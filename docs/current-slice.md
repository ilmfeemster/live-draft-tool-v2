# Current Slice: Load Draft Room From Persisted Workspace

## Source Task

`docs/tasks.md` Task 7: Wire The App To Load A Persisted Draft Workspace.

This slice starts Task 7 by moving the draft room's initial data source from static `defaultDraft`/`seedRankings` props to a persisted `DraftWorkspace` loaded on the server.

## Goal

Load a persisted draft workspace for the home page and pass its typed `Draft` and `RankingEntry[]` into the existing `DraftRoom`.

If no persisted draft exists, create one using the existing MVP defaults and seed rankings. This gives the app a durable workspace identity before UI mutation wiring happens.

## User-Visible Increment

The draft room should still look and behave the same on first load.

The meaningful product increment is that the initial draft room state now comes from a persisted `DraftWorkspace` when the database is available:

```txt
open the draft room
load the most recently updated persisted draft if one exists
otherwise create a default persisted draft
render the existing draft UI from that workspace
```

## Problem

The repository can create, list, load, draft, and undo persisted workspaces. Server actions now expose draft and undo mutations. However, the page still renders from static in-memory data:

- `defaultDraft`
- `seedRankings`

That means refresh and restart cannot restore persisted draft setup or pick history yet. Before wiring client-side mutation calls, the page needs a server-side persisted workspace source.

## Goals

- Add a small server-side helper that loads the active persisted draft workspace.
- If at least one draft summary exists, load the most recently updated draft workspace by ID.
- If no draft exists, create a default persisted draft using:
  - `defaultLeagueSettings`
  - `seedRankings`
  - `team-2` as the MVP user team ID, matching the current default draft position
- Update `src/app/page.tsx` to render `DraftRoom` from the loaded `DraftWorkspace`.
- Keep `DraftRoom` props typed as domain data, not Prisma data or raw JSON.
- Keep existing client-side draft/undo behavior unchanged for this slice.
- Add focused tests for the workspace-loading helper using a fake repository API.
- Update `docs/tasks.md` only for Task 7 items directly completed by this slice.

## Non-Goals

- Wiring draft and undo buttons to server actions.
- Persisting client-side draft actions from the UI.
- Adding optimistic UI state.
- Adding draft history UI.
- Adding route params or draft selection.
- Adding custom league setup UI.
- Changing recommendation logic.
- Changing draft state transition behavior.
- Changing repository mutation behavior.
- Changing Prisma schema or migrations.
- Adding authentication or user/account models.
- Updating package dependencies.
- Broad styling changes.
- Broad documentation rewrites.

## Expected Files

- `src/lib/draftWorkspaceLoader.ts`
- `src/lib/draftWorkspaceLoader.test.ts`
- `src/app/page.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Possibly:

- `src/data/defaultDraft.ts`, only if exporting the current MVP user team ID avoids duplicating `"team-2"`

Avoid changing UI components, server actions, repository internals, draft state helpers, recommendation logic, seed ranking data, Prisma schema, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the codebase, but keep the helper close to this shape:

```ts
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import {
  createDraftWorkspace,
  getDraftWorkspaceById,
  listDraftSummaries,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";

type DraftWorkspaceLoaderRepository = {
  createDraftWorkspace: typeof createDraftWorkspace;
  getDraftWorkspaceById: typeof getDraftWorkspaceById;
  listDraftSummaries: typeof listDraftSummaries;
};

export async function loadOrCreateDefaultDraftWorkspace(
  repository = {
    createDraftWorkspace,
    getDraftWorkspaceById,
    listDraftSummaries,
  },
): Promise<DraftWorkspace> {
  // implementation described below
}
```

The production helper should use the real repository functions by default. Tests should inject a fake repository object.

## Expected Behavior

### Existing Draft

- Call `listDraftSummaries()`.
- If the list contains at least one summary, use the first summary because repository summaries are ordered by `updatedAt desc`.
- Call `getDraftWorkspaceById(summary.id)`.
- If a workspace is returned, return it.
- Do not create a new draft.

### No Existing Draft

- If `listDraftSummaries()` returns an empty array, call `createDraftWorkspace()`.
- Use default MVP source state:
  - name: `"Default Draft"` or similarly clear MVP default label
  - league settings: `defaultLeagueSettings`
  - rankings: `seedRankings`
  - user team id: `"team-2"`
- Return the created workspace.

### Stale Summary Fallback

- If `listDraftSummaries()` returns a summary but `getDraftWorkspaceById(summary.id)` returns `null`, create a default persisted draft.
- This should be treated as defensive behavior, not a new user-facing recovery UI.

### Page Rendering

- Make `src/app/page.tsx` an async server component.
- Call `loadOrCreateDefaultDraftWorkspace()`.
- Pass `workspace.draft` and `workspace.rankings` to `DraftRoom`.
- Update the header stats to derive from `workspace.leagueSettings` instead of hard-coded values.
- Do not import Prisma types or raw JSON into the page.
- Do not change `DraftRoom` behavior in this slice.

## Database Availability Guidance

This slice may require a local database for manual page rendering because the page will call repository functions on the server.

Do not hide repository errors by silently falling back to static data in the helper. If local database setup is missing, validation may still pass through tests/build, and manual runtime testing should report the database blocker clearly.

If `npm run build` fails because prerendering tries to connect to the database, adjust the page to use dynamic server rendering in the smallest Next.js-supported way, such as:

```ts
export const dynamic = "force-dynamic";
```

Do not add a static fallback that bypasses persistence just to make the build pass.

## Testing Strategy

Use focused unit tests for the helper with an injected fake repository.

Tests should prove:

- Existing latest summary loads by ID.
- Existing loaded workspace is returned unchanged.
- No draft summaries creates a default persisted workspace.
- Stale summary with missing workspace creates a default persisted workspace.
- Default creation uses `defaultLeagueSettings`, `seedRankings`, and `team-2`.

Do not test Prisma internals. Do not add UI tests for this slice unless the implementation naturally exposes a small pure page helper.

## Implementation Steps

1. Add the workspace loader helper.
   - Create `src/lib/draftWorkspaceLoader.ts`.
   - Define a small repository dependency type based on the existing repository functions.
   - Implement `loadOrCreateDefaultDraftWorkspace`.
   - Keep default draft creation source state explicit and close to the helper.

2. Add helper tests.
   - Create `src/lib/draftWorkspaceLoader.test.ts`.
   - Use a fake repository object with `vi.fn()` functions.
   - Use a minimal `DraftWorkspace` fixture.
   - Assert load-existing, create-empty, stale-summary fallback, and default input shape.

3. Update the home page.
   - Make `src/app/page.tsx` async.
   - Import `loadOrCreateDefaultDraftWorkspace`.
   - Load the workspace on the server.
   - Replace `defaultDraft` and `seedRankings` imports/usages with `workspace.draft` and `workspace.rankings`.
   - Derive Teams, Format, and Draft labels from `workspace.leagueSettings`.
   - Add `export const dynamic = "force-dynamic"` only if needed for build/runtime correctness.

4. Update task tracking.
   - In `docs/tasks.md`, check only Task 7 scope items directly completed by this slice.
   - Do not mark all of Task 7 complete unless refresh persistence is actually satisfied by the implemented page load path and validation.
   - Do not check Task 8 or later items.
   - Do not update the Phase 2 validation checklist unless implementation directly proves a listed item end to end.

5. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If a local database is available, run the app manually and confirm first load creates or loads a persisted workspace.

## Acceptance Criteria

- Home page loads a `DraftWorkspace` through a server-side persistence helper.
- Existing persisted draft summaries load the most recently updated workspace.
- Empty persistence state creates a default persisted workspace.
- Stale summary fallback creates a default persisted workspace.
- `DraftRoom` receives typed `draft` and `rankings` from the loaded workspace.
- Header stats derive from loaded league settings instead of hard-coded values.
- UI components do not import Prisma models or raw database JSON.
- Existing in-memory client draft/undo behavior remains unchanged for this slice.
- Tests cover existing-load, empty-create, stale-summary fallback, and default creation inputs.
- `docs/tasks.md` Task 7 tracking is updated only for completed load-workspace work.
- No draft/undo server action wiring, draft history UI, custom setup UI, or route-based resume flow is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

If a local database is configured and migrated:

- Start the app.
- Open the draft room.
- Confirm the page renders normally.
- Confirm a default draft record exists after first load if the database was empty.
- Refresh the page and confirm the same persisted workspace is loaded.

If no local database is available:

- Report that manual runtime validation is blocked by database availability.
- Do not replace persistence loading with static fallback behavior.

## Slice Review

- Smallest meaningful increment: yes, it only changes the page's initial data source to a persisted workspace and does not combine mutation wiring or history UI.
- Concrete enough for implementation: yes, helper API, page behavior, tests, defaults, fallback behavior, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it uses the existing repository boundary and a small server-side helper.
- Blast radius reasonable: yes, expected changes are one helper, one helper test, the home page, and Task 7 tracking.
- Review/revert comfort: yes, the slice is focused on initial page data loading and can be reverted independently.
- Observable/testable acceptance criteria: yes, helper tests prove load/create behavior and page code visibly renders from the loaded workspace.
