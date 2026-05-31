# Archive Policy

Archive completed implementation work so later sessions can resume from repo-local memory instead of chat history.

## Archive When

- the verification contract is complete, blocked with explicit owner, or deferred with owner
- every `live-wired` behavior claim has a passing named user-facing acceptance probe, not only structure or fixture evidence
- decisions are recorded
- known failures are updated or ruled out
- remaining risks are explicit
- the same turn also updates `harness/open-decisions.md` and any paused or deferred pointers that still target the completed bundle

## Archive Summary Must Include

- project prefix
- goal and final status
- files or surfaces changed
- verification evidence
- user-facing acceptance result, including failed or missing behavior probes and their owner or user-provided next end goal
- decisions made
- known failures added or updated
- unresolved risks and revisit triggers
- next end goal only if the user has already provided it

## Do Not Archive

- raw chat transcript
- speculative plans that were never acted on
- speculative successor implementations, roadmap bundles, or future layer designs
- stale tasks without status
- implementation details that are already obvious from the diff unless they explain a future risk
- scaffold-only work described as completed user-facing behavior
- live-wired claims whose only evidence is fields, DTOs, files, paths, routes, crates, configs, nominal callers, mocks, fixtures, dry runs, or unit tests
- completed bundles left in `active/` as a "retained foundation" exception
- open decisions or paused bundles that still point at a completed bundle's former active path

## State Folders

Use explicit state folders under `harness/implementation-projects/` as the canonical location for numbered implementation bundles:

- `active/` for the single implementation bundle currently in live execution
- `archive/` for completed implementation bundles

The root `harness/implementation-projects/` directory is not a canonical home for numbered implementation plan, tracker, verification, decisions, seam, evidence, or summary files. Keep only `templates/` and the state folders there.

## Archive Location

Use `harness/implementation-projects/archive/` as the canonical home for completed implementation-project bundles.

Keep the one live numbered project bundle under `active/` until work is complete. Do not create paused bundles as future roadmap placeholders. When an implementation is complete, move its working-memory bundle into `archive/`:

- `implementation-XX-plan.md`
- `implementation-XX-tracker.md`
- `implementation-XX-decisions.md`, when one exists
- `implementation-XX-verification.md`, when one exists
- matching `implementation-XX-seams/` or `implementation-XX-evidence/` directories, when they exist
- `implementation-XX-summary.md`

The state folders are the implementation state authority. Do not maintain a separate implementation index or project table.

`harness/open-decisions.md` remains the decision authority. Its summary table should link to the decision section itself or another still-authoritative surface, not to a stale active tracker from a completed implementation.

Do not call an implementation archived if its completed plan, tracker, verification record, and summary are only present outside `harness/implementation-projects/archive/`. A completed implementation is archived only when its completed project bundle lives under `harness/implementation-projects/archive/`.

Do not call an implementation active if its numbered bundle lives at the root. A non-archived implementation is canonical only when its numbered bundle lives under `harness/implementation-projects/active/`.

## Same-Turn Closeout

When work changes an implementation state from active to complete, do the archive move and pointer cleanup in the same turn:

- move the numbered bundle from `active/` to `archive/`
- add or update the archive summary
- repoint `harness/open-decisions.md` and any paused or deferred bundles that still target the old active paths
- if any of this cannot be completed, mark the closeout blocked with owner instead of leaving the repo in a mixed state
