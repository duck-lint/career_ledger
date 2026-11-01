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


    def test_edit_experience_and_edit_move_delete_evidence(self):
        self.call("init")
        first = self.call("add-experience", "--kind", "employment", "--title", "First")["id"]
        second = self.call("add-experience", "--kind", "project", "--title", "Second")["id"]
        old_text = "First draft"
        ev = self.call(
            "add-evidence", "--experience-id", first, "--description", old_text
        )["id"]

        updated = self.call(
            "update-experience", "--id", first, "--kind", "project",
            "--title=  Revised — Unicode  ", "--organization=New org",
            "--start-date=2024-01-15", "--end-date=Present"
        )
        self.assertEqual(updated, {"id": first})
        parent = self.call("get-experience", "--id", first)
        self.assertEqual(
            (parent["kind"], parent["title"], parent["organization"],
             parent["start_date"], parent["end_date"]),
            ("project", "  Revised — Unicode  ", "New org", "2024-01-15", "Present")
        )
        self.assertEqual(parent["evidence"][0]["id"], ev)

        # Editing is a replacement of exact user-authored text; ID remains stable.
        revision = "  --Updated — text\nMore detail.  "
        self.assertEqual(
            self.call("update-evidence", "--id", ev, f"--description={revision}"),
            {"id": ev}
        )
        self.assertEqual(
            self.call("get-evidence", "--id", ev)["description"], revision
        )

        self.assertEqual(
            self.call("move-evidence", "--id", ev, "--experience-id", second),
            {"id": ev, "experience_id": second}
        )
        self.assertEqual(self.call("get-experience", "--id", first)["evidence"], [])
        self.assertEqual(
            self.call("get-experience", "--id", second)["evidence"][0]["description"],
            revision
        )
        self.assertEqual(
            self.call("delete-evidence", "--id", ev),
            {"id": ev, "deleted": True}
        )
        self.assertEqual(self.call("get-experience", "--id", second)["evidence"], [])
        self.assertIn("record not found", self.call("get-evidence", "--id", ev, success=False))

    def test_invalid_edits_do_not_mutate_database(self):
        self.call("init")
        first = self.call(
            "add-experience", "--kind", "employment", "--title", "Original",
            "--organization", "Company", "--start-date", "2022-01-01"
        )["id"]
        second = self.call(
            "add-experience", "--kind", "project", "--title", "Other"
        )["id"]
        ev = self.call(
            "add-evidence", "--experience-id", first,
            "--description", "Actual source text"
        )["id"]

        self.assertIn("title must not be blank", self.call(
            "update-experience", "--id", first, "--kind", "project",
            "--title=  ", success=False
        ))
        self.assertIn("start date must not be after end date", self.call(
            "update-experience", "--id", first, "--kind", "employment",
            "--title=Changed", "--start-date=2025-01-01",
            "--end-date=2024-01-01", success=False
        ))
        self.assertIn("record not found", self.call(
            "update-experience", "--id", "missing", "--kind", "project",
            "--title=Missing", success=False
        ))
        self.assertIn("description must not be blank", self.call(
            "update-evidence", "--id", ev, "--description=  ", success=False
        ))
        self.assertIn("evidence not found", self.call(
            "update-evidence", "--id", "ev_missing", "--description=Something",
            success=False
        ))
        self.assertIn("evidence not found", self.call(
            "delete-evidence", "--id", "ev_missing", success=False
        ))
        self.assertIn("FOREIGN KEY constraint failed", self.call(
            "move-evidence", "--id", ev, "--experience-id", "missing",
            success=False
        ))
        self.assertEqual(self.call("get-experience", "--id", first)["title"], "Original")
        self.assertEqual(self.call("get-experience", "--id", first)["kind"], "employment")
        self.assertEqual(self.call("get-experience", "--id", first)["organization"], "Company")
        self.assertEqual(self.call("get-evidence", "--id", ev)["experience_id"], first)
        self.assertEqual(self.call("get-evidence", "--id", ev)["description"], "Actual source text")
        self.assertEqual(self.call("get-experience", "--id", second)["evidence"], [])

    def test_optional_experience_fields_can_be_cleared_explicitly(self):
        self.call("init")
        exp = self.call(
            "add-experience", "--kind", "employment", "--title", "Before",
            "--organization=Old org", "--start-date=2021-10-31",
            "--end-date=Present"
        )["id"]
        self.call(
            "update-experience", "--id", exp, "--kind", "project",
            "--title=After"
        )
        result = self.call("get-experience", "--id", exp)
        self.assertEqual(result["title"], "After")
        self.assertIsNone(result["organization"])
        self.assertIsNone(result["start_date"])
        self.assertIsNone(result["end_date"])

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
