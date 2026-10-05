# Cuevaro Security, Privacy, and Compliance Baseline

Status: Mandatory product baseline, not optional hardening  
Scope: consumer launch plus foundations for later household/business use  
Important: this document defines engineering/product requirements. It is not legal advice. Counsel and jurisdiction-specific review are required before commercial launch.

## 1. Trust model

Cuevaro may eventually hold:
- receipts and purchase history,
- home addresses in invoices,
- product serial numbers,
- family membership,
- insurance or registration documents,
- identity documents,
- school/family records,
- contracts,
- financial-adjacent evidence,
- other sensitive personal information.

The product therefore has to behave like a trusted repository even when V1 begins with lower-sensitivity purchase records.

Security cannot be retrofitted after users upload identity or family documents.

## 2. Privacy principles

Cuevaro should adopt these default principles:

1. **Purpose limitation**  
   Collect/process data only to provide the user's requested administration function.

2. **Data minimization**  
   Do not collect full documents or extracted fields when a less sensitive representation is sufficient.

3. **User ownership and portability**  
   Users can export their records/evidence and leave.

4. **No sale of personal data**  
   Business model should not depend on selling household/purchase information.

5. **No unrelated advertising profiling**  
   Do not turn receipts into ad-targeting profiles.

6. **Transparent AI processing**  
   Explain when content leaves the device for AI/cloud processing.

7. **Retention by purpose**  
   Evidence and derived data follow explicit retention/deletion rules.

8. **Least privilege**  
   Access is scoped to household/object/action and role.

9. **Safe defaults**  
   Sensitive notification previews, sharing, public links and integrations should be conservative by default.

10. **Evidence integrity**  
    Preserve original evidence separately from AI/user-derived structured facts.

## 3. Regulatory baseline

### Philippines

Cuevaro must be designed to support obligations under the Philippine Data Privacy Act of 2012 (RA 10173) and current National Privacy Commission rules/guidance.

Before Philippine commercial operation, confirm:
- whether Cuevaro's personal information processing system must be registered with the NPC,
- Data Protection Officer requirements,
- Privacy Impact Assessment obligations,
- privacy management program,
- data-processing records,
- security measures,
- breach response/notification,
- data-subject request process,
- cross-border processing arrangements,
- vendor/data-processing agreements.

Data-subject capabilities should support:
- information/transparency,
- access,
- correction,
- objection where applicable,
- erasure/blocking where applicable,
- portability where applicable.

### EU/EEA

If Cuevaro offers service to or monitors people subject to GDPR, support:
- lawful basis analysis,
- transparency,
- data minimization,
- purpose limitation,
- storage limitation,
- data-subject rights,
- processor/controller contracts,
- international transfer controls,
- DPIA where required,
- privacy by design/default,
- breach processes.

Do not claim GDPR compliance solely because encryption or deletion exists.

### Other regions

Commercial expansion requires explicit review for:
- California/US state privacy laws,
- children's/minors' privacy if family/school modules expand,
- consumer protection,
- electronic communications,
- subscription renewal laws,
- records retention,
- data localization where relevant.

Launch regions should be intentionally limited until reviewed.

## 4. Data classification

### Class 0 - Public/product metadata
Examples:
- generic product model,
- public retailer policy URL,
- public manual URL.

### Class 1 - Account/internal
Examples:
- user ID,
- app preferences,
- device token,
- feature flags.

### Class 2 - Personal
Examples:
- name,
- email,
- household relationship,
- purchase history,
- merchant records,
- notes.

### Class 3 - Sensitive/high-impact
Examples:
- identity documents,
- government IDs,
- health-related documents,
- children's records,
- financial account information if ever supported,
- legal contracts containing sensitive data.

### Class 4 - Secrets/security credentials
Examples:
- auth secrets,
- recovery codes,
- API keys,
- encryption keys.

Rules:
- class 4 must never be exposed to normal application logs,
- class 3 requires stricter access, audit and processing review,
- V1 should avoid collecting unnecessary class 3 data.

## 5. Authentication

Requirements:
- standards-based managed authentication where possible,
- email verification,
- secure password policy if passwords are used,
- passkeys support as a desirable roadmap target,
- MFA support before higher-sensitivity modules,
- session expiration/revocation,
- refresh-token rotation/provider best practices,
- device/session list and revoke capability,
- brute-force/rate protections,
- account-recovery abuse protections.

Do not implement custom password cryptography.

## 6. Authorization

Authorization is server enforced.

Core model:
- user,
- household,
- membership,
- object/evidence ownership,
- explicit share grants,
- role.

Use database row-level access control where supported, but do not rely on UI hiding.

Test:
- IDOR/BOLA attempts,
- cross-household access,
- stale revoked shares,
- deleted household membership,
- export endpoints,
- signed media URLs,
- background jobs operating under wrong tenant.

Every high-value data query should have a clear tenant/owner predicate.

## 7. Storage security

### Object storage
- private buckets only for user evidence,
- short-lived signed access URLs,
- no guessable public media paths,
- server-side encryption at rest,
- separate thumbnails/previews if needed,
- malware/file-type validation,
- file size/page limits,
- safe image/PDF processing libraries,
- metadata stripping where useful.

### Database
- encrypted managed storage,
- TLS in transit,
- backups encrypted,
- least-privilege database credentials,
- schema migrations audited,
- no production DB accessible broadly from internet without provider controls.

### Device
- use platform secure storage for tokens/keys,
- protect cached sensitive files,
- respect OS backup behavior,
- remove abandoned capture temp files,
- do not persist raw AI prompts with sensitive content unless required and disclosed.

## 8. Encryption strategy

Baseline:
- TLS for network traffic,
- provider encryption at rest,
- application-managed protections for especially sensitive future classes where threat model justifies it,
- secrets stored in managed secret systems, never source control.

Do not advertise "end-to-end encrypted" unless the architecture truly prevents the service from accessing plaintext. Server-side AI extraction is incompatible with a simplistic E2E claim unless decryption/processing boundaries are carefully designed.

Future privacy mode may support on-device extraction for selected documents, but this is a separate architecture and should not be falsely promised in V1.

## 9. AI privacy

AI calls must follow a provider-reviewed data path.

Requirements:
- send only data needed for the current extraction/action,
- avoid account/profile metadata in prompts unless necessary,
- separate user content from telemetry,
- use provider settings/contracts appropriate to commercial confidential data,
- disable model training on customer data by default where provider capability/terms allow,
- understand provider retention behavior and zero-data-retention eligibility,
- do not store full request/response bodies in general logs,
- redact/tokenize where feasible,
- track model/provider used for each extraction for audit/debugging.

Cuevaro should support provider substitution. A commercial product cannot assume one AI vendor's privacy terms will never change.

## 10. Prompt injection and untrusted documents

Receipts, PDFs, emails and web pages are untrusted input.

Rules:
- document text never becomes system/developer policy,
- extraction prompts explicitly treat embedded instructions as data,
- web policy content cannot invoke tools,
- external URLs are not automatically followed beyond allowlisted/safe fetch logic,
- no arbitrary code or scripts from documents,
- generated action messages are drafts until user approval when consequential,
- never expose internal prompts or secrets to document content.

Add adversarial documents to AI evaluation.

## 11. External policy lookup safety

Policy intelligence can affect money and decisions.

For each policy claim:
- store source URL/domain,
- retrieval/check time,
- region/jurisdiction,
- quoted/structured supporting fragment internally where copyright/terms permit,
- policy version/effective date if discoverable,
- confidence,
- conflicts,
- expiration/recheck schedule.

Do not use search snippets alone as authoritative truth for high-consequence claims.

Retailer terms of service/robots/legal restrictions must be respected. Prefer official retailer/manufacturer sources and documented APIs.

## 12. Logging and observability

Log:
- request ID,
- authenticated actor ID (pseudonymous internal ID),
- operation,
- resource class/ID,
- result,
- latency,
- error code,
- security event metadata.

Do not log by default:
- receipt text,
- document contents,
- full names/addresses,
- access tokens,
- payment credentials,
- signed URLs,
- AI prompts containing raw user evidence.

Audit logs for sensitive actions:
- share created/revoked,
- member invited/removed,
- export,
- account deletion request,
- evidence deletion,
- sensitive record view if needed by threat model,
- admin/support access,
- policy override,
- security setting changes.

## 13. Admin/support access

Human support must not have universal casual document access.

Implement:
- role-based support permissions,
- just-in-time/elevated access if required,
- reason/ticket association,
- audit trail,
- automatic expiry,
- customer-visible disclosure where practical,
- strict prohibition on browsing user content without support need/authorization.

Production admin tools require MFA.

## 14. Data lifecycle and deletion

For every data class define:
- creation source,
- purpose,
- retention,
- user deletion behavior,
- backup retention,
- derived-data cascade,
- legal/security exceptions.

Account deletion:
1. authenticate/reconfirm,
2. explain immediate effects,
3. revoke sessions/shares,
4. queue deletion,
5. erase active primary data,
6. handle backups per documented retention,
7. retain only legally/security-required minimal records,
8. provide completion status.

Deleting original evidence should offer a clear choice where derived facts remain:
- delete evidence only,
- delete evidence plus derived record,
subject to product/legal constraints.

## 15. Export and portability

A user should be able to export:
- original evidence,
- structured facts,
- lifecycle records,
- cue/action history,
- household/share metadata where appropriate.

Formats:
- ZIP for evidence,
- JSON/CSV for structured data,
- human-readable summary/PDF where useful.

No proprietary lock-in should be necessary to retrieve one's own evidence.

## 16. Backups and disaster recovery

Requirements:
- automated encrypted database backups,
- object-storage durability/redundancy appropriate to provider,
- tested restore procedure,
- documented RPO/RTO targets before production,
- backup access separated from normal app role,
- restore drills,
- deletion semantics documented for backups,
- configuration/infrastructure reproducibility.

V1 commercial target proposal:
- RPO <= 24 hours initially, improve as usage/value grows,
- RTO <= 24 hours initially,
- higher service tiers may eventually require tighter targets.

Do not advertise numbers until verified operationally.

## 17. Secure SDLC

Adopt:
- protected main branch,
- code review,
- automated unit/integration tests,
- dependency lockfiles,
- secret scanning,
- dependency vulnerability scanning,
- SAST where useful,
- mobile/web security testing,
- reproducible builds where feasible,
- signed release artifacts/store distribution,
- environment separation,
- least-privilege CI credentials,
- change log and rollback plan.

Use OWASP ASVS as a web/backend verification reference and OWASP MASVS for mobile security coverage.

## 18. Threat model

At minimum model:

### Threat actors
- opportunistic attacker,
- credential stuffer,
- malicious household member,
- abusive ex-partner/former member,
- malicious uploaded document,
- compromised third-party SDK,
- compromised support account,
- supply-chain dependency,
- insider with excessive privilege.

### Assets
- original evidence,
- personal identity,
- household relationships,
- purchase/location patterns,
- auth sessions,
- encryption/secrets,
- policy/action state.

### Threats
- account takeover,
- cross-tenant data exposure,
- public object URL leak,
- unauthorized household sharing,
- AI prompt injection,
- malicious file parsing,
- notification privacy leak,
- insecure backups,
- forgotten/deleted data retained forever,
- third-party SDK collection,
- inaccurate high-consequence AI output.

Threat model must be reviewed before each new sensitive domain.

## 19. Mobile/app-store privacy

Apple:
- maintain accurate App Privacy disclosures,
- maintain required privacy manifests/SDK declarations,
- verify third-party SDK data collection,
- explain permission purpose strings,
- request camera/photos/notifications only in context.

Google Play:
- maintain accurate Data Safety disclosures,
- encrypt sensitive data in transit,
- provide account deletion where required,
- comply with user-data and permission policies,
- review every analytics/ads SDK.

Avoid advertising SDKs in early Cuevaro. The privacy cost is not worth it for the proposed business model.

## 20. Children and family data

V1 should not intentionally target children.

If Family/School later stores children's data:
- adult account controls the data,
- minimize child identifiers,
- assess COPPA and other child-privacy obligations by launch region,
- avoid behavioral profiling,
- define retention,
- use conservative sharing,
- conduct a dedicated privacy impact assessment.

Do not launch school/children workflows by casually extending receipt schemas.

## 21. Payment security

Use app-store billing for native digital subscriptions where required by platform rules. For eligible web commerce use a compliant payment processor/Merchant-of-Record strategy.

Cuevaro should not store raw payment-card data.

Billing records should be isolated from evidence content as much as practical.

## 22. Incident response

Maintain:
- severity levels,
- on-call/escalation path,
- containment procedures,
- credential/key rotation,
- evidence preservation,
- user communication templates,
- regulator notification decision tree,
- post-incident review,
- corrective action tracking.

Security contact/reporting channel should be public.

A `SECURITY.md` should define responsible vulnerability reporting once repository/product becomes public or testers are external.

## 23. Privacy impact review triggers

Require a fresh privacy/security review before:
- identity documents,
- health documents,
- child/school data,
- email inbox connection,
- automatic purchase-email ingestion,
- government integrations,
- bank/payment-account ingestion,
- automatic external action execution,
- location tracking,
- biometric features,
- training/learning on customer content,
- advertising/marketing profile integrations,
- cross-border storage region changes.

## 24. Abuse and misuse

Potential abuse:
- storing documents belonging to others without permission,
- stalking/monitoring a household member,
- fraudulent warranty/insurance evidence packs,
- forged/altered receipts,
- mass scraping of retailer policies,
- using shared access after relationship changes.

Controls:
- household access visibility/revocation,
- no guarantee of document authenticity,
- preserve original evidence and edits,
- abuse reporting,
- rate limits,
- suspicious sharing/action monitoring proportional to risk,
- terms prohibiting fraud and unauthorized access.

Cuevaro should assist organization, not certify truth it cannot independently verify.

## 25. Compliance artifacts required before commercial launch

- Privacy Policy
- Terms of Service
- Data Processing Addendum for business customers if applicable
- Subprocessor list
- Retention schedule
- Data map
- Privacy Impact Assessment
- Threat model
- Incident Response Plan
- Breach notification procedure
- Security policy baseline
- Access-control matrix
- Data-subject request procedure
- Cookie/tracking disclosure for web
- App-store privacy/data-safety declarations
- Vendor security/privacy reviews
- Business continuity/backup restore runbook
- Vulnerability disclosure policy
- NPC registration/DPO records if applicable

## 26. Security launch gates

No public commercial launch until:
- cross-tenant authorization tests pass,
- evidence buckets are private,
- signed URL expiry tested,
- account deletion and export tested,
- restore procedure tested,
- production secrets removed from code/CI logs,
- security headers/API controls tested,
- mobile secure-storage behavior reviewed,
- high-risk AI prompt-injection eval passes threshold,
- sensitive content absent from standard logs,
- third-party SDK inventory complete,
- privacy policy matches actual behavior,
- app-store disclosures match actual behavior,
- critical/high dependency vulnerabilities resolved or formally accepted with mitigation,
- incident-response owner and process assigned.

## 27. Security success metric

Security is not "zero reported incidents."

Track:
- auth/authorization test coverage,
- security defects by severity/time-to-fix,
- restore drill success,
- privacy-request completion time,
- revoked-share propagation time,
- SDK/data-flow inventory accuracy,
- AI high-consequence false-confidence rate,
- support-access audit exceptions,
- incident detection/containment times when applicable.

The product earns trust through verifiable controls and honest boundaries, not security slogans.