# Cuevaro — Quality, Testing, and Validation Strategy

Status: pre-development quality contract

## 1. Quality principle

Cuevaro stores evidence and may influence financially important decisions. "It usually works" is insufficient.

Quality has five dimensions:
1. functional correctness;
2. AI/extraction correctness;
3. lifecycle/reminder reliability;
4. security/privacy correctness;
5. usability/accessibility.

## 2. Test pyramid

### Unit
- date arithmetic;
- lifecycle rule evaluation;
- timezone/DST handling;
- confidence gating;
- state machines;
- permission checks;
- idempotency;
- parsing/normalization helpers.

### Integration
- database + row-level authorization;
- storage access;
- job queue;
- push scheduling;
- AI provider schema validation;
- policy-source retrieval;
- billing webhooks;
- export/deletion.

### End-to-end
Critical mobile journeys:
1. capture good receipt → review → confirm → cue created;
2. blurry capture → quality warning → retake → success;
3. questionable capture → use anyway → uncertainty preserved;
4. offline capture → queued → reconnect → durable upload;
5. quick-reply confirmation changes the intended state;
6. destructive action uses explicit consequence confirmation;
7. push notification deep-links to correct record;
8. export and delete complete correctly.

Desktop:
- login;
- search/filter;
- record review;
- bulk evidence upload later;
- export/admin.

## 3. Capture Quality Gate benchmark

Build a versioned test set containing:
- crisp receipts;
- motion blur;
- defocus;
- glare;
- low light;
- overexposure;
- cut-off edges;
- folded/curled receipts;
- thermal fade;
- small distant text;
- fingers covering key fields;
- strong perspective;
- multiple documents;
- screenshots/PDFs that should bypass camera-specific warnings.

Metrics:
- bad-image recall;
- usable-image false rejection;
- latency;
- downstream extraction accuracy before/after gate;
- user retake success rate.

Do not tune the gate until it rejects every imperfect photo. It should reject photos that threaten reliable extraction, not photography aesthetics.

## 4. AI extraction benchmark

Private, versioned, legally usable fixtures spanning:
- Philippine merchants and target markets;
- receipts/PDF invoices;
- varying layouts;
- currencies/tax formats;
- date formats;
- multi-item purchases;
- model/serial labels;
- warranty documents;
- adversarial/prompt-like text.

Per-field:
- exact/normalized match;
- precision/recall;
- numeric/date accuracy;
- confidence calibration;
- provenance correctness;
- unknown correctness.

Critical metric:
**false-confident high-consequence fields**.

A conservative unknown is preferable to a confident wrong return/warranty date.

## 5. Policy intelligence validation

For supported merchants/manufacturers:
- authoritative source exists;
- jurisdiction is known;
- checked-at timestamp stored;
- rule applicability test passes;
- deterministic date computation matches fixtures;
- exceptions/conflicts become unknown/review rather than silent selection.

Regression fixtures should include changed policies.

## 6. Reminder reliability

Test:
- process/server restarts;
- duplicate job delivery;
- clock/timezone changes;
- DST markets;
- rescheduling when source date changes;
- completed lifecycle suppression;
- retries;
- device token changes;
- notification permission denial.

Every externally delivered cue should have a stable idempotency key.

## 7. Security testing

Before public launch:
- automated dependency/security scans;
- authorization tests for every household-scoped resource;
- signed URL expiry;
- object-ID enumeration attempts;
- session revocation;
- invite/revoke;
- secure mobile storage;
- API rate limiting;
- malicious upload tests;
- prompt injection tests for documents;
- content redaction in logs/analytics;
- backup access;
- deletion propagation.

Independent security review/pentest should precede meaningful scale.

## 8. Privacy validation

Automated/manual checks:
- analytics events contain no raw document text/images by default;
- privacy notice matches actual providers;
- export contains expected records/evidence;
- delete removes active data and follows declared backup retention;
- account cancellation does not strand data without export;
- notification previews respect privacy defaults.

## 9. UX validation

Usability tests with non-technical users:
- first useful capture without coaching;
- user can understand why Cuevaro believes a date;
- user notices uncertainty;
- user can correct one field quickly;
- user understands what a quick-reply action will do;
- user can recover from bad photo/offline failure;
- user can retrieve an old receipt under time pressure.

Measure:
- time to first value;
- taps/typing per confirmed capture;
- abandonment point;
- correction burden;
- comprehension of consequential actions.

## 10. Accessibility

Release checks:
- VoiceOver/TalkBack paths;
- keyboard support on web;
- dynamic type;
- contrast;
- focus order;
- semantic controls;
- reduced motion;
- touch target size;
- quick-reply chips reachable/labeled.

## 11. Device matrix

Minimum beta coverage:
- low/mid/high Android camera quality;
- at least two Android OS generations in supported range;
- multiple recent iPhone sizes;
- slow network / offline;
- low storage;
- dark/light;
- common locale/date formats.

Emulators are insufficient for camera and notification confidence.

## 12. Release gates

No public V1 unless:
- P0/P1 known defects are zero or explicitly waived by Owner with rationale;
- core E2E suite passes;
- AI benchmark thresholds are defined and achieved;
- high-consequence false-confidence is within approved bound;
- quality gate benchmark passes;
- reminder recovery tests pass;
- export/delete/restore drills pass;
- authorization/security baseline passes;
- accessibility critical flows pass;
- store/billing sandbox tests pass;
- privacy/support documents are ready.

## 13. Post-release quality

Monitor:
- crash-free sessions;
- queue age;
- notification failures;
- extraction corrections;
- false-confidence reports;
- retake rate;
- duplicate records;
- policy lookup failures;
- support themes.

Every model/prompt/provider change requires benchmark comparison before broad rollout.
