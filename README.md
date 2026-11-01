# Career Ledger — first database slice

Requires Python 3.10+; no external packages. The CLI uses `harness/career_schema.sql`.

```bash
python career_ledger.py --db career.db init
python career_ledger.py --db career.db add-experience --kind employment --title "Grounds crew" --organization "City" --end-date Present
# Copy the exp_... ID from the JSON output:
python career_ledger.py --db career.db add-evidence --experience-id exp_... --description "Cleared snow from walkways"
# Copy the ev_... ID from the JSON output:
python career_ledger.py --db career.db get-experience --id exp_...
python career_ledger.py --db career.db get-evidence --id ev_...
python career_ledger.py --db career.db move-evidence --id ev_... --experience-id exp_OTHER
```

Every command returns JSON on stdout; failures return nonzero with an error on stderr. `init` refuses to overwrite an existing file. Dates, if supplied, are `YYYY-MM-DD`; `--end-date Present` is also accepted for both `employment` and `project`. Experience kinds: `employment`, `project`.

```bash
python -m unittest discover -s tests -v
```

**Boundary:** User text is stored verbatim. Evidence has a stable ID and an editable foreign key to its parent record. No inference, GUI, or resume generation in this slice.

## Browse without JSON output

```bash
python career_ledger.py --db career.db list-experiences
python career_ledger.py --db career.db list-evidence
python career_ledger.py --db career.db list-evidence --limit 50
```

Listings are read-only text tables: 15 rows by default, with a count of total records. Long values and line breaks are shortened **for display only**; SQLite content is unchanged. Experience records show `Present` entries first. Existing `get-*` commands still return full JSON.

## MCP experiment: read-only experience catalogue

Python **3.11+** required for the optional MCP SDK v2 (the original CLI remains Python 3.10+).

```bash
python -m pip install -r requirements-mcp.txt
python -m unittest discover -s tests -p test_mcp.py -v
```

The MCP test runs a real **stdio client → MCP server → SQLite → structured result** roundtrip. It discovers `list_experiences(limit=20, offset=0)`, `list_evidence(experience_id, limit=20, offset=0)`, and `search_evidence(query, limit=20, offset=0)`. No model or API key is needed.

- **Input:** positive `limit` (max 20), nonnegative `offset`; `list_evidence` also requires an `experience_id`. The model-facing MCP input schemas explicitly advertise these bounds (`minimum`/`maximum`), and runtime validation remains in place.
- **Output:** structured JSON `{"items": [...], "total": 0, "has_more": false}`. Experience rows include ID, kind, title, organization, dates; evidence rows include ID, parent experience ID, and full description.
- **Boundaries:** source records remain in SQLite; no relevance ranking, resource registration, write tool, or resume builder.
- **Try in Inspector:** call `list_experiences`, copy an `exp_...` ID, call `list_evidence` with that ID, then change `offset` to see the next page. An unknown ID returns a tool error.
- **Transport:** local `stdio`. The MCP client starts `python career_mcp.py --db career.db`; don't start it manually unless you have a client to speak MCP.

### Literal evidence search

`search_evidence(query="Workday", limit=20, offset=0)` searches the **description**
of every evidence record across the library, independent of its parent
experience. Results include original evidence ID/text and parent experience
ID/title/organization/kind, plus `items`, `total`, and `has_more`.
Matching is **contiguous literal substring**, case-insensitive for ASCII
characters using SQLite's built-in `lower()`. Non-ASCII case is not folded.
`%` and `_` are literal characters, **not wildcards**; words are not stemmed,
and neither acronyms nor synonyms are automatically expanded. Results are
ordered by evidence ID, not semantic relevance. Empty results mean no literal
matches for that query, not that relevant evidence is absent.

The inference runner now gives the model the **unchanged canonical kernel and
its definitions** from `harness/project_spec.md`, followed by the versioned
model-facing `harness/inquiry_prompt_v1.md`. The same relational interpretation
applies to a direct question (such as expertise) and a job posting; the
experimental runner does not perform resume validation or assembly. Literal
substring search is only one discovery option. The model still decides which
tools and search terms to use; no new retrieval system or taxonomy was added.


## Opening the live database in a GUI

Keep **one authoritative** `career.db` file. The MCP server closes each
read connection after its query; it does not maintain a long-lived database
session. If Windows DB Browser fails to open a SQLite file under WSL's Linux
filesystem through a Windows WSL network path, that is a cross-filesystem access issue to
diagnose, not something to bypass by disabling SQLite locking.

For direct GUI access, prefer running Linux DB Browser inside WSL against
the original WSL path. Alternatively, if you want Windows DB Browser, place
the **original** database on the Windows filesystem and update every WSL
`--db` argument to the matching `/mnt/c/...` path. Close open database
connections before moving or editing it. Avoid simultaneous writes from
Windows and WSL. Do not create snapshot copies or use SQLite unsafe
locking bypasses. A persistent lock needs process/filesystem inspection;
this tool-schema change does not claim to repair it.

## Inference runner pilot: OpenAI API → MCP → SQLite

This optional runner demonstrates the **model-host boundary**, not resume building.
It launches the existing read-only MCP server as a subprocess, discovers its
tools, translates their schemas to OpenAI Responses functions, sends the model's
requests to MCP, and returns structured tool results to the model.

```bash
python -m pip install -r requirements-inference.txt
python -m unittest discover -s tests -p test_inference_runner.py -v
# Create a project-root .env file containing OPENAI_API_KEY=your-key
# (The .env file is ignored by Git; edit it locally, never commit it.)
python inference_runner.py --db career.db --model gpt-5.6-luna
```

Create `.env` next to `inference_runner.py` at the repository root. Its contents can be just:

```dotenv
OPENAI_API_KEY=your-actual-api-key
```

The inference runner reads this file automatically, even when invoked from a
different working directory. A nonempty `OPENAI_API_KEY` already exported in
the shell takes precedence. The file is already covered by the repository's
`.gitignore`; never commit or share actual keys. No additional Python
dependency or shell export is required.

Choose an API model available to your account; API usage is separately billed
from ChatGPT. You can change the question with `--question "Your question here"`.

**Inquiry experiment:** The model-facing specification supplies the canonical
`Explore → I_p → I_s` dependencies and requests a compact final account:
interpreted question, investigated evidence relationships, supported findings
with encountered IDs, material coverage limits, and a stopping judgment.
This is an **observable proposal**, not access to internal reasoning or a
deterministic semantic validator. Compare the original and new prompts on the
same database, question, model, and four-round tool budget. Save the existing
baseline trace before merging this PR, then rerun and compare: new relevant
evidence IDs, conceptual breadth, uninspected plausible areas, and whether
claims are proportionate to actual coverage. A polished account without
improved retrieval is **not** an inquiry-quality success. Multiple runs may
be needed to assess variability.

**Follow the handoff:** `MODEL → MCP` displays the requested tool and
arguments, `MCP → MODEL` displays the exact returned JSON, and `MODEL ANSWER`
shows the result. From the **first** response, the model chooses whether
to call a tool, which tool to request, and what arguments to provide.
There is no forced initial `list_experiences` call; the runner allows up to
four rounds of tool calls, then requires a final response. A model response
without any tool calls is permitted and does not establish that the database
was explored.

**Boundaries:** All MCP tools remain read-only; the API receives the question
and any records the model retrieves. No SQLite changes, semantic ranking,
source-ID validation, resume creation, automatic persistence, or versioned
selection prompt is connected yet. The runner uses `store=False` and
keeps the conversation only in process memory for this run. Tests use fake
model replies and don't spend API credits; the optional stdio integration
test needs the MCP dependency installed.

## WSLg Tauri evidence-entry pilot

The [desktop app](desktop/README.md) provides a first practical UI for
selecting an experience, browsing its evidence, adding one item at a time,
editing experience fields and evidence descriptions, moving evidence to another
experience, and deleting individual items with confirmation.
It launches inside WSLg and delegates all database operations to the existing
Python CLI, against a single explicitly configured `CAREER_LEDGER_DB` file.
The CLI's `list-experiences --json --limit N --offset N` mode supplies a
structured, paginated experience catalogue with stable IDs without changing
the default human-readable listing. No schema migration, CSV import, separate
database, or MCP write tool is introduced.

Follow [desktop/README.md](desktop/README.md) for Tauri 2 Linux prerequisites,
launch instructions, and the native smoke-test checklist.


## Importing legacy experiences and evidence

For a one-time move from the former Career Ledger database, use
[the interactive legacy importer](IMPORTING_LEGACY.md). It imports only
experience fields and verbatim atomic evidence text, offers explicit mapping
to existing experience IDs, previews duplicates, and applies a single transaction.
The source database is opened read-only; MCP tools remain read-only.
