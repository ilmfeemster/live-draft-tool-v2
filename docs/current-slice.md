# Current Slice: Define UserRoster Type

## Goal

Make the user roster data contract explicit in the shared draft types.

The app already tracks and renders the user's roster correctly. This slice turns the current implicit/local roster shape into a shared domain type so roster-aware UI and recommendation logic use the same contract.

## User-Visible Increment

No behavior or UI should change.

This is a small type-safety and maintainability slice that prepares the codebase for future recommendation-engine tuning.

## Problem

`docs/tasks.md` still has `Define UserRoster type` unchecked.

The roster shape currently exists locally in `UserRosterPanel` as `UserRosterPlayer`, while `DraftRoom` derives the same shape inline and passes it to:

- `UserRosterPanel`
- `generateTopRecommendations`

That works today, but the roster contract is not part of the shared domain model.

## Goals

- Define `UserRosterPlayer` in `src/types/draft.ts`.
- Define `UserRoster` in `src/types/draft.ts`.
- Use the shared type in `DraftRoom`.
- Use the shared type in `UserRosterPanel`.
- Use the shared type for recommendation roster input where appropriate.
- Mark `Define UserRoster type` complete in `docs/tasks.md`.

## Non-Goals

- Roster behavior changes.
- Slot assignment changes.
- Recommendation scoring changes.
- Recommendation reason changes.
- Draft logic changes.
- Persistence or database modeling.
- New files.
- New dependencies.
- Renaming existing components.

## Expected Files

- `src/types/draft.ts`
- `src/components/DraftRoom.tsx`
- `src/components/UserRosterPanel.tsx`
- `src/lib/recommendations.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing draft data, ranking data, draft order helpers, recommendation scoring constants, available-player UI, or draft-status UI.

## Type Model

Add these shared types to `src/types/draft.ts`:

```ts
export type UserRosterPlayer = {
  pickNumber: number;
  name: string;
  team: string;
  position: Position;
};

export type UserRoster = {
  players: UserRosterPlayer[];
};
```

Keep the shape intentionally close to what the UI already uses. Do not add fields until a real consumer needs them.

## Implementation Steps

1. Update `src/types/draft.ts`.
   - Add `UserRosterPlayer`.
   - Add `UserRoster`.
   - Use the existing `Position` type for `UserRosterPlayer.position`.

2. Update `src/components/UserRosterPanel.tsx`.
   - Remove the local exported `UserRosterPlayer` type.
   - Import `Position` and `UserRosterPlayer` from `@/types/draft`.
   - Keep `UserRosterPanelProps` as `players: UserRosterPlayer[]`.
   - Do not change slot assignment, counts, overflow bench behavior, or rendering.

3. Update `src/components/DraftRoom.tsx`.
   - Import `UserRosterPlayer` from `@/types/draft`.
   - Type the derived `userRosterPlayers` value as `UserRosterPlayer[]`.
   - Keep the existing derivation logic, sorting, and props unchanged.

4. Update `src/lib/recommendations.ts`.
   - Import `UserRosterPlayer` from `@/types/draft`.
   - Remove the local `RosterNeedPlayer` type if it becomes redundant.
   - Type `rosterPlayers` as `UserRosterPlayer[]` or `Pick<UserRosterPlayer, "position">[]` only if a narrower type is cleaner.
   - Do not change scoring, modifiers, ordering, or reasons.

5. Update `docs/tasks.md`.
   - Mark `Define UserRoster type` complete.

6. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.

7. Manual smoke test.
   - Load the app.
   - Draft at least one player for the user's team.
   - Confirm the player appears in `Your Roster`.
   - Confirm position counts still update.
   - Confirm recommendations still render and update after picks.

## Acceptance Criteria

- `UserRosterPlayer` is defined in `src/types/draft.ts`.
- `UserRoster` is defined in `src/types/draft.ts`.
- `UserRosterPanel` uses the shared `UserRosterPlayer` type.
- `DraftRoom` uses the shared `UserRosterPlayer` type for derived roster players.
- Recommendation roster input uses the shared roster type or an intentional narrow projection of it.
- Roster slot assignment behavior is unchanged.
- Roster position counts are unchanged.
- Recommendation scoring, ordering, and reasons are unchanged.
- `Define UserRoster type` is marked complete in `docs/tasks.md`.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice is type-modeling cleanup, not a user-facing feature.

The useful mental model:

```txt
"Name the roster shape the app already has"
```

not:

```txt
"Redesign roster management"
```

## Slice Review

- Smallest meaningful increment: yes, this only promotes the existing roster shape into shared types.
- Concrete enough for implementation: yes, the exact types, files, and usage points are listed.
- Avoids unnecessary architecture changes: yes, no new state, persistence, or roster abstractions are introduced.
- Blast radius reasonable: yes, expected changes are four source files and task docs.
- Review/revert comfort: yes, this is a narrow typing change with no intended behavior change.
- Observable/testable acceptance criteria: yes, shared type usage, task completion, lint, build, and roster smoke checks are directly verifiable.
