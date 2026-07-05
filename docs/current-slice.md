# Current Slice - Task 14: Project Profile Transitions Into Monotonic Candidate Timing Allocation

## Status

Planned. Awaiting implementation and validation.

## Context

Task 13 added the pure shared profile-transition boundary. It groups each current position/overall-tier profile once, uses the highest-ranked member as a shared anchor, and derives common replacement quality and skip safety from the forecasted pocket.

Recommendation scoring still uses the superseded candidate-relative path. This slice replaces that path with candidate projections from the Task 13 transitions and applies the approved full/reduced allocation:

| Shared profile skip safety | Profile leader | Other profile members |
| --- | ---: | ---: |
| Low | `+6` | `+3` |
| Medium | `+3` | `0` |
| High or neutral | `0` | `0` |

Task 15 remains responsible for a focused review of reason semantics and workflow regressions. This slice must preserve existing reason wording and selection machinery while supplying it with the new component evidence.

## Goal

Compute profile transitions once per recommendation calculation, project their shared evidence onto current candidates, and replace candidate-relative draft-pocket scoring with deterministic allocation that can never award a lower-ranked member of a profile a larger timing modifier than a higher-ranked available member.

## Scope

### Goals

- Extend candidate signals with profile identity, shared anchor, one-based profile ordinal, and allocation role.
- Make replacement counts, replacement quality, skip safety, and disappearance observations direct projections of one shared profile transition.
- Keep candidate presence in the forecasted pocket as diagnostic evidence only.
- Compute profile transitions once in the Phase 5.5 scoring context and reuse them for every recommendation candidate.
- Apply the approved full/reduced/neutral timing allocation without new score values or tuning settings.
- Remove the superseded candidate-relative forecasted-pocket scan after the profile-backed path is validated.
- Preserve component reconciliation, urgency and context caps, deterministic ordering, and existing non-forecast modifiers.
- Prove the Jefferson/London inversion cannot recur while both share the same current profile.

### Non-goals

- Do not change board forecasting, ADP normalization, target-pick selection, pocket construction, or Task 13 transition derivation.
- Do not change draft-pocket reason wording, priority, materiality, caveat, or maximum-count rules.
- Do not complete Task 15 workflow/reason validation or Task 16 exit validation.
- Do not add score magnitudes, position weights, tuning configuration, hidden adjustments, or final-sort overrides.
- Do not retune base value, overall tier, roster fit, tier pressure, scarcity, run pressure, or value opportunity.
- Do not make raw ADP, removal-window membership, exact-player forecast presence, diversity labels, or missing-ADP fallback score directly.
- Do not change persistence, scenario formats, repositories, React state, or UI controls.

## Candidate Projection Contract

### Required Evidence

Extend `CandidatePocketSignal` with:

```text
profile identity
profile anchor player ID, nullable for a neutral projection
one-based profile ordinal, nullable for a neutral projection
allocation role: full | reduced | neutral
```

Retain the existing candidate fields for compatibility, but change their source:

- `comparableReplacementCount` comes from the shared transition's forecasted comparable count.
- `nearReplacementCount` comes from the shared transition's forecasted near count.
- `replacementQuality` and `skipSafety` come directly from the shared transition.
- `currentProfileCount` comes from the shared transition.
- `forecastedProfileCount` maps to the transition's exact-profile count.
- `profileDisappeared` maps to exact-profile disappearance.
- `highestMeaningfulTierDisappeared` comes from the shared transition.
- `candidateInForecastedPocket` remains an exact-player diagnostic and affects no category or delta.

Every current candidate in one profile therefore receives identical shared transition evidence. Only player identity, forecast membership, profile ordinal, and allocation role may differ.

### Neutral Projection

A candidate receives a neutral projection when:

- the forecast is not active;
- the candidate is outside the current pocket; or
- no future profile transition applies.

Neutral projections retain the candidate's structural profile and diagnostic pocket membership. They use a null anchor, null ordinal, neutral allocation role, neutral replacement/skip levels, zero counts, and false disappearance observations.

For an active forecast, a candidate listed in the current pocket must resolve to exactly one shared transition. Missing or duplicate membership is an explicit domain error rather than a neutral fallback.

## Allocation Contract

### Candidate Role

Profile ordinal is one-based in overall-rank then stable-ID order.

Derive allocation role from shared skip safety and ordinal:

```text
Low safety + ordinal 1       -> full
Low safety + ordinal > 1     -> reduced
Medium safety + ordinal 1    -> full
Medium safety + ordinal > 1  -> neutral
High or neutral safety       -> neutral
```

### Timing Delta

Map role and shared skip safety to the existing `draft_pocket_timing` values:

```text
Full + low safety       -> +6
Reduced + low safety    -> +3
Full + medium safety    -> +3
Every other state       -> 0
```

The component remains eligible only for an active forecast, a current-pocket candidate, and QB/RB/WR/TE. DST and K remain neutral even if their profile transition is low or medium safety.

The timing delta continues through the existing urgency cap and total-context cap. It must reconcile from the component and existing adjustments without a new same-profile adjustment.

### Component Evidence

Add profile identity, anchor, ordinal, and allocation role to `draft_pocket_timing` evidence. Preserve the existing forecast status, target pick, candidate position, pocket membership, shared counts, safety levels, and disappearance observations.

Keep the existing `low_skip_safety` and `medium_skip_safety` thresholds for positive full or reduced allocations so current reason wording and selection remain unchanged in this slice. Use a deterministic neutral threshold such as `profile_member_no_allocation` when a medium-safety non-leader receives zero. High and neutral states retain their existing neutral meanings.

## Implementation Steps

1. In `src/types/draft.ts`, add a narrow `DraftPocketTimingAllocationRole` union of `full | reduced | neutral` and extend `CandidatePocketSignal` with `profile`, nullable `profileAnchorPlayerId`, nullable one-based `profileOrdinal`, and `allocationRole`.
2. Refactor `createCandidatePocketSignal` in `src/lib/draftPocketForecast.ts` to accept the candidate, shared forecast, and the already-derived `DraftPocketProfileTransition[]`. Remove its rankings input and all candidate-relative ranking resolution, rank-window scanning, replacement classification, and candidate-presence skip-safety adjustment.
3. For inactive forecasts and candidates outside the current pocket, return the neutral projection defined above. For active current-pocket candidates, find the single transition whose ordered `currentPlayerIds` contains the candidate.
4. Fail explicitly if an active current-pocket candidate resolves to no transition or more than one transition. Validate that the candidate's position, overall-tier origin, and overall-tier value match the transition profile before projecting it.
5. Derive one-based profile ordinal from the candidate's index in `currentPlayerIds`. Project every shared count, category, and disappearance observation directly from the transition; use forecasted-pocket membership only for `candidateInForecastedPocket` evidence.
6. Derive `allocationRole` exactly from profile ordinal and shared skip safety. Do not calculate a score inside the forecast-analysis function.
7. In `src/lib/recommendations.ts`, construct `forecast` once inside `createPhase55ScoringContext`, call `createDraftPocketProfileTransitions` once with that forecast and normalized rankings, and retain both values in the scoring context.
8. Pass the shared transition collection to `createCandidatePocketSignal` for every candidate. Do not call transition derivation inside the candidate map.
9. Update `calculateDraftPocketTimingComponent` to map allocation role plus shared skip safety to `+6`, `+3`, or `0`. Preserve forecast/current-pocket/position eligibility checks, existing component priority, caps, and evidence exclusions.
10. Preserve current reason behavior by retaining `low_skip_safety` or `medium_skip_safety` for material positive components. A zero-allocation profile member must produce a neutral component and therefore no positive timing reason.
11. Replace the superseded `createCandidatePocketSignal` unit tests in `src/lib/draftPocketForecast.test.ts` with profile-projection tests covering shared evidence, full/reduced/neutral roles, neutral projections, exact-player diagnostic independence, leader promotion, deterministic ties, transition mismatch, and immutability. Keep Task 13 transition tests intact.
12. Update direct component tests in `src/lib/recommendations.test.ts` for every valid role/safety combination and all existing neutral eligibility states. Assert complete profile-backed evidence and continued absence of raw ADP, removal-window, fallback, and diversity-label evidence.
13. Add an integrated Jefferson/London regression using their default rank, ADP, position, and tier facts. Assert both read one shared medium-safety WR/source-tier-2 transition, Jefferson receives the full `+3`, London receives `0`, Jefferson remains ordered first, and every score reconciles.
14. Add leader-promotion coverage: after Jefferson is drafted or unavailable, London becomes the profile leader and receives the full modifier supported by the recomputed shared transition.
15. Preserve and update existing urgency-cap, context-cap, QB/TE roster-fit, DST/K neutrality, deterministic ordering, and no-ADP/no-next-pick regressions only where the intentional profile-backed evidence changes their exact expectations.
16. Run focused validation:

   ```powershell
   npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts src/lib/scenarioSession.test.ts src/components/DraftRoom.test.tsx
   npx tsc --noEmit
   npm run lint
   git diff --check
   ```

17. After validation passes, mark Task 14 complete in `docs/tasks.md` and add dated completion notes to this file. Do not begin Task 15.

## Expected Files

- `src/types/draft.ts`
- `src/lib/draftPocketForecast.ts`
- `src/lib/draftPocketForecast.test.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `docs/tasks.md`, status and testing-status updates only after validation
- `docs/current-slice.md`, completion notes only after validation

Expected production/test blast radius: five code and test files, plus two status-only documentation updates.

## Acceptance Criteria

- Profile transitions are computed exactly once per Phase 5.5 recommendation calculation and reused for all candidate projections.
- Every current candidate in one profile receives identical profile identity, anchor, shared counts, replacement quality, skip safety, and disappearance observations.
- Profile ordinal is one-based and follows overall rank then stable player ID; removing the leader promotes the next member deterministically.
- Candidate forecast membership remains inspectable but cannot change shared replacement quality, skip safety, allocation role, or timing delta.
- Low-safety leaders receive `+6`, later low-safety members receive `+3`, medium-safety leaders receive `+3`, and later medium-safety members receive `0`.
- High, neutral, inactive, outside-pocket, DST, and K cases receive `0`.
- Within every profile, a higher-ranked member's timing delta is greater than or equal to every lower-ranked member's timing delta.
- Jefferson and London share medium-safety WR/source-tier-2 evidence; Jefferson receives `+3`, London receives `0`, and London cannot outrank Jefferson from draft-pocket timing while both are available.
- When Jefferson becomes unavailable, London becomes the recomputed profile leader and receives the full applicable timing modifier.
- Active current-pocket candidates missing a unique matching transition fail explicitly rather than silently using candidate-relative or neutral behavior.
- Raw ADP, exact removal, candidate forecast membership, missing-ADP fallback, and diversity labels remain non-scoring.
- Every score reconciles exactly from components and adjustments; no final-sort override or hidden correction is introduced.
- Existing urgency/context caps, overall-tier scoring, roster fit, tier pressure, scarcity, run pressure, value opportunity, QB/TE handling, deterministic ties, and legacy no-context behavior remain intact.
- Existing reason wording and selection rules remain unchanged; zero timing components emit no positive timing reason.
- Focused tests, TypeScript validation, lint, and `git diff --check` pass with no new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- monotonic allocation requires a final-sort override, hidden adjustment, or score that does not reconcile;
- profile transitions must be rebuilt per candidate or candidate-relative rank windows are required;
- candidate forecast membership must affect skip safety or timing to preserve existing behavior;
- correct integration requires new score magnitudes, tuning settings, reason wording, persistence, scenario-format, repository, React, or UI changes;
- the Jefferson/London regression cannot be reproduced from deterministic inputs;
- validation exposes an unrelated failure or requires files outside the expected implementation/test set.

## Slice Review

1. Smallest meaningful increment: yes - it replaces only candidate projection and timing allocation while deferring reason/workflow hardening to Task 15.
2. Executable without redefining the approach: yes - signal fields, neutral behavior, lookup rules, allocation roles, deltas, evidence, integration ownership, tests, and failures are explicit.
3. Avoids unnecessary architecture changes: yes - it reuses the pure forecast, shared transitions, existing component, and existing caps without new state or abstractions.
4. Reasonable blast radius: yes - three domain/type files and two focused recommendation files; documentation changes are status-only.
5. Comfortably reviewable and revertible: yes - the superseded candidate-relative path is replaced at one domain boundary and one scoring call site.
6. Observable and testable acceptance criteria: yes - shared evidence, roles, deltas, ordering, score reconciliation, promotion, and neutrality are deterministic outputs.

## Follow-up

After Task 14 is complete, promote Task 15 to validate profile-backed reasons and recomputation across persisted, preview, scenario, replay, and workbench workflows before final Phase 5.5 exit validation.
