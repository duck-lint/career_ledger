"""End-to-end CLI tests: arguments -> SQLite -> retrieved JSON."""

import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "career_ledger.py"


class LibraryFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name) / "career.db"

    def call(self, *args, success=True):
        result = subprocess.run(
            [sys.executable, str(CLI), "--db", str(self.db), *args],
            capture_output=True, text=True, encoding="utf-8", check=False,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("error:", result.stderr)
        return result.stderr

    def test_roundtrip_reparent_and_keep_exact_text(self):
        self.call("init")
        exp1 = self.call("add-experience", "--kind", "employment", "--title", "Grounds crew",
                         "--organization", "City", "--start-date", "2025-01-01")["id"]
        exp2 = self.call("add-experience", "--kind", "project", "--title", "Winter project")["id"]
        original = "  Cleared snow from walkways — safely.\n"
        evidence_id = self.call("add-evidence", "--experience-id", exp1,
                                "--description", original)["id"]

        record = self.call("get-experience", "--id", exp1)
        self.assertEqual(record["title"], "Grounds crew")
        self.assertEqual(record["evidence"][0]["description"], original)
        self.assertEqual(record["evidence"][0]["id"], evidence_id)
        self.assertEqual(self.call("get-evidence", "--id", evidence_id)["experience"]["id"], exp1)

        self.call("move-evidence", "--id", evidence_id, "--experience-id", exp2)
        moved = self.call("get-evidence", "--id", evidence_id)
        self.assertEqual(moved["id"], evidence_id)
        self.assertEqual(moved["description"], original)
        self.assertEqual(moved["experience"]["id"], exp2)
        self.assertEqual(self.call("get-experience", "--id", exp1)["evidence"], [])
        self.assertEqual(len(self.call("get-experience", "--id", exp2)["evidence"]), 1)

        # Check actual persisted SQLite bytes, not just CLI JSON roundtrip.
        with sqlite3.connect(self.db) as con:
            stored = con.execute("SELECT description FROM evidence_items WHERE id = ?", (evidence_id,)).fetchone()[0]
        self.assertEqual(stored.encode(), original.encode())

    def test_references_and_missing_ids_fail_without_mutation(self):
        self.call("init")
        exp = self.call("add-experience", "--kind", "employment", "--title", "Operator")["id"]
        self.call("add-evidence", "--experience-id", "missing", "--description", "Invalid", success=False)
        self.assertEqual(self.call("get-experience", "--id", exp)["evidence"], [])
        ev = self.call("add-evidence", "--experience-id", exp, "--description", "Real task")["id"]
        self.call("move-evidence", "--id", ev, "--experience-id", "missing", success=False)
        self.assertEqual(self.call("get-evidence", "--id", ev)["experience_id"], exp)
        self.call("get-evidence", "--id", "missing", success=False)
        self.call("move-evidence", "--id", "missing", "--experience-id", exp, success=False)

    def test_present_end_date_for_both_experience_kinds(self):
        self.call("init")
        for kind in ("employment", "project"):
            with self.subTest(kind=kind):
                exp_id = self.call(
                    "add-experience", "--kind", kind, "--title", f"Ongoing {kind}",
                    "--start-date", "2025-01-01", "--end-date", "Present"
                )["id"]
                record = self.call("get-experience", "--id", exp_id)
                self.assertEqual(record["start_date"], "2025-01-01")
                self.assertEqual(record["end_date"], "Present")
                with sqlite3.connect(self.db) as con:
                    stored_end = con.execute(
                        "SELECT end_date FROM experience_records WHERE id = ?", (exp_id,)
                    ).fetchone()[0]
                self.assertEqual(stored_end, "Present")

    def test_initialization_and_input_validation(self):
        self.call("get-experience", "--id", "missing", success=False)
        self.assertFalse(self.db.exists())  # Reads must never create a database.
        self.call("init")
        self.call("init", success=False)
        self.call("add-experience", "--kind", "project", "--title", "   ", success=False)
        self.call("add-evidence", "--experience-id", "missing", "--description", "  ", success=False)
        self.call("add-experience", "--kind", "employment", "--title", "Operator",
                  "--start-date", "2025-05-02", "--end-date", "2025-04-02", success=False)
        self.call("add-experience", "--kind", "employment", "--title", "Operator",
                  "--start-date", "not-a-date", success=False)
        self.call("add-experience", "--kind", "employment", "--title", "Operator",
                  "--start-date", "Present", success=False)
        self.call("add-experience", "--kind", "project", "--title", "Project",
                  "--end-date", "present", success=False)
        self.call("add-experience", "--kind", "project", "--title", "Project",
                  "--end-date", "not-a-date", success=False)
        with sqlite3.connect(self.db) as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM experience_records").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
