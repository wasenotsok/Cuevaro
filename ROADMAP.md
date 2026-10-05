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

## Phase 1 — Engineering Foundation
**Status: Planned**

Goal: establish the secure mobile-first skeleton.

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

## Phase 2 — Capture and Quality Gate
**Status: Planned**

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

## Phase 3 — Intelligent Purchase Lifecycle
**Status: Planned**

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

## Phase 4 — Watch, Remind, Act
**Status: Planned**

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
