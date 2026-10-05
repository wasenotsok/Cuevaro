import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash,randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { authorize,type Actor,type Membership } from '../../packages/domain/authority';
import { qualityGate,mayExtract,type Quality } from '../../packages/domain/quality';
import { confirm,derive,draftSchema,type Draft,type Field } from '../../packages/domain/purchase';
import { extractOriginal } from '../worker/extract';
export const developmentActor:Actor={userId:'11111111-1111-4111-8111-111111111111',householdId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
export async function openDevelopmentDb(path?:string){
 const db=new PGlite(path);
 const exists=await db.query(`select to_regclass('public.captures') present`);
 if(!(exists.rows[0] as {present:unknown}).present){
  await db.exec(`create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(readFileSync('supabase/migrations/202610050001_foundation.sql','utf8'));
  await db.exec(`create table private.evidence_bytes(evidence_id uuid primary key references public.evidence_objects, original bytea not null); create table private.review_drafts(capture_id uuid primary key references public.captures, draft jsonb not null);`);
  await db.query(`insert into households(id,name,region,timezone) values($1,'Synthetic development household','PH','Asia/Manila')`,[developmentActor.householdId]);
  await db.query(`insert into household_memberships values($1,$2,'owner',null)`,[developmentActor.householdId,developmentActor.userId]);
 }
 return db;
}
export async function assertActor(db:PGlite,actor:Actor,write=false){
 const {rows}=await db.query<{user_id:string;household_id:string;role:Membership['role'];revoked_at:string|null}>(`select * from household_memberships where household_id=$1 and user_id=$2`,[actor.householdId,actor.userId]);
 const m=rows[0];authorize(actor,m?{userId:m.user_id,householdId:m.household_id,role:m.role,revoked:!!m.revoked_at}:undefined,write);
}
export async function imageQuality(bytes:Uint8Array):Promise<Quality>{
 const image=sharp(bytes,{limitInputPixels:20000000});const meta=await image.metadata();
 if(!['jpeg','png'].includes(meta.format??''))throw Error('UNSUPPORTED_IMAGE');
 const {data,info}=await image.resize({width:900,withoutEnlargement:true}).greyscale().raw().toBuffer({resolveWithObject:true});
 return qualityGate({width:info.width,height:info.height,luminance:new Uint8Array(data)});
}
export async function createCapture(db:PGlite,actor:Actor,clientId:string,bytes:Uint8Array,useAnyway:boolean){
 await assertActor(db,actor,true);
 if(bytes.length<1||bytes.length>20000000)throw Error('INVALID_SIZE');
 const quality=await imageQuality(bytes);if(!mayExtract(quality,useAnyway))throw Error('QUALITY_REVIEW_REQUIRED');
 const hash=createHash('sha256').update(bytes).digest('hex');
 const meta=await sharp(bytes).metadata(),mime=meta.format==='png'?'image/png':'image/jpeg';
 return db.transaction(async tx=>{
  const membership=(await tx.query(`select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,[actor.householdId,actor.userId])).rows;
  if(!membership.length)throw Error('ACCESS_DENIED');
  const old=(await tx.query<{id:string;content_hash:string}>(`select id,content_hash from captures where household_id=$1 and (client_capture_id=$2 or content_hash=$3)`,[actor.householdId,clientId,hash])).rows[0];
  if(old){if(old.content_hash!==hash)throw Error('IDEMPOTENCY_CONFLICT');return {id:old.id,hash,durable:true,duplicate:true};}
  const id=randomUUID(),evidence=randomUUID();
  await tx.query(`insert into captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values($1,$2,$3,$4,'stored',$5,$6,now())`,[id,actor.householdId,actor.userId,clientId,hash,JSON.stringify(quality)]);
  await tx.query(`insert into evidence_objects(id,household_id,capture_id,storage_key,mime_type,byte_size,sha256) values($1,$2,$3,$4,$5,$6,$7)`,[evidence,actor.householdId,id,`${actor.householdId}/${id}/original`,mime,bytes.length,hash]);
  await tx.query(`insert into private.evidence_bytes values($1,$2)`,[evidence,bytes]);
  await tx.query(`insert into jobs(household_id,type,resource_id,idempotency_key) values($1,'extract',$2,$3)`,[actor.householdId,id,`extract:${id}:v1`]);
  await tx.query(`insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'capture_stored',$3,$4)`,[actor.householdId,actor.userId,id,clientId]);
  return {id,hash,durable:true,duplicate:false};
 });
}
export async function runOneJob(db:PGlite,extract=extractOriginal){
 const job=await db.transaction(async tx=>{
  const {rows}=await tx.query<{id:string;resource_id:string;household_id:string;attempts:number}>(`select * from jobs where type='extract' and attempts<3 and (state='pending' or state='processing' and leased_until<now()) and available_at<=now() order by created_at for update skip locked limit 1`);
  const j=rows[0];if(!j)return null;
  await tx.query(`update jobs set state='processing',attempts=attempts+1,leased_until=now()+interval '5 minutes' where id=$1`,[j.id]);return j;
 });if(!job)return false;
 try{
  const {rows}=await db.query<{id:string;original:Uint8Array;quality:Quality;initiated_by_user_id:string}>(`select e.id,b.original,c.quality,c.initiated_by_user_id from captures c join evidence_objects e on e.capture_id=c.id and e.household_id=c.household_id join private.evidence_bytes b on b.evidence_id=e.id where c.id=$1 and c.household_id=$2 and c.state in ('stored','processing','failed')`,[job.resource_id,job.household_id]);
  const row=rows[0];if(!row)throw Error('RESOURCE_UNAVAILABLE');
  const actor={userId:row.initiated_by_user_id,householdId:job.household_id};await assertActor(db,actor,true);
  const draft=draftSchema.parse(await extract(row.original,row.id,row.quality.grade==='good'?'good':'questionable',new Date().toISOString().slice(0,10)));
  if(draft.observations.some(o=>o.evidenceId!==row.id))throw Error('UNBOUND_EVIDENCE');
  await assertActor(db,actor,true); // Revalidation after extraction; revocation wins.
  await db.transaction(async tx=>{
   const active=(await tx.query(`select id from jobs where id=$1 and state='processing' and attempts=$2 for update`,[job.id,job.attempts+1])).rows;
   if(!active.length)throw Error('STALE_WORKER_LEASE');
   const membership=(await tx.query(`select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,[actor.householdId,actor.userId])).rows;
   if(!membership.length)throw Error('ACCESS_DENIED');
   await tx.query(`insert into private.review_drafts values($1,$2) on conflict(capture_id) do nothing`,[job.resource_id,JSON.stringify(draft)]);
   await tx.query(`update captures set state='review_ready' where id=$1 and household_id=$2 and state<>'confirmed'`,[job.resource_id,job.household_id]);
   await tx.query(`update jobs set state='complete',leased_until=null where id=$1`,[job.id]);
  });
 }catch{
  const failed=await db.query(`update jobs set state=case when attempts>=3 then 'dead_letter' else 'pending' end,error_code='EXTRACTION_RETRY_REQUIRED',available_at=now()+interval '10 seconds',leased_until=null where id=$1 and state='processing' and attempts=$2 returning id`,[job.id,job.attempts+1]);
  if(failed.rows.length)await db.query(`update captures set state='failed' where id=$1 and household_id=$2 and state<>'confirmed'`,[job.resource_id,job.household_id]);
 }return true;
}
export async function getDraft(db:PGlite,actor:Actor,id:string){
 await assertActor(db,actor);
 const {rows}=await db.query<{state:string;draft:Draft|null}>(`select c.state,d.draft from captures c left join private.review_drafts d on d.capture_id=c.id where c.id=$1 and c.household_id=$2`,[id,actor.householdId]);
 if(!rows[0])throw Error('NOT_FOUND');return rows[0];
}
export async function confirmPurchase(db:PGlite,actor:Actor,captureId:string,values:Partial<Record<Field,string|null>>){
 await assertActor(db,actor,true);
 return db.transaction(async tx=>{
  const membership=(await tx.query(`select user_id from household_memberships where household_id=$1 and user_id=$2 and revoked_at is null and role in ('owner','member') for share`,[actor.householdId,actor.userId])).rows;
  if(!membership.length)throw Error('ACCESS_DENIED');
  const {rows}=await tx.query<{state:string;draft:Draft;timezone:string}>(`select c.state,d.draft,h.timezone from captures c join private.review_drafts d on d.capture_id=c.id join households h on h.id=c.household_id where c.id=$1 and c.household_id=$2 for update of c`,[captureId,actor.householdId]);
  const row=rows[0];if(!row)throw Error('NOT_FOUND');if(row.state!=='review_ready')throw Error('STATE_CONFLICT');
  const now=new Date().toISOString(),facts=confirm(row.draft,values,actor.userId,now,randomUUID),id=randomUUID();
  const result=derive(facts,row.timezone,id);
  await tx.query(`insert into purchases(id,household_id,capture_id) values($1,$2,$3)`,[id,actor.householdId,captureId]);
  await tx.query(`insert into items(household_id,purchase_id,display_name) values($1,$2,$3)`,[actor.householdId,id,facts.find(f=>f.field==='item')?.value??'Purchase']);
  for(const f of facts){
   const oid=randomUUID();await tx.query(`insert into observations(id,household_id,evidence_id,field_name,value,confidence,source_locator) values($1,$2,$3,$4,$5,$6,$7)`,[oid,actor.householdId,f.observation.evidenceId,f.field,JSON.stringify(f.observation.value),f.observation.confidence,JSON.stringify({excerpt:f.observation.excerpt,source:f.observation.source,version:f.observation.version})]);
   await tx.query(`insert into fact_assertions(id,household_id,purchase_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8)`,[f.id,actor.householdId,id,f.field,JSON.stringify(f.value),f.authority,oid,actor.userId]);
  }
  for(const e of result.events){const eid=randomUUID();await tx.query(`insert into lifecycle_events(id,household_id,purchase_id,kind,status,due_date,timezone,source_fact_ids,rule_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[eid,actor.householdId,id,e.kind,e.status,e.dueDate,e.timezone,e.sourceFactIds,e.ruleVersion]);for(const cue of result.cues.filter(c=>c.kind===e.kind))await tx.query(`insert into cues(household_id,event_id,scheduled_for,idempotency_key) values($1,$2,$3,$4)`,[actor.householdId,eid,cue.scheduledFor,cue.id]);}
  await tx.query(`update captures set state='confirmed' where id=$1`,[captureId]);
  await tx.query(`insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'purchase_confirmed',$3,$4)`,[actor.householdId,actor.userId,id,randomUUID()]);
  return {id,captureId,facts,...result,createdAt:now,version:1};
 });
}
