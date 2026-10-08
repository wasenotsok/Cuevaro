# Cuevaro — Risk Register

Status: initial commercial risk register  
Scoring: Probability (P) and Impact (I): Low / Medium / High

| ID | Risk | P | I | Mitigation / design response |
|---|---|---|---|---|
| R-01 | Wrong return/warranty/expiry date causes user loss | M | H | provenance, jurisdiction-aware sources, deterministic calculation, strict confidence gate, unknown state |
| R-02 | Data breach exposes receipts/documents/identity information | M | H | least privilege, RLS/authz tests, private storage, encryption, minimal logs, security review |
| R-03 | Users distrust uploading sensitive documents | H | H | start with purchases, clear privacy UX, minimize data, on-device checks, export/delete, transparent subprocessors |
| R-04 | Product becomes another manual database | M | H | camera/share-first, extraction, linking, minimal confirmation, measure typing/taps |
| R-05 | Reminder delivery fails | M | H | durable server-side scheduler, retries, in-app canonical state, monitoring, idempotency |
| R-06 | Notification fatigue causes churn | M | H | attention budget, bundling, quiet hours, lifecycle closure, useful-action rule |
| R-07 | AI costs exceed subscription economics | M | H | quality gate before AI, caching, provider abstraction, usage tiers, unit-cost telemetry |
| R-08 | AI silently overwrites confirmed truth | L | H | immutable provenance, user confirmation, audit history, no silent replacement |
| R-09 | Competitors replicate visible features | H | M | focus on lifecycle graph, accumulated evidence, trust, action workflow, UX execution |
| R-10 | Existing broad competitors already satisfy users | H | H | narrow beachhead, faster capture, stronger provenance, action assistance, validate willingness to switch |
| R-11 | Scope expands into generic life assistant/CRM/accounting | H | H | explicit product boundary and roadmap gates |
| R-12 | Retailer/manufacturer policies change | H | H | source freshness, checked-at date, policy versioning, invalidate/review affected rules |
| R-13 | International rules/locales cause incorrect assumptions | H | H | jurisdiction field, local sources, no U.S.-default logic, staged market expansion |
| R-14 | App-store subscription/policy changes | M | M | managed billing abstraction, policy monitoring, web fallback where allowed |
| R-15 | Brand Cuevaro has later trademark conflict | M | H | formal IPOPHL/USPTO/WIPO clearance before material launch spend |
| R-16 | Low retention because useful events are infrequent | M | H | measure lifecycle outcomes not DAU; expand adjacent high-value lifecycles only after core trust |
| R-17 | Users lose evidence during failed upload/offline | M | H | local durable capture queue until server acknowledgment |
| R-18 | Duplicate captures create clutter/wrong reminders | M | M | hashes, entity resolution, reversible merges, dedupe review |
| R-19 | Quick-reply button triggers unintended consequential action | L | H | consequence-specific labels, explicit confirmation for destructive/sensitive actions |
| R-20 | Capture-quality gate annoys users by rejecting usable images | M | M | three-state good/questionable/bad, benchmark false rejection, Use anyway on questionable |
| R-21 | Family sharing exposes private records to wrong member | M | H | household roles, explicit sharing, audit, revoke, sensitive-item rules |
| R-22 | Account takeover exposes vault | M | H | secure auth, MFA/passkeys roadmap, device/session management, biometrics locally |
| R-23 | Third-party vendor lock-in | M | M | provider interfaces, standard Postgres/data export, no vendor objects in domain |
| R-24 | Support staff over-access sensitive content | L | H | restricted support tooling, audit, least privilege, content access only when needed |
| R-25 | Deletion promises do not match backups/providers | M | H | documented retention, subprocessor contracts, deletion tests |
| R-26 | Policy/web lookup content injects malicious model instructions | M | H | treat external content as untrusted data, schema extraction, prompt-injection tests |
| R-27 | User treats Cuevaro as legal/insurance authority | M | H | wording, source display, disclaimers, never adjudicate eligibility |
| R-28 | Overengineering delays validation | H | M | managed services, monolith+worker, phase gates, no premature microservices |
| R-29 | No real iOS/Android device testing | M | H | physical device matrix before beta |
| R-30 | Public repo accidentally receives secrets/private data | M | H | secret scanning, .gitignore, fixture policy, CI checks |
| R-31 | Synthetic developer slice mistaken for complete native product | M | H | visible development mode, no cloud/push claims, native hardware and managed-service gates stay open |
| R-32 | Global image heuristics miss local glare, cut-off, skew or occlusion | H | H | missing verified geometry yields Questionable; mandatory override and fact review; calibrated camera benchmark/detectors still required |
| R-33 | Unpatched upstream tooling advisories propagate into release | M | H | separate failing CI dependency gate; synthetic loopback-only scope; no release waiver; track upstream fixes |

## Top launch risks

2026-10-06 synthetic evidence for R-01/R-17/R-18/R-32: ordered multi-page originals, atomic assembly failure and lost-acknowledgement restart are now covered, with independent deduplication/revocation/rebinding fixes. Generated glare still produced a wrong low-confidence merchant; review and Unknown remain necessary. This reduces specific development gaps without closing camera calibration, native storage, managed upgrade or release risks. See docs/VALIDATION.md and docs/INDEPENDENT_REVIEW.md.

The five risks that should dominate early product decisions:

1. **Trust/privacy** — users will not give Cuevaro meaningful evidence if the product feels unsafe.
2. **False confidence** — one confidently wrong deadline can destroy trust.
3. **Manual burden** — if the user has to maintain another database, Cuevaro loses its reason to exist.
4. **Reminder reliability** — lifecycle intelligence is worthless if the future cue does not arrive.
5. **Differentiation** — storing receipts/warranties/reminders is already commoditized.

## Risk review cadence

- review at each roadmap phase gate;
- add risks from beta/support data;
- close only with evidence, not optimism;
- any new feature touching identity, payments, sharing, or automated external action requires threat/risk review.

## Explicit product boundary used as risk control

Cuevaro V1 is not:
- accounting software;
- a bank/financial aggregation product;
- a generic calendar/to-do app;
- a CRM;
- a general autonomous agent;
- legal advice;
- an insurer/warranty adjudicator;
- a marketplace;
- a password manager;
- a complete document management suite.

Keeping this boundary protects time, security, and comprehension.

## Synthetic extraction review checkpoint - 2026-10-06

False-confidence risk remains active. Camouflaged receipt covers cannot establish complete evidence from pixels; embedded PDF text may be hidden/differ from visible pages; valid monetary lines may coexist with malformed/conflicting labeled evidence. Implemented controls: unresolved completeness/explicit continuation, visible PDF warning and low-confidence review, Unknown on competing monetary/date evidence with provenance retained. Synthetic regressions and independent review are in docs/VALIDATION.md and docs/INDEPENDENT_REVIEW.md. None establishes representative calibration or closes the risk. Native viewing/rendering, adversarial PDF corpus, managed isolation and production delivery remain unverified.

Device export risk checkpoint (2026-10-06): plaintext ZIP copies outside Cuevaro cannot be recalled. Explicit destination warning and scoped temporary-file cleanup/restart visibility are implemented. OS delivery is not inferred from chooser closure; actual file-provider/device lifecycle remains unverified. Generated OCR v2 still exposes glare merchant error and cannot establish representative accuracy.

2026-10-07 native evidence clarification: Android generated prebuild succeeds with SQLCipher/Hermes configuration, but installed Java 8 fails official Gradle TLS trust and Android SDK/device is absent. Do not bypass trust validation or equate generated configuration/bundles with compiled/runtime security. iOS requires separate macOS/Xcode/device validation. Keyboard focus/error regressions are repaired in browser; OS accessibility/native theme remains open. See docs/NATIVE_VALIDATION.md.

2026-10-08 storage review: generic SELECT could authorize direct client signing with arbitrary positive lifetime. Reviewed forward policy permits authenticated raw downloads only, preserving bounded server signing with fresh authorization and metadata identity checks. Already-issued URLs remain bearer access until expiry; revocation cannot recall downloaded originals. Real API denial/expiration remains unverified until approved identities and synthetic StorageAPI fixtures exist. SQL-role fixtures must not be labeled Auth/upload/backup acceptance.
