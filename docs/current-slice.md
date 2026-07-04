# Current Slice — Task 12C: Integrate Scenario V2 With Workbench Flows

## Status

Planned. Not yet implemented.

## Goal

Complete Task 12 by connecting the version-aware scenario APIs and authoritative tier semantics to transient sessions and the Draft Room workbench, making Scenario V2 the workbench export format while preserving Scenario V1 import compatibility.

Task 12A completed V1/V2 replay and import. Task 12B preserved authoritative tier semantics through persisted and transient state. This final slice wires those completed boundaries into import, reset, replay-target, restart, and export workflows without changing draft-state, forecast, scoring, or reason semantics.

## Scope

### Goals

- Add a Scenario V2 workspace exporter that requires authoritative `RankingTierSemantics` rather than reconstructing them.
- Keep the existing Scenario V1 exporter unchanged for compatibility and curated/test callers.
- Switch transient scenario creation from V1-only import to the version-aware import API.
- Retain the parsed scenario version in transient session state.
- Use V1 neutral semantics for legacy imports and exact supplied V2 semantics for V2 imports.
- Preserve nullable ADP and recompute normalized context, forecasts, recommendations, adjustments, and reasons after import, local pick, undo, reset, restart, and replay-target replacement.
- Re-export both imported V1 and imported V2 sessions as Scenario V2 using the active rankings and authoritative semantics.
- Export persisted and restarted-manual workbench sessions as Scenario V2 without requiring the original mutable ranking set.
- Make the live Home-to-DraftRoom boundary require mapped tier semantics while keeping a compatibility guard for older isolated DraftRoom test constructors.
- Preserve existing download naming, provenance, dirty-state confirmations, replay-target controls, and validation/replay error presentation.

### Non-goals

- Do not remove or change Scenario V1 types, parsing, serialization, replay, export, curated fixtures, or compatibility APIs.
- Do not migrate or rewrite existing scenario files.
- Do not serialize forecasts, fallback ADP, pockets, candidate signals, recommendation components, scores, adjustments, reasons, or recommendation output.
- Do not infer overall/source tiers from recommendation tiers or normalized recommendation facts.
- Do not infer recommendation-tier eligibility from numeric tier values.
- Do not query mutable ranking sets, persistence repositories, or external data during import/export/replay.
- Do not add new workbench controls, scenario-library features, database fields, migrations, caching, or background work.
- Do not change draft-state replay rules, forecast construction, scoring, caps, ordering, or reason wording.

## Implementation Steps

1. Add `exportWorkspaceToScenarioV2` to `src/lib/scenarioPortability.ts`. Require a workspace value with authoritative `rankingTierSemantics`, reuse the existing metadata/pick-history/target validation behavior, copy canonical rankings and tier semantics into the Task 11 V2 contract, and avoid emitting snapshot identity, timestamps, capabilities, or derived output.
2. Refactor only the small common export-envelope code needed to keep V1 and V2 exports consistent. Preserve `exportWorkspaceToScenarioV1` output byte-for-byte at the object level and retain its public signature.
3. Update `src/lib/scenarioSession.ts` to use `importScenarioJson` and store `ScenarioDocument` rather than `ScenarioV1` in scenario sessions. Derive session tier semantics by version:
   - V1: explicit source kind `none` plus neutral recommendation semantics for represented positions;
   - V2: a fresh copy of `scenario.rankingContext.tierSemantics`.
4. Build transient normalized context and recommendations from the same rankings and tier semantics. Preserve them through local pick, undo, and restart; reset reparses the original source JSON through the version-aware importer.
5. Extend `src/lib/scenarioSession.test.ts` with V2 fixtures and integration assertions covering exact source-overall context, complete/partial/absent ADP, score-backed reasons, pick/undo/reset/restart behavior, version retention, V1 compatibility, and V2 export/re-import equality. Exercise `exportWorkspaceToScenarioV2` here using persisted-style, V1-transient, V2-transient, and restarted-manual session inputs so no additional test file is required.
6. Update `src/app/page.tsx` to require `workspace.rankingTierSemantics` alongside the existing normalized-context result and pass it to `DraftRoom`. A mapped persisted workspace missing either value should fail explicitly rather than export guessed semantics.
7. Update `src/components/DraftRoom.tsx` to accept an optional compatibility prop for `rankingTierSemantics`, select transient semantics when a transient session is active, and use `exportWorkspaceToScenarioV2` plus `serializeScenarioV2` for every workbench export.
8. In Draft Room replay-target replacement, serialize the active scenario with the serializer matching its existing version before recreating the transient session. Do not upgrade the cached source document during target changes; only explicit export produces V2.
9. If authoritative semantics are unavailable in an isolated compatibility render, keep recommendations usable but report a workbench export error instead of emitting V1 or guessed V2 data.
10. Run focused scenario session, portability, replay, Draft Room, repository mapping, forecast, and recommendation tests, followed by TypeScript validation, lint, `git diff --check`, and a local workbench smoke pass when the in-app browser is available.
11. After all required automated validation passes, mark Task 12 complete in `docs/tasks.md` and add completion notes to this file.

## Expected Files

- `src/lib/scenarioPortability.ts`
- `src/lib/scenarioSession.ts`
- `src/lib/scenarioSession.test.ts`
- `src/app/page.tsx`
- `src/components/DraftRoom.tsx`
- `docs/tasks.md` after complete validation
- `docs/current-slice.md` for completion notes

Expected implementation blast radius: five implementation/test files, plus two status-only documentation updates after validation.

## Acceptance Criteria

- Version-aware transient import accepts Scenario V1 and Scenario V2 while retaining strict validation/replay failures.
- Scenario V1 sessions remain default-neutral for overall tiers and use stored nullable ADP.
- Scenario V2 sessions preserve supplied ranking tiers, tier semantics, source-overall values, and nullable ADP exactly.
- Import, accepted/rejected pick, undo, reset, restart, and replay-target replacement recompute deterministic recommendations from captured inputs without stale derived output.
- Replay-target replacement preserves the active source scenario version; explicit workbench export always emits Scenario V2.
- Persisted, V1-transient, V2-transient, and restarted-manual workbench states export valid Scenario V2 documents with authoritative tier semantics.
- Exported Scenario V2 re-import reproduces the same target draft, normalized ranking context, recommendation ordering, components, adjustments, evidence, and reasons.
- Export/import remains independent of mutable ranking-set identity, source deletion, snapshot timestamps, and serialized recommendation output.
- Missing authoritative semantics blocks only export with an explicit workbench error; draft state and recommendations remain usable.
- Existing Scenario V1 APIs, curated scenarios, workbench controls, download naming, dirty-state behavior, draft invariants, forecast/scoring semantics, and reason wording remain unchanged.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- exporting V2 requires reconstructing tier semantics from normalized facts or numeric tiers;
- V1 compatibility requires interpreting legacy tiers as overall tiers;
- workbench integration requires persisting derived recommendation or forecast output;
- implementation requires changing the database schema, ranking snapshot contract, draft-state replay rules, forecast, scoring, or reason semantics;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/scenarioSession.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioReplay.test.ts src/components/DraftRoom.test.tsx src/lib/draftRepositoryMapping.test.ts src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

Manual smoke QA should import both a Scenario V1 and Scenario V2 file, change replay targets, make and undo a local pick, reset/restart, export each active state, and re-import the downloaded V2 document. Confirm refreshed Phase 5.5 evidence and reasons and no dependency on the original ranking set.

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Follow-up

After Task 12 is complete, Task 13 should run the Phase 5.5 regression, scenario, workflow, and manual exit-validation matrix without adding new product behavior.

## Slice Review

1. Smallest meaningful increment: yes — this is the remaining vertical integration needed to make the completed V2 contract and replay path usable from the existing workbench.
2. Executable without redefining the approach: yes — export ownership, version handling, state selection, compatibility guards, tests, and error behavior are explicit.
3. Avoids unnecessary architecture changes: yes — it connects existing domain boundaries and adds no persistence, reconstruction, or generic registry.
4. Reasonable blast radius: yes — five implementation/test files; direct export coverage is intentionally colocated with transient-session integration tests.
5. Comfortably reviewable and revertible: yes — changes are isolated to portability, transient sessions, and the existing workbench caller boundary.
6. Observable and testable acceptance criteria: yes — exact V2 documents, re-import equality, version preservation, state transitions, export blocking, and unchanged V1 behavior are deterministic outputs.
