# Current Slice — Task 10: Integrate Between-Turn Draft-Pocket Recommendation Previews

## Status

Planned. Not yet implemented.

## Goal

Use the normalized immutable ranking context at the existing persisted and transient recommendation entry points so recommendations, forecast evidence, scores, and reasons recalculate after every supported draft-state change, including between the user's turns.

This slice wires existing Phase 5.5 behavior into live session flows. It must not change forecast construction, scoring, reason semantics, draft transitions, scenario contracts, or recommendation presentation.

## Current Behavior

- `DraftRoom` receives `recommendationRankingContextResult` from the loaded persisted workspace but does not pass a successful context into `generatePlayerRecommendations`.
- Transient sessions create and retain `recommendationRankingContextResult`, but their shared recommendation helper does not pass it to the engine.
- Persisted pick, undo, reset, and load transitions already replace `activeDraft`, causing the existing memoized recommendation call to rerun.
- Transient pick, undo, reset, restart, and replay-target transitions already rebuild or update the session and its recommendations.
- `RecommendationsPanel` already distinguishes the user's turn through `isUserPick`; no presentation change is required for this wiring slice.

## Scope

### Goals

- Pass a successful persisted workspace recommendation context into every `DraftRoom` recommendation calculation.
- Recompute transient-session recommendations with the session's successful normalized context at initial scenario load, local pick, undo, reset, restart, and replay-target replacement.
- Keep failed structured context results from being converted into guessed or partial context.
- Preserve one shared engine rule for on-turn and between-turn forecast targets.
- Verify that newly drafted players are excluded and forecast evidence refreshes after supported state changes.
- Preserve final-user-pick behavior, where recommendations remain usable and future timing is neutral.
- Preserve existing Draft Room responsiveness, ordering, score caps, reasons, draft invariants, and transient-session identity rules.

### Non-goals

- Do not change `generatePlayerRecommendations`, forecast construction, pocket analysis, scoring, caps, ordering, or reason builders.
- Do not change scenario serialization or introduce the Phase 5.5 portable scenario contract; that belongs to Task 11.
- Do not update the standalone scenario replay engine, scenario portability, or workbench export format; version-aware replay integration belongs to Task 12.
- Do not persist forecasts, score output, reasons, or recommendation results.
- Do not add caching, debouncing, background work, precomputation, opponent simulation, or probabilities.
- Do not redesign `RecommendationsPanel`, Draft Room controls, or unrelated UI.
- Do not infer overall tiers or fabricate context when normalization returned a structured failure.

## Implementation Steps

1. Update `DraftRoom` to retain the `recommendationRankingContextResult` prop and pass `result.context` to `generatePlayerRecommendations` only when the result is successful.
2. Keep persisted recommendations derived through the existing `useMemo` so load, accepted pick, undo, and reset draft replacements automatically recalculate from the current draft, immutable rankings, league settings, and normalized context.
3. Extend the private transient-session recommendation helper to accept the retained `RecommendationRankingContextResult` and pass a successful context into `generatePlayerRecommendations` without creating a fallback for failed results.
4. At transient scenario creation, recompute recommendations from the imported target draft and the newly normalized context instead of retaining the context-absent recommendation array returned by the current V1 import/replay path.
5. Route transient local pick, undo, and restart calculations through the same context-aware helper. Preserve the existing reset and replay-target behavior, which recreate the session and therefore re-enter the same helper.
6. Update `DraftRoom.test.tsx` so its expected loaded-workspace output is generated with the successful workspace context and proves Phase 5.5 components/reasons reach the render boundary while drafted players remain absent.
7. Update `scenarioSession.test.ts` and its expectation helper to use the session's successful context. Add focused assertions covering initial load, between-turn and on-turn transitions, drafted-player exclusion, refreshed target/status evidence, undo restoration, reset/restart behavior, and neutral final-user-pick timing.
8. Run focused recommendation, forecast, Draft Room, and transient-session tests, followed by TypeScript validation, lint, and `git diff --check`.
9. After all validation passes, mark only Task 10 complete in `docs/tasks.md` and add implementation completion notes to this file.

## Expected Files

Implementation and focused tests:

- `src/components/DraftRoom.tsx`
- `src/components/DraftRoom.test.tsx`
- `src/lib/scenarioSession.ts`
- `src/lib/scenarioSession.test.ts`

Post-validation documentation:

- `docs/tasks.md`
- `docs/current-slice.md`

Expected implementation blast radius: four files, plus two status-only documentation updates after validation.

## Acceptance Criteria

- A loaded persisted workspace uses its successful immutable normalized context for recommendation generation.
- Persisted recommendations refresh after accepted pick, undo, reset, and resume/load state changes without adding a second recommendation state store.
- Transient recommendations use the same retained normalized context after initial load, local pick, undo, reset, restart, and replay-target replacement.
- On-turn and between-turn states expose forecast targets derived by the same existing deterministic engine rule.
- A player drafted by any team is absent from subsequent recommendations and cannot remain eligible for recalculated pocket timing.
- Forecast-backed components and Task 9 reasons update from the new draft state rather than remaining stale.
- A final user pick still returns recommendations with neutral future timing rather than failing or inventing a target.
- Failed normalization results do not produce guessed, partial, or coerced ranking context.
- Existing draft invariants, recommendation ordering/caps, transient dirty-state behavior, and Draft Room presentation remain unchanged.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- a supported persisted or transient state change bypasses the existing `DraftRoom` or `scenarioSession` recomputation paths;
- correct wiring requires changing forecast, scoring, reason, or draft-state semantics;
- support requires changing the scenario document contract or standalone replay engine before Tasks 11–12;
- a normalized context failure must be silently replaced with inferred data to keep a workflow running;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts src/components/DraftRoom.test.tsx src/lib/scenarioSession.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

Manual QA should exercise a persisted draft through opponent and user picks, undo, and reset; then repeat with a transient scenario across a replay-target change and the user's final pick. Confirm that recommendation score details show refreshed `overall_tier` and `draft_pocket_timing` evidence where eligible and neutral timing at the final user pick.

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Follow-up

Task 11 should add the versioned portable scenario contract that carries Ranking Snapshot V2-equivalent overall-tier semantics and nullable ADP while preserving Scenario V1 compatibility.

## Slice Review

1. Smallest meaningful increment: yes — it activates the completed Phase 5.5 engine behavior in the two existing live session recommendation paths without changing domain logic.
2. Executable without redefining the approach: yes — the successful-result gate, exact callers, recomputation paths, tests, and deferred boundaries are explicit.
3. Avoids unnecessary architecture changes: yes — it passes already-owned immutable context through existing pure-engine calls and adds no state store or abstraction.
4. Reasonable blast radius: yes — four implementation/test files; documentation changes are status-only after validation.
5. Comfortably reviewable and revertible: yes — caller wiring and focused regressions are isolated from forecast, scoring, persistence, and scenario contracts.
6. Observable and testable acceptance criteria: yes — components, target/status evidence, reasons, drafted-player exclusion, restored outputs, and final-pick neutrality are deterministic outputs.
