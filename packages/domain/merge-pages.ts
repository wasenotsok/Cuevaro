import { draftSchema, extractText, fields, type Draft } from "./purchase";
import { draftItems } from "./review-items";
export function mergePageDrafts(
  pages: { draft: Draft; evidenceId: string }[],
  provider: string,
  version: string,
): Draft {
  if (pages.length < 1 || pages.length > 10) throw Error("INVALID_PAGE_BUNDLE");
  const parsed = pages.map((page) => {
    const draft = draftSchema.parse(page.draft);
    if (draft.observations.some((o) => o.evidenceId !== page.evidenceId))
      throw Error("UNBOUND_EVIDENCE");
    return { ...page, draft };
  });
  const uncertain = new Set([
    "conflicting_document_fields",
    "ambiguous_or_invalid_date",
    "ambiguous_or_invalid_amount",
  ]);
  const items = parsed.flatMap((p, i) =>
    draftItems(p.draft).map((c) => ({
      ...c,
      observation: {
        ...c.observation,
        pages: [i + 1],
        sources: [
          {
            evidenceId: p.evidenceId,
            page: i + 1,
            excerpt: c.observation.excerpt,
          },
        ],
      },
    })),
  );
  return draftSchema.parse({
    provider,
    version,
    ...(items.length > 1 ? { itemCandidates: items } : {}),
    observations: fields.map((field) => {
      const observed = parsed.map(
        (p) =>
          p.draft.observations.find((o) => o.field === field) ??
          extractText(
            "",
            p.evidenceId,
            "questionable",
            "2000-01-01",
          ).observations.find((o) => o.field === field)!,
      );
      const candidates = observed.filter((o) => o.value !== null),
        values = new Set(candidates.map((o) => o.value));
      const supporting = observed.flatMap((o, i) =>
        o.value !== null || uncertain.has(o.reason)
          ? [
              {
                evidenceId: parsed[i].evidenceId,
                page: i + 1,
                excerpt: o.excerpt,
              },
            ]
          : [],
      );
      if (values.size === 1 && !observed.some((o) => uncertain.has(o.reason))) {
        const first = candidates[0];
        return {
          ...first,
          confidence: "low",
          pages: supporting.map((s) => s.page),
          sources: supporting,
        };
      }
      return {
        ...observed[0],
        value: null,
        confidence: "unknown",
        excerpt: supporting
          .map((s) => s.excerpt)
          .filter(Boolean)
          .join(" | ")
          .slice(0, 400),
        pages: supporting.map((s) => s.page),
        sources: supporting,
        reason:
          values.size > 1 ||
          observed.some((o) => o.reason === "conflicting_document_fields")
            ? "conflicting_document_fields"
            : (observed.find((o) => uncertain.has(o.reason))?.reason ??
              "missing"),
      };
    }),
  });
}
