# Current Slice: Persist Draft Room Interactions

## Source Task

`docs/tasks.md` Task 7: Wire The App To Load A Persisted Draft Workspace.

This slice completes the remaining Task 7 interaction wiring by making the draft room's draft and undo buttons call the existing server actions instead of mutating only local in-memory draft state.

## Goal

Persist manual draft and undo interactions from the existing draft room UI while preserving the current user experience as much as possible.

The draft room should continue to derive available players, roster, recommendations, and draft status from typed `Draft` and `RankingEntry[]` data. The difference is that successful button actions should replace local draft state with the updated persisted `DraftWorkspace` returned by the server action.

## User-Visible Increment

Manual picks and undo operations should survive browser refresh when the local database is configured.

The user-visible workflow should be:

```txt
open persisted draft room
draft a player
see the draft board update
refresh the page
see the drafted player still restored
undo the latest pick
refresh the page
see the undo restored
```

## Problem

The page now loads its initial state from a persisted `DraftWorkspace`, but `DraftRoom` still handles draft and undo interactions with pure client-side helpers:

- `draftPlayerInDraft`
- `undoLastDraftPick`

That means the first page load is persisted, but new user interactions are not written to pick history yet. The server actions and repository mutations already exist; the client component needs to call them.

## Goals

- Wire draft-player clicks to `draftPlayerAction`.
- Wire undo clicks to `undoLastPickAction`.
- Replace `activeDraft` with the returned workspace draft when the action succeeds.
- Keep recommendations, available players, roster, and status derived from current local `activeDraft` and existing rankings.
- Keep the UI responsive enough for MVP use by tracking pending mutations.
- Prevent duplicate overlapping draft/undo requests while a mutation is pending.
- Leave ranking data unchanged in the component because the ranking snapshot does not change during draft/undo mutations.
- Update `docs/tasks.md` only for Task 7 items directly completed by this slice.

## Non-Goals

- Adding optimistic UI state.
- Adding toast notifications or error banners.
- Adding retry UI.
- Adding draft history UI.
- Adding route params or draft selection.
- Adding custom league setup UI.
- Changing recommendation logic.
- Changing draft state transition behavior.
- Changing repository mutation behavior.
- Changing server action behavior unless a small guard is required by the client wiring.
- Changing Prisma schema or migrations.
- Adding authentication or user/account models.
- Updating package dependencies.
- Broad styling changes.
- Broad documentation rewrites.

## Expected Files

- `src/components/DraftRoom.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Possibly:

- `src/app/actions/draftActions.ts`, only if the component wiring reveals a tiny server-action shape issue.

Avoid changing page loading, repository internals, draft state helpers, recommendation logic, seed ranking data, Prisma schema, project scope, roadmap scope, or unrelated documentation.

## Expected Behavior

### Draft Player

- When a player is selected from recommendations or the available players table:
  - If a mutation is already pending, do nothing.
  - Call `draftPlayerAction(activeDraft.id, playerId)`.
  - If the action returns a workspace, update local draft state to `workspace.draft`.
  - If the action returns `null`, leave local draft state unchanged.
- Do not call `draftPlayerInDraft` in the component for persisted interactions.
- Existing repository/action behavior should continue to reject duplicate, invalid, missing-player, or complete-draft mutations.

### Undo Last Pick

- When undo is clicked:
  - If a mutation is already pending, do nothing.
  - Call `undoLastPickAction(activeDraft.id)`.
  - If the action returns a workspace, update local draft state to `workspace.draft`.
  - If the action returns `null`, leave local draft state unchanged.
- Do not call `undoLastDraftPick` in the component for persisted interactions.

### Pending State

- Add one local pending state such as `isMutationPending`.
- Use it to prevent overlapping requests.
- Disable draft actions while pending by passing `isDraftComplete || isMutationPending` to existing draft-button disabling paths if practical.
- Disable undo while pending by setting `canUndoLastPick` to false while pending.
- Do not add visible loading copy or new UI surfaces in this slice unless required for correctness.

### Error Handling

- If a server action throws, reset pending state and leave local draft state unchanged.
- It is acceptable to log the error with `console.error` for this slice.
- Do not add a full user-facing error system in this slice.

## Testing Strategy

Do not add a new React testing dependency for this slice.

The persistence behavior is already covered by:

- repository mutation tests
- server action delegation tests
- workspace loader tests

This slice should rely on:

- TypeScript/build validation to prove the client/server action wiring compiles.
- Existing unit tests to guard the persistence behavior behind the actions.
- Manual runtime validation with a configured local database to prove the click-refresh workflow.

If implementation naturally extracts a small pure helper, add a unit test for that helper. Do not add an abstraction only to make the component easier to test.

## Implementation Steps

1. Update `DraftRoom` imports.
   - Remove `draftPlayerInDraft` and `undoLastDraftPick` imports.
   - Import `draftPlayerAction` and `undoLastPickAction`.

2. Add mutation pending state.
   - Add `const [isMutationPending, setIsMutationPending] = useState(false);`.
   - Keep existing `activeDraft` state.

3. Wire persisted draft action.
   - Change `draftPlayer` to an async function.
   - Guard against `isMutationPending`.
   - Set pending true before calling the server action.
   - Call `draftPlayerAction(activeDraft.id, playerId)`.
   - If a workspace is returned, call `setActiveDraft(workspace.draft)`.
   - Reset pending in `finally`.

4. Wire persisted undo action.
   - Change `undoLastPick` to an async function.
   - Guard against `isMutationPending`.
   - Set pending true before calling the server action.
   - Call `undoLastPickAction(activeDraft.id)`.
   - If a workspace is returned, call `setActiveDraft(workspace.draft)`.
   - Reset pending in `finally`.

5. Prevent overlapping interactions.
   - Treat the draft as unavailable for new draft clicks while pending.
   - Treat undo as unavailable while pending.
   - Keep derived recommendation/roster logic unchanged.

6. Update task tracking.
   - In `docs/tasks.md`, check the Task 7 item for persisting draft room draft and undo interactions through server actions.
   - If Task 7 scope items are now all complete and validation supports the acceptance criteria, mark Task 7 complete.
   - Update the Phase 2 validation checklist only for items directly proven by implementation and validation.
   - Do not check Task 8 or later items.

7. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - With local database configured and migrated, run `npm run dev` and manually verify draft, refresh, undo, refresh.

## Acceptance Criteria

- Draft room draft clicks call `draftPlayerAction`.
- Draft room undo clicks call `undoLastPickAction`.
- Successful draft action responses update local draft state from returned `DraftWorkspace`.
- Successful undo action responses update local draft state from returned `DraftWorkspace`.
- Draft and undo interactions persist after page refresh when the local database is configured.
- Duplicate overlapping mutation requests are prevented while an action is pending.
- Available players, roster, status, and recommendations still derive correctly from loaded draft state.
- UI components do not import Prisma models or raw database JSON.
- Existing repository and server action tests remain green.
- `docs/tasks.md` Task 7 tracking is updated only for completed interaction-wiring work.
- No draft history UI, custom setup UI, route-based resume flow, optimistic UI, or new package dependency is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

Requires a configured and migrated local database.

Manual checks:

- Start the app with `npm run dev`.
- Open the draft room.
- Draft one player.
- Refresh the page and confirm the player remains drafted.
- Undo the pick.
- Refresh the page and confirm the player is available again and current pick is restored.
- Draft several picks, refresh, and confirm recommendations and roster still derive from the restored draft state.

If the local database is unavailable:

- Report manual runtime validation as blocked by database availability.
- Do not replace persistence behavior with static fallback behavior.

## Slice Review

- Smallest meaningful increment: yes, it wires only existing draft/undo interactions to existing server actions and avoids history, routing, or custom setup.
- Concrete enough for implementation: yes, handler behavior, pending state, task updates, and validation are specified.
- Avoids unnecessary architecture changes: yes, it uses the existing server actions and repository boundary.
- Blast radius reasonable: yes, expected source change is one client component plus Task 7 tracking.
- Review/revert comfort: yes, the slice can be reverted independently to restore client-only draft behavior.
- Observable/testable acceptance criteria: yes, automated validation proves the wiring compiles and existing persistence tests remain green; manual runtime validation proves refresh persistence.
