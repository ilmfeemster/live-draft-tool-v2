# Current Slice: Ranking Library Import, Export, and Delete UI

## Completion Status

Implemented and validated. This slice completed Phase 5 Task 17.

## Source Context

- Phase 5 Task 16 is complete. Draft creation can use an explicit managed ranking set through `createConfiguredDraftFromRankingSetAction`, but draft setup ranking-set selection remains deferred to Task 19.
- `src/lib/rankingImportWorkflow.ts` already provides `importRankingSet(input, options)` and owns preflight, parsing, normalization, validation, conversion, and persistence.
- `src/lib/rankingManagementWorkflow.ts` already provides `listManagedRankingSets`, `deleteManagedRankingSet`, and `exportManagedRankingSetJson`.
- `src/types/rankingImport.ts` defines `RankingImportFormatId` as `fantasypros-csv` or `canonical-ranking-json`, plus stage-specific diagnostic locations.
- `src/types/rankings.ts` defines `RankingSetSummary` and capability metadata for team, ADP, and position tiers.
- `src/app/page.tsx` currently loads draft workspace data and renders `DraftHistoryList` followed by `DraftRoom`.
- `src/components/DraftHistoryList.tsx` is the closest existing management UI pattern for local summary state, deletion confirmation, optimistic updates, and refresh.
- Existing tests use Vitest, `vi.mock`, and `renderToStaticMarkup`; do not add testing dependencies.

## Goal

Add a focused ranking-library panel that lets a user view managed ranking sets, import supported ranking files, export canonical JSON, and delete ranking sets through thin UI and server-action boundaries.

The UI must not parse, normalize, validate, convert, export-map, rank, or calculate tier semantics. Those responsibilities stay in the existing application workflows and domain code.

## Scope

### Goals

- Add server actions that wrap existing ranking import and management workflows.
- Load ranking-set summaries on the home page and render a ranking-library panel above draft history.
- Display lightweight ranking-set summaries with name, source kind, entry count, updated timestamp, and concise capability status.
- Provide explicit import controls for FantasyPros CSV Profile V1 and Canonical Ranking Set JSON V1.
- Read a selected local file in the browser and submit text, selected format, display name, and source label to the import action.
- Display import errors and warnings with stage, code, message, and available row, column, field, or path details.
- Distinguish safe degradation warnings from blocking errors.
- Refresh the visible library after successful import or deletion.
- Export a selected set through the canonical JSON management workflow and trigger a browser download from returned JSON text.
- Confirm destructive deletion and explain that existing draft snapshots remain unchanged.
- Preserve current draft, Draft Room, developer workbench, scenario behavior, and draft setup behavior when imports fail.

### Non-Goals

- Do not add ranking entry review, ranking correction, reordering, or tier editing UI. That is Task 18.
- Do not add draft setup ranking-set selection UI. That is Task 19.
- Do not import Scenario V1 as rankings.
- Do not add generic column mapping, source previews, drag-and-drop polish, cloud storage, source refresh, scheduled imports, accounts, or provider integrations.
- Do not change parser, normalizer, validator, converter, exporter, repository, draft creation, recommendation scoring, Scenario V1, Prisma schema, migrations, generated client, or package dependencies.
- Do not persist raw uploaded files or transient import previews.

## Implementation Design

### Server Actions

Add `src/app/actions/rankingActions.ts` with `"use server"` and these thin wrappers:

```ts
export async function listRankingLibraryAction(): Promise<
  RankingManagementResult<readonly RankingSetSummary[]>
>;

export async function importRankingLibraryFileAction(
  input: Readonly<{
    text: string;
    formatId: RankingImportFormatId;
    name: string;
    sourceLabel?: string;
  }>,
): Promise<ImportRankingSetResult>;

export async function deleteRankingLibrarySetAction(
  id: string,
): Promise<RankingManagementResult<{ id: string }>>;

export async function exportRankingLibrarySetJsonAction(
  id: string,
): Promise<RankingManagementResult<CanonicalRankingJsonExportValue>>;
```

Delegation rules:

- `listRankingLibraryAction` calls `listManagedRankingSets()`.
- `importRankingLibraryFileAction` calls `importRankingSet({ text, formatId, name, sourceLabel, importedAt: new Date() })`.
- `deleteRankingLibrarySetAction` calls `deleteManagedRankingSet(id)`.
- `exportRankingLibrarySetJsonAction` calls `exportManagedRankingSetJson({ id, exportedAt: new Date(), includeSourceRankingSetId: true })`.
- Return structured workflow results unchanged.
- Let unexpected workflow failures reject so tests can verify they are not swallowed.

### Page Wiring

Update `src/app/page.tsx` to load summaries through `listManagedRankingSets()` in addition to `loadDraftWorkspace()`.

- Pass successful summary values to `RankingLibraryPanel`.
- If summary loading returns structured errors, render the panel with an empty summary list and those initial errors.
- Unexpected thrown persistence failures may continue surfacing like current draft loading failures; do not add broad recovery infrastructure in this slice.
- Render `RankingLibraryPanel` above `DraftHistoryList`.

### Ranking Library Panel

Add `src/components/RankingLibraryPanel.tsx` as a client component.

Props:

```ts
type RankingLibraryPanelProps = {
  initialSummaries: readonly RankingSetSummary[];
  initialErrors?: readonly RankingManagementError[];
};
```

Expected behavior:

1. Keep a local visible summary list initialized from `initialSummaries`.
2. Render an empty state when no ranking sets exist.
3. Render each summary with name, source kind, entry count, updated date, and capability text.
4. Provide a format selector with `fantasypros-csv` and `canonical-ranking-json`.
5. Provide a ranking-set name input.
6. Provide a file input accepting `.csv`, `.json`, and JSON MIME types.
7. Read selected file text only when the user starts import.
8. Call `importRankingLibraryFileAction` with file text, selected format, name, and file name as `sourceLabel`.
9. On import success, show success text, show warnings, refresh summaries through `listRankingLibraryAction`, and leave Draft Room state untouched.
10. On import failure, show errors and warnings and leave the current visible summaries unchanged.
11. Provide export and delete buttons for each summary.
12. Export calls `exportRankingLibrarySetJsonAction(summary.id)`, creates a JSON `Blob` from `value.text`, downloads it with a safe file name, and revokes the object URL.
13. Delete confirms before calling `deleteRankingLibrarySetAction(summary.id)`, mentions existing draft snapshots remain unchanged, and refreshes or removes the summary on success.
14. Catch unexpected action failures, log them, and show a generic operation failure message.

Use native controls and existing restrained Tailwind patterns. Do not build entry tables, source previews, tier editing, or draft-selection controls.

### Diagnostics and Capability Display

Diagnostic formatting must preserve:

- `stage`
- `code`
- `message`
- `location.path`
- `location.row`
- `location.column`
- `location.field`

Warnings and errors must be displayed separately.

Capability display should stay concise:

- Team: complete, partial, or none.
- ADP: complete, partial, or none.
- Tiers: source positions and defaulted-neutral positions summarized in plain text.

The UI may say defaulted-neutral tiers are neutralized. It must not calculate recommendation impact.

## Implementation Steps

1. Add `src/app/actions/rankingActions.ts` with the list, import, delete, and export server actions described above.
2. Add `src/app/actions/rankingActions.test.ts` with mocked workflow tests for delegation, timestamps, structured failures, and unexpected throws.
3. Add `src/components/RankingLibraryPanel.tsx` with initial summaries, import controls, diagnostic rendering, export/download behavior, delete confirmation, and summary refresh behavior.
4. Add `src/components/RankingLibraryPanel.test.tsx` using `renderToStaticMarkup` and exported pure helpers where useful.
5. Update `src/app/page.tsx` to load ranking summaries and render `RankingLibraryPanel` above `DraftHistoryList`.
6. Update existing page or Draft Room render tests only if the new panel changes their static markup expectations.
7. Run focused ranking action and panel tests.
8. Run focused ranking workflow and draft render regression tests.
9. Run TypeScript no-emit and lint for touched files.
10. Run the full test suite and repository-wide lint.
11. After validation passes, mark only Phase 5 Task 17 complete in `docs/tasks.md` and update this slice completion status.
12. Report results and stop. Do not begin Task 18 or Task 19.

## Expected Files

- `src/app/actions/rankingActions.ts`
- `src/app/actions/rankingActions.test.ts`
- `src/components/RankingLibraryPanel.tsx`
- `src/components/RankingLibraryPanel.test.tsx`
- `src/app/page.tsx`
- `docs/tasks.md`, after implementation validation only
- `docs/current-slice.md`, for completion status after implementation

Avoid changes to Draft Room, draft setup, selected-ranking draft creation, ranking edit workflows, ranking import/export/domain/repository internals, recommendation engine, scenario files, Prisma schema, migrations, generated source, and package dependencies.

## Tests

Add `src/app/actions/rankingActions.test.ts` covering:

- list delegates to `listManagedRankingSets`;
- import delegates to `importRankingSet` with format, text, name, source label, and action-owned timestamp;
- delete delegates to `deleteManagedRankingSet`;
- export delegates to `exportManagedRankingSetJson` with action-owned timestamp and `includeSourceRankingSetId: true`;
- structured workflow errors are returned unchanged;
- unexpected workflow failures reject.

Add `src/components/RankingLibraryPanel.test.tsx` covering:

- empty state rendering;
- summary cards render name, source kind, entry count, updated date, and capability text;
- initial server errors render distinctly;
- import controls expose both supported format choices;
- diagnostic formatting preserves stage, code, message, and location details;
- warnings render separately from errors;
- destructive delete copy mentions existing draft snapshots remain unchanged.

Keep interaction-heavy behavior to action tests and manual QA unless existing test utilities already make it straightforward. Do not add testing dependencies.

## Automated Validation

Run from the repository root:

```text
npm test -- src/app/actions/rankingActions.test.ts src/components/RankingLibraryPanel.test.tsx
npm test -- src/lib/rankingImportWorkflow.test.ts src/lib/rankingManagementWorkflow.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingSetRepository.test.ts
npm test -- src/components/DraftRoom.test.tsx
npx tsc --noEmit
npm run lint -- src/app/actions/rankingActions.ts src/app/actions/rankingActions.test.ts src/components/RankingLibraryPanel.tsx src/components/RankingLibraryPanel.test.tsx src/app/page.tsx
npm test
npm run lint
```

Expected result:

- focused ranking action and panel tests pass;
- ranking import, management, exporter, and repository tests continue to pass;
- Draft Room render test continues to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Manual QA

After automated validation, run the app locally only if practical and complete a small browser check:

1. Open the home page and confirm the ranking library renders without disrupting Draft History or Draft Room.
2. Import one valid FantasyPros CSV fixture and confirm a new summary appears.
3. Import one invalid file and confirm diagnostics appear without changing the summary list.
4. Export a ranking set and confirm a JSON file downloads.
5. Delete a ranking set and confirm the library refreshes while the current draft remains loaded.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- Ranking library summaries render without exposing persistence records or full entries.
- A user can choose FantasyPros CSV or Canonical Ranking Set JSON V1 explicitly before import.
- Import UI reads local file text in the browser and sends text plus selected format to the application import workflow.
- Valid imports refresh the library and show successful warnings when safe degradation occurs.
- Invalid imports show actionable stage-specific diagnostics and create no visible new set.
- Capability status for team, ADP, and tiers is visible at summary level.
- Export uses the canonical JSON management workflow and performs a browser download from returned JSON text.
- Delete requires confirmation, removes the set from the library, and explains that existing draft snapshots remain unchanged.
- UI code performs no ranking parsing, normalization, validation, conversion, export mapping, rank calculation, or tier calculation.
- Existing Draft Room, Draft History, developer workbench, draft setup, selected-ranking draft creation action, scenario import/export, and recommendation behavior remain unchanged.
- No schema, migration, dependency, ranking edit, draft setup selection, Scenario V1, or recommendation-tuning change is introduced.
- Only Phase 5 Task 17 is checked complete after validation passes.

## Failure Handling

- If summary loading returns structured errors, render them and keep the panel usable for later refresh.
- If file reading fails, show a local read error and do not call import.
- If import fails, display returned errors and warnings and leave the current summary list unchanged.
- If list refresh fails after a successful import or delete, keep the last visible summaries and show the refresh error.
- If export fails, show returned errors and do not create a download.
- If delete returns not-found, remove or refresh the missing summary and show the not-found message.
- If unexpected server-action errors throw, show a generic operation failure message and log the error.
- If implementing the panel appears to require ranking entry editing or draft setup selection, stop and report the Task 17/18/19 boundary.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Documentation Updates After Implementation

- Update `docs/tasks.md` only to mark Phase 5 Task 17 complete after implementation validation passes.
- Update this file's completion status after implementation validation passes.
- No `docs/architecture.md`, `docs/project.md`, or `docs/decisions.md` update is expected if the slice remains a thin UI and server-action layer over existing workflows.
- The existing recommendation to establish a checked-in Prisma migration baseline and local/CI database setup remains outside this slice.

## Follow-Up Slice

Promote Phase 5 Task 18: add focused ranking and tier editing UI over the existing ranking management workflow, keeping domain edit rules authoritative and immutable draft snapshots unchanged.

## Slice Review

- Smallest meaningful increment: yes. It delivers the Task 17 ranking library workflow without ranking editing or draft setup selection.
- Executable by a lower-reasoning pass: yes. Actions, component behavior, diagnostics, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing workflows without schema, parser, exporter, repository, or engine changes.
- Blast radius reasonable: yes. Planned code changes are one server-action file, one component, one page integration, and focused tests.
- Review/revert comfort: yes. The panel is isolated from ranking domain internals and draft behavior.
- Observable/testable acceptance criteria: yes. Summary rendering, import diagnostics, warnings, export download behavior, delete confirmation copy, and unchanged draft UI are directly observable.
