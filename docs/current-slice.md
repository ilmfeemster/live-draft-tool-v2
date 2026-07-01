# Current Slice: Tier Semantics Patch Slice 3 - Scenario V1 Compatibility

## Completion Status

Planned. Awaiting implementation approval.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 3.
- Approved design: `docs/design/tier-semantics.md`, especially Scenario V1 compatibility and recommendation behavior.
- Completed prerequisite: source-only, absent, neutral, and legacy ranking-set values reach the engine as neutral tiers.
- Completed prerequisite: new draft snapshot envelopes preserve explicit eligibility, while legacy snapshot arrays hydrate neutral.
- Completed prerequisite: neutral engine-facing tiers produce no tier score component or reason.
- Current Scenario V1 facts:
  - the format embeds only `RankingEntry[]` and has no tier-semantics metadata;
  - `scenarioValidation` parses entry `tier` values unchanged;
  - `scenarioReplay` passes those values directly to `generatePlayerRecommendations`;
  - transient sessions retain the parsed scenario rankings and reuse them for later local picks, undo, reset, and restart;
  - the curated early-pressure fixture contains tier gaps and currently asserts an invalid tier-cliff component/reason;
  - direct recommendation scenario tests also use non-neutral tiers, but those are engine tests rather than Scenario V1 portability tests and must retain valid explicit-tier coverage.

## Goal

Keep Scenario V1 files loadable, replayable, and deterministic while treating every embedded `tier` value as legacy ambiguous and materializing neutral recommendation tiers before any Scenario V1 recommendation evaluation.

## Scope

### Goals

- Add one pure Scenario V1 ranking compatibility mapper.
- Parse Scenario V1 ranking entries through that mapper after existing structural validation.
- Return parsed `ScenarioV1` values whose engine-facing tiers are all `NEUTRAL_TIER`.
- Defensively apply the same mapper in `replayScenarioV1` for typed scenarios created without the JSON parser.
- Ensure transient sessions and later local recomputation continue using neutralized rankings.
- Preserve ranking order, player data, overall rank, position rank, ADP, league settings, draft configuration, pick history, replay target, and metadata.
- Preserve deterministic replay and exact score/component reconciliation.
- Keep replay independent from ranking-set persistence, snapshot persistence, and database access.

### Non-Goals

- Do not create Scenario V2 or add tier-semantics fields to Scenario V1.
- Do not preserve ambiguous Scenario V1 tier numbers as new source metadata.
- Do not rewrite curated scenario JSON fixtures merely to make their tier values cosmetic.
- Do not change Scenario V1 document selection, schema version, or serialization shape.
- Do not change Canonical Ranking JSON or persisted draft snapshot behavior.
- Do not change recommendation scoring, factors, weights, caps, component priorities, or reason generation.
- Do not remove valid positive tier-pressure tests that call the Recommendation Engine with explicit non-neutral tiers.
- Do not add ranking-set or database lookups to parsing, replay, or sessions.
- Do not update dependencies, data files, `docs/tasks.md`, or unrelated documentation.

## Compatibility Decisions

- Scenario V1 `tier` values are always legacy ambiguous because the format has no eligibility metadata.
- The parsed in-memory `ScenarioV1.rankingContext.rankings` becomes the compatibility boundary output: all entries use `NEUTRAL_TIER`.
- The mapper copies every entry and nested player object. It must not mutate the parsed JSON value or a caller-supplied typed scenario.
- Raw ambiguous tier numbers are not retained in `ScenarioV1`; source-tier portability requires a future Scenario V2 and is outside this patch.
- `replayScenarioV1` rematerializes neutral rankings defensively before calling the engine. This protects direct typed callers without changing replay output shape.
- Transient scenario sessions use the already-neutral parsed scenario rankings, so local picks, undo, reset, and restart cannot restore ambiguous tier pressure.
- Scenario V1 export/serialization remains shape-compatible. A subsequently imported Scenario V1 document is neutralized regardless of the numeric tier values written by an older or current producer.
- `recommendations.scenario.test.ts` remains an engine-level suite. Its positive tier-cliff cases are not Scenario V1 compatibility cases and must continue passing unchanged.

## Implementation Steps

1. Add the pure Scenario V1 compatibility mapper.

   In `src/lib/scenarioValidation.ts`:

   - import `NEUTRAL_TIER` and the ranking-entry type;
   - export a narrowly named helper such as `materializeScenarioV1Rankings`;
   - accept `readonly RankingEntry[]` and return fresh `RankingEntry[]` values;
   - copy each player and every non-tier ranking field exactly;
   - set every output `tier` to `NEUTRAL_TIER`;
   - do not validate, reorder, derive, or mutate values in this helper.

2. Neutralize rankings during Scenario V1 parsing.

   In `parseRankings`:

   - retain the current array, size, non-empty, and typed-entry validation;
   - pass the successfully parsed entries through `materializeScenarioV1Rankings` before constructing `ScenarioV1`;
   - preserve all existing validation errors, paths, limits, consistency checks, and object-copy behavior;
   - do not add tier metadata to the parsed scenario.

3. Guard direct typed replay callers.

   In `src/lib/scenarioReplay.ts`:

   - materialize a local neutral ranking array before recommendation generation;
   - pass only that local array to `generatePlayerRecommendations`;
   - keep draft hydration, pick replay, rejection behavior, replay target selection, and result shape unchanged;
   - do not mutate `scenario.rankingContext.rankings` or replace the caller's scenario object.

4. Add parser compatibility tests.

   In `src/lib/scenarioValidation.test.ts`, add a valid Scenario V1 document containing multiple positions and non-neutral tier gaps, then prove:

   - parsing succeeds;
   - every parsed tier equals `NEUTRAL_TIER`;
   - all non-tier ranking fields remain exact and ordered;
   - the source document and its nested player values are unchanged;
   - existing malformed ranking and consistency diagnostics remain unchanged.

5. Add replay safety and determinism tests.

   In `src/lib/scenarioReplay.test.ts`, add a directly constructed Scenario V1 with same-position tier gaps that would otherwise create pressure, then prove:

   - replay succeeds without a tier-cliff component or reason;
   - repeated replay returns identical draft, ordering, scores, components, and reasons;
   - total scores reconcile with emitted components;
   - roster fit, scarcity, run pressure, value opportunity, base order, and pick replay behavior remain unchanged;
   - the caller's scenario and original tier values are not mutated.

6. Cover the full import and transient-session paths.

   In `src/lib/scenarioPortability.test.ts` and `src/lib/scenarioSession.test.ts`, prove:

   - imported non-neutral Scenario V1 JSON exposes only neutral tiers;
   - import recommendations contain no `tier_cliff` component or reason;
   - a local transient pick, undo, reset, and restart continue recomputing from neutral rankings;
   - scenario import/replay remains independent of mutable ranking sets and persistence;
   - existing metadata, provenance, draft state, and non-tier semantic round trips remain intact.

7. Correct curated Scenario V1 regression expectations.

   In `src/lib/curatedScenarios.test.ts`:

   - keep the existing curated JSON fixture unchanged;
   - retain assertions for league configuration, replay target, user picks, available-player order, and deterministic primary recommendation ordering unless observed non-tier behavior proves otherwise;
   - remove the expectation that the early-pressure fixture emits a tier-cliff component/reason;
   - assert the component and reason are absent;
   - update the exact score and remaining reason list only for the intentional removal of invalid tier pressure;
   - continue asserting roster need, positional run, scarcity, and other non-tier components exactly.

8. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/curatedScenarios.test.ts src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
   npx tsc --noEmit
   ```

   The recommendation suites are regression-only:

   - neutral-tier behavior must remain an explicit no-op;
   - direct engine tests with valid non-neutral recommendation tiers must retain positive tier-pressure coverage.

9. Finalize the slice after validation.

   If focused validation passes:

   - update this file's Completion Status to complete;
   - mark only Slice 3 complete in `docs/patches/tier-semantics-tasks.md`;
   - record the exact validation commands and results in the patch task file;
   - do not update `docs/tasks.md` or begin UI terminology work automatically.

## Expected Files

Production files:

- `src/lib/scenarioValidation.ts`
- `src/lib/scenarioReplay.ts`

Focused tests:

- `src/lib/scenarioValidation.test.ts`
- `src/lib/scenarioReplay.test.ts`
- `src/lib/scenarioPortability.test.ts`
- `src/lib/scenarioSession.test.ts`
- `src/lib/curatedScenarios.test.ts`

Tracking after successful implementation:

- `docs/current-slice.md`
- `docs/patches/tier-semantics-tasks.md`

Do not touch:

- `src/types/scenario.ts` or the Scenario V1 schema shape.
- `src/lib/scenarioSerialization.ts` unless implementation proves the unchanged writer bypasses the import compatibility boundary; stop and report before changing it.
- curated scenario JSON fixtures or other data files.
- recommendation production code or scoring constants.
- ranking import, ranking repository, draft snapshot, draft repository, Prisma, UI, or replay-independent production files.
- dependencies or `docs/tasks.md`.

## Tests

Required focused validation:

```text
npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/curatedScenarios.test.ts src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
npx tsc --noEmit
```

Expected result:

- Existing Scenario V1 documents continue parsing and replaying.
- Parsed and session-held Scenario V1 rankings are recommendation-neutral.
- Direct typed replay also cannot produce ambiguous tier pressure.
- Tier-cliff components and reasons are absent from Scenario V1 results.
- Non-tier components, ordering, pick replay, and score reconciliation remain deterministic.
- Explicit engine-level tier-pressure tests remain green.

## Manual QA

No browser QA is required for this pure compatibility/replay slice.

Manual code review should confirm:

- neutralization occurs before rankings enter session state or recommendation evaluation;
- the original Scenario V1 document and typed scenario are not mutated;
- no tier semantics are inferred from numeric values;
- replay performs no ranking-set or database lookup;
- Scenario V1 schema and fixture files are unchanged;
- Recommendation Engine behavior is unchanged.

## Acceptance Criteria

- Existing Scenario V1 fixtures continue to parse, import, replay, reset, restart, and support transient local picks.
- Every parsed Scenario V1 ranking uses `NEUTRAL_TIER` regardless of the embedded numeric tier.
- Direct typed Scenario V1 replay also treats embedded tiers as legacy ambiguous.
- Ambiguous Scenario V1 tiers produce no tier-drop score component or tier-cliff reason.
- Repeated replay of identical Scenario V1 input remains deterministic.
- Recommendation totals reconcile with emitted components after tier pressure is removed.
- Non-tier recommendation inputs, components, ordering, and replay state remain unchanged except where the removed invalid tier delta affected the final total or top-three reasons.
- Scenario replay remains independent of mutable ranking sets, persisted snapshots, and database access.
- Valid explicit non-neutral Recommendation Engine tests continue producing bounded tier pressure.
- No Scenario V2, schema, fixture, serialization-shape, canonical import, snapshot, persistence, scoring, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Required focused tests and `npx tsc --noEmit` pass.

## Failure Handling

- If parsed Scenario V1 rankings are consumed before `parseRankings` returns, stop and report that path before adding another neutralization point.
- If direct replay needs neutralization but importing the compatibility helper creates a module cycle, keep the helper in a tiny scenario-specific module; do not duplicate tier policy across parser and replay.
- If a curated scenario changes beyond the removed tier delta/reason, identify the exact non-tier difference and stop rather than broadly updating expectations.
- If a positive tier-pressure engine test fails, preserve that explicit engine contract; do not neutralize generic `RecommendationInput`.
- If unrelated scenario validation or replay tests fail, report them rather than weakening assertions or rewriting fixtures.
- Preserve unrelated worktree changes, including completed Canonical JSON and snapshot slices, and report any unsafe overlap.

## Follow-Up

After this slice is implemented and validated, the next slice is Tier Semantics Patch Slice 4 - Focused UI Terminology. It should correct affected user-facing tier labels and explanations without redesigning ranking-management screens. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. Parser and replay neutralization close the complete Scenario V1 recommendation path without changing the format.
- Executable by a lower-reasoning pass: yes. The compatibility rule, exact boundaries, tests, and failure behavior are explicit.
- Avoids unnecessary architecture changes: yes. No new scenario version, metadata model, persistence lookup, or scoring change is introduced.
- Blast radius reasonable: yes. Runtime changes stay in two existing scenario modules; remaining changes are focused regression tests and tracking.
- Review/revert comfort: yes. The mapper and defensive replay call are localized and fixture files remain unchanged.
- Observable/testable acceptance criteria: yes. Parsed tiers, component/reason absence, deterministic output, score reconciliation, and non-mutation are directly assertable.
