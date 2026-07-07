# Current Slice - Task 3: Add Top-Options Tradeoff Insights

## Status

Complete. Task 3 passed focused validation on 2026-07-06.

## Context

Phase 6 Tasks 1-2 created the pure Insight Engine contract, neutral bundle behavior, score-gap labels, primary decision frames, and top-candidate summaries.

Task 3 should add the next layer of strategic value: one concise explanation of the strongest meaningful contrast among the top recommendations. The user often already sees the ordered list; this slice should help explain what kind of choice the top two or three options represent.

This slice remains inside the pure Insight Engine. It must not change recommendation scoring, ordering, reason generation, forecast behavior, UI presentation, persistence, or scenario contracts.

## Goal

Generate one deterministic `tradeoff` insight when the top recommendations are close enough and their existing components show a meaningful contrast, such as player quality versus roster fit, player quality versus timing pressure, or roster fit versus timing pressure.

## Scope

### Goals

- Compare the top two or three recommendations in their existing order.
- Generate at most one `tradeoff` insight in `tradeoffInsights`.
- Only consider tradeoffs when the current `summary.scoreGapLabel` is `"close_call"` or `"slight_lean"`.
- Identify supported material differences across:
  - player quality, from `baseScore` and supported `base_value` evidence;
  - roster fit, from supported material `roster_fit` evidence;
  - timing pressure, from supported material `draft_pocket_timing`, `tier_cliff`, `positional_scarcity`, or `positional_run` evidence;
  - value opportunity, from supported material `value_opportunity` evidence;
  - caveats, from supported material negative components.
- Prefer the highest-value supported contrast in deterministic priority order:
  1. player quality versus roster/timing;
  2. roster fit versus timing pressure;
  3. player quality versus caveat;
  4. value opportunity versus roster/timing;
  5. close same-strength cluster.
- Include `supportedBy` references for every player/component used by the tradeoff.
- Preserve existing primary decision frames and candidate summaries unless a small helper extraction is needed.
- Keep tradeoff wording concise and grounded in existing evidence.

### Non-goals

- Do not change recommendation scores, ordering, components, adjustments, reasons, caps, or forecast behavior.
- Do not generate roster construction summaries; Task 4 owns roster insight.
- Do not generate board or next-pocket notes beyond interpreting material timing components already present in recommendations; Task 5 owns board/pocket insight.
- Do not call the Insight Engine from UI or application workflows.
- Do not add UI presentation.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add AI-generated language, simulations, opponent modeling, probabilities, exact-player availability claims, ADP-as-quality claims, or new recommendation signals.
- Do not manufacture tradeoffs when the top option is clearly ahead or component differences are immaterial.

## Implementation Steps

1. In `src/lib/insights.ts`, add local helpers for classifying each of the top recommendations by supported strengths:
   - `player_quality`
   - `roster_fit`
   - `timing_pressure`
   - `value_opportunity`
   - `caveat`
2. Reuse or extract existing support/component helper logic from Task 2 rather than creating a second parallel interpretation path.
3. Add a tradeoff selection helper that:
   - receives the already-ordered recommendations and derived score-gap label;
   - immediately returns `null` unless the score-gap label is `"close_call"` or `"slight_lean"`;
   - compares only the top two recommendations by default, consulting the third only when it has the clearest supported contrasting strength and remains within the same close/slight score band;
   - never reorders recommendations or changes `summary.leadingPlayerId`.
4. Implement deterministic tradeoff priority:
   - If one candidate has the strongest player-quality case and another has supported roster or timing strength, emit a player-quality-versus-roster/timing tradeoff.
   - If one candidate has supported roster fit and another has supported timing pressure, emit a roster-versus-timing tradeoff.
   - If one candidate has the strongest player-quality case but also has a supported caveat while another has no material caveat, emit a player-quality-versus-caveat tradeoff.
   - If one candidate has supported value opportunity and another has supported roster or timing strength, emit a value-versus-roster/timing tradeoff.
   - If the top options are close and share the same supported primary strength, emit a restrained close-cluster tradeoff only when both sides have traceable support.
5. Add deterministic tradeoff titles and bodies. Use wording such as:
   - `Player quality versus roster/timing`
   - `Roster fit versus timing pressure`
   - `Value versus roster/timing`
   - `Close options with similar support`
   Avoid exact-player availability, opponent behavior, probability, projection, ADP-as-quality, or certainty language.
6. Add the selected insight to `tradeoffInsights`; leave `rosterInsights`, `boardInsights`, and `caveats` unchanged.
7. Extend `src/lib/insights.test.ts` with fixtures covering:
   - stronger player-quality candidate versus stronger roster-fit candidate;
   - stronger roster/timing candidate versus stronger base-value candidate;
   - roster fit versus timing pressure;
   - player quality with caveat versus cleaner alternative;
   - value opportunity versus roster/timing;
   - close same-strength cluster;
   - clear leader suppresses tradeoff;
   - same-position or no-supported-contrast case suppresses tradeoff;
   - deterministic support references include both sides of the tradeoff;
   - repeated equivalent inputs produce identical tradeoff output.
8. Run focused validation:

   ```powershell
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/lib/insights.ts`
- `src/lib/insights.test.ts`

Type changes are not expected. Do not edit `src/types/draft.ts` unless implementation reveals a missing type required by the already-approved contract.

No UI, persistence, scenario, recommendation-engine, or forecast files are expected.

## Acceptance Criteria

- Close top options with different supported strengths produce exactly one deterministic `tradeoff` insight.
- A stronger overall player versus stronger roster-fit option is explained without implying certainty.
- A stronger roster/timing option versus stronger base-value option is explained using existing component evidence.
- Timing-pressure tradeoffs appear only when timing components materially support them.
- Clear leaders do not receive unnecessary tradeoff text.
- Same-position or no-supported-contrast cases suppress tradeoff output.
- Every tradeoff references the relevant players and supporting components.
- Primary decision frames and candidate summaries from Task 2 remain deterministic.
- Recommendation scores, ordering, components, adjustments, and reasons are unchanged.
- Focused tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- tradeoff generation requires new recommendation scoring signals or changed recommendation components;
- deciding the tradeoff requires broad roster reconstruction that belongs in Task 4;
- deciding the tradeoff requires board/pocket analysis beyond existing material recommendation components and should wait for Task 5;
- supporting the desired wording would require unsupported claims about exact availability, opponents, probabilities, projections, or ADP quality;
- validation failures require UI, persistence, scenario, schema, recommendation scoring, or forecast changes.

## Slice Review

1. Smallest meaningful increment: yes - this adds one focused insight category without pulling in roster summaries, board notes, or UI.
2. Executable without redefining the approach: yes - comparison scope, priority order, supported evidence, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - work remains inside the pure Insight Engine.
4. Reasonable blast radius: yes - expected changes are limited to two files.
5. Comfortably reviewable and revertible: yes - no existing recommendation behavior should change.
6. Observable and testable acceptance criteria: yes - tradeoff presence, suppression, support references, determinism, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 4: Add Roster Construction Insights.

## Completion Notes

Completed on 2026-07-06.

- Added top-options tradeoff selection in `src/lib/insights.ts`.
- Classified supported candidate strengths for player quality, roster fit, timing pressure, value opportunity, and caveats using existing recommendation components only.
- Added deterministic tradeoff priority for player quality versus roster/timing, roster fit versus timing pressure, player quality with caveat, value versus roster/timing, and close same-strength clusters.
- Added concise `tradeoff` insight output with traceable `supportedBy` references for both sides.
- Preserved existing primary decision frames, candidate summaries, recommendation scoring, ordering, reasons, forecast behavior, UI, persistence, and scenario contracts.
- Extended `src/lib/insights.test.ts` to 29 focused tests covering tradeoff presence, suppression, support references, determinism, and immutability.
- Confirmed `npm test -- src/lib/insights.test.ts`, `npx tsc --noEmit`, and `git diff --check` pass.
