# Current Slice: Compact Draft History And Separate Completed Drafts

## Source Task

Task 11: Make Draft History Compact And Separate Completed Drafts.

## Goal

Keep draft history useful without letting it push the active draft workspace down the page.

This slice improves the draft room layout now that the app can create multiple persisted drafts. It keeps draft history available for resume, but changes it from a large stacked grid into a compact status-grouped surface.

## User-Visible Increment

- Active and in-progress drafts appear in a compact horizontal history row.
- Completed drafts appear in their own lower-priority completed section.
- The loaded draft remains visually obvious.
- The main draft room sits closer to the top of the page even when several drafts exist.

## Problem

Draft history currently renders as a growing grid above the draft room. That works for one or two drafts, but each additional draft pushes the draft board farther down the page. Completed drafts also compete with active drafts even though they are mostly reference/history after completion.

## Goals

- Group draft summaries by status:
  - active/in-progress group: `NOT_STARTED` and `IN_PROGRESS`
  - completed group: `COMPLETE`
- Render active/in-progress drafts as compact horizontally scrollable cards.
- Render completed drafts in a separate section below the active/in-progress row.
- Make the completed section visually lower priority and collapsible/minimized by default if practical within this page component.
- Preserve the existing `?draftId=<id>` resume links.
- Preserve summary information needed to distinguish drafts:
  - name
  - status
  - updated time
  - pick count
  - team count
  - round count
- Keep the currently loaded draft clearly marked.
- Keep the change local to the existing draft history UI.
- Update task tracking after implementation.

## Non-Goals

- Full draft management screen.
- New route for draft history.
- Search, filters, tags, or custom sort controls.
- Draft deletion.
- Draft renaming.
- Draft setup changes.
- Completed draft analytics.
- Mobile-first redesign beyond keeping the compact layout usable.
- New package dependencies.

## Expected Files

- `src/app/page.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing repository APIs, Prisma schema, route structure, draft creation behavior, draft mutations, recommendation logic, ranking seed data, or unrelated draft room UI unless implementation reveals a real blocker.

## UI Shape

Keep `DraftHistoryList` in `src/app/page.tsx` for this slice.

Recommended structure:

```tsx
const activeSummaries = summaries.filter(
  (summary) => summary.status !== "COMPLETE",
);
const completedSummaries = summaries.filter(
  (summary) => summary.status === "COMPLETE",
);
```

Render:

- One compact `Draft History` section.
- An active/in-progress row with horizontal overflow:
  - `overflow-x-auto`
  - cards with stable width such as `min-w-64` or similar
  - compact text and metrics
- A separate completed section only when completed summaries exist:
  - use `<details>`/`<summary>` or another simple built-in disclosure
  - default collapsed unless the currently loaded draft is completed
  - render completed draft cards in a compact row or compact grid inside the disclosure

Use existing anchors for resume links:

```tsx
href={`/?draftId=${encodeURIComponent(summary.id)}`}
```

## Implementation Steps

1. Split summaries by status in `DraftHistoryList`.
   - Add `activeSummaries`.
   - Add `completedSummaries`.
   - Treat `NOT_STARTED` as active/in-progress for this UI.

2. Replace the large stacked grid for active/in-progress drafts.
   - Render active/in-progress summaries in a horizontal scroll container.
   - Keep cards compact enough that several can be scanned in one row.
   - Keep the loaded draft highlighted with `aria-current="page"` and the existing loaded badge or equivalent.
   - Preserve name, status, updated time, picks, teams, and rounds.

3. Add a completed drafts section.
   - Render only when `completedSummaries.length > 0`.
   - Use a native `<details>` disclosure or another simple local approach.
   - Default it open only when the active loaded draft is completed.
   - Label it clearly as completed drafts/history.
   - Use compact cards and the same resume link behavior.

4. Preserve empty-state behavior.
   - Keep an empty state for when no summaries are listed before the workspace loads.
   - If all drafts are completed, the active/in-progress row should not look broken; show a short active-row empty message and rely on the completed section.

5. Avoid unrelated behavior changes.
   - Do not change `DraftRoom`.
   - Do not change server actions.
   - Do not change repository summary ordering.
   - Do not add deletion or renaming controls.

6. Update task tracking.
   - In `docs/tasks.md`, mark Task 11 complete only if all acceptance criteria are satisfied.
   - Check `Keep completed drafts separate from the active draft workflow` in the Phase 2 validation checklist if validated.
   - Do not mark unrelated Phase 2 validation items complete.

7. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Run `npm test` if implementation adds or changes behavior covered by tests, or to confirm the broader suite remains green.
   - Manually inspect the page in the browser if a dev server is already available or can be started locally.

## Acceptance Criteria

- A growing draft history no longer renders as a tall stacked grid above the draft room.
- Active and in-progress drafts are easy to reopen from a compact horizontal history row.
- Completed drafts are displayed separately from active/in-progress drafts.
- Completed drafts are visually lower priority and can be minimized/collapsed.
- The currently loaded draft remains obvious.
- Resume links still load the selected persisted draft through `?draftId=<id>`.
- Summary cards still show enough information to distinguish drafts.
- Existing new draft, resume, draft, undo, reset, available-player, roster, and recommendation behavior still works.
- `npm run lint` passes.
- `npm run build` passes or any environment-specific blocker is reported clearly.

## Manual Test Notes

Recommended manual checks after implementation:

- Load the app with several draft history entries and confirm the draft room is no longer pushed far down the page.
- Confirm `NOT_STARTED` and `IN_PROGRESS` drafts appear in the active/in-progress row.
- Confirm `COMPLETE` drafts appear in the completed section instead of the active row.
- Confirm the completed section is collapsed/minimized by default when the loaded draft is not complete.
- Load a completed draft and confirm the completed section opens or clearly exposes the loaded draft.
- Click a draft history item and confirm the URL changes to `/?draftId=<id>` and the selected draft loads.
- Confirm `Start New Draft`, draft pick, undo, and reset still work from the selected draft.

## Slice Review

- Smallest meaningful increment: yes, it only reorganizes the existing draft history UI.
- Concrete enough for implementation: yes, grouping rules, UI structure, files, and validation are specified.
- Avoids unnecessary architecture changes: yes, it keeps the UI in `src/app/page.tsx` and does not add routes or management abstractions.
- Blast radius reasonable: yes, expected changes are limited to the page component and task tracking.
- Review/revert comfort: yes, the slice can be reverted without schema, repository, action, or draft engine changes.
- Observable/testable acceptance criteria: yes, grouping, compact layout, loaded state, and resume links are visible in the app and build/lint can verify code health.
