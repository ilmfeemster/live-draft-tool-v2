# Current Slice: User Roster V1

## Goal

Show the user's drafted players and basic position counts as the draft progresses.

This slice proves that the app can distinguish the user's picks from the rest of the draft:

- Picks made by `draft.userTeamId` appear in a roster panel.
- Picks made by other teams do not appear in the user's roster.
- Undoing a user pick removes that player from the roster.

## User-Visible Increment

The draft board includes a `Your Roster` panel. As picks are entered, players drafted by the user's team appear in that panel, and position counts update.

## Goals

- Derive user roster entries from `activeDraft.picks`.
- Join user picks to `rankings` to display player name, team, position, and pick number.
- Show basic position counts for `QB`, `RB`, `WR`, `TE`, `DST`, and `K`.
- Keep the roster panel in sync with draft and undo actions.
- Keep all roster state derived; do not store a second roster state.

## Non-Goals

- Roster slot assignment.
- FLEX eligibility logic.
- Overfilled position warnings.
- Recommendations.
- Search.
- Persistence.
- New draft setup UI.
- Context providers, reducers, global state, or new domain models.

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/UserRosterPanel.tsx`
- `docs/tasks.md`

Avoid changing domain types unless implementation reveals a real gap.

## Implementation Constraint

Use derived data from existing local React state in `DraftRoom`. Do not add a separate `UserRoster` type, separate roster state, reducers, context, global state, persistence, or a draft history model.

## Implementation Steps

1. Create `src/components/UserRosterPanel.tsx`.
   - Accept a `players` prop containing roster entries.
   - Define the roster entry prop type locally in this file or export it only if `DraftRoom` needs it.
   - Each roster entry should include:
     - `pickNumber`
     - `name`
     - `team`
     - `position`
   - Derive position counts for `QB`, `RB`, `WR`, `TE`, `DST`, and `K`.
   - Render a `Your Roster` heading.
   - Render position counts.
   - Render an empty state when there are no user players.
   - Render a simple list of drafted user players when present.

2. Update `src/components/DraftRoom.tsx`.
   - Import `UserRosterPanel`.
   - Derive `userRosterPlayers` from `activeDraft.picks` and `rankings`.
   - Include only picks where:
     - `pick.teamId === activeDraft.userTeamId`
     - `pick.playerId` exists
   - Find the matching ranking entry by `player.id`.
   - Sort roster players by `pickNumber`.
   - Render `UserRosterPanel` in the right-side column near `DraftStatusPanel`.
   - Keep `availableRankings`, draft, and undo behavior unchanged except as needed for layout.

3. Update `docs/tasks.md`.
   - Mark `Detect user picks` complete.
   - Mark `Add player to roster` complete.
   - Mark `Display positional counts` complete.
   - Leave `Display roster slots` and `Detect overfilled positions` unchecked.

4. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run the dev server and verify page HTML renders.

## Acceptance Criteria

- The app renders with the available players table, draft status panel, and user roster panel.
- The user roster panel shows an empty state before user picks are drafted.
- Drafting picks for teams other than `draft.userTeamId` does not add players to the user roster.
- Drafting a pick for `draft.userTeamId` adds that player to the user roster.
- Undoing a user pick removes that player from the user roster.
- Position counts update from drafted user players.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

The default user team is `Team 6`, so the first user roster addition occurs on pick 6. To test manually, draft six players and verify the sixth player appears in `Your Roster`.

## Slice Review

- Smallest meaningful increment: yes, it proves user roster tracking without slot assignment or warnings.
- Concrete enough for implementation: yes, data derivation, files, and display requirements are specified.
- Avoids unnecessary architecture changes: yes, roster is derived from existing local draft state.
- Blast radius reasonable: yes, expected changes are two source files plus task docs.
- Review/revert comfort: yes, the slice is isolated to one new panel and one derived data path.
- Observable/testable acceptance criteria: yes, roster visibility and counts can be checked through the UI.
