# Cuevaro

> **Working product name:** Cuevaro  
> **Internal concept:** Life Admin  
> **Product state:** Engineering foundation in progress; synthetic local slice implemented
> **Commercial intent:** Aspiring consumer SaaS with a later family and small-business path  
> **Core promise:** Give Cuevaro something once. It remembers what matters, watches what changes, and brings it back when action is needed.

Cuevaro is an AI-assisted life-administration system designed to remove the clerical work between **having information** and **using it at the right time**.

A receipt is not merely a receipt. It may imply a purchased item, proof of ownership, a return deadline, warranty coverage, a serial number, a maintenance schedule, an insurance record, a future claim, and eventually resale or disposal. A passport is not merely a scanned image. It has an owner, an expiry, travel relevance, renewal lead time, and controlled sharing needs.

Cuevaro's job is to transform real-world evidence into a trustworthy, low-maintenance lifecycle system.

## The product in one line

**Capture once → understand → connect → watch → remind → act → prove.**

## What Cuevaro is not

Cuevaro is not a generic to-do list, calendar, cloud drive, accounting package, CRM, password manager, project-management tool, or general-purpose AI chatbot. It may integrate with those tools, but it should not become them.

## Why this repository exists

This repository is intended to be the durable source of truth for Cuevaro before implementation begins. It defines:

- product purpose and boundaries;
- users and jobs to be done;
- launch wedge and commercial differentiation;
- systems and subsystems;
- information model;
- AI behavior and trust requirements;
- privacy, security, and compliance baseline;
- UX and design system;
- technology and infrastructure;
- engineering process and resources;
- testing and AI-evaluation requirements;
- operations, support, backup, and incident response;
- business model, pricing hypotheses, go-to-market, and metrics;
- risks, decisions, roadmap, and release gates.

Start with [00_DOCUMENT_MAP.md](00_DOCUMENT_MAP.md).

Implementation has begun in the documented Expo/TypeScript/Postgres architecture. See [CURRENT_STATUS.md](CURRENT_STATUS.md), [development setup](docs/DEVELOPMENT.md), and [actual validation evidence and limits](docs/VALIDATION.md). Native hardware, managed services and commercial release gates are still open. No public application is deployed.

## Current strategic thesis

The category is validated but crowded. Existing products already cover household documents, receipts, warranties, inventory, expiry reminders, and AI-assisted capture. Cuevaro should **not** compete by presenting a larger checklist of features.

Cuevaro's intended edge is the combination of:

1. **Lowest-friction capture** — photo, PDF, screenshot, email, barcode, or short text.
2. **Evidence-backed extraction** — every important fact can point back to the original evidence.
3. **Confidence-aware review** — Cuevaro asks only about uncertain or consequential fields.
4. **Lifecycle linking** — one capture can create and connect multiple records and future obligations.
5. **Consequence engine** — Cuevaro determines what may matter later rather than waiting for the user to manually build reminders.
6. **Calm attention model** — surface only what needs attention, not a noisy dashboard of everything stored.
7. **Action readiness** — a reminder should lead toward completing the real-world job, with the relevant evidence already assembled.
8. **Portable trust** — export, deletion, audit history, privacy controls, and no intentional lock-in.

## Launch wedge

The recommended launch wedge is **purchases and owned household items**:

> Photograph a receipt or purchase proof. Cuevaro creates the useful record and watches the purchase lifecycle.

Initial lifecycle targets:

- proof of purchase;
- merchant, date, amount, and purchased item;
- return window;
- warranty;
- model and serial number;
- receipt/document preservation;
- maintenance when relevant;
- claim/return preparation;
- searchable history.

This wedge is understandable in seconds, demonstrates the automation advantage, and asks for less sensitive information than beginning with passports, medical documents, or children's records.

## Working tagline candidates

These are positioning aids, not final marketing copy:

- **Send it once. Know when it matters.**
- **The boring important stuff, handled.**
- **Capture it once. Cuevaro watches the rest.**
- **Your real-world admin, without the admin.**

## Commercial principle

A subscription must pay for ongoing value, not merely ongoing access to a database. Paid value should come from continued intelligence, automation, monitoring, shared use, document processing, action workflows, and reliable service.

## Brand note

"Cuevaro" passed a preliminary exact-name web collision screen during product discovery, but this is **not legal trademark clearance**. Before public launch or material brand spend, perform formal exact, phonetic, and confusing-similarity clearance in relevant jurisdictions and classes, including IPOPHL, USPTO, and WIPO, and obtain professional advice if warranted.

## Platform direction

Cuevaro is **mobile-first** (iOS and Android) with a desktop/web companion. The default experience is capture-first and low-typing: photograph, share, or import evidence; Cuevaro checks capture quality, extracts what matters, asks only necessary questions with tappable contextual replies, then watches the resulting lifecycle.
