# Current Slice: Ranking Reorder Editor

## Completion Status

Planned. This slice promotes the second implementation increment of Phase 5 Task 18. Implementation has not started.

## Source Context

- Phase 5 Task 17 is complete. `RankingLibraryPanel` lists managed ranking sets and supports import, export, delete, diagnostics, refresh, and opening a set for review.
- The first Task 18 increment is complete. `RankingSetEditorPanel` can load one complete ranking set, display canonical entries and provenance, and persist a rename through `editRankingLibrarySetAction`.
- Phase 5 Task 18 remains incomplete. Player correction, reorder, and tier editing are still open.
- `src/app/actions/rankingActions.ts` already exposes `editRankingLibrarySetAction({ id, intent })`, which accepts any `RankingSetEditIntent` and adds an action-owned timestamp.
- `src/lib/rankingSetEditing.ts` already supports the pure `reorder-player` intent and derives canonical overall and position ranks after reorder.
- `src/components/RankingSetEditorPanel.tsx` currently renders the canonical entry table but has no controls for reorder, player correction, or tier editing.
- Existing tests use Vitest, `vi.mock`, and `renderToStaticMarkup`; do not add testing dependencies.

## Goal

Allow a user to move a player to a new overall rank from the ranking detail editor and persist the reorder through the existing application edit workflow.

This proves the Task 18 reorder path end to end while keeping player correction and tier editing for later slices.

## Scope

### Goals

- Add a focused reorder form to `RankingSetEditorPanel`.
- Let the user choose a player from the currently loaded ranking set and enter a target overall rank.
- Submit a `reorder-player` intent through the existing `editRankingLibrarySetAction` path.
- Refresh the editor from the saved canonical aggregate after success.
- Display reordered canonical overall ranks and derived position ranks from the returned aggregate.
- Display structured validation, not-found, conflict, and persistence failures without replacing the current valid editor view.
- Keep immutable draft snapshot behavior visibly distinct from mutable ranking sets.
- Preserve existing import, export, delete, rename, Draft Room, draft setup, scenario, and recommendation behavior.

### Non-Goals

- Do not add player-field correction UI yet.
- Do not add tier assignment or tier update UI yet.
- Do not add drag/drop reorder, animations, keyboard shortcuts, undo, history, bulk editing, merge, compare, or source-file editing.
- Do not calculate ranks, validate reorder targets, validate tier progression, or derive capability states in UI.
- Do not edit draft snapshots or existing drafts.
- Do not add draft setup ranking-set selection. That remains Task 19.
- Do not change parser, normalizer, validator, converter, repository schema, migrations, generated source, recommendation scoring, Scenario V1, or package dependencies.

## Implementation Design

### Editor Props

Update `src/components/RankingSetEditorPanel.tsx` props:

```ts
type RankingSetEditorPanelProps = {
  rankingSet: RankingSet;
  isSaving: boolean;
  errors: readonly RankingManagementError[];
  onRename: (name: string) => void;
  onReorder: (input: Readonly<{ playerId: string; toOverallRank: number }>) => void;
  onClose: () => void;
};
```

The editor may keep local form state for selected player ID and target overall rank text. It must not locally mutate entries or recalculate ranks.

### Reorder UI

Add a compact reorder form near the rename form:

- player selector populated from the loaded ranking set in canonical `overallRank` order;
- numeric target overall rank input;
- submit button labeled clearly for reorder.

On submit:

- parse the target rank with `Number(...)`;
- call `onReorder({ playerId, toOverallRank })`;
- do not clamp, repair, or validate the value in UI beyond requiring a selected player and passing a number;
- let domain/application workflow return structured validation for invalid ranks, missing players, and stale data.

The selected player label should include current overall rank, player name, and position so the user can make a useful choice.

### Ranking Library Integration

Update `src/components/RankingLibraryPanel.tsx`:

- Pass an `onReorder` handler to `RankingSetEditorPanel`.
- Submit:

```ts
editRankingLibrarySetAction({
  id: loadedRankingSet.id,
  intent: {
    type: "reorder-player",
    playerId,
    toOverallRank,
  },
});
```

- On success:
  - update `loadedRankingSet` from the returned aggregate;
  - clear editor errors;
  - refresh summaries with `listRankingLibraryAction()`;
  - show a success message.
- On failure:
  - show returned management errors in the editor;
  - keep the current loaded set unchanged.
- Reuse the existing `isSavingEditor` state unless separating rename and reorder saving state is necessary for clarity.

### Error Display

Use the existing editor error display for reorder failures.

Management errors should preserve:

- `code`
- `message`
- `path` when present

Do not add a new diagnostics abstraction unless the existing helper cannot be reused cleanly.

## Implementation Steps

1. Update `src/components/RankingSetEditorPanel.tsx` to render the reorder form and accept an `onReorder` prop.
2. Update `src/components/RankingSetEditorPanel.test.tsx` for:
   - reorder form rendering;
   - player selector labels include overall rank, name, and position;
   - target rank numeric input and submit button render;
   - canonical entry table still renders in returned aggregate order;
   - structured reorder errors render through the existing error list.
3. Update `src/components/RankingLibraryPanel.tsx` to handle reorder submissions through `editRankingLibrarySetAction`, refresh summaries after success, and preserve the current loaded view on failure.
4. Update `src/components/RankingLibraryPanel.test.tsx` only if static markup expectations change.
5. Add or update action tests only if action behavior changes. No new server action is expected.
6. Run focused editor, library panel, ranking actions, and ranking management workflow tests.
7. Run pure ranking-set editing tests to verify reorder domain behavior remains covered.
8. Run Draft Room render regression tests.
9. Run TypeScript no-emit and lint for touched files.
10. Run the full test suite and repository-wide lint.
11. After validation passes, update this slice completion status only. Do not mark Phase 5 Task 18 complete yet.
12. Report results and stop. Do not begin player correction, tier editing, or Task 19.

## Expected Files

- `src/components/RankingSetEditorPanel.tsx`
- `src/components/RankingSetEditorPanel.test.tsx`
- `src/components/RankingLibraryPanel.tsx`
- `src/components/RankingLibraryPanel.test.tsx`, only if needed
- `src/app/actions/rankingActions.test.ts`, only if action test coverage needs an added generic edit-intent assertion
- `docs/current-slice.md`, for completion status after implementation

Avoid changes to Draft Room, draft setup, parser/normalizer/import/export internals, ranking repository internals, Prisma schema, migrations, generated source, recommendation engine, Scenario V1 files, package dependencies, and `docs/tasks.md`.

## Tests

Update editor component tests covering:

- reorder form appears when a ranking set is loaded;
- player options are based on canonical overall order;
- target overall rank input is present;
- reorder submit button is present;
- entry table continues to display overall rank and derived position rank from props;
- reorder-related structured errors render with code, message, and path.

Update library panel or action tests as needed to cover:

- existing review, rename, import, export, and delete markup expectations still hold;
- reorder uses the existing edit action path where practical without adding browser interaction dependencies.

Keep interaction-heavy load/save behavior to action tests and manual QA unless current test utilities already make it straightforward. Do not add testing dependencies.

## Automated Validation

Run from the repository root:

```text
npm test -- src/components/RankingSetEditorPanel.test.tsx src/components/RankingLibraryPanel.test.tsx src/app/actions/rankingActions.test.ts
npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingManagementWorkflow.test.ts src/lib/rankingSetRepository.test.ts
npm test -- src/components/DraftRoom.test.tsx
npx tsc --noEmit
npm run lint -- src/components/RankingSetEditorPanel.tsx src/components/RankingSetEditorPanel.test.tsx src/components/RankingLibraryPanel.tsx src/components/RankingLibraryPanel.test.tsx src/app/actions/rankingActions.test.ts
npm test
npm run lint
```

Expected result:

- focused editor, panel, and action tests pass;
- pure ranking editing, management workflow, and repository tests continue to pass;
- Draft Room render test continues to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Manual QA

After automated validation, run the app locally only if practical and complete a small browser check:

1. Open the home page and load one ranking set through `Review/Edit`.
2. Move a player to a valid target overall rank and confirm the editor shows the returned overall and position ranks.
3. Attempt an invalid target rank such as `0` or a value larger than the entry count and confirm a structured error appears while the prior valid view remains.
4. Confirm rename still works after a reorder.
5. Confirm import, export, delete, and Draft Room behavior still work as before.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- A user can submit a reorder for one loaded ranking set from the detail editor.
- Successful reorder persists through the application edit workflow.
- The editor refreshes from the returned canonical aggregate after success.
- Reordered overall ranks and derived position ranks display from domain output, not UI calculation.
- Invalid target ranks, stale/missing players, conflicts, and persistence errors show useful feedback and preserve the current valid editor view.
- UI code performs no ranking normalization, validation, conversion, rank calculation, tier legality calculation, or direct persistence mapping.
- Existing rename, import, export, delete, Draft Room, Draft History, developer workbench, draft setup, selected-ranking draft creation action, scenario import/export, and recommendation behavior remain unchanged.
- No schema, migration, dependency, player correction, tier-editing, draft setup selection, Scenario V1, or recommendation-tuning change is introduced.
- Phase 5 Task 18 remains incomplete after this slice; player correction and tier editing still need follow-up slices.

## Failure Handling

- If reorder fails, show returned management errors and keep the current loaded set unchanged.
- If summary refresh fails after reorder, keep the updated editor view and show the refresh error.
- If the loaded set is deleted, keep existing behavior and clear the editor.
- If unexpected server-action errors throw, show a generic operation failure message and log the error.
- If implementation appears to require player correction, tier editing, or draft setup selection, stop and report the Task 18/19 boundary.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Documentation Updates After Implementation

- Update only this file's completion status after implementation validation passes.
- Do not update `docs/tasks.md` to mark Task 18 complete until later slices implement player correction and tier editing.
- No `docs/architecture.md`, `docs/project.md`, or `docs/decisions.md` update is expected if the slice remains a thin UI layer over existing workflows.
- The existing recommendation to establish a checked-in Prisma migration baseline and local/CI database setup remains outside this slice.

## Follow-Up Slice

Continue Phase 5 Task 18 by adding supported player correction UI or tier assignment/update controls over the editor shell. Keep pure domain edit rules authoritative and immutable draft snapshots unchanged.

## Slice Review

- Smallest meaningful increment: yes. It adds one remaining Task 18 edit mode without bundling correction or tier editing.
- Executable by a lower-reasoning pass: yes. Component behavior, integration path, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It reuses the existing edit action and pure `reorder-player` intent.
- Blast radius reasonable: yes. Planned changes are limited to the editor, library integration, focused tests, and slice status.
- Review/revert comfort: yes. The reorder UI can be removed without changing domain, repository, or draft behavior.
- Observable/testable acceptance criteria: yes. Reorder success, derived rank display, invalid-rank failure, and unchanged draft behavior are directly observable.
