# Current Slice: Add Core Roster Construction Scenario Validation

## Source Task

Task 9: Add Recommendation Scenario Validation.

This is the first Task 9 slice. It covers the core roster-construction scenarios only: heavy RB, heavy WR, and QB timing.

## Goal

Add deterministic scenario tests that validate how the completed Recommendation Engine balances base value against roster construction across representative early- and middle-draft states.

This slice should lock down observable behavior without changing production scoring or tuning.

## Confidence Increment

- A heavy RB start demonstrably raises needed WRs above ordinary additional RB depth while preserving elite RB value.
- A heavy WR start produces the symmetric RB behavior while preserving elite WR value.
- QB recommendations remain value-sensitive early, rise when comparable in the middle rounds with an open starter slot, and fall after the QB slot is filled.
- Key recommendation reasons match the score-backed behavior in each scenario.

## Current Context

Phase 3 now has a pure `generatePlayerRecommendations` engine with:

- Rank-derived base value.
- Dynamic roster-fit and timing behavior.
- Value opportunity.
- Tier, scarcity, and observed-run urgency.
- Deterministic, score-backed reasons.
- Stable ordering for identical typed inputs.

Focused unit tests already validate individual formulas, thresholds, caps, component evidence, reason selection, and deterministic ordering. Task 9 should now validate complete draft situations using small, readable fixtures and observable relative ordering.

The approved design recommends asserting top recommendation sets or important relative ordering rather than every player in a full ranking list.

## Scope

### Goals

- Add a dedicated scenario test file for Recommendation Engine behavior.
- Add small typed fixture helpers local to that test file.
- Validate heavy RB roster construction.
- Validate heavy WR roster construction.
- Validate QB timing before and after filling the starter slot.
- Assert important player-relative ordering, not complete score snapshots.
- Assert key score-backed reasons for roster need and saturation.
- Assert drafted players never appear in scenario recommendations.
- Assert identical scenario inputs return identical recommendations and reasons.
- Keep production recommendation code unchanged.

### Non-Goals

- Changing scoring constants, modifier ranges, caps, reason mappings, or engine tuning.
- Fixing a scenario by weakening its assertion or changing production behavior without a separately approved slice.
- Adding positional-run or tier-cliff scenario coverage; those belong in the next Task 9 slice.
- Adding starter-filled, bench-depth, late-round DEF/K, or dynamic-roster scenario coverage.
- Adding persisted-draft parity coverage.
- Adding UI, workflow, database, Prisma, server action, or draft-source integration tests.
- Using the full seed ranking dataset or CSV in scenario tests.
- Refactoring existing test helpers into production or shared infrastructure.
- Updating documentation other than `docs/current-slice.md`.

If a scenario exposes behavior that directly contradicts the approved design, stop and report the discrepancy. Do not tune production scoring inside this validation-only slice.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.scenario.test.ts`

Do not modify `src/lib/recommendations.ts`, `src/lib/recommendations.test.ts`, or application types in this slice.

## Fixture Rules

Create only the helpers needed by this scenario file:

- `createScenarioRanking`
  - Produces a complete `RankingEntry` with explicit id, overall rank, position, position rank, and tier.
- `createScenarioDraft`
  - Uses `createDraftTeams` and `generateSnakeDraftOrder`.
  - Accepts explicit completed user and opponent player ids.
  - Assigns player ids only to picks before `currentPickNumber`.
  - Uses a two-team snake draft with enough rounds to place the scenario roster in the intended draft phase.
- `createScenarioInput`
  - Returns typed `RecommendationInput` using `defaultLeagueSettings` unless the scenario explicitly overrides it.
- Small assertion helpers may:
  - return a recommendation's array index by player id;
  - return reason ids for a player;
  - assert no drafted player id appears in results;
  - call the engine twice and assert full deterministic equality.

Keep fixtures local and explicit. Do not add a generic scenario framework or move existing unit-test helpers.

All players assigned to completed picks must also exist in the scenario ranking snapshot so roster derivation and observed-pick behavior use realistic typed data. Give drafted filler players low enough ranking value that their exact rank does not affect available recommendation ordering.

## Scenario 1: Heavy RB Start

### Setup

- Use default roster settings.
- Give the user ten drafted RBs, filling the configured RB starter, FLEX, and useful bench capacity for RB.
- Complete enough opponent picks to keep the draft state internally consistent and place the draft before the late-phase threshold.
- Available candidates must include:
  - `elite-rb` at overall rank `1`.
  - `ordinary-rb` at overall rank `17`.
  - `needed-wr` at overall rank `18`.
  - At least three additional nearby WRs in the next 24 ranks so `needed-wr` is not relying on scarcity credit.
- Keep available candidate tiers flat enough that tier pressure is not the cause of the asserted ordering.

### Assertions

- `needed-wr` ranks above `ordinary-rb` despite the ordinary RB's slightly better base rank.
- `needed-wr` includes `roster_fit:direct_starter_need`.
- `ordinary-rb` has a negative `roster_fit` component with saturation evidence.
- `elite-rb` remains above `needed-wr` because the large base-value gap remains visible.
- When returned within the requested limit, `elite-rb` includes the saturation caveat `roster_fit:saturated`.
- No drafted RB or opponent filler appears in recommendations.
- Repeated calls with the same input return identical full output.

Use a recommendation limit large enough to include all named candidates needed for relative assertions.

## Scenario 2: Heavy WR Start

### Setup

- Mirror the heavy-RB scenario using ten drafted WRs.
- Available candidates must include:
  - `elite-wr` at overall rank `1`.
  - `ordinary-wr` at overall rank `17`.
  - `needed-rb` at overall rank `18`.
  - At least three additional nearby RBs in the next 24 ranks so `needed-rb` is not relying on scarcity credit.
- Keep available candidate tiers flat enough that tier pressure is not the cause of the asserted ordering.

### Assertions

- `needed-rb` ranks above `ordinary-wr`.
- `needed-rb` includes `roster_fit:direct_starter_need`.
- `ordinary-wr` has a negative `roster_fit` component with saturation evidence.
- `elite-wr` remains above `needed-rb`.
- When returned within the requested limit, `elite-wr` includes `roster_fit:saturated`.
- No drafted player appears in recommendations.
- Repeated calls return identical full output.

## Scenario 3: QB Timing And Filled-Slot Behavior

Use three related typed draft states with default single-QB roster settings. Keep QB and RB comparison tiers and nearby positional depth flat so tier and scarcity do not determine the assertions.

### Early State

- The user has no QB and has drafted a small balanced RB/WR core.
- `elite-rb` is overall rank `1`.
- `early-qb` is overall rank `40`.
- Include at least three nearby available QBs after `early-qb`.

Assertions:

- `elite-rb` remains above `early-qb`; the open QB slot does not overcome a large base-value gap.
- If `early-qb` is returned within the requested limit, its reason may identify the open QB starter slot but must not make an opponent prediction.

### Middle State

- Advance to a middle-round draft state without drafting a QB.
- Fill the user's direct RB and WR starter slots so additional RB/WR candidates receive FLEX or depth treatment.
- Compare `middle-qb` at overall rank `30` with `middle-rb` at overall rank `29`.
- Include at least three nearby available QBs and RBs to neutralize scarcity.

Assertions:

- `middle-qb` ranks above the similarly ranked `middle-rb`.
- `middle-qb` includes `roster_fit:direct_starter_need`.
- The reason text is exactly `Fills an open QB starter slot.`

### Filled-QB State

- Start from the middle state and add one drafted user QB.
- Compare `backup-qb` at overall rank `30` with `depth-rb` at overall rank `31`.
- Include nearby QB and RB depth to neutralize scarcity and tier pressure.

Assertions:

- `depth-rb` ranks above `backup-qb` after the required QB slot is filled.
- `backup-qb` has a negative `roster_fit` component with `limited_need` timing.
- When returned within the requested limit, `backup-qb` includes `roster_fit:limited_need` as its final caveat.
- No drafted QB appears in recommendations.

For all three states, repeated calls must produce identical ordering and reasons.

## Implementation Steps

1. Review only the active scenario context.
   - Read `docs/current-slice.md`.
   - Read Task 9 in `docs/tasks.md`.
   - Read the Scenario Validation section of `docs/design/recommendation-engine.md`.
   - Read the Recommendation Engine section of `docs/testing.md`.
   - Read the public recommendation entry point and the existing recommendation-test fixture style.

2. Create `src/lib/recommendations.scenario.test.ts`.
   - Import only public domain/test helpers already used by recommendation tests.
   - Add the small local fixture and assertion helpers described above.
   - Keep scenario data compact and named for the behavior it represents.

3. Add the heavy RB scenario.
   - Construct the complete typed ranking snapshot and draft state.
   - Assert elite-value preservation, needed-WR promotion, RB saturation evidence/caveat, availability, and determinism.

4. Add the heavy WR scenario.
   - Mirror the meaningful heavy-RB assertions without abstracting the scenario into unreadable parameterized data.
   - Assert needed-RB promotion, WR saturation, elite-value preservation, availability, and determinism.

5. Add the QB timing scenario.
   - Add explicit early, middle, and filled-QB states.
   - Assert the specified relative ordering, component evidence, reason ids/text, availability, and determinism.

6. Run validation.
   - Run `npm test -- src/lib/recommendations.scenario.test.ts`.
   - Run `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts`.
   - Run `npm run lint`.
   - Fix only failures caused by the scenario fixtures or assertions.
   - If a correctly constructed scenario contradicts the approved behavior, stop and report it rather than changing production scoring.

7. Stop after this Task 9 slice.
   - Do not add urgency, late-draft, dynamic-roster, persistence, or workflow scenarios.
   - Do not update task status or begin the next Task 9 slice automatically.

## Acceptance Criteria

- Heavy RB and heavy WR scenarios prove roster need can reorder close ranking values.
- Both heavy-position scenarios prove elite base value remains visible despite saturation.
- Saturation and open-starter reasons trace to the expected `roster_fit` component evidence.
- The early QB scenario proves an open QB slot does not overcome a large base-value gap.
- The middle QB scenario proves a comparable QB can rise when its starter slot remains open.
- The filled-QB scenario proves an ordinary backup QB falls after the required slot is solved.
- Every scenario recommendation contains only available players.
- Identical scenario inputs produce identical ordering, scores, components, and reasons.
- Assertions focus on observable ordering and reasons rather than duplicating all internal score arithmetic.
- No production recommendation code, tuning, UI, persistence, or draft behavior is changed.

## Suggested Tests

- Scenario test for a heavy RB start.
- Scenario test for a heavy WR start.
- Scenario test for early QB restraint.
- Scenario test for middle-round QB need.
- Scenario test for backup-QB de-emphasis after filling the starter.
- Availability invariant assertion in every scenario.
- Full-output determinism assertion in every scenario.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.scenario.test.ts
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
npm run lint
```

## Follow-Up Task 9 Slices

Do not implement these in the current slice:

1. Urgency scenarios: positional run and tier cliff.
2. Late-roster scenarios: starter positions filled, bench depth, and late-round DEF/K.
3. Boundary scenarios: dynamic roster configuration and persisted-draft parity where practical.

## Slice Review

- Smallest meaningful increment: yes. It validates one coherent behavior family: core roster construction and QB timing.
- Concrete enough for implementation: yes. Draft states, candidate ranks, neutralized confounders, relative assertions, reasons, invariants, and validation commands are specified.
- Avoids unnecessary architecture changes: yes. It adds scenario tests only and explicitly forbids production tuning.
- Blast radius reasonable: yes. The implementation should add one dedicated test file.
- Review/revert comfort: yes. The slice is isolated validation coverage with no production changes.
- Observable/testable acceptance criteria: yes. Ordering, evidence, reasons, availability, and determinism are directly asserted.
