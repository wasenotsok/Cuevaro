-- Durable scoped replay receipts contain no document text or corrected values.
begin;
alter table public.cues add column user_intent jsonb check(user_intent is null or (user_intent->>'type' in ('dismiss','snooze') and jsonb_typeof(user_intent->'version')='number'));
update public.cues set user_intent=jsonb_build_object('type','dismiss','version',0) where state='dismissed';
create table private.purchase_commands(household_id uuid not null,purchase_id uuid not null,mutation_id uuid not null,request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),resulting_version integer not null check(resulting_version>0),created_at timestamptz not null default now(),primary key(household_id,purchase_id,mutation_id),foreign key(purchase_id,household_id) references public.purchases(id,household_id));
alter table private.purchase_commands enable row level security;
revoke all on private.purchase_commands from public,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='anon') then revoke all on private.purchase_commands from anon; end if; end $$;
commit;
