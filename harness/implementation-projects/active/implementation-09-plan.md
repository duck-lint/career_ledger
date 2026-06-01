# Implementation 09 Plan

## Intent

Implementation-09 opens exactly one planning-only seam: add a read-only source-authority explorer to the desktop shell so the operator can inspect the existing `load_source_authority` slices that already drive local analysis. The seam preserves the implementation-07 SQLite-backed source authority and requirement-region taxonomy, preserves the implementation-08 operator runtime input behavior, keeps `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, and keeps presentation surfaces non-authoritative.

## Admissibility Report

- Invariant constraints: Canonical persisted authority remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Requirement-region authority stays SQLite-backed inside taxonomy authority under `PD-03`. Job-posting input, proof output, metadata, explorer state, and other UI surfaces remain derived runtime or presentation state only. No write paths, saved explorer state, schema/storage changes, AI, embeddings, network, telemetry, cloud behavior, or hidden authority expansion may be introduced.
- Task constraints: This bundle is planning-only, contains exactly one seam, focuses only on exposing existing source-authority slices in the desktop UI as a read-only explorer, preserves the current operator runtime-input behavior from implementation-08, preserves the SQLite-backed source-authority and requirement-region taxonomy posture from implementation-07, preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, and does not widen into profiles/settings, write paths, schema/storage changes, saved UI state, or broader desktop redesign.
- Constraint conflicts: The current desktop shell already runs analysis from operator-supplied runtime input and already receives the full source-authority payload, but it only renders analysis metadata and requirement results. The inspectability goal therefore requires a presentation seam that reuses the existing payload without inventing a second authority path or a new persisted UI state.
- Allowed transformation types: In this bundle, plan and tracker creation only. In the later executable seam, admissible changes are limited to desktop presentation, the narrowest client-side state needed to render read-only source-authority details for the current run, and a successor desktop probe plus any minimal probe-launch/report wiring needed to validate the seam. Because the current payload already includes `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers`, do not plan a new source-authority backend command or authority-category expansion.
- Affected surfaces now: `harness/implementation-projects/active/implementation-09-plan.md` and `harness/implementation-projects/active/implementation-09-tracker.md`.
- Downstream affected surfaces when implementation is later approved: `desktop/index.html`, `desktop/main.js`, `desktop/styles.css`, `desktop/probes/i09-desktop-probe.mjs`, and probe wiring such as `package.json` only if needed. `src-tauri/src/main.rs` is downstream only if minimal probe launch or report plumbing is needed; it is not a planned source-authority data seam.
- Non-affected surfaces: `career_schema.sql`, `src-tauri/fixtures/career.db`, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, the current `load_source_authority` authority categories, profiles/settings behavior, write paths, migrations, schema/storage, auth, deployment, compatibility promises, network behavior, telemetry, cloud behavior, AI, embeddings, and broader analysis or traversal redesign.
- Admissibility checks: The later seam is admissible only if the desktop explorer renders the existing source-authority slices from the same live payload already returned for analysis, keeps `requirementRegionAuthority = sqlite`, preserves the current runtime-input and result behavior, and keeps the explorer read-only and non-persisted.
- Stop conditions: Stop before implementation if the seam appears to require a new canonical source category, a write path, saved explorer state, ps01 edits, a widened authority model, or a new `load_source_authority` contract beyond the currently returned slices.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the invariant authority.
- `harness/open-decisions.md` currently carries `PD-01`, `PD-02`, and `PD-03`, with no pending decision row.
- `harness/implementation-projects/archive/implementation-08-summary.md` records that implementation-08 is complete and archived, that operator runtime input now drives analysis per run, and that `proof-slices/ps01/runtime-core.mjs` plus `proof-slices/ps01/source-authority-adapter.mjs` stayed unchanged.
- `harness/implementation-projects/active/` currently contains only `.gitkeep`, so implementation-09 is the next live bundle.
- `desktop/index.html` now provides operator runtime-input controls and renders analysis metadata plus requirement results, but it does not yet expose the underlying source-authority slices.
- `desktop/main.js` already invokes `load_source_authority` with operator runtime input, receives the full source-authority payload, passes that full payload into `assembleApprovedSourceFactsProof`, and retains the payload in the run outcome.
- `src-tauri/src/main.rs` already exposes the current source-authority slices through `load_source_authority`: `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers`, with `requirementRegionAuthority` marked as `sqlite`.
- `desktop/probes/i08-desktop-probe.mjs` proves the current runtime-input and requirement-result contract, but it does not yet prove source-authority inspectability in the desktop UI.

## Planned Seam

1. `I09-S1: Expose existing source-authority slices in the desktop shell as a read-only explorer`

Seam boundary:

- Future implementation adds a read-only explorer surface in the desktop UI that renders the existing `load_source_authority` payload after a run completes.
- Explorer coverage is limited to the already returned slices: `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers`.
- The seam reuses the current desktop invocation path and the current `load_source_authority` payload. No new source-authority backend command is planned.
- The implementation preserves the existing operator runtime-input form, analysis metadata, and requirement results.
- Explorer content remains presentation only. No edit controls inside the explorer, no saved explorer state, no write path, and no new canonical authority are introduced.
- `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` remain unchanged.

Upstream dependency:

- `PD-01`, `PD-02`, and `PD-03` already authorize the runtime-only, SQLite-backed, profiles/settings-deferred posture needed for this seam.
- No pending decision row is needed in `harness/open-decisions.md` now because this seam only exposes already authorized data in a read-only presentation surface and does not introduce a new governance question. A pending row becomes necessary only if later work pressures persisted explorer state, source-authority expansion, profile/settings activation, or another new authority surface.

Downstream consequence:

- After later implementation and proof, the repo can truthfully claim that the desktop shell lets the operator inspect the live source-authority slices that fed the current analysis run while SQLite remains the requirement-region authority and the explorer remains read-only.

## Non-Goals

- No implementation in this bundle.
- No new source-authority backend command and no new source-authority payload category.
- No edits to `career_schema.sql`, SQLite fixtures, `proof-slices/ps01/runtime-core.mjs`, or `proof-slices/ps01/source-authority-adapter.mjs`.
- No profiles/settings activation.
- No write paths, saved UI state, schema/storage changes, migrations, or persistence of explorer state.
- No broader desktop redesign beyond the narrow read-only explorer seam.

## Acceptance Criteria

- This bundle remains planning-only and defines exactly one seam: `I09-S1`.
- The bundle states explicitly that the explorer should reuse the existing `load_source_authority` payload rather than assuming a new backend command.
- The bundle states explicitly that SQLite-backed source authority and SQLite-backed requirement-region taxonomy remain unchanged.
- The bundle states explicitly that operator runtime input behavior from implementation-08 remains intact.
- The bundle states explicitly that `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged.
- The bundle states explicitly that presentation surfaces remain non-authoritative and that no persistence or write path is introduced.
- The bundle defines one named desktop acceptance probe for the later executable seam.
- The bundle records clearly that no pending decision row is needed in `harness/open-decisions.md` at this stage.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: planning-only.
- Approval posture for later execution: explicit implementation approval is required before changing desktop presentation or probe surfaces. If implementation discovers that the current `load_source_authority` payload is insufficient and a new backend contract is needed, stop and reopen admissibility rather than silently widening the seam.
- User-facing acceptance for the later seam: after the operator runs analysis from the same desktop shell, the UI shows read-only inspectable views of the current `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers` that actually fed that run, while the existing analysis metadata and requirement results remain visible.
- Truth rule: visible explorer sections alone are insufficient. The later seam is only complete when the desktop proof shows the explorer reflects the same live source-authority payload used for the run, remains read-only, preserves `requirementRegionAuthority = sqlite`, and introduces no persistence or write path.

## Current Repo Runtime State

- The current shell accepts operator runtime input and renders analysis metadata plus requirement results.
- The current desktop caller already invokes `load_source_authority` with runtime job-posting input.
- The current desktop caller already has the full source-authority payload available before calling `assembleApprovedSourceFactsProof`.
- The current Tauri command already returns `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers`, with `requirementRegionAuthority = sqlite`.
- The current I08 desktop probe validates runtime-input-driven analysis and SQLite requirement-region authority, but not source-authority inspectability.

## Assumptions And Unknowns

- The existing `load_source_authority` payload is sufficient for the explorer, so no source-authority bridge expansion should be necessary.
- The explorer can remain read-only with rendered summaries and lists rather than introducing new editable controls.
- A successor desktop probe and minimal launcher/report plumbing may be needed for validation, but that would support proof only and would not change source-authority semantics.
- No pending decision row is needed now because the current user authorization and existing decision set already cover this read-only inspectability seam.

## Affected and Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-09-plan.md` and `harness/implementation-projects/active/implementation-09-tracker.md`.
- Downstream surfaces when implementation is later approved: `desktop/index.html`, `desktop/main.js`, `desktop/styles.css`, `desktop/probes/i09-desktop-probe.mjs`, probe script wiring only if required, and `src-tauri/src/main.rs` only if minimal probe launch/report plumbing is needed.
- Read-only dependency surfaces for this bundle: the governing project-spec docs, `harness/open-decisions.md`, `harness/implementation-projects/archive/implementation-08-summary.md`, `desktop/index.html`, `desktop/main.js`, `desktop/probes/i08-desktop-probe.mjs`, and `src-tauri/src/main.rs`.
- Non-affected: `career_schema.sql`, `src-tauri/fixtures/career.db`, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings, write paths, schema/storage, auth, deployment, compatibility promises, telemetry, network behavior, cloud behavior, AI, embeddings, and broader semantic or resume-assembly redesign.

## Verification Contract Summary

- Named successor acceptance probe: `I09 Desktop Probe: Read-Only Source-Authority Explorer Reflects Live Payload`.
- Probe shape: run the desktop in probe mode, submit operator runtime input, wait for a successful analysis, and capture both the existing result contract and the explorer state. The probe must prove `runtimeError = null`, `requirementRegionAuthority = sqlite`, the existing supported and unsupported result cards still render, the explorer shows non-empty read-only summaries or lists for `experience_records`, `evidence_items`, `taxonomy`, runtime `jobPostingInput`, and `authorityMarkers`, and the displayed runtime input values match the operator-supplied input for that run.
- Required proof boundary: the explorer fails the seam if it depends on a second authority fetch, introduces editable controls inside the explorer surface, saves explorer state, writes to SQLite, changes requirement-region authority, or requires ps01 edits.
- Companion regression proof: `npm run probe:i08` must continue to pass because the runtime-input and requirement-result contract remains in scope, and `node --test proof-slices/ps01/ps01.test.mjs` must continue to pass unchanged.

## Completion Rule

- Do not implement from this bundle alone.
- Do not mark the later seam complete because explorer markup exists or because source-authority data is retained in memory.
- Do not treat explorer state, DOM payloads, or probe payloads as canonical authority.
- Do not widen into persistence, profiles/settings, schema/storage changes, or backend authority expansion beyond the current payload.
- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.

## Approval Gates

- API: no new source-authority backend command is planned. If implementation discovers that inspectability cannot be delivered from the current `load_source_authority` payload and a new bridge contract or payload expansion is needed, stop and get explicit approval before continuing.
- Storage and schema: not expected for this seam. If implementation pressure appears here, stop and reopen admissibility rather than planning around it.
- Project-intent authority: no new `harness/open-decisions.md` row is needed now. If later work proposes persisted explorer state, source-authority expansion, profile/settings activation, or another new authority surface, add a pending decision before implementation.

## Handoff Packet For The Next Agent

- Goal: implement only `I09-S1` after explicit implementation approval is granted for the desktop read-only explorer seam.
- Preserve unchanged: SQLite-backed source authority, SQLite-backed requirement-region taxonomy, operator runtime-input behavior from implementation-08, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings deferral, and the non-authoritative status of all presentation surfaces.
- Touch budget when later authorized: the narrowest desktop shell files needed to render the explorer, one successor desktop probe surface, probe script wiring only if needed, and minimal Tauri probe plumbing only if the probe harness requires it. Do not widen `load_source_authority` unless the current payload proves insufficient and explicit approval is granted.
- Required proof before closeout: `I09 Desktop Probe: Read-Only Source-Authority Explorer Reflects Live Payload` passes, `npm run probe:i08` still passes, and `node --test proof-slices/ps01/ps01.test.mjs` still passes unchanged.
- Explicit stop rule: if implementation needs persistence, saved UI state, schema/storage changes, profile/settings activation, ps01 edits, or a widened source-authority backend contract, stop and open a fresh admissibility pass instead of widening this seam.

## Closeout Note

- When this bundle completes, move it from `active/` to `archive/`.