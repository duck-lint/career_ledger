# Implementation 08 Summary

## Project Prefix

- implementation-08

## Goal And Final Status

- Goal: complete `I08-S1` by replacing the fixed overlay-driven live runtime `jobPostingInput` dependency with explicit operator-supplied runtime input per desktop run while keeping SQLite-backed source authority and SQLite-backed requirement-region taxonomy unchanged from implementation-07.
- Final status: complete and archived. `I08-S1` shipped, the live-wired proof passed, and same-turn archive cleanup is complete.
- Scope limit: implementation-08 is limited to the desktop runtime-input seam, the successor desktop proof, and harness closeout. It does not authorize saved postings, persisted defaults, profiles/settings activation, SQLite authority changes beyond implementation-07, proof-slice edits, auth, deployment, network access, telemetry, cloud behavior, AI, or broader desktop redesign.
- Scope reminder: `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` stayed unchanged.

## Files And Surfaces Changed

- `desktop/index.html`
- `desktop/main.js`
- `desktop/styles.css`
- `desktop/probes/i08-desktop-probe.mjs`
- `src-tauri/src/main.rs`
- `package.json`
- `harness/implementation-projects/archive/implementation-08-plan.md`
- `harness/implementation-projects/archive/implementation-08-summary.md`
- `harness/implementation-projects/archive/implementation-08-tracker.md`
- `harness/implementation-projects/active/implementation-08-plan.md` removed during same-turn archive cleanup
- `harness/implementation-projects/active/implementation-08-tracker.md` removed during same-turn archive cleanup

## Verification Evidence

- `npm run probe:i08` passed end to end.
- The latest passing I08 probe proved two successful runs in one desktop session, `requirementRegionAuthority = sqlite` on both runs, preserved result ids, preserved statuses, preserved unsupported note visibility, preserved ordered path shape, and differing visible analysis metadata between runs.
- The implemented desktop path now passes runtime job-posting input into `load_source_authority` per invocation rather than reading live runtime input from the overlay.
- `node --test proof-slices/ps01/ps01.test.mjs` passed unchanged.
- `get_errors` reported no diagnostics in the touched code and harness files at closeout time after the WebKit CSS prefix fix.

## User-Facing Acceptance Result

- Accepted for the implemented seam: from the same desktop window, the operator can supply runtime job-posting input, run analysis, revise that input, and rerun in the same session without persisting the job-posting text.
- The accepted I08 probe proves both behavior and authority shape: both runs kept `requirementRegionAuthority = sqlite`, the visible desktop result contract remained intact, and the run-specific analysis metadata changed with operator-supplied input.
- No broader product claim is made. The accepted result is limited to runtime-only operator input through the desktop invocation path and does not claim profiles/settings behavior, saved-posting persistence, proof-slice changes, or broader desktop completion.

## Decisions Made Or Reused

- No new project-direction decision was created and `harness/open-decisions.md` did not need a same-turn update.
- The bundle reused `PD-01` as the invariant runtime-only direction, reused `PD-02` for the bounded desktop seam and profiles/settings deferral, and reused `PD-03` for the unchanged SQLite-backed requirement-region authority posture from implementation-07.
- `load_source_authority` now receives job-posting input from the desktop invocation path per run while job-posting input remains runtime-only and non-persisted.
- SQLite-backed source authority and SQLite-backed requirement-region taxonomy remain unchanged from implementation-07.

## Known Failures Added Or Ruled Out

- No new `harness/known-failures.md` entry was needed.
- No recurring harness failure pattern was identified during implementation-08 closeout.
- The transient WebKit CSS prefix diagnostic was resolved before closeout and did not require a reusable failure note.
- Overlay-driven live runtime input is no longer part of the implemented desktop invocation path.

## Unresolved Risks And Revisit Triggers

- Profiles and settings remain intentionally deferred. Any widening into those surfaces requires a fresh approval-boundary pass.
- Job-posting input remains runtime-only and non-persisted. Revisit only if later work proposes saved postings, persisted defaults, profile-backed defaults, or another persisted input authority.
- Revisit if later work changes requirement-region authority away from SQLite-backed taxonomy authority, requires ps01 edits, or changes the current visible desktop result contract.
- Revisit if later work depends on the overlay sample as live runtime input again rather than as a non-authoritative fixture artifact.
