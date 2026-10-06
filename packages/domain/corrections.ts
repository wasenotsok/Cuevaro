import { z } from "zod";
import {
  derive,
  fields,
  validValue,
  type ConfirmedFact,
  type Lifecycle,
  type Cue,
} from "./purchase";
import type { ReviewedItem } from "./review-items";
export const correctionSchema = z
  .object({
    mutationId: z.uuid(),
    version: z.number().int().positive(),
    field: z.enum(fields),
    value: z.string().max(200).nullable(),
    itemId: z.uuid().optional(),
  })
  .strict();
export type Correction = z.infer<typeof correctionSchema>;
export type ItemFact = ConfirmedFact & { itemId: string };
export type CorrectableRecord = {
  id: string;
  version: number;
  facts: ConfirmedFact[];
  history?: ConfirmedFact[];
  items?: ReviewedItem[];
  itemHistory?: ItemFact[];
  events: Lifecycle[];
  cues: Cue[];
};
const offset = (c: Cue) =>
  /:(?:return|warranty):\d{4}-\d{2}-\d{2}:(\d+)(?:$|:revision:)/.exec(
    c.id,
  )?.[1];
export function correctRecord<T extends CorrectableRecord>(
  record: T,
  input: Correction,
  actorId: string,
  now: string,
  id: () => string,
): T {
  const command = correctionSchema.parse(input);
  if (command.version !== record.version) throw Error("STATE_CONFLICT");
  if (
    !validValue(command.field, command.value) ||
    (command.itemId && (command.field !== "item" || command.value === null))
  )
    throw Error("INVALID_FIELD");
  let facts = record.facts.map((f) => ({ ...f })),
    history = [...(record.history ?? record.facts)],
    items = record.items?.map((i) => ({ ...i })),
    itemHistory = [...(record.itemHistory ?? [])];
  const replaceFact = (old: ConfirmedFact): ConfirmedFact => ({
    ...old,
    id: id(),
    value: command.value,
    authority: "user_entered",
    actorId,
    confirmedAt: now,
    supersedesId: old.id,
  });
  if (command.itemId) {
    const item = items?.find((i) => i.id === command.itemId);
    if (!item || !item.factId) throw Error("ITEM_NOT_FOUND");
    if (item.name === command.value) throw Error("NO_CHANGE");
    const old = itemHistory.find((f) => f.id === item.factId);
    if (!old) throw Error("HISTORY_UNAVAILABLE");
    const next = { ...replaceFact(old), itemId: item.id };
    itemHistory.push(next);
    item.name = command.value!;
    item.authority = "user_entered";
    item.factId = next.id;
    if (item.candidateId === "single-item") {
      const main = facts.find((f) => f.field === "item");
      if (main) {
        const next = replaceFact(main);
        facts = facts.map((f) => (f.id === main.id ? next : f));
        history.push(next);
      }
    }
  } else {
    if (command.field === "item" && items?.length)
      throw Error("USE_ITEM_TARGET");
    const old = facts.find((f) => f.field === command.field);
    if (!old) throw Error("FIELD_NOT_FOUND");
    if (old.value === command.value) throw Error("NO_CHANGE");
    const next = replaceFact(old);
    facts = facts.map((f) => (f.id === old.id ? next : f));
    history.push(next);
  }
  const affected =
    command.field === "purchaseDate"
      ? new Set(["return", "warranty"])
      : command.field === "returnDate"
        ? new Set(["return"])
        : command.field === "warrantyDate"
          ? new Set(["warranty"])
          : new Set<string>();
  const timezone = record.events[0]?.timezone ?? "UTC",
    derived = derive(facts, timezone, record.id);
  const events = record.events.map((old) => {
    if (!affected.has(old.kind)) return { ...old };
    const next = derived.events.find((e) => e.kind === old.kind)!;
    return {
      ...next,
      status:
        old.status === "not_applicable" || old.status === "completed"
          ? old.status
          : next.status,
    };
  });
  const priorCues = record.cues.map((c) => {
    let intent = c.intent;
    if (!intent && c.state === "dismissed")
      intent = { type: "dismiss" as const, version: 0 };
    const days = offset(c),
      defaultDate = new Date(`${c.dueDate}T00:00:00Z`);
    if (days) defaultDate.setUTCDate(defaultDate.getUTCDate() - Number(days));
    if (
      !intent &&
      days &&
      c.state === "scheduled" &&
      record.events.some((e) => e.kind === c.kind && e.dueDate === c.dueDate) &&
      c.scheduledFor !== defaultDate.toISOString().slice(0, 10)
    )
      intent = { type: "snooze" as const, version: 0, date: c.scheduledFor };
    return { ...c, ...(intent ? { intent } : {}) };
  });
  const cues = priorCues.map((c) =>
    affected.has(c.kind) && ["scheduled", "delivered"].includes(c.state)
      ? { ...c, state: "cancelled" as const }
      : { ...c },
  );
  for (const cue of derived.cues) {
    if (
      !affected.has(cue.kind) ||
      events.find((e) => e.kind === cue.kind)?.status !== "active"
    )
      continue;
    const oldEvent = record.events.find((e) => e.kind === cue.kind);
    const prior = [...priorCues]
      .reverse()
      .find(
        (c) =>
          c.kind === cue.kind &&
          c.dueDate === oldEvent?.dueDate &&
          ["scheduled", "delivered", "dismissed"].includes(c.state) &&
          offset(c) === offset(cue),
      );
    const sameDeadline = cue.dueDate === oldEvent?.dueDate;
    const intent = priorCues
      .filter(
        (c) => c.kind === cue.kind && offset(c) === offset(cue) && c.intent,
      )
      .sort((a, b) => b.intent!.version - a.intent!.version)[0]?.intent;
    cues.push({
      ...cue,
      id: `${cue.id}:revision:${command.mutationId}`,
      state:
        intent?.type === "dismiss"
          ? "dismissed"
          : sameDeadline && prior?.state === "delivered"
            ? "delivered"
            : "scheduled",
      ...(intent ? { intent } : {}),
      scheduledFor:
        intent?.type === "snooze" &&
        intent.date &&
        intent.date <= cue.dueDate &&
        intent.date >= facts.find((f) => f.field === "purchaseDate")!.value!
          ? intent.date
          : cue.scheduledFor,
    });
  }
  return {
    ...record,
    facts,
    history,
    items,
    itemHistory,
    events,
    cues,
    version: record.version + 1,
  };
}
