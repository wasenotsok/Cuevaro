# Cuevaro — Operations and Support

Status: pre-launch operating model

## 1. Operating principle

Cuevaro must be boring to operate. Personal evidence and reminders are not the place for fragile heroics.

## 2. Production responsibilities

Monitor:
- API availability;
- database health;
- object storage;
- worker/queue backlog;
- scheduled cue backlog;
- push delivery failures;
- AI provider latency/error/cost;
- policy lookup failure rate;
- billing webhooks;
- export/deletion jobs;
- backup status.

## 3. Incident severity

### SEV-0
Confirmed unauthorized exposure of sensitive user data, destructive corruption, or systemic security compromise.

### SEV-1
Widespread inability to access data, reminder system failure that can cause missed obligations, or large-scale incorrect lifecycle dates.

### SEV-2
Major feature unavailable with workaround.

### SEV-3
Localized bug, degraded extraction, cosmetic/low-impact issue.

Security/privacy incidents follow a dedicated legal notification assessment.

## 4. Backup and recovery

Requirements:
- automated encrypted database backups;
- object-storage durability appropriate to provider;
- documented restore procedure;
- regular restore drills;
- recovery point/time objectives chosen before public launch;
- backups covered by retention/deletion policy.

A successful backup job is not proof of recoverability; restore must be tested.

## 5. AI/provider outage behavior

If AI is unavailable:
- accept/preserve capture;
- show pending state;
- allow manual essential data where helpful;
- retry safely;
- never discard original evidence;
- do not fabricate placeholder facts.

If policy lookup is unavailable:
- keep item;
- mark deadline unknown/pending;
- allow manual user date;
- retry later.

## 6. Notification outage behavior

Cue scheduler keeps canonical due state independently of push delivery.

If push provider fails:
- record delivery failure;
- retry according to policy;
- show due item in-app;
- avoid duplicate bursts on recovery.

## 7. Support model

V1 channels:
- in-app help/contact;
- support email;
- concise searchable help center.

Support tools should allow authorized staff to inspect account metadata and job state without casually viewing document content.

Sensitive-content access:
- explicit need;
- least privilege;
- auditable;
- preferably user-approved where practical;
- no support agent shared credentials.

## 8. User-facing recovery

Self-service:
- retry processing;
- retake/replace image;
- edit confirmed facts;
- merge duplicates;
- re-link evidence;
- resend invite;
- export;
- delete;
- report wrong deadline/policy;
- report suspicious access.

Design support out of the product whenever safe self-recovery is possible.

## 9. Data correction

When a user corrects a fact:
- keep correction history;
- recompute dependent lifecycle events;
- cancel/reschedule obsolete cues;
- preserve evidence;
- do not silently restore the old AI value later.

## 10. Abuse and safety

Controls:
- file-size/rate limits;
- malware/content validation;
- authentication throttling;
- invite abuse controls;
- API quotas;
- AI prompt-injection defenses;
- report/block flow for future sharing features.

Cuevaro is not a legal, insurance, or warranty adjudicator. Support must not promise eligibility beyond evidence.

## 11. Change management

Production changes:
- reviewed PR;
- automated checks;
- migration plan;
- staged rollout for risky AI/provider changes;
- rollback/forward-fix path;
- release notes for material user behavior changes.

Do not change reminder semantics casually.

## 12. Model/provider changes

Record:
- provider/model;
- prompt/schema version;
- benchmark result;
- cost/latency impact;
- rollout date.

Canary before full deployment where feasible.

## 13. Support KPIs

- median first response;
- resolution time;
- repeat-contact rate;
- top issue themes;
- wrong-deadline reports;
- export/delete support rate;
- captures requiring support per 1,000;
- user-reported reminder misses.

Do not optimize response time at the expense of safe access practices.

## 14. Business continuity

Document:
- owner/admin access recovery;
- domain/DNS ownership;
- app-store account recovery;
- cloud-provider recovery;
- billing-provider recovery;
- secrets rotation;
- incident contacts;
- vendor exit/export paths.

No single personal laptop should be the only copy of production credentials or recovery information.

## 15. Sunset policy

If Cuevaro is ever discontinued:
- give reasonable advance notice;
- keep export available for a defined period;
- explain reminder shutdown date;
- allow evidence download;
- delete data under published retention terms.

Trust includes how a product ends.
