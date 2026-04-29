# Implementation 02 Plan: Resume Audit Surfaces And Persistent Review Intent

## Intent

- Move the resume-generation workflow away from redundant raw JSON when the app already has structured audit data.
- Make the native audit surfaces cover the gap and manifest details operators actually use during resume generation.
- Bring taxonomy diagnostics in line with the same candidate inputs the resume pipeline already consumes, especially education and certification signal tags.
- Define, and only after approval implement, reusable persistence for requirement-review noise terms so analyst suppressions survive later posting analysis and resume generation.

## Recommended Scope Shape

- Recommendation: keep all four candidate items in one implementation-02 plan.
- Rationale: they sit in one operator loop: analyze a posting, review extracted terms, generate a resume, and inspect the audit output.
- The only real cross-boundary change is reusable noise-term persistence. That is an approval gate, not a reason to split the whole effort up front.
- Contingency: if storage approval stalls, land seams 1 through 3 and open implementation-03 for persistent review state rather than blocking the UI and diagnostics work.

## Non-Goals

- No broad redesign of the Operations screen beyond manifest detail needed for resume-generation audit parity.
- No legacy compatibility layer for older review-state, settings, or manifest shapes.
- No automatic taxonomy mutation or learned suppression behavior from marked noise terms.
- No attempt to persist full per-posting review history unless that is explicitly approved later.
- No blanket removal of every raw JSON surface unless parity is confirmed for normal operator tasks.

## Observed Evidence

- [docs/implementation-projects/README.md](README.md) says the next distinct live effort should start at `implementation-02-*`.
- [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx) still renders `Preview`, `Pipeline`, and `JSON` tabs, and the JSON tab prints both the assembly artifact and the full pipeline result.
- [src/components/resume/ResumeAuditPanels.tsx](../../src/components/resume/ResumeAuditPanels.tsx) already renders a first-class Gap Report and Assembly Audit inside Preview.
- [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx) still renders selected record ids, selected evidence ids, artifact paths, artifact hashes, and requirement review as raw JSON in manifest detail.
- [docs/archive/2026-04-product-improvement-complete/02-resume-provenance-and-gap-drillthrough.md](../archive/2026-04-product-improvement-complete/02-resume-provenance-and-gap-drillthrough.md) describes the prior goal as making the preview auditable without forcing users to inspect JSON, while explicitly keeping raw JSON as an advanced surface.
- [src/lib/taxonomy-diagnostics.ts](../../src/lib/taxonomy-diagnostics.ts) uses candidate-profile education and certification signal tags only for `unknownCandidateProfileSignalTags`; marker-hit and coverage search text still comes from records and evidence only.
- [src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx](../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx) still labels the diagnostics as library-level checks.
- [src/components/resume/RequirementAnalysisReviewPanel.tsx](../../src/components/resume/RequirementAnalysisReviewPanel.tsx) keeps review overrides in local component state and only emits them through `onReviewChange` for the current analysis/generation run.
- [src/lib/runtime-settings.ts](../../src/lib/runtime-settings.ts) currently persists only DB path, artifact output dir, and job posting text in localStorage.
- [src-tauri/src/resume_pipeline.rs](../../src-tauri/src/resume_pipeline.rs) persists `requirement_review` into generation manifests, but not into any reusable settings surface.

## Inferences From The Evidence

- The Resume JSON tab is removable only if it no longer exposes operator-relevant information that is missing from Preview, Pipeline, or manifest detail.
- The remaining "better native gap report display" work is not inventing a gap panel from scratch; it is promoting still-raw audit details into first-class UI where users review current and persisted generation output.
- Persistent noise terms are not a UI-only change. They need a storage contract, load/apply behavior, and explicit override precedence.

## Assumptions And Unknowns

- Assumption: "resume generation" includes both the live ResumeGeneration flow and the manifest detail users rely on to inspect persisted resume runs.
- Assumption: a stored noise-term decision should be reusable across later posting analyses within the same active ledger unless approval picks a narrower scope.
- Assumption: a per-posting review should still be able to disagree with a reusable default, but the precedence rule is still undecided.
- Unknown: whether any raw JSON surface must remain in-app for support or debugging after the Resume JSON tab is removed.
- Unknown: whether reusable noise terms should be global to the active database or scoped by target role family.
- Unknown: whether stored noise terms should suppress only suggested and unrecognized terms, or whether they should also pre-mark controls inside the review panel.
- Unknown: whether Operations manifest-detail rendering belongs in implementation-02 or stays an advanced debug surface for a later effort.

## Affected Surfaces And Blast Radius

- Resume-generation UI: [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx), [src/components/resume/ResumeAuditPanels.tsx](../../src/components/resume/ResumeAuditPanels.tsx), and possibly [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx) for persisted manifest audit parity.
- Requirement-review UI and logic: [src/components/resume/RequirementAnalysisReviewPanel.tsx](../../src/components/resume/RequirementAnalysisReviewPanel.tsx), [src/lib/requirement-review.ts](../../src/lib/requirement-review.ts), and [src/lib/types.ts](../../src/lib/types.ts).
- Taxonomy diagnostics: [src/lib/taxonomy-diagnostics.ts](../../src/lib/taxonomy-diagnostics.ts) and [src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx](../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx).
- Frontend persistence or service boundary: [src/lib/runtime-settings.ts](../../src/lib/runtime-settings.ts) only if the approved storage stays local, otherwise [src/lib/service.ts](../../src/lib/service.ts) plus any command-facing types in [src/lib/types.ts](../../src/lib/types.ts).
- Backend persistence boundary if reusable storage is approved: [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs), [src-tauri/src/resume_pipeline.rs](../../src-tauri/src/resume_pipeline.rs), and likely [src-tauri/defaults/career_schema.sql](../../src-tauri/defaults/career_schema.sql). A dedicated settings module is preferable to overloading candidate-profile or manifest tables.
- Tests: focused React tests around resume audit and review state, focused diagnostics unit tests, and focused Rust tests if DB-backed persistence is approved.
- Blast radius summary: seams 1 through 3 are mostly frontend and logic-local; reusable noise-term persistence crosses storage, command, and possibly schema boundaries.

## Ordered Seams

1. Audit the resume-generation end state and retire only redundant JSON.
   - Inventory which fields in the Resume JSON tab and manifest detail still carry unique operator value.
   - Promote required fields into structured UI first.
   - Remove the Resume JSON tab only if normal resume-generation review no longer depends on it.
   - Keep any remaining raw JSON clearly labeled as advanced or debug, not the primary workflow.

2. Make gap and manifest audit data first-class in the live generation flow.
   - Improve native gap-report and generation-manifest display for the current run and any persisted manifest detail that remains operator-facing.
   - Replace raw JSON blocks for operator-facing fields such as gap-related audit data, artifact outputs, and requirement review with structured cards, lists, and counts.
   - Keep this narrow: no full Operations redesign and no new provenance system.

3. Expand taxonomy diagnostics to use the same candidate inputs the resume pipeline already uses.
   - Fold education and certification signal tags into diagnostics search text and marker-hit analysis.
   - Update copy and status framing so the panel no longer presents this as library-only coverage.
   - Preserve the separate orphan-tag reporting for candidate-profile signal tags.

4. Approval gate: choose the reusable storage home and scope for noise terms.
   - Recommendation: store reusable noise terms in the active database, not localStorage and not inside candidate-profile rows.
   - Why: the setting changes analysis and generation semantics, should travel with the active ledger, and is operator review state rather than candidate identity data.
   - Decide scope: active-database global or role-family scoped.
   - Decide precedence: stored default versus per-posting useful or noise override.

5. Add reusable noise-term persistence and application path.
   - Add a storage contract and service or command surface for load and save.
   - Hydrate the review UI from stored reusable noise terms.
   - Apply stored noise terms during later posting analysis and resume generation in the approved scope.
   - Persist only the reusable preference set, not full historical review sessions, unless a separate approval says otherwise.

## Approval Gates

- Approval required before any schema, storage, or command changes for reusable noise terms.
- Approval required if the proposed storage home is candidate-profile tables, generation manifests, or browser localStorage instead of an active-database settings surface.
- Approval required if implementation removes the last in-app raw JSON surface for resume-generation debugging rather than only removing the now-cosmetic Resume JSON tab.
- Pause if this effort broadens into general requirement-learning behavior, taxonomy mutation, or a full Operations redesign.

## Verification Contract Summary

- Resume-generation review no longer requires the Resume JSON tab for normal audit tasks, and any retained raw JSON is explicitly justified as advanced or debug-only.
- Native UI covers the gap-report and manifest details users need for current-run and persisted-run inspection inside the approved scope.
- Focused diagnostics tests prove education and certification signal tags affect marker-hit or coverage analysis where records and evidence alone would not.
- Focused review-state tests prove reusable noise terms survive beyond one review session and apply to later posting analysis or generation according to the approved scope and precedence.
- Expected focused validations for the eventual implementation:
  - targeted React tests for resume audit surfaces and RequirementAnalysisReviewPanel behavior
  - targeted diagnostics unit tests in [src/lib/taxonomy-diagnostics.test.ts](../../src/lib/taxonomy-diagnostics.test.ts)
  - targeted review-state tests in [src/lib/requirement-review.test.ts](../../src/lib/requirement-review.test.ts) and [src/components/resume/RequirementAnalysisReviewPanel.test.tsx](../../src/components/resume/RequirementAnalysisReviewPanel.test.tsx)
  - if DB-backed persistence is approved, focused Rust tests for storage and command round-trip behavior
  - the relevant frontend verify command and a narrow backend test slice before completion

## Handoff Packet For The Next Role

- Start with a short inventory of which resume-generation details are still unique to raw JSON. Do not remove the tab by assumption.
- Treat reusable noise-term storage as the controlling approval gate. Do not cross schema or command boundaries until that is resolved.
- Prefer an active-database settings surface over localStorage or candidate-profile storage for reusable noise terms.
- Keep seams 1 through 3 independently executable. They should not wait on the persistence decision.
- If storage approval is denied or delayed, stop after seam 3 and open implementation-03 for reusable review state rather than widening implementation-02.
- Do not add legacy compatibility code or dual-write behavior for older review-state shapes in this greenfield repo.