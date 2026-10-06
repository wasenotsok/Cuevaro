import { it, expect } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { imageQuality } from "../services/api/development";
import { extractOriginal } from "../services/worker/extract";
import { fields, type Field } from "../packages/domain/purchase";
import { mayExtract } from "../packages/domain/quality";
import { syntheticReceiptSvg } from "../packages/test-fixtures/receipt";

// Versioned generated corpus; no real household evidence or representative-camera claim.
it("measures the quality-gated real OCR pipeline over ugly synthetic inputs without hiding skips or wrong candidates", async () => {
  const original = await sharp(Buffer.from(syntheticReceiptSvg()))
    .png()
    .toBuffer();
  const cases = {
    crisp: original,
    duplicate: original,
    blur: await sharp(original).blur(8).png().toBuffer(),
    glare: await sharp(original)
      .composite([
        {
          input: Buffer.from(
            '<svg width="650" height="450"><rect width="650" height="450" fill="white"/></svg>',
          ),
          left: 100,
          top: 200,
        },
      ])
      .png()
      .toBuffer(),
    low_light: await sharp(original)
      .modulate({ brightness: 0.1 })
      .png()
      .toBuffer(),
    cut_off: await sharp(original)
      .extract({ left: 120, top: 220, width: 680, height: 630 })
      .png()
      .toBuffer(),
    faded_thermal: await sharp(original).linear(0.12, 210).png().toBuffer(),
    skew: await sharp(original)
      .rotate(25, { background: "#888" })
      .png()
      .toBuffer(),
    small_text: await sharp(original).resize({ width: 160 }).png().toBuffer(),
    missing_fields: await sharp(
      Buffer.from(
        syntheticReceiptSvg()
          .replace("Return by: 2026-10-19", "No return deadline stated")
          .replace("Warranty ends: 2027-10-05", "No warranty deadline stated"),
      ),
    )
      .png()
      .toBuffer(),
    monospace: await sharp(
      Buffer.from(
        syntheticReceiptSvg().replaceAll(
          'font-family="Arial"',
          'font-family="monospace"',
        ),
      ),
    )
      .png()
      .toBuffer(),
    jpeg_artifacts: await sharp(original).jpeg({ quality: 15 }).toBuffer(),
    conflicting_deadline: await sharp(
      Buffer.from(
        syntheticReceiptSvg().replace(
          "Not a real purchase",
          "Return by: 2026-10-22",
        ),
      ),
    )
      .png()
      .toBuffer(),
    relative_policy: await sharp(
      Buffer.from(
        syntheticReceiptSvg()
          .replace("Return by: 2026-10-19", "Returns within fourteen days")
          .replace("Warranty ends: 2027-10-05", "Warranty valid one year"),
      ),
    )
      .png()
      .toBuffer(),
    unlabeled_merchant: await sharp(
      Buffer.from(
        syntheticReceiptSvg().replace(
          "Merchant: Synthetic Appliances",
          "Synthetic Appliances",
        ),
      ),
    )
      .png()
      .toBuffer(),
    ambiguous_date: await sharp(
      Buffer.from(
        syntheticReceiptSvg().replace("Date: 2026-10-05", "Date: 05/10/2026"),
      ),
    )
      .png()
      .toBuffer(),
  };
  const truth: Record<Field, string | null> = {
    merchant: "Synthetic Appliances",
    purchaseDate: "2026-10-05",
    total: "1299.00",
    currency: "PHP",
    item: "Electric kettle",
    returnDate: "2026-10-19",
    warrantyDate: "2027-10-05",
  };
  const results: {
    case: string;
    sha256: string;
    quality: Awaited<ReturnType<typeof imageQuality>>;
    outcome: "quality_blocked" | "review_required";
    elapsedMs: number;
    metrics:
      | {
          field: Field;
          expected: string | null;
          actual: string | null;
          normalizedMatch: boolean;
          confidence: string;
          excerpt: string;
        }[]
      | null;
  }[] = [];
  let extracted = 0,
    skipped = 0,
    falseHighConfidence = 0;
  mkdirSync(".local/extraction-benchmark-v2", { recursive: true });
  for (const [name, bytes] of Object.entries(cases)) {
    const started = performance.now();
    const quality = await imageQuality(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(`.local/extraction-benchmark-v2/${name}.png`, bytes);
    if (!mayExtract(quality, true)) {
      skipped++;
      results.push({
        case: name,
        sha256,
        quality,
        outcome: "quality_blocked",
        metrics: null,
        elapsedMs: performance.now() - started,
      });
      continue;
    }
    // Explicit continuation here models reviewed Questionable input, never a Bad bypass.
    extracted++;
    const draft = await extractOriginal(
      bytes,
      `synthetic:${sha256}`,
      "questionable",
      "2026-10-06",
    );
    const expected = { ...truth };
    if (name === "missing_fields" || name === "relative_policy")
      expected.returnDate = expected.warrantyDate = null;
    if (name === "ambiguous_date") expected.purchaseDate = null;
    if (name === "conflicting_deadline") expected.returnDate = null;
    if (name === "unlabeled_merchant") expected.merchant = null;
    const metrics = fields.map((field) => {
      const observation = draft.observations.find((o) => o.field === field)!;
      expect(observation.evidenceId).toBe(`synthetic:${sha256}`);
      expect(["low", "unknown"]).toContain(observation.confidence);
      const match = observation.value === expected[field];
      if (!match && observation.confidence === "high") falseHighConfidence++;
      return {
        field,
        expected: expected[field],
        actual: observation.value,
        normalizedMatch: match,
        confidence: observation.confidence,
        excerpt: observation.excerpt,
      };
    });
    if (name === "crisp" || name === "duplicate")
      expect(metrics.every((m) => m.normalizedMatch)).toBe(true);
    if (name === "missing_fields" || name === "relative_policy")
      expect(
        metrics
          .filter((m) => m.field === "returnDate" || m.field === "warrantyDate")
          .every((m) => m.actual === null),
      ).toBe(true);
    if (name === "conflicting_deadline")
      expect(metrics.find((m) => m.field === "returnDate")!.actual).toBeNull();
    if (name === "unlabeled_merchant")
      expect(metrics.find((m) => m.field === "merchant")!.actual).toBeNull();
    if (name === "ambiguous_date")
      expect(
        metrics.find((m) => m.field === "purchaseDate")?.actual,
      ).toBeNull();
    results.push({
      case: name,
      sha256,
      quality,
      outcome: "review_required",
      metrics,
      elapsedMs: performance.now() - started,
    });
  }
  expect(skipped).toBeGreaterThanOrEqual(4);
  expect(extracted).toBeGreaterThanOrEqual(4);
  expect(falseHighConfidence).toBe(0);
  expect(results[0].sha256).toBe(results[1].sha256);
  for (const name of ["crisp", "duplicate", "missing_fields", "ambiguous_date"])
    expect(results.find((r) => r.case === name)?.outcome).toBe(
      "review_required",
    );
  const perField = fields.map((field) => {
    const observations = results.flatMap(
      (r) => r.metrics?.filter((m) => m.field === field) ?? [],
    );
    return {
      field,
      evaluated: observations.length,
      normalizedMatches: observations.filter((m) => m.normalizedMatch).length,
      correctCandidates: observations.filter(
        (m) => m.actual !== null && m.normalizedMatch,
      ).length,
      wrongCandidates: observations.filter(
        (m) => m.actual !== null && !m.normalizedMatch,
      ).length,
      correctUnknowns: observations.filter(
        (m) => m.actual === null && m.expected === null,
      ).length,
      missingCandidates: observations.filter(
        (m) => m.actual === null && m.expected !== null,
      ).length,
    };
  });
  writeFileSync(
    ".local/extraction-benchmark-v2/report.json",
    JSON.stringify(
      {
        version: "synthetic-quality-extraction-v2",
        representative: false,
        truthBasis:
          "generated full original; damaged candidates may differ and remain review-required",
        provider: "tesseract-7+receipt-text-v3",
        extracted,
        skipped,
        falseHighConfidence,
        perField,
        results,
      },
      null,
      2,
    ),
  );
}, 90000);
