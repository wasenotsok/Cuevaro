import { isoDate, type Lifecycle, type Cue } from "./purchase";
export type AttentionRecord = {
  events: Lifecycle[];
  cues: Cue[];
  version: number;
};
export type AttentionCommand =
  | { type: "stop"; kind: "return" | "warranty" }
  | { type: "dismiss"; cueId: string }
  | { type: "snooze"; cueId: string; date: string };
export function updateAttention<T extends AttentionRecord>(
  record: T,
  command: AttentionCommand,
  expectedVersion: number,
  today: string,
): T {
  if (record.version !== expectedVersion) throw Error("STATE_CONFLICT");
  const events = record.events.map((e) => ({ ...e })),
    cues = record.cues.map((c) => ({ ...c }));
  if (command.type === "stop") {
    const event = events.find((e) => e.kind === command.kind);
    if (!event || event.status !== "active") throw Error("INVALID_EVENT");
    event.status = "not_applicable";
    for (const cue of cues)
      if (
        cue.kind === command.kind &&
        ["scheduled", "delivered"].includes(cue.state)
      )
        cue.state = "cancelled";
  } else {
    const cue = cues.find((c) => c.id === command.cueId);
    if (!cue || !["scheduled", "delivered"].includes(cue.state))
      throw Error("INVALID_CUE");
    if (command.type === "dismiss") cue.state = "dismissed";
    else {
      if (
        !isoDate.safeParse(command.date).success ||
        command.date < today ||
        command.date > cue.dueDate
      )
        throw Error("INVALID_SNOOZE_DATE");
      cue.scheduledFor = command.date;
      cue.state = "scheduled";
    }
  }
  return { ...record, events, cues, version: record.version + 1 };
}
