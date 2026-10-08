# Native development preparation and acceptance

Checkpoint: 2026-10-07. Synthetic development only. Phase 1 remains open.

## Observed preparation and blockers

Android source generation succeeds with `npm exec -w @cuevaro/mobile -- expo prebuild --platform android --no-install`. Generated `apps/mobile/android/` is ignored/reproducible; it is not an APK. After adding SDK-matched expo-system-ui ~57.0.4, automatic-theme preparation no longer warns about its missing module. Generated properties enable SQLCipher, Hermes and new architecture. Wrapper Gradle 9.3.1 and installed Android Gradle Plugin 8.12.0 were inspected, not executed successfully.

This Windows environment exposes Java 1.8.0_51 and lacks adb/the standard Android SDK and connected hardware. Wrapper `--version`, with GRADLE_USER_HOME scoped to this repository's ignored `.local/gradle-cache`, fails downloading the official distribution with SSLHandshakeException/PKIX trust-chain failure. This is the observed first failure, not a compiler error or evidence that native dependencies link. Independently, Gradle 9 requires Java 17 or newer and Android Gradle Plugin 8 requires JDK 17: [Gradle compatibility](https://docs.gradle.org/current/userguide/compatibility.html), [Android JDK requirements](https://developer.android.com/build/jdks). Do not disable certificate validation or alter global trust/Owner configuration to bypass this.

A compatible locally scoped JDK and Android SDK with accepted applicable terms, then an authorized synthetic-test device, are required. SDK/account/license/security changes are not assumed by a generated build. No EAS project, paid build service, developer account, production signing, external user or store deployment was created.

## Reproducible Android sequence after prerequisites

Use a dedicated checkout and preserve concurrent changes. `npm ci`; run `npm run check`, `npm run format:check`, `npm run build:mobile`, `npm run test:e2e`. Check the enforced dependency gate; successful local build does not waive it.

Generate native sources with the command above. In that process only, point JAVA_HOME to the compatible approved JDK, ANDROID_HOME to the available SDK, and GRADLE_USER_HOME to `.local/gradle-cache`; do not publish their machine-specific values. Run generated `apps/mobile/android/gradlew.bat --version`, then the generated Android project's `:app:assembleDebug` from its directory. Record full source SHA, tool versions and command results. A debug APK is a private development artifact, not a release/signing acceptance. Install only onto the authorized synthetic-test device after prerequisites exist. Capture platform/runtime evidence separately from compilation.

## Physical synthetic acceptance record

For each device, record OS/model, exact source SHA, debug build identity, time and results without secrets or raw receipt telemetry. Use generated fixtures and approved identities only.

- Verify SQLCipher reports cipher_version, Keychain/Keystore persistence and restart recovery. Verify unsupported/Expo Go paths refuse capture storage rather than writing plaintext. Do not disclose the database key.
- Camera/library preservation must precede decoding/upload. Test blur, glare, low light, cut-off, faded thermal, skew and small text. Bad blocks extraction; Questionable requires explicit continuation; completeness remains uncertain. Compare retained original hashes and ordered multi-page identities, including replacements.
- In airplane mode/failed upload, preserve captures through process termination/restart. Reconnect/retry without duplicate purchases; lost acknowledgements reuse the exact identity. No browser/dev-computer result establishes native independence.
- Explicit low-confidence review/Unknown, quick replies, item track/skip, original excerpts/page provenance and supported dates must survive save/retrieval. Test correction replay after interruption and Stop/dismiss/snooze through changed date/Unknown. Refuse invalid dates before durable queueing.
- Use TalkBack, actual OS large text and hardware keyboard where available in both themes. Verify labels, focus after quick replies, error announcement/association, visible focus, 48px controls and no obscured essential action. Browser 200% text is a separate regression, not OS text scaling.
- Generate ZIP locally, verify its original bytes/history, use an authorized destination and test delayed recipient reads. Explicit cleanup/restart discovery must remove only owned export cache files; retain captures and unrelated files. External copies cannot be recalled. Test unavailable/cancelled/failing chooser without claiming successful delivery.
- Real managed auth/private storage/signed URL expiry/revocation/backup tests require already approved Supabase access; local fixtures cannot replace them. Native automatic extraction must use an approved mobile-accessible backend, not a development desktop dependency. Until then record that part as blocked, not passed.

## Separate iOS assessment

This Windows environment cannot compile or run Xcode/iOS. Android success would not establish iOS acceptance. A macOS/Xcode environment, compatible platform prerequisites and an authorized physical device are needed; any new account, signing credential, paid service or deployment remains a separate boundary. Generate iOS source only there with `expo prebuild --platform ios --no-install`, build a private development target through the approved local signing path, and record exact commands/results. Repeat the checklist with VoiceOver, iOS Dynamic Type, camera/Keychain/SQLCipher and OS sharing/cleanup. Simulator evidence alone cannot prove physical camera/secure storage or destination behavior.

No checkbox is marked passed by this preparation document. Native compilation and physical acceptance remain open until recorded evidence exists.
