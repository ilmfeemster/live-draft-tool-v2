# Current Slice: Phase 5 QA Correction - Ranking Library Synchronization and Collapsible Panels

## Completion Status

Planned and awaiting implementation approval. Tier-semantics automated exit validation passed, and the user reports the remaining QA is good except for one Phase 5 workflow defect: a newly imported ranking set does not appear in New Draft Setup until the browser page is refreshed. The user also explicitly requested independent minimize controls for the `Managed Sets` and `Import Rankings` panels.

## Source Context

- Active Phase 5 task: `docs/tasks.md`, Task 20 - Complete Phase 5 Regression and Exit Validation.
- Tier patch tracking: `docs/patches/tier-semantics-tasks.md`, Slice 5.
- QA record: `docs/qa/manual-phase-5-qa.md`.
- Current ownership boundary:
  - `src/app/page.tsx` loads one server-side `rankingSummaries` value;
  - that value is passed independently to `RankingLibraryPanel` and `DraftRoom`;
  - `RankingLibraryPanel` owns a separate local `visibleSummaries` state for immediate library updates;
  - `DraftRoom` continues receiving the server-provided summary prop and passes it to `DraftSetupForm`;
  - after import, rename, reorder, player correction, delete, or manual library refresh, `refreshSummaries` updates only `RankingLibraryPanel` local state;
  - therefore sibling `DraftRoom` remains stale until a browser reload or another server navigation reruns `page.tsx`.
- Existing Next.js client navigation is already used in `DraftRoom`; no new state library or application service is required.
- Tier-patch automated exit gates passed: focused suites, 45-file full suite with 648 tests passed and 1 skipped, TypeScript, lint with one known warning, Prisma validation, migration status, and production build.
- Preserve the corrected readable canonical JSON workflow assertion in `src/lib/rankingManagementWorkflow.test.ts`.

## Goal

Make successful ranking-library summary changes visible in New Draft Setup immediately, without requiring a hard browser refresh or duplicate ranking state ownership, and let users independently minimize the two primary ranking-library panels without losing in-progress UI state.

## Scope

### Goals

- Trigger a Next.js server refresh after the ranking library successfully reloads authoritative summaries.
- Preserve the library's immediate local summary update and status/error behavior.
- Synchronize imports, renames, capability-changing edits, deletes, and manual Refresh because they already share `refreshSummaries`.
- Ensure `page.tsx` reruns and passes current summaries to both `RankingLibraryPanel` and `DraftRoom`.
- Verify a newly imported set appears when New Draft Setup is opened without a hard reload.
- Add independent minimize/expand controls for `Managed Sets` and `Import Rankings`.
- Preserve import form state, library operations, notices, diagnostics, and loaded ranking detail while either panel is minimized.
- Preserve the completed tier-semantics behavior and exit evidence.

### Non-Goals

- Do not add a global state library, React context, polling, subscriptions, cache framework, or new client wrapper.
- Do not move ranking persistence or listing into `DraftRoom` or `DraftSetupForm`.
- Do not reload the whole browser window.
- Do not change ranking import, validation, repository, snapshot, draft-creation, or recommendation behavior.
- Do not alter current draft snapshots when mutable ranking summaries change.
- Do not redesign ranking library or draft setup UI.
- Do not add per-ranking-set card collapse, drag-and-drop, persisted panel preferences, or animation infrastructure.
- Do not begin Phase 5.5 overall-tier recommendation work.

## Implementation Decisions

### Summary Synchronization

- `page.tsx` remains the authoritative cross-component summary loader.
- `RankingLibraryPanel.refreshSummaries` continues using `listRankingLibraryAction` for its immediate local UI result.
- After that list succeeds, call `router.refresh()` so the current route's Server Component payload is regenerated and sibling consumers receive the same authoritative summaries.
- Do not call `router.refresh()` when listing fails; preserve the last valid local and server snapshots with the existing error message.
- Put the route refresh inside the shared successful `refreshSummaries` branch rather than duplicating it after each mutation. This covers every current summary-changing path consistently.
- A Next router refresh preserves client component state while replacing updated server props, which is the desired behavior for the open draft and ranking library.

### Collapsible Panels

- `Managed Sets` and `Import Rankings` each own an independent boolean expanded state initialized to `true`.
- Each panel header gets a visible `Minimize` or `Expand` button with a panel-specific `aria-label`, `aria-expanded`, and `aria-controls` value.
- Keep the `Managed Sets` Refresh action visible and usable while its content is minimized.
- Hide panel content with the HTML `hidden` attribute rather than conditional unmounting. This preserves the import format, name, selected file input, and other local DOM state while minimized.
- Do not move operation notices, management errors, import diagnostics, warnings, or `RankingSetEditorPanel` inside either collapsible region. They remain visible and actionable.
- Minimize state is intentionally session-local and resets to expanded after a page reload.

## Implementation Steps

1. Synchronize server consumers after successful summary refresh.

   In `src/components/RankingLibraryPanel.tsx`:

   - import `useRouter` from `next/navigation`;
   - create the router once in `RankingLibraryPanel`;
   - in the successful branch of `refreshSummaries`, retain the existing local summary and error updates;
   - call `router.refresh()` after applying the successful local result;
   - keep the existing boolean result and failure path unchanged;
   - do not add route refresh calls to individual import, edit, delete, or button handlers.

2. Add independent accessible panel controls.

   In `src/components/RankingLibraryPanel.tsx`:

   - add separate expanded state for `Managed Sets` and `Import Rankings`, both initially `true`;
   - add a `Minimize`/`Expand` toggle to each panel header;
   - give each toggle a panel-specific accessible label, `aria-expanded`, and `aria-controls`;
   - give each content region a stable matching `id` and toggle its `hidden` attribute;
   - keep the Managed Sets `Refresh` button in the always-visible header action group;
   - preserve import form values and file selection when minimizing and reopening Import Rankings;
   - keep operation notices, errors, warnings, and loaded ranking detail outside both hidden regions;
   - do not add a reusable collapse abstraction for only two local panels.

3. Keep focused component coverage compatible with the router and panel controls.

   In `src/components/RankingLibraryPanel.test.tsx`:

   - mock `next/navigation` with a stable `useRouter` result that provides `refresh`;
   - assert both panel toggles render expanded by default with correct accessible names and content IDs;
   - assert the initial server-rendered view still contains managed-set content and import controls;
   - retain all existing library rendering, terminology, diagnostics, export filename, and delete-copy assertions;
   - do not add trivial implementation-detail assertions solely to check hook setter calls or `router.refresh`;
   - rely on focused manual QA for toggle interaction, state preservation, and observable sibling synchronization because the current component test environment is server-render-only and has no DOM interaction harness.

4. Run focused automated regression validation.

   Run:

   ```text
   npm test -- src/components/RankingLibraryPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Confirm:

   - ranking library still renders and compiles with the router dependency;
   - draft setup still renders all supplied summaries and validation states;
   - ranking import/management actions remain unchanged;
   - readable canonical export behavior remains green;
   - only the recorded unrelated `stripLocations` warning is accepted.

5. Run full project validation because this changes a shared top-level workflow.

   Run:

   ```text
   npm test
   npm run build
   ```

   Record exact file/test counts and any skipped tests.

6. Complete focused manual QA.

   Without manually reloading the browser page:

   - import a valid new ranking set and confirm it appears in the ranking library;
   - open New Draft Setup and confirm the new set appears immediately;
   - select it and confirm its name, player count, source kind, and capability warnings are current;
   - rename the set, reopen New Draft Setup, and confirm the new name appears;
   - make a supported player correction that changes summary capability state when applicable, reopen setup, and confirm warnings are current;
   - delete the set, reopen setup, and confirm it is absent;
   - confirm the active draft and any existing immutable snapshot remain unchanged throughout;
   - confirm a failed import does not refresh sibling consumers or introduce a phantom set.
   - minimize Managed Sets and confirm its cards hide while its header and Refresh action remain visible;
   - expand Managed Sets and confirm the same cards return;
   - enter an import name and choose a file, minimize Import Rankings, expand it, and confirm the in-progress form state remains intact;
   - confirm the two panels minimize independently;
   - confirm notices, import warnings/errors, and loaded ranking detail remain visible when either panel is minimized.

7. Finalize tracking only after the corrective QA passes.

   In `docs/qa/manual-phase-5-qa.md`:

   - record the stale-summary defect and the successful no-hard-refresh verification;
   - retain accurate evidence for the tier-semantics and broader Phase 5 checks;
   - do not claim any workflow that was not observed.

   In `docs/patches/tier-semantics-tasks.md`:

   - mark Slice 5 complete only if the user-confirmed remaining tier QA and this corrective workflow both pass;
   - record the final correction and validation results without recasting it as tier-scoring behavior.

   In `docs/tasks.md`:

   - add the corrective result under Task 20;
   - leave Task 20 unchecked unless its full separate checklist is confirmed complete.

   In this file:

   - update Completion Status with exact automated and manual results;
   - stop without beginning another slice.

## Expected Files

Production:

- `src/components/RankingLibraryPanel.tsx`

Focused test:

- `src/components/RankingLibraryPanel.test.tsx`

Tracking after successful validation:

- `docs/current-slice.md`
- `docs/qa/manual-phase-5-qa.md`
- `docs/patches/tier-semantics-tasks.md`
- `docs/tasks.md`

Do not touch:

- `src/app/page.tsx`, `DraftRoom`, or `DraftSetupForm` unless implementation proves `router.refresh()` does not replace their server props; stop and report before expanding;
- ranking actions, workflows, repositories, imports, snapshots, recommendations, Prisma, migrations, dependencies, or data files;
- roadmap, project, architecture, or tier-semantics design documents;
- Phase 5.5 implementation.

## Tests

Required focused validation:

```text
npm test -- src/components/RankingLibraryPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts
npx tsc --noEmit
npm run lint
```

Required full validation:

```text
npm test
npm run build
```

## Acceptance Criteria

- A successfully imported ranking set appears in New Draft Setup without a hard browser refresh.
- Successful rename, capability-changing edit, delete, and manual library refresh also synchronize draft-setup summaries.
- Failed listing or import leaves the last valid summaries visible and does not trigger a phantom setup option.
- Ranking library preserves its immediate local update, messages, errors, and warnings.
- Managed Sets and Import Rankings each have an independent accessible Minimize/Expand control.
- Both panels render expanded by default, and minimizing one does not minimize the other.
- Minimizing Managed Sets hides only its cards or empty state; its header and Refresh action remain visible.
- Minimizing Import Rankings preserves its format, name, selected file, and pending local form state when reopened.
- Operation notices, diagnostics, warnings, and loaded ranking detail remain visible regardless of panel state.
- The active draft and immutable ranking snapshot do not change when mutable library summaries refresh.
- `page.tsx` remains the authoritative cross-component summary source.
- No global store, polling, full browser reload, new persistence query in draft setup, or unrelated refactor is introduced.
- Focused tests, TypeScript, lint, full tests, and build pass with only explicitly recorded pre-existing warnings.
- Manual QA proves the original reproduction no longer requires a browser refresh.
- Tier-patch and Phase 5 tracking state remain accurate and do not overstate completion.

## Failure Handling

- If `router.refresh()` does not update the `DraftRoom` prop in manual QA, stop and report before introducing lifted state or a client wrapper.
- If router refresh resets active draft or transient workbench state, stop; preserving current client state is required.
- If summary listing fails after a successful mutation, keep the existing last-valid-state behavior and do not refresh server consumers.
- If hiding panel content clears the selected file or other form state, use retained DOM visibility semantics; do not add a second form-state model.
- If a test requires adding a DOM environment or dependency solely for this slice, stop and rely on the existing focused tests plus manual observable QA.
- If validation reveals an unrelated failure, report it rather than changing out-of-scope code.
- Preserve user work and stop on unsafe overlap.

## Follow-Up

After this correction passes, finish the pending tier-patch/Phase 5 QA tracking based on the actually completed checklist. Then plan only the remaining Phase 5 Task 20 work; do not begin Phase 5.5 automatically.

## Slice Review

- Smallest meaningful increment: yes. The explicit user-requested additions remain localized to the same ranking-library component pair as the synchronization correction.
- Executable by a lower-reasoning pass: yes. The exact hook, success branch, tests, manual reproduction, and stop condition are explicit.
- Avoids unnecessary architecture changes: yes. Server-loaded props remain authoritative; no new state layer is introduced.
- Blast radius reasonable: yes. Runtime and automated changes remain limited to one component pair.
- Review/revert comfort: yes. The change is localized to route revalidation after an already-successful refresh.
- Observable/testable acceptance criteria: yes. The original import/setup reproduction and related mutation cases are directly visible in manual QA.
