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

## Edit and organize

- **Edit experience** opens the fields for the selected record: kind, title,
  organization, start date, end date. Saving calls `update-experience`,
  retains the experience ID, and preserves its attached evidence. Blank
  optional fields become SQL NULL. Dates accept `YYYY-MM-DD`; end date
  may also be `Present`. This is a **full field replacement**, not a
  partial patch. Discarding changes prompts if the values were modified.
- **Edit** on an evidence card replaces its description exactly through
  `update-evidence`; preserves that evidence ID and parent. Multiline
  descriptions and leading/trailing spaces are retained.
- **Move** chooses another existing experience and invokes the existing
  `move-evidence` operation; the evidence ID and description remain
  unchanged. The item disappears from the original experience when refreshed.
- **Delete** asks for explicit confirmation before calling
  `delete-evidence`. This permanently deletes **only the chosen evidence
  record**, not its parent. There is no recycle bin or silent fallback.
- Edit/move/delete buttons are disabled during a pending write. An
  acknowledged commit is reported separately from any subsequent list
  refresh failure; do not retry a committed operation merely because a
  refresh failed.

The read-only MCP tools and model-facing retrieval remain unchanged.

## Test

From the **repository root**:

```bash
python -m unittest discover -s tests -v
```

Smoke-test the native GUI in WSLg (after running the Python suite):

1. Open the app and verify all five existing experiences appear.
2. Select an experience and confirm its saved evidence is displayed.
3. Enter an item with whitespace, Unicode, and/or newlines and save it.
4. Confirm a new evidence ID appears and the description is unchanged.
5. Close the GUI; verify the same record using `cl get-experience --id exp_...`.
6. Verify that a blank item is rejected and no extra record is created.
7. Edit the experience title, organization, kind, and dates; confirm the
   original ID and attached evidence remain unchanged.
8. Edit a description containing Unicode, newlines, and leading/trailing spaces.
   Verify its ID and exact stored text using `cl get-evidence --id ev_...`.
9. Move an item to a second existing experience; verify its ID and description
   stay the same, and it appears under the new parent after switching.
10. Try deleting an item, cancel the confirmation, and verify it still exists.
    Confirm deletion for a disposable item; verify no other item was removed.
11. Attempt invalid field updates (blank title, malformed/reversed dates,
    blank evidence). Verify the UI surfaces errors without changing stored data.
12. Set `CAREER_LEDGER_DB` to a missing path and verify the app shows an error
    rather than creating another database.

This implementation was prepared without a native WSLg/Rust build in the authoring
environment; the integration smoke test is required before merge.

## Deliberately out of scope

Creating/deleting experience records; batch CSV ingestion; model access
from the GUI; standalone packaged Windows application; Tauri sidecar
packaging; schema migrations.
