"""Real SQLite reads plus an MCP client/server integration test."""

import asyncio
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from career_mcp import read_experiences  # noqa: E402


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
                self.assertEqual([tool.name for tool in discovered.tools], ["list_experiences"])
                self.assertIsNotNone(discovered.tools[0].output_schema,
                                     "MCP tool must advertise a JSON output schema")
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

        asyncio.run(check())


if __name__ == "__main__":
    unittest.main()
