# Repo-Local Harness

This directory holds the stable repo-local harness contract for planning and handoff work in career_ledger. It stays small on purpose: stable rules live here, live effort docs live in [docs/implementation-projects/README.md](../implementation-projects/README.md), and completed efforts move to [docs/archive/README.md](../archive/README.md).

## Intent

- Keep planning, approval boundaries, and verification duties repo-local.
- Match the repo's existing program-doc style: one map, one tracker, small explicit seams.
- Preserve the repo's greenfield stance: no legacy-compatibility framing unless a task explicitly requires it.

## Non-Goals

- This is not a product roadmap.
- This is not a replacement for the root README.
- This does not define CI, editor, or extension policy.

## Working Surface

- Stable harness rules live here.
- Live effort docs live as numbered plan/tracker pairs in [docs/implementation-projects/README.md](../implementation-projects/README.md).
- Completed efforts move under [docs/archive/README.md](../archive/README.md).
- Shared claim vocabulary lives in [agent-reference-type-system.md](../../agent-reference-type-system.md).

## Required Shape For Live Plans

- One numbered pair per effort: `implementation-XX-plan.md` and `implementation-XX-tracker.md`.
- Plan files are decision documents: intent, non-goals, evidence, unknowns, blast radius, seams, approval gates, and verification contract.
- Tracker files are factual execution records: status, decisions, risks, open questions, validations, and completion state.

## Approval Boundaries

- Pause for schema, API, auth, storage, deployment, destructive, or broad architecture changes.
- Docs-only harness updates do not need a separate approval gate unless they change repo-wide workflow commitments.

## Validation Posture

- Prefer the narrowest falsifiable check first.
- Use executable validation when code changes exist.
- For docs-only harness work, validate file presence, naming consistency, and internal links before doing anything broader.