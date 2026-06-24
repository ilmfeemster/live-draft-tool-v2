# Current Slice: Highlight User Pick

## Goal

Make it obvious when the user's team is currently on the clock.

The app already shows the active drafting team and the user's team, but it does not visually distinguish the moment when those are the same team. During a live draft, that moment needs to be immediately scannable.

## User-Visible Increment

When the active drafting team is the user's team, the `Draft Status` panel should clearly show that it is the user's pick.

Example visible text:

- `Your pick`

## Goals

- Highlight the on-the-clock card when the active team is the user's team.
- Add a short, explicit `Your pick` label only when the user is on the clock.
- Preserve the existing current pick, round, active team, user team, and undo behavior.
- Keep the change local to the draft status UI.
- Keep the styling simple and consistent with the existing emerald user-team styling.

## Non-Goals

- Recommendation scoring changes.
- Recommendation reason changes.
- Draft logic changes.
- Snake order changes.
- Roster logic changes.
- New global state.
- Draft setup flow.
- Notifications, sounds, modals, or browser alerts.
- Keyboard shortcuts.
- New dependencies.

## Expected Files

- `src/components/DraftStatusPanel.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing recommendation logic, draft data, draft order helpers, roster UI, available-player UI, or seed rankings unless implementation reveals a direct compatibility issue.

## Implementation Constraint

Keep this as a presentational UI change.

Do not add:

- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- New UI components.

## UI Model

Use existing draft data inside `DraftStatusPanel`:

```txt
isUserPick = currentPick.teamId === draft.userTeamId
```

When `isUserPick` is `true`:

- Change the `On The Clock` card border/background/text color to match the existing emerald user-team emphasis.
- Show a small `Your pick` label in that card.

When `isUserPick` is `false`:

- Preserve the current neutral `On The Clock` card styling.
- Do not show the `Your pick` label.

## Implementation Steps

1. Update `src/components/DraftStatusPanel.tsx`.
   - Add an `isUserPick` boolean after `currentPick`, `activeTeam`, and `userTeam` are derived.
   - Use `isUserPick` to conditionally set the `On The Clock` card classes.
   - Render `Your pick` inside the `On The Clock` card only when `isUserPick` is true.
   - Keep existing active team name and draft position text.
   - Keep the existing `Your Team` card.
   - Keep the undo button unchanged.

2. Update `docs/tasks.md`.
   - Mark `Highlight user pick` complete.

3. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.

4. Manual smoke test.
   - Load the app.
   - Confirm the `Draft Status` panel still renders.
   - Advance picks until the active team is the user's team.
   - Confirm the `On The Clock` card changes to the highlighted style.
   - Confirm `Your pick` appears only on the user's pick.
   - Undo picks and confirm the highlight updates correctly.

## Acceptance Criteria

- The app clearly indicates when the user's team is on the clock.
- `Your pick` appears only when `currentPick.teamId === draft.userTeamId`.
- The active team name still displays correctly.
- The active team's draft position still displays correctly.
- The user's team card still displays correctly.
- Undo still works.
- Drafting a player still advances the active team.
- Existing recommendation behavior is unchanged.
- `Highlight user pick` is marked complete in `docs/tasks.md`.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice is intentionally small. It improves live-draft usability without adding notifications, new controls, or recommendation logic.

The useful mental model for this slice:

```txt
"Make my turn unmistakable"
```

not:

```txt
"Build a full alert system"
```

## Slice Review

- Smallest meaningful increment: yes, this only highlights the user's active pick state.
- Concrete enough for implementation: yes, the boolean, conditional rendering, and target component are specified.
- Avoids unnecessary architecture changes: yes, it is a local presentational change.
- Blast radius reasonable: yes, expected changes are one component and task docs.
- Review/revert comfort: yes, the highlight can be removed without affecting draft state or recommendation logic.
- Observable/testable acceptance criteria: yes, the highlight, label, undo behavior, lint, and build are directly checkable.
