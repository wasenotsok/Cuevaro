# Cuevaro — Engineering, Resources, and Recommended Stack

Status: recommended development baseline, not yet implemented

## 1. Engineering objective

Build the smallest architecture that can safely support a commercial mobile-first product without painting Cuevaro into a corner.

Priorities:
1. mobile capture speed;
2. trustworthy data/provenance;
3. durable reminders;
4. privacy/security;
5. measurable AI quality;
6. low operational complexity;
7. reasonable cost for a small team.

Avoid microservices, custom ML training, Kubernetes, and bespoke infrastructure in V1 unless evidence forces them.

## 2. Recommended repository model

Monorepo:

```text
/
├─ apps/
│  ├─ mobile/        # iOS + Android
│  ├─ web/           # desktop/web companion, initially lighter
│  └─ ops/           # later internal support/review console
├─ services/
│  ├─ api/
│  └─ worker/
├─ packages/
│  ├─ domain/
│  ├─ schemas/
│  ├─ providers/
│  ├─ ui/
│  └─ test-fixtures/
├─ supabase/
│  └─ migrations/
├─ docs/
├─ scripts/
└─ .github/workflows/
```

Logical subsystem boundaries matter; deployment count does not.

## 3. Recommended technologies

### Mobile
- React Native with Expo;
- TypeScript;
- Expo Router or equivalent;
- native camera/document APIs where quality requires it;
- secure credential/token storage using platform keychain/keystore;
- push via APNs/FCM through a managed abstraction where practical.

Why: one team can ship iOS and Android while retaining access to camera, share, notifications, biometrics, offline storage, and native modules.

### Desktop/web companion
- Next.js + TypeScript;
- responsive design using the same product vocabulary and API;
- no requirement to duplicate every mobile interaction immediately.

### Backend
- TypeScript API using a boring, well-supported framework such as Fastify/NestJS/Hono depending on team preference;
- PostgreSQL as source-of-truth;
- Supabase is a strong V1 candidate for managed Postgres, Auth, Storage, row-level security, and developer velocity;
- background worker for extraction, policy lookup, lifecycle recomputation, notification scheduling, export/deletion tasks.

### Durable jobs
Prefer Postgres-backed/durable job infrastructure or a managed workflow service. Reminder correctness is more important than fashionable architecture.

Requirements:
- idempotency keys;
- retries with backoff;
- dead-letter/review path;
- durable schedule state;
- no dependence on a mobile app remaining open.

### Object storage
Private object storage with:
- per-household authorization;
- short-lived signed URLs;
- malware/content validation;
- encryption at rest;
- lifecycle/retention policy.

### AI
Use a provider abstraction over multimodal structured extraction and reasoning. Do not hard-code business logic to one model response format throughout the app.

AI workloads:
- document/image classification;
- structured extraction;
- entity-match ranking;
- evidence summarization;
- action-draft generation;
- policy normalization where deterministic validation follows.

Image quality, barcode, simple OCR, and redaction should move on-device where it improves latency/privacy/cost.

### Billing
For mobile subscriptions, a service such as RevenueCat can reduce App Store / Play billing complexity. Web billing can be added only when store policy and product strategy justify it.

### Observability
- Sentry or equivalent for errors/performance;
- privacy-conscious product analytics such as PostHog with content redaction;
- structured server logs excluding user document bodies by default;
- uptime/queue health monitoring.

### CI/CD
GitHub Actions:
- lint/typecheck;
- unit/integration;
- migrations;
- API contract checks;
- AI benchmark subset;
- mobile/web build;
- security/dependency scanning;
- staged release.

## 4. Development environments

At minimum:
- local;
- shared development;
- staging with non-production test data;
- production.

Never use real personal documents in ordinary automated test fixtures.

Separate:
- API keys;
- databases;
- storage buckets;
- push credentials;
- billing environments;
- analytics projects.

## 5. Required accounts/services before implementation

Exact providers can change. Capabilities required:
- Apple Developer account;
- Google Play Console account;
- cloud database/storage;
- AI API;
- push notification credentials;
- transactional email provider later;
- error monitoring;
- analytics;
- billing/subscription service;
- domain/DNS;
- support email/helpdesk;
- GitHub repository/CI.

## 6. Local hardware/resources

V1 development does not need specialist hardware or model training GPUs.

Useful:
- existing Windows development PC;
- at least one real Android phone;
- access to a physical iPhone before iOS release;
- multiple camera quality levels for testing;
- printer/thermal receipts and sample documents;
- optional Mac/cloud macOS build capacity for iOS pipeline if development environment requires it.

## 7. Team capabilities

A very small team can build V1 if responsibilities are covered:
- product/UX;
- TypeScript/mobile engineering;
- backend/database;
- security/privacy review;
- AI evaluation/data work;
- QA/release;
- customer support/operations.

One person may cover multiple roles, but no role may be silently omitted.

External specialist review is worthwhile before public launch for:
- privacy/legal terms;
- security/pentest;
- trademark/brand clearance;
- app-store/tax/accounting questions.

## 8. Data migration discipline

Database schema changes:
- versioned migrations;
- backward-compatible rollout where possible;
- backup before destructive migrations;
- restore test;
- migration rollback or forward-fix plan.

AI schema changes are data migrations too when stored structured fields change meaning.

## 9. Performance targets to validate

Initial targets, subject to measurement:
- camera ready quickly enough to feel immediate on supported devices;
- local quality gate target under ~500 ms for common captures where technically feasible;
- upload begins immediately and may continue asynchronously;
- clean receipt extraction typically returns a review-ready result in several seconds, with explicit progress rather than frozen UI;
- home screen should not require expensive AI generation;
- search over confirmed metadata should feel interactive;
- notification scheduling must not depend on foreground sessions.

Do not promise exact SLAs until measured.

## 10. Cost discipline

Track unit cost per:
- capture;
- extraction attempt;
- successful confirmed capture;
- policy lookup;
- GB stored;
- monthly active household;
- push/email delivery;
- support case.

Use lower-cost/on-device checks before expensive AI where quality allows.

Cache policy/source lookups with freshness metadata rather than repeatedly paying to rediscover unchanged rules.

## 11. Build-vs-buy rule

Buy/managed-service when:
- it is commodity infrastructure;
- security burden is high;
- switching path exists;
- it does not define Cuevaro's edge.

Build when it defines the product:
- lifecycle/consequence engine;
- provenance/confidence model;
- evidence-to-entity linking;
- capture/review UX;
- cue/action logic;
- trust/audit behavior.

Cuevaro's moat should be product intelligence and accumulated lifecycle graph, not a custom authentication server.

## 12. Accessibility and localization

Engineering must support:
- scalable text;
- screen readers;
- semantic labels;
- sufficient contrast;
- reduced motion;
- touch targets;
- RTL readiness where practical;
- locale-safe dates/numbers/currencies;
- timezone-aware lifecycle dates.

Philippines can be an early validation market, but architecture should not assume one currency, language, retailer policy, or date format.

## 13. Definition of engineering-ready

Implementation can begin when:
- product V1 scope is frozen enough for Phase 1;
- domain entities and lifecycle invariants are agreed;
- threat model baseline exists;
- benchmark fixture policy exists;
- repository/CI conventions are chosen;
- staging/prod account ownership is clear;
- first mobile flow wireframe is approved.
