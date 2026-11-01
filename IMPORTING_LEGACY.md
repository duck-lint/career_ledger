# One-time legacy Career Ledger import

Use `import_legacy.py` to bring **experiences and atomic evidence text only** from the older Career Ledger SQLite database into the current authoritative library. The legacy database is opened read-only; the importer writes only to your existing destination database. Do not replace your current database with the old one.

From the repository root, with the legacy file accessible somewhere in WSL:

```bash
python import_legacy.py --source "/path/to/legacy/career.db" --db "$cldb" --dry-run
```

For each legacy experience the importer lists existing destination experiences **of the same kind** (employment/project). Enter a listed number to attach evidence to that existing record, `n` to create a new experience using the original title, organization, kind, and dates, or `s` to omit the experience **and all its evidence**. There is no title-based automatic matching. In particular, the two legacy **Prompt Palette** projects have distinct organizations and are separate records unless you explicitly choose otherwise. The **Methanex** experience can be mapped to its already-existing destination record instead of creating a duplicate. Review the proposed counts before proceeding.

`--dry-run` always exits without writing. When ready, run the same command without `--dry-run` and type the confirmation word `IMPORT` **only after reviewing the preview**:

```bash
python import_legacy.py --source "/path/to/legacy/career.db" --db "$cldb"
```

The import is a **single SQLite transaction**. If the destination changes between preview and confirmation, the importer aborts without writing. If any insert fails, it rolls back the entire import. Existing destination records and evidence are not edited, moved, or deleted. Repeating the import while mapping the source to the **same existing destination experiences** skips descriptions already present there using **exact, character-for-character equality**. That does not prevent duplicate *experiences* if you explicitly choose `n` a second time, or semantically similar evidence with different wording. Review carefully before committing.

Only the legacy fields `experience_records.record_type/title/organization/start_date/end_date` and `evidence_items.claim` are imported. Every inserted record receives a new ID; imported evidence attaches to the chosen or newly created parent. Legacy tags, context metadata, notes, configuration and resumes are not imported. Original text is preserved, including Unicode, line breaks and whitespace. Month-precision dates such as `2026-03` are preserved **without inventing a day**. At present the ordinary CLI/desktop editor still validates full `YYYY-MM-DD` dates on edits; changing that validation is a separate follow-up.

The uploaded legacy database used to design this importer contains **15 experiences and 688 evidence items**. These counts are diagnostic, not hard-coded: the script reads whatever is actually in `--source`.

If the GUI or another process has the database open, close it before committing to avoid lock contention. The importer does not run through the read-only MCP tools or introduce another active Career Ledger database. No additional Python packages are needed.

Test from the repository root:

```bash
python -m unittest discover -s tests -p test_import_legacy.py -v
```
