# Current Slice: Add Persisted Draft Workflow Validation Test

## Source Task

Task 9: Complete Phase 2 Persistence Validation.

This slice adds the smallest useful automated validation for persisted draft workflow behavior. It does not attempt to complete all Phase 2 manual QA or full-draft validation.

## Goal

Prove that a persisted draft can be created, mutated, reloaded, and used as recommendation input without corrupting draft invariants.

The test should validate the repository/workspace boundary that Phase 2 depends on: persisted source state goes in, a hydrated `DraftWorkspace` comes back out, and the app can derive available players, user roster, and recommendations from that workspace after reload.

## User-Visible Increment

No direct UI change.

The user-visible value is increased confidence that refresh/resume behavior is backed by tested persistence workflow behavior rather than only isolated repository operations.

## Problem

Phase 2 now supports persisted drafts, persisted pick mutations, reset, and draft history links. Existing tests cover many pieces independently, but there is not yet a single validation test that exercises the core persisted workflow as a user would depend on it:

```txt
create draft
draft picks
reload workspace
derive available players
derive user roster
generate recommendations
undo
reload again
confirm invariants still hold
```

Task 9 is broad, so this slice should add one focused automated confidence layer before moving to manual full-draft QA.

## Goals

- Add a focused persisted workflow validation test.
- Use a non-default league configuration.
- Create a persisted draft workspace through the repository.
- Persist multiple draft picks through repository mutation methods.
- Reload the workspace from the repository after mutations.
- Derive available rankings from reloaded pick history.
- Derive user roster players from reloaded pick history.
- Generate recommendations from reloaded available rankings and user roster.
- Validate draft invariants after reload, including recommendation availability.
- Undo the latest persisted pick.
- Reload again and validate the restored draft state.
- Keep the test at the repository/domain boundary; do not add a UI test dependency.

## Non-Goals

- Real PostgreSQL integration testing.
- Prisma migration testing.
- Browser or React UI testing.
- Full 12-team draft completion.
- Manual QA checklist completion.
- Draft history UI changes.
- New production features.
- New repository methods.
- New schema or migration changes.
- New package dependencies.
- Broad refactoring of existing tests or helpers.

## Expected Files

- `src/lib/draftRepository.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing production code unless the validation exposes a real bug caused by existing behavior. Avoid modifying page UI, components, server actions, Prisma schema, recommendation scoring rules, seed ranking data, or unrelated documentation.

## Test Shape

Add one integration-style repository test to `src/lib/draftRepository.test.ts`, near the existing repository mutation tests.

Use the existing fake DB test pattern in that file. Do not export test helpers or introduce a new test utility module for this slice.

The test should be close to:

```ts
it("preserves draft invariants and recommendation inputs across persisted reload and undo", async () => {
  // create non-default draft workspace
  // draft multiple players
  // reload workspace
  // derive available rankings and user roster players from reloaded workspace
  // generate recommendations
  // assert drafted players are unavailable
  // assert recommendations only contain available players
  // assert draft invariants are valid
  // undo latest pick
  // reload workspace again
  // assert current pick and availability are restored
  // assert draft invariants remain valid
});
```

Use local helper functions in the test file if needed:

- `getAvailableRankings(rankings, draft)`
- `getUserRosterPlayers(rankings, draft)`

Keep helpers small and specific to this test file.

## Expected Behavior

### Setup

- Use a non-default league configuration, such as 4 teams and 3 rounds.
- Use enough rankings to draft several players and still generate recommendations.
- Use a user team id that receives at least one pick in the tested sequence.

### Persist And Reload

- Create the workspace through `repository.createDraftWorkspace`.
- Persist at least three draft picks through `repository.draftPlayerInWorkspace`.
- Reload through `repository.getDraftWorkspaceById`.
- Assert the reloaded draft reflects persisted picks and the correct next pick.

### Derived Inputs

- Build available rankings by removing reloaded drafted player ids from `workspace.rankings`.
- Build user roster players from reloaded picks assigned to `workspace.draft.userTeamId`.
- Generate recommendations with `generateTopRecommendations(availableRankings, { rosterPlayers })`.
- Assert recommendations are non-empty when available rankings remain.
- Assert recommendation rankings are all available.

### Invariants

- Call `isValidDraftState` with:
  - the reloaded draft
  - available rankings
  - user roster players
  - recommendation rankings
- Expect invariants to be valid.

### Undo And Reload

- Call `repository.undoLastPickInWorkspace`.
- Reload again through `repository.getDraftWorkspaceById`.
- Assert the undone player is available again.
- Assert the current pick has moved back correctly.
- Regenerate recommendation inputs from the post-undo reload.
- Assert invariants are still valid.

## Safety Rules

- Do not weaken existing tests.
- Do not replace specific assertions with broad truthy assertions.
- Do not change production behavior solely to satisfy the new test.
- If existing behavior fails this validation and the expected behavior is unclear, stop and report the discrepancy rather than expanding scope.
- Keep the test deterministic and independent of test execution order.

## Testing Strategy

This slice is itself a testing slice.

Required validation:

- Run `npm test`.
- Run `npm run lint`.
- Run `npm run build`.

Manual runtime validation is not required for this slice because the goal is automated workflow coverage. If a local dev server or `.next` file lock blocks `npm run build`, report that separately and do not change the slice scope.

## Implementation Steps

1. Add imports.
   - Import `generateTopRecommendations` in `src/lib/draftRepository.test.ts`.
   - Reuse existing `isValidDraftState` import.

2. Add small local derivation helpers if needed.
   - Add `getAvailableRankings(rankings, draft)`.
   - Add `getUserRosterPlayers(rankings, draft)`.
   - Keep helper return data aligned with existing app derivation behavior in `DraftRoom`.

3. Add the persisted workflow validation test.
   - Use `createFakeDraftDb`.
   - Use `createDraftRepository`.
   - Use `createLeagueSettings({ teamCount: 4, rounds: 3 })`.
   - Create enough rankings across positions to support drafting and recommendations.
   - Draft at least three players.
   - Reload the workspace and assert persisted state.
   - Derive available rankings, user roster, and recommendations.
   - Validate invariants.
   - Undo the latest pick.
   - Reload and validate the restored state and invariants.

4. Update task tracking.
   - In `docs/tasks.md`, mark only the Task 9 scope item directly proven by this slice.
   - Do not mark Task 9 complete.
   - Do not check manual QA or full 12-team completion items.
   - Do not update the Phase 2 validation checklist unless the automated test directly proves a listed item.

5. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- A persisted workflow test covers create, draft, reload, derive, recommend, undo, and reload again.
- The test uses a non-default league configuration.
- The test validates draft invariants after reload.
- The test validates recommendation inputs only reference available players.
- The test proves undo restores the latest persisted pick after reload.
- Existing repository tests still pass.
- No production code is changed unless a real bug is found.
- No React/UI testing dependency is added.
- No Prisma schema, migration, package dependency, or UI change is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes or any environment-specific file lock is reported clearly.

## Manual Test Notes

Manual QA is deferred to a later slice.

This slice does not complete:

- refresh/restart manual validation
- full 12-team persisted draft completion
- real PostgreSQL round-trip validation
- browser-based draft history validation

## Slice Review

- Smallest meaningful increment: yes, it adds one automated workflow validation test rather than trying to finish all Phase 2 QA.
- Concrete enough for implementation: yes, the test setup, derivations, assertions, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it stays inside existing repository tests and fake DB patterns.
- Blast radius reasonable: yes, expected changes are limited to one test file, task tracking, and this slice document.
- Review/revert comfort: yes, the test can be removed independently without affecting production behavior.
- Observable/testable acceptance criteria: yes, success is measured by deterministic test assertions and standard validation commands.
