# Current Slice: Light Positional Scarcity Modifier

## Goal

Add a light positional scarcity modifier to the existing recommendation engine.

This should make recommendations aware when there are few nearby available players at the same position, without trying to fully tune the recommendation engine before the MVP is usable.

## User-Visible Increment

The `Recommendations` panel should continue to show top recommendations, but some recommendations may now include a small scarcity reason chip.

Example reason:

- `Limited nearby RB options`

## Goals

- Add a small positional scarcity modifier to recommendation scoring.
- Keep the modifier intentionally light.
- Use only current available rankings.
- Keep base ranking score unchanged.
- Keep roster need modifier unchanged.
- Keep tier-drop modifier unchanged.
- Add scarcity reasons through the existing recommendation reason chips.
- Keep recommendations deterministic.
- Keep all recommendation logic pure and independent of React rendering.
- Avoid trying to fully tune recommendation behavior in this slice.

## Non-Goals

- Pick-distance or "will this player fall to me" prediction.
- Opponent roster modeling.
- Simulation.
- ADP-based scoring changes.
- Roster need changes.
- Tier-drop changes.
- Recommendation UI redesign.
- Separate scarcity warning component.
- Draft setup changes.
- Persistence.
- Database work.
- New dependencies.
- Global state.

## Expected Files

- `src/lib/recommendations.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, `RecommendationsPanel`, seed data, draft types, available-player UI, or roster UI unless implementation reveals a direct compatibility issue.

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

## Scarcity Model

Use current available rankings only.

For a candidate recommendation:

1. Ignore `K` and `DST` for scarcity in this slice.
2. Look at available rankings after the candidate within a small overall-rank window.
3. Count later available players with the same `player.position` inside that window.
4. If the count is low, add a small scarcity bonus.
5. Otherwise, add no scarcity bonus.

Recommended constants:

```txt
SCARCITY_LOOKAHEAD_RANKS = 24
SCARCITY_MIN_NEARBY_OPTIONS = 2
SCARCITY_BONUS = 5
```

Meaning:

- Look 24 overall-rank spots after the candidate.
- If fewer than 2 later same-position players are available in that window, apply `+5`.
- If 2 or more later same-position players are available in that window, apply `+0`.

This is intentionally modest. It should nudge recommendations when a position is thinning out nearby, not override player quality.

## Modifier Rules

Keep existing score components:

```txt
recommendation score =
base ranking score
+ roster need modifier
+ tier-drop modifier
+ scarcity modifier
```

The scarcity modifier should be either:

```txt
+5
```

or:

```txt
+0
```

Do not stack multiple scarcity bonuses.

Examples:

- Candidate `RB` at overall rank 40, fewer than 2 later available `RB`s through rank 64: `+5`
- Candidate `WR` at overall rank 40, 2 or more later available `WR`s through rank 64: `+0`
- Candidate `QB` at overall rank 80, fewer than 2 later available `QB`s through rank 104: `+5`
- Candidate `K` at any rank: `+0`
- Candidate `DST` at any rank: `+0`

## Explanation Rules

Recommendations should keep existing reasons:

- Overall rank reason.
- ADP rank reason when available.
- Roster need reason when applicable.
- Tier-drop reason when applicable.

Add a scarcity reason only when the scarcity modifier applies:

- `Limited nearby <POSITION> options`

Do not show a scarcity reason when the modifier is `0`.

## Implementation Steps

1. Update `src/lib/recommendations.ts`.
   - Add a `ScarcityResult` local type.
   - Add `SCARCITY_LOOKAHEAD_RANKS`, `SCARCITY_MIN_NEARBY_OPTIONS`, and `SCARCITY_BONUS` constants.
   - Add `calculateScarcityModifier(ranking, availableRankings)`.
   - Return no scarcity bonus for `K` and `DST`.
   - Count later same-position available players where:
     - `candidate.overallRank > ranking.overallRank`
     - `candidate.overallRank <= ranking.overallRank + SCARCITY_LOOKAHEAD_RANKS`
   - Return `+5` and the scarcity reason when the later same-position count is less than `SCARCITY_MIN_NEARBY_OPTIONS`.
   - Add the scarcity modifier to total score.
   - Add the scarcity reason to recommendation reasons.
   - Keep base ranking, roster need, and tier-drop scoring unchanged.
   - Keep input arrays immutable.

2. Update `docs/tasks.md`.
   - Mark `Add scarcity modifier` complete.
   - Mark `Display scarcity warnings` complete because scarcity reasons appear in the existing recommendation panel.

3. Validate with a quick local script or equivalent helper checks.
   - `K` and `DST` receive no scarcity bonus.
   - A position with fewer than 2 nearby later options receives `+5`.
   - A position with 2 or more nearby later options receives `+0`.
   - Scarcity reason appears only when the modifier applies.
   - Recommendations still return 5 items by default.
   - Recommendations still sort by score descending.

4. Run validation.
   - Run `npm run lint`.
   - Run `npm run build`.

5. Manual smoke test.
   - Load the app.
   - Confirm recommendations still render.
   - Confirm scarcity reason chips appear only where applicable.
   - Draft a player.
   - Confirm recommendations recalculate.
   - Undo the pick.
   - Confirm recommendations recalculate again.

## Acceptance Criteria

- Base ranking score remains `1000 - overallRank`.
- Roster need modifier remains active.
- Tier-drop modifier remains active.
- Scarcity modifier is `+5` at most.
- Scarcity modifier does not apply to `K` or `DST`.
- Scarcity modifier applies when fewer than 2 later same-position players are available within 24 overall-rank spots.
- No scarcity reason appears when no scarcity bonus applies.
- Scarcity reasons appear in the existing recommendation panel when applicable.
- Recommendations still return 5 items by default.
- Recommendations still sort by score descending.
- Existing ranking, ADP, roster need, and tier-drop reasons still appear.
- Existing draft, undo, search, roster, and available-player behavior still work.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice intentionally avoids heavy recommendation tuning. The modifier is small because the recommendation engine will be dialed in after the MVP is usable.

The useful mental model for this slice:

```txt
"Nearby options at this position are getting thin"
```

not:

```txt
"This position is globally more valuable"
```

## Slice Review

- Smallest meaningful increment: yes, this adds only a light scarcity scoring signal and reason chip.
- Concrete enough for implementation: yes, constants, counting window, exclusions, score, and reason text are explicit.
- Avoids unnecessary architecture changes: yes, all logic stays inside the pure recommendation helper.
- Blast radius reasonable: yes, expected changes are one helper module and task docs.
- Review/revert comfort: yes, the modifier can be removed without affecting draft state or UI structure.
- Observable/testable acceptance criteria: yes, scores, reasons, recommendation order, lint, and build are directly checkable.
