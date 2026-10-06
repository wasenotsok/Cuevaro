-- Original files remain distinct immutable evidence objects under one capture.
-- Apply to a separate approved development target first, never infer live setup.
begin;
alter table public.evidence_objects add column page_number integer not null default 1 check(page_number between 1 and 10);
create unique index evidence_page_order on public.evidence_objects(capture_id,page_number);
commit;
