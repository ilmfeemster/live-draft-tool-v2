# Current Slice: Add Tier-Drop Risk Modifier

## Source Task

Task 6: Add Tier-Drop Risk Modifier.

## Goal

Add a bounded tier-drop risk modifier to the pure Recommendation Engine path.

This slice should reward players who are among the last useful options in their current positional tier, especially when the position still matters to the user's roster and the user may not pick again before that tier is likely gone.

## User-Visible Increment

- Recommendations can identify meaningful tier cliffs.
- Last-few-in-tier players at relevant positions can rise above similar alternatives.
- Tier pressure remains bounded so it cannot single-handedly push much lower base-value players above elite options.

## Current Context

Previous Phase 3 slices established:

- A pure `generatePlayerRecommendations` entry point.
- Rank-derived `baseScore` from `RankingEntry.overallRank`.
- A `base_value` score component.
- A `roster_fit` score component derived from draft state and league settings.
- A `value_opportunity` score component derived from current pick and overall rank.
- `contextScore` is currently the clamped sum of roster fit and value opportunity.
- `generateTopRecommendations` remains the legacy UI compatibility path and should not be changed for this slice.

The approved design defines tier-drop risk as a positive-only urgency modifier in the range `0` to `+12`. It should consider available players in the candidate's position and tier, the next available tier at that position, distance to the user's next pick, and roster relevance.

## Scope

### Goals

- Add a pure tier-drop risk helper in `src/lib/recommendations.ts`.
- Calculate available rankings once after drafted-player filtering.
- Detect remaining available players in the candidate's position and tier.
- Detect the next available tier for the candidate's position.
- Calculate distance to the user's next pick from `input.draft.picks`.
- Scale tier pressure by roster relevance using the existing `roster_fit` component delta.
- Add a `tier_cliff` score component to every `PlayerRecommendation`.
- Apply bounded tier deltas:
  - No pressure: `0`
  - Mild pressure with two remaining players in tier: `+4`
  - Last player in a normal next-tier drop: `+8`
  - Last player before a major tier cliff at a needed position: `+12`
- Reduce tier pressure when roster fit is neutral or negative.
- Treat the current tier urgency score as `min(tierDropRisk, tuning.maxUrgencyScore)` until scarcity is added in Task 7.
- Recompute `contextScore` as the clamped sum of:
  - `roster_fit`
  - current urgency score from `tier_cliff`
  - `value_opportunity`
- Recompute `totalScore` as `baseScore + contextScore`.
- Preserve deterministic sorting by total score, base score, overall rank, position rank, and player id.
- Add focused tests for mild tier pressure, major tier cliffs, roster-relevance reduction, urgency cap behavior, and elite-player guardrails.

### Non-Goals

- Adding positional scarcity or run pressure.
- Predicting opponent behavior.
- Simulating future picks.
- Generating final recommendation reasons.
- Adding UI-only tier labels.
- Changing UI components to consume `generatePlayerRecommendations`.
- Changing persistence, Prisma, server actions, draft source behavior, or Draft State Engine behavior.
- Introducing Phase 6 strategy advice.
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
   - Read Task 6 in `docs/tasks.md`.
   - Read the tier-drop risk section of `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Prepare available rankings and next-pick distance.
   - In `generatePlayerRecommendations`, keep filtering drafted players before scoring.
   - Store the filtered list as `availableRankings`.
   - Add a pure helper such as `getDistanceToNextUserPick`.
   - Find the next pick where `pick.teamId === input.userTeamId` and `pick.pickNumber > input.draft.currentPickNumber`.
   - Return `nextPick.pickNumber - input.draft.currentPickNumber` when one exists.
   - Return `null` when the user has no remaining pick.

3. Add the tier-drop risk calculation.
   - Add a helper such as `calculateTierDropRiskComponent`.
   - Inputs should include:
     - candidate `RankingEntry`
     - `availableRankings`
     - distance to next user pick
     - existing `roster_fit` component delta
     - recommendation tuning config
   - Compute same-position available rankings sorted by `overallRank`.
   - Count available players with the candidate's position and current tier.
   - Find the next higher tier number available at the same position.
   - Compute `tierGap = nextTier - currentTier` when a next tier exists.
   - Return `0` when:
     - no next tier exists
     - the candidate is not in the best available tier for the position
     - same-tier count is greater than `tuning.tierThinnessThreshold`
     - distance to the user's next pick exists and same-tier count is greater than that distance
   - Use base deltas:
     - same-tier count equals `tuning.tierThinnessThreshold`: `+4`
     - same-tier count is `1` and `tierGap === 1`: `+8`
     - same-tier count is `1` and `tierGap > 1`: `+12`
   - Scale by roster relevance:
     - `roster_fit.delta > 0`: keep full delta.
     - `roster_fit.delta === 0`: halve the delta and round down.
     - `roster_fit.delta < 0`: cap the delta at `+3`.
   - Clamp the final tier delta to `0` through `+12`.

4. Add the tier score component.
   - Use stable id `tier_cliff`.
   - Set `delta` to the calculated tier modifier.
   - Set direction to `"positive"` when `delta > 0`, otherwise `"neutral"`.
   - Set a stable priority suitable for later reason selection.
   - Include evidence such as:
     - `position`
     - `currentTier`
     - `sameTierRemaining`
     - `nextTier`
     - `tierGap`
     - `distanceToNextUserPick`
     - `rosterFitDelta`
     - `thresholdMatched`

5. Compose context score.
   - Keep existing `base_value`, `roster_fit`, and `value_opportunity` components.
   - Add the new `tier_cliff` component after `roster_fit` and before `value_opportunity`.
   - Compute `urgencyScore = min(tierCliffComponent.delta, tuning.maxUrgencyScore)`.
   - Compute raw context as `rosterFitComponent.delta + urgencyScore + valueOpportunityComponent.delta`.
   - Clamp raw context with `tuning.maxNegativeContextScore` and `tuning.maxPositiveContextScore`.
   - Set `totalScore` from `baseScore + contextScore`.
   - Keep `reasons` empty until the explanation-selection task.

6. Preserve existing compatibility behavior.
   - Do not change `generateTopRecommendations`.
   - Do not change UI call sites.
   - Do not alter roster fit or value opportunity behavior except for composing tier urgency into context.

7. Add focused tests.
   - Unit test mild tier pressure when two players remain in a relevant tier.
   - Unit test major tier cliff when one player remains before a multi-tier drop at a needed position.
   - Unit test no tier pressure when several players remain beyond the thinness threshold.
   - Unit test no tier pressure when the candidate is not in the best available tier at the position.
   - Unit test that filled or low-value roster positions reduce tier impact.
   - Unit test that tier pressure cannot move a much lower base-value player above an elite player by itself.
   - Unit test `tier_cliff` component shape and evidence.
   - Unit test urgency score respects `tuning.maxUrgencyScore`.
   - Unit test deterministic output for identical inputs.

8. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

9. Stop after Task 6.
   - Do not start positional scarcity, run pressure, explanation selection, scenario validation, or UI wiring tasks.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- Last-few-in-tier situations increase recommendations for roster-relevant positions.
- Major tier cliffs can receive a larger bounded `tier_cliff` modifier.
- Tier pressure is reduced when the position is already solved or low-value for the roster.
- Candidates outside the best available tier for their position do not receive tier pressure.
- Tier pressure cannot move a much lower base-value player above an elite player by itself.
- `tier_cliff` components include evidence needed for later reason generation.
- `contextScore` is the clamped sum of roster fit, current urgency score, and value opportunity.
- Current urgency score respects `tuning.maxUrgencyScore`.
- Recommendation ordering remains deterministic for the same draft state and rankings.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft source dependency is introduced into the engine.

## Suggested Tests

- Unit test mild tier pressure.
- Unit test major tier cliff at a needed position.
- Unit test no tier pressure when tier depth is not thin.
- Unit test no tier pressure outside the best available tier.
- Unit test filled-position reduction.
- Unit test elite-player guardrail.
- Unit test urgency cap behavior.
- Unit test tier component shape and evidence.
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

- Smallest meaningful increment: yes. It adds only the tier-drop risk modifier from Task 6.
- Concrete enough for implementation: yes. The tier detection inputs, distance rule, relevance scaling, component shape, composition rule, and tests are specified.
- Avoids unnecessary architecture changes: yes. It stays inside the pure Recommendation Engine path and avoids a modifier registry.
- Blast radius reasonable: yes. Expected implementation changes are limited to recommendation library code and tests.
- Review/revert comfort: yes. The slice is isolated from UI, persistence, scarcity, run pressure, and explanation work.
- Observable/testable acceptance criteria: yes. Behavior is covered by focused unit tests and linting.
