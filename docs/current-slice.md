# Current Slice - Phase 5.5 Bug Fix: Prevent Same-Position Draft-Pocket Quality Inversions

## Status

Planned. Awaiting implementation and validation.

## Context

Phase 5.5 exit validation exposed a draft-pocket scoring inversion in the default rankings:

- Justin Jefferson is overall rank 9, ADP 10, WR6, overall/source tier 2.
- Drake London is overall rank 11, ADP 18, WR7, overall/source tier 2.
- The shared forecast can remove Jefferson while retaining London and one lower-tier WR.
- London then counts as a comparable replacement for Jefferson, giving Jefferson high skip safety and no timing bonus.
- Jefferson cannot count as a replacement for London after leaving the forecasted pocket, so London can receive medium skip safety and a `+3` timing bonus.
- Their base-score gap is about two points, allowing the lower-ranked London to outrank the available higher-ranked Jefferson solely through draft-pocket timing.

The candidate-level forecast observations are internally consistent, but using them directly for both same-position candidates creates a circular recommendation: London makes Jefferson safe to skip, then London is rewarded because Jefferson is forecasted to disappear.

This bug fix temporarily replaces the Task 13 exit-validation slice. Task 13 remains incomplete and resumes after this regression is fixed.

## Goal

Prevent draft-pocket timing from boosting a lower-ranked candidate while a higher-ranked candidate at the same position is currently available, while preserving candidate forecast analysis, player-quality scoring, deterministic forecast construction, and timing behavior for the best currently available option at each position.

## Approved Rule

Draft-pocket timing is eligible only for the highest-ranked candidate at a position within the current draft pocket.

Candidate replacement quality and skip safety remain objective, candidate-specific forecast observations for every current-pocket candidate. A lower-ranked same-position candidate retains those observations for inspection but receives a neutral `draft_pocket_timing` score while the higher-ranked option is available.

Use overall rank followed by stable player ID to identify the highest-ranked current-pocket option at a position, matching existing deterministic board ordering. Do not compare ADP, projected removal order, score, or roster context when selecting that option.

## Scope

### Goals

- Expose whether each candidate is the highest-ranked current-pocket option at their position as deterministic candidate-signal evidence.
- Keep replacement counts, replacement quality, skip safety, profile transitions, and forecasted-pocket presence unchanged.
- Make `draft_pocket_timing` neutral for a current-pocket candidate when a higher-ranked same-position candidate is also in the current pocket.
- Preserve low and medium skip-safety deltas for the highest-ranked current-pocket candidate at each eligible position.
- Suppress draft-pocket reasons when timing is neutralized by the same-position quality guard.
- Reproduce the Jefferson/London inversion and prove Jefferson remains ordered above London.
- Prove London becomes timing-eligible after Jefferson is drafted or otherwise unavailable.

### Non-goals

- Do not change Drake London’s or Justin Jefferson’s rank, ADP, tier, or source data.
- Do not change forecast removal order, current/forecast pocket construction, replacement windows, replacement thresholds, or skip-safety categories.
- Do not make per-candidate forecasts or simulate drafting a candidate.
- Do not add a final-sort override, hidden score adjustment, or hard-coded player/position exception.
- Do not retune base value, timing deltas, urgency caps, context caps, roster fit, scarcity, run pressure, tier pressure, or overall-tier scoring.
- Do not change reason wording, scenario contracts, persistence, ranking normalization, or UI behavior.
- Do not resume the broader Task 13 exit-validation matrix in this slice.

## Implementation Steps

1. Extend `CandidatePocketSignal` in `src/types/draft.ts` with an explicit boolean indicating whether the candidate is the highest-ranked current-pocket option at their position. Keep the field required so every signal state is inspectable and no caller silently bypasses the rule.
2. In `src/lib/draftPocketForecast.ts`, derive the boolean from the already-resolved current-pocket rankings using overall rank and stable player ID. Populate it for active, neutral-forecast, and outside-current-pocket signal results without changing any existing replacement or skip-safety calculation.
3. In `calculateDraftPocketTimingComponent` in `src/lib/recommendations.ts`, check the new eligibility evidence after active-forecast, current-pocket, and supported-position checks but before mapping skip safety to a delta. When the candidate is not the highest-ranked current-pocket option at the position:
   - emit delta `0`;
   - use a deterministic threshold such as `higher_ranked_same_position_available`;
   - retain the candidate’s raw replacement and skip-safety evidence;
   - include the new eligibility boolean in component evidence.
4. Keep reason generation unchanged except for relying on the new neutral threshold. Existing low/medium draft-pocket reasons must not be emitted for a component neutralized by the guard.
5. Update `src/lib/draftPocketForecast.test.ts` to prove:
   - the highest-ranked current-pocket candidate at a position is marked eligible;
   - a lower-ranked same-position candidate is marked ineligible even when its raw skip safety is medium or low;
   - stable player ID resolves an otherwise tied overall rank deterministically;
   - removing the higher-ranked candidate makes the next-ranked option eligible;
   - replacement counts, skip safety, profile transitions, and neutral forecast behavior remain unchanged.
6. Update `src/lib/recommendations.test.ts` with the reported regression using the default ranking facts for Jefferson (rank 9, ADP 10, tier 2) and London (rank 11, ADP 18, tier 2), plus the lower-tier WR needed to create the asymmetric forecast:
   - Jefferson has high raw skip safety because London is a comparable replacement and another WR is near;
   - London has medium raw skip safety but is not the highest-ranked current-pocket WR;
   - London’s timing component is neutral with the same-position guard threshold and produces no draft-pocket reason;
   - Jefferson remains ordered above London and every score reconciles exactly;
   - after Jefferson is unavailable, London is the highest-ranked current-pocket WR and receives the approved timing delta when his skip safety is low or medium.
7. Preserve direct timing-component tests for active/inactive forecasts, pocket membership, eligible positions, and low/medium/high skip safety. Add the new boolean to their fixtures and add an exact neutralization test for a lower-ranked same-position candidate.
8. Run focused validation:

   ```powershell
   npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts src/lib/scenarioSession.test.ts src/components/DraftRoom.test.tsx
   npx tsc --noEmit
   npm run lint
   git diff --check
   ```

9. Manually reproduce the original ranking state in the Draft Room. Confirm Jefferson remains above London, London shows no score-backed draft-pocket reason while Jefferson is available, and London becomes timing-eligible after Jefferson leaves the available pool.
10. After validation passes, add completion notes to this file. Do not mark Task 13 complete and do not begin the remaining exit-validation work.

## Expected Files

- `src/types/draft.ts`
- `src/lib/draftPocketForecast.ts`
- `src/lib/draftPocketForecast.test.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `docs/current-slice.md` for completion notes

Expected production/test blast radius: five code and test files. The slice document is the only documentation file expected to change.

## Acceptance Criteria

- With Jefferson and London available in the reported forecast state, London retains medium raw skip safety but receives exactly `0` draft-pocket timing points.
- Jefferson remains ordered above London when the only previous reason for inversion was London’s larger draft-pocket timing delta.
- London emits no draft-pocket timing reason while the same-position quality guard neutralizes the component.
- The highest-ranked current-pocket option at each eligible position continues to receive exactly `+6`, `+3`, or `0` for low, medium, or high skip safety.
- When the higher-ranked same-position player becomes unavailable, the next-ranked current-pocket candidate becomes timing-eligible without special-case logic.
- Candidate replacement counts, replacement quality, skip safety, forecast membership, profile transitions, pocket construction, and forecast removal order are unchanged.
- Overall rank then stable player ID selects the eligible same-position candidate deterministically.
- Overall-tier, roster-fit, tier-pressure, scarcity, run-pressure, value-opportunity, urgency-cap, context-cap, ordering, and score-reconciliation behavior remain unchanged.
- Neutralized timing evidence cannot generate a positive draft-pocket reason.
- Identical draft and ranking inputs continue to produce exact equivalent signals, components, scores, reasons, and ordering.
- Focused tests, TypeScript validation, lint, manual reproduction, and `git diff --check` pass with no new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- enforcing the rule requires a final-sort override or a score that no longer reconciles from components and adjustments;
- the guard requires changing candidate replacement, skip-safety, forecast, pocket, ADP, or overall-tier semantics;
- correct reason behavior requires new user-facing wording rather than suppressing a neutral component;
- the Jefferson/London case cannot be reproduced from deterministic fixture inputs;
- validation exposes an unrelated failure or requires changes outside the expected files.

## Slice Review

1. Smallest meaningful increment: yes - it fixes one observed scoring inversion without resuming general exit validation.
2. Executable without redefining the approach: yes - eligibility, ordering keys, evidence, scoring behavior, regression inputs, and validation are explicit.
3. Avoids unnecessary architecture changes: yes - it adds one fact to the existing candidate signal and one scoring eligibility check.
4. Reasonable blast radius: yes - two production files, one shared type, and two focused test files.
5. Comfortably reviewable and revertible: yes - the guard is isolated from forecast and replacement calculations.
6. Observable and testable acceptance criteria: yes - exact component deltas, thresholds, reasons, ordering, and post-removal eligibility are deterministic.

## Follow-up

After this bug-fix slice passes, restore and execute Task 13: Complete Phase 5.5 Regression and Exit Validation, including the same-position quality invariant in its regression matrix.
