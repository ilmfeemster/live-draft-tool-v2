# Current Slice: Tier-Drop Modifier V1

## Goal

Make recommendations aware of tier-drop risk by adding a simple tier-drop modifier to the existing recommendation engine.

This slice should favor an available player when the next available player at the same position is in a worse tier.

## User-Visible Increment

The existing `Recommendations` panel continues to show top recommendations, but scores and reasons now include tier-drop context when a recommended player is the last available player in their position tier.

Example reason:

- `Tier drop after this WR`

## Goals

- Add a tier-drop modifier to the existing recommendation score.
- Keep base ranking score unchanged.
- Keep roster need modifier unchanged.
- Use only current available rankings to detect tier-drop risk.
- Add recommendation reasons that explain tier-drop bonuses.
- Surface tier warnings through the existing recommendation reason chips.
- Keep recommendations deterministic.
- Keep all recommendation logic pure and independent of React rendering.

## Non-Goals

- Positional scarcity modifier.
- ADP-based scoring.
- Roster need changes.
- Recommendation UI redesign.
- Separate warning component.
- Draft pick timing logic.
- Bench or lineup optimization.
- Persistence.
- Database work.
- New dependencies.
- Global state.

## Expected Files

- `src/lib/recommendations.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, `RecommendationsPanel`, seed data, draft types, or available-player UI unless implementation reveals a direct compatibility issue.

## Implementation Constraint

Keep the recommendation helper pure.

Do not add:

- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- New UI components.

## Tier-Drop Model

Use current available rankings only.

For a candidate recommendation:

1. Look at available rankings with the same `player.position`.
2. Sort those same-position rankings by `overallRank`.
3. Find the next same-position player after the candidate.
4. If there is no next same-position player, no tier-drop bonus in this slice.
5. If the next same-position player's `tier` is greater than the candidate's `tier`, the candidate gets a tier-drop bonus.
6. If the next same-position player's `tier` is the same or better, no tier-drop bonus.

Do not compare against players at other positions.

## Modifier Rules

Keep the modifier small and inspectable.

Recommended modifier:

```txt
tier drop bonus = 20 * tier gap
```

Where:

```txt
tier gap = next same-position tier - candidate tier
```

Cap the tier-drop bonus at `+40` so it cannot dominate overall rank too aggressively yet.

Examples:

- Candidate `WR` tier 1, next available `WR` tier 1: `+0`
- Candidate `WR` tier 1, next available `WR` tier 2: `+20`
- Candidate `TE` tier 3, next available `TE` tier 5: `+40` after cap
- Candidate `K` with no later available `K`: `+0`

## Explanation Rules

Recommendations should keep existing reasons:

- Overall rank reason.
- ADP rank reason when available.
- Roster need reason when applicable.

Add a tier-drop reason only when a bonus applies:

- `Tier drop after this <POSITION>`

If the tier gap is greater than 1, include the gap:

- `Tier drop after this <POSITION> by <N> tiers`

Do not show a tier-drop reason when the modifier is `0`.

## Implementation Steps

1. Update `src/lib/recommendations.ts`.
   - Add a `TierDropResult` local type.
   - Add `calculateTierDropModifier(ranking, availableRankings)`.
   - Use same-position available rankings to find the next same-position player.
   - Add tier-drop modifier to total score.
   - Add tier-drop reason to recommendation reasons.
   - Keep base ranking and roster need scoring unchanged.
   - Keep input arrays immutable.

2. Update `docs/tasks.md`.
   - Mark `Add tier-drop modifier` complete.
   - Mark `Display tier warnings` complete because tier-drop reasons appear in the recommendation panel.
   - Leave scarcity modifier and scarcity warnings unchecked.

3. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run a quick local script that verifies:
     - Same-tier next player gives no tier-drop bonus.
     - Worse-tier next player gives a tier-drop bonus.
     - No next same-position player gives no tier-drop bonus.

4. Manual smoke test.
   - Load the app and confirm recommendations still render.
   - Draft enough players at a position to create or expose a tier-drop situation.
   - Confirm a tier-drop reason appears when applicable.
   - Undo the pick and confirm recommendations recalculate.

## Acceptance Criteria

- Base ranking score remains `1000 - overallRank`.
- Roster need modifier remains active.
- Tier-drop modifier is added to recommendation score when the next available same-position player is in a worse tier.
- Tier-drop bonus is capped at `+40`.
- No tier-drop reason appears when no tier-drop bonus applies.
- Tier-drop reasons appear in the existing recommendation panel when applicable.
- Recommendations still return 5 items by default.
- Recommendations still sort by score descending.
- Existing ranking, ADP, and roster need reasons still appear.
- Existing draft, undo, search, and available-player behavior still work.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

The tier data is overall FantasyPros tier data, not position-specific custom tiers. This slice uses it conservatively by only comparing same-position available players.

The modifier is intentionally small. It should nudge recommendations when a position is about to drop tiers, not override elite ranking value by itself.

## Slice Review

- Smallest meaningful increment: yes, this adds only tier-drop scoring and visible tier-drop reasons.
- Concrete enough for implementation: yes, same-position lookup, modifier formula, cap, reasons, and task updates are explicit.
- Avoids unnecessary architecture changes: yes, all logic stays inside the pure recommendation helper.
- Blast radius reasonable: yes, expected changes are one helper module and task docs.
- Review/revert comfort: yes, the modifier can be removed without affecting draft state or UI structure.
- Observable/testable acceptance criteria: yes, scores, reasons, draft/undo behavior, lint, and build are directly checkable.
