# Current Slice: Highlight User Pick And Recommendations

## Goal

Make it obvious when the user's team is currently on the clock, including the recommendations area.

The app should visually steer attention toward both the draft status and recommendations when it is time for the user to pick.

## User-Visible Increment

When the active drafting team is the user's team:

- The `On The Clock` card in `Draft Status` is highlighted.
- The `Recommendations` panel gets a subtle emerald glow.
- The UI shows `Your pick`.

When another team is on the clock, the UI returns to its normal styling.

## Goals

- Compute the user-pick state once from existing draft state.
- Highlight the on-the-clock card when the active team is the user's team.
- Add a short, explicit `Your pick` label only when the user is on the clock.
- Give the `Recommendations` panel a subtle glow only when the user is on the clock.
- Preserve the existing current pick, round, active team, user team, recommendations, and undo behavior.
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

- `src/components/DraftRoom.tsx`
- `src/components/DraftStatusPanel.tsx`
- `src/components/RecommendationsPanel.tsx`
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

Use existing draft data in `DraftRoom`:

```txt
currentPick = activeDraft.picks.find(pick => pick.pickNumber === activeDraft.currentPickNumber)
isUserPick = currentPick?.teamId === activeDraft.userTeamId
```

Pass `isUserPick` into:

- `DraftStatusPanel`
- `RecommendationsPanel`

When `isUserPick` is `true`:

- `DraftStatusPanel` highlights the `On The Clock` card.
- `DraftStatusPanel` shows `Your pick`.
- `RecommendationsPanel` uses a subtle emerald border/ring/background glow.

When `isUserPick` is `false`:

- Preserve normal `On The Clock` styling.
- Hide `Your pick`.
- Preserve normal `Recommendations` panel styling.

## Implementation Steps

1. Update `src/components/DraftRoom.tsx`.
   - Derive `currentPick` from `activeDraft.currentPickNumber`.
   - Derive `isUserPick` from `currentPick?.teamId === activeDraft.userTeamId`.
   - Pass `isUserPick` to `RecommendationsPanel`.
   - Pass `isUserPick` to `DraftStatusPanel`.

2. Update `src/components/DraftStatusPanel.tsx`.
   - Add an `isUserPick` prop.
   - Use the prop to conditionally style the `On The Clock` card.
   - Render `Your pick` inside the `On The Clock` card only when `isUserPick` is true.
   - Keep existing active team name and draft position text.
   - Keep the existing `Your Team` card.
   - Keep the undo button unchanged.

3. Update `src/components/RecommendationsPanel.tsx`.
   - Add an `isUserPick` prop.
   - Use the prop to conditionally style the outer `<section>`.
   - When `isUserPick` is true, apply a subtle emerald emphasis, such as:
     - `border-emerald-300`
     - `bg-emerald-50/40`
     - `shadow-[0_0_0_3px_rgba(16,185,129,0.12)]`
   - When `isUserPick` is false, preserve the current neutral section styling.
   - Do not change recommendation card scoring, ordering, reasons, or buttons.

4. Update `docs/tasks.md`.
   - Mark `Highlight user pick` complete.

5. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.

6. Manual smoke test.
   - Load the app.
   - Confirm the `Draft Status` and `Recommendations` panels still render.
   - Advance picks until the active team is the user's team.
   - Confirm the `On The Clock` card changes to the highlighted style.
   - Confirm `Your pick` appears only on the user's pick.
   - Confirm the `Recommendations` panel glows only on the user's pick.
   - Undo picks and confirm both highlights update correctly.

## Acceptance Criteria

- The app clearly indicates when the user's team is on the clock.
- `Your pick` appears only when the active pick belongs to the user.
- The `On The Clock` card is highlighted only when the active pick belongs to the user.
- The `Recommendations` panel glows only when the active pick belongs to the user.
- The active team name still displays correctly.
- The active team's draft position still displays correctly.
- The user's team card still displays correctly.
- Recommendation ordering, scores, reasons, and draft buttons are unchanged.
- Undo still works.
- Drafting a player still advances the active team.
- `Highlight user pick` is marked complete in `docs/tasks.md`.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice is intentionally small. It improves live-draft usability without adding notifications, new controls, or recommendation logic.

The useful mental model for this slice:

```txt
"Make my turn and recommended actions visually obvious"
```

not:

```txt
"Build a full alert system"
```

## Slice Review

- Smallest meaningful increment: yes, this only highlights the user's active pick state in existing UI.
- Concrete enough for implementation: yes, the boolean, props, conditional rendering, and target components are specified.
- Avoids unnecessary architecture changes: yes, it is a local presentational change.
- Blast radius reasonable: yes, expected changes are three components and task docs.
- Review/revert comfort: yes, the highlights can be removed without affecting draft state or recommendation logic.
- Observable/testable acceptance criteria: yes, the highlights, label, undo behavior, lint, and build are directly checkable.
