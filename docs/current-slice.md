# Current Slice: Tier Semantics Task 6b - Neutralize Legacy Draft Snapshot Tiers

## Completion Status

Complete. Focused tests, the full automated suite, and TypeScript validation pass.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Completed prerequisite: Task 5 neutralizes FantasyPros engine-facing tiers while preserving source tiers.
- Completed prerequisite: Task 6a persists ranking-set tier semantics and conservatively maps legacy ranking-set rows.
- Current draft snapshot behavior:
  - persisted `RankingSnapshot.rankings` values are unversioned JSON arrays of `RankingEntry` values;
  - draft hydration parses those arrays through `parseRankingSnapshotJson` and exposes them directly as `DraftWorkspace.rankings`;
  - old persisted arrays may therefore still contain ambiguous non-neutral tier values that reach recommendations;
  - the same generic ranking-snapshot parser is also used by Scenario V1 validation, so changing its behavior globally would broaden this slice into scenario compatibility.

The immediate product problem is preventing ambiguous overall tiers from acting like position-tier recommendation pressure. This slice closes the persisted-draft hydration path only. It does not introduce a new snapshot format or persist tier-semantics metadata; those broader portability capabilities remain deferred unless later engine work proves they are necessary.

## Goal

Ensure every existing unversioned persisted draft ranking snapshot hydrates with neutral engine-facing tiers, without changing generic ranking-array parsing or Scenario V1 behavior.

## Scope

### Goals

- Add a draft-specific persisted snapshot parser at the ranking-snapshot boundary.
- Reuse existing strict ranking-entry parsing before applying compatibility behavior.
- Replace every hydrated persisted-draft `RankingEntry.tier` with `NEUTRAL_TIER`.
- Preserve player, overall rank, position rank, ADP, canonical order, and array length exactly.
- Return independently owned entry and player objects.
- Update draft repository mapping to use the draft-specific compatibility parser.
- Keep the generic `parseRankingSnapshotJson` behavior unchanged for Scenario V1 and other callers.
- Add focused tests proving legacy draft snapshot neutralization and parser isolation.

### Non-Goals

- Do not add a new versioned draft snapshot JSON contract.
- Do not persist `RankingSnapshot.capabilities` or `RankingSnapshot.tierSemantics` in this slice.
- Do not change snapshot database schema or add a migration.
- Do not change ranking-set repository behavior.
- Do not change Scenario V1 validation, serialization, replay, or fixtures.
- Do not change Canonical Ranking Set JSON import/export.
- Do not change Recommendation Engine scoring, components, reasons, or tuning yet.
- Do not add recommendation-tier authoring or infer eligible tiers.
- Do not update UI or manual QA.
- Do not update `docs/tasks.md` or mark patch Task 6 complete.

## Implementation Steps

1. Add a draft-specific compatibility parser.

   In `src/lib/rankingSnapshot.ts`, add one explicit function, preferably:

   ```ts
   parsePersistedDraftRankingSnapshotJson(snapshot: unknown): RankingEntry[]
   ```

   The function must:

   - call the existing `parseRankingSnapshotJson` first so malformed legacy JSON retains the current stable validation behavior;
   - map the parsed entries to fresh entry and player objects;
   - set only `tier` to `NEUTRAL_TIER`;
   - preserve every other parsed value and canonical order;
   - remain pure and deterministic.

   Do not add format detection, metadata inference, or source-specific logic. Every persisted unversioned draft snapshot is ambiguous and receives the same conservative treatment.

2. Keep the generic parser unchanged.

   `parseRankingSnapshotJson` and `serializeRankingSnapshot` must retain their current array round-trip behavior. Scenario V1 and other generic ranking-array consumers must not be silently neutralized by this slice.

   Do not rename the existing functions or alter their accepted JSON shape.

3. Route persisted draft hydration through the compatibility parser.

   In `src/lib/draftRepositoryMapping.ts`:

   - replace the `parseRankingSnapshotJson` import with the new draft-specific parser;
   - use it only for `record.rankingSnapshot.rankings`;
   - keep league-settings parsing, pick-history mapping, draft hydration, and workspace shape unchanged.

   Do not change `DraftWorkspace`, `CreateDraftWorkspaceInput`, `draftRepository.ts`, or database types.

4. Add focused ranking-snapshot tests.

   In `src/lib/rankingSnapshot.test.ts`, add tests proving:

   - the draft-specific parser converts mixed non-neutral legacy tiers to `NEUTRAL_TIER`;
   - all non-tier fields and ordering are preserved;
   - returned entries and players do not share references with parsed or source values;
   - malformed input still throws the existing parser error;
   - `serializeRankingSnapshot` plus generic `parseRankingSnapshotJson` still round-trips non-neutral tiers unchanged.

5. Update draft repository mapping tests.

   In `src/lib/draftRepositoryMapping.test.ts`:

   - update the persisted snapshot expectation that currently exposes tier `4` unchanged;
   - assert that the hydrated workspace exposes `NEUTRAL_TIER` instead;
   - assert that player, rank, position-rank, ADP, and team values remain unchanged;
   - keep invalid snapshot and pick-history behavior unchanged.

6. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts
   npx tsc --noEmit
   ```

   The draft repository and creation tests protect the real persistence workflow. The scenario tests prove that leaving the generic parser unchanged preserves the deferred Scenario V1 boundary.

7. Finalize this slice.

   If focused validation passes:

   - update this file's Completion Status to complete;
   - do not mark patch Task 6 complete;
   - do not update `docs/tasks.md`;
   - recommend Task 7 as the next active slice;
   - record Canonical JSON and richer snapshot/scenario portability as deferred compatibility work rather than beginning it automatically.

## Expected Files

- `src/lib/rankingSnapshot.ts`
- `src/lib/rankingSnapshot.test.ts`
- `src/lib/draftRepositoryMapping.ts`
- `src/lib/draftRepositoryMapping.test.ts`
- `docs/current-slice.md`, after validation, to record completion status

Do not touch these files in this slice:

- `src/types/rankings.ts`
- `src/types/draft.ts`
- `src/lib/draftRepository.ts`
- `src/lib/draftCreationWorkflow.ts`
- `src/lib/rankingSetRepository.ts`
- `src/lib/recommendations.ts`
- Canonical JSON files
- Scenario or replay files
- Prisma schema or migrations
- UI components
- fixtures or data files
- `docs/tasks.md`
- `docs/patches/tier-semantics-tasks.md`

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts
npx tsc --noEmit
```

Expected result:

- Existing persisted draft arrays hydrate successfully.
- Hydrated draft rankings contain only `NEUTRAL_TIER` values.
- No ambiguous persisted tier can reach recommendations through `DraftWorkspace.rankings`.
- Non-tier ranking values and draft pick history remain unchanged.
- Generic ranking-array parsing still preserves supplied tiers for deferred Scenario V1 compatibility.
- No schema, engine, scenario, export, or UI behavior changes.

## Manual QA

No app manual QA is required for this compatibility-mapper slice.

Manual review should confirm:

- neutralization occurs only in persisted draft hydration;
- generic ranking snapshot parsing remains byte-shape compatible with existing array callers;
- no scenario or recommendation code changed;
- the new helper is a small compatibility boundary, not a new snapshot abstraction.

## Acceptance Criteria

- A persisted draft snapshot containing tier values such as `1`, `2`, and `4` hydrates with every entry tier equal to `NEUTRAL_TIER`.
- Hydration preserves player identity, player fields, overall rank, position rank, ADP, ordering, and entry count.
- Invalid persisted snapshot JSON retains the current error behavior.
- Hydrated rankings are independently owned values.
- Generic `serializeRankingSnapshot` and `parseRankingSnapshotJson` continue preserving non-neutral tiers unchanged.
- Scenario V1 validation and serialization tests pass without scenario code changes.
- No database, ranking-set repository, canonical JSON, Recommendation Engine, UI, dependency, data-file, `docs/tasks.md`, or patch-task-status changes are introduced.
- Focused tests and `npx tsc --noEmit` pass.

## Failure Handling

- If draft hydration cannot be isolated from Scenario V1 without changing shared public behavior, stop and report the coupling rather than changing scenarios in this slice.
- If neutralizing persisted entries breaks draft invariants unrelated to tiers, report the failure rather than modifying draft state logic.
- If Recommendation Engine changes are required to make neutral tiers no-op, stop; that belongs to Task 7.
- If unrelated worktree changes overlap the four target source/test files, preserve them and report any conflict that prevents safe editing.

## Follow-Up

After this slice, plan Task 7 to ensure tier-drop scoring and tier-cliff reasons no-op for neutral recommendation tiers. Canonical JSON evolution and richer Scenario/snapshot portability remain deferred unless explicitly reprioritized. Do not begin the next slice automatically.

## Slice Review

- Smallest meaningful increment: yes. It closes the remaining legacy persisted-draft route into recommendation input.
- Executable by a lower-reasoning pass: yes. One helper, one call-site change, focused assertions, and explicit non-goals define the work.
- Avoids unnecessary architecture changes: yes. Existing array storage, domain types, and workspace boundaries remain intact.
- Blast radius reasonable: yes. Runtime changes affect two modules and two focused test files.
- Review/revert comfort: yes. Draft-only compatibility neutralization is isolated and reversible.
- Observable/testable acceptance criteria: yes. Exact hydrated values and generic parser isolation are directly assertable.
