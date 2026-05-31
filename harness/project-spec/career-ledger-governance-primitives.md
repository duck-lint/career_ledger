# Career Ledger Governance Primitives

This file defines authority order, invariants, approval boundaries, admissible transformations, review checkpoints, and admissibility inputs for the approved greenfield semantic-traversal baseline.

It is a governance contract for future implementation work. It does not claim that the repository already ships the runtime described here.

## Authority Order

Use this order when deciding what the project may claim or change.

1. Explicit user-approved amendments and the current admissibility report for the active seam.
2. This governance file and the companion project spec.
3. The unchanged source-authority layer defined by the approved target: `experience_records`, `evidence_items`, taxonomy, profiles, and settings.
4. Approved future implementation evidence that stays inside this target contract.
5. Supporting harness material that does not contradict the approved target.

Important tie-breaker: if stale prose conflicts with the approved greenfield target, the stale prose is wrong and must be rewritten rather than implemented.

## Baseline-Authorized Decisions

The following decisions are already authorized for the target baseline.

- The project is greenfield relative to this semantic-traversal target.
- Canonical persisted source authority stays limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings.
- No new workspace tables, transition tables, or persisted semantic-state tables are part of the baseline.
- Semantic projection is runtime-only and in-memory.
- Traversal is deterministic, explainable, and evidence-bounded.
- Job-posting analysis produces a Target Semantic Region rather than stopping at matched tags.
- Resume assembly reconstructs supporting paths rather than reconstructing flat tag matches.
- Unsupported requirements remain visible.
- No AI, embeddings, hidden network calls, telemetry, or cloud dependencies are allowed.
- Semantic state language refers to positions and valid transitions, not workflow-status machines.

## Explicit Prohibitions

The following are banned in the baseline unless a later explicit decision authorizes them.

- AI-assisted analysis or generation in the semantic baseline
- embeddings, vector indexes, or semantic similarity stores
- persisted semantic workspaces
- persisted traversal ledgers or transition tables
- workflow-status state machines for semantic processing
- hidden provider adapters, cloud execution, telemetry, or network fallback
- any new canonical persisted truth layer beyond `experience_records`, `evidence_items`, taxonomy, profiles, and settings

## Core Invariants

These statements remain fixed unless the project explicitly amends the target contract.

- The source authority layer is unchanged and limited.
- Semantic projection and traversal are derived runtime behavior, not persisted baseline state.
- Traversal must always be explainable from source evidence and deterministic rules.
- Job-posting analysis defines a target semantic region, not merely a matched-tag ledger.
- Resume assembly must remain evidence-bounded.
- Unsupported requirements must remain visible rather than being hidden by optimistic generation.
- No hidden network, telemetry, cloud, AI, or embedding behavior is allowed.
- Semantic state must be described as semantic positions and valid transitions only.
- Workflow-status labels are not valid semantic-state categories.

## State Model Discipline

The allowed semantic-state form is:

- `Semantic Position -> Valid Transition -> Semantic Position`

This is the only approved baseline language for semantic state.

The following examples are explicitly disallowed as semantic-state categories:

- `Draft`
- `Review`
- `Approved`
- `Rejected`

If a proposal needs those labels, it is defining a workflow-status machine and must be escalated rather than smuggled into the semantic contract.

## Source, Derived, And Presentation Authority

### Source authority

The authoritative persisted source layer is limited to:

- `experience_records`
- `evidence_items`
- taxonomy
- profiles
- settings

### Derived authority

The following are approved as runtime-only derived artifacts:

- semantic projection graphs
- target semantic regions
- traversal scores and ranked paths
- resume-assembly provenance chains
- generated resume artifacts

Derived artifacts may be recomputed on demand. They must not silently widen into persisted semantic workspaces or transition-state storage.

### Presentation authority

The following are presentation or transport surfaces only and cannot become authority by drift:

- UI view state
- request payloads
- rendered artifacts
- debug traces or local caches

## Approval Boundaries

Require explicit approval before crossing any of these boundaries.

- Storage and schema changes.
  Any move to add new canonical tables, semantic workspaces, transition tables, or persisted traversal state.

- Semantic persistence changes.
  Any move to save target semantic regions, projected graphs, traversal results, or supporting paths as baseline state.

- AI or embedding changes.
  Any use of models, embeddings, vector retrieval, or probabilistic matching as part of the canonical baseline.

- Network, telemetry, or cloud changes.
  Any external service call, sync path, analytics, or hidden provider behavior.

- Workflow-status changes.
  Any proposal to model semantic processing with statuses such as `Draft`, `Review`, `Approved`, or `Rejected`.

- Artifact-contract changes.
  Any move away from evidence-bounded output with visible unsupported requirements and inspectable supporting paths.

## Admissible Transformations

The following changes are admissible inside an approved seam without a new product decision.

- Clarify documentation so it matches the approved greenfield target.
- Refine semantic projection rules while preserving runtime-only, deterministic, evidence-bounded behavior.
- Refine traversal scoring or ranking while preserving explainability and source evidence boundaries.
- Refine job-posting analysis while preserving the target semantic region contract.
- Refine resume assembly while preserving path reconstruction and unsupported-requirement visibility.
- Add tests, probes, or validation that falsify violations of this target contract.

The following changes are not admissible without approval.

- Reintroducing tag-first matching as the primary canonical contract.
- Adding persisted semantic workspaces, traversal history, or transition-status storage.
- Introducing AI, embeddings, vector stores, network calls, telemetry, or cloud dependencies.
- Recasting semantic state as a workflow-status machine.
- Hiding unsupported requirements or dropping supporting-path provenance from assembled output.

## Review Checkpoints

Use these checkpoints before closing behavior-facing work.

### Source-authority checkpoint

- Does persisted authority remain limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings?
- Did the seam avoid inventing workspace or transition tables?

### Semantic projection checkpoint

- Is the semantic graph runtime-only and in-memory?
- Are approved node kinds and edge kinds preserved?
- Is every projected relation traceable to source evidence or deterministic taxonomy rules?

### Job-posting checkpoint

- Does analysis produce a Target Semantic Region instead of a flat matched-tag result?
- Does the target region remain weighted and reviewable?

### Traversal checkpoint

- Does traversal search for highest-scoring paths from candidate semantic space into the target semantic region?
- Are path explanations inspectable and evidence-bounded?

### Resume-assembly checkpoint

- Does assembly reconstruct supporting paths instead of flat tag hits?
- Do unsupported requirements remain visible?
- Is provenance expressed as an evidence chain rather than a tag-only note?

### Privacy and locality checkpoint

- Did the seam avoid AI, embeddings, network behavior, telemetry, and cloud assumptions?
- Is the baseline still local-first and explicit about hidden dependencies being forbidden?

### Documentation checkpoint

- Do docs speak in truthful target language such as greenfield target, canonical target contract, or approved implementation target?
- Did the seam avoid claiming a shipped runtime or live schema proof that does not exist yet?

## Harness Admissibility Inputs

Every admissibility report for this repo should name these inputs explicitly.

- Invariant constraints.
  Source authority stays limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings; no new workspace tables, transition tables, or persisted semantic state; semantic projection and traversal are runtime-only; traversal is deterministic and evidence-bounded; no AI or embeddings; semantic state language means positions and valid transitions, not workflow statuses.

- Task constraints.
  Exact seam, editable files, forbidden surfaces, expected observable consequence, and acceptance criteria.

- Source evidence.
  The approved target contract in the project spec and governance docs plus any explicit user-approved amendments.

- Affected downstream surfaces.
  Canonical product intent, semantic-model implementation seams, future runtime validation, and future review criteria.

- Non-affected surfaces.
  All other harness docs, runtime code, schema, storage, tests, build config, and deployment assumptions unless separately approved.

- Assumptions.
  Any seam-local assumption that does not widen persistence, network behavior, workflow-state semantics, or product authority.

- Validation plan.
  The narrowest falsifiable check for the touched surface.

- Stop conditions.
  Missing source evidence, contradictory authority, missing acceptance criteria, or any need to add persisted semantic state, workflow-status state machines, AI, embeddings, network behavior, telemetry, or cloud assumptions.

## Open-Question Discipline

When future work hits a real unresolved question, record it explicitly in the harness decision surfaces. Do not quietly answer it by writing speculative canonical prose or by sneaking forbidden persistence or workflow concepts into implementation.
