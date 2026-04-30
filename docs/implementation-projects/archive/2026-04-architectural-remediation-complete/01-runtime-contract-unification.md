# WS1: Runtime Contract Unification

## Finding Addressed

The app currently swaps between `tauriService` and `localService` behind one shared `CareerService` contract even though the implementations are not behaviorally equivalent. That is the root architectural lie behind several downstream problems.

## Goal

Replace the implicit runtime swap with an explicit runtime model and a capability-aware service boundary. The UI should know what runtime it is in and what that runtime can actually do.

## Status

Complete as of 2026-04-22.

## Current Decision

Accepted on 2026-04-22:

- `tauri` remains the real application runtime.
- Browser `npm run dev` is treated as a local harness, not as a parity runtime.
- Fresh first-run state should be empty.
- Shared behavior should exist only where it is truly shared, not where browser mode is faking backend semantics.

Already landed in the first execution slice:

- Browser local mode no longer auto-seeds sample data.
- Nearby browser-mode UI copy now describes a harness, not a fallback runtime.

Already landed in the second execution slice:

- A shared `runtime` module now owns runtime detection, labels, descriptions, and capability flags.
- `service.ts` now resolves the active service through that runtime descriptor instead of re-detecting runtime on its own.
- `App`, `ResumeGenerationView`, `SettingsView`, and `TaxonomyView` now consume runtime/capability truth from one place instead of probing `window` ad hoc.
- Unsupported taxonomy actions are disabled in the browser harness instead of relying only on thrown runtime errors.

Already landed in the third execution slice:

- `CareerService` was decomposed into narrower sub-interfaces: runtime admin, pipeline, library, operations, taxonomy, intake, and tag normalization.
- `service.ts` now exports staged narrow bindings so callers can move off the monolith incrementally instead of through a repo-wide hard cut.
- The runtime-heavy views already touched by WS1 now use those narrower bindings.

Already landed in the fourth execution slice:

- The remaining library-facing and operations-facing views/dialogs were migrated onto the narrow bindings, so UI callers no longer import a monolithic service export.
- `appRuntime` now exposes a named `services` bundle instead of a single broad service field.
- The dead `careerService` export was removed.
- The remaining internal composite type was renamed from `CareerService` to `RuntimeServiceAdapter` so the broad shape is explicitly adapter-internal rather than UI-facing.

Already landed in the fifth execution slice:

- `runtime.ts` now has executable tests for bootstrap selection and runtime service bundling.
- `local-service.ts` now has contract tests for the browser harness semantics that are intentionally shared or intentionally unsupported.
- `tauri-service.ts` now has representative IPC mapping tests so the shared adapter surface is pinned to concrete Tauri command names and argument shapes.

Already landed in the sixth execution slice:

- The temporary `RuntimeServiceAdapter` composite was removed instead of being kept as a permanent internal assembly type.
- `runtime.ts` now consumes explicit per-capability service bundles from each runtime adapter module.
- `local-service.ts` and `tauri-service.ts` now export those named capability bundles directly.

Already landed in the seventh execution slice:

- The shared browser-harness seams now have executable contract coverage for record/evidence lifecycle behavior, taxonomy rename propagation, candidate-profile normalization, and reset-to-empty behavior.
- The matching Tauri adapter seams now have stable command-mapping tests for library, profile, taxonomy, and reset commands.
- The remaining hidden runtime probe is still centralized in `runtime.ts`, and app/components do not import concrete runtime adapters directly.

## Recommended End State

- The app bootstrap exposes a runtime descriptor, not just a hidden service instance.
- Capabilities are explicit. Unsupported actions are blocked by app structure and UI state before they become runtime exceptions.
- Shared interfaces exist only for behaviors that are genuinely shared.
- Demo-only behavior is isolated behind a demo runtime, not smuggled in as a fake production equivalent.

## Non-Goals

- Do not preserve the current fake parity between browser and Tauri.
- Do not add compatibility layers for old service shapes if a cleaner split is available.
- Do not widen this into a generic plugin architecture.

## Architectural Recommendation

Choose one of these models and commit to it:

### Option A: Single supported runtime plus explicit demo runtime

Recommended.

- `tauri` is the supported application runtime.
- `demo` is an explicit alternate mode for frontend development, screenshots, and guided demos.
- Shared interfaces cover only overlapping capabilities.
- The UI branches on runtime mode/capabilities intentionally.

Why this is recommended:

- It matches the actual product intent in the docs.
- It removes the false claim that browser mode is the same app.
- It keeps demo/dev workflows available without contaminating production architecture.

### Option B: Two first-class runtimes with strict contract parity

Not recommended unless browser mode is a real product requirement.

- Keep both runtimes as supported surfaces.
- Add contract tests for every overlapping method.
- Treat behavioral drift as a release blocker.

Why this is weaker here:

- More surface area, more tests, more drift risk.
- The current browser implementation is not close to parity.

## Proposed Runtime Shape

Introduce a small bootstrap surface such as:

- `AppRuntimeMode = 'tauri' | 'demo'`
- `RuntimeCapabilities`
- `RuntimeServices`
- `AppRuntimeContext`

Suggested capability buckets:

- `libraryCrud`
- `taxonomyCrud`
- `taxonomyImportExport`
- `pipelineAnalysis`
- `pipelineGeneration`
- `rawIntakeImport`
- `artifactPersistence`

Suggested service split:

- `LibraryService`
- `TaxonomyService`
- `PipelineService`
- `OperationsService`

Do not keep one monolithic interface if its only purpose is to hide that half the methods are unavailable in one runtime.

## Impacted Surfaces

- Frontend runtime bootstrap
- `src/lib/service.ts`
- `src/lib/local-service.ts`
- `src/lib/tauri-service.ts`
- Views that currently gate on ad hoc `isTauri` checks
- Test setup and any future contract test harness

## Implementation Slices

### Slice 1: Define runtime truth

- Write the runtime descriptor and capability types.
- Decide whether browser mode is demo-only or genuinely supported.
- Add a single runtime bootstrap module that returns mode, capabilities, and services.

Status:

- Runtime direction decided.
- Types/bootstrap landed.

Remaining follow-up:

- None within WS1. Future runtime changes should extend the existing contract suite when they add or alter intentionally shared seams.

### Slice 2: Split the current service boundary

- Break the monolithic `CareerService` into smaller interfaces.
- Move unsupported features out of the shared path.
- Make the browser harness implement only what it actually supports.

### Slice 3: Move the UI to explicit capability checks

- Replace scattered `isTauri` checks with runtime context/capability checks.
- Prevent unsupported controls from rendering or becoming actionable.
- Keep the UI copy explicit: browser harness is browser harness.

### Slice 4: Add runtime contract tests

- For any capability intentionally shared between Tauri and the browser harness, run the same test suite against both adapters.
- Do not add parity tests for capabilities that are intentionally unavailable in the browser harness.

## Validation Plan

- Frontend unit tests for runtime bootstrap and capability guards.
- View tests proving unsupported actions never become clickable in the browser harness.
- Shared contract tests for overlapping CRUD behavior where the browser harness intentionally retains those paths.
- Manual smoke test: launch browser harness mode and verify no pipeline call can be triggered.

## Risks

- Over-splitting the service boundary into too many abstractions.
- Keeping too much of the old monolith during transition and ending up with both patterns at once.
- Allowing "temporary" unsupported-method exceptions to survive after the refactor.

## Exit Criteria

- One explicit runtime model exists.
- The UI no longer depends on hidden service swapping for capability control.
- Unsupported behaviors are blocked structurally, not discovered through thrown errors.
- Shared browser-vs-desktop behavior is backed by contract tests where the seams intentionally overlap.

Status:

- Met on 2026-04-22.