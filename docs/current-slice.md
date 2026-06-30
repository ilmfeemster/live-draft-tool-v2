# Current Slice: Complete Task 19 - Ranking Set Selection in Draft Setup

## Completion Status

Completed. Task 19 implementation and automated validation are complete.

## Source Context

- Phase 5 Task 19 is the active task: allow the user to choose which managed ranking set anchors a new draft.
- `createConfiguredDraftFromRankingSet` already performs the authoritative identity-based draft creation workflow:
  - trims and requires `rankingSetId`;
  - loads the selected managed ranking set;
  - validates league capacity against the selected set's entry count;
  - creates an immutable ranking snapshot;
  - persists the draft workspace from copied snapshot entries.
- `createConfiguredDraftFromRankingSetAction` already exposes that workflow to the app.
- `Home` already loads ranking-set summaries for `RankingLibraryPanel`; those summaries should also feed draft setup.
- `DraftRoom` currently opens `DraftSetupForm` with only the active draft snapshot player count and calls the legacy seed-backed `createConfiguredDraftAction`.
- Task 19 should switch the setup UI to pass ranking-set identity only. It must not copy ranking entries, validate ranking data, or create snapshots in the client.

## Goal

Finish Phase 5 Task 19 by adding ranking-set selection to new draft setup, defaulting to the managed seed set when available, and routing draft creation through the shared selected-ranking workflow while preserving immutable draft snapshot behavior.

## Scope

### Goals

- Pass managed ranking-set summaries from `Home` into `DraftRoom` and `DraftSetupForm`.
- Add a required ranking-set selector to the existing draft setup form.
- Default the selector to the managed seed ranking set when its summary is available; otherwise use a clear empty/choose state.
- Show selected set name, source kind, player count, and concise non-blocking warnings for neutral tier capability or missing optional data.
- Use the selected set's entry count for local league-capacity validation before submit.
- Submit `{ leagueSetup, rankingSetId }` through `createConfiguredDraftFromRankingSetAction`.
- Display selected-ranking workflow errors clearly, including missing/deleted set, invalid request, invalid league setup, and invalid ranking set.
- Preserve cancel behavior, pending state, in-progress-draft confirmation, transient-session confirmation, and route-to-created-draft behavior.
- Tell the user in setup copy that the selected set is snapshotted for the new draft and cannot be switched after creation.
- Preserve existing ranking library, draft history, current draft, replay, scenario, and recommendation behavior.

### Non-Goals

- Do not edit rankings inside draft setup.
- Do not blend, compare, merge, or preview multiple ranking sets.
- Do not allow existing drafts to switch ranking snapshots.
- Do not add league presets, account preferences, persistence schema changes, or package dependencies.
- Do not redesign unrelated draft controls.
- Do not move ranking-copy, validation, normalization, or snapshot creation logic into UI components.
- Do not change recommendation scoring or tier semantics in this slice.
- Do not remove the legacy seed-backed draft action unless it is no longer referenced and removal is trivially safe.

## Implementation Step

1. Wire ranking-set selection into the existing configured draft setup path.

   Update `Home` to pass loaded `rankingSummaries` into `DraftRoom` and provide the managed seed default ID from `MANAGED_SEED_RANKING_SET_ID`. Extend `DraftRoom` props to accept those summaries and the default ID, pass them to `DraftSetupForm`, and replace its setup submit handler with a call to `createConfiguredDraftFromRankingSetAction({ leagueSetup: input, rankingSetId })`.

   Update `DraftSetupForm` so its form state includes `rankingSetId`. Render a selector from the supplied summaries, defaulting to the managed seed summary when present. Derive the selected summary from the current ID, use `selectedSummary.entryCount` for `buildLeagueSetup`, and block submit locally when no valid summary is selected. Keep the existing numeric setup controls and summary UI, but add selected-set metadata, a short snapshot immutability note, and non-blocking warnings based on summary capabilities:

   - any represented position with `tiers[position] === "defaulted-neutral"` should warn that tiers were neutralized for that position;
   - `team !== "complete"` or `adp !== "complete"` should warn that optional metadata is missing or partial.

   Convert selected-ranking workflow errors to the form's existing display pattern without changing domain error messages. Field/path errors for `rankingSetId` should appear near the selector, league setup errors should remain attached to the existing setup fields, and unexpected creation failures should continue using the form-level error.

   Update focused tests to cover default managed seed selection, explicit alternate set selection markup/submission shape, empty/no-valid-set state, capability warnings, selected set capacity validation, selected-ranking workflow error display, preserved cancel/pending behavior, and the `DraftRoom` action handoff. Keep snapshot immutability and distinct-set creation assertions in the existing workflow tests unless a small regression test is needed to cover UI wiring.

## Expected Files

- `src/app/page.tsx`
- `src/components/DraftRoom.tsx`
- `src/components/DraftRoom.test.tsx`
- `src/components/DraftSetupForm.tsx`
- `src/components/DraftSetupForm.test.tsx`
- `src/app/actions/draftActions.test.ts`, only if selected-ranking action expectations need adjustment
- `src/lib/draftCreationWorkflow.test.ts`, only if an acceptance criterion is not already covered there
- `docs/current-slice.md`, for completion status after implementation
- `docs/tasks.md`, after validation, to mark Phase 5 Task 19 complete

## Tests

Run from the repository root:

```text
npm test -- src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx src/app/actions/draftActions.test.ts src/lib/draftCreationWorkflow.test.ts
npm test -- src/lib/rankingManagementWorkflow.test.ts src/lib/rankingSetRepository.test.ts src/lib/draftWorkspaceLoader.test.ts
npx tsc --noEmit
npm run lint -- src/app/page.tsx src/components/DraftRoom.tsx src/components/DraftRoom.test.tsx src/components/DraftSetupForm.tsx src/components/DraftSetupForm.test.tsx src/app/actions/draftActions.test.ts src/lib/draftCreationWorkflow.test.ts
npm test
npm run lint
```

Expected result:

- focused draft setup, draft room, action, and selected-ranking workflow tests pass;
- ranking management and repository summary tests continue to pass;
- draft workspace loading continues to preserve existing snapshot resume behavior;
- TypeScript no-emit passes;
- lint passes;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled.

## Manual QA

Run the app locally only if practical:

1. Open New Draft Setup and confirm the managed seed set is selected by default when present.
2. Select a different managed ranking set, create a draft, and confirm recommendations reflect that set's snapshot.
3. Create another draft from a different set and confirm the two drafts keep distinct recommendation inputs.
4. Edit or delete the source ranking set after draft creation, refresh, and confirm the created draft still loads from its captured snapshot.
5. Try setup with no available ranking sets, a deleted selected set, and an oversized league capacity, and confirm clear errors with no partial draft.
6. Confirm cancel, pending state, in-progress draft confirmation, transient-session confirmation, draft history, ranking library, scenario import/export, and replay still behave.

If local persistence is unavailable, report manual QA as blocked by database setup rather than changing this slice.

## Acceptance Criteria

- A user can create two drafts from different managed ranking sets and receive deterministic recommendations corresponding to each selected set.
- The managed seed ranking set provides a quick default selection path when available.
- Missing, deleted, invalid, or insufficient ranking sets fail clearly without partial draft creation.
- Safely degraded sets remain selectable and draft deterministically from their materialized canonical values.
- Refresh and resume continue using each draft's captured immutable snapshot.
- Draft setup UI passes ranking-set identity only and contains no ranking-copy, snapshot creation, normalization, conversion, or ranking validation logic.
- Cancel behavior, pending state, in-progress-draft confirmation, and transient-session confirmation remain unchanged.
- Existing ranking library, draft history, current draft, scenario, replay, and recommendation behavior remain unchanged.
- After implementation validation, Phase 5 Task 19 is marked complete in `docs/tasks.md`.

## Failure Handling

- If no ranking summaries are available, disable creation and show a concise message that a managed ranking set is required.
- If the selected ranking set disappears before submit, show the workflow's not-found error and keep the setup form open.
- If league setup fails against the selected set capacity, show the validation errors and do not call persistence beyond the workflow.
- If snapshot creation rejects an invalid selected set, show the invalid-ranking-set errors and keep the setup form open.
- If implementation appears to require ranking editing, blending sets, changing existing draft snapshots, schema changes, or recommendation scoring changes, stop and report the Task 19 boundary.
- If unrelated tests fail, report them separately and do not broaden this task.

## Follow-Up

After Task 19 is complete, plan Task 20: complete Phase 5 regression and exit validation. Do not begin Task 20 automatically.

## Slice Review

- Smallest meaningful increment: yes. This wires the already-built selected-ranking creation workflow into the existing setup UI.
- Executable by a lower-reasoning pass: yes. The relevant files, data flow, error mapping, and validation expectations are explicit.
- Avoids unnecessary architecture changes: yes. It reuses ranking summaries, the existing form, and the existing draft creation workflow.
- Blast radius reasonable: yes. Planned changes are limited to the page prop, draft room, setup form, focused tests, and task status.
- Review/revert comfort: yes. The UI wiring can be reverted without changing ranking storage, draft persistence, or recommendation scoring.
- Observable/testable acceptance criteria: yes. Default selection, explicit alternate selection, workflow errors, capacity validation, and immutable resume behavior are directly observable.
