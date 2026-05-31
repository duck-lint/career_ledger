# Open Decisions

This file is the current decision authority for decisions that still matter outside an archived implementation bundle.

Do not use this file as a roadmap. Record only decisions already made, decisions required to continue the current implementation, and explicit user-provided next end goals.

## Current Decisions

| ID | Decision | Source | Status | Owner | Revisit Trigger |
| --- | --- | --- | --- | --- | --- |
| PD-01 | Career Ledger's approved greenfield canonical direction is a runtime-only semantic projection/traversal engine: build semantic nodes and edges in memory, select evidence by traversal within a target semantic region, keep semantic-position transitions non-persisted, preserve SQLite as source authority, and add no persisted workspace, transition, or workflow-status state. | Explicit user approval; [implementation-01 summary](implementation-projects/archive/implementation-01-summary.md) | approved/current | User | Revisit only if a future proposal adds persisted semantic or workflow state, reintroduces workflow-status state, introduces AI, embeddings, or similar forbidden behavior, or changes source authority away from SQLite. |
| PD-02 | The desktop seam remains bounded as follows: keep profiles and settings unused; derive experience labels from `canonical_scope_summary` falling back to `organization · title`; derive evidence labels from `evidence_note` falling back to `claim`; use fixed seam-local weights of record-tag `1`, evidence-tag `2`, and evidence-to-experience `1`; preserve behavior parity with the current desktop result contract rather than exact fixture-id parity; keep the generic `load_source_authority` bridge naming; and keep the sanitized repo-local sample database as the local validation artifact. The implementation-06 overlay split for `tag_requirement_links`, `requirements`, and `target_regions` was superseded by PD-03 and implementation-07. | Explicit user approval during implementation-06 planning; [implementation-06 summary](implementation-projects/archive/implementation-06-summary.md); supersession recorded in [implementation-07 summary](implementation-projects/archive/implementation-07-summary.md) | approved/current | User | Revisit only if profiles/settings need to become active in this seam, if the deterministic label or weight mapping changes, if the visible desktop result contract changes, or if the local validation artifact strategy changes. |
| PD-03 | Requirement-region authority now lives in SQLite-backed taxonomy authority: `tag_requirement_links`, `requirements`, and `target_regions` are loaded from SQLite only, while `src-tauri/fixtures/source-authority-semantic-overlay.json` now carries only the fixed sample `jobPostingInput`. This stays inside the existing approved taxonomy source category and does not promote `jobPostingInput` into canonical persisted authority. | Explicit user approval for implementation-07; archived closeout in [implementation-07 summary](implementation-projects/archive/implementation-07-summary.md) | approved/current | User | Revisit only if a later decision proposes persisting the fixed sample `jobPostingInput`, widening profiles/settings into the same seam, changing requirement-region authority away from SQLite-backed taxonomy authority, or determining that these requirement-region semantics cannot be represented truthfully inside the approved taxonomy category. |

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
