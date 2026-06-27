# Current Slice: Add Recommendation Urgency Scenario Validation

## Source Task

Task 9: Add Recommendation Scenario Validation.

This is the second Task 9 slice. The first slice covered heavy RB, heavy WR, and QB timing. This slice covers positional runs and tier cliffs.

## Goal

Add deterministic scenario tests proving that observed positional runs and meaningful tier cliffs can reorder close player values without overriding roster relevance or elite base value.

This is a validation-only slice. Production scoring and tuning must remain unchanged.

## Confidence Increment

- A five-pick positional run can raise a roster-relevant candidate above a close peer and produce an observed-run reason.
- The same run pressure has no scoring or explanation effect when the position is solved.
- A major tier cliff can move the last useful player above a close alternative while an elite player remains ahead.

## Current Context

The Recommendation Engine already provides:

- Positive-only `positional_run` deltas of `+2` or `+4` based on recent completed picks.
- Roster relevance gating for run pressure.
- Positive-only `tier_cliff` pressure based on remaining tier depth and tier gap.
- A shared urgency cap across tier, scarcity, and run pressure.
- Deterministic, score-backed reasons for meaningful run and tier components.
- Focused unit coverage for thresholds, caps, evidence, and reason selection.

`src/lib/recommendations.scenario.test.ts` already contains local typed fixture helpers, availability assertions, full-output determinism assertions, and core roster-construction scenarios. Extend that file rather than creating a second scenario framework.

## Scope

### Goals

- Add an active positional-run scenario.
- Add a solved-position run scenario.
- Add a major tier-cliff scenario.
- Assert important relative ordering rather than complete score snapshots.
- Assert the exact component evidence and score-backed reason ids that explain urgency behavior.
- Assert drafted players remain unavailable.
- Assert identical inputs produce identical ordering, scores, components, and reasons.
- Keep production recommendation code unchanged.

### Non-Goals

- Changing run, scarcity, tier, roster-fit, value, or base-score formulas.
- Changing urgency caps, modifier thresholds, reason thresholds, or reason text.
- Adding opponent prediction or claiming a run will continue.
- Adding starter-filled, bench-depth, late-round DEF/K, or dynamic-roster scenarios.
- Adding persistence parity or workflow integration.
- Refactoring scenario helpers into shared test infrastructure.
- Updating `docs/tasks.md` or any documentation other than `docs/current-slice.md`.

If a correctly constructed scenario contradicts the approved design, stop and report the discrepancy. Do not change production scoring inside this validation-only slice.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.scenario.test.ts`

Do not modify `src/lib/recommendations.ts`, `src/lib/recommendations.test.ts`, application types, UI, or persistence files.

## Fixture Guidance

- Reuse the existing local helpers in `src/lib/recommendations.scenario.test.ts`.
- Add only small helper adjustments if an explicit recent-pick sequence cannot be represented clearly with the current helper.
- Continue using a two-team snake draft and typed ranking entries for every completed pick.
- Keep all available comparison players in explicit small ranking snapshots.
- Give drafted filler players low ranking value so they cannot affect available ordering.
- Use flat same-position tiers and at least three nearby same-position options whenever tier or scarcity should be neutralized.
- Use a recommendation limit large enough to include every named player used in relative assertions.
- Every scenario must use the existing deterministic generator helper so full output and availability are checked automatically.

## Scenario 1: Active Five-Pick WR Run

### Setup

- Use default roster slots and a two-team, 16-round draft.
- Complete 12 picks so `currentPickNumber` is `13`.
- Give the user:
  - two drafted RBs;
  - one drafted TE;
  - three drafted WRs.
- Arrange picks `8` through `12` as five consecutive WR selections across both teams.
- Available comparison players:
  - `control-rb` at overall rank `19`;
  - `run-wr` at overall rank `20`.
- Add three nearby available RBs and three nearby available WRs in the next 24 ranks.
- Keep all available RB and WR candidates in a flat tier so tier pressure is neutral.

This roster shape leaves both RB and WR relevant through the remaining FLEX opening, while only WR receives the observed-run modifier.

### Assertions

- `run-wr` ranks above the slightly higher-ranked `control-rb`.
- Both comparison players have the same positive FLEX roster-fit delta, proving roster fit is not the ordering difference.
- `run-wr` has a `positional_run` component with:
  - `delta: 4`;
  - `direction: "positive"`;
  - `recentPositionPickCount: 5`;
  - `thresholdMatched: "clear_run"`.
- `control-rb` has a neutral `positional_run` component.
- `run-wr` includes reason id `positional_run:clear_run`.
- Its reason text reports observed picks only and contains no claim about opponents or future availability.
- Drafted players are excluded and repeated output is identical.

## Scenario 2: Run Pressure At A Solved Position

### Setup

- Give the user ten drafted WRs, filling configured WR starter, FLEX, and useful bench capacity.
- Complete 20 picks and make at least five of the most recent 12 completed picks WR selections.
- Use WR rankings for all recent run picks so the observed count is fully known.
- Available comparison players:
  - `solved-wr` at overall rank `20`;
  - `needed-rb` at overall rank `21`.
- Add three nearby WRs and three nearby RBs with flat tiers to neutralize scarcity and tier pressure.

### Assertions

- `needed-rb` ranks above `solved-wr`.
- `solved-wr` has a negative `roster_fit` component with saturation evidence.
- `solved-wr` has a neutral `positional_run` component with:
  - `delta: 0`;
  - a recent WR count of at least `5`;
  - `thresholdMatched: "roster_irrelevant"`.
- `solved-wr` does not include a `positional_run` reason.
- Its final caveat is `roster_fit:saturated` when returned within the requested limit.
- Drafted players are excluded and repeated output is identical.

## Scenario 3: Major Tier Cliff With Elite Guardrail

### Setup

- Give the user a balanced early roster with two drafted RBs and two drafted WRs.
- Use opponent filler positions that do not create an RB or WR run.
- Available candidates:
  - `elite-wr` at overall rank `1`;
  - `control-wr` at overall rank `19`;
  - `tier-rb` at overall rank `20`, tier `1`;
  - `next-tier-rb` at overall rank `35`, tier `3`.
- Add at least three nearby available WRs in tier `1` so `control-wr` has neither scarcity nor tier pressure.
- Do not add another tier-1 RB, making `tier-rb` the last available RB in its tier before a multi-tier drop.

Both `tier-rb` and `control-wr` should receive comparable positive FLEX roster fit. The tier cliff is the intended contextual difference.

### Assertions

- `tier-rb` ranks above the slightly higher-ranked `control-wr`.
- `elite-wr` remains above `tier-rb`.
- `tier-rb` has a `tier_cliff` component with:
  - `delta: 12`;
  - `direction: "positive"`;
  - `sameTierRemaining: 1`;
  - `tierGap: 2`;
  - `thresholdMatched: "major_tier_cliff"`.
- `control-wr` has a neutral `tier_cliff` component.
- `tier-rb` includes reason id `tier_cliff:major_tier_cliff` with text `A major RB tier drop follows.`
- The reason makes no prediction about a specific opponent or future pick.
- Drafted players are excluded and repeated output is identical.

## Implementation Steps

1. Review the active validation context.
   - Read `docs/current-slice.md`.
   - Read Task 9 in `docs/tasks.md`.
   - Read the Positional Run and Tier Cliff scenarios in `docs/design/recommendation-engine.md`.
   - Read the existing `src/lib/recommendations.scenario.test.ts` helpers and scenarios.

2. Extend `src/lib/recommendations.scenario.test.ts`.
   - Add a new `describe("recommendation urgency scenarios", ...)` block.
   - Reuse the current ranking, draft, input, ordering, availability, determinism, and component helpers.
   - Add a small generic component lookup helper only if it materially reduces repeated assertions.

3. Add the active-run scenario.
   - Construct the explicit 12-pick sequence described above.
   - Neutralize tier and scarcity for both comparison positions.
   - Assert relative ordering, equal roster fit, run evidence, reason content, availability, and determinism.

4. Add the solved-run scenario.
   - Construct the saturated WR roster and recent WR run.
   - Assert the run is observed in evidence but gated to zero by roster relevance.
   - Assert no run reason is emitted and the saturation caveat remains visible.

5. Add the tier-cliff scenario.
   - Construct the last-tier RB, close WR peer, and elite WR guardrail.
   - Assert relative ordering, exact tier evidence, exact reason text, availability, and determinism.

6. Run validation.
   - Run `npm test -- src/lib/recommendations.scenario.test.ts`.
   - Run `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts`.
   - Run `npm run lint`.
   - Fix only fixture or assertion failures caused by this slice.
   - If correct scenario data reveals a product contradiction, stop and report it without changing production scoring.

7. Stop after this Task 9 slice.
   - Do not add late-roster, dynamic-configuration, persistence, or workflow scenarios.
   - Do not check off Task 9 or begin the next slice automatically.

## Acceptance Criteria

- A five-pick WR run reorders two close, equally roster-relevant candidates.
- Active run pressure exposes the correct component evidence and observed-run reason.
- A known run at a solved position produces no score or reason credit.
- A major tier cliff moves the last useful RB above a close WR peer.
- The tier-cliff reason traces to the exact tier component evidence.
- Neither run nor tier urgency moves the contextual candidate above an elite player when the base-value gap is large.
- No reason predicts opponent behavior or future picks.
- Every scenario recommendation contains only available players.
- Identical inputs produce identical ordering, scores, components, and reasons.
- Production recommendation code and tuning remain unchanged.

## Suggested Tests

- Scenario test for an active five-pick WR run.
- Scenario test for a run at a solved WR position.
- Scenario test for a major RB tier cliff with a close peer and elite guardrail.
- Availability invariant assertion in every scenario.
- Full-output determinism assertion in every scenario.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.scenario.test.ts
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
npm run lint
```

## Remaining Task 9 Slices

Do not implement these in the current slice:

1. Late-roster scenarios: starter positions filled, bench depth, and late-round DEF/K.
2. Boundary scenarios: dynamic roster configuration and persisted-draft parity where practical.

## Slice Review

- Smallest meaningful increment: yes. It validates one coherent behavior family: recommendation urgency.
- Concrete enough for implementation: yes. Pick sequence, roster shape, candidate ranks, confounder controls, component evidence, reasons, and relative ordering are specified.
- Avoids unnecessary architecture changes: yes. It extends scenario coverage only and forbids production tuning.
- Blast radius reasonable: yes. Implementation changes remain in one existing scenario test file.
- Review/revert comfort: yes. The slice is isolated validation with no production behavior changes.
- Observable/testable acceptance criteria: yes. Ordering, evidence, reasons, availability, guardrails, and determinism are directly asserted.
