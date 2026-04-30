# Repo-Local Harness

This directory mirrors the stable shared harness seed for career_ledger and localizes only the repo workflow details that differ from canon.

Stable harness rules live here. Live implementation memory lives in [../implementation-projects/README.md](../implementation-projects/README.md). Completed work is preserved in [../archive/README.md](../archive/README.md).

## Intent

- Keep planning, approval boundaries, handoff structure, and verification duties repo-local.
- Preserve the repo's greenfield stance: no legacy-compatibility framing unless a task explicitly requires it.
- Keep the stable harness split into small reference files instead of one oversized index.

## Seeded Surface

- [runtime-contract.md](runtime-contract.md): always-on orchestration behavior and approval boundaries.
- [roles.md](roles.md): planner, implementer, reviewer, adversary, and archivist role contracts.
- [handoff-packet.md](handoff-packet.md): standard handoff payload for agent transitions.
- [verification-contract.md](verification-contract.md): validation contract template for non-trivial work.
- [known-failures.md](known-failures.md): recurring failure patterns worth remembering.
- [archive-policy.md](archive-policy.md): archive rules, localized to this repo's archive layout.
- [canon/type-system-operational.md](canon/type-system-operational.md): compressed claim discipline.
- [canon/bridge-schema.md](canon/bridge-schema.md): full bridge schema for higher-risk changes.

## Repo-Local Workflow Notes

- The folder entrypoint remains `README.md` for easy browsing, while the rest of the canon is split across the files above.
- Completed work archives under [../archive/README.md](../archive/README.md), not under `docs/implementation-projects/archive/`.
- Reusable implementation scaffolding lives under [../implementation-projects/templates/](../implementation-projects/templates/).
- The live project list lives in [../implementation-projects/index.md](../implementation-projects/index.md).

## Live Project Memory

- Use matching numbered prefixes such as `implementation-02-plan.md` and `implementation-02-tracker.md`.
- Add verification, decisions, seams, and evidence artifacts when the work needs continuity or stronger provenance.
- Preserve repo-specific execution history until it is deliberately archived.

## Approval Boundaries

- Pause for schema, API, auth, storage, deployment, destructive, or broad architecture changes.
- Docs-only harness alignment may proceed without extra approval unless it changes repo-wide workflow commitments or archive layout.

## Validation Posture

- Prefer the narrowest falsifiable check first.
- Use executable validation when code changes exist.
- For docs-only harness work, validate file presence, naming consistency, and internal link targets before doing anything broader.