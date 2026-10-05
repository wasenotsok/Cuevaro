import { z } from 'zod';
export const fields=['merchant','purchaseDate','total','currency','item','returnDate','warrantyDate'] as const;
export type Field=typeof fields[number];
export const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T00:00:00Z`);return !isNaN(+d)&&d.toISOString().slice(0,10)===v;},'Invalid calendar date');
const observation=z.object({field:z.enum(fields),value:z.string().max(200).nullable(),confidence:z.enum(['high','medium','low','unknown']),evidenceId:z.string().min(1),excerpt:z.string().max(400),source:z.enum(['document_extraction','user_entered']),version:z.string(),reason:z.string().max(100)}).strict();
export const draftSchema=z.object({observations:z.array(observation).max(7),provider:z.string(),version:z.string()}).strict().superRefine((v,ctx)=>{if(new Set(v.observations.map(o=>o.field)).size!==v.observations.length)ctx.addIssue({code:'custom',message:'Duplicate fields'});});
export type Observation=z.infer<typeof observation>;
export type Draft=z.infer<typeof draftSchema>;
export type ConfirmedFact={id:string;field:Field;value:string|null;observation:Observation;authority:'user_confirmed'|'user_entered';actorId:string;confirmedAt:string;supersedesId?:string};
export type Lifecycle={kind:'return'|'warranty';status:'unknown'|'active'|'completed'|'not_applicable';dueDate:string|null;sourceFactIds:string[];ruleVersion:string;timezone:string};
export type Cue={id:string;kind:'return'|'warranty';scheduledFor:string;dueDate:string;state:'scheduled'|'delivered'|'dismissed'|'cancelled'};
export function validValue(field:Field,value:string|null):boolean {
 if(value===null)return true;
 if(!value.trim()||value.length>200)return false;
 if(field.endsWith('Date'))return isoDate.safeParse(value).success;
 if(field==='total')return /^\d{1,10}(\.\d{1,2})?$/.test(value);
 if(field==='currency')return /^[A-Z]{3}$/.test(value);
 return true;
}
// Text-only baseline over OCR output. No document instructions, tools or policy guesses.
export function extractText(text:string,evidenceId:string,quality:'good'|'questionable',today:string):Draft {
 if(text.length>100000)throw Error('TEXT_TOO_LARGE');
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const result:Observation[]=fields.map(field=>({field,value:null,confidence:'unknown',evidenceId,excerpt:'',source:'document_extraction',version:'receipt-text-v1',reason:'missing'}));
 const set=(field:Field,value:string,excerpt:string,confidence:Observation['confidence']='medium')=>{if(validValue(field,value))result[fields.indexOf(field)]={...result[fields.indexOf(field)],value,excerpt:excerpt.slice(0,400),confidence:quality==='questionable'?'low':confidence,reason:quality==='questionable'?'capture_warning':'requires_review'};};
 // Only explicit labels. Arbitrary first lines can be addresses/instructions, not merchants.
 for(const line of lines){
  const merchant=/^Merchant\s*:\s*(.+)$/i.exec(line);if(merchant)set('merchant',merchant[1],line);
  const item=/^Item\s*:\s*(.+)$/i.exec(line);if(item)set('item',item[1],line);
  const total=/^(?:Grand\s+)?Total\s*:?\s*([A-Z]{3})\s*(\d+(?:[,.]\d{3})*(?:\.\d{1,2})?)$/i.exec(line);if(total){set('currency',total[1].toUpperCase(),line);set('total',total[2].replace(/,/g,''),line);}
 }
 for(const [field,label] of [['purchaseDate','(?:Purchase date|Date)'],['returnDate','Return (?:by|deadline)'],['warrantyDate','Warranty (?:ends|until)']] as const){
  const matches=lines.flatMap(line=>{const m=new RegExp(`^${label}\\s*:?\\s*(\\d{4}-\\d{2}-\\d{2})$`,'i').exec(line);return m?[{value:m[1],line}]:[];});
  if(matches.length===1&&isoDate.safeParse(matches[0].value).success&&(field!=='purchaseDate'||matches[0].value<=today))set(field,matches[0].value,matches[0].line);
  else if(matches.length)result[fields.indexOf(field)].reason='ambiguous_or_invalid_date';
 }
 return draftSchema.parse({observations:result,provider:'local-text-parser',version:'receipt-text-v1'});
}
export function confirm(draft:Draft,values:Partial<Record<Field,string|null>>,actorId:string,now:string,id:()=>string):ConfirmedFact[]{
 const parsed=draftSchema.parse(draft);
 return parsed.observations.map(o=>{
  if(!(o.field in values))throw Error('EXPLICIT_REVIEW_REQUIRED');
  const value=values[o.field]??null;
  if(!validValue(o.field,value))throw Error('INVALID_FIELD');
  const changed=value!==o.value;
  return {id:id(),field:o.field,value,observation:o,authority:changed?'user_entered':'user_confirmed',actorId,confirmedAt:now};
 });
}
export function derive(facts:ConfirmedFact[],timezone:string,recordId:string):{events:Lifecycle[];cues:Cue[]} {
 try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw Error('INVALID_TIMEZONE');}
 const purchase=facts.find(f=>f.field==='purchaseDate');
 const events:Lifecycle[]=[],cues:Cue[]=[];
 for(const kind of ['return','warranty'] as const){
  const fact=facts.find(f=>f.field===(kind==='return'?'returnDate':'warrantyDate'));
  const supported=!!fact?.value&&isoDate.safeParse(fact.value).success&&!!purchase?.value&&isoDate.safeParse(purchase.value).success&&fact.value>=purchase.value;
  const dueDate=supported?fact!.value:null;
  events.push({kind,status:supported?'active':'unknown',dueDate,timezone,sourceFactIds:supported?[purchase!.id,fact!.id]:[],ruleVersion:'explicit-deadline-v1'});
  if(dueDate)for(const offset of kind==='return'?[7,2]:[30,14]){
   const d=new Date(`${dueDate}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-offset);
   const scheduledFor=d.toISOString().slice(0,10);
   if(scheduledFor>=purchase!.value!)cues.push({id:`${recordId}:${kind}:${dueDate}:${offset}`,kind,scheduledFor,dueDate,state:'scheduled'});
  }
 }
 return {events,cues};
}
