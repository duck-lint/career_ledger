# WS4: Requirement Analysis Review

## Status

Complete.

First review UI slice landed on 2026-04-24. The generation-affecting correction flow landed and passed validation on 2026-04-25.

## Finding Addressed

Requirement analysis is currently a local surface-term and taxonomy matching process. That is a good local-first choice, but users can misread it as semantic AI judgment unless the app frames and exposes it carefully.

## Goal

Make requirement analysis understandable and optionally correctable before resume generation depends on it.

## Recommended End State

- The UI describes analysis as local extraction and taxonomy matching.
- Requirement clusters and extracted terms are reviewable.
- Users can adopt unrecognized terms into taxonomy without losing the need to re-infer evidence.
- If implemented, corrections are explicit per-run state before they become persistent state.

Implemented end state:

- Corrections are explicit per-run state.
- Reviewed clusters and noise-term decisions flow into generation for the current run.
- Review metadata is stored on the generation manifest for audit, not as reusable posting-review state.

## Non-Goals

- Do not build a full job-posting parser product.
- Do not claim semantic understanding that the local extractor does not provide.
- Do not add cloud/LLM dependencies.
- Do not silently rewrite job requirements.

## Impacted Surfaces

- `src/components/views/ResumeGenerationView.tsx`
- `src/components/resume/RequirementAnalysisReviewPanel.tsx`
- `src/lib/requirement-review.ts`
- `src/lib/types.ts`
- `src/components/views/OperationsView.tsx`
- `src-tauri/src/resume_pipeline.rs`
- `src-tauri/src/operations.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/defaults/career_schema.sql`
- Taxonomy adoption dialogs
- Tests for analysis framing and correction flow

## Implementation Slices

### Slice 1: Copy and framing cleanup

- Rename or describe analysis as local requirement extraction where useful.
- Explain matched keywords and suggested terms as taxonomy signals.
- Avoid overpromising semantic ranking.

Status:

- Landed in the Resume posting analysis surface.
- The review panel frames output as local surface-term extraction and taxonomy matching.
- Per-run review marks do not rewrite the posting text; when reviewed analysis is available, included clusters and noise terms explicitly shape generation for the current run.

### Slice 2: Review UI

- Show clusters, atoms, matched tags, extracted terms, negated terms, and suggested terms clearly.
- Add affordances to mark terms as useful/noise if scoped.

Status:

- Landed as a dedicated Requirement Review panel.
- The panel exposes clusters, requirement atoms, matched taxonomy tags, positive extracted terms, negated terms, quantifiers, experience-year constraints, suggested taxonomy terms, and per-run reviewed/useful/noise marks.
- Suggested taxonomy terms still call the existing adopt/create taxonomy flow.

### Slice 3: Correction model decision

- Decide whether corrections are per-run only or persisted.
- If per-run, define a request shape for generation with corrected analysis.
- If persisted, pause and define storage semantics before implementation.

Decision:

- The user approved robust generation-affecting corrections, including frontend/backend/schema/pipeline contract changes.
- Corrections are per-run state, not persisted reusable edits.
- The bridge from review to generation is explicit: the frontend derives a reviewed `RequirementAnalysis`, sends it with structured `RequirementReviewOverride` metadata, and the backend validates both against the current posting hash before using the reviewed analysis.

### Slice 4: Pipeline integration

- Let reviewed/corrected analysis feed generation if approved.
- Preserve manifest traceability for corrected runs.

Status:

- Implemented.
- `ResumeGenerationView` sends `reviewed_requirement_analysis` and `requirement_review` when review state exists.
- The Rust pipeline uses reviewed analysis instead of freshly extracted analysis only after source-hash validation.
- The pipeline result returns `requirement_review` for the completed run.
- Generation manifests persist `requirement_review_json` and Operations displays the stored review metadata.
- Runtime DB user version is now 2, with a migration that adds `generation_manifests.requirement_review_json`.

### Slice 5: Tests

- Requirement analysis review renders extracted state accurately.
- Suggested-term adoption still warns that library tags require re-inference.
- Corrected analysis, if implemented, affects generation deterministically.

Status:

- Focused frontend tests cover local-extraction framing, extracted atoms/terms/negations, per-run review marks, suggested-term adoption callback wiring, reviewed-analysis transforms, and emitted review metadata.
- Rust tests cover reviewed-analysis use, manifest persistence, and rejection when review metadata belongs to a different posting.

## Validation Plan

- Focused frontend tests for analysis review UI.
- Backend tests if the analysis contract changes.
- `npm run verify:frontend` for frontend lint/typecheck/tests.
- `cargo test` for backend pipeline, operations, migration, and existing regression coverage.

## Validation Completed

- `npm test -- RequirementAnalysisReviewPanel.test.tsx` passed.
- `npm run verify:frontend` passed: lint, typecheck, and all frontend tests green.
- `npm test -- requirement-review.test.ts RequirementAnalysisReviewPanel.test.tsx` passed: 6 focused frontend tests green.
- `cargo test resume_pipeline` passed: 11 focused pipeline tests green.
- `cargo test operations` passed: 4 focused operations tests green.
- `npm run verify:frontend` passed after the contract changes: lint, typecheck, and 53 frontend tests green.
- `cargo test` passed after the contract changes: 108 Rust tests green in `app_lib`.

## Risks

- Correction persistence becomes ambiguous.
- Requirement review adds friction before the first successful resume.
- Users expect the app to understand job postings like an LLM.

Current mitigations:

- Persistence is intentionally limited to manifest audit metadata.
- Review remains inside the posting-analysis flow and is only used when review state is available.
- UI copy frames the feature as local extraction and taxonomy matching.

## Exit Criteria

- Analysis is framed as local extraction and taxonomy matching.
- Users can inspect why a posting produced its clusters/terms.
- Any correction path has explicit state ownership and validation.

Current status:

- Analysis framing is explicit in the UI.
- Users can inspect clusters, atoms, matched tags, extracted positive terms, negated terms, and suggested taxonomy terms.
- Review marks have explicit per-run ownership.
- Generation-affecting corrections are implemented through the pipeline contract and are manifest-traceable.