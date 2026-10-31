# Career Ledger — WSLg evidence-entry pilot

This is a **Linux Tauri 2 development app run inside WSLg**, not a Windows
installer. It invokes the existing Python CLI as a child process for each
operation. There is no second database, embedded SQL writer, service,
sidecar bundle, or MCP write operation.

## Prerequisites

- Ubuntu WSL2 with WSLg GUI support; test a Linux GUI application first.
- Rust toolchain (`cargo --version`), Node/npm (`node --version`),
  and `python3` available **inside the same WSL distro**.
- Tauri 2 Linux dependencies. On Ubuntu, per the [Tauri prerequisite guide](https://v2.tauri.app/start/prerequisites/):

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Database: single authoritative file

Set `CAREER_LEDGER_DB` to the absolute path of your **existing** SQLite
database. The GUI refuses to run database operations if the path is not an
absolute path to an existing file. It never runs `init`.

Prefer an actual WSL filesystem path for this WSLg pilot, such as
`/home/duck-lint/projects/career_ledger/career.db`.
If your original database is still on Windows, close DB Browser and any
other SQLite clients before moving it. **Move**, do not copy or snapshot;
first ensure the WSL destination does not already exist. Update the `cldb`
variable used by your Bash `cl` function to the final path.

From the repository root:

```bash
# Check the intended single database path before launching:
test -f "$cldb" && printf 'Database: %s\n' "$cldb"
cd desktop
npm install
CAREER_LEDGER_DB="$cldb" npm run tauri dev
```

`$cldb` must contain the unescaped path with spaces represented literally;
quoting `"$cldb"` protects it during argument expansion. You can also set
`CAREER_LEDGER_DB=/absolute/path/to/career.db` directly.

The frontend loads all experiences via paginated
`list-experiences --json`, chooses an experience, reads its existing
evidence via `get-experience`, and saves via `add-evidence`.
The input stays associated with the selected parent until you switch.
`Ctrl+Enter` or `Cmd+Enter` submits the current evidence description.

## Test

From the **repository root**:

```bash
python -m unittest discover -s tests -v
```

Smoke-test the native GUI in WSLg:

1. Open the app and verify all five existing experiences appear.
2. Select an experience and confirm its saved evidence is displayed.
3. Enter an item with whitespace, Unicode, and/or newlines and save it.
4. Confirm a new evidence ID appears and the description is unchanged.
5. Close the GUI; verify the same record using `cl get-experience --id exp_...`.
6. Verify that a blank item is rejected and no extra record is created.
7. Set `CAREER_LEDGER_DB` to a missing path and verify the app shows an error
   rather than creating another database.

This PR was prepared without a native WSLg/Rust build in the authoring
environment; the integration smoke test is required before merge.

## Deliberately out of scope

Creating/editing experience records; editing/moving/deleting evidence;
batch CSV ingestion; model access from the GUI; standalone packaged
Windows application; Tauri sidecar packaging; schema migrations.
