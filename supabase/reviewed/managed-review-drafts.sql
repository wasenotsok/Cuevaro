-- Review locally first; parent coordinates any later managed application.
-- Reuses capture/evidence/observation separation; no client access or byte storage.
create table private.review_drafts (
 capture_id uuid primary key,
 household_id uuid not null,
 draft jsonb not null check(jsonb_typeof(draft)='object'),
 foreign key(capture_id,household_id) references public.captures(id,household_id)
);
alter table private.review_drafts enable row level security;
revoke all on table private.review_drafts from public,anon,authenticated;
