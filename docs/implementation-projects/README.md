# Live Implementation Projects

This directory holds active repo-local working memory for multi-step or repo-scoped work. The active project list lives in [index.md](index.md), and reusable scaffold lives under [templates/](templates/).

## Current Layout

- [index.md](index.md): repo-local active-project index.
- `implementation-02-*`: current live plan, tracker, and UAT artifact set.
- `templates/`: reusable scaffold mirrored from the canonical harness seed.

## Naming Rules

- Use matching numbered prefixes such as `implementation-02-plan.md` and `implementation-02-tracker.md`.
- Add `implementation-XX-verification-contract.md`, `implementation-XX-decisions.md`, `implementation-XX-seams/`, and `implementation-XX-evidence/` when the work needs stronger continuity or provenance.
- Keep the shared number aligned across all files for a project.

## Lifecycle

- Start from [index.md](index.md) and open or update the numbered plan/tracker pair.
- Keep the tracker factual; do not turn it into a second plan.
- Archive completed efforts under [../archive/README.md](../archive/README.md) once they stop being useful as live execution memory.

## Archived Baseline

- The harness bootstrap pair lives at [../archive/implementation-01-plan.md](../archive/implementation-01-plan.md) and [../archive/implementation-01-tracker.md](../archive/implementation-01-tracker.md).
- Larger completed programs remain listed in [../archive/README.md](../archive/README.md).

## Next Number

- Unless there is an explicit renumbering decision, the next distinct live effort should start at `implementation-03-*`.