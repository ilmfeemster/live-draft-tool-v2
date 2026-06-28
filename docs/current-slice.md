# Current Slice: Add Recommendation Diagnostics and Debugger

## Source Context

Phase 4 Task 9: Add Recommendation Diagnostics and Debugger.

Tasks 1 through 8 are complete. Manual, hydrated persisted, replayed, imported, and curated draft states all converge on the same pure Recommendation Engine. Existing `PlayerRecommendation` output already includes ranking data, base score, context score, final total, raw components, evidence, and score-backed reasons. The remaining reconciliation gap is that urgency and context caps can change the applied score without exposing those adjustments.

The current `RecommendationsPanel` already receives the engine's authoritative ordered array from `DraftRoom`. This slice can add a read-only native-details debugger there without new state, routing, or DraftRoom orchestration.

## Goal

Make every recommendation total arithmetically reconcilable from engine-owned structured output and display that output in a compact read-only debugger while preserving scoring, reasons, and returned order exactly.

## Scope

### Goals

- Add a small structured score-adjustment type to recommendation output.
- Expose urgency-cap adjustment only when raw urgency exceeds its configured cap.
- Expose context-cap adjustment only when raw context exceeds its positive or negative configured bound.
- Ensure raw component deltas plus adjustment deltas reconcile to the final total.
- Preserve all existing component values, evidence, reasons, totals, and ordering.
- Add an expandable read-only diagnostics section to each existing recommendation card.
- Display returned position, ranking/tie-break values, base score, context subtotal, final total, raw components, cap adjustments, and exact engine reasons.
- Keep positive, neutral, and negative component/adjustment values visible.
- Make the debugger available automatically for existing manual and hydrated persisted DraftRoom workflows.
- Add focused engine and static-render component coverage.

### Non-Goals

- Recalculating totals, caps, reasons, or recommendation order in React.
- Changing scoring weights, tuning defaults, cap behavior, comparator behavior, or reason selection.
- Adding a new tie-break model.
- Sorting or filtering recommendations in the UI.
- Editing weights, live tuning, strategy profiles, or recommendation inputs.
- AI-generated explanations or new recommendation factors.
- Persisting or exporting diagnostics or recommendations.
- Scenario-session UI, selectors, import/export controls, reset, or restart.
- Redesigning the Draft Room or recommendation cards.
- Adding package dependencies or a disclosure component library.
- Beginning Phase 4 Task 10.

## Engine Output Contract

Update `src/types/draft.ts` with:

```ts
export type RecommendationScoreAdjustmentId =
  | "urgency_cap"
  | "context_cap";

export type RecommendationScoreAdjustment = {
  id: RecommendationScoreAdjustmentId;
  delta: number;
  direction: RecommendationScoreComponentDirection;
  evidence: {
    rawScore: number;
    adjustedScore: number;
    minScore?: number;
    maxScore?: number;
  };
};
```

Add this required field to `PlayerRecommendation`:

```ts
scoreAdjustments: RecommendationScoreAdjustment[];
```

Use the existing direction vocabulary:

- Positive delta -> `positive`.
- Negative delta -> `negative`.
- Zero delta -> `neutral`, although zero adjustments are not emitted.

The adjustment collection is engine-owned derived output. It is not added to scenario data, persistence, or export.

## Adjustment Semantics

Update `generatePlayerRecommendations` in `src/lib/recommendations.ts` without changing scoring results.

### Urgency Cap

Define:

```text
raw urgency = tier_cliff + positional_scarcity + positional_run
applied urgency = min(raw urgency, maxUrgencyScore)
urgency adjustment = applied urgency - raw urgency
```

When the adjustment is non-zero, emit:

```ts
{
  id: "urgency_cap",
  delta: appliedUrgency - rawUrgency,
  direction: "negative",
  evidence: {
    rawScore: rawUrgency,
    adjustedScore: appliedUrgency,
    maxScore: tuning.maxUrgencyScore,
  },
}
```

Do not modify the raw urgency component deltas. Their original values remain the evidence for why the cap was needed.

### Context Cap

After applying the urgency cap, define:

```text
raw context = roster_fit + applied urgency + value_opportunity
applied context = clamp(raw context, min context, max context)
context adjustment = applied context - raw context
```

When the adjustment is non-zero, emit:

```ts
{
  id: "context_cap",
  delta: appliedContext - rawContext,
  direction: delta > 0 ? "positive" : "negative",
  evidence: {
    rawScore: rawContext,
    adjustedScore: appliedContext,
    minScore: tuning.maxNegativeContextScore,
    maxScore: tuning.maxPositiveContextScore,
  },
}
```

A positive adjustment is expected when a negative raw context is raised to the configured minimum; it is still a cap/floor reconciliation adjustment rather than a strategic bonus.

### Ordering and Reconciliation

Store adjustments in applied calculation order:

1. `urgency_cap`, when present.
2. `context_cap`, when present.

For every recommendation:

```text
sum(recommendation.components[].delta)
+ sum(recommendation.scoreAdjustments[].delta)
= recommendation.totalScore
```

Use tolerance only for unavoidable floating-point comparison in tests. Do not round engine values or change score calculation order to make display arithmetic prettier.

Reasons continue to be selected from raw scoring components exactly as today. Adjustments do not generate reasons in this slice, and existing reason content/order must remain unchanged.

## Read-Only Debugger

Update `src/components/RecommendationsPanel.tsx` rather than adding DraftRoom state or a separate route.

For each recommendation card, retain the existing rank badge, player identity, score, reasons, and Draft button. Add a native `<details>` block below the existing reason chips with summary text `Score details`.

The expanded content should display engine-owned values only.

### Ordering and Ranking Context

- `Returned #<index + 1>` from the existing mapped array position.
- Player ID.
- Overall rank.
- Position rank.

The returned position is display-only. Do not sort a copied array or reproduce `comparePlayerRecommendations`.

### Score Summary

- Final total from `totalScore`.
- Base value from `baseScore`.
- Applied context subtotal from `contextScore`.

Use consistent numeric formatting, preferably two decimal places in diagnostics. Keep the existing one-decimal summary score unchanged.

### Raw Components

Render every `components` entry in its engine-provided order with:

- Component ID.
- Signed raw delta.
- Direction.
- Evidence as compact key/value rows when present.

Do not hide zero or negative components. Negative roster/timing/value components are the current penalty representation and must remain inspectable.

Formatting evidence keys and primitive values is allowed. Do not interpret evidence into new strategic claims.

### Cap Adjustments

- Render every `scoreAdjustments` entry in engine order with ID, signed delta, direction, raw score, adjusted score, and configured bound evidence.
- When the array is empty, render `No cap adjustments.`.
- Label this section `Cap adjustments` so it cannot be confused with scoring factors.

### Score-Backed Reasons

- Render the existing `reasons` array in its engine order.
- Show reason ID, source component ID, and exact reason text.
- When there are no reasons, render `No score-backed reasons.`.

Do not create debugger-only explanations or modify reason text.

## Presentation Constraints

- Use semantic HTML (`details`, `summary`, lists, definition-style labels) and existing Tailwind utilities.
- Keep the debugger visually subordinate to the existing recommendation and Draft action.
- Keep it read-only: no inputs, sliders, toggles that change values, or mutation callbacks.
- A native disclosure is sufficient; do not add component state or a dependency.
- Add small local formatting helpers only for signed numeric display and evidence primitive rendering.
- Formatting helpers must not sum scores, infer caps, or calculate rank/order.

## Testing Strategy

### Engine Tests

Extend `src/lib/recommendations.test.ts`.

Required cases:

1. An uncapped recommendation returns `scoreAdjustments: []`.
2. An urgency-capped recommendation exposes exact raw, adjusted, max, and negative delta values.
3. A positive context cap exposes the correct negative adjustment and bounds.
4. A negative context floor exposes the correct positive adjustment and bounds.
5. A case where both urgency and context caps apply emits both adjustments in calculation order.
6. For capped and uncapped recommendations, component delta sum plus adjustment delta sum equals final total within floating-point tolerance.
7. Existing `totalScore`, `baseScore`, `contextScore`, component values, recommendation order, and reasons remain unchanged.

Use the existing cap-oriented fixtures and tuning overrides near the current context/urgency tests rather than creating a parallel test harness.

### Component Tests

Add `src/components/RecommendationsPanel.test.tsx` using the existing `renderToStaticMarkup` strategy.

Build a small `PlayerRecommendation[]` fixture containing:

- At least one positive component.
- At least one negative component/penalty.
- An urgency-cap adjustment.
- A context-cap adjustment.
- A score-backed reason.

Assert that markup includes:

- Recommendations in supplied order and returned positions.
- Existing visible summary scores and reason text.
- `Score details`, player/ranking values, total/base/context values.
- Raw positive and negative deltas.
- Both cap IDs and their evidence values.
- Exact reason ID, source component ID, and text.
- Draft buttons retain existing enabled/disabled behavior.
- No-cap and no-reason fallback text in a second fixture/state.

Static rendering does not need to simulate expanding `<details>`; its child markup is rendered and directly assertable.

Existing `DraftRoom.test.tsx` already proves the loaded persisted workspace preserves engine ordering, displayed score, and reasons. Do not modify it unless the required `PlayerRecommendation` type addition creates a direct compile failure there.

## Implementation Steps

1. Add `RecommendationScoreAdjustment` types and required `scoreAdjustments` output to `src/types/draft.ts`.
2. Update `generatePlayerRecommendations` to calculate and emit non-zero urgency/context adjustments without changing totals, components, reasons, or sorting.
3. Extend `src/lib/recommendations.test.ts` with adjustment, reconciliation, and unchanged-output coverage.
4. Extend `src/components/RecommendationsPanel.tsx` with the native read-only diagnostics disclosure while preserving existing cards and actions.
5. Add `src/components/RecommendationsPanel.test.tsx` for ordering, positive/negative values, caps, evidence, reasons, fallbacks, and button states.
6. Run focused engine, scenario, curated, panel, and DraftRoom tests, then the full suite, lint, and TypeScript validation.
7. If all acceptance criteria and validation pass, check only Phase 4 Task 9 complete in `docs/tasks.md`. Do not begin Task 10.

## Expected Files

- `src/types/draft.ts`
- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `src/components/RecommendationsPanel.tsx`
- `src/components/RecommendationsPanel.test.tsx`
- `docs/tasks.md` only to mark Phase 4 Task 9 complete after validation passes

Five production/test files plus the completion checkbox are expected. No DraftRoom production change is needed because it already passes current manual and hydrated recommendations into the panel.

Do not modify scenario contracts/data, replay, portability, persistence, actions, Prisma, or other Draft Room components. If the existing panel cannot display the engine-owned output without calculating domain values, stop and report the missing structured field rather than duplicating logic in the UI.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/curatedScenarios.test.ts src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused engine, scenario, curated, panel, and DraftRoom tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because the debugger uses server-renderable semantic markup over already-tested engine output. Automated render coverage is sufficient for this read-only slice.

## Acceptance Criteria

- Every recommendation includes an engine-owned `scoreAdjustments` collection.
- Uncapped recommendations expose an empty collection.
- Urgency and positive/negative context caps expose exact non-zero reconciliation adjustments only when applied.
- Raw components remain unchanged and visible.
- Component deltas plus adjustment deltas reconcile to the final total.
- Existing scores, reasons, deterministic ordering, and recommendation behavior are unchanged.
- Every recommendation card exposes a read-only `Score details` disclosure.
- The debugger displays returned position, player/ranking context, final/base/context scores, all raw components, negative penalties, cap adjustments, evidence, and exact reasons.
- The UI preserves the engine array order and performs no scoring, cap, reason, or comparator logic.
- Manual and hydrated persisted DraftRoom recommendations automatically receive the debugger.
- Diagnostics are neither persisted nor exported.
- No tuning controls, package dependency, route, or Draft Room redesign is introduced.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- Only Phase 4 Task 9 is checked complete after implementation validation.
- Task 10 is not started.

## Failure Handling

- If raw components and adjustments do not reconcile, fix adjustment calculation in the Recommendation Engine; do not patch totals in the UI.
- If adding `scoreAdjustments` changes order, reasons, or totals, stop and correct the engine refactor before proceeding.
- If a diagnostic value is unavailable, add only the smallest engine-owned structured field justified by the acceptance criteria; do not infer it from React state.
- If static markup cannot cover interactive disclosure toggling, assert its semantic markup and read-only contents; do not add a browser test dependency.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 10: Add Transient Scenario Session, Reset, Restart, and Dirty-State Behavior. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. One engine diagnostic collection closes arithmetic gaps, and one native disclosure makes it usable without workbench orchestration.
- Concrete enough for implementation: yes. Types, formulas, ordering, evidence, UI fields, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. It extends existing derived output and existing recommendation cards without new state or routes.
- Blast radius reasonable: yes. Two engine/type files, two focused tests, and one existing component are changed/added; the task checkbox is documentation-only completion tracking.
- Review/revert comfort: yes. The scoring path remains behaviorally identical and the UI addition is isolated and read-only.
- Observable/testable acceptance criteria: yes. Exact adjustment evidence, reconciliation, unchanged ordering/reasons, and rendered diagnostics are directly asserted.
