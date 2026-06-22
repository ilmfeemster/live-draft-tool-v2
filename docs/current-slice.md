# Current Slice: Recommendation Engine Ranking Score V1

## Goal

Create the first recommendation engine increment: a pure ranking-based recommender that returns the top 5 available players with simple explanations.

This slice establishes the recommendation data shape and scoring flow without introducing roster need, scarcity, tier-drop, or UI complexity yet.

## User-Visible Increment

No UI change is required in this slice.

The implementation creates recommendation logic that future UI work can call. The app should continue rendering and drafting exactly as it does today.

## Goals

- Define a `Recommendation` type.
- Add a pure recommendation engine module.
- Score available players using overall ranking value.
- Generate the top 5 recommendations from available rankings.
- Generate simple recommendation explanations from the scoring inputs.
- Keep recommendations deterministic and inspectable.
- Keep all recommendation logic independent of React components.
- Preserve existing draft, search, roster, and table behavior.

## Non-Goals

- Recommendation UI.
- Roster need modifier.
- Positional scarcity modifier.
- Tier-drop modifier.
- ADP-based modifier.
- Draft pick timing logic.
- Lineup-slot optimization.
- Persistence.
- Database work.
- New dependencies.
- Runtime CSV parsing.
- Changing the draft flow.

## Expected Files

- `src/types/draft.ts`
- `src/lib/recommendations.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing components in this slice unless TypeScript compatibility requires a small import/type adjustment.

## Implementation Constraint

Keep recommendation logic pure and boring.

Do not add:

- React state for recommendations.
- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- UI components.

## Recommendation Type

Add a `Recommendation` type to `src/types/draft.ts`.

Use a simple shape:

- `ranking`: the `RankingEntry` being recommended.
- `score`: total numeric recommendation score.
- `reasons`: array of human-readable explanation strings.

Do not create a separate `RecommendationReason` type yet unless implementation proves it materially improves clarity.

## Ranking Score Rules

Create a pure helper in `src/lib/recommendations.ts`.

Recommended exports:

- `calculateRankingScore(ranking: RankingEntry): number`
- `generateTopRecommendations(rankings: RankingEntry[], limit?: number): Recommendation[]`

Scoring rule:

```txt
ranking score = 1000 - overallRank
```

Reasoning:

- Lower overall rank is better.
- The score is intentionally simple and easy to inspect.
- The constant keeps scores positive for the current 487-player seed data.
- Future slices can add modifiers to this base score.

Sorting rule:

1. Higher `score` first.
2. Lower `overallRank` as tie-breaker.
3. Player name alphabetically as final deterministic tie-breaker.

Recommendation limit:

- Default to `5`.
- Allow callers to pass a custom positive limit.
- Return an empty array when no rankings are provided.

Explanation rules:

Each recommendation should include at least one reason string.

Required reason:

- `Ranked #<overallRank> overall`

Optional ADP context:

- If `adpRank` is not `null`, include `ADP rank #<adpRank>`.
- Do not use ADP to modify score in this slice.

## Implementation Steps

1. Update `src/types/draft.ts`.
   - Add `Recommendation`.
   - Reuse existing `RankingEntry`.
   - Do not change existing draft or player types unless required.

2. Create `src/lib/recommendations.ts`.
   - Import `RankingEntry` and `Recommendation` as types.
   - Implement `calculateRankingScore`.
   - Implement `generateTopRecommendations`.
   - Keep functions pure and deterministic.
   - Do not mutate the input rankings array.

3. Update `docs/tasks.md`.
   - Mark `Define Recommendation type` complete.
   - Mark `Add ranking score` complete.
   - Mark `Generate top 5 recommendations` complete.
   - Mark `Generate recommendation explanations` complete only if the helper returns reasons.
   - Leave roster need, scarcity, tier-drop, and all UI items unchecked.

4. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, run a quick local script or REPL check that `generateTopRecommendations(seedRankings)` returns 5 recommendations with Ja'Marr Chase first.

## Acceptance Criteria

- `Recommendation` type exists.
- `calculateRankingScore` returns higher scores for better overall ranks.
- `generateTopRecommendations(seedRankings)` returns exactly 5 recommendations by default.
- Recommendations are sorted by score descending.
- The top recommendation from the current seed data is Ja'Marr Chase.
- Each recommendation includes at least one explanation.
- Recommendations include ADP context when `adpRank` is available.
- Rankings with `adpRank: null` still generate recommendations.
- Input rankings are not mutated.
- Existing app UI still renders.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice does not display recommendations yet.

Validation can be done by importing `seedRankings` and `generateTopRecommendations` in a quick local script or REPL check after implementation. The expected first five recommendations should match the first five available overall rankings before any draft picks.

## Slice Review

- Smallest meaningful increment: yes, this creates the recommendation type and first pure scoring function without UI or extra modifiers.
- Concrete enough for implementation: yes, types, exports, scoring formula, sorting, explanations, and task updates are explicit.
- Avoids unnecessary architecture changes: yes, recommendation logic stays in a small pure `lib` module.
- Blast radius reasonable: yes, expected implementation touches one type file, one new lib file, and task docs.
- Review/revert comfort: yes, the slice is independent of UI and draft state changes.
- Observable/testable acceptance criteria: yes, helper outputs, ordering, reasons, lint, and build are all directly checkable.
