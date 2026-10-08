import { it, expect } from "vitest";
import sharp from "sharp";
import { receiptDate } from "../packages/domain/receipt-date";
import { extractText } from "../packages/domain/purchase";
import { extractOriginal } from "../services/worker/extract";
import { extractPdf } from "../services/worker/pdf";
import { syntheticPdf } from "../packages/test-fixtures/pdf";
import { mkdirSync, writeFileSync } from "node:fs";
it.each([
  ["2026/10/05", "2026-10-05"],
  ["05 Oct 2026", "2026-10-05"],
  ["October 5, 2026", "2026-10-05"],
  ["19/10/2026", "2026-10-19"],
  ["10/19/2026", "2026-10-19"],
  ["10/10/2026", "2026-10-10"],
  ["05/10/2026", null],
  ["10/05/2026", null],
  ["2026-02-30", null],
  ["30 Feb 2026", null],
  ["05 Sept 2026", null],
  ["May 1 26", null],
  ["2026-10-05 10:00", null],
])("normalizes only explicit unambiguous date %s", (raw, expected) =>
  expect(receiptDate(raw!)).toBe(expected),
);
it("keeps conflicts, invalid dates, unlabeled headers, policies and ambiguous money unknown", () => {
  const draft = extractText(
    "SYNTHETIC HEADER\nSubtotal: PHP 100\nTotal: $100.00\nTotal: PHP 1234,567\nDate: 05/10/2026\nReturn by: 19/10/2026\nReturn deadline: 20/10/2026\nWarranty ends: 30 days after purchase\nItem: First\nProduct: Second",
    "e",
    "good",
    "2026-10-06",
  );
  for (const field of [
    "merchant",
    "total",
    "currency",
    "purchaseDate",
    "returnDate",
    "warrantyDate",
    "item",
  ])
    expect(
      draft.observations.find((o) => o.field === field)?.value,
      field,
    ).toBeNull();
});
it("accepts explicit peso symbol and preserves raw excerpt while rejecting contradictory date evidence", () => {
  const draft = extractText(
    "Amount due: ₱1,299.00\nDate: 2026/10/05\nPurchase date: 05 Oct 2026",
    "e",
    "questionable",
    "2026-10-06",
  );
  expect(draft.observations.find((o) => o.field === "total")).toMatchObject({
    value: "1299.00",
    excerpt: "Amount due: ₱1,299.00",
    confidence: "low",
  });
  expect(draft.observations.find((o) => o.field === "currency")?.value).toBe(
    "PHP",
  );
  expect(
    draft.observations.find((o) => o.field === "purchaseDate")?.value,
  ).toBe("2026-10-05");
  expect(
    extractText(
      "Date: 05 Oct 2026\nPurchase date: 05/10/2026",
      "e",
      "good",
      "2026-10-06",
    ).observations.find((o) => o.field === "purchaseDate")?.value,
  ).toBeNull();
});
it.each([
  "Amount due: PHP 1234,567",
  "Total: $200.00",
  "Total: PHP 123456789012",
])("does not hide unsupported competing amount %s", async (invalid) => {
  const draft = extractText(
    `Total: PHP 100.00\n${invalid}`,
    "e",
    "questionable",
    "2026-10-06",
  );
  const pdf = await extractPdf(
    syntheticPdf([["Total: PHP 100.00"], [invalid]]),
    "e",
    "2026-10-06",
  );
  for (const result of [draft, pdf])
    for (const field of ["total", "currency"])
      expect(result.observations.find((o) => o.field === field)).toMatchObject({
        value: null,
        confidence: "unknown",
        reason: "ambiguous_or_invalid_amount",
      });
});
it("actual local OCR supports two labeled layouts and preserves normalized facts/raw evidence", async () => {
  const layouts = [
    [
      "Sold by: Synthetic Layout Shop",
      "Transaction date: 05 Oct 2026",
      "Product: Test toaster",
      "Amount due: PHP 1,299.00",
      "Return deadline: 19 Oct 2026",
      "Warranty until: Oct 5, 2027",
    ],
    [
      "Seller: Synthetic Layout Shop",
      "Date of purchase: 2026/10/05",
      "Item: Test toaster",
      "Grand Total: PHP 1299.00",
      "Return by: 19/10/2026",
      "Warranty ends: 2027-10-05",
    ],
  ];
  mkdirSync(".local/receipt-layouts", { recursive: true });
  const report = [];
  for (const [i, lines] of layouts.entries()) {
    const svg = `<svg width="1050" height="900"><rect width="1050" height="900" fill="white"/>${["SYNTHETIC TEST RECEIPT", ...lines, "Not a real purchase"].map((line, j) => `<text x="50" y="${90 + j * 100}" font-family="Arial" font-size="34" fill="black">${line}</text>`).join("")}</svg>`;
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(`.local/receipt-layouts/layout-${i}.png`, bytes);
    const draft = await extractOriginal(
      bytes,
      `synthetic-layout-${i}`,
      "questionable",
      "2026-10-06",
    );
    report.push(draft);
    for (const [field, value] of Object.entries({
      merchant: "Synthetic Layout Shop",
      purchaseDate: "2026-10-05",
      item: "Test toaster",
      total: "1299.00",
      returnDate: "2026-10-19",
      warrantyDate: "2027-10-05",
    }))
      expect(
        draft.observations.find((o) => o.field === field),
        `layout ${i}: ${field}`,
      ).toMatchObject({
        value,
        confidence: "low",
        evidenceId: `synthetic-layout-${i}`,
      });
  }
  writeFileSync(
    ".local/receipt-layouts/report.json",
    JSON.stringify(report, null, 2),
  );
});
