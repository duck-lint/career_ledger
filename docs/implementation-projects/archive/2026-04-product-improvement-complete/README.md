# Product Improvement Implementation Plan

This folder archives the completed implementation plan for the product suggestions captured from the April 2026 product/codebase review. It is modeled after the archived architectural remediation program: one program map, one tracker, and numbered workstream files that make sequencing, blast radius, validation, and regroup points explicit.

## Program Status

- Status: Closed and archived on 2026-04-25
- Started on: 2026-04-24
- Current recommended focus: None; future product work should start as a new plan
- Current blocking decision: None active. Extra per-evidence fields were removed from scope; evidence capture remains tag-first.

## Source Review Summary

The app already has serious machinery: local-first SQLite state, user-controlled taxonomy, evidence inference, conservative resume assembly, manifests, anomaly tracking, and DOCX output. The weakness is not raw capability. The weakness is that users need clearer state, trust, and repair loops around that machinery.

The accepted product suggestions are:

- Add a first-run/readiness dashboard.
- Surface resume provenance in the preview, not only raw JSON.
- Make taxonomy quality measurable.
- Clarify the product promise around requirement analysis.
- Reconcile product/docs framing now that the app has outgrown the old product-requirements draft.
- Make browser-harness limitations impossible to misread as product failures.
- Put build policy power behind safer user-facing presets or an advanced posture.
- Add a raw-intake preflight/dry-run path with row-level repair hints.

Explicitly deferred:

- Resume style/template control. This is real product work, but it is outside the current plan because it changes document-format ownership rather than the evidence, readiness, and trust loop. Reopen it only if rendered resume presentation becomes the active product bottleneck.

Explicitly removed:

- Extra per-evidence context fields. This conflicts with the intended workflow: fast evidence capture, tags doing the matching work, and same-session resume generation. Do not add impact/source/confidence/privacy/resume-use/admissibility fields unless a future concrete failure mode reopens the decision.

## Workstream Map

| WS | Status | Finding | Outcome | Effort | Depends On |
|---|---|---|---|---|---|
| WS1 | Complete | Users cannot see whether the app is ready to generate useful resumes | Readiness dashboard/checklist with counts, stale-state warnings, and next actions | Medium | None |
| WS2 | Complete | Resume preview hides the evidence/provenance that makes the product trustworthy | Expandable preview provenance, gap report visibility, and selection explanations | Large | WS1 helpful, not blocking |
| WS3 | Complete | Taxonomy quality is edited locally but not measured globally | Taxonomy/evidence diagnostics for coverage, stale tags, zero-hit markers, and weak inference | Large | WS1 useful |
| WS4 | Complete | Requirement analysis can be mistaken for semantic AI judgment | Reviewable requirement analysis with clearer local surface-term framing and optional correction path | Medium/Large | WS2/WS3 helpful |
| WS5 | Complete | Adoption surfaces still carry prototype/operator friction | Docs/framing cleanup, runtime mode clarity, build policy presets, and intake preflight UX | Medium | Can run alongside WS1 |

## Recommended Execution Order

### Phase 0: Establish user state and product truth

Start with WS1 and the docs/runtime parts of WS5. The product should tell the user what state it is in before asking them to navigate five expert tabs.

Deliverables:

- App-level readiness summary.
- Clear next action from empty, partial, stale, and ready states.
- README and runtime copy reconciled with current product reality.

### Phase 1: Make resume output auditable

Run WS2 next. The assembled resume is the app's highest-stakes output, and its trust story should be visible without opening raw JSON.

Deliverables:

- Preview bullets linked to source evidence.
- Gap report rendered as a first-class panel.
- Constraint flags and selection notes visible in human-readable form.

### Phase 2: Make taxonomy tuning observable

Run WS3 after the readiness and provenance surfaces have stable homes. Taxonomy diagnostics should feed the same readiness model instead of becoming another isolated expert page.

Deliverables:

- Tags with zero evidence.
- Evidence with zero/weak inference.
- Markers with no observed hits.
- Candidate profile signal-tag drift.
- Posting terms not covered by taxonomy.

### Phase 3: Add review loops before generation

Run WS4 once analysis and taxonomy signals are visible enough to support correction.

Deliverables:

- Requirement clusters presented as local extraction results, not oracle output.
- User-confirmable or editable requirement clusters/terms if scope allows.
- Regeneration path after taxonomy adoption or requirement correction.

### Phase 4: Smooth operator-heavy surfaces

WS1-WS5 are complete. Use this phase as a closeout checkpoint for archiving the implementation plan with a validation snapshot.

Deliverables:

- Build policy presets with advanced controls still available.
- Raw-intake dry run/preflight with row-level skip reasons and repair hints.
- Documentation reflects actual runtime and product scope.

## Critical Path

The critical path is:

1. Readiness dashboard.
2. Resume provenance/gap drill-through.
3. Taxonomy quality diagnostics.
4. Requirement review/correction loop.
5. Operator ergonomics: docs/runtime framing, build policy presets, and intake preflight.

WS5 was important, but it mostly reduced adoption friction and could be sliced around the core path.

## Program Guardrails

- No legacy compatibility layers unless explicitly approved.
- No broad schema change without updating validation, export, bundle, GUI pipeline logic, tests, and docs that depend on it.
- Keep runtime truth explicit: Tauri is the product runtime; browser mode is a harness.
- Prefer preview/dry-run flows for destructive or bulk operations.
- Preserve the app's anti-hallucination stance: generated output should remain evidence-bounded and inspectable.
- Do not implement resume template/style control in this program unless reopened as an explicit scope change.

## Suggested PR Slices

1. Live plan artifacts and tracker setup.
2. Readiness data model plus dashboard shell.
3. Readiness next-action cards and stale taxonomy/profile/anomaly signals.
4. Resume preview source-evidence drill-through.
5. First-class gap report and constraint-flag panels.
6. Taxonomy/evidence diagnostics query layer and UI.
7. Requirement analysis wording cleanup and review/correction flow.
8. Build policy presets and intake dry-run UX.
9. Documentation reconciliation and closeout.

## Definition Of Program Done

This program is done when all of the following are true:

- A user can open the app and see whether they are ready to generate a meaningful resume.
- A generated resume preview can be audited back to selected evidence without reading JSON.
- Gaps and weak support are visible as product facts, not buried artifacts.
- Taxonomy quality has measurable diagnostics and repair paths.
- Requirement analysis is framed and, where implemented, corrected as local extraction rather than hidden semantic judgment.
- Evidence capture remains fast and tag-first; matching quality improves through taxonomy, inference, review, and intake repair rather than extra per-evidence fields.
- Docs, runtime copy, build policy UX, and raw intake UX no longer make the app feel like an internal prototype unless the user is on an explicitly advanced/operator surface.

## Files In This Folder

- `00-closeout-summary.md`: closeout summary and validation snapshot.
- `README.md`: program-level map and sequencing.
- `tracker.md`: archived execution tracker, decisions, risks, open questions, and completed slices.
- `01-readiness-and-first-run.md`: WS1.
- `02-resume-provenance-and-gap-drillthrough.md`: WS2.
- `03-taxonomy-quality-diagnostics.md`: WS3.
- `04-requirement-analysis-review.md`: WS4.
- `05-framing-runtime-and-operator-ergonomics.md`: WS5.