# Current Slice: Manual Pick Entry V1

## Goal

Allow the user to draft a player from the available players table and advance the draft by one pick.

This slice proves the core draft state transition:

- A player can be selected manually.
- The current pick records that player.
- The drafted player disappears from the available player pool.
- The draft status advances to the next pick.

## User-Visible Increment

From the draft board, each available player row has a draft action. When the action is used, that player is removed from the available list and the Draft Status panel updates from pick 1 to pick 2.

## Goals

- Add client-side draft state for the active draft.
- Filter available rankings by drafted player ids.
- Add a draft action to each available player row.
- Update the current pick with the drafted player id.
- Advance `currentPickNumber` after a successful pick.
- Prevent duplicate drafting by removing drafted players from the table.

## Non-Goals

- Player search.
- Undo.
- User roster tracking.
- Draft board history display.
- Recommendations.
- Persistence.
- Import flow.
- Keyboard shortcuts.

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/AvailablePlayersTable.tsx`
- `src/app/page.tsx`
- `docs/tasks.md`

Avoid changing domain types unless implementation reveals a real gap.

## Implementation Steps

1. Create `src/components/DraftRoom.tsx` as a client component.
   - Import `useMemo` and `useState`.
   - Accept `draft` and `rankings` props.
   - Store the draft in local state.
   - Derive `draftedPlayerIds` from picks with `playerId`.
   - Derive `availableRankings` by excluding drafted player ids.
   - Implement `draftPlayer(playerId: string)`.
   - In `draftPlayer`, find the current pick by `currentPickNumber`.
   - If the player is already drafted or the current pick is missing, return the existing draft.
   - Set `playerId` on the current pick.
   - Advance `currentPickNumber` by 1, capped at total picks.
   - Render `AvailablePlayersTable` with `availableRankings` and `draftPlayer`.
   - Render `DraftStatusPanel` with the current draft state.

2. Update `src/components/AvailablePlayersTable.tsx`.
   - Add an optional or required `onDraftPlayer(playerId: string)` prop.
   - Add an Action column.
   - Render a `Draft` button for each row.
   - Call `onDraftPlayer(entry.player.id)` when clicked.
   - Keep existing position filter and rank sorting behavior.

3. Update `src/app/page.tsx`.
   - Replace direct rendering of `AvailablePlayersTable` and `DraftStatusPanel`.
   - Render `DraftRoom` with `defaultDraft` and `seedRankings`.

4. Update `docs/tasks.md`.
   - Mark manual pick entry pieces complete only if they are satisfied by this slice.
   - Mark `Mark drafted players unavailable` complete if drafted players disappear.
   - Leave search, undo, and roster tracking unchecked.

5. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run the dev server and verify page HTML renders.

## Acceptance Criteria

- The app renders with the available players table and draft status panel.
- Each available player row has a draft action.
- Drafting a player removes that player from the available table.
- Drafting a player advances the current pick in Draft Status.
- A drafted player cannot be drafted again through the table.
- Position filtering still works after a pick.
- `npm run lint` passes.
- `npm run build` passes.

## Slice Review

- Smallest meaningful increment: yes, it proves one manual pick before search, undo, roster, or recommendations.
- Concrete enough for implementation: yes, each file and state transition is specified.
- Avoids unnecessary architecture changes: yes, local React state only.
- Blast radius reasonable: yes, expected code changes are three source files plus task docs.
- Review/revert comfort: yes, one client wrapper and one table action.
- Observable/testable acceptance criteria: yes, UI state and build checks are explicit.
