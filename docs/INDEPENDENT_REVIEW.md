# Independent code/security review - 2026-10-05

Read-only independent reviewer examined draft PR #1 at `5c0d52f84ff235e7e0da90f10e762199935cac49`. Five actionable defects plus Host containment and review-copy hardening were found, repaired and inspected again independently:

- Manual fallback on an uploaded capture incorrectly marked a local purchase as server-backed; only actual server confirmation now sets the marker.
- Lost reminder responses left cached versions permanently stale; recovery refreshes matching authoritative state without replaying a stale mutation or assuming the desired outcome.
- An interrupted final worker attempt remained processing forever; expired exhausted jobs now terminalize atomically, while stale completion cannot overwrite the terminal state.
- Plaintext picker/manipulation cache copies remained outside SQLCipher; cleanup now requires durable preservation and verified app-cache descendants, retaining files on save failure and never deleting user-library originals.
- Original observation reasons disappeared on persistence/retrieval; reasons now roundtrip unchanged alongside confidence and provenance.
- Loopback requests reject foreign Host names as well as foreign Origins. Review UI displays confidence buckets and missing/ambiguous date explanations.

Regressions cover manual-fallback reminder controls, lost stop response followed by another valid mutation, exhausted lease/stale completion, foreign Host, original observation roundtrip, safe cache ownership and retention on preservation failure. Independent follow-up found no additional actionable defect in these fixes. This is source/automated-test review; physical native cache/SQLCipher and managed-provider gates remain open.

The same reviewer assessed the isolated upstream forge candidates and reproduced remaining malformed OID acceptance, documented in DEPENDENCY_RISK.md. No review approval is represented as a release or overall CI approval.

## Document-region follow-up - 2026-10-06

Independent review found edge covers and missing corners could produce false Good geometry. Contrast-sensitive edge covers were added, but review then reproduced a narrow receipt with a background-colored cover still passing. The final mitigation leaves all pixel-only completeness unresolved, requiring Questionable/explicit continuation. Reviewer confirmed the exact narrower camouflage regression and the removal of the false-Good claim. Native source and preview pixel budgets were also reviewed. This remains provisional synthetic evidence, not real-camera calibration.

## Provider-default grants - 2026-10-06

Reviewer found no actionable defect in the scoped forward permission migration and actual before/after TRUNCATE regression. It preserves authenticated tenant reads and the household RPC, changes no stored rows, and leaves unrelated tables/service-role grants untouched. A regression asserts the latter scope boundaries. Live Supabase/storage ACLs, custom inherited roles and column-specific grants remain external verification limits; this is not universal backend privilege closure.

## Embedded-text PDF review - 2026-10-06

Reviewer found no actionable parser-execution or authority-bypass defect in the bounded data-only child process, minimal environment, conservative conflicts and original-retaining failure paths. It requested a visible warning before continuation because embedded text can be hidden/differ from visible evidence; the warning is now rendered and browser-tested, with an actual invisible-text regression remaining low-confidence/Questionable. OS-level memory isolation, adversarial corpus and native viewing remain unverified.

## Alternate receipt format review - 2026-10-06

Reviewer found named/year-first/unambiguous numeric dates deterministic and conservative, then reproduced valid totals masking unsupported competing monetary labels. The repair recognizes monetary labels before validation, keeps total/currency Unknown on malformed/unsupported/schema-invalid evidence, and propagates it across PDF pages with contributing provenance. Regressions cover same-page and cross-page malformed grouping, ambiguous currency symbols and oversized totals. Independent follow-up confirmed the repair; no further actionable defect found in that scope.

## Multi-page photo review - 2026-10-06

Reviewer found three defects: assembly changed the root hash and broke first-original deduplication; whole-bundle authorization permitted later pages after revocation during the first; and a sealed/uploaded standalone capture could be rebound into another receipt. Repairs compare retained original hashes, authorize before each extraction and reject sealed/server-backed/drafted attachment candidates. Browser reimport-after-confirmation, integration revocation-after-page-one and negative candidate regressions cover the repairs. Independent follow-up confirmed all three and found no further consequential defect. Review also assessed atomic writes, ordered manifests, source binding and retained replacements. This is read-only source review, not live-provider or physical-native acceptance.

## Synthetic evaluation and legacy migration review - 2026-10-06

No actionable defect found. Review confirmed real quality/OCR execution, visible skips/wrong candidates and conservative Unknown checks. Zero high-confidence errors is the enforced confidence-cap regression, not statistical calibration; the duplicate evaluation measures hashes/OCR rather than storage deduplication. Migration coverage is reconstructed in-memory legacy schema with exact original preservation, constraints and tenant reads, not live provider/restore evidence.

## Multi-item review - 2026-10-06

No active client authorization bypass found. Confirmation binds reviewed candidate IDs/names and actual source evidence, including lost-response matching. Reviewer found same-household cross-purchase item/supersedes links permitted by the initial migration. Repair binds item assertions to purchase/household, supersedes to purchase/field/item scope and enforces one successor; cross-purchase and cross-field regressions pass. Independent follow-up confirmed the repair and found no further issue. Managed migration and physical native acceptance remain open.

## Correction/history review - 2026-10-06

Reviewer reproduced loss of dismissal/snooze after deadline -> Unknown -> restoration. Durable versioned cue intent now survives cancellation and is selected per reminder offset; domain and PostgreSQL regressions cover the repair. Stop remains preserved. Follow-up confirmed the repair and transactional response snapshots with no remaining actionable defect. Read-only review does not establish native or managed-provider acceptance.

## Private export/restore review - 2026-10-06

Initial inner join could omit a missing page byte row and still export the remainder. Repaired with a left join/missing-byte refusal, full ordered capture-hash verification and contiguous pages. Partial loss/changed-manifest regressions cover it; follow-up found no further actionable defect. Tenant scoping, snapshots, UUID filenames, exclusive files and separate byte verification were assessed. Restore evidence is actual local PGlite dump/load, not managed-provider recovery.

## Device archive review - 2026-10-06

No actionable security/integrity issue found. Review confirmed byte/order hashes, safe ZIP names, queued-edit refusal, explicit plaintext warning, request-only events, scoped cleanup and restart discovery. Added actual multi-page/replaced-first-page archive coverage after review identified that evidence limit. Native sharing remains mocked and requires physical device/file-provider validation.

## Keyboard/error/native preparation review - 2026-10-07

Read-only independent review found no consequential regression. Invalid correction validation returns before durable queue or transport; error association/hint/assertive feedback are explicit. Required semantic outcomes prevent silent quality-blocked skips. Stable module-scope ActionButton fixes remount-caused focus loss while context retains current busy and theme behavior; the browser regression asserts retained focus after activation. Focus styling changes presentation only. Native focus, automatic theme, VoiceOver/TalkBack and OS text scaling remain hardware-unverified. Reviewer did not duplicate the running suite or edit files.

## Managed adapter and migration artifact review - 2026-10-08

Read-only local review found no consequential defect. Path guards match existing household/capture/original and page paths, reject tenant/page/traversal mismatches and preserve immutable uploads. Frozen WeakMap identity and fresh token/membership checks before storage and after metadata cover modeled revocation. All normalized source and bundle SHA256 values match; all seven migrations are included modulo removed transaction wrappers. Bundle depends on the parent atomic apply_migration transaction. Role checks rollback on success; failures require rollback/connection close. No reviewer remote writes or duplicate suite. Actual StorageAPI, bearer expiry/revocation after issue and managed backup remain open.

Probe review reproduced an evidence defect: network/server errors and empty batch results could count as successful access denial. Repair requires expected Auth401/403, PostgREST42501 or Storage403/404; other/empty responses classify inconclusive. Added regression; follow-up found no remaining consequential defect. No successful real API acceptance is claimed.

## Process-only runtime/fixture review - 2026-10-08

Read-only reviewer identified that ReadProbe bypassed runtime key-role validation, potentially transmitting a misplaced privileged key before failing anonymous-denial checks. A shared requireManagedPublishableKey guard now rejects that swap before any client/API request; regression covers modern secret and legacy service-role/authenticated values. Review found constrained SQL interpolation, finally restoration of process inputs and explicit separation of matching local bytes from actual Storage readback provenance. No reviewer managed calls or writes.


## Managed application wiring checkpoint - 2026-10-08

Existing capture/review/correction/Stop/retrieval commands now share a bounded PostgreSQL transaction interface and genuine Supabase SDK adapters. Original uploads are immutable, download/hash-checked before acknowledgement and use stable identifiers across rollback/lost acknowledgements. Worker publication revalidates actual Auth identity, household membership, the complete ordered page manifest and its unexpired claim after OCR. Unknown quality and missing/corrupt pages fail closed. This is local integration evidence with injected synthetic HTTP transport and real local OCR, not live managed API acceptance.

The separate forward migration `20261008030442_managed_review_drafts.sql` adds a household-bound private review table with RLS and no client grants. It is **unapplied**; parent remains sole managed-write coordinator. Original reviewed baseline/history mapping is unchanged. Explicit managed API/worker entry points are loopback-only, process-configured, synthetic-mutation-only and refuse a missing schema prerequisite. They were not started against the managed project. Owner-operated masked launcher modes are prepared; configuration never makes health an acceptance claim.

Local verification: **114 tests passed, one real PostgreSQL17 CI-only test explicitly skipped**, strict typecheck/source scan/formatting passed. Disposable PostgreSQL17 CI now exercises checked-out node-pg connections, rollback, SKIP LOCKED, concurrent claim ownership and retained Stop/correction history; its result requires exact-head CI. Independent review repaired post-OCR Auth revocation and partial-page omission, with negative regressions. Five synthetic Auth identities are Owner-approved; their passwords must be entered/submitted by Owner. The official Users form defaults Auto confirm on, which remains outside the instruction forbidding verification bypass; no accounts, passwords or project Auth settings were changed here.

Actual Auth login, Storage upload/readback/expiry, native mobile private connectivity, managed restore, hosting/durable notifications and dependency release gates remain open. Automatic approval review rejected live API/worker startup before credential handoff; no startup occurred. No phase, release, merge or deployment is claimed.


### PostgreSQL17 CI correction evidence - 2026-10-08

At `ce50a3d1288fb44835336874d5b152f83cb67417`, [CI37724288431](https://github.com/wasenotsok/Cuevaro/actions/runs/37724288431) passed the check and formatting steps, including the real disposable PostgreSQL17 test. The first run exposed an incorrect new assertion (`completed` instead of documented Stop state `not_applicable`); the assertion was repaired without changing product behavior. This establishes real node-pg rollback, SKIP LOCKED and concurrent claim behavior in an isolated fixture, not managed Auth/Storage acceptance. Exports/browser steps were still running when this note was recorded; their result requires explicit verification. The migration manifest now hashes canonical committed UTF-8/LF Git content, avoiding Windows CRLF mismatch; body SHA256380c244a80f4650556d1bd8532da702ad67acbdd52dd7888322a4479c14c584f. No migration was applied here.
