# Current Slice: Tier Semantics Task 6a - Persist Ranking-Set Tier Semantics

## Completion Status

Planned. Implementation has not begun.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Relevant decision: FantasyPros tiers are source tiers; legacy ambiguous tier values remain loadable but are neutralized for recommendation pressure by default.
- Completed prerequisite: Task 5 creates corrected FantasyPros `RankingSet` values with explicit `tierSemantics`, preserved source tiers, neutral engine-facing tiers, and `defaulted-neutral` tier capabilities.
- Current persistence boundary:
  - `RankingSet` stores capabilities on the parent row and canonical `tier` values on entry rows.
  - `RankingSet.tierSemantics` is not persisted.
  - Existing rows therefore have no trusted way to distinguish recommendation tiers from legacy ambiguous tiers.
  - `validateRankingSet` already validates explicit source, neutral, recommendation-position, and legacy-ambiguous semantics.

Task 6 covers repository, portable export, snapshot, and scenario compatibility. That is too broad for one reviewable slice. This slice implements only ranking-set repository compatibility so Task 5 semantics survive persistence and legacy ranking-set rows load conservatively. Canonical JSON, snapshots, and scenarios remain separate follow-up slices under Task 6.

## Goal

Persist explicit `RankingSet.tierSemantics` for new and replaced ranking sets, and load existing rows without semantics as legacy ambiguous data with neutral engine-facing recommendation tiers.

## Scope

### Goals

- Add nullable ranking-set storage for explicit tier semantics without rewriting existing rows.
- Round-trip valid explicit source-tier and recommendation-tier semantics through create, load, and replace repository operations.
- Treat a persisted `null` tier-semantics value as the legacy compatibility signal.
- Preserve legacy entry tier values as `legacy-ambiguous` source metadata.
- Neutralize engine-facing `RankingEntry.tier` values for legacy rows.
- Set every represented legacy position to:
  - `capabilities.tiers[position] === "defaulted-neutral"`;
  - `tierSemantics.recommendation[position] === "neutral"`.
- Continue validating every mapped aggregate with `validateRankingSet`.
- Fail loudly for malformed persisted explicit tier-semantics JSON.
- Keep summary queries and summary domain values unchanged.

### Non-Goals

- Do not update Canonical Ranking Set JSON parsing, normalization, conversion, or export.
- Do not update snapshot creation, snapshot repository mapping, snapshot hydration, or draft creation.
- Do not update Scenario V1 parsing, serialization, fixtures, or replay.
- Do not change Recommendation Engine scoring or reason generation.
- Do not update ranking editing semantics or UI labels.
- Do not backfill or rewrite existing ranking-set rows.
- Do not add a general migration framework.
- Do not update `docs/tasks.md`.
- Do not mark patch Task 6 complete; later Task 6 slices remain.

## Implementation Steps

1. Add nullable persistence storage.

   In `prisma/schema.prisma`, add a nullable JSON field on `RankingSet`:

   ```prisma
   tierSemantics Json?
   ```

   Create one additive Prisma migration that adds the nullable column. Existing rows must remain `NULL`; do not add a default and do not perform a data backfill.

2. Extend the repository persistence contract.

   In `src/lib/rankingSetRepository.ts`:

   - add `tierSemantics: unknown | null` to the persisted full-record shape;
   - include the field in create and replace data;
   - keep it out of summary selection and summary mapping because `RankingSetSummary` does not expose tier semantics;
   - serialize explicit domain semantics into independently owned JSON-compatible data;
   - when create input has no `tierSemantics`, omit the optional field so PostgreSQL stores database `NULL`;
   - when replace input clears or lacks `tierSemantics`, use Prisma's database-null JSON sentinel rather than serializing JSON `null`;
   - do not infer recommendation eligibility while writing a missing value.

   Do not add new repository methods or change transaction boundaries.

3. Map explicit persisted semantics without reinterpretation.

   When `record.tierSemantics` is non-null:

   - copy it into the mapped `RankingSet.tierSemantics` value;
   - preserve stored entry tiers and tier capabilities exactly;
   - rely on the final `validateRankingSet` call to reject malformed JSON, mismatched source references, invalid recommendation metadata, or capability/value contradictions;
   - surface failures through the existing `RankingSetRepositoryMappingError` with the domain error path.

   Do not repair malformed explicit semantics and do not silently downgrade them to legacy behavior.

4. Add the legacy compatibility mapper.

   When `record.tierSemantics === null`:

   - first map and canonically sort the persisted entries;
   - preserve each entry's original positive `tier` as a source value containing its `playerId`, canonical `overallRank`, and tier;
   - set `tierSemantics.source.kind` to `"legacy-ambiguous"` and attach those preserved values;
   - replace every mapped engine-facing entry tier with `NEUTRAL_TIER`;
   - derive the represented positions from the mapped entries;
   - set each represented position's tier capability to `"defaulted-neutral"`;
   - set each represented position's recommendation semantic to `"neutral"`;
   - discard tier-capability keys for unrepresented positions through this compatibility mapping;
   - pass the resulting aggregate through `validateRankingSet` before returning it.

   This compatibility behavior applies uniformly to old rows regardless of source label or format. Missing metadata is ambiguous; the mapper must not guess that old values were recommendation-eligible.

5. Keep new writes explicit when callers provide semantics.

   Ensure Task 5-style ranking sets with:

   - `source.kind: "source-overall"` and source values;
   - neutral recommendation metadata;
   - neutral entry tiers;
   - `defaulted-neutral` tier capabilities

   round-trip exactly through create, load, and replace.

   A caller that still supplies a `RankingSet` without `tierSemantics` may be persisted with `NULL`; the repository response and later reads must then use the conservative legacy mapping. Do not invent eligibility during write mapping.

6. Update focused repository tests.

   In `src/lib/rankingSetRepository.test.ts`, update the fake persisted record and helpers for the nullable JSON field, including normalization of Prisma's database-null JSON sentinel to persisted `null`, then add or adjust tests proving:

   - explicit source-overall plus neutral recommendation semantics round-trip without value loss;
   - explicit recommendation-position semantics also round-trip without reinterpretation;
   - create and replace send independently owned tier-semantics JSON to persistence;
   - a legacy `NULL` row loads with original tier values preserved under `source.kind: "legacy-ambiguous"`;
   - that same legacy row returns neutral entry tiers, neutral recommendation metadata, and `defaulted-neutral` capabilities for every represented position;
   - malformed non-null tier-semantics JSON throws `RankingSetRepositoryMappingError` at the relevant `tierSemantics` path;
   - summary queries do not select or expose tier-semantics JSON;
   - existing create, replace, delete, atomicity, and independent snapshot-isolation tests remain valid.

   Prefer adding explicit semantics to ordinary non-legacy test fixtures so only dedicated compatibility tests exercise the `NULL` path.

7. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingSetRepository.test.ts src/lib/rankingSetValidation.test.ts src/lib/rankingImportWorkflow.test.ts
   npm run prisma:validate
   npm run prisma:generate
   npx tsc --noEmit
   ```

   If `TEST_DATABASE_URL` is configured, also run the existing PostgreSQL repository integration suite with `RUN_RANKING_SET_DB_TESTS=1`. If it is unavailable, report that the unit repository boundary, Prisma schema validation, generated client, and type checking passed; do not add an external database dependency to the slice.

8. Finalize this slice.

   If validation passes:

   - update this file's Completion Status to complete;
   - do not mark Task 6 complete in `docs/patches/tier-semantics-tasks.md`;
   - do not update `docs/tasks.md`;
   - report that Canonical JSON, snapshot, and scenario compatibility remain under Task 6.

## Expected Files

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_ranking_set_tier_semantics/migration.sql`
- `src/lib/rankingSetRepository.ts`
- `src/lib/rankingSetRepository.test.ts`
- `docs/current-slice.md`, after validation, to record completion status
- Prisma-generated client artifacts only if the repository tracks changes produced by `npm run prisma:generate`

Do not touch these files in this slice:

- `src/types/rankings.ts`
- `src/lib/rankingNormalizer.ts`
- `src/lib/rankingSetConversion.ts`
- `src/lib/canonicalRankingJsonParser.ts`
- `src/lib/canonicalRankingJsonExporter.ts`
- `src/lib/rankingSnapshot.ts`
- Draft repository or draft creation files
- Scenario or replay files
- `src/lib/recommendationEngine.ts`
- UI components
- fixtures or data files
- `docs/tasks.md`
- `docs/patches/tier-semantics-tasks.md`

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingSetRepository.test.ts src/lib/rankingSetValidation.test.ts src/lib/rankingImportWorkflow.test.ts
npm run prisma:validate
npm run prisma:generate
npx tsc --noEmit
```

Expected result:

- Task 5 tier semantics survive actual ranking-set repository create, load, and replace mapping.
- Legacy rows remain loadable without making ambiguous tiers recommendation-eligible.
- Legacy source values remain inspectable after engine-facing tiers are neutralized.
- Explicit malformed semantics fail at the repository mapping boundary.
- Ranking-set summaries remain lightweight and unchanged.
- Existing import workflow behavior still compiles and passes its focused regression tests.

## Manual QA

No app manual QA is required for this repository-only slice.

Manual review should confirm:

- the migration is nullable and additive;
- there is no data backfill or destructive schema operation;
- no export, snapshot, scenario, recommendation, or UI code changed;
- the mapper preserves legacy tier values before neutralizing engine-facing entries;
- explicit semantics and legacy compatibility both finish at `validateRankingSet`.

## Acceptance Criteria

- New and replaced ranking sets with explicit tier semantics round-trip those semantics without value loss.
- Task 5 FantasyPros source-tier metadata survives ranking-set persistence.
- Existing rows with no tier-semantics column value load as `legacy-ambiguous` source data.
- Legacy engine-facing entry tiers equal `NEUTRAL_TIER` after mapping.
- Every represented legacy position declares neutral recommendation semantics and `defaulted-neutral` capability state.
- Legacy tier values remain preserved with canonical player IDs and overall ranks.
- Malformed explicit persisted semantics fail loudly through `RankingSetRepositoryMappingError`.
- Summary behavior and repository transaction semantics remain unchanged.
- The schema change is nullable, additive, and does not rewrite existing data.
- No canonical JSON, snapshot, scenario, recommendation, UI, dependency, data-file, `docs/tasks.md`, or patch-task-status changes are introduced.
- Focused tests, Prisma validation/generation, and `npx tsc --noEmit` pass.

## Failure Handling

- If Prisma cannot represent the semantics as one nullable JSON field without broader schema changes, stop and report the required design change.
- If loading a valid legacy row cannot produce a `validateRankingSet`-valid neutral aggregate without changing domain types, stop and report the contradiction rather than weakening validation.
- If compatibility requires changing Recommendation Engine behavior in this slice, stop; that belongs to Task 7.
- If migration generation requires an unavailable database, create or validate the additive migration using the existing project convention, report the unavailable integration environment, and do not broaden scope.
- If unrelated worktree changes overlap repository or schema files, preserve them and report any conflict that prevents a safe edit.

## Follow-Up

After this slice, plan the next Task 6 increment for Canonical Ranking Set JSON compatibility: read legacy V1 as ambiguous and export a versioned explicit tier-semantics contract. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. Corrected imports become durably safe without combining portable formats or immutable draft history.
- Executable by a lower-reasoning pass: yes. The storage shape, explicit mapping, legacy mapping, validation boundary, tests, and stop conditions are specified.
- Avoids unnecessary architecture changes: yes. One nullable JSON column extends the existing repository mapper; no new service or abstraction is introduced.
- Blast radius reasonable: yes. Runtime changes are limited to the Prisma ranking-set schema/migration and one repository module, with one focused test file.
- Review/revert comfort: yes. The additive column and mapper behavior can be reviewed and reverted independently from export, snapshot, scenario, and engine work.
- Observable/testable acceptance criteria: yes. Repository round trips and direct legacy-record fixtures can prove every behavior without UI or external services.
