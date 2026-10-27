"""Real SQLite reads plus an MCP client/server integration test."""

import asyncio
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from career_mcp import read_evidence, read_experiences  # noqa: E402


class McpExperienceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "career.db"
        with sqlite3.connect(self.db) as conn:
            conn.executescript((ROOT / "harness" / "career_schema.sql").read_text())
            conn.executemany("INSERT INTO experience_records VALUES (?, ?, ?, ?, ?, ?)", [
                ("exp_1", "employment", "Grounds", "City", "2025-01-01", "Present"),
                ("exp_2", "project", "Career Ledger", None, "2024-01-01", "2024-06-01"),
                ("exp_3", "project", "Notes", None, None, None),
            ])
            conn.executemany("INSERT INTO evidence_items VALUES (?, ?, ?)", [
                ("ev_1", "exp_1", "Cleared snow — safely.\n"),
                ("ev_2", "exp_1", "Maintained entrances"),
                ("ev_3", "exp_1", "Reported ice hazards"),
                ("ev_4", "exp_2", "Developed SQLite CLI"),
            ])

    def test_bounded_pages_and_counts(self):
        first = read_experiences(self.db, limit=2)
        self.assertEqual([r["id"] for r in first["items"]], ["exp_1", "exp_2"])
        self.assertEqual(first["total"], 3)
        self.assertTrue(first["has_more"])
        self.assertEqual(first["items"][0]["end_date"], "Present")
        second = read_experiences(self.db, limit=2, offset=2)
        self.assertEqual([r["id"] for r in second["items"]], ["exp_3"])
        self.assertFalse(second["has_more"])
        self.assertEqual(read_experiences(self.db, offset=99)["items"], [])

    def test_bounds_and_no_implicit_database_creation(self):
        for kwargs in ({"limit": 0}, {"limit": 21}, {"offset": -1}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                read_experiences(self.db, **kwargs)
        nonexistent = self.db.parent / "absent.db"
        with self.assertRaises(ValueError):
            read_experiences(nonexistent)
        self.assertFalse(nonexistent.exists())

    def test_evidence_pages_follow_parent_without_ranking(self):
        first = read_evidence(self.db, "exp_1", limit=2)
        self.assertEqual(first["total"], 3)
        self.assertTrue(first["has_more"])
        self.assertEqual([item["id"] for item in first["items"]], ["ev_1", "ev_2"])
        self.assertEqual(first["items"][0]["description"], "Cleared snow — safely.\n")
        self.assertEqual(first["items"][0]["experience_id"], "exp_1")

        next_page = read_evidence(self.db, "exp_1", limit=2, offset=2)
        self.assertEqual([item["id"] for item in next_page["items"]], ["ev_3"])
        self.assertFalse(next_page["has_more"])
        self.assertEqual(read_evidence(self.db, "exp_2")["total"], 1)
        self.assertEqual(read_evidence(self.db, "exp_3"),
                         {"items": [], "total": 0, "has_more": False})
        self.assertEqual(read_evidence(self.db, "exp_1", offset=99)["items"], [])

    def test_evidence_rejects_invalid_experience_and_bounds(self):
        for args in (
            {"experience_id": "missing"},
            {"experience_id": ""},
            {"experience_id": "exp_1", "limit": 0},
            {"experience_id": "exp_1", "limit": 21},
            {"experience_id": "exp_1", "offset": -1},
        ):
            with self.subTest(args=args), self.assertRaises(ValueError):
                read_evidence(self.db, **args)
        nonexistent = self.db.parent / "absent.db"
        with self.assertRaises(ValueError):
            read_evidence(nonexistent, "exp_1")
        self.assertFalse(nonexistent.exists())

    def test_stdio_mcp_client_roundtrip(self):
        try:
            from mcp import Client, StdioServerParameters
        except ImportError:
            self.skipTest('Install the optional MCP dependency: pip install "mcp>=2,<3"')

        async def check():
            params = StdioServerParameters(
                command=sys.executable,
                args=[str(ROOT / "career_mcp.py"), "--db", str(self.db)],
            )
            async with Client(params) as client:
                discovered = await client.list_tools()
                tools = {tool.name: tool for tool in discovered.tools}
                self.assertEqual(set(tools), {"list_experiences", "list_evidence"})
                for tool in tools.values():
                    self.assertIsNotNone(tool.output_schema,
                                         "MCP tool must advertise a JSON output schema")
                    self.assertEqual(set(tool.output_schema["properties"]),
                                     {"items", "total", "has_more"})
                result = await client.call_tool("list_experiences", {"limit": 2, "offset": 0})
                self.assertFalse(result.is_error)
                body = result.structured_content
                self.assertIsNotNone(body, f"Missing structured content; raw result: {result.content!r}")
                self.assertEqual(body["total"], 3)
                self.assertTrue(body["has_more"])
                self.assertEqual(body["items"][0]["id"], "exp_1")
                self.assertEqual(body["items"][0]["title"], "Grounds")
                self.assertEqual(body["items"][0]["end_date"], "Present")
                page2 = await client.call_tool("list_experiences", {"limit": 2, "offset": 2})
                self.assertEqual(page2.structured_content["items"][0]["id"], "exp_3")
                self.assertFalse(page2.structured_content["has_more"])
                bad = await client.call_tool("list_experiences", {"limit": 21})
                self.assertTrue(bad.is_error)
                evidence = await client.call_tool(
                    "list_evidence", {"experience_id": "exp_1", "limit": 2, "offset": 0}
                )
                self.assertFalse(evidence.is_error)
                self.assertIsNotNone(evidence.structured_content)
                self.assertEqual(evidence.structured_content["total"], 3)
                self.assertTrue(evidence.structured_content["has_more"])
                self.assertEqual(evidence.structured_content["items"][0]["id"], "ev_1")
                self.assertEqual(evidence.structured_content["items"][0]["description"],
                                 "Cleared snow — safely.\n")

                evidence_next = await client.call_tool(
                    "list_evidence", {"experience_id": "exp_1", "limit": 2, "offset": 2}
                )
                self.assertEqual(evidence_next.structured_content["items"][0]["id"], "ev_3")
                self.assertFalse(evidence_next.structured_content["has_more"])

                missing = await client.call_tool("list_evidence", {"experience_id": "absent"})
                self.assertTrue(missing.is_error)


        asyncio.run(check())


if __name__ == "__main__":
    unittest.main()
