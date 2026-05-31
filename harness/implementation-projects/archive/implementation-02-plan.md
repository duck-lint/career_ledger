# Implementation 02 Plan

## Intent

Define and complete the first admissible runtime proof slice as one in-memory, deterministic, evidence-bounded traversal slice that consumes approved source authority through fixtures or an adapter contract and produces provenance-style assembly output without choosing storage, schema, UI, or deployment.

## Archive Status

- State: implementation complete and archived.
- Completed seam: PS-01 in-memory requirement-region traversal to provenance assembly.
- Validation status: `node --test proof-slices/ps01/ps01.test.mjs` passed with 5 tests on 2026-05-31 after the same-turn determinism repair.
- Scope limit: this bundle proves one slice-local, in-memory traversal path only. It does not prove broader runtime conformance, storage design, shipped behavior, or any widened contract beyond PS-01.

## Admissibility Report

- Invariant constraints: Persisted source authority stays limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, target semantic region selection, traversal scores and paths, and resume artifacts remain runtime-only derived state. No workspace tables, transition tables, or persisted semantic-state tables are part of the baseline. Traversal must be deterministic, explainable, and evidence-bounded. No AI, embeddings, network calls, telemetry, or cloud dependencies are allowed. Semantic state may be expressed only as semantic positions and valid transitions, not workflow-status categories.
- Task constraints: This bundle defines and completes exactly one end-to-end proof slice. Source authority remains in-memory fixtures or an adapter contract, not a concrete storage design. The slice bounds semantic node and edge types, target semantic region input, deterministic path scoring, path reconstruction, and provenance-style assembly output. Validation remains seam-scoped to PS-01. Escalation would have been required if schema, storage, deployment, auth, external API, AI, embedding, telemetry, or cloud decisions became necessary.
- Constraint conflicts: None observed.
- Allowed transformation types: Start one active bundle, define one in-memory proof slice, implement that slice, verify it, archive the completed bundle, and defer all runtime widening until later explicit approval.
- Affected surfaces: `proof-slices/ps01/ps01.mjs`, `proof-slices/ps01/ps01.test.mjs`, and this implementation-02 bundle under `harness/implementation-projects/archive/`.
- Non-affected surfaces: Project spec, governance primitives, open decisions, implementation-01 archive, persistence, schema, auth, deployment, external API, compatibility, cloud, telemetry, AI, embeddings.
- Admissibility checks: The slice stayed entirely in memory. The slice did not choose concrete storage. The slice exposed one falsifiable end-to-end probe. Unsupported requirements remained visible. Traversal state stayed modeled only as semantic positions and valid transitions.
- Stop conditions: No stop condition was triggered during PS-01. The bundle would have stopped if it required persisted tables, graphs, ledgers, or workflow-status state; could not be stated as a falsifiable acceptance probe; forced a concrete storage decision; crossed schema, storage, auth, deployment, external API, AI, embedding, telemetry, or cloud boundaries; or claimed runtime conformance beyond the slice evidence.

## Planned Seams

1. PS-01: In-memory requirement-region traversal to provenance assembly.

PS-01 consumes read-only fixtures or a source adapter contract for the slice-needed subset of `experience_records`, `evidence_items`, and taxonomy relations, with no concrete storage wiring. The bounded node kinds are `Experience`, `Evidence`, `Tag`, and `Requirement`. The bounded edge kinds are `demonstrates`, `uses`, and `supports`. The target semantic region input is an ordered list of weighted requirement targets with stable ids, labels, and weights. Traversal enumerates valid simple paths from source-backed candidate nodes into each target requirement; a valid path must include at least one `Evidence` node tied to an approved source record. Paths rank by the score tuple `(evidence support count descending, explicit relation weight sum descending, hop count ascending, stable path key ascending)`, using only weights supplied by the fixtures or adapter output. Path reconstruction returns the selected best path for each requirement as an ordered node and edge sequence plus the semantic positions traversed. Provenance-style assembly returns either a supported result with selected path, supporting `experience_record` ids, supporting `evidence_item` ids, and a short explainable rationale, or an explicit unsupported result with no invented support.

## Non-Goals

- Concrete SQLite, schema, adapter, or persistence design.
- UI flows, Tauri wiring, export formatting, or artifact templates.
- Multi-region ranking, profile enrichment, or settings-driven policy behavior.
- Additional node or edge kinds beyond this proof slice.
- Workflow-status enums, persisted semantic state, transition ledgers, or hidden derived stores.
- AI, embeddings, network calls, telemetry, or cloud dependencies.

## Acceptance Criteria

- Exactly one end-to-end proof slice is defined and remains fully in memory.
- The slice contract uses source fixtures or an adapter boundary instead of concrete storage.
- The slice exposes only the bounded node and edge kinds named in this plan.
- The slice defines deterministic path validity, deterministic ranking, path reconstruction, and provenance-style assembly output.
- Unsupported requirements remain visible in the output contract.
- The implementation is falsified or supported by the named probe `PS-01 Probe: Backend Systems Path Reconstruction`.
- No storage, schema, auth, deployment, external API, AI, embedding, telemetry, or cloud decision is made by this bundle.

## Delivery Posture

- State of this bundle: archived after completion of the sole authorized seam.
- This bundle implemented one proof slice and seam-scoped tests only.
- No additional seam is authorized by this archived plan.

## Current Repo Runtime State

- The repo now contains one validated proof slice under `proof-slices/ps01` for this task.
- The proof remains bounded to fixtures or a source-adapter contract and in-memory traversal logic.
- The approved runtime direction remains recorded separately under PD-01.
- No broader runtime module layout, storage wiring, or shipped feature surface is implied by this archived bundle.

## Observed Evidence

- The approved decision authority already fixes the project direction as runtime-only semantic projection and traversal with no persisted semantic workspace or workflow-status state.
- The canonical project spec and governance primitives already prohibit AI, embeddings, network behavior, telemetry, cloud dependencies, and persisted semantic or transition tables.
- `proof-slices/ps01/ps01.mjs` and `proof-slices/ps01/ps01.test.mjs` exist for the implemented seam.
- `node --test proof-slices/ps01/ps01.test.mjs` passed with 5 tests, including the named probe, the seam-bounded determinism and rejection checks, and the non-ASCII stable-order regression check.
- Final reviewer feedback after the same-turn determinism repair reported no remaining runtime, contract, or harness-state issues for implementation-02.

## Assumptions And Unknowns

- The verified slice is sufficient to demonstrate one admissible in-memory traversal path without deciding storage shape.
- Taxonomy relations needed for the slice can be provided as explicit fixture inputs or adapter output fields.
- Runtime module layout and future language surface remain intentionally undecided beyond `proof-slices/ps01`.
- Later slices may need additional node kinds or policy behavior, but this bundle does not authorize or prove them.
- Shipped behavior, integration posture, and persistence boundaries remain unknown and unproven by this bundle.

## Affected and Non-Affected Surfaces

- Affected now: `proof-slices/ps01/ps01.mjs`, `proof-slices/ps01/ps01.test.mjs`, and the archived implementation-02 harness bundle.
- Non-affected: project-spec, governance primitives, open decisions, archived implementation-01 memory, persistence, auth, deployment, external API, compatibility, and all forbidden external dependencies.

## Verification Contract Summary

- Named falsifiable acceptance probe: `PS-01 Probe: Backend Systems Path Reconstruction`.
- Probe shape: given fixture input with one supported target requirement `Backend Systems` and one unsupported target requirement `Mentoring`, the implementation must select the highest-ranked evidence-backed path for `Backend Systems`, return its ordered node and edge sequence plus source provenance, and keep `Mentoring` visible as unsupported.
- Required checks completed: one contract test for allowed node and edge kinds, one deterministic ranking test that repeats the same input without output drift, one rejection test for paths lacking evidence support, and one end-to-end probe test for supported plus unsupported requirement output in the same region.
- Failure rule remained unchanged: if implementation had required persisted semantic state, workflow-status categories, or concrete storage decisions to satisfy the probe, work would have stopped and escalated instead of widening the seam.

## Handoff Packet

- From: Planner
- To: Implementer, Reviewer, Archivist
- Requested action completed: implement PS-01 only, entirely in memory, against fixtures or a source adapter contract, then archive the bundle after verification.
- Delivered change: the minimum runtime-local contracts and logic needed to build bounded nodes and edges, rank valid paths deterministically, reconstruct the winning path, and assemble provenance-style output with unsupported requirements left visible.
- Boundaries not authorized and not crossed: schema, storage, auth, deployment, external API, compatibility, workflow-status modeling, AI, embeddings, telemetry, network, cloud.

## Completion Rule

- This bundle is complete only for the verified PS-01 proof scope.
- Do not claim broader runtime conformance, storage design, or shipped behavior from this bundle.
- Unsupported requirements remain visible in the verified slice and continue to mark proof limits rather than hidden completion.

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

- The sole authorized seam is complete, verified, and archived.
- The archive copy is canonical for completed implementation state.
- The active implementation-02 plan and tracker were removed during same-turn archive cleanup, leaving `active/` placeholder-only.
- Leave `harness/open-decisions.md` unchanged because it already points to still-authoritative archived decision context and no stale implementation-02 pointer required cleanup.