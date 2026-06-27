# Current Slice: Add the Draft Setup Workflow

## Source Context

Phase 4 Task 3: Add the Draft Setup Workflow.

Tasks 1 and 2 are complete. The application now has a shared client-safe setup validator/builder and a server action that validates and persists configured drafts. The remaining milestone work is to expose that path through a compact developer-facing setup workflow.

The existing Draft Room owns the `Start New Draft` actions and routing. Its current tests use server-rendered markup without a browser DOM dependency, so this slice should preserve that test strategy and use focused manual QA for interactions.

## Goal

Replace immediate fixed-default creation in the Draft Room with an inline, cancellable setup mode that supports all approved configuration fields, validates locally and on the server, creates a persisted draft, and routes to the new workspace without changing existing draft behavior.

## Scope

### Goals

- Open a compact setup form from either existing `Start New Draft` button.
- Preserve the existing confirmation before leaving an in-progress draft.
- Keep the current draft loaded and unchanged while setup is open.
- Prefill the current MVP configuration from `defaultLeagueSetupInput`.
- Provide inputs for team count, user draft position, and every supported roster category.
- Show `SNAKE` and `PPR` as fixed supported values.
- Convert transient form strings into `LeagueSetupInput` without changing the domain contract.
- Validate with `buildLeagueSetup(input, rankings.length)` before calling the server action.
- Display client and authoritative server validation errors.
- Submit valid input through `createConfiguredDraftAction`.
- Route to the newly created draft on success.
- Allow cancel without creating a draft or changing the active workspace.
- Disable duplicate submission and cancel while creation is pending.
- Preserve existing recommendations, picks, undo, reset, history, and loaded non-default behavior.
- Add focused component/render regression coverage and complete one manual non-default workflow.

### Non-Goals

- Editing an existing draft's settings.
- Adding custom draft names, ranking selection, saved presets, or setup persistence.
- Adding arbitrary roster-slot eligibility or custom positions.
- Adding unsupported draft types or scoring formats.
- Changing `LeagueSetupInput`, validation limits, server-action contracts, repository behavior, hydration, or Prisma.
- Redesigning the Draft Room or introducing a new route.
- Adding a modal framework, form library, DOM test dependency, or package dependency.
- Changing recommendation, pick, undo, reset, or delete behavior.
- Beginning Phase 4 Task 4.

## User Workflow

### Open Setup

1. The developer clicks either existing `Start New Draft` button.
2. If the current draft is in progress, retain the current confirmation text and behavior.
3. Canceling that confirmation keeps the Draft Room unchanged.
4. Accepting it, or starting from a not-started/completed draft, opens setup mode without creating a draft.
5. Setup mode replaces the Draft Room grid inside the existing page; it does not navigate or discard the active component state.

### Configure

- Show a `New Draft Setup` heading and a short explanation that the existing draft remains in history.
- Prefill all values from `defaultLeagueSetupInput`.
- Use numeric inputs with step `1` for:
  - Team count.
  - Draft position.
  - QB, RB, WR, TE, FLEX, DST, K, and BENCH counts.
- Apply the documented min/max attributes where a direct bound exists, but rely on `buildLeagueSetup` for authoritative client validation.
- Show Draft Type as `Snake` and Scoring as `PPR` in read-only display fields rather than fake selectors.
- Show a derived summary when numeric values permit it:
  - Rounds equal total roster slots.
  - Total picks equal team count multiplied by rounds.

### Submit

1. Convert form strings to numbers, using `NaN` for blank or non-numeric values so shared validation reports them.
2. Build a `LeagueSetupInput` with fixed `SNAKE` and `PPR` values.
3. Call `buildLeagueSetup(input, rankingPlayerCount)` locally.
4. On local failure, display its errors and do not call `onSubmit`.
5. On local success, call the Draft Room's async submit callback with the typed input.
6. The Draft Room calls `createConfiguredDraftAction` and sets the existing pending state.
7. On server validation failure, remain in setup mode and display the returned errors.
8. On success, route to `/?draftId=<encoded id>`.
9. On unexpected action failure, log the existing-style concise error and show a form-level message so the developer is not left with a silent no-op.

### Cancel

- Cancel closes setup mode and clears local/server setup errors.
- Cancel performs no server action and restores the existing Draft Room view with its current in-memory state.
- Cancel is disabled while configured creation is pending.

## Component Boundary

Add `src/components/DraftSetupForm.tsx` as a client component.

Use a small prop contract equivalent to:

```ts
type DraftSetupFormProps = {
  rankingPlayerCount: number;
  isPending: boolean;
  serverErrors: LeagueSetupValidationError[];
  onCancel: () => void;
  onSubmit: (input: LeagueSetupInput) => Promise<void>;
};
```

The component should:

- Own transient string values initialized from `defaultLeagueSetupInput`.
- Keep form values separate from persisted/domain state.
- Run shared validation on submit before invoking `onSubmit`.
- After a failed submit, revalidate on edits so visible errors update promptly.
- Clear stale local errors after a valid local build.
- Prefer current server errors until the developer edits a field, then clear them through a small callback or by having the Draft Room clear them when it receives the next submitted input. Keep this coordination simple; do not introduce form context or reducers.
- Render errors close to matching fields when the error has a field-specific path.
- Render `rosterSlotCounts`, `rankingPlayerCount`, and unexpected-action errors in a concise form-level summary.
- Include `Create Draft` and `Cancel` buttons with clear pending/disabled behavior.

The exact prop contract may add one narrow `onEdit`/`onClearServerErrors` callback if needed to clear stale server messages. Do not add broader abstractions.

## Draft Room Integration

Update `src/components/DraftRoom.tsx` to:

- Import `DraftSetupForm` and `createConfiguredDraftAction`.
- Stop calling `createNewDraftAction` from `Start New Draft`.
- Add local setup-open and setup-error state.
- Retain the existing in-progress confirmation before opening setup.
- Render `DraftSetupForm` instead of the normal grid while setup mode is active.
- Pass `rankings.length` for capacity validation.
- Submit typed input to `createConfiguredDraftAction`.
- Preserve the current `isMutationPending` guard across setup submission.
- Route only after a successful configured action result.
- Remain in setup mode after validation or unexpected errors.
- Close setup without mutating `activeDraft`.

Do not alter the props or rendering behavior of `DraftStatusPanel`. Its existing buttons already call the callback supplied by Draft Room.

## Error Presentation

Use errors from the shared builder/server action rather than recreating validation rules in the component.

At minimum:

- `teamCount` appears with Team Count.
- `userDraftPosition` appears with Draft Position.
- `rosterSlotCounts.<CATEGORY>` appears with that category input.
- Aggregate `rosterSlotCounts` appears above or below the roster field group.
- `rankingPlayerCount` appears as a form-level capacity error.
- Unexpected action failures use a form-level message such as `Unable to create the configured draft.`

Do not expose stack traces or database details in the UI.

## Testing Strategy

The repository does not currently include a browser DOM test dependency. Keep automated tests proportional:

- Add `src/components/DraftSetupForm.test.tsx` using the existing `renderToStaticMarkup` approach.
- Extend `src/components/DraftRoom.test.tsx` to mock `createConfiguredDraftAction` instead of the removed Draft Room dependency on `createNewDraftAction`.
- Preserve the existing loaded-workspace recommendation render test.
- Use static markup assertions for defaults, labels, input bounds, fixed settings, pending state, and supplied validation errors.
- Rely on the already-completed Task 1 tests for validation behavior and Task 2 tests for configured server submission.
- Use focused manual QA for open, edit, submit, cancel, confirmation, route, refresh, and workflow interactions.

Do not add React Testing Library, jsdom, Playwright, or another test dependency in this slice.

## Implementation Steps

1. Add `src/components/DraftSetupForm.tsx` with transient form state, conversion, shared validation, error mapping, derived summary, and submit/cancel controls.
2. Add `src/components/DraftSetupForm.test.tsx` for default and error/pending render states.
3. Update `src/components/DraftRoom.tsx` to open setup mode and call `createConfiguredDraftAction` while preserving existing confirmation and mutation guards.
4. Update `src/components/DraftRoom.test.tsx` mocks and retain normal-workspace rendering assertions.
5. Run focused automated tests, the full suite, lint, and TypeScript validation.
6. Complete the focused manual QA workflow below.
7. If all acceptance criteria and validation pass, check only Phase 4 Task 3 complete in `docs/tasks.md`. Do not begin Task 4.

## Expected Files

- `src/components/DraftSetupForm.tsx`
- `src/components/DraftSetupForm.test.tsx`
- `src/components/DraftRoom.tsx`
- `src/components/DraftRoom.test.tsx`
- `docs/tasks.md` only to mark Phase 4 Task 3 complete after validation passes

Do not modify the action, setup builder, repository, Prisma, page, status panel, or domain types unless the approved interfaces prove impossible to consume. If that occurs, stop and report the conflict rather than broadening the slice.

## Automated Test Cases

The focused component tests should prove:

1. Default form markup includes Team Count `12`, Draft Position `2`, and the eight documented roster counts.
2. Draft Type displays `Snake` and Scoring displays `PPR` without unsupported selectors.
3. Numeric inputs expose appropriate names, labels, step, and direct min/max attributes.
4. The default derived summary shows 16 rounds and 192 total picks.
5. Supplied team-count, draft-position, category, aggregate roster, and capacity errors render in the correct areas.
6. Pending markup disables Create and Cancel and communicates creation progress.
7. Normal Draft Room server rendering remains unchanged before setup is opened.
8. Existing non-default loaded-workspace recommendations, scores, reasons, team count, rounds, and user-team identity still render correctly.

Static rendering does not need to simulate clicks. Interaction correctness is covered by Task 1/2 pure/action tests plus the manual checklist.

## Automated Validation

Run from the repository root in this order:

```txt
npm test -- src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx src/app/actions/draftActions.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused form, Draft Room, and configured-action tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No package dependency is added.

## Manual QA Preconditions

- Local dependencies are installed.
- PostgreSQL is running and `DATABASE_URL` targets the intended local database.
- The Prisma schema is already applied.
- The app starts with `npm run dev`.
- Use a disposable or development draft; do not alter production data.

If an infrastructure precondition is unavailable, record it as a blocker and leave Task 3 unchecked. Do not change application behavior merely to bypass local infrastructure.

## Manual QA Checklist

1. Open an existing draft with no picks and click `Start New Draft`; confirm setup opens without creating or routing.
2. Click `Cancel`; confirm the same draft and visible state return unchanged.
3. Add a pick to an in-progress draft, click `Start New Draft`, and reject the confirmation; confirm setup does not open.
4. Accept the confirmation; confirm setup opens and the existing persisted draft remains in history.
5. Confirm defaults show 12 teams, draft position 2, 16 rounds, 192 picks, Snake, and PPR.
6. Enter an invalid team count or draft position and submit; confirm an actionable field error appears and no draft is created.
7. Create a non-default draft, for example 4 teams, draft position 3, QB 1, RB 1, WR 1, FLEX 1, BENCH 2, and zero for the other categories.
8. Confirm the app routes to a new `draftId` and displays 4 teams, 6 rounds, and user draft position 3.
9. Enter one pick and confirm availability, recommendations, and current pick update.
10. Undo and confirm the prior state returns.
11. Refresh and confirm the configured draft, settings, and recommendation state persist.
12. Reset the draft and confirm the same non-default configuration remains with picks cleared.
13. Select the previous draft from history and confirm it was not overwritten.

Record any failure with the exact input, active draft ID, expected result, observed result, and reproduction steps.

## Acceptance Criteria

- Both existing `Start New Draft` buttons open the setup workflow.
- The current in-progress confirmation still protects accidental workflow replacement.
- Opening or canceling setup creates no draft and preserves current state.
- Defaults exactly match `defaultLeagueSetupInput`.
- Every supported setup field is editable through a numeric input.
- `SNAKE` and `PPR` are visible without unsupported choices.
- Shared client validation prevents invalid server calls and displays structured errors.
- Server validation errors remain visible in setup mode.
- Valid submission calls `createConfiguredDraftAction` once and routes to the returned draft ID.
- Duplicate submission and cancel are disabled while pending.
- A non-default draft persists team count, derived rounds, roster construction, and user draft position across refresh.
- Picks, recommendations, undo, reset, history, and resume work with the non-default draft.
- Existing normal Draft Room rendering remains unchanged outside setup mode.
- Automated validation and manual QA pass.
- No new package dependency, route, persistence shape, or domain model is introduced.
- Only Phase 4 Task 3 is checked complete after all evidence passes.
- Task 4 is not started.

## Failure Handling

- If the form cannot consume the completed setup/action interfaces without changing them, stop and report the exact contract conflict.
- If static component tests cannot assert an interaction, retain a render assertion and cover the interaction in manual QA; do not add a testing dependency.
- If configured creation returns validation errors after local validation passes, display them and record the differing input; do not bypass server validation.
- If automated validation exposes an unrelated failure, report it without expanding the slice.
- If manual QA is blocked by database or app infrastructure, leave Task 3 unchecked and report the unmet precondition.
- Do not weaken existing workflow, recommendation, or persistence assertions.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 4: Define the Scenario V1 Contract. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It completes the user-visible configurable creation milestone using already-approved domain and server boundaries.
- Concrete enough for implementation: yes. Component ownership, workflow states, field mapping, errors, tests, commands, and manual evidence are explicit.
- Avoids unnecessary architecture changes: yes. It uses local React state, existing actions, and existing routing without new routes, dependencies, or persistence changes.
- Blast radius reasonable: yes. Four code/test files are expected, plus the Task 3 checkbox after validation and manual QA.
- Review/revert comfort: yes. The setup mode is isolated and existing Draft Room behavior remains the fallback.
- Observable/testable acceptance criteria: yes. Rendered defaults/errors plus open, cancel, validation, route, refresh, pick, undo, reset, and history behavior are directly observable.
