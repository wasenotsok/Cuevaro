begin;
do $test$
declare
  owner_u uuid := gen_random_uuid();
  h uuid; other_h uuid;
  c uuid := gen_random_uuid(); second_c uuid := gen_random_uuid();
  role_name text; privilege text;
begin
  if not (select relrowsecurity from pg_class where oid='private.review_drafts'::regclass) then raise exception 'Review draft RLS missing'; end if;
  if exists(select 1 from pg_policies where schemaname='private' and tablename='review_drafts') then raise exception 'Unexpected client review-draft policy'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege(role_name,'private.review_drafts',privilege) then raise exception 'Unexpected client privilege: %.%',role_name,privilege; end if;
    end loop;
  end loop;
  insert into public.households(name,region,timezone) values('Synthetic draft validation A','PH','Asia/Manila') returning id into h;
  insert into public.households(name,region,timezone) values('Synthetic draft validation B','PH','Asia/Manila') returning id into other_h;
  insert into public.household_memberships values(h,owner_u,'owner',null);
  insert into public.captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values
    (c,h,owner_u,gen_random_uuid(),'review_ready',repeat('a',64),'{}',now()),
    (second_c,h,owner_u,gen_random_uuid(),'stored',repeat('b',64),'{}',now());
  insert into private.review_drafts(capture_id,household_id,draft) values(c,h,'{"synthetic":true}');
  if (select draft from private.review_drafts where capture_id=c and household_id=h) <> '{"synthetic":true}'::jsonb then raise exception 'Valid draft roundtrip failed'; end if;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(c,h,'{}');
    raise exception 'Duplicate capture unexpectedly accepted';
  exception when unique_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,other_h,'{}');
    raise exception 'Cross-household draft unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(gen_random_uuid(),h,'{}');
    raise exception 'Missing capture unexpectedly accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,null,'{}');
    raise exception 'Null household unexpectedly accepted';
  exception when not_null_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,h,null);
    raise exception 'SQL null draft unexpectedly accepted';
  exception when not_null_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,h,'null');
    raise exception 'JSON null draft unexpectedly accepted';
  exception when check_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,h,'[]');
    raise exception 'Array draft unexpectedly accepted';
  exception when check_violation then null; end;
  begin
    insert into private.review_drafts(capture_id,household_id,draft) values(second_c,h,'42');
    raise exception 'Scalar draft unexpectedly accepted';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claim.sub',owner_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_u,'role','authenticated')::text,true);
  foreach role_name in array array['authenticated','anon'] loop
    execute format('set local role %I',role_name);
    begin
      perform 1 from private.review_drafts where capture_id=c;
      raise exception 'Client SELECT unexpectedly accepted';
    exception when insufficient_privilege then null; end;
    begin
      insert into private.review_drafts(capture_id,household_id,draft) values(second_c,h,'{}');
      raise exception 'Client INSERT unexpectedly accepted';
    exception when insufficient_privilege then null; end;
    begin
      update private.review_drafts set draft='{}' where capture_id=c;
      raise exception 'Client UPDATE unexpectedly accepted';
    exception when insufficient_privilege then null; end;
    begin
      delete from private.review_drafts where capture_id=c;
      raise exception 'Client DELETE unexpectedly accepted';
    exception when insufficient_privilege then null; end;
    begin
      truncate private.review_drafts;
      raise exception 'Client TRUNCATE unexpectedly accepted';
    exception when insufficient_privilege then null; end;
    execute 'reset role';
  end loop;
  if (select count(*) from private.review_drafts) <> 1 then raise exception 'Client denial changed fixture'; end if;
end
$test$;
select 'passed review-draft RLS/ACL/tenant-FK/unique/JSON/null/client-denial checks; transaction rolled back; no Auth or Storage API operations' as evidence;
rollback;