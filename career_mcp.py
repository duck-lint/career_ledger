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


class EvidenceRecord(TypedDict):
    id: str
    experience_id: str
    description: str


class EvidencePage(TypedDict):
    items: list[EvidenceRecord]
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


def read_evidence(db_path: Path, experience_id: str, limit: int = 20, offset: int = 0) -> EvidencePage:
    """Return unranked evidence under one existing experience, with pagination."""
    if not experience_id.strip():
        raise ValueError("experience_id is required")
    if not 1 <= limit <= 20:
        raise ValueError("limit must be between 1 and 20")
    if offset < 0:
        raise ValueError("offset must not be negative")

    with closing(connect(db_path)) as db:
        db.execute("PRAGMA query_only = ON")
        if db.execute("SELECT 1 FROM experience_records WHERE id = ?", (experience_id,)).fetchone() is None:
            raise ValueError(f"experience not found: {experience_id}")
        total = db.execute(
            "SELECT COUNT(*) FROM evidence_items WHERE experience_id = ?", (experience_id,)
        ).fetchone()[0]
        rows = db.execute("""
            SELECT id, experience_id, description
            FROM evidence_items
            WHERE experience_id = ?
            ORDER BY id
            LIMIT ? OFFSET ?
        """, (experience_id, limit, offset)).fetchall()
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

    @server.tool(structured_output=True)
    def list_evidence(experience_id: str, limit: int = 20, offset: int = 0) -> EvidencePage:
        """List evidence belonging to an experience ID; read-only and unranked."""
        try:
            return read_evidence(db_path, experience_id, limit, offset)
        except (ValueError, OSError) as error:
            raise ToolError(str(error)) from error

    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path)
    args = parser.parse_args()
    make_server(args.db).run()  # stdio; a client launches this subprocess.
