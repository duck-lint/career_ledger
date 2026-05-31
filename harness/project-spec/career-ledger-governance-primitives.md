# Career Ledger Governance Primitives

This file defines authority order, baseline-authorized decisions, approval boundaries, invariants, admissible transformations, review checkpoints, and admissibility inputs for the current Tauri application.

It is intentionally aligned to the shipped desktop runtime. It is not a license to revive retired prototype concepts unless the project explicitly approves them.

## Authority Order

Use this order when deciding what the repo is allowed to claim or change.

1. Explicit user-approved amendments and the current admissibility report for the active seam.
2. This governance file and the companion project spec for baseline intent, constraints, and approval boundaries.
3. Direct runtime truth for factual questions about the current app: the live SQLite schema and the Rust and TypeScript command or contract surfaces.
4. The repository README when it is consistent with those runtime surfaces.
5. Open decisions and active implementation bundles that stay inside already-authorized boundaries.
6. Archived plans, historical notes, and prototype or prior-repo context.

Important tie-breaker: if stale prose conflicts with current runtime truth, the prose is wrong. Update the docs; do not fabricate missing behavior to satisfy outdated text.

## Baseline-Authorized Decisions

The following decisions are already authorized because they describe the app that currently exists.

- Rust plus Tauri is the target stack.
- The desktop runtime is the product; browser mode is only a harness.
- SQLite is canonical local storage and foreign keys must remain enabled.
- The durable library model is experience records plus evidence items, not generated resume artifacts.
- The taxonomy is user-controlled and includes canonical tags, delivery toolkit grouping, and inference markers.
- Evidence save is inference-aware and may require explicit confirmation before mutation.
- Requirement analysis is local and structured, with clusters, atoms, keyword bank, notable unmatched terms, matched tags, and negation-aware normalized terms.
- Reusable requirement-review persistence is limited to normalized noise terms in the current baseline.
- Bundle preparation is tag-first; posting-matched tags are a strict subset of toolkit tags; delivery toolkit is a grouped projection from taxonomy metadata only.
- Resume assembly is deterministic and normalization-bounded and emits a structured artifact with `resume`, `gap_report`, and `provenance`.
- The pipeline may optionally write assembled JSON, bundle JSON, and DOCX and may optionally persist a generation manifest.
- Raw intake import is a bounded preview plus import workflow with explicit run and item ledgers.
- The app assumes no network calls, no telemetry, no cloud dependency, and no hidden provider path.

## Retired Prototype Concepts Are Not Baseline-Authorized

Do not treat the following as current contract surfaces unless a future decision explicitly adds them back:

- claim-ceiling persistence as a required schema surface
- claim-ceiling or claim-option concepts as required baseline contract fields
- semantic transition ledgers, transition-status workflows, or state-machine workflow governance
- `candidate_alignments`, `claim_options`, `gap_items`, or `review_queue_items` as tables or required baseline runtime contract fields
- provider adapters or model-backed analysis as the default architecture
- Markdown as a required output artifact

## Approval Boundaries

Require explicit approval before crossing any of these boundaries.

- Storage and schema changes.
  Any change to canonical tables, singleton settings rows, foreign-key behavior, or the persisted truth model.

- New persistent posting workspace state.
  Any move to persist requirement analyses, reviewed analyses, draft workspaces, candidate-review queues, or resume assembly state as first-class durable rows.

- Network, provider, telemetry, or cloud behavior.
  Any external call path, provider adapter, hosted dependency, analytics, or hidden fallback.

- Browser-harness equivalence changes.
  Any attempt to make browser mode claim desktop-only capabilities or to treat frontend localStorage convenience caches as canonical state.

- Candidate identity model changes.
  Any move away from the current single active candidate profile toward multiple profiles, personas, accounts, or shared identity.

- Generated-text policy changes.
  Any move from current deterministic, normalization-bounded assembly toward freeform paraphrase or unsupported claim generation.

- Artifact contract changes.
  Any new required artifact format, any change to the top-level assembled artifact shape, or any change to manifest persistence semantics.

- Raw intake semantics.
  Any change to preview-versus-import behavior, dedupe and skip behavior, or how audit rows are recorded.

- Compatibility promises.
  Any commitment to support prototype-era schema shapes, retired document models, or hidden migration behavior not already present in the current app.

- Deployment and distribution assumptions.
  Any change that introduces hosted services, sync, accounts, or a non-desktop product target.

## Core Invariants

These statements are stable unless the project explicitly amends the spec and governance.

- The Tauri desktop runtime is the product runtime.
- Browser mode is a harness and must stay visibly weaker than desktop mode.
- SQLite is the canonical local store.
- `experience_records` and `evidence_items` are source facts; generated resumes are not.
- `record_type` stays constrained to `employment` and `project` unless explicitly widened.
- Every evidence item belongs to exactly one experience record.
- The taxonomy is canonical for tag names, inference markers, delivery toolkit categories, and display metadata.
- Posting analysis can filter or prioritize supported evidence and tags; it cannot invent support that the library and static profile sources do not provide.
- `posting_matched_tags` are a subset of `toolkit_tags`.
- The delivery toolkit is a grouped human-facing projection from taxonomy metadata, not an independent claim source.
- The active candidate profile, build policy settings, and requirement-review noise settings are singleton rows in the current baseline.
- Reviewed requirement analysis is non-authoritative request state; reusable persistence is limited to noise terms unless explicitly extended.
- In the live runtime, the backend only enforces co-presence and matching posting hash before using the supplied reviewed-analysis payload; the default frontend derives that payload from base analysis plus the review draft.
- The assembled artifact always centers on `resume`, `gap_report`, and `provenance`.
- Provenance must include the selected record and evidence surface behind the generated artifact.
- Highlights and profile text stay normalization-bounded rather than becoming an unrestricted writing surface.
- Generated files and manifests are derived outputs and audit surfaces, not the canonical library.
- Manifest snapshots and frontend localStorage convenience caches, including saved posting text, must not silently widen into saved posting workspaces, review queues, or transition logs.
- No hidden network calls, telemetry, or provider behavior are allowed.
- No legacy or prototype compatibility assumption should be inferred unless it is written down explicitly.

## Source, Derived, And Presentation Authority

### Source authority

The following persisted surfaces are authoritative:

- `experience_records`
- `evidence_items`
- taxonomy tables
- `candidate_profiles` and child tables
- `resume_build_policy_settings`
- `resume_requirement_review_settings`

### Governed operational authority

The following persisted surfaces are authoritative for audit and operations but do not redefine the career library:

- `raw_intake_import_runs`
- `raw_intake_import_items`
- `anomalies`
- `generation_manifests`

### Derived authority

The following are derived from source state plus request inputs and may be recomputed:

- requirement analysis
- reviewed requirement analysis
- preflight results
- bundle semantics and bundle input
- assembled resume artifact
- generated files written to disk

Derived payloads may be cached, echoed back from the frontend, or embedded in a manifest snapshot for audit. That does not make them independent authority surfaces.

### Presentation authority

The following surfaces are presentation-only and cannot become the truth model by drift:

- React component state
- frontend filters and local view state
- frontend localStorage convenience caches, including browser-harness data and saved posting text
- rendered DOCX output

## Admissible Transformations

The following changes are admissible inside an approved seam without a new product decision.

- Clarify or tighten documentation so it matches current runtime truth.
- Refine library CRUD or validation while preserving the current truth model.
- Refine taxonomy and inference behavior while preserving current table meanings and capability boundaries.
- Refine requirement-analysis heuristics while keeping the current structured output contract.
- Refine requirement-review filtering while keeping reusable persistence limited to the current noise-term settings row.
- Refine tag-first bundle preparation while preserving the subset and projection rules for posting-matched tags and delivery toolkit output.
- Refine deterministic assembly, gap reporting, manifest persistence, or DOCX rendering while preserving evidence-bounded output and top-level artifact shape.
- Add tests, probes, or validation that make the current contracts easier to falsify.

The following changes are not admissible without approval.

- Adding new canonical persistence for posting workspaces, review queues, or draft state.
- Widening manifest JSON or frontend localStorage convenience caches into de facto posting-workspace, queue, or transition-state persistence.
- Adding any network, provider, telemetry, or cloud path.
- Treating browser harness behavior as canonical desktop behavior.
- Widening candidate identity beyond the active singleton profile model.
- Changing the assembled artifact shape or making a new artifact format mandatory.
- Turning assembly into freeform paraphrase or unsupported claim generation.
- Changing raw intake audit semantics.
- Introducing compatibility layers for retired models or legacy schemas.

Any new enum, status, category, or contract field must map to a deterministic function over current observables, explicit user input, or explicitly persisted audit data. If that mapping is not clear, stop and define it before implementation.

## Review Checkpoints

Use these checkpoints before closing behavior-facing work.

### Runtime split checkpoint

- Does desktop mode still own the product-only capabilities?
- Does browser mode remain visibly non-canonical?

### Storage checkpoint

- Is SQLite still canonical?
- Are foreign keys still required and active?
- Did the change avoid turning generated artifacts into source data?

### Taxonomy and inference checkpoint

- Are canonical tags, inference markers, and delivery toolkit metadata still the controlling tag surfaces?
- Do evidence save and tag refresh flows remain inference-aware and explicit?

### Requirement analysis and review checkpoint

- Does analysis still emit the current structured contract?
- Is reusable persistence still limited to the noise-term settings row unless a wider change was approved?
- Are request-scoped reviewed analyses still treated as derived state?

### Assembly and artifact checkpoint

- Does the assembled artifact still expose `resume`, `gap_report`, and `provenance`?
- Do selected record and evidence surfaces remain inspectable?
- Are unsupported requirements still visible instead of being buried?

### Import and operations checkpoint

- Does preview remain non-mutating?
- Do import ledgers, anomaly records, and manifests stay auditable?
- Are delete or cleanup actions explicit rather than silent side effects?

### Documentation checkpoint

- Do the docs describe the current app rather than a retired prototype model?
- Did the change avoid asserting nonexistent tables, ledgers, or workflows?

## Harness Admissibility Inputs

Every admissibility report for this repo should name these inputs explicitly.

- Invariant constraints.
  Desktop runtime is the product; browser mode is only a harness; SQLite is canonical; resumes are derived outputs; no hidden network, telemetry, or cloud assumptions; no legacy compatibility assumptions unless explicitly authorized.

- Task constraints.
  Exact seam, editable files, forbidden surfaces, expected observable consequence, and acceptance criteria.

- Source evidence.
  Which README lines, schema definitions, Rust command surfaces, TypeScript runtime contracts, or user instructions ground the requested change.

- Affected downstream surfaces.
  Schema, frontend capability boundaries, taxonomy contracts, profile settings, pipeline behavior, manifests, intake ledgers, docs, and tests touched by the seam.

- Non-affected surfaces.
  Anything outside the approved seam, especially runtime code, storage, network behavior, deployment assumptions, and archive history.

- Assumptions.
  Any unresolved handoff question the seam depends on. If the assumption would widen storage, runtime boundaries, or product behavior, stop and escalate instead of guessing.

- Validation plan.
  The narrowest falsifiable check for the touched surface.

- Stop conditions.
  Missing source evidence, contradictory authority, missing acceptance criteria, or any need to cross schema, runtime-boundary, provider, compatibility, or artifact-contract approval lines.

## Open-Question Discipline

When future work hits a real unresolved question, record it as an explicit open decision or in the project-spec handoff matrix. Do not quietly resolve it by writing speculative canonical prose or by sneaking the answer into implementation.
