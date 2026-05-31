# Runtime Contract

This document defines the standing behavior for the harness orchestrator and agent roles.

## Runtime Job

- Identify the controlling surface.
- Separate evidence, inference, unknowns, and speculation.
- Ground multi-step, risky, or behavior-facing work in a project admissibility report before choosing files or tasks.
- Identify affected and non-affected surfaces before behavior-changing edits.
- Route work to the correct agent.
- Keep verification explicit.
- Separate scaffolding, wiring, and user-facing behavior.
- Keep planning tied to the current task-authorized implementation goal inside the project's invariant space.
- Update repo-local memory when the project state changes.

## Canonical Memory Rule

- Treat `harness/` as the only canonical repo-local memory for project continuity.
- Canonical continuity lives in `harness/implementation-projects/archive/`, `harness/open-decisions.md`, and `harness/known-failures.md`.
- Do not create, update, or rely on repo-root `memories/`, `memories/repo/`, or similar host-runtime memory files for implementation history, decision authority, risk state, or verification evidence.
- If a host tool provides repo-memory features, ignore them for authoritative project state and inspect the canonical harness surfaces instead.

## Authority Lens

- Invariant authority lives in `harness/project-spec/**`. It defines what the project is allowed to become.
- Task authority selects or sequences the current work inside that invariant space. It usually comes from the current user instruction, open decisions, and the active plan.
- Open decisions and active plans may interpret or sequence project work, but they do not silently override project-spec invariants.
- If task authority conflicts with invariant authority, stop and surface the conflict instead of improvising around it.

## Project Admissibility Report

The project admissibility report carries the relevant project constraints from `harness/project-spec/**` through PM review, planning, implementation, review, and archive. It is not a new project ontology or authority layer. It is a strict report format for naming what is admissible under the current project spec and request.

For multi-step, risky, or behavior-facing work, the report should state:

- Invariant constraints: project-spec constraints that govern the request.
- Task constraints: current-request constraints that govern what is being asked now.
- Constraint conflicts: any direct conflict, ambiguity, or missing basis between invariant constraints and task constraints.
- Allowed transformation types: only the transformations, approval requests, or amendment requests currently admissible.
- Affected surfaces: explicitly named surfaces whose contents, role, or meaning would change.
- Non-affected surfaces: explicitly named surfaces that must remain untouched or semantically unchanged.
- Admissibility checks: pass, fail, or blocked status for each named constraint.
- Stop conditions: the exact conditions under which work must pause because an invariant would be violated or authority is missing.

If the report cannot be grounded in repo state, invariant authority, or task authority, stop and ask for the missing authority or clarification.

## PM Output Validity

PM output is valid only when it can be checked against the project admissibility report and the project-spec validity condition. In practice, that means the PM must show:

- invariant constraints cited from the project spec
- task constraints separated from invariant constraints
- conflicts or missing bases surfaced explicitly
- allowed transformation types named from the governance primitives or approval boundaries
- affected and non-affected surfaces named truthfully
- admissibility checks with pass, fail, or blocked status
- stop conditions tied to invariant violation or missing authority

If any of those checks fail, PM output is `admissibility-blocked` rather than guidance.

## Constraint-First Work

- Choose the implementation shape that satisfies named invariant constraints, task constraints, allowed transformation types, and verification requirements.
- Do not optimize by change size, local containment, or other sizing language. Prefer the approach whose admissibility checks, affected surfaces, and verification consequences can be stated truthfully.
- If multiple admissible approaches are available, prefer the one with clearer constraint satisfaction and clearer verification.
- If task authority is insufficient to advance the project objective truthfully, stop and ask for the missing authority. Do not shrink the work into a non-meaningful substitute just to preserve locality.
- If the requested task would change what the project is allowed to become, treat that as an invariant-authority amendment request rather than ordinary task selection.

## Claim Discipline

For ordinary coding work, use the compressed form:

- Source: what was observed or reported.
- Inference: what conclusion follows and why.
- Unknowns: what has not been checked.
- Action state: proposed, implemented, validated, blocked, deferred, or quarantined.
- Cash-out: what observable check should change.

Use the full bridge schema in [canon/bridge-schema.md](canon/bridge-schema.md) only when the move crosses schema, API, auth, storage, deployment, broad behavior, high uncertainty, or the type-system canon itself.

## Anti-Drift Contract Discipline
- Any new enum/category in a contract must map to a deterministic function over current observables. If it does not, stop and define it before continuing.

## Behavior Reality Discipline

- Every non-trivial behavior claim needs a named user-facing acceptance probe before implementation or as soon as the seam is understood.
- Types, fields, files, paths, routes, crates, DTOs, configs, nominal callers, mocks, fixtures, snapshots, dry runs, and unit tests can prove structure. They do not prove user-facing behavior by themselves.
- Use `scaffold-only` when the evidence proves only structure, internal plumbing, or fixture behavior.
- Use `live-wired` only when a non-test caller or operator surface exercises the intended path against the intended backend, target, or failure source and produces the expected user-facing consequence.
- A command that exits successfully but fails the user-facing acceptance question is not a pass. Mark the seam active, blocked, or failed, then fix, quarantine, or ask for a project decision.
- If the behavior probe cannot run, name the missing caller, backend, target, data, credential, service, or operator action. Do not describe the behavior as implemented or archive it as complete.

## Start Rule

Default to read-only scout mode unless the user explicitly asks to implement. If implementation is requested, state the affected and non-affected surfaces before editing and proceed.

## Current Goal Rule

The active planning horizon is the current task-authorized implementation goal. Sketch contracts only for seams needed to complete that goal or for approval boundaries it touches. Do not preplan future layers, nodes, bundles, phases, or successor implementations unless the user explicitly provides the next end goal.

## Stop Rule

Stop and ask before crossing approval boundaries, failing an admissibility check, making changes whose correctness depends on project intent that is not available in the repo, or treating task authority as if it silently overrode invariant authority.

## Done Rule

Work is done only when:

- changed surfaces are named
- verification items are pass, fail, blocked, skipped with reason, or deferred with owner
- every behavior-facing claim maps to a passing named acceptance probe or an explicit downgrade to `scaffold-only`, blocked, skipped, or deferred with owner
- remaining risk is explicit
- project memory is updated when relevant
- no duplicate project-state store was created outside `harness/`
- if an implementation changed state, `harness/implementation-projects/active/`, `harness/implementation-projects/archive/`, and `harness/open-decisions.md` are reconciled in the same turn or explicitly marked blocked with owner
- completed implementation bundles are moved out of `active/`; `active/` keeps one live numbered bundle
