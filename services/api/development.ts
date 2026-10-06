import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { documentPreflight } from "../../packages/domain/document-preflight";
import {
  pageManifest,
  pagesQuality,
} from "../../packages/domain/capture-pages";
import { mergePageDrafts } from "../../packages/domain/merge-pages";
import {
  reviewItems,
  type ItemChoice,
} from "../../packages/domain/review-items";
import {
  authorize,
  type Actor,
  type Membership,
} from "../../packages/domain/authority";
import {
  qualityGate,
  mayExtract,
  type Quality,
  pdfQuality,
} from "../../packages/domain/quality";
import {
  confirm,
  derive,
  draftSchema,
  type Draft,
  type Field,
} from "../../packages/domain/purchase";
import { extractOriginal } from "../worker/extract";
import { isPdf } from "../worker/pdf";
import {
  updateAttention,
  type AttentionCommand,
} from "../../packages/domain/attention";
export const developmentActor: Actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  householdId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
export async function openDevelopmentDb(path?: string) {
  const db = new PGlite(path);
  const exists = await db.query(
    `select to_regclass('public.captures') present`,
  );
  if (!(exists.rows[0] as { present: unknown }).present) {
    await db.exec(
      `create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610050001_foundation.sql", "utf8"),
    );
    await db.exec(
      `create table private.evidence_bytes(evidence_id uuid primary key references public.evidence_objects, original bytea not null); create table private.review_drafts(capture_id uuid primary key references public.captures, draft jsonb not null);`,
    );
    await db.query(
      `insert into households(id,name,region,timezone) values($1,'Synthetic development household','PH','Asia/Manila')`,
      [developmentActor.householdId],
    );
    await db.query(
      `insert into household_memberships values($1,$2,'owner',null)`,
      [developmentActor.householdId, developmentActor.userId],
    );
  }
  const column = await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='evidence_objects' and column_name='page_number'",
  );
  if (!column.rows.length)
    await db.exec(
      readFileSync(
        "supabase/migrations/202610060004_evidence_pages.sql",
        "utf8",
      ),
    );
  const itemColumn = await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='fact_assertions' and column_name='item_id'",
  );
  if (!itemColumn.rows.length)
    await db.exec(
      readFileSync("supabase/migrations/202610060005_item_facts.sql", "utf8"),
    );
  return db;
}
export async function assertActor(db: PGlite, actor: Actor, write = false) {
  const { rows } = await db.query<{
    user_id: string;
    household_id: string;
    role: Membership["role"];
    revoked_at: string | null;
  }>(
    `select * from household_memberships where household_id=$1 and user_id=$2`,
    [actor.householdId, actor.userId],
  );
  const m = rows[0];
  authorize(
    actor,
    m
      ? {
          userId: m.user_id,
          householdId: m.household_id,
          role: m.role,
          revoked: !!m.revoked_at,
        }
      : undefined,
    write,
  );
}
export async function imageQuality(bytes: Uint8Array): Promise<Quality> {
  const image = sharp(bytes, { limitInputPixels: 20000000 });
  const meta = await image.metadata();
  if (!["jpeg", "png"].includes(meta.format ?? ""))
    throw Error("UNSUPPORTED_IMAGE");
  const { data, info } = await image
    .resize({
      width: 900,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return qualityGate(
    documentPreflight({
      width: info.width,
      height: info.height,
      luminance: new Uint8Array(data),
    }),
  );
}
export async function createCapture(
  db: PGlite,
  actor: Actor,
  clientId: string,
  bytes: Uint8Array,
  useAnyway: boolean,
) {
  if (bytes.length < 1 || bytes.length > 20000000) throw Error("INVALID_SIZE");
  return createPageCapture(db, actor, clientId, [bytes], useAnyway);
}
export async function createPageCapture(
  db: PGlite,
  actor: Actor,
  clientId: string,
  originals: Uint8Array[],
  useAnyway: boolean,
) {
  await assertActor(db, actor, true);
  const hashes = originals.map((bytes) =>
    createHash("sha256").update(bytes).digest("hex"),
  );
  const manifest = pageManifest(
    hashes,
    originals.map((bytes) => bytes.length),
  );
  if (originals.length > 1 && originals.some(isPdf))
    throw Error("PHOTO_PAGES_ONLY");
  const pageQualities: Quality[] = [];
  for (const bytes of originals)
    pageQualities.push(isPdf(bytes) ? pdfQuality() : await imageQuality(bytes));
  const quality = pagesQuality(pageQualities);
  if (!mayExtract(quality, useAnyway)) throw Error("QUALITY_REVIEW_REQUIRED");
  const hash = manifest
    ? createHash("sha256").update(manifest).digest("hex")
    : hashes[0];
  return db.transaction(async (tx) => {
    const membership = (
      await tx.query(
        `select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,
        [actor.householdId, actor.userId],
      )
    ).rows;
    if (!membership.length) throw Error("ACCESS_DENIED");
    const old = (
      await tx.query<{ id: string; content_hash: string }>(
        `select id,content_hash from captures where household_id=$1 and (client_capture_id=$2 or content_hash=$3)`,
        [actor.householdId, clientId, hash],
      )
    ).rows[0];
    if (old) {
      if (old.content_hash !== hash) throw Error("IDEMPOTENCY_CONFLICT");
      return { id: old.id, hash, durable: true, duplicate: true };
    }
    const id = randomUUID();
    await tx.query(
      `insert into captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values($1,$2,$3,$4,'stored',$5,$6,now())`,
      [
        id,
        actor.householdId,
        actor.userId,
        clientId,
        hash,
        JSON.stringify(quality),
      ],
    );
    for (const [index, bytes] of originals.entries()) {
      const evidence = randomUUID(),
        pdf = isPdf(bytes),
        meta = pdf ? null : await sharp(bytes).metadata();
      const mime = pdf
        ? "application/pdf"
        : meta?.format === "png"
          ? "image/png"
          : "image/jpeg";
      await tx.query(
        `insert into evidence_objects(id,household_id,capture_id,storage_key,mime_type,byte_size,sha256,page_number) values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          evidence,
          actor.householdId,
          id,
          `${actor.householdId}/${id}/original${originals.length > 1 ? `-page-${index + 1}` : ""}`,
          mime,
          bytes.length,
          hashes[index],
          index + 1,
        ],
      );
      await tx.query(`insert into private.evidence_bytes values($1,$2)`, [
        evidence,
        bytes,
      ]);
    }
    await tx.query(
      `insert into jobs(household_id,type,resource_id,idempotency_key) values($1,'extract',$2,$3)`,
      [actor.householdId, id, `extract:${id}:v1`],
    );
    await tx.query(
      `insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'capture_stored',$3,$4)`,
      [actor.householdId, actor.userId, id, clientId],
    );
    return { id, hash, durable: true, duplicate: false };
  });
}
export async function runOneJob(db: PGlite, extract = extractOriginal) {
  const job = await db.transaction(async (tx) => {
    const exhausted = await tx.query<{
      resource_id: string;
      household_id: string;
    }>(
      `update jobs set state='dead_letter',error_code='EXHAUSTED_LEASE',leased_until=null where type='extract' and state='processing' and attempts>=3 and leased_until<now() returning resource_id,household_id`,
    );
    for (const expired of exhausted.rows)
      await tx.query(
        `update captures set state='failed' where id=$1 and household_id=$2 and state in ('stored','processing','failed')`,
        [expired.resource_id, expired.household_id],
      );
    const { rows } = await tx.query<{
      id: string;
      resource_id: string;
      household_id: string;
      attempts: number;
    }>(
      `select * from jobs where type='extract' and attempts<3 and (state='pending' or state='processing' and leased_until<now()) and available_at<=now() order by created_at for update skip locked limit 1`,
    );
    const j = rows[0];
    if (!j) return null;
    await tx.query(
      `update jobs set state='processing',attempts=attempts+1,leased_until=now()+interval '5 minutes' where id=$1`,
      [j.id],
    );
    return j;
  });
  if (!job) return false;
  try {
    const { rows } = await db.query<{
      id: string;
      original: Uint8Array;
      quality: Quality;
      initiated_by_user_id: string;
      page_number: number;
    }>(
      `select e.id,b.original,e.page_number,c.quality,c.initiated_by_user_id from captures c join evidence_objects e on e.capture_id=c.id and e.household_id=c.household_id join private.evidence_bytes b on b.evidence_id=e.id where c.id=$1 and c.household_id=$2 and c.state in ('stored','processing','failed') order by e.page_number`,
      [job.resource_id, job.household_id],
    );
    const row = rows[0];
    if (!row) throw Error("RESOURCE_UNAVAILABLE");
    const actor = {
      userId: row.initiated_by_user_id,
      householdId: job.household_id,
    };
    await assertActor(db, actor, true);
    const drafts = [];
    for (const page of rows) {
      await assertActor(db, actor, true); // Revocation stops subsequent page processing.
      const d = draftSchema.parse(
        await extract(
          page.original,
          page.id,
          row.quality.grade === "good" ? "good" : "questionable",
          new Date().toISOString().slice(0, 10),
        ),
      );
      if (
        [
          ...d.observations,
          ...(d.itemCandidates?.map((c) => c.observation) ?? []),
        ].some(
          (o) =>
            o.evidenceId !== page.id ||
            o.sources?.some((s) => s.evidenceId !== page.id),
        )
      )
        throw Error("UNBOUND_EVIDENCE");
      drafts.push({ draft: d, evidenceId: page.id });
    }
    const draft =
      rows.length === 1
        ? drafts[0].draft
        : mergePageDrafts(
            drafts,
            "tesseract-local-pages",
            "tesseract-7+receipt-text-v3+page-merge-v1",
          );
    const ids = new Set(rows.map((r) => r.id));
    if (
      [
        ...draft.observations,
        ...(draft.itemCandidates?.map((c) => c.observation) ?? []),
      ].some(
        (o) =>
          !ids.has(o.evidenceId) ||
          o.sources?.some((s) => !ids.has(s.evidenceId)),
      )
    )
      throw Error("UNBOUND_EVIDENCE");
    await assertActor(db, actor, true); // Revalidation after extraction; revocation wins.
    await db.transaction(async (tx) => {
      const active = (
        await tx.query(
          `select id from jobs where id=$1 and state='processing' and attempts=$2 for update`,
          [job.id, job.attempts + 1],
        )
      ).rows;
      if (!active.length) throw Error("STALE_WORKER_LEASE");
      const membership = (
        await tx.query(
          `select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,
          [actor.householdId, actor.userId],
        )
      ).rows;
      if (!membership.length) throw Error("ACCESS_DENIED");
      await tx.query(
        `insert into private.review_drafts values($1,$2) on conflict(capture_id) do nothing`,
        [job.resource_id, JSON.stringify(draft)],
      );
      await tx.query(
        `update captures set state='review_ready' where id=$1 and household_id=$2 and state<>'confirmed'`,
        [job.resource_id, job.household_id],
      );
      await tx.query(
        `update jobs set state='complete',leased_until=null where id=$1`,
        [job.id],
      );
    });
  } catch (error) {
    const code =
      error instanceof Error &&
      [
        "PDF_PAGE_LIMIT",
        "PDF_TEXT_LIMIT",
        "PDF_NO_TEXT",
        "PDF_PASSWORD_REQUIRED",
        "PDF_INVALID",
        "PDF_INVALID_SIZE_OR_HEADER",
      ].includes(error.message)
        ? error.message
        : "EXTRACTION_RETRY_REQUIRED";
    const failed = await db.query(
      `update jobs set state=case when attempts>=3 or $3 then 'dead_letter' else 'pending' end,error_code=$4,available_at=now()+interval '10 seconds',leased_until=null where id=$1 and state='processing' and attempts=$2 returning id`,
      [job.id, job.attempts + 1, code !== "EXTRACTION_RETRY_REQUIRED", code],
    );
    if (failed.rows.length)
      await db.query(
        `update captures set state='failed' where id=$1 and household_id=$2 and state<>'confirmed'`,
        [job.resource_id, job.household_id],
      );
  }
  return true;
}
export async function getDraft(db: PGlite, actor: Actor, id: string) {
  await assertActor(db, actor);
  const { rows } = await db.query<{
    state: string;
    draft: Draft | null;
    errorCode: string | null;
  }>(
    `select c.state,d.draft,j.error_code as "errorCode" from captures c left join private.review_drafts d on d.capture_id=c.id left join jobs j on j.resource_id=c.id and j.type='extract' where c.id=$1 and c.household_id=$2`,
    [id, actor.householdId],
  );
  if (!rows[0]) throw Error("NOT_FOUND");
  return rows[0];
}
export async function confirmPurchase(
  db: PGlite,
  actor: Actor,
  captureId: string,
  values: Partial<Record<Field, string | null>>,
  itemChoices?: ItemChoice[],
) {
  await assertActor(db, actor, true);
  return db.transaction(async (tx) => {
    const membership = (
      await tx.query(
        `select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,
        [actor.householdId, actor.userId],
      )
    ).rows;
    if (!membership.length) throw Error("ACCESS_DENIED");
    const { rows } = await tx.query<{
      state: string;
      draft: Draft;
      timezone: string;
    }>(
      `select c.state,d.draft,h.timezone from captures c join private.review_drafts d on d.capture_id=c.id join households h on h.id=c.household_id where c.id=$1 and c.household_id=$2 for update of c`,
      [captureId, actor.householdId],
    );
    const row = rows[0];
    if (!row) throw Error("NOT_FOUND");
    if (row.state !== "review_ready") throw Error("STATE_CONFLICT");
    const now = new Date().toISOString(),
      facts = confirm(row.draft, values, actor.userId, now, randomUUID),
      id = randomUUID();
    const items = reviewItems(
      row.draft,
      itemChoices,
      values.item ?? null,
      randomUUID,
    );
    const result = derive(facts, row.timezone, id);
    await tx.query(
      `insert into purchases(id,household_id,capture_id) values($1,$2,$3)`,
      [id, actor.householdId, captureId],
    );
    for (const f of facts) {
      const oid = randomUUID();
      await tx.query(
        `insert into observations(id,household_id,evidence_id,field_name,value,confidence,source_locator) values($1,$2,$3,$4,$5,$6,$7)`,
        [
          oid,
          actor.householdId,
          f.observation.evidenceId,
          f.field,
          JSON.stringify(f.observation.value),
          f.observation.confidence,
          JSON.stringify({
            excerpt: f.observation.excerpt,
            source: f.observation.source,
            version: f.observation.version,
            reason: f.observation.reason,
            pages: f.observation.pages,
            sources: f.observation.sources,
          }),
        ],
      );
      await tx.query(
        `insert into fact_assertions(id,household_id,purchase_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          f.id,
          actor.householdId,
          id,
          f.field,
          JSON.stringify(f.value),
          f.authority,
          oid,
          actor.userId,
        ],
      );
    }
    for (const item of items) {
      await tx.query(
        `insert into items(id,household_id,purchase_id,display_name) values($1,$2,$3,$4)`,
        [item.id, actor.householdId, id, item.name],
      );
      const oid = randomUUID(),
        o = item.observation;
      await tx.query(
        `insert into observations(id,household_id,evidence_id,field_name,value,confidence,source_locator) values($1,$2,$3,'item',$4,$5,$6)`,
        [
          oid,
          actor.householdId,
          o.evidenceId,
          JSON.stringify(o.value),
          o.confidence,
          JSON.stringify({
            excerpt: o.excerpt,
            source: o.source,
            version: o.version,
            reason: o.reason,
            pages: o.pages,
            sources: o.sources,
            candidateId: item.candidateId,
          }),
        ],
      );
      await tx.query(
        `insert into fact_assertions(id,household_id,purchase_id,item_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) values($1,$2,$3,$4,'item',$5,$6,$7,$8)`,
        [
          randomUUID(),
          actor.householdId,
          id,
          item.id,
          JSON.stringify(item.name),
          item.authority,
          oid,
          actor.userId,
        ],
      );
    }
    for (const e of result.events) {
      const eid = randomUUID();
      await tx.query(
        `insert into lifecycle_events(id,household_id,purchase_id,kind,status,due_date,timezone,source_fact_ids,rule_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          eid,
          actor.householdId,
          id,
          e.kind,
          e.status,
          e.dueDate,
          e.timezone,
          e.sourceFactIds,
          e.ruleVersion,
        ],
      );
      for (const cue of result.cues.filter((c) => c.kind === e.kind))
        await tx.query(
          `insert into cues(household_id,event_id,scheduled_for,idempotency_key) values($1,$2,$3,$4)`,
          [actor.householdId, eid, cue.scheduledFor, cue.id],
        );
    }
    await tx.query(`update captures set state='confirmed' where id=$1`, [
      captureId,
    ]);
    await tx.query(
      `insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'purchase_confirmed',$3,$4)`,
      [actor.householdId, actor.userId, id, randomUUID()],
    );
    return {
      id,
      captureId,
      facts,
      items,
      ...result,
      createdAt: now,
      version: 1,
    };
  });
}
export async function changeAttention(
  db: PGlite,
  actor: Actor,
  purchaseId: string,
  command: AttentionCommand,
  expectedVersion: number,
) {
  await assertActor(db, actor, true);
  return db.transaction(async (tx) => {
    const membership = (
      await tx.query(
        `select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,
        [actor.householdId, actor.userId],
      )
    ).rows;
    if (!membership.length) throw Error("ACCESS_DENIED");
    const row = (
      await tx.query<{ version: number }>(
        `select version from purchases where id=$1 and household_id=$2 for update`,
        [purchaseId, actor.householdId],
      )
    ).rows[0];
    if (!row) throw Error("NOT_FOUND");
    const events = (
      await tx.query<import("../../packages/domain/purchase").Lifecycle>(
        `select kind,status,due_date::text as "dueDate",timezone,source_fact_ids as "sourceFactIds",rule_version as "ruleVersion" from lifecycle_events where purchase_id=$1 and household_id=$2`,
        [purchaseId, actor.householdId],
      )
    ).rows;
    const cues = (
      await tx.query<import("../../packages/domain/purchase").Cue>(
        `select c.idempotency_key as id,e.kind,c.scheduled_for::text as "scheduledFor",e.due_date::text as "dueDate",c.state from cues c join lifecycle_events e on e.id=c.event_id and e.household_id=c.household_id where e.purchase_id=$1 and c.household_id=$2`,
        [purchaseId, actor.householdId],
      )
    ).rows;
    const timezone = events[0]?.timezone ?? "UTC",
      today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
    const result = updateAttention(
      { ...row, events, cues },
      command,
      expectedVersion,
      today,
    );
    for (const e of result.events)
      await tx.query(
        `update lifecycle_events set status=$1 where purchase_id=$2 and household_id=$3 and kind=$4`,
        [e.status, purchaseId, actor.householdId, e.kind],
      );
    for (const c of result.cues)
      await tx.query(
        `update cues set state=$1,scheduled_for=$2 where idempotency_key=$3 and household_id=$4`,
        [c.state, c.scheduledFor, c.id, actor.householdId],
      );
    await tx.query(
      `update purchases set version=$1 where id=$2 and household_id=$3`,
      [result.version, purchaseId, actor.householdId],
    );
    await tx.query(
      `insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,$3,$4,$5)`,
      [
        actor.householdId,
        actor.userId,
        `cue_${command.type}`,
        purchaseId,
        randomUUID(),
      ],
    );
    return result;
  });
}
