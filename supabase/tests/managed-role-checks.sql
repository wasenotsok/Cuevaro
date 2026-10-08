-- Parent executor only, after the complete reviewed migration set.
-- SQL-role simulation, not Auth/Storage API proof. No auth.users/storage.objects writes.
-- Every synthetic application row rolls back, even on failed assertions.
begin;
do $$
declare h uuid; other_h uuid; t text; privilege text;
  u uuid := '11111111-1111-4111-8111-111111111111';
  other_u uuid := '22222222-2222-4222-8222-222222222222';
  operation text;
begin
  foreach t in array array['households','household_memberships','captures','evidence_objects','extraction_runs','observations','purchases','items','fact_assertions','lifecycle_events','cues','jobs','audit_events'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS missing: %',t; end if;
    if not has_table_privilege('authenticated','public.'||t,'SELECT') then raise exception 'SELECT missing: %',t; end if;
    foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon','public.'||t,privilege) or has_table_privilege('authenticated','public.'||t,privilege) then raise exception 'Client write grant: %.%',t,privilege; end if;
    end loop;
    if has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'Anonymous read grant: %',t; end if;
  end loop;
  if has_function_privilege('anon','public.create_household(text,text,text)','EXECUTE') then raise exception 'Anonymous household RPC'; end if;
  if has_table_privilege('anon','private.purchase_commands','SELECT') or has_table_privilege('authenticated','private.purchase_commands','SELECT') then raise exception 'Client replay receipt grant'; end if;
  if not exists(select 1 from storage.buckets where id='evidence' and not public and file_size_limit=20000000 and allowed_mime_types @> array['image/png','image/jpeg','application/pdf']) then raise exception 'Private bucket configuration mismatch'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='evidence_read' and qual like '%allow_only_operation%') then raise exception 'Operation policy missing'; end if;
  foreach operation in array array['object.sign','storage.object.sign','object.sign_many','object.list','object.get_authenticated_info','object.upload','','object.get_authenticated.extra'] loop
    perform set_config('storage.operation',operation,true);
    if storage.allow_only_operation('object.get_authenticated') then raise exception 'Unexpected allowed operation: %',operation; end if;
  end loop;
  perform set_config('storage.operation','storage.object.get_authenticated',true);
  if not storage.allow_only_operation('object.get_authenticated') then raise exception 'Raw download helper denied'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  h := public.create_household('Synthetic role fixture A','PH','Asia/Manila');
  if (select count(*) from public.households where id=h)<>1 then raise exception 'Owner read failed'; end if;
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_u,'role','authenticated')::text,true);
  other_h := public.create_household('Synthetic role fixture B','PH','Asia/Manila');
  if exists(select 1 from public.households where id=h) then raise exception 'Cross-household read'; end if;
  begin
    insert into public.household_memberships values(h,other_u,'owner',null);
    raise exception 'Escalation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  update public.household_memberships set revoked_at=now() where household_id=other_h and user_id=other_u;
  execute 'set local role authenticated';
  if exists(select 1 from public.households where id=other_h) then raise exception 'Revoked read'; end if;
  execute 'reset role';
end $$;
select 'passed SQL role/policy checks; API authentication/uploads/URL expiration/managed backup not tested' as evidence;
rollback;
