# Career Ledger Project Spec

This file describes the current canonical product shape for the Tauri application in this repository. It is not a future-state wishlist. If a statement here cannot be grounded in the live SQLite schema or Rust and TypeScript runtime contracts, it does not belong here. README prose may corroborate those surfaces, but it does not outrank them.

The companion governance file defines authority order, approval boundaries, invariants, and admissibility rules. This file defines the product thesis, runtime split, truth model, SQLite baseline, extracted portable contracts, operator workflow, acceptance probes, and a short handoff decision matrix for genuinely unresolved follow-on questions.

## Product Thesis

Career Ledger is a local-first desktop application for keeping a user-owned career evidence library and producing targeted resume artifacts without pretending the generated artifact is the source of truth.

The durable model is simple:

- experience records hold employment and project entries
- evidence items hold concrete claims and attached tags
- taxonomy tables define the canonical tag vocabulary, delivery toolkit grouping, and inference markers
- a candidate profile and build-policy settings shape resume output
- a job posting is analyzed at runtime to filter and prioritize existing evidence

The app is deliberately evidence-bounded. Unsupported requirements stay visible in the gap report instead of being turned into fluent fiction. The product is desktop-first, local-only, and explicit about what is persisted versus what is derived on demand.

## Runtime Split

Career Ledger has two runtime modes, and they are not equivalent.

| Surface | Status | Purpose |
| --- | --- | --- |
| Tauri desktop runtime | Product runtime | Full SQLite persistence, file access, taxonomy import/export, raw intake import, library tag refresh, resume pipeline commands, and DOCX rendering |
| Browser harness | Development harness only | Frontend-only localStorage sandbox with desktop-only capabilities intentionally disabled |

The browser harness exists to exercise frontend flows. It is not the normative product contract. Runtime truth lives in the desktop stack.

## Current Build Profile

The current baseline product is the following concrete stack and capability set:

- Desktop shell: Tauri v2.
- Frontend: React and TypeScript.
- Backend: Rust command surface under `src-tauri/src`.
- Persistence: local SQLite with `PRAGMA foreign_keys = ON` in the shipped schema.
- File-backed operations: taxonomy import/export, raw intake import, optional artifact writing, and DOCX rendering.
- Privacy model: no network calls, no telemetry, no cloud service, and no hidden provider path.
- Resume workflow: requirement analysis, optional requirement review filtering, preflight selection, tag-first bundle preparation, deterministic assembly, optional artifact emission, and optional manifest persistence.

The app does not currently persist a saved per-posting workspace model in SQLite. Requirement analysis, reviewed analysis, bundle preparation, and assembly run on demand from source data and request payloads. The frontend may cache non-authoritative convenience values in localStorage, including the last job posting text, the selected database-path hint, and the artifact output directory.

## Operator Workflow

The live app supports the following end-to-end flow.

1. Choose or initialize the active desktop database.
   The desktop runtime can create and select a SQLite database path. Browser harness mode cannot.

2. Maintain the career library.
   Operators create and edit `experience_records` and `evidence_items`. Evidence saves are inference-aware: the app compares explicit values and inferred tags, and create or update can return `confirmation_required` before writing if an explicit decision is needed.

3. Maintain the taxonomy.
   Operators manage canonical tags, delivery toolkit categories, delivery toolkit metadata, and inference markers. The taxonomy is fully user-controlled and can be imported, exported, cleared, and re-applied to the library through tag refresh or re-inference commands.

4. Maintain profile and generation settings.
   The current app uses one active candidate profile with ordered education, certifications, and summary lines. Build policy is stored as a JSON blob in a single active settings row. Reusable requirement-review settings persist only noise terms.

5. Analyze a job posting.
   Requirement analysis derives a structured `RequirementAnalysis` from posting text: clusters, atoms, matched tags, posting keyword bank, unrecognized notable terms, experience-years hints, and negation-aware normalized terms.

6. Optionally review requirement analysis.
   The frontend can exclude clusters and mark terms as useful or noise. The reviewed analysis stays request-scoped. The only reusable persisted review setting in the current baseline is the normalized noise-term list.

7. Prepare bundle semantics.
   Bundle preparation combines the library export, candidate profile, build policy, requirement analysis, and preflight report. Bundle semantics are tag-first. `posting_matched_tags` are a strict subset of `toolkit_tags`, and delivery toolkit output is a grouped human-facing projection from explicit taxonomy metadata only.

8. Assemble the resume artifact.
   The assembler deterministically emits a structured artifact with `resume`, `gap_report`, and `provenance`. Highlights and profile text stay normalization-bounded and do not paraphrase beyond supported projection.

9. Optionally write files and persist a manifest.
   The pipeline can write assembled JSON, optional bundle JSON, and optional DOCX. It can also persist a generation manifest containing hashes, selected record and evidence IDs, gap report, optional requirement review snapshot, and freeform notes.

10. Use operations surfaces.
    The app supports anomaly management, generation-manifest inspection and deletion, and raw intake preview plus import with explicit run and item ledgers.

## Not Part Of The Current Baseline

The following concepts are not part of the shipped Tauri baseline and should not be smuggled back into canonical docs as if they already exist:

- claim ceilings as a persisted or derived baseline contract concept
- semantic transition ledgers, transition-status workflows, or state-machine baseline governance
- `candidate_alignments`, `claim_options`, `gap_items`, or `review_queue_items` as tables or as required baseline runtime contract fields
- provider adapters or model-backed analysis as the normative baseline
- Markdown as a required artifact format
- hidden browser parity with desktop-only capabilities

If future work introduces any of those, it needs an explicit decision and should start from current runtime truth rather than from retired prototype language.

## Truth Model

Career Ledger has three important truth categories.

### Canonical persisted source state

This is the state the product actually owns and mutates in SQLite:

- experience records
- evidence items
- taxonomy tables
- active candidate profile and its child rows
- active build policy settings
- active reusable requirement-review noise settings

### Governed operational state

This is persisted and authoritative for audit or operations, but it is not the career library itself:

- raw intake import runs and row outcomes
- anomaly records
- generation manifests

### Derived runtime state

This is built from source state plus request inputs and can be recomputed:

- requirement analysis
- reviewed requirement analysis
- preflight filter results
- bundle semantics and bundle input
- assembled resume artifact
- generated files on disk

The current app does not persist first-class posting workspaces, candidate-review queues, draft snapshots, or transition histories. Job posting text is supplied per request even though the frontend may cache the latest text locally for convenience and taxonomy diagnostics. The manifest stores a hash of the posting and selected outputs, not a full saved workspace model.
`requirement_review_json` inside a manifest is an audit snapshot of one generation run. It must not be treated as a saved review workspace, queue, or transition log by drift.

## Minimum SQLite Contract

The current schema defines the minimum persisted contract the desktop app actually relies on.

### Library tables

- `experience_records`: `id`, unique `slug`, `record_type` constrained to `employment` or `project`, organization, title, optional dates, optional location, optional employment type, `context_tags_json`, reserved `canonical_scope_summary`, reserved `common_context_json`, timestamps.
- `evidence_items`: `id`, `experience_record_id`, `claim`, optional `date_range`, required `tags_json`, reserved `scope_context_json`, optional `evidence_note`, timestamps. Each evidence row belongs to exactly one experience record and cascades on record delete.

### Raw intake ledgers

- `raw_intake_import_runs`: `id`, `source_path`, item counts, skipped count, timestamp.
- `raw_intake_import_items`: primary-key `intake_id`, `run_id`, optional source area, `outcome` constrained to `imported` or `skipped`, optional `skip_reason`, optional linked record ID, created evidence IDs as JSON, timestamp.

### Generation and operations tables

- `generation_manifests`: `id`, timestamp, `artifact_kind`, target role family, source input paths and SHA-256 hashes, selected record and evidence IDs as JSON, `gap_report_json`, artifact path and hash maps as JSON, optional `requirement_review_json`, notes.
- `anomalies`: `id`, entity type and ID, anomaly code, severity, message, detected time, optional resolved time.

### Candidate profile tables

- `candidate_profiles`: singleton row enforced by `id = 'active'`, plus display name, location, optional contact fields, version, config type, timestamps.
- `candidate_profile_education`: ordered child rows with institution, credential, `signal_tags_json`, optional major and minor, timestamps.
- `candidate_profile_certifications`: ordered child rows with name, issuer, credential detail, `signal_tags_json`, timestamps.
- `candidate_profile_summary_lines`: ordered child rows with text and timestamps.

### Settings tables

- `resume_build_policy_settings`: singleton active row containing `policy_json` plus timestamps.
- `resume_requirement_review_settings`: singleton active row containing normalized `noise_terms_json` plus timestamps.

### Taxonomy tables

- `canonical_tags`: opaque ID, unique canonical `tag`, optional description, timestamp.
- `taxonomy_metadata`: key-value metadata store for taxonomy-level state.
- `delivery_toolkit_categories`: category name and unique sort order.
- `delivery_toolkit_metadata`: one row per canonical tag mapping the tag to a category and human-facing display label.
- `tag_inference_markers`: opaque ID, canonical tag, `marker_kind` constrained to `literal` or `compound`, optional literal value, timestamp.
- `tag_inference_marker_terms`: opaque ID, marker ID, `term_group` constrained to `all_of` or `any_of`, term value, sort order, uniqueness constraints.

## Extracted Portable Contracts

The following contracts are explicit in current code and worth preserving if the app is moved or reimplemented.

### Runtime capability contract

Runtime detection is explicit. Desktop mode enables database-path selection, taxonomy file import and export, taxonomy clearing, library tag refresh, resume pipeline commands, and raw intake import. Browser harness mode disables all of those and uses localStorage-backed services instead.

### Evidence save contract

Evidence create and update are not blind writes. The backend computes an inference comparison and can return `confirmation_required` with no write performed. Only an explicit follow-up save decision completes the mutation when inferred and explicit values need operator confirmation.

### Requirement analysis contract

`RequirementAnalysis` has a stable high-level shape:

- `analysis_version`
- `source` with posting SHA-256, posting length, derived target role family, posting keyword bank, unrecognized notable terms, and extraction method
- `clusters` with IDs, labels, kinds, priority order, atom IDs, and matched tags
- `atoms` with IDs, cluster linkage, source order, text, kind, priority, negation-aware normalized terms, matched tags, optional experience-years hints, quantifier flag, and optional merge metadata

Requirement extraction is local and negation-aware. The contract is about structured reviewable output, not about a hidden model call.

### Requirement review contract

Requirement review has two layers:

- reusable persisted settings: normalized noise terms only
- request-scoped override: reviewed cluster IDs, excluded cluster IDs, excluded atom IDs, useful terms, and noise terms tied to a specific posting hash

Generation only accepts reviewed analysis when both `reviewed_requirement_analysis` and `requirement_review` are supplied together, and both must match the current posting hash. The current app does not persist a standing review queue or a saved per-posting review workspace.
In the live runtime, the backend does not recompute the reviewed analysis; it trusts the paired caller-supplied payload after those co-presence and hash checks. The default frontend derives that payload from the base requirement analysis plus the review draft. Reviewed analysis remains request-scoped and non-authoritative and must not silently grow into a saved posting workspace or queue.

### Bundle semantics contract

Bundle preparation is tag-first by design. The code-level notes are explicit:

- active bundle semantics revolve around tags
- tags come from record-level context tags plus direct evidence and static-source education and certification tags
- `toolkit_tags` come from record-level context tags, direct evidence, and certifications; education tags remain in bundle semantics but do not feed the rendered delivery toolkit
- posting-matched tags are a strict subset of toolkit tags
- posting-derived keywords may filter or prioritize supported tags, not invent new ones
- delivery toolkit is a grouped projection from taxonomy metadata only

### Assembly artifact contract

The assembled artifact is shaped as:

- `resume`
- `gap_report`
- `provenance`

The resume itself includes header, target role family, highlights, optional profile, professional experience, projects, education, certifications, and optional toolkit section.

The gap report separates supported, partially supported, and unsupported requirements and carries compensation strategy and risk flags.

Provenance includes target role family, selected record IDs, selected evidence IDs, claim-to-evidence mappings, constraint flags, and notes.

Two behavioral constraints are explicit in the assembler:

- highlights and profile do not paraphrase beyond normalization-only projection
- delivery toolkit is the only rendered tag surface; `posting_matched_tags` remain bundle-internal

### Artifact writing contract

When artifact writing is enabled, the pipeline writes assembled JSON. It may also write bundle JSON and DOCX. The current baseline does not require Markdown, HTML, or PDF output.

### Manifest contract

Manifest persistence is optional. When enabled, the manifest stores:

- artifact kind
- target role family
- job-posting SHA-256
- build-policy and candidate-profile hashes
- library export hash
- selected record and evidence IDs
- gap report snapshot
- artifact path map and artifact hash map
- optional requirement-review snapshot
- optional operator notes

### Raw intake contract

Raw intake is a bounded import path with preview and import phases. The persisted audit surface is explicit run and item ledgers with outcomes and skip reasons. It is not a silent bulk loader.

## Runtime And Service Architecture

The current app is organized around a thin frontend/runtime split and a Rust command core.

### Frontend runtime layer

`src/lib/runtime.ts` selects either desktop services or local browser-harness services. The capability map is part of the contract, not a cosmetic label.

### Browser harness services

`src/lib/local-service.ts` provides a localStorage-backed approximation for frontend development. It can mimic local CRUD flows, but it is not allowed to claim desktop-only capabilities.

### Tauri command surface

The Rust backend exposes commands for:

- database initialization and active-path management
- library CRUD and delete previews
- evidence inference preview plus save confirmation flow
- candidate profile CRUD
- build policy and requirement-review noise-term settings
- taxonomy CRUD, import, export, and library tag refresh
- requirement analysis
- bundle-semantics build, bundle preparation, resume assembly, and full pipeline execution
- raw intake preview and import
- anomaly and generation-manifest operations

### Rust domain modules

The main implementation roles are currently split across modules such as:

- taxonomy and inference
- requirement analysis
- bundle preparation
- resume assembly
- resume pipeline orchestration
- intake import
- operations and manifest handling

### Storage and file boundaries

SQLite is the only canonical local store. Filesystem writes are explicit output operations for taxonomy export and generated resume artifacts. Raw-intake files are read-only input selected from disk; preview does not write import ledgers, and import writes SQLite run and item ledgers rather than a copied intake file.

## Acceptance Probes

These probes describe the current product bar. Future implementation work should use them when claiming the app still matches the current spec.

### Desktop runtime probe

Question: does desktop mode expose the full product while browser mode stays a harness?

Required proof: desktop runtime reports resume pipeline, raw intake import, taxonomy file import and export, database path selection, taxonomy clear, and library tag refresh as available; browser harness reports them as unavailable.

### Canonical storage probe

Question: do records and evidence persist to SQLite as the canonical source?

Required proof: create a record and evidence item through the desktop runtime, restart or reconnect, and read them back from SQLite-backed commands. Generated artifacts must not be used as source.

### Evidence confirmation probe

Question: can evidence save require explicit confirmation before mutation?

Required proof: submit evidence whose inferred tags require operator confirmation and observe `confirmation_required`; provide an explicit save decision and observe the row persist.

### Requirement analysis probe

Question: does posting analysis produce the current structured contract?

Required proof: analysis returns a posting SHA-256, target role family, posting keyword bank, unrecognized notable terms, clusters, atoms, matched tags, and negation-aware normalized terms.

### Requirement review boundary probe

Question: is reusable review persistence limited to noise terms?

Required proof: save reusable noise terms and reload them from `resume_requirement_review_settings`; verify reviewed analysis and full review override remain request-scoped except when copied into a manifest snapshot.

### Bundle semantics probe

Question: does tag-first bundle preparation preserve the current subset and projection rules?

Required proof: `toolkit_tags` come from record-level context tags, direct evidence, and certifications, not education rows; `posting_matched_tags` are a strict subset of `toolkit_tags`; and delivery toolkit groups come only from taxonomy metadata attached to those posting-matched tags.

### Assembly artifact probe

Question: does resume assembly remain evidence-bounded and normalization-bounded?

Required proof: the assembled artifact has `resume`, `gap_report`, and `provenance`; provenance includes selected record and evidence IDs plus claim-to-evidence mappings; unsupported requirements remain visible in the gap report.

### Pipeline and manifest probe

Question: can the pipeline optionally write artifacts and persist an auditable manifest?

Required proof: with artifact output enabled, the pipeline writes assembled JSON and optionally bundle JSON and DOCX; with manifest persistence enabled, a manifest row is stored with hashes, selected IDs, optional requirement review, and notes.

### Raw intake probe

Question: does intake stay previewable and auditable?

Required proof: preview does not write import-run rows; import writes run and item ledgers with imported or skipped outcomes and preserves skip reasons.

## Handoff Decision Matrix

Only unresolved questions that are genuinely surfaced by the current app belong here.

| Question | Current truth | If revisited |
| --- | --- | --- |
| Saved per-posting workspaces | The app computes requirement analysis, reviewed analysis, bundle input, and assembly on demand. It does not persist first-class posting workspaces or draft state in SQLite, but the frontend does cache the latest posting text in localStorage for convenience and diagnostics. Generation manifests remain audit snapshots only, not workspace state. | Decide whether future work should stay transient or introduce explicit saved workspace tables with new approval. |
| Reviewed-analysis hardening | The default frontend derives reviewed analysis from base analysis plus review draft, but the backend currently only enforces co-presence and matching posting hash before using the supplied reviewed payload. | Decide whether future work should re-derive reviewed analysis in the backend, validate exact derivation, or keep the current trust boundary explicit. |
| Candidate profile multiplicity | The schema hard-codes one active profile with ordered child tables. | Decide whether multiple profiles or personas are a real product need before widening schema or UI. |
| Artifact retention policy | The app can write files and persist manifests, but retention and cleanup policy is operationally thin beyond explicit user actions. | Decide file ownership, cleanup behavior, and whether manifest deletion should ever coordinate with file deletion. |
| Browser harness scope | The harness is intentionally a localStorage-backed UI sandbox with desktop-only capabilities disabled. | Decide whether future development needs a richer test shim or whether the harness should remain strictly non-product. |

Anything outside those questions should be omitted from canonical spec text until the repo exposes real evidence for it.
