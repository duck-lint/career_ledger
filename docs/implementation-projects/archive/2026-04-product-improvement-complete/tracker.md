# Product Improvement Tracker

This is the archived execution tracker for the product improvement program. It records decisions, risks, completed slices, and validation at closeout.

## Program Status

- Overall status: Closed and archived
- Current recommended focus: None; future product work should start as a new plan
- Current blocking decision: None active. Extra per-evidence fields were removed from scope; evidence capture remains tag-first with no new per-evidence context/admissibility fields.
- Last updated: 2026-04-25

## Workstream Status

| WS | Title | Status | Owner | Notes |
|---|---|---|---|---|
| WS1 | Readiness and first run | Complete | Copilot + user | Dashboard, top-level state model, taxonomy-diagnostics warning integration, next-action links, and focused tests are complete |
| WS2 | Resume provenance and gap drill-through | Complete | Copilot + user | Preview now exposes source evidence, gap report, constraint flags, and assembly notes |
| WS3 | Taxonomy quality diagnostics | Complete | Copilot + user | Diagnostics now cover tag/evidence/profile drift, marker hit health, saved-posting coverage, repair actions, and readiness integration |
| WS4 | Requirement analysis review | Complete | Copilot + user | Local extraction is reviewable; reviewed clusters/noise terms now flow into generation for the run and are stored in manifests |
| WS5 | Framing, runtime, and operator ergonomics | Complete | Copilot + user | Docs/runtime framing, build policy presets, root doc cleanup, and raw-intake preflight landed |

## Decision Log

| Date | Decision | Why | Follow-up |
|---|---|---|---|
| 2026-04-24 | Resume style/template control is deferred from this product-improvement program | It is real product work, but it changes document presentation ownership rather than the evidence/readiness/trust loop | Reopen only if rendered resume presentation becomes the active bottleneck |
| 2026-04-24 | Treat readiness/provenance/diagnostics as the critical path | The app already has machinery; users need state, trust, and repair loops around it | Start with WS1, then WS2, then WS3 |
| 2026-04-24 | Keep Tauri as product runtime and browser as harness in this plan | This matches the completed architectural remediation decision | WS5 should clarify copy/docs, not reopen runtime parity |
| 2026-04-25 | WS4 corrections should flow into generation as explicit per-run state | User prioritized robust, user-empowering correction flow over review-only UI, and approved crossing frontend/backend/schema/pipeline boundaries | Keep persistence limited to manifest traceability unless a later product decision calls for reusable posting reviews |
| 2026-04-25 | Remove extra per-evidence fields from scope | User rejected the premise: extra per-evidence fields create form work, weighting/admissibility mess, and a second retrieval model beside tags | Preserve tag-first evidence capture; improve taxonomy/tag repair and intake ergonomics instead |

## Open Questions

| Question | Needed For | Current Lean |
|---|---|---|
| Should requirement correction persist reusable user edits beyond the current run? | Future WS4 extension | Current implementation is per-run only; manifests preserve what was reviewed for audit, not reuse |

## Risk Log

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Readiness dashboard becomes a shallow checklist detached from real backend state | High | Medium | Source readiness from existing service/query surfaces and add tests for key states |
| Provenance UI overwhelms users with JSON-shaped detail | Medium | Medium | Start with progressive disclosure: summary first, drill-through second |
| Taxonomy diagnostics become slow on larger libraries | Medium | Medium | Keep queries bounded, aggregate in backend where appropriate, and validate with realistic counts |
| Requirement review expands into a full ATS/parser product | High | Medium | Keep scope tied to current local extraction and taxonomy adoption loop |
| Evidence capture becomes form-heavy and undermines plug-and-play use | High | Medium | Do not add new per-evidence context/admissibility fields; make tags and intake repair do the work |
| Operator improvements blur advanced controls with first-run UX | Medium | Medium | Separate defaults/presets from advanced settings and keep browser/Tauri runtime copy explicit |

## Suggested Implementation Sequence

1. Add readiness query/data model and UI shell.
2. Wire readiness signals into existing counts/statuses: taxonomy, records, evidence, candidate profile, tag sync, anomalies, manifests.
3. Add resume preview provenance drill-through for selected bullets and evidence.
4. Render gap report and constraint flags as first-class panels.
5. Add taxonomy/evidence diagnostics and feed them back into readiness.
6. Add requirement analysis review/correction scope once diagnostics exist.
7. Finish docs/runtime/build-policy/intake ergonomics and close the program.

## Completed In Current Slice

- Created the live product improvement planning folder.
- Captured the accepted suggestions as numbered workstreams, with removed scope kept out of the active workstream table.
- Deferred resume style/template control explicitly instead of silently folding it into scope.
- Established readiness, provenance, and diagnostics as the critical path.
- Added an app-level readiness dashboard above the main tabs.
- Readiness now summarizes taxonomy, records, evidence, candidate profile, tag sync, anomalies, manifests, and browser-harness mode using existing service seams.
- Added focused tests for empty first-run, ready, warning, browser harness, navigation, and refresh states.
- Validation: `npm test -- ReadinessDashboard.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 33 frontend tests green.
- Added expandable source evidence panels under rendered resume profile, highlights, employment bullets, and project bullets.
- Source panels map rendered `evidence_ids` back to exported record/evidence details already present in the pipeline payload.
- Added focused tests for mapped source details, missing evidence ids, and claims with no source ids.
- Validation: `npm test -- ResumeEvidenceSources.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 36 frontend tests green.
- Added first-class Resume preview panels for gap report, risk flags, compensation strategy, constraint flags, and assembler notes.
- Gap report now separates supported, partially supported, and unsupported requirements without requiring JSON inspection.
- Constraint flags and assembler notes now explain conservative output directly in the preview surface.
- Validation: `npm test -- ResumeAuditPanels.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 40 frontend tests green.
- Added a pure taxonomy diagnostics model for tag/evidence/profile coverage checks.
- Added a Taxonomy Diagnostics panel to the Taxonomy view using existing services and no backend contract changes.
- Diagnostics now surface tags with no evidence, tags with no markers, missing toolkit metadata, evidence without tags, unknown evidence tags, unknown record context tags, and unknown candidate-profile signal tags.
- Added focused tests for diagnostics computation and panel rendering/refresh behavior.
- Validation: `npm test -- taxonomy-diagnostics.test.ts TaxonomyDiagnosticsPanel.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 45 frontend tests green.
- Extended taxonomy diagnostics with marker hit health against current library text.
- Added saved-posting taxonomy coverage using existing stored posting text without auto-running requirement analysis from the Taxonomy view.
- Added first-step repair actions from diagnostics into the canonical tag and marker editor tabs.
- Fed open taxonomy diagnostics into the readiness dashboard as a warning state.
- Added focused tests for marker hit diagnostics, saved-posting coverage, repair action hooks, and readiness warning integration.
- Validation: `npm test -- taxonomy-diagnostics.test.ts TaxonomyDiagnosticsPanel.test.tsx ReadinessDashboard.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 47 frontend tests green.
- Added a dedicated Requirement Review panel inside Resume posting analysis.
- Requirement analysis is now framed as local surface-term extraction and taxonomy matching, not semantic judgment.
- Review panel exposes clusters, atoms, matched tags, positive extracted terms, negated terms, experience quantifiers, suggested taxonomy terms, and per-run review marks.
- Suggested taxonomy terms remain wired to the existing adopt/create taxonomy flow.
- Per-run review marks can now include or exclude clusters from generation and classify suggested terms as useful or noise.
- Validation: `npm test -- RequirementAnalysisReviewPanel.test.tsx` passed.
- Validation: `npm run verify:frontend` passed with lint, typecheck, and 50 frontend tests green.
- Added a typed frontend requirement-review transform that produces reviewed analysis and explicit review metadata.
- Resume generation now sends reviewed requirement analysis and review metadata through the pipeline request when review state is available.
- The Rust resume pipeline validates reviewed analysis/review metadata against the current posting hash before using it.
- Generation manifests now store `requirement_review_json` so corrected runs remain auditable from Operations.
- Runtime DB schema advanced to user version 2 with a migration that adds the requirement-review manifest column.
- Focused validation: `npm test -- requirement-review.test.ts RequirementAnalysisReviewPanel.test.tsx` passed with 6 tests green.
- Focused validation: `cargo test resume_pipeline` passed with 11 tests green; `cargo test operations` passed with 4 tests green.
- Full validation: `npm run verify:frontend` passed with lint, typecheck, and 53 frontend tests green.
- Full validation: `cargo test` passed with 108 Rust tests green in `app_lib`.
- Removed extra per-evidence fields from active scope after user review.
- Audited the discarded per-evidence-field direction: no evidence UI fields, evidence request types, schema changes, or pipeline contracts from that direction remain in this plan.
- Product decision: evidence capture stays tag-first and fast; do not add new per-evidence context, weighting, confidence, privacy, or admissibility fields.
- Matching reliability should improve through taxonomy quality, tag inference, requirement review, intake ergonomics, and build policy, not a second evidence metadata model.
- Began WS5 operator ergonomics.
- Collapsed redundant root product-requirements content into `README.md` and removed the separate draft as a source of truth.
- Updated `README.md` so feature and first-run docs mention readiness, reviewable requirement analysis, resume audit trail, taxonomy diagnostics, raw-intake safety rules, product boundaries, retryable raw-intake skip summaries, and the exact limits of `npm run dev`.
- Updated app runtime labels and header subtitle so browser harness no longer borrows desktop runtime claims.
- Updated Settings disabled-state copy for database path and bulk import so browser harness limitations are visible near desktop-only controls.
- Validation: stale product-doc grep passed for removed prototype-era claims and `claim ceiling`; editor diagnostics were clean for updated docs/runtime files.
- Validation: `npm run typecheck` passed.
- Validation: `npm test -- ReadinessDashboard.test.tsx` passed with 7 tests.
- Added build policy presets for Balanced default, Concise, Coverage-first, and Project-heavy.
- Presets are frontend draft transforms over the existing stored `BuildPolicy` contract; they do not auto-save or add a second policy store.
- Added saved-versus-draft build policy change summaries before the existing Save Build Policy action.
- Kept advanced build policy controls visible for deliberate tuning after a preset is applied.
- Validation: `npm test -- build-policy-presets.test.ts` passed with 3 tests.
- Validation: `npm run typecheck` passed after build-policy preset integration.
- Removed stale root product-requirements references from README, the active plan docs, and the desktop min-width comment.
- Added raw-intake preflight through `preview_raw_intake` / `previewRawIntake(path)`.
- Preview and commit share parser, action classification, target-record resolution, tag inference, duplicate-id checks, duplicate-claim checks, skip summaries, and repair hints.
- Preview returns source path, total item count, would-import record/evidence counts, skipped count, skip summaries, duplicate ids, per-item outcomes, messages, and repair hints.
- Preview does not write import runs, import items, records, evidence, or anomalies.
- Settings now requires Preview Raw Intake for the current file before Import Preview is enabled.
- Validation: `cargo test intake` passed with 10 tests.
- Validation: `npm test -- SettingsView.test.tsx` passed with 1 test.
- Full validation: `npm run verify:frontend` passed with lint, typecheck, and 57 frontend tests green.
- Full validation: `cargo test` passed with 110 Rust tests green in `app_lib`.
- Completed WS1 audit after WS5: current dashboard satisfies the WS1 exit criteria without a backend aggregate.
- Added focused partial-library readiness coverage so empty, partial, stale/warning, ready, browser harness, navigation, and refresh states are all represented in tests.
- Validation: `npm test -- ReadinessDashboard.test.tsx` passed with 8 tests.
- Completed closeout review: no blocking implementation defects found.
- Added explicit Settings preview invalidation test for raw-intake path changes before import.
- Validation: `npm test -- SettingsView.test.tsx ReadinessDashboard.test.tsx` passed with 10 tests.
- Full closeout validation: `npm run verify:frontend` passed with lint, typecheck, and 59 frontend tests green.
- Full closeout validation: `cargo test` passed with 110 Rust tests green.
- Archived this folder under `docs/implementation-projects/archive/2026-04-product-improvement-complete/` with `00-closeout-summary.md`.

## WS5 Remaining Surfaces

- None active.

## WS5 Raw Intake Preflight Contract Candidate

- Add a desktop-only `preview_raw_intake` Tauri command and `previewRawIntake(path)` frontend service method.
- Refactor intake so preview and commit share parsing, classification, target-record resolution, tag inference, duplicate-intake-id checks, and duplicate-claim checks.
- Preview does not insert import runs, import items, records, evidence, or anomalies.
- Preview returns source path, total items, would-import record/evidence counts, skipped count, skip summaries, duplicate intake ids, per-item outcomes, and repair hints.
- Settings requires Preview before Import from the main UI; commit still re-validates because the DB may change after preview.
- Implemented on 2026-04-25 after approval.

## Completion Checklist

- [x] WS1 complete
- [x] WS2 complete
- [x] WS3 complete
- [x] WS4 complete
- [x] WS5 complete
- [x] README/docs reconciled with final product scope
- [x] Program closeout summary created and archived

## Notes

- This tracker is archived. Do not treat it as an active execution board unless a future plan explicitly reopens this program.