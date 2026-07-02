# Current Slice: Default-Collapsed Workspace Panels

## Goal

Reduce initial page height and visual noise by rendering Developer Workbench, Draft History, Active Drafts, Managed Sets, and Import Rankings minimized by default while preserving each section's existing content and independent expand behavior.

## Scope

### Goals

- Render Developer Workbench minimized on initial load.
- Make the Draft History section collapsible and minimized on initial load.
- Render the nested Active Drafts group minimized when Draft History is expanded.
- Render Managed Sets and Import Rankings minimized on initial load.
- Keep all five sections independently expandable.
- Preserve mounted controls, form state, draft cards, notices, and existing behavior while sections are minimized.
- Preserve the ranking-library grid fix that lets each card shrink to its own content height.

### Non-Goals

- Do not persist expanded or minimized preferences across reloads.
- Do not add animation, a global accordion controller, a shared collapse abstraction, or a state library.
- Do not make Completed Drafts default-collapsed behavior part of this change; preserve its existing active-draft behavior.
- Do not change draft loading, deletion, scenario, ranking import, ranking management, synchronization, or recommendation behavior.
- Do not redesign panel styling or reorder page sections.

## Implementation Decisions

- Continue using native `<details>` and `<summary>` for Developer Workbench and draft-history sections so their content remains mounted and browser-managed disclosure behavior stays intact.
- Remove the initial `open` state from Developer Workbench and Active Drafts.
- Convert the Draft History section header into an accessible native disclosure summary and place the existing history body inside it.
- Keep the Draft History count visible in its collapsed summary.
- Preserve the existing nested Active Drafts and Completed Drafts disclosures inside Draft History.
- Initialize the existing Managed Sets and Import Rankings expanded-state booleans to `false`; retain their current buttons, ARIA attributes, stable content IDs, and `hidden` behavior.
- Keep every disclosure independent and session-local. Expanding one section must not expand or minimize another.

## Implementation Steps

1. Default Developer Workbench to minimized.

   In `src/components/DeveloperWorkbenchPanel.tsx`:

   - remove the `open` attribute from its existing `<details>` element;
   - retain the current summary, Expand/Minimize indicator, content, handlers, and pending-state behavior.

   In `src/components/DeveloperWorkbenchPanel.test.tsx`:

   - update the initial-render assertion to require a closed `<details>` element;
   - retain coverage for the summary, disclosure labels, status, controls, and errors.

2. Make Draft History and Active Drafts minimized by default.

   In `src/components/DraftHistoryList.tsx`:

   - convert the top-level Draft History container into a native `<details>` disclosure without `open`;
   - use the existing Draft History title, description, and active/completed count in its always-visible `<summary>`;
   - add the same visible Expand/Minimize indicator pattern used by the other native disclosures;
   - keep the existing empty state and active/completed groups inside the Draft History body;
   - remove `open` from the Active Drafts `<details>` element;
   - preserve Completed Drafts' current `open={isActiveDraftComplete}` behavior and all navigation/deletion logic.

   In `src/components/DraftHistoryList.test.tsx`:

   - assert Draft History and Active Drafts render as closed native disclosures initially;
   - retain assertions for counts, draft cards, loaded state, delete controls, and the empty-history state;
   - ensure the disclosure labels remain present.

3. Default both ranking-library panels to minimized.

   In `src/components/RankingLibraryPanel.tsx`:

   - initialize `isManagedSetsExpanded` and `isImportRankingsExpanded` to `false`;
   - retain the independent toggle handlers, accessible labels, `aria-expanded`, `aria-controls`, stable content IDs, and mounted hidden regions;
   - retain `items-start` on the two-column grid so either minimized card shrinks independently;
   - keep Managed Sets Refresh visible and keep notices, diagnostics, warnings, and loaded ranking detail outside the hidden regions.

   In `src/components/RankingLibraryPanel.test.tsx`:

   - update initial-render assertions to expect `aria-expanded="false"` and panel-specific Expand labels;
   - retain coverage that both content regions and their controls remain rendered in the markup;
   - retain existing ranking-library, import-format, diagnostics, export, and delete-copy coverage.

4. Run focused automated validation.

   Run:

   ```text
   npm test -- src/components/DeveloperWorkbenchPanel.test.tsx src/components/DraftHistoryList.test.tsx src/components/RankingLibraryPanel.test.tsx
   npx tsc --noEmit
   npm run lint
   ```

   Accept only the already-recorded unrelated `stripLocations` lint warning if it remains unchanged.

5. Run focused manual QA.

   On a fresh page load, confirm:

   - Developer Workbench, Draft History, Managed Sets, and Import Rankings show only their collapsed summaries or headers;
   - expanding Draft History reveals Active Drafts still minimized by default;
   - each of the five sections expands and minimizes independently;
   - each minimized container visibly shrinks to its header height;
   - expanding sections restores their existing controls and content;
   - a selected ranking import file and entered import name survive minimizing and reopening Import Rankings during the same mounted session;
   - ranking notices, diagnostics, warnings, loaded ranking detail, and Managed Sets Refresh retain their existing visibility rules;
   - draft navigation, deletion, scenario controls, and ranking synchronization still work as before.

6. Record completion in this file only after validation passes, then stop.

## Expected Files

Production:

- `src/components/DeveloperWorkbenchPanel.tsx`
- `src/components/DraftHistoryList.tsx`
- `src/components/RankingLibraryPanel.tsx`

Focused tests:

- `src/components/DeveloperWorkbenchPanel.test.tsx`
- `src/components/DraftHistoryList.test.tsx`
- `src/components/RankingLibraryPanel.test.tsx`

Planning and completion record:

- `docs/current-slice.md`

Do not touch page loading, actions, repositories, workflows, Prisma, migrations, recommendation code, dependencies, or roadmap documents.

## Acceptance Criteria

- Developer Workbench is minimized by default and expands with all existing content intact.
- Draft History is minimized by default and retains its description and active/completed count in the disclosure header.
- Active Drafts is minimized by default when Draft History is opened.
- Managed Sets and Import Rankings are minimized by default.
- Each of the five disclosures expands and minimizes independently.
- Every minimized container visibly shrinks to its header rather than retaining a sibling's expanded height.
- Existing form values and selected files remain intact when Import Rankings is minimized and reopened during the mounted session.
- Managed Sets Refresh, ranking notices, diagnostics, warnings, and loaded detail preserve their existing visibility and behavior.
- Completed Drafts preserves its existing automatic-open behavior when the loaded draft is complete.
- No disclosure preference is persisted across reloads.
- No draft, scenario, ranking, snapshot, or recommendation behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.
- Manual QA confirms the five initial collapsed states and independent controls.

## Failure Handling

- If wrapping Draft History in native `<details>` disrupts nested disclosure behavior or keyboard access, stop and report before introducing custom state management.
- If minimizing a ranking panel clears import form or file-input state, retain the mounted `hidden` approach and do not create a second form-state model.
- If a panel still stretches while minimized, correct only its immediate layout alignment; do not redesign the surrounding page.
- If validation exposes an unrelated failure, report it rather than changing out-of-scope code.

## Follow-Up

After this slice passes, return to the remaining Phase 5 regression and exit tracking. Do not begin Phase 5.5 automatically.

## Slice Review

- Smallest meaningful increment: yes. All changes express one consistent default-collapsed workspace behavior explicitly requested for the five named sections.
- Executable by a lower-reasoning pass: yes. Each owning component, initial-state change, preserved behavior, and test update is named.
- Avoids unnecessary architecture changes: yes. It reuses native disclosures and existing local state.
- Blast radius reasonable: yes. Runtime changes are limited to three existing UI components, with their three focused tests.
- Review/revert comfort: yes. The changes are local initial-state and disclosure-markup edits without data-flow changes.
- Observable/testable acceptance criteria: yes. Initial disclosure state, independent expansion, retained content, and visible shrink behavior are directly verifiable.
