# Current Slice: Add Basic Draft Workflow Integration Test

## Source Task

`docs/test-tasks.md` Task 7: Add Basic Draft Workflow Integration Test.

## Goal

Validate the interaction between draft state, available players, user roster derivation, and basic recommendations for a small manual draft workflow.

This slice should prove the Phase 1 workflow works across the pure business logic already covered by narrower unit tests, without adding browser or React component testing.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

now validates a small manual draft workflow from empty draft state through multiple picks, available-player updates, user roster derivation, and regenerated recommendations.

## Problem

Current tests cover individual pieces:

- draft order helpers
- draft state transitions
- draft invariants
- basic recommendation updates

They do not yet prove those pieces work together in one small workflow that resembles the app's manual draft loop:

1. draft a player
2. advance draft state
3. remove drafted players from available rankings
4. derive the user roster from user-team picks
5. regenerate recommendations from the remaining available players

## Goals

- Add one focused integration test for a small manual draft workflow.
- Use small inline draft and ranking fixtures.
- Simulate several picks with `draftPlayerInDraft`.
- Derive available rankings from drafted player IDs.
- Derive user roster players from user-team picks and rankings.
- Generate recommendations from the current available rankings and user roster.
- Mark Task 7 complete in `docs/test-tasks.md`.

## Non-Goals

- Full 12-team draft automation.
- React component tests.
- Browser tests.
- Playwright setup.
- Testing UI rendering or click behavior.
- Large scenario libraries.
- Advanced recommendation strategy tests.
- Persistence, replay, or live provider tests.
- Refactoring `DraftRoom`.
- Extracting new selector/helper modules unless a real blocker is found.
- Changing production draft or recommendation behavior.

## Expected Files

- `src/lib/draftWorkflow.test.ts`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, UI components, production recommendation code, draft state helpers, package metadata, Vitest config, seed data, or ranking data unless the integration test exposes a real bug.

## Test Strategy

Create `src/lib/draftWorkflow.test.ts`.

The test should exercise public business logic through:

- `draftPlayerInDraft`
- `createDraftTeams`
- `generateSnakeDraftOrder`
- `generateTopRecommendations`
- small local ranking fixtures

Do not import the full seed rankings dataset.

Do not require React, DOM, or browser tooling.

Use small local derivation helpers inside the test file for workflow-level assertions:

- `getAvailableRankings(rankings, draft)`
- `getUserRosterPlayers(rankings, draft)`
- `getRecommendationPlayerIds(recommendations)`

These helpers should mirror the app's current derivation rules closely enough for the workflow test, but this slice should not extract production selectors.

## Fixture Shape

Define a local helper:

```ts
function createRanking(
  id: string,
  overallRank: number,
  position: Position,
  name = id,
): RankingEntry
```

Default values:

- `team: "TEST"`
- `adpRank: null`
- `positionRank: overallRank`
- `tier: 1`

Define a local `createTestDraft` helper using:

- `teamCount: 3`
- `rounds: 2`
- `userTeamId: "team-2"`
- `currentPickNumber: 1`
- `teams: createDraftTeams(3)`
- `picks: generateSnakeDraftOrder(3, 2)`

This draft order makes the user team pick at pick 2 and pick 5.

Use a small ranking set such as:

- `player-rb-1`, rank 1, RB
- `player-qb-user`, rank 2, QB
- `player-wr-1`, rank 3, WR
- `player-te-1`, rank 4, TE
- `player-rb-user`, rank 5, RB
- `player-wr-2`, rank 6, WR

## Implementation Steps

1. Create `src/lib/draftWorkflow.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import `createDraftTeams` and `generateSnakeDraftOrder` from `@/lib/draftOrder`.
   - Import `draftPlayerInDraft` from `@/lib/draftState`.
   - Import `generateTopRecommendations` from `@/lib/recommendations`.
   - Import `Draft`, `Position`, `RankingEntry`, and `UserRosterPlayer` as types.
   - Add local `createRanking`, `createTestDraft`, `getAvailableRankings`, `getUserRosterPlayers`, and `getRecommendationPlayerIds` helpers.

2. Add one integration test named clearly, for example:

```ts
it("updates available players, user roster, and recommendations through a small manual draft", () => {
  // ...
});
```

3. In the test, start from an empty 3-team, 2-round draft.
   - Assert `currentPickNumber` starts at `1`.
   - Assert all rankings are initially available.
   - Generate initial recommendations and assert the top recommendation is `player-rb-1`.
   - Derive the initial user roster and assert it is empty.

4. Apply the first three picks sequentially.
   - Pick 1: draft `player-rb-1` for `team-1`.
   - Pick 2: draft `player-qb-user` for `team-2`.
   - Pick 3: draft `player-wr-1` for `team-3`.
   - Use `draftPlayerInDraft` for each pick.
   - Assert `currentPickNumber` advances to `4`.

5. Recompute derived workflow state after the first three picks.
   - Assert available ranking IDs are exactly:

```ts
["player-te-1", "player-rb-user", "player-wr-2"]
```

   - Assert the user roster contains exactly one player:

```ts
{
  pickNumber: 2,
  name: "player-qb-user",
  team: "TEST",
  position: "QB",
}
```

   - Generate recommendations using:

```ts
generateTopRecommendations(availableRankings, {
  rosterPlayers: userRosterPlayers,
})
```

   - Assert recommendation player IDs do not contain drafted players.
   - Assert recommendation player IDs contain only currently available players.

6. Continue through the next two picks to reach the user's second pick.
   - Pick 4: draft `player-te-1` for `team-3`.
   - Pick 5: draft `player-rb-user` for `team-2`.
   - Assert `currentPickNumber` advances to `6`.

7. Recompute derived workflow state after pick 5.
   - Assert available ranking IDs are exactly:

```ts
["player-wr-2"]
```

   - Assert the user roster contains both user-team picks in pick order:

```ts
[
  {
    pickNumber: 2,
    name: "player-qb-user",
    team: "TEST",
    position: "QB",
  },
  {
    pickNumber: 5,
    name: "player-rb-user",
    team: "TEST",
    position: "RB",
  },
]
```

   - Generate recommendations again.
   - Assert the only recommendation is `player-wr-2`.

8. Update `docs/test-tasks.md`.
   - Mark `Task 7: Add Basic Draft Workflow Integration Test` as complete.
   - Do not mark any future task complete.

9. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `src/lib/draftWorkflow.test.ts` exists.
- The test uses small inline fixtures, not seed rankings.
- The test starts from an empty valid draft state.
- The test applies multiple manual picks with `draftPlayerInDraft`.
- The test verifies `currentPickNumber` advances through the workflow.
- The test verifies available players update after picks.
- The test verifies user roster derivation reflects user-team picks.
- The test verifies recommendations are regenerated from remaining players.
- The test verifies recommendations only include available players.
- Tests do not require React, DOM, or browser tooling.
- Production draft and recommendation implementations are unchanged unless a real bug is found.
- `docs/test-tasks.md` marks only Task 7 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser manual QA run is required for this slice. The previous manual checklist covers full-draft browser validation; this slice adds automated confidence for a small business-logic workflow.

If the test reveals a mismatch between the app's current derivation behavior and the expected Phase 1 workflow, stop and report the mismatch instead of broadening the slice into UI changes or selector refactors.

## Slice Review

- Smallest meaningful increment: yes, one focused integration test covers the remaining Task 7 behavior.
- Concrete enough for implementation: yes, file names, helpers, fixtures, exact picks, assertions, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, it avoids React tests, browser tooling, and production selector extraction.
- Blast radius reasonable: yes, expected changes are one test file, task tracking, and this slice plan.
- Review/revert comfort: yes, the slice is isolated and should be easy to revert.
- Observable/testable acceptance criteria: yes, assertions plus test/lint/build and the Task 7 checkbox verify the slice.
