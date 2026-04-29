# Agent Reference Type System

This file defines the claim types the repo uses in plans, reviews, and handoffs. The goal is not theory. The goal is to stop mixing facts, guesses, and decisions into one blurry paragraph.

## Claim Classes

| Term | Meaning | What makes it valid |
|---|---|---|
| Observed evidence | A fact directly seen in repo files, tests, commands, tool output, or explicit user instructions | Point to the artifact or state the exact observation |
| Inference | A conclusion drawn from observed evidence | State the local reasoning that connects it to the evidence |
| Assumption | A temporary working premise used to keep moving when the fact is not settled | State the uncertainty and what could falsify it |
| Unknown | A missing fact that could change scope, ownership, or solution shape | State why it matters |
| Decision | A choice that narrows the work | State the reason and the downstream consequence |
| Non-goal | Work explicitly excluded from the current slice | State the boundary clearly enough to stop scope creep |
| Approval gate | A class of change that requires explicit user approval before editing | Name the surface: schema, API, auth, storage, deployment, destructive flow, or broad architecture |
| Verification contract | The narrowest checks that would falsify the current plan or implementation | Prefer executable checks when they exist |

## Usage Rules

- Separate observed evidence from inference.
- State affected surfaces and blast radius before proposing edits.
- Record only the unknowns that could change the seam or approval path.
- Prefer one small falsifiable seam over one sprawling umbrella plan.
- Keep trackers factual: status, decisions, risks, questions, validations.

## Role Expectations

- Planner: produce intent, non-goals, evidence, unknowns, affected surfaces, ordered seams, approval gates, and verification contract.
- Implementer: make the smallest grounded edit that exercises the current seam and run the narrowest useful validation.
- Reviewer: prioritize bugs, regressions, missing tests, and contract drift over style commentary.