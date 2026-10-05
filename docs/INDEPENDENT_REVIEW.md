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
