# Development verification — 2026-10-05

All named canonical project documents were read before subsystem implementation. Baseline checkout: `33b2b6864817720ce7f720d4f2057bc28ce2f74a`; branch `feat/mobile-foundation`. Tests use generated, non-sensitive receipts and fixture identities.

## Completed local checks

Remote evidence: [draft PR #1](https://github.com/wasenotsok/Cuevaro/pull/1), candidate `b475c5fcaf9ec3268c85aded3726b9f385f67607`, [Linux workflow 37331727837](https://github.com/wasenotsok/Cuevaro/actions/runs/37331727837). All verification steps passed (typechecking/tests, formatting, Android/iOS/web export and Chromium browser journeys). The separate dependency job failed with 28 high findings propagated from the two documented advisories. Overall CI is therefore not green. Subsequent status-only commits do not change this tested implementation.

Separately, the final pre-review head `5c0d52f84ff235e7e0da90f10e762199935cac49` completed [exact-head PR workflow 37332080788](https://github.com/wasenotsok/Cuevaro/actions/runs/37332080788): `verify` passed and `dependency-gate` failed. This is distinct from the prior implementation checkpoint. Subsequent [independent review fixes](INDEPENDENT_REVIEW.md) passed 31 unit/integration tests, five browser journeys, formatting and three-platform exports locally; new-head CI results are checked before final handoff. Neither historical run validates later code changes by itself.

- `npm run check`: strict TypeScript, 31 unit/integration tests and source secret-pattern scan. Includes actual PostgreSQL RLS, forged managed-actor refusal, revoked/wrong-household/viewer denial, immutable evidence, duplicate hashes, idempotency, explicit review, invalid/ambiguous dates, Unknown policies, deterministic cues, optimistic reminder controls and restart recovery.
- Actual bundled Tesseract OCR recognizes the generated receipt image; integration confirms facts into relational purchase/item/evidence/observation/assertion/lifecycle/cue rows and retrieves them through the API. Provider output is schema/evidence-bound before persistence. An injectable extractor in recovery tests is explicitly a test double; the real-OCR integration is separate.
- `npm run build:mobile`: Android and iOS Hermes plus web bundle export. This is not an Android/iOS binary build or hardware run.
- `npm run test:e2e`: five browser tests: mobile 390×844 journey through quality warning → actual local OCR → contextual confirmations → lost-response recovery → saved lifecycle → original image → retrieval after reload → stopped return reminders; server-acknowledged capture followed by manual fallback with local reminder controls; lost reminder response recovery; bad-image retention/refusal; failed upload/restart/reconnect; desktop keyboard/viewport smoke check. Browser emulation is not physical-camera or VoiceOver/TalkBack proof.
- Degraded synthetic pixels exercise blur, glare, low light, cut-off, thermal fade, skew, small text and occlusion. The regression report is `.local/quality-benchmark.json`; generated PNGs live under `.local/quality-fixtures/`. These are not a representative calibrated benchmark. Specific geometry/occlusion/glare-region diagnosis remains incomplete. Real images without verified edge signals are Questionable, requiring conscious override.

## Defects found and repaired

1. Expo peer hoisting selected incompatible React Native; exact SDK alignment restored web/native bundling.
2. SQLite native imports entered web bundling; platform-specific storage adapters now isolate browser preview from native SQLCipher.
3. Canonical server capture IDs broke local original retrieval; local cache preserves both server and device capture IDs.
4. A lost confirmation response could leave the client unable to recover a server-created purchase; retries recover only an existing record with exactly matching reviewed values.
5. Worker authorization could change during extraction; membership is revalidated and locked at commit, with lease generation checks preventing stale workers from committing.
6. User corrections risked replacing source observations; confirmed fact authority is now separate from the unchanged observation.
7. Managed storage adapter methods could receive caller-declared actor objects; only actors minted by the adapter's managed identity path can reach them, with fresh identity/membership revalidation.
8. Image normalization could enlarge small evidence and hide resolution problems; preflight never upscales the source.

## Open acceptance gates

Phase 1 remains open: configured managed auth/private storage, actual signed URL/managed isolation tests, approved private staging, and real Android/iOS secure-storage/camera tests. Native automatic extraction/cloud sync is not connected; browser local OCR is a developer harness, not ordinary production mobile use.

Other incomplete slice/V1 capabilities: broad/unlabeled and multi-item receipt extraction, PDF OCR, share-sheet/barcode, calibrated geometry/occlusion detection, production AI privacy path, push/background delivery, source-edit rescheduling workflow, action packs, full localization/text scaling/screen readers, export/delete/restore, and commercial/security/legal gates. No real personal documents or external users were used.

Dependency audit currently reports high findings propagated through Expo/Metro tooling from two primary advisories: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). At inspection the registry's latest versions were 3.0.3 and 1.4.0 and the advisories listed no patch. The CI dependency job must remain failing until remediation or separately authorized risk acceptance; development verification passing is not a release pass.

The [dependency investigation](DEPENDENCY_RISK.md) records exact paths, exploit conditions, implemented API isolation/localhost containment, zero findings in the selected API runtime audit, and concrete upstream/backport alternatives. This isolation reduces exposure and is not a mobile-toolchain waiver.

## Alternate labeled receipt checkpoint - 2026-10-06

Version `receipt-text-v3` supports explicit Seller/Sold by/Product/Amount due labels, peso-symbol currency, named English dates, year-first dates and numeric dates with only one valid month/day interpretation. Future/invalid purchase dates, contradictory or ambiguous dates, unlabeled headers, relative policy durations and unsupported monetary formats remain Unknown. Equivalent repeated dates are accepted; original excerpts remain unchanged. Independent review caught valid monetary candidates hiding malformed/unsupported competing labels; both total/currency now remain Unknown in those cases, including across PDF pages with contributing page/excerpt provenance.

The expanded suite includes actual Tesseract OCR over two generated alternate layouts, exact normalized facts/raw evidence association, ambiguous/invalid/date-format cases and valid-plus-invalid monetary conflicts on one page and across PDFs. The new mobile journey shows normalized deadlines alongside original named-month text, explicit confirmations and the saved lifecycle. Its 390px review screenshot was visually inspected: readable source excerpts, low confidence and explicit Keep unknown/confirm actions. This remains limited labeled support, not representative merchant calibration, unlabeled inference or multi-item extraction. Fixtures/report are ignored under `.local/receipt-layouts/`.

Final local results for this checkpoint: 58 tests across ten files, nine browser journeys, strict typechecking/source scan, formatting and Android/iOS/web bundle exports passed. No native hardware or managed-provider result is inferred from these checks. The prior PDF head `49a61e07d7822f97359735ae77a4aa674aeef3ce` passed [exact PR CI 37449088755](https://github.com/wasenotsok/Cuevaro/actions/runs/37449088755) implementation verification; dependency gate failed. Later parser changes require their own exact-head CI.

## Embedded-text PDF checkpoint - 2026-10-06

Actual Mozilla PDF.js parsing is isolated in a minimal-environment child process, with 20 MB input, ten-page, 100,000-character, 15-second, 192 MB V8-heap and bounded-output limits. These are containment, not a total-memory/OS sandbox guarantee. No rendering, annotation/JavaScript actions or document URLs are invoked; eval/XFA/WASM/fetch are disabled. Original PDFs are stored before parsing. Supported labeled text becomes low-confidence candidates with page provenance; conflicting labels within/across pages remain Unknown. Password/corruption/page/text-limit and no-text failures retain originals and terminalize jobs without futile retry loops. Scanned-PDF OCR/native original viewing remain unsupported.

39 unit/integration tests passed across nine files, including actual text parsing, two-page lifecycle facts and provenance persistence, cross-page/same-page conflicts, hidden-text uncertainty, unsupported-original retention, password/corrupt/page/text/size/time limits. Eight browser journeys passed, adding mobile PDF review → confirmation → reload/search → byte-exact original PDF download, and unsupported input → honest manual fallback → reload retention. Android/iOS/web bundle exports passed. Review/unsupported screenshots were visually inspected for readable wrapping, confidence/page visibility and explicit consequential confirmations; native hardware remains unverified. A visible pre-processing warning states embedded text may be hidden/differ from visible content.

Official integration reference: [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html). PDF fixtures are generated ASCII files with real cross-reference tables, no real personal evidence. Parser behavior is versioned `receipt-text-v2` for the conflict fix; historic observations retain their version. Selected API runtime audit remains zero; the latest full audit reports 16 propagated high findings from the same two unresolved advisories. The earlier 28 count is historical, not evidence of upstream remediation.

## Document-region checkpoint - 2026-10-06

Shared bounded native/server preflight segments light paper on contrasting backgrounds, measures skew/perspective and detects visible cut-off, large obstruction and interior washout. Generated fixtures include full paper, cut-off, skew, trapezoid, brown interior/edge covers, bright washout, blank paper, missing corner and background-colored covers at two aspect ratios. Reports/images are ignored under `.local/document-preflight/`; they are synthetic regressions, not a representative benchmark. Independent review demonstrated a camouflaged bottom cover could pass geometry; pixel-only edges now remain unverified, so no automatic OCR starts before conscious continuation. A visible rectangle never proves semantic completeness. Native sources reject >20 MP before manipulation and both previews are bounded to 900x1600 without enlargement.

New browser coverage checks actionable Bad advice without bypass, 320px dark-mode layout without horizontal overflow, and a clean-looking receipt requiring explicit continuation before actual OCR. Visual screenshots are local artifacts, not physical-device acceptance. This checkpoint does not inherit historical CI; exact new-head results must be checked separately.

Local results: 32 unit/integration tests, six browser tests, strict typechecking/source scan and Android/iOS/web bundle exports passed. The 320px dark-mode cut-off, obstruction and post-continuation review screenshots were visually inspected: readable wrapping, accessible explicit retake controls, no horizontal overflow. Browser screenshots cannot validate native camera or screen-reader behavior.

Subsequent provider-default ACL regression brings the suite to 33 tests across eight files. It models broad client default grants, successfully reproduces RLS-bypassing TRUNCATE in a rolled-back empty synthetic transaction, applies the scoped forward migration, verifies six prohibited privileges across both client roles and thirteen tables, and retains authenticated household creation/tenant reads. Anonymous RPC/read and actual authenticated TRUNCATE then fail. This is real embedded PostgreSQL execution, not proof of live Supabase configuration.

## Multi-page photo checkpoint - 2026-10-06

Up to ten distinct photos/20 MB total are preserved separately and assembled with an ordered manifest. Per-page quality is visible; any Bad page blocks extraction. Replacing a page retains the earlier original. A sealed manifest survives upload failure/lost acknowledgement and restart; uploaded/drafted originals cannot be rebound into another receipt. Real local Tesseract processes each photo sequentially, authorizing before every page and before commit. Candidates retain actual evidence IDs/page/excerpts; cross-page contradictory dates or malformed amounts remain Unknown. One confirmation creates one purchase/lifecycle.

Local unit/integration verification: 64 tests across eleven files and all eleven browser journeys passed, including real two-page OCR and byte-exact database originals, idempotency/order conflicts, bounds/duplicates, foreign evidence refusal, cross-page uncertainty and revocation after page one (only one extractor call; no draft; both originals retained). Strict typechecking, source-pattern scan, formatting and Android/iOS/web bundle export passed. Browser verification covers bad-page replacement, lost upload acknowledgement/restart, original reimport after confirmation and injected synchronous atomic storage failure. The 390px original-view screenshot was visually inspected: clear retained-original controls and readable evidence. Native SQLCipher transactions, physical capture, representative calibration and live migration 004 remain unverified. This does not close a phase or release gate.

Exact multi-page head `52b04df3b252a9159734bfb09e72de2b8a1d18e5` completed [PR CI 37453551626](https://github.com/wasenotsok/Cuevaro/actions/runs/37453551626): implementation verification passed, including Linux Chromium journeys; dependency gate failed. Later changes require their own head verification.

## Synthetic extraction evaluation and legacy upgrade - 2026-10-06

`tests/extraction-benchmark.test.ts` generates eleven versioned synthetic cases: crisp/duplicate, blur, glare, low light, cut-off, faded thermal, skew, small text, missing deadlines and ambiguous date. It executes shared quality preflight then genuine Tesseract only for explicitly continued Questionable input; Bad cases are reported as skipped rather than hidden from the denominator. The report includes immutable hashes, per-field expected/actual values, normalized matches, wrong candidates, correct Unknowns, missed candidates and local elapsed time. Generated images/report are ignored under `.local/extraction-benchmark-v1/` and can be reproduced from committed test source.

Observed Windows run: six extracted and five quality-blocked; crisp/duplicate matched seven fields each. Missing deadlines and ambiguous dates stayed Unknown. Glare produced one wrong low-confidence merchant (`Sunthatic Annliances`) and six Unknown fields; cut-off produced seven Unknown fields. These defects are visible in the report, not counted as correct extraction. Zero high-confidence mismatches verifies the enforced Questionable confidence cap, not statistical calibration. Duplicate identity/OCR determinism here is separate from the storage idempotency tests. This corpus is generated labeled text, not representative merchant/camera coverage, and cannot close benchmark acceptance.

An additional in-memory legacy-schema regression reconstructs pre-004 ordering, applies the actual forward migration and preserves original ID/hash/bytes exactly. Duplicate/out-of-range page positions fail and own/foreign tenant reads remain isolated. This is not a live Supabase upgrade/backup/restore test. The expanded local suite passed 66 tests across twelve files, strict typechecking/source scan and formatting. App runtime is unchanged from the previously verified multi-page bundle and eleven browser journeys. Independent read-only review found no actionable defect and confirmed these evidence limits.

## Reproduction

`npm ci && npm run check && npm run build:mobile`

On Windows with Edge installed, `npm run test:e2e` uses headless Edge. CI installs bundled Chromium. The tests start their own ephemeral loopback API on 4329 and static preview on 4187, then clean up their servers. Ordinary development API uses `.local/database`; a restart preserves jobs/originals. Do not place real documents there.
