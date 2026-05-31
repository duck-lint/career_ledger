# Implementation 06 Tracker

## Status

- State: blocked
- Current seam: `I06-S1: Read-only SQLite source-authority extraction into the approved source-shaped contract` is planned only and not yet authorized for implementation
- Next action: add the sanitized sample DB to `src-tauri/fixtures/career.db`, then implementation can begin under PD-02

## Work Log

| Date | Agent Role | Change | Evidence | Next |
| --- | --- | --- | --- | --- |
| 2026-05-31 | Planner | Opened implementation-06 as one planning-only bundle for the first real SQLite-backed source-authority seam, kept the seam read-only and contract-preserving, named the later desktop acceptance probe, and blocked implementation on missing authoritative SQLite basis artifacts. | Evidence came from the governing project-spec docs, `harness/open-decisions.md`, archived implementation-05 closeout, `src-tauri/src/main.rs`, `desktop/main.js`, `desktop/probes/i04-desktop-probe.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, `src-tauri/Cargo.toml`, and the workspace scan showing no repo-local checked-in SQLite basis artifact. | Wait for authoritative SQLite schema snapshot, sample database, or source contract; if those artifacts expose a new approval-boundary question, record that before implementation. |
| 2026-05-31 | Harnessed Agent | Narrowed the implementation-06 blocker after the user supplied `career_schema.sql` and a sample SQLite database attachment. The basis-evidence blocker is partially resolved, but implementation remains blocked on explicit decisions for labels, weighted tag links, requirement-region taxonomy, first-seam scope, sample database handling, and later probe strictness. | Evidence now includes the supplied SQLite schema snapshot, the sample database attachment, the current approved source-shaped fixture, and the unchanged adapter contract in `proof-slices/ps01/source-authority-adapter.mjs`. | Surface a decision option matrix for the remaining blockers and record the chosen direction before implementation. |
| 2026-05-31 | User | Approved the recommended first-seam direction set plus D1: first seam limited to `experience_records`, `evidence_items`, and canonical tag vocabulary; deterministic seam-local label and weight mapping; semantic overlay for requirement-region taxonomy; profiles/settings unused; behavior-parity probe contract; generic bridge naming; sanitized repo-local sample DB as seam validation artifact. | Explicit user direction selected the recommended option set plus D1, and stated the replacement sample DB uses made-up candidate and experience information. | Record the chosen direction in decision authority and planning docs, then wait for the sanitized DB to be present in the repo-local path. |

## Seam Status

| Seam | Owner Agent | Status | Verification | Notes |
| --- | --- | --- | --- | --- |
| `I06-S1: Read-only SQLite source-authority extraction into the approved source-shaped contract` | Implementer | proposed but blocked | Later acceptance is `I06 Desktop Probe: SQLite Source Authority Preserves I04 Result Contract`; it cannot run truthfully until the sanitized sample DB exists at `src-tauri/fixtures/career.db` and the seam can be verified against it. | Preserve `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` unchanged unless a separate admissibility question is opened first. Follow PD-02 for scope, labels, weights, taxonomy overlay, and behavior-parity verification. |

## Blockers

| Blocker | Boundary | Owner Agent | Resolution |
| --- | --- | --- | --- |
| The D1 validation artifact is still not repo-local. The sanitized sample DB chosen for implementation-06 is attached in chat, but no `src-tauri/fixtures/career.db` file exists in the workspace. | Seam validation artifact / workspace state | User | Place the sanitized sample DB at `src-tauri/fixtures/career.db`. The `.gitignore` path blocker has already been cleared. |

## Closeout Note

- Only the planning bundle is admissible now.
- Do not start SQLite implementation from this tracker alone.
- When the repo-local sample DB exists at `src-tauri/fixtures/career.db` and `I06-S1` later completes with the named desktop probe passing, archive the bundle.