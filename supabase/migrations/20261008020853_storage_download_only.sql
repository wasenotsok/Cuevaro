-- Forward scoped hardening; no bucket/data changes or new grants.
-- Generic SELECT also permits client signing with arbitrary positive expiry.
-- Service-role signing remains server-only and bounded by the adapter to 60 seconds.
begin;
alter policy evidence_read on storage.objects using (
  bucket_id='evidence'
  and storage.allow_only_operation('object.get_authenticated')
  and exists (
    select 1 from public.evidence_objects e
    where e.storage_key=storage.objects.name and private.can_access(e.household_id)
  )
);
commit;
