# Current Slice: Add Draft Order Unit Tests

## Source Task

`docs/test-tasks.md` Task 2: Add Draft Order Unit Tests.

## Goal

Validate the pure snake draft order helpers that determine round, pick-in-round, draft position, and team assignment.

This slice should turn the existing smoke test into meaningful Draft State Engine coverage without changing production draft logic.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is stronger confidence from:

```txt
npm test
```

covering the draft order helper behavior with exact expected outputs.

## Problem

Task 1 created the test runner and added a tiny `generateSnakeDraftOrder` smoke test.

That test proves the runner works, but it does not fully validate the draft order helpers listed in Task 2:

- `getRoundForPick`
- `getPickInRound`
- `getDraftPositionForPick`
- `generateSnakeDraftOrder`

`docs/testing.md` now emphasizes that tests should fail for the right reason and should use specific assertions when behavior is deterministic.

## Goals

- Expand `src/lib/draftOrder.test.ts` to cover every exported draft order helper.
- Use exact expected values for deterministic behavior.
- Include readable small-draft cases.
- Include one MVP-shape assertion for 12 teams and 16 rounds.
- Mark Task 2 complete in `docs/test-tasks.md`.

## Non-Goals

- Draft state transition tests.
- Manual pick entry tests.
- Available player tests.
- Roster tracking tests.
- Recommendation tests.
- UI or component tests.
- Refactoring `src/lib/draftOrder.ts`.
- Changing draft behavior.
- Adding new test utilities.

## Expected Files

- `src/lib/draftOrder.test.ts`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing `src/lib/draftOrder.ts` unless a test exposes an actual bug in existing behavior.

Avoid changing package metadata, Vitest config, app components, seed data, recommendation logic, or project scope docs.

## Implementation Steps

1. Update imports in `src/lib/draftOrder.test.ts`.
   - Import:
     - `generateSnakeDraftOrder`
     - `getDraftPositionForPick`
     - `getPickInRound`
     - `getRoundForPick`
   - Keep using the `@` alias.

2. Add tests for `getRoundForPick`.
   - Use `teamCount = 4`.
   - Assert exact round values:
     - pick 1 -> round 1
     - pick 4 -> round 1
     - pick 5 -> round 2
     - pick 8 -> round 2
     - pick 9 -> round 3

3. Add tests for `getPickInRound`.
   - Use `teamCount = 4`.
   - Assert exact pick-in-round values:
     - pick 1 -> 1
     - pick 4 -> 4
     - pick 5 -> 1
     - pick 8 -> 4
     - pick 9 -> 1

4. Add tests for `getDraftPositionForPick`.
   - Use `teamCount = 4`.
   - Assert odd-round picks move first to last:
     - pick 1 -> draft position 1
     - pick 2 -> draft position 2
     - pick 3 -> draft position 3
     - pick 4 -> draft position 4
   - Assert even-round picks move last to first:
     - pick 5 -> draft position 4
     - pick 6 -> draft position 3
     - pick 7 -> draft position 2
     - pick 8 -> draft position 1

5. Replace the existing `generateSnakeDraftOrder` smoke test with exact order tests.
   - For `generateSnakeDraftOrder(4, 2)`, assert the full array equals:

```ts
[
  { pickNumber: 1, round: 1, pickInRound: 1, teamId: "team-1" },
  { pickNumber: 2, round: 1, pickInRound: 2, teamId: "team-2" },
  { pickNumber: 3, round: 1, pickInRound: 3, teamId: "team-3" },
  { pickNumber: 4, round: 1, pickInRound: 4, teamId: "team-4" },
  { pickNumber: 5, round: 2, pickInRound: 1, teamId: "team-4" },
  { pickNumber: 6, round: 2, pickInRound: 2, teamId: "team-3" },
  { pickNumber: 7, round: 2, pickInRound: 3, teamId: "team-2" },
  { pickNumber: 8, round: 2, pickInRound: 4, teamId: "team-1" },
]
```

6. Add an MVP-shape test.
   - For `generateSnakeDraftOrder(12, 16)`, assert:
     - the generated order has 192 picks
     - first pick is `{ pickNumber: 1, round: 1, pickInRound: 1, teamId: "team-1" }`
     - pick 12 is `{ pickNumber: 12, round: 1, pickInRound: 12, teamId: "team-12" }`
     - pick 13 is `{ pickNumber: 13, round: 2, pickInRound: 1, teamId: "team-12" }`
     - final pick is `{ pickNumber: 192, round: 16, pickInRound: 12, teamId: "team-1" }`

7. Update `docs/test-tasks.md`.
   - Mark `Task 2: Add Draft Order Unit Tests` as complete.
   - Do not mark Task 3 or later tasks complete.

8. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `getRoundForPick` has exact unit coverage.
- `getPickInRound` has exact unit coverage.
- `getDraftPositionForPick` has exact odd/even round unit coverage.
- `generateSnakeDraftOrder` has exact small-draft unit coverage.
- `generateSnakeDraftOrder(12, 16)` is checked for 192 picks and key boundary picks.
- Tests avoid weak existence-only assertions.
- Production draft order code is unchanged unless a real bug is found.
- `docs/test-tasks.md` marks only Task 2 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because runtime app behavior is not intended to change.

## Slice Review

- Smallest meaningful increment: yes, it covers only pure draft order helpers.
- Concrete enough for implementation: yes, exact functions, cases, expected values, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no production refactor or new test utility is required.
- Blast radius reasonable: yes, expected changes are one test file, test-task docs, and this slice plan.
- Review/revert comfort: yes, the change is isolated to tests and task tracking unless a genuine bug is discovered.
- Observable/testable acceptance criteria: yes, exact assertions plus `npm test`, lint, build, and the Task 2 checkbox verify the slice.
