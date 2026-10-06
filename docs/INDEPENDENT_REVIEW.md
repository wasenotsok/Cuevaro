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
