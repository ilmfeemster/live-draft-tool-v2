# Current Slice: Ranking Player Facts Correction Editor

## Completion Status

Implemented and validated.

This slice is the next focused implementation increment of Phase 5 Task 18. Task 18 remains open after this slice because tier editing is still required.

## Source Context

- Phase 5 Task 17 is complete. The ranking library can list, import, export, delete, and open managed ranking sets.
- The first Task 18 increment is complete. `RankingSetEditorPanel` can load one complete ranking set, display canonical entries and provenance, and persist a rename through `editRankingLibrarySetAction`.
- The second Task 18 increment is complete. The editor can submit a `reorder-player` intent and refresh from the returned canonical aggregate.
- Phase 5 Task 18 still requires supported player-field correction and tier editing UI.
- `src/app/actions/rankingActions.ts` already exposes `editRankingLibrarySetAction({ id, intent })`, which accepts any `RankingSetEditIntent` and adds an action-owned timestamp.
- `src/lib/rankingSetEditing.ts` already supports the pure `correct-player` intent.
- `correct-player` can update player identity, name, team, position, ADP, and tier in the domain layer, but position, identity, and tier edits have more complicated capability and invariant behavior.
- Existing tests use Vitest, `vi.mock`, and `renderToStaticMarkup`; do not add testing dependencies.

## Goal

Allow a user to correct basic player facts for one loaded mutable ranking set from the ranking detail editor and persist those corrections through the existing application edit workflow.

This proves the Task 18 player-correction path end to end while keeping player identity changes, position changes, and tier editing for later slices.

## Scope

### Goals

- Add a focused player correction form to `RankingSetEditorPanel`.
- Let the user choose a player from the currently loaded ranking set.
- Let the user edit the selected player's display name, team, and ADP rank.
- Submit a `correct-player` intent through the existing `editRankingLibrarySetAction` path.
- Refresh the editor from the saved canonical aggregate after success.
- Display corrected player facts and refreshed capability states from the returned aggregate.
- Display structured validation, not-found, conflict, and persistence failures without replacing the current valid editor view.
- Keep immutable draft snapshot behavior visibly distinct from mutable ranking sets.
- Preserve existing import, export, delete, rename, reorder, Draft Room, draft setup, scenario, and recommendation behavior.

### Non-Goals

- Do not add player ID editing yet.
- Do not add player position editing yet.
- Do not add tier assignment or tier update UI yet.
- Do not add bulk editing, spreadsheet controls, inline table editing, undo, history, merge, compare, or source-file editing.
- Do not calculate ranks, validate player facts, validate tier progression, or derive capability states in UI.
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
  onCorrectPlayer: (
    input: Readonly<{
      playerId: string;
      changes: Readonly<{
        name: string;
        team: string;
        adpRank: number | null;
      }>;
    }>,
  ) => void;
  onClose: () => void;
};
```

The editor may keep local form state for selected player ID, name text, team text, and ADP text. It must not locally mutate entries, recalculate ranks, validate player facts, or infer capability states.

### Player Correction UI

Add a compact player correction form near the existing rename and reorder controls:

- player selector populated from the loaded ranking set in canonical `overallRank` order;
- selected player label includes current overall rank, player name, position, and team;
- editable text input for player name;
- editable text input for team;
- numeric input for ADP rank that can be blank;
- submit button labeled clearly for saving the correction.

When the selected player changes:

- populate the form from the selected canonical entry;
- display a blank ADP field when `player.adpRank` is `null`;
- leave player ID and position visible only as context, not editable controls.

On submit:

- require only that a player is selected;
- map blank ADP text to `null`;
- map nonblank ADP text with `Number(...)`;
- call:

```ts
onCorrectPlayer({
  playerId,
  changes: {
    name,
    team,
    adpRank,
  },
});
```

Do not trim, clamp, repair, or reject values in the UI beyond the minimal ADP text-to-value mapping needed to call the typed action. Let the domain/application workflow return structured validation for invalid names, teams, ADP values, missing players, conflicts, and persistence failures.

### Ranking Library Integration

Update `src/components/RankingLibraryPanel.tsx`:

- Pass an `onCorrectPlayer` handler to `RankingSetEditorPanel`.
- Submit:

```ts
editRankingLibrarySetAction({
  id: loadedRankingSet.id,
  intent: {
    type: "correct-player",
    playerId,
    changes,
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
- Reuse the existing `isSavingEditor` state unless separating edit-specific saving state becomes necessary for clarity.

### Error Display

Use the existing editor error display for correction failures.

Management errors should preserve:

- `code`
- `message`
- `path` when present

Do not add a new diagnostics abstraction unless the existing helper cannot be reused cleanly.

## Implementation Steps

1. Update `src/components/RankingSetEditorPanel.tsx` to render the player correction form and accept an `onCorrectPlayer` prop.
2. Update editor local state so changing the selected correction player repopulates name, team, and ADP fields from the current canonical entry.
3. Update `src/components/RankingSetEditorPanel.test.tsx` for:
   - correction form rendering;
   - player selector labels include overall rank, name, position, and team;
   - selected player values prefill name, team, and ADP fields;
   - blank ADP is represented as an empty input;
   - structured correction errors render through the existing error list;
   - existing rename, reorder, provenance, and canonical table markup expectations still hold.
4. Update `src/components/RankingLibraryPanel.tsx` to handle correction submissions through `editRankingLibrarySetAction`, refresh summaries after success, and preserve the current loaded view on failure.
5. Update `src/components/RankingLibraryPanel.test.tsx` only if static markup expectations change.
6. Add or update action tests only if action behavior changes. No new server action is expected.
7. Run focused editor, library panel, ranking actions, and ranking management workflow tests.
8. Run pure ranking-set editing tests to verify correction domain behavior remains covered.
9. Run Draft Room render regression tests.
10. Run TypeScript no-emit and lint for touched files.
11. Run the full test suite and repository-wide lint.
12. After validation passes, update this slice completion status only. Do not mark Phase 5 Task 18 complete yet.
13. Report results and stop. Do not begin tier editing, position editing, identity editing, or Task 19.

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

- correction form appears when a ranking set is loaded;
- player options are based on canonical overall order;
- selected player facts are visible in editable fields;
- blank ADP values render as empty ADP input values;
- player ID and position are not editable in this slice;
- entry table continues to display values from props;
- correction-related structured errors render with code, message, and path.

Update library panel or action tests as needed to cover:

- existing review, rename, reorder, import, export, and delete markup expectations still hold;
- correction uses the existing edit action path where practical without adding browser interaction dependencies.

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
2. Correct a player's name, team, and ADP, then confirm the editor shows the returned values.
3. Clear a player's ADP and confirm the saved aggregate displays ADP as unavailable/blank according to the existing table behavior.
4. Attempt an invalid correction such as a blank player name or invalid ADP number and confirm a structured error appears while the prior valid view remains.
5. Confirm rename and reorder still work after a correction.
6. Confirm import, export, delete, and Draft Room behavior still work as before.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- A user can submit a basic player facts correction for one loaded ranking set from the detail editor.
- Supported corrections include player name, team, and ADP rank.
- Successful corrections persist through the application edit workflow.
- The editor refreshes from the returned canonical aggregate after success.
- Corrected values and capability states display from domain output, not UI calculation.
- Invalid player fact edits, stale/missing players, conflicts, and persistence errors show useful feedback and preserve the current valid editor view.
- UI code performs no ranking normalization, validation, conversion, rank calculation, tier legality calculation, or direct persistence mapping.
- Existing rename, reorder, import, export, delete, Draft Room, Draft History, developer workbench, draft setup, selected-ranking draft creation action, scenario import/export, and recommendation behavior remain unchanged.
- No schema, migration, dependency, player identity editing, position editing, tier-editing, draft setup selection, Scenario V1, or recommendation-tuning change is introduced.
- Phase 5 Task 18 remains incomplete after this slice; tier editing still needs a follow-up slice.

## Failure Handling

- If correction fails, show returned management errors and keep the current loaded set unchanged.
- If summary refresh fails after correction, keep the updated editor view and show the refresh error.
- If the loaded set is deleted, keep existing behavior and clear the editor.
- If unexpected server-action errors throw, show a generic operation failure message and log the error.
- If implementation appears to require player identity editing, position editing, tier editing, or draft setup selection, stop and report the Task 18/19 boundary.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Documentation Updates After Implementation

- Update only this file's completion status after implementation validation passes.
- Do not update `docs/tasks.md` to mark Task 18 complete until tier editing is implemented.
- No `docs/architecture.md`, `docs/project.md`, or `docs/decisions.md` update is expected if the slice remains a thin UI layer over existing workflows.
- The existing recommendation to establish a checked-in Prisma migration baseline and local/CI database setup remains outside this slice.

## Follow-Up Slice

Continue Phase 5 Task 18 by adding tier assignment/update controls over the editor shell. Keep pure domain edit rules authoritative and immutable draft snapshots unchanged.

## Slice Review

- Smallest meaningful increment: yes. It adds one remaining Task 18 edit mode without bundling tier editing, identity editing, position editing, or draft setup selection.
- Executable by a lower-reasoning pass: yes. Component behavior, integration path, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It reuses the existing edit action and pure `correct-player` intent.
- Blast radius reasonable: yes. Planned changes are limited to the editor, library integration, focused tests, and slice status.
- Review/revert comfort: yes. The correction UI can be removed without changing domain, repository, or draft behavior.
- Observable/testable acceptance criteria: yes. Correction success, returned value display, invalid edit failure, and unchanged draft behavior are directly observable.
