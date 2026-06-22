# Current Slice: Roster Slots V1

## Goal

Show the user's drafted players in simple roster slots so manual testing can verify how a team fills out.

This slice builds on `User Roster V1` by turning the flat roster list into a more useful roster view:

- Required starter slots are visible.
- Drafted players are assigned to straightforward slots.
- Extra drafted players go to Bench.

## User-Visible Increment

The `Your Roster` panel shows starter slots for the MVP lineup and bench slots. As the user's team drafts players, the slots fill in a predictable order.

## Goals

- Display MVP roster slots:
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
  - `Bench` x6
- Assign players to slots using simple deterministic rules.
- Keep existing position counts visible.
- Keep roster data derived from the existing `players` prop.
- Keep the existing flat drafted-player list only if it remains useful and compact.

## Non-Goals

- Optimal roster assignment.
- Drag/drop roster management.
- Manual slot overrides.
- Overfilled position warnings.
- Recommendation logic.
- Persistence.
- New domain models.
- Context providers, reducers, or global state.

## Expected Files

- `src/components/UserRosterPanel.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, draft types, or seed data unless implementation reveals a real gap.

## Implementation Constraint

Use derived data inside `UserRosterPanel`. Do not add a separate roster state, a `UserRoster` domain type, reducers, context, global state, persistence, or a general-purpose roster engine.

## Slot Assignment Rules

Assign players in the order they appear in the `players` prop, which should already be sorted by `pickNumber`.

For each player:

1. `QB` fills the `QB` slot first, then Bench.
2. `RB` fills `RB` slots first, then `FLEX` slots, then Bench.
3. `WR` fills `WR` slots first, then `FLEX` slots, then Bench.
4. `TE` fills the `TE` slot first, then `FLEX` slots, then Bench.
5. `DST` fills the `DST` slot first, then Bench.
6. `K` fills the `K` slot first, then Bench.
7. If Bench is full, leave the player out of slots for now. Do not add warnings in this slice.

## Implementation Steps

1. Update `src/components/UserRosterPanel.tsx`.
   - Define a local slot shape with:
     - `id`
     - `label`
     - `acceptedPositions`
     - `player`
   - Create the starter slot list for the MVP lineup.
   - Create six bench slots.
   - Derive filled slots from the `players` prop using the Slot Assignment Rules above.
   - Render a `Roster Slots` section.
   - For empty slots, show the slot label and an empty placeholder.
   - For filled slots, show player name, team, position, and pick number.
   - Keep existing position counts.
   - Keep the empty roster state when no players are drafted.

2. Update `docs/tasks.md`.
   - Mark `Display roster slots` complete.
   - Leave `Detect overfilled positions` unchecked.
   - Do not change recommendation or search task items.

3. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify roster slots render.

## Acceptance Criteria

- `Your Roster` still renders before any user picks.
- Position counts still render.
- Roster slots render with all MVP starter slots and six Bench slots.
- Empty slots are visibly empty.
- A drafted user `QB` fills `QB`then Bench.
- Drafted user `RB` players fill `RB`, then `FLEX`, then Bench.
- Drafted user `WR` players fill `WR`, then `FLEX`, then Bench.
- A drafted user `TE` fills `TE`, then `FLEX`, then Bench.
- A drafted user `DST` fills `DST`then Bench.
- A drafted user `K` fills `K`then Bench.
- Undoing a user pick updates the slot display.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

With the 4-team default draft and user draft position 2, user picks occur at picks 2, 7, 10, 15, 18, 23, 26, and so on. Draft enough user picks across RB, WR, and TE to confirm direct slots fill before FLEX and Bench.

## Slice Review

- Smallest meaningful increment: yes, it adds visible roster slots without warnings or optimization.
- Concrete enough for implementation: yes, the slot list and assignment rules are explicit.
- Avoids unnecessary architecture changes: yes, all logic stays derived inside `UserRosterPanel`.
- Blast radius reasonable: yes, expected changes are one component plus task docs.
- Review/revert comfort: yes, the slice is isolated to roster display.
- Observable/testable acceptance criteria: yes, slot rendering and fill order are visible in the UI.
