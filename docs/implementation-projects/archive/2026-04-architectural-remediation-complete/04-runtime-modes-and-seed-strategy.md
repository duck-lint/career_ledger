# WS4: Runtime Modes And Seed Strategy

## Finding Addressed

Browser mode used to seed sample data implicitly and behave like a half-real, half-demo runtime. That was confusing for users and corrosive for development because fake data and fake parity were ambient by default.

## Goal

Make the browser runtime honest. `npm run dev` should be documented and labeled as a browser harness, not as a fallback persisted runtime, and empty first-run state should remain the default.

## Status

Complete as of 2026-04-22.

## Current Decision

Accepted on 2026-04-22:

- Fresh app state should be empty.
- Browser `npm run dev` is a browser harness, not an alternative application runtime.
- Browser `npm run dev` should not auto-seed sample data.
- Any future fixture/demo data should be explicit opt-in behavior rather than default boot behavior.
- Taxonomy export/import is useful, but it is not the same thing as whole-app migration.

Already landed in the first execution slice:

- Browser local mode initializes empty instead of injecting sample content.
- Newly created runtime DBs initialize empty taxonomy instead of starter taxonomy.
- Full app reset now returns to empty first-run state.
- The old embedded browser sample-data bootstrap path was removed instead of left dormant.

Already landed in the second execution slice:

- Settings copy now describes reset as returning to empty first-run state rather than to seed data.
- Browser-harness export metadata no longer uses `fallback` naming.
- User-facing docs now describe `npm run dev` as the browser harness instead of as a generic frontend fallback.

## Recommended End State

- Browser mode is explicitly labeled as a browser harness where it is user-visible.
- First load does not silently populate local storage.
- Reset returns the active runtime to empty first-run state.
- If fixture/demo data is ever added later, it is opt-in and clearly separate from normal harness boot behavior.

## Non-Goals

- Do not keep the old implicit seeding behavior for convenience.
- Do not preserve seeded local storage as a hidden compatibility obligation.
- Do not let the browser harness masquerade as a normal persisted desktop runtime.
- Do not add an explicit demo mode in this workstream unless the product actually needs one.

## Recommended Architecture

### Runtime modes

Recommended modes:

- `tauri`: supported desktop runtime
- `browser-harness`: frontend-only harness with honest capability limits

### Sample data strategy

- Keep empty-state behavior as the default browser-harness behavior.
- If sample data ever returns, put it in explicit fixtures and require an explicit load path.
- Do not smuggle fixtures back into the browser initialization branch.

### State lifecycle

- Browser-harness state should be easy to reset.
- If localStorage remains the harness backing store, copy and metadata should say so plainly.
- Harness reset should return to empty first-run state and should not pretend to be equivalent to database migration.

## Impacted Surfaces

- browser bootstrap/runtime selection
- `src/lib/local-service.ts`
- any UI badges or banners describing runtime mode
- settings/reset behavior in browser harness mode
- docs that currently imply browser mode is a normal fallback

## Implementation Slices

### Slice 1: Remove implicit seeding

- Remove sample-data construction from service initialization.
- Keep empty first-run state as the default.

Status:

- Landed.

### Slice 2: Clean up browser-harness copy and docs

- Remove lingering `fallback` / `seed data` language from browser-harness UI and metadata.
- Update docs so `npm run dev` is described as a browser harness, not as a pseudo-runtime.

Status:

- Landed.

### Slice 3: Future opt-in fixtures, only if needed

- Not required to close WS4.
- If fixtures are added later, keep them explicit and separate from normal harness boot.

## Validation Plan

- Fresh browser-harness load starts empty.
- Reset returns the active runtime to empty first-run state.
- Browser-harness copy and export metadata do not describe it as a fallback runtime.
- No Tauri-only feature can be triggered accidentally from browser harness mode.

## Risks

- Breaking frontend-only development workflow if empty-state browser behavior is described unclearly.
- Keeping old seeded local storage around and mistaking it for current behavior during testing.
- Leaving UI copy ambiguous after the logic changes.

## Exit Criteria

- No implicit sample seeding on browser load.
- Browser harness is explicit in code, UI, and docs.
- Reset returns to empty first-run state instead of to seed data.
- The runtime story is honest to the user and to the developer.

Status:

- Met on 2026-04-22.