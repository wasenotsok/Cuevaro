# Cuevaro Current Status

Status date: 2026-10-06
Project registry status: active  
Implementation state: **Phase 1 in progress; synthetic local receipt-to-lifecycle development slice verified**

Current objective:
Complete the engineering foundation and the mobile-first receipt-to-lifecycle slice under the Owner's continuous development authority. The existing roadmap gates remain binding; no phase is being closed from browser or bundle evidence alone.

## Implementation checkpoint — 2026-10-05

Base: `main` at `33b2b6864817720ce7f720d4f2057bc28ce2f74a`. Development branch: `feat/mobile-foundation`. Firstborn and Atlas working files were not modified.

Implemented locally:
- Expo/React Native/TypeScript mobile shell, camera/library/PDF preservation paths, local state/recovery, accessible controls, dark/light palette;
- SQLCipher-only native store with Keychain/Keystore key storage and fail-closed Expo Go refusal; browser preview uses a separate synthetic IndexedDB cache;
- PostgreSQL household/RLS migration, private storage migration, guarded managed-auth/storage adapter seams;
- loopback-only synthetic development API, durable embedded PostgreSQL jobs, immutable original bytes, content hashes and duplicate/idempotency checks;
- genuine bundled local Tesseract OCR over generated receipt images, bounded text extraction, confidence/provenance, explicit consequential-fact review and contextual replies;
- linked purchase/item/evidence/fact rows, explicit supported return/warranty dates or Unknown, deterministic in-app cues, versioned snooze/dismiss/stop controls, metadata search and original retrieval;
- strict typechecking, automated unit/integration tests, mobile viewport browser tests, native/web bundle export and CI quality/dependency gates.

Verified evidence is described in [docs/VALIDATION.md](docs/VALIDATION.md). This is a development slice, **not a finished native mobile vertical slice, production backend, calibrated AI system, or release**. The browser OCR API runs on the development computer; native automatic cloud extraction is not connected. Ordinary production mobile use must not depend on that computer.

[Draft PR #1](https://github.com/wasenotsok/Cuevaro/pull/1) is published. [Linux CI](https://github.com/wasenotsok/Cuevaro/actions/runs/37331727837) passed all implementation verification steps at `b475c5fcaf9ec3268c85aded3726b9f385f67607`; the dependency gate failed with the documented 28 high findings. No merge or deployment occurred.

Final pre-review head `5c0d52f84ff235e7e0da90f10e762199935cac49` separately completed [PR CI 37332080788](https://github.com/wasenotsok/Cuevaro/actions/runs/37332080788): verification passed; dependency gate failed. [Independent review](docs/INDEPENDENT_REVIEW.md) then found and verified repairs for reminder recovery, final worker retry, native temporary-file ownership/cleanup and observation reason preservation. These later fixes require their own checks and do not inherit historical CI. A concrete [private managed-service proposal](docs/PRIVATE_DEVELOPMENT_PLAN.md) is prepared; nothing was activated.

## Next safe work and external gates

2026-10-06 local checkpoint: shared bounded document-region preflight adds visible cut-off, skew, perspective, large obstruction and interior washout advice. Independent review reproduced background-colored edge covers; all pixel-only captures therefore retain unverified completeness and require conscious continuation before OCR. No arbitrary aspect-ratio rule can prove a complete receipt. Native source pixel budgets and bounded preview dimensions were tightened. Supabase provider/region approval is recorded below; managed access remains pending.

Provider-default permission hardening: a disposable PostgreSQL fixture reproduced authenticated `TRUNCATE` under broad default grants despite RLS. Forward migration `202610060003_client_privileges.sql` removes all client table privileges except authenticated SELECT on the thirteen application tables, and removes anonymous function grants explicitly. The regression verifies denied mutation/TRUNCATE/escalation privileges, retained household RPC/tenant reads and anonymous denial. No live provider migration has been applied.

Exact capture-quality head `46b4661a58141ce45cfaf02c9a1cf252d4803a4c` completed [PR CI 37445474421](https://github.com/wasenotsok/Cuevaro/actions/runs/37445474421): verification passed; dependency gate failed. Later permission changes require their own exact-head CI and do not inherit that result.

Permission head `c7ac63a89b078319316ae20013ab02101d954590` separately passed all implementation checks in [PR CI 37445858804](https://github.com/wasenotsok/Cuevaro/actions/runs/37445858804); dependency gate failed. Independent work continued with bounded local embedded-text PDF import: up to ten pages, explicit pre-processing review, page provenance, supported lifecycle dates/Unknown and exact original download after reload. Password/corruption/page/text limits and no-text documents retain originals and terminate deterministic jobs. PDF rendering, scanned-PDF OCR and native original viewing remain incomplete. Embedded text can be hidden/differ from visible content; the warning is visible before continuation. Conflicting labels within/across pages remain Unknown. This does not close Phase 1 or make the browser harness ordinary native mobile operation.

Further independent V1 work remains authorized: broader synthetic receipt-layout evaluation, multi-item review, correction/rescheduling history and remaining accessibility/export development. These are implementation gaps, not Owner approval blockers; service/hardware gates do not stop them.

Multi-page photo assembly now preserves ordered separate originals, retained replacements and per-page quality/provenance under one receipt. Bad pages cannot bypass retake, and conflicting fields remain Unknown. Assembly is sealed before an upload attempt; retries reuse the same identity after a lost acknowledgement. Local atomic-attachment failure leaves saved originals recoverable. Independent review found and repaired original reimport deduplication, between-page revocation and attaching already-uploading pages. Actual two-page Tesseract processing and mobile recovery are locally verified; native hardware and managed migration remain unverified. See [validation](docs/VALIDATION.md) for the exact checkpoint evidence.

Multi-page head `52b04df3b252a9159734bfb09e72de2b8a1d18e5` separately passed all implementation verification in [PR CI 37453551626](https://github.com/wasenotsok/Cuevaro/actions/runs/37453551626); the dependency gate failed. Synthetic quality-to-extraction benchmark and legacy migration verification are the next independent safe contributions, not phase closure.

Those contributions now pass locally: 66 tests/twelve files, typechecking, formatting and source scan. The eleven-case synthetic quality-to-extraction evaluation exposes skipped cases, wrong candidates and Unknowns; glare still yielded one wrong low-confidence merchant, so this is regression evidence rather than calibrated accuracy. The reconstructed legacy migration preserves original bytes/hash/ID and tenant isolation. Independent review found no actionable defect; live managed upgrade remains unverified. Next safe V1 work is multi-item review and correction/rescheduling history; no ordinary development approval is required.

Multi-item checkpoint: explicit labeled item candidates now require individual track/skip decisions and preserve corrected names alongside original excerpts/evidence/page IDs. One receipt still creates one receipt-level lifecycle; item-specific warranty coverage, quantities and prices are not inferred. Actual OCR/PDF/page candidates, item assertions/search, lost-confirmation-response and reload are covered. Local evidence: 69 unit/integration tests, twelve browser journeys, typechecking/source scan/formatting and all platform exports. A 320px dark review screenshot was inspected. Independent review identified cross-purchase history links within a household; migration 005 now enforces purchase/item/field scope and one successor, with rejection regressions. Correction/rescheduling work follows; no roadmap gate is closed.

PDF head `49a61e07d7822f97359735ae77a4aa674aeef3ce` separately completed [PR CI 37449088755](https://github.com/wasenotsok/Cuevaro/actions/runs/37449088755): implementation verification passed; dependency gate failed. The next independent contribution supports explicit alternate receipt labels, peso-symbol currency and unambiguous named/year-first/numeric calendar dates. Ambiguous numeric dates, malformed grouping, unlabeled merchants, policy durations and conflicting evidence remain Unknown. Two actual OCR layout fixtures are verified; this is limited labeled parsing, not broad merchant coverage or multi-item extraction.

1. Review the draft development PR and its exact CI results; resolve available dependency fixes without weakening the gate.
2. Supabase Free in Singapore is Owner-approved for synthetic private development. Secure project access, project reference and explicitly approved developer identities are pending; no provider account, credential, paid service or staging deployment was created. The private Node API/worker hosting path remains unresolved.
3. Produce and test native development binaries on actual Android/iOS devices; validate SQLCipher, camera quality, offline recovery, screen readers and text scaling. JavaScript/Hermes bundle export does not prove these.
4. Calibrate quality/extraction against a legally usable representative benchmark. Provisional light-paper geometry, obstruction and washout checks are being verified locally; representative camera calibration, unlabeled merchant layouts, multi-item receipts, PDF OCR, share-sheet/barcode, and broad provider extraction remain incomplete.
5. Complete durable production notification delivery and real storage/auth/deletion/restore tests before later phase gates can close.

Current dependency release gate is blocked by unpatched upstream `braces` and `node-forge` advisories. No waiver or public deployment is authorized by this checkpoint.

Mitigation implemented: separate API dependency surface audits clean; all development servers default to localhost; no evidence is consumed as a glob, certificate or instruction. [Exact dependency paths, reachability limits and alternatives](docs/DEPENDENCY_RISK.md) are documented. The complete mobile toolchain gate remains active.

## What Cuevaro is

Cuevaro is a mobile-first life-admin product that turns real-world evidence into organized, evidence-backed lifecycles.

Core loop:

**Capture → Understand → Link → Watch → Remind → Act → Verify**

Initial commercial beachhead:
- purchases;
- receipts;
- return windows;
- warranties;
- product/model/serial evidence;
- later service/maintenance history.

## Owner-confirmed product decisions

- Product working name: **Cuevaro**.
- Commercial intent: aspiring commercial product; design and function must be sellable, simple, and convenient.
- Primary platform: **mobile first**.
- Desktop/web: companion experience; ordinary personal use must not require desktop.
- Camera/document capture must include a **Capture Quality Gate** that identifies unusable/uncertain photos and asks for retake or offers Use Anyway where appropriate.
- Assistant questions with predictable answers must use **Contextual Quick Replies** rather than force needless typing.
- Consequential actions use consequence-specific labels, not vague yes/no confirmation.

## Documentation published

Canonical source set:
- README.md
- 00_DOCUMENT_MAP.md
- PROJECT_BRIEF.md
- PRODUCT_VISION.md
- PRODUCT_SPEC.md
- UX_UI_SYSTEM.md
- SYSTEM_ARCHITECTURE.md
- DATA_MODEL.md
- AI_INTELLIGENCE.md
- INTEGRATIONS.md
- SECURITY_PRIVACY_COMPLIANCE.md
- COMPETITIVE_STUDY.md
- BUSINESS_AND_GTM.md
- ENGINEERING_AND_RESOURCES.md
- QUALITY_AND_VALIDATION.md
- OPERATIONS_AND_SUPPORT.md
- RISK_REGISTER.md
- ROADMAP.md
- CURRENT_STATUS.md
- DECISIONS.md
- REVIEW_AND_GAP_AUDIT.md
- SOURCES.md
- HISTORY.json

## What is NOT done

Working synthetic local software now exists. No claim should be made that Cuevaro is production-ready or that any roadmap release gate is complete.

Still incomplete or unverified:
- signed native mobile builds and real-device acceptance;
- production web companion and managed backend/authentication;
- managed storage isolation, signed URL expiry and real cloud backup;
- production AI/provider configuration and representative extraction benchmark;
- calibrated complete Capture Quality Gate;
- production push notifications;
- billing;
- production infrastructure;
- app-store accounts/configuration;
- user testing;
- benchmark datasets;
- formal legal/trademark clearance.

## Next development step

**Phase 1 - Engineering Foundation (in progress; gate open)**

The local foundation now establishes these components; managed and hardware verification remain open:
1. repository code/monorepo structure;
2. mobile app shell;
3. authentication and household-ready authorization;
4. database/storage migrations;
5. secure capture preservation;
6. API/worker foundation;
7. CI/test/observability baseline.

Do not begin by building every future Life Admin category.

## Known open decisions before/within Phase 1

- final backend framework within the recommended TypeScript/managed-Postgres direction;
- exact cloud provider/region;
- initial launch geography beyond the Philippines validation context;
- formal Cuevaro trademark clearance;
- final pricing after unit-cost/willingness-to-pay evidence;
- final benchmark thresholds;
- whether Family sharing is public V1 or immediate post-V1.

These are explicit open decisions, not missing documentation.

## Correction and rescheduling checkpoint - 2026-10-06

Confirmed fields and tracked names now support explicit corrections with immutable original observations, linked earlier/current assertions and visible history. Date corrections atomically replace supported lifecycle/cues; Unknown cancels unsupported scheduled cues. Prior Stop, dismissal and snooze intent survives corrections and Unknown roundtrips. A durable mutation receipt binds command UUID, payload digest and resulting version; retries after restart/lost acknowledgement do not duplicate history. Viewer, revoked, foreign-item/household, stale-version and conflicting-replay requests are refused.

Mobile correction commands are saved before upload. Offline/lost-response edits show a queued draft while displaying last confirmed facts, support replay after restart and require a successful fresh read to discard the queue. Mutation responses and record reads use transactional snapshots. Synthetic PostgreSQL integration and mobile browser evidence remain development-only; migration 006 has not been applied to Supabase. Phase 1 remains open.

Correction checkpoint verification: 73 unit/integration tests across fourteen files, all thirteen browser journeys, strict typechecking, formatting, source scan and Android/iOS/web exports passed. The mobile history screenshot was visually inspected for readable earlier/current facts and retained original sources. Test receipts are isolated to prevent shared-record contamination; no native-device claim.
