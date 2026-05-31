# External Cognition Harness

This folder is the repo-local working memory for harnessed implementation work in this project.

Use it to keep plans, handoffs, role boundaries, decisions, failures, verification evidence, and completed implementation summaries outside chat history.

## What This Is For

- Keep planning and implementation tied to the user's current goal.
- Make agent handoffs explicit enough that another role or later session can continue without guessing.
- Preserve decisions, failures, and verification evidence in the repo instead of in chat history.
- Separate implementation shape from user-facing behavior.
- Keep the harness light for trivial local work and structured for multi-step or risky work.

## Core Principles

- Keep this folder concise. Record the current plan, decisions, evidence, failures, and archive status only when they help the work resume or verify cleanly.
- Keep project state, evidence, and reusable reference here. Do not use these docs as a chat transcript.
- Keep repo-local memory as the system of record for completed or paused implementation work.
- Keep `harness/` as the only canonical continuity store. Do not create or rely on repo-root `memories/`, `memories/repo/`, or similar host-managed memory files for project state.
- Track only the current task-authorized implementation goal. Do not pre-plan future bundles unless the user supplies the next end goal.
- Ground multi-step, risky, or behavior-facing work in the repo-local project spec before choosing tasks or files.
- Define verification before calling work complete.
- Behavior claims need a falsifiable user-facing acceptance probe.
- Record recurring failures separately from decisions.
- Prefer plain engineering language. Use the type-system canon only when it clarifies risk.

## Harness Layout

```text
harness/
  README.md
  harness-runtime.md
  sub-agent-assignment-template.md
  sub-agent-roles.md
  archive-policy.md
  known-failures.md
  open-decisions.md
  canon/
    type-system-operational.md
    bridge-schema.md
  implementation-projects/
    active/
    archive/
    templates/
    implementation-plan-template.md
    implementation-tracker-template.md
  project-spec/
    *.md
```

## File Responsibilities

- `README.md`: orientation for harnessed work in this repo.
- `harness-runtime.md`: model-neutral runtime reference that mirrors the orchestrator's standing rules.
- `sub-agent-assignment-template.md`: handoff packet for assigning work to another agent.
- `sub-agent-roles.md`: short role reference for planner, implementer, reviewer, adversary, and archivist.
- `archive-policy.md`: when and how completed implementation work moves to archive.
- `known-failures.md`: recurring harness or repo failure patterns.
- `open-decisions.md`: current decision authority for still-live decisions.
- `canon/type-system-operational.md`: compact claim discipline for normal coding work.
- `canon/bridge-schema.md`: full bridge schema for high-risk or conceptually sensitive moves.
- `implementation-projects/templates/implementation-plan-template.md`: plan skeleton for numbered implementation bundles.
- `implementation-projects/templates/implementation-tracker-template.md`: tracker skeleton for status, handoffs, blockers, and closeout.
- `project-spec/**/*.md`: project-local intent, semantics, architecture, governance rules, approval boundaries, and authority distinctions. Project-specific filenames are allowed.

Treat the surfaces above as canonical. If a host runtime offers persistent repo memory, use it at most as a non-authoritative pointer back to these files, never as a duplicate status or decision log.

## Working Structure

For trivial one-off work, skip project scaffolding and use a lightweight chat plan.

For multi-step, repo-scoped, risky, or architecture-shaping work, create a numbered implementation bundle under `harness/implementation-projects/active/` using the templates:

```text
harness/implementation-projects/active/
  implementation-XX-plan.md
  implementation-XX-tracker.md
```

Optional evidence, decision, seam, or verification files can use the same `implementation-XX` prefix when the work needs them. Keep the bundle concise; create extra files only when they reduce real resumption or verification risk.

Completed bundles move to:

```text
harness/implementation-projects/archive/
```

Keep `active/` to one live numbered bundle. Do not leave completed work in `active/` as a retained foundation.

## Workflow

1. Scout the request and identify the controlling surface.
2. Planner creates or updates the current plan, seams, approval gates, and acceptance probe when the work needs planning docs.
3. Human approval is required before crossing approval boundaries.
4. Implementer executes one approved seam at a time.
5. Reviewer checks the diff against the plan, verification status, and behavior acceptance probe.
6. Adversary stress-tests assumptions when risk, uncertainty, or recurrence justifies it.
7. Archivist updates decisions, known failures, evidence, and archive placement when project memory changes.

## Memory Boundary

Project trajectory and resumable continuity belong in the harness surfaces already defined here.

Do not create a parallel repo-root memory tree such as `memories/repo/harness.md` for implementation history, completed bundle summaries, live decisions, or verification state. That duplicates authority and invites drift.

When resuming work, inspect current repo state plus:

- `harness/implementation-projects/archive/`
- `harness/open-decisions.md`
- `harness/known-failures.md`

Those surfaces replace the need for a separate memory note.

## Approval Boundaries

Escalate before changing schema, API, auth, storage, deployment, billing, destructive operations, broad architecture, compatibility promises, or project-intent-dependent behavior not covered by the repo spec or current task authority.

Approval must name the boundary and current admissibility report. Approval for one schema change is not approval for deployment. Approval for a local refactor is not approval for a compatibility layer.

## About `harness-runtime.md`

Keep `harness-runtime.md` as a separate unnumbered reference. It mirrors the runtime rules in a model-neutral form so every role has the same repo-local contract to check against.

It is unnumbered because it is a standing reference, not a procedural step.
