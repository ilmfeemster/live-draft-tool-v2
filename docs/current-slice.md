# Current Slice — Task 11: Add a Portable Phase 5.5 Scenario Contract

## Status

Complete. Implemented and validated on 2026-07-03.

## Goal

Add an explicit Scenario V2 document contract that can preserve the immutable ranking facts required to reproduce Phase 5.5 recommendation context: canonical ranking entries with nullable ADP, recommendation-tier semantics, and complete overall/source-tier values.

This slice defines, validates, and deterministically serializes the portable contract only. Scenario V1 must remain unchanged and readable. Replay, workbench import/export selection, and live session integration belong to Task 12.

## Approved Contract Shape

Scenario V2 keeps the existing scenario envelope and changes only the schema version and ranking context:

```ts
type ScenarioV2 = {
  schemaVersion: 2;
  metadata: ScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: ScenarioDraftConfiguration;
  rankingContext: {
    rankings: RankingEntry[];
    tierSemantics: RankingTierSemantics;
  };
  userTeamContext: ScenarioUserTeamContext;
  pickHistory: ScenarioPick[];
  replayTarget: ScenarioReplayTarget;
};
```

Contract rules:

- `rankings` remains the canonical ordered ranking array and preserves each nullable `adpRank` exactly.
- `tierSemantics` uses the existing Ranking Snapshot V2 domain shape. Its source values carry overall/source-tier facts separately from the recommendation-facing `tier` field.
- A Scenario V2 document does not carry ranking-set IDs, ranking-set names, mutable source records, snapshot timestamps, normalized recommendation facts, fallback ADP, forecasts, pockets, components, reasons, or recommendation output.
- Scenario V1 retains its legacy ranking-array contract and continues to materialize neutral recommendation tiers when read.

## Scope

### Goals

- Add explicit schema-version constants and types for Scenario V1 and Scenario V2 without changing the existing V1 default export path.
- Add a Scenario V2 parser and a version-dispatching parser that accepts V1 or V2 while retaining the existing V1-only parser for compatibility.
- Preserve V2 ranking entries, nullable ADP, recommendation-tier values, tier semantics, and overall/source-tier values as fresh typed data.
- Validate V2 tier semantics against ranking identity, overall rank, completeness, positive/non-decreasing tiers, and recommendation-tier rules.
- Return stable structured validation failures for malformed, partial, contradictory, or mismatched V2 tier metadata.
- Add deterministic Scenario V2 serialization with stable field order and a single trailing newline.
- Prove Scenario V1 behavior and serialization remain unchanged.
- Prove derived Phase 5.5 output is absent from both the typed portable contract and serialized JSON.

### Non-goals

- Do not change `exportWorkspaceToScenarioV1`, `importScenarioV1Json`, `replayScenarioV1`, transient sessions, curated scenarios, or Draft Room workbench flows.
- Do not make Scenario V2 the default export format yet; Task 12 owns version-aware workbench integration.
- Do not recompute forecasts, recommendations, scores, adjustments, or reasons in this slice.
- Do not serialize normalized overall-tier facts per player, missing-ADP fallback values, removal windows, pockets, candidate signals, or recommendation output.
- Do not reinterpret Scenario V1 `tier` values as overall tiers.
- Do not infer missing V2 source tiers, recommendation-tier eligibility, ADP, capabilities, or ranking-set provenance.
- Do not add database migrations, persistence changes, generic schema registries, or migration infrastructure.

## Implementation Steps

1. Extend `src/types/scenario.ts` with explicit V1 and V2 schema-version constants, a `ScenarioV2` type, a `ScenarioDocument` union, and a V2 ranking-context type containing canonical rankings plus `RankingTierSemantics`. Keep the current `SCENARIO_SCHEMA_VERSION` behavior as the V1 compatibility/default-export constant so existing V1 callers do not silently change format.
2. Refactor `src/lib/scenarioValidation.ts` only enough to share envelope parsing and consistency validation across the two versions while preserving `parseScenarioV1Json` behavior and error output.
3. Add `parseScenarioV2Json` and a version-dispatching `parseScenarioJson`. The dispatcher must reject unknown versions and return a typed V1-or-V2 result without guessing a format.
4. Parse V2 ranking entries without the V1 neutral-tier materialization. Validate `rankingContext.tierSemantics` through the existing Ranking Snapshot V2 validation semantics, then run `createRecommendationRankingContext` to enforce valid ADP and complete, matching, non-decreasing source-overall tiers. Prefix returned ranking-context diagnostic paths with `rankingContext.` and preserve meaningful structured error codes.
5. Ensure V2 parsing returns fresh nested ranking and tier-semantic values and discards unknown derived-output properties exactly as the V1 boundary does.
6. Add `serializeScenarioV2` in `src/lib/scenarioSerialization.ts`. Serialize the common envelope in the existing deterministic order, then emit V2 `rankingContext.rankings` and a deep copied `tierSemantics`; do not emit ranking-set identity, timestamps, capabilities, or derived values.
7. Extend `src/lib/scenarioValidation.test.ts` with focused V2 coverage for:
   - complete source-overall tiers with complete, partial, and absent ADP;
   - exact preservation of ranking tier values and tier semantics;
   - Scenario V1 compatibility and neutral-tier behavior through the version dispatcher;
   - partial source values, unknown/duplicate players, rank mismatches, invalid/decreasing tiers, malformed recommendation semantics, invalid ADP, and unsupported versions;
   - fresh outputs, deterministic failures, size limits, common consistency rules, and ignored derived-state properties.
8. Extend `src/lib/scenarioSerialization.test.ts` with exact Scenario V2 shape, deterministic/newline behavior, non-mutation, optional metadata behavior, semantic ordering, and absence of forecast/recommendation output. Round-trip serialized V2 documents through the V2 parser.
9. Run focused scenario, ranking-snapshot, and recommendation-context tests, TypeScript validation, lint, and `git diff --check`.
10. After all validation passes, mark only Task 11 complete in `docs/tasks.md` and add implementation completion notes to this file.

## Expected Files

Implementation and focused tests:

- `src/types/scenario.ts`
- `src/lib/scenarioValidation.ts`
- `src/lib/scenarioValidation.test.ts`
- `src/lib/scenarioSerialization.ts`
- `src/lib/scenarioSerialization.test.ts`

Post-validation documentation:

- `docs/tasks.md`
- `docs/current-slice.md`

Expected implementation blast radius: five files, plus two status-only documentation updates after validation.

## Acceptance Criteria

- Scenario V2 round-trips canonical rankings, nullable ADP, recommendation-tier values, tier semantics, and overall/source-tier values exactly.
- Complete, partial, and wholly absent ADP remain valid V2 inputs with each `null` preserved; no fallback ADP is serialized.
- Complete source-overall tiers are accepted, while partial, malformed, decreasing, duplicate, unknown-player, or rank-mismatched tier values fail with structured diagnostics.
- Recommendation-tier semantics are validated and remain distinct from overall/source-tier values.
- Scenario V1 remains readable and serializable with its existing schema and neutral-tier materialization behavior.
- The version-dispatching parser accepts exactly V1 and V2 and rejects unknown versions without coercion.
- Serialized Scenario V2 output is deterministic, newline-terminated, independent of mutable ranking-set identity, and does not mutate its input.
- Forecasts, fallback ADP, pockets, candidate signals, recommendation components, scores, adjustments, reasons, and recommendation output are absent from the portable document.
- Existing scenario envelope limits, metadata rules, draft configuration validation, pick-history validation, and replay-target validation apply equally to V2.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- preserving Phase 5.5 facts requires serializing derived forecast or recommendation output;
- V2 tier validation cannot reuse the existing Ranking Snapshot V2 and normalized recommendation-context semantics without changing their approved behavior;
- Scenario V1 compatibility requires reinterpreting its legacy tier values;
- implementing the contract requires changing replay, workbench, transient-session, repository, or database behavior before Task 12;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioPortability.test.ts src/lib/rankingSnapshot.test.ts src/lib/recommendationRankingContext.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Implementation Completion Notes

- Added explicit additive Scenario V2 types while retaining `SCENARIO_SCHEMA_VERSION` and every V1 API as the compatibility/default-export path.
- Added V2-only and version-dispatching parsers that preserve nullable ADP and ranking tiers, reuse Ranking Snapshot V2 tier validation, and apply normalized recommendation-context checks with structured paths.
- Added deterministic V2 serialization for canonical rankings and tier semantics without ranking-set identity, timestamps, fallback ADP, forecast output, or recommendations.
- Added focused coverage for complete, partial, and absent ADP; source-overall and recommendation-tier separation; malformed/partial/mismatched tier metadata; V1 dispatch compatibility; common envelope validation; deterministic serialization; and derived-output exclusion.
- Validation passed:
  - `npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioPortability.test.ts src/lib/rankingSnapshot.test.ts src/lib/recommendationRankingContext.test.ts` (109 tests)
  - `npx tsc --noEmit`
  - `npm run lint` (only the documented pre-existing warning)
  - `git diff --check`
- No replay, workbench, transient-session, persistence, database, forecast, scoring, or recommendation behavior changed.

## Follow-up

Task 12 should integrate the version-dispatching contract with scenario replay, transient sessions, and workbench import/export so V2 replays use supplied overall tiers while V1 remains default-neutral.

## Slice Review

1. Smallest meaningful increment: yes — it defines and proves the portable V2 boundary without mixing in replay or UI behavior.
2. Executable without redefining the approach: yes — the schema shape, compatibility rule, validation sources, parser APIs, serializer behavior, diagnostics, and deferred integration are explicit.
3. Avoids unnecessary architecture changes: yes — it reuses existing ranking and tier semantics and adds no persistence, registry, or migration framework.
4. Reasonable blast radius: yes — five implementation/test files; documentation updates are status-only after validation.
5. Comfortably reviewable and revertible: yes — V2 is additive and the existing V1 functions remain intact.
6. Observable and testable acceptance criteria: yes — exact round trips, deterministic serialization, structured failures, V1 compatibility, and absence of derived output are directly assertable.
