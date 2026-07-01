# Current Slice: Tier Semantics Patch Slice 2 - New Draft Snapshot Semantics

## Completion Status

Complete. New V2 snapshot envelopes, explicit tier-semantics hydration, legacy array compatibility, focused validation, the full automated suite, and TypeScript validation pass.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 2.
- Approved design: `docs/design/tier-semantics.md`, especially immutable snapshots and persistence compatibility.
- Completed prerequisite: Canonical Ranking JSON V2 now preserves explicit source and recommendation tier semantics.
- Completed prerequisite: ranking sets persist `RankingSet.tierSemantics`, and legacy ranking-set rows load conservatively.
- Completed prerequisite: legacy persisted draft snapshot arrays load with neutral recommendation tiers.
- Current snapshot facts:
  - `RankingSnapshot` can represent capabilities, tier semantics, source-set provenance, and capture time;
  - `createRankingSnapshotFromRankingSet` currently copies only entries, capabilities, provenance, and capture time, dropping `tierSemantics`;
  - `RankingSnapshot.rankings` is one Prisma `Json` column, so a versioned envelope can be stored without a schema migration;
  - repository writes currently serialize only a bare `RankingEntry[]`;
  - persisted draft hydration currently treats every stored snapshot as legacy and neutralizes every tier;
  - the managed draft-creation workflow creates a rich snapshot but passes only its entries to the repository.

## Goal

Persist complete, immutable tier semantics with every newly written draft ranking snapshot and hydrate recommendation tiers according to that stored eligibility, while keeping legacy bare-array snapshots readable and recommendation-neutral.

## Scope

### Goals

- Define a versioned persisted ranking-snapshot JSON envelope for new writes.
- Store engine-facing rankings separately from source-tier metadata inside the envelope.
- Preserve capabilities, tier semantics, source ranking-set identity/name, and capture time when available.
- Make all new repository snapshot writes explicit: managed snapshots retain their semantics; callers without semantics receive a conservative legacy-ambiguous/neutral envelope.
- Continue reading pre-patch bare ranking arrays.
- Treat legacy array tiers as ambiguous source values and return neutral engine-facing tiers.
- Preserve explicitly recommendation-eligible tiers from new envelopes during hydration.
- Reject malformed new envelopes rather than inferring eligibility from numeric values.
- Keep snapshot data independent from later ranking-set edits or deletion.

### Non-Goals

- Do not rewrite existing snapshot rows.
- Do not add or alter Prisma models, columns, migrations, or generated clients.
- Do not make draft workspaces query mutable ranking sets during load.
- Do not expose snapshot metadata in `DraftWorkspace` or add UI.
- Do not persist recommendation output.
- Do not change Scenario V1 parsing or replay.
- Do not change recommendation scoring, weights, or reasons.
- Do not add a generic snapshot migration framework.
- Do not update dependencies, data files, `docs/tasks.md`, or unrelated documentation.

## Persisted Snapshot Contract

- Keep the existing `RankingSnapshot.rankings` Prisma JSON column. New writes store a document in this shape:

  ```text
  {
    schemaVersion: 2,
    rankings: RankingEntry[],
    capabilities?: RankingSetCapabilities,
    tierSemantics: RankingTierSemantics,
    sourceRankingSetId?: string,
    sourceRankingSetName?: string,
    capturedAt: ISO-8601 string
  }
  ```

- The envelope's `rankings` are the engine-facing immutable values. Source-tier values remain only in `tierSemantics.source.values`.
- For an explicit managed snapshot:
  - copy `RankingSet.tierSemantics` deeply;
  - preserve entry tiers for positions marked `recommendation-position`;
  - require neutral positions to contain `NEUTRAL_TIER`;
  - copy capabilities and provenance.
- For a new repository write that has entries but no explicit semantics:
  - classify the original entry tiers as `legacy-ambiguous` source values;
  - materialize `NEUTRAL_TIER` in every persisted engine-facing entry;
  - mark every represented position `neutral`;
  - convert represented tier capabilities to `defaulted-neutral` when capabilities are supplied;
  - never infer recommendation eligibility from the tier numbers.
- For a legacy bare-array snapshot:
  - keep accepting the array shape;
  - preserve its original tier numbers only as legacy-ambiguous source metadata in the parsed snapshot value;
  - return neutral engine-facing rankings;
  - do not require fields that the legacy document never stored.
- `capturedAt` is copied from the managed snapshot when provided; repository-created conservative envelopes use the repository write time.

## Implementation Steps

1. Add the versioned snapshot envelope and deep-copy helpers.

   In `src/lib/rankingSnapshot.ts`:

   - define the V2 persisted envelope type and update `RankingSnapshotJson` to cover legacy arrays and V2 envelopes;
   - keep `parseRankingSnapshotJson` as the existing bare-array parser for low-level compatibility tests;
   - allow `serializeRankingSnapshot` to distinguish a legacy array fixture from a `RankingSnapshot` value:
     - an array serializes as the legacy array shape;
     - a snapshot value serializes as the V2 envelope;
   - add one internal conservative materialization path for snapshot values missing tier semantics;
   - deep-copy capabilities, source-tier values, recommendation semantics, entries, and dates;
   - serialize `capturedAt` as an ISO string without mutating the input.

2. Make managed snapshot creation preserve exact semantics.

   In `createRankingSnapshotFromRankingSet`:

   - continue validating the source ranking set first;
   - copy explicit `RankingSet.tierSemantics` into the snapshot;
   - when semantics are absent, create the conservative legacy-ambiguous source metadata and neutral recommendation entries described above;
   - align snapshot tier capabilities with the materialized recommendation semantics;
   - retain source-set ID/name and the copied capture timestamp;
   - ensure all nested values are independent of the mutable source set.

3. Parse legacy and V2 persisted snapshots through one compatibility boundary.

   Update `parsePersistedDraftRankingSnapshotJson` to return a `RankingSnapshot`:

   - if the stored value is an array, parse it as legacy, preserve raw tiers as legacy source metadata, and neutralize engine-facing entries;
   - if the stored value is an object, require `schemaVersion: 2`, an array `rankings`, an object `tierSemantics`, and a valid `capturedAt` string;
   - parse optional capabilities and provenance when present;
   - preserve tiers only for positions explicitly marked `recommendation-position`;
   - require neutral positions to contain `NEUTRAL_TIER`;
   - reject missing position semantics, unsupported semantics, malformed source-tier references, or inconsistent capabilities with stable errors;
   - do not consult a ranking-set repository during parsing.

4. Write V2 envelopes from the draft repository.

   In `src/lib/draftRepository.ts`:

   - extend `CreateDraftWorkspaceInput` with optional snapshot metadata that excludes the already-present `rankings` array;
   - always combine `input.rankings` with that metadata and serialize a V2 snapshot envelope;
   - if metadata is absent, use the conservative materialization path rather than writing another ambiguous bare array;
   - keep the Prisma write in the existing `rankingSnapshot.create.rankings` JSON field;
   - preserve every other draft create, pick, undo, reset, list, and delete behavior.

5. Hydrate workspaces from the parsed snapshot rankings.

   In `src/lib/draftRepositoryMapping.ts`:

   - consume the `RankingSnapshot` returned by `parsePersistedDraftRankingSnapshotJson`;
   - pass only `snapshot.rankings` into the existing `DraftWorkspace` boundary;
   - do not add mutable source lookups or snapshot metadata to `DraftWorkspace`.

6. Pass managed snapshot metadata through draft creation.

   In `src/lib/draftCreationWorkflow.ts`:

   - continue creating the immutable snapshot before repository persistence;
   - pass copied snapshot metadata alongside `snapshot.rankings` in `CreateDraftWorkspaceInput`;
   - do not independently rebuild tier semantics in the workflow;
   - retain league validation, error mapping, ranking-set selection, and result shape.

7. Add focused snapshot mapper tests.

   In `src/lib/rankingSnapshot.test.ts`, prove:

   - source-only managed semantics persist source values while engine tiers remain neutral;
   - explicit recommendation-position tiers survive creation, V2 serialization, and hydration;
   - mixed eligible/neutral positions retain their exact behavior;
   - a managed set with missing semantics becomes legacy ambiguous and neutral;
   - legacy arrays remain readable, preserve raw values as legacy metadata, and hydrate neutral;
   - malformed V2 metadata, missing position eligibility, non-neutral values in neutral positions, and invalid source references fail;
   - source entries, capabilities, semantics, source values, and dates share no mutable references with the snapshot or serialized value.

8. Add repository mapping and persistence coverage.

   In `src/lib/draftRepository.test.ts` and `src/lib/draftRepositoryMapping.test.ts`, prove:

   - new repository writes store `schemaVersion: 2` in the existing JSON field;
   - explicit managed metadata round-trips without losing eligibility;
   - repository callers without metadata produce conservative V2 envelopes, not legacy arrays;
   - a legacy bare-array database fixture still loads with neutral tiers;
   - eligible new snapshots hydrate their stored recommendation tiers;
   - draft create/load, pick, undo, reset, summaries, and deletion remain unchanged.

9. Add managed draft-creation isolation coverage.

   In `src/lib/draftCreationWorkflow.test.ts`, add source-only, recommendation-eligible, and mixed-semantic ranking-set fixtures and prove:

   - the workflow passes complete copied snapshot metadata to persistence;
   - source tiers remain separate from persisted engine tiers;
   - eligible recommendation tiers remain eligible after simulated hydration;
   - edits to or deletion of the source set after creation do not alter persisted snapshot entries or semantics;
   - degraded and invalid ranking-set behavior remains unchanged.

10. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts src/lib/recommendations.test.ts
   npx tsc --noEmit
   ```

   The recommendation suite is regression-only: it proves the hydrated neutral and explicitly eligible entry values retain the existing engine contract without changing scoring code.

11. Finalize the slice after validation.

   If focused validation passes:

   - update this file's Completion Status to complete;
   - mark only Slice 2 complete in `docs/patches/tier-semantics-tasks.md`;
   - record the exact validation commands and results in the patch task file;
   - do not update `docs/tasks.md` or begin Scenario V1 compatibility automatically.

## Expected Files

Production files:

- `src/lib/rankingSnapshot.ts`
- `src/lib/draftRepository.ts`
- `src/lib/draftRepositoryMapping.ts`
- `src/lib/draftCreationWorkflow.ts`

Focused tests:

- `src/lib/rankingSnapshot.test.ts`
- `src/lib/draftRepository.test.ts`
- `src/lib/draftRepositoryMapping.test.ts`
- `src/lib/draftCreationWorkflow.test.ts`

Tracking after successful implementation:

- `docs/current-slice.md`
- `docs/patches/tier-semantics-tasks.md`

Do not touch:

- `prisma/schema.prisma`, migrations, or generated Prisma files.
- ranking-set repository or Canonical JSON production files.
- Scenario V1, replay, recommendation, or UI production files.
- `src/types/draft.ts` or the `DraftWorkspace` shape.
- dependencies, fixtures outside focused tests, data files, or `docs/tasks.md`.

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts src/lib/recommendations.test.ts
npx tsc --noEmit
```

Expected result:

- New snapshot JSON is a deterministic V2 envelope in the existing column.
- Source-only tiers remain inspectable but hydrate recommendation-neutral.
- Explicitly eligible recommendation tiers survive persistence and hydration.
- Legacy arrays continue loading with conservative neutral behavior.
- Source changes or deletion do not affect stored snapshot behavior.
- Existing draft persistence and recommendation regressions remain green.

Completed result:

- Required focused validation passed: 5 test files and 118 tests.
- Full automated validation passed: 44 test files, 646 tests passed, and 1 test skipped.
- `npx tsc --noEmit` passed.
- ESLint completed with no errors and one pre-existing unused-helper warning in `src/lib/rankingNormalizer.test.ts`.

## Manual QA

No browser QA is required for this persistence-boundary slice.

Manual code review should confirm:

- the Prisma schema is unchanged;
- new snapshot writes are objects, while legacy arrays remain accepted;
- source-tier metadata never directly populates engine-facing tiers;
- eligibility comes only from stored per-position semantics;
- draft loading performs no mutable ranking-set lookup;
- snapshot metadata is copied, not referenced.

## Acceptance Criteria

- Every newly persisted draft ranking snapshot uses the V2 envelope with explicit tier semantics.
- New managed snapshots preserve source-tier values separately from engine-facing recommendation tiers.
- Explicit per-position recommendation eligibility and tier values survive creation, persistence, and hydration.
- Source-only, absent, missing-semantic, and legacy ambiguous values hydrate with neutral tier pressure.
- Legacy bare-array snapshots continue to load deterministically.
- Malformed V2 semantics cannot be upgraded into recommendation eligibility.
- Snapshot entries and metadata remain unchanged after source ranking-set edits or deletion.
- Snapshot hydration remains independent of mutable ranking-set persistence.
- Existing draft create/load, picks, undo, reset, list, delete, and deterministic recommendation behavior remain unchanged.
- No Prisma schema, migration, Scenario V1, replay, scoring, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Required focused tests and `npx tsc --noEmit` pass.

## Failure Handling

- If the V2 envelope cannot fit safely in the existing JSON column, stop and report the exact serialization limitation before proposing schema changes.
- If a currently valid explicit `RankingTierSemantics` state cannot round-trip through the envelope, stop and report that state rather than flattening eligibility.
- If a legacy array lacks enough metadata to preserve source meaning, preserve loadability and neutral recommendation behavior; do not infer eligibility.
- If a new envelope is malformed or contradictory, fail hydration rather than silently treating numeric tiers as eligible.
- If draft repository regressions require changing unrelated draft behavior, report them rather than broadening the slice.
- Preserve unrelated worktree changes, including the completed Canonical JSON slice, and report any unsafe overlap.

## Follow-Up

After this slice is implemented and validated, the next slice is Tier Semantics Patch Slice 3 - Scenario V1 Compatibility. It should keep existing scenarios replayable while neutralizing ambiguous Scenario V1 tiers. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. Snapshot creation, persistence, and hydration stay together because semantics are only useful if they survive the complete immutable boundary.
- Executable by a lower-reasoning pass: yes. The envelope, compatibility behavior, handoff, exact files, tests, and failure rules are specified.
- Avoids unnecessary architecture changes: yes. It reuses the existing JSON column and snapshot module without a migration or new repository.
- Blast radius reasonable: yes. Four production files form the existing creation/serialization/hydration path; the remaining changes are focused tests and tracking.
- Review/revert comfort: yes. No schema, workspace, scenario, scoring, or UI contract changes are included.
- Observable/testable acceptance criteria: yes. Stored JSON shape, parsed metadata, hydrated tier values, repository behavior, and isolation are directly assertable.
