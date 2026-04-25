# WS1: Readiness And First Run

## Status

Complete.

First dashboard slice landed on 2026-04-24. Completion audit and final test/doc pass landed on 2026-04-25.

## Finding Addressed

The app exposes Library, Taxonomy, Resume, Operations, and Settings as peer expert surfaces, but the intended user path is state-dependent. A user needs to know whether they have enough taxonomy, evidence, profile data, sync state, and anomaly cleanliness to generate a meaningful resume.

## Goal

Add an app-level readiness surface that shows current state, blockers, warnings, and the next recommended action.

## Recommended End State

- The app has a visible readiness summary near the start of the user journey.
- Empty, partial, stale, and ready states are distinguishable.
- The dashboard links to the exact tab/action needed next.
- Existing taxonomy sync, anomaly, profile, record, evidence, and manifest facts feed one coherent state model.

## Non-Goals

- Do not add another vague onboarding page that duplicates docs.
- Do not hide expert tabs behind a wizard.
- Do not invent readiness facts that cannot be derived from current app state.
- Do not treat browser harness limitations as product readiness failures.

## Impacted Surfaces

- `src/App.tsx`
- Library, taxonomy, resume, and operations service seams
- Possible new readiness service/type module
- Frontend tests for app-level state rendering
- README/first-run docs if readiness changes the recommended workflow

## Implementation Slices

### Slice 1: Define readiness model

- Define readiness categories and severity levels.
- Map existing facts into readiness items.
- Decide UI placement: top-of-app band, dashboard card above tabs, or first tab.

Suggested initial signals:

- taxonomy category count
- canonical tag count
- marker availability
- records count
- evidence count
- candidate profile presence
- library tag sync status
- open anomaly count
- last generation manifest
- runtime mode/capability state

Status:

- Landed using existing frontend service seams.
- Signals currently include taxonomy category count, canonical tag count, records, evidence, candidate profile, tag sync status, open anomalies, generation manifests, and browser-harness mode.
- Marker availability, marker hit health, orphaned tag references, and saved-posting coverage now flow through the WS3 taxonomy diagnostics model and are summarized by readiness as warning state.

### Slice 2: Add data retrieval

- Reuse existing services where possible.
- Add narrow backend/frontend aggregate only if repeated view-level requests become noisy.
- Keep browser harness semantics explicit.

Status:

- Landed as a frontend aggregate over existing taxonomy, library, and operations services.
- No backend contract change was needed for the first slice.

### Slice 3: Render dashboard

- Show blockers, warnings, and ready signals.
- Add direct navigation/actions where available.
- Keep text direct and state-specific.

Status:

- Landed above the main tab list in `App`.
- Items navigate to the relevant top-level tab.
- Browser harness mode is called out as a harness rather than a product failure.

### Slice 4: Add tests

- Empty first-run state.
- Partial library state.
- Stale taxonomy state.
- Ready state with no open anomalies.
- Browser harness mode copy/capability behavior.

Status:

- Focused `ReadinessDashboard` tests cover empty first-run, partial library, ready, warning, navigation, browser harness, and refresh behavior.

## Validation Plan

- Focused frontend tests for readiness states.
- `npm run verify:frontend` after implementation.
- Manual Tauri smoke test if readiness depends on desktop-only services.

## Validation Completed

- `npm test -- ReadinessDashboard.test.tsx` passed.
- `npm run verify:frontend` passed: lint, typecheck, and all frontend tests green.
- `npm test -- ReadinessDashboard.test.tsx` passed after the WS1 completion audit with 8 tests.

## Risks

- Too many parallel service calls in app bootstrap.
- Readiness copy becoming instructional clutter instead of state reporting.
- Treating warnings as blockers and frustrating legitimate partial workflows.

## Exit Criteria

- A user can tell what state their app is in from the main screen.
- The next useful action is visible for empty, partial, stale, and ready states.
- Readiness uses real app facts and has test coverage for key states.

Current status:

- All exit criteria are met.
- The dashboard is visible above the main tabs, distinguishes setup blockers, warnings, ready signals, and informational state, and links to the controlling tab for each item.
- Readiness uses observed app facts from existing library, taxonomy, operations, candidate profile, manifest, tag sync, and taxonomy diagnostics service seams.
- A backend aggregate remains a future performance/refinement option if service-call volume becomes a measured problem; it is not required for WS1 completion.