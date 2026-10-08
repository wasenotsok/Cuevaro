import { it, expect } from "vitest";
import { Pool, type PoolClient } from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  postgresDatabase,
  type PostgresPool,
} from "../packages/providers/postgres";
import {
  createPageCapture,
  runOneJob,
  getDraft,
  confirmPurchase,
  changeAttention,
  correctPurchase,
} from "../services/api/development";
import { getRecords } from "../services/api/records";
import {
  syntheticReceiptSvg,
  syntheticReceiptText,
} from "../packages/test-fixtures/receipt";
import { extractText } from "../packages/domain/purchase";
// Only the dedicated ephemeral CI service. No URL/password/managed env is accepted.
const enabled =
  process.env.CI === "true" && process.env.CUEVARO_DISPOSABLE_POSTGRES === "1";
it.runIf(enabled)(
  "real PostgreSQL17 connections preserve transaction isolation, SKIP LOCKED claims and Stop/correction history",
  async () => {
    const pool = new Pool({
      host: "127.0.0.1",
      port: 5432,
      database: "cuevaro_synthetic_ci",
      user: "postgres",
      ssl: false,
      max: 4,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    const db = postgresDatabase(pool as PostgresPool);
    let locked: PoolClient | undefined;
    try {
      const version = (
        await pool.query(
          "select current_setting('server_version_num')::int version",
        )
      ).rows[0].version;
      expect(version).toBeGreaterThanOrEqual(170000);
      expect(version).toBeLessThan(180000);
      await pool.query(
        `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;create function storage.allow_only_operation(expected_operation text) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=expected_operation or current_setting('storage.operation',true)='storage.'||expected_operation,false)$$;`,
      );
      await pool.query(
        `begin;${readFileSync("supabase/reviewed/phase1-development-baseline.sql", "utf8")}commit;`,
      );
      await pool.query(
        readFileSync(
          "supabase/migrations/20261008030442_managed_review_drafts.sql",
          "utf8",
        ),
      );
      await pool.query(
        readFileSync("supabase/tests/managed-role-checks.sql", "utf8"),
      );
      await pool.query(
        readFileSync(
          "supabase/tests/cuevaro-managed-supplemental-role-checks.sql",
          "utf8",
        ),
      );
      // This byte table belongs only to the disposable SQL fixture, not managed storage.
      await pool.query(
        "create table private.evidence_bytes(evidence_id uuid primary key references public.evidence_objects,original bytea not null)",
      );
      const actorA = { householdId: randomUUID(), userId: randomUUID() },
        actorB = { householdId: randomUUID(), userId: randomUUID() };
      for (const actor of [actorA, actorB]) {
        await db.query(
          "insert into households(id,name,region,timezone) values($1,'SYNTHETIC CI','SG','Asia/Singapore')",
          [actor.householdId],
        );
        await db.query(
          "insert into household_memberships values($1,$2,'owner',null)",
          [actor.householdId, actor.userId],
        );
      }
      const png = await sharp(Buffer.from(syntheticReceiptSvg()))
        .png()
        .toBuffer();
      const a = await createPageCapture(db, actorA, randomUUID(), [png], true),
        b = await createPageCapture(db, actorB, randomUUID(), [png], true);
      locked = await pool.connect();
      await locked.query("begin");
      await locked.query(
        "select id from jobs where resource_id=$1 for update",
        [a.id],
      );
      const extractor = async (_bytes: Uint8Array, id: string) =>
        extractText(syntheticReceiptText, id, "questionable", "2026-10-08");
      expect(await runOneJob(db, extractor)).toBe(true);
      expect((await getDraft(db, actorB, b.id)).state).toBe("review_ready");
      expect((await getDraft(db, actorA, a.id)).state).toBe("stored");
      await locked.query("rollback");
      locked.release();
      locked = undefined;
      expect(await runOneJob(db, extractor)).toBe(true);
      const draft = (await getDraft(db, actorA, a.id)).draft!;
      const record = await confirmPurchase(
        db,
        actorA,
        a.id,
        Object.fromEntries(draft.observations.map((o) => [o.field, o.value])),
      );
      const stopped = await changeAttention(
        db,
        actorA,
        record.id,
        { type: "stop", kind: "return" },
        record.version,
      );
      const correction = await correctPurchase(db, actorA, record.id, {
        version: stopped.version,
        mutationId: randomUUID(),
        field: "returnDate",
        value: "2026-10-22",
      });
      expect(correction.events.find((e) => e.kind === "return")?.status).toBe(
        "not_applicable",
      );
      expect(
        correction.cues
          .filter((c) => c.kind === "return")
          .every((c) => c.state === "cancelled"),
      ).toBe(true);
      const before = (
        await db.query("select count(*)::int count from audit_events")
      ).rows[0].count;
      await expect(
        db.transaction(async (tx) => {
          await tx.query(
            "insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'synthetic-rollback',$3,$4)",
            [actorA.householdId, actorA.userId, record.id, randomUUID()],
          );
          throw Error("CONTROLLED_ROLLBACK");
        }),
      ).rejects.toThrow("CONTROLLED_ROLLBACK");
      expect(
        (await db.query("select count(*)::int count from audit_events")).rows[0]
          .count,
      ).toBe(before);
      const third = await sharp(
        Buffer.from(
          syntheticReceiptSvg().replace(
            "Not a real purchase",
            "Not a real purchase next",
          ),
        ),
      )
        .png()
        .toBuffer();
      await createPageCapture(db, actorA, randomUUID(), [third], true);
      let extractions = 0;
      const concurrent = await Promise.all([
        runOneJob(db, async (...args) => {
          extractions++;
          await new Promise((r) => setTimeout(r, 20));
          return extractor(args[0], args[1]);
        }),
        runOneJob(db, async (...args) => {
          extractions++;
          return extractor(args[0], args[1]);
        }),
      ]);
      expect(concurrent.filter(Boolean)).toHaveLength(1);
      expect(extractions).toBe(1);
      expect(
        (await db.transaction((tx) => getRecords(tx, actorA))).length,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "select has_table_privilege('authenticated','private.review_drafts','MAINTAIN') maintain",
          )
        ).rows[0].maintain,
      ).toBe(false);
    } finally {
      if (locked) {
        try {
          await locked.query("rollback");
        } finally {
          locked.release(true);
        }
      }
      await db.close();
    }
  },
  30000,
);
