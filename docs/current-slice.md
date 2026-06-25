# Current Slice: Add Draft Invariant Tests

## Source Task

`docs/test-tasks.md` Task 4: Add Draft Invariant Tests.

## Goal

Add a small pure invariant checker for Phase 1 draft state and cover it with unit tests.

This slice should verify that draft states produced by the current manual draft engine remain internally consistent after picks and undo actions.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

now validates core draft invariants directly.

## Problem

`docs/testing.md` defines important draft invariants:

- A player exists in exactly one location.
- Drafted players never appear in the available player pool.
- Available players never appear on a roster.
- Total drafted players equals the current pick number minus one.
- Every drafted player belongs to exactly one team.
- Undo restores the previous valid draft state.
- Recommendation results only contain available players.

Task 3 added pure transition helpers and tests for pick/undo behavior, but there is still no reusable way to check draft-state validity. Phase 1 needs direct invariant coverage before adding broader workflow tests.

## Goals

- Add a pure invariant checker for draft state and related player lists.
- Test valid empty, picked, and undone draft states.
- Test invalid duplicate drafted-player state.
- Test invalid available/recommendation lists containing drafted players.
- Mark Task 4 complete in `docs/test-tasks.md`.

## Non-Goals

- Exhaustive property-based testing.
- React component tests.
- Browser tests.
- Database constraints.
- Live provider event tests.
- Full workflow integration tests.
- Recommendation scoring tests.
- Roster slot assignment tests.
- Changing draft transition behavior.
- Changing UI behavior.

## Expected Files

- `src/lib/draftInvariants.ts`
- `src/lib/draftInvariants.test.ts`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, UI components, package metadata, Vitest config, seed data, ranking data, recommendation scoring, or existing draft transition helpers unless a test exposes a real bug.

## Helper API

Create `src/lib/draftInvariants.ts`:

```ts
import type { Draft, RankingEntry, UserRosterPlayer } from "@/types/draft";

export type DraftInvariantViolation =
  | "duplicate-drafted-player"
  | "drafted-player-available"
  | "available-player-on-roster"
  | "drafted-count-mismatch"
  | "drafted-player-missing-team"
  | "recommendation-player-unavailable";

export type DraftInvariantInput = {
  draft: Draft;
  availableRankings?: RankingEntry[];
  rosterPlayers?: UserRosterPlayer[];
  recommendationRankings?: RankingEntry[];
};

export function findDraftInvariantViolations(
  input: DraftInvariantInput,
): DraftInvariantViolation[];

export function isValidDraftState(input: DraftInvariantInput): boolean;
```

Keep the helper intentionally small:

- Return an array of violation strings.
- Return an empty array for valid state.
- Do not throw.
- Do not mutate input.
- Do not add classes or a validation framework.

## Invariants To Check

### Always Check From `draft`

- A drafted player ID may appear in at most one pick.
  - Violation: `"duplicate-drafted-player"`
- Drafted player count should equal `draft.currentPickNumber - 1`, except when the draft is complete and `currentPickNumber` is capped at total picks.
  - Let `totalPicks = draft.teamCount * draft.rounds`.
  - Expected drafted count is:

```ts
Math.min(draft.currentPickNumber - 1, totalPicks)
```

  - If every pick is filled, expected drafted count is `totalPicks`.
  - Violation: `"drafted-count-mismatch"`
- Every drafted pick must have a `teamId`.
  - Violation: `"drafted-player-missing-team"`

### Check When Optional Lists Are Provided

- `availableRankings` must not contain drafted player IDs.
  - Violation: `"drafted-player-available"`
- `rosterPlayers` must not contain player names that still appear in `availableRankings`.
  - Violation: `"available-player-on-roster"`
  - This uses name matching because `UserRosterPlayer` currently does not include `playerId`.
- `recommendationRankings` must not contain players absent from `availableRankings`, when `availableRankings` is provided.
  - Violation: `"recommendation-player-unavailable"`

## Implementation Steps

1. Create `src/lib/draftInvariants.ts`.
   - Import `Draft`, `RankingEntry`, and `UserRosterPlayer` as types.
   - Add the `DraftInvariantViolation` type.
   - Add the `DraftInvariantInput` type.
   - Add `findDraftInvariantViolations`.
   - Add `isValidDraftState`.

2. Create `src/lib/draftInvariants.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import `createDraftTeams` and `generateSnakeDraftOrder` from `@/lib/draftOrder`.
   - Import `draftPlayerInDraft` and `undoLastDraftPick` from `@/lib/draftState`.
   - Import `findDraftInvariantViolations` and `isValidDraftState`.
   - Import `Draft`, `RankingEntry`, and `UserRosterPlayer` as types.
   - Define local helpers:
     - `createTestDraft(overrides?: Partial<Draft>): Draft`
     - `createRanking(id: string, name?: string): RankingEntry`

3. Add valid-state tests.
   - Empty draft:
     - `isValidDraftState({ draft })` is `true`.
     - `findDraftInvariantViolations({ draft })` returns `[]`.
   - After one valid pick using `draftPlayerInDraft`:
     - invariant check is valid.
   - After two picks and one undo using `undoLastDraftPick`:
     - invariant check is valid.
     - current pick/drafted count relationship is valid.

4. Add invalid duplicate drafted-player test.
   - Create a draft with the same `playerId` on two picks.
   - Assert violations contain `"duplicate-drafted-player"`.

5. Add invalid drafted-count test.
   - Create a draft with `currentPickNumber: 3` but only one drafted player.
   - Assert violations contain `"drafted-count-mismatch"`.

6. Add available-player invariant test.
   - Draft `"player-1"`.
   - Pass `availableRankings` containing ranking for `"player-1"`.
   - Assert violations contain `"drafted-player-available"`.

7. Add roster/available invariant test.
   - Pass `availableRankings` containing a ranking named `"Player One"`.
   - Pass `rosterPlayers` containing `{ name: "Player One", ... }`.
   - Assert violations contain `"available-player-on-roster"`.

8. Add recommendation availability invariant test.
   - Pass `availableRankings` with `"player-1"`.
   - Pass `recommendationRankings` with `"player-2"`.
   - Assert violations contain `"recommendation-player-unavailable"`.

9. Update `docs/test-tasks.md`.
   - Mark `Task 4: Add Draft Invariant Tests` as complete.
   - Do not mark Task 5 or later tasks complete.

10. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `findDraftInvariantViolations` exists as a pure helper.
- `isValidDraftState` exists as a pure helper.
- Empty draft state is valid.
- Draft state after valid picks is valid.
- Draft state after undo is valid.
- Duplicate drafted player IDs are detected.
- Drafted count mismatch is detected.
- Drafted players in available rankings are detected.
- Available players on roster are detected.
- Recommendation rankings containing unavailable players are detected.
- Helpers do not mutate inputs.
- No UI behavior changes.
- `docs/test-tasks.md` marks only Task 4 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because runtime app behavior is not intended to change.

If invariant tests reveal an existing invalid state produced by current draft helpers, stop and report it instead of broadening the slice.

## Slice Review

- Smallest meaningful increment: yes, it adds invariant checks only for Phase 1 draft state.
- Concrete enough for implementation: yes, helper names, violation strings, optional inputs, exact tests, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no validation framework, provider abstraction, database constraint, or UI integration is introduced.
- Blast radius reasonable: yes, expected changes are one helper module, one test file, test-task docs, and this slice plan.
- Review/revert comfort: yes, the helper is isolated and does not change runtime UI behavior.
- Observable/testable acceptance criteria: yes, unit tests plus lint/build and the Task 4 checkbox verify the slice.
