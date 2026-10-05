import {it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {openDevelopmentDb,developmentActor as actor,createCapture,runOneJob,getDraft,confirmPurchase} from '../services/api/development';
import {buildApi} from '../services/api/server';
import {syntheticReceiptSvg,syntheticReceiptText} from '../packages/test-fixtures/receipt';
import {extractText} from '../packages/domain/purchase';
const receipt=()=>sharp(Buffer.from(syntheticReceiptSvg())).png().toBuffer();
it('real local OCR → review → relational facts/items/events/cues → retrieval, no duplicate records',async()=>{
 const db=await openDevelopmentDb();const bytes=await receipt();
 const c=await createCapture(db,actor,randomUUID(),bytes,true);
 expect(c.hash).toBe(createHash('sha256').update(bytes).digest('hex'));
 expect((await createCapture(db,actor,randomUUID(),bytes,true)).id).toBe(c.id);
 await runOneJob(db);
 const d=await getDraft(db,actor,c.id);expect(d.state).toBe('review_ready');expect(d.draft?.provider).toBe('tesseract-local');
 expect(d.draft?.observations.find(o=>o.field==='purchaseDate')?.value).toBe('2026-10-05');
 expect(d.draft?.observations.find(o=>o.field==='returnDate')?.value).toBe('2026-10-19');
 const values=Object.fromEntries(d.draft!.observations.map(o=>[o.field,o.value]));
 const r=await confirmPurchase(db,actor,c.id,values);expect(r.events[0].status).toBe('active');expect(r.cues.length).toBeGreaterThan(0);
 await expect(confirmPurchase(db,actor,c.id,values)).rejects.toThrow('STATE_CONFLICT');
 const app=await buildApi(db);const response=await app.inject({url:'/v1/records'});expect(response.statusCode).toBe(200);expect(response.json()[0].id).toBe(r.id);
 const audit=await db.query('select * from audit_events');expect(JSON.stringify(audit.rows)).not.toContain('Electric kettle');
 expect((await db.query('select * from items')).rows).toHaveLength(1);
 await app.close();await db.close();
});
it('restart retains original, queued extraction, immutable source and cue schedule',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cuevaro-fixture-'));let db=await openDevelopmentDb(dir);
 try{
  const c=await createCapture(db,actor,randomUUID(),await receipt(),true);await db.close();db=await openDevelopmentDb(dir);
  const extract=async(_b:Uint8Array,e:string)=>extractText(syntheticReceiptText,e,'questionable','2026-10-05');
  await runOneJob(db,extract);const d=await getDraft(db,actor,c.id);
  const values=Object.fromEntries(d.draft!.observations.map(o=>[o.field,o.value]));values.returnDate='2026-10-20';
  const r=await confirmPurchase(db,actor,c.id,values);
  const original=(await db.query<{original:Uint8Array}>('select original from private.evidence_bytes')).rows[0].original;
  expect(createHash('sha256').update(original).digest('hex')).toBe(c.hash);
  const obs=(await db.query<{value:string}>("select value from observations where field_name='returnDate'")).rows[0];expect(obs.value).toBe('2026-10-19');
  await db.close();db=await openDevelopmentDb(dir);expect((await db.query('select * from cues')).rows).toHaveLength(r.cues.length);
 }finally{await db.close();rmSync(dir,{recursive:true,force:true});}
});
it('revocation during OCR prevents commit; retry retains original and wrong household cannot read',async()=>{
 const db=await openDevelopmentDb();const c=await createCapture(db,actor,randomUUID(),await receipt(),true);
 await expect(getDraft(db,{...actor,householdId:randomUUID()},c.id)).rejects.toThrow('ACCESS_DENIED');
 await runOneJob(db,async(_b,e)=>{await db.query('update household_memberships set revoked_at=now()');return extractText(syntheticReceiptText,e,'good','2026-10-05');});
 expect((await db.query('select * from private.review_drafts')).rows).toHaveLength(0);expect((await db.query('select * from private.evidence_bytes')).rows).toHaveLength(1);
 await expect(getDraft(db,actor,c.id)).rejects.toThrow('ACCESS_DENIED');await db.close();
});
it('bad-image and malicious-content preflight cannot be bypassed by a client quality claim',async()=>{
 const db=await openDevelopmentDb();const bytes=await sharp({create:{width:500,height:700,channels:3,background:'white'}}).png().toBuffer();
 await expect(createCapture(db,actor,randomUUID(),bytes,true)).rejects.toThrow('QUALITY_REVIEW_REQUIRED');
 await expect(createCapture(db,actor,randomUUID(),Buffer.from('<script>bad</script>'),true)).rejects.toThrow();
 expect((await db.query('select * from jobs')).rows).toHaveLength(0);await db.close();
});
it('API rejects foreign origins, missing mutation marker, unknown keys and log-worthy data',async()=>{
 const db=await openDevelopmentDb();const app=await buildApi(db);
 expect((await app.inject({url:'/v1/records',headers:{origin:'https://evil.example'}})).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/v1/captures',payload:{}})).statusCode).toBe(403);
 const r=await app.inject({method:'POST',url:'/v1/captures',headers:{'x-cuevaro-development':'synthetic-only'},payload:{clientId:randomUUID(),base64:'bad',useAnyway:true,householdId:'foreign',secret:'sensitive-fixture'}});
 expect(r.statusCode).toBe(400);expect(r.body).not.toContain('sensitive-fixture');await app.close();await db.close();
});
