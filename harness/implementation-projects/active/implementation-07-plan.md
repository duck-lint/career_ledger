# Implementation 07 Plan

## Intent

Implementation-07 now defines exactly one approval-gated executable seam: move requirement-region authority into SQLite-backed taxonomy authority while preserving the current visible desktop contract. The move applies only to `tag_requirement_links`, `requirements`, and `target_regions`, treated as taxonomy relationships and requirement-region definitions inside the existing approved taxonomy source category. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged, profiles/settings widening stays deferred, and the fixed sample `jobPostingInput` remains seam-local runtime input rather than canonical persisted authority.

## Admissibility Report

- Invariant constraints: Canonical persisted source authority remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, target semantic region selection, traversal scores and ranked paths, provenance chains, and assembled artifacts remain runtime-only, deterministic, explainable, and evidence-bounded. Unsupported requirements stay visible. No persisted semantic workspace, traversal ledger, transition table, workflow-status state, AI, embeddings, network, telemetry, or cloud behavior may be introduced.
- Task constraints: This bundle resolves PD-03 at decision-authority level in favor of SQLite-backed taxonomy authority for requirement-region semantics, stops before implementation work starts, keeps `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` explicitly unchanged, continues to defer profiles/settings widening, keeps the fixed sample `jobPostingInput` seam-local runtime input, and defines one successor desktop probe that proves SQLite-only requirement-region authority with no overlay fallback.
- Constraint conflicts: The current runtime still merges requirement-region semantics from `src-tauri/fixtures/source-authority-semantic-overlay.json`, but PD-03 now resolves that this is not the long-term authority surface. Moving `tag_requirement_links`, `requirements`, and `target_regions` into SQLite crosses a storage/schema approval boundary and is not implementation-approved by this bundle. This bundle relies on the user-approved thesis that those requirement-region semantics belong inside the existing taxonomy source category; if later implementation cannot represent them truthfully as taxonomy authority, implementation must stop and reopen governance rather than widen source authority by drift.
- Allowed transformation types: decision-level updates only in this plan, this tracker, and `harness/open-decisions.md`. No runtime, probe, SQLite, overlay, or ps01 edits are admissible in this task.
- Affected surfaces now: `harness/open-decisions.md`, this plan, and this tracker.
- Downstream surfaces when implementation is explicitly approved: `src-tauri/src/main.rs`, the successor desktop probe surface, and the SQLite-backed taxonomy authority path for requirement-region semantics. `desktop/probes/i06-desktop-probe.mjs` is the current fixture-level proof of the visible desktop contract that the successor probe must preserve.
- Non-affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, profiles/settings behavior, the current desktop information architecture, SQLite artifacts, overlay JSON, migrations, auth, deployment, compatibility promises, external APIs, AI, embeddings, telemetry, cloud behavior, and any broader taxonomy or resume-assembly redesign.
- Admissibility checks: This bundle is admissible only as planning. Later implementation of `I07-S1` becomes admissible only after explicit implementation approval is granted for the SQLite authority move.
- Stop conditions: Stop before implementation if explicit approval is missing, if the move would require unapproved storage/schema invention, if overlay fallback remains acceptable, if the fixed sample `jobPostingInput` is silently promoted into canonical persisted authority, if `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs` would need to change, or if profiles/settings widening is bundled into the seam.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the invariant authority.
- `harness/open-decisions.md` now carries PD-03 as a current decision rather than a pending comparison.
- `harness/implementation-projects/archive/implementation-06-summary.md` records the current overlay-backed requirement-region posture as a revisit trigger rather than a final authority choice.
- `src-tauri/src/main.rs` currently reads canonical tags, `experience_records`, and `evidence_items` from SQLite, then merges requirement-region semantics and the fixed sample `jobPostingInput` from `src-tauri/fixtures/source-authority-semantic-overlay.json` through `load_source_authority`.
- `desktop/main.js` already uses the generic `load_source_authority` path.
- `desktop/probes/i06-desktop-probe.mjs` is the current user-facing proof surface for the visible desktop contract: `Backend Systems` supported, `Mentoring` unsupported, stable rendered requirement ids, non-empty supporting ids, stable semantic-position shape, stable ordered path shape, and visible unsupported note.
- `proof-slices/ps01/source-authority-adapter.mjs` still marks `profiles` and `settings` as unused source authorities.

## Planned Seam

1. `I07-S1: Move requirement-region authority into SQLite-backed taxonomy authority while preserving the current desktop contract`

Seam boundary:

- Future implementation moves `tag_requirement_links`, `requirements`, and `target_regions` into SQLite-backed taxonomy authority and removes overlay fallback for those requirement-region semantics.
- The seam preserves the current visible desktop contract reached through `load_source_authority`.
- `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` remain unchanged.
- Profiles/settings remain deferred and unused by this seam.
- The fixed sample `jobPostingInput` remains seam-local runtime input. Persisting that sample input is out of scope and requires a separate explicit decision.
- This seam is blocked on explicit implementation approval because the approved direction crosses a storage/schema boundary.
- If later design work cannot keep these requirement-region semantics inside the approved taxonomy source category, stop and reopen governance before code rather than widening canonical persisted authority by implication.

Upstream dependency:

- PD-03 is already resolved in `harness/open-decisions.md`; this bundle is no longer comparing authority options.

Downstream consequence:

- After later implementation and proof, the repo can truthfully claim that requirement-region semantics are supplied by SQLite-backed taxonomy authority and that overlay fallback is no longer part of the contract for `tag_requirement_links`, `requirements`, or `target_regions`.

## Non-Goals

- No implementation in this bundle.
- No runtime, desktop, probe, overlay, SQLite, or ps01 edits.
- No profiles/settings widening.
- No persistence of the fixed sample `jobPostingInput`.
- No schema details by implication, no migration design, and no broader desktop, auth, deployment, network, telemetry, cloud, AI, or embedding work.

## Acceptance Criteria

- This bundle remains planning-only and defines exactly one seam: `I07-S1`.
- PD-03 is treated as resolved in favor of SQLite-backed taxonomy authority for requirement-region semantics rather than as a pending comparison.
- The bundle states explicitly that the approved move stays inside the existing taxonomy source category and does not create a new canonical persisted truth category.
- The bundle states explicitly that `tag_requirement_links`, `requirements`, and `target_regions` are the only approved requirement-region authority move in scope.
- The bundle states explicitly that `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged, profiles/settings widening remains deferred, and the fixed sample `jobPostingInput` remains seam-local runtime input.
- The bundle is blocked on explicit implementation approval for the SQLite authority move, not on unresolved decision authority.
- The bundle defines one named successor desktop probe that proves SQLite-only requirement-region authority with no overlay fallback while preserving the current visible desktop contract.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: planning-only and blocked on explicit implementation approval.
- Dominant fact: the decision authority is now settled; the remaining gate is whether to authorize implementation of the SQLite-backed taxonomy move for requirement-region semantics.
- User-facing acceptance for the later seam: from the same existing desktop screen, the operator can run the local analysis through `load_source_authority` and still see supported `Backend Systems` plus explicit unsupported `Mentoring`, while the successor desktop probe also proves that requirement-region authority came from SQLite only and not from overlay or fallback behavior.
- Truth rule: preserving visible output alone is insufficient. The later implementation is only complete when the probe proves both the current visible desktop contract and SQLite-only requirement-region authority.

## Current Repo Runtime State

- The current bridge already uses the generic `load_source_authority` command.
- The current runtime still composes one source object from two authority surfaces: SQLite for core source facts and `src-tauri/fixtures/source-authority-semantic-overlay.json` for requirement-region semantics plus the fixed sample `jobPostingInput`.
- The current I06 live probe already validates the visible result contract end to end.
- The current ps01 adapter still marks `profiles` and `settings` as unused.

## Assumptions And Unknowns

- The requirement-region authority move is the narrowest real post-I06 successor seam.
- The current visible desktop contract can be preserved while moving `tag_requirement_links`, `requirements`, and `target_regions` into SQLite-backed authority.
- The approved decision to move requirement-region authority into SQLite does not by itself authorize storage/schema implementation work.
- This bundle assumes `tag_requirement_links`, `requirements`, and `target_regions` can be represented truthfully inside the approved taxonomy source category; if that assumption fails, a separate governance amendment is required before implementation.
- The fixed sample `jobPostingInput` should remain seam-local runtime input unless a later explicit decision approves persistence.
- Profiles/settings widening remains intentionally deferred unless separately reprioritized.

## Affected and Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-07-plan.md`, `harness/implementation-projects/active/implementation-07-tracker.md`, and `harness/open-decisions.md`.
- Downstream surfaces when later implementation is approved: `harness/open-decisions.md`, `src-tauri/src/main.rs`, the successor desktop probe surface, and the SQLite-backed taxonomy authority path for requirement-region semantics.
- Read-only dependency surfaces for this bundle: the governing project-spec docs, `harness/open-decisions.md`, `harness/implementation-projects/archive/implementation-06-summary.md`, `desktop/main.js`, `desktop/probes/i06-desktop-probe.mjs`, and `proof-slices/ps01/source-authority-adapter.mjs`.
- Non-affected: `proof-slices/ps01/runtime-core.mjs`, `src-tauri/fixtures/source-authority-semantic-overlay.json` in this task, profiles/settings inputs and tests, broader UI layout, write paths, migrations, auth, deployment, cloud, telemetry, AI, embeddings, and any broader semantic traversal redesign.

## Verification Contract Summary

- Named successor acceptance probe: `I07 Desktop Probe: Requirement-Region Authority Is SQLite-Only`.
- Probe shape: run the same single-screen desktop flow through `load_source_authority`, preserve the I06 visible result contract (`runtimeError: null`, rendered ids `req-backend-systems` and `req-mentoring`, supported `Backend Systems`, unsupported `Mentoring`, non-empty supporting ids, stable semantic-position shape, stable ordered path shape, visible unsupported note), and also prove that `tag_requirement_links`, `requirements`, and `target_regions` are sourced from SQLite only with no overlay fallback.
- Required precondition: explicit implementation approval is granted for the SQLite authority move.
- Failure rule: the later seam fails if overlay fallback remains, if the visible desktop contract regresses, if `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs` must change, if profiles/settings widening is folded into the seam, or if the fixed sample `jobPostingInput` is silently persisted.

## Completion Rule

- Do not implement from this bundle alone.
- Do not treat the SQLite move as implementation-approved merely because PD-03 is resolved.
- Do not allow mixed overlay-plus-SQLite requirement-region authority to remain acceptable after this seam.
- Do not widen into profiles/settings.
- Do not silently persist the fixed sample `jobPostingInput`.
- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.

## Approval Gate

- Explicit implementation approval is required before any storage/schema work for `I07-S1` starts.
- If later implementation cannot ground the move inside the approved taxonomy source category, stop and open a separate governance amendment before code.
- If the later implementation proposal needs to persist the fixed sample `jobPostingInput`, open a separate explicit decision instead of folding that persistence into this seam.

## Handoff Packet For The Next Agent

- Goal: implement only `I07-S1` after explicit implementation approval is granted for the SQLite-backed taxonomy authority move for requirement-region semantics.
- Preserve unchanged: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, the current visible desktop result contract, and the current deferral of profiles/settings.
- Carry forward as fixed scope: move `tag_requirement_links`, `requirements`, and `target_regions` into SQLite-backed taxonomy authority only; keep the fixed sample `jobPostingInput` seam-local unless separately approved for persistence; do not allow overlay fallback.
- Touch budget when later authorized: `harness/open-decisions.md`, the narrowest bridge-and-probe surfaces needed to expose SQLite-only requirement-region authority, and the SQLite-backed taxonomy authority path for requirement-region semantics.
- Required proof before closeout: the named probe `I07 Desktop Probe: Requirement-Region Authority Is SQLite-Only` passes end to end.
- Explicit stop rule: if implementation would require unapproved storage/schema invention, mixed overlay-plus-SQLite fallback, ps01 changes, bundled profiles/settings widening, or silent persistence of the fixed sample `jobPostingInput`, stop and open a fresh admissibility pass before implementation.

## Closeout Note

- This active bundle is admissible only as planning until explicit implementation approval is granted.
- When `I07-S1` later completes or is intentionally retired, move the bundle from `active/` to `archive/`.