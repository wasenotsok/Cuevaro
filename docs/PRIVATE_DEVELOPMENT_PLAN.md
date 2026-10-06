# Approved private managed-service checkpoint

Prepared 2026-10-05; Owner approved Supabase Free in Singapore (`ap-southeast-1`) on 2026-10-06 for synthetic data and explicitly approved developer identities. **No account, credentials or deployment created**. Secure project access, project reference and approved identity list are not available in this workspace. Phase 1 and all external release gates remain open. This follows the canonical Supabase/Postgres/Auth/private-storage and modular API plus durable worker architecture.

## Least-cost proposal

Use one Owner-controlled **Supabase Free** development project in the approved region **Singapore (`ap-southeast-1`)**, near the documented early Philippine validation market. Region approval is not a legal compliance conclusion. Confirm availability in the dashboard; do not silently choose another region. [Official regions](https://supabase.com/docs/guides/platform/regions).

[Current Free limits](https://supabase.com/pricing): $0/month, two active projects, 500 MB database, 1 GB object storage, 5 GB egress and 5 GB cached egress, 50,000 MAU and 500,000 Edge Function invocations. Projects pause after one inactive week. Automatic backups, PITR, uptime SLA, private network links and some advanced session controls are absent. These are ceilings, not Cuevaro capacity promises. Proposed test budget: two approved identities, 100 generated captures, 200 MB objects and 50 MB database; stop well before quota, never upgrade automatically. No card, paid organization, SMTP/SMS, domain, AI API or build-service activation.

Stage auth/storage verification first; this does not require adopting Edge Functions for OCR. The existing sharp/Tesseract Node worker has not been qualified for Edge Function memory/runtime limits. A mobile-accessible private API/worker host remains necessary for the automatic slice: prefer an existing Owner-controlled private Linux host, if available, running the same monolith/worker with internal TLS and approved private access. Otherwise present a separate hosting decision; no assumed free always-on host or desktop dependency is concealed. No endpoint is deployed by this plan.

## Owner setup and privacy boundary

Owner accepts provider terms, confirms Free organization/quota availability and specific region, creates or selects the isolated development project, and stores credentials through an approved secret mechanism. Do not paste secrets in chat. Public client configuration may contain only the provider URL/publishable key; privileged keys remain server-only. No production resources are reused.

Only generated receipts enter storage. Account testing uses explicitly approved developer identities: authentication necessarily sends their email/account metadata to Supabase. Keep email verification enabled; default email delivery is team-address-only and currently two messages/hour, so initial testing must use approved team members. Do not bypass this limit, disable verification or purchase SMTP. [Auth email restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

Disable anonymous signup; restrict allowed redirects to the exact development build. Private evidence bucket only, 20 MB application limit, short signed URLs, household predicates/RLS, least-privilege membership and no document-content telemetry. No external AI processing, analytics SDK, public links, real receipts or external testers. Local Tesseract remains synthetic until hosting/privacy approval. Treat Free endpoints as internet-addressable authenticated services, not network-private infrastructure.

## Verification after secure access is available

Apply reviewed migrations to the new empty project; verify two-household isolation, revoked/viewer writes, signed-URL expiry, forged actor refusal and original hash roundtrip. Exercise native SQLCipher/camera/temp cleanup/offline recovery on actual Android/iOS devices. Export synthetic database and objects separately, then restore into a disposable approved target. Free has no automated backups, and database backups exclude Storage objects. [Backup scope](https://supabase.com/docs/guides/platform/backups).

Document results, provider/project identifiers (no secrets), configuration, usage and rollback. Deleting projects or replacing credentials remains an Owner boundary. No phase closes until managed and native evidence meets the canonical acceptance gates. Production hosting, real-data privacy review, notification delivery and release dependency remediation remain separate.
