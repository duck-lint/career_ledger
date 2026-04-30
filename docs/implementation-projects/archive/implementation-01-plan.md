# Implementation 01 Plan: Repo-Local Harness Bootstrap

## Intent

- Add the smallest stable doc scaffold for repo-local harness use.
- Give future work a predictable live home for numbered plans and factual trackers.
- Add a shared claim vocabulary so plans, reviews, and handoffs separate evidence, inference, unknowns, and approval boundaries consistently.

## Non-Goals

- No schema, API, storage, runtime, or UI changes.
- No CI, git hook, editor, or extension configuration.
- No archive reorganization beyond referencing the existing archive surface.

## Observed Evidence

- [docs/implementation-projects/archive/2026-04-architectural-remediation-complete/README.md](2026-04-architectural-remediation-complete/README.md) uses a program README plus a tracker and numbered workstream docs.
- [docs/implementation-projects/archive/2026-04-architectural-remediation-complete/tracker.md](2026-04-architectural-remediation-complete/tracker.md) keeps decisions, risks, open questions, and completion facts in one factual tracker.
- [docs/implementation-projects/archive/2026-04-product-improvement-complete/README.md](2026-04-product-improvement-complete/README.md) repeats the same structure for a second completed program.
- [README.md](../../README.md) currently shows `docs/taxonomy-quickstart.md` and `docs/implementation-projects/archive/` in the repo tree, but not a live harness or implementation-project surface.

## Assumptions And Unknowns

- Assumption: the bootstrap should stay docs-only and internal-facing.
- Assumption: `implementation-01` can represent the harness bootstrap itself so the repo gets an immediate exemplar pair.
- Unknown: whether the root README should later carry a contributor-facing pointer to the live harness surface.
- Unknown: whether the repo-root placement of [agent-reference-type-system.md](../../agent-reference-type-system.md) remains preferable once the harness surface stabilizes.

## Affected Surfaces And Blast Radius

- New docs surface: [docs/harness/README.md](../harness/README.md).
- New live-plan surface: [docs/implementation-projects/README.md](README.md) plus the `implementation-01` pair.
- New repo-root reference doc: [agent-reference-type-system.md](../../agent-reference-type-system.md).
- No product source, tests, schemas, config, or runtime files change.
- The root README stays unchanged in this slice.

## Ordered Seams

1. Add the stable harness contract in [docs/harness/README.md](../harness/README.md).
2. Add the live-plan directory contract in [docs/implementation-projects/README.md](README.md).
3. Add the shared claim vocabulary in [agent-reference-type-system.md](../../agent-reference-type-system.md).
4. Seed the live surface with [implementation-01-plan.md](implementation-01-plan.md) and [implementation-01-tracker.md](implementation-01-tracker.md).

## Approval Gates

- None for this docs-only bootstrap.
- Pause if the work expands into root README changes, CI, editor settings, or repo-wide policy enforcement.
- Pause if a future edit wants these docs to prescribe product/runtime behavior rather than planning and handoff discipline.

## Verification Contract Summary

- Confirm the new files exist at the expected paths.
- Confirm the numbered pair naming matches the repo preference.
- Confirm internal links point only to existing files.
- Confirm the root README remains untouched in this slice.

## Handoff Packet For The Next Role

- Scope is docs-only.
- Preserve the archive docs as reference, not live state.
- Do not touch `src/`, `src-tauri/`, `package.json`, or CI/config surfaces.
- If a later request widens into workflow enforcement or root discoverability, get explicit approval first.