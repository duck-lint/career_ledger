# Implementation 03 Verification Contract

Use [../harness/verification-contract.md](../harness/verification-contract.md) as the source template.

## Contract Header

- Project: implementation-03
- Seam: archive alignment and interactive taxonomy diagnostics
- Owner agent role: Harnessed Agent
- Last updated: 2026-04-29
- Status: active

## Claims Under Test

| ID | Claim | Source | Expected Observable Consequence | Status |
| --- | --- | --- | --- | --- |
| V-001 | The repo archive surface now lives under `docs/implementation-projects/archive/` with coherent internal references. | [implementation-03-plan.md](implementation-03-plan.md) | Archive docs resolve through the canonical path without stale `docs/archive/` references. | passed |
| V-002 | Implementation-02 now has the missing provenance artifacts needed for future continuity. | [implementation-03-plan.md](implementation-03-plan.md) | `implementation-02-verification-contract.md` and `implementation-02-decisions.md` exist and align with the tracker state. | passed |
| V-003 | Taxonomy diagnostics become actionable without regressing education and certification coverage. | [implementation-03-plan.md](implementation-03-plan.md) | Operators can route directly from a diagnostic item into adopt-or-create or tag/marker repair, and focused diagnostics tests remain green. | passed |
| V-004 | “Markers with no source hits” no longer flags a tag once that tag has any valid source hit through tag text or one of its markers. | user UAT report and [implementation-03-tracker.md](implementation-03-tracker.md) | Education/certification-backed tags like `bachelor` disappear from the no-hit section once any marker or tag-name hit exists. | passed |

## Required Checks

| ID | Check | Command or Probe | Pass Signal | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| C-001 | Archive path and link sweep | File presence plus stale-link grep across `docs/**` and `README.md` | Canonical archive files exist and stale `docs/archive` references are gone. | pass | local validation via file-presence and grep sweep on 2026-04-29 |
| C-002 | Diagnostics model slice | `npx vitest run src/lib/taxonomy-diagnostics.test.ts src/components/taxonomy/TaxonomyDiagnosticsPanel.test.tsx` | Focused diagnostics tests pass with the tag-gated no-source-hit contract. | pass | local validation on 2026-04-29 |
| C-003 | Taxonomy view interaction slice | `npx vitest run src/components/views/TaxonomyView.test.tsx` | A diagnostic item triggers the intended repair flow and lands on a visible editor surface. | pass | local validation on 2026-04-29 |
| C-004 | Frontend verification gate | `npm run verify:frontend` | Frontend lint, typecheck, and tests pass. | pass | local validation on 2026-04-29 |

## Skipped Or Deferred Checks

| Check | Reason | Risk | Owner | Revisit Trigger |
| --- | --- | --- | --- | --- |
| Archive closeout for implementation-02 | The user has not completed manual UAT sign-off for implementation-02 yet. | Low: implementation-02 may stay live slightly longer than ideal. | User | When implementation-02 UAT passes or reopens. |