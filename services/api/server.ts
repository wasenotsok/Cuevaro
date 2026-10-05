import Fastify from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { openDevelopmentDb,developmentActor,createCapture,getDraft,confirmPurchase,runOneJob,assertActor } from './development';
import { fields } from '../../packages/domain/purchase';
import { syntheticReceiptSvg } from '../../packages/test-fixtures/receipt';
const body=z.object({clientId:z.uuid(),base64:z.string().min(1).max(27000000).regex(/^[A-Za-z0-9+/]*={0,2}$/),useAnyway:z.boolean()}).strict();
const values=z.object(Object.fromEntries(fields.map(f=>[f,z.string().max(200).nullable()]))).strict();
export async function buildApi(db:Awaited<ReturnType<typeof openDevelopmentDb>>){
 const app=Fastify({logger:false,bodyLimit:28000000});
 app.addHook('onRequest',async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(8081|19006|4187)$/.test(origin))return res.code(403).send({code:'ORIGIN_DENIED'});
  if(origin){res.header('Access-Control-Allow-Origin',origin);res.header('Vary','Origin');}
  res.header('X-Content-Type-Options','nosniff');res.header('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.header('Access-Control-Allow-Headers','Content-Type,X-Cuevaro-Development').header('Access-Control-Allow-Methods','GET,POST,OPTIONS').code(204).send();
  if(req.method!=='GET'&&req.headers['x-cuevaro-development']!=='synthetic-only')return res.code(403).send({code:'DEVELOPMENT_ONLY'});
 });
 app.setErrorHandler((error,req,res)=>{const msg=error instanceof Error?error.message:'';const code=error instanceof z.ZodError?'INVALID_REQUEST':msg==='ACCESS_DENIED'?'ACCESS_DENIED':msg==='QUALITY_REVIEW_REQUIRED'?'QUALITY_REVIEW_REQUIRED':msg==='STATE_CONFLICT'?'STATE_CONFLICT':'OPERATION_FAILED';res.code(code==='ACCESS_DENIED'?403:400).send({code,requestId:randomUUID()});});
 app.get('/v1/health',()=>({environment:'local-synthetic-development',managedAuth:false,cloudBackup:false,push:false}));
 app.get('/v1/fixture',async(_req,res)=>res.type('image/png').send(await sharp(Buffer.from(syntheticReceiptSvg())).png().toBuffer()));
 app.post('/v1/captures',async req=>{const b=body.parse(req.body);return createCapture(db,developmentActor,b.clientId,Buffer.from(b.base64,'base64'),b.useAnyway);});
 app.get<{Params:{id:string}}>('/v1/captures/:id',async req=>getDraft(db,developmentActor,z.uuid().parse(req.params.id)));
 app.post<{Params:{id:string}}>('/v1/captures/:id/confirm',async req=>confirmPurchase(db,developmentActor,z.uuid().parse(req.params.id),values.parse(req.body)));
 app.get('/v1/records',async()=>{
  await assertActor(db,developmentActor);
  const purchases=(await db.query<{id:string;capture_id:string;version:number;created_at:string}>(`select * from purchases where household_id=$1 order by created_at desc limit 100`,[developmentActor.householdId])).rows;
  return Promise.all(purchases.map(async p=>({id:p.id,captureId:p.capture_id,version:p.version,createdAt:p.created_at,facts:(await db.query(`select f.id,f.field_name as field,f.value,f.authority_type as authority,f.confirmed_by_user_id as "actorId",f.confirmed_at as "confirmedAt",json_build_object('field',o.field_name,'value',o.value,'confidence',o.confidence,'evidenceId',o.evidence_id,'excerpt',o.source_locator->>'excerpt','source',o.source_locator->>'source','version',o.source_locator->>'version','reason','requires_review') as observation from fact_assertions f join observations o on o.id=f.source_observation_id where f.purchase_id=$1 and f.household_id=$2`,[p.id,developmentActor.householdId])).rows,events:(await db.query(`select kind,status,due_date::text as "dueDate",timezone,source_fact_ids as "sourceFactIds",rule_version as "ruleVersion" from lifecycle_events where purchase_id=$1 and household_id=$2`,[p.id,developmentActor.householdId])).rows,cues:(await db.query(`select c.id,e.kind,c.scheduled_for::text as "scheduledFor",e.due_date::text as "dueDate",c.state from cues c join lifecycle_events e on e.id=c.event_id where e.purchase_id=$1 and c.household_id=$2`,[p.id,developmentActor.householdId])).rows})));
 });
 return app;
}
if(process.argv[1]?.endsWith('server.ts')){
 mkdirSync('.local',{recursive:true});
 const db=await openDevelopmentDb(process.env.CUEVARO_EPHEMERAL==='1'?undefined:'.local/database');const app=await buildApi(db);
 // Loopback only; this synthetic fixture identity is never a network authentication mechanism.
 await app.listen({host:'127.0.0.1',port:4329});
 console.log('Cuevaro synthetic development API on http://127.0.0.1:4329. No production auth or cloud service.');
 let running=false;const timer=setInterval(async()=>{if(running)return;running=true;try{await runOneJob(db);}finally{running=false;}},1000);
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{clearInterval(timer);await app.close();await db.close();process.exit(0);});
}
