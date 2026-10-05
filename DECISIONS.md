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
