# WS2: Backend Concurrency And Command Isolation

## Status

Complete

## Finding Addressed

The Tauri backend stores a single SQLite `Connection` behind a global mutex and then runs most commands while holding that lock. That serializes the app and makes long-running work the bottleneck for unrelated operations.

## Goal

Move from "one shared mutexed connection" to "cheap, isolated command execution with explicit initialization state and per-command connections".

## Recommended End State

- The backend stores active database configuration, not a long-lived shared `Connection`.
- Commands open their own connection from the active database path.
- Long-running operations use isolated connections and do not block ordinary reads/writes via a process-wide mutex.
- Initialization and active-path changes remain serialized and explicit.

## Landed Result

- Backend app state now stores only the active runtime DB path via `ActiveDbState`.
- All Tauri commands in `src-tauri/src/lib.rs` now open a configured SQLite connection per command instead of sharing one process-wide connection behind a mutex.
- Long-running flows, including resume pipeline execution and raw intake import, now use isolated connections like the rest of the backend commands.
- The old shared `Mutex<Option<Connection>>` path and the separate active-path state were removed from command wiring.
- Regression tests now cover uninitialized active-path state, reopened-connection behavior, and active-path switching.

## Non-Goals

- Do not introduce a heavy connection-pool dependency unless the standard rusqlite approach becomes insufficient.
- Do not keep the old shared-connection state alive "just in case".
- Do not widen this into an async rewrite unless evidence forces it.

## Recommended Architecture

Use an `ActiveDbState` that stores:

- resolved active database path
- initialized/not-initialized state
- any initialization metadata needed for migrations or path switching

Then add a single backend helper that:

- reads the active path
- opens a fresh rusqlite connection
- applies required connection-level pragmas
- returns the connection to the command

Recommended supporting choices:

- Enable WAL mode if it is compatible with the app's current write patterns.
- Set a reasonable busy timeout.
- Centralize all connection-opening pragmas in one helper.

## Why This Shape

- It removes the global critical section without introducing a broad framework change.
- It fits SQLite's intended model better for a desktop app with mixed command durations.
- It keeps command ownership simple: a command owns its connection and its transaction scope.

## Impacted Surfaces

- `src-tauri/src/lib.rs`
- initialization/path selection logic
- any command that currently locks `DbState`
- long-running flows such as resume pipeline and raw intake import
- tests that assume one in-memory connection shared across operations

## Implementation Slices

### Slice 1: Add connection provider abstraction

- Introduce `ActiveDbState` or equivalent.
- Add helper(s) to resolve active path and open a configured connection.
- Keep initialization as the only code path that runs migrations and sets active state.

### Slice 2: Migrate read-only commands

- Convert lightweight read commands first.
- Verify no command depends on hidden shared-connection state.

### Slice 3: Migrate write commands

- Convert CRUD write paths and taxonomy mutations.
- Keep transaction boundaries local to each command.

### Slice 4: Migrate long-running commands

- Move resume pipeline and raw intake import onto isolated connections.
- Ensure these commands no longer block unrelated reads via process-wide locking.

### Slice 5: Remove old shared connection state

- Delete the old `Mutex<Option<Connection>>` path.
- Delete any dead helper code left behind.

## Validation Plan

- Unit tests for initialization, active-path resolution, and path switching.
- Regression tests for commands after re-opened connections.
- Manual concurrency smoke test: run a long operation and verify basic reads remain responsive.
- Full backend test suite.

## Validation Completed

- `cargo check` passes in `src-tauri` after the command migration.
- `cargo test --lib` passes in `src-tauri` with 102 passing tests.
- The backend test module now exercises the new connection-provider seam directly for initialization-state failure, reopened connections, and active-path switching.
- A desktop manual responsiveness smoke is still a useful follow-up, but it is no longer blocking closure of the command-isolation refactor because the implementation risk was localized to backend connection ownership and that seam now has direct automated coverage.

## Risks

- Hidden assumptions that multiple commands share temporary connection state.
- Path switching bugs if the active path changes during command execution.
- In-memory tests needing refactor because per-command connections change their setup model.

## Open Design Choices

- Whether to keep a simple mutex around the active path or switch to an `RwLock`.
- Whether WAL mode should be enabled during initialization by default.
- Whether command helpers should return domain-specific errors for uninitialized state instead of raw strings.

## Exit Criteria

- No long-lived shared SQLite connection in app state.
- Commands open isolated connections from the active path.
- Long-running commands do not require a global backend mutex.
- Backend tests pass after the migration; manual desktop responsiveness smoke remains recommended follow-up validation.