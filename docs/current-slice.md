# Current Slice: Add Explanation Selection

## Source Task

Task 8: Add Explanation Selection.

## Goal

Generate concise, deterministic recommendation reasons directly from the score components already produced by the pure Recommendation Engine.

This slice should make each returned recommendation explain its strongest score-backed signals without changing scoring behavior or introducing a separate reasoning system.

## User-Visible Increment

- Each player recommendation can include up to three concise reasons.
- Reasons explain actual scoring signals such as roster fit, tier pressure, scarcity, observed runs, value opportunity, or a meaningful penalty.
- Reason output is stable for identical recommendation inputs.

## Current Context

Previous Phase 3 slices established:

- A pure `generatePlayerRecommendations` entry point.
- Deterministic base, roster-fit, value-opportunity, tier-cliff, positional-scarcity, and positional-run score components.
- Stable component ids, directions, priorities, and evidence.
- `RecommendationReason` with `id`, `text`, `sourceComponentId`, and `priority`.
- Tuning values for `positiveReasonThreshold`, `negativeReasonThreshold`, and `maxReasons`.
- `PlayerRecommendation.reasons` currently remains empty.
- `generateTopRecommendations` remains the legacy UI compatibility path and should not be changed for this slice.

The approved design requires explanations to come from scoring components rather than generic strategy claims, predictions, AI-generated language, or a second scoring system.

## Scope

### Goals

- Add a pure reason-selection helper in `src/lib/recommendations.ts`.
- Convert eligible score components into typed `RecommendationReason` candidates.
- Use component evidence to produce concise, factual reason text.
- Apply positive and negative reason thresholds from recommendation tuning.
- Return at most `tuning.maxReasons` reasons.
- Order reasons deterministically using component priority, component impact, and stable ids.
- Include no more than one meaningful negative caveat and keep it last.
- Use base value as a reason for a top-five available ranking value or as a fallback when no contextual positive reason qualifies.
- Populate `PlayerRecommendation.reasons` without changing scores or ordering.
- Add focused reason-selection tests.

### Non-Goals

- Changing score formulas, modifier deltas, caps, or recommendation ordering.
- Adding AI-written or conversational explanations.
- Predicting opponent behavior or whether a positional run will continue.
- Adding generic strategy advice or unsupported upside claims.
- Adding long-form insights.
- Adding UI wiring or presentation changes.
- Changing persistence, Prisma, server actions, draft sources, or Draft State Engine behavior.
- Changing the `RecommendationReason` or score-component types unless a compile blocker appears.
- Introducing a generic explanation registry or templating framework.
- Updating `docs/tasks.md`, `docs/project.md`, `docs/architecture.md`, `docs/decisions.md`, or design docs.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`

Do not modify `src/types/draft.ts` unless the existing typed reason contract creates a compile blocker.

## Reason Eligibility

### Positive Context

- Exclude neutral components.
- Exclude `base_value` from the generic positive threshold path; handle it through the base-value rule below.
- A positive component qualifies when:
  - `component.direction === "positive"`
  - `component.delta >= tuning.positiveReasonThreshold`
- Supported positive components are:
  - `roster_fit`
  - `tier_cliff`
  - `positional_scarcity`
  - `positional_run`
  - `value_opportunity`

### Negative Caveat

- A negative component qualifies when:
  - `component.direction === "negative"`
  - `component.delta <= tuning.negativeReasonThreshold`
- Supported negative components are:
  - `roster_fit`
  - `value_opportunity`
- Select at most one caveat.
- Choose the most negative delta first, then higher component priority, then stable reason id.
- Append the caveat after positive reasons.
- Reserve a slot for the caveat only when `maxReasons >= 2`; a one-reason result should retain its strongest positive or base-value explanation.

### Base Value

- Compute each candidate's one-based value rank from `availableRankings` sorted by the existing stable draft-order comparator.
- Add a `base_value` reason when either:
  - the candidate is among the top five available ranking values, or
  - no contextual positive reason qualifies.
- Base value does not use its numeric score delta as a reason threshold because that score is on a different scale from context modifiers.

## Reason Text Mapping

Create text only from the source component's stored evidence. Use the following deterministic mappings:

- `base_value`
  - `Ranked #<overallRank> overall.`
- Positive `roster_fit`
  - `direct_starter_need`: `Fills an open <position> starter slot.`
  - `flex_need`: `Helps fill an open FLEX slot.`
  - `bench_depth`: `Adds useful <position> depth.`
- Negative `roster_fit`
  - `early_def_k`: `Early for <position> relative to roster timing.`
  - `saturated`: `<position> is already saturated on the roster.`
  - `limited_need`: `Limited current roster need at <position>.`
- `tier_cliff`
  - `major_tier_cliff`: `A major <position> tier drop follows.`
  - `last_in_tier`: `Last <position> available in this tier.`
  - `mild_tier_pressure`: `Only <sameTierRemaining> <position> options remain in this tier.`
- `positional_scarcity`
  - `clear_scarcity`: `No nearby <position> options remain in the next <lookaheadRanks> ranks.`
  - `mild_scarcity`: `Only <nearbySamePositionOptions> nearby <position> options remain.`
- `positional_run`
  - `mild_run` or `clear_run`: `<recentPositionPickCount> <position> players were drafted in the last <recentPickWindow> picks.`
- Positive `value_opportunity`
  - `Value at pick <currentPickNumber>: ranked #<overallRank> overall.`
- Negative `value_opportunity`
  - `Reach at pick <currentPickNumber>: ranked #<overallRank> overall.`

Do not create a reason when the component id, direction, threshold label, or required evidence does not match a supported mapping. Do not invent fallback evidence.

Use stable reason ids derived from the component and matched evidence state, such as `roster_fit:direct_starter_need` or `tier_cliff:major_tier_cliff`. Set `sourceComponentId` to the exact component id and inherit `priority` from the component, defaulting to `0` only if absent.

## Deterministic Selection Rules

1. Build supported positive contextual reason candidates.
2. Sort positive contextual candidates by:
   - component priority descending
   - component delta descending
   - reason id ascending
3. Add the eligible base-value candidate to the same ordered pool using the base component priority and delta.
4. Re-sort the positive/base pool with the same comparator.
5. Select the single eligible negative caveat using:
   - component delta ascending
   - component priority descending
   - reason id ascending
6. If a caveat qualifies and `maxReasons >= 2`, reserve one final slot for it.
7. Fill remaining slots from the positive/base pool.
8. Append the caveat last.
9. Clamp the effective reason limit to a non-negative integer with `Math.max(0, Math.floor(tuning.maxReasons))`.

## Implementation Steps

1. Review the active implementation context.
   - Read `docs/current-slice.md`.
   - Read Task 8 in `docs/tasks.md`.
   - Read the Explanation Model section of `docs/design/recommendation-engine.md`.
   - Read the recommendation types in `src/types/draft.ts`.
   - Read `src/lib/recommendations.ts`.
   - Read `src/lib/recommendations.test.ts`.

2. Add pure reason-candidate construction.
   - Add a small internal candidate shape that retains the typed reason plus source component delta.
   - Add evidence readers that safely accept only the expected primitive evidence types.
   - Map only the supported component/evidence combinations listed in this slice.
   - Keep all text factual and derived from component evidence.

3. Add deterministic reason selection.
   - Add an exported helper such as `selectRecommendationReasons` for focused unit testing.
   - Inputs should include candidate ranking, score components, available value rank, and tuning.
   - Apply the eligibility, base-value, sorting, caveat, and limit rules exactly as specified.
   - Return `RecommendationReason[]`.

4. Integrate selection into the pure engine.
   - Derive stable available value ranks once from `availableRankings`.
   - Build each recommendation's existing component array without changing component order or values.
   - Pass the candidate's ranking, components, available value rank, and tuning to the selection helper.
   - Replace the empty `reasons` array with the selected reasons.
   - Do not change score calculation, context composition, sorting, or result limits.

5. Preserve compatibility boundaries.
   - Do not change `generateTopRecommendations` or its string reasons.
   - Do not change UI call sites.
   - Do not introduce persistence or draft-source dependencies.

6. Add focused tests.
   - Unit test that every emitted reason references a component present on the recommendation.
   - Unit test deterministic priority ordering for multiple qualifying positive components.
   - Unit test `maxReasons` and non-integer/negative limit handling.
   - Unit test that a meaningful negative caveat is selected once and placed last.
   - Unit test that below-threshold positive and negative components do not emit reasons.
   - Unit test base value for a top-five available ranking value.
   - Unit test base value fallback when no contextual positive reason qualifies.
   - Unit test representative text/evidence mappings for roster need, tier cliff, scarcity, observed run, value opportunity, and a negative penalty.
   - Unit test that identical inputs return identical reason arrays.
   - Regression test that recommendation scores and ordering remain unchanged by reason selection.

7. Run validation.
   - Run `npm test -- src/lib/recommendations.test.ts` if the test runner accepts a file argument.
   - If that command does not work, run `npm test`.
   - Run `npm run lint`.
   - Fix only failures caused by this slice.
   - If validation fails for unrelated pre-existing reasons, document the blocker and stop.

8. Stop after Task 8.
   - Do not start scenario validation, UI wiring, or later recommendation tasks.
   - Do not update planning docs beyond this current slice.

## Acceptance Criteria

- Every emitted reason traces to an existing score component through `sourceComponentId`.
- Reason text uses only evidence stored on the source component or ranking evidence already represented by `base_value`.
- Recommendations return no more than the configured maximum of three reasons by default.
- Meaningful roster need, tier cliff, scarcity, observed run, value opportunity, and negative caveat reasons can be selected.
- Components below configured thresholds do not produce contextual reasons.
- At most one negative caveat is returned, and it appears last.
- Base value is available for top-five ranking values and as a fallback when contextual positives do not qualify.
- Reason ordering is deterministic for the same input.
- Recommendation scores, component values, and player ordering remain unchanged.
- No generic advice, opponent prediction, AI-generated claim, or unsupported evidence is emitted.
- Existing `generateTopRecommendations` behavior remains available for current UI compatibility.
- No UI, persistence, server action, Prisma, or draft-source dependency is introduced.

## Suggested Tests

- Unit test score-component traceability.
- Unit test positive reason priority ordering.
- Unit test reason count limit.
- Unit test one negative caveat placed last.
- Unit test threshold suppression.
- Unit test top-five base-value reason and fallback behavior.
- Unit test evidence-backed reason text for each supported component family.
- Unit test deterministic reason output.
- Regression test unchanged scores and recommendation ordering.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.test.ts
npm run lint
```

If targeted test execution is unsupported, run:

```txt
npm test
npm run lint
```

## Slice Review

- Smallest meaningful increment: yes. It adds only deterministic reason selection from components that already exist.
- Concrete enough for implementation: yes. Eligibility, mappings, ordering, limits, caveat behavior, integration, and tests are specified.
- Avoids unnecessary architecture changes: yes. It uses the existing pure engine, component model, reason type, and tuning config without a registry or new subsystem.
- Blast radius reasonable: yes. Expected implementation changes are limited to the recommendation library and its focused tests.
- Review/revert comfort: yes. Reasons are derived output and do not alter scoring, UI, persistence, or draft state.
- Observable/testable acceptance criteria: yes. Traceability, text mapping, thresholds, ordering, limits, determinism, and score stability are directly testable.
