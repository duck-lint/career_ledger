# Implementation 07 Plan

## Intent

Implementation-07 opens exactly one planning-only seam for the post-I06 requirement-region authority question. This bundle does not implement either near-term option. It compares the two admissible immediate directions now visible after I06: keep `src-tauri/fixtures/source-authority-semantic-overlay.json` as an explicit local authority surface for requirement-region semantics, or seek explicit approval to move requirement-region authority into SQLite. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` remain unchanged in either case, and profiles/settings widening stays deferred until this authority question is resolved or separately reprioritized.

## Admissibility Report

- Invariant constraints: Canonical persisted authority remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, target-region selection, traversal, ranked paths, and assembled output remain runtime-only, deterministic, explainable, and evidence-bounded. Unsupported requirements remain visible. No AI, embeddings, network, telemetry, cloud behavior, workflow-status state, persisted semantic workspaces, or transition tables may be introduced.
- Task constraints: This bundle is planning-only, edits only planning and decision surfaces, defines exactly one future seam, compares two near-term authority options without implementing either, preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, and defers profiles/settings widening.
- Constraint conflicts: The live runtime already composes requirement-region semantics from `src-tauri/fixtures/source-authority-semantic-overlay.json`, while `PD-02` and the implementation-06 summary both name that surface as a revisit trigger rather than settled long-term authority. Leaving the overlay in place requires making that authority posture explicit. Moving requirement-region authority into SQLite would cross a source-authority and likely storage/schema approval boundary. `harness/open-decisions.md` now carries this as pending decision `PD-03`.
- Allowed transformation types: Create the active implementation-07 plan and tracker, record the live pending decision in `harness/open-decisions.md`, compare the two near-term options, define one future executable seam, and define one future desktop acceptance probe without answering the authority question by drift.
- Affected surfaces: This plan, this tracker, and pending decision `PD-03` in `harness/open-decisions.md` now. If later authorized, the seam must move together across `harness/open-decisions.md`, the Tauri bridge in `src-tauri/src/main.rs`, the live desktop probe surface, and exactly one chosen requirement-region authority surface: either `src-tauri/fixtures/source-authority-semantic-overlay.json` as explicit local authority or approved SQLite-backed requirement-region storage/query surfaces.
- Non-affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles, settings, the current desktop information architecture, write paths, migrations, auth, deployment, network, telemetry, cloud, AI, embeddings, and any broader taxonomy or resume-assembly redesign.
- Admissibility checks: This bundle is admissible only as planning. Later implementation of `I07-S1` becomes admissible only after the requirement-region authority question is explicitly captured in decision authority, the user chooses one option, and any SQLite move receives explicit approval before code changes begin.
- Stop conditions: Stop before implementation if the authority choice remains implicit; if moving authority into SQLite would require unapproved schema/storage invention; if either option would force `runtime-core.mjs` or `source-authority-adapter.mjs` changes; if profiles/settings widening is treated as bundled follow-on work; or if no desktop probe can falsify mixed or fallback requirement-region authority.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the invariant authority.
- `harness/open-decisions.md` keeps `PD-02` current and explicitly names two revisit triggers relevant here: the semantic overlay becoming persisted SQLite authority, and profiles/settings widening.
- `harness/open-decisions.md` now carries pending decision `PD-03` for the requirement-region authority question.
- `harness/implementation-projects/archive/implementation-06-summary.md` records implementation-06 as complete and states that the semantic overlay remains seam-local and should be revisited if requirement-region authority needs to become persisted SQLite authority.
- `src-tauri/src/main.rs` now loads canonical tags, `experience_records`, and `evidence_items` from SQLite read-only, then merges requirement-region semantics and job-posting input from `src-tauri/fixtures/source-authority-semantic-overlay.json` behind the generic `load_source_authority` path.
- `desktop/main.js` invokes `load_source_authority` and passes the returned object into `assembleApprovedSourceFactsProof`.
- `desktop/probes/i06-desktop-probe.mjs` proves the current live desktop result contract: `Backend Systems` supported, `Mentoring` unsupported, stable rendered requirement ids, non-empty supporting ids, stable semantic-position shape, stable ordered path shape, and visible unsupported note.
- `proof-slices/ps01/source-authority-adapter.mjs` still reports `profiles` and `settings` as unused source authorities.
- `harness/implementation-projects/active/` contained only `.gitkeep` before this bundle.

## Planned Seam

1. `I07-S1: Make the requirement-region authority source explicit and probeable without widening the ps01 contract`

Seam boundary:

- The seam does not answer the authority question in planning by drift. It prepares the narrowest later implementation boundary that can truthfully support either approved direction while preserving the current I06 desktop result contract.
- Near-term option A keeps `src-tauri/fixtures/source-authority-semantic-overlay.json` as an explicit local authority surface for `tag_requirement_links`, `requirements`, `target_regions`, and the fixed job-posting input. If this option is chosen later, implementation-07 should only make that local-authority posture explicit in decision authority and probe-visible runtime evidence while keeping SQLite limited to canonical tags, `experience_records`, and `evidence_items`.
- Near-term option B seeks explicit approval to move requirement-region authority into SQLite. If this option is chosen later, implementation-07 must stop for approval before code because it changes where authoritative requirement-region semantics live and may open schema/storage review depending on what the current SQLite basis can actually represent.
- The narrowest next executable seam after the decision is therefore the same in both cases: one bridge-and-probe slice that exposes exactly one chosen requirement-region authority source through `load_source_authority`, preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged, preserves the current visible desktop contract, and keeps profiles/settings unused.

Upstream dependency:

- Yes: `harness/open-decisions.md` now carries pending decision `PD-03` for the requirement-region authority question because the next seam is blocked on a real unresolved authority choice.

Downstream consequence:

- If option A is later chosen, the repo can truthfully claim that requirement-region semantics are supplied by an explicit local authority surface paired with SQLite-backed source facts, rather than by an accidental temporary overlay.
- If option B is later chosen and approved, the repo can truthfully claim that requirement-region authority is SQLite-backed, but only after the storage/source-authority move is implemented and proven without overlay fallback.

## Non-Goals

- No implementation in this bundle.
- No decision resolution in `harness/open-decisions.md` in this task beyond recording the pending question.
- No change to `src-tauri/src/main.rs`, `desktop/main.js`, `desktop/probes/i06-desktop-probe.mjs`, `src-tauri/fixtures/source-authority-semantic-overlay.json`, or SQLite artifacts in this bundle.
- No change to `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs`.
- No profiles/settings widening or adapter-contract widening.
- No schema/storage approval by implication, no taxonomy redesign beyond the requirement-region authority choice, and no broader desktop, auth, deployment, network, telemetry, cloud, AI, or embedding work.

## Acceptance Criteria

- This bundle remains planning-only and defines exactly one future seam: `I07-S1`.
- The bundle compares the two near-term authority options without implementing either one.
- The bundle states explicitly that `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged and that profiles/settings widening remains deferred.
- The bundle states clearly that `harness/open-decisions.md` now carries pending decision `PD-03` and that the authority choice itself remains unresolved.
- The bundle defines one named desktop acceptance probe for the later seam that can falsify the chosen authority source while preserving the current visible desktop contract.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: planning-only and blocked on decision authority.
- Dominant fact: after I06, the remaining live question is not whether the desktop can render the current contract, but whether requirement-region semantics should stay on an explicit local overlay surface or move into SQLite with approval.
- User-facing acceptance for the later seam: from the same existing desktop screen, the operator can run the local analysis through `load_source_authority` and still see supported `Backend Systems` plus explicit unsupported `Mentoring`, while the live desktop probe also proves that requirement-region semantics came from exactly the chosen authority source and not from mixed or fallback authority.
- Truth rule: preserving visible output alone is insufficient for this seam. The later implementation is only complete when the desktop probe proves both the current visible contract and the chosen requirement-region authority source.

## Current Repo Runtime State

- The current bridge already uses the generic `load_source_authority` command and composes one source object from two authority surfaces: SQLite for source facts and `src-tauri/fixtures/source-authority-semantic-overlay.json` for requirement-region semantics.
- The desktop caller already targets the generic source-authority path.
- The current I06 live probe already validates the visible result contract end to end.
- The current ps01 adapter still marks `profiles` and `settings` as unused, which keeps those surfaces outside the next seam unless separately reprioritized.

## Assumptions And Unknowns

- The requirement-region authority question is the narrowest real post-I06 follow-up seam.
- Option A is admissible without a storage/schema approval gate if the project explicitly accepts the local overlay as the authority surface for requirement-region semantics.
- Option B is not automatically admissible just because other source facts already come from SQLite; it needs explicit approval and may also need schema/storage clarification depending on the current SQLite basis.
- It is not yet proven that the current SQLite basis can represent `tag_requirement_links`, `requirements`, `target_regions`, and fixed job-posting input without additional storage work.
- Profiles/settings widening remains intentionally deferred unless the user separately reprioritizes it after the authority question is resolved.

## Affected and Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-07-plan.md`, `harness/implementation-projects/active/implementation-07-tracker.md`, and `harness/open-decisions.md`.
- Affected when later implementation is authorized: `harness/open-decisions.md`, `src-tauri/src/main.rs`, the live desktop probe surface, and exactly one chosen requirement-region authority surface.
- Read-only dependency surfaces: the governing project-spec docs, `harness/open-decisions.md`, `harness/implementation-projects/archive/implementation-06-summary.md`, `desktop/main.js`, `desktop/probes/i06-desktop-probe.mjs`, and `proof-slices/ps01/source-authority-adapter.mjs`.
- Non-affected: `proof-slices/ps01/runtime-core.mjs`, profiles/settings inputs and tests, broader UI layout, write paths, migrations, auth, deployment, cloud, telemetry, AI, embeddings, and any broader semantic traversal redesign.

## Verification Contract Summary

- Named later acceptance probe: `I07 Desktop Probe: Requirement-Region Authority Source Matches Decision`.
- Probe shape: run the same single-screen desktop flow through `load_source_authority`, preserve the I06-visible result contract (`runtimeError: null`, rendered ids `req-backend-systems` and `req-mentoring`, supported `Backend Systems`, unsupported `Mentoring`, non-empty supporting ids, stable semantic-position shape, stable ordered path shape, visible unsupported note), and also assert one explicit requirement-region authority marker that equals the recorded decision outcome: `local-overlay` for option A or `sqlite` for option B.
- Required precondition: pending decision `PD-03` is recorded, the user selects one option, and any SQLite move receives explicit approval before implementation.
- Failure rule: the later seam fails if requirement-region authority remains implicit, if mixed or fallback authority is used, if the visible desktop contract regresses, if `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs` must change, or if profiles/settings widening is folded into the seam.

## Completion Rule

- Do not implement from this bundle alone.
- Do not treat the existing overlay as silently settled long-term authority without recording the pending decision and a chosen outcome.
- Do not treat a future SQLite move as already authorized merely because the current bridge already reads other source facts from SQLite.
- Do not widen into profiles/settings before the requirement-region authority question is resolved or separately reprioritized.
- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.

## Approval Gates

- No approval gate is crossed by creating this planning bundle.
- Future implementation must stop for explicit approval if option B is chosen because moving requirement-region authority into SQLite changes project-intent authority and may also cross schema/storage review boundaries.
- If option A is chosen, no schema/storage approval gate is implied, but the decision still must be captured explicitly so the repo can speak truthfully about the local overlay as an authority surface.

## Handoff Packet For The Next Agent

- Goal: implement only `I07-S1` after the requirement-region authority question is recorded in `harness/open-decisions.md` and the user chooses option A or option B.
- Preserve unchanged: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, the current visible desktop result contract, and the current deferral of profiles/settings.
- Decision package to carry forward: option A keeps `src-tauri/fixtures/source-authority-semantic-overlay.json` as explicit local authority; option B seeks approval to move requirement-region authority into SQLite; do not mix them.
- Touch budget when later authorized: `harness/open-decisions.md`, the narrowest bridge-and-probe surfaces needed to expose the chosen authority source, and exactly one chosen requirement-region authority surface.
- Required proof before closeout: the named probe `I07 Desktop Probe: Requirement-Region Authority Source Matches Decision` passes end to end.
- Explicit stop rule: if the chosen direction would require schema/storage invention beyond approved authority, mixed overlay-plus-SQLite requirement-region fallback, `proof-slices/ps01` changes, or bundled profiles/settings widening, stop and open a fresh admissibility pass before implementation.

## Closeout Note

- This active bundle is admissible only as planning until the requirement-region authority decision is made explicit.
- When the authority question is resolved and the one planned seam later completes or is intentionally retired, move the bundle from `active/` to `archive/`.