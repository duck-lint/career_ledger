# Career Ledger Governance Primitives

This document defines project-local authority semantics, approval boundaries, invariants, admissible transformations, review checkpoints, and acceptance probes for the Career Ledger architecture described in the companion project spec.

It is self-contained governance for a local-first Rust/Tauri product whose resume construction model is a governed semantic state-transition process. It does not rely on prior Python files, historical repository paths, or prototype implementation details.

## Authority Semantics

Use this authority order when deciding what the product is allowed to become:

1. Explicit user-approved amendments to the project spec or this governance file.
2. The current project spec and this governance file.
3. Open decisions that interpret unsettled provider, algorithm, storage, privacy, or workflow choices without overriding the spec.
4. Active implementation plans and trackers that execute an already-authorized objective.
5. Current task instructions that select, sequence, or pause work inside the authorized objective.
6. Archived implementation history, prototype code, and prior chat context.

The project spec and governance file define invariants. Open decisions are the place for unsettled beyond-baseline algorithm and provider choices. Prototype code can provide examples, but it cannot silently become authority.

## Baseline-Authorized Decisions

The companion project spec authorizes a first buildable baseline. Implementation work that stays inside these decisions does not need a new open decision; deviations, replacements, or expansions do.

- Primary runtime is a Rust/Tauri desktop application.
- Persistence is local SQLite with migrations managed by Rust.
- Provider mode is local-only by default: no network calls, no external model dependency, no hidden provider fallback, and no telemetry.
- Semantic indexing starts as a SQLite-backed semantic graph using normalized terms, canonical tags, target spans, evidence links, simple lexical similarity, co-occurrence, recency/context metadata, scores, and explanations.
- Transition persistence is an append-only transition ledger plus materialized snapshots for current target runs, semantic projections, traversal workspaces, drafts, artifacts, and manifests.
- Review gates are candidate alignment approval, claim option approval, gap review where gaps affect draft readiness, and whole-draft approval before artifact emission. Candidate alignments, claim options, gap items, and review queue items are first-class persisted review subjects, not incidental JSON blobs.
- Baseline artifacts are structured JSON, Markdown export, and provenance manifest.
- Baseline wording options come from stored evidence text, stored signal claims, claim ceilings, and user-approved revisions. Every option must retain evidence references and claim-ceiling notes.

Open decisions apply beyond this baseline. A harness implementing the baseline should proceed under these authorized choices instead of stopping on provider, semantic-index, transition-persistence, review-granularity, or baseline artifact-format questions.

## Approval Boundaries

Require explicit approval before crossing any of these boundaries:

- Project-spec or governance amendment.
  Any change that redefines product thesis, source-of-truth rules, stack authority, semantic-state semantics, evidence obligations, or generated-artifact policy.

- Schema and storage.
  Any change that departs from, redefines, or expands beyond the minimum baseline SQLite contract; any change to table meaning, migration policy, foreign-key expectations, canonical source boundaries, cache persistence, or conflict strategy beyond the baseline.

- Provider, external-call, and privacy behavior.
  Any embedding, language-model, extraction, reranking, generation, telemetry, network, or cloud behavior beyond the local-only baseline; any change to what data may leave the device; any change to provider-input retention.

- State-transition semantics.
  Any new transition family, state family, transition precondition, review gate, replay guarantee, discard behavior, or mutation rule that departs from the baseline transition graph or changes how resume construction proceeds.

- Generated-text policy.
  Any change beyond baseline evidence-derived claim options and user-approved revisions; any change to how claims are bounded, how evidence references are required, or how gaps are represented.

- Prompt, scoring, and model policy.
  Any prompt template, model-dependent behavior, confidence category, or semantic scoring/ranking policy that materially changes candidate proposal, claim generation, or artifact construction beyond the baseline lexical, tag, co-occurrence, recency, and context scoring.

- API and command boundaries.
  Any Tauri command contract, Rust core API, import/export format, artifact schema, provider adapter interface, or manifest shape that departs from or extends beyond the baseline profile, changes authority boundaries, or exposes data outside local desktop behavior.

- Deployment and packaging.
  Any packaging, update, distribution, hosted component, sync service, or release-channel commitment beyond the local-first desktop product.

- Auth and identity.
  Any introduction of accounts, identity, authorization, shared workspaces, collaboration, or multi-user semantics.

- Compatibility and migration promises.
  Any commitment to support legacy Python-era data, old schema shapes, old artifact contracts, browser-local fallback stores, or undocumented prototype behavior.

- Destructive operations.
  Any operation that deletes canonical data, resets storage, rewrites evidence, bulk-imports over existing state, or broadens cleanup behavior.

Implementing the baseline profile and minimum contracts named in the project spec is already authorized. If a task crosses one of these boundaries outside that baseline and does not include explicit approval, stop and return an escalation note rather than implementing around the gap.

## Core Invariants

These truths must remain stable unless the project spec and governance file are explicitly amended:

- Rust/Tauri is the primary implementation stack.
- Python is prototype or reference history only.
- The product is local-first and user-owned.
- SQLite is the canonical persisted source for the factual career library and governed operational ledgers.
- Generated exports, drafts, resumes, manifests, and rendered documents are derived outputs.
- Generated artifacts do not become canonical source.
- Semantic spaces are derived from observable source data: library records, evidence, tags, claim ceilings, target seeds, transition events, provider outputs, and user decisions.
- Semantic projections may be cached, but caches do not outrank the library, target seed, provider records, or transition ledger that produced them.
- State transitions must be inspectable, reviewable, and discardable or reversible before artifact approval.
- Candidate alignments, claim options, gap items, and review queue items are core derived review subjects with stable IDs.
- Replay does not require bit-for-bit identical model behavior, but it does require enough recorded input, configuration, provider, prompt, output, score, explanation, hash, and timestamp data to audit how a result was produced.
- Claims in draft or artifact state require evidence references.
- Claim ceilings bound safe wording and implication.
- Gaps remain visible when evidence is weak, absent, stale, or ambiguous.
- User approval gates are required before proposed candidates become draft resume state and before drafts become emitted artifacts.
- No hidden model calls, hidden SaaS dependencies, hidden telemetry, or silent provider fallback are allowed.
- External providers, if used, must be explicit adapters with visible privacy, configuration, network, logging, and failure behavior.
- Local-only mode must be real, not a label over hidden external calls.
- Validation and policy enforcement belong in the Rust core, not only in the Tauri UI.

## Source, Derived, And Presentation Authority

Use these categories when reviewing changes:

- Authoritative source state.
  SQLite library records, evidence items, claim ceilings, taxonomy data, target seeds, user approvals, provider configuration, and transition ledger records.

- Derived inspectable state.
  Semantic projections, semantic indexes, candidate alignments, claim options, gap items, review queue items, scores, clusters, draft resume state, structured artifacts, and manifests.

- Presentation state.
  UI layout, previews, rendered documents, transient filters, and visual affordances.

- Planning state.
  Product notes, open decisions, implementation plans, trackers, and prototype references.

Do not promote derived, presentation, planning, or prototype state into canonical source unless a specific approved design says so.

## Minimum Transition Event Shape And Lifecycle Constraints

Every state-machine transition must append or preserve an auditable transition event. The baseline event shape is normative even when an implementation also keeps materialized snapshots for current UI state.

Minimum transition event fields:

- `id`: stable transition event identifier.
- `target_run_id`: target run affected by the transition, when applicable.
- `transition_type`: one of the approved baseline transition families or an explicitly approved extension.
- `transition_status`: `succeeded`, `failed`, or `discarded`.
- `actor`: `system`, `user`, or an explicitly approved provider/adapter actor.
- `occurred_at`: timestamp for the recorded event.
- `input_refs_json`: source records, evidence, target seeds, semantic nodes, snapshots, provider outputs, or decisions read by the transition.
- `output_refs_json`: stable references to records, semantic nodes, `candidate_alignments`, `claim_options`, `gap_items`, `review_queue_items`, draft snapshots, artifacts, or manifests produced by the transition.
- `preconditions_json` and `postconditions_json`: state facts checked before and after the transition.
- `method_json`: local rule, lexical scoring, traversal policy, adapter version, or renderer policy used.
- `provider_config_json` and `provider_output_refs_json`: empty or explicitly local for the baseline; required when an approved provider adapter is used.
- `prompt_or_policy_refs_json`: extraction, wording, traversal, or render policy references; prompt references are required for approved model-backed behavior.
- `hashes_json`: hashes for source text, snapshots, artifacts, provider inputs/outputs when retained, or rendered files where applicable.
- `explanation`: human-inspectable rationale for what changed and why.
- `error_json`: structured failure detail when `transition_status` is `failed`.
- `payload_json`: flexible extension data that cannot replace the required fields above.

Minimum lifecycle statuses:

- Target run: `seed_created`, `semantics_ready`, `traversal_ready`, `review_pending`, `draft_ready`, `artifact_approved`, `artifact_rendered`, `blocked`, `archived`.
- Semantic projection node or edge: `current`, `stale`, `discarded`, `failed`.
- Candidate alignment, claim-option, or gap-item review subject: `proposed`, `review_pending`, `accepted`, `rejected`, `revised`, `superseded`.
- Review queue item: `review_pending`, `resolved`, `superseded`, `discarded`. `resolved` requires a recorded review decision or transition event that closes the queue item.
- Draft snapshot: `assembling`, `review_pending`, `approved`, `discarded`, `superseded`.
- Artifact manifest: `planned`, `rendered`, `failed`, `superseded`.
- Transition event: `succeeded`, `failed`, `discarded`.

Any new lifecycle status, enum category, confidence class, or transition subject must map to observable source data, a recorded transition, a user decision, or an explicitly recorded provider output. Otherwise implementation must stop and define the semantics first.

## Admissible Transformations

The following changes are admissible inside an already-approved seam:

- Implement the baseline Rust/Tauri, Rust-managed SQLite, local-only provider mode, SQLite semantic graph, transition ledger, materialized snapshots, review gates, JSON/Markdown artifacts, and manifest described in the project spec.
- Add or refine library CRUD behavior when writes remain validated, local, and SQLite-backed.
- Add semantic projection behavior when every derived node or category maps back to concrete stored observables or recorded provider outputs.
- Add a transition type when its inputs, outputs, preconditions, user-review behavior, and audit metadata are explicit.
- Add scoring, ranking, clustering, or matching behavior when the method is declared and the result remains explainable enough for user review.
- Add provider adapters only when the provider decision is already authorized and privacy behavior, network behavior, configuration, failure modes, and persisted metadata are explicit.
- Add artifact formats when they consume approved draft state and preserve provenance rather than reinterpreting claims.
- Add tests or probes that make source, derived, provider, transition, review, or artifact behavior more falsifiable.

The following beyond-baseline changes require an open decision before implementation:

- Choosing any external embedding, extraction, reranking, or generation provider beyond the local-only baseline.
- Replacing or extending the SQLite-backed semantic graph with SQLite extensions, an embedded vector store, a hybrid index, or provider-backed retrieval.
- Changing transition persistence away from the baseline append-only ledger plus materialized snapshots, or adding replay/compaction semantics that alter audit guarantees.
- Choosing provider-input retention policy for audit versus privacy when an external provider is introduced.
- Changing default setup behavior away from local-only.
- Expanding or replacing baseline review gates for candidate alignments, claim options, and whole-draft approval.
- Expanding user-edited resume wording beyond evidence-linked claim option revision.
- Promoting PDF, DOCX, or another renderer to first-class artifact status beyond the baseline structured JSON, Markdown, and manifest.

The following changes require explicit project-spec or governance amendment:

- Moving away from Rust/Tauri as the target stack.
- Moving away from SQLite as canonical local storage.
- Allowing generated artifacts to become source of truth.
- Allowing unbounded AI-authored claims without evidence references.
- Creating hidden cloud, SaaS, sync, telemetry, or account assumptions.
- Adding legacy compatibility promises for prototype-era data or behavior.
- Removing user review gates from semantic traversal, draft construction, or artifact approval.

Any new enum, semantic category, confidence class, status, or artifact field in a contract must map to a deterministic function over current observables or to a recorded provider output with explicit provenance. If neither mapping exists, stop and define the semantics before implementing.

## Review Checkpoints

Use these checkpoints before closing future implementation work.

### Storage Checkpoint

- Is SQLite still canonical?
- Are foreign keys, transactions, migrations, and conflict policies explicit?
- Are generated artifacts prevented from becoming source by accident?
- Are destructive operations opt-in and visible?

### Semantic Checkpoint

- Does every semantic node, edge, score, or category link back to source observables or recorded provider outputs?
- Are stale projections invalidated or marked stale when source state changes?
- Are gaps and low-confidence results visible?
- Are deterministic and provider-dependent parts clearly distinguished?

### Transition Checkpoint

- Does the transition name its input state, output state, preconditions, and review gate?
- Does the transition ledger record enough metadata for audit and comparison?
- Do transition outputs name stable first-class rows for candidate alignments, claim options, gap items, and review queue items rather than hiding them in payload JSON?
- Can proposed changes be discarded before approval?
- Are user decisions recorded without rewriting factual evidence, and do review decisions reference first-class review subjects by stable IDs?

### Provider Checkpoint

- Is the provider adapter explicit?
- Does the operator know whether data leaves the device?
- Are model identifiers, adapter versions, prompts or policies, parameters, and output metadata recorded according to the privacy policy?
- Is fallback behavior explicit rather than silent?

### Generated-Text Checkpoint

- Does every claim reference evidence?
- Does wording respect claim ceilings?
- Are unsupported requirements represented as gaps or review prompts?
- Are user edits preserved with evidence linkage and approval metadata?

### Artifact Checkpoint

- Does the artifact come from approved draft state?
- Does the manifest include selected evidence, target seed, transition lineage, hashes, provider configuration where relevant, and render metadata?
- Can a reviewer distinguish structured artifact state from presentation-only output?

### UI Checkpoint

- Does the Tauri UI call the Rust core rather than duplicating hidden policy?
- Are provider, privacy, dry-run/apply, and review states visible to the operator?
- Does the UI avoid implying certainty when semantic or provider confidence is weak?

## Acceptance Probes For Harness Work

Future harness work should define executable or inspectable proof for the relevant probe. A screenshot, mock, fixture-only artifact, or prose explanation is not enough for behavior-facing claims.

### Canonical Library Probe

Question: Does user-edited library data persist to SQLite through validated Rust core behavior and read back without treating artifacts as source?

Required evidence: Real command or UI path, SQLite rows, validation behavior, and read-back through the core.

### Target Seed Probe

Question: Does a supplied JD become a target seed and target semantic space without mutating the career library?

Required evidence: Stored seed, derived semantic nodes and edges, extraction metadata, ambiguity markers, and unchanged library state.

### Semantic Traversal Probe

Question: Does the system traverse target and library semantic spaces to produce candidate evidence with explanations?

Required evidence: Target nodes, library nodes, persisted `candidate_alignments`, evidence references, scores or ranking rationale, provider or rule metadata, rejected or weak candidates where available, persisted `gap_items`, and review queue entries when operator judgment is required.

Negative control: The fixture must include at least one accepted candidate whose target node and library node do not share direct normalized-term overlap. That candidate must be explainable through canonical tags, context metadata, evidence links, and scoring rationale. The same fixture must include at least one unsupported requirement that remains a gap item. A keyword-only match set, or a traversal with no accepted non-direct candidate, fails this probe.

### Evidence-Bounded Draft Probe

Question: Do approved candidates become draft resume sections while preserving evidence references, claim ceilings, and gaps?

Required evidence: Draft state with claim-to-evidence links, approval status, wording constraints, and unresolved gaps.

### Transition Audit Probe

Question: Can a reviewer inspect how a candidate, draft, or artifact was produced?

Required evidence: Transition ledger records with inputs, outputs, hashes, provider configuration, prompts or policies, model identifiers where relevant, explanations, timestamps, and user decisions.

### Artifact Provenance Probe

Question: Can every emitted artifact be traced to approved draft state, selected evidence, target seed, and transition lineage?

Required evidence: Structured artifact, manifest, selected evidence IDs, target seed references, transition references, hashes, gap report, approval state, and render metadata.

### Provider Privacy Probe

Question: Is provider behavior explicit and bounded by user-visible privacy settings?

Required evidence: Active provider adapter, network behavior, data classes sent, retention policy, persisted metadata, local-only mode behavior, and explicit fallback or failure handling.

## Harness Admissibility Inputs

When producing an admissibility report for future work, name these items explicitly:

- Invariant constraints.
  Rust/Tauri target stack; Python prototype/reference only; SQLite canonical source; generated artifacts derived; semantic spaces derived; transitions inspectable; evidence references required; user approval gates required; no hidden providers.

- Task constraints.
  Exact seam, editable files, forbidden surfaces, acceptance criteria, provider/privacy impact, state-transition impact, and expected observable consequence.

- Source evidence.
  Which project spec, governance rule, open decision, fixture, test, runtime behavior, or user instruction authorizes the work.

- Assumptions.
  Any unresolved provider, index, review, artifact, storage, or privacy choice that the task relies on.

- Affected downstream surfaces.
  Storage, schema, UI, provider adapters, transition ledger, semantic index, artifact formats, tests, fixtures, docs, and operator workflows touched by the seam.

- Non-affected surfaces.
  Surfaces outside the approved seam, especially schema, storage, provider behavior, deployment, compatibility, and generated-text policy when they were not explicitly authorized.

- Admissibility checks.
  No hidden source-of-truth changes, no hidden cloud calls, no unsupported compatibility, no unbounded generation, no stale dependent surface, no semantic category without provenance, and no artifact claim without evidence.

- Stop conditions.
  Missing acceptance criteria; unresolved schema, storage, provider, privacy, deployment, compatibility, generated-text, or transition-policy decision beyond the authorized baseline; insufficient source evidence; or a seam that cannot deliver the intended behavior without crossing approval boundaries.

## Open Decisions Discipline

Open decisions should be used for unsettled choices beyond the baseline, such as external providers, advanced indexes, transition replay or compaction strategy, expanded review granularity, richer editing policy, external-provider privacy defaults, sample corpora, scoring calibration, and post-MVP artifact formats.

Do not resolve beyond-baseline choices accidentally through implementation. If a seam stays inside the authorized baseline, proceed under the project spec and this governance file. If a seam requires a beyond-baseline choice, stop, state the decision needed, list the practical options, and request project authority.
