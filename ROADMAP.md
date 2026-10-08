# Cuevaro Roadmap

Status: source-of-truth delivery sequence  
Rule: phase completion requires evidence and its release gate; a later phase must not silently pull broad scope forward.

## Phase 0 — Product Definition and Commercial Blueprint
**Status: Completed**

Goal: make Cuevaro understandable and development-ready before implementation.

Completed scope:
- product identity and boundary;
- competitive study;
- mobile-first doctrine;
- V1 beachhead;
- functional/non-functional product specification;
- UX/UI system;
- Capture Quality Gate requirement;
- Contextual Quick Replies requirement;
- system architecture;
- data model;
- AI/provenance/confidence design;
- integration strategy;
- privacy/security/compliance baseline;
- business/pricing/GTM hypotheses;
- engineering/resource plan;
- QA/release strategy;
- operations/support;
- risk register;
- gap/red-team review;
- Atlas-compatible status/history.

Gate:
- documentation is internally coherent;
- Owner can read the repository and understand what Cuevaro is, why it exists, what V1 does, and how development should begin.

## Phase 1 - Engineering Foundation
**Status: In progress — local foundation implemented; managed-service, staging and real-device gates open**

Goal: establish the secure mobile-first skeleton.

Current 2026-10-08 queue: exact-head CI/review and enforced dependency gate; Android native preparation followed by compatible JDK/SDK/device acceptance; separate macOS/Xcode/iOS hardware acceptance; approved Supabase Free/Singapore project management access (verified October8), parent-applied atomic baseline20261008022037 and passed managed SQL-role verification; real Auth/Storage/expiry/restore API acceptance remains open; mobile-accessible private API/worker hosting. Safe regression work continues when evidence warrants it. Keyboard focus/error fixes and required semantic benchmark execution are locally verified; current suite97 tests/21 files and prior exact-head CI15 browser journeys. Process-only managed composition and local fixture tooling are ready; actual Auth/Storage API, managed transaction/job wiring and private hosting remain open. See [runtime handoff](docs/MANAGED_RUNTIME_HANDOFF.md). These contributions do not close Phase 1. See [current status](CURRENT_STATUS.md) and [native validation](docs/NATIVE_VALIDATION.md).

Scope:
- monorepo and CI;
- environment/secrets discipline;
- mobile app shell;
- authentication;
- household-ready authorization model;
- PostgreSQL migrations;
- private evidence storage;
- local encrypted/secure app storage;
- basic API + worker;
- observability baseline;
- test fixture policy;
- staging environment.

Not yet:
- broad AI features;
- household sharing UI;
- multiple life-admin categories.

Gate:
- signed-in user can create a private account;
- storage/data isolation tests pass;
- mobile app runs on real Android/iOS hardware;
- CI blocks obvious regressions/secrets.

## Phase 2 - Capture and Quality Gate
**Status: Planned**

Local contribution, 2026-10-05: original preservation, camera/library/PDF import seams, retry/deduplication and conservative three-state preflight are implemented/tested in the development slice. Geometry/occlusion detection and representative camera calibration remain open. This does not close Phase 1 or this phase's gate.

2026-10-06: provisional shared document-region checks now identify visible cut-off, skew, perspective, obstruction and interior washout in synthetic pixels. Pixel-only completeness remains uncertain, including camouflaged edge covers, and requires conscious continuation. Representative camera calibration remains open; no phase gate is closed.

Independent contribution, 2026-10-06: local embedded-text PDF import supports up to ten pages in a bounded child process, conservative review/page provenance and original retrieval. Unsupported/password/corrupt/no-text inputs retain originals and show manual alternatives. Scanned-PDF OCR and native PDF viewing remain implementation gaps. PDF text is not verified visible content; explicit warning/continuation is required. Phase 1 remains incomplete.

Multi-page photo contribution, 2026-10-06: ordered append/replace preserves separate originals and earlier replacements, requires per-page quality review and seals bundle identity before uploading. Up to ten photos/20 MB total share one receipt lifecycle with actual per-page OCR/provenance and Unknown on conflicting evidence. Atomic failure, lost acknowledgement/restart, original reimport and between-page revocation are covered locally. Native camera/storage and representative capture gates remain open.

Quality-to-extraction evaluation, 2026-10-06: eleven generated cases now report real OCR after quality gating, including blocked cases, per-field mismatches/Unknowns and local latency. Glare still produced a wrong low-confidence merchant. This is a reproducible synthetic regression corpus, not representative calibration or acceptance thresholds.

Goal: make capture faster and safer than manual entry.

Scope:
- camera flow;
- photo/library import;
- PDF import;
- multi-page capture;
- offline/poor-network local queue;
- upload state/recovery;
- duplicate hash baseline;
- Capture Quality Gate: blur, glare, lighting, cut-off, occlusion, perspective, low resolution, likely multiple documents;
- Good / Questionable / Bad UX;
- Retake / Use Anyway / Choose Another Photo;
- benchmark for quality-gate false accept/reject.

Gate:
- a user cannot silently lose the only copy of a capture during ordinary failures;
- bad images are caught at useful accuracy without excessive false rejection;
- common capture path is comfortable one-handed on supported phones.

## Phase 3 - Intelligent Purchase Lifecycle
**Status: Planned**

Local contribution, 2026-10-05: bundled local OCR over synthetic labeled receipts, provenance/confidence review, contextual replies and explicit supported dates/Unknown are implemented in sequence. Broad receipt/provider extraction, multi-item and policy research remain open; phase gate is not met.

Independent contribution, 2026-10-06: explicit Seller/Sold by/Product/Amount due labels, peso-symbol currency and unambiguous named/year-first/numeric dates are supported with raw excerpts and conservative conflicts. Two additional synthetic layouts passed actual Tesseract checks. Unlabeled merchant inference, ambiguous numeric dates, multi-item review and representative calibration remain open; no phase gate is closed.

Multi-item contribution, 2026-10-06: repeated explicit Item/Product labels become distinct low-confidence candidates with per-page evidence. Every candidate requires track/skip review; corrected names retain original provenance. One receipt/lifecycle links multiple item assertions. Duplicate names are surfaced rather than automatically merged, and per-item coverage/quantities/prices remain unsupported. Local tests and narrow-mobile visual inspection cover this limited labeled flow, not representative multi-item extraction acceptance. Correction/rescheduling history remains next.

Goal: turn evidence into a trustworthy useful record.

Scope:
- classify purchase/receipt/evidence;
- extract merchant/date/amount/product candidates;
- product/item entity;
- model/serial evidence;
- per-field provenance and confidence;
- confirmation sheet;
- Contextual Quick Replies;
- user corrections and audit history;
- return/warranty lifecycle candidates;
- authoritative policy/source lookup for supported cases;
- deterministic date computation;
- explicit Unknown state.

Gate:
- clean supported receipts reach review-ready state with low correction burden;
- high-consequence fields never silently become truth from low-confidence AI;
- source/evidence is visible for consequential dates.

## Phase 4 - Watch, Remind, Act
**Status: Planned**

Local contribution, 2026-10-05: deterministic in-app cue dates, persistence, versioned snooze/dismiss/stop and saved-record retrieval are developed. Production scheduler/push delivery, action packs and related phase acceptance remain open. No post-V1 module was started.

Goal: fulfill the product promise after capture.

Scope:
- lifecycle/consequence engine;
- durable cue scheduler;
- push notifications;
- in-app attention;
- snooze/complete/dismiss;
- timeline;
- search;
- action cards;
- return/warranty action pack;
- evidence bundle;
- draft message/checklist;
- deep links.

Gate:
- cues survive worker/server/device restarts;
- duplicate reminder behavior within release threshold;
- source changes safely reschedule dependent cues;
- completed lifecycle stops nagging.

## Phase 5 — Trust, Desktop Companion, and Household Readiness
**Status: Planned**

Goal: make Cuevaro commercially trustworthy and usable across devices.

Scope:
- desktop/web companion;
- export;
- deletion;
- backup/restore drills;
- session/device management;
- biometric local unlock;
- notification privacy;
- accessibility;
- household owner/member model;
- invite/revoke if Family is in V1;
- billing infrastructure;
- support tooling with least privilege.

Gate:
- ordinary personal use still needs no desktop;
- cross-device data is consistent;
- export/delete/security/accessibility gates pass.

## Phase 6 — Closed Alpha
**Status: Planned**

Goal: test with real behavior before public marketing.

Participants:
- small owner-controlled group;
- mix of Android/iPhone devices and receipt types;
- no expectation that every retailer/policy is supported.

Validate:
- time to first value;
- capture retake behavior;
- extraction corrections;
- false-confidence incidents;
- cue usefulness;
- trust/privacy comprehension;
- support burden;
- AI/infrastructure unit cost;
- willingness to keep using Cuevaro.

Gate:
- no unresolved systemic trust/reliability flaw;
- V1 scope can be reduced based on evidence.

## Phase 7 — Commercial Beta / V1
**Status: Planned**

Goal: sell a focused, trustworthy product.

V1 product promise:
**Photograph or import a purchase record; Cuevaro organizes the evidence, tracks supported return/warranty consequences, and brings back the next useful action.**

Launch requirements:
- iOS + Android primary experience;
- desktop/web companion at the level justified by beta;
- commercial billing;
- privacy/terms/support;
- production monitoring/backups;
- defined supported markets;
- formal brand/trademark review;
- app-store compliance;
- documented known limits.

## Phase 8 — Home Lifecycle Expansion
**Status: Planned post-V1**

Candidate scope:
- service/repair records;
- maintenance plans;
- manuals;
- parts/filter history;
- product recall monitoring;
- home inventory/insurance evidence.

Only start after purchase lifecycle retention is validated.

## Phase 9 — Vehicle and Document Lifecycles
**Status: Planned post-V1**

Candidate scope:
- registration;
- insurance;
- inspections;
- service;
- licences/passports/IDs;
- renewals/expiry evidence.

Higher-sensitivity document support requires a fresh privacy/threat review.

## Phase 10 — Family and School Admin
**Status: Planned post-V1**

Candidate scope:
- household members;
- school notices/forms;
- extracted dates/actions;
- shared cues;
- family evidence.

Avoid turning Cuevaro into family chat or a generic calendar.

## Phase 11 — Cuevaro Business
**Status: Planned post-V1**

Candidate scope:
- employee certifications;
- licences/permits;
- vendor renewal/cancellation windows;
- equipment records;
- team roles/audit;
- higher assurance/reporting.

Business requirements and pricing are separate from the consumer plan.

## Explicit sequencing rules

- No generic AI assistant before the lifecycle product works.
- No full accounting, CRM, budgeting, project management, or marketplace scope.
- No autonomous external cancellation/claim submission without separate safety/integration design.
- No expansion module may compromise V1 capture speed or trust.

2026-10-06 independent correction contribution: immutable field/item history, durable replay, offline correction queue and atomic cue replacement are locally implemented. Stop/dismiss/snooze survive Unknown roundtrips. This does not close Phase 1 or advance subsequent release gates; managed/native acceptance remains open.

Private single-record developer export and disposable PGlite dump/load recovery now contribute local evidence without closing Phase 1. Native export UX, managed backup/restore and household-wide export remain open.

2026-10-06: on-device single-record archive UX and broader generated OCR evaluation are locally verified independent contributions. Native file-provider/SQLCipher/hardware, managed service integration, representative calibration and durable push remain separate gates; no later phase is closed.


## Managed application wiring checkpoint - 2026-10-08

Existing capture/review/correction/Stop/retrieval commands now share a bounded PostgreSQL transaction interface and genuine Supabase SDK adapters. Original uploads are immutable, download/hash-checked before acknowledgement and use stable identifiers across rollback/lost acknowledgements. Worker publication revalidates actual Auth identity, household membership, the complete ordered page manifest and its unexpired claim after OCR. Unknown quality and missing/corrupt pages fail closed. This is local integration evidence with injected synthetic HTTP transport and real local OCR, not live managed API acceptance.

The separate forward migration `20261008030442_managed_review_drafts.sql` adds a household-bound private review table with RLS and no client grants. It is **unapplied**; parent remains sole managed-write coordinator. Original reviewed baseline/history mapping is unchanged. Explicit managed API/worker entry points are loopback-only, process-configured, synthetic-mutation-only and refuse a missing schema prerequisite. They were not started against the managed project. Owner-operated masked launcher modes are prepared; configuration never makes health an acceptance claim.

Local verification: **114 tests passed, one real PostgreSQL17 CI-only test explicitly skipped**, strict typecheck/source scan/formatting passed. Disposable PostgreSQL17 CI now exercises checked-out node-pg connections, rollback, SKIP LOCKED, concurrent claim ownership and retained Stop/correction history; its result requires exact-head CI. Independent review repaired post-OCR Auth revocation and partial-page omission, with negative regressions. Five synthetic Auth identities are Owner-approved; their passwords must be entered/submitted by Owner. The official Users form defaults Auto confirm on, which remains outside the instruction forbidding verification bypass; no accounts, passwords or project Auth settings were changed here.

Actual Auth login, Storage upload/readback/expiry, native mobile private connectivity, managed restore, hosting/durable notifications and dependency release gates remain open. Automatic approval review rejected live API/worker startup before credential handoff; no startup occurred. No phase, release, merge or deployment is claimed.


## Current managed review-table application - 2026-10-08

Parent sole executor applied the separate reviewed table migration **once** as managed version **20261008035615**, name `cuevaro_managed_review_drafts`, from source checkpoint `47785e1f20bfe3b9c97b1ef322736e68212ece3d`. Source file `20261008030442_managed_review_drafts.sql` maps to that managed version; never reapply it or the preceding baseline20261008022037. Reviewed body SHA256380c244a80f4650556d1bd8532da702ad67acbdd52dd7888322a4479c14c584f and source SHA2563a8438f4406780f4ad5baec922bb28fa1ff6c6af9125550bad30a0aca65e34d5 match canonical Git blobs. Earlier dated "unapplied" statements and the immutable pre-application manifest are historical checkpoints superseded by this receipt.

Parent catalog verified private.review_drafts ownershippostgres, enabledRLS, zero client policies, postgres-onlyACL includingPG17MAINTAIN, capture primary key, composite capture/household FK, all3 NOT NULL columns and JSON-object constraint. The supplied rollback-only SQL passed once: valid roundtrip plus duplicate/missing/cross-household/null/JSON refusals, all8 client privilege checks and actual anon/authenticated SELECT/INSERT/UPDATE/DELETE/TRUNCATE denial. Its exact reproducible artifact [cuevaro-managed-review-drafts-role-checks.sql](supabase/tests/cuevaro-managed-review-drafts-role-checks.sql) hashes595e9e7ccec61352f598a9310f9408fdac53580d01de227f5cf5d95a7f0d3d26 (UTF-8/LF, no terminal newline). Desktop recorded it without executing managed SQL. Final application/Auth/Storage fixture counts were zero at parent observation; this is not a claim about later Owner account creation.

See [structured parent receipt](docs/managed-review-drafts-evidence-2026-10-08.json). Advisors remain: one securityWARN for intentional authenticated SECURITYDEFINERcreate_household; two securityINFO no-policy tables (private replay/review, intentional client denial);16 unindexed-FKINFO, including the new composite FK, and4 unused-indexINFO. No extra grants/policies/indexes or Auth/Storage operations were introduced. This is managed SQL validation, distinct from implementation checkpoint47785e1 CI37724511877, which passed115 tests (including disposable realPG17),15 browser journeys and exports; its dependency gate failed.

Owner approved email auto-confirm for **exactly five synthetic accounts only**, without email delivery or project-wide Auth changes. Owner performs password entry/submission; account handoff remains pending. No desktop account operation or live API/worker startup occurred. Actual Auth/StorageAPI/expiry/restore/native/hosting gates and Phase1 remain open.
