import { it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import sharp from "sharp";
import { correctRecord, type Correction } from "../packages/domain/corrections";
import { extractText } from "../packages/domain/purchase";
import {
  syntheticReceiptSvg,
  syntheticReceiptText,
} from "../packages/test-fixtures/receipt";
import {
  openDevelopmentDb,
  developmentActor as actor,
  createCapture,
  runOneJob,
  getDraft,
  confirmPurchase,
  correctPurchase,
  changeAttention,
} from "../services/api/development";
import { getRecords } from "../services/api/records";
const command = (
  version: number,
  field: Correction["field"] = "returnDate",
  value: string | null = "2026-10-21",
): Correction => ({ mutationId: randomUUID(), version, field, value });
async function fixture(db: Awaited<ReturnType<typeof openDevelopmentDb>>) {
  const bytes = await sharp(Buffer.from(syntheticReceiptSvg()))
    .png()
    .toBuffer();
  const capture = await createCapture(db, actor, randomUUID(), bytes, true);
  await runOneJob(db, async (_, e) =>
    extractText(syntheticReceiptText, e, "questionable", "2026-10-06"),
  );
  const draft = (await getDraft(db, actor, capture.id)).draft!;
  const record = await confirmPurchase(
    db,
    actor,
    capture.id,
    Object.fromEntries(draft.observations.map((o) => [o.field, o.value])),
  );
  return { record, bytes };
}
it("correction keeps immutable sources and histories while replacing default cues and respecting dismiss/snooze/Stop", async () => {
  const db = await openDevelopmentDb();
  try {
    const { record } = await fixture(db);
    const old = record.facts.find((f) => f.field === "returnDate")!;
    const updated = correctRecord(
      record,
      command(1),
      actor.userId,
      "2026-10-06T00:00:00Z",
      randomUUID,
    );
    expect(updated.facts.find((f) => f.field === "returnDate")).toMatchObject({
      value: "2026-10-21",
      supersedesId: old.id,
      observation: old.observation,
    });
    expect(record.facts.find((f) => f.field === "returnDate")?.value).toBe(
      "2026-10-19",
    );
    expect(updated.history).toHaveLength(8);
    expect(
      updated.cues
        .filter((c) => c.kind === "return" && c.state === "scheduled")
        .map((c) => c.scheduledFor),
    ).toEqual(["2026-10-14", "2026-10-19"]);
    const modified = {
      ...record,
      cues: record.cues.map((c, i) =>
        c.kind === "return"
          ? {
              ...c,
              state: i === 0 ? ("dismissed" as const) : ("scheduled" as const),
              scheduledFor: i === 0 ? c.scheduledFor : "2026-10-18",
            }
          : c,
      ),
    };
    const respected = correctRecord(
      modified,
      command(1),
      actor.userId,
      "2026-10-06T00:00:00Z",
      randomUUID,
    );
    expect(
      respected.cues
        .filter((c) => c.id.includes(":revision:") && c.kind === "return")
        .map((c) => [c.state, c.scheduledFor]),
    ).toEqual([
      ["dismissed", "2026-10-14"],
      ["scheduled", "2026-10-18"],
    ]);
    const unknown = correctRecord(
      respected,
      command(2, "returnDate", null),
      actor.userId,
      "2026-10-06T00:00:00Z",
      randomUUID,
    );
    const restored = correctRecord(
      unknown,
      command(3),
      actor.userId,
      "2026-10-06T00:00:00Z",
      randomUUID,
    );
    expect(
      restored.cues
        .filter(
          (c) =>
            c.kind === "return" &&
            c.id.endsWith(restored.cues.at(-1)!.id.split(":revision:")[1]),
        )
        .map((c) => [c.state, c.scheduledFor]),
    ).toEqual([
      ["dismissed", "2026-10-14"],
      ["scheduled", "2026-10-18"],
    ]);
    const stopped = await changeAttention(
      db,
      actor,
      record.id,
      { type: "stop", kind: "return" },
      1,
    );
    const afterStop = correctRecord(
      { ...record, ...stopped },
      command(2),
      actor.userId,
      "2026-10-06T00:00:00Z",
      randomUUID,
    );
    expect(afterStop.events.find((e) => e.kind === "return")?.status).toBe(
      "not_applicable",
    );
    expect(
      afterStop.cues.some(
        (c) => c.kind === "return" && c.state === "scheduled",
      ),
    ).toBe(false);
  } finally {
    await db.close();
  }
});
it("durable correction atomically reschedules, survives restart and replay, retains exact original and refuses stale/conflicting requests", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cuevaro-correction-"));
  let db = await openDevelopmentDb(dir);
  try {
    const { record, bytes } = await fixture(db),
      input = command(1);
    const updated = await correctPurchase(db, actor, record.id, input);
    expect(updated.version).toBe(2);
    expect(updated.appliedVersion).toBe(2);
    expect(updated.history).toHaveLength(8);
    const first = updated.facts.find((f) => f.field === "returnDate")!;
    expect(first.observation.value).toBe("2026-10-19");
    expect(first.value).toBe("2026-10-21");
    expect(first.supersedesId).toBe(
      record.facts.find((f) => f.field === "returnDate")!.id,
    );
    expect(
      updated.cues
        .filter((c) => c.kind === "return" && c.state === "scheduled")
        .map((c) => c.scheduledFor)
        .sort(),
    ).toEqual(["2026-10-14", "2026-10-19"]);
    expect(
      (
        await db.query(
          "select * from lifecycle_events where status='superseded'",
        )
      ).rows,
    ).toHaveLength(1);
    await db.close();
    db = await openDevelopmentDb(dir);
    expect((await correctPurchase(db, actor, record.id, input)).version).toBe(
      2,
    );
    await expect(
      correctPurchase(db, actor, record.id, { ...input, value: "2026-10-22" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(
      correctPurchase(db, actor, record.id, command(1)),
    ).rejects.toThrow("STATE_CONFLICT");
    const unknown = await correctPurchase(
      db,
      actor,
      record.id,
      command(2, "returnDate", null),
    );
    expect(unknown.events.find((e) => e.kind === "return")?.status).toBe(
      "unknown",
    );
    expect(
      unknown.cues.some((c) => c.kind === "return" && c.state === "scheduled"),
    ).toBe(false);
    const replay = await correctPurchase(db, actor, record.id, input);
    expect(replay.version).toBe(3);
    expect(replay.appliedVersion).toBe(2);
    expect(
      (
        await db.query(
          "select * from audit_events where event_type='purchase_corrected'",
        )
      ).rows,
    ).toHaveLength(2);
    const stored = (
      await db.query<{ original: Uint8Array }>(
        "select original from private.evidence_bytes",
      )
    ).rows[0].original;
    expect(createHash("sha256").update(stored).digest("hex")).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  } finally {
    await db.close();
    const target = resolve(dir),
      root = resolve(tmpdir()) + sep;
    if (!target.startsWith(root) || !target.includes("cuevaro-correction-"))
      throw Error("UNSAFE_FIXTURE_CLEANUP");
    rmSync(target, { recursive: true, force: true });
  }
});
it("item correction preserves item and aggregate history without rescheduling unrelated cues; viewer/revoked/foreign edits fail", async () => {
  const db = await openDevelopmentDb();
  try {
    const { record } = await fixture(db),
      item = record.items[0];
    const updated = await correctPurchase(db, actor, record.id, {
      ...command(1, "item", "Corrected kettle"),
      itemId: item.id,
    });
    expect(updated.items[0].name).toBe("Corrected kettle");
    expect(updated.items[0].observation.value).toBe("Electric kettle");
    expect(updated.itemHistory).toHaveLength(2);
    expect(updated.history).toHaveLength(8);
    expect(updated.cues).toHaveLength(record.cues.length);
    expect(updated.facts.find((f) => f.field === "item")?.value).toBe(
      "Corrected kettle",
    );
    await expect(
      correctPurchase(db, actor, record.id, {
        ...command(2, "item", "Foreign"),
        itemId: randomUUID(),
      }),
    ).rejects.toThrow("ITEM_NOT_FOUND");
    await expect(
      correctPurchase(
        db,
        { ...actor, householdId: randomUUID() },
        record.id,
        command(2),
      ),
    ).rejects.toThrow("ACCESS_DENIED");
    await db.query("update household_memberships set role='viewer'");
    await expect(
      correctPurchase(db, actor, record.id, command(2)),
    ).rejects.toThrow("ACCESS_DENIED");
    await db.query(
      "update household_memberships set role='owner',revoked_at=now()",
    );
    await expect(
      correctPurchase(db, actor, record.id, command(2)),
    ).rejects.toThrow("ACCESS_DENIED");
    await expect(getRecords(db, actor)).rejects.toThrow("ACCESS_DENIED");
    expect(
      (await db.query("select * from private.evidence_bytes")).rows,
    ).toHaveLength(1);
    await db.exec("set role authenticated");
    await expect(
      db.query("select * from private.purchase_commands"),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});

it("durable dismissal and snooze survive an Unknown deadline roundtrip", async () => {
  const db = await openDevelopmentDb();
  try {
    const { record } = await fixture(db);
    let state = await changeAttention(
      db,
      actor,
      record.id,
      { type: "dismiss", cueId: record.cues[0].id },
      1,
    );
    state = await changeAttention(
      db,
      actor,
      record.id,
      { type: "snooze", cueId: record.cues[1].id, date: "2026-10-18" },
      state.version,
    );
    const unknown = await correctPurchase(
      db,
      actor,
      record.id,
      command(state.version, "returnDate", null),
    );
    const restored = await correctPurchase(
      db,
      actor,
      record.id,
      command(unknown.version),
    );
    expect(
      restored.cues
        .filter((c) => c.kind === "return" && c.dueDate === "2026-10-21")
        .map((c) => [c.state, c.scheduledFor])
        .sort(),
    ).toEqual([
      ["dismissed", "2026-10-14"],
      ["scheduled", "2026-10-18"],
    ]);
  } finally {
    await db.close();
  }
});
