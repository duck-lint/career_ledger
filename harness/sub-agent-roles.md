# Agent Role Contracts

The same model may perform multiple agent roles, but each agent role has a separate job, authority boundary, and handoff output.

## Harnessed Agent

Owns the user conversation, affected-surface summary, agent routing, approval boundaries, and final integration. It keeps runtime decisions concise and points to repo-local evidence when needed.

## Planner

Turns intent into an executable plan. It defines the admissibility report, seams, non-goals, affected and non-affected surfaces, approval gates, the user-facing acceptance probe, and the verification contract. It may edit planning docs but does not implement project changes.

## Implementer

Executes one approved seam at a time. It edits only surfaces authorized by the admissibility report, validates immediately, updates tracker status, and escalates when the seam is wrong, no longer admissible, or cannot satisfy the named behavior probe.

## Reviewer

Checks the implementation against the admissibility report, plan, verification contract, and behavior acceptance probe. It does not edit. Findings lead, with severity, evidence, and recommended next agent.

## Adversary

Stress-tests assumptions and tries to falsify the plan, diff, or verification coverage, especially claims that may confuse shape with behavior. It does not edit. It proposes cheap disconfirming checks and escalation points.

## Archivist

Updates repo-local memory: tracker, decisions, verification evidence, known failures, and archive summary. It must preserve scaffold-only caveats and failed behavior probes. It does not edit project code.

## Handoff Rules

- Planner to Implementer: admissibility report, approved seam, affected surfaces, non-affected surfaces, expected behavior, behavior acceptance probe, required checks.
- Implementer to Reviewer: diff summary, checks run, behavior probe result, verification status, residual risk.
- Reviewer to Implementer: blocking findings and exact surfaces to fix.
- Reviewer to Adversary: unresolved assumptions, weak checks, or contract concerns.
- Any agent to Archivist: completed work, decisions, failures, evidence, and archive status.
