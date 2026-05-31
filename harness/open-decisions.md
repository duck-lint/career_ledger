# Open Decisions

This file is the current decision authority for decisions that still matter outside an archived implementation bundle.

Do not use this file as a roadmap. Record only decisions already made, decisions required to continue the current implementation, and explicit user-provided next end goals.

## Current Decisions

| ID | Decision | Source | Status | Owner | Revisit Trigger |
| --- | --- | --- | --- | --- | --- |
| PD-01 | Career Ledger's approved greenfield canonical direction is a runtime-only semantic projection/traversal engine: build semantic nodes and edges in memory, select evidence by traversal within a target semantic region, keep semantic-position transitions non-persisted, preserve SQLite as source authority, and add no persisted workspace, transition, or workflow-status state. | Explicit user approval; [implementation-01 summary](implementation-projects/archive/implementation-01-summary.md) | approved/current | User | Revisit only if a future proposal adds persisted semantic or workflow state, reintroduces workflow-status state, introduces AI, embeddings, or similar forbidden behavior, or changes source authority away from SQLite. |
| PD-02 | The first SQLite-backed desktop seam is bounded as follows: read only `experience_records`, `evidence_items`, and canonical tag vocabulary from SQLite first; keep profiles and settings unused; derive experience labels from `canonical_scope_summary` falling back to `organization · title`; derive evidence labels from `evidence_note` falling back to `claim`; use fixed seam-local weights of record-tag `1`, evidence-tag `2`, and evidence-to-experience `1`; treat old prototype taxonomy tables as non-authoritative for the new requirement-region contract and use a separate semantic overlay for `tag_requirement_links`, `requirements`, and `target_regions`; preserve behavior parity with the current desktop result contract rather than exact fixture-id parity; rename the future bridge to a generic source-authority load path; and use a sanitized repo-local sample database as the seam validation artifact. | Explicit user approval during implementation-06 planning; [implementation-06 summary](implementation-projects/archive/implementation-06-summary.md) | approved/current | User | Revisit only if the supplied SQLite basis proves incompatible with this mapping without proof-slice edits, if the semantic overlay needs to become persisted SQLite authority, if the first seam must widen to profiles/settings, or if the sanitized sample DB cannot be made repo-local. |
| PD-03 | Requirement-region authority should move into SQLite-backed taxonomy authority: `tag_requirement_links`, `requirements`, and `target_regions` should no longer remain authoritative in `src-tauri/fixtures/source-authority-semantic-overlay.json`. This decision treats those requirement-region semantics as taxonomy relationships and requirement-region definitions inside the existing approved taxonomy source category, not as a new canonical persisted truth category. This decision does not promote the fixed sample `jobPostingInput` into canonical persisted authority; that input remains seam-local runtime input unless a later explicit decision approves persistence. Implementation is still approval-gated and must stop for explicit storage/schema approval before any taxonomy authority move starts. | Explicit user admissibility report for implementation-07; [implementation-07 plan](implementation-projects/active/implementation-07-plan.md) | approved/current | User | Revisit only if a later decision proposes persisting the fixed sample `jobPostingInput`, widening profiles/settings into the same seam, changing the approved requirement-region authority target away from SQLite-backed taxonomy authority, or determining that these requirement-region semantics cannot be represented truthfully inside the approved taxonomy category. |

## Pending Decisions

None current.

| ID | Question | Boundary | Needed For | Owner | Status |
| --- | --- | --- | --- | --- | --- |

When a pending decision exists, use:

| ID | Question | Boundary | Needed For | Owner | Status |
| --- | --- | --- | --- | --- | --- |

## Notes

- Link to archived implementation summaries or decision files when a decision's evidence lives there.
- Do not point active decisions at stale files under `active/` after a bundle has moved to `archive/`.
- Remove decisions that no longer affect current or paused implementation work, or move their final context into the archived bundle summary.
