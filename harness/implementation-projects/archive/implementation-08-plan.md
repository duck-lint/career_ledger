# Implementation 08 Plan

Historical planning artifact: the approval gate described below was resolved later the same day, `I08-S1` was implemented within the approved seam, and the bundle was archived. See `harness/implementation-projects/archive/implementation-08-summary.md` for final status and verification evidence. The planning-only and approval-gated language below is retained as historical context.

## Intent

Implementation-08 opens exactly one planning-only seam: replace the fixed overlay-driven `jobPostingInput` dependency with explicit operator-supplied runtime input in the desktop shell so the local desktop caller behaves like an input-driven app without changing source authority, persistence, or ps01 semantics. The seam preserves the SQLite-backed source authority and requirement-region taxonomy delivered in implementation-07, keeps `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, and keeps job-posting input runtime-only and non-persisted.

## Admissibility Report

- Invariant constraints: Canonical persisted authority remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Requirement-region semantics stay in SQLite-backed taxonomy authority. Semantic projection, target-region selection, traversal, and assembled output remain runtime-only, deterministic, explainable, and evidence-bounded. No persisted semantic workspace, saved posting store, workflow-status state, AI, embeddings, network, telemetry, or cloud behavior may be introduced. Presentation and transport surfaces cannot become authority by drift.
- Task constraints: This bundle is planning-only, contains exactly one seam, focuses only on replacing the fixed seam-local `jobPostingInput` dependency with explicit operator-supplied runtime input, preserves the implementation-07 SQLite requirement-region authority shape, preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, keeps runtime input non-persisted, and does not widen into profiles/settings, write paths, schema/storage changes, or broader desktop redesign.
- Constraint conflicts: The current desktop shell is still a single-action read-only caller, `desktop/main.js` invokes `load_source_authority` with no operator payload, and `src-tauri/src/main.rs` still fills `jobPostingInput` from the fixed overlay sample. The desired runtime-input seam therefore requires a later bridge payload change and desktop input surface, but it must stop short of persistence or authority drift.
- Allowed transformation types: In this bundle, plan and tracker creation only. In the later executable seam, the admissible change shape is limited to the narrow desktop input surface, the desktop-to-Tauri runtime payload path, and one successor desktop probe that proves runtime input is operator-supplied per run while SQLite remains the requirement-region authority.
- Affected surfaces now: `harness/implementation-projects/active/implementation-08-plan.md` and `harness/implementation-projects/active/implementation-08-tracker.md`.
- Downstream affected surfaces when implementation is later approved: `desktop/index.html`, `desktop/main.js`, `desktop/styles.css`, `src-tauri/src/main.rs`, the successor desktop probe surface, and probe wiring such as `package.json` only if needed to expose the new probe.
- Non-affected surfaces: `career_schema.sql`, `src-tauri/fixtures/career.db`, `src-tauri/fixtures/source-authority-semantic-overlay.json` as a non-authoritative fixture artifact, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings behavior, write paths, migrations, auth, deployment, cloud behavior, telemetry, AI, embeddings, and broader resume-assembly or traversal redesign.
- Admissibility checks: The later seam is admissible only if operator-entered posting text can drive analysis per run without persisting that input, without changing the SQLite-backed requirement-region authority, without changing ps01, and without treating UI state or invoke payloads as canonical source truth.
- Stop conditions: Stop before implementation if the seam requires schema/storage changes, saved postings, overlay-backed write paths, profiles/settings widening, ps01 edits, or any move that turns desktop state, request payloads, or probe payloads into authoritative persisted state.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the invariant authority.
- `harness/open-decisions.md` currently carries `PD-01`, `PD-02`, and `PD-03`; there is no current pending decision row.
- `harness/implementation-projects/archive/implementation-07-summary.md` records that requirement-region authority now comes from SQLite-backed taxonomy authority only and that the fixed sample `jobPostingInput` remains runtime-only rather than persisted authority.
- `desktop/index.html` is still a single-action, read-only shell with no operator input controls.
- `desktop/main.js` still invokes `load_source_authority` with no operator-supplied input and auto-runs that same path in probe mode.
- `src-tauri/src/main.rs` still defines `load_source_authority()` as a zero-argument command and still fills `jobPostingInput` from `src-tauri/fixtures/source-authority-semantic-overlay.json`.
- `src-tauri/fixtures/source-authority-semantic-overlay.json` now carries only a fixed sample `jobPostingInput`.
- `proof-slices/ps01/source-authority-adapter.mjs` already derives target-region selection from `sourceAuthority.jobPostingInput`, already accepts runtime text fields `title`, `summary`, `text`, and `description`, and still leaves profiles/settings unused.
- `desktop/probes/i07-desktop-probe.mjs` proves the current visible desktop contract and SQLite requirement-region authority, but it does not yet prove operator-supplied runtime input.

## Planned Seam

1. `I08-S1: Pass explicit operator-supplied runtime job-posting input through the desktop shell without persisting it`

Seam boundary:

- Future implementation adds an explicit operator input surface to the current desktop shell and routes that runtime input through the existing local analysis flow.
- Future implementation changes the desktop-to-Tauri bridge so `load_source_authority` receives runtime job-posting input per invocation instead of reading the fixed sample from the overlay at runtime.
- The seam preserves SQLite-backed requirement-region taxonomy authority exactly as implemented in implementation-07.
- `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` remain unchanged.
- Runtime input stays ephemeral and non-persisted. UI state, invoke payloads, probe payloads, and rendered metadata remain transport or presentation only.
- Profiles/settings remain deferred. Saved postings, draft persistence, write paths, schema/storage changes, and broader app-shell expansion remain out of scope.

Upstream dependency:

- `PD-01`, `PD-02`, and `PD-03` already authorize the runtime-only and SQLite-backed authority posture needed for this seam.
- No new pending row is needed in `harness/open-decisions.md` now because there is no unresolved governance question blocking this planning bundle. If future work proposes persisted job-posting drafts, profile-backed defaults, or other new authority surfaces, that would require a fresh pending decision row before implementation.

Downstream consequence:

- After later implementation and proof, the repo can truthfully claim that the desktop shell accepts explicit operator-supplied runtime input per run while SQLite remains the requirement-region authority and job-posting input remains non-persisted.

## Non-Goals

- No implementation in this bundle.
- No edits to runtime code, probes, SQLite data, overlay content, or ps01 files.
- No profiles/settings widening.
- No saved-posting or default-posting persistence.
- No write paths, schema/storage changes, migrations, or authority-category expansion.
- No broader desktop redesign beyond the narrow runtime-input seam.

## Acceptance Criteria

- This bundle remains planning-only and defines exactly one seam: `I08-S1`.
- The bundle states explicitly that the seam replaces the fixed runtime dependency on overlay-supplied `jobPostingInput` with explicit operator-supplied runtime input.
- The bundle states explicitly that SQLite-backed source authority and SQLite-backed requirement-region taxonomy from implementation-07 remain unchanged.
- The bundle states explicitly that `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged and that job-posting input remains runtime-only and non-persisted.
- The bundle states explicitly that profiles/settings, write paths, and schema/storage changes remain out of scope.
- The bundle states explicitly that presentation and transport surfaces must not become authority by drift.
- The bundle defines one named desktop acceptance probe for the later executable seam.
- The bundle records clearly that no pending decision row is needed in `harness/open-decisions.md` at this stage.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: planning-only.
- Approval posture for later execution: explicit implementation approval is required before changing the internal desktop-to-Tauri command contract.
- User-facing acceptance for the later seam: from the same desktop window, the operator can enter or revise job-posting text, run analysis, and see the rendered metadata and requirement results reflect that just-entered runtime input for that run rather than the fixed overlay sample.
- Truth rule: visible input controls alone are insufficient. The later seam is only complete when the desktop proof shows operator-supplied runtime input drives analysis per run, SQLite still supplies requirement-region authority, and no persistence or write path is introduced.

## Current Repo Runtime State

- The current shell is a single-action analysis screen with read-only metadata and results.
- The current desktop caller still invokes a zero-argument `load_source_authority` command.
- The current Tauri bridge still injects `jobPostingInput` from the fixed overlay sample.
- The current ps01 adapter already accepts runtime text fields and already derives target-region selection from `sourceAuthority.jobPostingInput`.
- The current I07 desktop probe proves the SQLite requirement-region authority and current visible result contract only.

## Assumptions And Unknowns

- The existing ps01 adapter contract is already broad enough for the runtime-input seam because it accepts `title`, `summary`, `text`, and `description` without persistence.
- The narrowest truthful implementation shape is to change only the local desktop input surface, the bridge payload, and the desktop probe, while preserving the current SQLite-backed taxonomy authority.
- Whether the overlay fixture remains in the repo as an unused sample artifact or is later reduced further is not a decision-level question for this bundle, as long as it no longer drives live runtime input.
- No pending decision row is needed now because the current user authorization and existing project authority already cover runtime-only operator input. A new pending row becomes necessary only if later work pressures persistence, profile defaults, saved drafts, or another new authority surface.

## Affected and Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-08-plan.md` and `harness/implementation-projects/active/implementation-08-tracker.md`.
- Downstream surfaces when implementation is later approved: `desktop/index.html`, `desktop/main.js`, `desktop/styles.css`, `src-tauri/src/main.rs`, the successor desktop probe surface, and probe script wiring only if required.
- Read-only dependency surfaces for this bundle: the governing project-spec docs, `harness/open-decisions.md`, archived implementation-07 artifacts, `desktop/index.html`, `desktop/main.js`, `desktop/probes/i07-desktop-probe.mjs`, `src-tauri/src/main.rs`, `src-tauri/fixtures/source-authority-semantic-overlay.json`, and `proof-slices/ps01/source-authority-adapter.mjs`.
- Non-affected: `career_schema.sql`, `src-tauri/fixtures/career.db`, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings, write paths, schema/storage, auth, deployment, compatibility promises, telemetry, network behavior, cloud behavior, AI, embeddings, and broader semantic or resume-assembly redesign.

## Verification Contract Summary

- Named successor acceptance probe: `I08 Desktop Probe: Operator Runtime Input Drives Analysis`.
- Probe shape: run the desktop in probe mode, submit one operator-supplied runtime posting, capture the rendered metadata and result summary, then change the operator input and rerun in the same session. The probe must prove `runtimeError = null` on both runs, `requirementRegionAuthority = sqlite` on both runs, and at least one user-visible analysis outcome changes because the runtime input changed, demonstrating that the fixed overlay sample is no longer the live runtime input authority.
- Required proof boundary: the probe must also prove that the input remains runtime-only and per-run. The seam fails if the second run depends on persisted draft state, overlay edits, SQLite writes, profiles/settings defaults, or ps01 changes.
- Companion regression proof: `node --test proof-slices/ps01/ps01.test.mjs` must continue to pass unchanged once implementation exists because the seam depends on keeping ps01 behavior stable.

## Completion Rule

- Do not implement from this bundle alone.
- Do not mark the later seam complete because input fields exist or because a payload was added to the bridge.
- Do not treat UI state, invoke payloads, or probe payloads as canonical authority.
- Do not widen into saved postings, profiles/settings, schema/storage changes, or overlay-backed write paths.
- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.

## Approval Gates

- API: explicit implementation approval is required before changing the internal `load_source_authority` command contract and the corresponding desktop probe/report path.
- Schema and storage: not expected for this seam. If implementation pressure appears here, stop and reopen admissibility rather than planning around it.
- Project-intent authority: no new open-decision row is required now. If later work proposes saved postings, persisted defaults, or another authority change, open a pending decision before implementation.

## Handoff Packet For The Next Agent

- Goal: implement only `I08-S1` after explicit implementation approval is granted for the desktop runtime-input seam.
- Preserve unchanged: SQLite-backed requirement-region authority, `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings deferral, and the non-persisted status of job-posting input.
- Touch budget when later authorized: the narrowest desktop shell files needed to collect operator input, the narrowest bridge surface needed to pass runtime input into `load_source_authority`, and one successor desktop probe surface.
- Required proof before closeout: `I08 Desktop Probe: Operator Runtime Input Drives Analysis` passes, and `node --test proof-slices/ps01/ps01.test.mjs` still passes unchanged.
- Explicit stop rule: if implementation needs persistence, schema/storage changes, saved postings, profiles/settings widening, or ps01 edits, stop and open a fresh admissibility pass instead of widening this seam.

## Closeout Note

- This archived plan is retained as the historical planning artifact for implementation-08.
- `I08-S1` was later implemented and validated the same day, and the archive copy of this plan was written during closeout.
- Same-turn cleanup completed, and `harness/implementation-projects/active/` returned to `.gitkeep` only.