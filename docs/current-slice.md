# Current Slice: Reload the Draft Workspace After Active Deletion

## Source Context

This is a focused correction to Phase 4 Task 11.

The previous deletion fix removes a successfully deleted draft from the local `DraftHistoryList` state. When the deleted draft is also the loaded draft, however, the Draft Room can continue showing that deleted workspace's available players, roster, recommendations, and status.

`DraftHistoryList` and `DraftRoom` are siblings rendered by the server page. The history list can update its own cards, but it does not own the loaded workspace used by `DraftRoom`. The current active-deletion path calls `router.replace()` and then immediately calls `router.refresh()`. Those operations do not expose a completion boundary, so refresh can reconcile the old route while the replacement navigation is still pending.

The active workspace must be replaced through one authoritative navigation that reloads all server-derived workspace props together.

## Goal

After deleting the loaded draft, automatically load a deterministic remaining draft or the existing fallback workspace, and ensure the entire page reflects that workspace without requiring another click or manual refresh.

## Scope

### Goals

- Preserve immediate local card and count removal after successful deletion.
- Preserve the existing deterministic replacement choice:
  1. First remaining non-complete draft in display order.
  2. Otherwise the first remaining completed draft.
  3. Otherwise the root fallback/default-workspace path.
- Use a single authoritative hard replacement navigation for active-draft deletion.
- Ensure Draft Room state, available players, user roster, recommendations, status, and page-level league summary are reconstructed from the replacement server workspace.
- Keep inactive-draft deletion on the existing optimistic removal plus `router.refresh()` reconciliation path.
- Preserve confirmation, pending, cancellation, and failure behavior.
- Keep the deleted draft URL out of browser history.
- Mark Phase 4 Task 11 complete only after this correction and the remaining Task 11 validation pass.

### Non-Goals

- Moving workspace state into `DraftHistoryList`.
- Converting the server page into a client-owned workspace store.
- Passing draft, rankings, roster, or recommendation state between sibling components.
- Synchronizing `DraftRoom` props with effects as a substitute for loading the correct server workspace.
- Changing draft deletion persistence semantics.
- Changing scenario import, export, replay-target, reset, or restart behavior.
- Redesigning Draft History or Draft Room.
- Adding a package dependency or browser-test framework.
- Beginning Phase 4 Task 12.

## Implementation Design

Update `src/components/DraftHistoryList.tsx`.

### Inactive Draft Deletion

After `deleteDraftAction(summary.id)` succeeds for a draft other than `activeDraftId`:

1. Remove the deleted summary from `visibleSummaries`.
2. Leave the loaded Draft Room unchanged.
3. Call `router.refresh()` to reconcile authoritative server summaries.

### Active Draft Deletion

After `deleteDraftAction(summary.id)` succeeds for `activeDraftId`:

1. Remove the deleted summary from `visibleSummaries`.
2. Select the replacement summary using the existing deterministic order.
3. Build the destination:

```ts
const destination = nextSummary
  ? `/?draftId=${encodeURIComponent(nextSummary.id)}`
  : "/";
```

4. Call:

```ts
window.location.replace(destination);
```

5. Return without calling `router.refresh()`.

The hard replacement is intentional. Active deletion invalidates the server workspace supplying several sibling and page-level surfaces, and the existing client navigation plus immediate refresh has already demonstrated stale mixed UI. A full replacement is a small, reliable boundary that reloads the page, loader, Draft Room key, rankings, league settings, recommendations, available-player derivation, and roster derivation together. `replace` is preferred over `assign` so Back cannot revisit the deleted draft URL.

### Cancellation and Failure

- If native confirmation is declined, do not call the delete action, update local summaries, or navigate.
- If deletion returns `false` or throws, leave cards, counts, loaded workspace, and URL unchanged.
- Preserve existing error logging and pending-state cleanup.

## Testing Strategy

The repository has no DOM interaction test dependency, and static rendering cannot invoke the asynchronous delete handler or replace `window.location`. Do not add React Testing Library or jsdom for this correction.

- Keep `src/components/DraftHistoryList.test.tsx` as markup regression coverage for grouping, counts, cards, and empty state.
- Retain action and repository tests as authority for deletion success/failure semantics.
- Use focused manual QA as the behavior regression for active deletion and full workspace replacement.
- Run the complete automated suite because the replacement workspace must preserve draft, roster, recommendation, scenario, and persistence behavior.

## Implementation Steps

1. Update the successful deletion branch in `DraftHistoryList` to separate inactive reconciliation from active workspace replacement.
2. For active deletion, replace the browser location with the deterministic destination and skip the racing `router.refresh()` call.
3. Confirm inactive deletion still removes its card immediately and refreshes server summaries without changing the loaded Draft Room.
4. Run focused Draft History, Draft Room, action, repository, and workspace-loader tests.
5. Run the full test suite, lint, and TypeScript validation.
6. Complete the focused manual QA below.
7. If all remaining Task 11 criteria pass, mark Task 11 complete in `docs/tasks.md`. Do not begin Task 12.

## Expected Files

- `src/components/DraftHistoryList.tsx`
- `docs/tasks.md` only to mark Task 11 complete after validation

No Draft Room, page, domain, persistence, scenario, or dependency changes are expected.

## Automated Validation

Run from the repository root:

```text
npm test -- src/components/DraftHistoryList.test.tsx src/components/DraftRoom.test.tsx src/app/actions/draftActions.test.ts src/lib/draftRepository.test.ts src/lib/draftWorkspaceLoader.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused history, workspace, action, repository, and Draft Room tests pass.
- Full Vitest suite passes.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- No dependency or lockfile changes are introduced.

## Focused Manual QA

1. Delete an inactive draft; confirm its card/count disappear immediately while available players, roster, recommendations, and loaded-draft status remain unchanged.
2. Cancel inactive deletion; confirm no visible state or navigation changes.
3. Delete the loaded draft while another active draft remains; confirm that draft loads automatically and its available players, roster, recommendations, status, and league summary all replace the deleted workspace.
4. Delete the loaded draft when only completed drafts remain; confirm the first completed draft loads with its complete workspace state.
5. Delete the only remaining draft; confirm the root loader establishes its normal fallback/default workspace and all Draft Room surfaces match it.
6. Use Back after active deletion; confirm the browser does not return to the deleted draft URL.
7. Force or observe a failed deletion if practical; confirm the card, counts, URL, and loaded Draft Room remain unchanged.
8. Confirm the Scenario Files and replay-target controls retain their existing behavior after replacement navigation.

## Acceptance Criteria

- Successful inactive deletion immediately updates history without changing the loaded workspace.
- Successful active deletion automatically loads the deterministic replacement or fallback workspace.
- Available players are derived from the replacement draft and rankings, not the deleted draft.
- User roster, recommendations, draft status, and page-level league summary all reflect the same replacement workspace.
- No additional click or manual refresh is required.
- The active-deletion path performs one replacement navigation and does not race it with `router.refresh()`.
- Browser Back does not revisit the deleted draft URL.
- Cancelled or failed deletion leaves history, URL, and Draft Room state unchanged.
- Existing deletion confirmation and server-side deletion behavior are preserved.
- Existing persisted draft, scenario-workbench, reset/restart, and recommendation behavior remains functional.
- Focused tests, full suite, lint, TypeScript, and focused manual QA pass.
- Task 11 is checked complete only after validation.
- Task 12 is not started.

## Failure Handling

- If the replacement server load fails, allow the existing page/loader error behavior to surface; do not fabricate a client workspace from summaries.
- If `window.location.replace()` is unavailable during server rendering, no issue should occur because deletion is a client event in a client component.
- If active deletion still produces mixed workspace state, stop and report it before introducing shared client state or changing the page architecture.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this correction is implemented, manually validated, and Task 11 is complete, plan Phase 4 Task 12: Complete Cross-Feature Regression and Phase 4 Exit Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It corrects one observable stale-workspace bug after active deletion.
- Executable by a lower-reasoning pass: yes. The exact branch, destination, navigation method, and refresh behavior are specified.
- Avoids unnecessary architecture changes: yes. It uses the existing server loader as the authoritative workspace boundary.
- Blast radius reasonable: yes. One production component changes, with task tracking only after validation.
- Review/revert comfort: yes. The navigation correction is isolated to successful active deletion.
- Observable/testable acceptance criteria: yes. History, URL, player pool, roster, recommendations, status, league summary, fallback, and Back behavior are directly observable.
