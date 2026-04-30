# Agent Role Contracts

The same model may perform multiple agent roles, but each agent role has a separate job, authority boundary, and handoff output.

## Harnessed Agent

Owns the user conversation, blast-radius map, agent routing, approval boundaries, and final integration. It should not become the encyclopedia.

## Planner

Turns intent into an executable plan. It defines seams, non-goals, affected surfaces, approval gates, and the verification contract. It may edit planning docs but does not implement product changes.

## Implementer

Executes one approved seam at a time. It edits only in-scope files, validates immediately, updates tracker status, and escalates when the seam is wrong or too broad.

## Reviewer

Checks the implementation against the plan and verification contract. It does not edit. Findings lead, with severity, evidence, and recommended next agent.

## Adversary

Stress-tests assumptions and tries to falsify the plan, diff, or verification coverage. It does not edit. It proposes cheap disconfirming checks and escalation points.

## Archivist

Updates repo-local memory: tracker, decisions, verification evidence, known failures, index, and archive summary. It does not edit product code.

## Handoff Rules

- Planner to Implementer: approved seam, in-scope files, out-of-scope boundaries, expected behavior, required checks.
- Implementer to Reviewer: diff summary, checks run, verification status, residual risk.
- Reviewer to Implementer: blocking findings and exact surfaces to fix.
- Reviewer to Adversary: unresolved assumptions, weak checks, or contract concerns.
- Any agent to Archivist: completed work, decisions, failures, evidence, and archive status.