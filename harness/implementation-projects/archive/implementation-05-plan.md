# Implementation 05 Plan

## Intent

Implementation-05 opens exactly one implementation seam: harden the existing single-screen local desktop caller by reducing the Tauri capability surface to only what the current fixture-backed flow needs and by replacing `null` CSP with the narrowest local-only compatible policy. This seam preserves the current user-facing behavior proven in implementation-04. It does not authorize real source-authority wiring, bridge replacement, additional screens, persistence, schema changes, or any hidden dependency drift.

## Admissibility Report

- Invariant constraints: Canonical authority remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, traversal, and assembled results remain runtime-only, deterministic, explainable, and evidence-bounded. Unsupported requirements remain visible. No AI, embeddings, network, telemetry, cloud, workflow-status state, or hidden persistence may be introduced.
- Task constraints: The seam is limited to hardening the already-shipped I04 desktop shell. It may reduce Tauri permissions, tighten CSP, and make only the narrow supporting desktop-shell adjustments needed to keep the existing fixture-only single-screen flow working. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` must remain unchanged. The bridge stays fixture-only.
- Constraint conflicts: None inside this seam. The adjacent desire to replace the fixture bridge with real source-authority wiring is not admissible here and remains blocked pending a fresh approval-boundary pass.
- Allowed transformation types: Narrow Tauri capability manifest changes, narrow Tauri security-config changes, and only the smallest desktop-shell or probe-facing adjustments required to keep the current local-only seam functioning under those tighter constraints.
- Affected surfaces: This active plan/tracker bundle now. Future implementation for `I05-S1` is limited to `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, and any directly dependent desktop-shell surfaces needed to preserve the current single-screen fixture-backed caller and probe.
- Non-affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, fixture semantics, project spec, governance, open decisions, archive history, schema, storage, auth, deployment, network, telemetry, cloud, multi-screen IA, and any real source-authority adapter or storage wiring.
- Admissibility checks: The hardened app must still build, `cargo check`, pass the live desktop probe, and pass the ps01 tests without widening permissions, bridge authority, or CSP scope beyond what the local bundled screen requires. Capability reduction must map to the current two-command fixture flow only. CSP must remain local-only and must not re-enable remote origins or `null` fallback.
- Stop conditions: Stop if keeping the current seam working requires real source-authority wiring, proof-slice edits, new persisted state, schema/storage/auth/deployment decisions, network allowances, telemetry, cloud assumptions, or a CSP/permission exception broader than the local bundled screen and current probe justify.

## Observed Evidence

- `harness/implementation-projects/active/` is empty aside from `.gitkeep`, so implementation-05 can become the sole live numbered bundle.
- `src-tauri/capabilities/default.json` still grants `core:default` for the `main` window.
- `src-tauri/tauri.conf.json` still sets `app.security.csp` to `null`.
- `src-tauri/src/main.rs` exposes only `load_i04_fixture` and `report_i04_probe`, opens only the `main` window, and routes only app-local `index.html` URLs.
- `desktop/index.html` and `desktop/main.js` load only bundled local CSS and module JS, then invoke the two local Tauri commands above for the fixture-backed read-only flow.
- `package.json` already exposes the required verification commands: `npm run build:web`, `cargo check --manifest-path src-tauri/Cargo.toml`, `npm run probe:i04`, and `node --test proof-slices/ps01/ps01.test.mjs`.
- Archived implementation-04 explicitly records that the bridge is fixture-only and that real source-authority wiring remains unresolved for a later approval-boundary pass.

## Non-Goals

- No replacement of the fixture bridge with real source-authority wiring.
- No edits to ps01 runtime-core or source-authority adapter.
- No schema, storage, auth, deployment, updater, packaging, network, telemetry, cloud, or AI work.
- No new UI screens, editing flows, persistence, or broader Tauri architecture work.
- No new command surface beyond what the current single-screen probe already exercises.

## Planned Seams

1. `I05-S1: Harden the existing fixture-only desktop shell`

Seam boundary:

- Reduce the Tauri capability manifest from the broad default grant to the minimum permission surface required by the current `main` window and the two existing local commands.
- Replace `null` CSP with the narrowest bundled-local policy that still permits the current HTML, CSS, module script, and any Tauri-required local protocol behavior for the existing screen and probe.
- Keep the bridge fixture-only, the screen single-page and read-only, and the probe semantics unchanged.

Upstream dependency:

- Implementation-04 already proved the single-screen local desktop caller and its probe against the unchanged ps01 adapter/core boundary.

Downstream consequence:

- If implemented successfully, the repo may truthfully claim that the existing desktop seam is no longer relying on broad default capability grants or a `null` CSP. It still will not claim any live source-authority wiring or broader desktop product completion.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: proposed, planning-only.
- Dominant tension: capability and CSP hardening are admissible now because they narrow an already-approved local desktop seam; replacing the fixture bridge with real source-authority wiring is separately blocked until a fresh approval-boundary pass rechecks authority, affected surfaces, and verification obligations.
- User-facing acceptance: from the same single local desktop screen, the operator can still run the built-in fixture analysis and see the same supported `Backend Systems` and explicit unsupported `Mentoring` results while the underlying Tauri shell runs with reduced permissions and a non-null local-only CSP.
- Truth rule: a smaller permission manifest or stricter CSP alone does not count unless the existing user-facing probe still passes end to end.

## Assumptions And Unknowns

- The current screen likely needs only a narrow invoke permission set plus a local-only CSP because it uses bundled assets and two known commands.
- Exact Tauri permission identifiers may require inspection of generated schemas or tool feedback during implementation.
- Tauri may require limited protocol allowances in CSP for bundled assets or webview internals; any allowance must be justified as local-only and no broader than needed.
- If the app cannot keep the current probe green without falling back to broad default grants or `null` CSP, the seam must stop and surface the concrete incompatibility rather than widening authority.

## Affected And Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-05-plan.md` and `harness/implementation-projects/active/implementation-05-tracker.md`.
- Affected when implementation is approved: `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, and only the smallest directly dependent desktop-shell surfaces needed to preserve the current live probe contract.
- Read-only dependency surfaces: `desktop/index.html`, `desktop/main.js`, `desktop/probes/i04-desktop-probe.mjs`, `src-tauri/src/main.rs`, and the archived implementation-04 records.
- Non-affected: ps01 proof files, fixture content, schema/storage/auth/deployment surfaces, project-spec docs, governance docs, open decisions, archive history, and any real source-authority wiring surface.

## Verification Contract Summary

- Falsifiable acceptance probe: the existing live I04 desktop probe must remain green while the shell is hardened.
- Required verification commands:
  - `npm run build:web`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `npm run probe:i04`
  - `node --test proof-slices/ps01/ps01.test.mjs`
- Failure rule: the seam is incomplete if hardening only changes config shape, if any command above fails, if the probe loses supported or unsupported visibility, if the bridge ceases to be fixture-only, or if hardening requires broader permissions or CSP than the current local screen can justify.

## Completion Rule

- Do not mark this seam complete on config diffs alone.
- Do not count scaffold, permission-file churn, or CSP prose as behavior evidence without the required commands passing.
- Do not let implementation-05 widen into source-authority wiring, schema/storage work, or second-screen architecture.

## Approval Gates

- [ ] Schema
- [ ] API
- [ ] Auth
- [ ] Storage
- [ ] Deployment
- [ ] Destructive operation
- [ ] Broad architecture
- [ ] Project-intent authority not covered by spec or current authorization

## Handoff Packet For The Next Agent

- Goal: implement only `I05-S1`.
- Preserve unchanged: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, fixture-only bridge semantics, single-screen read-only behavior, and the existing live probe contract.
- Touch budget: hardening in `src-tauri/capabilities/default.json` and `src-tauri/tauri.conf.json`, plus only the smallest directly dependent desktop-shell edits needed to keep the current probe passing.
- Required proof before closeout: all four verification commands pass, and the live desktop seam still shows supported `Backend Systems` plus explicit unsupported `Mentoring`.
- Explicitly blocked adjacent work: do not replace the fixture bridge with real source-authority wiring in this bundle; request a new admissibility and approval-boundary pass instead.

## Closeout Note

- When this bundle completes, move it from `active/` to `archive/`.