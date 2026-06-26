# Current Slice: Add Roster Fit And Timing Modifier

## Source Task

Task 4: Add Roster Fit And Timing Modifier.

## Goal

Add the primary team-context modifier to the pure Recommendation Engine path.

This slice should make `generatePlayerRecommendations` adjust base-scored recommendations using the user's roster state, configured roster slots, draft phase, and candidate position. The modifier must remain deterministic, bounded, and independent from UI, persistence, and draft-source details.

## User-Visible Increment

- Recommendations begin to respond to the user's actual drafted roster.
- Open starter and FLEX needs can move comparable players upward.
- Saturated positions and poorly timed early DEF/K picks are de-emphasized without hiding elite base value.

## Current Context

Task 3 added rank-derived base scoring to `generatePlayerRecommendations`.

Current Recommendation Engine behavior:

- Drafted players are excluded from `input.draft.picks`.
- `baseScore` comes from `RankingEntry.overallRank`.
- `contextScore` is still `0`.
- Each recommendation has a `base_value` score component.
- `generateTopRecommendations` remains the legacy UI compatibility path and should not be changed for this slice.

The approved design defines roster fit and timing as the primary team-context modifier with a recommended range of `-20` to `+14`. It must derive roster needs from configured league settings instead of hard-coded MVP starter counts.

## Scope

### Goals

- Derive the user's drafted roster from:
  - `input.draft.picks`
  - `input.userTeamId`
  - `input.rankings`
- Derive roster need from `input.leagueSettings.rosterSlots`.
- Treat slots with `label: "BENCH"` as bench capacity.
- Treat non-bench slots with exactly one eligible position as direct starter slots.
- Treat non-bench slots with multiple eligible positions as FLEX-style slots.
- Add a pure roster fit/timing helper in `src/lib/recommendations.ts`.
- Add a roster fit score component to every `PlayerRecommendation`.
- Add the roster fit delta into `contextScore`.
- Clamp `contextScore` using `defaultRecommendationTuningConfig.maxNegativeContextScore` and `maxPositiveContextScore`.
- Recompute `totalScore` as `baseScore + contextScore`.
- Preserve deterministic sorting by total score, base score, overall rank, position rank, and player id.
- Add focused tests for starter need, FLEX eligibility, saturation, DEF/K timing, and non-default roster configuration.

### Non-Goals

- Adding positional scarcity, run pressure, tier-drop risk, or value-opportunity modifiers.
- Generating final recommendation reasons.
- Changing UI components to consume `generatePlayerRecommendations`.
- Changing persistence, Prisma, server actions, draft source behavior, or Draft State Engine behavior.
- Hard-coding 12 teams, 16 rounds, MVP starter counts, fixed FLEX rules, or fixed bench size.
- Introducing strategy profiles or a generic modifier registry.
- Updating `docs/tasks.md`, `docs/project.md`, `docs/architecture.md`, `docs/decisions.md`, or design docs.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

Do not modify `src/types/draft.ts` unless a compile blocker appears. Use the existing score component and evidence shape.

## Implementation Steps

1. Review the active context.
   - Read `docs/current-slice.md`.
   - Read Task 4 in `docs/tasks.md`.
   - Read the roster fit and timing section of `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.
   - Read `src/data/defaultLeagueSettings.ts` only if roster slot fixtures need confirmation.

2. Add roster derivation for the pure engine.
   - Build a `Map` from player id to `RankingEntry`.
   - Select picks where `pick.teamId === input.userTeamId` and `pick.playerId` exists.
   - Convert those picks into roster entries using ranking player position data.
   - Ignore drafted player ids that are missing from rankings rather than guessing positions.
   - Keep this logic local and pure; do not call persistence, React, or draft-source code.

3. Add roster slot analysis helpers.
   - Split roster slots into bench and non-bench slots using `slot.label === "BENCH"`.
   - For a candidate position, count direct starter slots whose `eligiblePositions` is exactly that position.
   - Count FLEX-style slots whose `eligiblePositions` includes the candidate position and has multiple eligible positions.
   - Count bench slots whose `eligiblePositions` includes the candidate position.
   - Count current user roster players by position and by FLEX eligibility.
   - Do not assume MVP default counts or fixed FLEX positions.

4. Add the roster fit and timing calculation.
   - Add a helper such as `calculateRosterFitComponent`.
   - Inputs should include the candidate ranking, derived user roster, league settings, draft state, and tuning.
   - Suggested starting deltas:
     - Open direct starter slot: `+10`.
     - Open FLEX-style capacity for candidate position: `+5`.
     - Useful bench depth when starter/FLEX needs are filled and bench capacity remains: `+3`.
     - Starter/FLEX filled with limited bench value: `-6`.
     - Heavily saturated position beyond useful roster capacity: `-12`.
     - Early DEF/K timing penalty: `-20`.
   - Keep the final roster fit delta within `-20` to `+14`.
   - For DEF/K:
     - Apply the early timing penalty before the late draft phase when the configured slot is not urgently needed.
     - Allow DEF/K to become normal open starter needs in the late phase if configured slots remain empty.
     - De-emphasize backup DEF/K once configured DEF/K slots are filled.
   - Use draft phase from `input.draft.currentPickNumber / (input.draft.teamCount * input.draft.rounds)`.
   - Use `tuning.lateDraftPickRatio` as the late-phase boundary.

5. Apply roster fit in `generatePlayerRecommendations`.
   - Keep the existing `base_value` component.
   - Add one roster component with a stable id such as `roster_fit`.
   - Set the component direction from the delta:
     - positive for `> 0`
     - negative for `< 0`
     - neutral for `0`
   - Include evidence such as candidate position, direct starter openings, flex openings, bench openings, roster count at position, draft phase, and timing label.
   - Set `contextScore` to the clamped sum of roster components for now.
   - Keep `reasons` empty until the explanation-selection task.

6. Preserve existing compatibility behavior.
   - Do not change `generateTopRecommendations`.
   - Do not change legacy roster helper behavior unless a direct compile issue requires a tiny local adjustment.
   - Do not change UI call sites.

7. Add focused tests.
   - Unit test that an open configured starter slot increases the eligible position's context score.
   - Unit test that FLEX-style eligibility affects need using a non-default FLEX slot configuration.
   - Unit test that a saturated position receives a negative roster fit component but can still appear when base value is strong.
   - Unit test that early DEF/K picks receive a strong negative timing component.
   - Unit test that late empty DEF/K configured slots become valid starter needs.
   - Unit test using a non-default roster configuration, such as extra WR starter or QB-eligible FLEX, to prove no MVP starter counts are hard-coded.
   - Unit test that `contextScore` is clamped to configured positive and negative caps if the helper could otherwise exceed them.
   - Unit test that recommendation output remains deterministic for identical inputs.

8. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

9. Stop after Task 4.
   - Do not start value opportunity, tier-drop, scarcity, run-pressure, explanation selection, or UI wiring tasks.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- `generatePlayerRecommendations` derives the user roster from draft state and rankings.
- Roster need is derived from configured roster slots instead of MVP defaults.
- Open direct starter slots increase context score for eligible positions.
- FLEX-style roster slots affect positional need in observable ways.
- Bench depth can provide limited positive credit after starter/FLEX needs are mostly filled.
- Saturated positions receive negative context without removing elite base-value players from consideration.
- DEF/K are strongly de-emphasized before the late draft phase and become valid needs late when configured slots remain empty.
- Non-default roster configurations influence scoring correctly.
- Every recommendation includes a roster fit score component tied to scoring evidence.
- `contextScore` is clamped to configured context score bounds.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft source dependency is introduced into the engine.

## Suggested Tests

- Unit test open direct starter need.
- Unit test FLEX-style slot eligibility using a custom roster slot.
- Unit test position saturation penalty.
- Unit test early DEF/K timing penalty.
- Unit test late DEF/K open starter need.
- Unit test non-default roster configuration.
- Unit test context score clamping.
- Unit test deterministic output for the same roster and rankings.

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

- Smallest meaningful increment: yes. It adds only the roster fit and timing modifier from Task 4.
- Concrete enough for implementation: yes. The derivation inputs, slot interpretation, scoring ranges, component behavior, and tests are specified.
- Avoids unnecessary architecture changes: yes. It stays inside the pure Recommendation Engine path and avoids a modifier registry.
- Blast radius reasonable: yes. Expected implementation changes are limited to recommendation library code and tests.
- Review/revert comfort: yes. The slice is isolated from UI, persistence, and later modifier work.
- Observable/testable acceptance criteria: yes. The behavior is covered by focused unit tests and linting.
