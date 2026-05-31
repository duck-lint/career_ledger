# Implementation 06 Plan

## Intent

Implementation-06 opens exactly one planning-only seam for the first real SQLite-backed source-authority extraction into the existing approved source-shaped contract already consumed by the desktop seam. This aligns with the approved project direction in PD-01, but implementation is not yet admissible because the repo does not currently provide authoritative SQLite basis artifacts such as a schema snapshot, sample database, or authoritative source contract. This bundle does not authorize SQLite implementation yet.

## Admissibility Report

- Invariant constraints: Canonical persisted authority stays limited to `experience_records`, `evidence_items`, taxonomy, profiles, and settings. Semantic projection, traversal, target-region selection, ranked paths, and assembled output remain runtime-only, deterministic, explainable, and evidence-bounded. Unsupported requirements remain visible. No AI, embeddings, network, telemetry, cloud behavior, workflow-status state, persisted semantic workspaces, or transition tables may be introduced.
- Task constraints: This bundle is planning-only and must define exactly one future seam for read-only SQLite extraction into the current approved source-shaped contract. `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` must remain unchanged unless a separate admissibility question is opened later. `harness/open-decisions.md` stays unchanged unless a real new approval-boundary question appears.
- Constraint conflicts: Project direction explicitly retains SQLite as source authority, but current repo evidence stops at an embedded fixture bridge plus adapter-inferred source shape. No repo-local authoritative SQLite schema snapshot, sample database, or authoritative source contract exists to make the first real SQLite bridge truthful, reviewable, or falsifiable.
- Allowed transformation types: Create the planning bundle now; later, only after authoritative SQLite basis artifacts are supplied, implement one read-only Tauri extraction seam that maps SQLite-backed source facts into the existing approved source-shaped contract without changing the current desktop result contract.
- Affected surfaces: This plan/tracker bundle now. If later authorized, the seam must move together across the Tauri bridge surface in `src-tauri/src/main.rs`, the Rust dependency surface in `src-tauri/Cargo.toml`, the live desktop probe surface, and the repo-local authoritative SQLite basis artifact supplied for the seam.
- Non-affected surfaces: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, current fixture semantics, project spec, governance, `harness/open-decisions.md`, archived bundles, UI layout, schema invention beyond the supplied basis artifacts, write paths, migrations, auth, deployment, network, telemetry, cloud, and any broader desktop IA work.
- Admissibility checks: Only the planning bundle is admissible now. Future implementation becomes admissible only if the repo receives authoritative SQLite basis artifacts that let the seam prove a read-only extraction into the current approved source-shaped contract without inventing schema from the fixture, without changing the current desktop result contract, and without forcing proof-slice edits.
- Stop conditions: Stop before implementation if the seam still lacks a repo-local schema snapshot, sample database, or authoritative source contract; if SQLite wiring would require inventing canonical tables or source shape from fixture behavior alone; if the bridge would need to change `runtime-core.mjs` or `source-authority-adapter.mjs`; or if the supplied basis artifacts expose a new schema, storage, compatibility, or architecture approval-boundary question.

## Observed Evidence

- `harness/project-spec/career-ledger-project-spec.md` and `harness/project-spec/career-ledger-governance-primitives.md` remain the governing invariant authority.
- `harness/open-decisions.md` still records `PD-01` as current and explicitly preserves SQLite as source authority.
- `harness/implementation-projects/archive/implementation-05-summary.md` records the hardened desktop seam as complete and archived, and `harness/implementation-projects/active/` contained only `.gitkeep` before this bundle.
- `src-tauri/src/main.rs` still exposes `load_i04_fixture`, embeds `desktop/fixtures/i04-approved-source-facts.json`, and returns that embedded JSON through the current desktop bridge.
- `desktop/main.js` still invokes `load_i04_fixture` and passes the returned object into `assembleApprovedSourceFactsProof` from `@ps01/source-authority-adapter.mjs`.
- `desktop/probes/i04-desktop-probe.mjs` still enforces the current screen/result contract: one supported `Backend Systems` result, one explicit unsupported `Mentoring` result, stable rendered ids, stable supporting ids, stable semantic positions, stable ordered sequence, and visible unsupported note.
- `src-tauri/Cargo.toml` has no SQLite dependency surface.
- The workspace scan found no repo-local checked-in `.sql`, `.sqlite`, `.sqlite3`, or `.db` basis artifact, and the current authoritative source shape is therefore observable only from the fixture plus adapter expectations rather than from a SQLite authority artifact.

## Planned Seam

1. `I06-S1: Read-only SQLite source-authority extraction into the approved source-shaped contract`

Seam boundary:

- Replace the current embedded-fixture read in the Tauri bridge with a read-only SQLite-backed extraction that returns the same approved source-shaped object already consumed by `assembleApprovedSourceFactsProof`.
- Keep the current single-screen desktop flow and result contract intact: the screen still renders one supported `Backend Systems` result and one explicit unsupported `Mentoring` result when fed seam-approved SQLite source authority.
- Do not modify `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs` inside this seam unless a separate admissibility question is opened first.

Upstream dependency:

- The seam depends on repo-local authoritative SQLite basis artifacts: a schema snapshot, sample database, or authoritative source contract that defines how SQLite source authority maps to the existing approved source-shaped contract.

Downstream consequence:

- If later implemented with those artifacts, the repo may truthfully claim the desktop seam reads real SQLite-backed source authority through the Tauri bridge while preserving the current approved source-shaped contract and current result contract. Until then, the bridge remains fixture-only.

## Non-Goals

- No SQLite dependency, query, bridge, or storage implementation in this bundle.
- No invention of SQLite schema, seed data, or contract from fixture behavior alone.
- No changes to `proof-slices/ps01/runtime-core.mjs` or `proof-slices/ps01/source-authority-adapter.mjs`.
- No write path, migration, mutating storage, caching, auth, deployment, network, telemetry, cloud, or broader desktop architecture work.
- No update to `harness/open-decisions.md` unless the supplied basis artifacts later force a real approval-boundary question.

## Acceptance Criteria

- This bundle remains planning-only and names exactly one future implementation seam: `I06-S1`.
- The bundle states explicitly that only planning is admissible now and that SQLite implementation is blocked on authoritative basis artifacts.
- The future seam is constrained to read-only SQLite extraction into the current approved source-shaped contract and current desktop result contract.
- The bundle preserves `proof-slices/ps01/runtime-core.mjs` and `proof-slices/ps01/source-authority-adapter.mjs` as unchanged surfaces unless a new admissibility question is opened.
- The bundle includes one explicit named desktop acceptance probe for later implementation and one explicit blocker owned outside this bundle.

## Delivery Posture And User-Facing Acceptance Criteria

- State of this bundle: proposed and blocked for implementation; planning-only is the only admissible posture now.
- Dominant fact: real SQLite-backed source-authority wiring matches project direction, but the repo still lacks authoritative SQLite basis artifacts, so implementation would otherwise be guesswork over a fixture-shaped contract.
- User-facing acceptance for the later seam: from the same existing desktop screen, the operator can run the current analysis flow against SQLite-backed source authority and still see supported `Backend Systems` plus explicit unsupported `Mentoring`, with the same rendered result ids, supporting ids, semantic positions, ordered sequence, and unsupported-note visibility now locked by the live desktop probe.
- Truth rule: a SQLite connection alone is not acceptable evidence. The later seam is only complete when the live desktop acceptance probe passes end to end without fixture fallback and without changing the approved source-shaped contract.

## Current Repo Runtime State

- The current Tauri bridge is fixture-only and returns embedded JSON from `load_i04_fixture`.
- The current desktop presenter is already wired to the thin approved-source adapter in `proof-slices/ps01/source-authority-adapter.mjs`.
- The current live desktop probe already proves the visible screen/result contract, but only against embedded fixture data.
- No Rust SQLite dependency or repo-local authoritative SQLite basis artifact currently anchors a real source-authority seam.

## Assumptions And Unknowns

- The approved long-term source authority remains SQLite because PD-01 still governs.
- The current fixture and adapter together show the shape the desktop seam expects, but they are not authoritative evidence for the real SQLite schema or extraction contract.
- A later read-only seam is likely admissible without changing proof-slice code if the supplied SQLite basis artifacts map cleanly to the existing source-shaped contract.
- It is unknown whether the future authoritative SQLite basis exposes all currently observed fields exactly as the fixture does, or whether a separate admissibility question will be needed for contract drift.

## Affected And Non-Affected Surfaces

- Affected now: `harness/implementation-projects/active/implementation-06-plan.md` and `harness/implementation-projects/active/implementation-06-tracker.md`.
- Affected when later implementation is authorized: `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`, the live desktop probe surface, and the supplied authoritative SQLite basis artifact.
- Read-only dependency surfaces: `desktop/main.js`, `desktop/probes/i04-desktop-probe.mjs`, `desktop/fixtures/i04-approved-source-facts.json`, `proof-slices/ps01/source-authority-adapter.mjs`, `proof-slices/ps01/runtime-core.mjs`, `harness/open-decisions.md`, and the governing project-spec docs.
- Non-affected: archived implementation bundles, open decisions for now, current UI layout, proof-slice behavior surfaces, write-path/storage-mutation surfaces, auth, deployment, cloud, telemetry, AI, embeddings, and any broader app topology work.

## Verification Contract Summary

- Named falsifiable later acceptance probe: `I06 Desktop Probe: SQLite Source Authority Preserves I04 Result Contract`.
- Probe shape: given a repo-local authoritative SQLite basis artifact for the approved source-authority categories, the desktop probe runs the same single-screen analysis flow through a read-only SQLite-backed Tauri bridge instead of `load_i04_fixture`, then still reports `runtimeError: null`, supported `Backend Systems`, unsupported `Mentoring`, `renderedResultIds` of `req-backend-systems` and `req-mentoring`, supporting ids of `exp-payments`, `evidence-adr`, and `evidence-runbook`, semantic positions of `source-experience`, `source-evidence`, `semantic-tag`, and `target-requirement`, the same ordered sequence, and a visible unsupported note.
- Required precondition: the repo must first receive an authoritative SQLite schema snapshot, sample database, or authoritative source contract that lets the bridge prove this behavior without inventing storage truth from the fixture.
- Failure rule: the later seam fails if it falls back to embedded fixture data, changes the current screen/result contract, requires proof-slice edits, or cannot explain the SQLite-to-source-shape mapping from authoritative basis artifacts.

## Completion Rule

- Do not start SQLite implementation from this bundle alone.
- Do not treat fixture shape, adapter expectations, or project direction as a substitute for authoritative SQLite basis artifacts.
- Do not mark implementation-06 complete until the blocker is resolved, the one planned seam is implemented, and the named desktop probe passes against real SQLite-backed data.

## Approval Gates

- No approval gate is crossed by creating this planning bundle.
- Future implementation must stop for approval if the supplied basis artifacts force a new schema, storage, compatibility, or broad-architecture question that is not already covered by the governing spec and PD-01.

## Handoff Packet For The Next Agent

- Goal: implement only `I06-S1` after authoritative SQLite basis artifacts are supplied.
- Preserve unchanged: `proof-slices/ps01/runtime-core.mjs`, `proof-slices/ps01/source-authority-adapter.mjs`, the current desktop UI contract, and the current supported-versus-unsupported result contract.
- Required missing inputs: one authoritative SQLite schema snapshot, one repo-local sample database, or one authoritative source contract that maps SQLite truth into the existing approved source-shaped object.
- Touch budget when later authorized: the Tauri Rust bridge, Rust dependency surface, and the narrowest probe-facing changes needed to prove the same current desktop result contract against SQLite-backed data.
- Required proof before closeout: the named probe `I06 Desktop Probe: SQLite Source Authority Preserves I04 Result Contract` passes end to end without fixture fallback.
- Explicit stop rule: if the missing basis artifacts are not supplied, or if they imply contract drift that would touch the ps01 proof surfaces, stop and open a fresh admissibility question before implementation.

## Closeout Note

- This active bundle is admissible only as planning until authoritative SQLite basis artifacts arrive.
- When the blocker is resolved and the seam later completes, move the bundle from `active/` to `archive/`.