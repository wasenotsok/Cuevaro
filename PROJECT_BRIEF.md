# Project Brief — Cuevaro

## 1. Identity

**Name:** Cuevaro  
**Internal concept:** Life Admin  
**Category:** Consumer life-administration / household intelligence  
**Stage:** Product definition, before implementation  
**Primary platforms:** Mobile-first; Android and iOS, with web access as the product matures  
**Commercial model:** Freemium/subscription hypothesis with family plan; business edition later only if consumer core proves itself

## 2. Problem

Important everyday information arrives in formats designed for the moment, not for the future:

- paper receipts;
- emailed receipts and invoices;
- warranty cards;
- product boxes and serial labels;
- insurance policies;
- registrations;
- IDs and licenses;
- school notices;
- contracts;
- membership notices;
- screenshots;
- service invoices;
- PDFs.

The user is expected to manually decide what matters, extract dates and identifiers, create folders, create calendar entries, set reminders, preserve proof, remember relationships, and later reconstruct context when action is needed.

That is the failure point.

People usually do not lack storage. They lack **conversion from evidence to useful future state**.

## 3. Product thesis

Cuevaro should act as a quiet administrative layer between real-world evidence and future action.

The user provides the evidence once. Cuevaro:

1. identifies what it is;
2. extracts useful facts;
3. records provenance and confidence;
4. links it to the correct person, household, item, vehicle, property, policy, or organization;
5. derives future obligations or opportunities;
6. monitors dates and state;
7. surfaces the issue at an appropriate time;
8. prepares the evidence and next action.

## 4. Core product loop

**Capture → Understand → Confirm → Link → Watch → Cue → Act → Close → Learn**

### Capture
Accept information in the form users already have.

### Understand
Classify and extract structured facts.

### Confirm
Ask the user only about uncertainty that matters.

### Link
Connect evidence to real-world entities and existing records.

### Watch
Track lifecycle dates, recurring needs, and optionally external policy/recall changes.

### Cue
Surface an actionable attention item before it becomes costly or stressful.

### Act
Open the relevant evidence and prepare the next step.

### Close
Record completion, outcome, and new state.

### Learn
Use confirmed corrections to improve routing and personalization without silently changing truth.

## 5. Launch wedge

Cuevaro V1 should center on **purchase lifecycle administration**.

### Primary V1 scenario

A user buys an appliance, electronics item, tool, furniture item, or other meaningful purchase and photographs the receipt.

Cuevaro should be able to create a draft record containing:

- merchant;
- purchase date;
- total and currency;
- item name(s);
- brand/model when available;
- receipt image/PDF;
- warranty evidence and/or candidate warranty;
- return deadline or unknown state;
- model/serial as additional capture if needed;
- reminders/cues generated from confirmed dates;
- notes/history.

The user should not be forced through a long form.

## 6. Primary users

### U1 — Busy adult
Has important purchases and documents scattered across email, photos, drawers, and cloud folders.

### U2 — Household administrator
The person in a family who remembers registrations, warranties, policies, school forms, maintenance, and where documents live.

### U3 — Homeowner/renter
Needs purchase proof, appliance history, maintenance records, and insurance-ready evidence.

### U4 — Couple/family
Needs shared access without sharing one password or exposing every record to every person.

### Later: U5 — Small operator/business
Needs expiries and evidence for certificates, licenses, equipment, vendors, and contracts. This is not a launch requirement.

## 7. Jobs to be done

- "When I buy something important, make sure I can prove it and use the warranty/return rights later."
- "When something expires or renews, warn me early enough to act."
- "When I need a document, show me the useful facts immediately and keep the original one tap away."
- "When an item breaks, put the receipt, serial, warranty, and history in front of me."
- "When my partner needs access, let them get the right information without asking me where it is."
- "When Cuevaro inferred something, let me see where it came from and correct it."
- "If I leave Cuevaro, let me take my information with me."

## 8. Product promise

Cuevaro should reduce:

- manual entry;
- missed deadlines;
- repeated searching;
- forgotten coverage;
- duplicated records;
- dependency on one household member's memory;
- uncertainty about whether an AI-derived fact is reliable.

Cuevaro should increase:

- evidence availability;
- timely action;
- household resilience;
- clarity;
- confidence;
- completion.

## 9. Product boundaries

### In scope over the product lifetime
- receipts and proof of purchase;
- warranties and return windows;
- belongings and household assets;
- maintenance and service history;
- registrations, licenses, IDs, memberships;
- insurance and household policies;
- family/shared records;
- school/admin notices;
- vehicle/property admin;
- recurring and expiry-based obligations;
- evidence bundles and action preparation;
- small-business expiry/document tracking as a later edition.

### Deliberately out of scope
- generic project management;
- generic task management;
- email client replacement;
- accounting/bookkeeping;
- bank aggregation in V1;
- password management;
- CRM/sales pipeline;
- medical diagnosis;
- legal advice;
- financial advice;
- autonomous submission of consequential forms without explicit user review;
- broad "AI assistant that does everything."

## 10. Strategic differentiator

Cuevaro's desired differentiation is **lifecycle intelligence with evidence and low friction**, not raw storage capacity.

The product should feel less like "maintain your personal database" and more like "hand Cuevaro the thing and let it keep watch."

## 11. Trust principle

Cuevaro must never invent certainty.

For consequential fields such as warranty end date, return deadline, expiry, policy cancellation window, identity number, or monetary amount:

- preserve original evidence;
- distinguish extracted fact from externally researched fact from user-entered fact;
- store source and observation date when external policy information is used;
- display uncertainty;
- require confirmation when confidence or consequence dictates;
- never silently replace confirmed user data with a model guess.

## 12. Success definition

Cuevaro is succeeding when users can add meaningful real-world admin in seconds and later receive a cue that saves time, money, stress, or a missed obligation.

The strongest activation event is not account creation. It is:

> **User captures an item/document and Cuevaro creates a future useful consequence with minimal manual input.**

The strongest retention event is:

> **Cuevaro brings something back at the right time and the user acts successfully.**

## Owner-confirmed platform rule

Cuevaro is **mobile-first and desktop-complete**. The phone is the primary product because capture, reminders, proof retrieval, and follow-up happen in the physical world. Desktop/web is a companion for heavier review and administration. Ordinary personal use must never depend on having a desktop computer.

Mobile design defaults to camera/share/voice input, minimal typing, contextual quick replies, biometric access, push notifications, accessibility, and safe offline capture queuing.
