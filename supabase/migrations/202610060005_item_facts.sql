-- Scoped forward migration; per-item facts reuse immutable observation/assertion history.
begin;
alter table public.fact_assertions add column item_id uuid;
alter table public.items add constraint item_purchase_identity unique(id,purchase_id,household_id);
alter table public.fact_assertions add constraint fact_item_purchase foreign key(item_id,purchase_id,household_id) references public.items(id,purchase_id,household_id);
alter table public.fact_assertions add constraint fact_item_nonzero check(item_id is null or item_id<>'00000000-0000-0000-0000-000000000000'::uuid);
alter table public.fact_assertions add column item_scope uuid generated always as (coalesce(item_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored;
alter table public.fact_assertions add constraint fact_history_identity unique(id,purchase_id,household_id,field_name,item_scope);
alter table public.fact_assertions add constraint fact_supersedes_scope foreign key(supersedes_id,purchase_id,household_id,field_name,item_scope) references public.fact_assertions(id,purchase_id,household_id,field_name,item_scope);
create unique index fact_one_successor on public.fact_assertions(supersedes_id) where supersedes_id is not null;
create index fact_item_history on public.fact_assertions(purchase_id,item_id,field_name);
commit;
