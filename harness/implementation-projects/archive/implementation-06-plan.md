# Implementation 06 Plan

Historical planning artifact: the workspace-state blocker described below was resolved later the same day, `I06-S1` was implemented within the approved seam, and the bundle was archived. See `harness/implementation-projects/archive/implementation-06-summary.md` for final status and verification evidence.

## Intent

Implementation-06 opens exactly one planning-only seam for the first real SQLite-backed source-authority extraction into the existing approved source-shaped contract already consumed by the desktop seam. This aligns with the approved project direction in PD-01. The user has now supplied both a schema snapshot and a sample SQLite database and has explicitly chosen the first-seam mapping direction under PD-02. The remaining blocker is now purely workspace state: the sanitized sample database is not yet present as a repo-local validation artifact at the approved path. This bundle does not authorize SQLite implementation yet.

## Admissibility Report

- Invariant constraints: Canonical persisted authority stays limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, traversal, target-region selection, ranked paths, and assembled output remain runtime-only, deterministic, explainable, and evidence-bounded. Unsupported requirements remain visible. No AI, embeddings, network, telemetry, cloud behavior, workflow-status state, persisted semantic workspaces, or transition tables may be introduced.
- Task constraints: This bundle is planning-only and defines exactly one future seam for read-only SQLite extraction into the current approved source-shaped contract. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` must remain unchanged unless a separate admissibility question is opened later. `harness/open-decisions.md` now records the chosen implementation-06 seam directions in PD-02.
- Constraint conflicts: Project direction explicitly retains SQLite as source authority, the user has now supplied a schema snapshot plus a sample SQLite database, and PD-02 resolves the mapping and seam-scope decisions needed to continue. The remaining conflict is mechanical: the sanitized sample database selected under D1 is not yet repo-local at the approved path.
- Allowed transformation types: Refine the planning bundle now to encode PD-02; later, once the sanitized sample DB is repo-local, implement one read-only Tauri extraction seam that maps SQLite-backed source facts into the existing approved source-shaped contract without changing the current desktop result contract beyond the approved behavior-parity boundary.
- Affected surfaces: This plan/tracker bundle now. If later authorized, the seam must move together across the Tauri bridge surface in `src-tauri/src/main.rs`, the Rust dependency surface in `src-tauri/Cargo.toml`, the live desktop probe surface, and the repo-local sanitized sample database at `src-tauri/fixtures/career.db`.
- Non-affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, current fixture semantics, project spec, governance, `harness/open-decisions.md`, archived bundles, UI layout, schema invention beyond the supplied basis artifacts, write paths, migrations, auth, deployment, network, telemetry, cloud, and any broader desktop IA work.
- Admissibility checks: Only the planning bundle is admissible now. Future implementation becomes admissible only if the sanitized sample DB selected under D1 is made repo-local, and the seam can then implement PD-02 without inventing missing semantics from fixture behavior alone, without changing the current desktop result contract beyond the approved behavior-parity boundary, and without forcing proof-slice edits.
- Stop conditions: Stop before implementation if the seam would still require inventing canonical tables or source shape from fixture behavior alone; if the bridge would need to change `runtime-core.mjs` or `source-authority-adapter.mjs`; if the sanitized sample DB is not present at the approved repo-local path `src-tauri/fixtures/career.db`; or if the supplied basis artifacts expose a new schema, storage, compatibility, or architecture approval-boundary question.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the governing invariant authority.
- `harness/open-decisions.md` still records `PD-01` as current and explicitly preserves SQLite as source authority.
- `harness/open-decisions.md` now also records `PD-02` as the chosen implementation-06 seam direction.
- `harness/implementation-projects/archive/implementation-05-summary.md` records the hardened desktop seam as complete and archived, and `harness/implementation-projects/active/` contained only `.gitkeep` before this bundle.
- The user has now supplied `career_schema.sql` as a SQLite schema snapshot plus a sample SQLite database attachment for planning analysis.
- `src-tauri/src/main.rs` still exposes `load_i04_fixture`, embeds `desktop/fixtures/i04-approved-source-facts.json`, and returns that embedded JSON through the current desktop bridge.
- `desktop/main.js` still invokes `load_i04_fixture` and passes the returned object into `assembleApprovedSourceFactsProof` from `@ps01/source-authority-adapter.mjs`.
- `desktop/probes/i04-desktop-probe.mjs` still enforces the current screen/result contract: one supported `Backend Systems` result, one explicit unsupported `Mentoring` result, stable rendered ids, stable supporting ids, stable semantic positions, stable ordered sequence, and visible unsupported note.
- `src-tauri/Cargo.toml` has no SQLite dependency surface.
- `career_schema.sql` grounds persisted tables for `experience_records`, `evidence_items`, canonical tag vocabulary, and candidate profile surfaces, but it does not directly define the richer approved source-shaped contract fields currently consumed by `source-authority-adapter.mjs`, such as weighted `tag_links`, `experience_link.weight`, `taxonomy.tag_requirement_links`, `taxonomy.requirements`, or `taxonomy.target_regions`.
- The supplied sample SQLite database is now approved as the seam validation artifact under D1, but it is not yet present in the repo at the selected path `src-tauri/fixtures/career.db`.
- `.gitignore` now allowlists `src-tauri/fixtures/career.db`, but that file still does not exist in the workspace.

## Planned Seam

1. `I06-S1: Read-only SQLite source-authority extraction into the approved source-shaped contract`

Seam boundary:

- Replace the current embedded-fixture read in the Tauri bridge with a read-only SQLite-backed extraction that returns the same approved source-shaped object already consumed by `assembleApprovedSourceFactsProof`.
- Keep the current single-screen desktop flow and result contract intact at the behavior-parity level approved in PD-02: the screen still renders one supported `Backend Systems` result and one explicit unsupported `Mentoring` result when fed seam-approved SQLite source authority, while allowing DB-derived source ids and weights to differ from the synthetic fixture so long as the visible result contract and provenance shape remain intact.
- First-seam scope under PD-02 is limited to reading `experience_records`, `evidence_items`, and canonical tag vocabulary from SQLite. Profiles and settings remain unused in this seam.
- Label derivation under PD-02 is seam-local and deterministic: experience label is `canonical_scope_summary` falling back to `organization · title`; evidence label is `evidence_note` falling back to `claim`.
- Weight derivation under PD-02 is seam-local and deterministic: record-tag links weigh `1`, evidence-tag links weigh `2`, and evidence-to-experience links weigh `1`.
- Taxonomy authority under PD-02 is split for the first seam: SQLite supplies canonical tag vocabulary, while a separate semantic overlay supplies `tag_requirement_links`, `requirements`, and `target_regions` for the current runtime contract.
- Bridge naming under PD-02 should move from fixture-specific naming to a generic source-authority load path when implementation begins.
- Do not modify `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs` inside this seam unless a separate admissibility question is opened first.

Upstream dependency:

- The seam depends on the repo-local sanitized sample DB at `src-tauri/fixtures/career.db`, plus implementation of the approved PD-02 mapping contract for labels, weights, canonical tag vocabulary, and semantic overlay.

Downstream consequence:

- If later implemented with those artifacts, the repo may truthfully claim the desktop seam reads real SQLite-backed source authority through the Tauri bridge while preserving the current approved source-shaped contract and current result contract. Until then, the bridge remains fixture-only.

## Non-Goals

- No SQLite dependency, query, bridge, or storage implementation in this bundle.
- No invention of SQLite schema, seed data, or contract from fixture behavior alone.
- No silent adoption of old deterministic prototype taxonomy tables as the new semantic requirement-region contract without an explicit decision.
- No changes to `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs`.
- No widening of the first seam to `candidate_profiles`, `candidate_profile_*`, or settings usage.
- No write path, migration, mutating storage, caching, auth, deployment, network, telemetry, cloud, or broader desktop architecture work.
- No update to `harness/open-decisions.md` unless the supplied basis artifacts later force a real approval-boundary question.

## Acceptance Criteria

- This bundle remains planning-only and names exactly one future implementation seam: `I06-S1`.
- The bundle states explicitly that only planning is admissible now and that SQLite implementation is blocked on materializing the approved D1 sample database into the repo-local path.
- The future seam is constrained to read-only SQLite extraction into the current approved source-shaped contract and current desktop result contract.
- The bundle preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` as unchanged surfaces unless a new admissibility question is opened.
- The bundle includes one explicit named desktop acceptance probe for later implementation and one explicit blocker owned outside this bundle.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: proposed and blocked for implementation; planning-only is the only admissible posture now.
- Dominant fact: real SQLite-backed source-authority wiring matches project direction, the user has supplied real SQLite basis evidence, and PD-02 resolves the seam contract. The remaining blocker is getting the sanitized sample DB into the approved repo-local validation path so the seam can be implemented and verified truthfully.
- User-facing acceptance for the later seam: from the same existing desktop screen, the operator can run the current analysis flow against SQLite-backed source authority and still see supported `Backend Systems` plus explicit unsupported `Mentoring`, with the same requirement-result visibility, visible provenance and path shape, and unsupported-note visibility now locked by the live desktop probe, while allowing DB-derived supporting ids and exact path weights to differ from the synthetic fixture under the approved behavior-parity contract.
- Truth rule: a SQLite connection alone is not acceptable evidence. The later seam is only complete when the live desktop acceptance probe passes end to end without fixture fallback and while preserving the approved behavior-parity contract.

## Current Repo Runtime State

- The current Tauri bridge is fixture-only and returns embedded JSON from `load_i04_fixture`.
- The current desktop presenter is already wired to the thin approved-source adapter in `proof-slices/ps01/source-authority-adapter.mjs`.
- The current live desktop probe already proves the visible screen/result contract, but only against embedded fixture data.
- No Rust SQLite dependency or repo-local sample DB currently anchors a real source-authority seam inside the workspace.

## Assumptions And Unknowns

- The approved long-term source authority remains SQLite because PD-01 still governs.
- The current fixture and adapter together show the shape the desktop seam expects, while the supplied schema and sample database now partially ground the SQLite side of the seam.
- A later read-only seam is likely admissible without changing proof-slice code if the supplied SQLite basis artifacts map cleanly to the existing source-shaped contract.
- The chosen PD-02 mapping contract is sufficient for the first seam unless the sample DB contents prove incompatible with it once the DB becomes repo-local.

## Affected And Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-06-plan.md` and `harness/implementation-projects/active/implementation-06-tracker.md`.
- Affected when later implementation is authorized: `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`, the live desktop probe surface, the sample SQLite database at `src-tauri/fixtures/career.db`, and any explicit semantic overlay surface approved for the seam.
- Read-only dependency surfaces: `desktop/main.js`, `desktop/probes/i04-desktop-probe.mjs`, `desktop/fixtures/i04-approved-source-facts.json`, `proof-slices/ps01/source-authority-adapter.mjs`, `proof-slices/ps01/runtime-core.mjs`, `harness/open-decisions.md`, and the governing project-spec docs.
- Non-affected: archived implementation bundles, open decisions for now, current UI layout, proof-slice behavior surfaces, write-path/storage-mutation surfaces, auth, deployment, cloud, telemetry, AI, embeddings, and any broader app topology work.

## Verification Contract Summary

- Named falsifiable later acceptance probe: `I06 Desktop Probe: SQLite Source Authority Preserves I04 Result Contract`.
- Probe shape: given the repo-local sanitized sample DB at `src-tauri/fixtures/career.db`, the desktop probe runs the same single-screen analysis flow through a read-only SQLite-backed Tauri bridge instead of `load_i04_fixture`, then still reports `runtimeError: null`, supported `Backend Systems`, unsupported `Mentoring`, `renderedResultIds` of `req-backend-systems` and `req-mentoring`, visible provenance and path shape, and a visible unsupported note. Under the approved behavior-parity boundary, DB-derived supporting ids and exact path weights may differ from the synthetic fixture so long as the visible result contract remains intact and evidence-bounded.
- Required precondition: the sanitized sample DB is repo-local and the bridge implements PD-02 without fixture fallback.
- Failure rule: the later seam fails if it falls back to embedded fixture data, changes the current visible result contract, widens the first seam beyond PD-02, requires proof-slice edits, or cannot explain the SQLite-to-source-shape mapping from the approved schema and sample DB.

## Completion Rule

- Do not start SQLite implementation from this bundle alone.
- Do not treat fixture shape, adapter expectations, project direction, or the raw old-prototype schema as a substitute for an explicit approved mapping contract.
- Do not treat an attached-but-not-repo-local sample DB as sufficient seam evidence for implementation or verification.
- Do not mark implementation-06 complete until the blocker is resolved, the one planned seam is implemented, and the named desktop probe passes against real SQLite-backed data.

## Approval Gates

- No approval gate is crossed by creating this planning bundle.
- Future implementation must stop for approval if the supplied basis artifacts force a new schema, storage, compatibility, or broad-architecture question that is not already covered by the governing spec and PD-01.

## Handoff Packet For The Next Agent

- Goal: implement only `I06-S1` after the sanitized sample DB is added at `src-tauri/fixtures/career.db`.
- Preserve unchanged: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, the current desktop UI contract, and the current supported-versus-unsupported result contract.
- Required missing input: the sanitized sample DB committed at `src-tauri/fixtures/career.db`.
- Touch budget when later authorized: the Tauri Rust bridge, Rust dependency surface, the narrowest probe-facing changes needed to prove the same current desktop result contract against SQLite-backed data, and one explicit semantic overlay surface for `tag_requirement_links`, `requirements`, and `target_regions`.
- Required proof before closeout: the named probe `I06 Desktop Probe: SQLite Source Authority Preserves I04 Result Contract` passes end to end without fixture fallback.
- Explicit stop rule: if the sample DB is not made repo-local, or if the supplied SQLite basis implies contract drift that would touch the ps01 proof surfaces, stop and open a fresh admissibility question before implementation.

## Closeout Note

- This active bundle is admissible only as planning until the sanitized sample DB is repo-local at the approved path.
- When the blocker is resolved and the seam later completes, move the bundle from `active/` to `archive/`.