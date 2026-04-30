# WS6: Repo Hygiene And Test Discipline

## Status

Complete

## Finding Addressed

The repo currently has known lint/test issues and React effect debt that are visible in normal validation runs. That is a process smell: the project is already teaching itself to ignore weak signals.

## Goal

Get the repo back to a state where routine checks are trusted and current warning debt does not linger as normal background noise.

## Recommended End State

- No known frontend lint failures.
- The current `act(...)` warning is fixed.
- Hook dependencies are either explicit or the effect design is simplified so warnings disappear for the right reason.
- Rust warning cleanup has a clear target and no obviously stale dead code remains in touched surfaces.
- If dual runtime behavior remains anywhere, overlapping behavior has contract tests.

## Non-Goals

- Do not treat this as an invitation for endless cosmetic cleanup.
- Do not silence warnings instead of fixing their cause.
- Do not keep dead code around for imaginary future compatibility.

## Scope

This workstream is intentionally narrower than "clean the whole repo". It targets the warning debt already surfaced by validation and any direct fallout from WS1-WS5.

Current known debt from the review:

- invalid test expression in `utils.test.ts`
- unresolved async `act(...)` warning in `ConfirmDialog.test.tsx`
- stale effect warnings around `EvidenceDialog.tsx` and `TaxonomyView.tsx`
- Rust unused/dead-code warnings visible during `cargo test --lib`

## Landed Result

- The lingering async `act(...)` warning in `ConfirmDialog.test.tsx` is fixed by awaiting the confirm promise resolution inside React's update cycle.
- `EvidenceDialog` and `TaxonomyView` now satisfy hook dependency analysis without suppression comments by making the controlling dependencies explicit.
- Shared UI styling constants no longer violate the React refresh lint rule: `buttonVariants` now lives in a non-component module, and the unused `badgeVariants` export is gone.
- The frontend lint gate now fails on warnings via `eslint --max-warnings=0`, so the current clean state is enforced by the same verify path CI runs.

## Recommended Approach

### Frontend test cleanup

- Fix tests so they model real async completion instead of leaving in-flight state updates behind.
- Replace brittle test expressions with explicit values.

### Effect hygiene

- Where hook dependency warnings are correct, add the dependencies and stabilize the effect design.
- Where the effect is trying to do too much, split it or move the logic out of the effect.
- Prefer simpler state flow over suppression comments.

### Rust warning cleanup

- Delete unused imports, variables, and obviously dead types in touched modules.
- If some warnings belong to legitimate near-term work, document them explicitly instead of letting them blend into background noise.

### Contract tests

- If WS1 leaves any overlapping demo/Tauri behaviors, add shared adapter tests for those behaviors.
- Keep the shared test suite small and focused on genuine overlap.

## Impacted Surfaces

- frontend tests and effect-heavy components
- lint configuration or verification thresholds if updated
- backend modules with current warning noise
- runtime adapter tests if added

## Implementation Slices

### Slice 1: Fix currently failing or warning frontend tests

- Resolve the `utils.test.ts` lint issue.
- Resolve the `ConfirmDialog` async warning.

### Slice 2: Fix effect dependency debt

- Refactor `EvidenceDialog` preview effect if needed.
- Refactor `TaxonomyView` loading effects if needed.

### Slice 3: Clean touched Rust warning debt

- Remove unused imports and dead code in modules touched by WS1-WS5.
- Decide whether repo-wide zero warnings is required now.

### Slice 4: Add adapter contract tests if still needed

- Only after WS1/WS4 settle the runtime model.

## Validation Plan

- `npm run lint`
- `npm test`
- `npm run build`
- `cargo test --lib`
- any new contract tests introduced by WS1/WS4

## Validation Completed

- `npm run lint`
- `npm run verify`

Both now pass cleanly, and the lint step is configured to fail on warnings.

## Risks

- Slipping from targeted cleanup into indefinite polish.
- Hiding real effect problems with dependency suppression.
- Setting repo-wide warning policy before agreeing how strict it should be.

## Exit Criteria

- The specific lint/test issues called out in the review are gone.
- Touched surfaces do not carry obvious stale warnings.
- Shared runtime behavior, if any remains, is backed by tests.
- Quality signals are trustworthy again.

All exit criteria met.