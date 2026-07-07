# Current Slice - Task 5: Add Board and Next-Pocket Insights

## Status

Complete. Task 5 passed focused validation on 2026-07-07.

## Context

Phase 6 Tasks 1-4 created the pure Insight Engine contract, neutral bundle behavior, score-gap labels, primary decision frames, top-candidate summaries, top-options tradeoff insights, and roster construction insights.

Task 5 adds near-term board and next-pocket interpretation to the same pure Insight Engine. The goal is to explain supported forecast/profile context for the current decision without changing forecast construction, recommendation scoring, candidate timing allocation, or UI presentation.

`InsightInput` currently carries an optional `forecast` plus recommendation components. The existing `draft_pocket_timing` recommendation component already carries the Phase 5.5 candidate/profile-transition evidence needed by this slice, including forecast status, target pick, candidate/profile position, overall-tier origin, profile ordinal, allocation role, current/forecast pocket membership, comparable and near replacement counts, replacement quality, skip safety, current and forecasted profile counts, profile disappearance, highest meaningful tier disappearance, and threshold matched.

This slice must not add raw profile-transition arrays to the Insight Engine boundary unless implementation proves the existing component evidence is insufficient. It must not change recommendation scores, ordering, reason generation, board forecasts, profile transitions, UI presentation, persistence, or scenario contracts.

## Goal

Generate deterministic board or next-pocket insight in `boardInsights` when existing active forecast and `draft_pocket_timing` evidence materially explain profile-level current-pocket pressure or wait-safe next-pocket context.

## Scope

### Goals

- Interpret existing `draft_pocket_timing` component evidence for the top recommendations.
- Use `input.forecast` only as optional aggregate support for active forecast, current pocket, forecasted pocket, and next-pick target context.
- Generate at most one `next_pocket` or `board_context` insight in `boardInsights`.
- Prefer current-pocket pressure insight when low or medium skip safety materially supports the current decision.
- Generate wait-safe board context only when high skip safety or enough comparable forecasted profiles make urgency unsupported but context is still useful.
- Explain profile-level timing pressure without saying a specific player will or will not be available.
- Preserve the distinction between source overall tiers and defaulted-neutral tiers.
- Include support references to the relevant player/component and, where possible, a stable `forecastProfileId`.
- Suppress board insight when forecast evidence is inactive, missing, neutral, unsupported, or not material.

### Non-goals

- Do not change forecast construction, pocket creation, profile transitions, candidate timing allocation, scoring, caps, reasons, or recommendation ordering.
- Do not add raw profile-transition arrays to `InsightInput` unless required by implementation and kept within the already-approved pure boundary.
- Do not introduce opponent modeling, probabilities, exact-player availability predictions, simulations, projections, VORP, or ADP-as-quality claims.
- Do not infer position tiers from overall/source tiers.
- Do not create whole-draft planning, multi-pick optimization, or strategy-profile advice.
- Do not add UI presentation; Task 6 owns that work.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add package dependencies.

## Implementation Steps

1. In `src/lib/insights.ts`, add local board/next-pocket helper types and evidence readers for `draft_pocket_timing` components:
   - `forecastStatus`;
   - `targetPickNumber`;
   - `candidatePosition`;
   - `profilePosition`;
   - `profileOverallTierOrigin`;
   - `profileOverallTier`;
   - `profileAnchorPlayerId`;
   - `profileOrdinal`;
   - `allocationRole`;
   - `candidateInCurrentPocket`;
   - `candidateInForecastedPocket`;
   - `comparableReplacementCount`;
   - `nearReplacementCount`;
   - `replacementQuality`;
   - `skipSafety`;
   - `currentProfileCount`;
   - `forecastedProfileCount`;
   - `profileDisappeared`;
   - `highestMeaningfulTierDisappeared`;
   - `thresholdMatched`.
2. Add a support helper for forecast/profile evidence that extends existing component support with a stable `forecastProfileId` when the component has enough profile evidence. Use profile-level ids, not player-availability claims.
3. Add a board insight candidate classifier that only considers `draft_pocket_timing` when:
   - the component belongs to a visible recommendation, preferably the top three;
   - component direction is positive and material, or the component is neutral with high skip-safety wait-safe evidence;
   - forecast status is `"active"`;
   - candidate is in the current pocket;
   - candidate position is not `DST` or `K`;
   - allocation role is not `"neutral"` for pressure insights;
   - profile overall-tier origin is not `"defaulted-neutral"` for meaningful tier disappearance language.
4. Select at most one board insight using deterministic priority:
   1. low skip-safety current-pocket pressure with absent comparable forecast profiles;
   2. medium skip-safety current-pocket pressure with limited comparable or near profiles;
   3. source-tier highest meaningful tier disappearance for a material current-pocket candidate;
   4. high skip-safety wait-safe context when comparable forecast profiles remain and urgency should not be overstated.
   Break ties by recommendation order.
5. Create concise insight output:
   - use `kind: "next_pocket"` for pressure or wait-safe next-pocket timing context;
   - use `kind: "board_context"` for broader current-board thinness or profile context;
   - use `severity: "warning"` for low skip-safety or disappearing-profile pressure;
   - use `severity: "info"` for medium skip-safety and wait-safe context;
   - use stable ids such as `next_pocket:low_skip_safety:<playerId>` or `board_context:wait_safe:<playerId>`.
6. Keep wording profile-level and supported. Acceptable patterns include:
   - `Comparable RB profiles thin out before your next pick.`;
   - `This WR profile has limited next-pocket support.`;
   - `Comparable profiles remain in the next pocket.`;
   - `Current-pocket timing is supported for this profile.`;
   Avoid wording such as "this player will be gone", "opponents will take", "X% chance", or "ADP says he is better."
7. Add the selected insight to `boardInsights`; leave `primaryInsight`, `candidateInsights`, `tradeoffInsights`, `rosterInsights`, `caveats`, recommendation output, and forecast output unchanged.
8. Extend `src/lib/insights.test.ts` with focused fixtures covering:
   - low skip-safety pocket pressure with absent comparable profiles;
   - medium skip-safety with limited comparable or near profiles;
   - high skip-safety wait-safe context with comparable profiles remaining;
   - defaulted-neutral overall-tier profile suppresses tier-disappearance claims;
   - no-ADP, no-next-pick, inactive, missing, and outside-current-pocket states suppress board insight;
   - DST/K timing evidence suppresses board insight;
   - neutral allocation or zero-allocation timing evidence suppresses pressure insight;
   - same-profile candidates use the same profile evidence consistently;
   - support references include the relevant `draft_pocket_timing` component and stable forecast profile id when available;
   - equivalent inputs produce deterministic output and inputs are not mutated.
9. Run focused validation:

   ```powershell
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/lib/insights.ts`
- `src/lib/insights.test.ts`

Type changes are not expected. Do not edit `src/types/draft.ts` unless implementation proves the existing Insight Engine contract cannot express required support references.

No UI, persistence, scenario, recommendation-engine, forecast-construction, schema, package, or ranking import files are expected.

## Acceptance Criteria

- Low or medium skip safety can produce supported next-pocket pressure language for material current-pocket candidates.
- High skip safety suppresses urgency and may support wait-safe language when useful.
- Defaulted-neutral profiles never produce meaningful overall-tier disappearance claims.
- No-ADP, no-next-pick, inactive, missing, outside-pocket, DST/K, neutral-allocation, and unsupported states produce no board or future-pick claims.
- Same-profile candidates read the same Phase 5.5 profile evidence consistently.
- Every board or next-pocket insight traces to `draft_pocket_timing` evidence and, where applicable, active forecast context.
- Insight wording stays profile-level and never predicts exact player availability, opponent behavior, probabilities, projections, or ADP-as-quality.
- Existing primary decision frames, candidate summaries, tradeoff insights, and roster insights remain deterministic.
- Recommendation scores, ordering, components, adjustments, reasons, forecast output, profile transitions, and timing allocation are unchanged.
- Focused tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- board insight generation requires changing recommendation scoring, forecast construction, profile transitions, candidate timing allocation, caps, or reasons;
- the existing `draft_pocket_timing` evidence is insufficient and adding raw profile transitions would expand the Insight Engine boundary beyond the approved contract;
- useful wording would require unsupported claims about exact player availability, opponents, probabilities, projections, ADP quality, or whole-draft planning;
- implementation requires UI, persistence, scenario, schema, ranking import, or recommendation-engine changes;
- validation failures require changes outside the expected files.

## Slice Review

1. Smallest meaningful increment: yes - this adds the board/next-pocket insight category without pulling in UI or phase exit validation.
2. Executable without redefining the approach: yes - evidence fields, materiality gates, priority order, output shape, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - work remains inside the pure Insight Engine and uses existing recommendation component evidence.
4. Reasonable blast radius: yes - expected changes are limited to two files.
5. Comfortably reviewable and revertible: yes - no recommendation, forecast, persistence, or UI behavior should change.
6. Observable and testable acceptance criteria: yes - insight presence, suppression, support references, deterministic output, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 6: Present Strategic Insights in the Draft Experience.

## Completion Notes

Completed on 2026-07-07.

- Added deterministic board and next-pocket insight selection in `src/lib/insights.ts`.
- Interpreted existing `draft_pocket_timing` component evidence for low skip-safety pressure, medium skip-safety limited support, source-tier current-pocket context, and high skip-safety wait-safe context.
- Added profile-level `next_pocket` and `board_context` insight output with traceable `supportedBy` references and stable forecast profile ids.
- Suppressed unsupported board insight states for inactive aggregate forecasts, inactive component evidence, missing timing evidence, outside-pocket candidates, DST/K, neutral pressure allocation, and defaulted-neutral tier-disappearance claims.
- Preserved recommendation scoring, ordering, components, adjustments, reasons, forecast construction, profile transitions, timing allocation, UI, persistence, and scenario contracts.
- Extended `src/lib/insights.test.ts` to 52 focused tests covering board/next-pocket insight presence, suppression, support references, same-profile evidence, determinism, and immutability.
- Confirmed `npm test -- src/lib/insights.test.ts`, `npx tsc --noEmit`, and `git diff --check` pass.
