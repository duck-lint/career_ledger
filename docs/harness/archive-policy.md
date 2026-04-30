# Archive Policy

Archive completed implementation work so future agents can resume from repo-local memory instead of chat history.

## Archive When

- the verification contract is complete, blocked with explicit owner, or deferred with owner
- decisions are recorded
- known failures are updated or ruled out
- remaining risks are explicit

## Archive Summary Must Include

- project prefix
- goal and final status
- files or surfaces changed
- verification evidence
- decisions made
- known failures added or updated
- unresolved risks and revisit triggers

## Do Not Archive

- raw chat transcript
- speculative plans that were never acted on
- stale tasks without status
- implementation details that are already obvious from the diff unless they explain a future risk

## Archive Location

Use [../archive/README.md](../archive/README.md) as the repo-local archive entrypoint for completed summaries and preserved historical program docs. Keep active numbered project files at the root of [../implementation-projects/](../implementation-projects/README.md) so agents can find them quickly.

If this repo later moves archive material under `docs/implementation-projects/archive/`, make that a deliberate repo-wide documentation change rather than an ad hoc per-project move.