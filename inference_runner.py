"""Small OpenAI Responses host for Career Ledger's read-only MCP tools.

This is a tool-call wiring experiment, NOT the resume-selection or assembly pipeline.
"""

import argparse
import asyncio
import json
from pathlib import Path
import sys


INSTRUCTIONS = (
    "You are inspecting a career evidence library through read-only tools. "
    "Use returned records as evidence; never invent experience, evidence, or IDs. "
    "You may request further pages or evidence for an experience. "
    "search_evidence performs only literal substring matching in descriptions "
    "(ASCII case-insensitive): no semantic retrieval, synonyms, stemming, or "
    "automatic acronym expansion. For conceptual questions, choose and revise "
    "search terms using plausible wording variants (for example, SME and "
    "Subject Matter Expert) and related operational descriptions; inspect "
    "promising results and adjacent evidence as needed. A lexical miss does "
    "not establish that substantively relevant evidence is absent. "
    "Do not treat unseen records as irrelevant. Briefly explain what you observed."
)


def response_tools(discovered):
    """Translate the server's MCP tool definitions into Responses function tools."""
    return [
        {
            "type": "function",
            "name": tool.name,
            "description": tool.description or "",
            "parameters": tool.input_schema,
            # MCP has optional limit/offset arguments; do not make them required.
            "strict": False,
        }
        for tool in discovered
    ]


async def run_inference(mcp_client, model_client, *, model, question,
                        max_tool_rounds=4, emit=print):
    """Send model calls to MCP, replay their results, and return the final text."""
    discovered = (await mcp_client.list_tools()).tools
    functions = response_tools(discovered)
    allowed_names = {tool["name"] for tool in functions}
    if "list_experiences" not in allowed_names:
        raise RuntimeError("MCP server has no list_experiences tool")

    history = [{"role": "user", "content": question}]
    for round_number in range(max_tool_rounds + 1):
        # The model chooses whether to call a tool, and which one.
        # The final round requires an answer rather than another tool call.
        choice = "auto" if round_number < max_tool_rounds else "none"
        response = await model_client.responses.create(
            model=model,
            instructions=INSTRUCTIONS,
            input=history,
            tools=functions,
            tool_choice=choice,
            store=False,
        )
        if response.status != "completed":
            raise RuntimeError(f"Model response not completed: {response.status}")
        # Replay ALL items (including opaque reasoning) for tool-call continuity.
        history.extend(response.output)
        calls = [item for item in response.output if item.type == "function_call"]
        if not calls:
            if not response.output_text:
                raise RuntimeError("Model returned neither a tool call nor final text")
            return response.output_text

        if round_number >= max_tool_rounds:
            raise RuntimeError("Tool-call round limit reached without a final answer")

        for call in calls:
            if call.name not in allowed_names:
                raise RuntimeError(f"Unadvertised tool requested: {call.name}")
            try:
                arguments = json.loads(call.arguments)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"Invalid arguments for {call.name}") from error
            if not isinstance(arguments, dict):
                raise RuntimeError(f"Arguments for {call.name} must be an object")

            emit(f"MODEL → MCP {call.name}({json.dumps(arguments, ensure_ascii=False)})")
            result = await mcp_client.call_tool(call.name, arguments)
            if result.is_error:
                payload = {"error": [getattr(item, "text", str(item)) for item in result.content]}
            else:
                payload = result.structured_content
                if payload is None:
                    raise RuntimeError(f"{call.name} returned no structured content")
            emit(f"MCP → MODEL {json.dumps(payload, ensure_ascii=False)}")
            history.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(payload, ensure_ascii=False),
            })

    raise RuntimeError("Unexpected inference loop exit")


async def main():
    from mcp import Client, StdioServerParameters
    from openai import AsyncOpenAI

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True, help="Existing SQLite database")
    parser.add_argument("--model", required=True, help="OpenAI API model ID")
    parser.add_argument(
        "--question",
        default="What experience records are in my Career Ledger? Give me a brief overview.",
        help="Question for the model; not a resume-generation request",
    )
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error(f"Database file does not exist: {args.db}")
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(Path(__file__).resolve().with_name("career_mcp.py")),
              "--db", str(args.db.resolve())],
    )
    async with Client(params) as mcp_client:
        async with AsyncOpenAI() as model_client:
            answer = await run_inference(
                mcp_client, model_client, model=args.model, question=args.question
            )
    print(f"\nMODEL ANSWER:\n{answer}")


if __name__ == "__main__":
    asyncio.run(main())
