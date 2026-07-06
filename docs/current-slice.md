# Current Slice - Task 1: Add the Insight Engine Contract and Neutral Bundle

## Status

Complete. Task 1 passed focused validation on 2026-07-06.

## Context

Phase 6 introduces a pure Strategy & Insight Engine above the existing Recommendation Engine. The Insight Engine explains the current draft decision by interpreting draft state, league settings, immutable ranking snapshot entries, recommendation output, and supported forecast observations.

This first slice should create only the domain contract and deterministic neutral output. It should not generate visible strategic advice, change recommendation scoring, change recommendation ordering, integrate with the Draft Room, or add UI presentation.

The existing domain types live in `src/types/draft.ts`. The current Recommendation Engine is implemented in `src/lib/recommendations.ts`, and Phase 5.5 forecast/profile evidence is implemented in `src/lib/draftPocketForecast.ts`. This slice should add a separate pure Insight Engine module rather than mixing insight behavior into recommendation scoring.

## Goal

Define the Phase 6 Insight Engine boundary and return a stable neutral insight bundle for empty, missing, or not-yet-interpreted recommendation states.

## Scope

### Goals

- Add Insight Engine domain types for input, output bundle, summary, insights, support references, suppressed signals, insight kinds, severities, decision frames, score-gap labels, and suppression reasons.
- Add a pure `generateStrategicInsights` function that accepts typed draft state, league settings, user team id, ranking entries, player recommendations, and optional draft-pocket forecast output.
- Return deterministic neutral output with `decisionFrame: "no_material_insight"` before any strategy-specific insight selection exists.
- Represent empty recommendation states safely with `leadingPlayerId: null` and `scoreGapLabel: "unavailable"`.
- Include empty arrays for candidate insights, tradeoff insights, roster insights, board insights, caveats, and suppressed signals.
- Keep the new module independent of React, Prisma, repositories, raw import formats, mutable ranking sets, and UI state.
- Add focused unit tests for neutral output, empty recommendations, one recommendation, multiple recommendations, determinism, and input immutability.

### Non-goals

- Do not generate primary decision frames beyond the neutral default.
- Do not generate top-candidate summaries, tradeoff insights, roster insights, board insights, next-pocket insights, caveats, or capability notes yet.
- Do not call the Insight Engine from the Draft Room or any existing UI.
- Do not change recommendation scores, ordering, components, adjustments, reasons, caps, or forecast behavior.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add AI-generated language, simulations, opponent modeling, probabilities, exact-player availability claims, or new recommendation signals.

## Implementation Steps

1. In `src/types/draft.ts`, add the Insight Engine type contract:
   - `InsightInput`
   - `StrategicInsightBundle`
   - `CurrentDecisionSummary`
   - `Insight`
   - `InsightSupport`
   - `SuppressedSignal`
   - string-union types for insight kind, severity, decision frame, score-gap label, and suppression reason.
2. Keep support references optional and traceable to existing domain evidence:
   - `playerId`
   - `componentId`
   - `evidenceKeys`
   - `reasonId`
   - `scoreAdjustmentId`
   - `forecastProfileId`
3. Create `src/lib/insights.ts` with `generateStrategicInsights(input: InsightInput): StrategicInsightBundle`.
4. Implement only neutral bundle behavior:
   - `summary.leadingPlayerId` should be the first recommendation's `playerId` when one exists, otherwise `null`;
   - `summary.decisionFrame` should always be `"no_material_insight"` in this slice;
   - `summary.scoreGapLabel` should be `"unavailable"` for zero or one recommendation and may remain `"unavailable"` for multiple recommendations until Task 2 introduces materiality labels;
   - all insight arrays should be empty;
   - the function must not mutate input objects or arrays.
5. Add `src/lib/insights.test.ts` using existing test fixture style from `src/lib/recommendations.test.ts`.
6. Cover:
   - empty recommendations return a complete neutral bundle;
   - one recommendation sets `leadingPlayerId` but still returns neutral insight arrays;
   - multiple recommendations keep current neutral behavior without changing or sorting recommendations;
   - repeated equivalent inputs return exactly equal output;
   - the function does not mutate the draft, rankings, recommendations, or forecast input.
7. Run focused validation:

   ```powershell
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/types/draft.ts`
- `src/lib/insights.ts`
- `src/lib/insights.test.ts`

No documentation updates are expected during implementation unless a contradiction is discovered.

## Acceptance Criteria

- The Insight Engine can be called with current draft inputs and recommendation output.
- The returned bundle has stable structured fields and deterministic defaults.
- Empty recommendations return `no_material_insight` without throwing.
- One or more recommendations preserve the first recommendation as `leadingPlayerId` without creating strategic advice yet.
- Insight, support, and suppressed-signal types can reference existing player, component, reason, adjustment, evidence, and forecast-profile identifiers.
- No database, UI, mutable ranking-set, import-format, or React type crosses into the Insight Engine boundary.
- Recommendation scores, ordering, components, adjustments, and reasons are unchanged.
- Focused tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- the existing recommendation output lacks enough structured data to define the contract without changing Recommendation Engine behavior;
- implementing the neutral bundle requires UI, persistence, scenario, or recommendation-scoring changes;
- type additions conflict with existing domain types or phase boundaries;
- validation failures are unrelated to this slice.

## Slice Review

1. Smallest meaningful increment: yes - this creates only the Phase 6 contract and neutral output.
2. Executable without redefining the approach: yes - the expected files, types, function behavior, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - it adds one pure domain module above recommendations and no service, persistence, or UI boundary.
4. Reasonable blast radius: yes - expected changes are limited to three files.
5. Comfortably reviewable and revertible: yes - no existing behavior should change.
6. Observable and testable acceptance criteria: yes - neutral output, determinism, immutability, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 2: Generate Primary Decision Frames and Top-Candidate Summaries.

## Completion Notes

Completed on 2026-07-06.

- Added the Phase 6 Insight Engine type contract in `src/types/draft.ts`.
- Added `generateStrategicInsights` in `src/lib/insights.ts` with deterministic neutral bundle behavior only.
- Added focused tests in `src/lib/insights.test.ts` covering empty, single, multiple, deterministic, and immutability behavior.
- Confirmed `npm test -- src/lib/insights.test.ts`, `npx tsc --noEmit`, and `git diff --check` pass.
- No recommendation scoring, ordering, reasons, forecast behavior, UI, persistence, or scenario contracts changed.
