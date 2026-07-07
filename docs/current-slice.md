# Current Slice - Task 4: Add Roster Construction Insights

## Status

Pending. This slice is planned for implementation after Phase 6 Task 3.

## Context

Phase 6 Tasks 1-3 created the pure Insight Engine contract, neutral bundle behavior, score-gap labels, primary decision frames, top-candidate summaries, and top-options tradeoff insights.

Task 4 adds roster construction context to the same pure Insight Engine. The goal is to explain when the user's roster shape materially affects the current decision, using configured league slots, the user's drafted players, existing recommendation evidence, and current top-candidate context.

This slice must not change recommendation scoring, ordering, reason generation, roster-fit component generation, board forecasts, UI presentation, persistence, or scenario contracts.

## Goal

Generate at most one deterministic `roster_context` insight in `rosterInsights` when the user's roster construction materially explains the current recommendation decision or top-candidate context.

## Scope

### Goals

- Derive the user's roster from `input.draft.picks`, `input.rankings`, and `input.userTeamId`.
- Derive roster slot context from `input.leagueSettings.rosterSlots` rather than MVP constants.
- Classify roster context for relevant recommendation positions:
  - open direct starter need;
  - useful flex need;
  - useful bench-depth need;
  - limited need;
  - saturated position;
  - early single-start DST/K timing caveat.
- Preserve RB/WR/FLEX utility language for the default two-flex PPR roster while deriving the behavior from configured slots.
- Treat QB, DST, and K as single-start positions unless the configured roster slots show broader utility.
- Generate a roster insight only when the top recommendation or a close top option has material supported roster-fit evidence.
- Prefer the leading recommendation's roster context when it is material; otherwise use the strongest close top-option roster context if it helps explain the decision.
- Include `supportedBy` references to the recommendation `roster_fit` component and its evidence keys.
- Keep insight wording concise and factual.

### Non-goals

- Do not add, retune, or reinterpret recommendation scoring.
- Do not change `calculateRosterFitComponent`, roster-fit deltas, caps, reasons, or thresholds.
- Do not hard-code default roster counts into Insight Engine behavior.
- Do not generate broad whole-draft roster planning or strategy-profile advice.
- Do not generate board, forecast, or next-pocket insights; Task 5 owns that work.
- Do not add UI presentation; Task 6 owns that work.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add AI-generated language, simulations, opponent modeling, probabilities, exact-player availability claims, ADP-as-quality claims, or new recommendation signals.

## Implementation Steps

1. In `src/lib/insights.ts`, add small local roster helpers that keep the Insight Engine pure:
   - build a `Map` of ranking entries by player id from `input.rankings`;
   - collect drafted user players from `input.draft.picks` where `pick.teamId === input.userTeamId`;
   - count rostered players by `Position`;
   - identify bench slots by `slot.label.toUpperCase() === "BENCH"`;
   - identify direct starter slots as non-bench slots with exactly one eligible position;
   - identify flex-style slots as non-bench slots with more than one eligible position.
2. Add a roster-slot analysis helper for a candidate position that derives:
   - direct starter slots and openings;
   - flex slots and openings for flex-eligible positions;
   - bench slots and openings;
   - roster count at the candidate position;
   - total useful capacity for that candidate position.
3. Reuse the existing recommendation `roster_fit` component as the materiality and support gate:
   - positive material `direct_starter_need`, `flex_need`, or `bench_depth` can support roster context;
   - negative material `limited_need`, `saturated`, or `early_def_k` can support roster caveat context;
   - neutral, below-threshold, missing, or unsupported roster-fit evidence should suppress roster insight.
4. Add a candidate selector for roster insights that:
   - checks the leading recommendation first;
   - may check the second or third recommendation only when `summary.scoreGapLabel` is `"close_call"` or `"slight_lean"`;
   - chooses the strongest material roster-fit case using deterministic priority:
     1. open direct starter need;
     2. flex need;
     3. saturated position caveat;
     4. early DST/K timing caveat;
     5. useful bench-depth need;
     6. limited-need caveat;
   - breaks ties by recommendation order.
5. Add `createRosterInsight` output with:
   - `kind: "roster_context"`;
   - `severity: "positive"` for starter, flex, and bench-depth support;
   - `severity: "warning"` for saturated, limited-need, and early DST/K caveats;
   - stable ids such as `roster_context:<timing>:<playerId>`;
   - concise titles and bodies that avoid unsupported future-pick or opponent claims.
6. Keep wording grounded in roster state and configured slots. Use patterns such as:
   - `Open RB starter slot`;
   - `WR still carries flex utility`;
   - `Bench depth is still useful at RB`;
   - `WR is close to saturated`;
   - `QB is a single-start slot here`;
   - `DST is early for this roster phase`.
7. Add the selected insight to `rosterInsights`; leave `boardInsights`, `caveats`, scoring output, and existing primary/candidate/tradeoff behavior unchanged.
8. Extend `src/lib/insights.test.ts` with focused fixtures covering:
   - open RB/WR direct starter need;
   - open flex utility for RB/WR and cautious TE flex language;
   - useful bench-depth context;
   - saturated RB/WR caveat;
   - QB single-start context when another close option has stronger RB/WR roster utility;
   - early DST/K caveat supported by existing roster-fit evidence;
   - neutral or unrelated roster state suppresses roster insight;
   - non-default roster settings derive openings from configured slots;
   - every roster insight includes `roster_fit` support references;
   - equivalent inputs produce deterministic output and inputs are not mutated.
9. Run focused validation:

   ```powershell
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/lib/insights.ts`
- `src/lib/insights.test.ts`

Type changes are not expected. Do not edit `src/types/draft.ts` unless implementation reveals a missing type required by the already-approved Insight Engine contract.

No UI, persistence, scenario, recommendation-engine, forecast, schema, or package files are expected.

## Acceptance Criteria

- Open direct starter needs can produce a supported roster-context insight.
- Flex openings keep eligible positions relevant without overstating TE depth.
- Useful bench-depth needs can produce roster context only when materially supported.
- Saturated or limited-need positions produce caveats only when material to a visible recommendation.
- QB is described as a single-start slot unless league settings support broader utility.
- DST/K caveats appear only when existing recommendation evidence supports early timing concerns.
- Neutral, below-threshold, missing, unsupported, or unrelated roster state suppresses roster insight.
- Non-default roster settings derive insight from configured slots rather than MVP constants.
- Every roster insight references the relevant player and `roster_fit` component.
- Existing primary decision frames, candidate summaries, and tradeoff insights remain deterministic.
- Recommendation scores, ordering, components, adjustments, and reasons are unchanged.
- Focused tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- roster insight generation requires changing recommendation scoring, roster-fit component evidence, or recommendation reason generation;
- deriving the roster requires persistence, React state, scenario contracts, or UI state;
- useful roster wording would require unsupported claims about exact availability, opponents, probabilities, projections, ADP quality, or whole-draft planning;
- the implementation needs board or next-pocket forecast interpretation that belongs in Task 5;
- validation failures require UI, persistence, schema, scenario, recommendation scoring, or forecast changes.

## Slice Review

1. Smallest meaningful increment: yes - this adds one focused insight category without pulling in board notes, UI, or phase exit validation.
2. Executable without redefining the approach: yes - input derivation, materiality gates, priority order, output shape, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - work remains inside the pure Insight Engine.
4. Reasonable blast radius: yes - expected changes are limited to two files.
5. Comfortably reviewable and revertible: yes - no existing recommendation behavior should change.
6. Observable and testable acceptance criteria: yes - roster insight presence, suppression, support references, non-default settings, determinism, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 5: Add Board and Next-Pocket Insights.
