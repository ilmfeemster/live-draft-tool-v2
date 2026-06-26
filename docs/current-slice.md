# Current Slice: Implement Base Ranking Scoring

## Source Task

Task 3: Implement Base Ranking Scoring.

## Goal

Implement the Phase 3 rank-derived base player value score in the pure Recommendation Engine path.

This slice should make `generatePlayerRecommendations` return meaningful base-scored recommendations while keeping all contextual modifiers at zero until later tasks add them.

## User-Visible Increment

- The Recommendation Engine can rank available players by deterministic base player value.
- Recommendation output includes a base-value score component that later explanation work can use.
- Drafted players remain excluded from recommendation results.

## Current Context

Task 2 established the Recommendation Engine contract in:

- `src/types/draft.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

The current engine entry point returns zeroed scores and deterministic rank-order output. This slice should replace the zeroed base score with the approved formula while preserving the pure domain boundary.

The approved design defines:

```txt
baseValueScore = max(0, 100 - 6 * sqrt(overallRank - 1))
```

Use `RankingEntry.overallRank` as the base value source. The coefficient should come from `defaultRecommendationTuningConfig.baseScoreCurveCoefficient` so future tuning can happen without redesigning the scoring model.

## Scope

### Goals

- Add a small testable base score helper in `src/lib/recommendations.ts`.
- Score each available player using the approved `overallRank` formula.
- Use the configured base score curve coefficient from recommendation tuning.
- Keep `contextScore` at `0`.
- Set `totalScore` to `baseScore + contextScore`.
- Add a base-value score component to every `PlayerRecommendation`.
- Sort recommendations by:
  - `totalScore` descending
  - `baseScore` descending
  - `overallRank` ascending
  - `positionRank` ascending
  - `player.id` ascending
- Preserve drafted-player filtering, recommendation limit behavior, and deterministic output.
- Preserve existing `generateTopRecommendations` behavior for current UI compatibility.
- Add focused unit tests for base scoring and ordering.

### Non-Goals

- Adding roster need, scarcity, tier-drop, run-pressure, or value-opportunity modifiers.
- Adding reason-selection text or explanation prioritization.
- Updating UI components to consume the new Recommendation Engine output.
- Changing persistence, Prisma, server actions, or draft source behavior.
- Normalizing ranking data or introducing projections, ADP, VORP, or simulations.
- Introducing a generic modifier registry.
- Updating `docs/tasks.md`, `docs/project.md`, `docs/architecture.md`, `docs/decisions.md`, or design docs.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

Only touch `src/types/draft.ts` if a small type adjustment is required to represent the base-value component cleanly.

## Implementation Steps

1. Review the active context.
   - Read `docs/current-slice.md`.
   - Read Task 3 in `docs/tasks.md`.
   - Read the scoring model section of `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Add base score calculation.
   - Add an exported helper such as `calculateBasePlayerValueScore`.
   - Accept `overallRank` and an optional coefficient or tuning value.
   - Implement `max(0, 100 - coefficient * sqrt(overallRank - 1))`.
   - Clamp the square-root input so invalid ranks do not produce `NaN`.
   - Do not read from projections, ADP, persistence, or league defaults.

3. Apply base scoring in `generatePlayerRecommendations`.
   - Resolve tuning from options or `defaultRecommendationTuningConfig`.
   - Compute `baseScore` for each available ranking.
   - Keep `contextScore` at `0`.
   - Set `totalScore` from `baseScore + contextScore`.
   - Add a score component with a stable id such as `base_value`.
   - Include evidence that ties the component to `overallRank`.
   - Keep `reasons` empty until the explanation-selection task.

4. Update recommendation sorting.
   - Sort scored recommendations by total score and base score descending.
   - Use `overallRank`, `positionRank`, and `player.id` as deterministic tie breakers.
   - Apply the requested limit after sorting.
   - Keep drafted players excluded before scoring.

5. Add or update focused tests.
   - Unit test the base score formula for top, middle, and clamped low-end values.
   - Unit test that recommendations are ordered by base score when no context modifiers exist.
   - Unit test deterministic tie-break ordering when scores are equal.
   - Unit test that drafted players are excluded and not scored.
   - Unit test that `contextScore` remains `0` and `totalScore` equals `baseScore`.
   - Unit test that a lower-ranked player does not outrank a higher-ranked player when no context modifiers apply.

6. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

7. Stop after Task 3.
   - Do not start contextual modifier tasks.
   - Do not update UI call sites.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- A testable base score helper implements the approved rank-derived formula.
- `generatePlayerRecommendations` assigns a non-zero base score for ranked players when appropriate.
- `contextScore` remains `0` for all recommendations.
- `totalScore` equals `baseScore` while no context modifiers exist.
- Every recommendation includes a base-value score component tied to the scoring input.
- Recommendation ordering uses total score, base score, and deterministic rank/id tie breakers.
- Drafted players are excluded before scoring.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft source dependency is introduced into the engine.

## Suggested Tests

- Unit test `calculateBasePlayerValueScore` for rank `1`, a middle rank, and a rank far enough down the board to clamp to `0`.
- Unit test that base-scored recommendations follow rank-derived ordering.
- Unit test deterministic tie-breaking for equal scores.
- Unit test that drafted players are absent from scored output.
- Unit test score field consistency: `contextScore === 0` and `totalScore === baseScore`.

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

- Smallest meaningful increment: yes. It adds base scoring without introducing contextual modifier behavior.
- Concrete enough for implementation: yes. The formula, score fields, component expectation, ordering, and tests are specified.
- Avoids unnecessary architecture changes: yes. It uses the existing pure Recommendation Engine contract and tuning config.
- Blast radius reasonable: yes. Expected implementation changes are limited to recommendation library code and tests.
- Review/revert comfort: yes. The slice is isolated from UI, persistence, and later modifier work.
- Observable/testable acceptance criteria: yes. Behavior is covered by focused unit tests and linting.
