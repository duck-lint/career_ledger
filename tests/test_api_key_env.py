"""Environment-based API key lookup; no network, MCP, or OpenAI credentials needed."""

import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import inference_runner  # noqa: E402


class ApiKeyEnvironmentTests(unittest.TestCase):
    def test_plain_api_key_in_project_env(self):
        with tempfile.TemporaryDirectory() as folder:
            env_file = Path(folder) / ".env"
            env_file.write_text(
                "# Local key\nOTHER_VARIABLE=unused\nOPENAI_API_KEY=sk-test-file=with-equals\n",
                encoding="utf-8",
            )
            self.assertEqual(
                inference_runner.resolve_api_key(env_file=env_file, environ={}),
                "sk-test-file=with-equals",
            )

    def test_shell_variable_overrides_dotenv(self):
        with tempfile.TemporaryDirectory() as folder:
            env_file = Path(folder) / ".env"
            env_file.write_text("OPENAI_API_KEY=sk-test-file\n", encoding="utf-8")
            self.assertEqual(
                inference_runner.resolve_api_key(
                    env_file=env_file, environ={"OPENAI_API_KEY": "sk-test-shell"}
                ),
                "sk-test-shell",
            )

    def test_default_file_is_beside_runner_not_working_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / ".env").write_text("OPENAI_API_KEY='sk-test-root'\n", encoding="utf-8")
            other = root / "desktop"
            other.mkdir()
            original_directory = Path.cwd()
            try:
                os.chdir(other)
                with patch.object(inference_runner, "__file__", str(root / "inference_runner.py")):
                    self.assertEqual(
                        inference_runner.resolve_api_key(environ={}), "sk-test-root"
                    )
            finally:
                os.chdir(original_directory)

    def test_missing_or_empty_key_returns_none(self):
        with tempfile.TemporaryDirectory() as folder:
            env_file = Path(folder) / ".env"
            self.assertIsNone(
                inference_runner.resolve_api_key(env_file=env_file, environ={})
            )
            env_file.write_text("OTHER_VARIABLE=value\n", encoding="utf-8")
            self.assertIsNone(
                inference_runner.resolve_api_key(env_file=env_file, environ={})
            )
            env_file.write_text("OPENAI_API_KEY=\n", encoding="utf-8")
            self.assertIsNone(
                inference_runner.resolve_api_key(env_file=env_file, environ={})
            )


if __name__ == "__main__":
    unittest.main()
