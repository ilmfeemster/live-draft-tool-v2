# Current Slice: Roster Need Modifier V1

## Goal

Make visible recommendations respond to the user's drafted roster by adding a simple roster need modifier to the existing recommendation engine.

This slice should make recommendations slightly prefer positions where the user's starter slots are not filled yet, while keeping the scoring model inspectable and intentionally simple.

## User-Visible Increment

The existing `Recommendations` panel still appears above the available players list, but recommendation scores and reasons now include roster-need context.

As the user's team drafts players, recommendations update to reflect filled and unfilled starter positions.

## Goals

- Add a roster need modifier to the existing recommendation score.
- Keep base ranking score unchanged.
- Pass user roster context from `DraftRoom` into the recommendation helper.
- Add recommendation reasons that explain roster need bonuses.
- Keep recommendations deterministic.
- Keep logic pure and independent of React rendering.
- Keep the existing recommendation panel layout.
- Avoid introducing a full `UserRoster` domain model in this slice.

## Non-Goals

- Positional scarcity modifier.
- Tier-drop modifier.
- ADP-based scoring.
- Optimal lineup assignment.
- Overfilled position warnings.
- Manual roster slot overrides.
- Recommendation UI redesign.
- Recommendation persistence.
- New dependencies.
- Database work.
- Global state.

## Expected Files

- `src/lib/recommendations.ts`
- `src/components/DraftRoom.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `RecommendationsPanel`, `AvailablePlayersTable`, seed data, draft types, or roster display unless implementation reveals a direct compatibility issue.

## Implementation Constraint

Keep the recommendation helper pure.

Do not add:

- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- A full `UserRoster` model.

## Roster Need Input

The recommendation engine needs only drafted user player positions.

Use a small local type in `src/lib/recommendations.ts`, such as:

```ts
type RosterNeedPlayer = {
  position: Position;
};
```

Update `generateTopRecommendations` to accept an optional options object:

```ts
generateTopRecommendations(rankings, {
  limit,
  rosterPlayers,
})
```

Keep backward compatibility for callers that pass only rankings.

## Starter Need Model

Use the MVP starting lineup from `docs/project.md`:

- `QB`: 1
- `RB`: 2
- `WR`: 2
- `TE`: 1
- `FLEX`: 2, using `RB`, `WR`, or `TE`
- `DST`: 1
- `K`: 1

For this slice, use a simple position-level need calculation:

- `QB` needs 1.
- `RB` needs 2 direct starter slots.
- `WR` needs 2 direct starter slots.
- `TE` needs 1 direct starter slot.
- `DST` needs 1.
- `K` needs 1.
- `FLEX` need should add modest extra value to `RB`, `WR`, and `TE` until two total FLEX-eligible surplus players exist after direct starter slots are filled.

Do not model Bench needs.

## Modifier Rules

Keep values intentionally small relative to base ranking score.

Recommended modifiers:

- Direct starter need bonus: `+30`
- FLEX need bonus for `RB`, `WR`, and `TE`: `+15`
- No need bonus: `0`

Examples:

- If user has no QB, available QBs receive `+30`.
- If user has one RB, available RBs receive `+30`.
- If user has two RBs and no extra FLEX-eligible players, available RBs receive `+15`.
- If user has two RBs, two WRs, one TE, and two additional FLEX-eligible players, RB/WR/TE receive no roster need bonus.
- If user has a DST, available DSTs receive no roster need bonus.

## Explanation Rules

Recommendations should keep existing reasons:

- Overall rank reason.
- ADP rank reason when available.

Add roster need reasons only when a bonus applies:

- Direct need: `Fills <POSITION> starter need`
- FLEX need: `Helps fill FLEX need`

Do not show a roster need reason when the modifier is `0`.

## Implementation Steps

1. Update `src/lib/recommendations.ts`.
   - Add local roster need input type.
   - Add options object support for `generateTopRecommendations`.
   - Preserve default limit of 5.
   - Add `calculateRosterNeedModifier`.
   - Add roster need reasons.
   - Keep input arrays immutable.

2. Update `src/components/DraftRoom.tsx`.
   - Pass `userRosterPlayers` into `generateTopRecommendations`.
   - Ensure recommendations still derive from `availableRankings`.

3. Update `docs/tasks.md`.
   - Mark `Add roster need modifier` complete.
   - Leave scarcity and tier-drop unchecked.
   - Do not change recommendation UI checklist items.

4. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run a quick local script that verifies a missing position receives a higher score than the base ranking score.

5. Manual smoke test.
   - Start with an empty roster and confirm top recommendations include roster need reasons where applicable.
   - Draft a user pick at a needed position.
   - Confirm recommendation scores/reasons update after the pick.
   - Undo the pick and confirm scores/reasons revert.

## Acceptance Criteria

- Base ranking score remains `1000 - overallRank`.
- Roster need modifier is added to recommendation score.
- Missing direct starter positions receive `+30`.
- FLEX-eligible positions receive `+15` when FLEX need remains.
- No roster need reason appears when no roster need bonus applies.
- Recommendations still return 5 items by default.
- Recommendations still sort by score descending.
- Existing ranking and ADP reasons still appear.
- Recommendations update when user roster changes.
- Existing recommendation panel still renders.
- Existing draft, undo, search, and available-player behavior still work.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

The modifier is intentionally small. Early recommendations may still heavily favor elite overall-ranked players. That is expected.

This slice is about making roster need visible and testable, not finalizing strategy quality.

## Slice Review

- Smallest meaningful increment: yes, this adds only roster need scoring and reasons.
- Concrete enough for implementation: yes, input shape, starter model, modifier values, reasons, and task updates are explicit.
- Avoids unnecessary architecture changes: yes, no new global state or full roster model is introduced.
- Blast radius reasonable: yes, expected changes are one helper module, one parent component, and task docs.
- Review/revert comfort: yes, the modifier can be removed without affecting draft state or UI structure.
- Observable/testable acceptance criteria: yes, scores, reasons, draft/undo behavior, lint, and build are directly checkable.
