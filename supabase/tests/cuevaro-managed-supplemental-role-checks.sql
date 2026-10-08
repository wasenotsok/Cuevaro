begin;
do $test$
declare
  owner_u uuid := gen_random_uuid();
  foreign_u uuid := gen_random_uuid();
  viewer_u uuid := gen_random_uuid();
  member_u uuid := gen_random_uuid();
  h uuid; other_h uuid;
  c uuid := gen_random_uuid(); other_c uuid := gen_random_uuid(); second_c uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); other_e uuid := gen_random_uuid();
  o uuid := gen_random_uuid(); other_o uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); other_p uuid := gen_random_uuid(); second_p uuid := gen_random_uuid();
  i uuid := gen_random_uuid(); second_i uuid := gen_random_uuid();
  f uuid := gen_random_uuid(); successor uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.sub',owner_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  h := public.create_household('Synthetic supplemental A','PH','Asia/Manila');
  if not private.can_access(h,true) then raise exception 'Owner write authorization failed'; end if;
  begin
    perform public.create_household('Invalid region','ph','Asia/Manila');
    raise exception 'Invalid region unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid region/timezone' then raise; end if;
  end;
  begin
    perform public.create_household('Invalid timezone','PH','Synthetic/Invalid');
    raise exception 'Invalid timezone unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid region/timezone' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',foreign_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',foreign_u,'role','authenticated')::text,true);
  other_h := public.create_household('Synthetic supplemental B','PH','Asia/Manila');
  execute 'reset role';
  insert into public.household_memberships values(h,viewer_u,'viewer',null),(h,member_u,'member',null);
  insert into public.captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values
    (c,h,owner_u,gen_random_uuid(),'stored',repeat('a',64),'{}',now()),
    (second_c,h,owner_u,gen_random_uuid(),'stored',repeat('c',64),'{}',now()),
    (other_c,other_h,foreign_u,gen_random_uuid(),'stored',repeat('b',64),'{}',now());
  insert into public.evidence_objects(id,household_id,capture_id,storage_key,mime_type,byte_size,sha256,page_number) values
    (e,h,c,h::text||'/'||e::text||'/synthetic-metadata-only','image/png',1,repeat('d',64),1),
    (other_e,other_h,other_c,other_h::text||'/'||other_e::text||'/synthetic-metadata-only','image/png',1,repeat('e',64),1);
  insert into public.observations(id,household_id,evidence_id,field_name,value,confidence,source_locator) values
    (o,h,e,'merchant','"SYNTHETIC A"','high','{}'),
    (other_o,other_h,other_e,'merchant','"SYNTHETIC B"','high','{}');
  insert into public.purchases(id,household_id,capture_id) values(p,h,c),(second_p,h,second_c),(other_p,other_h,other_c);
  insert into public.items(id,household_id,purchase_id,display_name) values(i,h,p,'SYNTHETIC ITEM A'),(second_i,h,second_p,'SYNTHETIC ITEM A2');
  insert into public.fact_assertions(id,household_id,purchase_id,item_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) values
    (f,h,p,i,'merchant','"SYNTHETIC A"','user_confirmed',o,owner_u);
  begin
    insert into public.evidence_objects(household_id,capture_id,storage_key,mime_type,byte_size,sha256,page_number) values
      (other_h,c,'synthetic-invalid-cross-household','image/png',1,repeat('f',64),2);
    raise exception 'Cross-household evidence unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.fact_assertions(household_id,purchase_id,field_name,value,authority_type,source_observation_id,confirmed_by_user_id) values
      (h,p,'merchant','"SYNTHETIC"','user_confirmed',other_o,owner_u);
    raise exception 'Cross-household observation unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.fact_assertions(household_id,purchase_id,item_id,field_name,value,authority_type,confirmed_by_user_id) values
      (h,p,second_i,'merchant','"SYNTHETIC"','user_confirmed',owner_u);
    raise exception 'Wrong-purchase item unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.fact_assertions(household_id,purchase_id,item_id,field_name,value,authority_type,confirmed_by_user_id,supersedes_id) values
      (h,second_p,second_i,'merchant','"SYNTHETIC"','user_confirmed',owner_u,f);
    raise exception 'Cross-purchase history unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  insert into public.fact_assertions(id,household_id,purchase_id,item_id,field_name,value,authority_type,confirmed_by_user_id,supersedes_id) values
    (successor,h,p,i,'merchant','"SYNTHETIC corrected"','user_entered',owner_u,f);
  begin
    insert into public.fact_assertions(household_id,purchase_id,item_id,field_name,value,authority_type,confirmed_by_user_id,supersedes_id) values
      (h,p,i,'merchant','"SYNTHETIC fork"','user_entered',owner_u,f);
    raise exception 'Second successor unexpectedly accepted';
  exception when unique_violation then null; end;
  perform set_config('request.jwt.claim.sub',viewer_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',viewer_u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if not private.can_access(h,false) or private.can_access(h,true) then raise exception 'Viewer authorization mismatch'; end if;
  if (select count(*) from public.captures)<>2 or (select count(*) from public.evidence_objects)<>1 or (select count(*) from public.fact_assertions)<>2 then raise exception 'Viewer tenant graph mismatch'; end if;
  if exists(select 1 from public.captures where id=other_c) or exists(select 1 from public.evidence_objects where id=other_e) then raise exception 'Viewer foreign graph leak'; end if;
  begin
    update public.captures set state='failed' where id=c;
    raise exception 'Viewer direct write unexpectedly accepted';
  exception when insufficient_privilege then null; end;
  begin
    truncate public.cues;
    raise exception 'Viewer truncate unexpectedly accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',member_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_u,'role','authenticated')::text,true);
  if not private.can_access(h,false) or not private.can_access(h,true) then raise exception 'Member authorization mismatch'; end if;
  begin
    update public.household_memberships set role='owner' where household_id=h and user_id=member_u;
    raise exception 'Member escalation unexpectedly accepted';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  update public.household_memberships set revoked_at=now() where household_id=h and user_id=member_u;
  execute 'set local role authenticated';
  if private.can_access(h,false) or private.can_access(h,true) or exists(select 1 from public.captures) then raise exception 'Revoked member retained graph access'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  if exists(select 1 from public.households) or private.can_access(h,false) then raise exception 'Empty identity retained access'; end if;
  begin
    perform public.create_household('Unauthenticated synthetic','PH','Asia/Manila');
    raise exception 'Empty identity RPC unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Authentication required' then raise; end if;
  end;
  execute 'reset role';
end
$test$;
select 'passed supplemental owner/member/viewer/revocation/empty-identity/privilege/FK/history checks; SQL claims only; no Auth or Storage API operations' as evidence;
rollback;