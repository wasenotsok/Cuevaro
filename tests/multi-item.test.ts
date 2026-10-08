import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { extractText } from "../packages/domain/purchase";
import { reviewItems } from "../packages/domain/review-items";
import { mergePageDrafts } from "../packages/domain/merge-pages";
import { extractPdf } from "../services/worker/pdf";
import { syntheticPdf } from "../packages/test-fixtures/pdf";
import { receiptPageSvg } from "../packages/test-fixtures/receipt-pages";
import {
  openDevelopmentDb,
  developmentActor as actor,
  createCapture,
  runOneJob,
  getDraft,
  confirmPurchase,
} from "../services/api/development";
import { getRecords } from "../services/api/records";
const lines = [
  "Merchant: Synthetic Multi Shop",
  "Date: 2026-10-05",
  "Item: Electric kettle",
  "Product: Synthetic toaster",
  "Total: PHP 2000.00",
  "Return by: 2026-10-19",
  "Warranty ends: 2027-10-05",
];
it("requires a decision for every item and retains corrected/skipped source without guessing quantities", () => {
  const d = extractText(lines.join("\n"), "e", "questionable", "2026-10-06");
  expect(d.observations.find((o) => o.field === "item")?.value).toBeNull();
  expect(d.itemCandidates).toHaveLength(2);
  expect(() => reviewItems(d, undefined, null, randomUUID)).toThrow();
  const choices = d.itemCandidates!.map((c) => ({
    candidateId: c.id,
    name: c.observation.value,
  }));
  expect(() => reviewItems(d, choices.slice(0, 1), null, randomUUID)).toThrow(
    "EXPLICIT_ITEM_REVIEW_REQUIRED",
  );
  expect(() =>
    reviewItems(d, [choices[0], choices[0]], null, randomUUID),
  ).toThrow("EXPLICIT_ITEM_REVIEW_REQUIRED");
  expect(() =>
    reviewItems(
      d,
      choices.map((c) => ({ ...c, candidateId: "foreign" })),
      null,
      randomUUID,
    ),
  ).toThrow("EXPLICIT_ITEM_REVIEW_REQUIRED");
  expect(() =>
    reviewItems(
      d,
      choices.map((c) => ({ ...c, name: null })),
      null,
      randomUUID,
    ),
  ).toThrow("SELECT_AN_ITEM_TO_TRACK");
  const items = reviewItems(
    d,
    [
      { ...choices[0], name: "Corrected kettle" },
      { ...choices[1], name: null },
    ],
    null,
    randomUUID,
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    name: "Corrected kettle",
    authority: "user_entered",
    observation: {
      value: "Electric kettle",
      excerpt: "Item: Electric kettle",
      evidenceId: "e",
    },
  });
});
it("preserves repeated candidates and distinct page provenance for PDFs and photo assembly", async () => {
  const pdf = await extractPdf(
    syntheticPdf([["Item: Same item"], ["Item: Same item"]]),
    "pdf",
    "2026-10-06",
  );
  expect(pdf.itemCandidates).toHaveLength(2);
  expect(new Set(pdf.itemCandidates!.map((c) => c.id)).size).toBe(2);
  expect(pdf.itemCandidates!.map((c) => c.observation.pages)).toEqual([
    [1],
    [2],
  ]);
  const merged = mergePageDrafts(
    ["one", "two"].map((evidenceId) => ({
      evidenceId,
      draft: extractText(
        "Item: Same item",
        evidenceId,
        "questionable",
        "2026-10-06",
      ),
    })),
    "test",
    "test",
  );
  expect(
    merged.itemCandidates!.map((c) => c.observation.sources?.[0].evidenceId),
  ).toEqual(["one", "two"]);
});
it("actual multi-item OCR persists reviewed item-specific assertions and one receipt lifecycle", async () => {
  const original = await sharp(Buffer.from(receiptPageSvg(lines, 1)))
    .png()
    .toBuffer();
  mkdirSync(".local/multi-item", { recursive: true });
  writeFileSync(".local/multi-item/receipt.png", original);
  const db = await openDevelopmentDb();
  try {
    const c = await createCapture(db, actor, randomUUID(), original, true);
    await runOneJob(db);
    const d = (await getDraft(db, actor, c.id)).draft!;
    expect(d.itemCandidates!.map((c) => c.observation.value)).toEqual([
      "Electric kettle",
      "Synthetic toaster",
    ]);
    const values = Object.fromEntries(
      d.observations.map((o) => [o.field, o.value]),
    );
    await expect(confirmPurchase(db, actor, c.id, values)).rejects.toThrow();
    expect((await db.query("select * from purchases")).rows).toHaveLength(0);
    const choices = d.itemCandidates!.map((c, i) => ({
      candidateId: c.id,
      name: i ? c.observation.value : "Reviewed kettle",
    }));
    const record = await confirmPurchase(db, actor, c.id, values, choices);
    expect(record.items).toHaveLength(2);
    const saved = (await getRecords(db, actor))[0];
    expect(saved.items.map((i) => i.name).sort()).toEqual([
      "Reviewed kettle",
      "Synthetic toaster",
    ]);
    expect(saved.items.find((i) => i.name === "Reviewed kettle")).toMatchObject(
      {
        authority: "user_entered",
        observation: {
          value: "Electric kettle",
          evidenceId: d.itemCandidates![0].observation.evidenceId,
        },
      },
    );
    expect(saved.events).toHaveLength(2);
    expect((await db.query("select * from purchases")).rows).toHaveLength(1);
    expect((await db.query("select * from items")).rows).toHaveLength(2);
    expect(
      (
        await db.query(
          "select * from fact_assertions where item_id is not null",
        )
      ).rows,
    ).toHaveLength(2);
    await expect(
      confirmPurchase(db, actor, c.id, values, choices),
    ).rejects.toThrow("STATE_CONFLICT");
    const other = await createCapture(
      db,
      actor,
      randomUUID(),
      await sharp(
        Buffer.from(
          receiptPageSvg(
            ["Merchant: Other synthetic shop", ...lines.slice(1)],
            1,
          ),
        ),
      )
        .png()
        .toBuffer(),
      true,
    );
    await runOneJob(db, async (_, e) =>
      extractText(lines.join("\n"), e, "questionable", "2026-10-06"),
    );
    const otherDraft = (await getDraft(db, actor, other.id)).draft!;
    const second = await confirmPurchase(
      db,
      actor,
      other.id,
      values,
      otherDraft.itemCandidates!.map((c) => ({
        candidateId: c.id,
        name: c.observation.value,
      })),
    );
    const itemFact = (
      await db.query<{ id: string }>(
        "select id from fact_assertions where purchase_id=$1 and item_id is not null limit 1",
        [record.id],
      )
    ).rows[0];
    await expect(
      db.query(
        `insert into fact_assertions(id,household_id,purchase_id,item_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) select gen_random_uuid(),household_id,$1,item_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id from fact_assertions where id=$2`,
        [second.id, itemFact.id],
      ),
    ).rejects.toThrow();
    const returnFact = record.facts.find((f) => f.field === "returnDate")!;
    const successor = `insert into fact_assertions(id,household_id,purchase_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id,supersedes_id) select gen_random_uuid(),household_id,$1,$2,value,authority_type,source_observation_id,confirmed_by_user_id,id from fact_assertions where id=$3`;
    await expect(
      db.query(successor, [second.id, "returnDate", returnFact.id]),
    ).rejects.toThrow();
    await expect(
      db.query(successor, [record.id, "merchant", returnFact.id]),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
