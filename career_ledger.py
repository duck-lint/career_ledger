"""Small CLI for entering and retrieving user-authored career evidence."""

import argparse
from contextlib import closing
from datetime import date
import json
from pathlib import Path
import sqlite3
import sys
from uuid import uuid4

SCHEMA = Path(__file__).parent / "harness" / "career_schema.sql"


def connect(path):
    if not path.is_file():
        raise ValueError(f"database not found: {path}; run init first")
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def nonblank(text, field):
    if not text.strip():
        raise ValueError(f"{field} must not be blank")
    return text  # Preserve user-authored bytes: no normalization or rewriting.


def checked_dates(start, end):
    if start is not None and date.fromisoformat(start).isoformat() != start:
        raise ValueError("start date must be YYYY-MM-DD")
    if end is not None and end != "Present" and date.fromisoformat(end).isoformat() != end:
        raise ValueError('end date must be YYYY-MM-DD or "Present"')
    if start and end and end != "Present" and start > end:
        raise ValueError("start date must not be after end date")


def required_row(db, sql, id):
    row = db.execute(sql, (id,)).fetchone()
    if row is None:
        raise ValueError(f"record not found: {id}")
    return dict(row)


def format_table(headers, rows, widths, total):
    def cell(value, width):
        value = " ".join(str(value if value is not None else "—").split())
        return (value[:width - 1] + "…") if len(value) > width else value

    def line(values):
        return "  ".join(cell(value, width).ljust(width) for value, width in zip(values, widths)).rstrip()

    return "\n".join([
        line(headers), line(["-" * width for width in widths]),
        *(line(row) for row in rows), f"Showing {len(rows)} of {total} records"
    ])


def execute(args):
    path = Path(args.db)
    if args.command == "init":
        if path.exists():
            raise ValueError(f"refusing to overwrite existing database: {path}")
        try:
            with closing(sqlite3.connect(path)) as db:
                db.executescript(SCHEMA.read_text(encoding="utf-8"))
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return {"database": str(path), "initialized": True}

    with closing(connect(path)) as db:
        if args.command == "add-experience":
            title = nonblank(args.title, "title")
            checked_dates(args.start_date, args.end_date)
            id = "exp_" + uuid4().hex
            with db:
                db.execute(
                    "INSERT INTO experience_records VALUES (?, ?, ?, ?, ?, ?)",
                    (id, args.kind, title, args.organization, args.start_date, args.end_date),
                )
            return {"id": id}

        if args.command == "add-evidence":
            description = nonblank(args.description, "description")
            id = "ev_" + uuid4().hex
            with db:
                db.execute("INSERT INTO evidence_items VALUES (?, ?, ?)",
                           (id, args.experience_id, description))
            return {"id": id}

        if args.command == "move-evidence":
            with db:
                cursor = db.execute("UPDATE evidence_items SET experience_id = ? WHERE id = ?",
                                    (args.experience_id, args.id))
                if cursor.rowcount != 1:
                    raise ValueError(f"evidence not found: {args.id}")
            return {"id": args.id, "experience_id": args.experience_id}

        if args.command == "get-experience":
            record = required_row(db, "SELECT * FROM experience_records WHERE id = ?", args.id)
            record["evidence"] = [dict(row) for row in db.execute(
                "SELECT * FROM evidence_items WHERE experience_id = ? ORDER BY id", (args.id,)
            )]
            return record

        if args.command == "get-evidence":
            item = required_row(db, "SELECT * FROM evidence_items WHERE id = ?", args.id)
            item["experience"] = required_row(
                db, "SELECT * FROM experience_records WHERE id = ?", item["experience_id"]
            )
            return item

        if args.command in ("list-experiences", "list-evidence"):
            if args.limit < 1:
                raise ValueError("--limit must be a positive integer")
            if args.command == "list-experiences":
                if args.offset < 0:
                    raise ValueError("--offset must be nonnegative")
                total = db.execute("SELECT COUNT(*) FROM experience_records").fetchone()[0]
                rows = db.execute("""
                    SELECT id, kind, title, organization, start_date, end_date
                    FROM experience_records
                    ORDER BY (end_date = 'Present') DESC,
                             (end_date IS NULL), end_date DESC,
                             start_date DESC, title COLLATE NOCASE, id
                    LIMIT ? OFFSET ?
                """, (args.limit, args.offset)).fetchall()
                if args.json:
                    items = [dict(row) for row in rows]
                    return {"items": items, "total": total,
                            "has_more": args.offset + len(items) < total}
                return format_table(
                    ("TYPE", "TITLE", "START", "END"),
                    [(row["kind"], row["title"], row["start_date"], row["end_date"])
                     for row in rows],
                    (10, 30, 10, 10), total
                )
            total = db.execute("SELECT COUNT(*) FROM evidence_items").fetchone()[0]
            rows = db.execute("""
                SELECT r.title, e.description FROM evidence_items AS e
                JOIN experience_records AS r ON r.id = e.experience_id
                ORDER BY r.title COLLATE NOCASE, e.id
                LIMIT ?
            """, (args.limit,)).fetchall()
            return format_table(("EXPERIENCE", "EVIDENCE"), rows, (24, 50), total)

    raise ValueError(f"unknown command: {args.command}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="SQLite database path")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init")

    exp = commands.add_parser("add-experience")
    exp.add_argument("--kind", choices=("employment", "project"), required=True)
    exp.add_argument("--title", required=True)
    exp.add_argument("--organization")
    exp.add_argument("--start-date")
    exp.add_argument("--end-date")

    evidence = commands.add_parser("add-evidence")
    evidence.add_argument("--experience-id", required=True)
    evidence.add_argument("--description", required=True)

    for name in ("get-experience", "get-evidence"):
        commands.add_parser(name).add_argument("--id", required=True)

    for name in ("list-experiences", "list-evidence"):
        listing = commands.add_parser(name)
        listing.add_argument("--limit", type=int, default=15)
        if name == "list-experiences":
            listing.add_argument("--offset", type=int, default=0)
            listing.add_argument("--json", action="store_true",
                                 help="return structured records with IDs for the desktop UI")

    move = commands.add_parser("move-evidence")
    move.add_argument("--id", required=True)
    move.add_argument("--experience-id", required=True)

    args = parser.parse_args(argv)
    try:
        result = execute(args)
        print(result if isinstance(result, str) else json.dumps(result, ensure_ascii=False))
    except (ValueError, sqlite3.Error, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
