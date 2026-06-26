# Current Slice: Add Positional Scarcity And Run Pressure Modifier

## Source Task

Task 7: Add Positional Scarcity And Run Pressure Modifier.

## Goal

Add bounded positional scarcity and observed run-pressure modifiers to the pure Recommendation Engine path.

This slice should reward positions where useful remaining options are thinning, including recent observed draft runs, without predicting opponent behavior or letting run pressure force bad picks.

## User-Visible Increment

- Recommendations can recognize when useful options at a roster-relevant position are becoming thin.
- Recent positional runs can add bounded urgency when the user's roster still benefits from the position.
- Scarcity, run pressure, and tier pressure share the approved urgency cap so contextual pressure remains explainable and controlled.

## Current Context

Previous Phase 3 slices established:

- A pure `generatePlayerRecommendations` entry point.
- Rank-derived `baseScore` from `RankingEntry.overallRank`.
- Score components for `base_value`, `roster_fit`, `tier_cliff`, and `value_opportunity`.
- User roster derivation from draft picks and rankings.
- Drafted-player filtering through `availableRankings`.
- Current urgency composition as `min(tier_cliff, tuning.maxUrgencyScore)`.
- `generateTopRecommendations` remains the legacy UI compatibility path and should not be changed for this slice.

The approved design defines positional scarcity and run pressure as positive-only urgency modifiers in the range `0` to `+10`. Scarcity and run pressure should combine with tier-drop risk through the same urgency cap, currently represented by `tuning.maxUrgencyScore`.

## Scope

### Goals

- Add a pure positional scarcity helper in `src/lib/recommendations.ts`.
- Add a pure observed run-pressure helper in `src/lib/recommendations.ts`.
- Measure remaining available quality by candidate position using `availableRankings`.
- Detect recent observed positional runs from `input.draft.picks`.
- Apply scarcity and run pressure only when the candidate position remains relevant to the user's roster.
- Add `positional_scarcity` and `positional_run` score components to every `PlayerRecommendation`.
- Keep scarcity and run pressure positive-only.
- Combine urgency as:
  - `urgencyScore = min(tier_cliff + positional_scarcity + positional_run, tuning.maxUrgencyScore)`
- Recompute `contextScore` as the clamped sum of:
  - `roster_fit`
  - combined urgency score
  - `value_opportunity`
- Preserve deterministic sorting by total score, base score, overall rank, position rank, and player id.
- Add focused tests for scarcity, run pressure, solved-position behavior, combined urgency cap behavior, and deterministic output.

### Non-Goals

- Modeling opponents.
- Simulating future picks.
- Predicting whether a run will continue.
- Replacing tier-drop risk.
- Letting positional runs force bad picks.
- Generating final recommendation reasons.
- Adding UI wiring or display behavior.
- Changing persistence, Prisma, server actions, draft source behavior, or Draft State Engine behavior.
- Introducing provider-specific assumptions.
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
   - Read Task 7 in `docs/tasks.md`.
   - Read the positional scarcity and run pressure sections of `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Add positional scarcity calculation.
   - Add a helper such as `calculatePositionalScarcityComponent`.
   - Inputs should include:
     - candidate `RankingEntry`
     - `availableRankings`
     - existing `roster_fit` component delta
     - recommendation tuning config
   - Limit scarcity to roster-building positions where scarcity is strategically useful for MVP recommendations: `QB`, `RB`, `WR`, and `TE`.
   - Compute same-position available rankings sorted by `overallRank`.
   - Count same-position options behind the candidate within the existing lookahead window, such as `candidate.overallRank + 24`.
   - Return `0` when:
     - the position is not roster-relevant
     - roster fit delta is negative
     - enough nearby same-position options remain
   - Use starting deltas:
     - Mild scarcity when one or two nearby same-position options remain: `+3`
     - Clear scarcity when no nearby same-position options remain: `+6`
   - Scale by roster relevance:
     - `roster_fit.delta > 0`: keep full delta.
     - `roster_fit.delta === 0`: halve the delta and round down.
     - `roster_fit.delta < 0`: return `0`.
   - Clamp the final scarcity delta to `0` through `+6` for this slice.

3. Add observed run-pressure calculation.
   - Add a helper such as `calculatePositionalRunComponent`.
   - Inputs should include:
     - candidate `RankingEntry`
     - full rankings map or lookup by player id
     - `input.draft.picks`
     - `input.draft.currentPickNumber`
     - existing `roster_fit` component delta
     - recommendation tuning config
   - Use only completed picks with `pick.pickNumber < currentPickNumber`.
   - Sort recent picks by `pickNumber` descending and inspect at most `tuning.recentPickRunWindow`.
   - Map picked players to positions through the ranking snapshot.
   - Ignore picks whose player id is missing from rankings.
   - Limit run pressure to `QB`, `RB`, `WR`, and `TE`.
   - Return `0` when:
     - the candidate position is not roster-relevant
     - roster fit delta is not positive
     - the recent window does not show a meaningful run
   - Use starting deltas:
     - Three or four recent picks at the candidate position: `+2`
     - Five or more recent picks at the candidate position: `+4`
   - Clamp the final run-pressure delta to `0` through `+4`.

4. Add score components.
   - Add stable component id `positional_scarcity`.
   - Add stable component id `positional_run`.
   - Set `delta` to the calculated modifier.
   - Set direction to `"positive"` when `delta > 0`, otherwise `"neutral"`.
   - Set stable priorities suitable for later reason selection.
   - Include evidence for scarcity such as:
     - `position`
     - `nearbySamePositionOptions`
     - `lookaheadRanks`
     - `rosterFitDelta`
     - `thresholdMatched`
   - Include evidence for run pressure such as:
     - `position`
     - `recentPickWindow`
     - `recentPositionPickCount`
     - `rosterFitDelta`
     - `thresholdMatched`

5. Compose combined urgency.
   - Keep existing `base_value`, `roster_fit`, `tier_cliff`, and `value_opportunity` components.
   - Add `positional_scarcity` and `positional_run` after `tier_cliff` and before `value_opportunity`.
   - Compute `urgencyScore = min(tierCliffComponent.delta + positionalScarcityComponent.delta + positionalRunComponent.delta, tuning.maxUrgencyScore)`.
   - Compute raw context as `rosterFitComponent.delta + urgencyScore + valueOpportunityComponent.delta`.
   - Clamp raw context with `tuning.maxNegativeContextScore` and `tuning.maxPositiveContextScore`.
   - Set `totalScore` from `baseScore + contextScore`.
   - Keep `reasons` empty until the explanation-selection task.

6. Preserve existing compatibility behavior.
   - Do not change `generateTopRecommendations`.
   - Do not change UI call sites.
   - Do not alter base value, roster fit, tier-drop risk, or value opportunity behavior except for composing scarcity and run pressure into urgency.

7. Add focused tests.
   - Unit test mild scarcity when one or two nearby same-position options remain at a relevant position.
   - Unit test clear scarcity when no nearby same-position options remain at a relevant position.
   - Unit test no scarcity when enough nearby same-position options remain.
   - Unit test observed run pressure at a needed position.
   - Unit test observed run pressure is ignored for a solved or roster-irrelevant position.
   - Unit test recent picks with player ids missing from rankings are ignored.
   - Unit test scarcity, run pressure, and tier pressure together respect `tuning.maxUrgencyScore`.
   - Unit test that scarcity and run pressure do not move a much lower base-value player above an elite player by themselves.
   - Unit test component shape and evidence for both new components.
   - Unit test deterministic output for identical inputs.

8. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

9. Stop after Task 7.
   - Do not start explanation selection, scenario validation, UI wiring, or later recommendation tasks.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- Thin remaining positional quality creates bounded `positional_scarcity` credit.
- Recent observed positional runs create bounded `positional_run` pressure only when tied to roster relevance.
- Runs at solved or roster-irrelevant positions have no effect.
- Scarcity and run pressure are positive-only and remain bounded.
- Scarcity, run pressure, and tier pressure share the combined urgency cap.
- Scarcity and run pressure cannot move a much lower base-value player above an elite player by themselves.
- New components include evidence needed for later reason generation.
- `contextScore` is the clamped sum of roster fit, combined urgency, and value opportunity.
- Recommendation ordering remains deterministic for the same draft state and rankings.
- The modifier remains independent from manual, replay, or future live draft sources.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft source dependency is introduced into the engine.

## Suggested Tests

- Unit test mild scarcity.
- Unit test clear scarcity.
- Unit test no scarcity when nearby depth remains.
- Unit test observed run pressure at a needed position.
- Unit test observed run pressure ignored for a solved position.
- Unit test unknown recent pick player ids are ignored.
- Unit test combined urgency cap behavior.
- Unit test elite-player guardrail.
- Unit test scarcity and run component shape and evidence.
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

- Smallest meaningful increment: yes. It adds only the Task 7 scarcity and observed run-pressure modifiers.
- Concrete enough for implementation: yes. Inputs, thresholds, roster-relevance gates, component shape, composition rule, and tests are specified.
- Avoids unnecessary architecture changes: yes. It stays inside the pure Recommendation Engine path and avoids a modifier registry.
- Blast radius reasonable: yes. Expected implementation changes are limited to recommendation library code and tests.
- Review/revert comfort: yes. The slice is isolated from UI, persistence, explanation selection, and scenario validation.
- Observable/testable acceptance criteria: yes. Behavior is covered by focused unit tests and linting.
