# Current Slice: Fix Layout Shift When Recommendations Panel Updates

## Source Context

This is a UX improvement to Phase 4 Task 11 (Developer Workbench Integration).

When a user makes a draft pick, the RecommendationsPanel updates with new recommendations. The panel's height changes based on the number of recommendations rendered, causing the entire left-column layout to reflow and shift upward. This creates a janky, disorienting UX.

## Root Cause

The `RecommendationsPanel` is rendered in a flex column (the left panel of the Draft Room) without a fixed or reserved height. When recommendations update, the panel's content height changes, causing the entire flex container to reflow and push other elements up the page.

## Goal

Eliminate the layout shift by constraining the RecommendationsPanel height so that updates do not cause visible reflow of the page or adjacent elements.

## Scope

### Goals

- Prevent upward layout shift when recommendations update during pick selection.
- Preserve the existing recommendations display and user-pick highlight styling.
- Ensure the panel remains functional and scrollable if recommendations overflow.
- Maintain the existing manual QA and draft workflow behavior.

### Non-Goals

- Changing recommendations content, scoring, or filtering.
- Adding new recommendation features or controls.
- Redesigning the RecommendationsPanel layout or styling beyond height constraints.
- Changing Draft Room layout structure or other panels.
- Modifying draft state, persistence, or deletion behavior.
- Altering available-players or user-roster behavior.
- Adding package dependencies.

## Implementation Design

Update `src/components/RecommendationsPanel.tsx` to add height constraints.

### Approach

1. Wrap the recommendations list in a container with a fixed max-height.
2. Add `overflow-y: auto` for scrolling if recommendations exceed the space.
3. Calculate or choose a sensible max-height that accommodates typical recommendation sets (3-5 players visible without scrolling on most screens).
4. Preserve the heading, description, and "No recommendations" state outside the scrollable container.

### Expected Styling Changes

- Add a fixed max-height to the recommendations list container (e.g., `max-h-72` or similar Tailwind class).
- Add `overflow-y-auto` for scrolling overflow.
- Preserve all existing text, padding, border, and background styling.

## Testing Strategy

- Keep `src/components/RecommendationsPanel.test.tsx` markup coverage as-is (no new tests required; styling is not covered by markup tests).
- Visual inspection during manual QA to verify no layout shift on pick selection.
- Verify scrolling works if recommendations exceed the allocated space.
- Run the complete automated suite to ensure no regression in draft state, recommendations calculation, or other features.

## Implementation Steps

1. Update `src/components/RecommendationsPanel.tsx` to wrap the recommendations list in a constrained container.
2. Choose and apply an appropriate max-height constraint (e.g., `max-h-72` in Tailwind, or equivalent CSS).
3. Add overflow scrolling for cases where recommendations exceed the space.
4. Run focused tests for RecommendationsPanel and DraftRoom.
5. Run the full test suite, lint, and TypeScript validation.
6. Complete focused manual QA to verify the layout shift is eliminated.

## Expected Files

- `src/components/RecommendationsPanel.tsx`

No Draft Room, page, domain, persistence, scenario, state, or dependency changes expected.

## Automated Validation

Run from the repository root:

```text
npm test -- src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- RecommendationsPanel and DraftRoom tests pass.
- Full Vitest suite passes.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- No dependency or lockfile changes are introduced.

## Focused Manual QA

1. Load a draft in progress with available picks.
2. Make a draft pick and observe the RecommendationsPanel update.
3. Verify that no visible upward layout shift occurs; the page should remain stable.
4. Make additional picks and verify stability with each update.
5. If recommendations exceed the allocated space, verify that scrolling is available and works smoothly.
6. Verify that the recommendations still display correctly with proper styling, numbering, player info, and reason tags.
7. Verify that the user can still click recommendations to draft players.
8. Confirm the existing manual draft, undo, reset, scenario, and developer workbench workflows continue to work.

## Acceptance Criteria

- Picking a player does not cause visible upward layout shift of the page or adjacent elements.
- The RecommendationsPanel updates correctly with new recommendations.
- The panel remains visually stable even as recommendations change.
- Recommendations remain interactive and can be drafted.
- Scrolling works smoothly if recommendations overflow the allocated space.
- No regression in draft state, recommendations calculation, or other features.
- All existing manual and automated tests pass.
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
