# Current Slice: Add Draft History Summary And Resume Links

## Source Task

Task 8: Add Draft History And Resume Flow.

This slice adds the smallest useful draft history/resume increment: show lightweight persisted draft summaries and allow opening one existing draft from the main draft page.

## Goal

Allow the user to see existing persisted drafts and reopen one by selecting it from the page.

The app already loads the most recently updated persisted draft by default. This slice makes that behavior visible and controllable without adding a full draft management screen.

## User-Visible Increment

The draft page should include a simple draft history area that:

```txt
lists existing persisted draft summaries
shows enough details to distinguish drafts
marks the currently loaded draft
links each summary to reopen that draft
loads the selected draft into the existing draft room
keeps draft state, available players, roster, and recommendations derived from the selected workspace
```

## Problem

Phase 2 persistence can store multiple draft records and the repository can list draft summaries, but the UI still silently loads the latest draft. The user has no way to intentionally reopen another persisted draft.

This blocks the core Phase 2 resume workflow and makes persistence feel hidden.

## Goals

- Add loader support for an optional selected draft id.
- Keep default behavior: if no draft id is selected, load the latest draft or create the default draft.
- Return lightweight draft summaries alongside the loaded workspace.
- Add a draft history summary list to the main draft page.
- Use a query param such as `?draftId=<id>` for selecting a draft.
- Highlight or label the currently loaded draft.
- Ensure changing selected draft remounts `DraftRoom` so local client state does not show a stale draft.
- Add focused loader tests for selected draft loading and missing selected draft fallback.
- Update `docs/tasks.md` only for the directly completed part of Task 8 after implementation.

## Non-Goals

- Creating a new draft from the history UI.
- Renaming drafts.
- Deleting drafts.
- Duplicating drafts.
- Adding a separate draft history route.
- Adding route params or nested layouts.
- Adding accounts, users, sharing, or multi-user behavior.
- Adding pagination, filters, sorting controls, or search.
- Loading full ranking snapshot JSON for every history row.
- Changing repository summary query behavior unless a test reveals it is wrong.
- Changing draft mutation behavior.
- Changing recommendation logic.
- Changing Prisma schema or migrations.
- Updating package dependencies.
- Broad styling changes.

## Expected Files

- `src/lib/draftWorkspaceLoader.ts`
- `src/lib/draftWorkspaceLoader.test.ts`
- `src/app/page.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing repository mapping, draft state helpers, recommendation logic, seed ranking data, Prisma schema, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the implementation, but keep the loader API close to:

```ts
type LoadDraftWorkspaceResult = {
  workspace: DraftWorkspace;
  summaries: DraftSummary[];
  selectedDraftId: string;
  requestedDraftMissing: boolean;
};

async function loadDraftWorkspace(
  selectedDraftId?: string,
): Promise<LoadDraftWorkspaceResult>;
```

Keep `loadOrCreateDefaultDraftWorkspace` if existing callers or tests still need it, but it can delegate to the new loader and return only `workspace`.

## Expected Behavior

### Loader

- List draft summaries once through the repository.
- If `selectedDraftId` is present and non-blank:
  - Try to load that draft by id.
  - If found, return it as the active workspace.
  - If not found, fall back to the latest summary or create the default draft.
  - Mark `requestedDraftMissing` as `true` for the missing selected id case.
- If `selectedDraftId` is absent or blank:
  - Load the latest summary if one exists.
  - Otherwise create the default draft.
- Return summaries along with the loaded workspace.
- Do not load full ranking snapshot JSON for every summary.
- Preserve the existing actionable persistence setup error message.

### Page Routing

- Read `draftId` from the page `searchParams`.
- Pass the selected id into the loader.
- Render links using `?draftId=<id>`.
- Use the loaded workspace for the existing header values and `DraftRoom`.
- Add `key={workspace.draft.id}` to `DraftRoom` so client-local `activeDraft` resets when the selected persisted draft changes.
- If a requested draft id is missing, show a small inline notice and continue with the fallback draft.

### Draft History UI

- Render a compact, scan-friendly section above the draft room.
- For each summary, show:
  - draft name or a fallback label
  - status
  - drafted pick count
  - team count
  - rounds
  - updated date
- Clearly indicate the currently loaded draft.
- Use links rather than client-side mutation state.
- If no summaries exist before first draft creation, the page may show the newly created default draft after the loader creates it, as long as the page still renders normally.

## Safety Rules

- Do not create a new draft when selecting an existing valid draft.
- Do not silently delete, reset, or mutate any existing draft from the history UI.
- Do not add a static fallback that bypasses persistence.
- Do not let UI code import Prisma models or raw database JSON.
- Keep full ranking snapshots behind the repository/workspace load boundary.

## Testing Strategy

Use existing test patterns.

Loader tests should cover:

- A valid selected draft id loads that exact workspace.
- No selected draft id loads the latest summary as before.
- Missing selected draft id falls back to the latest draft and reports `requestedDraftMissing`.
- Missing selected draft id with no summaries creates the default draft and reports `requestedDraftMissing`.
- Blank selected draft id behaves like no selected draft id.
- Repository failures still throw the existing actionable setup error.

Do not add a React testing dependency for the history UI. Use TypeScript/build validation plus manual QA for the link navigation path.

## Implementation Steps

1. Extend the loader return shape.
   - Add a result type containing `workspace`, `summaries`, `selectedDraftId`, and `requestedDraftMissing`.
   - Add a new loader function that accepts an optional selected draft id.
   - Keep `loadOrCreateDefaultDraftWorkspace` as a compatibility wrapper if useful.

2. Implement selected draft loading.
   - Trim the selected draft id.
   - Load summaries once.
   - If a non-blank selected id exists, attempt `getDraftWorkspaceById(selectedId)`.
   - Return the selected workspace when found.
   - Fall back to latest summary or default draft creation when missing.
   - Preserve the existing setup error wrapping.

3. Update loader tests.
   - Extend the fake repository only as needed.
   - Add tests for selected id success, selected id missing fallback, selected id missing with no summaries, and blank id behavior.
   - Keep existing latest/default/error tests meaningful.

4. Update the page.
   - Accept `searchParams` in `src/app/page.tsx`.
   - Read `draftId` safely from the query params.
   - Call the new loader.
   - Render a compact draft history summary section.
   - Link each summary to `/?draftId=<id>`.
   - Mark the active summary by comparing to `workspace.draft.id`.
   - Pass `key={workspace.draft.id}` to `DraftRoom`.

5. Update task tracking.
   - In `docs/tasks.md`, check only Task 8 items directly completed by this slice.
   - Do not mark Task 8 complete unless all Task 8 acceptance criteria are satisfied.
   - Do not update Task 9 or the Phase 2 validation checklist unless manual validation directly proves a listed item.

6. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - With local database configured, manually verify:
     - multiple persisted drafts appear in the history list
     - clicking a draft loads that draft
     - refreshing the selected draft URL keeps that draft loaded
     - draft, undo, and reset still operate on the selected draft

## Acceptance Criteria

- The loader can load a selected draft id.
- The loader still loads the latest draft when no id is selected.
- The loader falls back safely when a selected draft id is missing.
- The page renders lightweight draft summaries.
- Each summary can reopen that persisted draft.
- The currently loaded draft is clearly indicated.
- Changing selected draft does not leave stale `DraftRoom` local state.
- Reopened drafts restore picks, available players, roster, and recommendations through the existing workspace flow.
- Draft history does not load full ranking snapshot JSON for every row.
- Existing draft, undo, and reset interactions still work for the loaded draft.
- No account/user system, custom setup UI, separate history route, Prisma schema change, or package dependency is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

Requires a configured and migrated local database with at least two draft records for the full resume check.

Manual checks:

- Start the app with `npm run dev`.
- Confirm the draft history section appears.
- Create or seed at least two persisted drafts if needed.
- Click a non-active draft summary.
- Confirm URL includes that draft id.
- Confirm the draft room reflects that draft's current pick and picks.
- Refresh the page and confirm the same draft remains loaded.
- Draft one player, undo, and reset from the selected draft.
- Confirm those mutations affect the selected draft, not a different history row.

If the local database is unavailable:

- Report manual runtime validation as blocked by database availability.
- Do not replace persistence behavior with static fallback behavior.

## Slice Review

- Smallest meaningful increment: yes, it provides visible history and resume without draft creation, deletion, or management features.
- Concrete enough for implementation: yes, loader behavior, query param routing, UI output, stale-state handling, tests, and validation are specified.
- Avoids unnecessary architecture changes: yes, it reuses the repository, server-rendered page, and existing draft room.
- Blast radius reasonable: yes, it should touch the loader, loader tests, page UI, and task tracking.
- Review/revert comfort: yes, removing the history section and selected-id loader path would restore the latest-draft behavior.
- Observable/testable acceptance criteria: yes, loader behavior is unit-testable and resume links are manually verifiable.
