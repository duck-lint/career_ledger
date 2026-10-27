"""Read-only MCP access to Career Ledger's SQLite experience catalogue."""

import argparse
from contextlib import closing
from pathlib import Path
from typing import TypedDict

from career_ledger import connect


class ExperienceRecord(TypedDict):
    id: str
    kind: str
    title: str
    organization: str | None
    start_date: str | None
    end_date: str | None


class ExperiencePage(TypedDict):
    items: list[ExperienceRecord]
    total: int
    has_more: bool


def read_experiences(db_path: Path, limit: int = 20, offset: int = 0) -> ExperiencePage:
    """Return a bounded, unranked page of existing experience records."""
    if not 1 <= limit <= 20:
        raise ValueError("limit must be between 1 and 20")
    if offset < 0:
        raise ValueError("offset must not be negative")

    with closing(connect(db_path)) as db:
        db.execute("PRAGMA query_only = ON")
        total = db.execute("SELECT COUNT(*) FROM experience_records").fetchone()[0]
        rows = db.execute("""
            SELECT id, kind, title, organization, start_date, end_date
            FROM experience_records
            ORDER BY (end_date = 'Present') DESC,
                     (end_date IS NULL), end_date DESC,
                     start_date DESC, title COLLATE NOCASE, id
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()
        items = [dict(row) for row in rows]
    return {"items": items, "total": total, "has_more": offset + len(items) < total}


def make_server(db_path: Path):
    from mcp.server import MCPServer
    from mcp.server.mcpserver.exceptions import ToolError

    server = MCPServer("Career Ledger")

    @server.tool(structured_output=True)
    def list_experiences(limit: int = 20, offset: int = 0) -> ExperiencePage:
        """Browse existing employment/project records and IDs; no relevance ranking."""
        try:
            return read_experiences(db_path, limit, offset)
        except (ValueError, OSError) as error:
            raise ToolError(str(error)) from error

    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path)
    args = parser.parse_args()
    make_server(args.db).run()  # stdio; a client launches this subprocess.
