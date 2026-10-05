# Product Specification — Cuevaro

## 1. Scope of this specification

This is the canonical product requirements document for the pre-development definition of Cuevaro. It defines the required behavior of the initial product and the architecture constraints needed for later expansion.

The V1 target is deliberately narrower than the long-term vision.

## 2. V1 outcome

V1 must prove one commercial proposition:

> A user will trust Cuevaro to turn purchase evidence into a useful, evidence-backed lifecycle record with less effort than using photos, folders, spreadsheets, calendar reminders, or a conventional inventory app.

## 3. V1 supported inputs

### Required
- camera photo;
- photo library image;
- PDF upload;
- manual quick-add;
- barcode/QR capture when present on packaging or item.

### Preferred if schedule allows
- share-sheet import from another mobile app;
- forwarded email receipt via a unique ingestion address;
- screenshot import.

### Later
- voice note;
- direct mailbox connection;
- browser extension;
- retailer integrations;
- bulk video inventory.

## 4. V1 canonical objects

- Household
- User
- Membership / role
- Capture
- Document / evidence
- Purchase
- Item / asset
- Merchant
- Warranty
- Return policy / return window
- Identifier (serial/model/barcode)
- Obligation / lifecycle event
- Cue
- Action
- Completion / outcome
- Note
- Provenance record
- Audit event

See `DATA_MODEL.md`.

## 5. V1 primary flow — receipt to lifecycle

### Step 1 — Capture
User taps one prominent action: **Add**.

Default capture options:
- Take photo
- Choose photo/PDF
- Scan barcode
- Add manually

The app must not first ask "What category is this?"

### Step 2 — Processing
Cuevaro:
- preserves the original;
- performs image normalization where useful;
- classifies the capture;
- extracts merchant/date/total/currency/item candidates;
- detects likely warranty/return evidence;
- attempts to match item and merchant;
- generates structured draft fields with confidence and provenance.

### Step 3 — Review
The app presents a short review, not a full form.

Fields are grouped:

**Looks good**
- high-confidence, low-risk fields

**Check these**
- low-confidence or high-consequence fields

**Optional**
- model/serial/photo if missing and useful

The user can inspect the source crop/evidence behind a field.

### Step 4 — Consequences
After confirmation Cuevaro creates:
- purchase record;
- one or more item records;
- linked receipt;
- known return deadline or explicit unknown;
- known warranty or explicit unknown;
- cue schedule;
- suggested next capture when useful ("Add serial number?").

### Step 5 — Home
Home screen shows attention, not inventory volume.

Priority zones:
1. **Needs attention**
2. **Coming soon**
3. **Recently handled**
4. Search / browse all

No "you have 372 records" vanity statistic as the primary experience.

## 6. Return-window behavior

A return deadline may come from:
- explicit receipt text;
- merchant policy source;
- user input;
- imported retailer metadata.

Requirements:
- source type must be stored;
- external policy must store URL/reference, jurisdiction/market, and checked-at time;
- computed deadline must store the rule and base date;
- if policy cannot be determined reliably, show **Unknown**, not a fabricated date;
- user may set their own date;
- the user can see why a deadline exists.

V1 may limit automatic retailer-policy research to a curated merchant set. "Unknown with easy manual override" is acceptable. Wrong confident deadlines are not.

## 7. Warranty behavior

Warranty state may be:
- explicit from receipt/document;
- manufacturer policy found externally;
- user-entered;
- unknown.

Requirements mirror return-policy provenance.

Manufacturer warranty is not assumed to apply merely because a generic web page says a duration. Region, product line, registration requirements, exclusions, and purchase channel may differ.

The system should distinguish:
- **coverage candidate**;
- **confirmed coverage**;
- **user-entered coverage**.

## 8. Cue scheduling

Each lifecycle event can have one or more cue offsets.

Example defaults:
- return: 7 days and 2 days before;
- short warranty: 30 days before;
- long warranty: 60 and 14 days before;
- maintenance: configurable based on confirmed interval.

Defaults are product policy, not immutable.

Users must be able to:
- change cue timing;
- snooze;
- dismiss one cue without deleting the underlying record;
- mark an obligation not applicable;
- complete action;
- mute categories/digests.

## 9. Cue card requirements

Every cue should answer:

- **What:** "Return window ends in 7 days"
- **For what:** item and merchant
- **When:** exact date/timezone context if relevant
- **Why:** source/provenance
- **Do:** primary next action
- **Evidence:** receipt/document one tap away

Example actions:
- Keep item
- Start return
- Start warranty claim
- Mark serviced
- Add missing proof
- Snooze
- Dismiss / not applicable

## 10. Action packs

V1 action packs may be simple but the data structure should support growth.

### Return pack
- item;
- merchant;
- purchase date;
- amount;
- receipt;
- known return policy source;
- deadline;
- notes.

### Warranty pack
- item;
- model/serial;
- purchase date;
- receipt;
- warranty evidence/source;
- service history;
- defect photos (later);
- generated summary (later).

V1 does not autonomously file a claim or return without user review.

## 11. Search

Search must work across:
- item names;
- merchant;
- brand/model/serial;
- extracted text;
- dates;
- notes;
- tags;
- record type.

Search results should prioritize exact identifiers and linked entities.

Natural-language question answering is later unless it can be implemented without delaying the core.

## 12. Sharing

### V1
Single-user is acceptable for the earliest private alpha.

### Public V1 requirement
A paid household/family plan needs:
- owner role;
- member role;
- invite/revoke;
- per-household isolation;
- audit trail for changes.

Fine-grained per-record sharing can be later, but architecture must not assume one user = one household forever.

## 13. Export and deletion

Required before public launch:
- export structured data in a documented format (CSV/JSON where appropriate);
- export original documents in a folder/archive;
- account deletion;
- document deletion;
- retention policy;
- clear behavior for backups and deletion propagation.

## 14. Offline behavior

Minimum:
- user can view recently cached confirmed records and original thumbnails;
- capture can queue when offline;
- user sees upload/processing state.

The system must never pretend a queued item is safely backed up before upload succeeds.

Full offline intelligence is not a V1 requirement.

## 15. Notifications

V1 channels:
- in-app;
- mobile push.

Later:
- email;
- digest;
- calendar export/integration;
- SMS for selected high-value business use cases.

Notification policy must avoid spam. Default design should favor consolidated, useful reminders over repeated nagging.

## 16. Onboarding

Goal: first useful record in under three minutes.

Sequence:
1. concise value explanation;
2. privacy summary;
3. create/sign in;
4. "Add your first purchase";
5. capture;
6. review;
7. show the future cue Cuevaro created.

Do not ask the user to configure:
- every household member;
- every category;
- notification matrix;
- filing structure;
before first value.

## 17. Trust UI

Required:
- provenance chip/label for consequential values;
- confidence/needs-review state;
- original evidence accessible;
- edit history for confirmed fields;
- external source and checked date where relevant;
- explicit "unknown" state;
- no fake precision.

## 18. Sensitive-data controls

Even V1 receipts can contain:
- name/address;
- payment fragments;
- loyalty IDs;
- order numbers;
- phone/email.

Therefore:
- redact unnecessary sensitive fields from AI prompts when feasible;
- store originals securely;
- minimize extracted data to product purpose;
- prohibit use of user data for advertising targeting;
- document third-party processing.

## 19. Accessibility

Public launch must support:
- screen readers;
- dynamic text / large font;
- sufficient contrast;
- non-color-only state;
- minimum touch target sizing;
- reduced motion;
- keyboard/web access where applicable;
- logical focus order;
- clear error recovery.

Target WCAG 2.2 AA principles for applicable surfaces and platform-specific accessibility testing.

## 20. Localization

Architecture:
- all UI strings externalized;
- locale-aware dates/numbers/currency;
- timezone explicit;
- merchant policy facts region-scoped;
- no hard-coded U.S.-only date formats.

Initial language can be English. Philippines launch should support PHP currency and local date/time conventions. Tagalog localization is a later commercial decision, not a data-model rewrite.

## 21. Analytics

Product analytics must be privacy-conscious.

Track events such as:
- onboarding_started/completed;
- capture_started/uploaded;
- extraction_completed;
- review_required;
- field_corrected;
- record_confirmed;
- cue_delivered/opened;
- action_started/completed;
- export_requested;
- deletion_requested.

Do not put raw receipt text, document contents, IDs, serials, addresses, or user-entered sensitive strings into analytics.

## 22. Commercial tiers — hypothesis

Not final pricing.

### Free
Enough to prove value:
- limited AI captures per month;
- core records;
- basic cues;
- export.

### Plus
Ongoing automation:
- higher/unlimited reasonable capture allowance;
- external policy lookup;
- advanced cues;
- action packs;
- more document storage;
- recall monitoring when available.

### Family
- shared household;
- multiple members;
- roles;
- shared action history.

### Business — later
Separate requirements and pricing.

See `BUSINESS_AND_GTM.md`.

## 23. V1 non-goals

- tax filing;
- budgeting;
- banking;
- password storage;
- medical record system;
- legal document drafting engine;
- autonomous merchant negotiation;
- broad web agent;
- full business asset management;
- inventory quantity management;
- QR label printing;
- home renovation project management;
- estate-planning workflows.

## 24. V1 product requirements

### Functional
F-001 Capture image/PDF/manual input.  
F-002 Preserve original evidence.  
F-003 Extract purchase facts into structured draft.  
F-004 Represent confidence and provenance per important field.  
F-005 Confirm/edit before high-consequence facts become authoritative.  
F-006 Create linked purchase/item/evidence records.  
F-007 Track warranty/return state including unknown.  
F-008 Compute cue dates only from traceable rules.  
F-009 Deliver in-app/push cues.  
F-010 Complete/snooze/dismiss cues without corrupting record history.  
F-011 Search confirmed records.  
F-012 Export records and evidence.  
F-013 Delete account/data.  
F-014 Audit material changes.  
F-015 Isolate household data.  
F-016 Recover safely from failed/duplicate uploads.  
F-017 Never overwrite confirmed data silently with AI output.

### Non-functional
N-001 Mobile capture path should feel immediate; upload may continue asynchronously.  
N-002 User-facing operations should have explicit loading/error/offline states.  
N-003 Public launch requires backups and tested restore.  
N-004 Sensitive secrets never ship in client application code.  
N-005 Logs/analytics exclude document content by default.  
N-006 Security review against OWASP mobile/web baselines before public launch.  
N-007 Accessibility acceptance tests included in release gate.  
N-008 AI extraction quality has a measured benchmark, not anecdotal testing.  
N-009 Critical cue scheduling is durable and idempotent.  
N-010 All timestamps stored with unambiguous timezone semantics.

## 25. V1 acceptance gates

Cuevaro is not ready for public sale merely because screens work.

### Product gate
- new user successfully creates useful first lifecycle record without tutorial assistance;
- median confirmed record requires minimal corrections in the supported receipt set;
- clear unknown states exist when warranty/return cannot be verified.

### AI gate
- benchmark dataset covers receipts with varying layouts, image quality, currencies, merchants, multi-item purchases;
- field-level accuracy thresholds defined and met;
- high-consequence false-confidence rate is explicitly bounded;
- regression suite runs on model/prompt changes.

### Trust gate
- originals, sources, confidence, history, export, deletion all work;
- privacy disclosures match actual behavior;
- no sensitive content in analytics/logging tests.

### Reliability gate
- reminder jobs survive restart/retry;
- duplicate notification rate within target;
- restore drill passes.

### Security gate
- threat model reviewed;
- auth/access-control tests pass;
- object storage isolation tested;
- dependency/security scanning clean to release policy;
- mobile/web security checklist passes.

### Commercial gate
- subscription/store compliance implemented;
- support and refund handling defined;
- pricing page/app-store copy does not overclaim AI certainty;
- brand/trademark clearance completed before material launch spend.

## 26. Owner-confirmed mobile interaction requirements

These requirements are mandatory product behavior, not optional polish.

### 26.1 Mobile-first, desktop-complete
Cuevaro is designed primarily for phones because most capture, reminders, and real-world follow-up happen on mobile. iOS and Android are the primary product surfaces. Desktop/web is a companion surface optimized for bulk review, large-document viewing, advanced search/filtering, export, administration, and later business workflows.

Nothing essential to ordinary personal use may require desktop.

The primary mobile loop is:
**Open → Capture / Share / Speak → Review only what is uncertain → Confirm → Done.**

Requirements:
- camera-first capture;
- share-sheet ingestion for images/PDFs/links where platform permits;
- push notifications;
- biometric unlock for sensitive access;
- offline/poor-network capture queue with visible sync state;
- fast cold/warm startup targets;
- large touch targets and one-handed use where practical;
- responsive layouts, dark mode, and accessibility;
- minimal typing; forms are fallback, not the default workflow.

### 26.2 Capture Quality Gate
Every camera/image capture must be quality-checked before expensive extraction where technically practical.

Checks include:
- blur and motion blur;
- glare/reflection;
- under/overexposure;
- cut-off document edges or missing pages;
- text too small / low effective resolution;
- occlusion by fingers or objects;
- extreme perspective/skew;
- multiple documents when one is expected;
- unreadable regions likely to contain important fields.

Outcomes:
- **Good:** continue automatically.
- **Questionable:** explain the specific issue and offer context actions such as **Use anyway** and **Retake photo**.
- **Bad:** do not pretend extraction succeeded; explain the problem and prioritize **Retake photo** / **Choose another photo**.

A failed quality gate never destroys the user's original capture. When offline, local quality checks should still run where feasible.

### 26.3 Contextual Quick Replies
When Cuevaro asks a question whose likely answers are predictable, the mobile chat/assistant UI must present tappable quick-reply chips/buttons.

Examples:
- **Track warranty**
- **Don't track**
- **Edit warranty**
- **Yes, that's mine**
- **Not sure**
- **Remind me later**
- **Retake photo**

Use consequence-specific labels instead of vague **Yes** whenever an action changes data or state.

For destructive, privacy-sensitive, financial, sharing, or external-action confirmations, the confirmation must name the consequence, for example **Delete receipt** / **Keep receipt**, rather than a generic yes/no pair.

Typing remains available for genuinely open-ended answers.

### 26.4 New functional requirements
F-018 Detect poor capture quality and request or offer a retry before unreliable extraction.
F-019 Explain the specific capture-quality problem in plain language where detectable.
F-020 Provide contextual quick-reply controls for predictable assistant questions.
F-021 Require consequence-specific confirmation labels for destructive or sensitive actions.
F-022 Ordinary personal Cuevaro use must be fully functional from mobile without desktop.
F-023 Desktop/web must share the same canonical data and permission model as mobile.
