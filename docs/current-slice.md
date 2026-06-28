# Current Slice: Add the Curated Scenario Library

## Source Context

Phase 4 Task 8: Add the Curated Scenario Library.

Tasks 1 through 7 are complete. The project now has a versioned Scenario V1 contract, deterministic serialization, untrusted JSON validation, atomic replay, and semantic import/export round trips. This slice adds a deliberately small set of checked-in raw scenario documents that exercise representative draft and recommendation behavior through exactly those public boundaries.

The library is regression-oriented developer data, not a scenario-management product. It receives no special draft construction, validation, replay, or recommendation path.

## Goal

Add two version-controlled Scenario V1 JSON documents and a tiny catalog that imports each through the public parser/validator/replay path, covering an early non-default pressure case and a completed draft with exact deterministic assertions.

## Scope

### Goals

- Add a small checked-in curated scenario catalog.
- Store each scenario as raw portable Scenario V1 JSON.
- Route every curated document through `importScenarioV1Json`.
- Cover an early-draft baseline in a valid non-default league.
- Make the early scenario exercise roster need, tier or scarcity pressure, and observed positional-run pressure together.
- Cover a completed draft and empty post-completion recommendations.
- Give each scenario stable metadata describing its regression purpose.
- Assert exact reconstructed draft invariants and important recommendation output.
- Prove repeated loads are deterministic and return fresh reconstructed values.
- Keep ranking snapshots embedded and intentionally small.

### Non-Goals

- A special hard-coded draft setup or direct `ScenarioV1` object path for curated data.
- Generating curated scenarios at runtime with builders or workspace exporters.
- Bypassing JSON parsing, validation, or replay because files are checked in.
- Adding new recommendation behavior or tuning solely to make a scenario interesting.
- Exhaustive positional, roster, or league combinations.
- User-created scenario collections, search, filtering, cloud storage, or persistence.
- Scenario selector, import/export controls, or other workbench UI.
- Ranking management or importing external ranking formats.
- Reset/restart or transient scenario-session state.
- Adding package dependencies.
- Beginning Phase 4 Task 9.

## Curated Scenario Set

Use two scenario documents so every file has a clear regression purpose while the slice remains comfortably reviewable.

### 1. Early Non-Default Pressure

File: `src/data/scenarios/early-non-default-pressure.json`

Purpose:

- Establish an early-draft baseline after a short ordered history.
- Prove a non-default team count, roster construction, round count, and user draft position.
- Put the user roster in a clear need state.
- Create a recent positional run.
- Leave a thin tier or scarcity condition at the needed position.
- Produce at least one recommendation whose existing structured components demonstrate the intended pressure case.

Use a compact supported snake/PPR setup, preferably four teams and no more than four rounds. Include only the rankings required to satisfy draft capacity and make the recommendation behavior deterministic. The history should be long enough to create observed run evidence but still represent an early draft.

The final authored fixture must demonstrate, through existing engine output rather than metadata claims:

- A non-zero `roster_fit` component for an important recommendation.
- A non-zero `positional_run` component for a relevant position.
- At least one non-zero `tier_cliff` or `positional_scarcity` component.
- A stable recommendation order and total for the primary expected player.

One scenario may cover these related pressure behaviors together; do not add separate near-duplicate files merely to isolate each component.

### 2. Completed Draft

File: `src/data/scenarios/completed-draft.json`

Purpose:

- Replay a full valid history through the final configured pick.
- Prove completed draft shape, assignments, current-pick behavior, and invariants.
- Prove no rankings remain available and recommendations are empty.

Use the smallest clear supported configuration, such as two teams with a two-slot roster, and an embedded ranking entry for every pick.

## Raw JSON Requirements

Each file must:

- Be a standalone Scenario V1 document with `schemaVersion: 1`.
- Use stable metadata ID, name, description, and regression-oriented tags.
- Omit provenance unless it adds real informational value; curated identity already comes from metadata and catalog key.
- Carry canonical generated `LeagueSettings`, teams, user-team ID, rankings, ordered pick history, optional assertions, and replay target.
- Use canonical roster slot IDs, labels, eligibility, and order produced by `buildLeagueSetup`.
- Include expected pick number and expected team ID on every history entry.
- Contain no comments, trailing commas, derived draft state, recommendations, persistence IDs, or UI state.
- Remain well below all fixed Scenario V1 safety limits.

During implementation, use existing builders and serializer in a temporary local test/debug workflow if helpful to author correct JSON, but commit only the canonical JSON documents. Do not add a generator script or a second setup path to production.

## Catalog Boundary

Add `src/lib/curatedScenarios.ts`.

Because `resolveJsonModule` is already enabled, import the two JSON documents as unknown raw data and serialize them back to JSON text for the public import boundary. Do not cast either document to `ScenarioV1`.

Use a small public shape equivalent to:

```ts
export const CURATED_SCENARIO_IDS = [
  "early-non-default-pressure",
  "completed-draft",
] as const;

export type CuratedScenarioId =
  (typeof CURATED_SCENARIO_IDS)[number];

export type CuratedScenarioCatalogEntry = {
  id: CuratedScenarioId;
  json: string;
};

export const curatedScenarioCatalog: CuratedScenarioCatalogEntry[];

export function loadCuratedScenario(
  id: CuratedScenarioId,
): ImportScenarioV1Result;
```

Catalog construction should:

- Keep the stable ID order shown above.
- Pair each ID with `JSON.stringify(importedDocument)`.
- Avoid exposing imported objects as trusted typed scenarios.
- Avoid parsing metadata separately for display; Task 11 can use the normalized successful import when UI integration begins.

`loadCuratedScenario` should find the matching catalog entry and call `importScenarioV1Json(entry.json)`. The `CuratedScenarioId` union makes an unknown ID impossible for normal TypeScript callers, so no new missing-ID result variant is required.

Do not cache imported/replayed results. Loading the same scenario twice should independently traverse validation and replay and return fresh equal values.

## Public-Path Requirement

The only supported flow is:

```text
checked-in JSON document
        |
        v
JSON.stringify(raw imported module)
        |
        v
importScenarioV1Json
        |
        +--> parseScenarioV1Json
        |
        +--> replayScenarioV1
        |
        v
normalized scenario + draft + recommendations
```

Do not call `replayScenarioV1` directly on imported JSON, cast JSON to `ScenarioV1`, hydrate final state, or reproduce validation in the catalog.

## Exact Regression Assertions

Tests should use exact assertions where output is deterministic.

For every curated scenario, assert:

- Import succeeds through `loadCuratedScenario`.
- Normalized metadata ID equals the catalog ID.
- Schema version, settings, user-team identity, applied-pick count, drafted count, current pick, and assigned player order are exact.
- Draft invariants pass with the derived available rankings.
- Repeated loads return deeply equal results but distinct scenario, draft, and recommendation array references.

For `early-non-default-pressure`, additionally assert:

- Exact dynamic team count and rounds.
- Exact user-team pick identities at the target.
- Exact available-player identities relevant to the regression.
- Exact primary recommendation player ID, total score, and returned position.
- Exact relevant component deltas for `roster_fit`, `positional_run`, and either `tier_cliff` or `positional_scarcity`.
- Exact score-backed reason IDs/text only where the current engine emits them deterministically.

For `completed-draft`, additionally assert:

- Applied pick count equals configured capacity.
- Every generated pick has a player ID.
- Assigned player IDs remain unique and in expected order.
- Available rankings and recommendations are empty.

If the proposed early fixture does not naturally produce the intended current-engine components, adjust only its settings, rankings, tiers, or history. Do not modify recommendation production code in this slice.

## Testing Strategy

Add `src/lib/curatedScenarios.test.ts`.

### Required Test Cases

1. Catalog IDs are stable, unique, and match normalized scenario metadata IDs.
2. Every catalog entry passes the same import/validation/replay path as external JSON.
3. Every curated scenario replays deterministically on repeated load.
4. Repeated results are fresh values rather than cached shared state.
5. Every reconstructed draft satisfies existing invariants.
6. The early scenario has exact non-default settings, target draft state, availability, and recommendation order.
7. The early scenario proves non-zero roster need, observed-run pressure, and tier/scarcity pressure through structured component output.
8. The completed scenario has exact capacity, complete assignments, no availability, and no recommendations.
9. Raw JSON documents contain no authoritative derived fields such as rosters, availability, current pick, completion, or recommendations.
10. Every JSON document remains inside the fixed safety limits through normal validation.

Prefer a parameterized base test over duplicated assertions. Keep scenario-specific expectations in small named blocks so engine regressions are easy to diagnose.

## Implementation Steps

1. Author `src/data/scenarios/early-non-default-pressure.json` as a canonical valid Scenario V1 document whose existing recommendation output demonstrates the combined early pressure case.
2. Author `src/data/scenarios/completed-draft.json` as a canonical valid completed scenario.
3. Add `src/lib/curatedScenarios.ts` with stable IDs, raw JSON strings, and public import-based loading.
4. Add `src/lib/curatedScenarios.test.ts` with parameterized public-path checks, exact state/invariant assertions, exact early recommendation evidence, completion checks, and determinism/freshness coverage.
5. Run focused curated, portability, validation, replay, workflow, scenario-recommendation, and recommendation tests, then the full suite, lint, and TypeScript validation.
6. If all acceptance criteria and validation pass, check only Phase 4 Task 8 complete in `docs/tasks.md`. Do not begin Task 9.

## Expected Files

- `src/data/scenarios/early-non-default-pressure.json`
- `src/data/scenarios/completed-draft.json`
- `src/lib/curatedScenarios.ts`
- `src/lib/curatedScenarios.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 8 complete after validation passes

This five-file blast radius is intentional: two representative documents cover all required scenario categories without a broad fixture collection.

Do not modify the Scenario V1 contract, serializer, validator, portability layer, replay coordinator, Draft State Engine, Recommendation Engine, domain types, repository, Prisma, actions, or UI. If an existing public boundary cannot load a correctly authored curated document, stop and report the exact conflict rather than adding a privileged path.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/curatedScenarios.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/draftWorkflow.test.ts src/lib/recommendations.scenario.test.ts src/lib/recommendations.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused curated and supporting scenario/recommendation regression tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because this slice adds version-controlled data and a pure loader without UI or persistence integration. Automated public-path loading and exact regression assertions are the acceptance evidence.

## Acceptance Criteria

- The catalog contains exactly the two approved representative Scenario V1 documents.
- Together they cover early baseline, roster need, tier/scarcity pressure, observed run pressure, completed state, and dynamic non-default settings.
- Every document passes the same parser, validator, and replay coordinator as imported JSON.
- No curated scenario receives a direct typed, hydration, or hard-coded final-state path.
- Metadata clearly states each scenario's regression purpose.
- Embedded rankings are self-contained, small, and sufficient for configured capacity.
- Repeated loads produce equal deterministic draft and recommendation output with fresh values.
- Exact draft invariants and scenario-specific recommendation behavior are asserted.
- The early scenario proves its intended pressure behavior through existing structured engine components.
- The completed scenario has no available players or recommendations.
- Raw scenario data contains source inputs only and stays within fixed safety limits.
- No recommendation behavior, persistence, ranking management, package dependency, or UI is introduced.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- Only Phase 4 Task 8 is checked complete after implementation validation.
- Task 9 is not started.

## Failure Handling

- If raw JSON import typing requires a local `unknown` annotation, keep it in the catalog; do not cast the document to `ScenarioV1`.
- If a curated file fails validation, correct the file's settings, identities, rankings, assertions, history, or target; do not bypass or weaken validation.
- If replay fails, correct the authored ordered inputs; do not hydrate picks directly.
- If the early fixture does not produce the intended components, tune only fixture inputs and retain existing Recommendation Engine behavior.
- If an exact recommendation assertion reveals an unrelated engine defect, report it without changing the engine in this slice.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 9: Add Recommendation Diagnostics and Debugger. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. Two complementary files cover all required representative cases without creating a fixture warehouse.
- Concrete enough for implementation: yes. File purposes, public loading flow, catalog API, exact assertions, tests, and failure handling are explicit.
- Avoids unnecessary architecture changes: yes. Static JSON flows through completed public portability boundaries with only a tiny catalog.
- Blast radius reasonable: yes. Two data files, one loader, one test, and the completion checkbox total five files.
- Review/revert comfort: yes. The slice is additive, local, deterministic, and has no runtime UI or persistence integration.
- Observable/testable acceptance criteria: yes. Public-path success, exact state, structured recommendation evidence, completion, invariants, and repeatability are directly asserted.
