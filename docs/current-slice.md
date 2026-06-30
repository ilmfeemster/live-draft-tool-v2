# Current Slice: Add Ranking Library Import, Export, and Delete UI

## Completion Status

Planned. This slice promotes Phase 5 Task 17. Implementation has not started.

## Source Context

- Phase 5 Task 16 is complete. Draft creation can now use an explicit managed ranking set through `createConfiguredDraftFromRankingSetAction`, but Draft Room ranking-set selection UI remains deferred to Task 19.
- `src/lib/rankingImportWorkflow.ts` already orchestrates supported FantasyPros CSV and Canonical Ranking Set JSON V1 imports and returns saved ranking sets plus stage-specific diagnostics and warnings.
- `src/lib/rankingManagementWorkflow.ts` already exposes application-level list, load, delete, and canonical JSON export operations with structured application errors.
- `src/types/rankingImport.ts` defines supported import format IDs and diagnostic shapes with stages, severity, messages, and optional row, column, field, or path locations.
- `src/types/rankings.ts` defines `RankingSetSummary` and field-capability metadata needed for lightweight library display.
- `src/app/page.tsx` currently loads draft workspace data and renders `DraftHistoryList` and `DraftRoom`; it does not load or render managed ranking-set summaries.
- `src/components/DraftHistoryList.tsx` is the closest existing management panel pattern: it accepts initial server-loaded summaries, keeps an optimistic local list, calls server actions, confirms deletion, and refreshes after mutations.
- `src/components/DraftRoom.tsx` currently owns scenario file import/export and draft interactions. This slice should not add ranking library behavior inside Draft Room.

## Goal

Add a focused ranking-library panel that lets a user view managed ranking sets, import supported ranking files, export canonical JSON, and delete ranking sets through thin UI and server-action boundaries while keeping parsing, validation, export, and persistence logic in existing application workflows.

## Scope

### Goals

- Add server actions that wrap existing ranking import and ranking management workflows.
- Load ranking-set summaries on the home page and render a ranking-library panel above the draft workspace.
- Display lightweight ranking-set summaries with name, source kind, entry count, lifecycle metadata, and concise capability status.
- Provide explicit import controls for:
  - FantasyPros CSV Profile V1;
  - Canonical Ranking Set JSON V1.
- Read selected local files in the browser and submit text, selected format, display name, and source label to the import action.
- Display import errors and warnings with stage, message, and location details when available.
- Distinguish successful degradation warnings from blocking errors.
- Refresh the library after successful import or deletion.
- Export a selected set using the canonical JSON management workflow and trigger a browser download from the returned deterministic JSON text.
- Confirm deletion and state that existing draft snapshots remain unchanged.
- Keep the current draft, Draft Room state, developer workbench state, scenario behavior, and draft setup flow unchanged when imports fail.

### Non-Goals

- Do not add ranking entry review or ranking/tier editing UI. That is Task 18.
- Do not add draft setup ranking-set selection UI. That is Task 19.
- Do not import Scenario V1 as rankings.
- Do not add generic CSV column mapping, source previews, drag-and-drop polish, cloud storage, source refresh, scheduled imports, account behavior, or provider integrations.
- Do not change ranking parser, normalizer, validation, conversion, exporter, repository, draft creation, recommendation scoring, scenario behavior, Prisma schema, migrations, generated client, or dependencies.
- Do not persist raw uploaded files or transient import previews.

## Implementation Design

### Server Actions

Add `src/app/actions/rankingActions.ts` as a thin server-action boundary over existing workflows. Use exact names where practical:

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

The actions must delegate to:

- `listManagedRankingSets`;
- `importRankingSet`;
- `deleteManagedRankingSet`;
- `exportManagedRankingSetJson`.

Use `new Date()` for import/export timestamps at the action boundary. Do not parse, normalize, validate, export, delete, or map persistence records in UI code.

### Page Wiring

Update `src/app/page.tsx` to load ranking-set summaries through `listManagedRankingSets()` and pass them to `RankingLibraryPanel`.

If summary loading returns structured errors, render the panel with an empty summary list and an initial error message. Unexpected thrown persistence failures may continue to surface like the current draft loader behavior; do not add broad recovery infrastructure in this slice.

Render the ranking library above `DraftHistoryList` so ranking management is visible without entering Draft Room or the developer workbench.

### Ranking Library Panel

Add `src/components/RankingLibraryPanel.tsx` as a client component.

Expected behavior:

1. Accept `initialSummaries` and optional `initialErrors`.
2. Keep a local visible summary list initialized from server-loaded summaries.
3. Render an empty state when no sets exist.
4. Render each summary with:
   - name;
   - source kind;
   - entry count;
   - updated timestamp;
   - concise team, ADP, and tier capability status.
5. Provide import controls:
   - format selector;
   - ranking-set name input;
   - file input with accepted `.csv`, `.json`, and JSON MIME types;
   - import button.
6. Read selected file text in the browser only after the user chooses a file and starts import.
7. Call `importRankingLibraryFileAction` with file text, selected format, name, and file name as `sourceLabel`.
8. On import success:
   - show a success message;
   - show any warnings;
   - refresh summaries by calling `listRankingLibraryAction`;
   - keep the Draft Room state untouched.
9. On import failure:
   - show errors and warnings;
   - leave summaries unchanged.
10. Provide export and delete buttons for each summary.
11. Export must call `exportRankingLibrarySetJsonAction(summary.id)`, create a JSON Blob from `value.text`, download it with a safe file name, and revoke the object URL.
12. Delete must confirm before calling `deleteRankingLibrarySetAction(summary.id)`, explain that existing draft snapshots remain unchanged, and refresh or optimistically remove the summary on success.

The panel may use text buttons and native form controls consistent with the existing application. Do not build entry tables, source previews, tier editing, or draft selection controls.

### Diagnostics and Capability Display

Format import diagnostics without losing useful context:

- Show `stage`, `message`, and `code`.
- Include `row`, `column`, `field`, or `path` when present.
- Display warnings separately from errors.

Capability display should remain concise:

- Team: complete, partial, or none.
- ADP: complete, partial, or none.
- Tiers: source positions and defaulted-neutral positions summarized in plain text.

Do not infer recommendation behavior from capability metadata in the UI. It may note that defaulted-neutral tiers are neutralized, but it must not calculate tier impact.

## Tests

Add `src/app/actions/rankingActions.test.ts` with workflow mocks. Cover:

- list delegates to `listManagedRankingSets`;
- import delegates to `importRankingSet` with format, text, name, source label, and an action-owned timestamp;
- delete delegates to `deleteManagedRankingSet`;
- export delegates to `exportManagedRankingSetJson` with an action-owned timestamp;
- structured workflow errors are returned unchanged;
- unexpected workflow failures reject.

Add `src/components/RankingLibraryPanel.test.tsx` using `renderToStaticMarkup` and pure helper coverage where needed. Cover:

- empty state rendering;
- summary cards render name, source kind, entry count, updated date, and capability text;
- initial server errors render distinctly;
- import controls expose the two supported format choices;
- warning and diagnostic formatting helpers preserve stage and location details;
- destructive delete copy mentions existing draft snapshots remain unchanged.

Interaction tests should stay within the currently available test stack. Do not add testing dependencies in this slice. Cover mutation details through server-action tests and keep manual QA for file picker/download confirmation.

Update existing page or Draft Room render tests only if the new panel affects their static markup expectations.

## Implementation Steps

1. Add `src/app/actions/rankingActions.ts` with thin list/import/delete/export server actions over existing workflows.
2. Add `src/app/actions/rankingActions.test.ts` with mocked workflow tests for delegation, timestamps, structured failures, and unexpected throws.
3. Add `src/components/RankingLibraryPanel.tsx` with initial summaries, import controls, diagnostic rendering, export/download, delete confirmation, and summary refresh behavior.
4. Add `src/components/RankingLibraryPanel.test.tsx` for static rendering and diagnostic/capability formatting coverage.
5. Update `src/app/page.tsx` to load ranking summaries and render `RankingLibraryPanel` above `DraftHistoryList`.
6. Keep Draft Room, draft setup, draft creation, ranking edit workflows, parser/normalizer/exporter/repository code, recommendation engine, Scenario V1 files, Prisma schema, generated source, and dependencies unchanged unless TypeScript requires a type-only import adjustment.
7. Run focused ranking action and ranking library component tests.
8. Run focused ranking import, ranking management, canonical exporter, ranking-set repository, and page/DraftRoom render tests.
9. Run TypeScript no-emit and focused lint for touched files.
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

Avoid changes to Draft Room, Draft Setup, selected-ranking draft creation, ranking editing, ranking import/export/domain/repository internals, recommendation engine, scenario files, Prisma schema, migrations, generated source, and package dependencies.

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

- focused ranking action and library component tests pass;
- ranking import, management, exporter, and repository tests continue to pass;
- Draft Room render test continues to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
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

## Follow-Up Slice

Promote Phase 5 Task 18: add focused ranking and tier editing UI over the existing ranking management workflow, keeping domain edit rules authoritative and immutable draft snapshots unchanged.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 17 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains a thin UI and server-action layer over already documented ranking import, management, export, and delete workflows.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It adds the ranking library workflow promised by Task 17 without ranking editing or draft setup selection.
- Executable by a lower-reasoning pass: yes. Actions, component behavior, diagnostics, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing workflows and repositories without schema, parser, exporter, or engine changes.
- Blast radius reasonable: yes. The planned code changes are one server-action file, one component, one page integration, and focused tests.
- Review/revert comfort: yes. The panel is isolated and can be removed without changing ranking domain or draft behavior.
- Observable/testable acceptance criteria: yes. Summary rendering, import diagnostics, warnings, export download behavior, delete confirmation copy, and unchanged draft UI are directly observable.
