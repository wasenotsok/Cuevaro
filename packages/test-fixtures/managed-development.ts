import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
const identitiesSchema = z
  .object({
    owner: z.uuid(),
    member: z.uuid(),
    viewer: z.uuid(),
    revoked: z.uuid(),
    foreign: z.uuid(),
  })
  .strict();
export function planManagedFixture(input: unknown, bytes: Uint8Array) {
  const parsed = identitiesSchema.safeParse(input);
  if (!parsed.success || new Set(Object.values(parsed.data)).size !== 5)
    throw Error("FIVE_DISTINCT_APPROVED_IDENTITIES_REQUIRED");
  if (
    bytes.length < 1 ||
    bytes.length > 20000000 ||
    !Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    throw Error("SYNTHETIC_PNG_REQUIRED");
  const identities = parsed.data;
  const household = randomUUID(),
    foreignHousehold = randomUUID(),
    capture = randomUUID(),
    evidence = randomUUID(),
    clientCapture = randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `${household}/${capture}/original`;
  const manifest = {
    schema_version: 1,
    project_ref: "wqwapaklrfpckhgjsejf",
    status: "local plan only",
    identities,
    household,
    foreignHousehold,
    capture,
    evidence,
    clientCapture,
    storageKey,
    mime: "image/png",
    byteSize: bytes.length,
    sha256,
  };
  // Values interpolated below are validated UUIDs or freshly generated constants.
  const setupSql = `-- Parent review/execution only; no Auth creation or Storage byte upload.
begin;
do $$ begin
 if (select count(*) from auth.users where id in (${Object.values(identities)
   .map((id) => "'" + id + "'")
   .join(
     ",",
   )})) <> 5 then raise exception 'Approved Auth identities missing'; end if;
end $$;
insert into public.households(id,name,region,timezone) values ('${household}','SYNTHETIC API A','SG','Asia/Singapore'),('${foreignHousehold}','SYNTHETIC API B','SG','Asia/Singapore');
insert into public.household_memberships(household_id,user_id,role,revoked_at) values
('${household}','${identities.owner}','owner',null),
('${household}','${identities.member}','member',null),
('${household}','${identities.viewer}','viewer',null),
('${household}','${identities.revoked}','member',now()),
('${foreignHousehold}','${identities.foreign}','owner',null);
commit;
`;
  return { manifest, setupSql };
}
export function managedFixtureEvidenceSql(
  input: unknown,
  downloadedBytes: Uint8Array,
) {
  const schema = z
    .object({
      schema_version: z.literal(1),
      project_ref: z.literal("wqwapaklrfpckhgjsejf"),
      status: z.literal("local plan only"),
      identities: identitiesSchema,
      household: z.uuid(),
      foreignHousehold: z.uuid(),
      capture: z.uuid(),
      evidence: z.uuid(),
      clientCapture: z.uuid(),
      storageKey: z.string(),
      mime: z.literal("image/png"),
      byteSize: z.number().int().positive().max(20000000),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw Error("INVALID_FIXTURE_MANIFEST");
  const m = parsed.data;
  if (
    new Set(Object.values(m.identities)).size !== 5 ||
    new Set([
      m.household,
      m.foreignHousehold,
      m.capture,
      m.evidence,
      m.clientCapture,
    ]).size !== 5 ||
    m.storageKey !== `${m.household}/${m.capture}/original`
  )
    throw Error("INVALID_FIXTURE_MANIFEST");
  if (
    downloadedBytes.length !== m.byteSize ||
    createHash("sha256").update(downloadedBytes).digest("hex") !== m.sha256
  )
    throw Error("VERIFIED_UPLOAD_RECEIPT_MISMATCH");
  // Caller supplies actual downloaded bytes. Matching local bytes alone cannot prove remote upload.
  return `-- Parent must establish real immutable API upload/readback before execution.\nbegin;\ninsert into public.captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values ('${m.capture}','${m.household}','${m.identities.owner}','${m.clientCapture}','stored','${m.sha256}','{"synthetic":true,"status":"not_evaluated"}',now());\ninsert into public.evidence_objects(id,household_id,capture_id,storage_key,mime_type,byte_size,sha256,page_number) values ('${m.evidence}','${m.household}','${m.capture}','${m.storageKey}','image/png',${m.byteSize},'${m.sha256}',1);\ninsert into public.audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values ('${m.household}','${m.identities.owner}','synthetic_managed_fixture_stored','${m.capture}','${m.clientCapture}');\ncommit;\n`;
}
