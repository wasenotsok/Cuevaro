# Development verification — 2026-10-05

All named canonical project documents were read before subsystem implementation. Baseline checkout: `33b2b6864817720ce7f720d4f2057bc28ce2f74a`; branch `feat/mobile-foundation`. Tests use generated, non-sensitive receipts and fixture identities.

## Completed local checks

Remote evidence: [draft PR #1](https://github.com/wasenotsok/Cuevaro/pull/1), candidate `b475c5fcaf9ec3268c85aded3726b9f385f67607`, [Linux workflow 37331727837](https://github.com/wasenotsok/Cuevaro/actions/runs/37331727837). All verification steps passed (typechecking/tests, formatting, Android/iOS/web export and Chromium browser journeys). The separate dependency job failed with 28 high findings propagated from the two documented advisories. Overall CI is therefore not green. Subsequent status-only commits do not change this tested implementation.

- `npm run check`: strict TypeScript, 29 unit/integration tests and source secret-pattern scan. Includes actual PostgreSQL RLS, forged managed-actor refusal, revoked/wrong-household/viewer denial, immutable evidence, duplicate hashes, idempotency, explicit review, invalid/ambiguous dates, Unknown policies, deterministic cues, optimistic reminder controls and restart recovery.
- Actual bundled Tesseract OCR recognizes the generated receipt image; integration confirms facts into relational purchase/item/evidence/observation/assertion/lifecycle/cue rows and retrieves them through the API. Provider output is schema/evidence-bound before persistence. An injectable extractor in recovery tests is explicitly a test double; the real-OCR integration is separate.
- `npm run build:mobile`: Android and iOS Hermes plus web bundle export. This is not an Android/iOS binary build or hardware run.
- `npm run test:e2e`: four browser tests: mobile 390×844 journey through quality warning → actual local OCR → contextual confirmations → lost-response recovery → saved lifecycle → original image → retrieval after reload → stopped return reminders; bad-image retention/refusal; failed upload/restart/reconnect; desktop keyboard/viewport smoke check. Browser emulation is not physical-camera or VoiceOver/TalkBack proof.
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

## Reproduction

`npm ci && npm run check && npm run build:mobile`

On Windows with Edge installed, `npm run test:e2e` uses headless Edge. CI installs bundled Chromium. The tests start their own ephemeral loopback API on 4329 and static preview on 4187, then clean up their servers. Ordinary development API uses `.local/database`; a restart preserves jobs/originals. Do not place real documents there.
