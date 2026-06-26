# Current Slice: Define Recommendation Engine Contract

## Source Task

Task 2: Define Recommendation Engine Contract.

## Goal

Create the domain-facing Recommendation Engine boundary and output model without coupling it to UI, persistence, or draft sources.

This slice should establish the contract that later Phase 3 scoring tasks will build on. It should not implement the full bounded additive scoring model or contextual modifiers yet.

## User-Visible Increment

- The codebase has a pure Recommendation Engine entry point that accepts full draft context.
- Recommendation output has the score, component, and reason structure needed by later scoring and explanation work.
- The engine excludes drafted players from recommendation results using draft state rather than relying on callers to pre-filter rankings.

## Current Context

`docs/tasks.md` defines Task 2 as the next Phase 3 implementation task after architecture documentation alignment.

Existing recommendation behavior lives in:

- `src/types/draft.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

The existing `generateTopRecommendations` helper takes already-filtered rankings plus limited roster options. This slice should add the new Phase 3 contract in a way that does not force the UI to adopt it yet.

The approved Phase 3 design establishes:

- A pure Recommendation Engine boundary.
- Inputs that include typed draft state, rankings, league settings, and user team identity.
- Outputs that include total score, base score, context score, score components, and reasons.
- Recommendation output is derived, not persisted.
- Recommendation logic must not depend on Prisma, server actions, React state, or database records.

## Scope

### Goals

- Add domain-facing recommendation input and output types.
- Add score component and reason types that later scoring tasks can populate.
- Add an engine-level tuning configuration type and default tuning config.
- Add a pure recommendation entry point that accepts draft, rankings, league settings, and user team id.
- Exclude drafted players inside the new engine entry point.
- Return deterministic output for identical inputs.
- Keep the new entry point independent from persistence, React, server actions, and draft sources.
- Add focused unit tests for the new contract.
- Preserve existing `generateTopRecommendations` behavior unless a small compatibility adjustment is required.

### Non-Goals

- Implementing the Phase 3 base score formula.
- Implementing roster fit, timing, value opportunity, tier-drop risk, scarcity, or run-pressure modifiers.
- Replacing the existing UI recommendation call site.
- Changing `DraftRoom` or recommendation presentation.
- Persisting recommendation output.
- Reading from Prisma, server actions, or repository code inside the engine.
- Introducing a generic modifier registry.
- Redesigning the approved recommendation engine.
- Updating `docs/tasks.md`.
- Updating project, architecture, decision, or design docs.

## Expected Files

- `docs/current-slice.md`
- `src/types/draft.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

Do not modify UI, persistence, Prisma, package, or task files during this slice unless a direct compile blocker requires a very small local adjustment.

## Implementation Steps

1. Review the active context.
   - Read `docs/current-slice.md`.
   - Read `docs/tasks.md`.
   - Read `docs/design/recommendation-engine.md`.
   - Read `src/types/draft.ts`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Add recommendation contract types.
   - In `src/types/draft.ts`, add a new `RecommendationInput` type with:
     - `draft: Draft`
     - `rankings: RankingEntry[]`
     - `leagueSettings: LeagueSettings`
     - `userTeamId: string`
   - Add `RecommendationScoreComponent` with fields sufficient for later modifiers:
     - stable component id
     - numeric delta
     - direction
     - optional priority
     - optional reason data or evidence
   - Add `RecommendationReason` with fields sufficient for later reason selection:
     - stable reason id
     - text
     - source component id
     - priority
   - Add `PlayerRecommendation` with:
     - `ranking`
     - `playerId`
     - `totalScore`
     - `baseScore`
     - `contextScore`
     - `components`
     - `reasons`
   - Add `RecommendationTuningConfig` for engine-level constants.
   - Keep the existing `Recommendation` type in place for current UI compatibility.

3. Add default tuning configuration.
   - In `src/lib/recommendations.ts`, export a `defaultRecommendationTuningConfig`.
   - Include placeholders for values named by the design, such as base score coefficient, context caps, urgency cap, and reason thresholds.
   - Do not use these values for full scoring behavior yet unless needed to satisfy type shape.

4. Add the new pure engine entry point.
   - In `src/lib/recommendations.ts`, add a function such as `generatePlayerRecommendations`.
   - Accept `RecommendationInput` and optional settings such as `limit` and `tuning`.
   - Build the drafted player id set from `input.draft.picks`.
   - Filter `input.rankings` to available players.
   - Return `PlayerRecommendation[]`.
   - For this contract slice, keep scoring intentionally minimal:
     - `baseScore: 0`
     - `contextScore: 0`
     - `totalScore: 0`
     - empty `components`
     - empty `reasons`
   - Sort deterministically by existing ranking fields while Task 3 is still pending:
     - `overallRank`
     - `positionRank`
     - `player.id`
   - Apply the requested recommendation limit after sorting.
   - Do not call persistence, server actions, React APIs, or mutate the draft.

5. Preserve existing recommendation helper behavior.
   - Keep `generateTopRecommendations` available for current UI/tests.
   - Do not force existing UI components to consume `PlayerRecommendation` in this slice.
   - If shared helpers are extracted, keep the change small and local to `src/lib/recommendations.ts`.

6. Add focused contract tests.
   - Add or extend tests in `src/lib/recommendations.test.ts`.
   - Verify the new engine excludes drafted players from `draft.picks`.
   - Verify identical input produces identical recommendation ordering.
   - Verify the new engine accepts non-default league settings without default roster assumptions.
   - Verify output includes the new score fields, component array, and reason array.
   - Verify the function does not mutate the input draft.

7. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - If validation fails due to issues caused by this slice, fix only those issues.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

8. Stop after Task 2.
   - Do not start Task 3 base ranking scoring.
   - Do not update `docs/tasks.md`.
   - Do not update the UI to use the new engine.

## Acceptance Criteria

- `RecommendationInput` or equivalent domain-facing input type exists.
- `PlayerRecommendation` or equivalent output type includes total score, base score, context score, score components, and reasons.
- A default recommendation tuning config exists for future scoring tasks.
- A pure Recommendation Engine entry point accepts draft state, rankings, league settings, and user team id.
- The new entry point excludes drafted players from recommendation results.
- The same input produces the same output ordering.
- The new entry point can be called with non-default league settings.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No persistence, server action, React, or Prisma dependency is introduced into the engine.
- No UI files are changed.
- No recommendation output is persisted.

## Suggested Tests

- Unit test that the new engine returns only available players.
- Unit test that identical inputs produce identical ordering.
- Unit test that the new engine accepts a non-default league setting fixture.
- Unit test that output contains score fields, component data, and reason data.
- Unit test that the input draft is not mutated.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.test.ts
npm run lint
```

If targeted test execution is unsupported, run:

```txt
npm test
npm run lint
```

## Slice Review

- Smallest meaningful increment: yes. It establishes the engine contract without implementing scoring behavior from later tasks.
- Concrete enough for implementation: yes. The target files, types, function behavior, and tests are specified.
- Avoids unnecessary architecture changes: yes. It preserves current UI usage and does not introduce abstractions beyond the approved contract.
- Blast radius reasonable: yes. Expected changes are limited to recommendation types, recommendation library code, and recommendation tests.
- Review/revert comfort: yes. The slice can be reviewed independently before scoring logic is added.
- Observable/testable acceptance criteria: yes. Contract behavior is covered by focused unit tests and linting.
