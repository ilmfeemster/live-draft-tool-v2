# Current Slice: Stabilize Drafting Scroll and Collapse Utility Panels

## Source Context

Phase 4 Task 11 is complete, but focused use exposed two usability problems before Phase 4 exit validation:

1. When a developer is scrolled into the full Available Players list and drafts a player who also appears in Recommendations, the recommendation refresh can change content height above the table. The table and browser scroll positions can move, making the screen appear to jump away from the drafting context.
2. Developer Workbench and the Active Drafts history group occupy substantial vertical space even when the developer is focused on drafting.

These are presentation and interaction corrections. Draft state, recommendation output, persistence, and scenario behavior must remain authoritative and unchanged.

## Goal

Keep the developer's visible position stable when drafting from the full player list, and allow Developer Workbench and Active Drafts to be minimized without removing or redesigning their existing controls.

## Scope

### Goals

- Preserve the Available Players table's internal scroll position while a selected player is removed.
- Preserve the table viewport's page position when recommendation content above it refreshes after a full-list draft action.
- Apply the scroll stabilization to persisted and transient draft sessions through the existing `onDraftPlayer` callback.
- Make Developer Workbench collapsible and expanded by default.
- Make the Active Drafts group collapsible and expanded by default.
- Keep a compact, meaningful summary visible for each minimized section.
- Use accessible native disclosure behavior with keyboard-operable summaries.
- Preserve all existing workbench, history, draft, recommendation, and deletion behavior.

### Non-Goals

- Changing Recommendation Engine output, recommendation count, scoring, order, or card content.
- Making Recommendations, Available Players, Draft Status, User Roster, or completed draft history newly collapsible.
- Persisting minimized state across reloads, routes, or browser sessions.
- Adding sticky page regions, virtualized tables, custom scroll containers, or global scroll restoration.
- Changing draft actions, optimistic state, persistence, scenario sessions, or deletion navigation.
- Redesigning the Draft Room or Draft History.
- Adding a DOM interaction-test dependency or beginning Phase 4 Task 12.

## Implementation Design

### Stable Full-List Drafting Position

Update `src/components/AvailablePlayersTable.tsx`.

- Keep a ref to the existing `max-h-[620px]` table scroll container.
- Allow `onDraftPlayer` to return `void` or `Promise<void>` so the table can wait for the existing Draft Room mutation to settle without changing draft ownership.
- When a full-list Draft button is used:
  1. Capture the table container's `scrollTop` and its top position in the viewport.
  2. Await `onDraftPlayer(playerId)`.
  3. On the next animation frame, if the table container is still mounted, restore its internal `scrollTop`.
  4. Measure the table container's new viewport top and adjust the window by only that delta so the table returns to its prior visible position.
- Do not scroll to the drafted row, to Recommendations, or to the top of the page.
- Do not run this correction for recommendation-card Draft buttons; the reported regression is the full-list workflow and the table owns the relevant scroll context.
- If the draft action fails or produces no layout change, the measured delta should be zero and visible position should remain unchanged.

This keeps the correction local to the surface that owns the nested table scroll position. `DraftRoom` remains the owner of persisted and transient draft mutations.

### Collapsible Developer Workbench

Update `src/components/DeveloperWorkbenchPanel.tsx`.

- Wrap the existing panel body in an expanded-by-default native `<details>` disclosure.
- Use its `<summary>` as the persistent compact header.
- Keep `Developer Workbench`, the current mode label, and an Expand/Minimize affordance visible in the summary.
- Render all existing scenario files, status, replay-target, reset/restart, and error content unchanged inside the disclosure body.
- Do not reset workbench input or session state when the disclosure is toggled.

### Collapsible Active Drafts

Update `src/components/DraftHistoryList.tsx`.

- Convert only the Active Drafts group into an expanded-by-default native `<details>` disclosure.
- Keep the group label and active-draft count visible in its summary.
- Keep the existing cards, loaded indicator, empty-active state, deletion behavior, and horizontal scrolling unchanged inside the disclosure body.
- Leave the existing Completed Drafts disclosure behavior unchanged.

Native disclosure state is intentionally local and transient. No storage, shared UI state, or new abstraction is needed.

## Testing Strategy

The repository does not include a DOM interaction environment capable of exercising browser scroll geometry or native disclosure clicks. Do not add jsdom, React Testing Library, Playwright, or another dependency for this slice.

- Update existing static component tests to cover the expanded disclosure markup, compact summaries, counts/mode labels, and retained panel/card content.
- Retain Draft Room tests as regression coverage for recommendation output and workbench integration.
- Use focused manual QA for scroll position and disclosure interaction.
- Run the full automated suite because drafting and workbench changes share the main Draft Room workflow.

## Implementation Steps

1. Add the local full-list scroll anchor and post-mutation restoration in `AvailablePlayersTable`.
2. Convert Developer Workbench to an expanded-by-default native disclosure while preserving all controls and status content.
3. Convert Active Drafts to an expanded-by-default native disclosure while preserving cards, counts, empty state, and deletion behavior.
4. Update Developer Workbench and Draft History markup regression tests for the disclosure summaries and retained content.
5. Run focused component and Draft Room tests.
6. Run the full test suite, lint, and TypeScript validation.
7. Complete the focused manual QA below.
8. Stop after reporting results. Do not begin Phase 4 Task 12.

## Expected Files

- `src/components/AvailablePlayersTable.tsx`
- `src/components/DeveloperWorkbenchPanel.tsx`
- `src/components/DeveloperWorkbenchPanel.test.tsx`
- `src/components/DraftHistoryList.tsx`
- `src/components/DraftHistoryList.test.tsx`

No Draft Room, recommendation engine, action, persistence, scenario, dependency, or task-tracking changes are expected.

## Automated Validation

Run from the repository root:

```text
npm test -- src/components/DeveloperWorkbenchPanel.test.tsx src/components/DraftHistoryList.test.tsx src/components/DraftRoom.test.tsx
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused workbench, history, and Draft Room tests pass.
- Full Vitest suite passes.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- No dependency or lockfile changes are introduced.

## Focused Manual QA

1. Scroll the page and the Available Players table away from their starting positions, then draft a player who appears in Recommendations; confirm the same table area remains visible without a page jump.
2. Repeat with a player who is not in Recommendations; confirm the table's page position and internal scroll position remain stable.
3. Repeat one full-list draft in a transient scenario or transient manual session; confirm the same scroll behavior and correct local draft update.
4. Draft directly from Recommendations; confirm existing behavior remains correct and no forced scroll is introduced.
5. Minimize and expand Developer Workbench with pointer and keyboard; confirm the compact summary shows the current mode and all controls/state remain intact when reopened.
6. Leave Developer Workbench minimized, make a draft pick, and confirm it remains usable and its current status is correct when reopened.
7. Minimize and expand Active Drafts with pointer and keyboard; confirm its count remains visible and cards/deletion controls are unchanged when reopened.
8. Confirm Completed Drafts retains its existing disclosure behavior.
9. Confirm persisted picks, transient picks, undo, reset/restart, scenario import/export, replay target, draft history navigation, and deletion still behave as before.

## Acceptance Criteria

- Drafting a recommended player from the full Available Players list does not visibly jump the page away from the table context.
- The Available Players table retains its prior internal scroll position after the drafted row is removed, subject only to the browser's valid maximum scroll boundary.
- Recommendation content and ordering still refresh from the new draft state.
- Persisted and transient full-list drafting both receive the scroll correction.
- Drafting from Recommendations does not gain an unrelated forced-scroll behavior.
- Developer Workbench can be minimized and expanded, starts expanded, and retains all existing controls, status, inputs, and errors.
- Active Drafts can be minimized and expanded, starts expanded, and retains its count, cards, loaded state, empty state, and deletion behavior.
- Both disclosures are keyboard operable and expose native expanded/collapsed semantics.
- Completed Drafts behavior is unchanged.
- No draft, recommendation, persistence, scenario, or deletion semantics change.
- Focused tests, full suite, lint, TypeScript, and focused manual QA pass.
- No dependency or lockfile changes are introduced.
- Phase 4 Task 12 is not started.

## Failure Handling

- If exact scroll restoration is limited at the top or bottom document boundary, preserve the closest valid browser position; do not add artificial spacer content.
- If the table is no longer mounted after a successful action, skip restoration rather than querying or scrolling another surface.
- If native disclosure state is reset by ordinary Draft Room rerenders, stop and replace only that disclosure with small local boolean state; do not add global or persisted UI state.
- If manual QA shows the jump originates outside recommendation-height changes or full-list anchoring, stop and report the observed cause before adding global scroll handling.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this usability correction passes automated and manual validation, plan Phase 4 Task 12: Complete Phase 4 Regression and Exit Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. The three changes improve one continuous drafting workflow: maintaining place and reducing obstructive utility content.
- Executable by a lower-reasoning pass: yes. Component ownership, capture/restore sequence, disclosure behavior, tests, and validation are explicit.
- Avoids unnecessary architecture changes: yes. Scroll handling stays with the table, and native disclosures require no shared state.
- Blast radius reasonable: yes. Three production components and two existing tests are expected to change.
- Review/revert comfort: yes. The interaction corrections are isolated from domain, persistence, and scenario logic.
- Observable/testable acceptance criteria: yes. Scroll position, table position, expanded state, visible summaries, keyboard behavior, and retained workflows are directly observable.
