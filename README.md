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

The MCP test runs a real **stdio client → MCP server → SQLite → structured result** roundtrip. It discovers `list_experiences(limit=20, offset=0)` and `list_evidence(experience_id, limit=20, offset=0)`. No model or API key is needed.

- **Input:** positive `limit` (max 20), nonnegative `offset`; `list_evidence` also requires an `experience_id`.
- **Output:** structured JSON `{"items": [...], "total": 0, "has_more": false}`. Experience rows include ID, kind, title, organization, dates; evidence rows include ID, parent experience ID, and full description.
- **Boundaries:** source records remain in SQLite; no relevance ranking, resource registration, write tool, or resume builder.
- **Try in Inspector:** call `list_experiences`, copy an `exp_...` ID, call `list_evidence` with that ID, then change `offset` to see the next page. An unknown ID returns a tool error.
- **Transport:** local `stdio`. The MCP client starts `python career_mcp.py --db career.db`; don't start it manually unless you have a client to speak MCP.


## Inference runner pilot: OpenAI API → MCP → SQLite

This optional runner demonstrates the **model-host boundary**, not resume building.
It launches the existing read-only MCP server as a subprocess, discovers its
tools, translates their schemas to OpenAI Responses functions, sends the model's
requests to MCP, and returns structured tool results to the model.

```bash
python -m pip install -r requirements-inference.txt
python -m unittest discover -s tests -p test_inference_runner.py -v
read -rsp "OpenAI API key: " OPENAI_API_KEY; echo; export OPENAI_API_KEY
python inference_runner.py --db career.db --model gpt-5.6-luna
```

Choose an API model available to your account; API usage is separately billed
from ChatGPT. You can change the question with `--question "Your question here"`.

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
