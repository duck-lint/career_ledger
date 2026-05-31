# Implementation 07 Tracker

## Status

- State: blocked
- Current seam: `I07-S1` is defined but not yet admissible for implementation until the user chooses option A or option B for pending decision `PD-03`
- Next action: obtain user direction on keeping the explicit local overlay or seeking approval to move authority into SQLite under pending decision `PD-03`

## Work Log

| Date | Agent Role | Change | Evidence | Next |
| --- | --- | --- | --- | --- |
| 2026-05-31 | Planner | Opened implementation-07 as one planning-only bundle for the post-I06 requirement-region authority question, compared the two near-term authority options without implementing either one, preserved the unchanged ps01 boundary, deferred profiles/settings widening, named the later desktop acceptance probe, and identified the need for a pending decision row in `harness/open-decisions.md`. | Evidence came from the governing project-spec docs, `harness/open-decisions.md`, `harness/implementation-projects/archive/implementation-06-summary.md`, `src-tauri/src/main.rs`, `desktop/main.js`, `desktop/probes/i06-desktop-probe.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, and the active-folder check showing only `.gitkeep` before this bundle. | Record the pending decision row, get the user's authority choice, and stop for approval before any SQLite authority move. |
| 2026-05-31 | Harnessed Agent | Recorded pending decision `PD-03` in `harness/open-decisions.md` so the live requirement-region authority split is now represented in the canonical decision surface. | `PD-03` now asks whether requirement-region authority stays in the explicit local overlay or moves into SQLite-backed authority, with project-intent and storage/schema boundaries named up front. | Wait for the user to choose option A or option B. |

## Seam Status

| Seam | Owner Agent | Status | Verification | Notes |
| --- | --- | --- | --- | --- |
| `I07-S1: Make the requirement-region authority source explicit and probeable without widening the ps01 contract` | Implementer | proposed | Later acceptance probe: `I07 Desktop Probe: Requirement-Region Authority Source Matches Decision`. | Option A keeps `src-tauri/fixtures/source-authority-semantic-overlay.json` as explicit local authority. Option B seeks explicit approval to move requirement-region authority into SQLite. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stay unchanged in either case, and profiles/settings remain deferred. |

## Blockers

| Blocker | Boundary | Owner Agent | Resolution |
| --- | --- | --- | --- |
| Pending decision `PD-03` is now recorded, but no option has been chosen yet for where requirement-region authority should live. | Project-intent authority now; storage/schema approval too if SQLite is chosen. | User | Choose option A or option B explicitly, and obtain approval before implementation if the choice is SQLite authority. |

## Closeout Note

- This tracker is intentionally blocked pending the authority decision.
- When `I07-S1` is later implemented or intentionally retired, move this bundle from `active/` to `archive/`.