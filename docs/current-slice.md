# Current Slice: Persist Draft And Undo Pick Mutations

## Source Task

`docs/tasks.md` Task 6: Persist Manual Draft Pick Mutations.

This slice implements the persistence behavior behind manual draft and undo operations, but does not wire those operations into the UI yet.

## Goal

Add repository-level mutation functions that persist manual draft progress while preserving the existing draft state transition behavior.

This slice should prove that a persisted draft can be loaded, mutated through the existing Draft State Engine, saved back to pick history, and reloaded as the same domain-facing `DraftWorkspace`.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is repository behavior that can:

```txt
draft a player into a persisted draft
reload the draft with the pick restored
undo the latest persisted pick
reload the draft with the current pick restored
reject duplicate or invalid draft mutations without corrupting pick history
```

## Problem

The repository can now create drafts, load a draft workspace, and list draft summaries. However, manual draft progress is still not persisted.

The app already has pure draft transition helpers:

- `draftPlayerInDraft`
- `undoLastDraftPick`

Persistence should not reimplement draft rules. It should load and hydrate the draft, apply those existing transitions, then persist the resulting pick history and status consistently.

## Goals

- Add a repository mutation for drafting a player.
- Add a repository mutation for undoing the last pick.
- Load and hydrate the draft before applying each mutation.
- Validate that drafted players exist in the draft's ranking snapshot.
- Use existing draft transition helpers for draft and undo behavior.
- Persist changed pick history in the repository layer.
- Update draft status consistently with the resulting pick history.
- Return updated typed `DraftWorkspace` values.
- Add tests for draft, reload, undo, duplicate prevention, missing draft behavior, and completed-draft status.
- Update `docs/tasks.md` checkboxes only for Task 6 items directly completed by this slice.

## Non-Goals

- Adding server actions.
- Wiring UI components or pages to persisted mutation functions.
- Adding draft history UI.
- Adding optimistic UI state.
- Adding browser refresh flow.
- Changing draft state transition behavior.
- Changing recommendation behavior.
- Changing ranking snapshot mapper behavior.
- Changing league settings mapper behavior.
- Changing the Prisma schema unless implementation reveals a clear blocker.
- Running a migration against a real database unless local `DATABASE_URL` is already configured and the implementation approach requires it.
- Adding authentication or user/account models.
- Updating package dependencies.
- Broad documentation rewrites.

## Expected Files

- `src/lib/draftRepository.ts`
- `src/lib/draftRepository.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Possibly:

- `src/lib/draftPersistence.ts` or equivalent only if small helper extraction keeps repository code clearer

Avoid changing UI components, server actions, draft state helpers, recommendation logic, seed ranking data, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the codebase, but keep the repository API close to this shape:

```ts
async function draftPlayerInWorkspace(
  draftId: string,
  playerId: string,
): Promise<DraftWorkspace | null>;

async function undoLastPickInWorkspace(
  draftId: string,
): Promise<DraftWorkspace | null>;
```

If the repository is already exposed through `createDraftRepository(db)`, add these methods there as well:

```ts
function createDraftRepository(db = prisma) {
  return {
    createDraftWorkspace,
    getDraftWorkspaceById,
    listDraftSummaries,
    draftPlayerInWorkspace,
    undoLastPickInWorkspace,
  };
}
```

## Expected Behavior

### Draft Player

- Load the draft workspace by ID.
- Return `null` if the draft does not exist.
- Confirm the player exists in the loaded ranking snapshot.
- Apply `draftPlayerInDraft(workspace.draft, playerId)`.
- If the transition returns the original draft unchanged, do not create or delete pick rows.
- If the transition changes the draft:
  - persist the new made pick at the current pick position
  - keep existing earlier pick history
  - update draft status to `COMPLETE` if every generated pick has a player
  - otherwise update status to `IN_PROGRESS`
- Return the reloaded typed `DraftWorkspace`.

### Undo Last Pick

- Load the draft workspace by ID.
- Return `null` if the draft does not exist.
- Apply `undoLastDraftPick(workspace.draft)`.
- If the transition returns the original draft unchanged, do not create or delete pick rows.
- If the transition changes the draft:
  - delete the latest persisted pick row
  - update draft status to `IN_PROGRESS` if picks remain or `NOT_STARTED` if no picks remain
- Return the reloaded typed `DraftWorkspace`.

### Persistence Rules

- Persist only made picks.
- Do not store empty future picks.
- Do not allow duplicate player IDs in persisted pick history.
- Do not draft players that are missing from the draft's ranking snapshot.
- Do not advance or persist extra picks after a complete draft.
- Keep status synchronized with pick history in the same repository operation.

## Transaction Guidance

Use a transaction for multi-step persistence when using the real Prisma client.

For fake-client repository tests, dependency injection may model the same behavior without a real database transaction. Tests should still verify the observable result:

- pick row created or deleted
- status updated
- reloaded workspace matches expected draft state

## Testing Strategy

Use focused repository tests with the existing fake Prisma-like client unless a real test database is already simple to use.

Tests should validate repository behavior, not Prisma internals.

## Implementation Steps

1. Extend repository database interface.
   - Add the minimal fake/Prisma methods needed for creating and deleting pick rows and updating draft status.
   - Keep the production default functions lazy through the existing Prisma client boundary.

2. Implement `draftPlayerInWorkspace`.
   - Load the workspace.
   - Validate player exists in loaded rankings.
   - Apply `draftPlayerInDraft`.
   - Persist only the newly made pick if the draft changed.
   - Update status based on the resulting draft.
   - Return the reloaded workspace.

3. Implement `undoLastPickInWorkspace`.
   - Load the workspace.
   - Apply `undoLastDraftPick`.
   - Delete the latest persisted pick if the draft changed.
   - Update status based on remaining pick history.
   - Return the reloaded workspace.

4. Add tests.
   - Drafting a player persists the pick.
   - Reloading after draft restores the pick and current pick.
   - Drafting a missing player is rejected or ignored without mutating pick history.
   - Drafting a duplicate player does not create another pick row.
   - Undo removes the latest persisted pick.
   - Reloading after undo restores the current pick.
   - Undo on an empty draft does not mutate pick history.
   - Completing a small draft updates status to `COMPLETE`.
   - Undo after completion restores status to `IN_PROGRESS`.

5. Update task tracking.
   - Update `docs/tasks.md` only for Task 6 checkboxes directly completed by this slice.
   - Do not check Task 7 or later items.

6. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- Repository mutation exists for drafting a player.
- Repository mutation exists for undoing the last pick.
- Drafting a player persists the pick.
- Reloading the draft restores the pick and current pick position.
- Undo removes the latest persisted pick.
- Reloading after undo restores the current pick.
- Duplicate drafted players are rejected or prevented.
- Missing ranking-snapshot players are rejected or prevented.
- Extra picks after draft completion are blocked.
- Draft status is updated consistently with pick history.
- Recommendations remain derivable from the loaded draft and ranking snapshot.
- Tests cover draft, reload, undo, duplicate prevention, and completion status.
- `docs/tasks.md` Task 6 checkboxes are updated for completed mutation work.
- No server action, UI wiring, draft history UI, or browser refresh flow is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged.

If the app is run manually, confirm the draft room still loads normally from the existing static default draft and seed rankings.

## Slice Review

- Smallest meaningful increment: yes, this persists draft and undo mutations behind the repository boundary before server actions or UI wiring.
- Concrete enough for implementation: yes, APIs, mutation behavior, persistence rules, tests, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it reuses the existing Draft State Engine and repository boundary.
- Blast radius reasonable: yes, expected changes are repository code, repository tests, and task checkbox updates.
- Review/revert comfort: yes, app runtime UI behavior remains unchanged and mutation behavior is tested at the repository boundary.
- Observable/testable acceptance criteria: yes, persisted pick rows, statuses, reloaded workspaces, and task checkbox changes are directly verifiable.
