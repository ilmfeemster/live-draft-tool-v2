# Current Slice: Add Late-Roster Recommendation Scenarios

## Source Task

Task 9: Add Recommendation Scenario Validation.

This is the third Task 9 slice. Earlier slices covered core roster construction, QB timing, positional runs, and tier cliffs. This slice covers filled starters, bench depth, and late-round DEF/K behavior.

## Goal

Add deterministic scenario tests proving that the Recommendation Engine distinguishes FLEX capacity, useful bench depth, and late required DEF/K slots without encouraging low-impact backups.

This is a validation-only slice. Production scoring, tuning, and reason mappings must remain unchanged.

## Confidence Increment

- Filled direct RB/WR starters remain relevant while FLEX capacity is open, while an ordinary backup QB is de-emphasized.
- Once starters and FLEX capacity are consumed, useful RB/WR depth rises above low-impact single-starter backups.
- Empty DEF/K starter slots become valid late-round needs.
- After DEF/K slots are filled, backup DEF/K recommendations drop below useful depth.

## Current Context

The completed Recommendation Engine provides these roster-fit states:

- `direct_starter_need` for open required slots.
- `flex_need` for eligible positions while configured FLEX capacity remains.
- `bench_depth` for useful RB/WR/TE depth after FLEX is consumed and bench capacity remains.
- `limited_need` for low-value backups, including ordinary backup QB, DEF, and K.
- `early_def_k` to suppress DEF/K before the configured late phase.

`src/lib/recommendations.scenario.test.ts` already has local typed fixture helpers plus automatic availability and full-output determinism assertions. Extend that file rather than creating another fixture system.

## Scope

### Goals

- Add a filled-direct-starters scenario with FLEX capacity still open.
- Add a bench-depth scenario after configured FLEX capacity is consumed.
- Add a late-round scenario with empty DEF/K starter slots.
- Add the corresponding late-round state after DEF/K are filled.
- Assert important relative ordering, roster-fit component evidence, and score-backed reason ids.
- Assert drafted players remain unavailable.
- Assert identical inputs produce identical ordering, scores, components, and reasons.
- Keep production recommendation code unchanged.

### Non-Goals

- Changing roster slot analysis, draft-phase thresholds, score deltas, caps, or reason text.
- Adding dynamic roster configuration; that belongs in the final Task 9 boundary slice.
- Adding persisted-draft parity or workflow integration.
- Adding UI tests or manual QA.
- Testing every possible bench composition.
- Using full seed rankings or CSV data.
- Refactoring scenario helpers into shared infrastructure.
- Updating `docs/tasks.md` or any documentation other than `docs/current-slice.md`.

If a correctly constructed scenario contradicts the approved design, stop and report the discrepancy. Do not change production scoring inside this validation-only slice.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.scenario.test.ts`

Do not modify `src/lib/recommendations.ts`, `src/lib/recommendations.test.ts`, application types, UI, or persistence files.

## Fixture Guidance

- Reuse the existing local ranking, draft, input, recommendation, component, availability, and determinism helpers.
- Continue using two-team, 16-round snake drafts and default roster slots.
- Provide typed ranking entries for every completed pick.
- Keep comparison candidates close in overall rank so roster context—not a large base-value gap—determines ordering.
- Add at least three nearby same-position options and flat tiers whenever scarcity and tier pressure should be neutralized.
- Arrange completed picks so no unintended five-pick run affects a comparison candidate.
- Use recommendation limits large enough to include every named player used in assertions.
- Avoid exact total-score snapshots; assert relative ordering and the component evidence responsible for it.

## Scenario 1: Direct Starters Filled, FLEX Open

### Setup

- Complete 12 picks so `currentPickNumber` is `13`.
- Give the user exactly:
  - one QB;
  - two RBs;
  - two WRs;
  - one TE.
- Keep both configured FLEX slots open.
- Available comparison players:
  - `backup-qb` at overall rank `18`;
  - `flex-rb` at overall rank `19`;
  - `flex-wr` at overall rank `20`.
- Add three nearby RBs and three nearby WRs with flat tiers.
- Use opponent filler positions that do not create an RB, WR, or QB run.

### Assertions

- `flex-rb` and `flex-wr` both rank above the slightly higher-ranked `backup-qb`.
- `flex-rb` and `flex-wr` each have `roster_fit`:
  - `delta: 5`;
  - `direction: "positive"`;
  - `timing: "flex_need"`.
- Both FLEX candidates include reason id `roster_fit:flex_need`.
- `backup-qb` has `roster_fit`:
  - `delta: -6`;
  - `direction: "negative"`;
  - `timing: "limited_need"`.
- `backup-qb` includes `roster_fit:limited_need` as its final caveat when returned.
- Drafted players are excluded and repeated output is identical.

## Scenario 2: Useful Bench Depth

### Setup

- Complete 22 picks so `currentPickNumber` is `23`.
- Give the user an 11-player roster containing:
  - one QB;
  - three RBs;
  - three WRs;
  - two TEs;
  - one DST;
  - one K.
- This roster fills all direct starters, consumes both FLEX slots through eligible surplus, and leaves bench capacity.
- Available comparison players:
  - `backup-dst` at overall rank `28`;
  - `backup-qb` at overall rank `29`;
  - `bench-rb` at overall rank `30`;
  - `bench-wr` at overall rank `31`.
- Add three nearby RBs and three nearby WRs with flat tiers.

### Assertions

- `bench-rb` and `bench-wr` both rank above `backup-qb` and `backup-dst` despite their lower base ranks.
- `bench-rb` and `bench-wr` each have `roster_fit`:
  - `delta: 3`;
  - `direction: "positive"`;
  - `timing: "bench_depth"`.
- Both include reason id `roster_fit:bench_depth`.
- `backup-qb` and `backup-dst` each have negative `roster_fit` with `timing: "limited_need"`.
- At least one returned backup includes the matching limited-need caveat.
- Drafted players are excluded and repeated output is identical.

## Scenario 3: Late Empty DEF/K Slots

### Setup

- Complete 22 picks so `currentPickNumber` is `23`, which is beyond the late-phase threshold in a 32-pick two-team draft.
- Give the user an 11-player roster with:
  - one QB;
  - four RBs;
  - four WRs;
  - two TEs;
  - no DST;
  - no K.
- Available comparison players:
  - `extra-rb` at overall rank `28`;
  - `needed-dst` at overall rank `29`;
  - `needed-k` at overall rank `30`.
- Add three nearby RBs with a flat tier.

### Assertions

- `needed-dst` and `needed-k` both rank above the slightly higher-ranked `extra-rb`.
- Both DEF/K candidates have `roster_fit`:
  - `delta: 10`;
  - `direction: "positive"`;
  - `timing: "direct_starter_need"`.
- Their reasons include `roster_fit:direct_starter_need` with exact text:
  - `Fills an open DST starter slot.`
  - `Fills an open K starter slot.`
- `extra-rb` has positive `bench_depth` rather than a penalty, proving DEF/K win because required slots remain open.
- Drafted players are excluded and repeated output is identical.

## Scenario 4: DEF/K Filled, Backups De-Emphasized

### Setup

- Start from the late roster shape above and add one drafted DST and one drafted K.
- Complete 26 picks so `currentPickNumber` is `27`.
- Available comparison players:
  - `backup-dst` at overall rank `29`;
  - `backup-k` at overall rank `30`;
  - `depth-rb` at overall rank `31`.
- Add three nearby RBs with a flat tier.

### Assertions

- `depth-rb` ranks above both higher-ranked DEF/K backups.
- `depth-rb` has positive `bench_depth` roster fit and the matching reason.
- `backup-dst` and `backup-k` each have `roster_fit`:
  - `delta: -6`;
  - `direction: "negative"`;
  - `timing: "limited_need"`.
- Both backups include `roster_fit:limited_need` as their final caveat when returned.
- The drafted DST and K do not appear in recommendations.
- Repeated output is identical.

## Implementation Steps

1. Review the active validation context.
   - Read `docs/current-slice.md`.
   - Read Task 9 in `docs/tasks.md`.
   - Read the Starter Positions Filled, Bench Depth Decisions, and Late-Round DEF/K sections of `docs/design/recommendation-engine.md`.
   - Read the existing scenario helpers and tests in `src/lib/recommendations.scenario.test.ts`.

2. Extend `src/lib/recommendations.scenario.test.ts`.
   - Add a new `describe("late-roster recommendation scenarios", ...)` block.
   - Reuse existing helpers without creating a generic scenario framework.
   - Add only small local fixture helpers if they remove repeated setup without hiding roster composition.

3. Add the filled-starters/FLEX-open scenario.
   - Construct the six-player user roster and close QB/RB/WR candidates.
   - Neutralize tier, scarcity, and run pressure.
   - Assert relative ordering, FLEX evidence, limited-QB evidence/caveat, availability, and determinism.

4. Add the bench-depth scenario.
   - Construct the 11-player roster that consumes FLEX and leaves bench space.
   - Assert useful RB/WR depth above backup QB/DST.
   - Assert exact bench-depth and limited-need evidence and reasons.

5. Add the two late DEF/K states.
   - First prove empty required DEF/K slots outrank close extra depth after the late threshold.
   - Then fill both slots and prove useful RB depth outranks both backups.
   - Assert exact roster-fit evidence, reasons, availability, and determinism in both states.

6. Run validation.
   - Run `npm test -- src/lib/recommendations.scenario.test.ts`.
   - Run `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts`.
   - Run `npm run lint`.
   - Fix only fixture or assertion failures caused by this slice.
   - If correct scenario data reveals a product contradiction, stop and report it without changing production scoring.

7. Stop after this Task 9 slice.
   - Do not add dynamic-configuration, persistence, UI, or workflow scenarios.
   - Do not check off Task 9 or begin the final Task 9 slice automatically.

## Acceptance Criteria

- Filled direct starters remain recommendation-relevant through configured FLEX slots.
- Ordinary backup QB is de-emphasized when the required QB slot is filled.
- Useful RB/WR bench depth outranks low-impact backup QB/DST candidates after FLEX is consumed.
- Empty DEF/K starter slots become positive needs after the late threshold.
- Once DEF/K slots are filled, their backups fall below useful depth.
- All asserted reasons trace to the expected roster-fit evidence.
- Every scenario recommendation contains only available players.
- Identical inputs produce identical ordering, scores, components, and reasons.
- Production recommendation code and tuning remain unchanged.

## Suggested Tests

- Scenario test for filled direct starters with FLEX open.
- Scenario test for useful bench depth after FLEX is consumed.
- Scenario test for late missing DEF/K starters.
- Scenario test for backup DEF/K after both slots are filled.
- Availability invariant assertion in every scenario.
- Full-output determinism assertion in every scenario.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.scenario.test.ts
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
npm run lint
```

## Remaining Task 9 Slice

Do not implement this in the current slice:

- Boundary scenarios: dynamic roster configuration and persisted-draft parity where practical.

## Slice Review

- Smallest meaningful increment: yes. It validates one coherent behavior family: late roster construction and required-slot timing.
- Concrete enough for implementation: yes. Roster counts, draft phases, candidate ranks, confounder controls, component evidence, reasons, and relative ordering are specified.
- Avoids unnecessary architecture changes: yes. It extends scenario coverage only and forbids production tuning.
- Blast radius reasonable: yes. Implementation changes remain in one existing scenario test file.
- Review/revert comfort: yes. The slice is isolated validation with no production behavior changes.
- Observable/testable acceptance criteria: yes. Ordering, evidence, reasons, availability, phase behavior, and determinism are directly asserted.
