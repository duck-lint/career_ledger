# Career Ledger Project Spec

This document is the portable product and architecture specification for Career Ledger. A fresh harness in a new repository should be able to read this file and the companion governance primitives file and understand what to build without relying on any prior Python implementation, historical repo paths, or prototype code.

The companion governance file defines authority, approval boundaries, admissible transformations, and review checkpoints. This file defines the product thesis, target workflow, target architecture, state model, quality bar, acceptance probes, and open questions.

## Product Thesis

Career Ledger is a local-first Rust/Tauri desktop application for maintaining a user-owned factual career library and constructing evidence-backed resume artifacts through a governed semantic state-transition process.

The product exists because career evidence should be canonical, inspectable, reusable, and resistant to unsupported claim drift. The user maintains a durable library of experience records, evidence, tags, claims, constraints, and career context. A supplied job description becomes a target seed that creates a target semantic space. The user's library creates a library semantic space. The system traverses and cross-references those spaces to propose candidate evidence, claims, sections, gaps, and revisions. The user reviews and approves those transition results before any generated artifact is treated as an output.

Generated resumes, exports, manifests, rendered documents, and analysis reports are derived outputs. They never become the canonical source of truth. The canonical persisted source is the local SQLite career library and its explicitly governed operational ledgers.

## Primary Stack

The primary target stack is Rust plus Tauri.

- Tauri is the desktop shell and primary operator surface.
- Rust owns the core application logic, storage access, semantic state machine, provider adapters, artifact generation, and privacy boundaries.
- SQLite is the canonical local persistence layer.
- The local filesystem is used for user-selected imports, exports, and rendered artifacts.
- Python may be mentioned only as prototype or reference history. Python is not the target architecture, not the source of contract truth, and not a required runtime for the product described here.

## Baseline Build Profile

The first buildable product profile is authorized and does not require any external provider, model, cloud service, or unresolved index decision.

- Primary runtime: a Rust/Tauri desktop application. Tauri owns the desktop shell; Rust owns domain logic, migrations, persistence, transitions, semantic traversal, artifact construction, and policy enforcement.
- Persistence: local SQLite with migrations managed by Rust. SQLite is the canonical source for library state, target seeds, transition ledgers, snapshots, review decisions, artifacts, and manifests.
- Provider mode: local-only baseline. The MVP makes no network calls and requires no external model. Future embedding, extraction, reranking, or generation providers are optional adapters and require explicit provider/privacy decisions before use.
- Semantic index baseline: a SQLite-backed semantic graph built from normalized terms, canonical tags, target spans, evidence links, simple lexical similarity, co-occurrence signals, recency/context metadata, scores, and explanation fields. Optional embeddings or provider-backed indexes can be added later as adapters without replacing the baseline contract.
- Transition persistence: an append-only transition ledger plus materialized snapshots for current target runs, semantic projections, traversal workspaces, drafts, and artifacts.
- Review granularity: candidate alignment and claim option approval first, then whole-draft approval before artifact emission. Finer bullet or section approval can be added later, but the baseline cannot skip these gates.
- Artifact baseline: structured JSON artifact, Markdown export, and provenance manifest first. PDF and DOCX are later renderer decisions.
- Generated wording policy: the baseline proposes claim options from stored evidence text, stored signal claims, claim ceilings, and user-approved revisions. Every wording option must retain evidence references and claim-ceiling notes. Unsupported target requirements become visible gaps rather than invented claims.

This profile is the default implementation target. Open questions apply to extensions beyond this baseline, not to whether the baseline may be built.

## Desired User Workflow

The primary workflow is:

1. Maintain the career library.
   The user adds and revises experience records, evidence items, signal claims, tags, claim ceilings, and contextual notes. The application validates writes before they enter SQLite.

2. Ingest a job description as a target seed.
   The user supplies a JD or related posting material. The system stores the source text, user-provided context, and parsing metadata as a target seed. The seed does not mutate the career library.

3. Build semantic spaces.
   The target seed is projected into a target semantic space containing requirements, responsibilities, domains, constraints, seniority signals, tools, outcomes, keywords, ambiguities, and missing-context markers. The career library is projected into a library semantic space containing evidence-grounded capabilities, domains, accomplishments, tools, outcomes, roles, chronology, and claim ceilings.

4. Traverse and cross-reference semantic spaces.
   The state machine proposes candidate alignments between target semantic nodes and library semantic nodes. It can rank, cluster, explain, or flag candidates using deterministic rules, embeddings, model calls, or hybrid methods, but every transition must remain inspectable and evidence-bounded.

5. Review candidate evidence, claims, sections, and gaps.
   The user sees why evidence was proposed, what claim it can safely support, what wording ceilings constrain it, which target requirements remain uncovered, and which candidates were rejected or deferred. User approval is required before candidates become draft resume state.

6. Emit artifacts with provenance.
   Approved draft state can produce structured resume artifacts, gap reports, provenance manifests, and rendered documents. Artifacts record their source target seed, selected evidence, transition lineage, provider configuration where relevant, and user approval state.

## Non-Goals

Career Ledger is not:

- A SaaS resume writer.
- A hidden cloud service.
- A Python-first product.
- A deterministic-only resume compiler that hard-codes one brittle ranking path.
- An unbounded AI writing surface that invents claims beyond evidence.
- A system where generated artifacts become editable source of truth.
- A compatibility program for legacy databases, legacy payloads, or prototype record shapes.
- A UI-first mock that can bypass SQLite, provenance, transition auditing, or review gates.

## Data And Truth Model

SQLite is canonical for persisted user-owned state and explicitly governed operational state. A target implementation should define migrations and storage modules for at least these conceptual entities:

- Library records: factual employment, project, education, credential, or other approved experience entities.
- Evidence items: source-backed support for claims, including descriptions, dates, artifacts, metrics, links, notes, and provenance metadata.
- Signal claims: concise claims that evidence can support.
- Claim ceilings: anti-drift constraints that bound safe verbs, qualifiers, and implications.
- Taxonomy and tags: normalized labels for capabilities, domains, tools, contexts, seniority, outcomes, and other retrieval dimensions.
- Application contexts: user intent for a target resume run, such as role family, location, constraints, emphasis, and risk tolerance.
- Target seeds: job descriptions or related target materials supplied by the user.
- Semantic projections: derived target and library semantic nodes, edges, embeddings, annotations, scores, and extraction metadata.
- Candidate alignments: first-class derived records that connect target semantic nodes to library semantic nodes, evidence, signal claims, scoring rationale, and traversal method metadata.
- Claim options: first-class derived wording choices produced from candidate alignments, evidence references, signal claims, claim ceilings, and wording policy.
- Gap items: first-class derived records for unsupported, weak, ambiguous, stale, or missing target requirements.
- Review queue items: first-class derived records that expose candidate alignments, claim options, gaps, drafts, or artifacts as stable subjects for user review.
- Transition ledger: inspectable state-machine events, inputs, outputs, user actions, provider configuration, hashes, timestamps, and explanations.
- Draft resume state: approved or pending sections, claims, ordering, gaps, alternatives, and unresolved review items.
- Artifact manifests: emitted artifact identifiers, hashes, source state references, selected evidence references, provider configuration, and render metadata.

The library remains target-neutral. Semantic projections are derived from the library, target seed, provider outputs, and deterministic transformations. They may be cached in SQLite for auditability and performance, but cache persistence does not make them more authoritative than the underlying library and target seed.

Every generated claim that appears in a draft or artifact must reference supporting evidence. If a claim cannot be tied to evidence, it must be presented as a gap, prompt for user input, or excluded.

## Minimum SQLite Contract

The MVP schema may use JSON payload columns for flexible semantic metadata, but the following entities and fields are normative enough for a fresh implementation to build against. All tables must have stable IDs, created timestamps, updated timestamps where records are mutable, and foreign keys where references are local.

- `library_records`: `id`, `record_type`, `title`, `organization_or_context`, `date_start`, `date_end`, `status`, `summary`, `source_refs_json`, `metadata_json`, `created_at`, `updated_at`. These records hold user-owned career facts and do not belong to a target run.
- `evidence_items`: `id`, `library_record_id`, `evidence_type`, `evidence_text`, `source_label`, `source_uri`, `source_hash`, `date_observed`, `metrics_json`, `provenance_json`, `status`, `created_at`, `updated_at`. Evidence items are the support surface for claims.
- `signal_claims`: `id`, `library_record_id`, `claim_text`, `evidence_refs_json`, `tags_json`, `claim_ceiling_id`, `status`, `created_at`, `updated_at`. Claims are reusable library signals, not generated resume bullets.
- `claim_ceilings`: `id`, `subject_ref_kind`, `subject_ref_id`, `safe_verbs_json`, `qualifiers_json`, `do_not_imply_json`, `notes`, `created_at`, `updated_at`. Ceilings bound safe wording for evidence, claims, candidates, and draft text.
- `canonical_tags`: `id`, `normalized_name`, `category`, `description`, `status`, `created_at`, `updated_at`; and `tag_assignments`: `id`, `tag_id`, `subject_ref_kind`, `subject_ref_id`, `created_at`. Tags provide normalized retrieval and semantic grouping.
- `target_runs`: `id`, `status`, `provider_mode`, `active_seed_id`, `active_draft_snapshot_id`, `active_artifact_id`, `context_json`, `created_at`, `updated_at`. A target run owns derived work for one JD or target intent.
- `target_seeds`: `id`, `target_run_id`, `source_text`, `source_label`, `source_uri`, `source_hash`, `user_context_json`, `parse_status`, `created_at`, `updated_at`. Seeds store the supplied JD or related target material without mutating the library.
- `semantic_nodes`: `id`, `target_run_id`, `space_kind`, `node_kind`, `normalized_term`, `display_text`, `source_ref_kind`, `source_ref_id`, `target_span_json`, `evidence_refs_json`, `tags_json`, `score_json`, `explanation`, `metadata_json`, `status`, `created_at`, `updated_at`. `space_kind` is `target` or `library` in the baseline.
- `semantic_edges`: `id`, `target_run_id`, `source_node_id`, `target_node_id`, `edge_kind`, `weight`, `method`, `evidence_refs_json`, `explanation`, `metadata_json`, `status`, `created_at`, `updated_at`. Edges record lexical similarity, co-occurrence, tag overlap, chronology, context, or explicit user/provider provenance.
- `candidate_alignments`: stable `id`, `target_run_id`, `target_node_refs_json`, `library_node_refs_json`, `evidence_refs_json`, `signal_claim_refs_json`, `score_json`, `method_json`, `explanation`, `status`, `transition_event_id`, `created_at`, `updated_at`. Candidate alignments are first-class traversal outputs, not unnamed objects inside a transition payload or draft snapshot.
- `claim_options`: stable `id`, `target_run_id`, `candidate_alignment_id`, `option_text`, `evidence_refs_json`, `signal_claim_refs_json`, `claim_ceiling_refs_json`, `wording_policy_json`, `status`, `transition_event_id`, `created_at`, `updated_at`. Claim options are first-class wording subjects and must retain evidence and ceiling references.
- `gap_items`: stable `id`, `target_run_id`, `target_node_refs_json`, `gap_kind`, `reason`, `weak_candidate_refs_json`, `status`, `transition_event_id`, `created_at`, `updated_at`. Gap items are first-class review subjects for unsupported, weak, ambiguous, stale, or missing target requirements.
- `review_queue_items`: stable `id`, `target_run_id`, `subject_ref_kind`, `subject_ref_id`, `review_kind`, `status`, `rationale`, `created_at`, `updated_at`. Review queue items expose stable subjects for user review and must point to first-class rows rather than JSON payload members.
- `transition_events`: `id`, `target_run_id`, `transition_type`, `transition_status`, `actor`, `occurred_at`, `input_refs_json`, `output_refs_json`, `preconditions_json`, `postconditions_json`, `method_json`, `provider_config_json`, `provider_output_refs_json`, `prompt_or_policy_refs_json`, `hashes_json`, `explanation`, `error_json`, `payload_json`. This is the append-only event surface for state-machine audit.
- `review_decisions`: `id`, `target_run_id`, `transition_event_id`, `subject_ref_kind`, `subject_ref_id`, `decision_type`, `decision_status`, `user_text`, `evidence_refs_json`, `claim_ceiling_refs_json`, `created_at`. Decisions record acceptance, rejection, revision, and whole-draft approval without rewriting factual evidence. For candidate, claim, gap, or queue review, `subject_ref_kind` must reference a stable first-class subject such as `candidate_alignment`, `claim_option`, `gap_item`, or `review_queue_item`; whole-draft or artifact decisions may reference `draft_snapshot` or `artifact_manifest`. It must not reference opaque JSON payload members.
- `draft_snapshots`: `id`, `target_run_id`, `status`, `sections_json`, `approved_candidate_refs_json`, `claim_option_refs_json`, `gap_refs_json`, `transition_event_id`, `content_hash`, `created_at`. Draft snapshots are derived and discardable.
- `artifact_manifests`: `id`, `target_run_id`, `draft_snapshot_id`, `artifact_kind`, `status`, `file_path`, `content_hash`, `manifest_json`, `transition_event_id`, `rendered_at`, `created_at`. Baseline artifact kinds are `structured_json`, `markdown`, and `manifest`.

Baseline transition events must be sufficient to reconstruct why a state changed even when snapshots provide the current working view. `transition_events.output_refs_json` must include stable references to any `candidate_alignments`, `claim_options`, `gap_items`, `review_queue_items`, snapshots, artifacts, or manifests produced by the transition. Flexible JSON fields are allowed for semantic metadata, but they cannot hide required IDs, statuses, source references, evidence references, target spans, hashes, explanations, approval state, or first-class review subjects.

## Extracted Portable Schema Contracts

These contracts are extractable from the current repository and are worth carrying into a fresh Rust/Tauri implementation because they reinforce source-of-truth discipline, evidence bounds, and auditability without tying the new repo to Python-era structure.

- Identifier contract.
  Persisted entities use opaque stable text IDs rather than user-facing strings as primary keys. Human-facing slugs, labels, or display names may exist, but they are separate from canonical IDs.

- Timestamp contract.
  All persisted entities require `created_at`. Mutable entities require `updated_at`. Append-only ledgers and immutable event rows use immutable occurrence timestamps rather than mutable update timestamps.

- Foreign-key contract.
  SQLite foreign keys must be enabled on every connection. Parent-child relations must be explicit in schema and enforced in storage code rather than treated as application-only discipline.

- Canonical-child contract.
  `evidence_items` must reference exactly one parent `library_record`. `signal_claims` must reference the library record or evidence they summarize. Review subjects, drafts, manifests, semantic projections, and transition rows must reference their owning `target_run`.

- Cascade-or-fail contract.
  Canonical child rows must either cascade with their parent or block deletion with an explicit conflict policy. The baseline recommendation is cascade for owned children such as evidence under library records and derived target-run state under target runs, with destructive actions surfaced clearly in the UI.

- Tag normalization contract.
  Canonical tag names are normalized lowercase snake case and must be unique. Tag assignments must be unique per `(subject_ref_kind, subject_ref_id, tag_id)` pair so the same tag is not silently duplicated on one subject.

- Claim-ceiling shape contract.
  Claim ceilings remain bounded to three logical fields only: `safe_verbs`, `qualifiers`, and `do_not_imply`. Each field is an ordered list of strings or null. Extra keys do not belong in the baseline contract.

- Target-seed source contract.
  A target seed must preserve either source text or a source-file reference plus a source hash, source label, and run context. Derived target semantic nodes are invalid unless they can point back to target spans, recorded extraction metadata, or explicit user-authored transitions.

- Semantic-provenance contract.
  Semantic nodes, edges, candidate alignments, claim options, and gaps must link back to stored observables, recorded transition events, or explicitly recorded provider outputs. A semantic row with no source refs, evidence refs, target refs, or transition lineage is out of contract.

- Review-subject identity contract.
  Candidate alignments, claim options, gap items, and review queue items are first-class persisted review subjects with stable IDs. Review decisions must target those IDs directly, not anonymous JSON payload members.

- Artifact-shape contract.
  The baseline structured artifact should preserve the separation already proven useful in the current repo: top-level `resume`, `gap_report`, and `provenance` surfaces remain distinct. Rendered artifacts consume that structured artifact plus its manifest; they do not become the source for reconstructing provenance.

- Provenance-minimum contract.
  `provenance` must include selected library record IDs, selected evidence IDs, claim-to-evidence mappings, transition references, hashes, and human-inspectable notes. If a rendered artifact cannot be traced back to those fields, it does not satisfy the baseline.

- Requirement-semantics source contract.
  The target semantic space must preserve enough source detail to recover a normalized keyword bank, extraction method, target role family, and stable node references for requirements or equivalent target concepts. If richer cluster or atom views are materialized later, they must use stable IDs within a target run.

- Import-ledger contract for future migration work.
  If raw intake or migration import is implemented, it should use explicit run and item ledgers with counts, outcomes, and skip reasons, rather than silently mutating the library with no replayable record.

## Lifecycle Status Vocabularies

The baseline must use explicit lifecycle states rather than ad hoc booleans.

- `target_run.status`: `seed_created`, `semantics_ready`, `traversal_ready`, `review_pending`, `draft_ready`, `artifact_approved`, `artifact_rendered`, `blocked`, `archived`.
- `semantic_nodes.status` and `semantic_edges.status`: `current`, `stale`, `discarded`, `failed`.
- `candidate_alignments.status`, `claim_options.status`, and `gap_items.status`: `proposed`, `review_pending`, `accepted`, `rejected`, `revised`, `superseded`.
- `review_queue_items.status`: `review_pending`, `resolved`, `superseded`, `discarded`. `resolved` requires a recorded review decision or transition event that closes the queue item.
- `draft_snapshots.status`: `assembling`, `review_pending`, `approved`, `discarded`, `superseded`.
- `artifact_manifests.status`: `planned`, `rendered`, `failed`, `superseded`.
- `transition_events.transition_status`: `succeeded`, `failed`, `discarded`.

Additional statuses require governance review because each status must map to observable data, a recorded transition, or a user decision.

## Architecture

The target architecture has these layers:

- Tauri desktop UI.
  Provides library CRUD, target seed ingestion, review queues, transition inspection, provider configuration, artifact preview, export controls, and user approval gates. It must not contain canonical validation rules that are unavailable to the Rust core.

- Rust application core.
  Owns domain validation, workflow orchestration, state-machine transitions, semantic projection, candidate proposal, artifact construction, and policy enforcement.

- SQLite storage layer.
  Owns migrations, typed query APIs, transactions, foreign-key enforcement, local path metadata, and persisted ledgers. All writes to canonical library state pass through explicit validation and conflict policy.

- Semantic index layer.
  Owns derived semantic nodes, edges, lexical indexes, similarity search, explanation metadata, and cache invalidation. The baseline implementation is the SQLite-backed semantic graph described above. Embeddings, vector indexes, and provider-backed retrieval are beyond-baseline extensions that must be explicit about provider boundaries.

- Provider adapter layer.
  Owns embedding, extraction, reranking, generation, or model-backed analysis adapters. Each adapter must declare privacy behavior, network behavior, persisted configuration, input/output logging policy, deterministic controls when available, failure modes, and fallback behavior.

- State-machine layer.
  Owns allowed states, transition types, transition preconditions, transition outputs, review gates, replay and audit metadata, and rules for discarding or reversing proposed changes.

- Artifact layer.
  Owns structured resume artifacts, provenance manifests, gap reports, and renderers such as PDF, DOCX, Markdown, or JSON. Rendering must not reinterpret selection or invent claims.

The product should be organized around target concepts, not prototype files. Useful module names might include `storage`, `library`, `target_seed`, `semantic_space`, `providers`, `transitions`, `review`, `artifact`, `rendering`, and `privacy`, but those names are illustrative rather than contractual.

## Semantic State Model

Resume construction is governed as a semantic state-transition process. It is not a fixed compiler whose only job is to deterministically transform one bundle into one resume.

The state model should include these state families:

- Persisted library state.
  User-owned career facts, evidence, tags, claim ceilings, and context stored in SQLite.

- Target seed state.
  The supplied JD or target material, source metadata, user constraints, parse status, and target-run configuration.

- Target semantic space.
  Derived semantic representation of the target seed: requirements, themes, responsibilities, outcomes, constraints, priority signals, ambiguities, and unknowns.

- Library semantic space.
  Derived semantic representation of the user's career library: capabilities, evidence-backed claims, outcomes, domains, tools, chronology, constraints, and claim ceilings.

- Traversal workspace.
  `candidate_alignments`, search paths, scores, explanations, rejected paths, clusters, conflicts, and `gap_items` produced while traversing the target and library spaces.

- Draft resume state.
  User-reviewed candidate sections, claims, bullets, ordering, alternatives, and gap annotations. Draft state is derived and can be discarded without corrupting the library.

- Review and approval state.
  `review_queue_items` plus user decisions about candidate evidence, claim wording, section inclusion, gaps, and artifact readiness.

- Artifact and manifest state.
  Generated structured resumes, render outputs, hashes, selected evidence references, transition lineage, and provider configuration used for the run.

The baseline transition graph must include these transition families and pre/postconditions:

- `ingest_target_seed`: requires source text or a source file reference plus target-run context. Produces a target seed, source hash, `seed_created` target-run status, and a transition event without changing library records.
- `extract_target_semantics`: requires a stored target seed. Produces target semantic nodes and edges with source spans, normalized terms, extraction method metadata, ambiguity markers, and `semantics_ready` status. In the baseline this is local lexical/tag extraction only.
- `project_library_semantics`: requires current library records, evidence, tags, and claim ceilings. Produces library semantic nodes and edges linked to records, evidence, tags, chronology, and ceilings. Empty libraries produce an inspectable empty projection, not invented evidence.
- `traverse_alignment_candidates`: requires current target and library semantic spaces. Produces `candidate_alignments` rows, rejected or weak paths where available, scores, explanation fields, evidence refs, target node refs, and `traversal_ready` or `review_pending` status. Baseline scoring uses lexical similarity, tag overlap, co-occurrence, recency, and context metadata.
- `propose_claim_options`: requires `candidate_alignments` with evidence references and any applicable claim ceilings. Produces `claim_options` rows that quote, compress, or recombine evidence-bounded language without exceeding ceiling notes.
- `identify_gaps`: requires target semantic nodes and the current candidate set. Produces `gap_items` rows for unsupported, weak, ambiguous, stale, or missing target requirements.
- `request_user_review`: requires `candidate_alignments`, `claim_options`, `gap_items`, drafts, or artifacts that need operator judgment. Produces `review_queue_items` rows with `review_pending` status and inspectable rationale.
- `accept_candidate`, `reject_candidate`, and `revise_candidate`: require a pending first-class review subject and an explicit user decision. Produce `review_decisions` records and updated derived state for the referenced `candidate_alignment`, `claim_option`, `gap_item`, or `review_queue_item`. They must not rewrite factual evidence, target seed text, or library records.
- `assemble_draft`: requires accepted candidates and accepted or revised claim options; unresolved gaps must remain visible. Produces a draft snapshot with sections, selected evidence refs, claim option refs, gap refs, ordering rationale, and `draft_ready` or `review_pending` status.
- `approve_artifact`: requires whole-draft user approval. Produces an approval decision, artifact-ready draft state, and `artifact_approved` target-run status.
- `render_artifact`: requires an approved draft snapshot. Produces a structured JSON artifact, Markdown export, manifest, hashes, render metadata, and `artifact_rendered` status.

Optional transitions such as clustering, reranking, provider extraction, provider generation, PDF rendering, or DOCX rendering can be added later only when their inputs, outputs, review behavior, and provenance rules are explicit.

Every transition must record enough metadata to answer these questions:

- What state did it read?
- What state did it produce?
- Which evidence, target spans, semantic nodes, provider outputs, prompts, models, rules, and user decisions influenced it?
- Which parts are deterministic, which are provider-dependent, and which require user judgment?
- How can the user inspect, discard, repeat, or compare the transition result?

Model-dependent scoring may be non-deterministic. That is acceptable only when the run is inspectable and replayable enough for audit: inputs or input hashes, provider name, model identifier, adapter version, prompt or extraction policy, parameters, output summaries, scores, explanations, and timestamps must be recorded according to the privacy policy chosen for that provider.

## Invariants

- The user controls the canonical career library.
- SQLite is the canonical persisted source for library state and governed operational ledgers.
- Generated artifacts are outputs, not source.
- Semantic spaces are derived from observable library, target, provider, and transition data.
- State transitions are inspectable, reviewable, and discardable before artifact approval.
- Claims require evidence references.
- Claim ceilings bound language and implication.
- Gaps are first-class outputs, not failures to be hidden by fluent prose.
- External provider calls are never hidden. They require explicit adapters, configuration, and privacy boundaries.
- A local-only mode must not silently degrade into unsupported cloud behavior.

## Quality Bar

The product should feel useful because the user can see and control how a resume emerges from their evidence.

- Library operations are boring, reliable, and explicit about persistence.
- Target seed ingestion shows what was supplied and what was derived.
- Semantic traversal explains candidate alignments rather than presenting them as magic.
- Draft resume claims remain bounded by evidence and claim ceilings.
- Review queues make acceptance, rejection, revision, and gaps visible.
- Artifacts are reproducible enough for audit even when semantic ranking uses model-dependent components.
- Provider behavior is visible enough that privacy-sensitive users can choose local-only or explicit external adapters.
- Failures are actionable: missing evidence, weak matches, provider unavailability, schema conflicts, and render errors are surfaced without pretending the resume is complete.

## First Honest Vertical Slice

The first buildable vertical slice is intentionally local, inspectable, and narrow:

1. Create library data through the Tauri UI or a real Tauri command backed by Rust validation and SQLite writes: at least one library record, one evidence item, one canonical tag, one signal claim, and one claim ceiling.
2. Ingest a job description as a target seed with source text, source hash, and run context.
3. Derive local target and library semantic spaces into SQLite using normalized terms, tags, target spans, evidence links, lexical similarity, co-occurrence, recency/context metadata, scores, and explanations.
4. Traverse the spaces to persist `candidate_alignments` and `gap_items` with stable IDs, evidence refs, scoring rationale, method metadata, and explanations.
5. Persist `claim_options` from candidate alignments, then let the user accept, reject, or revise candidate alignments, claim options, and gaps through first-class review subjects while preserving evidence refs and claim-ceiling notes.
6. Assemble a draft from approved candidate state and visible gaps, then require whole-draft approval.
7. Emit structured JSON, Markdown, and a manifest that include hashes, selected evidence IDs, target seed refs, transition refs, gap report, render metadata, and approval state.

This slice does not require external providers, embeddings, PDF, DOCX, sync, accounts, telemetry, or compatibility with prototype-era data.

## Acceptance Probes

Future implementation work should define executable checks around these probes.

### Baseline Executable Semantic Probe

Question: Can the baseline semantic traversal produce stable, reviewable subjects while proving that semantic traversal is more than keyword overlap?

Minimum fixture: one target run contains three target requirements: one requirement with a direct supported library match, one requirement whose accepted candidate has no direct normalized-term overlap with its library node but is supported by canonical tags, context metadata, evidence links, and scoring rationale, and one unsupported requirement that must become a gap. The library side must include evidence items, signal claims, claim ceilings, tags, and context sufficient to explain both supported candidates without inventing evidence.

Minimum proof: The run persists `candidate_alignments`, `claim_options`, `gap_items`, and `review_queue_items` with stable IDs; transition events reference those rows in `output_refs_json`; review decisions target stable first-class subjects; the non-direct accepted candidate explains its relationship through tags, context, evidence links, and method metadata rather than shared keywords alone; and the unsupported requirement remains visible as a `gap_item`.

Does not count: A keyword-only filter renamed as semantic traversal, a match that cannot name target nodes and library nodes, review decisions against anonymous JSON payload objects, or a fixture with no accepted non-direct candidate.

### Library CRUD And Persistence

Question: Can the user create, edit, delete, and inspect career library records and evidence through the Tauri UI while SQLite remains the canonical source?

Minimum proof: A real Tauri command or UI-driven path writes validated data to SQLite, reads it back through the Rust core, and shows that generated outputs were not used as source.

Does not count: A mock browser store, a fixture-only JSON edit, or a UI screen that never reaches SQLite.

### Target Seed Semantic Space

Question: Can a supplied job description create a target seed and an inspectable target semantic space without mutating the career library?

Minimum proof: The target seed is persisted, semantic nodes and edges are derived, ambiguous or low-confidence extractions are visible, and the library state is unchanged.

Does not count: A hand-authored target summary with no source text, no extraction metadata, or no audit trail.

### Library Semantic Projection

Question: Can the system derive a library semantic space from stored records and evidence while preserving evidence boundaries?

Minimum proof: Derived semantic nodes link back to concrete records, evidence items, tags, dates, and claim ceilings; stale projections can be refreshed when source records change.

Does not count: Embeddings or labels that cannot be traced back to stored observables.

### Semantic Traversal And Candidate Proposal

Question: Can the state machine cross-reference target and library semantic spaces to propose relevant evidence candidates with explanations?

Minimum proof: Candidate alignments identify target nodes, library nodes, supporting evidence, scores or ranking rationale, rejected paths where available, and gap candidates.

Does not count: A single opaque match score, a polished bullet list with no evidence lineage, or a deterministic-only keyword filter presented as semantic reasoning.

### Evidence-Bounded Draft Construction

Question: Can approved candidates become draft resume sections without unsupported claim inflation?

Minimum proof: Each draft claim references evidence, respects claim ceilings, records user approval status, and preserves visible gaps where evidence is weak or absent.

Does not count: Model-generated prose that cannot identify its evidence, or wording that turns weak evidence into stronger claims.

### Transition Auditability

Question: Can a user or reviewer inspect how a draft or artifact was produced?

Minimum proof: The transition ledger records state inputs, outputs, provider configuration, prompts or policies, model identifiers where relevant, user decisions, hashes, timestamps, and explanations sufficient to compare two runs.

Does not count: Logs that say a step ran without preserving what it read, produced, or depended on.

### Artifact Manifest And Provenance

Question: Can every emitted artifact be traced back to its approved draft state, target seed, selected evidence, and transition lineage?

Minimum proof: Structured artifact and manifest include hashes, selected evidence IDs, target seed references, transition references, gap report, render metadata, and approval state.

Does not count: A DOCX, PDF, or Markdown file with no structured artifact or manifest.

### Provider Privacy And Fallback Behavior

Question: Does provider use stay explicit, configurable, and bounded by privacy expectations?

Minimum proof: The operator can see which provider adapter is active, what data class it may receive, whether it makes network calls, what gets persisted, and what fallback behavior applies if the provider is unavailable.

Does not count: Any hidden SaaS call, silent model fallback, or telemetry-like behavior without explicit configuration.

## Handoff Decision Matrix

This matrix captures the main design questions surfaced during the spec rewrite. It is meant to make handoff into a fresh repo easier by showing which choices are already settled for the baseline, which remain open, and what the practical options are.

| Decision | Options | Starting point for a fresh repo | Status | Revisit trigger |
| --- | --- | --- | --- | --- |
| Candidate identity and header data | Singleton operator profile / multiple reusable profiles / per-target-only profile overlays | Start with a singleton local operator profile plus per-target overrides in `target_runs.context_json` | Recommended baseline extension choice | Revisit if one user needs multiple personas or profile sets |
| Enum strategy for core kinds and statuses | SQL `CHECK` enums / lookup tables / free text plus app validation | Use SQL `CHECK` constraints for stable baseline statuses and kinds; reserve lookup tables for extensible taxonomies only | Recommended baseline choice | Revisit if plugin-like extensibility or user-defined workflow states become necessary |
| Target semantic representation | Node-edge graph only / graph plus materialized cluster-atom views / first-class atom-cluster tables | Start with the node-edge graph baseline and add materialized cluster or atom views only when reviewers need them | Decision likely needed in first schema seam | Revisit if review UX requires stable requirement groups beyond node-edge traversal |
| Transition persistence model | Snapshots only / append-only events plus snapshots / full event sourcing | Keep the current baseline: append-only transition ledger plus materialized snapshots | Baseline-authorized | Revisit if replay, branching, or compaction become primary operator needs |
| Review granularity | Whole draft only / candidate plus claim plus draft / bullet and section level configurable review | Keep the current baseline: candidate alignment, claim option, gap review where relevant, then whole-draft approval | Baseline-authorized | Revisit if users need finer section or bullet governance |
| User edit policy for generated text | No edits / evidence-linked revisions only / freeform editing with warnings | Start with evidence-linked revisions only | Recommended baseline extension choice | Revisit if users demand freeform authoring beyond evidence-backed revisions |
| Provider strategy after MVP | Local-only forever / opt-in external adapters / external-provider default | Keep local-only baseline, then add opt-in adapters later if quality demands it | Baseline-authorized for MVP; open beyond baseline | Revisit if local lexical-plus-tag traversal misses too many valid candidates |
| Semantic index evolution | SQLite lexical graph / embedded vector store / hybrid graph plus vector / provider-backed retrieval | Start with the SQLite lexical-plus-tag graph | Baseline-authorized | Revisit if retrieval quality or scale fails the semantic probe |
| Artifact surface at launch | Structured JSON plus Markdown / add DOCX next / add PDF and HTML / all at once | Keep structured JSON, Markdown, and manifest at MVP | Baseline-authorized | Revisit if export/share needs outrun core traversal and review work |
| Raw import and migration path | No raw import / guided import with run-item ledgers / direct bulk import into library | Defer unless migration is immediately needed; if added, use explicit import ledgers | Open decision beyond baseline | Revisit if the new repo must absorb current data on day one |
| Provider-input retention | No retained provider payloads / hashes plus summaries / full payload retention | If providers are added later, start with hashes plus summaries unless stricter audit is required | Open decision beyond baseline | Revisit if privacy requirements or audit requirements change |
| Semantic negative-control test design | Direct-match-only tests / lexical plus tag-context negative control / embedding-required evaluation | Keep the current negative-control baseline: one accepted non-direct match plus one visible unsupported gap | Baseline-authorized | Revisit if embeddings or provider-backed semantics become baseline behavior |

## Open Questions Beyond Baseline

The baseline build profile above is settled for MVP implementation. These questions apply to extensions beyond that profile and should be resolved through explicit decisions rather than implicit implementation drift.

- Which external embedding, extraction, reranking, and generation providers should be supported after the local-only baseline?
- Should the baseline SQLite semantic graph later gain SQLite extensions, an embedded vector store, a hybrid index, or provider-backed retrieval?
- What snapshot compaction, replay tooling, or event-sourcing refinements should be added beyond the baseline append-only ledger plus materialized snapshots?
- Should review granularity expand beyond candidate alignment, claim option approval, and whole-draft approval to bullets, sections, or configurable levels?
- What richer user-editing model should exist beyond evidence-linked claim option revision?
- What provider-input retention policy best balances replayability with privacy when external providers are introduced?
- What sample corpus should be used for early acceptance probes without leaking sensitive career data?
- How should scoring calibration be evaluated when model-dependent semantics are allowed?
- Which artifact formats beyond structured JSON, Markdown, and manifest should be first-class after the MVP?
