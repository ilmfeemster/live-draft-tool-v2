# Current Slice: Restore Page Position After Draft State Commits

## Source Context

Phase 4 Task 11 and the prior focused QA are complete. Developer Workbench and Active Drafts can now be minimized, and the Available Players table attempts to preserve its nested and page position after a full-list pick.

One scroll regression remains: drafting the first recommendation can still jump the page. The current full-list correction awaits `onDraftPlayer` and schedules one animation-frame restoration from `AvailablePlayersTable`. React can commit the refreshed draft and recommendation markup after that callback boundary, so the correction can run before the layout change it is intended to compensate for. It also does not cover Draft buttons inside Recommendations.

The reliable completion boundary is the Draft Room render that applies the new `displayedDraft`. Page restoration should occur in a layout effect after that committed draft update and before the browser paints the changed recommendation list.

## Goal

Keep the browser page at the same scroll position after any successful player draft, including removal of the first recommendation, while preserving the Available Players table's independent nested scroll position.

## Scope

### Goals

- Capture the browser page position when a valid player-draft action begins.
- Restore that exact page position after the resulting persisted or transient draft state commits.
- Cover Draft buttons in both Recommendations and Available Players through the shared `DraftRoom` mutation handler.
- Preserve the Available Players table's internal `scrollTop` correction.
- Remove the table-owned window-scroll adjustment so only one component owns page restoration.
- Clear a pending restoration when a persisted draft action fails or returns no workspace.
- Preserve all completed minimization, draft, recommendation, persistence, and scenario behavior.

### Non-Goals

- Changing recommendation content, order, scoring, or card height.
- Keeping the clicked recommendation card mounted after it is drafted.
- Scrolling to a selected player, recommendation, table row, or page landmark.
- Applying automatic page restoration to undo, reset, restart, replay-target, import, deletion, or navigation actions.
- Persisting scroll positions across reloads or routes.
- Adding global scroll management, sticky layout, fixed recommendation heights, virtualization, or a dependency.
- Reopening Phase 4 Task 11 or beginning Phase 4 Task 12.

## Implementation Design

### Draft-Commit Page Restoration

Update `src/components/DraftRoom.tsx`.

- Import `useLayoutEffect` and `useRef` from React.
- Add a ref for one pending draft-action page position containing `window.scrollX` and `window.scrollY`.
- In the shared `draftPlayer(playerId)` handler, after the existing pending guard and before either persisted or transient mutation, capture the current page position in that ref.
- Keep all draft transitions on their existing paths:
  - transient sessions continue through `draftPlayerInTransientSession`;
  - persisted drafts continue through `draftPlayerAction` and `setActiveDraft`.
- Add a layout effect keyed to `displayedDraft`. When a successful draft update changes the displayed draft and a pending page position exists:
  1. Clear the pending ref.
  2. Call `window.scrollTo` with the captured coordinates and `behavior: "auto"`.
- A layout effect is intentional: it runs after React commits the changed recommendation and player markup but before paint, preventing the user from seeing an intermediate browser-anchored position.
- If `draftPlayerAction` returns no workspace or throws, clear the pending ref without scrolling.
- Do not populate the ref from undo, reset, restart, import, replay, deletion, or navigation handlers.

### Table Scroll Ownership

Update `src/components/AvailablePlayersTable.tsx`.

- Keep capturing and restoring the table container's internal `scrollTop` around full-list Draft actions.
- Remove capture of the table's viewport top.
- Remove the table's `window.scrollBy` adjustment.
- Continue awaiting `onDraftPlayer` and restoring the internal table position on the next animation frame.

After this change, ownership is explicit:

- `DraftRoom` preserves browser page position for every player-draft entry point.
- `AvailablePlayersTable` preserves only its nested table position for full-list drafting.

No shared scroll utility or new abstraction is warranted for these two distinct responsibilities.

## Testing Strategy

The repository has no DOM interaction environment for browser scroll geometry or React layout-effect timing. Do not add jsdom, React Testing Library, Playwright, or another dependency for this correction.

- Retain existing component markup tests.
- Run focused Draft Room, Recommendations, and Draft History tests for render-boundary regression coverage.
- Use focused manual QA as the behavior regression for first-recommendation removal and scroll stability.
- Run the full automated suite because the shared draft handler serves persisted and transient workflows.

## Implementation Steps

1. Add pending page-position capture and post-commit layout restoration to `DraftRoom`'s shared player-draft path.
2. Clear pending restoration on persisted no-result and failure paths.
3. Reduce `AvailablePlayersTable` restoration to its internal `scrollTop` only.
4. Run focused Draft Room, recommendation, history, and workbench tests.
5. Run the full test suite, lint, and TypeScript validation.
6. Complete the focused manual QA below.
7. Stop after reporting results. Do not begin Phase 4 Task 12.

## Expected Files

- `src/components/DraftRoom.tsx`
- `src/components/AvailablePlayersTable.tsx`

No tests, task tracking, recommendation engine, action, persistence, scenario, disclosure, dependency, or lockfile changes are expected.

`docs/tasks.md` already records Phase 4 Task 11 as complete and should remain checked.

## Automated Validation

Run from the repository root:

```text
npm test -- src/components/DraftRoom.test.tsx src/components/RecommendationsPanel.test.tsx src/components/DraftHistoryList.test.tsx src/components/DeveloperWorkbenchPanel.test.tsx
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused Draft Room, recommendation, history, and workbench tests pass.
- Full Vitest suite passes.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- No dependency or lockfile changes are introduced.

## Focused Manual QA

1. Scroll the page away from its starting position and draft the first recommendation directly from Recommendations; confirm the page remains at the same scroll position while the next recommendation replaces it.
2. From the full Available Players list, draft the player currently ranked first in Recommendations; confirm both page position and the table's internal scroll position remain stable.
3. Repeat with a lower recommendation and a non-recommended player; confirm the same stable behavior.
4. Repeat first-recommendation and full-list picks in a transient scenario or transient manual session.
5. Confirm Recommendations and Available Players still remove the drafted player and refresh from the new draft state.
6. Confirm a failed or no-result persisted draft action does not trigger delayed scrolling during a later action.
7. Confirm undo, reset/restart, replay target, scenario import/export, history navigation, deletion, and disclosure toggles retain their existing scroll and behavior.

## Acceptance Criteria

- Drafting the first recommendation directly does not move the browser page from its pre-click position.
- Drafting the first recommended player from Available Players does not move the browser page and retains the table's valid internal scroll position.
- Lower-recommendation and non-recommended picks have the same stable behavior.
- Persisted and transient player drafting both restore after the committed draft render.
- The drafted player is still removed and recommendations still recompute correctly.
- Only successful player-draft state changes trigger page restoration.
- Failed or no-result persisted actions leave no stale restoration for later renders.
- Undo, reset/restart, replay, import/export, navigation, deletion, and disclosure behavior are unchanged.
- Phase 4 Task 11 remains checked complete.
- Focused tests, full suite, lint, TypeScript, and focused manual QA pass.
- No dependency or lockfile changes are introduced.
- Phase 4 Task 12 is not started.

## Failure Handling

- If the browser clamps the captured coordinates at a document boundary, accept the closest valid position; do not add spacer content.
- If `displayedDraft` does not change, do not scroll and clear the pending position on the known no-result/failure path.
- If a successful persisted update can return the same `displayedDraft` reference, stop and report that discrepancy rather than adding timers or global listeners.
- If the page still moves after layout-effect restoration, inspect the actual focus/scroll sequence before introducing focus reassignment or CSS anchoring changes.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this correction passes automated and manual validation, plan Phase 4 Task 12: Complete Phase 4 Regression and Exit Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It corrects the single remaining player-draft scroll regression.
- Executable by a lower-reasoning pass: yes. The owner, capture point, commit boundary, cleanup paths, and table responsibility are explicit.
- Avoids unnecessary architecture changes: yes. One ref and one layout effect remain inside the existing Draft Room owner.
- Blast radius reasonable: yes. Two production components are expected to change.
- Review/revert comfort: yes. The correction is isolated from domain and persistence semantics.
- Observable/testable acceptance criteria: yes. Page coordinates, nested table position, refreshed recommendations, success/failure behavior, and unaffected actions are directly observable.
