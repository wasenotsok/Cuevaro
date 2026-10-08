-- Forward-only least privilege for these application tables, not unrelated schemas.
-- RLS does not protect TRUNCATE: remove inherited/default client grants explicitly.
begin;
do $$ declare t text; begin
 foreach t in array array['households','household_memberships','captures','evidence_objects','extraction_runs','observations','purchases','items','fact_assertions','lifecycle_events','cues','jobs','audit_events'] loop
 execute format('revoke all privileges on table public.%I from public, anon, authenticated',t);
 execute format('grant select on table public.%I to authenticated',t);
 end loop;
end $$;
-- A provider default ACL can explicitly grant anon EXECUTE despite PUBLIC revoke.
revoke all privileges on function public.create_household(text,text,text) from public, anon, authenticated;
grant execute on function public.create_household(text,text,text) to authenticated;
revoke all privileges on function private.can_access(uuid,boolean) from public, anon, authenticated;
grant execute on function private.can_access(uuid,boolean) to authenticated;
commit;
