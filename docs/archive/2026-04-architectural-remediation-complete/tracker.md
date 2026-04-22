# Archived Remediation Tracker

This file is the preserved execution record for the completed remediation program. It is no longer a live board unless a future plan explicitly reopens the program.

## Program Status

- Overall status: Closed and archived
- Current recommended focus: None inside this program; start any new work as a separate plan or feature track
- Current blocking decision: None

## Workstream Status

| WS | Title | Status | Owner | Notes |
|---|---|---|---|---|
| WS1 | Runtime contract unification | Complete | Copilot + user | Explicit runtime model, per-capability composition, and shared-seam contract coverage landed |
| WS2 | Backend concurrency and command isolation | Complete | Copilot + user | Shared backend connection state was removed; commands now open isolated connections from active path state and regression tests cover path resolution/reopen behavior |
| WS3 | Build, typecheck, and quality gates | Complete | Copilot + user | Typechecked build restored, explicit verify scripts landed, and CI now runs the same frontend/backend verification surface as local development |
| WS4 | Runtime modes and seed strategy | Complete | Copilot + user | Browser harness is now documented honestly and no longer carries fallback/seed copy drift |
| WS5 | Bulk mutations and batch operations | Complete | Copilot + user | Record and evidence bulk delete now use preview + commit APIs with strict conflict handling, transactional backend commits, and shared runtime parity |
| WS6 | Repo hygiene and test discipline | Complete | Copilot + user | Frontend warning debt is resolved, lint now fails on warnings, and verify passes cleanly end-to-end |

## Decision Log

| Date | Decision | Why | Follow-up |
|---|---|---|---|
| 2026-04-22 | Fresh first-run state should be empty, not starter-seeded | Removes the seeded-taxonomy crutch from browser/dev and new-user flows | Continue WS1 capability cleanup and update docs/UI copy |
| 2026-04-22 | Browser `npm run dev` should behave as an empty local harness, not a seeded pseudo-runtime | Keeps browser development useful without pretending it matches desktop behavior | Finish runtime descriptor/capability work in WS1 |
| 2026-04-22 | Taxonomy export/import is not the full app migration path | It preserves taxonomy only, not records/evidence/profile/build policy | Keep this limitation explicit until a broader migration/export story exists |
| 2026-04-22 | WS1 is complete once the explicit runtime boundary exists and the remaining shared browser-vs-desktop seams are covered by contract tests | Prevents WS1 from turning into an endless cleanup loop after the architecture and tests are in place | Move to WS4 next |
| 2026-04-22 | WS4 is complete once browser mode is described consistently as a harness and no seed/fallback copy remains on the live user path | Prevents WS4 from inflating into an unnecessary demo-mode project when the current product decision is simpler | Move to WS2 next |
| 2026-04-22 | WS2 is complete once backend command wiring stores only active DB path state and every command opens its own configured SQLite connection | Removes the process-wide connection mutex without widening into a pool or async rewrite | Move to WS3 next |
| 2026-04-22 | WS3 is complete once the build typechecks again and local verification scripts are the same commands CI runs | Restores cheap safety rails without forcing warning cleanup into the same slice | Move to WS5 next |
| 2026-04-22 | GitHub Actions is the current CI surface, and the repo-level verify scripts are now its source of truth | Keeps local and CI verification aligned instead of splitting checks across ad hoc workflow commands | Decide later whether warning debt becomes blocking |
| 2026-04-22 | WS5 batch delete uses strict all-or-nothing semantics by default when any requested id is missing | Keeps preview and commit rules aligned across frontend, browser harness, and Tauri backend without quiet partial deletes | Move to WS6 next |
| 2026-04-22 | Frontend lint warnings now fail the verify path via `eslint --max-warnings=0` | Makes the zero-warning state an enforced contract instead of a one-time cleanup result | Keep future warning cleanup inside normal feature work |

## Open Questions

- None currently blocking the remediation program.

## Risk Log

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| WS1 drifts into a broad frontend rewrite | High | Medium | Keep runtime bootstrap small and move one view at a time |
| WS2 introduces path-switch bugs | High | Medium | Add initialization and path-switch regression tests first |
| WS3 turns on hard gates before warning debt is paid down | Medium | High | Stage the rollout and fix known failures immediately |
| WS4 keeps browser-harness wording ambiguous and still leaks fake parity | High | Medium | Make capability limitations visible in both types and UI |
| WS5 ships batch delete without preview counts | Medium | Medium | Require preview response before destructive commit |
| WS6 becomes endless cleanup without exit criteria | Medium | Medium | Tie completion to the review findings, not open-ended polish |

## Suggested Implementation Sequence

1. Replace shared backend connection state with a connection provider.
2. Restore typecheck and CI verify commands.
3. Add batch preview + batch delete commands and wire the UI.
4. Close lint/test warning debt and add contract tests where runtimes overlap.

## Completed In Current Slice

- Resolved the remaining frontend warning debt by fixing the async `ConfirmDialog` test flow, simplifying effect dependencies in `EvidenceDialog` and `TaxonomyView`, and removing fast-refresh warning triggers from shared UI primitives.
- Moved shared button variant styling into a non-component module and removed the unused `badgeVariants` export so React refresh lint rules hold for the right reason.
- Hardened the lint gate with `eslint --max-warnings=0`, so warnings now fail local verification and CI instead of accumulating as background noise.
- Validation for WS6 now includes a warning-free `npm run lint` and a clean end-to-end `npm run verify` pass.
- Added explicit record and evidence batch delete preview/result types to the shared frontend service contract.
- Implemented strict preview + commit batch delete methods in both runtime adapters, and aligned browser-harness single-record deletion with desktop cascade semantics.
- Added backend preview and transactional batch delete commands for records and evidence items in Tauri, including strict missing-id conflict handling.
- Rewired the records and evidence views to use one preview call and one commit call instead of client-side delete loops.
- Bulk delete dialogs now surface preview counts and block destructive confirmation when strict preview detects missing ids.
- Added frontend view tests for the record and evidence bulk delete flows, plus backend and adapter tests for missing ids, cascade counts, and successful commit behavior.
- Validation for WS5 now includes passing focused adapter tests, focused UI tests, Rust library tests, and a full `npm run verify` pass.
- Restored a real typechecked production build by removing `--noCheck` from `npm run build`.
- Added explicit `typecheck`, `verify:frontend`, `verify:backend`, and `verify` scripts to the repo script surface.
- Updated CI to run the new frontend and backend verify commands before the desktop bundle build.
- Fixed the blocking ESLint error in `src/lib/utils.test.ts` so the restored verify path runs cleanly.
- Updated the README to document the new verification commands and recommended local verification flow.
- Validation for WS3 now includes passing `npm run verify:frontend`, `npm run verify`, and `npm run build` runs.
- Replaced the long-lived shared backend SQLite connection state with `ActiveDbState`, which stores only the resolved active DB path.
- Added centralized helpers to resolve the active runtime DB path and open configured per-command SQLite connections.
- Migrated all Tauri backend commands, including resume pipeline and raw intake import, onto isolated per-command connections.
- Removed the remaining `DbState`/`ActiveDbPath` command wiring from the backend runtime.
- Added backend regression tests for uninitialized active-path state, reopened-connection persistence, and active-path switching.
- Backend validation now includes a passing `cargo check` and `cargo test --lib` run after the WS2 migration.
- Fresh browser local mode no longer auto-seeds sample data.
- Freshly created runtime DBs initialize with empty taxonomy instead of the starter taxonomy.
- Full data reset now returns to empty first-run state.
- Nearby runtime copy was corrected to describe browser mode as a harness and the default DB as app-local.
- A shared runtime descriptor/capability module now owns runtime detection.
- Frontend runtime probes were centralized so `__TAURI_INTERNALS__` is no longer scattered through views and app bootstrap.
- Unsupported taxonomy actions are now disabled structurally in the browser harness instead of failing only after click.
- The dead browser sample-data seed function was removed from `local-service`, so the harness no longer carries a dormant conflicting bootstrap path.
- `CareerService` has been decomposed into narrower sub-interfaces for runtime admin, taxonomy, pipeline, operations, intake, and normalization.
- `service.ts` now exports staged narrow service bindings, and the runtime-heavy views (`App`, `Settings`, `Taxonomy`, `Resume`) have been migrated onto those narrower seams.
- The remaining library- and operations-oriented views/dialogs now use the narrow service bindings as well, so UI callers no longer import a monolithic service export.
- `appRuntime` now exposes an explicit named `services` bundle instead of a single broad service instance.
- WS1 contract tests now cover runtime bootstrap selection, browser harness adapter behavior for shared library/profile/taxonomy seams, and stable Tauri IPC mappings for the matching desktop adapter seams.
- The internal `RuntimeServiceAdapter` composite has now been removed entirely, and the runtime bootstrap is assembled from explicit per-capability service bundles.
- Settings reset copy now says empty first-run state instead of seed data.
- Browser-harness export metadata now uses harness naming instead of `fallback` naming.
- User-facing docs now describe `npm run dev` as the browser harness instead of as a generic frontend fallback.

## Completion Checklist

- [x] WS1 complete
- [x] WS2 complete
- [x] WS3 complete
- [x] WS4 complete
- [x] WS5 complete
- [x] WS6 complete
- [x] README updated with any sequencing changes learned during execution

## Notes

- Keep this file factual. Record decisions and risks, not aspirations.
- If a future effort reopens any part of this program, do it in a new active plan instead of silently treating this archive as live state.
