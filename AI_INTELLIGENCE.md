# AI and Intelligence System — Cuevaro

## 1. Role of AI

AI is an implementation engine, not Cuevaro's authority.

Its jobs are to reduce clerical work:
- classify captures;
- extract candidate facts;
- normalize messy text;
- link records;
- find candidate policies/sources;
- summarize evidence;
- propose future consequences;
- prepare action materials.

AI must not silently create authoritative high-consequence truth when evidence or confidence is insufficient.

## 2. Intelligence pipeline

```text
Input
  ↓
Preflight / safety / file validation
  ↓
Image/PDF normalization
  ↓
Classification
  ↓
Structured extraction
  ↓
Schema validation
  ↓
Field confidence + provenance
  ↓
Entity matching
  ↓
Policy intelligence (when relevant)
  ↓
Consequence generation
  ↓
Risk/confidence gate
  ↓
User review or auto-accept low-risk fields
  ↓
Confirmed facts
```

## 3. Input preflight

Checks:
- supported MIME/content;
- file size/page limit;
- corruption;
- duplicate hash;
- malicious file handling;
- image readability;
- page count;
- password-protected PDF state.

PDF rendering/parsing must be isolated from application process where practical.

## 4. Structured extraction

Never parse free-form prose output with fragile regex if structured model output is available.

Schemas should include:
- candidate value;
- normalized value;
- source locator;
- confidence bucket;
- reason code for uncertainty;
- alternative candidates where useful.

Example conceptual field:

```json
{
  "field": "purchase_date",
  "value": "2026-10-05",
  "confidence": "high",
  "source": {"page": 1, "region": [0.12, 0.18, 0.42, 0.24]}
}
```

## 5. Confidence policy

Model self-reported confidence alone is not enough.

Confidence gating can combine:
- model confidence;
- OCR/vision agreement;
- schema validity;
- field format;
- cross-field consistency;
- evidence visibility;
- merchant/date/amount heuristics;
- benchmark calibration.

### Risk classes

**Low consequence**
- merchant display name;
- category suggestion.

**Medium**
- price, model, purchase date.

**High consequence**
- return deadline;
- warranty end;
- cancellation/renewal date;
- identity number;
- compliance expiry.

The higher the consequence, the stronger the confirmation/source requirement.

## 6. External policy intelligence

This subsystem is strategically important and dangerous if done badly.

### Required behavior
- identify merchant/manufacturer and user region;
- retrieve authoritative or high-quality source;
- record source URL/title;
- record checked-at timestamp;
- retain normalized rule plus the evidence used;
- distinguish generic policy from item-specific exceptions;
- compute date deterministically;
- show unknown when rules conflict or applicability is unclear.

### Source hierarchy
1. merchant/manufacturer official policy;
2. government/regulator source;
3. contract/receipt text;
4. trusted structured provider;
5. secondary source only as a lead, not final authority for consequential dates.

### Never
- let a generative model invent a return period from memory;
- hide source age;
- assume a U.S. policy applies in the Philippines;
- treat search snippets as durable proof.

## 7. Consequence engine

Do not ask an LLM every day "what should happen?" for stored records.

Use deterministic rules over confirmed facts and policy records where possible.

AI can propose rule candidates. Once confirmed/normalized, the actual date arithmetic and cue scheduling are deterministic.

Example:
- purchase date = Oct 5
- confirmed return policy = 30 calendar days
- computed end date = Nov 4
- cue offsets = -7d, -2d

Rule version and inputs are stored.

## 8. Entity resolution

Goals:
- same merchant under aliases;
- new service invoice → existing appliance;
- second photo with serial → item created from receipt;
- duplicate receipt detection.

Use layered matching:
1. exact identifiers;
2. deterministic normalized values;
3. fuzzy similarity;
4. AI-assisted candidate ranking;
5. user confirmation for ambiguous merges.

Never irreversible auto-merge on weak semantic similarity.

## 9. AI-generated action material

Permitted examples:
- warranty claim summary;
- return checklist;
- email draft;
- service history summary;
- questions to ask the merchant;
- evidence checklist.

Requirements:
- generated text labeled as draft where relevant;
- factual assertions grounded in confirmed Cuevaro records;
- source links available;
- user reviews before external send/submission.

## 10. Prompt and model governance

Every production AI operation stores:
- operation type;
- prompt/template version;
- schema version;
- model/provider version;
- evaluation version where applicable;
- non-sensitive cost/latency metadata.

Changes to prompts/models are software changes and go through:
- automated regression;
- benchmark comparison;
- staged rollout;
- rollback capability.

## 11. Provider abstraction

Interface examples:
- `extractPurchaseEvidence()`
- `classifyCapture()`
- `rankEntityMatches()`
- `summarizeActionPack()`

Do not spread vendor-specific response objects throughout the domain model.

Provider abstraction enables:
- cost optimization;
- privacy-provider changes;
- fallback;
- regional hosting options;
- future local/on-device models.

## 12. Data minimization for AI

Where feasible:
- crop to relevant receipt area;
- omit unrelated pages;
- redact payment card/account fragments;
- avoid sending household names if not needed;
- use opaque internal IDs;
- do not include unrelated records in prompts;
- set API storage/retention options deliberately.

If a third-party AI provider receives user evidence, that relationship belongs in privacy disclosures and subprocessor documentation.

## 13. On-device intelligence roadmap

On-device capabilities are strategically valuable for:
- barcode;
- simple OCR;
- image quality checks;
- PII redaction;
- local classification;
- offline capture;
- privacy-sensitive documents.

Do not force on-device-only AI into V1 if it makes extraction materially worse. Use it where it reduces cost/privacy risk without compromising the core experience.

## 14. AI evaluation program

Create a versioned private benchmark.

### Dataset dimensions
- crisp receipt photos;
- skewed/blurry/low light;
- thermal/faded paper;
- emailed PDF receipts;
- multi-page invoices;
- multi-item receipts;
- different currencies;
- date formats;
- taxes/discounts;
- merchants from Philippines and target launch markets;
- handwritten additions;
- irrelevant photos;
- duplicate captures;
- adversarial/misleading text;
- documents containing prompt-like instructions.

### Metrics
Per field:
- exact match;
- normalized match;
- precision/recall;
- date accuracy;
- numeric accuracy;
- confidence calibration;
- "unknown" correctness.

End-to-end:
- % records confirmed with no edits;
- median fields corrected;
- false-confident high-consequence rate;
- extraction latency;
- cost per successful confirmed capture;
- duplicate/merge error rate.

### Critical metric
**High-consequence false-confidence rate** is more important than raw average extraction accuracy.

A system that says "unknown" 5% more often but almost never gives a wrong warranty deadline may be commercially superior.

## 15. Human review strategy

The user is not an unpaid labeler.

Review UI should:
- show only important/uncertain fields;
- make correction one tap;
- remember safe preferences;
- never make the user inspect every field forever.

For internal policy catalog maintenance, staff/reviewer tooling can have a separate review queue.

## 16. Abuse/prompt-injection considerations

Uploaded documents can contain hostile instructions such as "ignore previous instructions."

Document content is untrusted data.

Requirements:
- extraction prompts explicitly treat document text as data;
- no tool execution based on document instructions;
- external URL fetches use allow/deny/security policies;
- generated actions never inherit arbitrary instructions from evidence;
- sanitize HTML/PDF metadata;
- no automatic credential submission.

## 17. Cost controls

- resize images to sufficient, not maximal, resolution;
- cache immutable extraction results by evidence hash;
- deterministic code for date arithmetic;
- do not re-run expensive extraction on every view;
- model tiering by task/risk;
- monthly per-plan AI budgets;
- observability by operation/model;
- rate limit abuse.

## 18. Failure behavior

When AI fails:
- original evidence is still safely stored;
- user can add/edit manually;
- job can retry when safe;
- UI explains processing state;
- no fake partially generated authoritative record;
- support diagnostics do not expose full user document by default.

Cuevaro must remain useful when intelligence is uncertain.

## 17. Capture-quality intelligence

Capture quality is a first-class intelligence stage and should run before costly cloud extraction whenever feasible.

The quality gate produces structured findings, not merely a single pass/fail score. Candidate checks:
- blur/motion blur;
- glare/reflections;
- exposure/contrast;
- document-edge completeness;
- perspective/skew;
- effective text resolution;
- occlusion;
- page completeness;
- likely multiple-document collision;
- important-region readability.

The gate returns one of:
- **good** — proceed;
- **questionable** — proceed only with clear warning and **Use anyway / Retake** choices;
- **bad** — request retake or alternate image and do not create false-confidence extracted facts.

Where possible, low-cost/on-device computer-vision checks should handle blur, glare, edge completeness, and basic readability so bad captures are rejected before remote AI cost is incurred.

Capture-quality evaluation must be included in the AI benchmark. Metrics include false rejection of usable images, false acceptance of unusable images, latency, and downstream extraction improvement.
