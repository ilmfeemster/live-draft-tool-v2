# Current Slice: Fix Draft Deletion and Refine Scenario File Controls

## Source Context

This is a user-requested Task 11 correction before Phase 4 exit validation.

The initial Developer Workbench implementation and automated validation are complete, and the user has accepted the prior manual QA as complete. Two usability gaps remain:

1. Deleting a persisted draft succeeds, but the history UI can remain stale until the user refreshes or selects another draft because `DraftHistoryList` renders server-provided summaries and depends only on router refresh.
2. The curated scenario selector exposes synthetic regression fixtures that are not useful as realistic human workflows. The workbench should instead emphasize explicit import of the user's saved exported JSON files and allow the active scenario replay target to be changed.

Browsers cannot silently enumerate the user's Downloads folder or maintain a trusted list of arbitrary local exports without adding app-managed storage or a persistent File System Access permission model. This slice therefore uses an explicit file picker labeled for saved exports. It does not create a scenario database or browser file registry.

## Goal

Make draft deletion update immediately and replace the curated workbench selector with a saved-export file workflow that supports selecting and applying any valid replay target contained in the imported scenario history.

## Scope

### Goals

- Remove the curated scenario selector from the Developer Workbench UI.
- Keep curated JSON fixtures and catalog code as automated regression infrastructure.
- Rename/reframe scenario controls around importing previously exported JSON files.
- Explain that imported files remain transient and must be exported again to preserve changes.
- Display the imported scenario's available replay-target range.
- Allow a developer to enter and apply a target from zero through pick-history length.
- Revalidate and replay the scenario when applying a new target.
- Treat target changes as destructive replacement when the transient session is dirty.
- Preserve imported file source labeling after a target change.
- Keep reset using the newly selected target.
- Optimistically remove a successfully deleted draft from history state.
- Navigate automatically to a remaining draft when the currently loaded draft is deleted.
- Keep server refresh as reconciliation rather than the sole visible update mechanism.
- Preserve existing delete confirmation and failure behavior.
- Mark Phase 4 Task 11 complete only after this correction passes validation.

### Non-Goals

- Deleting curated scenario JSON files or their automated regression tests.
- Showing synthetic curated fixtures in the human-facing workbench.
- Automatically scanning Downloads, Documents, or another local folder.
- Persisting imported scenarios, file handles, recent-file lists, or scenario metadata.
- A scenario library database, browser storage, cloud storage, or user collections.
- Editing scenario settings, rankings, teams, pick history, or metadata in the UI.
- Extending pick history beyond what the imported JSON already contains.
- Step-forward/back playback, animation, or timeline controls.
- Changing scenario validation, replay, scoring, or persistence semantics.
- Broad Draft History or Draft Room redesign.
- Adding a package dependency.
- Beginning Phase 4 Task 12.

## Draft Deletion Fix

Update `src/components/DraftHistoryList.tsx`.

### Local Summary State

- Add `visibleSummaries` state initialized from the `summaries` prop.
- Add a narrow `useEffect` that replaces `visibleSummaries` when the server prop changes after navigation or refresh.
- Derive active/completed groups, counts, cards, and empty states from `visibleSummaries`, not directly from `summaries`.

### Successful Inactive Draft Deletion

After `deleteDraftAction(summary.id)` returns `true`:

1. Compute remaining summaries by filtering the deleted ID.
2. Set `visibleSummaries` immediately to that result.
3. Keep the currently loaded DraftRoom unchanged.
4. Call `router.refresh()` to reconcile server-rendered data.

The deleted card and counts must update without manual refresh or selection.

### Successful Active Draft Deletion

After optimistic removal:

1. Choose the next remaining summary deterministically from the existing display order:
   - First remaining non-complete draft.
   - Otherwise first remaining completed draft.
2. If a summary remains, call:

```ts
router.replace(`/?draftId=${encodeURIComponent(nextSummary.id)}`);
```

3. If none remain, call `router.replace("/")` and allow the existing loader/default-creation behavior to establish a workspace.
4. Call `router.refresh()` after replacement to reconcile the page.

Do not keep rendering the deleted draft as loaded while waiting for the user to act.

### Failure

- If the action returns `false` or throws, leave `visibleSummaries` unchanged.
- Retain existing logging and deletion pending state.
- Do not optimistically remove before server success.
- Preserve the native irreversible-delete confirmation text.

## Saved Scenario File Workflow

Update `src/components/DeveloperWorkbenchPanel.tsx`.

### Remove Curated Selection

- Remove the curated `<select>`, curated labels, curated ID props, and selection callback.
- Do not import `curatedScenarios` in the panel.
- Keep curated infrastructure in the repository for automated engine regressions only.

### Scenario Files Section

Render a section labeled `Scenario Files` with concise guidance:

```text
Open a previously exported Scenario V1 JSON file. Local files are not stored by the app.
```

- Keep the JSON file input accepting `.json,application/json`.
- Label the input `Open saved scenario`.
- Continue clearing its value after handing off the selected file.
- Keep `Export Scenario` available for persisted and transient states.
- Explain that exporting the active state is how a scenario is saved for later reuse.

Do not imply that the app can list or remember files that the user saved elsewhere.

## Replay Target Control

The replay target is editable only for an active `mode: "scenario"` session.

Extend the controlled panel contract with values equivalent to:

```ts
replayTargetInput: string;
replayTargetMax: number | null;
canApplyReplayTarget: boolean;
onReplayTargetInputChange: (value: string) => void;
onApplyReplayTarget: () => void;
```

Render:

- Numeric input labeled `Replay target`.
- `min="0"`, `step="1"`, and `max={replayTargetMax}` when a scenario is active.
- Helper text `0 through <max> applied picks`.
- `Apply Target` button.
- Disabled input/button for persisted and transient-manual modes.
- Existing status continues to show the currently applied target separately from the editable input.

Do not update replay on every keystroke. The explicit button avoids replaying incomplete numeric input.

## DraftRoom Scenario Changes

Update `src/components/DraftRoom.tsx`.

### Remove Curated UI State

- Remove curated catalog/ID imports.
- Remove curated selection handler.
- Remove `curated` from `TransientSource`.
- Keep only:

```ts
{ kind: "imported"; fileName: string }
{ kind: "restart" }
```

- Continue importing saved files through `createTransientScenarioSession`.

### Replay Target Input State

Add:

```ts
replayTargetInput: string
```

- Set it to the normalized scenario target after successful file import.
- Set it to an empty string after restart into transient-manual mode.
- Preserve it when an attempted apply fails.
- Reset it to the successful target after applying or resetting a scenario.

### Apply Replay Target

When `Apply Target` is invoked:

1. Require an active `kind: "scenario"` session.
2. Parse `replayTargetInput` as a number.
3. Require an integer from `0` through `transientSession.scenario.pickHistory.length`.
4. On invalid input, keep current state and show:

```text
Replay target must be an integer from 0 through <max>.
```

5. If the session is dirty, use the existing replacement confirmation policy and native confirmation before discarding exploration.
6. Create a fresh typed scenario value by copying the normalized scenario and replacing only:

```ts
replayTarget: { appliedPickCount: target }
```

7. Serialize it with `serializeScenarioV1`.
8. Call `createTransientScenarioSession` with the new JSON so validation and full-history replay remain authoritative.
9. On failure, keep the current session and show its structured errors.
10. On success:
    - Install the clean scenario session.
    - Preserve the imported filename source label.
    - Set `replayTargetInput` to the applied target.
    - Clear workbench errors.

The imported history is not truncated. Reset after this operation must return to the newly selected target because the new serialized source becomes the session's reset authority.

### Import and Reset Coordination

- Successful import sets the target input from the file's declared target.
- Failed import does not replace the session or target input.
- Successful reset sets the input from the freshly reconstructed scenario target.
- Restart clears the input and disables target controls.

## Testing Strategy

The project still has no DOM interaction test dependency. Use static component tests plus pure session/replay coverage and focused manual QA.

### Workbench Panel Tests

Update `src/components/DeveloperWorkbenchPanel.test.tsx` to assert:

- No curated scenario `<select>` or curated labels render.
- `Scenario Files`, `Open saved scenario`, local-not-stored guidance, file acceptance, and export action render.
- Active scenario target input has exact min/max/step/value attributes.
- `Apply Target` is enabled only when allowed.
- Persisted/transient-manual modes disable target editing and applying.
- Current applied target remains visible in status separately from the input.
- Existing error/live-region and pending behavior remains.

### DraftRoom Tests

Update `src/components/DraftRoom.test.tsx` to assert the initial persisted render:

- Shows the Scenario Files workflow.
- Does not show curated scenario labels/select controls.
- Has disabled replay-target controls.
- Preserves existing persisted recommendation, debugger, and workbench status assertions.

### Draft History Coverage

Add `src/components/DraftHistoryList.test.tsx` using the existing static render strategy for grouping/count/empty/card regression coverage.

Because static rendering cannot invoke deletion, cover the actual optimistic removal and active navigation in focused manual QA. Do not add React Testing Library or jsdom solely for this slice.

Existing action/repository tests remain the authority for successful and failed deletion semantics.

## Implementation Steps

1. Update `src/components/DraftHistoryList.tsx` with prop-synchronized local summaries, post-success optimistic removal, and deterministic active-draft replacement navigation.
2. Add `src/components/DraftHistoryList.test.tsx` for history grouping/count/card/empty markup regression.
3. Update `src/components/DeveloperWorkbenchPanel.tsx` to remove curated selection and add the saved-file guidance plus controlled replay-target input/apply controls.
4. Update `src/components/DeveloperWorkbenchPanel.test.tsx` for saved-file and replay-target states.
5. Update `src/components/DraftRoom.tsx` to remove curated UI integration and add import/reset target coordination and explicit target application through serialization/session recreation.
6. Update `src/components/DraftRoom.test.tsx` for the revised persisted workbench render.
7. Run focused deletion, workbench, DraftRoom, scenario-session, portability, replay, action, and repository tests, then the full suite, lint, and TypeScript validation.
8. Complete the focused manual QA below.
9. If all acceptance criteria pass, mark Phase 4 Task 11 complete in `docs/tasks.md`. Do not begin Task 12.

## Expected Files

- `src/components/DraftHistoryList.tsx`
- `src/components/DraftHistoryList.test.tsx`
- `src/components/DeveloperWorkbenchPanel.tsx`
- `src/components/DeveloperWorkbenchPanel.test.tsx`
- `src/components/DraftRoom.tsx`
- `src/components/DraftRoom.test.tsx`
- `docs/tasks.md` only to mark Task 11 complete after validation

The seven-file count is accepted because the user explicitly requested one persisted-history correction and two tightly related scenario-workbench corrections. Do not add new domain modules, storage, dependencies, or routes.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/components/DraftHistoryList.test.tsx src/components/DeveloperWorkbenchPanel.test.tsx src/components/DraftRoom.test.tsx src/lib/scenarioSession.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioReplay.test.ts src/app/actions/draftActions.test.ts src/lib/draftRepository.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused deletion, workbench, scenario, action, and repository tests pass.
- Full Vitest suite passes.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- No dependency or lockfile change is introduced.

## Focused Manual QA

The user considers the previous Task 11 checklist complete. Only these correction cases need new manual evidence:

1. Delete an inactive draft; confirm its card and history counts update immediately without refresh or selection.
2. Delete the loaded draft when another draft remains; confirm the card disappears and the remaining draft loads automatically.
3. Delete the only remaining draft; confirm the app automatically establishes its normal fallback/default workspace.
4. Cancel deletion; confirm no card/count/navigation changes.
5. Confirm the workbench no longer shows curated scenario controls or synthetic fixture names.
6. Confirm Scenario Files explains explicit saved-export selection and does not claim to list local files.
7. Import a previously exported realistic scenario; confirm its declared target loads and the target input shows that count and history maximum.
8. Apply target `0`; confirm the same scenario opens before all picks, clean.
9. Apply an intermediate and maximum target; confirm exact state/recommendations and reset returns to the newly applied target.
10. Enter negative, fractional, blank, and history-exceeding targets; confirm useful error and unchanged state.
11. Make a local exploratory pick, apply another target, reject confirmation, and confirm unchanged state; approve and confirm clean replacement.
12. Restart configuration; confirm target controls clear/disable and other transient behavior remains.
13. Export the adjusted target state and re-import it; confirm the exported active applied state reproduces.

## Acceptance Criteria

- Successful deletion immediately removes the card and updates history counts.
- Deleting the active draft automatically selects a deterministic remaining draft or existing fallback with no manual refresh.
- Failed/cancelled deletion leaves visible history and navigation unchanged.
- Curated scenario controls and synthetic curated names are absent from the human-facing workbench.
- Curated fixtures remain available to automated regression tests.
- Workbench clearly supports opening explicitly selected saved export JSON files.
- The UI does not claim or attempt to enumerate arbitrary local files.
- Active imported scenarios expose target range `0..pickHistory.length` and an explicit apply action.
- Valid target changes revalidate/replay full history, establish a clean new baseline, and become reset authority.
- Invalid target or failed replay leaves active state unchanged with concise errors.
- Dirty target replacement requires confirmation; clean replacement does not.
- Import, reset, restart, export, local picks/undo, and recommendation debugger remain functional.
- Existing persisted actions and scenario/domain boundaries remain unchanged.
- Focused tests, full suite, lint, TypeScript, and focused manual QA pass.
- Task 11 is checked complete only after validation.
- Task 12 is not started.

## Failure Handling

- If router replacement still leaves the loaded deleted draft visible, use a narrow automatic hard navigation only as a last resort and document why client navigation could not reconcile; do not require manual refresh.
- If deletion fails, do not remove local history state.
- If local file enumeration is requested, report the browser security/storage boundary rather than inventing access.
- If target parsing or replay fails, retain the current session and imported source label.
- If changing target would discard dirty work and confirmation is declined, do nothing.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this correction is implemented and Task 11 is complete, plan Phase 4 Task 12: Complete Cross-Feature Regression and Phase 4 Exit Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes within the explicit request. It fixes the reported stale deletion and makes the scenario UI usable with realistic exported files and controllable targets.
- Concrete enough for implementation: yes. State ownership, navigation choice, browser file constraint, target bounds, replay flow, confirmation, tests, and manual cases are explicit.
- Avoids unnecessary architecture changes: yes. It reuses current router, file picker, serializer, validator, replay, and session boundaries without new storage.
- Blast radius reasonable: accepted at six code/test files plus completion tracking because the user explicitly grouped the history and workbench corrections.
- Review/revert comfort: yes. Changes remain isolated to Draft History and existing workbench integration.
- Observable/testable acceptance criteria: yes. Immediate card/count updates, automatic active replacement, saved-file labels, target states, errors, and confirmation behavior are directly observable.
