# Open Decisions

This file is the current decision authority for decisions that still matter outside an archived implementation bundle.

Do not use this file as a roadmap. Record only decisions already made, decisions required to continue the current implementation, and explicit user-provided next end goals.

## Current Decisions

No current decisions recorded.

When a current decision exists, use:

| ID | Decision | Source | Status | Owner | Revisit Trigger |
| --- | --- | --- | --- | --- | --- |

## Pending Decisions

| ID | Question | Boundary | Needed For | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| PD-01 | Should Career Ledger amend its canonical resume-generation contract from tag-first bundle preparation and tag-driven evidence selection to a runtime-only semantic projection/traversal engine that builds in-memory graph nodes and edges, selects evidence by traversal within a target semantic region, and uses non-persisted semantic-position transitions instead of workflow statuses, while preserving SQLite as source truth and adding no new persisted workspace or transition state? | Broad architecture; project-intent authority not covered by current spec | Any non-blocked implementation plan for the requested refactor | User | pending |

## Notes

- Link to archived implementation summaries or decision files when a decision's evidence lives there.
- Do not point active decisions at stale files under `active/` after a bundle has moved to `archive/`.
- Remove decisions that no longer affect current or paused implementation work, or move their final context into the archived bundle summary.
