# Career Ledger — Project Kernel

**Goal:** Relate a user-supplied job posting to user-authored career evidence, propose relevant source IDs, and assemble a source-grounded resume.

## Roles and authority

- **User:** Authoritative for the job posting and stored career content.
- **Model:** Explores accessible evidence, evaluates substantive relationships to the posting, and proposes source IDs with stated relationships.
- **MCP server:** Exposes read-only discovery/retrieval tools; it is an interface to SQLite, not a second database.
- **Host:** Sends the model its versioned instructions and job posting, executes requested tool calls via an MCP client, and returns tool results.
- **Validator and assembler:** Ordinary application functions, **not** MCP resources or model-callable tools. Check JSON/IDs/source associations, then retrieve and place authoritative text. Neither judges semantic relevance.
- The prompt constrains the **task**, not the model's reasoning or a fixed relevance taxonomy. Its stated relationships are inspectable proposals, not internal reasoning.

## Kernel

```text
(O_seen, L) = Explore(J, D, tools, bounds)
P = I_p(J, O_seen)
T = I_s(P, O_seen)
C(T, D, O_seen) -> valid | invalid
R = E(T, D)                  [only if valid]
A = F(R, Approved(D), ℓ)
```

- **J:** posting; **D:** SQLite source of truth; **O_seen:** evidence actually returned to the model, with parent context; **L:** observed coverage and limits.
- **Explore:** model requests bounded, read-only MCP tool calls; server executes SQLite queries and returns results. No automatic semantic filtering.
- **P:** relational interpretation of J and encountered evidence; conceptual, not a mandatory serialized object.
- **I_p / I_s:** problem interpretation / candidate proposal; separate model calls are **not required**.
- **T:** observed evidence IDs with requirements and stated relationships; **C:** structural checks, including that IDs were actually offered.
- **R:** retrieved source content; **Approved(D):** approved content; **ℓ:** layout; **A:** resume artifact.
- No extra persisted snapshot, MCP resources, or MCP prompts are required.

## Data flow

See [`diagrams.md`](diagrams.md) for the entry, exploration, and assembly paths.

## MCP access — incremental slices

- `list_experiences(limit, offset)`: **implemented** as the first read-only MCP tool; bounded catalogue of experience IDs and context.
- `list_evidence(experience_id, limit, offset)`: **implemented** bounded evidence discovery within a record; returns original descriptions and IDs without ranking.
- `get_evidence(evidence_id)`: **planned** full evidence text and owning experience context.
- Listing results report `total`, `items`, and `has_more`; these are **application tool-result fields**, not an MCP protocol requirement.
- Neither a SQLite row nor a catalogue must become an MCP **resource**. Resources are host-read context; tools are model-requestable operations. Start with tools only.
- **Not encountered ≠ irrelevant.** Measure what was returned; don't interpret unseen rows as negative evidence.

## Contracts — initial cut

1. **Database:** [`career_schema.sql`](career_schema.sql). A parent experience record (employment/project) owns separate evidence items; changing an item's parent does not recreate its ID. Approved profile, highlight, education, certification, and toolkit content is stored separately. Only user actions edit source content.
2. **Inference:** [`inference_prompt_v1.md`](inference_prompt_v1.md) + [`selection.schema.json`](selection.schema.json). Host supplies `job_description`, a versioned instructional prompt, and MCP tool definitions. Exploration returns bounded evidence with IDs, text, and parent context. Final output: `matches: [{requirement, evidence_id, relationship}]` and `unmatched_requirements: string[]`. These are model-stated proposals, **not** verified claims.
3. **Assembly:** Given validated T, fetch evidence text **and its parent metadata** from D; place it under the owning experience/project. Place only approved content in other configured sections. Preserve source wording, allow selection/order/layout, and emit a structured resume, DOCX, and source-ID mapping for career statements. Invalid selections produce no resume.

## Traceability

For each build, retain the **exact prompt version/text, job description, tool requests and returned records/IDs, coverage limits, available model/provider settings, final proposal, validation outcome, and output-to-source mapping**. This tracks observable inference provenance—not hidden reasoning or semantic correctness.
