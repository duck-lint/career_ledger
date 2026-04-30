# WS3: Taxonomy Quality Diagnostics

## Status

Complete.

First frontend diagnostics slice landed on 2026-04-24.
Follow-up diagnostics, repair actions, and readiness integration landed on 2026-04-24.

## Finding Addressed

The app lets users create tags, markers, categories, and re-infer library tags, but it does not yet provide a global quality picture of taxonomy coverage or inference health.

## Goal

Add diagnostics that help users tune taxonomy and evidence quality intentionally.

## Recommended End State

- Users can see which tags have no evidence.
- Users can see which evidence items have zero or weak inferred tags.
- Users can see which markers have no observed hits.
- Candidate profile signal-tag drift is visible and actionable.
- Posting terms not covered by taxonomy feed a repair loop rather than staying local to one analysis result.

## Non-Goals

- Do not turn diagnostics into an automated taxonomy rewrite engine.
- Do not silently adopt suggested tags.
- Do not make broad matching looser just to improve coverage metrics.

## Impacted Surfaces

- Taxonomy backend query layer
- `src/components/views/TaxonomyView.tsx`
- Possible new diagnostics view/card shared with readiness
- Candidate profile tag validation surfaces
- Resume posting analysis suggested-term flow
- Frontend and backend tests for aggregate counts

## Implementation Slices

### Slice 1: Define diagnostic inventory

- Decide which diagnostics are blockers, warnings, or informational.
- Define exact counts and thresholds.
- Decide which diagnostics belong in readiness versus taxonomy detail.

Status:

- Initial diagnostics inventory landed for taxonomy detail.
- Current checks cover tags with no evidence, tags with no markers, tags missing delivery toolkit metadata, evidence with no tags, unknown evidence tags, unknown record context tags, and unknown candidate-profile signal tags.
- Follow-up checks add markers with no observed library hits and saved-posting taxonomy coverage.

### Slice 2: Add backend/frontend diagnostic data

- Prefer aggregate queries over client-side scans when data volume could grow.
- Keep output small enough for a dashboard card.
- Preserve drill-through ids for repair flows.

Status:

- Landed as a frontend aggregate over existing taxonomy and library services.
- No backend contract change was needed for the first slice.
- A backend aggregate may still be useful later if larger library performance requires it.

### Slice 3: Add taxonomy diagnostics UI

- Add summary cards.
- Add drill-through lists for tags/evidence/markers.
- Link to marker editor or evidence item where practical.

Status:

- Landed as a Taxonomy Diagnostics panel in the Taxonomy view.
- The panel provides counts, preview lists, and first-step repair actions into the tag and marker editor tabs.

### Slice 4: Connect posting suggested terms

- Preserve or surface repeated unrecognized terms after analysis.
- Make adoption flow explicit: create tag, adopt marker, then re-infer.

Status:

- Saved-posting coverage now shows which canonical tags match the stored posting text by tag name or marker.
- The Taxonomy view does not auto-run requirement analysis to harvest unrecognized terms; that would hide a pipeline operation behind diagnostics.
- Suggested-term review stays with WS4, where requirement analysis is already the explicit controlling surface.

### Slice 5: Add tests

- Tags with zero evidence.
- Evidence with no inferred tags.
- Candidate profile signal tags unknown to taxonomy.
- Marker hit/no-hit cases.

Status:

- Pure diagnostics tests cover coverage and orphaned tag computation.
- Panel tests cover rendered diagnostics, refresh behavior, clean state, and repair action hooks.
- Readiness tests cover taxonomy diagnostics warning integration.

## Validation Plan

- Backend tests for diagnostic aggregation if backend queries are added.
- Frontend tests for diagnostic rendering and empty states.
- `npm run verify` if backend and frontend surfaces both move.

## Validation Completed

- `npm test -- taxonomy-diagnostics.test.ts TaxonomyDiagnosticsPanel.test.tsx` passed.
- `npm test -- taxonomy-diagnostics.test.ts TaxonomyDiagnosticsPanel.test.tsx ReadinessDashboard.test.tsx` passed.
- `npm run verify:frontend` passed: lint, typecheck, and all frontend tests green.

## Risks

- Diagnostics become judgmental or noisy for valid early-stage libraries.
- Marker hit counting becomes expensive if implemented naively.
- Users optimize metrics instead of evidence quality.

## Exit Criteria

- Taxonomy quality can be inspected globally.
- Diagnostics provide repair paths, not just counts.
- Readiness can consume at least the high-level diagnostic state.

Current status:

- Global inspection exists for tag coverage, marker coverage, marker hit health, orphaned tags, profile drift, and saved-posting taxonomy coverage.
- Repair paths exist for canonical tag review and marker editing/testing. Library evidence repair remains through the Library surface rather than a Taxonomy-owned editor.
- Readiness consumes the high-level open diagnostic count as a warning.