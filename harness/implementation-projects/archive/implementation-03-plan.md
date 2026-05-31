# Implementation 03 Plan

## Intent

Implementation-03 completed exactly one archived seam that turned the PS-01 proof into a reusable runtime-core plus a thin source-authority adapter, while keeping the behavior runtime-only, deterministic, evidence-bounded, and still proven by one executable end-to-end path from approved source-shaped facts through projection, target-region selection, ranked path reconstruction, and explicit unsupported output.

## Admissibility Report

- Invariant constraints: Persisted source authority remained limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, target-region selection, traversal scores and paths, and assembled results remained runtime-only derived state. No workspace tables, transition tables, persisted semantic state, workflow-status state, AI, embeddings, network calls, telemetry, or cloud behavior was added. Unsupported requirements remained visible. Traversal stayed deterministic, explainable, and evidence-bounded.
- Task constraints: The bundle stayed limited to one reusable runtime-core surface, one thin source-authority adapter surface, seam-scoped tests, and the implementation-03 archive record. The seam preserved PS-01 ranking, path reconstruction, and unsupported-output behavior. The adapter used only approved source-shaped categories actually needed in this seam. `profiles` and `settings` remained explicitly unused. Visible Tauri shell work, schema, storage, auth, deployment, external API, AI, embedding, telemetry, and cloud surfaces stayed out of scope.
- Constraint conflicts: None observed.
- Allowed transformation types completed: The current PS-01 pure runtime logic was extracted into `proof-slices/ps01/runtime-core.mjs` without changing the verified ranking contract; `proof-slices/ps01/ps01.mjs` stayed a thin compatibility re-export; one thin adapter accepted approved source-shaped facts for the categories actually used and derived a weighted target region from job-posting cue terms; seam-scoped tests were updated so the named acceptance probe ran through the adapter into the core.
- Affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/ps01.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, `proof-slices/ps01/ps01.test.mjs`, and the archived implementation-03 bundle under `harness/implementation-projects/archive/`.
- Non-affected surfaces: `harness/project-spec/**`, `harness/open-decisions.md`, archived implementation-01 and implementation-02 bundles, visible Tauri shell and UI surfaces, schema, storage, auth, deployment, export formatting, external APIs, compatibility promises, AI, embeddings, telemetry, network, and cloud assumptions.
- Admissibility checks satisfied: The runtime core stayed pure and runtime-only. The adapter consumed only approved source-shaped facts for `experience_records`, `evidence_items`, and taxonomy in this seam. `profiles` and `settings` stayed explicitly unused. The end-to-end probe still yielded one supported requirement with ranked path reconstruction and one explicit unsupported requirement in the same result. No visible Tauri shell work was required.
- Stop conditions triggered: None.

## Planned Seam

1. `I03-S1: Approved-source adapter to reusable runtime-core proof path`

`I03-S1` was the sole authorized seam for implementation-03 and is now complete and archived.

Seam boundary:

- The runtime-core surface in `proof-slices/ps01/runtime-core.mjs` owns projection from normalized seam input into the in-memory graph, explicit target-region normalization, deterministic valid-path ranking, selected-path reconstruction, semantic-position reporting, supported-result assembly, and explicit unsupported-result assembly. `proof-slices/ps01/ps01.mjs` remains a thin compatibility re-export so the PS-01 proof entry surface stays stable.
- The thin adapter surface in `proof-slices/ps01/source-authority-adapter.mjs` owns only the translation from approved source-shaped facts into the current core input shape and deterministic target-region derivation from taxonomy requirement cue terms in `jobPostingInput`. In this seam, that means `experience_records`, `evidence_items`, and taxonomy only. `profiles` and `settings` remained explicitly unused and did not become projected input in implementation-03.
- The test surface in `proof-slices/ps01/ps01.test.mjs` owns the executable seam evidence. The named acceptance probe now runs through the adapter and into the runtime core instead of bypassing the adapter with proof-only fixtures.

Upstream dependency:

- Archived PS-01 behavior in implementation-02 remained the governing runtime evidence for deterministic ranking, path reconstruction, semantic-position reporting, and explicit unsupported visibility.

Downstream consequence:

- The repo now has one truthful adapter boundary around the approved source authority used so far and one reusable runtime-core entry point without claiming storage wiring, shipped Tauri behavior, storage design, schema, or a broader app runtime.

## Non-Goals

- Visible Tauri shell work remained out of scope for implementation-03.
- No schema, storage, auth, deployment, external API, compatibility, or export-format decision was part of this bundle.
- No workflow-status state, persisted semantic state, transition ledger, or hidden cache was added.
- No new node kinds, edge kinds, source-authority categories, or target-region policy beyond the current PS-01 proof contract was introduced.
- `profiles` and `settings` stayed unused in this seam and were not widened into the adapter or runtime core.
- No shell scaffolding, window wiring, or app-facing UI integration was part of this bundle.

## Acceptance Criteria

- The bundle implemented exactly one seam: `I03-S1: Approved-source adapter to reusable runtime-core proof path`.
- The named seam-local acceptance probe is `I03 Probe: Approved Source Facts To Ranked Requirement Output`.
- The probe runs from approved source-shaped facts plus `jobPostingInput` through the adapter into target-region derivation, projection, ranked path reconstruction, and final supported-plus-unsupported output.
- The supported result preserves the existing PS-01 ranking contract, ordered path reconstruction, semantic-position sequence, and evidence-bounded provenance fields.
- The unsupported result stays explicit and remains visible in the same output contract when no evidence-backed path qualifies.
- The adapter reads only `experience_records`, `evidence_items`, taxonomy, and `jobPostingInput` for this seam. `profiles` and `settings` remained explicitly unused.
- No visible Tauri shell work or forbidden boundary decision was introduced.

## Delivery Posture

- State of this bundle: complete and archived for one seam only.
- Final outcome: executable evidence for a reusable runtime-core plus source-authority adapter boundary, not shell scaffolding and not a broader runtime rollout.
- Tauri shell status: explicitly out of scope throughout implementation-03. No visible Tauri shell code, commands, routes, windows, or bindings belong to the proved seam.

## Final Repo Runtime State For This Bundle

- The runtime logic for this seam now lives under `proof-slices/ps01` as a reusable runtime core with a proof-slice-local source-authority adapter.
- `proof-slices/ps01/ps01.mjs` remains the compatibility surface for the archived PS-01 proof entry point.
- `proof-slices/ps01/ps01.test.mjs` proves the adapter-driven seam and keeps explicit unsupported output visible in the verified slice.
- No visible Tauri shell or shipped application runtime surface exists in the repo posture relevant to this seam.

## Observed Evidence

- The project spec and governance files continued to authorize runtime-only semantic projection and traversal and continued to forbid persisted semantic workspaces, workflow-status state, and hidden external dependencies.
- `harness/open-decisions.md` remained unchanged and continued to record PD-01 as current.
- Archived implementation-02 remained the governing proof posture for deterministic ranking, path reconstruction, and unsupported-output visibility.
- `node --test proof-slices/ps01/ps01.test.mjs` passed with 7 tests.
- The named probe `I03 Probe: Approved Source Facts To Ranked Requirement Output` passed through the adapter into the runtime core.
- Final reviewer feedback reported no blocking or non-blocking issues and recommended archive closeout.

## Assumptions And Unknowns

- The approved source-shaped facts needed for this seam were expressible without choosing concrete storage or schema wiring.
- The archived PS-01 input shape was close enough to the approved source-shaped facts that one thin adapter could bridge them without widening authority.
- Future bundles may choose a different long-term runtime location, but implementation-03 did not need to make that broader architecture decision because the seam stayed reusable and executable at the current proof surface.
- If future implementation pressure requires `profiles`, `settings`, new node kinds, or new edge kinds, that remains a new admissibility question rather than an extension of implementation-03.

## Affected And Non-Affected Surfaces

- Affected for the bundle: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/ps01.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, `proof-slices/ps01/ps01.test.mjs`, and the archived implementation-03 harness bundle.
- Non-affected: all Tauri shell and UI surfaces, persistence and schema surfaces, build and deployment surfaces, project-spec and governance authority files, open-decisions, archived implementation-01 and implementation-02 bundles, and all forbidden external-dependency categories.

## Verification Contract Summary

- Named falsifiable acceptance probe: `I03 Probe: Approved Source Facts To Ranked Requirement Output`.
- Probe shape: given approved source-shaped facts for `experience_records`, `evidence_items`, and taxonomy plus `jobPostingInput`, the adapter deterministically derives a weighted target region from taxonomy requirement cue terms, then feeds the runtime core so that one supported requirement returns the highest-ranked evidence-backed path with ordered sequence, semantic positions, and provenance, while one second requirement in the same selected region remains explicit as unsupported.
- Verification completed by `proof-slices/ps01/ps01.test.mjs`; the named probe is the required user-facing acceptance evidence for this bundle.
- Failure rule outcome: the probe passed without bypassing the adapter, widening source authority, or adding Tauri/storage/external behavior.

## Completion Rule

- Implementation-03 is archived complete because the named probe runs through the adapter into the runtime core and proves both supported path reconstruction and explicit unsupported visibility without crossing forbidden boundaries.
- This archived plan does not claim broader runtime conformance, Tauri shell behavior, storage design, schema choices, or shipped app behavior beyond the verified seam.

## Approval Gates

- No approval gates were crossed.
- No schema, API, auth, storage, deployment, destructive-operation, broad-architecture, or uncovered project-intent boundary change was required.

## Closeout Note

- The canonical plan record now lives under `harness/implementation-projects/archive/`.
- The active implementation-03 plan was removed during same-turn archive cleanup.