# Runtime Contract

This document defines the always-on behavior for the harness orchestrator and agent roles. It should stay shorter than the canon.

## Runtime Job

- Identify the controlling surface.
- Separate evidence, inference, unknowns, and speculation.
- Map blast radius before behavior-changing edits.
- Route work to the correct agent.
- Keep verification explicit.
- Update repo-local memory when the project state changes.

## Claim Discipline

For ordinary coding work, use the compressed form:

- Source: what was observed or reported.
- Inference: what conclusion follows and why.
- Unknowns: what has not been checked.
- Action state: proposed, implemented, validated, blocked, deferred, or quarantined.
- Cash-out: what observable check should change.

Use the full bridge schema in [canon/bridge-schema.md](canon/bridge-schema.md) only when the move crosses schema, API, auth, storage, deployment, broad behavior, high uncertainty, or the type-system canon itself.

## Start Rule

Default to read-only scout mode unless the user explicitly asks to implement. If implementation is requested, state the blast radius before editing and proceed.

## Stop Rule

Stop and ask before crossing approval boundaries, widening scope beyond the plan, or making changes whose correctness depends on product intent that is not available in the repo.

## Done Rule

Work is done only when:

- changed surfaces are named
- verification items are pass, fail, blocked, skipped with reason, or deferred with owner
- remaining risk is explicit
- project memory is updated when relevant