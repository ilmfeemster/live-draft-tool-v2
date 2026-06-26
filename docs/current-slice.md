# Current Slice: Add Safe Draft Deletion

## Source Task

Task 12: Add Safe Draft Deletion.

## Goal

Allow unwanted persisted drafts to be removed intentionally so local draft history stays manageable.

This slice adds a destructive workflow that is separate from reset. Reset clears pick history for the currently selected draft. Delete removes an unwanted draft workspace from draft history.

## User-Visible Increment

- A user can delete an unwanted draft from draft history.
- Deletion requires browser confirmation.
- Deleting a non-loaded draft removes it from history without changing the current draft.
- Deleting the loaded draft leaves the app in a valid loaded-draft state through the existing default/latest draft loading flow.

## Problem

Now that the app can create multiple persisted drafts, accidental or test drafts can accumulate. Reset is not the right tool because it preserves the draft workspace and only clears picks. The app needs a clear, confirmed delete action for removing unwanted draft records.

## Goals

- Add repository support for deleting a draft workspace by id.
- Delete the draft's persisted pick history.
- Delete the associated ranking snapshot only when it is safe under the current repository contract.
- Add a server action for deleting drafts.
- Add delete controls to draft history cards for active, in-progress, and completed drafts.
- Require browser confirmation before calling the delete action.
- If deleting the currently loaded draft, navigate to `/` so the existing loader can select the latest remaining draft or create a fallback.
- If deleting a non-loaded draft, refresh the current page/history.
- Preserve existing create, resume, draft, undo, reset, available-player, roster, and recommendation behavior.
- Update task tracking after implementation.

## Non-Goals

- Bulk deletion.
- Archive/restore.
- Soft delete.
- Audit log.
- Account-aware authorization.
- Draft renaming.
- Custom draft management screen.
- Deleting individual picks outside existing undo/reset flows.
- Changing the existing draft loading fallback behavior.
- Prisma schema or migration changes unless implementation proves deletion cannot be done correctly without one.
- New package dependencies.

## Expected Files

- `src/lib/draftRepository.ts`
- `src/lib/draftRepository.test.ts`
- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `src/components/DraftHistoryList.tsx`
- `src/app/page.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing draft state engine logic, recommendation logic, ranking seed data, route structure, reset behavior, new-draft creation behavior, or unrelated draft room UI.

## Repository Behavior

Add a repository method:

```ts
async deleteDraftWorkspace(draftId: string): Promise<boolean>
```

Expected behavior:

- Return `false` if the draft does not exist.
- Return `true` if the draft is deleted.
- Remove the `Draft` record.
- Ensure associated `DraftPick` rows are removed.
  - Prefer relying on the existing Prisma `onDelete: Cascade` relation for real database behavior.
  - Mirror that behavior in the fake repository test client.
- Clean up the associated ranking snapshot only if it is safe and scoped to the deleted draft.
  - Current MVP creation creates one ranking snapshot per draft.
  - Do not introduce broad ranking snapshot garbage collection.
  - Do not make deletion depend on loading or parsing full ranking JSON.

If deleting the associated ranking snapshot creates unexpected schema risk, stop and report the blocker rather than silently leaving inconsistent data.

## Server Action Shape

Add a server action in `src/app/actions/draftActions.ts`:

```ts
export async function deleteDraftAction(draftId: string): Promise<boolean>
```

Expected behavior:

- Return `false` and do not call the repository for blank draft ids.
- Delegate to `deleteDraftWorkspace`.
- Return the repository boolean.

## UI Shape

Move draft history rendering from `src/app/page.tsx` into a small client component:

```tsx
// src/components/DraftHistoryList.tsx
"use client";
```

Component props:

```ts
type DraftHistoryListProps = {
  activeDraftId: string;
  summaries: DraftSummary[];
};
```

Keep the current compact history behavior:

- active/in-progress row
- completed drafts disclosure
- loaded draft marker
- existing `?draftId=<id>` resume links

Add delete controls:

- Each draft history card has a delete button.
- Do not nest a `<button>` inside an `<a>`.
  - Use a card container with a resume link and a separate delete button.
- Disable delete buttons while a delete is pending.
- Confirmation copy should make the action clear and mention that deletion removes the saved draft.
- On successful deletion:
  - if deleting the loaded draft, `router.push("/")` and `router.refresh()`
  - otherwise, `router.refresh()`
- If the server action returns `false`, leave the UI stable and log a clear error.

## Implementation Steps

1. Add repository delete support.
   - Extend the repository DB type with the minimal `draft.delete` support needed.
   - Add `deleteDraftWorkspace(draftId)`.
   - Check existence before deleting so missing drafts return `false`.
   - Delete the draft record and rely on pick cascade semantics.
   - Handle ranking snapshot cleanup only when safely tied to the deleted draft.

2. Test repository deletion.
   - Extend `src/lib/draftRepository.test.ts`.
   - Add a test that creates two drafts with picks, deletes one, and verifies:
     - deleted draft no longer loads
     - deleted draft no longer appears in summaries
     - other draft still loads with its picks intact
     - deleted draft's pick rows are removed from the fake DB
   - Add a test that deleting a missing draft returns `false`.

3. Add the server action.
   - Import `deleteDraftWorkspace`.
   - Add `deleteDraftAction`.
   - Keep existing draft, undo, reset, and create actions unchanged.

4. Test the server action.
   - Extend the repository mock in `draftActions.test.ts`.
   - Assert deletion delegates with a non-blank id.
   - Assert the boolean result is returned.
   - Assert blank ids return `false` without calling the repository.

5. Extract draft history into a client component.
   - Create `src/components/DraftHistoryList.tsx`.
   - Move the current `DraftHistoryList`, `DraftSummaryCard`, `SummaryMetric`, `formatDraftStatus`, and `formatUpdatedAt` logic from `src/app/page.tsx`.
   - Add `"use client"`.
   - Import and use `useRouter` from `next/navigation`.
   - Import and call `deleteDraftAction`.

6. Wire delete controls.
   - Add a delete button to each draft card.
   - Keep the resume link separate from the delete button.
   - Use one pending id state such as `deletingDraftId`.
   - Confirm before calling `deleteDraftAction`.
   - Navigate/refresh according to whether the deleted draft is currently loaded.

7. Update `src/app/page.tsx`.
   - Import `DraftHistoryList` from `src/components/DraftHistoryList`.
   - Remove the local draft history helper functions that moved into the component.
   - Keep page loading and `DraftRoom` behavior unchanged.

8. Update task tracking.
   - In `docs/tasks.md`, mark Task 12 complete only if all acceptance criteria are satisfied.
   - Check `Delete unwanted persisted drafts safely` in the Phase 2 validation checklist if validated.
   - Do not mark unrelated Phase 2 validation items complete.

9. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Manually inspect deletion in the browser only if doing so will not destroy useful local data, or create disposable test drafts first.

## Acceptance Criteria

- A user can delete an unwanted persisted draft from draft history.
- Deletion requires browser confirmation.
- Deleting a draft removes it from draft history after navigation or refresh.
- Deleting one draft does not delete or mutate other drafts.
- Deleting the currently loaded draft leaves the app in a valid loaded-draft state.
- Delete controls are available for active, in-progress, and completed draft history cards.
- Resume links still load selected persisted drafts.
- Existing create, resume, draft, undo, reset, available-player, roster, and recommendation behavior still works.
- Repository tests cover successful deletion and missing-draft deletion.
- Server-action tests cover delegation and blank-id behavior.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes or any environment-specific blocker is reported clearly.

## Manual Test Notes

Recommended manual checks after implementation:

- Create a disposable draft, delete it from history, and confirm it disappears.
- Make a pick in one draft, create another draft, delete the other draft, and confirm the picked draft remains intact.
- Delete the currently loaded disposable draft and confirm the app loads another valid draft or creates a fallback.
- Delete a completed draft from the completed section and confirm it disappears from that section.
- Cancel the confirmation dialog and confirm no deletion occurs.
- Confirm resume links still navigate with `?draftId=<id>`.
- Confirm Start New Draft, draft pick, undo, and reset still work after deletion.

## Slice Review

- Smallest meaningful increment: yes, it adds only single-draft deletion and confirmation.
- Concrete enough for implementation: yes, repository behavior, server action shape, UI behavior, tests, and validation are specified.
- Avoids unnecessary architecture changes: yes, it reuses repository functions, server actions, and the existing `/` loader fallback.
- Blast radius reasonable: yes, expected changes are limited to repository/action layers, the draft history component/page boundary, and task tracking.
- Review/revert comfort: yes, the slice can be reverted without changing draft engine rules, route structure, or persisted schema unless a blocker forces schema work.
- Observable/testable acceptance criteria: yes, deletion, confirmation, history removal, current-draft fallback, and regression behavior can be checked directly.
