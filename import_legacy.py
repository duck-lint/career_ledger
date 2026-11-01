"""One-time interactive importer for the legacy Career Ledger SQLite library.

Import only experience identity fields and atomic evidence text. The legacy
source is read-only; the current Career Ledger database is the sole destination.
"""

import argparse
from collections import defaultdict
from contextlib import closing
from datetime import date
from pathlib import Path
import sqlite3
import sys
from uuid import uuid4


def validate_date(value, *, end=False):
    if value is None:
        return
    if end and value == "Present":
        return
    try:
        if len(value) == 7 and value[4] == "-":
            date.fromisoformat(value + "-01")
        elif len(value) == 10:
            if date.fromisoformat(value).isoformat() != value:
                raise ValueError()
        else:
            raise ValueError()
    except (ValueError, TypeError) as exc:
        raise ValueError(f"unsupported legacy date {value!r}; expected YYYY-MM, YYYY-MM-DD, or end-date Present") from exc


def load_source(path):
    """Read the two legacy tables only; no legacy metadata or tags."""
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only = ON")
        experiences = [dict(row) for row in db.execute("""
            SELECT id, record_type AS kind, title, organization, start_date, end_date
            FROM experience_records ORDER BY record_type, title, organization, id
        """)]
        evidence = [dict(row) for row in db.execute("""
            SELECT id, experience_record_id AS source_id, claim AS description
            FROM evidence_items ORDER BY experience_record_id, id
        """)]
    parents = {r["id"] for r in experiences}
    if len(parents) != len(experiences):
        raise ValueError("duplicate legacy experience IDs")
    for exp in experiences:
        if exp["kind"] not in ("project", "employment") or not isinstance(exp["title"], str) or not exp["title"].strip():
            raise ValueError(f"unsupported legacy experience: {exp['id']}")
        validate_date(exp["start_date"])
        validate_date(exp["end_date"], end=True)
        if (exp["start_date"] and exp["end_date"] != "Present" and exp["end_date"]
                and exp["start_date"][:7] > exp["end_date"][:7]):
            raise ValueError(f"legacy experience has reversed date range: {exp['id']}")
    for item in evidence:
        if item["source_id"] not in parents:
            raise ValueError(f"orphan legacy evidence: {item['id']}")
        if not isinstance(item["description"], str) or not item["description"].strip():
            raise ValueError(f"blank legacy evidence: {item['id']}")
    return experiences, evidence


def read_destination(db):
    """Require the current schema, rather than initializing or migrating a database."""
    try:
        experiences = [dict(r) for r in db.execute("""
            SELECT id, kind, title, organization, start_date, end_date
            FROM experience_records ORDER BY kind, title, organization, id
        """)]
        evidence = [(r["experience_id"], r["description"]) for r in db.execute(
            "SELECT experience_id, description FROM evidence_items"
        )]
    except sqlite3.OperationalError as exc:
        raise ValueError("destination does not have the current Career Ledger schema") from exc
    return experiences, evidence


def choose_mappings(source, existing, counts, *, ask=input, output=print):
    """Never infer an experience match: each mapping is an explicit choice."""
    mapping = {}
    for exp in source:
        output(f"\n{exp['kind'].upper()}: {exp['title']} | {exp['organization']} | "
               f"{exp['start_date'] or '?'} → {exp['end_date'] or '?'} | "
               f"{counts[exp['id']]} evidence items")
        options = [r for r in existing if r["kind"] == exp["kind"]]
        options.sort(key=lambda r: (
            r["title"].casefold() != exp["title"].casefold(),
            (r["organization"] or "").casefold() != (exp["organization"] or "").casefold(),
            r["title"].casefold(), r["id"],
        ))
        for index, row in enumerate(options, start=1):
            tag = " [SIMILAR TITLE]" if row["title"].casefold() == exp["title"].casefold() else ""
            output(f"  {index}. {row['title']} | {row['organization'] or '—'} "
                   f"({row['id']}){tag}")
        output("  n. Create a new experience (source details)")
        output("  s. Skip this experience and its evidence")
        while True:
            answer = ask("Destination [number/n/s]: ").strip().lower()
            if answer in ("n", "s"):
                mapping[exp["id"]] = {"mode": "new" if answer == "n" else "skip"}
                break
            if answer.isdecimal() and 1 <= int(answer) <= len(options):
                mapping[exp["id"]] = {"mode": "existing", "target_id": options[int(answer)-1]["id"]}
                break
            output("Enter a listed number, n, or s (no automatic selection).")
    return mapping


def make_preview(source, evidence, mapping, existing, existing_evidence):
    """Deterministic preview; apply recalculates it inside a write transaction."""
    target_by_id = {r["id"]: r for r in existing}
    source_by_id = {r["id"]: r for r in source}
    if set(mapping) != set(source_by_id):
        raise ValueError("every source experience must have an explicit mapping")
    seen = defaultdict(set)
    for parent, description in existing_evidence:
        seen[parent].add(description)
    actions = {}
    for record in source:
        source_id = record["id"]
        choice = mapping[source_id]
        mode = choice.get("mode")
        if mode == "existing":
            target = target_by_id.get(choice.get("target_id"))
            if target is None:
                raise ValueError(f"missing destination experience for {source_id}")
            if target["kind"] != record["kind"]:
                raise ValueError(f"kind mismatch for destination of {source_id}")
            actions[source_id] = target["id"]
        elif mode == "new":
            actions[source_id] = f"new:{source_id}"
        elif mode == "skip":
            actions[source_id] = None
        else:
            raise ValueError(f"invalid mapping for {source_id}")
    insert = []
    duplicates = 0
    skipped = 0
    for item in evidence:
        parent = actions[item["source_id"]]
        if parent is None:
            skipped += 1
        elif item["description"] in seen[parent]:
            duplicates += 1
        else:
            seen[parent].add(item["description"])
            insert.append(item)
    return {
        "new_experiences": sum(c["mode"] == "new" for c in mapping.values()),
        "mapped_experiences": sum(c["mode"] == "existing" for c in mapping.values()),
        "skipped_experiences": sum(c["mode"] == "skip" for c in mapping.values()),
        "new_evidence": len(insert),
        "duplicate_evidence": duplicates,
        "skipped_evidence": skipped,
        "insert_ids": [r["id"] for r in insert],
    }


def apply_import(db, source, evidence, mapping, expected):
    """Apply all parent/child inserts atomically; refuse if preview is stale."""
    db.execute("BEGIN IMMEDIATE")
    try:
        existing, existing_evidence = read_destination(db)
        current = make_preview(source, evidence, mapping, existing, existing_evidence)
        if current != expected:
            raise ValueError("destination changed since preview; restart the import")
        parent_ids = {}
        for item in source:
            choice = mapping[item["id"]]
            if choice["mode"] == "skip":
                continue
            if choice["mode"] == "existing":
                parent_ids[item["id"]] = choice["target_id"]
            else:
                new_id = "exp_" + uuid4().hex
                db.execute("""
                    INSERT INTO experience_records
                      (id, kind, title, organization, start_date, end_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (new_id, item["kind"], item["title"], item["organization"],
                      item["start_date"], item["end_date"]))
                parent_ids[item["id"]] = new_id
        keep = set(current["insert_ids"])
        for item in evidence:
            if item["id"] in keep:
                db.execute("INSERT INTO evidence_items (id, experience_id, description) VALUES (?, ?, ?)",
                           ("ev_" + uuid4().hex, parent_ids[item["source_id"]], item["description"]))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {key: value for key, value in current.items() if key != "insert_ids"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="legacy career.db (read-only)")
    parser.add_argument("--db", required=True, type=Path, help="existing authoritative Career Ledger database")
    parser.add_argument("--dry-run", action="store_true", help="show preview but never write")
    args = parser.parse_args(argv)
    try:
        if not args.source.is_file() or not args.db.is_file():
            raise ValueError("both source and destination must be existing SQLite files")
        if args.source.samefile(args.db):
            raise ValueError("source and destination must be different database files")
        source, evidence = load_source(args.source)
        counts = defaultdict(int)
        for item in evidence:
            counts[item["source_id"]] += 1
        with closing(sqlite3.connect(args.db)) as db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys = ON")
            existing, existing_evidence = read_destination(db)
            print(f"Legacy source: {len(source)} experiences, {len(evidence)} evidence items (read-only)")
            print(f"Destination: {len(existing)} experiences, {len(existing_evidence)} evidence items")
            mapping = choose_mappings(source, existing, counts)
            preview = make_preview(source, evidence, mapping, existing, existing_evidence)
            print("\nPREVIEW (no changes made):")
            for key, value in preview.items():
                if key != "insert_ids":
                    print(f"  {key}: {value}")
            if args.dry_run:
                print("Dry run complete; no changes made.")
                return 0
            if preview["new_experiences"] == preview["new_evidence"] == 0:
                print("Nothing to import.")
                return 0
            if input("\nType IMPORT to commit these changes: ").strip() != "IMPORT":
                print("Cancelled; no changes made.")
                return 0
            applied = apply_import(db, source, evidence, mapping, preview)
            print("Import committed:")
            for key, value in applied.items():
                print(f"  {key}: {value}")
        return 0
    except (ValueError, sqlite3.Error, OSError, EOFError, KeyboardInterrupt) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
