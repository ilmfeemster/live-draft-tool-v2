# Current Slice: Top-Tier Tier-Drop Eligibility Fix

## Goal

Fix the tier-drop modifier so it only rewards a player when they are the sole remaining available player in the best currently available tier for their position.

The current eligibility fix prevents boosting a player when other same-position players remain in that player's own tier. However, it can still boost a lower-tier player even while a better tier at the same position is available. That is misleading because the true tier-drop decision is at the top available tier boundary, not at every lower tier boundary.

## User-Visible Increment

The `Recommendations` panel should still show tier-drop reasons, but only for a player who represents the current top-tier cutoff at their position.

Examples:

- If tier-1 WRs are still available, a tier-2 WR should not receive a tier-drop bonus.
- If exactly one tier-1 WR remains and the next available WR is tier 2, that tier-1 WR may receive a tier-drop bonus.
- If no tier-1 WRs remain and exactly one tier-2 WR remains, that tier-2 WR may receive a tier-drop bonus only if tier 2 is now the best available WR tier.

## Goals

- Keep the existing tier-drop scoring formula.
- Keep the existing tier-drop reason text.
- Add a top-available-tier eligibility check before applying the tier-drop modifier.
- Preserve the same-position same-tier uniqueness check.
- Use only current available rankings.
- Keep base ranking score unchanged.
- Keep roster need modifier unchanged.
- Keep recommendations deterministic.
- Keep all recommendation logic pure and independent of React rendering.

## Non-Goals

- Predict whether a player will be gone by the user's next pick.
- Simulate opponent picks.
- Add draft-position timing logic.
- Add positional scarcity modifier.
- Add ADP-based scoring.
- Change roster need logic.
- Redesign recommendation UI.
- Add new warning components.
- Add new state, context, reducers, API routes, server actions, or dependencies.

## Expected Files

- `src/lib/recommendations.ts`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, `RecommendationsPanel`, seed data, draft types, available-player UI, or `docs/tasks.md` unless implementation reveals a direct compatibility issue.

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

## Tier-Drop Eligibility Model

Use current available rankings only.

For a candidate recommendation:

1. Look at available rankings with the same `player.position`.
2. Sort those same-position rankings by `overallRank`.
3. Determine the best available tier at that position.
4. If the candidate's `tier` is not the best available tier at that position, no tier-drop bonus applies.
5. Find available same-position players in the candidate's same `tier`.
6. If more than one same-position player remains in the candidate's tier, no tier-drop bonus applies.
7. Find the next same-position player after the candidate.
8. If there is no next same-position player, no tier-drop bonus applies in this slice.
9. If the next same-position player's `tier` is greater than the candidate's `tier`, the candidate gets a tier-drop bonus.
10. If the next same-position player's `tier` is the same or better, no tier-drop bonus applies.

Do not compare against players at other positions.

## Modifier Rules

Keep the existing V1 modifier:

```txt
tier drop bonus = 5 * tier gap
```

Where:

```txt
tier gap = next same-position tier - candidate tier
```

Cap the tier-drop bonus at `+10`.

Examples:

- Candidate `WR` tier 2, any tier-1 `WR` still available: `+0`
- Candidate `WR` tier 1, two tier-1 `WR`s still available: `+0`
- Candidate `WR` tier 1, no other tier-1 `WR`s available, next `WR` tier 2: `+5`
- Candidate `TE` tier 3, tier 3 is the best available `TE` tier, no other tier-3 `TE`s available, next `TE` tier 6: `+10` after cap
- Candidate `K` with no later available `K`: `+0`

## Explanation Rules

Keep existing recommendation reasons:

- Overall rank reason.
- ADP rank reason when available.
- Roster need reason when applicable.

Add a tier-drop reason only when all eligibility checks pass and the modifier is greater than `0`:

- `Tier drop after this <POSITION>`

If the tier gap is greater than 1, keep the existing gap reason:

- `Tier drop after this <POSITION> by <N> tiers`

Do not show a tier-drop reason when the modifier is `0`.

## Implementation Steps

1. Update `src/lib/recommendations.ts`.
   - Keep `TierDropResult`, `TIER_DROP_MULTIPLIER`, and `MAX_TIER_DROP_BONUS`.
   - In `calculateTierDropModifier`, derive same-position available rankings.
   - Determine the best available tier from those same-position rankings.
   - Return `{ modifier: 0, reason: null }` when `ranking.tier` is not the best available tier for that position.
   - Preserve the same-position same-tier uniqueness check.
   - Preserve the existing next same-position lookup after the eligibility checks.
   - Preserve the existing tier-gap calculation, cap, and reason strings.
   - Keep input arrays immutable.

2. Validate with a quick local script or equivalent manual helper checks.
   - Lower-tier candidate while a better same-position tier is available: no tier-drop bonus.
   - Top-tier candidate with another same-position same-tier player still available: no tier-drop bonus.
   - Top-tier candidate is sole remaining player in best available same-position tier and next same-position player is worse tier: tier-drop bonus applies.
   - Candidate is sole remaining player in best available same-position tier but no next same-position player exists: no tier-drop bonus.
   - Tier gap greater than 2 still caps at `+10`.

3. Run validation.
   - Run `npm run lint`.
   - Run `npm run build`.

4. Manual smoke test.
   - Load the app and confirm recommendations still render.
   - Confirm lower-tier players do not receive tier-drop reasons while a better tier at that position remains available.
   - Draft enough same-position players to leave one player in the best available tier.
   - Confirm a tier-drop reason appears only for that top-tier cutoff player.
   - Undo the pick and confirm recommendations recalculate.

## Acceptance Criteria

- Base ranking score remains `1000 - overallRank`.
- Roster need modifier remains active.
- Tier-drop modifier does not apply to a player outside the best currently available tier for their position.
- Tier-drop modifier does not apply while another same-position player in the candidate's tier is still available.
- Tier-drop modifier applies when the candidate is the sole remaining player in the best available same-position tier and the next same-position player is in a worse tier.
- Tier-drop bonus remains capped at `+10`.
- Existing tier-drop reason text remains unchanged.
- No tier-drop reason appears when no tier-drop bonus applies.
- Recommendations still return 5 items by default.
- Recommendations still sort by score descending.
- Existing ranking, ADP, and roster need reasons still appear.
- Existing draft, undo, search, and available-player behavior still work.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice intentionally does not predict whether a player will be gone by the user's next pick. That requires a draft timing or opponent pick model that does not exist yet.

The useful mental model for this slice:

```txt
"This is the final available player in the best currently available tier for this position"
```

not:

```txt
"This is the final available player in any lower tier"
```

## Slice Review

- Smallest meaningful increment: yes, this only tightens tier-drop eligibility.
- Concrete enough for implementation: yes, the top-tier and same-tier eligibility checks are explicit.
- Avoids unnecessary architecture changes: yes, all logic stays inside the pure recommendation helper.
- Blast radius reasonable: yes, expected changes are one helper module and this plan doc.
- Review/revert comfort: yes, the eligibility condition can be reverted without affecting draft state or UI structure.
- Observable/testable acceptance criteria: yes, scores, reasons, lint, build, and recommendation behavior are directly checkable.
