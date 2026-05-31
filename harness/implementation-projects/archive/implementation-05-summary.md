# Implementation 05 Summary

## Project Prefix

- implementation-05

## Goal And Final Status

- Goal: complete `I05-S1` by hardening the existing single-screen local desktop caller, reducing the Tauri capability surface below `core:default`, and replacing the `null` CSP with the narrowest local-only compatible policy while preserving the fixture-only bridge and the proven ps01 runtime boundary.
- Final status: complete and archived. The implementation-05 seam, archive records, and state-folder cleanup are complete.
- Scope limit: implementation-05 hardens only the already-shipped I04 desktop seam. It does not authorize real source-authority wiring, persistence, schema/storage/auth/deployment changes, new screens, network access, telemetry, AI, embeddings, or cloud behavior.
- Scope reminder: `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stayed unchanged, and the bridge remained fixture-only.

## Files Changed

- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`
- `harness/implementation-projects/archive/implementation-05-plan.md`
- `harness/implementation-projects/archive/implementation-05-summary.md`
- `harness/implementation-projects/archive/implementation-05-tracker.md`
- `harness/implementation-projects/active/implementation-05-plan.md` removed during same-turn archive cleanup.
- `harness/implementation-projects/active/implementation-05-tracker.md` removed during same-turn archive cleanup.

## Surfaces Changed

- One narrowed Tauri capability surface for the existing `main` desktop window.
- One non-null local-only Tauri CSP for the existing bundled desktop screen.
- One archived implementation-memory bundle for implementation-05.
- No changes to the desktop presenter files, the Tauri bridge shape in `src-tauri/src/main.rs`, the ps01 proof files, project spec, governance, open decisions, schema, storage, auth, deployment, external APIs, AI, embeddings, telemetry, cloud behavior, or real source-authority wiring.

## Verification Evidence

- The first substantive edit narrowed `src-tauri/capabilities/default.json` away from `core:default` and immediately triggered `npm run probe:i04` as the focused discriminating check.
- The first probe falsified only the initial permission-name spelling guess by reporting that manifest identifiers cannot use underscores.
- A follow-up probe against kebab-case app-command identifiers showed that the generated Tauri app permission manifest for this project is empty, so those command identifiers were not available as permission targets.
- A third focused probe passed with `src-tauri/capabilities/default.json` set to `permissions: []`, proving the current fixture-only invoke flow works with no built-in core permissions granted to the `main` window.
- A fourth focused probe passed after replacing `null` CSP with `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'` in `src-tauri/tauri.conf.json`.
- `npm run build:web` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm run probe:i04` passed and preserved the live desktop acceptance result.
- `node --test proof-slices/ps01/ps01.test.mjs` passed with the unchanged proof-slice contract.

## User-Facing Acceptance Result

- Accepted for the seam-local hardening contract only: from the same single local desktop screen, the operator can still trigger the built-in fixture analysis and see supported `Backend Systems` plus explicit unsupported `Mentoring` while the Tauri shell now runs with a capability surface narrower than `core:default` and a non-null local-only CSP.
- Unsupported requirements remained visible in the rendered result view; they were not collapsed or hidden by the hardening work.
- No broader product claim is made. The accepted result is limited to the hardened existing desktop caller seam and does not claim live source-authority wiring, persistence, editing flows, or broader desktop completion.

## Decisions Made Or Reused

- No new decision was created by implementation-05.
- The bundle reused PD-01 and the active implementation-05 admissibility report: runtime-only derived state, deterministic evidence-bounded traversal, no hidden network/telemetry/cloud behavior, and no drift in authority boundaries.

## Known Failures Added Or Ruled Out

- No new `harness/known-failures.md` entry was needed.
- The initial attempt to name app-command permissions directly in the capability manifest failed because manifest identifiers cannot use underscores and because the generated application permission manifest is empty for this project; the seam resolved that locally by proving the current fixture-only flow works with `permissions: []` instead of by widening scope.
- The non-blocking Windows WebView shutdown noise observed in implementation-04 remains non-failing and did not block implementation-05 acceptance.

## Unresolved Risks And Revisit Triggers

- Future work that needs command-level permission scoping for app-defined Tauri commands will require an explicit application permission-definition surface; the current generated app permission manifest is empty.
- Revisit the CSP if later desktop work introduces asset-protocol images, remote origins, additional protocols, or broader webview behavior, because those would require a fresh local-only justification.
- Real source-authority wiring, persistence, schema/storage/auth/deployment decisions, and any broader desktop information architecture remain intentionally unresolved and require a fresh approval-boundary pass.