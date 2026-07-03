# Current Slice: Add the ADP Availability Component

## Completion Status

Complete. Added the pure bounded `adp_availability` component with schedule-derived on-turn and preview decision points, exact `+8`, `+7`, `+5`, `+3`, and neutral outcomes, nullable ADP support, final-turn neutrality, fractional progress, and deterministic evidence. The component is not called by recommendation generation, so current scores, ordering, and UI behavior remain unchanged. Focused validation passed with 1 test file and 79 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Implement the pure, bounded `adp_availability` recommendation component that estimates the opportunity cost of waiting until the user's following turn, including deterministic preview decision points between user turns, without integrating the component into recommendation totals or UI behavior.

## Scope

### Goals

- Derive the relevant user decision pick from the current draft schedule.
- Use the current pick when the user is on the clock.
- Use the next scheduled user pick as a preview decision point when another team is on the clock.
- Derive the user's following scheduled pick after that decision point.
- Calculate normalized ADP turn progress from the decision pick to the following user pick.
- Apply the approved positive-only ADP risk bands from `0` through `+8`.
- Return neutral behavior for null ADP, ADP after the following turn, and no following user turn.
- Preserve fractional ADP without rounding.
- Return deterministic direction, priority, and evidence for later scoring integration and explanations.

### Non-Goals

- Do not call the component from `generatePlayerRecommendations`.
- Do not change recommendation totals, context scores, ordering, caps, adjustments, tie-breaking, or reasons.
- Do not display or activate between-turn previews in Draft Room; Task 7 owns user-visible preview integration.
- Do not fetch, refresh, infer, or default missing ADP.
- Do not simulate intervening opponent picks or claim probability or certainty.
- Do not change ranking context, draft state, league settings, persistence, scenarios, UI, or dependencies.
- Do not add tuning UI or a generic signal framework.

## Implementation Decisions

- Add an exported `calculateAdpAvailabilityComponent` function to `src/lib/recommendations.ts` beside the existing pure component functions.
- Accept:
  - one normalized `RecommendationRankingFact` candidate;
  - the current `Draft`;
  - the user team identity.
- Derive decision points from `draft.picks`; do not hard-code league size, snake position, rounds, or turn distance.
- Determine the decision pick as:
  - `draft.currentPickNumber` with `isPreview: false` when the current scheduled pick belongs to the user;
  - the first scheduled user pick after the current pick with `isPreview: true` when another team is on the clock;
  - `null` when no user decision remains.
- Determine `nextTurnPickNumber` as the first user pick strictly after `decisionPickNumber`.
- Calculate `turnSpan = nextTurnPickNumber - decisionPickNumber` only when both picks exist.
- For valid non-null ADP and a positive turn span, calculate:

  ```text
  turnProgress = (nextTurnPickNumber - adpRank) / turnSpan
  ```

- Apply these fixed approved values in order:
  - null ADP: `0` / `missing_adp`;
  - no following user turn: `0` / `no_next_turn`;
  - `adpRank <= decisionPickNumber`: `+8` / `available_past_adp`;
  - `turnProgress >= 2/3`: `+7` / `high_next_turn_risk`;
  - `turnProgress >= 1/3`: `+5` / `meaningful_next_turn_risk`;
  - `turnProgress >= 0`: `+3` / `borderline_next_turn_risk`;
  - ADP after the following user pick: `0` / `expected_available_next_turn`.
- Keep the signal positive-only. A player expected to remain available receives no urgency, not a quality penalty.
- Clamp the component to `0..8` and assign fixed component priority `20` for later reason selection.
- Emit evidence with:
  - `adpRank`;
  - `decisionPickNumber`;
  - `nextTurnPickNumber`;
  - `turnSpan`;
  - `turnProgress`;
  - `isPreview`;
  - `thresholdMatched`.
- Use `null` evidence for unavailable numeric values rather than sentinel numbers.
- Do not add these constants to `RecommendationTuningConfig` in this slice. Task 5 owns integration-level scoring configuration.

## Implementation Steps

1. Add the pure ADP availability component.

   In `src/lib/recommendations.ts`:

   - add private constants for the `0..8` bounds, four positive bands, fractional thresholds, and priority `20`;
   - implement a small private decision-point helper over the draft's scheduled picks;
   - implement `calculateAdpAvailabilityComponent` using the normalized candidate, draft, and user team identity;
   - derive on-turn and preview decision points deterministically;
   - handle missing ADP and missing following turns as explicit neutral states;
   - preserve fractional ADP and turn progress without rounding;
   - clamp the delta and return exact evidence;
   - do not add the component to recommendation generation or reason selection.

2. Add focused component tests.

   In `src/lib/recommendations.test.ts`:

   - import the new component and reuse the normalized-ranking helper from Task 3;
   - use generated snake draft schedules rather than hand-written opponent assumptions;
   - assert the current user pick is used with `isPreview: false` when the user is on the clock;
   - assert the next user pick is used with `isPreview: true` between user turns;
   - assert exact `+8`, `+7`, `+5`, and `+3` values at representative points and threshold boundaries;
   - assert ADP after the following pick returns zero without a negative adjustment;
   - assert null ADP returns zero and preserves `adpRank: null` evidence;
   - assert the final user decision returns `no_next_turn` and zero;
   - assert fractional ADP is not rounded;
   - assert a non-default snake position derives the correct decision and following-turn picks;
   - assert repeated equivalent inputs produce exact deterministic output;
   - retain all existing recommendation and overall-tier tests unchanged.

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
   - Mark Task 4 complete in `docs/tasks.md`.
   - Stop without beginning Task 5 decision-timing integration.

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

- On the user's turn, the component uses the current pick as the decision point and marks it non-preview.
- Between user turns, the component uses the next scheduled user pick as the decision point and marks it preview.
- The following user pick and turn span are derived from the actual draft schedule.
- Valid ADP maps deterministically to exact `+8`, `+7`, `+5`, `+3`, or `0` bands.
- Null ADP contributes zero, remains null in evidence, and never blocks the candidate.
- ADP after the following user pick contributes zero rather than a penalty.
- The final user decision contributes zero because waiting another turn is impossible.
- Fractional ADP and turn progress are preserved without rounding.
- Component output remains bounded from `0` through `8` and positive-only.
- Equivalent inputs return identical output and evidence.
- No recommendation total, ordering, cap, adjustment, reason, UI, persisted draft, or replay behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If draft schedules cannot distinguish the current user pick from an off-turn preview without new state, stop and report rather than adding UI state or opponent prediction.
- If a valid draft can contain a non-positive span between consecutive user picks, return the neutral no-next-turn state and report the invariant before inventing arithmetic behavior.
- If existing component evidence cannot carry nullable decision values or fractional progress, stop and report before changing shared evidence types.
- If adding the pure function changes recommendation output without explicit integration, stop and remove the unintended call path.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 5: integrate overall-tier and ADP components under the decision-timing cap and existing total-context guardrails. Do not begin Task 5 automatically.

## Slice Review

- Smallest meaningful increment: yes. It implements one independent availability-risk signal and its decision-point semantics without integration side effects.
- Executable by a lower-reasoning pass: yes. Inputs, schedule rules, formula, thresholds, evidence, files, and tests are explicit.
- Avoids unnecessary architecture changes: yes. It follows the existing pure-component pattern and derives state from the current draft schedule.
- Blast radius reasonable: yes. Implementation and tests are limited to the recommendation module and its focused test file.
- Review/revert comfort: yes. The component is not called by production recommendation generation in this slice.
- Observable/testable acceptance criteria: yes. Every decision state, risk band, neutral state, fractional behavior, and determinism rule has direct unit coverage.
