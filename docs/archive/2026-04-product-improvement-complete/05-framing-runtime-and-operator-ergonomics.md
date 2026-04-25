# WS5: Framing, Runtime, And Operator Ergonomics

## Status

Complete.

Docs/framing and the first runtime-copy pass landed on 2026-04-25.
Build policy presets and raw-intake preflight landed on 2026-04-25.

## Finding Addressed

Several adoption surfaces still feel like internal/operator tooling: docs frame the app inconsistently, browser harness limitations can look like missing product features, build policy exposes raw knobs, and raw intake import lacks a preview/repair loop.

## Goal

Reduce avoidable user confusion without weakening the advanced/operator surfaces that make the app inspectable.

## Recommended End State

- README, active planning docs, and in-app copy describe the current product consistently.
- Browser harness is impossible to confuse with the full desktop runtime.
- Build policy has safe presets or an advanced posture around raw numeric controls.
- Raw intake supports dry-run/preflight review before committing imports.

## Non-Goals

- Do not reopen browser runtime parity.
- Do not remove advanced controls; make them appropriately framed.
- Do not build resume style/template control in this workstream.
- Do not turn raw intake into a full approval-board workflow unless explicitly approved.

## Impacted Surfaces

- `README.md`
- Deleted redundant root product-requirements draft
- `src/App.tsx`
- `src/components/views/ResumeGenerationView.tsx`
- `src/components/views/SettingsView.tsx`
- Raw intake backend if dry-run/preflight is implemented
- Tests for build policy preset behavior and intake dry-run behavior

## Implementation Slices

### Slice 1: Docs/framing reconciliation

- Collapse redundant product-requirements material into README.
- Keep README aligned with current feature reality and active plan docs.
- Keep browser harness wording explicit.

Status:

- Landed in `README.md`; the redundant root product-requirements draft was removed.
- README now calls out readiness, reviewable requirement analysis, resume audit trail, taxonomy diagnostics, raw-intake safety rules, product boundaries, and the limits of `npm run dev`.
- The active product-improvement plan remains the planning source of truth for implementation sequencing and scope decisions.

### Slice 2: Runtime mode clarity

- Make harness limitations visible near disabled desktop-only features.
- Ensure readiness distinguishes harness limitation from missing user data.

Status:

- First pass landed in the app shell and Settings view.
- Header subtitle now changes between full desktop runtime and browser harness.
- Runtime badge labels now distinguish `Desktop runtime` from `Browser harness only`.
- Settings disabled-state copy now explains that browser harness uses localStorage and cannot open SQLite files, local files, or the Rust intake pipeline.

### Slice 3: Build policy presets

- Define presets such as concise, coverage-first, and project-heavy.
- Decide whether presets overwrite stored policy or stage a preview before save.
- Keep advanced numeric controls available.

Status:

- Landed as frontend draft presets over the existing stored `BuildPolicy` contract.
- Presets include Balanced default, Concise, Coverage-first, and Project-heavy.
- Applying a preset stages changes in the current draft instead of auto-saving.
- The UI now shows saved-versus-draft field deltas before the existing Save Build Policy command writes the active DB policy.
- Advanced numeric and boolean controls remain available below the presets.

### Slice 4: Raw intake dry-run/preflight

- Add dry-run request/response path or explicit preview command.
- Return row/item-level skip reasons and repair hints.
- Commit only after the user accepts the preview.

Proposed contract before implementation:

- Add a desktop-only `preview_raw_intake` Tauri command and `previewRawIntake(path)` frontend service method.
- Refactor the Rust intake flow so preview and commit share parsing, action classification, target-record resolution, tag inference, duplicate-intake-id checks, and duplicate-claim checks.
- Preview must not insert import runs, import items, records, evidence, or anomalies.
- Preview response should include source path, total items, would-import record/evidence counts, skipped count, skip summaries, duplicate intake ids, and per-item outcomes with repair hints.
- Settings should require Preview before Import from the main UI, while the existing commit command remains the backend commit operation.
- Commit still re-validates at import time because the database may change after preview.

Status:

- Implemented as `preview_raw_intake` / `previewRawIntake(path)` beside the existing import command.
- Preview and commit share parsing, action classification, target-record resolution, tag inference, duplicate-intake-id checks, duplicate-claim checks, skip summaries, and repair hints.
- Preview returns total items, would-import record/evidence counts, skipped count, duplicate intake ids, per-item outcomes, messages, and repair hints.
- Preview does not insert import runs, import items, records, evidence, or anomalies.
- Settings now requires a preview for the current path before enabling Import Preview.
- Import revalidates through the commit path before writing.

### Slice 5: Tests and validation

- Docs-only slices need review, not test execution.
- Build policy and intake changes need frontend/backend tests.
- Full `npm run verify` for backend command changes.

## Validation Plan

- Markdown review for docs-only changes.
- Frontend tests for preset application and disabled/advanced state.
- Backend and frontend tests for intake dry-run if implemented.
- `npm run verify` for code changes.

## Validation Completed

- Stale product-doc grep passed for removed prototype-era claims: `CRUD prototype`, `prototype focuses`, `intentionally excludes workspace pipeline`, `export features planned`, `claim ceiling`, `demo-data indicators`, and `desktop-first prototype`.
- Editor diagnostics found no errors in the updated docs/runtime files.
- `npm run typecheck` passed.
- `npm test -- ReadinessDashboard.test.tsx` passed with 7 tests.
- `npm test -- build-policy-presets.test.ts` passed with 3 tests.
- `npm run typecheck` passed after build-policy preset integration.
- Redundant root product-requirements references were removed from README, active plan docs, and the desktop min-width comment.
- `cargo test intake` passed with 10 tests after raw-intake preview integration.
- `npm test -- SettingsView.test.tsx` passed with 1 test.
- `npm run verify:frontend` passed after the full WS5 implementation: lint, typecheck, and 57 frontend tests green.
- `cargo test` passed after the full WS5 implementation: 110 Rust tests green in `app_lib`.

## Risks

- Presets hide important policy consequences.
- Intake dry-run duplicates too much import logic unless the backend shares internals deliberately.
- Docs cleanup becomes a wording pass without resolving product-state claims.

## Exit Criteria

- Product docs and in-app framing agree about what Career Ledger is now.
- Browser harness limitations are explicit and not confused with product failure.
- Build policy is approachable by default and inspectable when needed.
- Raw intake can be previewed and repaired before commit.

Current status:

- Product docs and first-pass in-app runtime copy are aligned with the current desktop product.
- README is now the root product/user/developer document; this completed planning record is archived under `docs/archive/2026-04-product-improvement-complete/`.
- Browser harness limitations are explicit in README, app header, readiness, and Settings disabled states.
- Build policy presets are staged, previewable, and use the existing save path.
- Raw-intake preflight is implemented and requires preview before import from Settings.