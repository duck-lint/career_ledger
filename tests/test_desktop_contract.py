"""CLI contract consumed by the WSLg Tauri evidence-entry adapter.

Tests operate on disposable test databases; never on the user's career.db.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CLI = Path(__file__).resolve().parents[1] / "career_ledger.py"


class DesktopCliContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / "career.db"

    def call(self, *args, success=True):
        result = subprocess.run(
            [sys.executable, str(CLI), "--db", str(self.db), *args],
            capture_output=True, text=True, encoding="utf-8", check=False,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result.stderr

    def test_select_create_and_refresh_with_verbatim_source(self):
        self.call("init")
        first = self.call("add-experience", "--kind", "employment",
                          "--title", "HR Coordinator", "--organization", "Company")["id"]
        second = self.call("add-experience", "--kind", "project",
                           "--title", "Side project")["id"]
        page = self.call("list-experiences", "--json", "--limit", "1", "--offset", "0")
        self.assertEqual(page["total"], 2)
        self.assertTrue(page["has_more"])
        more = self.call("list-experiences", "--json", "--limit", "1", "--offset", "1")
        selected_ids = {page["items"][0]["id"], more["items"][0]["id"]}
        self.assertEqual(selected_ids, {first, second})

        # --description=<value> keeps descriptions that begin with '-' as data.
        description = "--Improved onboarding — verified.\nSecond line.  "
        evidence = self.call("add-evidence", "--experience-id", second,
                             f"--description={description}")
        parent = self.call("get-experience", "--id", second)
        self.assertEqual(parent["evidence"], [{
            "id": evidence["id"], "experience_id": second,
            "description": description,
        }])
        self.assertEqual(self.call("get-experience", "--id", first)["evidence"], [])

    def test_missing_database_and_invalid_evidence_do_not_create_records(self):
        self.assertIn("database not found", self.call(
            "list-experiences", "--json", success=False
        ))
        self.assertFalse(self.db.exists())
        self.call("init")
        experience = self.call("add-experience", "--kind", "project",
                               "--title", "Prototype")["id"]
        self.assertIn("description must not be blank", self.call(
            "add-evidence", "--experience-id", experience,
            "--description=   ", success=False
        ))
        self.assertEqual(self.call("get-experience", "--id", experience)["evidence"], [])


if __name__ == "__main__":
    unittest.main()
