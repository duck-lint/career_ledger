# WS5: Bulk Mutations And Batch Operations

## Status

Complete

## Finding Addressed

The UI currently performs bulk deletes as a loop of one-item calls. That is slow, noisy, and operationally weak once the dataset grows.

## Goal

Replace N single-item delete calls with explicit batch preview and batch commit APIs that are transactional, predictable, and safe.

## Recommended End State

- Records and evidence have batch preview endpoints.
- Records and evidence have batch delete endpoints.
- The UI performs one preview call and one commit call.
- Conflict strategy is explicit.
- Destructive actions have a dry-run/preview phase by design.

## Landed Result

- `LibraryService` now exposes explicit batch delete preview and commit methods for records and evidence items.
- The browser harness and Tauri runtime both implement strict batch delete semantics, with record deletion cascading to linked evidence in both runtimes.
- The Tauri backend now exposes preview and transactional batch delete commands for records and evidence items.
- The records and evidence views now perform one preview call and one commit call for bulk delete instead of looping single-item deletions client-side.
- Bulk delete dialogs surface preview counts and disable destructive confirmation when strict preview detects missing ids.

## Non-Goals

- Do not implement silent best-effort partial deletes.
- Do not keep looping client-side just because it is already working.
- Do not add generic mutation batching for every entity before the delete path is proven.

## Recommended API Shape

Suggested commands:

- `preview_delete_records(ids)`
- `delete_records(ids, options)`
- `preview_delete_evidence(ids)`
- `delete_evidence(ids, options)`

Suggested options:

- `strict: boolean` default `true`
- `dry_run: boolean` for backend reuse if preview and commit share internals

Suggested response data:

- requested id count
- found id count
- missing ids
- cascade counts where relevant
- entity summaries needed for confirmation UI

Recommended conflict strategy:

- Strict all-or-nothing by default.
- If any requested id is missing, return an explicit error or conflict payload.

That is the cleanest greenfield behavior and avoids quiet partial state changes.

Chosen implementation:

- Strict all-or-nothing by default.
- Preview returns missing ids explicitly.
- Commit throws an explicit strict-conflict error if any requested ids are missing at commit time.

## Impacted Surfaces

- frontend record bulk delete flow
- frontend evidence bulk delete flow
- service interfaces
- Tauri command registration
- backend command implementations and tests
- demo runtime parity if batch delete remains supported there

## Implementation Slices

### Slice 1: Define backend preview responses

- Add record and evidence preview data models.
- Include cascade counts for record deletion.

### Slice 2: Add backend batch delete commands

- Implement strict transactional deletes.
- Use one transaction per batch operation.

### Slice 3: Add service-layer methods

- Update the runtime services to expose preview and batch delete methods.
- Remove the need for client-side loops.

### Slice 4: Update UI confirmation flows

- Show preview counts in confirmation UI.
- Perform one commit action after confirmation.

### Slice 5: Add tests

- Validate strict missing-id behavior.
- Validate cascade preview counts.
- Validate successful transactional delete behavior.

## Validation Plan

- Unit tests for preview and commit semantics.
- UI tests for batch delete confirmation copy.
- Manual smoke test with larger selections to verify only one preview and one commit path execute.

## Validation Completed

- Browser-harness adapter tests now cover strict missing-id behavior, preview shapes, cascade counts, and successful batch delete commits.
- Tauri adapter tests now cover the new preview and commit command mappings.
- Rust backend tests now cover record preview cascade counts, strict missing-id conflicts, transactional record deletion with cascade semantics, and evidence batch preview/delete behavior.
- Frontend view tests now exercise the record and evidence bulk delete preview/commit flows.
- `npm run verify` passes after the WS5 implementation.

## Risks

- Designing preview payloads too narrowly and needing a second round trip later.
- Letting the UI and backend disagree about strictness rules.
- Forgetting to update the demo/runtime service path after API changes.

## Exit Criteria

- Bulk delete no longer loops over single-item service calls.
- Preview counts are surfaced before destructive commit.
- Batch deletes are transactional and explicit about conflicts.
- Tests cover missing ids, cascade counts, and successful commit paths.

All exit criteria met.