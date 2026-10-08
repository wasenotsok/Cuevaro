-- Supabase-specific storage setup; not run by the embedded Postgres fixture.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,20000000,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
-- No client writes: API chooses paths, validates bytes/hash, and acknowledges durability.
create policy evidence_read on storage.objects for select to authenticated using(bucket_id='evidence' and exists(select 1 from public.evidence_objects e where e.storage_key=name and private.can_access(e.household_id)));
