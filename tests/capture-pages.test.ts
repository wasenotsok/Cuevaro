import { it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { pageManifest, pagesQuality } from "../packages/domain/capture-pages";
import { assemblePage, capturePages } from "../apps/mobile/pages";
import type { Capture } from "../apps/mobile/storage";
import { extractText } from "../packages/domain/purchase";
import { mergePageDrafts } from "../packages/domain/merge-pages";
import {
  openDevelopmentDb,
  developmentActor as actor,
  createPageCapture,
  runOneJob,
  getDraft,
  confirmPurchase,
} from "../services/api/development";
import {
  receiptPhotoPages,
  receiptPageSvg,
} from "../packages/test-fixtures/receipt-pages";
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const sample = (
  id: string,
  v: number,
  grade: "good" | "questionable" | "bad" = "questionable",
): Capture => ({
  id,
  bytes: new Uint8Array([v]),
  hash: hash(new Uint8Array([v])),
  mime: "image/png",
  createdAt: "2026-10-06T00:00:00Z",
  state: "local_pending",
  quality: {
    grade,
    findings: grade === "bad" ? ["blur"] : [],
    version: "quality-v2",
    limits: [],
  },
});
it("keeps ordered page identity, bad-page refusal, replacements and originals across metadata restart", async () => {
  const first = sample("first", 1),
    bad = sample("bad", 2, "bad"),
    replacement = sample("replacement", 3);
  const [root] = await assemblePage(first, bad, [first, bad], async (s) =>
    hash(s),
  );
  expect(root.quality?.grade).toBe("bad");
  expect(root.bytes).toEqual(first.bytes);
  expect(root.originalHash).toBe(first.hash);
  const [fixed] = await assemblePage(
    root,
    replacement,
    [root, bad, replacement],
    async (s) => hash(s),
    1,
  );
  expect(fixed.retiredPageIds).toEqual(["bad"]);
  expect(fixed.quality?.grade).toBe("questionable");
  expect(
    capturePages(fixed, [fixed, bad, replacement]).map((p) => p.id),
  ).toEqual(["first", "replacement"]);
  const metadata = JSON.parse(JSON.stringify({ ...fixed, bytes: undefined }));
  expect(
    capturePages({ ...metadata, bytes: first.bytes }, [bad, replacement]).map(
      (p) => hash(p.bytes),
    ),
  ).toEqual([first.hash, replacement.hash]);
  await expect(
    assemblePage(
      { ...fixed, assemblySealed: true },
      sample("four", 4),
      [fixed, bad, replacement],
      async (s) => hash(s),
    ),
  ).rejects.toThrow("ASSEMBLY_ALREADY_SEALED");
  expect(() => capturePages(fixed, [bad])).toThrow("MISSING_PAGE_ORIGINAL");
  expect(pagesQuality([first.quality!, bad.quality!]).grade).toBe("bad");
  for (const locked of [
    { assemblySealed: true },
    { serverId: "remote" },
    {
      draft: extractText(
        "Item: Synthetic",
        "bad",
        "questionable",
        "2026-10-06",
      ),
    },
  ]) {
    await expect(
      assemblePage(first, { ...bad, ...locked }, [first, bad], async (s) =>
        hash(s),
      ),
    ).rejects.toThrow("PHOTO_PAGES_ONLY");
  }
});
it("bounds active pages/bytes and rejects repeated originals", () => {
  expect(() => pageManifest(["a".repeat(64), "a".repeat(64)], [1, 1])).toThrow(
    "INVALID_PAGE_BUNDLE",
  );
  expect(() => pageManifest(["a".repeat(64)], [20000001])).toThrow(
    "INVALID_PAGE_BUNDLE",
  );
  expect(() =>
    pageManifest(
      Array.from({ length: 11 }, (_, i) => hash(String(i))),
      Array(11).fill(1),
    ),
  ).toThrow("INVALID_PAGE_BUNDLE");
});
it("keeps competing photo-page deadlines and malformed monetary evidence Unknown with both sources", () => {
  const pages = [
    "Return by: 2026-10-19\nTotal: USD 20.00",
    "Return by: 2026-10-20\nTotal: USD 1,23.00",
  ].map((text, i) => ({
    evidenceId: `page-${i + 1}`,
    draft: extractText(text, `page-${i + 1}`, "questionable", "2026-10-06"),
  }));
  const merged = mergePageDrafts(pages, "synthetic-test", "test");
  for (const field of ["returnDate", "total", "currency"]) {
    const o = merged.observations.find((o) => o.field === field)!;
    expect(o.value).toBeNull();
    expect(o.confidence).toBe("unknown");
    expect(o.sources?.map((s) => s.evidenceId)).toEqual(["page-1", "page-2"]);
  }
});
it("revocation after page one prevents further extraction and retains both originals without a draft", async () => {
  const db = await openDevelopmentDb();
  try {
    const originals = await Promise.all(
      receiptPhotoPages.map((p, i) =>
        sharp(Buffer.from(receiptPageSvg(p, i + 1)))
          .png()
          .toBuffer(),
      ),
    );
    const c = await createPageCapture(db, actor, randomUUID(), originals, true);
    let calls = 0;
    await runOneJob(db, async (_, id) => {
      calls++;
      await db.query(
        "update household_memberships set revoked_at=now() where household_id=$1 and user_id=$2",
        [actor.householdId, actor.userId],
      );
      return extractText("Item: Synthetic", id, "questionable", "2026-10-06");
    });
    expect(calls).toBe(1);
    expect(
      (await db.query("select * from private.review_drafts")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from private.evidence_bytes")).rows,
    ).toHaveLength(2);
    await expect(getDraft(db, actor, c.id)).rejects.toThrow("ACCESS_DENIED");
  } finally {
    await db.close();
  }
});
it("actual OCR merges page evidence, atomically preserves originals and creates one reviewed lifecycle", async () => {
  const originals = await Promise.all(
    receiptPhotoPages.map((p, i) =>
      sharp(Buffer.from(receiptPageSvg(p, i + 1)))
        .png()
        .toBuffer(),
    ),
  );
  mkdirSync(".local/receipt-pages", { recursive: true });
  originals.forEach((p, i) =>
    writeFileSync(`.local/receipt-pages/page-${i + 1}.png`, p),
  );
  const db = await openDevelopmentDb();
  try {
    const id = randomUUID();
    const c = await createPageCapture(db, actor, id, originals, true);
    const manifest = pageManifest(
      originals.map(hash),
      originals.map((p) => p.length),
    )!;
    expect(c.hash).toBe(hash(manifest));
    expect(
      (await createPageCapture(db, actor, randomUUID(), originals, true)).id,
    ).toBe(c.id);
    await expect(
      createPageCapture(db, actor, id, [...originals].reverse(), true),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await runOneJob(db);
    const result = await getDraft(db, actor, c.id);
    expect(result.state).toBe("review_ready");
    const rows = (
      await db.query<{
        id: string;
        page_number: number;
        original: Uint8Array;
        sha256: string;
      }>(
        "select e.id,e.page_number,e.sha256,b.original from evidence_objects e join private.evidence_bytes b on b.evidence_id=e.id order by e.page_number",
      )
    ).rows;
    expect(rows.map((r) => r.sha256)).toEqual(originals.map(hash));
    rows.forEach((r, i) =>
      expect(
        Buffer.from(r.original).equals(originals[i]),
        `original page ${i + 1}`,
      ).toBe(true),
    );
    const date = result.draft!.observations.find(
      (o) => o.field === "returnDate",
    )!;
    expect(date).toMatchObject({
      value: "2026-10-19",
      confidence: "low",
      evidenceId: rows[1].id,
      pages: [2],
      sources: [
        { evidenceId: rows[1].id, page: 2, excerpt: "Return by: 2026-10-19" },
      ],
    });
    const record = await confirmPurchase(
      db,
      actor,
      c.id,
      Object.fromEntries(
        result.draft!.observations.map((o) => [o.field, o.value]),
      ),
    );
    expect(record.events[0].status).toBe("active");
    expect((await db.query("select * from purchases")).rows).toHaveLength(1);
    writeFileSync(
      ".local/receipt-pages/report.json",
      JSON.stringify(result.draft, null, 2),
    );
  } finally {
    await db.close();
  }
});
it("refuses a bad page and foreign evidence metadata without committing purchase facts", async () => {
  const db = await openDevelopmentDb();
  const originals = await Promise.all(
    receiptPhotoPages.map((p, i) =>
      sharp(Buffer.from(receiptPageSvg(p, i + 1)))
        .png()
        .toBuffer(),
    ),
  );
  try {
    const bad = await sharp({
      create: { width: 800, height: 800, channels: 3, background: "#080808" },
    })
      .png()
      .toBuffer();
    await expect(
      createPageCapture(db, actor, randomUUID(), [originals[0], bad], true),
    ).rejects.toThrow("QUALITY_REVIEW_REQUIRED");
    await expect(
      createPageCapture(
        db,
        actor,
        randomUUID(),
        [originals[0], originals[0]],
        true,
      ),
    ).rejects.toThrow("INVALID_PAGE_BUNDLE");
    const c = await createPageCapture(db, actor, randomUUID(), originals, true);
    await runOneJob(db, async (_, id) => {
      const d = extractText(
        "Item: Synthetic",
        id,
        "questionable",
        "2026-10-06",
      );
      d.observations[0].sources = [
        { evidenceId: randomUUID(), page: 1, excerpt: "forged" },
      ];
      return d;
    });
    expect((await getDraft(db, actor, c.id)).state).toBe("failed");
    expect((await db.query("select * from purchases")).rows).toHaveLength(0);
    expect(
      (await db.query("select * from private.evidence_bytes")).rows,
    ).toHaveLength(2);
  } finally {
    await db.close();
  }
});
