# Current Slice - Task 2: Generate Primary Decision Frames and Top-Candidate Summaries

## Status

Planned. Ready for implementation.

## Context

Phase 6 Task 1 created the pure Insight Engine contract and `generateStrategicInsights` neutral bundle. Task 2 should make the first useful Insight Engine output by interpreting existing recommendation components for the current top recommendation.

This slice should still stay entirely inside the pure domain layer. It should not call the Insight Engine from the Draft Room, change recommendation scoring, change recommendation ordering, or add UI presentation.

The Insight Engine currently lives in `src/lib/insights.ts`, with tests in `src/lib/insights.test.ts`. Recommendation output already exposes the structured surface this slice should consume: `totalScore`, `baseScore`, `contextScore`, `components`, `scoreAdjustments`, and `reasons`.

## Goal

Generate a deterministic primary decision frame and concise top-candidate summary from existing recommendation evidence, while suppressing unsupported or immaterial claims.

## Scope

### Goals

- Derive `summary.scoreGapLabel` from the top recommendation and next recommendation without reordering recommendations.
- Generate one `primaryInsight` when the top recommendation has a supported material decision frame.
- Generate one `candidate_summary` insight for the top recommendation when material supported evidence exists.
- Support these first decision frames:
  - `clean_best_player`
  - `value_over_need`
  - `need_over_value`
  - `pocket_pressure`
  - `tier_boundary`
  - `run_pressure`
  - `caveated_top_pick`
  - `close_call`
  - `no_material_insight`
- Interpret only existing top-recommendation components and minimal second-recommendation score context needed for score-gap and value/need framing.
- Use conservative materiality thresholds:
  - positive component material at `delta >= 3`;
  - negative caveat material at `delta <= -6`;
  - close score gap at `<= 3`;
  - slight lean at `> 3` and `<= 8`;
  - clear lean at `> 8`.
- Include `supportedBy` references for every generated insight.
- Suppress insight text when component evidence is neutral, below threshold, defaulted-neutral, unsupported, contradictory, or absent.

### Non-goals

- Do not generate top-options tradeoff insights; Task 3 owns multi-candidate tradeoff wording.
- Do not generate roster construction summaries; Task 4 owns roster insight.
- Do not generate board or next-pocket notes beyond using a material top-candidate `draft_pocket_timing` component for the primary frame/summary; Task 5 owns board and pocket insight.
- Do not call the Insight Engine from UI or application workflows.
- Do not change recommendation scores, ordering, components, adjustments, reasons, caps, or forecast behavior.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add AI-generated language, simulations, opponent modeling, probabilities, exact-player availability claims, ADP-as-quality claims, or new recommendation signals.

## Implementation Steps

1. In `src/lib/insights.ts`, add local helper functions for:
   - finding components by id on a `PlayerRecommendation`;
   - checking material positive and negative components;
   - deriving `scoreGapLabel`;
   - building `supportedBy` references from component ids, evidence keys, reason ids, and score adjustment ids.
2. Derive score gap labels:
   - zero recommendations: `leadingPlayerId: null`, `scoreGapLabel: "unavailable"`;
   - one recommendation: `leadingPlayerId` set, `scoreGapLabel: "unavailable"`;
   - two or more recommendations: compare `top.totalScore - second.totalScore`;
   - `<= 3`: `"close_call"`;
   - `> 3` and `<= 8`: `"slight_lean"`;
   - `> 8`: `"clear_lean"`.
3. Add primary frame selection in deterministic priority order:
   - `close_call` when the score gap label is `"close_call"`;
   - `caveated_top_pick` when the top recommendation has a material negative component and still ranks first;
   - `pocket_pressure` when material `draft_pocket_timing` evidence is supported;
   - `tier_boundary` when material `overall_tier` or recommendation-eligible `tier_cliff` evidence is supported;
   - `run_pressure` when material `positional_run` evidence is supported;
   - `need_over_value` when material positive `roster_fit` or urgency/context components explain the top recommendation while another recommendation has a stronger `baseScore`;
   - `value_over_need` when the top recommendation has the strongest visible player-quality case but a neutral/negative roster-fit component;
   - `clean_best_player` when the top recommendation leads on `baseScore` and has no material caveat;
   - otherwise `no_material_insight`.
4. Generate `primaryInsight` only when the selected frame is not `no_material_insight`.
   - Use concise deterministic titles and optional bodies.
   - Keep wording grounded in component ids and evidence.
   - Do not mention exact future availability, opponent behavior, probability, projection, or ADP quality.
5. Generate one top-candidate `candidate_summary` insight when the top recommendation has material supported evidence.
   - Prefer the strongest material positive component by priority, then delta, then id.
   - Include one material caveat in the body only when present.
   - Suppress the summary when only neutral or unsupported evidence exists.
6. Preserve the existing neutral bundle shape for arrays not owned by this slice:
   - `tradeoffInsights: []`
   - `rosterInsights: []`
   - `boardInsights: []`
   - `caveats: []` unless a caveat is included as the top-candidate summary body or primary caveated frame.
   - `suppressedSignals` may include deterministic records for below-threshold/defaulted/unsupported signals when useful for tests, but UI-facing insight arrays should remain silent.
7. Extend `src/lib/insights.test.ts` with fixtures covering:
   - score-gap labels for unavailable, close, slight, and clear states;
   - clean best-player frame;
   - value-over-need frame;
   - need-over-value frame;
   - pocket-pressure frame from material `draft_pocket_timing`;
   - tier-boundary frame from supported `overall_tier` or `tier_cliff`;
   - run-pressure frame;
   - caveated top pick from material negative component;
   - suppression for below-threshold, defaulted-neutral, inactive forecast, high skip-safety, and unsupported timing evidence;
   - deterministic `supportedBy` references.
8. Run focused validation:

   ```powershell
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/lib/insights.ts`
- `src/lib/insights.test.ts`

Type changes are not expected. Do not edit `src/types/draft.ts` unless implementation reveals a missing type required by the already-approved contract.

No UI, persistence, scenario, or recommendation-engine files are expected.

## Acceptance Criteria

- `generateStrategicInsights` derives deterministic score-gap labels from existing recommendation order and scores.
- A clean top player produces a concise best-player or player-quality frame.
- A top player with material roster/timing support produces the appropriate supported frame.
- A top player with a meaningful negative component produces a caveated frame or caveated summary.
- Close top scores avoid overstated certainty by using the `close_call` frame.
- Unsupported, inactive, defaulted-neutral, below-threshold, high-safety, or neutral tier/forecast/run/timing evidence does not produce UI-facing claims.
- Every generated primary or candidate-summary insight includes traceable `supportedBy` references.
- Recommendation scores, ordering, components, adjustments, and reasons are unchanged.
- Focused tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- the existing component evidence is insufficient to support a required frame without changing Recommendation Engine behavior;
- frame selection requires broad multi-candidate tradeoff logic that belongs in Task 3;
- implementing summaries requires roster reconstruction beyond existing top-recommendation component evidence;
- validation failures require recommendation scoring, forecast, UI, persistence, scenario, or schema changes;
- a needed insight claim would be unsupported by structured inputs.

## Slice Review

1. Smallest meaningful increment: yes - this adds the first visible domain insight while leaving tradeoffs, roster summaries, board notes, and UI for later tasks.
2. Executable without redefining the approach: yes - frame priority, thresholds, supported evidence, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - work remains inside the pure Insight Engine.
4. Reasonable blast radius: yes - expected changes are limited to two files, with a possible type-file edit only if the existing contract is insufficient.
5. Comfortably reviewable and revertible: yes - no existing recommendation behavior should change.
6. Observable and testable acceptance criteria: yes - generated frames, summaries, support references, suppression behavior, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 3: Add Top-Options Tradeoff Insights.
