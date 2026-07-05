# Current Slice - Task 13: Add Shared Position/Tier Profile Transition Analysis

## Status

Planned. Awaiting implementation and validation.

## Context

The Phase 5.5 corrective design replaces candidate-relative replacement analysis with one shared transition per current position/overall-tier profile. The board forecast and both draft pockets already exist and remain unchanged.

This slice adds only the pure profile-transition boundary. Existing candidate signals, timing scores, recommendation ordering, and reasons continue using the completed candidate-relative path until Task 14 replaces them. Keeping both paths temporarily allows the new domain output to be validated without mixing analysis, scoring, and explanation changes.

The source contract is `docs/design/phase5.5-profile-transitions.md`.

## Goal

Given one existing shared draft-pocket forecast and its normalized ranking facts, deterministically derive one immutable transition for every position/overall-tier profile represented in the current pocket.

Every current candidate in a profile must share the same anchor, comparison window, forecast classifications, replacement quality, skip safety, and transition observations.

## Scope

### Goals

- Add explicit domain types for draft-pocket profile identity and shared profile transitions.
- Represent a profile by position, overall-tier origin, and overall/source-tier value.
- Group and order current-pocket candidates by overall rank then stable player ID.
- Use the highest-ranked current member as the profile anchor for one shared 12-rank comparison window.
- Classify forecasted-pocket options as exact, comparable, near, or unrelated for each current profile.
- Derive shared counts, replacement quality, skip safety, exact-profile disappearance, and highest-meaningful-tier disappearance.
- Treat defaulted-neutral profiles as position depth without inventing meaningful tier boundaries.
- Return deterministic transition ordering and evidence suitable for Task 14 candidate projection.
- Preserve existing explicit failures for unresolved pocket identities and incompatible tier origins.

### Non-goals

- Do not change `DraftPocketForecast`, forecast removal order, target-pick selection, or pocket construction.
- Do not call profile-transition analysis from recommendation scoring yet.
- Do not change or remove `createCandidatePocketSignal` or its current behavior.
- Do not allocate timing modifiers, alter recommendation ordering, or change reasons.
- Do not change scoring components, tuning values, urgency caps, context caps, or roster behavior.
- Do not add persistence, scenario, replay, repository, React, or UI behavior.
- Do not create position tiers, counterfactual forecasts, simulations, or player-specific availability claims.

## Domain Contract

### Profile Identity

Add a structural profile value equivalent to:

```ts
type DraftPocketProfile = Readonly<{
  position: Position;
  overallTierOrigin: RecommendationOverallTierOrigin;
  overallTier: number;
}>;
```

Profile equality requires all three fields to match. A source tier remains an overall quality grouping; combining it with position for pocket comparison must not make it recommendation-tier eligible.

### Transition Output

Add one transition value per current profile with these required concepts:

```text
profile identity
anchor player ID
anchor overall rank
ordered current player IDs
current profile count
ordered forecasted comparable player IDs
ordered forecasted near player IDs
forecasted exact-profile count
forecasted comparable count
forecasted near count
replacement quality
skip safety
exact profile disappeared
highest meaningful overall tier disappeared
```

Comparable player IDs include exact-profile and better-tier options. Near player IDs contain worse-tier options only. All output identity arrays follow overall rank then stable player ID.

### Option Classification

Only forecasted-pocket players at the same position and within an absolute overall-rank distance of 12 from the profile anchor participate.

For a meaningful source-tier profile:

- exact: same tier origin and tier value;
- comparable: same or better meaningful source tier, including exact options;
- near: worse meaningful source tier;
- unrelated: different position, incompatible origin, or outside the shared rank window.

For a defaulted-neutral profile:

- same-position defaulted-neutral options inside the rank window are exact and comparable;
- no option becomes near from the neutral tier value;
- no meaningful-tier disappearance evidence may be emitted.

Numeric tier gaps do not change classification strength. Only tier ordering matters.

### Replacement Quality and Skip Safety

Derive one result per profile:

```text
High:
  at least two comparable options remain

Medium:
  exactly one comparable option remains
  OR no comparable option remains and at least one near option remains

Low:
  no comparable or near option remains
```

Map replacement quality directly to skip safety: high to high, medium to medium, and low to low.

Exact-player presence, removal-window membership, and candidate-specific rank must not alter these shared categories.

## Implementation Steps

1. Add `DraftPocketProfile` and `DraftPocketProfileTransition` domain types to `src/types/draft.ts`. Reuse the existing position, tier-origin, and signal-level types. Keep the output readonly and explicit; do not add a generic profile framework.
2. In `src/lib/draftPocketForecast.ts`, add one exported pure function named `createDraftPocketProfileTransitions` accepting an existing `DraftPocketForecast` and the normalized `RecommendationRankingFact[]` used to build it.
3. Return an empty transition list for `no-adp` and `no-next-pick` forecasts, a null forecasted pocket, or an empty current pocket. Do not manufacture neutral per-profile transitions when future timing is inactive.
4. Resolve current and forecasted pocket identities through the existing ranking-resolution boundary. Preserve explicit failure behavior for missing identities instead of silently dropping players.
5. Group current-pocket rankings by structural profile identity. Sort members by overall rank then stable player ID, choose the first member as the shared anchor, and order the resulting profiles by anchor rank then anchor player ID.
6. For each current profile, classify forecasted-pocket rankings using position, compatible tier origin, tier order, and distance from the shared anchor. Build deterministic comparable and near player-ID lists and exact/comparable/near counts.
7. Derive replacement quality and skip safety from the shared counts exactly as specified above. Candidate membership in the forecasted pocket remains irrelevant to this result.
8. Mark exact-profile disappearance when no exact member of the current profile appears in the forecasted pocket. Mark highest-meaningful-tier disappearance only for source profiles in the current highest meaningful tier when that tier is absent across the complete forecasted pocket.
9. For defaulted-neutral profiles, compare same-position depth inside the anchor window while keeping meaningful-tier disappearance false. Reject incompatible mixed-origin comparisons consistently with the existing candidate-analysis boundary rather than inferring compatibility.
10. Extend `src/lib/draftPocketForecast.test.ts` with a dedicated `createDraftPocketProfileTransitions` suite covering grouping, anchors, classifications, thresholds, neutral states, failures, and deterministic output. Keep existing forecast, pocket, and candidate-signal tests unchanged except for any shared fixture reuse required by the new tests.
11. Include the Jefferson/London regression shape as a pure transition fixture: both current candidates share WR/source-tier-2, Jefferson is the anchor, and both necessarily read the same transition even when Jefferson is removed while London remains in the forecasted pocket.
12. Run focused validation, then TypeScript and lint checks:

   ```powershell
   npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts
   npx tsc --noEmit
   npm run lint
   git diff --check
   ```

13. After all validation passes, mark Task 13 complete in `docs/tasks.md` and add dated completion notes to this file. Do not begin Task 14.

## Expected Files

- `src/types/draft.ts`
- `src/lib/draftPocketForecast.ts`
- `src/lib/draftPocketForecast.test.ts`
- `docs/tasks.md`, status and testing-status updates only after validation
- `docs/current-slice.md`, completion notes only after validation

Expected implementation blast radius: three code/test files plus two status-only documentation files.

## Acceptance Criteria

- Every distinct profile in the current pocket produces exactly one transition ordered by profile anchor rank then stable ID.
- Profile identity consists only of position, overall-tier origin, and overall/source-tier value.
- Every current candidate in one profile shares the same anchor, forecast classifications, counts, replacement quality, skip safety, and transition observations.
- Current profile members and forecasted comparable/near identities are ordered by overall rank then stable player ID.
- The highest-ranked current profile member is the shared rank-window anchor; stable ID resolves tied overall ranks.
- Forecasted options at rank distance 12 are included and distance 13 are excluded for every member of the profile.
- Source-tier options at the same or better tier are comparable; worse-tier options are near; numeric tier-gap size has no additional effect.
- High replacement quality requires at least two comparable options; one comparable or one-or-more near-only options is medium; no comparable or near option is low.
- Skip safety exactly matches the shared profile replacement-quality level.
- Defaulted-neutral profiles compare same-position depth without near-tier or meaningful-tier disappearance evidence.
- Exact-profile and highest-meaningful-tier disappearance follow the approved shared-pocket definitions.
- Jefferson and London resolve to one WR/source-tier-2 transition anchored by Jefferson, regardless of which exact member remains forecasted.
- Exact-player forecast membership and removal-window membership do not independently change shared replacement quality or skip safety.
- Inactive forecasts and empty current pockets return no transitions; unresolved identities and incompatible tier origins fail explicitly.
- Equivalent inputs with shuffled ranking arrays produce exact equivalent transitions without input mutation.
- Existing forecast, pocket, candidate-signal, recommendation, scoring, and reason behavior remains unchanged.
- Focused tests, TypeScript validation, lint, and `git diff --check` pass with no new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- the shared transition boundary cannot be added without changing existing forecast, scoring, or reason output;
- profile comparison requires inferred position tiers or reinterpretation of overall/source tiers;
- deterministic classification requires candidate-specific anchors or separate candidate forecasts;
- Task 13 requires persistence, scenario-format, repository, React, or UI changes;
- a validation failure is unrelated to this slice or requires changes outside the expected files.

## Slice Review

1. Smallest meaningful increment: yes - it introduces and validates only the shared profile-transition domain boundary required before scoring can change.
2. Executable without redefining the approach: yes - types, function boundary, identity, anchors, classifications, thresholds, ordering, neutral states, and failures are explicit.
3. Avoids unnecessary architecture changes: yes - the work remains a pure derived function beside the existing forecast logic and adds no state or infrastructure.
4. Reasonable blast radius: yes - one shared type file, one domain implementation file, and one focused test file.
5. Comfortably reviewable and revertible: yes - existing candidate analysis and recommendation behavior remain active and unchanged.
6. Observable and testable acceptance criteria: yes - every transition field and boundary is deterministic and asserted directly.

## Follow-up

After Task 13 is complete, promote Task 14 to project shared profile transitions into candidate evidence and replace candidate-relative timing with monotonic full/reduced modifier allocation.
