# Development setup and honest environment boundaries

The canonical product documents remain at the repository root. This monorepo follows their Expo/TypeScript/Postgres direction. Run `npm ci`, `npm run check`, and `npm run mobile`. No paid service, cloud project, credential, public deployment, or real-user data is enabled by these commands.

The native app requires a development build for SQLCipher. Expo Go must not be used as evidence of encrypted storage. A native storage adapter must check `cipher_version` and fail closed rather than silently write unencrypted evidence. Physical Android/iOS testing remains a phase gate.

`supabase/migrations/202610050001_foundation.sql` defines household-scoped domain storage and read-only authenticated grants. `202610050002_private_storage.sql` configures a private Supabase bucket. Managed authentication uses provider `getUser`, not client-declared identity. All server-side service-role operations require explicit membership and tenant predicates. No Supabase project is provisioned and the adapter is not a complete hosted backend.

The authorization suite runs the migration and attacks against actual embedded PostgreSQL (PGlite), with an `auth.uid` fixture replacing only managed identity. It does not prove managed storage isolation or production authentication. Apply storage migration and test signed URL expiry on an approved development Supabase project before closing Phase 1.

Fixture policy: generated receipts only, clearly synthetic merchants and products. No real receipts, customer data, credentials, or raw content in logs. `.local/`, device caches, generated builds and environment files are ignored. The source-pattern scanner is a baseline and cannot replace full secret scanning or review.

Deployment gates remain open: provider/region and privacy review, private staging, hardware camera/secure-storage testing, signed builds, notification delivery, restore, and external-user authorization. A local build never constitutes a release.
