# Current Slice - Task 6: Present Strategic Insights in the Draft Experience

## Status

Pending. This slice is planned for implementation after Phase 6 Task 5.

## Context

Phase 6 Tasks 1-5 created the pure Insight Engine and its domain outputs for neutral bundles, primary decision frames, top-candidate summaries, top-options tradeoffs, roster construction insights, and board/next-pocket insights.

Task 6 exposes those structured insights in the draft experience. The current Draft Room computes `recommendations` in `src/components/DraftRoom.tsx` and passes them into `src/components/RecommendationsPanel.tsx`, where recommendation order, scores, score-backed reasons, and diagnostic score details are already rendered.

This slice should call `generateStrategicInsights` after recommendations are available, pass the resulting bundle to the recommendations panel, and render concise insight output near the recommendation list. The work must preserve recommendation ordering, scoring, reasons, pick entry, undo, reset, persisted draft load, scenario import/replay, transient restart, and score detail diagnostics.

## Goal

Display the current strategic insight bundle in the Draft Room so users can see the current decision frame, top candidate context, strongest tradeoff, and one roster or board note while keeping existing recommendation details available.

## Scope

### Goals

- Call `generateStrategicInsights` from `src/components/DraftRoom.tsx` after the active recommendations are selected.
- Use the currently displayed draft context:
  - `displayedDraft`;
  - `activeRankings`;
  - `activeLeagueSettings`;
  - `displayedDraft.userTeamId`;
  - `recommendations`.
- Pass the resulting `StrategicInsightBundle` into `RecommendationsPanel`.
- Render a compact insight area near the top of the recommendations panel when there is at least one non-neutral insight.
- Display, when present:
  - `primaryInsight`;
  - the first `candidateInsights` item;
  - the first `tradeoffInsights` item;
  - the first useful roster or board insight, preferring `rosterInsights[0]` and falling back to `boardInsights[0]`;
  - any future `caveats` if present.
- Gracefully suppress the insight area when the bundle is neutral or all insight arrays are empty.
- Preserve existing recommendation list, score-backed reason pills, score details, raw components, cap adjustments, and draft buttons.
- Keep the presentation compact, scannable, and narrow in blast radius.

### Non-goals

- Do not redesign the Draft Room broadly.
- Do not add controls, settings, filters, toggles, scoring controls, or recommendation tuning UI.
- Do not change recommendation scoring, ordering, reasons, components, caps, or forecast behavior.
- Do not change the Insight Engine contract or domain wording unless an implementation blocker is found.
- Do not persist insight output or change database/schema/scenario contracts.
- Do not add live-provider integration.
- Do not introduce opponent modeling, probabilities, exact-player availability claims, AI-generated reasoning, projections, VORP, or ADP-as-quality language.
- Do not add package dependencies.

## Implementation Steps

1. In `src/components/DraftRoom.tsx`, import `generateStrategicInsights`.
2. Add a `useMemo` that derives `strategicInsights` from:
   - `displayedDraft`;
   - `activeRankings`;
   - `activeLeagueSettings`;
   - `recommendations`;
   - `displayedDraft.userTeamId`.
   Keep dependencies explicit so insights recompute after pick, undo, reset, persisted load, transient scenario import, replay-target changes, and transient restart.
3. Pass `strategicInsights` to `RecommendationsPanel`.
4. In `src/components/RecommendationsPanel.tsx`, update props to accept `strategicInsights: StrategicInsightBundle`.
5. Add a small rendering helper that collects visible insights in deterministic order:
   1. `primaryInsight`;
   2. `candidateInsights[0]`;
   3. `tradeoffInsights[0]`;
   4. `rosterInsights[0] ?? boardInsights[0]`;
   5. all `caveats`.
6. Render the insight area only when the collected list is non-empty.
7. Use the existing `Insight` fields directly:
   - title as the compact label;
   - body when present;
   - severity for quiet visual treatment.
   Keep styling local and restrained, using existing Tailwind conventions. Do not place the insight area inside each recommendation card.
8. Keep the neutral/empty state clean:
   - no insight area for empty recommendations or `no_material_insight` with no insight items;
   - existing "No recommendations available." behavior remains unchanged.
9. Extend `src/components/RecommendationsPanel.test.tsx` with focused rendering coverage:
   - primary/candidate/tradeoff/roster-or-board insights render in deterministic order;
   - neutral bundles do not render the insight area;
   - existing recommendation order, score text, reason pills, diagnostics, and disabled draft button behavior remain unchanged.
10. Extend `src/components/DraftRoom.test.tsx` with focused render-boundary coverage:
    - Draft Room renders a supported Insight Engine message when recommendation evidence supports one;
    - recommendation ordering, scores, reasons, and diagnostic timing component output remain visible;
    - normalization failure still does not fabricate overall-tier or draft-pocket timing insights.
11. Run focused validation:

   ```powershell
   npm test -- src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
   npm test -- src/lib/insights.test.ts
   npx tsc --noEmit
   git diff --check
   ```

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/RecommendationsPanel.tsx`
- `src/components/DraftRoom.test.tsx`
- `src/components/RecommendationsPanel.test.tsx`

Insight Engine source changes are not expected. Do not edit `src/lib/insights.ts` or `src/types/draft.ts` unless implementation reveals a blocker in the already-approved presentation contract.

No persistence, schema, scenario serialization, recommendation-engine, forecast-construction, package, or ranking import files are expected.

## Acceptance Criteria

- Draft Room users can see the current decision frame and concise supported insight near recommendations.
- Insight output updates from the same displayed draft/recommendation state used by the current recommendation panel.
- Pick, undo, reset, persisted load, replay-target changes, scenario import, and transient restart continue to recompute or display the appropriate recommendations and insights.
- Empty or neutral bundles do not create broken, empty, or misleading UI.
- Existing recommendation details remain accessible, including scores, reason pills, raw components, cap adjustments, and score-backed reasons.
- The UI does not display unsupported opponent, probability, exact-player availability, AI, projection, VORP, or ADP-quality claims.
- Recommendation scores, ordering, components, adjustments, reasons, forecast output, profile transitions, and insight generation behavior are unchanged.
- Focused component tests, focused Insight Engine regression tests, TypeScript validation, and `git diff --check` pass.

## Failure Conditions

Stop and report instead of broadening the slice if:

- presenting insights requires changing recommendation scoring, reason generation, forecast construction, profile transitions, or Insight Engine semantics;
- the UI needs a broad Draft Room redesign to fit the insight output;
- persisted drafts, scenarios, replay, or transient sessions require serialization of insight output;
- useful wording would require unsupported claims about exact player availability, opponents, probabilities, projections, ADP quality, or whole-draft planning;
- validation failures require persistence, schema, scenario serialization, recommendation-engine, forecast, or import changes.

## Slice Review

1. Smallest meaningful increment: yes - this only presents existing insight output in the Draft Room.
2. Executable without redefining the approach: yes - computation location, props, rendering order, tests, and validation commands are explicit.
3. Avoids unnecessary architecture changes: yes - Insight Engine remains pure and derived; UI receives a computed bundle.
4. Reasonable blast radius: yes - expected changes are limited to four component/test files.
5. Comfortably reviewable and revertible: yes - recommendation behavior and persistence contracts should not change.
6. Observable and testable acceptance criteria: yes - insight rendering, suppression, preserved diagnostics, and validation commands are directly testable.

## Follow-up

After this slice passes, promote Task 7: Complete Phase 6 Regression and Exit Validation.
