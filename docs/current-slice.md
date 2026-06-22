# Current Slice: Tier-Drop Modifier Eligibility Fix

## Goal

Fix the tier-drop modifier so it only rewards a player when they are the sole remaining available player in their same-position tier.

The current V1 logic correctly detects that a candidate is followed by a worse tier, but it can boost the lowest-ranked player in a tier even when better players from that same position tier are still available. This makes the recommendation engine over-favor bottom-of-tier players too early.

## User-Visible Increment

The `Recommendations` panel should still show tier-drop reasons, but those reasons should appear less often and only when the recommended player is truly the last available player in their position tier.

Example:

- If three tier-2 WRs are available, none should receive a tier-drop bonus yet.
- Once only one tier-2 WR remains and the next available WR is tier 3 or worse, that WR may receive a tier-drop bonus.

## Goals

- Keep the existing tier-drop scoring formula.
- Keep the existing tier-drop reason text.
- Add a stricter eligibility check before applying the tier-drop modifier.
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
2. From those, find available players in the candidate's same `tier`.
3. If more than one same-position player remains in the candidate's tier, no tier-drop bonus applies.
4. If the candidate is not the only remaining same-position player in that tier, no tier-drop bonus applies.
5. Sort same-position available rankings by `overallRank`.
6. Find the next same-position player after the candidate.
7. If there is no next same-position player, no tier-drop bonus applies in this slice.
8. If the next same-position player's `tier` is greater than the candidate's `tier`, the candidate gets a tier-drop bonus.
9. If the next same-position player's `tier` is the same or better, no tier-drop bonus applies.

Do not compare against players at other positions.

## Modifier Rules

Keep the existing V1 modifier:

```txt
tier drop bonus = 20 * tier gap
```

Where:

```txt
tier gap = next same-position tier - candidate tier
```

Cap the tier-drop bonus at `+40`.

Examples:

- Candidate `WR` tier 1, two other tier-1 `WR`s still available: `+0`
- Candidate `WR` tier 1, no other tier-1 `WR`s available, next `WR` tier 2: `+20`
- Candidate `TE` tier 3, no other tier-3 `TE`s available, next `TE` tier 5: `+40` after cap
- Candidate `K` with no later available `K`: `+0`

## Explanation Rules

Keep existing recommendation reasons:

- Overall rank reason.
- ADP rank reason when available.
- Roster need reason when applicable.

Add a tier-drop reason only when the stricter eligibility check passes and the modifier is greater than `0`:

- `Tier drop after this <POSITION>`

If the tier gap is greater than 1, keep the existing gap reason:

- `Tier drop after this <POSITION> by <N> tiers`

Do not show a tier-drop reason when the modifier is `0`.

## Implementation Steps

1. Update `src/lib/recommendations.ts`.
   - Keep `TierDropResult`, `TIER_DROP_MULTIPLIER`, and `MAX_TIER_DROP_BONUS`.
   - In `calculateTierDropModifier`, derive same-position available rankings.
   - Derive same-position, same-tier available rankings.
   - Return `{ modifier: 0, reason: null }` when the same-position, same-tier list length is greater than `1`.
   - Preserve the existing next same-position lookup after the same-tier eligibility check.
   - Preserve the existing tier-gap calculation, cap, and reason strings.
   - Keep input arrays immutable.

2. Validate with a quick local script or equivalent manual helper checks.
   - Better same-tier player still available: no tier-drop bonus.
   - Candidate is sole remaining player in same-position tier and next same-position player is worse tier: tier-drop bonus applies.
   - Candidate is sole remaining player in same-position tier but no next same-position player exists: no tier-drop bonus.
   - Tier gap greater than 1 still caps at `+40`.

3. Run validation.
   - Run `npm run lint`.
   - Run `npm run build`.

4. Manual smoke test.
   - Load the app and confirm recommendations still render.
   - Confirm initial recommendations do not over-favor bottom-of-tier players when better same-tier players are still available.
   - Draft enough same-position players to leave one player in a tier.
   - Confirm a tier-drop reason appears only when that player is the sole remaining player in that same-position tier.
   - Undo the pick and confirm recommendations recalculate.

## Acceptance Criteria

- Base ranking score remains `1000 - overallRank`.
- Roster need modifier remains active.
- Tier-drop modifier does not apply while another same-position player in the candidate's tier is still available.
- Tier-drop modifier applies when the candidate is the sole remaining same-position player in their tier and the next same-position player is in a worse tier.
- Tier-drop bonus remains capped at `+40`.
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
"This is the final available player in this position tier"
```

not:

```txt
"This player is at the bottom of a tier"
```

## Slice Review

- Smallest meaningful increment: yes, this only tightens tier-drop eligibility.
- Concrete enough for implementation: yes, the same-position same-tier eligibility check is explicit.
- Avoids unnecessary architecture changes: yes, all logic stays inside the pure recommendation helper.
- Blast radius reasonable: yes, expected changes are one helper module and this plan doc.
- Review/revert comfort: yes, the eligibility condition can be reverted without affecting draft state or UI structure.
- Observable/testable acceptance criteria: yes, scores, reasons, lint, build, and recommendation behavior are directly checkable.
