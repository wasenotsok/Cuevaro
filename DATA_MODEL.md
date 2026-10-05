# Canonical Data Model — Cuevaro

## 1. Goal

Cuevaro's data model must represent not only "things" but the chain from evidence to truth to future action.

The model is relational at its core, with JSON used only for bounded flexible metadata.

## 2. Core identity model

### users
- id
- auth_subject
- email/phone as required
- locale
- timezone
- created_at
- status

### households
- id
- name
- home_region / country
- default_currency
- timezone
- created_at

### household_memberships
- household_id
- user_id
- role (`owner`, `member`, later `viewer`)
- status
- invited_at
- joined_at
- revoked_at

Every user-owned domain row includes `household_id` where practical to make isolation explicit.

## 3. Capture/evidence model

### captures
Represents an ingestion event.

Fields:
- id
- household_id
- initiated_by_user_id
- input_type
- client_capture_id / idempotency key
- state
- captured_at
- uploaded_at
- confirmed_at
- source_app metadata (minimal)
- error_code
- content_hash where possible

### evidence_objects
Represents original or derived files.

Fields:
- id
- household_id
- capture_id
- object_kind (`original`, `page_image`, `thumbnail`, `crop`, `export`)
- storage_key
- mime_type
- byte_size
- sha256
- encrypted flag / encryption_version
- created_at
- deleted_at
- retention_state

### evidence_links
Many-to-many links from evidence to domain records.

- evidence_id
- entity_type
- entity_id
- relation_type (`proves`, `mentions`, `manual`, `service_record`, etc.)

## 4. Observation/provenance model

### extraction_runs
- id
- capture_id
- provider
- model/version
- prompt/schema version
- started_at
- completed_at
- status
- cost/usage metadata (non-content)
- evaluation cohort flag

### observations
Each extracted candidate fact is a row or structured child record.

Fields:
- id
- household_id
- extraction_run_id
- entity_candidate_id
- field_name
- normalized_value
- raw_value where necessary
- value_type
- confidence_score
- confidence_bucket
- evidence_object_id
- source_locator (page / bounding box / text span)
- source_type (`document_extraction`, `external_policy`, `import`, etc.)
- created_at

Do not treat model confidence as calibrated probability unless evaluation proves it. UI can use buckets such as high/medium/low.

### fact_assertions
Current and historical authoritative/user-facing values.

- id
- household_id
- entity_type
- entity_id
- field_name
- value
- source_observation_id nullable
- authority_type (`user_confirmed`, `user_entered`, `trusted_import`, `system_derived`)
- valid_from
- valid_to
- supersedes_id
- confirmed_by_user_id
- confirmed_at

This allows correction history without losing prior values.

## 5. Commerce / purchase model

### merchants
- id
- canonical_name
- domain
- country/region
- normalized aliases

Global merchant reference data must be separated from household-private purchase information.

### purchases
- id
- household_id
- merchant_id nullable
- purchase_date
- currency
- subtotal
- tax
- total
- order_number
- status
- primary_evidence_id
- created_at

### purchase_lines
- id
- purchase_id
- item_id nullable
- description
- quantity
- unit_price
- line_total
- sku/barcode if known

### items
Represents owned assets/products.

- id
- household_id
- display_name
- category
- brand
- model
- serial_number
- barcode
- purchase_id nullable
- owner/profile later
- location_id nullable
- lifecycle_status (`owned`, `returned`, `sold`, `disposed`, `lost`)
- acquired_at
- disposed_at

Identifiers may later be normalized into a separate table if multiple identifiers per item become common.

## 6. Warranty and return model

### coverage_records
Generic coverage abstraction.

- id
- household_id
- item_id
- coverage_type (`manufacturer_warranty`, `retailer_warranty`, `extended_warranty`, `protection_plan`)
- start_date
- end_date
- duration_rule
- status (`candidate`, `confirmed`, `expired`, `void`, `unknown`)
- provider_name
- policy_reference_id nullable
- evidence_id nullable
- registration_required unknown/bool
- notes

### return_windows
- id
- household_id
- purchase_id / purchase_line / item_id
- start_date
- end_date nullable
- rule
- status (`candidate`, `confirmed`, `expired`, `used`, `not_applicable`, `unknown`)
- policy_reference_id
- evidence_id

## 7. External policy provenance

### policy_sources
- id
- organization/merchant/manufacturer
- policy_type
- region
- source_url
- source_title
- retrieved_at
- content_hash/excerpt_hash
- normalized_rule_json
- confidence/review_state
- valid_from/known_at
- superseded_by

Never overwrite policy history invisibly.

## 8. Lifecycle model

### obligations
Represents something that may require attention.

- id
- household_id
- entity_type/entity_id
- obligation_type
- title
- due_at / due_date
- timezone
- source_fact_ids / rule_version
- priority
- consequence_category (`money`, `coverage`, `compliance`, `maintenance`, `convenience`)
- state (`candidate`, `active`, `completed`, `dismissed`, `not_applicable`, `superseded`)
- created_at
- completed_at

### cues
Represents a notification/attention occurrence for an obligation.

- id
- obligation_id
- scheduled_for
- channel
- state (`scheduled`, `suppressed`, `sent`, `delivered`, `opened`, `failed`, `cancelled`)
- delivery_attempts
- sent_at
- opened_at

### actions
- id
- obligation_id
- action_type
- state
- started_at
- completed_at
- outcome
- generated_artifact_id nullable

### maintenance_events
Can be modeled as obligations/actions initially, with later specialized fields:
- service date;
- provider;
- cost;
- meter/usage;
- parts;
- next due.

## 9. Notes and history

### notes
- entity_type/entity_id
- author_user_id
- content
- created_at/updated_at

### audit_events
- id
- household_id
- actor_type/user_id
- event_type
- entity_type/id
- timestamp
- request/correlation id
- safe metadata JSON

Audit metadata must not become a second unprotected copy of document contents.

## 10. Notification preferences

### notification_preferences
- household/user
- category
- channel
- enabled
- quiet_hours
- digest_mode
- default lead times

Per-obligation overrides may exist.

## 11. Billing

### entitlements
- household_id
- plan
- provider
- provider_customer/subscription references
- state
- current_period_end
- grace_until
- feature limits

Never gate export/delete behind a paid entitlement.

## 12. Privacy records

### consent_records
- user_id
- policy/document version
- purpose
- granted/withdrawn
- timestamp

### deletion_jobs
- scope
- requested_by
- requested_at
- state
- completed_at
- verification metadata

### data_exports
- requested_by
- requested_at
- expires_at
- state
- storage reference

## 13. Entity relationship principles

### Rule 1
Original evidence is not the same as extracted data.

### Rule 2
An item may have many evidence objects and many lifecycle events.

### Rule 3
A purchase may contain multiple items.

### Rule 4
A future event is derived and must know which facts/rules produced it.

### Rule 5
A user's correction creates a superseding fact; it does not erase history.

### Rule 6
External policy facts are dated observations, not timeless truth.

### Rule 7
Unknown is a first-class value/state where business logic needs it. Avoid using null ambiguously for "not applicable", "not yet known", "not processed", and "failed".

## 14. Deduplication

Possible signals:
- evidence content hash;
- same merchant/date/total/order number;
- same serial/model;
- same client idempotency key;
- near-identical OCR fingerprint.

Deduplication should propose merge or automatically suppress duplicate ingestion only when confidence is strong and reversibility exists.

## 15. Data retention classes

Define categories:
- account/profile;
- original evidence;
- derived facts;
- operational logs;
- audit/security logs;
- analytics;
- AI request metadata;
- exports;
- deleted-item tombstones.

Each class requires:
- purpose;
- legal/business basis;
- retention period;
- deletion behavior;
- backup behavior.

Exact periods require legal/privacy review before launch.

## 16. Future extensions

The model should later support:
- persons/dependents;
- pets;
- vehicles;
- properties/locations;
- policies;
- licenses/IDs;
- memberships/subscriptions;
- contracts;
- school/admin events;
- organization/team.

Add them as domain entities attached to the same evidence/fact/obligation engine rather than inventing separate reminder systems.