# Current Slice: Block Drafting After Final Pick

## Goal

Prevent users from drafting additional players after the final draft slot has been filled.

The draft should have a clear completed state instead of leaving the final pick active and allowing later clicks to overwrite that last pick.

## User-Visible Increment

After the last pick of round 16 is made:

- Draft buttons are disabled in both recommendations and available players.
- The draft status panel indicates the draft is complete.
- No additional player can be drafted into the final pick slot.
- Undo still reopens the final pick and allows drafting to continue from that point.

## Problem

`currentPickNumber` is clamped to the final pick number. After the final pick is filled, the active pick remains the final pick. Because the draft action only checks whether the selected player has already been drafted, clicking another available player can overwrite the final pick instead of being blocked.

## Goals

- Add an explicit `isDraftComplete` state derived from existing draft picks.
- Block `draftPlayer` when the draft is complete or the current pick already has a player.
- Disable draft buttons when the draft is complete.
- Show a simple completed state in `DraftStatusPanel`.
- Preserve undo behavior so undoing the final pick makes the draft editable again.

## Non-Goals

- Draft recap.
- Draft grading.
- Persistence.
- Confirmation dialogs.
- New draft state machine.
- New domain types.
- Changing snake draft order generation.
- Changing recommendation scoring.
- Changing roster logic.
- Changing ranking data.

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/DraftStatusPanel.tsx`
- `src/components/RecommendationsPanel.tsx`
- `src/components/AvailablePlayersTable.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing recommendation logic, draft data, draft order helpers, roster UI, seed rankings, or package dependencies.

## Implementation Constraint

Keep this as a local draft-flow guard and presentational UI update.

Do not add:

- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- A full draft completion workflow.

## State Model

In `DraftRoom`, derive:

```txt
totalPicks = activeDraft.teamCount * activeDraft.rounds
isDraftComplete = activeDraft.picks.every(pick => Boolean(pick.playerId))
```

The existing draft order should remain the source of truth for how many picks exist.

## Implementation Steps

1. Update `src/components/DraftRoom.tsx`.
   - Derive `totalPicks` from `activeDraft.teamCount * activeDraft.rounds`.
   - Derive `isDraftComplete` from all draft picks having a `playerId`.
   - In `draftPlayer`, return the current draft without changes when:
     - `currentPick` is missing.
     - `currentPick.playerId` already exists.
     - `isAlreadyDrafted` is true.
     - all draft picks already have a `playerId`.
   - Keep `currentPickNumber` clamped to `totalPicks`.
   - Pass `isDraftComplete` to `DraftStatusPanel`.
   - Pass `isDraftComplete` to `RecommendationsPanel`.
   - Pass `isDraftComplete` to `AvailablePlayersTable`.

2. Update `src/components/DraftStatusPanel.tsx`.
   - Add an `isDraftComplete` prop.
   - When `isDraftComplete` is true, show a simple completed state in the on-the-clock card, such as:
     - heading: `Draft Complete`
     - body: `All draft slots are filled.`
   - Do not show `Your pick` when the draft is complete.
   - Keep current pick, round, user team, and undo button rendering intact.

3. Update `src/components/RecommendationsPanel.tsx`.
   - Add an `isDraftComplete` prop.
   - Disable recommendation draft buttons when `isDraftComplete` is true.
   - Use the existing disabled button styling pattern from the undo button or a matching local variant.
   - Do not change recommendation ordering, scores, or reasons.

4. Update `src/components/AvailablePlayersTable.tsx`.
   - Add an `isDraftComplete` prop.
   - Disable available-player draft buttons when `isDraftComplete` is true.
   - Keep search, position filters, sorting, and table rendering unchanged.

5. Update `docs/tasks.md`.
   - Add and mark complete a validation item for blocking extra picks after the draft is complete.

6. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.

7. Manual smoke test.
   - Complete the final pick of round 16.
   - Confirm draft buttons are disabled after the final pick.
   - Confirm clicking a draft button after completion cannot overwrite the final pick.
   - Confirm `Draft Complete` appears in the draft status area.
   - Undo the final pick.
   - Confirm draft buttons are enabled again.
   - Draft a replacement final pick.
   - Confirm the draft returns to the completed state.

## Acceptance Criteria

- The final pick cannot be overwritten by clicking another available player.
- No player can be drafted after every draft slot is filled.
- Recommendation draft buttons are disabled when the draft is complete.
- Available-player draft buttons are disabled when the draft is complete.
- Draft status clearly indicates the completed state.
- `Your pick` does not display when the draft is complete.
- Undoing the final pick re-enables drafting.
- Drafting after undo fills the final pick and returns to the completed state.
- Drafting before the final pick still advances normally.
- Recommendation ordering, scores, and reasons are unchanged.
- Search, filters, and available-player sorting are unchanged.
- `docs/tasks.md` includes the completed validation item.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice fixes a draft-state boundary bug. The important distinction:

```txt
final pick active and empty = allow drafting
final pick active and filled = draft complete; block drafting
```

Undo is the escape hatch back into an editable draft state.

## Slice Review

- Smallest meaningful increment: yes, this only prevents extra picks after the final draft slot.
- Concrete enough for implementation: yes, the derived boolean, guard conditions, props, disabled buttons, and status text are specified.
- Avoids unnecessary architecture changes: yes, no new state system or draft state machine is introduced.
- Blast radius reasonable: yes, expected changes are four components and task docs.
- Review/revert comfort: yes, the guard and disabled UI can be reviewed independently from recommendation logic.
- Observable/testable acceptance criteria: yes, final-pick overwrite prevention, disabled buttons, undo recovery, lint, and build are directly checkable.
