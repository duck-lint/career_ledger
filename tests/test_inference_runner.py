"""Offline fake-model tests for the inference runner, plus an optional real MCP bridge."""

import asyncio
from pathlib import Path
import sqlite3
import sys
import tempfile
from types import SimpleNamespace as Obj
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from inference_runner import response_tools, run_inference  # noqa: E402


def call(name, arguments, call_id):
    return Obj(type="function_call", name=name, arguments=arguments, call_id=call_id)


def reply(*items, text=""):
    return Obj(status="completed", output=list(items), output_text=text)


class FakeModel:
    def __init__(self, replies):
        self.responses = self
        self.replies = iter(replies)
        self.requests = []

    async def create(self, **kwargs):
        # Capture a snapshot before the runner extends the shared input list.
        self.requests.append({**kwargs, "input": list(kwargs["input"])})
        return next(self.replies)


class FakeMCP:
    def __init__(self, *, failure=False):
        self.calls = []
        self.failure = failure
        self.tools = [
            Obj(name="list_experiences", description="Browse experiences",
                input_schema={"type": "object", "properties": {
                    "limit": {"type": "integer"}, "offset": {"type": "integer"}
                }}),
            Obj(name="list_evidence", description="Browse evidence",
                input_schema={"type": "object", "properties": {
                    "experience_id": {"type": "string"}
                }, "required": ["experience_id"]}),
        ]

    async def list_tools(self):
        return Obj(tools=self.tools)

    async def call_tool(self, name, args):
        self.calls.append((name, args))
        if self.failure:
            return Obj(is_error=True, structured_content=None,
                       content=[Obj(text="limit must be between 1 and 20")])
        return Obj(is_error=False, content=[], structured_content={
            "items": [{"id": "exp_1"}] if name == "list_experiences" else [{"id": "ev_1"}],
            "total": 1, "has_more": False,
        })


class InferenceRunnerTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_call_mcp_result_model_answer(self):
        mcp = FakeMCP()
        model = FakeModel([
            reply(call("list_experiences", '{"limit": 2, "offset": 0}', "call_one")),
            reply(call("list_evidence", '{"experience_id":"exp_1"}', "call_two")),
            reply(text="Found one experience and one evidence item."),
        ])
        trace = []
        answer = await run_inference(
            mcp, model, model="test-model", question="Explore my records", emit=trace.append
        )
        self.assertEqual(answer, "Found one experience and one evidence item.")
        self.assertEqual(mcp.calls, [
            ("list_experiences", {"limit": 2, "offset": 0}),
            ("list_evidence", {"experience_id": "exp_1"}),
        ])
        self.assertEqual(
            model.requests[0]["tool_choice"],
            {"type": "function", "name": "list_experiences"},
        )
        self.assertEqual(model.requests[1]["tool_choice"], "auto")
        self.assertFalse(model.requests[0]["store"])
        advertised = model.requests[0]["tools"]
        self.assertEqual({tool["name"] for tool in advertised},
                         {"list_experiences", "list_evidence"})
        self.assertTrue(all(tool["strict"] is False for tool in advertised))
        second_input = model.requests[1]["input"]
        outputs = [item for item in second_input if isinstance(item, dict)
                   and item.get("type") == "function_call_output"]
        self.assertEqual(len(outputs), 1)
        self.assertEqual(outputs[0]["call_id"], "call_one")
        self.assertIn('"exp_1"', outputs[0]["output"])
        self.assertEqual(len(trace), 4)
        self.assertIn("list_experiences", trace[0])
        self.assertIn("ev_1", trace[3])

    async def test_mcp_tool_error_is_returned_to_model(self):
        mcp = FakeMCP(failure=True)
        model = FakeModel([
            reply(call("list_experiences", '{"limit":21}', "bad")),
            reply(text="The tool rejected the limit."),
        ])
        answer = await run_inference(mcp, model, model="test-model", question="Inspect",
                                     emit=lambda _: None)
        self.assertIn("rejected", answer)
        second = model.requests[1]["input"]
        self.assertTrue(any('"error"' in item["output"] for item in second
                            if isinstance(item, dict) and
                            item.get("type") == "function_call_output"))

    async def test_unknown_tool_and_malformed_arguments_are_not_executed(self):
        for attempted in (
            call("delete_database", '{}', "unknown"),
            call("list_experiences", '{"limit":', "badjson"),
            call("list_experiences", '[]', "not_object"),
        ):
            with self.subTest(name=attempted.name, args=attempted.arguments):
                mcp = FakeMCP()
                model = FakeModel([reply(attempted)])
                with self.assertRaises(RuntimeError):
                    await run_inference(mcp, model, model="test-model", question="Inspect",
                                        emit=lambda _: None)
                self.assertEqual(mcp.calls, [])

    async def test_max_rounds_force_final_answer(self):
        model = FakeModel([
            reply(call("list_experiences", '{}', "one")),
            reply(text="Enough."),
        ])
        answer = await run_inference(FakeMCP(), model, model="test-model",
                                     question="Inspect", max_tool_rounds=1,
                                     emit=lambda _: None)
        self.assertEqual(answer, "Enough.")
        self.assertEqual(model.requests[1]["tool_choice"], "none")

    async def test_with_real_stdio_server_and_fake_model(self):
        try:
            from mcp import Client, StdioServerParameters
        except ImportError:
            self.skipTest('Install MCP: pip install -r requirements-inference.txt')

        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / "career.db"
            with sqlite3.connect(db) as conn:
                conn.executescript((ROOT / "harness" / "career_schema.sql").read_text())
                conn.execute(
                    "INSERT INTO experience_records VALUES (?, ?, ?, ?, ?, ?)",
                    ("exp_test", "project", "Demo", None, None, "Present"),
                )
            params = StdioServerParameters(
                command=sys.executable,
                args=[str(ROOT / "career_mcp.py"), "--db", str(db)],
            )
            model = FakeModel([
                reply(call("list_experiences", '{"limit":5}', "one")),
                reply(text="I saw Demo."),
            ])
            async with Client(params) as mcp:
                answer = await run_inference(
                    mcp, model, model="test-model", question="Inspect",
                    emit=lambda _: None
                )
            self.assertEqual(answer, "I saw Demo.")
            self.assertIn("exp_test", model.requests[1]["input"][-1]["output"])


if __name__ == "__main__":
    unittest.main()
