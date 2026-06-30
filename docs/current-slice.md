# Current Slice: Formalize Immutable Snapshot Creation from Managed Rankings

## Completion Status

Planned. This slice promotes Phase 5 Task 15. Implementation has not started.

## Source Context

- `src/types/rankings.ts` already defines `RankingSet`, `RankingSetCapabilities`, `RankingSetSummary`, and a `RankingSnapshot` value type with copied rankings, optional capabilities, optional source ranking-set provenance, and optional capture time.
- `src/lib/rankingSnapshot.ts` currently serializes and parses the legacy Phase 2 snapshot representation as a bare `RankingEntry[]`. It deep-copies player and ranking fields but does not yet expose a managed-ranking snapshot creation boundary or metadata-aware snapshot value helpers.
- `src/lib/draftRepository.ts` and `src/lib/draftRepositoryMapping.ts` persist and hydrate ranking snapshots through `serializeRankingSnapshot` and `parseRankingSnapshotJson`.
- `src/lib/scenarioValidation.ts`, `src/lib/scenarioSerialization.ts`, and `src/lib/scenarioPortability.ts` continue to use Scenario V1 `rankingContext.rankings` as a complete embedded `RankingEntry[]` contract.
- `src/lib/rankingSetValidation.ts` already validates canonical ranking-set invariants and field-capability consistency for managed ranking sets.
- `docs/design/rankings-data.md` requires immutable snapshots to copy every domain-relevant entry value, optionally carry capability/provenance metadata outside engine input, preserve legacy Phase 2 snapshot arrays, and avoid any live dependency on source ranking sets.

## Goal

Add a pure, reusable snapshot creation boundary for managed ranking sets while preserving existing snapshot loading, Scenario V1 replay, and Recommendation Engine input behavior.

## Scope

### Goals

- Add or formalize snapshot creation from a valid managed `RankingSet`.
- Return a complete immutable value copy with fresh entry and player objects.
- Copy field-capability metadata for inspection without making capabilities an engine input.
- Copy source ranking-set ID, source ranking-set name, and capture timestamp as optional non-authoritative provenance.
- Preserve existing `serializeRankingSnapshot(rankings: RankingEntry[])` and `parseRankingSnapshotJson(snapshot)` legacy behavior.
- Keep persisted draft hydration returning the existing `DraftWorkspace` shape with `rankings: RankingEntry[]`.
- Keep Scenario V1 serialization, validation, import, export, and replay compatible with embedded `RankingEntry[]` values.
- Reuse canonical ranking-set validation when creating snapshots from managed sets.
- Prove that editing or deleting a source set after snapshot creation cannot change the snapshot value.

### Non-Goals

- Do not change draft setup or require a ranking-set ID during draft creation. That is Task 16.
- Do not migrate, rewrite, or version existing persisted snapshot records.
- Do not change Scenario V1 schema or add capability metadata to scenario documents.
- Do not expose snapshot update, refresh, relink, merge, or restore behavior.
- Do not query or mutate ranking-set persistence from snapshot helpers.
- Do not change recommendation scoring, draft state behavior, scenario replay semantics, UI, Prisma schema, migrations, generated client, or dependencies.

## Implementation Design

### Public API

Update `src/lib/rankingSnapshot.ts` to keep the existing legacy array functions and add explicit value helpers. Use exact names where practical:

```ts
export type CreateRankingSnapshotOptions = Readonly<{
  capturedAt?: Date;
}>;

export type CreateRankingSnapshotResult =
  | Readonly<{ ok: true; snapshot: RankingSnapshot }>
  | Readonly<{
      ok: false;
      errors: readonly RankingSnapshotCreationError[];
    }>;

export function createRankingSnapshotFromRankingSet(
  rankingSet: RankingSet,
  options?: CreateRankingSnapshotOptions,
): CreateRankingSnapshotResult;

export function copyRankingEntries(
  rankings: readonly RankingEntry[],
): RankingEntry[];
```

The implementation may choose a more specific internal helper name, but the public boundary must make source-set-to-snapshot creation explicit and must not require repository access.

### Snapshot Creation Flow

`createRankingSnapshotFromRankingSet` must:

1. Validate the input with `validateRankingSet`.
2. Return structured creation errors if validation fails.
3. Copy `rankingSet.entries` into new `RankingEntry` and `Player` objects.
4. Copy `rankingSet.capabilities` into a new capability object, including a new `tiers` object.
5. Copy `rankingSet.id` to `sourceRankingSetId`.
6. Copy `rankingSet.name` to `sourceRankingSetName`.
7. Use `options.capturedAt` when provided, otherwise create a valid `Date`.
8. Return a `RankingSnapshot` value whose `rankings` are the only values intended for Draft State Engine and Recommendation Engine input.

Do not mutate, freeze, sort, renumber, or otherwise repair the source ranking set. Invalid ranking sets should fail rather than being normalized into snapshots.

### Legacy Snapshot Serialization

Keep `serializeRankingSnapshot(rankings)` and `parseRankingSnapshotJson(snapshot)` compatible with the existing bare-array representation:

- `serializeRankingSnapshot` should continue accepting `RankingEntry[]` and returning `RankingSnapshotJson`.
- `parseRankingSnapshotJson` should continue accepting only the legacy array and returning `RankingEntry[]`.
- Existing error messages for malformed legacy arrays should remain stable unless TypeScript requires a tiny wording change.
- If helper reuse is added, it must not change JSON shape or Scenario V1 output.

This slice should not introduce a new persisted snapshot JSON object format. Metadata-aware persistence belongs to a later slice only if draft creation and repository contracts require it.

### Scenario Compatibility

Scenario V1 must remain a complete embedded ranking-entry contract:

- `serializeScenarioV1` should still write `rankingContext.rankings` as a serialized legacy ranking array.
- `parseScenarioV1Json` should still validate and return `rankingContext.rankings` as `RankingEntry[]`.
- Scenario import and replay should not require a source ranking-set record or capability metadata.
- Neutral tiers and nullable ADP must continue to be materialized in the ranking entries so replay behavior does not depend on capability metadata.

Prefer adding regression tests around the existing scenario modules over changing scenario production code.

### Error Mapping

Add snapshot creation errors only for expected managed-set validation failures:

```ts
type RankingSnapshotCreationError = Readonly<{
  code: "invalid-ranking-set";
  path: string;
  message: string;
}>;
```

Map `validateRankingSet` errors to `invalid-ranking-set` while preserving path and message. Unexpected thrown failures should still throw.

## Tests

Expand `src/lib/rankingSnapshot.test.ts` to cover:

- `createRankingSnapshotFromRankingSet` copies all ranking entry and player fields.
- Snapshot creation returns fresh entry, player, capabilities, tiers, and `Date` objects.
- Mutating the source ranking set after snapshot creation does not change snapshot rankings, capabilities, source provenance, or captured time.
- Source ranking-set ID and name are copied only as optional provenance outside snapshot rankings.
- Invalid managed ranking sets return structured `invalid-ranking-set` errors and do not produce a snapshot.
- `copyRankingEntries` or the equivalent shared helper preserves null ADP, neutral tiers, rank fields, player identity, team, position, and order.
- Existing legacy `serializeRankingSnapshot` and `parseRankingSnapshotJson` behavior remains unchanged, including malformed input failures.

Add focused regressions in existing scenario tests only if needed:

- Scenario V1 serialization still emits `rankingContext.rankings` as the legacy array, without snapshot capabilities or source ranking-set provenance.
- Scenario V1 validation and replay still work from embedded ranking entries with neutral tiers and nullable ADP.
- Scenario parsing returns fresh ranking values and does not depend on a managed ranking set.

Keep tests behavior-focused and avoid asserting private implementation details.

## Implementation Steps

1. Update `src/lib/rankingSnapshot.ts` with pure copy helpers, managed ranking-set snapshot creation, validation-error mapping, and unchanged legacy parse/serialize contracts.
2. Update `src/lib/rankingSnapshot.test.ts` with managed snapshot creation, deep-copy isolation, validation failure, and legacy compatibility coverage.
3. Add focused scenario serialization/validation/replay regression coverage only if existing tests do not already prove the Task 15 compatibility criteria.
4. Keep draft repository, ranking-set repository, ranking management workflow, recommendation engine, scenario schema, UI, Prisma schema, generated client, and dependencies unchanged unless TypeScript requires a tiny type-only import adjustment.
5. Run focused snapshot tests.
6. Run focused scenario validation, serialization, portability/replay, draft repository mapping, and draft repository tests.
7. Run focused ranking-set validation tests.
8. Run TypeScript no-emit and focused lint for touched files.
9. Run the full test suite and repository-wide lint.
10. After validation passes, mark only Phase 5 Task 15 complete in `docs/tasks.md` and update this slice completion status.
11. Report results and stop. Do not begin Task 16.

## Expected Files

- `src/lib/rankingSnapshot.ts`
- `src/lib/rankingSnapshot.test.ts`
- `src/lib/scenarioSerialization.test.ts`, only if a focused Scenario V1 serialization regression is needed
- `src/lib/scenarioValidation.test.ts`, only if a focused Scenario V1 parse/replay regression is needed
- `src/lib/scenarioPortability.test.ts`, only if replay/source-independence coverage is missing and this file already owns that behavior
- `docs/tasks.md`, after implementation validation only
- `docs/current-slice.md`, for completion status after implementation

Avoid changes to draft setup, draft actions, draft repository persistence shape, ranking-set repository, ranking management workflow, recommendation engine, Scenario V1 schema/types, Prisma schema, migrations, generated source, dependencies, and UI files.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSnapshot.test.ts
npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioPortability.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts
npm test -- src/lib/rankingSetValidation.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSnapshot.ts src/lib/rankingSnapshot.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioPortability.test.ts
npm test
npm run lint
```

Expected result:

- focused snapshot tests pass for managed snapshot creation, deep-copy isolation, validation failure mapping, and legacy array compatibility;
- scenario validation, serialization, portability/replay, and draft repository mapping tests continue to pass;
- ranking-set validation tests continue to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Acceptance Criteria

- Snapshot creation from a managed ranking set returns a complete `RankingSnapshot` value with copied ranking entries.
- Snapshot entries and players share no mutable object references with the source ranking set.
- Snapshot capabilities and tier metadata are copied for inspection and share no mutable object references with the source ranking set.
- Snapshot provenance may include source ranking-set ID and name, but engine input remains only `snapshot.rankings`.
- Invalid managed ranking sets fail with structured snapshot creation errors.
- Changing or deleting a source ranking set after snapshot creation cannot alter the snapshot value.
- Existing Phase 2 bare-array ranking snapshots still serialize, parse, hydrate, and reject malformed values as before.
- Scenario V1 files continue to serialize, validate, import, and replay with embedded `RankingEntry[]` values and without source ranking-set records.
- Neutral tiers and nullable ADP remain materialized in snapshot and scenario ranking entries, so recommendation behavior does not depend on capability metadata.
- Draft State Engine and Recommendation Engine code paths continue receiving only canonical `RankingEntry[]` values.
- No schema, migration, dependency, UI, draft-setup, ranking-selection, recommendation-tuning, snapshot-update, or Scenario V1 schema change is introduced.
- Only Phase 5 Task 15 is checked complete after validation passes.

## Failure Handling

- If `validateRankingSet` rejects the source set, return mapped snapshot creation errors and do not create a partial snapshot.
- If existing legacy snapshot tests require changing the persisted JSON shape, stop and report the conflict.
- If scenario compatibility appears to require adding capability metadata to Scenario V1, stop and report the conflict with the design guardrail.
- If draft repository tests suggest changing draft creation or snapshot persistence shape, stop and report the issue rather than broadening into Task 16.
- If recommendation behavior changes from metadata alone, stop and report the regression.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 16: integrate explicit ranking-set selection into draft creation by loading a selected managed ranking set, checking league capacity, creating an immutable snapshot through this boundary, and persisting draft plus snapshot atomically.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 15 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains a pure snapshot boundary over already documented mutable ranking-set and immutable snapshot separation.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It formalizes pure snapshot creation and legacy compatibility without changing draft setup.
- Executable by a lower-reasoning pass: yes. Inputs, helper behavior, error mapping, expected files, tests, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It reuses existing ranking-set validation and snapshot modules without schema, repository, UI, or engine changes.
- Blast radius reasonable: yes. The expected production change is one module, with focused tests and optional scenario regressions.
- Review/revert comfort: yes. The boundary is isolated and does not alter persisted JSON shape.
- Observable/testable acceptance criteria: yes. Deep-copy behavior, provenance copying, validation failures, legacy parsing, scenario compatibility, and engine-input preservation are directly assertable.
