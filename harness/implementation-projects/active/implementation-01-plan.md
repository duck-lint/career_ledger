# Implementation 01 Plan

## Intent

Record the requested semantic-traversal refactor as a truthful blocked active bundle without inventing runtime work, while preserving the current tag-first contract and storage constraints until the user explicitly authorizes a contract change and actual runtime surfaces exist.

## Admissibility Report

- Invariant constraints: Preserve SQLite/source-truth constraints from the project spec; add no new persisted workspace or transition state; keep the current baseline as tag-first bundle preparation and deterministic assembly unless the canonical contract is explicitly amended.
- Task constraints: Record a truthful blocked state only; do not assume hidden runtime code exists.
- Constraint conflicts: The requested semantic-traversal engine is a broad-architecture and project-intent change relative to the current tag-first spec, and the repo contains no runtime implementation surface.
- Allowed transformation types: Harness-only planning, tracking, and open-decision updates.
- Affected surfaces: `harness/implementation-projects/active/implementation-01-plan.md`, `harness/implementation-projects/active/implementation-01-tracker.md`, `harness/open-decisions.md`.
- Non-affected surfaces: Runtime code, schema, storage, tests, build config, and project spec files.
- Admissibility checks: Confirm the repo root contains only `.gitignore` and `harness/` outside `.git`; confirm the active implementation folder had no live bundle files beyond `.gitkeep`; require explicit user approval for the broad-architecture contract change and actual runtime files before any non-blocked implementation plan.
- Stop conditions: Any attempt to invent implementation seams beyond harness memory updates, assume hidden runtime code exists, or edit non-harness files.

## Planned Seams

1. Admissibility and repo-surface check to verify whether any implementation surface exists for the requested refactor.
2. Blocked follow-up only if unblocked by both conditions: explicit user resolution of PD-01 and actual runtime files present in the repo.

## Non-Goals

- Implementing semantic traversal, graph-node assembly, or transition handling.
- Amending the project spec, schema, runtime code, tests, or build configuration.
- Inventing future runtime seams or hidden file locations.

## Acceptance Criteria

- The active plan records this work as admissibility-blocked.
- The active tracker records the repo-surface blocker and the broad-architecture approval gap.
- `harness/open-decisions.md` records PD-01 as pending.
- No non-harness surface is changed and no runtime implementation is implied.

## Current Repo Runtime State

- The repo root contains only `.gitignore` and `harness/` outside `.git`.
- No `src/`, `src-tauri/`, `package.json`, `Cargo.toml`, or `.rs`/`.ts`/`.tsx` runtime files exist.
- The active implementation folder contained only `.gitkeep` before this bundle was created.

## Assumptions And Unknowns

- Assumption: The canonical contract remains the current tag-first bundle preparation and deterministic assembly model until the user explicitly changes it.
- Unknown: Whether the user wants to amend the contract as described in PD-01.
- Unknown: Where future runtime implementation surfaces will exist, because none are present today.

## Affected and Non-Affected Surfaces

- Affected: Active implementation bundle memory and current decision tracking.
- Non-affected: Runtime code, schema, storage, tests, build config, and project spec sources.

## Completion Rule

- This bundle is complete only as a blocked harness-memory update. Any implementation work requires a new admissibility pass after PD-01 is resolved and runtime files exist.
- Do not mark behavior complete on fixture, mock, dry-run, serialization, type, field, file, path, route, crate, config, or nominal-caller evidence alone.

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

- This bundle stays in `active/` as blocked work until PD-01 is resolved and runtime implementation surfaces exist.
