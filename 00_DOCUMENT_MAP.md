# Cuevaro Documentation Map

This file is the recommended reading order and defines which documents are authoritative for which questions.

## Read first

| Document | Purpose | Authority |
|---|---|---|
| `PROJECT_BRIEF.md` | What Cuevaro is, who it serves, why it exists | Product identity |
| `PRODUCT_VISION.md` | Long-term product thesis, principles, boundaries, edge | Strategic product direction |
| `PRODUCT_SPEC.md` | Functional scope, V1 behavior, requirements, acceptance gates | Product requirements |
| `ROADMAP.md` | Development sequence and release gates | Delivery sequencing |
| `CURRENT_STATUS.md` | Current factual project state | Status |

## Product and user experience

| Document | Purpose |
|---|---|
| `UX_UI_SYSTEM.md` | UX rules, navigation, screens, accessibility, visual direction |
| `COMPETITIVE_STUDY.md` | Competitors, category map, gaps, differentiators |
| `BUSINESS_AND_GTM.md` | Pricing hypotheses, monetization, positioning, GTM, KPIs |

## Technical system

| Document | Purpose |
|---|---|
| `SYSTEM_ARCHITECTURE.md` | System context, services, subsystems, runtime architecture |
| `DATA_MODEL.md` | Canonical records, relationships, provenance, lifecycle data |
| `AI_INTELLIGENCE.md` | AI pipeline, extraction, confidence, policy intelligence, evaluations |
| `INTEGRATIONS.md` | External providers, app-store services, email/calendar, product/recall data |
| `ENGINEERING_AND_RESOURCES.md` | Stack, environments, accounts, skills, budget and resource plan |

## Trust, quality, and operations

| Document | Purpose |
|---|---|
| `SECURITY_PRIVACY_COMPLIANCE.md` | Threat model, privacy baseline, compliance design |
| `QUALITY_AND_VALIDATION.md` | Test strategy, AI evaluation, release criteria |
| `OPERATIONS_AND_SUPPORT.md` | Monitoring, backups, recovery, support, incidents |
| `RISK_REGISTER.md` | Product, technical, legal, commercial, and execution risks |

## Governance and evidence

| Document | Purpose |
|---|---|
| `DECISIONS.md` | Durable product and architecture decisions |
| `REVIEW_AND_GAP_AUDIT.md` | Independent re-review of this study and unresolved gaps |
| `SOURCES.md` | Research sources and evidence notes |
| `HISTORY.json` | Atlas-compatible structured history and roadmap facts |

## Source-of-truth precedence

When documents appear to disagree:

1. Explicit Owner decision recorded in `DECISIONS.md`.
2. `PRODUCT_SPEC.md` for current product requirements.
3. `SECURITY_PRIVACY_COMPLIANCE.md` for minimum trust controls.
4. `SYSTEM_ARCHITECTURE.md` and `DATA_MODEL.md` for technical structure.
5. `ROADMAP.md` for sequencing.
6. Other studies and research for supporting rationale.

`COMPETITIVE_STUDY.md` and `SOURCES.md` are evidence, not authority over product decisions.

## Change discipline

Any material change to product scope, security assumptions, data ownership, pricing model, AI decision authority, or launch platform should update:

- `DECISIONS.md`;
- the affected canonical document;
- `CURRENT_STATUS.md`;
- `HISTORY.json` when it changes a roadmap/state fact.

The goal is that a developer joining Cuevaro cold can answer "what are we building, why, how, and under what constraints?" without reconstructing the product from chat history.