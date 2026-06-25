# Current Slice: Add Draft Mutation Server Actions

## Source Task

`docs/tasks.md` Task 6: Persist Manual Draft Pick Mutations.

This slice completes the remaining Task 6 server-side operation step by exposing the repository draft and undo mutations through server actions.

## Goal

Add small server action wrappers for persisted draft and undo operations so the UI can call a stable app-layer API in the next slice.

The server actions should delegate to the existing repository mutations and return the same typed `DraftWorkspace | null` result without reimplementing draft rules or persistence behavior.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is an app-layer API that can:

```txt
draft a player in a persisted draft workspace
undo the latest persisted pick in a persisted draft workspace
return null for missing drafts
return the updated DraftWorkspace for successful or ignored mutations
```

## Problem

The repository can now persist draft and undo mutations, but the app has no server-side operation boundary for UI code to call.

The next UI wiring slice should not import repository details directly into client components. It should call server actions that represent app-level commands.

## Goals

- Add a server action for drafting a player into a persisted workspace.
- Add a server action for undoing the latest persisted pick.
- Keep the server actions thin: validate only basic string inputs if useful, then call repository functions.
- Return `DraftWorkspace | null` from each action.
- Preserve repository ownership of persistence and Draft State Engine ownership of draft rules.
- Add focused tests for action delegation and missing draft behavior.
- Update `docs/tasks.md` checkboxes only for the Task 6 server-operation item completed by this slice.

## Non-Goals

- Wiring `DraftRoom` or any UI component to the server actions.
- Loading a persisted draft into the page.
- Adding optimistic UI state.
- Adding browser refresh or resume flow.
- Adding draft history UI.
- Changing repository mutation behavior.
- Changing draft state transition behavior.
- Changing recommendation behavior.
- Changing Prisma schema or migrations.
- Adding authentication or user/account models.
- Updating package dependencies.
- Broad documentation rewrites.

## Expected Files

- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing UI components, page loading, repository internals, draft state helpers, recommendation logic, seed ranking data, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the codebase, but keep the server action API close to this shape:

```ts
"use server";

import type { DraftWorkspace } from "@/types/draft";
import {
  draftPlayerInWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";

export async function draftPlayerAction(
  draftId: string,
  playerId: string,
): Promise<DraftWorkspace | null> {
  return draftPlayerInWorkspace(draftId, playerId);
}

export async function undoLastPickAction(
  draftId: string,
): Promise<DraftWorkspace | null> {
  return undoLastPickInWorkspace(draftId);
}
```

If the implementation adds basic input guards, keep them simple and observable:

- blank `draftId` returns `null`
- blank `playerId` returns `null`
- no schema validation library or new dependency

## Expected Behavior

### Draft Player Action

- Accept `draftId` and `playerId` strings.
- Return `null` if either required input is blank.
- Call `draftPlayerInWorkspace(draftId, playerId)` for valid inputs.
- Return the repository result unchanged.
- Do not inspect rankings, pick history, draft status, or draft completeness in the action.

### Undo Last Pick Action

- Accept a `draftId` string.
- Return `null` if `draftId` is blank.
- Call `undoLastPickInWorkspace(draftId)` for valid input.
- Return the repository result unchanged.
- Do not inspect pick history or draft status in the action.

### Boundary Rules

- Server actions are app-layer command wrappers.
- Repository functions remain the persistence boundary.
- Draft State Engine helpers remain the source of draft transition rules.
- No raw Prisma models or JSON snapshots should be exposed.
- No UI component should be changed in this slice.

## Testing Strategy

Use focused unit tests for the server action module.

Mock the repository exports rather than using a fake database. These tests should prove:

- valid draft action inputs call `draftPlayerInWorkspace` with the same IDs
- valid undo action inputs call `undoLastPickInWorkspace` with the same draft ID
- repository return values are returned unchanged
- missing draft repository results propagate as `null`
- blank required inputs return `null` without calling the repository

Do not duplicate repository persistence tests here. The repository tests already own draft, reload, undo, duplicate prevention, and completion-status behavior.

## Implementation Steps

1. Add the server action file.
   - Create `src/app/actions/draftActions.ts`.
   - Add `"use server"` at the top.
   - Import the repository mutation functions.
   - Export `draftPlayerAction` and `undoLastPickAction`.
   - Add only minimal blank-string guards if used.

2. Add server action tests.
   - Create `src/app/actions/draftActions.test.ts`.
   - Mock `@/lib/draftRepository`.
   - Use a minimal `DraftWorkspace` test object or a small helper to represent returned workspace data.
   - Assert delegation, unchanged return values, null propagation, and blank-input guards.

3. Update task tracking.
   - In `docs/tasks.md`, check the Task 6 item for server-side operations.
   - If all Task 6 scope items are now checked and the Task 6 acceptance criteria are satisfied by existing repository tests plus this slice, mark Task 6 complete.
   - Do not check Task 7 or later items.
   - Do not update the Phase 2 validation checklist unless implementation directly proves a listed item end to end.

4. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- Server action exists for drafting a player.
- Server action exists for undoing the last pick.
- Draft action delegates to `draftPlayerInWorkspace`.
- Undo action delegates to `undoLastPickInWorkspace`.
- Server actions return repository results unchanged.
- Missing draft results propagate as `null`.
- Blank required inputs return `null` without mutating repository state.
- Tests cover draft action delegation, undo action delegation, null propagation, and blank-input guards.
- `docs/tasks.md` Task 6 tracking is updated only for completed server-operation work.
- No UI wiring, persisted page loading, draft history UI, or browser refresh flow is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged because no component or page should call the new actions yet.

If the app is run manually, confirm the draft room still loads normally from the existing static default draft and seed rankings.

## Slice Review

- Smallest meaningful increment: yes, this only exposes the already-tested repository mutations through an app-layer server action boundary.
- Concrete enough for implementation: yes, files, APIs, behavior, test expectations, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it follows the monolith-first Next.js direction and does not add a new service or abstraction.
- Blast radius reasonable: yes, expected changes are one action module, one test module, and Task 6 tracking.
- Review/revert comfort: yes, app runtime UI behavior remains unchanged and the slice can be reverted independently.
- Observable/testable acceptance criteria: yes, delegation, return values, null handling, docs tracking, and validation commands are directly verifiable.
