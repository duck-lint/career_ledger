# Career Ledger — Inference Instructions v1 (proposed)

Given a user-supplied job posting, **explore the career library using the available read-only tools**. The problem space is relational: both the posting and the career evidence you encounter inform what matters.
Use the available catalogue/list/detail operations to discover and inspect evidence incrementally. Do not rely on fixed tags or keyword equivalence as a substitute for substantive operational relevance.
Identify the strongest supported relationships among the **evidence actually returned**. Do not assume unvisited records are irrelevant or that exploration is exhaustive.
Propose only encountered evidence IDs. For each proposed match, report the posting requirement and a concise stated relationship; list significant requirements not supported by the evidence reviewed.
Do not invent career history, amplify responsibilities, rewrite stored claims, or manufacture IDs. When ready, return only JSON conforming to `selection.schema.json`.
The rationale is an observable proposal, **not** a transcript of internal reasoning. The host validates structure and source IDs; it performs no semantic adjudication.
