# Current Slice: Expand Overflow Bench Slots V1

## Goal

Fix the roster display edge case where drafted user players can disappear once all eligible starter and Bench slots are filled.

The roster panel should always show every user-drafted player, even in unlikely draft shapes such as:

- Drafting 11+ players at the same FLEX-eligible position.
- Filling Bench while leaving `DST` or `K` empty.
- Drafting extra `QB`, `DST`, or `K` players after their starter slot and fixed Bench slots are full.

## User-Visible Increment

The `Your Roster` panel still shows the MVP starter slots and six normal Bench slots. If more user-drafted players remain after those slots are filled, the panel adds extra Bench rows so no drafted player is hidden.

## Goals

- Preserve the existing MVP starter slots:
  - `QB`
  - `RB`
  - `RB`
  - `WR`
  - `WR`
  - `TE`
  - `FLEX`
  - `FLEX`
  - `DST`
  - `K`
- Preserve the existing six normal `Bench` slots.
- Add derived overflow Bench slots only for players that cannot fit into the normal starter or Bench slots.
- Keep all roster data derived from the existing `players` prop.
- Keep existing position counts visible.
- Keep the existing empty roster state before any user picks.
- Keep the existing flat drafted-player list if it remains compact and useful.

## Non-Goals

- Overfilled position warnings.
- Roster validation errors.
- Optimal roster assignment.
- Drag/drop roster management.
- Manual slot overrides.
- Recommendation logic.
- Persistence.
- New domain models.
- Context providers, reducers, or global state.

## Expected Files

- `src/components/UserRosterPanel.tsx`
- `docs/current-slice.md`

Do not update `docs/tasks.md` unless implementation reveals that an existing task is directly completed by this bug fix. Leave `Detect overfilled positions` unchecked.

Avoid changing `DraftRoom`, draft types, seed data, recommendation logic, or package dependencies.

## Implementation Constraint

Keep the solution local to `UserRosterPanel`. Use derived data inside the existing slot-assignment flow.

Do not add:

- Separate roster state.
- A `UserRoster` domain type.
- Reducers.
- Context.
- Global state.
- Persistence.
- A general-purpose roster engine.

## Slot Assignment Rules

Assign players in the order they appear in the `players` prop, which should already be sorted by `pickNumber`.

For each player:

1. `QB` fills the `QB` slot first, then normal Bench slots.
2. `RB` fills `RB` slots first, then `FLEX` slots, then normal Bench slots.
3. `WR` fills `WR` slots first, then `FLEX` slots, then normal Bench slots.
4. `TE` fills the `TE` slot first, then `FLEX` slots, then normal Bench slots.
5. `DST` fills the `DST` slot first, then normal Bench slots.
6. `K` fills the `K` slot first, then normal Bench slots.
7. If no eligible starter or normal Bench slot is open, append an overflow Bench slot for that player.

Overflow Bench slots should:

- Be created only for overflow players.
- Appear after the six normal Bench slots.
- Use stable ids such as `bench-overflow-1`, `bench-overflow-2`, etc.
- Use the visible label `Bench`.
- Show the same filled-player details as normal filled slots.
- Not create empty overflow slots.

## Implementation Steps

1. Update `src/components/UserRosterPanel.tsx`.
   - Adjust the local slot assignment helper so it tracks whether a player was assigned.
   - When a player cannot be assigned to a starter or normal Bench slot, append a filled overflow Bench slot for that player.
   - Keep the starter slot definitions and six normal Bench slot definitions intact.
   - Keep empty slot rendering for starter and normal Bench slots.
   - Ensure overflow Bench slots render only when filled.
   - Keep position counts unchanged.
   - Keep the empty roster state when no players are drafted.

2. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify the roster panel still renders.

3. Manual test the bug scenario.
   - Draft enough user players to fill all eligible starter and normal Bench slots while leaving `DST` or `K` empty.
   - Confirm the extra user picks appear as additional Bench rows instead of disappearing.
   - Undo the last overflow pick and confirm the extra Bench row disappears.

## Acceptance Criteria

- `Your Roster` still renders before any user picks.
- Position counts still render.
- MVP starter slots and six normal Bench slots still render.
- Empty starter and normal Bench slots remain visibly empty.
- Overflow Bench slots are not shown when no overflow players exist.
- A user-drafted player that cannot fit into any starter or normal Bench slot appears in an additional Bench row.
- Multiple overflow players each appear in their own additional Bench row.
- Overflow Bench rows appear after the six normal Bench slots.
- Overflow Bench rows do not create empty placeholders.
- Undoing an overflow user pick removes the corresponding overflow Bench row.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

With the 4-team default draft and user draft position 2, user picks occur at picks 2, 7, 10, 15, 18, 23, 26, and so on.

The easiest manual edge case is to avoid drafting `DST` and `K`, then keep drafting `RB`, `WR`, and `TE` until the two direct position groups, two `FLEX` slots, and six normal Bench slots are full. Any additional user `RB`, `WR`, or `TE` should appear as an extra Bench row.

Another edge case is drafting extra `QB`, `DST`, or `K` players after their starter slot and all normal Bench slots are full.

## Slice Review

- Smallest meaningful increment: yes, this fixes a specific roster visibility bug without adding warnings or validation.
- Concrete enough for implementation: yes, the overflow rule, slot placement, and ids are explicit.
- Avoids unnecessary architecture changes: yes, all logic stays derived inside `UserRosterPanel`.
- Blast radius reasonable: yes, expected implementation touches one component and this planning doc.
- Review/revert comfort: yes, the change is isolated to roster display behavior.
- Observable/testable acceptance criteria: yes, overflow rows and undo behavior are visible in the UI.
