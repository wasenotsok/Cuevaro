import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { syntheticPdf } from "../packages/test-fixtures/pdf";
import { pdfText, extractPdf } from "../services/worker/pdf";
import { extractText } from "../packages/domain/purchase";
import { pdfQuality, mayExtract } from "../packages/domain/quality";
import {
  openDevelopmentDb,
  developmentActor as actor,
  createCapture,
  runOneJob,
  getDraft,
  confirmPurchase,
} from "../services/api/development";
const pages = [
  [
    "Merchant: Synthetic PDF Shop",
    "Date: 2026-10-05",
    "Item: Test toaster",
    "Total: PHP 1299.00",
  ],
  ["Return by: 2026-10-19", "Warranty ends: 2027-10-05"],
];
it("extracts actual PDF text with page provenance, explicit review and immutable original retention", async () => {
  const bytes = syntheticPdf(pages);
  const db = await openDevelopmentDb();
  try {
    await expect(
      createCapture(db, actor, randomUUID(), bytes, false),
    ).rejects.toThrow("QUALITY_REVIEW_REQUIRED");
    const c = await createCapture(db, actor, randomUUID(), bytes, true);
    await runOneJob(db);
    const result = await getDraft(db, actor, c.id);
    expect(result.state).toBe("review_ready");
    expect(result.draft!.provider).toBe("pdfjs-local-text");
    expect(
      result.draft!.observations.find((o) => o.field === "returnDate"),
    ).toMatchObject({ value: "2026-10-19", confidence: "low", pages: [2] });
    const record = await confirmPurchase(
      db,
      actor,
      c.id,
      Object.fromEntries(
        result.draft!.observations.map((o) => [o.field, o.value]),
      ),
    );
    expect(record.events[0].status).toBe("active");
    const stored = await db.query<{
      original: Uint8Array;
      source_locator: { pages: number[] };
    }>(
      "select b.original,o.source_locator from private.evidence_bytes b join observations o on o.evidence_id=b.evidence_id where o.field_name='returnDate'",
    );
    expect(stored.rows[0].original).toEqual(bytes);
    expect(stored.rows[0].source_locator.pages).toEqual([2]);
  } finally {
    await db.close();
  }
});
it("keeps conflicting multi-page values unknown rather than selecting the last page", async () => {
  const draft = await extractPdf(
    syntheticPdf([["Total: PHP 10.00"], ["Total: PHP 20.00"]]),
    "synthetic-evidence",
    "2026-10-06",
  );
  expect(draft.observations.find((o) => o.field === "total")).toMatchObject({
    value: null,
    confidence: "unknown",
    reason: "conflicting_document_fields",
  });
});
it("refuses conflicting labels on a single page and does not hide them behind another page", async () => {
  expect(
    extractText(
      "Item: First\nItem: Second",
      "e",
      "good",
      "2026-10-06",
    ).observations.find((o) => o.field === "item"),
  ).toMatchObject({ value: null, reason: "conflicting_document_fields" });
  const draft = await extractPdf(
    syntheticPdf([["Item: First", "Item: Second"], ["Item: First"]]),
    "e",
    "2026-10-06",
  );
  expect(draft.observations.find((o) => o.field === "item")).toMatchObject({
    value: null,
    reason: "conflicting_document_fields",
  });
});
it("retains unsupported PDF originals and terminalizes deterministic failures without retry loops", async () => {
  const db = await openDevelopmentDb();
  const bytes = syntheticPdf([[]]);
  try {
    const c = await createCapture(db, actor, randomUUID(), bytes, true);
    await runOneJob(db);
    expect(await getDraft(db, actor, c.id)).toMatchObject({
      state: "failed",
      draft: null,
      errorCode: "PDF_NO_TEXT",
    });
    expect(
      (await db.query<{ state: string }>("select state from jobs")).rows[0]
        .state,
    ).toBe("dead_letter");
    expect(
      (
        await db.query<{ original: Uint8Array }>(
          "select original from private.evidence_bytes",
        )
      ).rows[0].original,
    ).toEqual(bytes);
  } finally {
    await db.close();
  }
});
it("refuses password, corruption, page limits, empty text and bounded-process timeout", async () => {
  await expect(
    pdfText(
      syntheticPdf(
        Array.from({ length: 10 }, () =>
          Array.from({ length: 200 }, () => "x".repeat(70)),
        ),
      ),
    ),
  ).rejects.toThrow("PDF_TEXT_LIMIT");
  await expect(
    pdfText(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(20000000)])),
  ).rejects.toThrow("PDF_INVALID_SIZE_OR_HEADER");
  await expect(pdfText(syntheticPdf(pages, true))).rejects.toThrow(
    "PDF_PASSWORD_REQUIRED",
  );
  await expect(
    pdfText(new TextEncoder().encode("%PDF-broken")),
  ).rejects.toThrow("PDF_INVALID");
  await expect(
    pdfText(syntheticPdf(Array.from({ length: 11 }, () => ["SYNTHETIC"]))),
  ).rejects.toThrow("PDF_PAGE_LIMIT");
  await expect(pdfText(syntheticPdf([[]]))).rejects.toThrow("PDF_NO_TEXT");
  await expect(pdfText(syntheticPdf(pages), 1)).rejects.toThrow(
    "PDF_PROCESS_TIMEOUT",
  );
});
it("does not treat invisible embedded text as verified visible evidence", async () => {
  const draft = await extractPdf(
    syntheticPdf([["Return by: 2026-10-19"]], false, true),
    "e",
    "2026-10-06",
  );
  expect(
    draft.observations.find((o) => o.field === "returnDate"),
  ).toMatchObject({ value: "2026-10-19", confidence: "low" });
  const quality = pdfQuality();
  expect(quality.grade).toBe("questionable");
  expect(mayExtract(quality, false)).toBe(false);
  expect(quality.limits.join(" ")).toContain("Embedded text may be hidden");
});
