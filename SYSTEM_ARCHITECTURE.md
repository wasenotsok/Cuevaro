# System Architecture — Cuevaro

## 1. Architecture objective

Build Cuevaro so a small team can ship V1 quickly without creating a disposable prototype, while preserving clear seams for:

- AI provider changes;
- mobile/web clients;
- household sharing;
- background jobs;
- policy intelligence;
- stronger encryption/privacy modes;
- later business edition.

The architecture must optimize for **simplicity of operations**, **evidence integrity**, and **security isolation** before scale theater.

## 2. Recommended V1 technology baseline

This is a recommendation to validate at implementation start, not an eternal mandate.

### Client
- **React Native with Expo + TypeScript** for Android/iOS.
- Expo cloud builds allow iOS/Android binaries to be produced from a Windows development environment.
- Web management surface later with **Next.js + TypeScript** if needed.

### Backend
- **TypeScript/Node.js** service layer to keep one primary application language.
- REST/JSON API first. GraphQL is unnecessary for V1.
- Long-running processing isolated from request handlers.

### Data/auth/storage
- **PostgreSQL** as canonical structured store.
- **Supabase** is the recommended V1 managed platform for Postgres, Auth, and private object storage, using strict Row Level Security plus server-side authorization.
- Original evidence stored in private object storage, never public buckets.

### Background jobs
- Durable Postgres-backed job queue for V1 (for example `pg-boss` or equivalent).
- Separate worker process for:
  - AI extraction;
  - image/document preprocessing;
  - policy lookup;
  - cue generation;
  - notification fanout;
  - export creation;
  - deletion jobs.

Avoid introducing Redis solely for the queue until volume or latency justifies it.

### AI
- Provider abstraction.
- Initial provider may use OpenAI vision-capable API with structured output validation.
- Requests carrying user evidence should avoid persistent model-side application state where possible and must follow the configured privacy/retention policy.
- No AI provider output writes directly into authoritative confirmed fields without validation/state transition.

### Push
- Expo push notification path for V1, with device-token abstraction so APNs/FCM direct integration remains possible later.

### Email
- Transactional provider behind an interface; use only for verification, recovery, account notices, and later optional cues/digests.

### Error monitoring
- Sentry or equivalent only after PII scrubbing and payload review.
- No automatic attachment/document capture in telemetry.

### Billing
- Keep entitlement logic provider-neutral.
- Native mobile subscriptions must comply with current Apple/Google rules.
- RevenueCat or equivalent may simplify entitlement synchronization; evaluate privacy and cost before adoption.
- Web merchant-of-record provider such as Paddle is an option if/when web checkout is commercially useful and compliant with store policies.

## 3. Repository shape

Recommended monorepo after Cuevaro repository exists:

```text
/
├─ README.md
├─ docs/
├─ apps/
│  ├─ mobile/            # Expo React Native
│  ├─ web/               # Later Next.js customer/web surface
│  └─ ops/               # Minimal internal operator console, later
├─ services/
│  ├─ api/               # HTTP API/application service
│  └─ worker/            # durable async jobs
├─ packages/
│  ├─ domain/            # entities, invariants, shared business rules
│  ├─ schemas/           # request/event/AI schemas
│  ├─ ui/                # design tokens/shared UI where appropriate
│  ├─ providers/         # AI, email, push, billing abstractions
│  └─ test-fixtures/
├─ supabase/
│  ├─ migrations/
│  └─ seed/
├─ scripts/
└─ .github/workflows/
```

Do not create a microservice per subsystem in V1. Logical boundaries are more important than deployment count.

## 4. System context

```text
User / Household
        |
        v
Mobile App  ---- optional Web App
        |
        v
     API Layer
        |
   +----+-------------------------------+
   |                                    |
   v                                    v
PostgreSQL                         Private Object Storage
   |                                    |
   +---------------+--------------------+
                   |
                   v
              Durable Job Queue
                   |
                   v
                 Worker
     +-------------+-------------+----------------+
     |             |             |                |
     v             v             v                v
AI Provider   Policy Sources  Push/Email     Export/Retention
```

## 5. Major subsystems

### S1 — Identity and Household
Responsibilities:
- authentication;
- household creation;
- memberships/roles;
- invite/revoke;
- session/device management;
- authorization boundary.

### S2 — Capture and Ingestion
Responsibilities:
- camera/library/PDF/manual inputs;
- upload integrity;
- deduplication;
- offline queue;
- source metadata;
- capture state machine.

State example:
`local_pending → uploading → stored → processing → review_ready → confirmed | failed | deleted`

### S3 — Evidence Vault
Responsibilities:
- original immutable-ish evidence object;
- thumbnails/previews;
- content hash;
- metadata;
- attachment relationships;
- retention/deletion;
- signed/short-lived access.

Original evidence should not be silently modified after confirmation. Any normalized derivative is a separate object.

### S4 — Extraction
Responsibilities:
- document/image preprocessing;
- classification;
- structured extraction;
- per-field confidence;
- evidence region/crop references;
- schema validation;
- retry/error handling.

### S5 — Entity Resolution and Linking
Responsibilities:
- merchant normalization;
- item identity;
- brand/model/serial matching;
- link new service document to existing item;
- duplicate purchase detection;
- household-person/property/vehicle association later.

Entity merging must be reversible/auditable.

### S6 — Lifecycle / Consequence Engine
Responsibilities:
- turn facts into lifecycle candidates;
- compute return/warranty/expiry/maintenance events;
- generate obligation/cue candidates;
- dependency tracking when source facts change;
- invalidate/recompute derived dates safely.

This is the conceptual heart of Cuevaro.

### S7 — Policy Intelligence
Responsibilities:
- retailer return policies;
- manufacturer warranty references;
- later regulatory/renewal guidance;
- jurisdiction/market selection;
- source URL and checked-at date;
- normalized policy rules;
- provenance and review.

Policy intelligence must support "unknown" rather than fabricate.

### S8 — Cue Scheduler
Responsibilities:
- schedule durable future attention;
- deduplicate;
- local timezone handling;
- reschedule when source event changes;
- quiet hours/digest settings;
- delivery state and retry.

### S9 — Action Engine
Responsibilities:
- action checklist;
- evidence bundle;
- generated summary/draft;
- completion and outcome;
- lifecycle state update.

V1 prepares actions. Autonomous external submission is later and always permission-gated.

### S10 — Search and Retrieval
Responsibilities:
- structured search;
- OCR/extracted text index;
- identifier-first ranking;
- household isolation;
- later semantic search.

Postgres full-text/trigram search is enough for V1. A vector database is not required simply because the product uses AI.

### S11 — Sharing and Access
Responsibilities:
- household roles;
- record access;
- later fine-grained sharing;
- share audit;
- export bundle access.

### S12 — Notification Delivery
Responsibilities:
- push;
- in-app inbox;
- later email/digest;
- delivery receipts;
- user preferences;
- suppression/deduplication.

### S13 — Billing and Entitlements
Responsibilities:
- plan;
- entitlement;
- limits;
- renewal status;
- grace period;
- store/provider receipts.

Product data must remain readable/exportable when a subscription lapses. Avoid holding user documents hostage.

### S14 — Audit and Provenance
Responsibilities:
- who/what changed authoritative fields;
- AI proposal history;
- user confirmation;
- source facts;
- recomputation;
- sensitive access where required.

### S15 — Privacy / Data Rights
Responsibilities:
- data export;
- deletion;
- retention;
- consent/notice version;
- privacy request workflow;
- vendor/subprocessor registry.

### S16 — Operator / Support
Responsibilities:
- account/support lookup using non-sensitive metadata;
- job health;
- privacy-safe diagnostics;
- feature flags;
- incident controls.

Internal operators should not have casual document browsing. Sensitive support access requires explicit purpose and audit.

## 6. Domain state separation

Cuevaro must distinguish four layers:

1. **Evidence:** what was actually uploaded or sourced.
2. **Observation:** what the system extracted/researched.
3. **Confirmed fact:** what Cuevaro currently treats as authoritative for the user.
4. **Derived consequence:** what was computed from confirmed facts/policies.

Never collapse these into one mutable JSON blob.

Example:

```text
receipt image
  ↓
observation: purchase_date = 2026-10-05 (0.98)
  ↓ user confirms
fact: purchase_date = 2026-10-05
  ↓
policy: return = 30 days, source X, checked Y
  ↓
derived event: return_deadline = 2026-11-04
  ↓
cue: notify 2026-10-28
```

If the return policy changes later, Cuevaro can explain why the earlier deadline existed.

## 7. API principles

- versioned API contract;
- idempotency keys for capture creation and job-triggering mutations;
- optimistic concurrency/version field for mutable records;
- pagination on collections;
- strict schema validation;
- no raw AI-provider schema exposed to clients;
- signed short-lived evidence URLs;
- error codes distinguish retryable vs user-action-required.

## 8. Job principles

Every background job has:
- stable job type;
- idempotency key;
- attempt count;
- status;
- timestamps;
- correlation/request ID;
- sanitized error;
- retry policy;
- dead-letter/manual-review state.

A user should never receive duplicate reminders because a worker retried.

## 9. Environments

Minimum:
- local/dev;
- staging;
- production.

Separate credentials, storage, database, notification targets, AI projects/keys, and analytics streams.

Production user documents must never be copied into dev/test.

## 10. Feature flags

Use explicit flags for:
- merchant policy lookup;
- warranty research;
- family sharing;
- AI model changes;
- new document types;
- external actions.

Feature flags must not become permanent configuration debt. Each flag has owner, purpose, created date, and removal condition.

## 11. Scalability

V1 should scale vertically/managed-service-first.

Expected first bottlenecks:
- image storage;
- AI request cost/latency;
- background processing;
- notification volume;
- search index size.

Postgres can support early commercial scale if queries/indexes/RLS are designed correctly. Do not introduce distributed architecture before measurements show a need.

## 12. Disaster recovery

- automated database backups;
- object storage versioning or recoverable deletion strategy where provider supports it;
- documented RPO/RTO targets;
- restoration drills;
- integrity checks between DB attachments and objects;
- backup encryption;
- separate backup credentials.

Targets should be decided before public launch. Suggested starting objective: RPO ≤ 24h, RTO ≤ 8h for early-stage consumer service, then tighten based on usage and plan promises.

## 13. Architecture decision gates

Before implementation begins, confirm:
- Expo/React Native choice;
- Supabase region/data residency;
- worker host;
- AI provider/privacy configuration;
- notification provider;
- billing/entitlement provider;
- object retention/backups;
- support/observability vendors.

Document selected providers in `DECISIONS.md`, not only environment files.

## Mobile-first client architecture amendment

The mobile app is the primary Cuevaro client. Desktop/web is a companion sharing the same API, authorization model, records, lifecycle engine, evidence, and audit history.

The preferred capture path is:

```text
Mobile camera/share sheet
        ↓
Local capture preservation
        ↓
On-device/low-cost Capture Quality Gate
        ↓
Good → upload / process
Questionable → user choice
Bad → retake / replace
        ↓
Durable upload
        ↓
Extraction / linking / lifecycle
        ↓
Minimal confirmation with contextual quick replies
```

A capture must remain locally recoverable until the server acknowledges durable storage, unless the user explicitly discards it. Poor connectivity must not turn a captured receipt into lost evidence.

Quick replies are presentation controls over explicit domain actions. They must call the same validated commands as any equivalent menu/form action and must not bypass permission, audit, or confirmation rules.
