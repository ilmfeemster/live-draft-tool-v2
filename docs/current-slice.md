# Current Slice: Add Reset Current Draft Control

## Source Task

Manual QA support for Phase 2 persistence.

This slice adds a small reset control for the currently loaded persisted draft. It is not a draft history feature and should not expand into broader draft management.

## Goal

Allow the current persisted draft to be reset back to an empty pick history from the draft room UI.

This is primarily a developer/manual-testing utility: after drafting several picks to test persistence, the user should be able to clear the current draft and repeat the workflow without manually editing the database or creating a full draft history/resume UI first.

## User-Visible Increment

The draft status panel should include a reset control that:

```txt
clears all persisted picks for the current draft
restores current pick to 1
restores draft status to NOT_STARTED
keeps the same draft settings and ranking snapshot
updates the visible draft room immediately
survives refresh as an empty draft
```

## Problem

Phase 2 persistence now loads a persisted workspace and persists draft/undo interactions. That makes manual testing more realistic, but it also makes repeated manual testing slower because old picks remain saved.

The app needs a safe, explicit way to clear the current draft's pick history while preserving the draft setup and ranking snapshot.

## Goals

- Add repository support for resetting one persisted draft's pick history.
- Add a server action for resetting the current draft.
- Add a reset button to the draft status panel.
- Wire the button from `DraftRoom` to the reset server action.
- Update local draft state from the returned `DraftWorkspace`.
- Prevent reset while another mutation is pending.
- Ask for confirmation before resetting, since this is destructive.
- Keep reset scoped to the current draft record only.
- Add focused repository and server action tests.
- Update `docs/tasks.md` only if adding a small manual-QA support item is useful for tracking.

## Non-Goals

- Adding draft history UI.
- Creating a new draft.
- Deleting draft records.
- Deleting ranking snapshots.
- Resetting all drafts.
- Adding custom league setup UI.
- Adding route params or draft selection.
- Adding account/user support.
- Adding optimistic UI state.
- Adding toast notifications or a full error system.
- Changing draft state transition behavior.
- Changing recommendation logic.
- Changing Prisma schema or migrations unless implementation reveals a blocker.
- Updating package dependencies.
- Broad styling changes.

## Expected Files

- `src/lib/draftRepository.ts`
- `src/lib/draftRepository.test.ts`
- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `src/components/DraftRoom.tsx`
- `src/components/DraftStatusPanel.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing page loading, workspace loader behavior, draft state helpers, recommendation logic, seed ranking data, Prisma schema, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the codebase, but keep the repository and action API close to:

```ts
async function resetDraftWorkspace(
  draftId: string,
): Promise<DraftWorkspace | null>;

export async function resetDraftAction(
  draftId: string,
): Promise<DraftWorkspace | null>;
```

If exposed through `createDraftRepository(db)`, add:

```ts
resetDraftWorkspace,
```

## Expected Behavior

### Repository Reset

- Load or mutate only the draft identified by `draftId`.
- Return `null` if the draft does not exist.
- Delete all persisted `DraftPick` rows for that draft.
- Update draft status to `NOT_STARTED`.
- Return the reloaded typed `DraftWorkspace`.
- Preserve the existing league settings, ranking snapshot, user team id, and draft id.
- Hydration should derive current pick `1` from the empty pick history.

### Server Action

- Accept a `draftId` string.
- Return `null` for blank input.
- Call the repository reset function for valid input.
- Return the repository result unchanged.

### UI Reset

- Add a reset control to `DraftStatusPanel`, near the existing undo button.
- The control should be disabled while a mutation is pending.
- In `DraftRoom`, call `window.confirm` before invoking the reset action.
- If the user cancels confirmation, do not call the action.
- If the action returns a workspace, replace local `activeDraft` with `workspace.draft`.
- If the action returns `null`, leave local draft state unchanged.
- If the action throws, reset pending state, leave local draft state unchanged, and log the error.

## Safety Rules

- Reset is destructive, so it must require confirmation.
- Reset should only clear pick history for the current draft.
- Do not silently create a new draft as part of reset.
- Do not change ranking snapshots or league settings.
- Do not add a static fallback that bypasses persistence.

## Testing Strategy

Use existing test patterns.

Repository tests should cover:

- Reset deletes all persisted picks for one draft.
- Reset updates status to `NOT_STARTED`.
- Reloaded workspace has current pick `1` and no drafted players.
- Reset preserves rankings and league settings.
- Reset returns `null` for a missing draft.

Server action tests should cover:

- Valid reset delegates to the repository.
- Repository `null` result propagates.
- Blank draft id returns `null` without calling the repository.

Do not add a React testing dependency for the button wiring. Use TypeScript/build validation plus manual QA for the UI click path.

## Implementation Steps

1. Extend repository database interface.
   - Add the minimal `draftPick.deleteMany` shape needed for deleting all picks by draft id if the existing type is too narrow.
   - Reuse existing draft update and workspace reload paths where possible.

2. Implement repository reset.
   - Add `resetDraftWorkspace(draftId)` to `createDraftRepository`.
   - Load the workspace first to return `null` for missing drafts.
   - Delete all draft pick rows for the draft.
   - Update draft status to `NOT_STARTED`.
   - Return the reloaded workspace.
   - Add top-level exported `resetDraftWorkspace`.

3. Add repository tests.
   - Extend the fake DB as needed.
   - Add reset behavior and missing-draft tests.
   - Keep assertions focused on observable repository behavior.

4. Add server action.
   - Add `resetDraftAction(draftId)` to `src/app/actions/draftActions.ts`.
   - Add blank input guard.
   - Delegate to repository reset.

5. Add server action tests.
   - Mock the repository reset export.
   - Assert delegation, null propagation, and blank-input guard.

6. Wire UI.
   - Add reset props to `DraftStatusPanel`.
   - Render a reset button with a destructive-but-contained visual treatment.
   - Add `resetDraft` handler in `DraftRoom`.
   - Reuse the existing pending mutation state.
   - Confirm before calling the reset action.
   - Replace `activeDraft` from returned workspace.

7. Update task tracking.
   - Add or check a small Phase 2 manual-QA support item in `docs/tasks.md` if appropriate.
   - Do not check Task 8 or Task 9 items.
   - Do not update the Phase 2 validation checklist unless the implementation and manual validation directly prove a listed item.

8. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - With local database configured, manually verify draft several picks, reset, refresh, and confirm the draft is empty.

## Acceptance Criteria

- Repository reset function exists.
- Server action reset function exists.
- Reset deletes persisted picks for the current draft only.
- Reset updates draft status to `NOT_STARTED`.
- Reset returns a reloaded typed `DraftWorkspace`.
- Reset preserves league settings and ranking snapshot.
- Missing draft reset returns `null`.
- Draft status panel includes a reset control.
- Reset requires user confirmation before calling the server action.
- Successful reset updates visible draft state immediately.
- Refresh after reset restores an empty draft.
- Existing draft and undo interactions still work.
- Tests cover repository reset and server action delegation.
- No draft history UI, route-based resume flow, custom setup UI, or package dependency is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

Requires a configured and migrated local database.

Manual checks:

- Start the app with `npm run dev`.
- Draft several players.
- Refresh and confirm picks remain.
- Click reset and cancel confirmation; confirm picks remain.
- Click reset and confirm; confirm the board resets to pick 1.
- Refresh and confirm the draft remains empty.
- Draft one new pick after reset and confirm persistence still works.

If the local database is unavailable:

- Report manual runtime validation as blocked by database availability.
- Do not replace persistence behavior with static fallback behavior.

## Slice Review

- Smallest meaningful increment: yes, it adds one manual-QA control for the current draft only and does not combine history or draft selection.
- Concrete enough for implementation: yes, repository, action, UI behavior, confirmation, tests, and validation are specified.
- Avoids unnecessary architecture changes: yes, it reuses the existing repository/action/component path.
- Blast radius reasonable: yes, more than one layer is touched, but the behavior is narrow and follows established patterns.
- Review/revert comfort: yes, reset can be removed independently without affecting draft/undo persistence.
- Observable/testable acceptance criteria: yes, repository/action tests cover persistence behavior and manual QA verifies the button-refresh workflow.
