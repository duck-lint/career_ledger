"""CLI listing output is compact, read-only, and bounded."""

import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / "career_ledger.py"


class ListCommands(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "career.db"
        self.command("init")

    def command(self, *args, success=True):
        result = subprocess.run(
            [sys.executable, str(CLI), "--db", str(self.db), *args],
            capture_output=True, text=True, encoding="utf-8", check=False,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return result.stdout
        self.assertNotEqual(result.returncode, 0)
        return result.stderr

    def test_experiences_are_capped_and_present_is_first(self):
        with sqlite3.connect(self.db) as db:
            db.executemany("INSERT INTO experience_records VALUES (?, ?, ?, ?, ?, ?)", [
                (f"exp_{i:02}", "project", f"Project {i}", None, "2020-01-01", "2020-02-01")
                for i in range(16)
            ])
            db.execute("INSERT INTO experience_records VALUES (?, ?, ?, ?, ?, ?)",
                       ("exp_current", "employment", "Current role", "City", "2025-01-01", "Present"))
        listing = self.command("list-experiences")
        self.assertIn("Showing 15 of 17 records", listing)
        self.assertIn("Current role", listing.splitlines()[2])
        self.assertEqual(len(listing.splitlines()), 18)  # 2 headers + 15 rows + footer
        small = self.command("list-experiences", "--limit", "2")
        self.assertIn("Showing 2 of 17 records", small)
        self.assertEqual(len(small.splitlines()), 5)
        self.assertIn("--limit must be a positive integer", self.command("list-experiences", "--limit", "0", success=False))

    def test_evidence_is_capped_truncated_and_read_only(self):
        parent = json.loads(self.command("add-experience", "--kind", "project", "--title", "Career Ledger"))["id"]
        long_text = "  Used SQLite — and commands.\n" + "More detail " * 12
        first = json.loads(self.command("add-evidence", "--experience-id", parent, "--description", long_text))["id"]
        for desc in ("Short item", "Other item"):
            self.command("add-evidence", "--experience-id", parent, "--description", desc)
        listing = self.command("list-evidence", "--limit", "2")
        self.assertIn("Showing 2 of 3 records", listing)
        self.assertEqual(len(listing.splitlines()), 5)
        self.assertTrue(all(len(line) <= 80 for line in listing.splitlines()))
        all_rows = self.command("list-evidence", "--limit", "10")
        self.assertIn("…", all_rows)
        self.assertNotIn("\nMore detail", all_rows)
        item = json.loads(self.command("get-evidence", "--id", first))
        self.assertEqual(item["description"], long_text)
        self.assertIn("--limit must be a positive integer", self.command("list-evidence", "--limit", "-1", success=False))

    def test_empty_listing_and_missing_database(self):
        self.assertIn("Showing 0 of 0 records", self.command("list-experiences"))
        self.assertIn("Showing 0 of 0 records", self.command("list-evidence"))
        self.db.unlink()
        self.assertIn("database not found", self.command("list-evidence", success=False))
        self.assertFalse(self.db.exists())


if __name__ == "__main__":
    unittest.main()
