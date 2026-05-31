# Implementation 04 Plan

## Intent

Implementation-04 opens exactly one planning-only active seam for the first desktop caller around the already proven adapter and runtime core. The seam is limited to one local-only desktop window or screen, one fixture-backed analysis action, and one read-only result view that renders one supported and one unsupported requirement result from the desktop caller. This bundle does not start implementation. Raw Tauri scaffolding, generated config, or an empty window without the named desktop acceptance probe is scaffold-only and cannot count as application behavior.

## Admissibility Report

- Invariant constraints: Persisted source authority must remain limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, target-region selection, traversal scores and paths, and assembled results remain runtime-only derived state. No workspace tables, transition tables, persisted semantic state, workflow-status state, AI, embeddings, network calls, telemetry, or cloud behavior may be introduced. Unsupported requirements must remain visible. Traversal remains deterministic, explainable, and evidence-bounded.
- Task constraints: The bundle is limited to one desktop caller seam around the existing `proof-slices/ps01/source-authority-adapter.mjs` and `proof-slices/ps01/runtime-core.mjs` contract. It stays local-only, fixture-backed, and non-persistent, with one window or screen, one analysis action, and one read-only result view. It must not widen into editing flows, schema decisions, multi-screen IA, deployment work, or any new runtime contract. Tauri UI state must remain presentation only.
- Constraint conflicts: None at planning time. The repo has no desktop shell surface yet, so some support scaffold will be required during implementation, but scaffold support cannot be counted as behavior.
- Allowed transformation types: Create one minimal desktop bootstrap surface, one local bridge or command surface, one single-screen read-only presentation surface, one local fixture surface, one seam-local desktop acceptance test or probe surface, and the associated archive records when the seam is complete.
- Affected surfaces: The active implementation-04 plan and tracker now. If implementation is later approved, the affected runtime-facing surfaces are limited to one new desktop bootstrap surface, one new desktop bridge or command surface, one new single-screen presenter surface, one new local fixture surface, and one new desktop acceptance probe surface. The existing proof files remain dependency surfaces.
- Non-affected surfaces: `harness/project-spec/**`, `harness/open-decisions.md`, archived bundles, schema, storage, auth, deployment, external API, AI, embedding, telemetry, cloud, persistence, editing flows, multi-screen IA, and the current contracts in `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs`.
- Admissibility checks: The desktop caller must route through `assembleApprovedSourceFactsProof` without widening the adapter or runtime-core contract. The seam must stay local-only, non-persistent, and presentation-only in UI state. The named desktop probe must show one supported and one unsupported requirement result in the same read-only view. No hidden external dependency or forbidden boundary decision may be introduced.
- Stop conditions: Stop if implementation requires widening the adapter or runtime-core contract, adding persisted state, adding more than one screen, adding an editing flow, introducing schema or storage decisions, or making deployment, external service, AI, embedding, telemetry, or cloud assumptions. Stop if the named desktop probe cannot be executed or observed locally.

## Planned Seams

1. `I04-S1: First local-only desktop caller around the proven adapter/core`

Seam boundary:

- The new desktop caller owns only one window or screen, one operator-triggered analysis action, one fixture-backed request path, and one read-only result view.
- The caller invokes `assembleApprovedSourceFactsProof` from `proof-slices/ps01/source-authority-adapter.mjs` and renders its returned supported and unsupported requirement output without widening the adapter or the runtime-core contract.
- Any Tauri bootstrap or config created only to host this flow is support-only. It is not acceptance evidence and cannot be used to claim application behavior.
- Presentation state stays local to the screen for loading, error, and visible result state only. It cannot become semantic authority, workflow state, or persisted state.

Upstream dependency:

- Archived implementation-03 proved the reusable runtime core and approved-source adapter with 7 passing tests, but did not prove any desktop caller behavior.

Downstream consequence:

- If implemented successfully, the repo may truthfully claim exactly one seam-local desktop behavior: a local desktop caller can run one bounded analysis against a fixture and show supported and unsupported requirement output in a read-only view. It still would not prove editing flows, storage wiring, multi-screen information architecture, or broader Tauri application behavior.

## Non-Goals

- No editing or authoring flows.
- No schema, storage, auth, deployment, external API, AI, embedding, telemetry, cloud, or network decisions.
- No new persisted semantic state or workflow-status state.
- No multi-screen IA, navigation shell, menus, or settings surfaces.
- No widening of the runtime-core or source-authority adapter contract.
- No claim that Tauri scaffolding alone is meaningful behavior.

## Acceptance Criteria

- The bundle plans exactly one seam: `I04-S1`.
- The named seam-local acceptance probe is `I04 Probe: Desktop Caller Shows Supported Backend Systems And Unsupported Mentoring`.
- The future implementation must route one fixture-backed analysis action from the desktop caller through the existing source-authority adapter into the existing runtime core and render one supported requirement result and one unsupported requirement result in the same read-only view.
- The supported result must preserve the current evidence-bounded path and provenance semantics from the proven runtime contract.
- The unsupported result must remain explicit and visible. It cannot be collapsed into empty success or hidden by the caller.
- UI state must remain presentation only and non-persistent.
- Raw Tauri scaffolding, generated config, an empty window, or bridge plumbing without the named probe passing counts only as scaffold-only progress, not application behavior.

## Delivery Posture

- State of this bundle: proposed, planning-only, not implemented.
- Implementation-04 opens the first desktop-caller seam only. It does not authorize adjacent seams or follow-on desktop architecture.
- Review burden stays tied to the named probe and the narrow touched-surface set.

## Current Repo Runtime State

- The repo currently contains harness surfaces and `proof-slices/ps01` only.
- Archived implementation-03 proved `proof-slices/ps01/runtime-core.mjs` plus `proof-slices/ps01/source-authority-adapter.mjs` with 7 passing tests.
- No desktop shell, no Tauri bootstrap, no window or screen, and no desktop caller acceptance evidence exist yet.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` continue to authorize runtime-only, deterministic, evidence-bounded derived behavior and forbid persistence widening, workflow-status semantics, AI, embeddings, network, telemetry, and cloud assumptions.
- `harness/open-decisions.md` continues to hold PD-01 as the current governing direction.
- The repo root currently exposes only harness and proof-slices surfaces, and `harness/implementation-projects/active/` was otherwise empty before this bundle.
- Archived implementation-03 explicitly states that desktop caller behavior remains unproved.
- `proof-slices/ps01/source-authority-adapter.mjs` exports `assembleApprovedSourceFactsProof`, and `proof-slices/ps01/runtime-core.mjs` exports the current proof contract that the desktop seam must preserve.

## Assumptions And Unknowns

- A minimal desktop scaffold can be introduced locally without forcing deployment, persistence, or multi-screen architecture decisions.
- The exact Tauri frontend and testing harness is not present yet, so implementation must choose the narrowest executable local probe available at that time.
- If desktop execution requires widening the adapter contract or inventing new persisted UI state, the seam is no longer admissible without re-planning.

## Affected And Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-04-plan.md` and `harness/implementation-projects/active/implementation-04-tracker.md`.
- Affected when implementation is approved: one minimal desktop bootstrap surface, one local desktop bridge or command surface, one single-screen read-only presenter surface, one local fixture surface, and one seam-local desktop acceptance test or probe surface.
- Read-only dependency surfaces for the future implementer: `proof-slices/ps01/source-authority-adapter.mjs` and `proof-slices/ps01/runtime-core.mjs`.
- Non-affected: project spec, governance, open decisions, archived bundles, schema, storage, auth, deployment surfaces, external dependencies, persistence, editing flows, multi-screen IA, and any new source-authority category.

## Verification Contract Summary

- Named falsifiable acceptance probe: `I04 Probe: Desktop Caller Shows Supported Backend Systems And Unsupported Mentoring`.
- Probe shape: from one local desktop window or screen, trigger one analysis action against a built-in fixture, route through `assembleApprovedSourceFactsProof`, and render a read-only result view that shows one supported `Backend Systems` requirement with its evidence-bounded path and provenance plus one explicit unsupported `Mentoring` requirement in the same result.
- Failure rule: if the desktop flow only proves scaffold boot, empty rendering, command invocation without result rendering, or result rendering without both supported and unsupported outcomes, the seam is not complete.

## Handoff Packet For The Next Agent

- Goal: implement only `I04-S1` if and when implementation is authorized.
- Existing computation boundary to preserve: call the current adapter entry point in `proof-slices/ps01/source-authority-adapter.mjs`; do not widen the contracts in `proof-slices/ps01/source-authority-adapter.mjs` or `proof-slices/ps01/runtime-core.mjs`.
- Exact future touch surfaces: one desktop bootstrap surface, one desktop bridge or command surface, one single-screen read-only UI surface, one local fixture surface, and one desktop acceptance test or probe surface. No second screen, no editing surface, and no persistence surface.
- Required user-facing probe: `I04 Probe: Desktop Caller Shows Supported Backend Systems And Unsupported Mentoring`.
- Review standard: scaffold-only progress does not count. The seam closes only on the named desktop probe.

## Completion Rule

- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.
- Raw Tauri scaffolding, generated bootstrap files, or a visible empty window without the named desktop probe passing is scaffold-only and cannot count as application behavior.
- Do not mark implementation-04 complete until the desktop caller proves one supported and one unsupported requirement result in the same read-only view through the existing adapter/core boundary.

## Approval Gates

- [ ] Schema
- [ ] API
- [ ] Auth
- [ ] Storage
- [ ] Deployment
- [ ] Destructive operation
- [ ] Broad architecture
- [ ] Project-intent authority not covered by spec or current authorization

## Closeout Note

- When this bundle completes, move it from `active/` to `archive/`.
- If implementation pressure exceeds the single desktop caller seam, stop and request a new admissibility pass rather than widening this bundle in place.