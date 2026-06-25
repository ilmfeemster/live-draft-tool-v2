# Current Slice: Add Draft State Transition Tests

## Source Task

`docs/test-tasks.md` Task 3: Add Draft State Transition Tests.

## Goal

Move the existing draft-pick and undo state transitions out of `DraftRoom` into pure helpers, then cover those helpers with focused unit tests.

This is a testing slice with a small production extraction so the behavior can be tested without React component tooling.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

now validates manual pick and undo state transitions.

## Problem

Manual pick entry and undo are Phase 1 Draft State Engine behavior, but the transition rules currently live inside `DraftRoom` state setter callbacks.

That means the rules are only indirectly validated through manual use. Extracting the existing logic into pure helpers gives the project direct tests for the highest-risk draft state changes while keeping the React component simple.

## Goals

- Extract the existing draft and undo transition behavior into pure helpers.
- Update `DraftRoom` to call those helpers.
- Add exact unit tests for valid draft actions, blocked draft actions, and undo actions.
- Mark Task 3 complete in `docs/test-tasks.md`.

## Non-Goals

- Redesigning draft state management.
- Changing draft behavior.
- Changing UI rendering, labels, props, layout, or derived display state.
- Adding React component tests.
- Adding browser tests.
- Adding draft invariant helpers.
- Changing draft order tests.
- Changing recommendation behavior.
- Adding persistence, replay, provider, or integration abstractions.

## Expected Files

- `src/lib/draftState.ts`
- `src/lib/draftState.test.ts`
- `src/components/DraftRoom.tsx`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing package metadata, Vitest config, seed data, ranking data, available-player UI, roster UI, recommendation UI, or project scope docs.

## Helper API

Create `src/lib/draftState.ts`:

```ts
import type { Draft } from "@/types/draft";

export function draftPlayerInDraft(draft: Draft, playerId: string): Draft {
  // existing DraftRoom draft behavior
}

export function undoLastDraftPick(draft: Draft): Draft {
  // existing DraftRoom undo behavior
}
```

Do not introduce classes, reducers, action objects, React hooks, or a broader state-management abstraction.

## Behavior To Preserve

### `draftPlayerInDraft`

- Finds the pick where `pick.pickNumber === draft.currentPickNumber`.
- Returns the original `draft` object unchanged when:
  - no current pick exists
  - the current pick already has a `playerId`
  - the `playerId` has already been drafted
  - every pick already has a `playerId`
- For a valid draft action:
  - returns a new draft object
  - does not mutate the input draft
  - assigns `playerId` to the current pick
  - advances `currentPickNumber` by one
  - caps `currentPickNumber` at `draft.teamCount * draft.rounds`
  - preserves all unrelated pick fields

### `undoLastDraftPick`

- Finds the highest-numbered pick with a `playerId`.
- Returns the original `draft` object unchanged when no drafted pick exists.
- For a valid undo action:
  - returns a new draft object
  - does not mutate the input draft
  - clears only the latest drafted pick by setting `playerId` to `undefined`
  - restores `currentPickNumber` to the undone pick number
  - preserves earlier drafted picks

## Implementation Steps

1. Create `src/lib/draftState.ts`.
   - Import `Draft` as a type from `@/types/draft`.
   - Move the existing draft logic from `DraftRoom.draftPlayer` into `draftPlayerInDraft`.
   - Move the existing undo logic from `DraftRoom.undoLastPick` into `undoLastDraftPick`.
   - Keep blocked-action behavior as reference equality: return the original `draft`.

2. Update `src/components/DraftRoom.tsx`.
   - Import `draftPlayerInDraft` and `undoLastDraftPick` from `@/lib/draftState`.
   - Replace `draftPlayer` with:

```ts
function draftPlayer(playerId: string) {
  setActiveDraft((currentDraft) => draftPlayerInDraft(currentDraft, playerId));
}
```

   - Replace `undoLastPick` with:

```ts
function undoLastPick() {
  setActiveDraft((currentDraft) => undoLastDraftPick(currentDraft));
}
```

   - Do not change the rest of `DraftRoom`.

3. Create `src/lib/draftState.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import `createDraftTeams` and `generateSnakeDraftOrder` from `@/lib/draftOrder`.
   - Import `draftPlayerInDraft` and `undoLastDraftPick` from `@/lib/draftState`.
   - Import `Draft` as a type from `@/types/draft`.
   - Define a local `createTestDraft(overrides?: Partial<Draft>): Draft` helper.
   - Default helper shape:
     - `id: "test-draft"`
     - `teamCount: 2`
     - `rounds: 2`
     - `userTeamId: "team-1"`
     - `currentPickNumber: 1`
     - `teams: createDraftTeams(2)`
     - `picks: generateSnakeDraftOrder(2, 2)`

4. Add valid draft action tests.
   - Drafting `"player-1"` into an empty draft:
     - returns a new draft object
     - sets pick 1 `playerId` to `"player-1"`
     - advances `currentPickNumber` from 1 to 2
     - leaves the original draft's pick 1 `playerId` undefined
   - Drafting on the final pick:
     - with `currentPickNumber: 4`
     - advances/caps `currentPickNumber` at 4

5. Add blocked draft action tests.
   - Duplicate player ID:
     - start with pick 1 already containing `"player-1"` and `currentPickNumber: 2`
     - drafting `"player-1"` returns the same draft object
   - Filled current pick:
     - current pick already has a player
     - drafting another player returns the same draft object
   - Missing current pick:
     - `currentPickNumber` does not exist in `picks`
     - drafting returns the same draft object
   - Complete draft:
     - every pick has a `playerId`
     - drafting returns the same draft object

6. Add undo tests.
   - Undo with multiple drafted picks:
     - pick 1 has `"player-1"`
     - pick 2 has `"player-2"`
     - `currentPickNumber` is 3
     - returns a new draft object
     - clears only pick 2
     - keeps pick 1 drafted
     - sets `currentPickNumber` to 2
     - leaves the original draft's pick 2 unchanged
   - Undo on an empty draft:
     - returns the same draft object

7. Update `docs/test-tasks.md`.
   - Mark `Task 3: Add Draft State Transition Tests` as complete.
   - Do not mark Task 4 or later tasks complete.

8. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `draftPlayerInDraft` exists as a pure helper.
- `undoLastDraftPick` exists as a pure helper.
- `DraftRoom` uses both helpers.
- Valid draft actions return a new draft object.
- Valid draft actions do not mutate the original draft.
- Valid draft actions assign the player to the current pick.
- Valid draft actions advance `currentPickNumber`, capped at the total pick count.
- Duplicate player IDs are blocked.
- Filled current picks are blocked.
- Missing current picks are blocked.
- Complete drafts block additional picks.
- Blocked draft actions return the original draft object.
- Undo clears only the latest drafted pick.
- Undo restores `currentPickNumber`.
- Undo on an empty draft returns the original draft object.
- Production behavior is unchanged except for moving logic into pure helpers.
- `docs/test-tasks.md` marks only Task 3 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because the extracted helper should preserve existing behavior and automated tests cover the transition logic.

If tests expose a difference between the helper and current `DraftRoom` behavior, preserve the existing behavior unless it is clearly a bug and stop to report the issue.

## Slice Review

- Smallest meaningful increment: yes, it extracts and tests only draft/undo transitions.
- Concrete enough for implementation: yes, helper names, expected behavior, exact test scenarios, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no reducer, hook, provider, or state-management redesign is introduced.
- Blast radius reasonable: yes, expected changes are one helper module, one test file, one component import/call-site update, test-task docs, and this slice plan.
- Review/revert comfort: yes, the extraction is local and preserves current behavior.
- Observable/testable acceptance criteria: yes, unit tests plus lint/build and the Task 3 checkbox verify the slice.
