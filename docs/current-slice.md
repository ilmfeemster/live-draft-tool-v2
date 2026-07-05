# Current Slice - Task 15: Integrate Profile-Backed Reasons and Corrective Workflow Regressions

## Status

In progress. Implementation and automated validation completed on 2026-07-05. Required manual Draft Room QA is blocked by the unavailable in-app browser connection.

## Context

Tasks 13-14 replaced candidate-relative draft-pocket timing with shared position/overall-tier profile transitions and monotonic full/reduced allocation. The Recommendation Engine now emits profile identity, anchor, ordinal, allocation role, shared replacement counts, skip safety, and disappearance observations in each `draft_pocket_timing` component.

The existing reason mapper still recognizes only the older subset of timing evidence. It currently relies on component direction, forecast status, current-pocket membership, candidate position, skip safety, and threshold. Task 15 closes the corrective work by requiring valid profile-backed allocation evidence before producing a reason and proving that derived output recomputes across persisted and transient workflows.

Reason wording does not need redesign. Existing language already describes future position/profile options rather than exact-player availability. This slice tightens eligibility, adds defaulted-neutral safeguards, and expands workflow regressions without changing scoring.

## Goal

Ensure every positive draft-pocket reason is backed by a material profile allocation from one shared transition, then prove profile-backed components, ordering, and reasons recompute deterministically across pick, undo, reset, restart, persisted load, Scenario V1/V2, replay-target, export, and re-import workflows.

## Scope

### Goals

- Require coherent profile identity and allocation evidence before mapping a positive timing component to a reason.
- Allow reasons only for allocations that can produce the component's positive delta: full low, reduced low, or full medium.
- Suppress timing reasons for zero allocations, neutral roles, malformed profile evidence, inactive forecasts, outside-pocket candidates, high safety, and ineligible positions.
- Preserve the existing reason precedence and wording for highest meaningful tier disappearance, exact profile disappearance, low safety, and medium safety.
- Keep defaulted-neutral reasons position-based and prevent meaningful overall-tier disappearance language.
- Assert Jefferson's shared medium-profile reason and London's zero-allocation reason suppression while preserving their corrected ordering.
- Cover deep, disappearing, both-deep, and both-thin RB/WR profiles plus QB/TE roster-fit interactions through score-backed reason assertions.
- Prove persisted and transient workflows recompute profile-backed recommendation output from captured inputs.
- Confirm Scenario V1/V2 export and replay remain independent of serialized derived output and mutable ranking sets.

### Non-goals

- Do not change profile transition derivation, candidate projection, allocation roles, timing deltas, scoring, caps, or ordering.
- Do not add or change user-facing reason text, priorities, materiality thresholds, caveats, or maximum counts.
- Do not add new recommendation components, reason categories, UI controls, or presentation.
- Do not serialize profiles, transitions, components, adjustments, scores, or reasons.
- Do not change scenario versions, ranking snapshots, database schema, repositories, replay rules, or persistence ownership.
- Do not add direct ADP, exact-player-gone, diversity-label, fallback-ADP, or position-tier claims.
- Do not begin the full Task 16 exit-validation matrix.

## Reason Eligibility Contract

### Required Profile Evidence

A positive `draft_pocket_timing` reason requires all existing timing evidence plus:

```text
profile position
profile overall-tier origin
profile overall-tier value
profile anchor player ID
one-based profile ordinal
allocation role
```

The evidence must be internally coherent:

- profile position equals candidate position;
- tier origin is `source` or `defaulted-neutral`;
- overall tier is a positive finite integer;
- anchor player ID is non-empty;
- profile ordinal is a positive integer;
- allocation role is valid for the shared skip safety and positive component delta.

### Valid Positive Allocations

Reasons are eligible only for:

| Skip safety | Allocation role | Component delta | Threshold |
| --- | --- | ---: | --- |
| Low | Full | `+6` | `low_skip_safety` |
| Low | Reduced | `+3` | `low_skip_safety` |
| Medium | Full | `+3` | `medium_skip_safety` |

Every other role/safety/delta combination is unsupported and produces no timing reason.

The reason mapper validates the component it receives; it does not recalculate scores, repair malformed evidence, or infer allocation from ordinal.

### Reason Precedence

For an eligible positive allocation, retain the existing precedence:

1. A meaningful source tier disappeared from the forecasted pocket.
2. The exact position/overall-tier profile disappeared.
3. Low skip safety left the profile thin.
4. Medium skip safety left limited comparable options.

Defaulted-neutral profiles skip step 1 even if contradictory evidence claims a meaningful tier disappeared. They may use position/profile language from steps 2-4 because the neutral tier does not represent a real quality boundary.

Zero-allocation candidates have neutral timing components and therefore no timing reason, even when their shared profile has low or medium skip safety.

## Workflow Recalculation Contract

Profile transitions, candidate projections, allocations, scores, and reasons remain derived values. Every supported state change must call the existing recommendation boundary with current draft state and captured ranking context:

- accepted pick;
- rejected pick, with the original state retained;
- undo;
- reset from source;
- persisted workspace load;
- transient restart;
- replay-target replacement;
- between-turn and on-turn preview;
- Scenario V1/V2 export and re-import.

No workflow may cache, serialize, or restore profile-derived output as authoritative state.

## Implementation Steps

1. In `src/lib/recommendations.ts`, extend `buildDraftPocketTimingReasonCandidate` to read the profile position, tier origin/value, anchor ID, one-based ordinal, and allocation role emitted by Task 14.
2. Validate profile evidence and require profile position to match candidate position. Reuse the existing typed evidence readers; add only the smallest local validation helper needed for allocation coherence.
3. Accept exactly the three positive allocation combinations in the table above, including reduced low-safety `+3`. Reject malformed deltas, role/safety mismatches, neutral roles, invalid ordinals, missing anchors, and contradictory thresholds.
4. Preserve existing timing reason IDs, text, priority, and precedence. For `defaulted-neutral` profile origin, ignore `highestMeaningfulTierDisappeared` when choosing a reason and fall through to position/profile, low-, or medium-safety language.
5. In `src/lib/recommendations.test.ts`, update direct reason fixtures to carry complete profile evidence. Add exact full-low, reduced-low, and full-medium reason cases plus suppression cases for zero allocation and every malformed profile/allocation combination.
6. Add a defaulted-neutral regression proving a positive profile allocation may produce position-based timing language but never `draft_pocket_timing:highest_meaningful_tier_disappeared` or overall-tier disappearance text.
7. Extend the integrated Jefferson/London test to assert Jefferson's material medium-profile reason is backed by his full allocation, London has no draft-pocket timing reason while his allocation is zero, and London receives the same approved reason only after promotion to profile leader.
8. Add or refine integrated profile fixtures for deep, disappearing, both-deep, and both-thin RB/WR states and QB/TE filled-versus-open roster states. Assert component delta, allocation role, reason presence/suppression, ordering, and exact score reconciliation without changing tuning.
9. In `src/lib/scenarioSession.test.ts`, assert profile identity, anchor, ordinal, allocation role, and reason output recompute after local pick, undo, reset, restart, between-turn/on-turn changes, and replay-target replacement. Prefer extending existing workflow tests rather than duplicating their setup.
10. For Scenario V1, assert defaulted-neutral timing reasons remain position-based and never claim meaningful overall-tier disappearance. For Scenario V2, assert source-profile evidence and reasons survive export/re-import through recomputation while derived profiles remain absent from the portable document.
11. In `src/components/DraftRoom.test.tsx`, strengthen the persisted-workspace boundary test to assert rendered recommendations match profile-backed engine ordering, scores, component evidence, and reasons. Keep structured normalization failure behavior unchanged.
12. Run the focused corrective regression set:

   ```powershell
   npm test -- src/lib/recommendations.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioReplay.test.ts src/components/DraftRoom.test.tsx src/lib/draftRepositoryMapping.test.ts
   npx tsc --noEmit
   npm run lint
   git diff --check
   ```

13. Complete focused manual QA in the running Draft Room:
   - reproduce the default Jefferson/London state and confirm Jefferson remains first with a profile-backed reason while London has no timing reason;
   - draft Jefferson and confirm London is promoted and receives the full applicable profile-backed reason;
   - undo and confirm the original ordering, allocation, and reasons return;
   - load a persisted workspace and import Scenario V1 and V2, then verify recommendation evidence and reasons recompute after a pick and replay-target change;
   - export and re-import the active scenario and confirm equivalent ordering, components, adjustments, scores, and reasons.
14. After automated and manual validation pass, mark Task 15 complete in `docs/tasks.md` and add dated completion notes to this file. Do not begin Task 16.

## Expected Files

- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `src/lib/scenarioSession.test.ts`
- `src/components/DraftRoom.test.tsx`
- `docs/tasks.md`, status and testing-status updates only after validation
- `docs/current-slice.md`, completion notes only after validation

Expected production/test blast radius: one production file and three existing test files, plus two status-only documentation updates.

## Acceptance Criteria

- Every positive draft-pocket reason contains complete, coherent profile identity, anchor, ordinal, allocation, safety, and threshold evidence.
- Full low-safety `+6`, reduced low-safety `+3`, and full medium-safety `+3` components retain their existing approved reason IDs and wording.
- Zero allocations and malformed role/safety/delta combinations produce no timing reason.
- Missing or invalid profile position, tier origin/value, anchor, ordinal, or allocation role produces no timing reason.
- Defaulted-neutral profiles may produce position-based timing reasons but never meaningful overall-tier disappearance reasons or text.
- Jefferson remains above London; Jefferson's full medium allocation produces the approved limited-options reason, London has no timing reason at zero allocation, and promoted London receives the approved reason after Jefferson is drafted.
- Deep profiles with high skip safety remain reason-neutral; disappearing and thin profiles produce only the single reason backed by their allocated timing component.
- Both-deep and both-thin RB/WR cases preserve player-quality and roster-context ordering under existing caps.
- QB/TE profile reasons remain subordinate to existing filled-position penalties and never invent a onesie roster need.
- Pick, undo, reset, persisted load, restart, replay-target, and between-turn/on-turn changes recompute exact deterministic profile-backed output.
- Scenario V1 remains defaulted-neutral; Scenario V2 preserves source semantics; export/re-import reproduces derived ordering, components, adjustments, scores, and reasons without serializing profile output.
- Persisted Draft Room rendering preserves engine recommendation order, displayed scores, and reason text.
- Existing overall-tier reasons, materiality, priority, caveat, maximum-count, score reconciliation, draft invariants, and structured-error behavior remain intact.
- Focused tests, TypeScript validation, lint, manual QA, and `git diff --check` pass with no new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- correct profile-backed reasons require new wording, priorities, categories, scoring, or allocation changes;
- a workflow requires serializing or persisting profile transitions or recommendation output;
- Scenario V1 compatibility requires treating legacy or defaulted-neutral tiers as meaningful source tiers;
- persisted, replayed, or exported output depends on the mutable source ranking set;
- manual QA requires UI controls, schema changes, or workflow behavior outside the existing workbench;
- validation exposes an unrelated failure or requires production changes outside `src/lib/recommendations.ts`.

## Slice Review

1. Smallest meaningful increment: yes - it hardens reason eligibility and proves existing workflows after the completed scoring correction.
2. Executable without redefining the approach: yes - required evidence, valid allocation combinations, precedence, workflow states, tests, manual checks, and stop conditions are explicit.
3. Avoids unnecessary architecture changes: yes - no scoring, persistence, scenario, replay, or UI contract changes are authorized.
4. Reasonable blast radius: yes - one production reason mapper and three focused test files.
5. Comfortably reviewable and revertible: yes - production behavior changes only by suppressing reasons that lack valid profile-backed allocation evidence.
6. Observable and testable acceptance criteria: yes - reason IDs/text, component evidence, state transitions, rendered output, and round-trip equality are deterministic.

## Follow-up

After Task 15 is complete, promote Task 16 to run full Phase 5.5 regression, persistence, production-build, and manual exit validation without adding product behavior.

## Implementation Progress

- Hardened draft-pocket reason eligibility so only full low, reduced low, and full medium allocations with coherent profile identity, anchor, ordinal, safety, delta, and threshold evidence can produce a reason.
- Preserved existing reason IDs, wording, priority, and precedence while preventing defaulted-neutral profiles from producing meaningful overall-tier disappearance language.
- Added direct coverage for all valid positive allocations, zero allocation, malformed profile evidence, contradictory roles/safety/deltas, and defaulted-neutral position-based wording.
- Extended the Jefferson/London regression to prove Jefferson receives the profile-backed reason, London receives none at zero allocation, and promoted London receives the approved reason after Jefferson is drafted.
- Added both-deep, both-thin, asymmetric RB/WR, and filled-QB score-backed reason regressions.
- Strengthened Scenario V1/V2, pick, preview, export/re-import, persisted Draft Room, and derived-output serialization regressions with profile evidence assertions.
- Automated validation passed: 199 focused recommendation, scenario-session, portability, replay, Draft Room, and repository-mapping tests, `npx tsc --noEmit`, `npm run lint`, and `git diff --check`. Lint reports only the documented pre-existing `stripLocations` warning in `src/lib/rankingNormalizer.test.ts`.

## Blocker

The browser skill could not connect to the in-app browser because the browser-control runtime rejected initialization before any page could be opened. Per the slice contract, manual Jefferson/London, pick/undo, persisted load, Scenario V1/V2, replay-target, and export/re-import QA remains required. Do not mark Task 15 complete or begin Task 16 until that browser QA succeeds.
