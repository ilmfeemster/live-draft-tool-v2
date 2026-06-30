# Current Slice: Tier Semantics Task 3 - Update Tier Import and Portable-Format Contracts

## Completion Status

Complete. Implementation and focused validation passed.

## Source Context

- Patch project: `docs/patches/tier-semantics-project.md`
- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Relevant existing contracts and implementation boundaries:
  - `src/types/rankingImport.ts`
  - `src/types/rankings.ts`
  - `src/lib/rankingImportPreflight.ts`
  - `src/lib/fantasyProsCsvParser.ts`
  - `src/lib/canonicalRankingJsonParser.ts`
  - `src/lib/canonicalRankingJsonExporter.ts`
  - `src/lib/rankingNormalizer.ts`
- Relevant focused tests:
  - `src/lib/rankingImportPreflight.test.ts`
  - `src/lib/fantasyProsCsvParser.test.ts`
  - `src/lib/canonicalRankingJsonParser.test.ts`
  - `src/lib/canonicalRankingJsonExporter.test.ts`
  - `src/lib/rankingNormalizer.test.ts`, only for contract-shape coverage if needed

Task 2 documentation alignment is complete. This slice begins runtime work by updating the import/export contracts so tier-bearing data can carry explicit semantics before later slices change domain validation, FantasyPros normalization behavior, persistence compatibility, Recommendation Engine behavior, or UI copy.

## Goal

Revise import-stage and portable ranking-set contracts so tier-like data is explicitly classified as source-only, recommendation-eligible, unsupported, absent, neutral, or legacy ambiguous before it can be normalized, validated, persisted, exported, or used by the engine.

## Scope

### Goals

- Update `src/types/rankingImport.ts` with contract types for tier semantics.
- Update `src/types/rankings.ts` only as needed to expose shared tier capability terminology required by import/export contracts.
- Update `src/lib/rankingImportPreflight.ts` profile metadata so FantasyPros CSV `TIERS` is documented in code as source-tier data, not position-tier data.
- Update parser contracts so FantasyPros `TIERS` remains parsed as a located source field but is identified as source-tier input for downstream stages.
- Update Canonical Ranking Set JSON contract planning/types so new exports have an explicit path to carry source-tier semantics and recommendation-tier semantics without relying only on an ambiguous `tier` field.
- Preserve the reader path for existing Canonical Ranking Set JSON V1 with ambiguous `tier` values.
- Add or update focused contract tests for FantasyPros present/absent/malformed `TIERS`, legacy Canonical JSON V1 `tier`, and the new explicit tier-semantics export shape.

### Non-Goals

- Do not change final normalization behavior for FantasyPros imports beyond what is necessary to expose contract metadata.
- Do not materialize neutral recommendation tiers in this slice.
- Do not update domain validation, conversion, ranking-set editing, repositories, snapshots, scenarios, Recommendation Engine scoring, or UI components.
- Do not rewrite existing ranking data or scenario fixtures except small contract fixtures required by tests.
- Do not derive position tiers from rank, position rank, ADP, or source tiers.
- Do not add projections, VORP, simulations, new recommendation factors, scoring tuning, live integrations, or new ranking source formats.
- Do not update `docs/tasks.md`.
- Do not mark Task 3 complete unless the focused contract tests and acceptance criteria pass.

## Implementation Steps

1. Inspect current contract types.

   Review `src/types/rankingImport.ts`, `src/types/rankings.ts`, and `src/lib/rankingImportPreflight.ts`. Identify all current tier-related fields:

   - `NormalizedRankingCandidateField` includes `tier`.
   - `NormalizedRankingCandidateEntry` has `tier`.
   - `RankingTierCapability` currently uses `"source" | "defaulted-neutral"`.
   - Canonical JSON V1 currently exports and parses `entries[].tier`.
   - FantasyPros profile currently maps `TIERS` to `tier`.

2. Add explicit tier semantic contract types.

   In `src/types/rankingImport.ts` and, only if necessary, `src/types/rankings.ts`, add focused types that let import/export code classify tier-like data without changing behavior yet.

   The contract must be able to represent:

   - source-only tier data;
   - recommendation-eligible position-tier data;
   - unsupported tier-like data;
   - absent tier data;
   - neutral recommendation tier state;
   - legacy ambiguous tier data.

   Prefer small explicit union types over broad abstractions. Keep names aligned with `docs/design/tier-semantics.md`.

3. Update FantasyPros CSV profile metadata.

   In `src/lib/rankingImportPreflight.ts`, keep the accepted `TIERS` and `TIER` aliases, but document/classify that semantic as source-tier input. Do not remove support for the existing column.

   If changing the semantic field name from `tier` to something like `sourceTier`, carry the change only through parser contract shape in this slice and leave later normalization behavior changes for Task 5.

4. Update FantasyPros parser contract tests.

   In `src/lib/fantasyProsCsvParser.test.ts`, add or update assertions proving:

   - a present `TIERS` column is parsed as located source-tier data;
   - an absent `TIERS` column is allowed by the parser contract;
   - malformed tier values are not parser failures merely because the parser does not do semantic numeric validation.

   Parser tests should stay parser-level: syntax, headers, and located source records only.

5. Update canonical JSON contract types.

   In `src/types/rankingImport.ts`, introduce the next explicit portable shape needed by the design. The implementation may add a V2 type or a V1-compatible metadata extension, but the contract must make source-tier and recommendation-tier semantics explicit for new exports.

   Preserve `CanonicalRankingSetDocumentV1` as the legacy readable shape. Do not remove `entries[].tier` from V1.

6. Update canonical parser/exporter contract surfaces.

   In `src/lib/canonicalRankingJsonParser.ts`, keep V1 parsing readable and make sure V1 `entries[].tier` is treated as legacy ambiguous at the contract boundary where applicable. Do not make legacy V1 fail only because it lacks new semantic metadata.

   In `src/lib/canonicalRankingJsonExporter.ts`, expose the new explicit tier-semantics export shape or prepare the mapper type so later domain slices can populate it. Do not make export depend on domain fields that do not exist yet unless the slice also defines a backward-compatible placeholder.

7. Add canonical JSON contract tests.

   In `src/lib/canonicalRankingJsonParser.test.ts` and `src/lib/canonicalRankingJsonExporter.test.ts`, add or update tests proving:

   - legacy V1 files with `entries[].tier` remain accepted;
   - new contract shape can represent source-tier semantics and recommendation-tier semantics explicitly;
   - ranking-set JSON and Scenario V1 JSON remain distinct;
   - unsupported future versions fail clearly.

8. Update normalizer tests only if contract changes require it.

   If renamed parsed fields would otherwise break compilation, update `src/lib/rankingNormalizer.ts` and `src/lib/rankingNormalizer.test.ts` only to bridge the new contract shape without implementing Task 5 behavior. Any behavioral changes to FantasyPros source tiers becoming neutral recommendation tiers must stay out of this slice.

9. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/canonicalRankingJsonExporter.test.ts
   npx tsc --noEmit
   ```

   If `rankingNormalizer` needed contract-bridge changes, also run:

   ```text
   npm test -- src/lib/rankingNormalizer.test.ts
   ```

10. Finalize the slice.

   If all acceptance criteria and focused validation pass:

   - update `docs/patches/tier-semantics-tasks.md` to mark Task 3 complete;
   - update this file's Completion Status to complete;
   - do not update `docs/tasks.md`.

## Expected Files

- `src/types/rankingImport.ts`
- `src/types/rankings.ts`, only if shared tier capability terminology must move there
- `src/lib/rankingImportPreflight.ts`
- `src/lib/fantasyProsCsvParser.ts`, only if parser semantic field names change
- `src/lib/canonicalRankingJsonParser.ts`
- `src/lib/canonicalRankingJsonExporter.ts`
- `src/lib/rankingNormalizer.ts`, only as a compatibility bridge if contract names change
- `src/lib/rankingImportPreflight.test.ts`
- `src/lib/fantasyProsCsvParser.test.ts`
- `src/lib/canonicalRankingJsonParser.test.ts`
- `src/lib/canonicalRankingJsonExporter.test.ts`
- `src/lib/rankingNormalizer.test.ts`, only if `rankingNormalizer.ts` changes
- `docs/patches/tier-semantics-tasks.md`, after validation, to mark Task 3 complete
- `docs/current-slice.md`, after validation, to record completion status

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/canonicalRankingJsonExporter.test.ts
npx tsc --noEmit
```

Conditional validation if the normalizer bridge is touched:

```text
npm test -- src/lib/rankingNormalizer.test.ts
```

Expected result:

- FantasyPros parser contract preserves present `TIERS` as source-tier input.
- FantasyPros parser contract permits missing `TIERS`.
- Canonical JSON V1 remains readable as legacy ambiguous tier data.
- New explicit tier-semantics portable contract has fixture coverage.
- TypeScript compiles without leaking parser/source records into domain or engine consumers.

Validation completed:

- `npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/canonicalRankingJsonExporter.test.ts`
- `npx tsc --noEmit`

## Manual QA

No app manual QA is required for this contract-only slice.

Manual review should confirm:

- new contract names match `docs/design/tier-semantics.md`;
- V1 canonical ranking files remain supported;
- no UI text or recommendation behavior changes are introduced in this slice.

## Acceptance Criteria

- Contract types can represent source-only, recommendation-eligible, unsupported, absent, neutral, and legacy ambiguous tier states.
- FantasyPros `TIERS` are classified as source-tier input in code-level profile or parser contract metadata.
- Missing FantasyPros `TIERS` remain safely parseable.
- Malformed supplied tier values remain a later semantic validation concern rather than a parser syntax failure.
- Canonical Ranking Set JSON has an explicit contract path for source-tier and recommendation-tier semantics in new exports.
- Legacy Canonical Ranking Set JSON V1 with `entries[].tier` remains readable through a legacy ambiguous-tier path.
- Scenario V1 JSON is still rejected as ranking-set JSON.
- No domain validation, persistence, snapshot, recommendation, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Focused tests and `npx tsc --noEmit` pass.
- `docs/patches/tier-semantics-tasks.md` marks Task 3 complete only after validation passes.

## Failure Handling

- If contract changes require broad domain or persistence changes, stop and report that Task 3 needs to be split further.
- If a V2 canonical export type cannot be added without changing runtime export behavior, add the type and fixtures only, then leave runtime export mapping to a later slice.
- If legacy V1 compatibility conflicts with the new explicit shape, preserve V1 loadability and document the limitation for Task 6.
- If tests fail outside the touched contract surface, report the failure rather than broadening the slice.
- If unrelated worktree changes appear in target files, preserve them and edit around them.

## Follow-Up

After this slice is complete, the next slice should implement Task 4 from `docs/patches/tier-semantics-tasks.md`: add domain tier semantics and validation.

## Slice Review

- Smallest meaningful increment: yes. This slice changes only import/export contract semantics before behavior changes.
- Executable by a lower-reasoning pass: yes. Target files, deferred work, tests, and acceptance criteria are explicit.
- Avoids unnecessary architecture changes: yes. It adds explicit contract vocabulary without changing the overall import pipeline.
- Blast radius reasonable: yes. Expected runtime files are limited to import/export contract surfaces and focused tests.
- Review/revert comfort: yes. Contract changes can be reviewed independently from normalization, persistence, recommendation, and UI behavior.
- Observable/testable acceptance criteria: yes. Focused parser/exporter tests and TypeScript validation prove the contract boundary.
