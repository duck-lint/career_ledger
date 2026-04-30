# Implementation 03 Plan: Archive Alignment And Interactive Taxonomy Diagnostics

## Intent

- Finish strict canonical archive alignment under `docs/implementation-projects/archive/`.
- Retrofit the repo-local project memory so implementation-02 has the missing provenance artifacts before new work lands.
- Turn taxonomy diagnostics from a cosmetic report into an actionable repair surface.
- Preserve the existing education and certification diagnostics coverage while making the operator path fast enough for UAT.

## Non-Goals

- No schema, storage, or backend command changes unless the current taxonomy diagnostics model proves insufficient.
- No broad taxonomy view redesign beyond wiring diagnostics into existing adopt-or-create and tag-edit flows.
- No compatibility shims for the old top-level `docs/archive/` layout.

## Observed Evidence

- [index.md](index.md) now tracks implementation projects at the root of `docs/implementation-projects/` while the canonical archive path is `archive/` beneath the same directory.
- [implementation-02-tracker.md](implementation-02-tracker.md) records implementation-02 as complete, but the project previously lacked a dedicated verification contract and decisions file.
- [../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx](../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx) renders counts and a few coarse actions, but it does not expose per-item repair actions.
- [../../src/components/views/TaxonomyView.tsx](../../src/components/views/TaxonomyView.tsx) already owns tag-edit state and marker-tab routing, making it the controlling surface for diagnostics interaction.
- [../../src/components/dialogs/AdoptTagDialog.tsx](../../src/components/dialogs/AdoptTagDialog.tsx) and [../../src/components/dialogs/TagDialog.tsx](../../src/components/dialogs/TagDialog.tsx) already implement the adopt-into-existing and create-new-tag flows used elsewhere in the app.
- [../../src/lib/taxonomy-diagnostics.ts](../../src/lib/taxonomy-diagnostics.ts) already folds education and certification content into candidate-profile search text and supporting-source coverage.

## Assumptions And Unknowns

- Assumption: the main UAT pain is lack of actionability in diagnostics, not a broken candidate-profile coverage model.
- Assumption: orphaned evidence, record-context, and candidate-profile signal tags are the highest-value targets for adopt-or-create repair.
- Unknown: whether the current diagnostics payload is rich enough for all desired interactions, or whether one focused model extension will be needed.
- Unknown: whether implementation-02 should be archived immediately after UAT or remain live until user sign-off.

## Affected Surfaces

- Docs and provenance: [README.md](../../README.md), [README.md](README.md), [index.md](index.md), [archive/README.md](archive/README.md), [implementation-02-verification-contract.md](implementation-02-verification-contract.md), and [implementation-02-decisions.md](implementation-02-decisions.md).
- Taxonomy diagnostics UI: [../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx](../../src/components/taxonomy/TaxonomyDiagnosticsPanel.tsx) and [../../src/components/views/TaxonomyView.tsx](../../src/components/views/TaxonomyView.tsx).
- Shared diagnostics model if needed: [../../src/lib/taxonomy-diagnostics.ts](../../src/lib/taxonomy-diagnostics.ts).
- Focused tests: [../../src/lib/taxonomy-diagnostics.test.ts](../../src/lib/taxonomy-diagnostics.test.ts), [../../src/components/taxonomy/TaxonomyDiagnosticsPanel.test.tsx](../../src/components/taxonomy/TaxonomyDiagnosticsPanel.test.tsx), and a new focused taxonomy view interaction test.

## Blast Radius

- Docs workflow and archive path references across the repo.
- Frontend-only taxonomy interaction wiring in the likely happy path.
- Shared diagnostics-model consumers only if the current payload is too coarse for the interaction design.

## Seams

1. Align archive and provenance docs to the canonical `docs/implementation-projects/archive/` layout.
2. Validate the current diagnostics model against education and certification coverage before changing behavior.
3. Add per-item interactive repair flows to taxonomy diagnostics using existing adopt-or-create and tag-edit surfaces.
4. Add focused tests and update UAT wording if the accepted interaction contract changes.

## Approval Gates

- [ ] Schema
- [ ] API
- [ ] Auth
- [ ] Storage
- [ ] Deployment
- [ ] Destructive operation
- [ ] Broad architecture
- [ ] Product intent

## Verification Contract

Use [implementation-03-verification-contract.md](implementation-03-verification-contract.md).

## Next Handoff

- Agent Role: Harness Implementer
- Scope: docs alignment is in progress; next behavior seam is taxonomy diagnostics interaction.
- Stop condition: if the desired interaction requires a shared diagnostics-model redesign instead of frontend wiring, stop and re-scope before widening further.