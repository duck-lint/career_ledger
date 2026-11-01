"""Tests run only against temporary SQLite databases, never a user's library."""

from contextlib import closing
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from import_legacy import load_source, read_destination, make_preview, apply_import


ROOT = Path(__file__).resolve().parents[1]
IMPORTER = ROOT / "import_legacy.py"


class LegacyImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "old.db"
        self.dest = Path(self.tmp.name) / "current.db"
        with closing(sqlite3.connect(self.source)) as db:
            db.executescript("""
                CREATE TABLE experience_records (
                    id TEXT PRIMARY KEY, record_type TEXT, title TEXT, organization TEXT,
                    start_date TEXT, end_date TEXT, legacy_metadata TEXT
                );
                CREATE TABLE evidence_items (
                    id TEXT PRIMARY KEY, experience_record_id TEXT, claim TEXT, tags_json TEXT
                );
                INSERT INTO experience_records VALUES
                    ('s1','employment','Coordinator','Company','2023-11','2026-03','discard'),
                    ('s2','project','Prompt Palette','AutoHotKey','2026-03','2026-03','discard'),
                    ('s3','project','Prompt Palette','Tauri','2026-03','Present','discard');
                INSERT INTO evidence_items VALUES
                    ('i1','s1','  — Coordinated work.\nSecond line  ','["discard"]'),
                    ('i2','s1','Already present','[]'),
                    ('i3','s2','Built an AHK tool','[]'),
                    ('i4','s3','Built a Tauri tool','[]');
            """)
            db.commit()
        with closing(sqlite3.connect(self.dest)) as db:
            db.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE experience_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL,
                    title TEXT NOT NULL, organization TEXT, start_date TEXT, end_date TEXT);
                CREATE TABLE evidence_items (id TEXT PRIMARY KEY,
                    experience_id TEXT NOT NULL REFERENCES experience_records(id),
                    description TEXT NOT NULL);
                CREATE TABLE approved_content (id TEXT PRIMARY KEY, section TEXT, content TEXT);
                INSERT INTO experience_records VALUES
                    ('exp_old','employment','Coordinator','Company','2023-11-01','2026-03-01');
                INSERT INTO evidence_items VALUES ('ev_old','exp_old','Already present');
            """)
            db.commit()
        self.mapping = {"s1": {"mode": "existing", "target_id": "exp_old"},
                        "s2": {"mode": "new"}, "s3": {"mode": "new"}}

    def get_inputs(self):
        return load_source(self.source)

    def connect(self):
        db = sqlite3.connect(self.dest)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def preview(self, db):
        source, evidence = self.get_inputs()
        existing, existing_evidence = read_destination(db)
        return source, evidence, make_preview(source, evidence, self.mapping, existing, existing_evidence)

    def test_import_preserves_months_claim_text_and_distinct_projects(self):
        source, evidence = self.get_inputs()
        self.assertEqual(len(source), 3)
        with closing(self.connect()) as db:
            _, _, preview = self.preview(db)
            self.assertEqual(preview["new_experiences"], 2)
            self.assertEqual(preview["new_evidence"], 3)
            self.assertEqual(preview["duplicate_evidence"], 1)
            result = apply_import(db, source, evidence, self.mapping, preview)
            self.assertEqual(result["new_evidence"], 3)
            records = db.execute("SELECT * FROM experience_records ORDER BY title, organization").fetchall()
            self.assertEqual(len(records), 3)
            palette = [r for r in records if r["title"] == "Prompt Palette"]
            self.assertEqual(len(palette), 2)
            self.assertEqual({r["organization"] for r in palette}, {"AutoHotKey", "Tauri"})
            self.assertTrue(all(r["start_date"] == "2026-03" for r in palette))
            descriptions = [r["description"] for r in db.execute("SELECT description FROM evidence_items")]
            self.assertCountEqual(descriptions,
                                  ["Already present", "  — Coordinated work.\nSecond line  ",
                                   "Built an AHK tool", "Built a Tauri tool"])
            self.assertEqual(db.execute("SELECT count(*) FROM approved_content").fetchone()[0], 0)
        self.assertEqual(len(load_source(self.source)[1]), 4)  # never changed source

    def test_repeated_import_mapping_to_existing_skips_exact_duplicates(self):
        source, evidence = self.get_inputs()
        with closing(self.connect()) as db:
            _, _, preview = self.preview(db)
            apply_import(db, source, evidence, self.mapping, preview)
            new_projects = db.execute("SELECT id, organization FROM experience_records WHERE kind='project'").fetchall()
            retry = {"s1": self.mapping["s1"]}
            for row in new_projects:
                retry["s2" if row["organization"] == "AutoHotKey" else "s3"] = {
                    "mode": "existing", "target_id": row["id"]}
            ex, ev = read_destination(db)
            retry_preview = make_preview(source, evidence, retry, ex, ev)
            self.assertEqual(retry_preview["new_evidence"], 0)
            self.assertEqual(retry_preview["duplicate_evidence"], 4)

    def test_stale_preview_aborts_without_writing(self):
        source, evidence = self.get_inputs()
        with closing(self.connect()) as db:
            _, _, preview = self.preview(db)
            with db:
                db.execute("INSERT INTO evidence_items VALUES ('new','exp_old','  — Coordinated work.\nSecond line  ')")
            with self.assertRaisesRegex(ValueError, "changed since preview"):
                apply_import(db, source, evidence, self.mapping, preview)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM experience_records").fetchone()[0], 1)

    def test_mid_import_error_rolls_back_parents_and_evidence(self):
        source, evidence = self.get_inputs()
        with closing(self.connect()) as db:
            _, _, preview = self.preview(db)
            db.execute("""CREATE TRIGGER stop_on_ahk BEFORE INSERT ON evidence_items
                       WHEN NEW.description = 'Built an AHK tool'
                       BEGIN SELECT RAISE(ABORT, 'simulated failure'); END""")
            with self.assertRaisesRegex(sqlite3.IntegrityError, "simulated failure"):
                apply_import(db, source, evidence, self.mapping, preview)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM experience_records").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM evidence_items").fetchone()[0], 1)

    def test_bad_mapping_and_legacy_source_rejected(self):
        source, evidence = self.get_inputs()
        with closing(self.connect()) as db:
            ex, ev = read_destination(db)
            with self.assertRaisesRegex(ValueError, "explicit mapping"):
                make_preview(source, evidence, {"s1": self.mapping["s1"]}, ex, ev)
            wrong = dict(self.mapping)
            wrong["s2"] = {"mode": "existing", "target_id": "exp_old"}
            with self.assertRaisesRegex(ValueError, "kind mismatch"):
                make_preview(source, evidence, wrong, ex, ev)
        with closing(sqlite3.connect(self.source)) as db:
            db.execute("UPDATE evidence_items SET claim='   ' WHERE id='i1'")
            db.commit()
        with self.assertRaisesRegex(ValueError, "blank legacy evidence"):
            load_source(self.source)

    def test_cli_dry_run_and_cancel_leave_destination_untouched(self):
        for extra, choices in [("--dry-run", "1\nn\nn\n"), (None, "1\nn\nn\nno\n")]:
            args = [sys.executable, str(IMPORTER), "--source", str(self.source), "--db", str(self.dest)]
            if extra:
                args.append(extra)
            p = subprocess.run(args, input=choices, encoding="utf-8", capture_output=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertIn("PREVIEW", p.stdout)
            with closing(self.connect()) as db:
                self.assertEqual(db.execute("SELECT count(*) FROM experience_records").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT count(*) FROM evidence_items").fetchone()[0], 1)

    def test_same_file_refused(self):
        p = subprocess.run([sys.executable, str(IMPORTER), "--source", str(self.source),
                            "--db", str(self.source)], capture_output=True, text=True)
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("must be different", p.stderr)


if __name__ == "__main__":
    unittest.main()
