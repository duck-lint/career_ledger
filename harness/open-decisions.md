# Open Decisions

This file is the current decision authority for decisions that still matter outside an archived implementation bundle.

Do not use this file as a roadmap. Record only decisions already made, decisions required to continue the current implementation, and explicit user-provided next end goals.

## Current Decisions

| ID | Decision | Source | Status | Owner | Revisit Trigger |
| --- | --- | --- | --- | --- | --- |
| PD-01 | Career Ledger's approved greenfield canonical direction is a runtime-only semantic projection/traversal engine: build semantic nodes and edges in memory, select evidence by traversal within a target semantic region, keep semantic-position transitions non-persisted, preserve SQLite as source authority, and add no persisted workspace, transition, or workflow-status state. | Explicit user approval; [implementation-01 summary](implementation-projects/archive/implementation-01-summary.md) | approved/current | User | Revisit only if a future proposal adds persisted semantic or workflow state, reintroduces workflow-status state, introduces AI, embeddings, or similar forbidden behavior, or changes source authority away from SQLite. |

## Pending Decisions

No pending decisions recorded.

When a pending decision exists, use:

| ID | Question | Boundary | Needed For | Owner | Status |
| --- | --- | --- | --- | --- | --- |

## Notes

- Link to archived implementation summaries or decision files when a decision's evidence lives there.
- Do not point active decisions at stale files under `active/` after a bundle has moved to `archive/`.
- Remove decisions that no longer affect current or paused implementation work, or move their final context into the archived bundle summary.
