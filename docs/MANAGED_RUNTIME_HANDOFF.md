# Process-only managed development handoff

Checkpoint: 2026-10-08. Target is existing Cuevaro Development `wqwapaklrfpckhgjsejf`, Singapore/Free. Parent remains the sole managed-write coordinator. These tools create no Auth users, passwords, keys, emails, invitations, persistent environment variables, deployments, or managed database/Storage mutations.

## Runtime composition and minimum inputs

`packages/providers/managed-development.ts` composes the existing guarded Supabase adapter. It is server-only, locks the URL to `https://wqwapaklrfpckhgjsejf.supabase.co`, loads only the calling process environment, and neither loads .env files nor starts a listener. It requires:

| Variable | Meaning |
| --- | --- |
| CUEVARO_SUPABASE_PUBLISHABLE_KEY | Existing public project key; modern publishable or legacy anon role |
| CUEVARO_SUPABASE_SERVICE_ROLE_KEY | Existing server-only secret key or legacy service_role key |

The syntax/legacy-role checks reject key swaps, unrelated roles, whitespace/header injection, oversized or missing values. They do not cryptographically authenticate credentials. Actual provider requests still verify identity and re-read membership. Copied actors and actors retained from another runtime instance are rejected. No fallback to generic SUPABASE_* variables exists; no project URL override is accepted. No secret-bearing configuration object or key is exposed by the returned interface. Do not log returned bearer evidence URLs.

The composition supports existing identity/membership, immutable original upload and revalidated60-second signing adapter methods. The existing application commands now run through a shared SQL transaction interface, node-pg adapter and managed original store. Loopback API/separate worker entry points are prepared. No service has been hosted or started against managed resources, and the native managed vertical slice remains open. Neither service keys nor publishable keys were retrieved during this work.

## Owner-operated secure input route

The concrete desktop route is `scripts/run-managed-verification.ps1`. Run it interactively in the Owner's local PowerShell; every missing value is entered through masked Read-Host. Inputs remain in the process environment only for the child command; finally restores previous process values even on failure. No setx, credential file, command-line secret, account creation/login, or email operation occurs. Existing process values are reused. Optional foreign token can be left empty. A future configured secret manager may inject these same process variables, but no such integration is currently available.

From the repository root:

```powershell
.\scripts\run-managed-verification.ps1 -Mode RuntimeCheck
```

This validates key roles and creates SDK clients **without network calls**; it is not credential/API acceptance. The Owner enters existing keys locally only after the credential/access handoff is authorized. This assistant must not generate/transmit passwords, retrieve secret keys, or invoke interactive entry on the Owner's behalf.

For the existing real read-only probe:

```powershell
.\scripts\run-managed-verification.ps1 -Mode ReadProbe
```

Required process names are CUEVARO_SUPABASE_PUBLISHABLE_KEY, CUEVARO_APPROVED_USER_TOKEN, CUEVARO_TEST_HOUSEHOLD_ID and CUEVARO_TEST_ORIGINAL_PATH; CUEVARO_OTHER_APPROVED_USER_TOKEN is optional for foreign denial. Token inputs are actual short-lived authenticated access tokens, not passwords. Both modes reject a privileged key accidentally used as a publishable key before any API request. The probe performs no uploads or mutations, and logs only sanitized status/codes. It requires an already uploaded synthetic original and matching domain metadata. Direct equivalent: `node --import tsx scripts/verify-managed-read-access.ts`.

Process/user/machine presence-only checks found all five probe inputs, the new server key input and generic SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY/DATABASE_URL absent; no root .env file exists. Actual probe/check invocations without configuration report blocked. Management connector authorization is separate and cannot supply Auth sessions or prove Storage byte operations.

## Synthetic identities and local fixture tools

Two approved existing identities suffice for the read-only owner/foreign probe. Full role acceptance uses five distinct actual Auth UUIDs: owner, member, viewer, revoked member, and foreign non-member (owner in separate household). These are database memberships, never user_metadata authority. Auth users currently number zero. Creating exactly these five accounts is now Owner-approved; password entry/submission remains exclusively Owner-operated and the verification route must follow the approved five-synthetic-account-only auto-confirm scope without emails; general synthetic-data approval already covers ordinary local fixtures and tests. Do not surprise the Owner with signup emails, invitations, recovery mail or confirmation bypasses; account password entry must be Owner-operated. No Auth configuration changes are included.

After approved accounts exist, make an ignored local JSON file containing only the five role-to-UUID entries, with keys `owner`, `member`, `viewer`, `revoked`, `foreign`. It must contain no emails/passwords/tokens or extra fields.

```powershell
node --import tsx scripts/prepare-managed-fixture.ts .local/approved-identity-ids.json
```

This performs zero network calls and creates a new exclusive .local/managed-fixtures/UUID directory with generated synthetic original.png, nonsensitive manifest.json and 01-households.sql. The SQL refuses missing Auth IDs and duplicate/existing record conflicts; inserts two synthetic households and five memberships atomically. It does not create Auth users or touch storage.objects. Parent reviews and coordinates execution only after identity approval. Preserve the same manifest across retries; rerunning preparation creates a different plan, never an automatic replacement.

Next, an authorized server path uploads original.png under manifest.storageKey in private evidence with upsert=false, downloads the actual object, and verifies exact bytes/hash. Never SQL-seed storage.objects to simulate a real upload. After that actual readback:

```powershell
node --import tsx scripts/prepare-managed-evidence.ts .local/managed-fixtures/PLAN/manifest.json .local/actual-storage-download.png
```

This checks bounded byte count/SHA and canonical tenant/capture path, producing an exclusive 02-evidence-after-readback.sql for parent review. It creates no managed rows. Local byte matching alone cannot prove remote upload: parent must establish the API readback provenance before execution. The SQL inserts one stored capture, immutable evidence metadata/page1 and audit event in one transaction, without overwrite/upsert. Quality remains explicitly not_evaluated; no extraction/facts/deadlines are invented. It is an API security fixture, not evidence that the real Capture Quality Gate ran.

Populate probe household/path from this same manifest, and use actual owner/foreign sessions through the masked launcher. Full live upload failure/retry, viewer/revocation,60-second URL expiry, managed export/restore and actual mobile/private API acceptance remain required. Synthetic transport and PGlite tests do not close these gates. Keep dependency gate enforced; no merge or public deployment is authorized.

## Private managed application startup (prepared; not executed)

After parent applies the separately reviewed forward review-draft migration and the Owner securely supplies existing project inputs locally:

```powershell
.\scripts\run-managed-verification.ps1 -Mode ManagedApi
# In a separate Owner-operated terminal:
.\scripts\run-managed-verification.ps1 -Mode ManagedWorker
```

Required process inputs: CUEVARO_SUPABASE_PUBLISHABLE_KEY, CUEVARO_SUPABASE_SERVICE_ROLE_KEY, CUEVARO_POSTGRES_HOST, CUEVARO_POSTGRES_USER, CUEVARO_POSTGRES_PASSWORD. Optional CUEVARO_POSTGRES_CA supplies a trusted CA without disabling TLS verification. Only the approved project direct host or Singapore session pooler is accepted; pooler user must include the exact project suffix. Port5432, databasepostgres, four connections, bounded query/connection/HTTP deadlines. No DATABASE_URL fallback or environment-file load. API binds127.0.0.1:4329; this is not reachable by an ordinary mobile device and is not hosting acceptance. Requests use actual Bearer Auth and X-Household-Id, with the existing development-only synthetic mutation marker. Worker drains in-flight work on cancellation. Readiness checks the private table/RLS prerequisite only.

Windows Chrome was opened to https://supabase.com/dashboard/project/wqwapaklrfpckhgjsejf/auth/users for Owner-operated input. No existing login session was inspected. Add user -> Create new user uses Email address/User Password fields and sends no confirmation email. **Auto confirm user? defaults checked** (official Studio source). Owner subsequently approved that option for exactly the five synthetic accounts without email delivery; no project-wide setting change is authorized. Owner performs password entry and submission. Account creation/completion is still pending and must be verified by parent, not inferred from consent. Do not use Invite user, alter project settings or enter passwords through assistant tools. Parent can coordinate nonsensitive UUID memberships after actual accounts exist; UUID presence is not authenticated API evidence.


## Current managed review-table application - 2026-10-08

Parent sole executor applied the separate reviewed table migration **once** as managed version **20261008035615**, name `cuevaro_managed_review_drafts`, from source checkpoint `47785e1f20bfe3b9c97b1ef322736e68212ece3d`. Source file `20261008030442_managed_review_drafts.sql` maps to that managed version; never reapply it or the preceding baseline20261008022037. Reviewed body SHA256380c244a80f4650556d1bd8532da702ad67acbdd52dd7888322a4479c14c584f and source SHA2563a8438f4406780f4ad5baec922bb28fa1ff6c6af9125550bad30a0aca65e34d5 match canonical Git blobs. Earlier dated "unapplied" statements and the immutable pre-application manifest are historical checkpoints superseded by this receipt.

Parent catalog verified private.review_drafts ownershippostgres, enabledRLS, zero client policies, postgres-onlyACL includingPG17MAINTAIN, capture primary key, composite capture/household FK, all3 NOT NULL columns and JSON-object constraint. The supplied rollback-only SQL passed once: valid roundtrip plus duplicate/missing/cross-household/null/JSON refusals, all8 client privilege checks and actual anon/authenticated SELECT/INSERT/UPDATE/DELETE/TRUNCATE denial. Its exact reproducible artifact [cuevaro-managed-review-drafts-role-checks.sql](../supabase/tests/cuevaro-managed-review-drafts-role-checks.sql) hashes595e9e7ccec61352f598a9310f9408fdac53580d01de227f5cf5d95a7f0d3d26 (UTF-8/LF, no terminal newline). Desktop recorded it without executing managed SQL. Final application/Auth/Storage fixture counts were zero at parent observation; this is not a claim about later Owner account creation.

See [structured parent receipt](managed-review-drafts-evidence-2026-10-08.json). Advisors remain: one securityWARN for intentional authenticated SECURITYDEFINERcreate_household; two securityINFO no-policy tables (private replay/review, intentional client denial);16 unindexed-FKINFO, including the new composite FK, and4 unused-indexINFO. No extra grants/policies/indexes or Auth/Storage operations were introduced. This is managed SQL validation, distinct from implementation checkpoint47785e1 CI37724511877, which passed115 tests (including disposable realPG17),15 browser journeys and exports; its dependency gate failed.

Owner approved email auto-confirm for **exactly five synthetic accounts only**, without email delivery or project-wide Auth changes. Owner performs password entry/submission; account handoff remains pending. No desktop account operation or live API/worker startup occurred. Actual Auth/StorageAPI/expiry/restore/native/hosting gates and Phase1 remain open.
