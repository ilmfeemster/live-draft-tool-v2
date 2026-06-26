# Current Slice: Add Value Opportunity Modifier

## Source Task

Task 5: Add Value Opportunity Modifier.

## Goal

Add a bounded value opportunity modifier to the pure Recommendation Engine path.

This slice should reward players who have fallen meaningfully relative to the current pick and lightly penalize clear reaches when no existing context supports the pick. The modifier must stay separate from base player value and compose with the existing roster fit context.

## User-Visible Increment

- Recommendations can identify useful falling value at the current pick.
- Clear reaches can be lightly de-emphasized when they are not supported by roster context.
- Base ranking value remains the scoring anchor while draft-position value adds bounded context.

## Current Context

Previous Phase 3 slices established:

- A pure `generatePlayerRecommendations` entry point.
- Rank-derived `baseScore` from `RankingEntry.overallRank`.
- A `base_value` score component.
- A `roster_fit` score component derived from draft state and league settings.
- `contextScore` currently comes from roster fit only and is clamped by tuning config.
- `generateTopRecommendations` remains the legacy UI compatibility path and should not be changed for this slice.

The approved design defines value opportunity as a context modifier in the range `-6` to `+8`. It should compare the current overall pick number with the candidate's overall rank, use existing ranking fields only, and avoid duplicating base score.

## Scope

### Goals

- Add a pure value opportunity helper in `src/lib/recommendations.ts`.
- Compare `input.draft.currentPickNumber` against each candidate `ranking.overallRank`.
- Use the existing tuning thresholds:
  - `valueOpportunitySmallFallThreshold`
  - `valueOpportunityClearFallThreshold`
  - `valueOpportunityMajorFallThreshold`
- Add a `value_opportunity` score component to every `PlayerRecommendation`.
- Apply bounded value deltas:
  - Small fall: `+2`
  - Clear value: `+5`
  - Major value: `+8`
  - Clear unsupported reach: `-4`
  - Major unsupported reach: `-6`
  - Neutral: `0`
- Treat a player as a falling value when `currentPickNumber - overallRank` meets a configured fall threshold.
- Treat a player as an unsupported reach when `overallRank - currentPickNumber` meets at least the clear threshold and the existing `roster_fit` delta is not positive.
- Keep value opportunity separate from `baseScore`.
- Recompute `contextScore` as the clamped sum of `roster_fit` and `value_opportunity`.
- Recompute `totalScore` as `baseScore + contextScore`.
- Preserve deterministic sorting by total score, base score, overall rank, position rank, and player id.
- Add focused tests for fall thresholds, reach penalties, context caps, and deterministic behavior.

### Non-Goals

- Adding projections, VORP, normalized player value, ADP dependency, or external data.
- Adding tier-drop risk, positional scarcity, or run pressure.
- Generating final recommendation reasons.
- Adding UI-only value labels.
- Changing UI components to consume `generatePlayerRecommendations`.
- Changing persistence, Prisma, server actions, draft source behavior, or Draft State Engine behavior.
- Introducing a generic modifier registry.
- Updating `docs/tasks.md`, `docs/project.md`, `docs/architecture.md`, `docs/decisions.md`, or design docs.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

Do not modify `src/types/draft.ts` unless a compile blocker appears. Use the existing score component and evidence shape.

## Implementation Steps

1. Review the active context.
   - Read `docs/current-slice.md`.
   - Read Task 5 in `docs/tasks.md`.
   - Read the value opportunity section of `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Add the value opportunity calculation.
   - Add a helper such as `calculateValueOpportunityComponent`.
   - Inputs should include:
     - candidate `RankingEntry`
     - `draft.currentPickNumber`
     - existing `roster_fit` component delta
     - recommendation tuning config
   - Calculate `pickValueGap = currentPickNumber - ranking.overallRank`.
   - Calculate `reachGap = ranking.overallRank - currentPickNumber`.
   - Return:
     - `+8` when `pickValueGap >= valueOpportunityMajorFallThreshold`
     - `+5` when `pickValueGap >= valueOpportunityClearFallThreshold`
     - `+2` when `pickValueGap >= valueOpportunitySmallFallThreshold`
     - `-6` when `reachGap >= valueOpportunityMajorFallThreshold` and `roster_fit.delta <= 0`
     - `-4` when `reachGap >= valueOpportunityClearFallThreshold` and `roster_fit.delta <= 0`
     - `0` otherwise
   - Clamp the helper output to `-6` through `+8`.
   - Do not use `adpRank`, projections, or persisted data.

3. Add the value score component.
   - Use stable id `value_opportunity`.
   - Set `delta` to the calculated value modifier.
   - Set direction from the delta:
     - positive for `> 0`
     - negative for `< 0`
     - neutral for `0`
   - Set a stable priority suitable for later reason selection.
   - Include evidence such as:
     - `currentPickNumber`
     - `overallRank`
     - `pickValueGap`
     - `reachGap`
     - `thresholdMatched`
     - `rosterFitDelta`

4. Compose context score.
   - Keep the existing `base_value` and `roster_fit` components.
   - Add the new `value_opportunity` component after `roster_fit`.
   - Compute raw context as `rosterFitComponent.delta + valueOpportunityComponent.delta`.
   - Clamp raw context with `tuning.maxNegativeContextScore` and `tuning.maxPositiveContextScore`.
   - Set `totalScore` from `baseScore + contextScore`.
   - Keep `reasons` empty until the explanation-selection task.

5. Preserve existing compatibility behavior.
   - Do not change `generateTopRecommendations`.
   - Do not change UI call sites.
   - Do not alter roster fit behavior except for composing it with value opportunity.

6. Add focused tests.
   - Unit test small, clear, and major falling value deltas.
   - Unit test clear and major unsupported reach penalties.
   - Unit test that positive roster fit prevents the reach penalty.
   - Unit test that neutral value opportunity does not duplicate base score.
   - Unit test that context score is the clamped sum of roster fit and value opportunity.
   - Unit test that value opportunity remains within `-6` to `+8`.
   - Unit test deterministic output for the same current pick, rankings, and roster state.
   - Unit test that the modifier only depends on typed draft state and ranking fields.

7. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

8. Stop after Task 5.
   - Do not start tier-drop risk, positional scarcity, run pressure, explanation selection, scenario validation, or UI wiring tasks.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- Players who have fallen meaningfully relative to `draft.currentPickNumber` receive a bounded positive `value_opportunity` component.
- Clear unsupported reaches receive a bounded negative `value_opportunity` component.
- Positive roster fit prevents the reach penalty from firing.
- Value opportunity does not replace or duplicate `baseScore`.
- `contextScore` is the clamped sum of roster fit and value opportunity.
- The value modifier stays within `-6` to `+8`.
- Recommendation ordering remains deterministic for the same current pick and rankings.
- The modifier works from typed draft state and ranking fields only.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft source dependency is introduced into the engine.

## Suggested Tests

- Unit test small, clear, and major fall thresholds.
- Unit test clear and major reach penalties.
- Unit test roster-supported reach avoids penalty.
- Unit test context score composition and clamping.
- Unit test neutral value opportunity leaves context unchanged except for existing roster fit.
- Unit test value component shape and evidence.
- Unit test deterministic output for identical inputs.

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

- Smallest meaningful increment: yes. It adds only the value opportunity modifier from Task 5.
- Concrete enough for implementation: yes. The thresholds, deltas, component shape, composition rule, and tests are specified.
- Avoids unnecessary architecture changes: yes. It stays inside the pure Recommendation Engine path and avoids a modifier registry.
- Blast radius reasonable: yes. Expected implementation changes are limited to recommendation library code and tests.
- Review/revert comfort: yes. The slice is isolated from UI, persistence, and later modifier work.
- Observable/testable acceptance criteria: yes. Behavior is covered by focused unit tests and linting.
