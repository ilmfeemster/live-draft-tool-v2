# Current Slice: Ranking Detail and Rename Editor

## Completion Status

Implemented and validated. This slice completed the first implementation increment of Phase 5 Task 18; Task 18 remains open for follow-up edit modes.

## Source Context

- Phase 5 Task 17 is complete. `RankingLibraryPanel` lists managed ranking sets and supports import, export, delete, diagnostics, and refresh.
- Phase 5 Task 18 is the next incomplete task. It adds focused ranking and tier editing UI while keeping domain rules authoritative.
- `src/lib/rankingManagementWorkflow.ts` already exposes `loadManagedRankingSet(id)` and `editManagedRankingSet({ id, updatedAt, intent })`.
- `src/lib/rankingSetEditing.ts` already supports pure edit intents for rename, player correction, reorder, complete position-tier assignment, and single source-tier update.
- `src/app/actions/rankingActions.ts` currently wraps only list, import, delete, and export actions.
- `src/components/RankingLibraryPanel.tsx` currently renders summaries and management controls but cannot load full ranking-set entries or edit them.
- Existing tests use Vitest, `vi.mock`, and `renderToStaticMarkup`; do not add testing dependencies.

## Goal

Allow a user to open one managed ranking set from the library, inspect its full canonical entries and capability provenance, and persist a ranking-set rename through the existing application edit workflow.

This establishes the Task 18 editor path without yet adding ranking reorder, player correction, or tier editing controls.

## Scope

### Goals

- Add server actions for loading one complete ranking set and submitting a managed ranking edit intent.
- Add a focused ranking detail/editor panel that displays:
  - ranking-set name, source kind, lifecycle metadata, and capability status;
  - canonical overall order;
  - player name, team, position, ADP, position rank, and tier;
  - concise provenance for team, ADP, derived position rank, and per-position tier capability.
- Add a rename form that submits a `rename` edit intent through the application workflow.
- Refresh the loaded detail view and summary list after a successful rename.
- Display structured load, validation, conflict, not-found, and persistence failures without replacing the currently loaded valid view.
- Keep immutable draft snapshot behavior visibly distinct from mutable ranking sets.
- Preserve existing import, export, delete, Draft Room, draft setup, scenario, and recommendation behavior.

### Non-Goals

- Do not add player-field correction UI yet.
- Do not add reorder UI yet.
- Do not add tier assignment or tier update UI yet.
- Do not calculate ranks, validate tier progression, or derive capability states in UI.
- Do not add spreadsheet-grade editing, drag/drop, undo, history, merge, compare, or source-file editing.
- Do not edit draft snapshots or existing drafts.
- Do not add draft setup ranking-set selection. That remains Task 19.
- Do not change parser, normalizer, validator, converter, repository schema, migrations, recommendation scoring, Scenario V1, or package dependencies.

## Implementation Design

### Server Actions

Extend `src/app/actions/rankingActions.ts` with thin wrappers:

```ts
export async function loadRankingLibrarySetAction(
  id: string,
): Promise<RankingManagementResult<RankingSet>>;

export async function editRankingLibrarySetAction(
  input: Readonly<{
    id: string;
    intent: RankingSetEditIntent;
  }>,
): Promise<RankingManagementResult<RankingSet>>;
```

Delegation rules:

- `loadRankingLibrarySetAction` calls `loadManagedRankingSet(id)`.
- `editRankingLibrarySetAction` calls `editManagedRankingSet({ id, intent, updatedAt: new Date() })`.
- Return structured workflow results unchanged.
- Let unexpected workflow failures reject so tests can verify they are not swallowed.
- Do not expose repository records or persistence shapes through the action boundary.

### Ranking Library Integration

Update `src/components/RankingLibraryPanel.tsx`:

- Add a `Review/Edit` button to each summary card.
- On click, call `loadRankingLibrarySetAction(summary.id)`.
- Keep the last successfully loaded ranking set visible if a later load or save fails.
- Render the editor below the library controls or beside them at desktop widths.
- After a successful rename:
  - update the loaded ranking set from the returned canonical aggregate;
  - call `listRankingLibraryAction()` to refresh summaries;
  - show a success message.
- If a loaded set is deleted through existing delete behavior, clear the editor when it is showing that deleted set.

### Editor Component

Add `src/components/RankingSetEditorPanel.tsx` as a client-presentational component.

Expected props:

```ts
type RankingSetEditorPanelProps = {
  rankingSet: RankingSet;
  isSaving: boolean;
  errors: readonly RankingManagementError[];
  onRename: (name: string) => void;
  onClose: () => void;
};
```

Expected behavior:

1. Initialize a local rename input from `rankingSet.name`.
2. Reset the rename input when a different ranking set is loaded.
3. Render source and lifecycle metadata without exposing persistence records.
4. Render capability provenance concisely:
   - team availability;
   - ADP availability;
   - position rank as derived;
   - source-tier positions;
   - defaulted-neutral tier positions.
5. Render a compact canonical entry table ordered by `overallRank`.
6. Include player name, ID, team, position, overall rank, position rank, tier, and ADP.
7. Submit only a rename string through `onRename`.
8. Display provided structured errors.
9. Include copy that distinguishes mutable ranking sets from immutable draft snapshots.

The component must not calculate new ranks, validate edits, derive tier legality, or mutate entries locally.

### Error Display

Management errors should preserve:

- `code`
- `message`
- `path` when present

Use existing `formatManagementError` from `RankingLibraryPanel` if practical, or move shared formatting helpers only if needed. Do not add a new diagnostics abstraction unless duplication becomes meaningful.

## Implementation Steps

1. Extend `src/app/actions/rankingActions.ts` with load and edit server actions.
2. Extend `src/app/actions/rankingActions.test.ts` with tests for:
   - load delegates to `loadManagedRankingSet`;
   - edit delegates to `editManagedRankingSet` with an action-owned timestamp;
   - structured load/edit errors are returned unchanged;
   - unexpected load/edit workflow failures reject.
3. Add `src/components/RankingSetEditorPanel.tsx` with ranking metadata, capability provenance, canonical entry table, rename form, close control, and structured error rendering.
4. Add `src/components/RankingSetEditorPanel.test.tsx` with static rendering and pure helper coverage for:
   - metadata and immutable snapshot copy;
   - canonical entry display;
   - capability provenance text;
   - structured management errors;
   - rename input and save button presence.
5. Update `src/components/RankingLibraryPanel.tsx` to load one ranking set, render `RankingSetEditorPanel`, submit rename edits, refresh summaries after success, and clear the editor when the loaded set is deleted.
6. Update `src/components/RankingLibraryPanel.test.tsx` only for static markup changes such as the new `Review/Edit` button.
7. Run focused action, editor, panel, and ranking management workflow tests.
8. Run Draft Room render regression tests.
9. Run TypeScript no-emit and lint for touched files.
10. Run the full test suite and repository-wide lint.
11. After validation passes, update this slice completion status only. Do not mark Phase 5 Task 18 complete yet.
12. Report results and stop. Do not begin player correction, reorder, tier editing, or Task 19.

## Expected Files

- `src/app/actions/rankingActions.ts`
- `src/app/actions/rankingActions.test.ts`
- `src/components/RankingLibraryPanel.tsx`
- `src/components/RankingLibraryPanel.test.tsx`
- `src/components/RankingSetEditorPanel.tsx`
- `src/components/RankingSetEditorPanel.test.tsx`
- `docs/current-slice.md`, for completion status after implementation

Avoid changes to Draft Room, draft setup, parser/normalizer/import/export internals, ranking repository internals, Prisma schema, migrations, generated source, recommendation engine, Scenario V1 files, package dependencies, and `docs/tasks.md`.

## Tests

Add or update server-action tests covering:

- load action delegates to `loadManagedRankingSet`;
- edit action delegates to `editManagedRankingSet` with `updatedAt: new Date()`;
- not-found, invalid edit, name conflict, and persistence errors are returned unchanged;
- unexpected workflow failures reject.

Add editor component tests covering:

- full ranking-set metadata renders;
- entries render in canonical overall order;
- team, ADP, position-rank, and tier capability provenance renders;
- neutralized tier positions are visible as defaulted-neutral/neutralized;
- structured errors render with code, message, and path;
- rename input and save button render without creating edit intents in the component test.

Update existing ranking library panel tests to cover:

- summary cards expose a `Review/Edit` command;
- existing import/export/delete markup expectations still hold.

Interaction-heavy load/save behavior may be covered through action tests and manual QA unless current test utilities already make it straightforward. Do not add testing dependencies.

## Automated Validation

Run from the repository root:

```text
npm test -- src/app/actions/rankingActions.test.ts src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx
npm test -- src/lib/rankingManagementWorkflow.test.ts src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts
npm test -- src/components/DraftRoom.test.tsx
npx tsc --noEmit
npm run lint -- src/app/actions/rankingActions.ts src/app/actions/rankingActions.test.ts src/components/RankingLibraryPanel.tsx src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.tsx src/components/RankingSetEditorPanel.test.tsx
npm test
npm run lint
```

Expected result:

- focused action, editor, and panel tests pass;
- ranking management, pure editing, and repository tests continue to pass;
- Draft Room render test continues to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Manual QA

After automated validation, run the app locally only if practical and complete a small browser check:

1. Open the home page and confirm ranking summaries still render.
2. Click `Review/Edit` for one ranking set and confirm full entries render in canonical order.
3. Rename the set and confirm the editor and summary list show the saved name.
4. Attempt an invalid blank rename and confirm a structured error appears while the prior valid view remains.
5. Delete the loaded set and confirm the editor clears while existing draft snapshots remain unaffected.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- A user can open one managed ranking set from the library and inspect full canonical entries.
- The detail view shows overall rank, position rank, player facts, ADP, and tier values from the loaded domain aggregate.
- The detail view shows concise provenance for team, ADP, derived position rank, and per-position tier capability.
- A user can rename a ranking set through the application edit workflow.
- Successful rename persists, reloads into the editor, and refreshes the summary list.
- Invalid rename, not-found, conflict, and persistence errors show useful feedback and preserve the current valid editor view.
- UI code performs no ranking normalization, validation, conversion, rank calculation, tier legality calculation, or direct persistence mapping.
- Existing import, export, delete, Draft Room, Draft History, developer workbench, draft setup, selected-ranking draft creation action, scenario import/export, and recommendation behavior remain unchanged.
- No schema, migration, dependency, player correction, reorder, tier-editing, draft setup selection, Scenario V1, or recommendation-tuning change is introduced.
- Phase 5 Task 18 remains incomplete after this slice; this is only the first editor increment.

## Failure Handling

- If loading a set fails, show the returned management errors and keep the last valid editor view if one exists.
- If rename fails, show returned management errors and keep the current loaded set unchanged.
- If summary refresh fails after rename, keep the updated editor view and show the refresh error.
- If the loaded set is deleted, clear the editor.
- If unexpected server-action errors throw, show a generic operation failure message and log the error.
- If implementation appears to require player correction, reorder, tier editing, or draft setup selection, stop and report the Task 18/19 boundary.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Documentation Updates After Implementation

- Update only this file's completion status after implementation validation passes.
- Do not update `docs/tasks.md` to mark Task 18 complete until later slices implement the remaining Task 18 edit modes.
- No `docs/architecture.md`, `docs/project.md`, or `docs/decisions.md` update is expected if the slice remains a thin UI and server-action layer over existing workflows.
- The existing recommendation to establish a checked-in Prisma migration baseline and local/CI database setup remains outside this slice.

## Follow-Up Slice

Continue Phase 5 Task 18 by adding player correction, reorder, and tier assignment/update controls over the editor shell created here. Keep pure domain edit rules authoritative and immutable draft snapshots unchanged.

## Slice Review

- Smallest meaningful increment: yes. It creates the editor path and proves one persisted edit without bundling every edit mode.
- Executable by a lower-reasoning pass: yes. Actions, component behavior, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing workflows and pure edit intents without schema, repository, or engine changes.
- Blast radius reasonable: yes. Planned code changes are the ranking action file, ranking library panel, one new editor component, and focused tests.
- Review/revert comfort: yes. The detail editor can be removed without changing ranking domain internals or draft behavior.
- Observable/testable acceptance criteria: yes. Loading, entry display, provenance display, rename success/failure, and unchanged draft behavior are directly observable.
