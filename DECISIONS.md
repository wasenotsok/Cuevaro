# Cuevaro Decisions

This log distinguishes **Owner decisions** from **recommended baselines**. Recommendations may change when implementation evidence appears.

## D-001 — Working product name: Cuevaro
**Status:** Owner accepted  
**Date:** 2026-10-05

Cuevaro is the working commercial brand for the Life Admin concept.

Formal trademark clearance is still required before material launch spend.

## D-002 — Commercial product standard
**Status:** Owner accepted  
**Date:** 2026-10-05

Cuevaro is designed as an aspiring commercial product. Function, UX, reliability, trust, branding, and simplicity must be acceptable to paying customers, not merely sufficient for a personal prototype.

## D-003 — Mobile-first, desktop companion
**Status:** Owner accepted  
**Date:** 2026-10-05

Mobile is the primary product surface. Desktop/web is a companion.

Ordinary personal use must not require desktop.

Reason: capture, reminders, retrieval, and action occur mainly around the user's phone and physical world.

## D-004 — Capture Quality Gate
**Status:** Owner accepted  
**Date:** 2026-10-05

Camera/image capture must detect materially poor input such as blur, glare, bad lighting, cut-off content, occlusion, severe angle, low effective resolution, and similar readability problems.

Behavior:
- Good → continue.
- Questionable → explain issue, offer Use Anyway / Retake.
- Bad → request Retake / Choose Another Photo.

Cuevaro must not quietly turn unreadable evidence into confident structured facts.

## D-005 — Contextual Quick Replies
**Status:** Owner accepted  
**Date:** 2026-10-05

When likely answers are predictable, Cuevaro should show tappable response/action buttons.

Use context-specific consequence labels for meaningful actions, especially destructive/sensitive actions.

Reason: reduce typing, ambiguity, and mobile friction.

## D-006 — V1 beachhead: purchase lifecycle
**Status:** Product baseline  
**Date:** 2026-10-05

Start with receipt/purchase → product → return/warranty → cue/action.

Reason:
- easy demo;
- clear monetary value;
- lower trust barrier than identity/medical documents;
- fits camera-first mobile use;
- creates reusable evidence/entity/lifecycle architecture.

Expansion categories remain later scope.

## D-007 — Product engine
**Status:** Product baseline  
**Date:** 2026-10-05

Canonical loop:

**Capture → Understand → Link → Watch → Remind → Act → Verify**

Cuevaro is not defined as a file vault or reminder app.

## D-008 — Evidence/provenance over confident guessing
**Status:** Product baseline  
**Date:** 2026-10-05

Consequential facts must preserve evidence, source, confidence, and correction history.

**Unknown** is a valid successful state.

For policies/deadlines, authoritative sources and jurisdiction matter.

## D-009 — Deterministic consequence engine
**Status:** Architecture baseline  
**Date:** 2026-10-05

AI may extract/propose facts and rules. Once confirmed, date arithmetic and cue scheduling should be deterministic where possible.

Do not repeatedly ask an LLM what a stored deadline means.

## D-010 — Human authority for external actions
**Status:** Product baseline  
**Date:** 2026-10-05

Cuevaro may prepare return/warranty/administrative action packs and drafts. It does not autonomously submit consequential external actions in V1.

Future integrations require explicit permission and separate safety design.

## D-011 — Managed infrastructure, minimal operational complexity
**Status:** Recommended engineering baseline  
**Date:** 2026-10-05

Prefer a TypeScript monorepo, React Native/Expo mobile, responsive web companion, managed PostgreSQL/auth/storage, durable worker/jobs, provider abstractions, and managed commodity services.

No V1 microservice zoo or custom ML training.

## D-012 — Privacy is part of product value
**Status:** Product baseline  
**Date:** 2026-10-05

No sale of personal document content for advertising. Minimize sensitive data in prompts/logs/analytics. Export/delete and clear household authorization are commercial requirements.

## D-013 — Calm attention
**Status:** Product baseline  
**Date:** 2026-10-05

Cuevaro does not optimize for daily engagement. "Nothing needs you today" is a successful state.

Notifications must correspond to useful awareness/action.

## D-014 — Product boundary
**Status:** Product baseline  
**Date:** 2026-10-05

Cuevaro V1 is not:
- accounting;
- banking aggregation;
- generic calendar/to-do;
- CRM;
- project management;
- generic autonomous assistant;
- legal/insurance adjudication;
- marketplace;
- password manager.

## D-015 — Paid value must earn recurring payment
**Status:** Commercial baseline  
**Date:** 2026-10-05

Do not create a subscription whose main value is storing a reminder. Paid value should come from recurring intelligence, lifecycle watching, secure sync, collaboration, policy intelligence, action preparation, and ongoing infrastructure.

Pricing remains a hypothesis until tested.

## D-016 — Local engineering baseline
**Status:** Implemented development choice under standing authority
**Date:** 2026-10-05

Use the recommended Expo/React Native TypeScript monorepo and boring Fastify API. Expo SDK 57 dependencies are pinned/aligned via the lockfile and React Native override. PostgreSQL remains canonical; PGlite supplies real embedded PostgreSQL for synthetic local development/integration. Supabase migrations and guarded adapter seams follow D-011. No managed project/region or production authentication was activated.

## D-017 — Honest, separated development mode
**Status:** Implemented development safeguard
**Date:** 2026-10-05

The loopback API has one clearly synthetic fixture identity and is not a custom production auth system. Native originals/cache require SQLCipher and a device-only secure-store key; Expo Go fails closed. Browser preview is synthetic-only and has no encryption/cloud-backup claim. A managed adapter accepts only actor objects minted by its own `getUser` path, revalidates identity/membership for privileged storage operations, and cannot trust client-declared actor IDs.

## D-018 — Conservative preflight and local OCR
**Status:** Implemented provisional development baseline; calibration open
**Date:** 2026-10-05

Global pixel checks cover blur/exposure/contrast/resolution. Absent verified edges returns Questionable, never Good. Geometry, regional glare, occlusion and page completeness are not claimed detected from pixel heuristics. Local Tesseract uses bundled language data; no evidence is sent to an AI vendor. The current parser supports explicit labeled single-item receipt fields and preserves ambiguity/Unknown. This is genuine OCR with limited extraction, not a fixture-output provider or calibrated commercial model.

## D-019 — Supported facts before consequences
**Status:** Implemented development behavior
**Date:** 2026-10-05

Only explicit validated and user-reviewed dates create current return/warranty events. No merchant return period, warranty eligibility or regional law is assumed. Original observations survive user corrections. Calendar-date cue calculations record timezone/source fact IDs/rule version; optimistic versions govern reminder changes. Stopping reminders retains purchase/evidence and audit history.

## D-020 - Dependency findings remain a release gate
**Status:** Active engineering blocker; no waiver
**Date:** 2026-10-05

Available Vitest/UUID fixes were installed and verified. `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv) remain upstream high advisories without a published patched release at inspection. CI keeps a separate failing dependency gate. Synthetic local development does not authorize public deployment or acceptance of these risks for real users.

## D-021 - Bounded document-region quality heuristics
**Status:** Provisional development implementation; representative calibration open
**Date:** 2026-10-06

Extend D-018 with shared native/server light-paper segmentation on contrasting backgrounds. Diagnose visible cut-off, skew, perspective, large obstruction and interior washout from bounded pixel previews; preserve originals and unknown edge completeness outside the supported image class. White backgrounds, camouflaged covers and semantic receipt completeness cannot be proven by these heuristics. Good describes observed capture signals, never extraction accuracy or guaranteed completeness. Native sources are checked against a 20 MP budget before image manipulation; previews are bounded to 900 by 1600 without enlargement.

## D-022 - Private development provider approval
**Status:** Owner approved; provisioning evidence pending
**Date:** 2026-10-06

Owner approved Supabase Free in Singapore (`ap-southeast-1`), synthetic data and explicitly approved developer identities. Paid activation, real sensitive captures, external testers and public deployment remain outside this checkpoint. Secure access and the identity list are pending; see docs/PRIVATE_DEVELOPMENT_PLAN.md. Do not infer identities or claim managed validation before executing it.

## D-023 - Bounded embedded-text PDF development adapter
**Status:** Local synthetic development implementation; native/rendered PDF gates open
**Date:** 2026-10-06

Use official Mozilla PDF.js 6.4.299 only in the Node API workspace, with a separate process, 192 MB V8 heap, 15-second deadline, 20 MB input, ten-page, 100,000-character and bounded output limits. Disable eval/XFA/WASM/remote fetching; request text only, not scripts/annotations or rendering. This is containment, not an OS sandbox or total-memory guarantee. Preserve originals before parsing; terminalize deterministic unsupported cases. Embedded text may be hidden or differ from visible content; show that warning and require explicit continuation, then low-confidence fact review. Retain page provenance and Unknown on conflicts. No scanned-PDF OCR or native viewing claim. Parser behavior is versioned receipt-text-v2 after removing last-label-wins ambiguity.

## D-024 - Explicit receipt-format normalization
**Status:** Limited synthetic development support; calibration open
**Date:** 2026-10-06

Version receipt-text-v3 accepts explicit alternate labels, the unambiguous peso symbol, named English months, year-first dates and numeric dates whose month/day order yields only one valid interpretation. Do not use host locale or infer merchant from arbitrary headers. Ambiguous numeric dates, invalid/future purchase dates, inconsistent labels and conflicting consequential evidence stay Unknown. Equivalent repeated dates can share one candidate; preserve original excerpt and evidence association. Relative policy durations remain unsupported. Broader unlabeled/multi-item extraction remains separate.
