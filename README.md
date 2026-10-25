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
