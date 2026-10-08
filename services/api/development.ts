import {
  localOriginals,
  assertOriginalManifest,
  type OriginalStore,
  type EvidenceOriginal,
} from "./originals";
import type { SqlDatabase, SqlQuery } from "../../packages/providers/database";
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
  correctRecord,
  correctionSchema,
  type Correction,
} from "../../packages/domain/corrections";
import {
  reviewItems,
  initialItemFacts,
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
      `create table private.evidence_bytes(evidence_id uuid primary key references public.evidence_objects, original bytea not null); create table private.review_drafts(capture_id uuid primary key, household_id uuid not null, draft jsonb not null, foreign key(capture_id,household_id) references public.captures(id,household_id));`,
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
  // Upgrade only this local synthetic schema; managed migrations are never run here.
  const reviewColumn = await db.query(
    "select column_name from information_schema.columns where table_schema='private' and table_name='review_drafts' and column_name='household_id'",
  );
  if (!reviewColumn.rows.length)
    await db.exec(
      "alter table private.review_drafts add column household_id uuid;update private.review_drafts d set household_id=c.household_id from public.captures c where c.id=d.capture_id;alter table private.review_drafts alter column household_id set not null;alter table private.review_drafts add foreign key(capture_id,household_id) references public.captures(id,household_id);",
    );
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
  if (
    !(
      await db.query<{ present: unknown }>(
        "select to_regclass('private.purchase_commands') present",
      )
    ).rows[0].present
  )
    await db.exec(
      readFileSync(
        "supabase/migrations/202610060006_correction_receipts.sql",
        "utf8",
      ),
    );
  return db;
}
export async function assertActor(db: SqlQuery, actor: Actor, write = false) {
  const { rows } = await db.query<{
    user_id: string;
    household_id: string;
    role: Membership["role"];
    revoked_at: string | null;
  }>(
    `select * from household_memberships where household_id=$1 and user_id=$2 for share`,
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
  db: SqlDatabase,
  actor: Actor,
  clientId: string,
  bytes: Uint8Array,
  useAnyway: boolean,
) {
  if (bytes.length < 1 || bytes.length > 20000000) throw Error("INVALID_SIZE");
  return createPageCapture(db, actor, clientId, [bytes], useAnyway);
}
export async function createPageCapture(
  db: SqlDatabase,
  actor: Actor,
  clientId: string,
  originals: Uint8Array[],
  useAnyway: boolean,
  store: OriginalStore = localOriginals,
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
    // Stable UUIDv5 namespace/name identity preserves external objects after rollback/lost ACK.
    const digest = createHash("sha1")
      .update(Buffer.from(actor.householdId.replaceAll("-", ""), "hex"))
      .update(clientId)
      .digest();
    digest[6] = (digest[6] & 15) | 80;
    digest[8] = (digest[8] & 63) | 128;
    const hex = digest.subarray(0, 16).toString("hex");
    const id =
      store === localOriginals
        ? randomUUID()
        : `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
      await store.put(
        tx,
        actor,
        {
          id: evidence,
          householdId: actor.householdId,
          captureId: id,
          storageKey: `${actor.householdId}/${id}/original${originals.length > 1 ? `-page-${index + 1}` : ""}`,
          mime,
          size: bytes.length,
          sha256: hashes[index],
          page: index + 1,
        },
        bytes,
      );
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
export async function runOneJob(
  db: SqlDatabase,
  extract = extractOriginal,
  store: OriginalStore = localOriginals,
) {
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
      content_hash: string;
      storage_key: string;
      mime_type: string;
      byte_size: number;
      sha256: string;
      quality: Quality;
      initiated_by_user_id: string;
      page_number: number;
    }>(
      `select e.id,c.content_hash,e.storage_key,e.mime_type,e.byte_size,e.sha256,e.page_number,c.quality,c.initiated_by_user_id from captures c join evidence_objects e on e.capture_id=c.id and e.household_id=c.household_id where c.id=$1 and c.household_id=$2 and c.state in ('stored','processing','failed') order by e.page_number`,
      [job.resource_id, job.household_id],
    );
    const row = rows[0];
    if (!row) throw Error("RESOURCE_UNAVAILABLE");
    assertOriginalManifest(
      rows.map((r) => ({
        sha256: r.sha256,
        size: r.byte_size,
        page: r.page_number,
      })),
      row.content_hash,
    );
    if (!["good", "questionable"].includes(row.quality?.grade))
      throw Error("QUALITY_REVIEW_REQUIRED");
    const actor = {
      userId: row.initiated_by_user_id,
      householdId: job.household_id,
    };
    await assertActor(db, actor, true);
    const drafts = [];
    for (const page of rows) {
      await assertActor(db, actor, true); // Revocation stops subsequent page processing.
      const original = await store.read(
        db,
        actor,
        {
          id: page.id,
          householdId: job.household_id,
          captureId: job.resource_id,
          storageKey: page.storage_key,
          mime: page.mime_type,
          size: page.byte_size,
          sha256: page.sha256,
          page: page.page_number,
        },
        true,
      );
      if (
        original.length !== page.byte_size ||
        createHash("sha256").update(original).digest("hex") !== page.sha256
      )
        throw Error("EVIDENCE_INTEGRITY");
      const d = draftSchema.parse(
        await extract(
          original,
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
      await store.verify?.(tx, actor, true);
      const current = await tx.query<{
        id: string;
        sha256: string;
        size: number;
        page: number;
        hash: string;
        quality: Quality;
      }>(
        "select e.id,e.sha256,e.byte_size as size,e.page_number as page,c.content_hash as hash,c.quality from public.captures c join public.evidence_objects e on e.capture_id=c.id and e.household_id=c.household_id where c.id=$1 and c.household_id=$2 order by e.page_number for share of c,e",
        [job.resource_id, job.household_id],
      );
      if (
        !current.rows[0] ||
        current.rows.length !== rows.length ||
        current.rows.some(
          (r, i) =>
            r.id !== rows[i].id ||
            r.sha256 !== rows[i].sha256 ||
            r.size !== rows[i].byte_size,
        ) ||
        !["good", "questionable"].includes(current.rows[0].quality?.grade)
      )
        throw Error("EVIDENCE_INTEGRITY");
      assertOriginalManifest(current.rows, current.rows[0].hash);
      const active = (
        await tx.query(
          `select id from jobs where id=$1 and state='processing' and attempts=$2 and leased_until>clock_timestamp() for update`,
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
        `insert into private.review_drafts(capture_id,household_id,draft) values($1,$2,$3) on conflict(capture_id) do nothing`,
        [job.resource_id, job.household_id, JSON.stringify(draft)],
      );
      await tx.query(
        `update captures set state='review_ready' where id=$1 and household_id=$2 and state<>'confirmed'`,
        [job.resource_id, job.household_id],
      );
      const completed = await tx.query(
        "update jobs set state='complete',leased_until=null,error_code=null where id=$1 and attempts=$2 and state='processing' and leased_until>clock_timestamp() returning id",
        [job.id, job.attempts + 1],
      );
      if (!completed.rows.length) throw Error("STALE_WORKER_LEASE");
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
    await db.transaction(async (tx) => {
      const failed = await tx.query(
        `update jobs set state=case when attempts>=3 or $3 then 'dead_letter' else 'pending' end,error_code=$4,available_at=now()+interval '10 seconds',leased_until=null where id=$1 and state='processing' and attempts=$2 returning id`,
        [job.id, job.attempts + 1, code !== "EXTRACTION_RETRY_REQUIRED", code],
      );
      if (failed.rows.length)
        await tx.query(
          `update captures set state='failed' where id=$1 and household_id=$2 and state<>'confirmed'`,
          [job.resource_id, job.household_id],
        );
    });
  }
  return true;
}
export async function getDraft(db: SqlDatabase, actor: Actor, id: string) {
  await assertActor(db, actor);
  const { rows } = await db.query<{
    state: string;
    draft: Draft | null;
    errorCode: string | null;
  }>(
    `select c.state,d.draft,j.error_code as "errorCode" from captures c left join private.review_drafts d on d.capture_id=c.id and d.household_id=c.household_id left join jobs j on j.resource_id=c.id and j.household_id=c.household_id and j.type='extract' where c.id=$1 and c.household_id=$2`,
    [id, actor.householdId],
  );
  if (!rows[0]) throw Error("NOT_FOUND");
  return rows[0];
}
export async function confirmPurchase(
  db: SqlDatabase,
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
      `select c.state,d.draft,h.timezone from captures c join private.review_drafts d on d.capture_id=c.id and d.household_id=c.household_id join households h on h.id=c.household_id where c.id=$1 and c.household_id=$2 for update of c`,
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
          item.factId!,
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
      history: facts,
      itemHistory: initialItemFacts(items, actor.userId, now),
      ...result,
      createdAt: now,
      version: 1,
    };
  });
}
export async function correctPurchase(
  db: SqlDatabase,
  actor: Actor,
  purchaseId: string,
  input: Correction,
) {
  const command = correctionSchema.parse(input);
  await assertActor(db, actor, true);
  const { getRecords } = await import("./records");
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        command.version,
        command.field,
        command.value,
        command.itemId ?? null,
      ]),
    )
    .digest("hex");
  const appliedVersion = await db.transaction(async (tx) => {
    const membership = (
      await tx.query(
        `select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,
        [actor.householdId, actor.userId],
      )
    ).rows;
    if (!membership.length) throw Error("ACCESS_DENIED");
    const purchase = (
      await tx.query<{ version: number }>(
        "select version from purchases where id=$1 and household_id=$2 for update",
        [purchaseId, actor.householdId],
      )
    ).rows[0];
    if (!purchase) throw Error("NOT_FOUND");
    const replay = (
      await tx.query<{ request_digest: string; resulting_version: number }>(
        "select request_digest,resulting_version from private.purchase_commands where household_id=$1 and purchase_id=$2 and mutation_id=$3",
        [actor.householdId, purchaseId, command.mutationId],
      )
    ).rows[0];
    if (replay) {
      if (replay.request_digest !== digest) throw Error("IDEMPOTENCY_CONFLICT");
      return replay.resulting_version;
    }
    if (purchase.version !== command.version) throw Error("STATE_CONFLICT");
    const before = (await getRecords(tx, actor, purchaseId))[0];
    if (!before) throw Error("NOT_FOUND");
    const result = correctRecord(
      before,
      command,
      actor.userId,
      new Date().toISOString(),
      randomUUID,
    );
    const known = new Set(
      [...before.history, ...before.itemHistory].map((f) => f.id),
    );
    for (const f of [...result.history, ...result.itemHistory].filter(
      (f) => !known.has(f.id),
    )) {
      const old = (
        await tx.query<{ source_observation_id: string }>(
          "select source_observation_id from fact_assertions where id=$1 and purchase_id=$2 and household_id=$3",
          [f.supersedesId, purchaseId, actor.householdId],
        )
      ).rows[0];
      if (!old) throw Error("HISTORY_UNAVAILABLE");
      await tx.query(
        `insert into fact_assertions(id,household_id,purchase_id,item_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id,confirmed_at,supersedes_id) values($1,$2,$3,$4,$5,$6,'user_entered',$7,$8,$9,$10)`,
        [
          f.id,
          actor.householdId,
          purchaseId,
          "itemId" in f ? f.itemId : null,
          f.field,
          JSON.stringify(f.value),
          old.source_observation_id,
          actor.userId,
          f.confirmedAt,
          f.supersedesId,
        ],
      );
    }
    for (const item of result.items)
      await tx.query(
        "update items set display_name=$1 where id=$2 and purchase_id=$3 and household_id=$4",
        [item.name, item.id, purchaseId, actor.householdId],
      );
    const oldEvents = (
      await tx.query<{
        id: string;
        kind: "return" | "warranty";
        status: string;
        dueDate: string | null;
        sourceFactIds: string[];
      }>(
        `select id,kind,status,due_date::text as "dueDate",source_fact_ids as "sourceFactIds" from lifecycle_events where purchase_id=$1 and household_id=$2 and status<>'superseded' for update`,
        [purchaseId, actor.householdId],
      )
    ).rows;
    for (const event of result.events) {
      const old = oldEvents.find((e) => e.kind === event.kind)!;
      if (
        old.status === event.status &&
        old.dueDate === event.dueDate &&
        JSON.stringify(old.sourceFactIds) ===
          JSON.stringify(event.sourceFactIds)
      )
        continue;
      await tx.query(
        "update lifecycle_events set status='superseded' where id=$1 and household_id=$2",
        [old.id, actor.householdId],
      );
      const eid = randomUUID();
      await tx.query(
        `insert into lifecycle_events(id,household_id,purchase_id,kind,status,due_date,timezone,source_fact_ids,rule_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          eid,
          actor.householdId,
          purchaseId,
          event.kind,
          event.status,
          event.dueDate,
          event.timezone,
          event.sourceFactIds,
          event.ruleVersion,
        ],
      );
      const existing = new Set(before.cues.map((c) => c.id));
      for (const cue of result.cues.filter((c) => c.kind === event.kind)) {
        if (existing.has(cue.id))
          await tx.query(
            "update cues set state=$1,user_intent=$4 where idempotency_key=$2 and household_id=$3",
            [
              cue.state,
              cue.id,
              actor.householdId,
              cue.intent ? JSON.stringify(cue.intent) : null,
            ],
          );
        else
          await tx.query(
            `insert into cues(household_id,event_id,scheduled_for,state,idempotency_key,user_intent) values($1,$2,$3,$4,$5,$6)`,
            [
              actor.householdId,
              eid,
              cue.scheduledFor,
              cue.state,
              cue.id,
              cue.intent ? JSON.stringify(cue.intent) : null,
            ],
          );
      }
    }
    await tx.query(
      "update purchases set version=$1 where id=$2 and household_id=$3",
      [result.version, purchaseId, actor.householdId],
    );
    await tx.query(
      "insert into private.purchase_commands(household_id,purchase_id,mutation_id,request_digest,resulting_version) values($1,$2,$3,$4,$5)",
      [
        actor.householdId,
        purchaseId,
        command.mutationId,
        digest,
        result.version,
      ],
    );
    await tx.query(
      "insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'purchase_corrected',$3,$4)",
      [actor.householdId, actor.userId, purchaseId, command.mutationId],
    );
    return result.version;
  });
  return {
    ...(await db.transaction((tx) => getRecords(tx, actor, purchaseId)))[0],
    appliedMutationId: command.mutationId,
    appliedVersion,
  };
}
export async function changeAttention(
  db: SqlDatabase,
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
        `select kind,status,due_date::text as "dueDate",timezone,source_fact_ids as "sourceFactIds",rule_version as "ruleVersion" from lifecycle_events where purchase_id=$1 and household_id=$2 and status<>'superseded'`,
        [purchaseId, actor.householdId],
      )
    ).rows;
    const cues = (
      await tx.query<import("../../packages/domain/purchase").Cue>(
        `select c.idempotency_key as id,e.kind,c.scheduled_for::text as "scheduledFor",e.due_date::text as "dueDate",c.state,c.user_intent as intent from cues c join lifecycle_events e on e.id=c.event_id and e.household_id=c.household_id where e.purchase_id=$1 and c.household_id=$2`,
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
        `update lifecycle_events set status=$1 where purchase_id=$2 and household_id=$3 and kind=$4 and status<>'superseded'`,
        [e.status, purchaseId, actor.householdId, e.kind],
      );
    for (const c of result.cues)
      await tx.query(
        `update cues set state=$1,scheduled_for=$2,user_intent=$5 where idempotency_key=$3 and household_id=$4`,
        [
          c.state,
          c.scheduledFor,
          c.id,
          actor.householdId,
          c.intent ? JSON.stringify(c.intent) : null,
        ],
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
