# Current Slice: Integrate Ranking Set Selection into Draft Creation

## Completion Status

Complete. The selected-ranking draft creation workflow is implemented as an application boundary that validates a ranking-set ID, loads the managed set, validates league setup and capacity against the selected set's entries, snapshots the set through `createRankingSnapshotFromRankingSet`, and persists a new draft using only copied canonical `RankingEntry[]` values. A new server action delegates to this workflow with automatic draft naming, while the existing Draft Room compatibility action remains unchanged for the current UI. Focused workflow and action tests pass 30 tests; focused draft repository, mapping, loader, snapshot, and ranking-set repository tests pass 71 tests with one expected database-gated skip; TypeScript no-emit passes; focused lint passes; the full Vitest suite passes 41 files and 569 tests with one expected skip; repository-wide lint passes. Phase 5 Task 16 is complete.

## Source Context

- Phase 5 Task 15 is complete. `src/lib/rankingSnapshot.ts` now exposes `createRankingSnapshotFromRankingSet` and `copyRankingEntries`, while legacy bare-array snapshot serialization/parsing remains compatible.
- `src/app/actions/draftActions.ts` currently creates configured drafts from `LeagueSetupInput` and the code-owned `seedRankings` array.
- `src/lib/draftRepository.ts` already persists a draft and its ranking snapshot atomically by accepting `rankings: RankingEntry[]` and serializing them through `serializeRankingSnapshot`.
- `src/lib/draftRepositoryMapping.ts`, draft hydration, pick, undo, reset, delete, and recommendation flows already hydrate persisted snapshots back into the existing `DraftWorkspace` shape.
- `src/lib/rankingSetRepository.ts` exposes `getRankingSetById`, which loads a complete managed `RankingSet` domain aggregate or `null`.
- `buildLeagueSetup(input, rankingPlayerCount)` already performs league setup validation and ranking-capacity checks.
- `DraftRoom.tsx` currently calls `createConfiguredDraftAction(input)` without ranking-set selection. Task 19 owns adding ranking-set selection UI, so this slice should expose the selected-ranking creation path without redesigning the setup UI.

## Goal

Create an application-level draft creation workflow that starts a new draft from an explicitly selected managed ranking set, captures an immutable snapshot through the Task 15 boundary, and preserves existing draft persistence, hydration, and recommendation behavior.

## Scope

### Goals

- Add a focused application workflow for configured draft creation from a selected ranking-set ID.
- Validate a non-empty selected ranking-set ID before creating a draft.
- Load the selected managed ranking set through the ranking-set repository.
- Return a structured not-found result when the selected ranking set is missing.
- Validate league setup and draft capacity using the selected set's entry count.
- Create an immutable snapshot with `createRankingSnapshotFromRankingSet`.
- Persist the new draft through the existing draft repository using only `snapshot.rankings`.
- Return the existing `DraftWorkspace` shape.
- Prove that two different selected ranking sets create drafts with distinct captured snapshots.
- Prove that later source-set edit or deletion cannot change the created draft workspace or reloaded snapshot.
- Add a server action entry point for the selected-ranking creation workflow so Task 19 UI can call it.

### Non-Goals

- Do not add ranking-set selection UI, controls, default-selection UI behavior, or Draft Room redesign.
- Do not remove or redesign the existing Draft Room setup flow in this slice.
- Do not migrate, rewrite, or version persisted draft ranking snapshots.
- Do not persist source ranking-set dependency as engine input.
- Do not allow switching ranking sets on an existing draft.
- Do not change pick, undo, reset, delete, refresh, resume, recommendation, scenario, import, export, ranking edit, Prisma schema, migrations, generated client, or dependencies.
- Do not introduce ranking merge, fallback, repair, or seed bootstrap behavior beyond loading an already-managed ranking set.

## Implementation Design

### Public Workflow

Add `src/lib/draftCreationWorkflow.ts` with a small injectable workflow. Use exact names where practical:

```ts
export type CreateConfiguredDraftFromRankingSetInput = Readonly<{
  leagueSetup: LeagueSetupInput;
  rankingSetId: string;
  name?: string;
  capturedAt?: Date;
}>;

export type CreateConfiguredDraftFromRankingSetError = Readonly<{
  code:
    | "invalid-request"
    | "ranking-set-not-found"
    | "invalid-league-setup"
    | "invalid-ranking-set";
  message: string;
  path?: string;
}>;

export type CreateConfiguredDraftFromRankingSetResult =
  | Readonly<{ ok: true; workspace: DraftWorkspace }>
  | Readonly<{
      ok: false;
      errors: readonly CreateConfiguredDraftFromRankingSetError[];
    }>;

export async function createConfiguredDraftFromRankingSet(
  input: CreateConfiguredDraftFromRankingSetInput,
  dependencies?: DraftCreationWorkflowDependencies,
): Promise<CreateConfiguredDraftFromRankingSetResult>;
```

Use structural dependencies for:

- `getRankingSetById(id)`
- `createDraftWorkspace(input)`

Default dependencies should point to the existing repository exports.

### Workflow Flow

`createConfiguredDraftFromRankingSet` must:

1. Trim and validate `rankingSetId`.
2. Return `invalid-request` with `path: "rankingSetId"` for a blank ID.
3. Load the selected ranking set by ID.
4. Return `ranking-set-not-found` with `path: "rankingSetId"` when missing.
5. Run `buildLeagueSetup(input.leagueSetup, rankingSet.entries.length)`.
6. Map setup failures to `invalid-league-setup`, preserving the setup field as `path` and message.
7. Call `createRankingSnapshotFromRankingSet(rankingSet, { capturedAt })`.
8. Map snapshot failures to `invalid-ranking-set`, preserving path and message.
9. Call `createDraftWorkspace` with:
   - `name`;
   - validated `leagueSettings`;
   - a fresh copy of `snapshot.rankings`;
   - validated `userTeamId`.
10. Return the repository-owned `DraftWorkspace`.

Do not pass `RankingSet`, capabilities, source-set ID, source-set name, or repository records into the draft repository or engines. Snapshot metadata remains outside the current draft repository persistence contract for this slice.

Unexpected repository or infrastructure errors should still throw. Do not catch and reword database failures.

### Server Action Boundary

Update `src/app/actions/draftActions.ts` to export a new action, named where practical:

```ts
export async function createConfiguredDraftFromRankingSetAction(
  input: Readonly<{
    leagueSetup: LeagueSetupInput;
    rankingSetId: string;
  }>,
): Promise<CreateConfiguredDraftFromRankingSetResult>;
```

The action should:

1. Generate the automatic draft name with `formatAutomaticDraftName()`.
2. Delegate to `createConfiguredDraftFromRankingSet`.
3. Return the workflow result unchanged.

Keep the current `createConfiguredDraftAction(input)` compatibility path in place for the existing Draft Room UI until Task 19 wires ranking-set selection. Do not expand that legacy path. Tests should make clear that the new selected-ranking action is the authoritative Task 16 path.

### Draft Repository Boundary

Prefer leaving `src/lib/draftRepository.ts` unchanged. It already owns atomic draft-plus-snapshot persistence once it receives `RankingEntry[]`.

Only make a tiny type adjustment if TypeScript requires accepting readonly rankings. Do not persist ranking-set ID or capability metadata in this slice.

## Tests

Add `src/lib/draftCreationWorkflow.test.ts` with focused fake repositories. Cover:

- Blank ranking-set ID returns `invalid-request` and does not call either repository.
- Missing ranking set returns `ranking-set-not-found` and does not create a draft.
- Invalid league setup or insufficient selected-set capacity returns `invalid-league-setup` and does not create a draft.
- Valid creation loads the selected set, creates a snapshot, persists only copied ranking entries, and returns the draft repository result.
- Two different selected ranking sets create drafts with different snapshot rankings.
- Mutating the source ranking set after creation does not change the captured rankings passed to the draft repository or returned workspace.
- Deleting the fake source ranking set after creation does not prevent loading the created draft from the fake draft repository.
- Snapshot validation failures map to `invalid-ranking-set`.
- Degraded/defaulted-neutral entries are persisted as materialized ranking values and do not require capability metadata for recommendation input.
- The workflow does not call list, replace, delete, ranking management workflow, scenario, recommendation, or UI code.

Update `src/app/actions/draftActions.test.ts` to cover:

- `createConfiguredDraftFromRankingSetAction` delegates to the selected-ranking workflow with an automatic name.
- Workflow errors are returned unchanged.
- Unexpected workflow/repository failures reject.
- Existing legacy create, delete, draft, undo, and reset action tests continue to pass.

Add or extend repository/loader tests only if implementation touches those files. Prefer focused workflow tests over broad repository assertions because the draft repository already tests snapshot persistence and hydration.

## Implementation Steps

1. Add `src/lib/draftCreationWorkflow.ts` with request/result types, injected repository dependencies, validation/error mapping helpers, and the selected-ranking draft creation function.
2. Add `src/lib/draftCreationWorkflow.test.ts` with fake ranking-set and draft repositories covering success, missing/blank selected set, insufficient capacity, snapshot failure, source edit/delete isolation, and distinct selected-set snapshots.
3. Update `src/app/actions/draftActions.ts` with `createConfiguredDraftFromRankingSetAction` delegating to the new workflow and automatic draft naming.
4. Update `src/app/actions/draftActions.test.ts` for the new action while preserving existing legacy action behavior for the current UI.
5. Keep `src/lib/draftRepository.ts`, `src/lib/draftRepositoryMapping.ts`, `src/lib/draftWorkspaceLoader.ts`, `src/components/DraftRoom.tsx`, ranking-set repository, recommendation engine, Scenario V1 files, Prisma schema, generated client, and dependencies unchanged unless TypeScript requires a tiny type-only adjustment.
6. Run focused workflow and action tests.
7. Run focused draft repository, draft repository mapping, draft workspace loader, ranking snapshot, and ranking-set repository tests.
8. Run TypeScript no-emit and focused lint for touched files.
9. Run the full test suite and repository-wide lint.
10. After validation passes, mark only Phase 5 Task 16 complete in `docs/tasks.md` and update this slice completion status.
11. Report results and stop. Do not begin Task 17 or Task 19.

## Expected Files

- `src/lib/draftCreationWorkflow.ts`
- `src/lib/draftCreationWorkflow.test.ts`
- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `docs/tasks.md`, after implementation validation only
- `docs/current-slice.md`, for completion status after implementation

Avoid changes to `src/components/DraftRoom.tsx`, `src/lib/draftWorkspaceLoader.ts`, `src/lib/draftRepository.ts`, `src/lib/draftRepositoryMapping.ts`, ranking-set repository, ranking-management workflow, recommendation engine, Scenario V1 files, Prisma schema, migrations, generated source, dependencies, and UI files unless the implementation hits a direct TypeScript-only need.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/draftCreationWorkflow.test.ts src/app/actions/draftActions.test.ts
npm test -- src/lib/draftRepository.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftWorkspaceLoader.test.ts src/lib/rankingSnapshot.test.ts src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/draftCreationWorkflow.ts src/lib/draftCreationWorkflow.test.ts src/app/actions/draftActions.ts src/app/actions/draftActions.test.ts
npm test
npm run lint
```

Expected result:

- focused selected-ranking creation workflow and action tests pass;
- draft repository, mapping, loader, snapshot, and ranking-set repository tests continue to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Acceptance Criteria

- A selected-ranking draft creation workflow accepts an explicit ranking-set ID and never uses `seedRankings` as its ranking source.
- Missing or blank ranking-set IDs return structured errors without creating a draft.
- League setup and capacity validation use the selected ranking set's entry count.
- A valid selected ranking set is snapshotted through `createRankingSnapshotFromRankingSet` before persistence.
- The draft repository receives only copied canonical `RankingEntry[]` values, not mutable ranking-set aggregates, source-set IDs, capabilities, or repository records.
- Creating drafts from two different selected sets produces distinct persisted snapshot inputs and returned workspaces.
- Later source-set edit or deletion does not change or block loading the created draft workspace.
- Existing persisted draft hydration, pick, undo, reset, delete, and recommendation behavior remains unchanged.
- Existing legacy Phase 2 snapshots continue to load.
- Existing Draft Room UI behavior is not redesigned in this slice; UI selection is deferred to Task 19.
- No schema, migration, dependency, recommendation-tuning, Scenario V1, import/export, ranking edit, or UI change is introduced.
- Only Phase 5 Task 16 is checked complete after validation passes.

## Failure Handling

- If ranking-set ID is blank, return `invalid-request`; do not call repositories.
- If the selected ranking set is missing, return `ranking-set-not-found`; do not create a draft.
- If `buildLeagueSetup` fails, return mapped `invalid-league-setup` errors; do not create a draft.
- If snapshot creation fails, return mapped `invalid-ranking-set` errors; do not create a draft.
- If draft repository creation throws unexpectedly, let it throw.
- If implementing this slice appears to require Draft Room selection UI, stop and report the Task 16/Task 19 boundary.
- If implementation appears to require changing draft snapshot persistence shape, stop and report the conflict.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 17 if following task order strictly: add the ranking library and import/export UI. Task 19 will later wire ranking-set selection into the Draft Room setup UI using the selected-ranking draft creation action from this slice.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 16 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains an application workflow over existing ranking-set repository, snapshot creation, league setup validation, and draft repository boundaries.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It adds the selected-ranking draft creation boundary without the UI selection work.
- Executable by a lower-reasoning pass: yes. Inputs, dependencies, flow, error mapping, expected files, tests, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing repositories, league setup validation, and snapshot creation without schema or engine changes.
- Blast radius reasonable: yes. The expected production changes are one new workflow module plus one new server action.
- Review/revert comfort: yes. The workflow is isolated and keeps the existing UI compatibility path untouched.
- Observable/testable acceptance criteria: yes. Selected-set loading, capacity validation, snapshot capture, source isolation, action delegation, and regression behavior are directly assertable.
