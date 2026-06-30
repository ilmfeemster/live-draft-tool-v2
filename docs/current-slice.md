# Current Slice: Complete Task 18 - Ranking and Tier Editing UI

## Completion Status

Planned and ready for implementation.

## Source Context

- Phase 5 Task 18 is the active task: add focused ranking and tier editing UI.
- The editor already loads one managed ranking set and supports review, rename, reorder, and basic player fact correction through `editRankingLibrarySetAction`.
- The remaining Task 18 work is tier editing UI.
- `src/lib/rankingSetEditing.ts` already supports `assign-position-tiers` and `update-tier`.
- Use complete position-tier assignment as the UI path for this task. It supports updating existing source tiers and replacing `defaulted-neutral` position tiers with authored source tiers.
- Do not add a separate single-player `update-tier` shortcut unless it becomes necessary to satisfy Task 18.

## Goal

Finish Phase 5 Task 18 by allowing a user to assign or update tiers for a represented position from the ranking detail editor, while keeping domain tier rules authoritative and preserving immutable draft snapshot behavior.

## Scope

### Goals

- Add a position tier assignment form to `RankingSetEditorPanel`.
- Let the user choose a represented position from the loaded ranking set.
- Show every player at that position in canonical overall order.
- Let the user edit one tier value per displayed player.
- Submit an `assign-position-tiers` intent through the existing `editRankingLibrarySetAction` workflow.
- Refresh the loaded editor from the returned canonical aggregate after success.
- Display returned tier values and tier capability states from domain output.
- Show structured edit errors without replacing the current valid editor view.
- Preserve existing rename, reorder, player correction, import, export, delete, Draft Room, draft setup, scenario, and recommendation behavior.

### Non-Goals

- Do not add player identity editing or position editing.
- Do not add draft setup ranking-set selection; that remains Task 19.
- Do not add spreadsheet controls, bulk paste, drag animation, history, undo, merge, compare, or source-file editing.
- Do not validate tier legality, calculate ranks, derive capability states, or repair tier inputs in UI.
- Do not edit draft snapshots or existing drafts.
- Do not change parser, normalizer, validator, converter, repository schema, migrations, generated source, recommendation scoring, Scenario V1, or package dependencies.

## Implementation Step

1. Complete Task 18 tier editing in the existing ranking editor.

   Update `RankingSetEditorPanel` to accept an `onAssignPositionTiers` prop, derive represented position options from canonical entries, keep local selected-position and tier-text state, render complete selected-position tier inputs, and submit every selected-position player as:

   ```ts
   onAssignPositionTiers({
     position,
     assignments: selectedPositionEntries.map((entry) => ({
       playerId: entry.player.id,
       tier: Number(tierTextByPlayerId[entry.player.id] ?? ""),
     })),
   });
   ```

   Update `RankingLibraryPanel` to pass that handler through `editRankingLibrarySetAction` with `type: "assign-position-tiers"`, update `loadedRankingSet` from successful results, refresh summaries, and preserve the current loaded view on failure.

   Update focused tests for tier form rendering, represented position options, canonical player order, prefilled tier values, `source` and `defaulted-neutral` capability display, structured tier errors, and unchanged existing editor/library markup expectations.

## Expected Files

- `src/components/RankingSetEditorPanel.tsx`
- `src/components/RankingSetEditorPanel.test.tsx`
- `src/components/RankingLibraryPanel.tsx`
- `src/components/RankingLibraryPanel.test.tsx`, only if static markup changes
- `src/app/actions/rankingActions.test.ts`, only if action coverage needs a generic edit-intent assertion
- `docs/current-slice.md`, for completion status after implementation
- `docs/tasks.md`, after validation, to mark Phase 5 Task 18 complete

## Tests

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
- lint passes;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled.

## Manual QA

Run the app locally only if practical:

1. Open a managed ranking set through `Review/Edit`.
2. Assign tiers for a source-tier position and confirm returned values display.
3. Assign complete tiers for a `defaulted-neutral` position and confirm returned values and `source` capability display.
4. Try an invalid tier assignment, such as a blank, zero, fractional, or decreasing tier, and confirm structured errors appear while the prior valid view remains.
5. Confirm rename, reorder, player correction, import, export, delete, and Draft Room behavior still work.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- A user can submit complete tier assignments for one represented position from the detail editor.
- Source tiers can be updated and `defaulted-neutral` position tiers can be replaced with authored source tiers.
- Successful tier assignments persist through the application edit workflow.
- The editor refreshes from the returned canonical aggregate after success.
- Tier values and capability states display from domain output, not UI calculation.
- Invalid tier edits, stale or missing players, conflicts, and persistence errors show useful feedback and preserve the current valid editor view.
- UI code performs no ranking normalization, validation, conversion, rank calculation, tier legality calculation, capability derivation, or direct persistence mapping.
- Existing rename, reorder, player correction, import, export, delete, Draft Room, Draft History, developer workbench, draft setup, selected-ranking draft creation action, scenario import/export, and recommendation behavior remain unchanged.
- No schema, migration, dependency, player identity editing, position editing, draft setup selection, Scenario V1, or recommendation-tuning change is introduced.
- After implementation validation, Phase 5 Task 18 is marked complete in `docs/tasks.md`.

## Failure Handling

- If tier assignment fails, show returned management errors and keep the current loaded set unchanged.
- If summary refresh fails after tier assignment, keep the updated editor view and show the refresh error.
- If implementation appears to require identity editing, position editing, draft setup selection, source-file editing, or recommendation changes, stop and report the Task 18/19 boundary.
- If unrelated tests fail, report them separately and do not broaden this task.

## Follow-Up

After Task 18 is complete, plan Task 19: add ranking-set selection to draft setup. Do not begin Task 19 automatically.

## Slice Review

- Smallest meaningful increment: yes. This finishes the active Task 18 rather than creating another sub-task chain.
- Executable by a lower-reasoning pass: yes. The edit path, files, tests, and acceptance criteria are explicit.
- Avoids unnecessary architecture changes: yes. It reuses the existing edit action and pure `assign-position-tiers` domain intent.
- Blast radius reasonable: yes. Planned changes are limited to editor UI, library integration, focused tests, and task status.
- Review/revert comfort: yes. The UI can be removed without changing domain, repository, draft, or recommendation behavior.
- Observable/testable acceptance criteria: yes. Tier assignment success, invalid edit failure, capability transition, and unchanged draft behavior are directly observable.
