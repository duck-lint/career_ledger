# WS3: Build, Typecheck, And Quality Gates

## Status

Complete

## Finding Addressed

The production build currently skips TypeScript checking. That undercuts one of the cheapest and most useful safety rails in the repo.

## Goal

Restore hard release gates for typecheck, lint, frontend tests, and backend tests so regressions fail early and locally.

## Recommended End State

- `npm run build` fails on TypeScript errors again.
- The repo has a fast, explicit verification command for local use.
- CI runs the same verification surface the developer runs locally.
- Known warning debt is either fixed or deliberately staged with a written policy.

## Landed Result

- `npm run build` now runs `tsc -b` again instead of skipping TypeScript checking with `--noCheck`.
- The repo script surface now includes `npm run typecheck`, `npm run verify:frontend`, `npm run verify:backend`, and `npm run verify`.
- CI now runs the same frontend and backend verify commands the repo exposes locally before building the desktop bundle.
- The README documents the verification commands explicitly, including the single top-level `npm run verify` entry point.
- Existing frontend lint warnings remain staged as non-blocking warning debt rather than being silently bypassed by missing or partial verification commands.

## Non-Goals

- Do not add a huge bespoke release pipeline.
- Do not hide failing checks behind optional scripts.
- Do not accept "we can just remember to run this manually" as the long-term answer.

## Recommended Changes

### Script surface

- Change `build` back to a real typechecked build.
- Add `typecheck` explicitly.
- Add a single `verify` script that runs the agreed release gates.

Suggested local script shape:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `cargo test --lib`
- `npm run verify`

### CI surface

- If no workflow exists, add a minimal GitHub Actions workflow.
- CI should run the same checks as `verify`.
- Avoid one set of local rules and another set of CI rules.

### Rollout strategy

- Fix current known failures first.
- Turn on hard gates once the repo is clean enough to enforce them.
- Prefer zero warnings for the touched surface, then decide if repo-wide zero warnings is required immediately.

## Impacted Surfaces

- `package.json`
- CI workflow files if added
- contributor docs if needed
- any files currently masked by skipped typechecking

## Implementation Slices

### Slice 1: Restore typecheck

- Add `typecheck`.
- Make `build` typecheck again.
- Fix any newly exposed errors.

### Slice 2: Create a single verification entry point

- Add `verify` scripts for frontend and full repo checks.
- Keep them predictable and boring.

### Slice 3: Wire CI

- Add or update CI to run the same checks.
- Fail the build on check failures.

### Slice 4: Document the rule

- Update README or contributing docs if needed.
- State clearly that main should not carry known failing quality gates.

## Validation Plan

- Intentionally introduce a TypeScript error and verify `build` fails.
- Run the full local verify command.
- Confirm CI fails when one required check fails.

## Validation Completed

- `npm run verify:frontend` passes.
- `npm run verify` passes.
- `npm run build` passes with typechecking restored.
- The current lint surface now has 0 errors and 5 warnings, which remain staged for later warning-debt cleanup instead of being treated as hidden gate failures.

## Risks

- Turning on hard gates before current warning debt is cleaned up.
- Adding slow verify scripts that no one runs locally.
- Letting CI diverge from local commands over time.

## Exit Criteria

- TypeScript errors fail the build again.
- A single documented verification command exists.
- CI enforces the same required checks.
- The repo is no longer relying on `--noCheck` for release builds.