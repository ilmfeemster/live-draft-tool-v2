# Current Slice: Tier Semantics Task 7 - Make Neutral Tier Pressure an Explicit No-Op

## Completion Status

Complete. Focused tests, the full automated suite, and TypeScript validation pass.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Completed prerequisite: Task 5 converts FantasyPros source tiers into metadata and materializes neutral engine-facing tiers.
- Completed prerequisite: Task 6a neutralizes legacy ranking-set rows during repository mapping.
- Completed prerequisite: Task 6b neutralizes legacy persisted draft snapshot tiers during draft hydration.
- Current Recommendation Engine facts:
  - `RecommendationInput` contains `RankingEntry[]`, not ranking-set or snapshot tier metadata;
  - upstream boundaries now guarantee that source-only, absent, and legacy ambiguous tiers reach the engine as `NEUTRAL_TIER`;
  - `calculateTierDropRiskComponent` already produces zero delta when all same-position entries share the neutral tier because no next tier exists;
  - `generatePlayerRecommendations` still emits that zero-delta `tier_cliff` component even though it cannot affect scoring or produce a reason;
  - the legacy `calculateTierDropModifier` path also naturally returns zero for neutral tiers, but the behavior is not explicit or regression-tested as a semantic boundary.

Task 6 still has deferred Canonical JSON and richer snapshot/scenario portability work. Per the current priority, this slice promotes the engine safety task now because the engine-facing neutralization boundaries are complete. It does not reopen those deferred compatibility surfaces.

## Goal

Make neutral recommendation tiers explicitly produce no tier-drop score, score component, or tier-cliff reason while preserving existing behavior for validated non-neutral recommendation-tier inputs.

## Scope

### Goals

- Add an explicit neutral-tier guard to the modern tier-drop component calculation.
- Return a deterministic zero-delta result with inspectable neutral-tier evidence from the pure calculation helper.
- Omit explicit neutral-tier `tier_cliff` components from final `PlayerRecommendation.components`.
- Preserve the existing rule that reasons are created only from positive score components.
- Add an explicit neutral-tier guard to the legacy tier-drop modifier helper.
- Preserve positive tier-pressure behavior for existing non-neutral recommendation-tier test inputs.
- Preserve all non-tier scoring, urgency caps, ordering, tie breakers, and determinism.
- Add focused regression tests for neutral modern and legacy paths.

### Non-Goals

- Do not add tier-semantics metadata to `RecommendationInput` or `DraftWorkspace`.
- Do not make the engine inspect ranking-set source metadata, import records, repositories, or snapshots.
- Do not derive tiers or infer eligibility from rank, position rank, ADP, or source tiers.
- Do not retune tier-pressure constants or unrelated scoring weights.
- Do not remove valid non-neutral tier-pressure behavior.
- Do not update ranking import, repository, snapshot, Canonical JSON, Scenario V1, or replay code.
- Do not update UI copy or manual QA.
- Do not update dependencies or data files.
- Do not update `docs/tasks.md`.

## Implementation Steps

1. Make neutral modern tier input explicit.

   In `src/lib/recommendations.ts`, import `NEUTRAL_TIER` and update `calculateTierDropRiskComponent`.

   After collecting and stably sorting same-position available rankings, detect the neutral semantic state when every represented same-position entry has `tier === NEUTRAL_TIER`.

   Return the normal `tier_cliff` component shape with:

   - `delta: 0`;
   - `direction: "neutral"`;
   - the existing component priority;
   - evidence containing the position, current tier, same-tier count, `nextTier: null`, `tierGap: null`, distance to the next user pick, roster-fit delta, and a stable threshold such as `"neutral_recommendation_tiers"`.

   Keep malformed or empty direct-helper inputs under their existing behavior. Do not add domain validation inside the engine.

2. Stop emitting non-scoring tier components.

   In `generatePlayerRecommendations`, continue calculating the tier component before urgency totals, but omit it from `PlayerRecommendation.components` only when its threshold is `"neutral_recommendation_tiers"`.

   Required behavior:

   - a neutral tier component contributes zero to urgency and context scoring;
   - it is absent from the final component list;
   - it cannot produce a reason because reason selection only sees emitted score components;
   - existing zero-delta diagnostics for non-neutral tier inputs remain available;
   - positive tier components remain emitted exactly as today;
   - score reconciliation remains exact.

   Do not filter unrelated zero-delta components in this slice.

3. Make the legacy helper explicitly neutral.

   In `calculateTierDropModifier`, after collecting same-position rankings, return `{ modifier: 0, reason: null }` when all represented same-position entries use `NEUTRAL_TIER`.

   Preserve every existing positive non-neutral legacy behavior and reason string.

4. Add focused modern-engine tests.

   In `src/lib/recommendations.test.ts`, add tests proving:

   - `calculateTierDropRiskComponent` returns zero with the stable neutral-tier threshold for a position containing only neutral tiers;
   - `generatePlayerRecommendations` emits no `tier_cliff` component for neutral-tier inputs;
   - neutral-tier recommendations contain no tier-cliff reason;
   - total, context, urgency adjustment, and non-tier components still reconcile;
   - repeated evaluation remains deterministic;
   - existing mild, last-in-tier, and major non-neutral tier-pressure tests continue passing unchanged.

5. Add focused legacy-helper coverage.

   In the existing legacy recommendation test section, add or update one test proving `calculateTierDropModifier` returns zero and no reason for neutral same-position entries.

   Do not rewrite the legacy recommendation API or migrate its callers in this slice.

6. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/recommendations.test.ts src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioSession.test.ts
   npx tsc --noEmit
   ```

   The recommendation unit suite proves score/component/reason behavior. Draft and scenario regressions prove that non-tier behavior and deterministic workflows remain intact without changing their source files.

7. Finalize the slice.

   If focused validation passes:

   - update this file's Completion Status to complete;
   - mark Task 7 complete in `docs/patches/tier-semantics-tasks.md`;
   - do not mark Task 6 complete;
   - do not update `docs/tasks.md`;
   - report the deferred Canonical JSON and richer scenario/snapshot portability work separately;
   - do not begin UI or regression-exit work automatically.

## Expected Files

- `src/lib/recommendations.ts`
- `src/lib/recommendations.test.ts`
- `docs/patches/tier-semantics-tasks.md`, after validation, to mark Task 7 complete
- `docs/current-slice.md`, after validation, to record completion status

Do not touch these files in this slice:

- `src/types/draft.ts`
- `src/types/rankings.ts`
- Ranking import, conversion, or repository files
- Ranking snapshot or draft repository mapping files
- Canonical JSON files
- Scenario, replay, or curated-scenario files
- Prisma schema or migrations
- UI components
- fixtures or data files
- `docs/tasks.md`

## Tests

Required focused validation:

```text
npm test -- src/lib/recommendations.test.ts src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioSession.test.ts
npx tsc --noEmit
```

Expected result:

- Neutral engine-facing tiers produce zero tier pressure.
- Neutral tiers emit no `tier_cliff` score component.
- Neutral tiers emit no tier-cliff reason.
- Valid non-neutral tier-pressure tests retain their current deltas, components, reasons, caps, and ordering.
- Roster fit, positional scarcity, observed run pressure, value opportunity, and base ranking behavior remain unchanged.
- Draft and scenario recommendation output remains deterministic.
- No upstream persistence, snapshot, scenario, export, or UI code changes.

## Manual QA

No app manual QA is required for this pure engine slice.

Manual review should confirm:

- the engine checks only the materialized neutral tier value, not source metadata;
- the neutral path changes no score;
- positive tier components remain score-backed;
- reason selection cannot emit a tier reason without an emitted positive component;
- no scoring constants changed.

## Acceptance Criteria

- FantasyPros-derived neutral entries create no tier-drop score, component, or reason.
- Legacy ranking-set and persisted-draft entries neutralized upstream create no tier-drop score, component, or reason.
- `calculateTierDropRiskComponent` exposes a deterministic neutral-tier no-op result.
- `calculateTierDropModifier` returns zero and no reason for neutral tiers.
- Existing non-neutral recommendation-tier scenarios continue producing their current bounded tier pressure.
- Non-tier modifiers, score reconciliation, reason/component linkage, ordering, and deterministic repetition remain unchanged.
- No input-type, import, repository, snapshot, Canonical JSON, Scenario V1, replay, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Focused tests and `npx tsc --noEmit` pass.
- Patch Task 7 is marked complete only after validation passes.

## Failure Handling

- If neutral tiers currently affect scoring through a path other than the two documented tier helpers, stop and report that path before broadening implementation.
- If omitting a neutral tier component breaks score reconciliation, fix only component assembly caused by this slice; do not alter scoring constants.
- If a positive tier-pressure test requires semantics metadata that does not reach the engine, preserve the existing non-neutral materialized-tier contract rather than adding repository or snapshot coupling.
- If draft or scenario regression failures are unrelated to tier component omission, report them rather than modifying those workflows.
- If unrelated worktree changes overlap `recommendations.ts` or its test file, preserve them and report any unsafe conflict.

## Follow-Up

After this slice, reassess the remaining patch work. Canonical JSON evolution and richer Scenario/snapshot portability remain deferred. The next product-facing slice should be Task 8 UI language only if the corrected semantics need user-visible explanation; otherwise plan Task 9 focused regression consolidation. Do not begin either automatically.

## Slice Review

- Smallest meaningful increment: yes. The scoring behavior is already nearly correct; this slice makes the neutral contract explicit and removes misleading output.
- Executable by a lower-reasoning pass: yes. The two helper guards, one component filter, exact evidence, and tests are specified.
- Avoids unnecessary architecture changes: yes. No new metadata channel or engine input type is introduced.
- Blast radius reasonable: yes. Runtime and test changes stay in one recommendation module and its focused test file.
- Review/revert comfort: yes. The neutral guard and component omission are localized.
- Observable/testable acceptance criteria: yes. Exact deltas, component presence, reason presence, and score reconciliation are directly assertable.
