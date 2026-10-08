-- Forward migration. Apply only to a separate development project first.
create schema if not exists private;
create table public.households (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), region text not null, timezone text not null, created_at timestamptz not null default now());
create table public.household_memberships (household_id uuid references public.households on delete cascade, user_id uuid not null, role text not null check(role in ('owner','member','viewer')), revoked_at timestamptz, primary key(household_id,user_id));
create function private.can_access(h uuid, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_memberships m where m.household_id=h and m.user_id=auth.uid() and m.revoked_at is null and (not writing or m.role in ('owner','member')))
$$;
revoke all on function private.can_access(uuid,boolean) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_access(uuid,boolean) to authenticated;
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
create policy households_read on public.households for select to authenticated using(private.can_access(id));
create policy memberships_read on public.household_memberships for select to authenticated using(private.can_access(household_id));
create function public.create_household(p_name text,p_region text,p_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_region !~ '^[A-Z]{2}$' or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid region/timezone'; end if;
 insert into public.households(name,region,timezone) values(p_name,p_region,p_timezone) returning id into h;
 insert into public.household_memberships values(h,auth.uid(),'owner',null);
 return h;
end $$;
revoke all on function public.create_household(text,text,text) from public;
grant execute on function public.create_household(text,text,text) to authenticated;
create table public.captures(id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households, initiated_by_user_id uuid not null, client_capture_id uuid not null, state text not null check(state in ('stored','processing','review_ready','confirmed','failed','deleted')), content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'), quality jsonb not null, captured_at timestamptz not null, created_at timestamptz not null default now(), unique(household_id,client_capture_id), unique(household_id,content_hash), unique(id,household_id));
create table public.evidence_objects(id uuid primary key default gen_random_uuid(), household_id uuid not null, capture_id uuid not null, storage_key text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')), byte_size integer not null check(byte_size between 1 and 20000000), sha256 text not null, created_at timestamptz not null default now(), foreign key(capture_id,household_id) references public.captures(id,household_id), unique(id,household_id));
create table public.extraction_runs(id uuid primary key default gen_random_uuid(), household_id uuid not null, capture_id uuid not null, provider text not null, version text not null, status text not null, foreign key(capture_id,household_id) references public.captures(id,household_id), created_at timestamptz not null default now());
create table public.observations(id uuid primary key default gen_random_uuid(), household_id uuid not null, evidence_id uuid not null, field_name text not null, value jsonb, confidence text not null check(confidence in ('high','medium','low','unknown')), source_locator jsonb not null, created_at timestamptz not null default now(), foreign key(evidence_id,household_id) references public.evidence_objects(id,household_id), unique(id,household_id));
create table public.purchases(id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households, capture_id uuid not null, version integer not null default 1, created_at timestamptz not null default now(), foreign key(capture_id,household_id) references public.captures(id,household_id), unique(capture_id), unique(id,household_id));
create table public.items(id uuid primary key default gen_random_uuid(), household_id uuid not null, purchase_id uuid not null, display_name text not null, lifecycle_status text not null default 'owned', foreign key(purchase_id,household_id) references public.purchases(id,household_id), unique(id,household_id));
create table public.fact_assertions(id uuid primary key default gen_random_uuid(), household_id uuid not null, purchase_id uuid not null, field_name text not null, value jsonb, authority_type text not null check(authority_type in ('user_confirmed','user_entered')), source_observation_id uuid, confirmed_by_user_id uuid not null, confirmed_at timestamptz not null default now(), supersedes_id uuid, foreign key(purchase_id,household_id) references public.purchases(id,household_id), foreign key(source_observation_id,household_id) references public.observations(id,household_id), unique(id,household_id));
create table public.lifecycle_events(id uuid primary key default gen_random_uuid(), household_id uuid not null, purchase_id uuid not null, kind text not null check(kind in ('return','warranty')), status text not null check(status in ('unknown','candidate','active','completed','not_applicable','superseded')), due_date date, timezone text not null, source_fact_ids uuid[] not null default '{}', rule_version text not null, foreign key(purchase_id,household_id) references public.purchases(id,household_id), check(status not in ('active','candidate') or due_date is not null), unique(id,household_id));
create table public.cues(id uuid primary key default gen_random_uuid(), household_id uuid not null, event_id uuid not null, scheduled_for date not null, state text not null default 'scheduled' check(state in ('scheduled','delivered','dismissed','cancelled')), idempotency_key text not null unique, foreign key(event_id,household_id) references public.lifecycle_events(id,household_id));
create table public.jobs(id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households, type text not null, resource_id uuid not null, idempotency_key text not null unique, state text not null default 'pending', attempts integer not null default 0, available_at timestamptz not null default now(), leased_until timestamptz, error_code text, created_at timestamptz not null default now());
create table public.audit_events(id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households, actor_id uuid not null, event_type text not null, entity_id uuid not null, correlation_id uuid not null, created_at timestamptz not null default now());
-- Client mutations go through the validated API. authenticated has read-only domain grants.
do $$ declare t text; begin
 foreach t in array array['captures','evidence_objects','extraction_runs','observations','purchases','items','fact_assertions','lifecycle_events','cues','jobs','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy tenant_read on public.%I for select to authenticated using(private.can_access(household_id))',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.households,public.household_memberships to authenticated;
create index jobs_ready on public.jobs(available_at) where state='pending';
create index captures_tenant on public.captures(household_id);
create index items_tenant on public.items(household_id);
