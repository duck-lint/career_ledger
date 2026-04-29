# Implementation 02 Tracker

## Status

- Overall status: Proposed
- Current focus: lock the implementation-02 seam order and resolve the storage boundary for reusable noise terms
- Current blocking decision: approve the storage home, scope, and precedence rules for persistent noise-term state before backend work starts

## Decisions

| Date | Decision | Why | Follow-up |
|---|---|---|---|
| 2026-04-29 | Keep the four candidate items in one implementation-02 plan with a hard seam boundary before storage work | They share one operator flow, and only the persistence slice crosses a major approval boundary | If storage approval stalls, land seams 1 through 3 and open implementation-03 for persistence |
| 2026-04-29 | Use "Resume Audit Surfaces And Persistent Review Intent" as the working theme | It names the actual work instead of hiding it under generic polish language | Revisit only if scope narrows to UI-only cleanup |
| 2026-04-29 | Recommend active-database storage for reusable noise terms | Noise suppression changes analysis and generation behavior and should move with the ledger data rather than a single browser session | Needs explicit approval before schema or command changes |

## Open Questions

- Does implementation-02 include native manifest-detail rendering in [src/components/views/OperationsView.tsx](../../src/components/views/OperationsView.tsx), or is the scope limited to [src/components/views/ResumeGenerationView.tsx](../../src/components/views/ResumeGenerationView.tsx)?
- Should reusable noise terms be global to the active database or scoped by target role family?
- Can a later posting mark a stored noise term useful, and if so does the per-posting override win for that run only?
- Must any raw JSON inspection surface remain in-app for support or debugging after the Resume JSON tab is removed?

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

- None yet; this tracker is still at planning state.

## Completion Checklist

- [ ] Resume JSON tab audited and either removed or retained with explicit justification
- [ ] Native resume-generation audit surfaces cover normal gap and manifest review without requiring raw JSON
- [ ] Taxonomy diagnostics include education and certification signal inputs in coverage and marker-hit analysis
- [ ] Taxonomy diagnostics copy reflects the expanded input surface
- [ ] Reusable noise-term storage home, scope, and precedence rules approved
- [ ] Reusable noise terms save, load, and apply across later posting analysis or generation in the approved scope
- [ ] Focused frontend tests updated and passing
- [ ] Focused backend or storage tests updated and passing if persistence uses the active database