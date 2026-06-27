# Current Slice: Wire Recommendation Engine Into Draft Room

## Source Task

Task 10: Wire Recommendation Engine Into Draft Workflow.

This is the first Task 10 slice. It replaces the legacy UI compatibility path with the completed Recommendation Engine and updates the existing pure workflow regression coverage.

## Goal

Make the current Draft Room compute and display ordered, context-aware `PlayerRecommendation` output from the active typed draft, ranking snapshot, league settings, and user team identity.

The slice should preserve the existing draft-room layout and actions while replacing static-style recommendations with scored recommendations and score-backed reasons.

## User-Visible Increment

- The Recommendations panel responds to roster fit, value, tier, scarcity, and observed run context rather than the legacy basic modifiers.
- Recommendation scores come from the Phase 3 engine.
- Displayed reasons are the deterministic score-backed reason text produced by the engine.
- Manual picks, undo, reset, and loaded drafts recompute from the active draft state already owned by `DraftRoom`.

## Current Context

- `generatePlayerRecommendations` is the completed pure Phase 3 engine.
- `generateTopRecommendations` remains the legacy compatibility function.
- `DraftRoom` currently calls `generateTopRecommendations` with separately derived available rankings and user roster players.
- `DraftRoom` already receives the active typed draft and ranking snapshot, updates its local draft after server actions, and recomputes memoized derived data.
- The loaded page already owns `workspace.leagueSettings` but does not pass it into `DraftRoom`.
- `RecommendationsPanel` currently accepts legacy `Recommendation[]`, a numeric `score`, and string reasons.
- `PlayerRecommendation` provides `totalScore`, `components`, and typed reasons with stable ids and text.
- Persisted workspace parity and dynamic roster behavior are already validated at the engine/repository boundary.

## Scope

### Goals

- Pass typed league settings from the loaded workspace into `DraftRoom`.
- Replace the legacy recommendation call in `DraftRoom` with `generatePlayerRecommendations`.
- Feed the engine the full ranking snapshot and active draft; let the engine own drafted-player filtering.
- Keep the existing available-player and user-roster derivations for their current UI panels.
- Adapt `RecommendationsPanel` to accept `PlayerRecommendation[]`.
- Display `totalScore` and typed reason text.
- Preserve recommendation order returned by the engine.
- Migrate the existing pure draft-workflow tests to `generatePlayerRecommendations`.
- Add an undo regression proving recommendation output returns to the prior state.
- Keep UI layout and draft actions otherwise unchanged.

### Non-Goals

- Redesigning the Draft Room or Recommendations panel.
- Displaying component-level score breakdowns.
- Adding new recommendation controls, filters, windows, or strategy settings.
- Persisting recommendation output.
- Changing Recommendation Engine scoring, tuning, reasons, or types.
- Changing server actions, repository mapping, Prisma, schema, or draft transitions.
- Adding browser automation or manual QA in this slice.
- Removing `generateTopRecommendations`; focused legacy tests may continue to cover it.
- Checking off Task 10; presentation/load validation remains a follow-up slice.
- Updating documentation other than `docs/current-slice.md`.

## Expected Files

- `docs/current-slice.md`
- `src/app/page.tsx`
- `src/components/DraftRoom.tsx`
- `src/components/RecommendationsPanel.tsx`
- `src/lib/draftWorkflow.test.ts`

Do not modify production recommendation, persistence, server-action, or draft-state files.

## Implementation Details

### Page Boundary

Update the existing `<DraftRoom>` call in `src/app/page.tsx`:

- Pass `workspace.leagueSettings` as a new `leagueSettings` prop.
- Keep the existing `key`, `draft`, and `rankings` props.
- Do not move recommendation generation into the server page; it must continue responding immediately to local active-draft updates after actions.

### DraftRoom Boundary

In `src/components/DraftRoom.tsx`:

- Add `leagueSettings: LeagueSettings` to `DraftRoomProps`.
- Import and call `generatePlayerRecommendations` instead of `generateTopRecommendations`.
- Build recommendations with:

```ts
generatePlayerRecommendations({
  draft: activeDraft,
  rankings,
  leagueSettings,
  userTeamId: activeDraft.userTeamId,
})
```

- Memoize from `activeDraft`, `rankings`, and `leagueSettings`.
- Do not pass prefiltered rankings or the separately derived user roster into the engine.
- Keep `availableRankings` for `AvailablePlayersTable`.
- Keep `userRosterPlayers` for `UserRosterPanel`.
- Preserve existing action handlers and active-draft state updates. Those updates should naturally trigger recommendation recomputation.

### RecommendationsPanel Contract

In `src/components/RecommendationsPanel.tsx`:

- Change the recommendation prop type from `Recommendation[]` to `PlayerRecommendation[]`.
- Preserve the existing recommendation ordering and row layout.
- Replace legacy `score` display with `totalScore` formatted to one decimal place.
- Render `reason.text` for each typed reason.
- Use `reason.id` as the reason list key within each recommendation row.
- Keep player rank, team, position, draft button behavior, empty state, current-pick emphasis, and disabled behavior unchanged.
- Update the subtitle from `Ranking-based suggestions from available players.` to `Context-aware suggestions from the current draft state.`
- Do not expose raw component evidence or internal tuning values.

## Workflow Regression Migration

Update `src/lib/draftWorkflow.test.ts` to exercise the engine now used by the Draft Room.

### Test Helpers

- Import `defaultLeagueSettings`.
- Import `generatePlayerRecommendations` instead of `generateTopRecommendations`.
- Import `undoLastDraftPick` alongside `draftPlayerInDraft`.
- Add a small helper that returns `RecommendationInput` from a draft and the full ranking snapshot using:
  - league settings copied from `defaultLeagueSettings` with `teamCount` and `rounds` aligned to the test draft;
  - `userTeamId` from the draft.
- Update recommendation-id helper typing to use `generatePlayerRecommendations` output.
- Keep available-player and user-roster helpers because those assertions validate independent workflow state.

### Existing Manual Draft Test

- Replace each legacy recommendation call with `generatePlayerRecommendations` using the full rankings and current draft state.
- Continue asserting:
  - initial recommendations exist;
  - drafted players disappear;
  - recommendations contain only available players;
  - user roster derivation remains correct;
  - the final remaining player is recommended.
- Add an assertion that at least one returned recommendation contains a typed, score-backed reason.
- Do not rewrite expected order unless the Phase 3 engine intentionally differs from the legacy helper; assert only behavior required by the workflow.

### Completed Draft Test

- Generate recommendations from the completed draft and full rankings through the Phase 3 engine.
- Continue expecting an empty result and valid draft invariants.

### Undo Regression

Add one focused test:

1. Create a small typed draft and ranking snapshot.
2. Apply enough picks to produce a non-empty recommendation state.
3. Capture recommendations immediately before one additional pick.
4. Apply that pick and confirm the drafted player disappears from recommendations.
5. Undo with `undoLastDraftPick`.
6. Assert the restored draft equals the prior draft state.
7. Assert the restored full recommendation output exactly equals the pre-pick output, including scores, components, and reasons.

This test should remain pure and must not introduce repository or React dependencies.

## Implementation Steps

1. Review the active workflow context.
   - Read `docs/current-slice.md`.
   - Read Task 10 in `docs/tasks.md`.
   - Read `src/app/page.tsx`.
   - Read `src/components/DraftRoom.tsx`.
   - Read `src/components/RecommendationsPanel.tsx`.
   - Read `src/lib/draftWorkflow.test.ts`.

2. Pass league settings through the page boundary.
   - Add the new `DraftRoom` prop from `workspace.leagueSettings`.

3. Replace Draft Room recommendation generation.
   - Update imports, props, and the recommendation memo.
   - Preserve independent available-player and roster derivations for their panels.
   - Do not change action behavior.

4. Adapt the Recommendations panel.
   - Switch to `PlayerRecommendation[]`.
   - Render one-decimal total scores and typed reason text with stable ids.
   - Update only the descriptive subtitle.

5. Migrate workflow regressions.
   - Replace legacy calls with full typed engine input.
   - Preserve workflow-state assertions.
   - Add reason-shape coverage and the exact undo restoration regression.

6. Run validation.
   - Run `npm test -- src/lib/draftWorkflow.test.ts`.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npx tsc --noEmit`.
   - Fix only failures caused by this slice.
   - If validation reveals an unrelated pre-existing failure, document it and stop rather than broadening scope.

7. Stop after this wiring slice.
   - Do not begin the follow-up presentation/load validation slice.
   - Do not check off Task 10.

## Acceptance Criteria

- `DraftRoom` uses `generatePlayerRecommendations`; no UI call site uses `generateTopRecommendations`.
- The engine receives active draft state, the full ranking snapshot, hydrated league settings, and active user team identity.
- Manual pick, undo, and reset state changes naturally recompute recommendations from `activeDraft`.
- A loaded persisted workspace supplies its own league settings to recommendation generation.
- RecommendationsPanel displays engine ordering, one-decimal total scores, and score-backed reason text.
- Available-player and user-roster panels retain their current behavior.
- Pure workflow tests exercise the same Recommendation Engine used by the UI.
- Undo restores exact prior recommendation output.
- Completed drafts return no recommendations.
- Existing draft invariants remain valid.
- No recommendation output is persisted.
- No scoring, persistence, server-action, schema, or draft-transition behavior changes.

## Suggested Tests

- Workflow test for recommendation updates after manual picks.
- Workflow test proving drafted players remain excluded.
- Workflow test proving completed drafts return no recommendations.
- Workflow regression proving undo restores exact recommendation output.
- Type validation for page, DraftRoom, and panel prop contracts.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/draftWorkflow.test.ts
npm test
npm run lint
npx tsc --noEmit
```

## Follow-Up Task 10 Slice

Do not implement this in the current slice:

- Add focused presentation/load validation for rendered score-backed reasons and hydrated-workspace wiring, complete any necessary manual QA, then check Task 10 complete.

## Slice Review

- Smallest meaningful increment: yes. It is the vertical replacement of the legacy UI recommendation path.
- Concrete enough for implementation: yes. Props, engine input, panel contract, display formatting, workflow migration, undo behavior, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It uses the completed pure engine and existing Draft Room state flow.
- Blast radius reasonable: yes. Expected implementation changes are limited to four source/test files.
- Review/revert comfort: yes. The legacy helper remains intact and the wiring change is localized.
- Observable/testable acceptance criteria: yes. UI contract, workflow updates, reasons, drafted-player filtering, completion, undo restoration, lint, and type checking are verifiable.
