# Career Ledger Project Spec

This file defines the approved greenfield target for Career Ledger. It is a canonical target contract for future implementation work, not a claim that this repository already ships the runtime, schema wiring, or desktop behavior described here.

The companion governance file defines authority order, invariants, approval boundaries, and admissibility rules. This file defines the intended product thesis, source authority, runtime-only semantic projection and traversal model, resume-assembly contract, and acceptance probes that future implementation work must satisfy.

## Product Thesis

Career Ledger is a local-first career evidence system that helps a user maintain an authoritative source library and assemble targeted resume artifacts without turning generated output into source truth.

The approved target keeps the durable source layer intentionally small:

- `experience_records` store employment and project records.
- `evidence_items` store bounded claims attached to those records.
- taxonomy data stores canonical user-controlled vocabulary and relationship hints.
- profiles store candidate profile facts such as education and certifications.
- settings store generation policy and other explicit operator preferences.

The semantic system is not a second persisted workspace. It is a runtime-only projection over those sources plus a job-posting input. Artifact generation must remain evidence-bounded: unsupported requirements stay visible instead of being hidden behind fluent but unsupported output.

## Target Runtime Shape

This project is approved against a greenfield target with these constraints:

- the authoritative persisted source layer remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings
- there are no new workspace tables, transition tables, or persisted semantic-state tables in the target baseline
- semantic projection and traversal are runtime-only and in-memory
- traversal is deterministic and evidence-bounded
- there are no AI calls, embeddings, hidden network paths, telemetry, or cloud assumptions
- semantic state language refers to positions and valid transitions, not workflow-status labels

## Source Authority

Future implementations must preserve this authority order.

### Canonical persisted source state

The only approved source-of-truth categories are:

- `experience_records`
- `evidence_items`
- taxonomy
- profiles
- settings

These persisted sources remain authoritative even when semantic projection or traversal derives richer runtime structure.

### Derived runtime state

The following state is approved as derived, runtime-only state:

- semantic projection graph
- job-posting analysis output
- target semantic region selection
- traversal scores and supporting paths
- assembled resume artifact and provenance view

Derived runtime state may be recomputed on demand. It must not silently become a persisted workspace model, a transition ledger, or a hidden review queue.

## Semantic Projection Layer

The target runtime introduces a Semantic Projection Layer that projects persisted source facts into an in-memory graph structure. The projection is runtime-only and deterministic.

### SemanticNode

The projection layer uses `SemanticNode` values for the following approved kinds:

- `Experience`
- `Evidence`
- `Tag`
- `Certification`
- `Education`
- `Requirement`

### SemanticEdge

The projection layer uses `SemanticEdge` values for the following approved kinds:

- `demonstrates`
- `supports`
- `uses`
- `implies`
- `relates_to`

### Projection rules

- projection starts from persisted source facts and explicit job-posting input only
- projection may infer semantic adjacency from approved taxonomy relationships and explicit source facts
- projection must remain explainable from persisted evidence and deterministic rules
- projection must not invent unsupported candidate capability
- projection must not persist the projected graph as a new baseline store

## Job Posting Layer

Job-posting analysis in the target baseline does not stop at matched tags. It produces a Target Semantic Region that the traversal layer can navigate toward.

Example target semantic region for `Senior Backend Engineer`:

- `Rust` with weight `1.0`
- `API Design` with weight `0.9`
- `Distributed Systems` with weight `0.9`
- `Testing` with weight `0.8`
- `Ownership` with weight `0.7`
- `Mentoring` with weight `0.6`

The important output is the weighted semantic region, not a flat list of matched tags. The region defines what the traversal layer is trying to reach and explain.

## Traversal Layer

The target runtime introduces a Traversal Layer that searches for the highest-scoring paths from candidate semantic space to target job semantic space.

Traversal must satisfy these constraints:

- start from projected candidate nodes grounded in source evidence
- score deterministic paths into the target semantic region
- prefer stronger evidence-supported paths over shallow keyword coincidence
- keep path explanations inspectable by the operator
- remain runtime-only and recomputable

The style of supporting paths is explicit. Examples:

- `Project A -> Rust -> API Design -> Backend Systems`
- `Job Requirement -> Backend Systems`

Those examples are path shapes, not persisted rows. The traversal layer uses them to explain why evidence was selected and how candidate evidence semantically reaches a requirement region.

## Resume Assembly

Resume assembly in the target baseline is path reconstruction, not tag reconstruction.

Current-style comparison to preserve intent:

- Current: `Requirement matched Rust. Include Rust evidence.`
- Future: `Requirement matched Backend Systems. Strongest supporting path: Project A -> Rust -> API Design -> Backend Systems. Include that evidence chain.`

Assembly must therefore:

- reconstruct the strongest supporting semantic path for included evidence
- expose the evidence chain behind each supported requirement region
- keep unsupported requirements visible when no qualifying path exists
- avoid claiming support when traversal cannot produce an evidence-bounded path

Generated artifacts remain derived outputs. They do not become source truth.

## State Model Language

Semantic state language is allowed only in the form:

- `Semantic Position -> Valid Transition -> Semantic Position`

This language describes reachable runtime semantic positions and deterministic transitions between them.

The following workflow-status language is explicitly forbidden in the baseline semantic model:

- `Draft`
- `Review`
- `Approved`
- `Rejected`

Those labels describe workflow states, not semantic state. They must not be used to define the semantic traversal contract.

## Evidence Boundary And Visibility

The target baseline keeps these output rules:

- artifact generation is evidence-bounded
- unsupported requirements remain visible
- provenance must expose the supporting evidence chain
- no hidden network, telemetry, provider, or cloud assumption may sit behind analysis or traversal

## Not Part Of The Approved Baseline

The following are not part of the approved target contract unless a later decision explicitly authorizes them:

- persisted semantic workspaces
- persisted traversal histories or transition tables
- workflow-status state machines for semantic processing
- AI-driven analysis or generation paths
- embeddings or vector stores
- hidden browser, server, cloud, or telemetry assumptions
- any new canonical source tables beyond `experience_records`, `evidence_items`, taxonomy, profiles, and settings

## Acceptance Probes

These probes are the review checkpoints future implementation work should satisfy before claiming conformance to this target spec.

### Source-authority probe

Question: does the implementation keep authoritative persistence limited to the approved source layer?

Required proof: persisted truth remains limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings, with no new workspace or transition tables introduced as baseline authority.

### Semantic projection probe

Question: does the implementation build a runtime-only semantic graph from approved sources?

Required proof: the runtime can project `Experience`, `Evidence`, `Tag`, `Certification`, `Education`, and `Requirement` nodes plus approved edge kinds without persisting that graph.

### Job-posting analysis probe

Question: does job-posting analysis produce a target semantic region rather than only matched tags?

Required proof: a posting such as `Senior Backend Engineer` yields a weighted region including `Rust`, `API Design`, `Distributed Systems`, `Testing`, `Ownership`, and `Mentoring`.

### Traversal probe

Question: does the implementation find the highest-scoring candidate-to-target paths?

Required proof: traversal can explain a supported requirement with path shapes such as `Project A -> Rust -> API Design -> Backend Systems` and `Job Requirement -> Backend Systems`.

### Resume-assembly probe

Question: does assembly reconstruct evidence-supported paths instead of flat tag matches?

Required proof: supported output includes the strongest supporting path and evidence chain for a requirement region, and unsupported requirements remain visible when no path qualifies.

### State-model probe

Question: does the implementation keep semantic state language distinct from workflow-status language?

Required proof: semantic transitions are expressed as `Semantic Position -> Valid Transition -> Semantic Position`, and the semantic model does not use workflow-status enums such as `Draft`, `Review`, `Approved`, or `Rejected`.

### Privacy and locality probe

Question: does the implementation avoid hidden external dependencies?

Required proof: there is no AI, embeddings, telemetry, network, or cloud dependency in the semantic projection and traversal baseline.

## Review Notes For Future Implementation

Use this spec as the canonical target when reviewing future implementation seams.

- If a change adds persisted semantic state, stop and escalate.
- If a change reintroduces tag-first artifact logic as the primary contract, treat that as drift from the approved target.
- If a change uses workflow-status language for semantic state, reject it as a contract violation.
- If a change weakens evidence-bounded visibility for unsupported requirements, reject it as a product-regression risk.
