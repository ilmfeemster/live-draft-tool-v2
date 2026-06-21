# Current Slice: Undo Last Pick V1

## Goal

Allow the user to undo the most recent drafted player and return the draft to the previous pick.

This slice proves the reverse draft state transition:

- The most recent pick can be cleared.
- The drafted player returns to the available player pool.
- The draft status moves back to the undone pick.

## User-Visible Increment

After drafting a player, an `Undo Last Pick` action is available in the Draft Status panel. Using it clears the last drafted player, returns that player to the available list, and moves Current Pick back by one.

## Goals

- Add an undo action for the most recent drafted pick.
- Disable undo when no picks have been drafted.
- Clear `playerId` from the most recent drafted pick.
- Set `currentPickNumber` back to the undone pick number.
- Make the previously drafted player appear in the available players table again.

## Non-Goals

- Multi-step history UI.
- Draft board history display.
- Confirm dialogs.
- Keyboard shortcuts.
- Roster tracking.
- Recommendations.
- Persistence.
- Reducers, context providers, or global state.

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/DraftStatusPanel.tsx`
- `docs/tasks.md`

Avoid changing domain types or adding new files unless implementation reveals a real gap.

## Implementation Constraint

Use the existing local React state in `DraftRoom`. Do not add reducers, context, global state, persistence, new domain models, or a separate history structure.

## Implementation Steps

1. Update `src/components/DraftRoom.tsx`.
   - Derive `canUndoLastPick` from whether any pick has a `playerId`.
   - Implement `undoLastPick()`.
   - In `undoLastPick`, find the drafted pick with the highest `pickNumber`.
   - If no drafted pick exists, return the existing draft.
   - Clear `playerId` from that pick.
   - Set `currentPickNumber` to that pick's `pickNumber`.
   - Pass `canUndoLastPick` and `undoLastPick` to `DraftStatusPanel`.

2. Update `src/components/DraftStatusPanel.tsx`.
   - Add required props:
     - `canUndoLastPick: boolean`
     - `onUndoLastPick: () => void`
   - Render an `Undo Last Pick` button.
   - Disable the button when `canUndoLastPick` is false.
   - Call `onUndoLastPick` when clicked.
   - Keep existing status display behavior.

3. Update `docs/tasks.md`.
   - Mark `Add undo functionality` complete.
   - Leave roster tracking, search, recommendations, and validation checklist items unchanged unless directly completed by this slice.

4. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run the dev server and verify page HTML renders.

## Acceptance Criteria

- The app renders with the available players table and draft status panel.
- `Undo Last Pick` is visible in the Draft Status panel.
- `Undo Last Pick` is disabled before any player is drafted.
- Drafting a player enables `Undo Last Pick`.
- Undoing clears the most recent drafted pick.
- Undoing returns the player to the available table.
- Undoing moves Current Pick back to the undone pick number.
- `npm run lint` passes.
- `npm run build` passes.

## Slice Review

- Smallest meaningful increment: yes, it adds one required reverse action for the existing manual pick flow.
- Concrete enough for implementation: yes, state ownership, props, and update behavior are specified.
- Avoids unnecessary architecture changes: yes, it reuses local state in `DraftRoom`.
- Blast radius reasonable: yes, expected changes are two source files plus task docs.
- Review/revert comfort: yes, the slice is isolated to undo behavior.
- Observable/testable acceptance criteria: yes, UI button state and draft state changes are explicit.
