# Dependency risk investigation — 2026-10-05

This is an engineering assessment, not risk acceptance. Repository-wide high-severity audit failure is retained. No real-user/public service, certificate signing, OTA release or credential configuration was enabled.

| Finding | Installed path | Affected behavior |
|---|---|---|
| [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces@3.0.3` | `@cuevaro/mobile → expo@57.0.26 → @expo/cli@57.0.27 → @expo/metro-file-map@57.0.3 → micromatch@4.0.8 → braces@3.0.3` | Recursive pattern/AST walkers can exhaust the stack on hostile nesting. Receipt text/HTTP input is not used as glob patterns in Cuevaro. Build/config inputs remain an attack surface. |
| [GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv), `node-forge@1.4.0` | `@cuevaro/mobile → expo → @expo/cli → node-forge`, also through `@expo/code-signing-certificates@0.0.6` | Malformed nested DigestAlgorithm data can bypass RSA signature verification for low-exponent keys. Expo tooling uses forge for certificate/signing operations; Cuevaro does not use it for receipt authenticity. Those operations are not configured in this slice. |

The published affected ranges are `braces <=3.0.3` and `node-forge <=1.4.0`; both advisories listed no patched published version at inspection. These are two primary advisories with 28 high dependency findings propagated through parent tooling, not 28 independent CVEs.

## Concrete mitigation and evidence

1. Added the existing API as its own workspace with only its required dependencies. `npm audit --omit=dev --workspace=@cuevaro/api --include-workspace-root=false --json` reports zero vulnerabilities. `npm ls braces node-forge --all --workspace=@cuevaro/api --include-workspace-root=false` reports an empty tree. This removes these dependencies from the selected API installation surface; it does not certify a production backend or remove them from the mobile build toolchain.
2. Mobile development startup defaults to `expo start --localhost`. The API/static preview also bind loopback. Cross-origin mutation requests are rejected. Developer-controlled, constant file/glob patterns are used; user evidence does not become a path/pattern/command/certificate.
3. The generated web and Android/iOS bundle bytes contain none of the strings `node-forge`, `@expo/cli`, or `micromatch`. This supports the build-tool classification but is only a static signal, not proof of complete non-reachability. Native release/security verification remains open.
4. Installed available Vitest/UUID fixes and repaired the invalid Expo dependency tree. No audit ignore/allowlist, `continue-on-error`, fake package version or vulnerability waiver was added. The full dependency gate still fails.

Local fixture exploitability is reduced by controlled synthetic input and loopback-only exposure. It is not declared zero. A controlled literal-nesting probe of `braces.compile` on Node 24 accepted depths through 4999, and larger strings hit the library's length guard. That probe does not cover all recursive walkers/AST inputs and does not invalidate the advisory. No hostile certificate/secret was supplied to the runtime.

## Supported alternatives investigated

- **API isolation/removal:** implemented and independently audited clean. API code has no Expo/Metro/signature-tool imports.
- **Published patched package override:** no patched npm release existed in the inspected affected lines. Downgrading within the affected ranges cannot fix either advisory; `npm audit fix --force` proposes an old Expo major and would undermine the selected SDK rather than demonstrate safety. It was not used.
- **Upstream source backport:** [forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152) proposes a small nested-element validation fix with regression coverage, but was still open/unmerged when inspected. This is a concrete candidate for isolated backport review/testing, not an automatically trusted released fix. Adopting it would require verifying the patch, upstream test suite, supply-chain provenance and Expo compatibility while retaining an honest audit disposition. No unreviewed fork or crypto replacement was installed.
- **Bounded glob/AST guard or upstream walker patch:** could mitigate braces nesting, but must cover all entry points and preserve Metro matching behavior. User input is currently excluded from those APIs. An ad hoc monkey patch of one entry point would not prove full remediation and was not substituted for the gate.
- **Removing/replacing Expo/Metro:** would materially change the recommended native architecture and camera/build path. Merely deleting nested dependencies would break tooling and would not be a safe supported removal. It is unnecessary for the clean API surface and not selected for mobile without stronger evidence.

Before any public/native release: obtain reviewed complete remediation or a separately authorized documented risk decision; verify the actual release dependency/artifact surface. Independent synthetic development can continue within the implemented containment. Phase 1 still also requires managed auth/private storage/staging and real hardware validation.
