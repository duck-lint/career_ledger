# Implementation-02 — UAT Checklist

Project: career_ledger

Implementation: Implementation-02 (UAT fixes)

Prepared by: automation

Date: 2026-04-29

Branch: master

Scope
- UI, persistence, and manifest contract changes affecting Resume Generation, Requirement Review, Taxonomy Diagnostics, and Operations manifest rendering.

Checklist (items, validation steps, expected results)

- Manifest round‑trip
  - Steps: Run a generation (produce a gap report / resume generation), then open the Operations -> manifest detail for that run.
  - Expected: The manifest detail renders with native UI components (Selected records/evidence counts, artifact files list, requirement-review summary). No raw JSON blob must be required to understand the manifest.
  - Validation: Visual confirmation and counts matching the generation run data.

- Resume JSON tab removed
  - Steps: Open the Resume Generation view and inspect the tabs/controls for a generated run.
  - Expected: There is no "JSON" tab in the resume section; raw JSON is not required for normal inspection.

- Native gap report
  - Steps: Run a generation that yields a gap report; open the Resume Generation view for that run.
  - Expected: Gap report displays natively (summary counts, per-evidence items, artifact links). Actions like marking reviewed should update UI state.

- Requirement‑review noise persistence
  - Steps: In Requirement Review, mark a token (e.g., the word "you") as noise and save. Run a new posting analysis or reload the app.
  - Expected: The marked noise term appears in the reusable noise-terms list and is omitted from subsequent analyses/resume generations.
  - Validation: Check the reusable noise list UI and confirm the token is excluded in a new analysis.

- Taxonomy diagnostics
  - Steps: Run taxonomy diagnostics on a sample posting or dataset.
  - Expected: Diagnostics include sections for Education and Certifications with counts and example evidence highlighted.

- Persistence & restart
  - Steps: Save noise terms, restart or reload the app, re-open Requirement Review.
  - Expected: Persisted noise terms are pre-populated and still applied to new analyses.

- Error / contract behavior (advanced)
  - Steps: (Advanced) Simulate or locate a malformed generation manifest in the DB, then trigger load/display.
  - Expected: Backend fails loud (errors logged) rather than silently dropping typed fields; UI surfaces a readable error instead of silently missing data.

- Automated tests
  - Steps: Run frontend and backend test suites and the focused tests added for Implementation-02.
  - Expected: Focused tests for `OperationsView` and `ResumeGenerationView` pass; backend generation-manifest tests pass.

How to run tests (recommended)
```
# Frontend - all tests
npx vitest

# Frontend - focused tests
npx vitest src/components/views/OperationsView.test.tsx src/components/views/ResumeGenerationView.test.tsx

# Backend - from repo root
cd src-tauri
cargo test
```

UAT result entry (use this template per item)
- Item: <short name>
- Tester: <name>
- Date: <YYYY-MM-DD>
- Sample posting / data: <file or description>
- Steps to reproduce: <exact steps>
- Expected: <expected outcome>
- Actual: <actual outcome>
- Status: Pass | Fail | Blocked
- Notes: <any extra context>
- Attachments: <screenshots, logs, failing test names>
- Issue filed: <link if created>

Issue filing guidance
- When filing a GitHub issue, prefix the title with `[UAT][Implementation-02]` and include the UAT result entry above.
- Attach frontend console logs and the output of the failing `cargo test` or `npx vitest` run when relevant.

Sign-off
- When UAT passes, reply in the thread or update the tracker and I will mark Implementation-02 closed and optionally run the full test suites on CI.

---
