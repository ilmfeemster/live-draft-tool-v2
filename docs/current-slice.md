# Current Slice — Task 12A: Integrate Version-Aware Scenario Replay and Import

## Status

Planned. Not yet implemented.

## Goal

Make the pure scenario replay and portability import boundaries consume both Scenario V1 and Scenario V2, rebuilding normalized recommendation context and deterministic Phase 5.5 recommendations from each document’s captured ranking inputs.

This is the first slice of Task 12. It completes version-aware replay/import without changing workspace types, transient sessions, Draft Room controls, or workbench export. The follow-up Task 12B slice will propagate authoritative tier semantics through persisted/transient workspaces and switch workbench import/export to the version-aware APIs.

## Why Task 12 Is Split

The current domain replay/import boundary can support V2 in four focused files. Workbench export additionally requires preserving authoritative `RankingTierSemantics` through `DraftWorkspace`, repository mapping, page props, transient sessions, and Draft Room export/replay-target handlers.

Combining both concerns would exceed the project’s normal five-file implementation blast radius and mix pure-domain replay changes with persistence-facing and UI wiring. Task 12 remains incomplete until the follow-up workbench slice is implemented.

## Scope

### Goals

- Add one version-aware replay function for the `ScenarioDocument` union.
- Keep `replayScenarioV1` as a compatibility wrapper with its existing signature and draft-transition behavior.
- Add an explicit Scenario V2 replay wrapper for typed callers.
- Build recommendation ranking context from the replayed document:
  - Scenario V1 uses freshly materialized neutral recommendation tiers and default-neutral overall tiers;
  - Scenario V2 uses its preserved ranking entries and authoritative `tierSemantics`.
- Pass successful normalized context into `generatePlayerRecommendations` so V1 stored ADP and V2 ADP/overall tiers produce the existing forecast, components, caps, ordering, and Task 9 reasons.
- Add version-aware JSON import that dispatches through `parseScenarioJson` and the shared replay function.
- Preserve the existing V1-only import API and failure shape for compatibility.
- Add an explicit V2 import API for callers that require that version.
- Preserve replay determinism, full-history validation, metadata independence, no-mutation behavior, and draft invariants.

### Non-goals

- Do not change scenario types, validation rules, or serializers completed in Task 11.
- Do not add Scenario V2 workspace export yet.
- Do not change `DraftWorkspace`, repository mapping, persistence, page props, transient sessions, Draft Room, or workbench controls; those belong to Task 12B.
- Do not make V2 the UI’s default export format in this slice.
- Do not persist or return forecasts, pockets, recommendation components, or recommendation output inside scenario documents.
- Do not infer Scenario V1 overall tiers from its legacy `tier` values.
- Do not infer missing Scenario V2 tier semantics, synthesize ADP, fetch rankings, or consult mutable ranking sets.
- Do not change draft-state replay rules or replay error semantics.

## Implementation Steps

1. Refactor `src/lib/scenarioReplay.ts` around a shared `replayScenario(scenario: ScenarioDocument)` implementation while retaining `replayScenarioV1` and adding `replayScenarioV2` as thin typed wrappers.
2. Preserve the existing draft hydration, complete pick-history validation, target-state capture, and `pick-rejected` result exactly.
3. At the recommendation boundary, materialize a ranking snapshot by version:
   - for V1, clone rankings through `materializeScenarioV1Rankings` and omit source tier semantics so `createRecommendationRankingContext` produces default-neutral overall tiers;
   - for V2, clone the parsed rankings and supply the document’s `tierSemantics` unchanged.
4. Require the normalized recommendation context to succeed for a validated scenario, then pass it into `generatePlayerRecommendations`. Do not add a context-free fallback or reinterpret invalid typed input.
5. Refactor `src/lib/scenarioPortability.ts` to share validation-stage and replay-stage result mapping across versions.
6. Add `importScenarioJson` using `parseScenarioJson` plus `replayScenario`, and add `importScenarioV2Json` using the V2-only parser plus the V2 replay wrapper. Preserve `importScenarioV1Json` as a V1-only API with its existing return type and behavior.
7. Extend `src/lib/scenarioReplay.test.ts` with parsed V2 fixtures containing source-overall tiers and complete/partial/absent ADP. Assert exact equality with direct context-aware engine output, material overall-tier/timing components and reasons when eligible, neutral fallbacks, deterministic target changes, V1 neutral-tier behavior, unchanged replay errors, and no mutation.
8. Extend `src/lib/scenarioPortability.test.ts` with version-aware and V2-only import coverage for validation failures, replay failures, exact draft/recommendation output, V1 compatibility, provenance independence, and absence of serialized derived output.
9. Run focused replay, portability, scenario contract, forecast, and recommendation tests, followed by TypeScript validation, lint, and `git diff --check`.
10. After validation, add completion notes to this file. Do not mark Task 12 complete in `docs/tasks.md`; Task 12B workbench integration remains.

## Expected Files

- `src/lib/scenarioReplay.ts`
- `src/lib/scenarioReplay.test.ts`
- `src/lib/scenarioPortability.ts`
- `src/lib/scenarioPortability.test.ts`
- `docs/current-slice.md` for completion notes after validation

Expected blast radius: four implementation/test files plus this active-slice status update.

## Acceptance Criteria

- The shared replay function accepts parsed Scenario V1 and Scenario V2 documents and preserves the existing draft-state replay result.
- Scenario V2 replay uses its captured nullable ADP and tier semantics to reproduce direct-engine recommendation ordering, components, adjustments, evidence, and reasons exactly.
- Scenario V1 replay keeps legacy tiers neutral while using its stored nullable ADP for the existing deterministic forecast behavior.
- Complete, partial, and absent ADP retain the approved active/active-with-fallback/no-ADP behavior after replay without serializing fallback values.
- Replaying different valid targets recomputes recommendation and forecast evidence from that target draft rather than retaining stale output.
- V1-only, V2-only, and version-dispatching import APIs reject the wrong or unsupported version without coercion.
- Validation-stage and replay-stage failures retain structured deterministic result shapes.
- Metadata and provenance do not affect replay output.
- Repeated equivalent replay/import calls are deterministic and do not mutate their scenario input.
- Existing replay errors, draft invariants, Scenario V1 portability behavior, forecast/scoring semantics, and recommendation ordering rules remain intact.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- replaying V2 requires changing the Scenario V2 contract or tier-validation semantics completed in Task 11;
- correct replay requires querying persistence, mutable ranking sets, or external data;
- supporting V2 requires serializing or trusting stale forecast/recommendation output;
- V1 compatibility requires interpreting its legacy `tier` values as overall tiers;
- implementation requires changing workspace, transient-session, or Draft Room APIs before the Task 12B slice;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Follow-up

Plan Task 12B to preserve authoritative tier semantics through persisted and transient workspace state, use version-aware import in the workbench, export Scenario V2 from the active session, preserve replay-target/reset behavior, and prove export/import independence from the original ranking set.

## Slice Review

1. Smallest meaningful increment: yes — it makes the new portable contract executable at the pure replay/import boundary without mixing in UI or workspace propagation.
2. Executable without redefining the approach: yes — version-specific snapshot construction, wrapper compatibility, import APIs, error behavior, tests, and deferred boundaries are explicit.
3. Avoids unnecessary architecture changes: yes — it reuses the existing parser, normalizer, recommendation engine, and draft replay loop.
4. Reasonable blast radius: yes — four implementation/test files plus active-slice completion notes.
5. Comfortably reviewable and revertible: yes — V2 support is additive and existing V1 entry points remain intact.
6. Observable and testable acceptance criteria: yes — exact engine equality, evidence/status transitions, structured failures, determinism, and invariants are directly assertable.
