# Current Slice: Add New Draft Creation Flow

## Source Task

Task 9: Add New Draft Creation Flow.

## Goal

Give the user an intentional way to start a fresh persisted draft without resetting, overwriting, deleting, or manually editing an existing draft.

This slice closes the product gap between "resume an old draft" and "reset this same draft." Reset remains a manual QA tool for clearing the current draft. New draft creation is the user-facing workflow for saving the current draft in history and moving on to another draft.

## User-Visible Increment

- A user can start a new persisted draft from the draft room.
- If the current draft is complete, the draft room shows a clear prompt to start another draft.
- The new draft loads immediately through the existing `?draftId=<id>` route.
- The previous draft remains visible in draft history.

## Problem

The app can persist, resume, reset, draft, and undo, but it does not yet provide a normal "start another draft" workflow. A user who finishes a draft, or simply wants to begin a separate draft, currently has no clear product action. Reset is destructive to the current draft's pick history and should not be used as a substitute for creating a new saved draft.

## Goals

- Add a server action that creates a new persisted draft workspace.
- Use current MVP defaults for the new draft:
  - default league settings
  - seed ranking snapshot
  - current MVP user team id
- Add a visible `Start New Draft` control in the draft room status area.
- Show an inline completed-draft prompt with a `Start New Draft` action when `isDraftComplete` is true.
- After creating the draft, navigate to `/?draftId=<newDraftId>`.
- Preserve the existing draft and its pick history.
- Prevent duplicate creates while the create action is pending.
- Keep existing draft, undo, reset, resume, recommendation, and history behavior intact.
- Add focused server-action test coverage for the new create action.
- Update task tracking after implementation.

## Non-Goals

- Custom league setup UI.
- Ranking import or ranking selection UI.
- Draft templates.
- Draft duplication.
- Draft deletion.
- Draft renaming.
- Accounts or multi-user draft ownership.
- Changing the existing auto-save behavior.
- Changing the draft history list into a full management screen.
- Adding a modal flow for this slice.
- Prisma schema or migration changes.
- New package dependencies.

## Expected Files

- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `src/components/DraftRoom.tsx`
- `src/components/DraftStatusPanel.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing repository APIs, Prisma schema, route structure, recommendation logic, ranking seed data, or unrelated UI layout unless implementation reveals a real blocker.

## Server Action Shape

Add a new server action in `src/app/actions/draftActions.ts`:

```ts
export async function createNewDraftAction()
```

Expected behavior:

- Call the existing repository create function.
- Pass MVP defaults explicitly:
  - `defaultLeagueSettings`
  - `seedRankings`
  - MVP user team id, currently `team-2`
  - a simple name such as `New Draft`
- Return the created `DraftWorkspace` so the client can navigate using `workspace.draft.id`.

Keep the action small. Do not add a general draft setup abstraction in this slice.

## UI Behavior

Add the new-draft control to the existing draft room/status flow.

### Always-Available Control

- Render a `Start New Draft` button in the draft status panel near the existing undo/reset controls.
- Disable it while another draft mutation is pending.
- On click, call `createNewDraftAction`.
- On success, navigate to `/?draftId=<newDraftId>` using Next navigation.

### In-Progress Draft Safety

If the current draft has one or more picks and is not complete:

- Ask for browser confirmation before creating and navigating to a new draft.
- Make the confirmation copy clear that the existing draft will be saved in history, not reset or deleted.
- If the user cancels, do not call the server action.

### Completed Draft Prompt

When `isDraftComplete` is true:

- Show an inline completion prompt in `DraftStatusPanel`.
- Include a `Start New Draft` button in that prompt.
- Reuse the same create handler and pending state.
- Do not add a modal for this slice.

## Implementation Steps

1. Add the create action.
   - Import `createDraftWorkspace`, `defaultLeagueSettings`, and `seedRankings`.
   - Add a local constant for the MVP user team id if no shared constant already exists.
   - Return the created workspace.

2. Test the create action.
   - Extend `src/app/actions/draftActions.test.ts`.
   - Mock the repository create function.
   - Assert `createNewDraftAction` delegates with default settings, seed rankings, user team id, and draft name.
   - Assert the created workspace is returned.
   - Keep existing action tests unchanged.

3. Wire the client handler.
   - In `DraftRoom`, import `createNewDraftAction`.
   - Use `useRouter` from `next/navigation`.
   - Add a handler that:
     - confirms when the current draft is in progress
     - sets pending mutation state
     - calls the create action
     - pushes `/?draftId=<createdWorkspace.draft.id>`
     - clears pending state if navigation does not immediately replace the component

4. Extend `DraftStatusPanel` props.
   - Add an `onCreateNewDraft` callback.
   - Add an `isNewDraftDisabled` or reuse the existing pending/disabled shape.
   - Render the always-available `Start New Draft` control.
   - Render the completed-draft prompt when `isDraftComplete` is true.

5. Preserve existing controls.
   - Keep undo behavior unchanged.
   - Keep reset behavior unchanged.
   - Keep current draft status display unchanged except for the new prompt/control.
   - Do not remove existing draft history links.

6. Update task tracking.
   - In `docs/tasks.md`, mark Task 9 complete only if all acceptance criteria are satisfied.
   - Check `Start a new persisted draft without overwriting an existing draft` in the Phase 2 validation checklist if validated.
   - Do not mark unrelated Phase 2 validation items complete.

7. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Manually verify the new draft workflow in the browser if a dev server is already available or can be started locally.

## Acceptance Criteria

- A user can intentionally create a new persisted draft from the draft room.
- Creating a new draft does not overwrite, reset, or delete the current draft.
- The app navigates to the newly created draft at `/?draftId=<newDraftId>`.
- The new draft starts at pick 1 with MVP default settings and seed rankings.
- The previous draft remains available in draft history.
- A completed draft shows an obvious option to start another draft.
- In-progress drafts ask for confirmation before navigating away to a new draft.
- Existing resume, draft, undo, reset, available-player, roster, and recommendation behavior still work.
- Server-action tests cover the new create action.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes or any environment-specific blocker is reported clearly.

## Manual Test Notes

Recommended manual checks after implementation:

- Create a new draft from an empty draft.
- Make at least one pick, start a new draft, confirm, and verify the old draft is still in history.
- Complete or simulate completing a draft enough to see the completed-draft prompt.
- Start a new draft from the completed prompt.
- Reopen the previous draft from history and confirm its picks remain intact.
- Verify undo and reset still affect only the currently selected draft.

## Slice Review

- Smallest meaningful increment: yes, it adds only the missing new-draft workflow.
- Concrete enough for implementation: yes, action shape, UI placement, state handling, tests, and validation are specified.
- Avoids unnecessary architecture changes: yes, it reuses the existing repository create function and `?draftId=` route.
- Blast radius reasonable: yes, expected changes are limited to two action files, two draft room UI files, and task tracking.
- Review/revert comfort: yes, the workflow can be reverted without schema or repository contract changes.
- Observable/testable acceptance criteria: yes, creation, navigation, history preservation, prompt visibility, and regression behavior can all be checked.
