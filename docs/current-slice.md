# Current Slice: Add the Overall-Tier Score Component

## Completion Status

Complete. Added the pure bounded `overall_tier` score component with exact `+3` and `+6` thresholds, explicit neutral states, cross-position overall-tier semantics, deterministic evidence, tier-gap neutrality, and strict separation from position-local recommendation tiers. The component is not called by recommendation generation, so existing scores and ordering remain unchanged. Focused validation passed with 1 test file and 68 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Implement the pure, bounded `overall_tier` recommendation score component that recognizes the best remaining overall quality band without integrating it into recommendation totals, ordering, caps, or explanations.

## Scope

### Goals

- Calculate overall-tier context from normalized `RecommendationRankingFact` values.
- Identify the numerically lowest overall tier among all available players, regardless of position.
- Return `+3` when a candidate belongs to the best available overall tier, multiple players remain in that tier, and a lower overall tier is available.
- Return `+6` when the candidate is the last remaining player in the best available overall tier and a lower overall tier is available.
- Return zero for candidates outside the best tier, contexts with no lower tier, and defaulted-neutral overall tiers.
- Ignore numeric gaps between tier labels when choosing the component value.
- Preserve strict separation from position-local recommendation tiers and tier-cliff scoring.
- Return deterministic component direction, priority, and evidence for later integration and explanation work.

### Non-Goals

- Do not call the component from `generatePlayerRecommendations`.
- Do not change recommendation totals, context scores, ordering, caps, adjustments, or tie-breaking.
- Do not add overall-tier reason text or change reason selection.
- Do not change recommendation input, normalized context, snapshot propagation, Draft Room, transient sessions, or scenarios.
- Do not infer tiers, compare tier-label gap magnitude, filter by position, or apply roster-need adjustments.
- Do not add tuning UI, generic signal abstractions, dependencies, or persistence changes.

## Implementation Decisions

- Add an exported `calculateOverallTierComponent` function to `src/lib/recommendations.ts` beside the existing pure score-component functions.
- Accept one normalized candidate and the complete readonly collection of normalized available rankings.
- Return the existing `RecommendationScoreComponent` shape with:
  - `id: "overall_tier"`;
  - direction `positive` only for a positive delta, otherwise `neutral`;
  - fixed component priority `19` for later reason selection;
  - a bounded delta from `0` through `6`.
- Use fixed approved values in this pure slice:
  - best tier with multiple remaining players and a lower tier available: `+3`;
  - last player in the best tier with a lower tier available: `+6`.
- Do not add these constants to `RecommendationTuningConfig` in this slice. Task 5 may expose integration-level tuning only if required by the approved scoring contract.
- Treat a candidate with `overallTierOrigin: "defaulted-neutral"` as neutral without evaluating a synthetic boundary.
- Compute the best tier and remaining count across positions. Player position and `RankingEntry.tier` must not influence the result.
- Do not use the numeric difference between current and lower tier labels; only their ordering and existence matter.
- Emit evidence with:
  - `candidateTier`;
  - `bestAvailableTier`;
  - `bestTierRemaining`;
  - `hasLowerTierAvailable`;
  - `overallTierOrigin`;
  - `thresholdMatched`.
- Use stable threshold states:
  - `last_in_best_overall_tier`;
  - `best_overall_tier_available`;
  - `outside_best_overall_tier`;
  - `no_overall_tier_boundary`;
  - `defaulted_neutral_overall_tier`.
- Preserve deterministic results regardless of available-ranking array order.

## Implementation Steps

1. Add the pure overall-tier component.

   In `src/lib/recommendations.ts`:

   - import the normalized recommendation-ranking fact type;
   - add private constants for the `0..6` bounds, `+3` and `+6` outcomes, and priority `19`;
   - implement `calculateOverallTierComponent` with the approved candidate and available-ranking inputs;
   - short-circuit defaulted-neutral candidates to zero with explicit evidence;
   - determine the best available tier, number remaining in that tier, and whether a lower tier exists across all available positions;
   - apply the approved threshold rules in deterministic order;
   - clamp the resulting delta to `0..6` and return exact evidence;
   - do not add the component to any recommendation-generation path.

2. Add focused component tests.

   In `src/lib/recommendations.test.ts`:

   - import the new component and normalized ranking-fact type;
   - add a focused normalized-ranking test helper without changing existing `RankingEntry` fixtures;
   - assert `+3` and `best_overall_tier_available` when multiple best-tier players remain above a lower tier;
   - assert `+6` and `last_in_best_overall_tier` for the final player in the best tier;
   - assert zero for a candidate outside the best tier;
   - assert zero when every available player belongs to one tier;
   - assert zero for defaulted-neutral overall tiers;
   - assert tier-label gaps do not change the outcome;
   - assert players across different positions participate in the same overall-tier calculation;
   - assert changing position-local `RankingEntry.tier` values does not change the component;
   - assert available-ranking input order does not change output or evidence;
   - retain all existing recommendation tests unchanged.

3. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/recommendations.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because this slice does not integrate the component into user-visible recommendations.

4. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Mark Task 3 complete in `docs/tasks.md`.
   - Stop without beginning Task 4 ADP availability scoring or Task 5 integration.

## Expected Files

Production:

- `src/lib/recommendations.ts`

Focused tests:

- `src/lib/recommendations.test.ts`

Planning and completion tracking:

- `docs/current-slice.md`
- `docs/tasks.md` only after validation passes

Do not touch recommendation types, normalized context, Draft Room, page props, transient sessions, snapshot mapping, repositories, imports, scenarios, Prisma, dependencies, project scope, architecture, roadmap, or future-ideas documents.

## Acceptance Criteria

- Multiple players in the best available overall tier receive an exact `+3` component when a lower tier exists.
- The final player in the best available overall tier receives an exact `+6` component when a lower tier exists.
- Candidates outside the best tier receive zero.
- A one-tier available context receives zero because no tier boundary exists.
- Defaulted-neutral overall tiers receive zero and cannot produce a false boundary.
- Non-contiguous tier labels produce the same values as contiguous labels with equivalent ordering.
- Position and position-local recommendation-tier values do not influence the component.
- Component output and evidence are deterministic regardless of available-ranking array order.
- The component delta remains bounded from `0` through `6`.
- No recommendation total, ordering, cap, adjustment, reason, UI, persisted draft, or replay behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If the normalized context can mix source and defaulted-neutral overall-tier origins in one valid context, stop and report before defining mixed-origin scoring behavior.
- If existing recommendation-component evidence cannot represent the approved fields, stop and report before changing shared evidence types.
- If adding the pure function changes recommendation output without explicit integration, stop and remove the unintended call path.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 4: add the pure ADP availability component and preview decision-point calculation without integrating it into recommendation totals. Do not begin Task 4 automatically.

## Slice Review

- Smallest meaningful increment: yes. It implements one independently testable recommendation signal without integration side effects.
- Executable by a lower-reasoning pass: yes. Inputs, bounds, thresholds, evidence, constants, files, and test cases are explicit.
- Avoids unnecessary architecture changes: yes. It follows the existing explicit pure-component pattern and adds no framework or registry.
- Blast radius reasonable: yes. Implementation and tests are limited to the existing recommendation module and its focused test file.
- Review/revert comfort: yes. The function is not called by production recommendation generation in this slice.
- Observable/testable acceptance criteria: yes. Every positive, neutral, semantic-separation, gap, cross-position, and determinism rule has direct unit coverage.
