# Implementation 02 Tracker

## Status

- Overall status: Complete
- Current focus: None
- Current blocking decision: None

## Decisions

| Date | Decision | Why | Follow-up |
|---|---|---|---|
| 2026-04-29 | Keep the four candidate items in one implementation-02 plan with a hard seam boundary before storage work | They share one operator flow, and only the persistence slice crosses a major approval boundary | If storage approval stalls, land seams 1 through 3 and open implementation-03 for persistence |
| 2026-04-29 | Use "Resume Audit Surfaces And Persistent Review Intent" as the working theme | It names the actual work instead of hiding it under generic polish language | Revisit only if scope narrows to UI-only cleanup |
| 2026-04-29 | Store reusable noise terms in the active database as one global per-ledger set | Noise suppression changes analysis and generation behavior and should move with the ledger data rather than a single browser session | Landed in `resume_requirement_review_settings` |
| 2026-04-29 | Remove the Resume JSON tab from [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx) | Preview and pipeline now cover the normal operator path; the in-view raw JSON surface was redundant | Reassess only if a support/debug need proves the removed surface was still doing real work |
| 2026-04-29 | Treat the latest explicit review noise set as the reusable default set | This keeps “mark it noise so it stays gone later” as the primary contract without adding a second persistence concept | If per-posting useful overrides are needed later, design them as a separate surface instead of overloading the current global setting |
| 2026-04-29 | Replace raw manifest JSON blocks in [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx) with native audit sections | The remaining raw JSON surface no longer matched the operator path after the Resume JSON tab removal and gap-review improvements | Keep any future debug-only JSON view outside the main audit surface |

## Open Questions

- None.

## Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| The Resume JSON tab is removed before native audit surfaces reach parity | Medium | Medium | Inventory unique fields first and remove the tab only after parity is explicit |
| Taxonomy diagnostics logic expands while the panel still claims library-only coverage | Medium | Medium | Update diagnostics copy and tests in the same slice as the logic change |
| Reusable noise terms land in the wrong storage home | High | Medium | Hold an approval gate on storage location and scope before implementation |
| Global noise suppression hides terms that are valid in a different role family | High | Medium | Decide scope and override precedence before persistence work |

## Planned Validations

- Focused React coverage for resume audit surfaces and RequirementAnalysisReviewPanel state hydration or application behavior.
- Focused diagnostics unit coverage in [src/lib/taxonomy-diagnostics.test.ts](../../src/lib/taxonomy-diagnostics.test.ts).
- Focused review-state coverage in [src/lib/requirement-review.test.ts](../../src/lib/requirement-review.test.ts) and [src/components/resume/RequirementAnalysisReviewPanel.test.tsx](../../src/components/resume/RequirementAnalysisReviewPanel.test.tsx).
- If DB-backed persistence is approved, focused Rust coverage for storage and command round-trip behavior.
- The relevant frontend verify command and a narrow backend test slice before the effort is marked complete.

## Completed Validations

- `npx vitest run src/lib/taxonomy-diagnostics.test.ts src/components/taxonomy/TaxonomyDiagnosticsPanel.test.tsx`
- `npx vitest run src/lib/requirement-review.test.ts src/components/resume/RequirementAnalysisReviewPanel.test.tsx src/lib/tauri-service.test.ts src/lib/local-service.test.ts`
- `npx vitest run src/components/views/OperationsView.test.tsx`
- `Push-Location src-tauri; cargo test requirement_review_settings; Pop-Location`
- Editor diagnostics clean for [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx), [src/components/resume/RequirementAnalysisReviewPanel.tsx](../../src/components/resume/RequirementAnalysisReviewPanel.tsx), [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx), [src/components/views/OperationsView.test.tsx](../../src/components/views/OperationsView.test.tsx), [src/lib/types.ts](../../src/lib/types.ts), [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs), and [src-tauri/src/requirement_review_settings.rs](../../src-tauri/src/requirement_review_settings.rs)

## Completion Checklist

- [x] Resume JSON tab audited and either removed or retained with explicit justification
- [x] Native resume-generation audit surfaces cover normal gap and manifest review without requiring raw JSON
- [x] Taxonomy diagnostics include education and certification signal inputs in coverage and marker-hit analysis
- [x] Taxonomy diagnostics copy reflects the expanded input surface
- [x] Reusable noise-term storage home, scope, and precedence rules approved
- [x] Reusable noise terms save, load, and apply across later posting analysis or generation in the approved scope
- [x] Focused frontend tests updated and passing
- [x] Focused backend or storage tests updated and passing if persistence uses the active database

## Completed In This Slice

- Removed the redundant Resume JSON tab from [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx) and kept preview plus pipeline as the primary in-view audit surfaces.
- Updated the resume generation flow so reusable noise terms are loaded from the active database during analyze and generate paths, and the filtered reviewed analysis now drives the non-review posting-analysis summaries.
- Added DB-backed reusable noise-term load and save methods to the shared pipeline service adapters and created the backend settings seam in [src-tauri/src/requirement_review_settings.rs](../../src-tauri/src/requirement_review_settings.rs).
- Updated the requirement review helpers and panel so persisted noise terms prehydrate the review UI, reset on new analyses, and only apply terms that actually exist in the current analysis.
- Expanded taxonomy diagnostics coverage and marker-hit analysis to include candidate-profile education and certification inputs, and updated the panel copy to match the broader ledger-level scope.
- Replaced the raw manifest JSON blocks in [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx) with native sections for selected ids, artifact outputs, requirement review summaries, and the shared gap report panel, and added focused coverage in [src/components/views/OperationsView.test.tsx](../../src/components/views/OperationsView.test.tsx).