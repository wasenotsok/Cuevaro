import { z } from "zod";
import {
  draftSchema,
  type Draft,
  type Observation,
  type ItemCandidate,
} from "./purchase";
export function draftItems(d: Draft): ItemCandidate[] {
  if (d.itemCandidates) return d.itemCandidates;
  const o = d.observations.find((o) => o.field === "item");
  return o?.value
    ? [
        {
          id: `${o.evidenceId}:item:single`,
          observation: { ...o, field: "item", value: o.value },
        },
      ]
    : [];
}
export const itemChoicesSchema = z
  .array(
    z
      .object({
        candidateId: z.string().min(1).max(250),
        name: z.string().trim().min(1).max(200).nullable(),
      })
      .strict(),
  )
  .max(20);
export type ItemChoice = z.infer<typeof itemChoicesSchema>[number];
export type ReviewedItem = {
  id: string;
  name: string;
  candidateId: string;
  observation: Observation;
  authority: "user_confirmed" | "user_entered";
  factId?: string;
};
export function initialItemFacts(
  items: ReviewedItem[],
  actorId: string,
  now: string,
) {
  return items.map((item) => ({
    id: item.factId!,
    itemId: item.id,
    field: "item" as const,
    value: item.name,
    observation: item.observation,
    authority: item.authority,
    actorId,
    confirmedAt: now,
  }));
}
export function reviewItems(
  draft: Draft,
  choices: ItemChoice[] | undefined,
  singleName: string | null,
  id: () => string,
): ReviewedItem[] {
  const d = draftSchema.parse(draft);
  if (!d.itemCandidates) {
    if (choices !== undefined) throw Error("UNEXPECTED_ITEM_CHOICES");
    const observation = d.observations.find((o) => o.field === "item")!;
    return [
      {
        id: id(),
        factId: id(),
        name: singleName ?? "Purchase",
        candidateId: "single-item",
        observation,
        authority:
          singleName === observation.value ? "user_confirmed" : "user_entered",
      },
    ];
  }
  const reviewed = itemChoicesSchema.parse(choices);
  if (
    reviewed.length !== d.itemCandidates.length ||
    new Set(reviewed.map((c) => c.candidateId)).size !== reviewed.length ||
    reviewed.some((c) => !d.itemCandidates!.some((p) => p.id === c.candidateId))
  )
    throw Error("EXPLICIT_ITEM_REVIEW_REQUIRED");
  const items = d.itemCandidates.flatMap((candidate) => {
    const choice = reviewed.find((c) => c.candidateId === candidate.id)!;
    return choice.name === null
      ? []
      : [
          {
            id: id(),
            factId: id(),
            name: choice.name,
            candidateId: candidate.id,
            observation: candidate.observation,
            authority:
              choice.name === candidate.observation.value
                ? ("user_confirmed" as const)
                : ("user_entered" as const),
          },
        ];
  });
  if (!items.length) throw Error("SELECT_AN_ITEM_TO_TRACK");
  return items;
}
