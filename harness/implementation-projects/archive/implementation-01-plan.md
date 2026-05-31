# Implementation 01 Plan

## Intent

Amend the canonical docs-only contract from the former tag-first model to the approved semantic-traversal target in the project spec and governance primitives, while preserving SQLite as source authority and keeping runtime semantic state non-persisted.

## Admissibility Report

- Invariant constraints: The approved canonical direction is semantic traversal/projection; source authority remains unchanged; runtime-only semantic state remains non-persisted.
- Task constraints: Complete a docs-only rewrite of the canonical project spec and governance primitives; record decision resolution and archive state cleanly; do not add runtime, schema, storage, test, or build changes.
- Allowed transformation types: Rewrite the canonical project spec and governance primitives to reflect the approved direction; update harness decision and archive memory.
- Affected surfaces: `project-spec/career-ledger-project-spec.md`, `project-spec/career-ledger-governance-primitives.md`, `harness/open-decisions.md`, and the implementation-01 archive bundle.
- Non-affected surfaces: Runtime code, schema, storage, tests, build config.
- Stop conditions: Any proposal that adds persisted semantic or workflow-status state, AI or embeddings behavior, or a new source authority.

## Planned Seams

1. Rewrite the project spec to make semantic traversal/projection the canonical greenfield direction.
2. Rewrite governance primitives to preserve source-authority and non-persistence constraints under that direction.
3. Validate the docs-only rewrite and archive the completed bundle with PD-01 resolved.

## Non-Goals

- Implementing runtime traversal, persistence, AI or embedding behavior, or workflow-status state.
- Changing schema, storage, runtime, test, or build surfaces.
- Introducing any persisted semantic, workspace, or transition state.

## Acceptance Criteria

- The project spec and governance primitives both reflect the approved semantic-traversal contract.
- The docs preserve SQLite as source authority and keep runtime semantic state non-persisted.
- Validation passes for the docs rewrite.
- PD-01 is resolved and the completed bundle is archived with no stale active pointer.

## Affected and Non-Affected Surfaces

- Affected: Canonical project spec/governance docs and harness decision/archive memory.
- Non-affected: Runtime code, schema, storage, tests, build config.

## Completion Rule

- This bundle is complete when the canonical docs are rewritten to the approved direction, validation has passed, and the bundle is moved to `archive/` with PD-01 resolved in `harness/open-decisions.md`.
- Do not treat this bundle as runtime implementation evidence; it closes only the docs-only canonical seam.

## Approval Gates

- [ ] Schema
- [ ] API
- [ ] Auth
- [ ] Storage
- [ ] Deployment
- [ ] Destructive operation
- [x] Broad architecture
- [x] Project-intent authority not covered by spec or current authorization

## Closeout Note

- Completed as a docs-only canonical rewrite and archived. Any future runtime implementation requires a new numbered bundle and fresh admissibility review if requested.