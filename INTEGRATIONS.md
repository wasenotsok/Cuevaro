# External Integrations and Provider Strategy — Cuevaro

## 1. Principle

Cuevaro should integrate where an external system creates clear user value, but no provider should become indistinguishable from the domain model.

Every integration has:
- owner;
- purpose;
- data sent/received;
- permission scope;
- retention/privacy review;
- failure mode;
- replacement plan.

## 2. AI provider

### Initial
Vision-capable structured extraction provider.

Requirements:
- image/PDF input;
- structured output;
- predictable versioning;
- documented retention;
- enterprise/data-processing terms suitable for product use;
- configurable storage behavior.

OpenAI is a viable initial provider, but use a provider interface and verify retention/data controls at implementation time.

## 3. Authentication

Recommended V1:
- email magic link/OTP or passwordless where appropriate;
- optional Apple/Google sign-in later.

Requirements:
- MFA path for sensitive expansion;
- secure recovery;
- reauthentication for export/delete/security changes;
- no custom password crypto.

## 4. Object storage

Requirements:
- private buckets only;
- short-lived signed reads;
- object-level access checks;
- content type/size restrictions;
- malware/file safety pipeline where relevant;
- lifecycle/deletion controls;
- backups/recovery plan.

## 5. Push notifications

V1:
- Expo notification service abstraction over platform push.

Store:
- device registration;
- platform;
- app build;
- last seen;
- invalidation state.

Never embed sensitive document data in lock-screen notification text by default.

Example safe:
"An item needs your attention in Cuevaro."

Optional user setting:
"Your blender return window ends in 2 days."

## 6. Email ingestion — post-alpha

A unique randomized address can let users forward receipts.

Pipeline:
email receive → validate sender/size → strip/normalize attachments → capture → extraction.

Security:
- reject executable/unsafe attachments;
- sender is not automatically proof of ownership;
- rate limits;
- anti-spam;
- do not execute remote content;
- clear retention for raw email headers/body.

Direct Gmail/Outlook OAuth should come later because it greatly expands trust, scopes, compliance, and review requirements.

## 7. Share sheet

High-value mobile integration:
- Share PDF/image/email-export to Cuevaro.
- Should open lightweight confirmation then background ingest.

This may deliver more convenience than mailbox OAuth early.

## 8. Calendar

Optional later:
- export one cue/event to system calendar;
- subscribe to Cuevaro calendar feed;
- avoid making calendar the source of truth.

If a user deletes the calendar event, Cuevaro's obligation should not silently disappear unless explicit synchronization rules say so.

## 9. Barcode/product data

Potential use:
- UPC/EAN product identification;
- brand/model autocomplete.

Rules:
- external product databases are hints, not proof of exact purchased variant;
- cache license-compliantly;
- retain provider/source attribution where required.

## 10. Product recalls

Potential differentiator, later.

Architecture should support:
- recall source;
- jurisdiction;
- product identifiers/model ranges;
- observed/published date;
- affected item match confidence;
- source link;
- user alert.

Only authoritative government/manufacturer sources should drive high-consequence recall alerts where possible.

## 11. Retailer/manufacturer policy sources

Policy Intelligence requires either:
- curated source registry;
- web retrieval/search provider;
- licensed policy data provider;
- human-reviewed catalog;
- combination.

Start with a small merchant set in launch markets rather than pretending universal coverage.

Provider failure must result in **policy unknown**, not an invented value.

## 12. Maps/location

Not needed for V1.

Future service provider/merchant location can use ordinary mapping provider, but location tracking is outside the core and should not be collected continuously.

## 13. Payments and entitlements

### Mobile
Follow Apple/Google current billing rules for digital subscriptions.

### Web
Merchant-of-record provider can reduce tax/compliance complexity.

### Entitlement service
Options:
- direct store receipt validation;
- RevenueCat-like abstraction.

Decision criteria:
- privacy;
- pricing;
- supported stores/regions;
- webhook reliability;
- migration/export path.

## 14. Customer support

Support platform integration should receive only the minimum necessary account metadata.

Do not automatically attach:
- receipt images;
- IDs;
- full extracted text;
- sensitive notes.

If user explicitly shares evidence with support, record consent/purpose and access.

## 15. Analytics

Preferred early approach:
- first-party event schema;
- no autocapture;
- no session replay on screens containing documents/records;
- no raw user text;
- pseudonymous IDs;
- defined retention.

A third-party analytics SDK is optional, not assumed.

## 16. Error monitoring

If using Sentry-equivalent:
- scrub request/response bodies;
- scrub file paths that contain personal info;
- no attachments/screenshots by default;
- hash or pseudonymize user IDs;
- separate prod/staging.

## 17. Export/import

Cuevaro should provide documented export formats.

Future import sources may include:
- CSV;
- Google Drive folder;
- iCloud/Files picker;
- competitor exports.

Data portability can be a competitive advantage.

## 18. Integration rollout rule

No integration ships because it is fashionable.

It ships only if:
1. it removes meaningful manual work;
2. permission scope is proportional;
3. failure is understandable;
4. data handling is documented;
5. it has tests/monitoring;
6. user can disconnect it;
7. Cuevaro remains usable without it where feasible.