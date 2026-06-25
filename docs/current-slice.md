# Current Slice: Add Draft State Transition Tests

## Source Task

`docs/test-tasks.md` Task 3: Add Draft State Transition Tests.

## Goal

Validate the draft-state changes that happen when a player is drafted or a pick is undone.

This slice should extract the existing transition behavior from `DraftRoom` into small pure helpers, then test those helpers directly.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is stronger confidence from:

```txt
npm test
```

covering draft pick and undo state transitions.

## Problem

The app already supports manual pick entry and undo, but the transition logic currently lives inside `DraftRoom` component state setters.

That makes the behavior hard to unit test without React component tooling. Phase 1 testing should prioritize deterministic draft-state business logic, so this slice should move only the smallest transition logic into a pure module.

## Goals

- Add pure draft transition helpers.
- Keep `DraftRoom` behavior unchanged by calling those helpers from the existing state setters.
- Add unit tests for drafting and undoing picks.
- Mark Task 3 complete in `docs/test-tasks.md`.

## Non-Goals

- Redesigning draft state management.
- Introducing React component tests.
- Adding browser tests.
- Changing UI behavior.
- Changing draft order helpers.
- Changing recommendation behavior.
- Adding draft invariant helpers beyond what is needed for transition tests.
- Adding persistence, replay, or provider abstractions.

## Expected Files

- `src/lib/draftState.ts`
- `src/lib/draftState.test.ts`
- `src/components/DraftRoom.tsx`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing available-player UI, roster UI, recommendation UI, seed data, ranking data, package metadata, or Vitest config.

## Helper API

Create `src/lib/draftState.ts` with these exported functions:

```ts
export function draftPlayerInDraft(draft: Draft, playerId: string): Draft;

export function undoLastDraftPick(draft: Draft): Draft;
```

Use the existing `Draft` type from `@/types/draft`.

Keep behavior intentionally identical to the current `DraftRoom` logic:

- Return the original `draft` object unchanged when the action is blocked.
- Draft into the pick matching `draft.currentPickNumber`.
- Prevent drafting when no current pick exists.
- Prevent drafting into an already-filled current pick.
- Prevent drafting duplicate `playerId`s.
- Prevent drafting after every pick has a `playerId`.
- Advance `currentPickNumber` by one, capped at `teamCount * rounds`.
- Undo the highest-numbered drafted pick.
- Undo restores `currentPickNumber` to the undone pick number.
- Undo clears that pick by setting `playerId` to `undefined`.
- Undo on an empty draft returns the original `draft` object unchanged.

## Implementation Steps

1. Create `src/lib/draftState.ts`.
   - Import `Draft` as a type from `@/types/draft`.
   - Add `draftPlayerInDraft`.
   - Add `undoLastDraftPick`.
   - Copy the current transition behavior from `DraftRoom` without adding new rules.

2. Update `src/components/DraftRoom.tsx`.
   - Import `draftPlayerInDraft` and `undoLastDraftPick` from `@/lib/draftState`.
   - Replace the body of `draftPlayer` with:

```ts
setActiveDraft((currentDraft) => draftPlayerInDraft(currentDraft, playerId));
```

   - Replace the body of `undoLastPick` with:

```ts
setActiveDraft((currentDraft) => undoLastDraftPick(currentDraft));
```

   - Do not change props, derived state, rendering, roster logic, recommendation logic, or UI text.

3. Create `src/lib/draftState.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import `draftPlayerInDraft` and `undoLastDraftPick` from `@/lib/draftState`.
   - Import `generateSnakeDraftOrder` and `createDraftTeams` from `@/lib/draftOrder`.
   - Define a small local `createTestDraft` helper using 2 teams and 2 rounds by default.
   - Keep test data inline and readable.

4. Add tests for drafting a player.
   - Drafting a valid player assigns that player to the current pick.
   - Drafting a valid player advances `currentPickNumber` by exactly one.
   - The original draft object is not mutated.

5. Add tests for blocked draft actions.
   - Duplicate `playerId` cannot be assigned to multiple picks.
   - Drafting is blocked when the current pick already has a player.
   - Drafting is blocked when `currentPickNumber` does not match any pick.
   - Drafting is blocked after the draft is complete.
   - Blocked actions return the original draft object unchanged.

6. Add tests for undo.
   - Undo clears only the latest drafted pick.
   - Undo restores `currentPickNumber` to the undone pick number.
   - Undo on an empty draft returns the original draft object unchanged.

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
- `DraftRoom` uses the pure helpers for draft and undo actions.
- Valid drafting assigns the player to the current pick.
- Valid drafting advances `currentPickNumber` by one until the draft is complete.
- Duplicate player IDs cannot be assigned to multiple picks.
- Filled current picks cannot be overwritten.
- Missing current picks are blocked.
- Extra picks are blocked after the final pick.
- Undo clears only the latest drafted pick.
- Undo restores `currentPickNumber`.
- Undo on an empty draft leaves draft state unchanged.
- Tests verify blocked actions return the original draft object unchanged.
- Production behavior is unchanged except for moving logic into pure helpers.
- `docs/test-tasks.md` marks only Task 3 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because the extracted helper should preserve existing behavior and automated tests cover the transition logic.

If validation suggests the UI behavior changed, stop and investigate rather than expanding scope.

## Slice Review

- Smallest meaningful increment: yes, it extracts and tests only draft/undo transitions.
- Concrete enough for implementation: yes, helper names, behavior, files, tests, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no state-management redesign or provider abstraction is introduced.
- Blast radius reasonable: yes, expected changes are one helper module, one test file, one component using the helper, test-task docs, and this slice plan.
- Review/revert comfort: yes, the extraction is local and preserves existing behavior.
- Observable/testable acceptance criteria: yes, unit tests plus lint/build and the Task 3 checkbox verify the slice.
