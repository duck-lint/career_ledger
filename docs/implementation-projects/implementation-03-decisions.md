# Implementation 03 Decisions

Record decisions here, not recurring failure patterns.

| ID | Decision | Source | Alternatives Considered | Reason | Date |
| --- | --- | --- | --- | --- | --- |
| D-001 | Start a new live implementation-03 effort instead of reopening implementation-02 for the taxonomy diagnostics work. | [implementation-03-plan.md](implementation-03-plan.md) | Reopen implementation-02 and keep appending unrelated work. | It keeps the prior UAT-fix history legible while still letting the repo absorb missing provenance artifacts for implementation-02. | 2026-04-29 |
| D-002 | Treat the current education and certification diagnostics model as sufficient unless focused tests fail. | [implementation-03-plan.md](implementation-03-plan.md) | Widen the shared diagnostics model before checking the existing candidate-profile coverage tests. | Focused diagnostics tests already proved the coverage seam green, so the fastest correct move was frontend interaction work rather than speculative model churn. | 2026-04-29 |
| D-003 | Reuse `AdoptTagDialog` and `TagDialog` for taxonomy diagnostics repair instead of inventing a new diagnostics-only modal. | [implementation-03-plan.md](implementation-03-plan.md) | Build a second, diagnostics-specific remediation flow. | The existing dialogs already encode the adopt-into-existing and create-new-tag contracts and keep the operator path consistent with resume analysis. | 2026-04-29 |