# Archived Architectural Remediation Program

This folder is the archived record of the completed six-workstream architectural remediation program. It is retained as a traceable implementation artifact, not as a live plan.

## Archive Status

- Status: Closed and archived
- Closed on: 2026-04-22
- Validation state at closeout: `npm run verify` passing

## Original Purpose

- Turn the review findings into executable workstreams.
- Make blast radius, sequencing, and validation obligations explicit.
- Give us a stable place to track decisions, open questions, and completed slices.
- Keep the repo greenfield: no legacy compatibility layers unless we explicitly decide they are required.

## Program Goals

- Stop pretending the browser harness and Tauri runtime are equivalent when they are not.
- Remove the backend's global execution bottleneck.
- Restore static and behavioral quality gates as actual release blockers.
- Keep browser-harness behavior explicit and empty-first, not ambient fallback/demo behavior.
- Replace chatty batch UI behavior with real bulk operations.
- Tighten repo hygiene so known warnings and test slop do not accumulate.

## Workstream Map

| WS | Finding | Outcome | Effort | Depends On |
|---|---|---|---|---|
| WS1 | Runtime contract drift | Explicit runtime model and capability-aware service boundary | Large | None |
| WS2 | Global backend mutex | Per-command connection model with isolated long-running work | Large | WS1 decision helpful, not blocking |
| WS3 | Type safety not enforced in build | Hard typecheck/lint/test gates in local verify and CI | Medium | None |
| WS4 | Implicit seeded browser fallback | Explicit browser-harness story and empty-first runtime lifecycle | Medium | WS1 |
| WS5 | N-call bulk deletes | Transactional batch mutation APIs with preview counts | Medium | WS1 useful, not blocking |
| WS6 | Hygiene/test discipline drift | Zero known frontend lint failures, deterministic tests, reduced backend warning debt | Medium | WS1 and WS4 for contract-test shape |

## Recommended Execution Order

### Phase 0: Lock the runtime story

Start with WS1 and WS4 together. The biggest architectural error in the repo is not the single bug, it is the false claim that one shared frontend contract can hide two materially different runtimes.

Deliverables:

- Document browser mode as a frontend-only harness instead of a fallback runtime.
- Define the runtime/capability model.
- Remove implicit sample seeding.

### Phase 1: Fix the backend execution model

Run WS2 next. There is no point polishing frontend seams while the backend still serializes the whole app behind one shared SQLite connection.

Deliverables:

- Replace shared `Connection` state with a connection-opening abstraction.
- Keep initialization/path switching serialized, but not ordinary commands.
- Ensure long-running operations do not block unrelated reads and writes.

### Phase 2: Restore safety rails

Run WS3 after WS1/WS2 design decisions settle enough to avoid churn.

Deliverables:

- Build fails on TypeScript errors again.
- Local verification commands are explicit and fast enough to use.
- CI enforces the same checks.

### Phase 3: Fix mutation ergonomics

Run WS5 after the service boundary is clearer.

Deliverables:

- Batch delete preview and commit paths.
- Single request / single transaction semantics.
- Clear conflict strategy for missing ids or partial failures.

### Phase 4: Pay down hygiene debt

Run WS6 continuously, but treat it as the final hardening pass after the larger seams stop moving.

Deliverables:

- No known lint failures.
- Deterministic dialog tests.
- Hook effects with explicit dependencies or redesigned state flow.
- Service contract tests where overlapping runtimes remain.

## Critical Path

The only truly blocking design choice was this one:

- Are we keeping a browser-accessible demo runtime as a first-class product surface?

Settled answer in this repo:

- No. Browser `npm run dev` is treated as a frontend-only harness, not as an alternative application runtime.

That decision is now closed, so WS1 is complete and WS4 should only cover remaining harness/copy cleanup rather than reopen demo-mode design.

## Program Guardrails

- No compatibility code for old state shapes unless a real support obligation is documented.
- No hidden runtime fallbacks for unsupported capabilities.
- No broad refactors without a stated blast radius and validation path.
- Prefer one small coherent slice at a time over one giant branch.
- Every workstream should end with executable validation, not just diff review.

## Suggested PR Slices

1. Runtime decision + capability model docs + app bootstrap scaffold.
2. Browser-harness copy/docs cleanup.
3. Backend connection abstraction and command migration.
4. Typecheck/verify/CI gates.
5. Batch delete preview + commit APIs.
6. Frontend/Rust hygiene cleanup and contract tests.

## Definition Of Program Done

This remediation program is done when all of the following are true:

- The app has an explicit runtime story and the UI cannot accidentally call unsupported features.
- Browser-harness behavior is intentional, documented, and not auto-seeded by surprise.
- Backend commands do not serialize behind one long-held mutexed SQLite connection.
- Release and CI both fail on type or lint regressions.
- Bulk deletes use transactional batch APIs.
- The current lint/test warning debt called out in the review is gone.

## Files In This Folder

- `00-closeout-summary.md`: concise closeout record and validation snapshot.
- `README.md`: program-level map and sequencing.
- `tracker.md`: live execution tracker, risks, decisions, open questions.
- `01-runtime-contract-unification.md`: WS1.
- `02-backend-concurrency-and-command-isolation.md`: WS2.
- `03-build-typecheck-and-quality-gates.md`: WS3.
- `04-runtime-modes-and-seed-strategy.md`: WS4.
- `05-bulk-mutations-and-batch-operations.md`: WS5.
- `06-repo-hygiene-and-test-discipline.md`: WS6.

The tracker and workstream files are preserved in place for auditability, but the program itself is complete.