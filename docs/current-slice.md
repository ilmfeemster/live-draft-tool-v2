# Current Slice: Add Basic Recommendation Update Tests

## Source Task

`docs/test-tasks.md` Task 5: Add Basic Recommendation Update Tests.

## Goal

Validate the Phase 1 requirement that recommendations are derived from the current available player pool and update as draft state changes.

This slice should test recommendation updates from draft state without turning into deep Recommendation Engine Stage coverage.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

now validates basic recommendation update behavior after draft picks.

## Problem

The app generates recommendations from `availableRankings`, which are derived by removing drafted player IDs from the rankings list in `DraftRoom`.

Current tests cover draft order, draft transitions, and invariants, but they do not yet prove the Phase 1 recommendation contract:

- drafted players are excluded before recommendations are generated
- recommendation results respect the configured limit
- recommendation results change when the available player pool changes
- basic roster input can influence recommendation ordering

## Goals

- Add focused tests for basic recommendation updates from draft state.
- Use small inline ranking fixtures.
- Reuse existing pure helpers where useful.
- Keep recommendation scoring/modifier coverage shallow and Phase 1-oriented.
- Mark Task 5 complete in `docs/test-tasks.md`.

## Non-Goals

- Exhaustive recommendation scoring tests.
- Exhaustive roster need modifier tests.
- Tier-drop scenario coverage.
- Scarcity scenario coverage.
- Recommendation explanation regression suite.
- Large scenario libraries.
- React component tests.
- Browser tests.
- Changing recommendation implementation.
- Changing draft state helpers.
- Changing invariant helpers.

## Expected Files

- `src/lib/recommendations.test.ts`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing `src/lib/recommendations.ts`, `DraftRoom`, UI components, package metadata, Vitest config, seed data, ranking data, draft state helpers, or invariant helpers unless a test exposes a real bug.

## Test Strategy

Create `src/lib/recommendations.test.ts`.

These tests should exercise existing public recommendation behavior through:

- `generateTopRecommendations`
- `draftPlayerInDraft`
- small local ranking fixtures

Do not import the full seed rankings dataset.

Do not test private constants directly.

## Fixture Shape

Define a local helper:

```ts
function createRanking(
  id: string,
  overallRank: number,
  position: Position = "RB",
  name = id,
): RankingEntry
```

Default values:

- `team: "TEST"`
- `adpRank: null`
- `positionRank: overallRank`
- `tier: 1`

Use at least these rankings in tests as needed:

- `player-1`, rank 1, RB
- `player-2`, rank 2, WR
- `player-3`, rank 3, QB
- `player-4`, rank 4, TE
- `player-5`, rank 5, RB

## Implementation Steps

1. Create `src/lib/recommendations.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import `generateTopRecommendations` from `@/lib/recommendations`.
   - Import `draftPlayerInDraft` from `@/lib/draftState`.
   - Import `createDraftTeams` and `generateSnakeDraftOrder` from `@/lib/draftOrder`.
   - Import `Draft`, `Position`, and `RankingEntry` as types.
   - Add local `createRanking` and `createTestDraft` helpers.

2. Add a test for excluding drafted players before generating recommendations.
   - Create rankings for `player-1`, `player-2`, and `player-3`.
   - Draft `player-1` using `draftPlayerInDraft`.
   - Build `availableRankings` by filtering rankings whose player IDs are not in drafted picks.
   - Generate recommendations.
   - Assert recommendation player IDs do not include `player-1`.
   - Assert recommendation player IDs include remaining available players.

3. Add a test for recommendation limit handling.
   - Generate recommendations from at least five rankings with `{ limit: 2 }`.
   - Assert exactly two recommendations are returned.
   - Assert the returned IDs are the top two expected available rankings.

4. Add a test for recommendation output changing when the available pool changes.
   - Generate recommendations before any pick.
   - Draft the top-ranked player.
   - Recompute `availableRankings`.
   - Generate recommendations again.
   - Assert the first recommendation changes from `player-1` to the next expected available player.

5. Add a test for basic roster input influencing recommendation ordering.
   - Use two close rankings where an unfilled starter need can change ordering.
   - Example:
     - `player-qb`, overall rank 10, QB
     - `player-rb`, overall rank 20, RB
   - Call `generateTopRecommendations(rankings, { rosterPlayers: [] })`.
   - Assert `player-qb` ranks ahead of `player-rb` because both receive starter need but the higher base score still wins.
   - Then call with rosterPlayers already containing a QB:

```ts
[{ position: "QB" }]
```

   - Assert the QB no longer receives starter-need help, and `player-rb` ranks first.

6. Update `docs/test-tasks.md`.
   - Mark `Task 5: Add Basic Recommendation Update Tests` as complete.
   - Do not mark Task 6 or later tasks complete.

7. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `src/lib/recommendations.test.ts` exists.
- Tests use small inline fixtures, not seed rankings.
- Drafted players are excluded before recommendation generation.
- Recommendation results respect the requested limit.
- Recommendation results update when the available player pool changes.
- A simple roster input changes recommendation ordering.
- Tests do not require React or browser tooling.
- Recommendation implementation is unchanged unless a real bug is found.
- `docs/test-tasks.md` marks only Task 5 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because runtime app behavior is not intended to change.

If tests reveal recommendation behavior that conflicts with the current Phase 1 product expectations, stop and report the mismatch instead of broadening the slice into a recommendation redesign.

## Slice Review

- Smallest meaningful increment: yes, it covers only basic recommendation update behavior from draft state.
- Concrete enough for implementation: yes, files, helpers, fixtures, assertions, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no recommendation refactor, scenario framework, or UI testing is introduced.
- Blast radius reasonable: yes, expected changes are one test file, test-task docs, and this slice plan.
- Review/revert comfort: yes, the slice is isolated to tests and task tracking unless a genuine bug is found.
- Observable/testable acceptance criteria: yes, unit tests plus lint/build and the Task 5 checkbox verify the slice.
