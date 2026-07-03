# Current Slice — Task 9: Score-Backed Tier and Draft-Pocket Reasons

## Status

Planned. Not yet implemented.

## Goal

Explain material overall-tier and draft-pocket timing contributions in recommendation reasons using only the evidence already attached to their score components.

This slice changes explanation output only. It must not change recommendation scores, caps, ordering, forecast construction, or pocket eligibility.

## Scope

### Goals

- Add deterministic reason builders for the `overall_tier` and `draft_pocket_timing` score components.
- Explain both meaningful overall-tier states:
  - the candidate is the last player in the best available overall tier;
  - the candidate belongs to the best available overall tier.
- Explain material draft-pocket timing through the strongest supported signal:
  - the candidate's highest meaningful overall tier is absent from the forecasted next pocket;
  - the candidate's position/tier profile is absent from the forecasted next pocket;
  - comparable options are thin under low skip safety;
  - comparable options are limited under medium skip safety.
- Use the candidate's actual position when describing comparable or profile-level alternatives.
- Preserve the existing reason materiality threshold, component priority ordering, caveat handling, deduplication, and maximum-reason limit.
- Add focused tests for supported wording, evidence precedence, suppression, and integration with recommendation generation.

### Non-goals

- Do not change component deltas, group caps, priorities, score calculation, or recommendation ordering.
- Do not alter forecast, draft-pocket, replacement-quality, or skip-safety calculations.
- Do not add reasons for neutral forecasts, high skip safety, candidates outside the current pocket, ineligible positions, default-neutral overall tiers, or immaterial components.
- Do not describe raw ADP, claim that an exact player will be gone, or infer reasons from missing ADP, fallback placement, removal risk, or position diversity alone.
- Do not add AI-generated explanations or redesign recommendation UI.
- Do not thread ranking context through production callers; that belongs to Task 10.

## Approved Reason Mapping

Each score component may contribute at most one reason. Builders must validate the component ID, threshold marker, and required typed evidence before producing text.

### Overall-tier reasons

| Required evidence | Reason ID | Text |
| --- | --- | --- |
| `overallTierOrigin: source`, `thresholdMatched: last_in_best_overall_tier`, and `bestTierRemaining: 1` | `overall_tier:last_in_best_overall_tier` | `Last player remaining in the best available overall tier.` |
| `overallTierOrigin: source` and `thresholdMatched: best_overall_tier_available` | `overall_tier:best_overall_tier_available` | `In the best available overall tier.` |

The builder must return no reason for default-neutral tiers, missing evidence, `no_overall_tier_boundary`, or `outside_best_overall_tier`.

### Draft-pocket timing reasons

The builder must require all shared eligibility evidence:

- `forecastStatus: active`
- `candidateInCurrentPocket: true`
- `candidatePosition` equal to `QB`, `RB`, `WR`, or `TE`
- `skipSafety` equal to `low` or `medium`
- `thresholdMatched` matching the component's material scoring state

After those gates pass, select the first supported reason in this precedence order:

| Precedence | Required evidence | Reason ID | Text |
| --- | --- | --- | --- |
| 1 | `highestMeaningfulTierDisappeared: true` | `draft_pocket_timing:highest_meaningful_tier_disappeared` | `This overall tier is not represented in the forecasted next pocket.` |
| 2 | `profileDisappeared: true` | `draft_pocket_timing:profile_disappeared` | `Similar {POSITION} options are not represented in the forecasted next pocket.` |
| 3 | `thresholdMatched: low_skip_safety` | `draft_pocket_timing:low_skip_safety` | `Comparable {POSITION} options are thin in the forecasted next pocket.` |
| 4 | `thresholdMatched: medium_skip_safety` | `draft_pocket_timing:medium_skip_safety` | `Only limited comparable {POSITION} options remain in the forecasted next pocket.` |

`{POSITION}` must come directly from `candidatePosition`. The highest-tier reason intentionally says `overall tier` so it is not confused with a position tier. The wording describes the deterministic forecasted pocket and must not make an exact-player availability promise.

## Implementation Steps

1. Extend the evidence-reading helpers in `src/lib/recommendations.ts` only as needed to safely read boolean evidence without coercion.
2. Add an overall-tier reason builder that implements the exact source-origin, threshold, and remaining-count gates above.
3. Add a draft-pocket timing reason builder that validates shared eligibility, applies the approved evidence precedence, and inserts only the candidate's evidence-backed position into position-specific wording.
4. Register both builders in the existing context-reason dispatch without changing selection thresholds, sorting, caveats, deduplication, or maximum count behavior.
5. Add focused unit tests in `src/lib/recommendations.test.ts` covering:
   - both overall-tier reason states;
   - all four draft-pocket reason paths and their precedence;
   - actual-position wording for RB/WR and QB/TE candidates;
   - suppression for default-neutral tiers, missing or contradictory evidence, inactive/neutral forecasts, high skip safety, outside-pocket candidates, and ineligible positions;
   - materiality, priority ordering, caveat behavior, and maximum-reason limits remaining intact;
   - absence of reasons derived only from raw ADP, exact-player disappearance, diversity, or missing-ADP metadata;
   - recommendation generation producing the new reasons when normalized ranking context creates material components while preserving context-absent behavior and score output.
6. Run the focused forecast and recommendation tests, TypeScript validation, and lint.
7. After all validation passes, mark only Task 9 complete in `docs/tasks.md` and record the validation result.

## Expected Files

- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `docs/tasks.md` after successful implementation validation
- `docs/current-slice.md` for implementation completion notes

Expected implementation blast radius: four files.

## Acceptance Criteria

- Every new reason is traceable to a positive, material score component and its own evidence.
- The two meaningful overall-tier states use the approved distinct wording.
- Draft-pocket reasons explain comparable-option loss or limitation using the candidate's actual position where applicable.
- When several timing facts are true, exactly one timing reason is selected using the approved precedence.
- Neutral/default/ineligible/outside-pocket/high-safety or incomplete evidence produces no new reason.
- No reason is generated from a heavy-position label, raw ADP, diversity, missing ADP, or an unsupported exact-player prediction.
- Existing materiality, priority, caveat, deduplication, and maximum-reason behavior remains unchanged.
- Recommendation scores, caps, ordering, and context-absent behavior remain unchanged.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- the existing score evidence cannot support one of the approved statements without inference;
- adding a reason requires changing scoring, forecast construction, component priority, or materiality thresholds;
- an existing test requires wording that conflicts with the approved score-backed evidence rules;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Follow-up

Task 10 should thread the normalized ranking context through the supported live recommendation entry points so the already-built scoring and explanation behavior is available in production flows.

## Slice Review

1. Smallest meaningful increment: yes — it exposes the already-computed Task 8 evidence through the existing explanation pipeline.
2. Executable without redefining the approach: yes — evidence gates, precedence, IDs, and exact wording are specified.
3. Avoids unnecessary architecture changes: yes — it extends existing builders and dispatch only.
4. Reasonable blast radius: yes — four files, with two production/test files carrying the behavior.
5. Comfortably reviewable and revertible: yes — no scoring or caller changes are included.
6. Observable and testable acceptance criteria: yes — each reason and suppression state has deterministic evidence and expected output.
