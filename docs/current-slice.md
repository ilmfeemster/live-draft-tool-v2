# Current Slice: Integrate the Developer Workbench Controls

## Source Context

Phase 4 Task 11: Integrate the Developer Workbench Controls.

Tasks 1 through 10 are complete. The application now has pure boundaries for scenario validation, replay, portability, curated loading, recommendation diagnostics, transient local transitions, reset, restart, dirty tracking, and confirmation policy. This slice connects those capabilities to the existing DraftRoom without changing persisted repository semantics.

The workbench is developer-facing and compact. It should make scenarios reachable in seconds while keeping the normal persisted draft workflow available when no transient session is active.

## Goal

Add one focused workbench panel and wire DraftRoom to select/import/export scenarios, run transient local actions, show source/target/dirty state, reset or restart safely, surface concise errors, and preserve all existing persisted behavior.

## Scope

### Goals

- Add a compact developer workbench panel above the existing DraftRoom grid.
- Select and immediately replay either curated scenario.
- Import a local UTF-8 Scenario V1 JSON file and immediately replay it.
- Keep the active persisted/transient state unchanged when import or replay fails.
- Export manual persisted, transient scenario, and restarted transient-manual states as JSON downloads.
- Display active mode, scenario name, source, replay target, current applied-pick count, and dirty state.
- Route transient picks and undo through the Task 10 pure session functions.
- Keep persisted picks, undo, and reset on existing server actions.
- Reset an active scenario to its declared target through fresh validation/replay.
- Restart an active transient session as a zero-pick transient manual session.
- Apply dirty-only confirmation policy to transient reset, restart, replacement, and leaving for new-draft setup.
- Preserve the existing persisted reset and in-progress new-draft confirmations.
- Keep recommendation diagnostics available in the same screen.
- Add proportional static-render and focused manual QA coverage.

### Non-Goals

- Step playback, timelines, animation, pause, or event streaming.
- Scenario editing, metadata editing, user collections, cloud storage, or autosave.
- Persisting imported/restarted sessions or creating scenario database tables.
- Uploading files to a server.
- Ranking import/editing or Phase 5 functionality.
- Global navigation/before-unload warnings or crash recovery.
- Provider controls or Phase 7 architecture.
- Mobile-first polish, consumer onboarding, or broad Draft Room redesign.
- Adding a DOM/browser testing dependency or package dependency.
- Beginning Phase 4 Task 12.

## Component Boundary

Add `src/components/DeveloperWorkbenchPanel.tsx` as a controlled client component.

Use a narrow prop contract equivalent to:

```ts
type WorkbenchMode = "persisted" | "scenario" | "transient-manual";

type WorkbenchStatus = {
  mode: WorkbenchMode;
  name: string;
  source: string;
  replayTarget: number | null;
  appliedPickCount: number;
  isDirty: boolean;
};

type DeveloperWorkbenchPanelProps = {
  status: WorkbenchStatus;
  selectedCuratedScenarioId: CuratedScenarioId | "";
  errors: string[];
  isPending: boolean;
  canResetScenario: boolean;
  canRestartTransient: boolean;
  onSelectCuratedScenario: (id: CuratedScenarioId) => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onResetScenario: () => void;
  onRestartTransient: () => void;
};
```

The exact prop names may vary narrowly. Keep session mutation and browser side effects in DraftRoom callbacks; the panel owns only markup and extracting the selected ID/file from input events.

## Workbench Presentation

Render a compact bordered section titled `Developer Workbench` with a short statement that scenario sessions are transient until exported.

### Curated Selection

- Render a labeled `<select>` with placeholder `Select a curated scenario`.
- Include both stable curated IDs with human-readable labels:
  - Early Non-Default Pressure.
  - Completed Draft.
- Keep it controlled by `selectedCuratedScenarioId`.
- Selecting an option calls `onSelectCuratedScenario` once.
- Disable it while a server/browser operation is pending.

### File Controls

- Render a labeled file input accepting `.json,application/json`.
- Pass only the first selected `File` to `onImportFile`.
- Clear the input value after handing off so selecting the same file again works.
- Render an `Export Scenario` button available for persisted and transient modes.
- Do not add upload/server language; import and export are local.

### Session Controls

- Render `Reset Scenario`, enabled only for `mode: scenario`.
- Render `Restart Configuration`, enabled for scenario and transient-manual modes.
- Persisted users retain the existing `Reset Draft` action in Draft Status; workbench restart is not a second persisted reset path.
- Disable controls while pending or when their capability prop is false.

### Status

Display:

- Mode: `Persisted Draft`, `Transient Scenario`, or `Transient Manual`.
- Name: persisted draft ID/name fallback, normalized scenario name, or `Restarted Configuration`.
- Source: `Persisted workspace`, `Curated: <id>`, `Imported file: <filename>`, or `Restarted transient configuration`.
- Replay target: numeric count for a scenario; `Not applicable` otherwise.
- Applied picks: count of assigned picks in the active draft.
- Dirty: `Yes` or `No`.

Use text/badges only. Do not infer additional domain behavior in the panel.

### Errors

- Render errors in an `aria-live="polite"` region.
- Show concise scenario paths/messages for validation failures.
- Show the indexed replay message for replay failures.
- Clear stale errors when a new operation starts or succeeds.
- Do not show stack traces, raw JSON, browser exception text, or database details.

## DraftRoom State Model

Update `src/components/DraftRoom.tsx` while preserving the existing persisted `activeDraft` state.

Add local state for:

```ts
transientSession: TransientDraftSession | null
transientSource:
  | { kind: "curated"; id: CuratedScenarioId }
  | { kind: "imported"; fileName: string }
  | { kind: "restart" }
  | null
workbenchErrors: string[]
isWorkbenchPending: boolean
```

Use active values:

```text
active draft = transientSession?.draft ?? persisted activeDraft
active rankings = transientSession?.rankings ?? persisted rankings prop
active settings = transientSession?.leagueSettings ?? persisted settings prop
active recommendations = transientSession?.recommendations ?? persisted engine result
```

All existing derived availability, roster, active-pick, completion, and display behavior should consume these active values.

Do not overwrite the persisted `activeDraft` when entering a transient session. Exiting/replacing transient state should leave the saved workspace available unchanged.

## Curated Scenario Selection

When a curated ID is selected:

1. If the current transient session requires replacement confirmation, call native `window.confirm` with concise unexported-change text.
2. If declined, keep the existing transient session and controlled selected value unchanged.
3. Find its catalog JSON and call `createTransientScenarioSession` so selection uses the same import path as external JSON.
4. On failure, leave the active state unchanged and show formatted errors.
5. On success, install the returned transient scenario session, set curated source metadata, clear errors, and immediately render its target.

Do not call `loadCuratedScenario` and then manually build a session; Task 10 session creation owns the full import-to-session boundary. The catalog supplies raw JSON only.

## Local File Import

`onImportFile` should:

1. Apply the same dirty replacement confirmation before reading the file.
2. Set workbench pending state and clear errors.
3. Read `await file.text()` locally.
4. Call `createTransientScenarioSession(text)`.
5. On structured validation/replay failure, keep the prior active state unchanged and format its errors.
6. On success, install the session and record `Imported file: <file.name>`.
7. Catch unexpected file-read failures, log a concise existing-style error, and show `Unable to read the selected scenario file.`.
8. Clear pending state in `finally`.

The validator enforces the UTF-8 byte limit before parsing. Do not add streaming or server upload.

## Export Download

Export always uses current active typed values:

```ts
const workspace = {
  draft: activeDraft,
  rankings: activeRankings,
  leagueSettings: activeLeagueSettings,
};
```

1. Call `exportWorkspaceToScenarioV1`.
2. Use a safe scenario name:
   - Active scenario name when in scenario mode.
   - `Exported Draft Scenario` otherwise.
3. Include informational provenance:
   - `scenario` with scenario metadata ID for a transient scenario.
   - `manual` for restarted transient manual.
   - `persisted` with persisted draft ID for normal persisted mode.
   - Supply `exportedAt: new Date().toISOString()` from this UI boundary.
4. Serialize with `serializeScenarioV1`.
5. Create an `application/json` Blob.
6. Create an object URL, click a temporary anchor with a sanitized `.json` filename, remove it, and revoke the URL in `finally`.

Export should capture all currently applied active picks and default target to that count. It must not mutate or persist the active workspace.

If download creation fails, log a concise error and show `Unable to export the active draft.`.

## Transient Pick and Undo Routing

Update the existing DraftRoom callbacks:

### Pick

- If `transientSession` exists, call `draftPlayerInTransientSession`, update transient state, and do not set server mutation pending or call `draftPlayerAction`.
- Otherwise preserve the existing `draftPlayerAction` flow exactly.

### Undo

- If `transientSession` exists, call `undoLastPickInTransientSession`, update transient state, and do not call `undoLastPickAction`.
- Otherwise preserve the existing server-action flow exactly.

Use the same callbacks for recommendation Draft buttons and the Available Players table, so both surfaces follow the active session boundary.

`canUndoLastPick` and action disabling should derive from the active draft. Workbench pending and persisted mutation pending should both disable conflicting controls.

## Reset and Restart Routing

### Existing Draft Status Reset

- In persisted mode, preserve the current always-confirmed `resetDraftAction` flow and message exactly.
- In scenario mode, route the Draft Status reset callback to the same scenario-reset handler described below.
- In transient-manual mode, route it to restart configuration.

This avoids a misleading persisted action call while retaining the existing status control.

### Reset Scenario

1. Available only for a `kind: scenario` session.
2. Use `requiresTransientSessionConfirmation(session, "reset")`.
3. Prompt only when dirty; unchanged sessions reset immediately.
4. On approval, call `resetTransientScenarioSession`.
5. On success, replace the session with the fresh clean result and preserve its curated/imported source label.
6. On failure, leave the current session unchanged and show structured errors.
7. Do not call `resetDraftAction`.

### Restart Configuration

1. Available only when a transient session exists.
2. Use `requiresTransientSessionConfirmation(session, "restart")`.
3. Prompt only when dirty.
4. On approval, call `restartTransientSession`.
5. Install the returned clean transient-manual session and set restart source metadata.
6. Do not call persisted reset/create actions.

## Replacement and New Draft Confirmation

Scenario selection/import replacement uses `requiresTransientSessionConfirmation(session, "replace")`.

When `Start New Draft` is invoked during a transient session:

- Apply the same dirty replacement confirmation before opening setup.
- A clean transient session opens setup without a transient warning.
- Preserve the existing persisted in-progress confirmation when no transient session is active.
- Opening/canceling setup must not itself discard the transient session.
- Successful configured creation navigates to the new persisted draft through the existing action.

Do not add a global unload prompt.

## Error Formatting

Add small private DraftRoom helpers:

- Validation failure: `${path}: ${message}` for each returned error.
- Replay failure: `Pick ${pickIndex + 1}: ${message}`.
- Unexpected file/export failures: the fixed messages above.

Formatting is UI-only and must not alter error objects in pure modules.

## Testing Strategy

The repository still has no DOM interaction test dependency. Keep automated coverage proportional and use focused manual QA for actual file and click workflows.

### Workbench Panel Tests

Add `src/components/DeveloperWorkbenchPanel.test.tsx` using `renderToStaticMarkup`.

Assert:

1. Persisted status renders mode/source, no replay target, applied count, clean state, curated options, file input, and export action.
2. Scenario status renders normalized name, curated/imported source, numeric target, applied count, and dirty badge.
3. Transient-manual status renders restarted source and no replay target.
4. Reset/restart disabled states match capability props and pending state.
5. Validation/replay messages render in the live region.
6. File input has the accepted JSON types.

### DraftRoom Regression Tests

Extend `src/components/DraftRoom.test.tsx` static coverage to prove:

- Existing persisted workspace render now includes workbench persisted status.
- Existing recommendation order, scores, reasons, debugger, history-derived state, and actions remain present.
- No transient scenario is active on initial persisted render.

Rely on completed pure tests for:

- Curated/imported session creation.
- Local pick/undo behavior.
- Dirty tracking.
- Reset/restart and confirmation policy.
- Portability and export mapping.

Do not add React Testing Library, jsdom, Playwright, or another package in this slice.

## Implementation Steps

1. Add `src/components/DeveloperWorkbenchPanel.tsx` with controlled curated/file/session controls, status, errors, and capability-based disabled behavior.
2. Add `src/components/DeveloperWorkbenchPanel.test.tsx` with persisted, scenario, transient-manual, pending, capability, file, and error markup coverage.
3. Update `src/components/DraftRoom.tsx` with transient/source/error/pending state; active-value derivation; curated/import/export; transient pick/undo; reset/restart; confirmation; and download handling.
4. Extend `src/components/DraftRoom.test.tsx` for persisted workbench presence while retaining existing loaded-workspace assertions.
5. Run focused workbench, DraftRoom, session, scenario, action, repository, recommendation, and component tests, then the full suite, lint, and TypeScript validation.
6. Complete the manual QA workflow below.
7. If all acceptance criteria and validation pass, check only Phase 4 Task 11 complete in `docs/tasks.md`. Do not begin Task 12.

## Expected Files

- `src/components/DeveloperWorkbenchPanel.tsx`
- `src/components/DeveloperWorkbenchPanel.test.tsx`
- `src/components/DraftRoom.tsx`
- `src/components/DraftRoom.test.tsx`
- `docs/tasks.md` only to mark Phase 4 Task 11 complete after validation and manual QA pass

Do not modify pure session/scenario/engine modules, actions, repositories, Prisma, page layout, status panel, available table, recommendation panel, or domain types. If an approved public boundary cannot support the UI integration, stop and report the exact conflict rather than adding parallel behavior.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/components/DeveloperWorkbenchPanel.test.tsx src/components/DraftRoom.test.tsx src/lib/scenarioSession.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioReplay.test.ts src/lib/curatedScenarios.test.ts src/components/RecommendationsPanel.test.tsx src/app/actions/draftActions.test.ts src/lib/draftRepository.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused workbench/transient and persisted regression tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

## Manual QA Preconditions

- Local dependencies are installed.
- PostgreSQL is running and `DATABASE_URL` targets the intended development database.
- Prisma schema is applied.
- App runs with `npm run dev`.
- Browser supports `File.text`, Blob downloads, and object URLs.
- Use disposable development drafts only.

If database/app infrastructure is unavailable, record it as a blocker and leave Task 11 unchecked. Do not bypass persistence behavior to manufacture manual evidence.

## Manual QA Checklist

1. Open a persisted draft and confirm Workbench shows Persisted Draft, persisted source, applied count, clean state, and export enabled.
2. Export the persisted draft; confirm one readable `.json` file downloads and contains Scenario V1 source inputs without recommendations or derived state.
3. Select Early Non-Default Pressure; confirm immediate target state, scenario name/source, target `8`, applied `8`, clean state, four teams/four rounds, and recommendation diagnostics.
4. Make a local pick; confirm availability, roster/current pick, recommendations, applied count, and Dirty `Yes` update without changing persisted history.
5. Undo the local pick; confirm exact target restoration and Dirty `No`.
6. Undo a baseline pick; confirm Dirty `Yes`, then reset. Confirm dirty warning appears and approval restores target `8` cleanly.
7. From a clean scenario, reset again; confirm no warning appears.
8. Restart Configuration; confirm zero picks, same settings/rankings/user team, Transient Manual source, no replay target, and clean state.
9. Make a restarted-manual pick; confirm Dirty `Yes`; attempt restart, reject warning, and confirm state remains; approve and confirm zero clean state.
10. Export a transient scenario after exploration and import the downloaded file; confirm equivalent active state and recommendations.
11. Import a valid curated/exported JSON file; confirm Imported file source and immediate target.
12. Import malformed JSON and an unsupported-version JSON; confirm concise errors and unchanged active state.
13. From a dirty transient session, attempt curated replacement/import and reject confirmation; confirm active state remains. Approve and confirm replacement.
14. Start New Draft from a dirty transient session, reject replacement warning, and confirm setup stays closed. Approve, then cancel setup and confirm transient state remains.
15. Return to/reload a persisted draft and verify persisted pick, recommendation, undo, reset, refresh, history selection, and new-draft setup behavior remain unchanged.
16. Select Completed Draft; confirm complete state, empty recommendations/availability, reset behavior, and export.

Record any failure with source mode, scenario/file name, dirty state, persisted draft ID if applicable, expected result, observed result, and reproduction steps.

## Acceptance Criteria

- Curated selection and valid local import reach declared target state immediately.
- Invalid validation/replay import leaves active state unchanged and shows useful errors.
- Export downloads valid portable JSON for persisted, scenario, and transient-manual states.
- Workbench clearly displays mode, name, source, replay target, applied count, and dirty state.
- Scenario and transient-manual picks/undo stay local and use pure session transitions.
- Persisted picks/undo/reset retain existing action/repository behavior.
- Scenario reset reruns source validation/replay and restores target; restart creates zero-pick transient manual state.
- Dirty transient reset/restart/replacement requires confirmation; clean equivalents do not.
- Existing persisted confirmations remain behaviorally unchanged.
- Recommendation debugger remains available and current through selection, import, local transitions, reset, and restart.
- No failed operation partially replaces active state.
- No scenario operation writes to persistence.
- No step playback, autosave, new service, dependency, or broad redesign is introduced.
- Focused tests, full suite, lint, TypeScript, and manual QA pass.
- Only Phase 4 Task 11 is checked complete after all evidence passes.
- Task 12 is not started.

## Failure Handling

- If a session/import/reset result fails, format its existing error and retain current state; do not install partial data.
- If a dirty confirmation is declined, perform no read, replay, reset, restart, navigation, or state replacement.
- If file reading or download fails unexpectedly, keep active state and show the fixed form-level message.
- If browser API behavior cannot be validated automatically, use the manual checklist; do not add a testing dependency.
- If persisted action regression appears, stop and report it rather than moving persisted drafts onto transient logic.
- If manual QA infrastructure is unavailable, leave Task 11 unchecked and report the blocker.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 12: Complete Cross-Feature Regression and Phase 4 Exit Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It exposes all completed Phase 4 capabilities in one compact workflow without adding new domain behavior.
- Concrete enough for implementation: yes. State ownership, active-value routing, controls, browser effects, confirmations, errors, tests, manual QA, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. Existing React state and pure boundaries are composed directly without a state library, route, service, or alternate engine.
- Blast radius reasonable: yes. One panel, one panel test, DraftRoom integration/test, and the completion checkbox total five files.
- Review/revert comfort: yes. UI integration is concentrated in DraftRoom and a controlled panel; pure modules and persisted boundaries remain untouched.
- Observable/testable acceptance criteria: yes. Static markup covers presentation, pure tests cover state behavior, and focused manual QA covers actual browser/file/confirmation workflows.
