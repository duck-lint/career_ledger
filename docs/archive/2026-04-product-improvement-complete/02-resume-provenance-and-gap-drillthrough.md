# WS2: Resume Provenance And Gap Drill-Through

## Status

Complete.

First source-evidence drill-through slice landed on 2026-04-24.
Gap report and assembly audit panels landed on 2026-04-24.

## Finding Addressed

The resume pipeline already produces provenance, selected evidence ids, constraint flags, notes, and a gap report. The preview shows the assembled resume, but the evidence trail is mostly hidden behind pipeline summaries and raw JSON.

## Goal

Make the resume preview auditable without forcing users to inspect JSON.

## Recommended End State

- Resume preview bullets can be expanded to show source evidence.
- Gap report is a first-class panel with supported, partial, and unsupported requirements.
- Constraint flags and assembly notes are visible in human-readable form.
- Users can understand why sparse output happened: weak evidence, missing taxonomy, unsupported requirements, or policy limits.

## Non-Goals

- Do not introduce freeform LLM paraphrasing to make output look better.
- Do not remove raw JSON inspection; keep it as an advanced audit surface.
- Do not build full resume editing in this workstream.

## Impacted Surfaces

- `src/components/views/ResumeGenerationView.tsx`
- `src/lib/types.ts`
- Possibly library lookup service if preview drill-through needs full evidence/record details
- Backend assembler only if provenance payload is insufficient
- Frontend tests for rendered gap/provenance states

## Implementation Slices

### Slice 1: Inventory existing provenance payload

- Confirm whether `claim_to_evidence_map` is enough to map preview text to evidence.
- Confirm whether selected evidence details are already present in the pipeline result through the export payload.
- Identify any missing source fields before changing backend contracts.

Status:

- Landed without backend contract changes.
- Rendered resume claims already carry `evidence_ids`.
- The pipeline result already includes exported record/evidence details through `career_library_export` and `preflight_result.career_library_export`.

### Slice 2: Add source drill-through

- Add expandable source panels for highlights, profile, experience bullets, and project bullets.
- Show claim text, record title/org, evidence tags, and evidence note where available.

Status:

- Landed for profile, highlights, professional experience bullets, and project bullets.
- Source panels show record title, organization, slug, evidence claim, date range, tags, and evidence note.
- Missing evidence ids are surfaced explicitly instead of failing silently.

### Slice 3: Render gap report

- Split supported, partially supported, and unsupported requirements.
- Show supporting source ids and limitations/reasons.
- Highlight unsupported must-have requirements when available.

Status:

- Landed in the Resume preview as a first-class Gap Report panel.
- Supported, partial, and unsupported requirements are separated.
- Risk flags and compensation strategy are visible without opening JSON.

### Slice 4: Render constraint flags and notes

- Show passed/warning/failed flags.
- Show assembly notes in plain language.

Status:

- Landed in the Resume preview as an Assembly Audit panel.
- Constraint flags render rule, status, and note.
- Assembly notes render as plain text audit items.

### Slice 5: Add tests

- Preview with mapped evidence.
- Preview with unsupported requirements.
- Preview with warnings/constraint flags.
- Preview-only run without written artifacts.

Status:

- Focused `ResumeEvidenceSources` tests cover mapped evidence, missing source ids, and empty source-id claims.
- Focused `ResumeAuditPanels` tests cover gap buckets, risk flags, compensation strategy, constraint flags, notes, and empty states.

## Validation Plan

- Focused React tests for provenance/gap rendering.
- `npm run verify:frontend`.
- Manual pipeline run in Tauri to verify the drill-through matches generated output.

## Validation Completed

- `npm test -- ResumeEvidenceSources.test.tsx` passed.
- `npm test -- ResumeAuditPanels.test.tsx` passed.
- `npm run verify:frontend` passed: lint, typecheck, and all frontend tests green.

## Risks

- Accidentally coupling UI rendering to unstable claim text paths.
- Overwhelming users with too much audit detail at once.
- Discovering backend provenance is almost enough but not quite enough, forcing a contract change.

## Exit Criteria

- Every rendered resume claim with source ids can expose its supporting evidence.
- Gap report is visible without opening JSON.
- Constraint flags and notes are visible enough to explain conservative output.

Current status:

- All exit criteria are met for the current frontend audit scope.
- No backend contract change was needed.