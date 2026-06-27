# Current Slice: Complete Recommendation Workflow Presentation Validation

## Source Context

Task 10: Wire Recommendation Engine Into Draft Workflow.

The production wiring is already implemented:

- `src/app/page.tsx` passes the hydrated draft, ranking snapshot, and league settings into `DraftRoom`.
- `DraftRoom` calls `generatePlayerRecommendations` with the active draft, rankings, league settings, and persisted user team identity.
- `RecommendationsPanel` displays engine ordering, total scores, and score-backed reason text.
- Existing workflow tests prove recommendations update after picks and return to the prior output after undo.
- Existing repository tests prove persisted hydration produces the same recommendations as equivalent in-memory state.
- The full test suite, lint, and TypeScript no-emit validation currently pass.

The remaining Task 10 gap is a focused presentation-boundary test proving that a loaded workspace reaches the rendered draft room with engine ordering, scores, and reasons intact.

## Goal

Complete Task 10 with an integration-style render test that loads a typed persisted-workspace fixture through the existing workspace loader, renders the existing Draft Room, and verifies its visible recommendations against direct output from the pure Recommendation Engine.

## Scope

### Goals

- Exercise `loadDraftWorkspace` with a typed, non-default workspace fixture.
- Render `DraftRoom` from the loaded workspace's draft, rankings, and league settings.
- Compute expected recommendations directly with `generatePlayerRecommendations` using the same loaded domain inputs.
- Verify the rendered recommendation order matches engine order.
- Verify displayed scores use each recommendation's `totalScore` rounded to one decimal place.
- Verify displayed reasons use the exact engine-provided `reason.text` values.
- Confirm the loaded fixture's persisted picks affect availability before rendering.
- Re-run the existing manual pick, undo, and persistence-parity tests as regression evidence.
- Check off Task 10 only after all focused and full validation passes.

### Non-Goals

- Changing production recommendation, draft, loader, repository, or UI code unless the new test exposes a direct Task 10 defect.
- Adding React Testing Library, a DOM emulator, or any package dependency.
- Simulating clicks or duplicating the existing workflow transition tests.
- Redesigning recommendation presentation.
- Adding browser automation or completing the Phase 3 manual QA required by Task 11.
- Changing scoring behavior, tuning, reason selection, persistence shape, or draft invariants.
- Beginning Task 11.

## Expected Files

- `docs/current-slice.md`
- `src/components/DraftRoom.test.tsx`
- `docs/tasks.md`

Production files should remain unchanged unless the focused test reveals a direct wiring defect.

## Implementation Details

### Loaded Workspace Fixture

In `src/components/DraftRoom.test.tsx`:

- Create a small typed `DraftWorkspace` fixture with:
  - non-default team and round counts;
  - non-default roster slots;
  - a ranking set large enough to produce multiple recommendations and score-backed reasons;
  - at least one persisted pick so drafted-player exclusion is observable;
  - a user team identity carried by the draft.
- Use the existing draft-order and draft-state helpers where practical instead of hand-encoding inconsistent pick metadata.
- Provide the fixture through an injected fake repository to `loadDraftWorkspace`.
- Keep the fake repository local and minimal; do not create shared test infrastructure.

### Draft Room Render Boundary

- Mock `next/navigation` so `useRouter` returns the minimal router surface needed during render.
- Mock `@/app/actions/draftActions` so importing `DraftRoom` does not cross into persistence or server-action runtime behavior.
- Use React's existing `renderToStaticMarkup` API; do not add a DOM test dependency.
- Render `DraftRoom` with `result.workspace.draft`, `result.workspace.rankings`, and `result.workspace.leagueSettings` from `loadDraftWorkspace`.

### Engine-to-Presentation Assertions

- Generate expected output by calling `generatePlayerRecommendations` with the loaded workspace fields and `workspace.draft.userTeamId`.
- Assert the persisted drafted player is absent from both expected recommendations and rendered recommendation rows.
- Assert expected player names appear in engine order by comparing their positions in the rendered markup.
- For each rendered recommendation under test, assert the markup contains:
  - `Score ${recommendation.totalScore.toFixed(1)}`;
  - every `recommendation.reasons[].text` value.
- Assert at least one expected recommendation contains a reason so reason validation cannot pass vacuously.
- Prefer player names and reason strings that do not rely on HTML escaping; if escaping is unavoidable, compare against the rendered representation explicitly.
- Do not assert CSS class strings or unrelated Draft Room markup.

### Existing Regression Evidence

Do not duplicate existing pick and undo scenarios. Re-run:

- `src/lib/draftWorkflow.test.ts` for manual pick updates and exact recommendation restoration after undo.
- `src/lib/draftRepository.test.ts` for recommendation parity across persistence hydration.
- `src/lib/draftWorkspaceLoader.test.ts` for selected/latest workspace loading behavior.

If any of these fail for reasons unrelated to this slice, stop and report the blocker rather than broadening scope.

### Task Status

After all acceptance criteria pass:

- Change only the Task 10 completion checkbox in `docs/tasks.md` from unchecked to checked.
- Do not alter Task 10 wording, Task 11 status, testing-status prose, or backlog content.

## Implementation Steps

1. Add the focused Draft Room integration test.
   - Build the typed non-default persisted-workspace fixture.
   - Inject it through `loadDraftWorkspace`.
   - Mock navigation and draft actions at module boundaries.
   - Render the loaded workspace with `renderToStaticMarkup`.

2. Compare presentation with pure engine output.
   - Generate expected recommendations from the loaded domain fields.
   - Assert drafted-player exclusion, recommendation ordering, formatted scores, and exact reason text.
   - Keep assertions independent from CSS and unrelated panels.

3. Run focused validation.
   - Run `npm test -- src/components/DraftRoom.test.tsx src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/draftWorkspaceLoader.test.ts`.
   - Run `npx tsc --noEmit`.
   - Fix only direct defects introduced or exposed by this slice.

4. Run full validation.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npx tsc --noEmit` again after final edits.

5. Complete Task 10.
   - Check only the Task 10 completion checkbox in `docs/tasks.md` after all validation succeeds.
   - Stop without beginning Task 11.

## Acceptance Criteria

- A loaded typed workspace renders recommendations through `DraftRoom` without persistence-shaped inputs entering the engine.
- The rendered player order matches `generatePlayerRecommendations` output for the loaded workspace.
- A player already drafted in the persisted fixture is absent from recommendations.
- Rendered scores match engine `totalScore` values formatted to one decimal place.
- Rendered reason text exactly matches score-backed engine reasons.
- The integration fixture proves non-default league and roster settings reach the Recommendation Engine.
- Existing manual pick and undo recommendation tests pass unchanged.
- Existing persisted recommendation parity and workspace-loader tests pass unchanged.
- The full Vitest suite passes.
- Lint passes.
- `npx tsc --noEmit` passes.
- No package dependency is added.
- Task 10 is checked complete only after successful validation.
- Task 11 remains unchecked and is not started.

## Suggested Tests

- Focused Draft Room render integration test.
- Existing draft workflow tests.
- Existing repository persistence-parity tests.
- Existing workspace-loader tests.
- Full Vitest regression suite.
- ESLint.
- TypeScript no-emit validation.

## Validation Notes

Expected commands:

```txt
npm test -- src/components/DraftRoom.test.tsx src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/draftWorkspaceLoader.test.ts
npx tsc --noEmit
npm test
npm run lint
npx tsc --noEmit
```

## Follow-Up Slice

Plan Task 11: Phase 3 Completion Validation, including the short manual draft-room QA required before Phase 3 is marked complete.

Do not begin Task 11 automatically.

## Slice Review

- Smallest meaningful increment: yes. It adds the one missing presentation-boundary proof and then closes the already implemented Task 10.
- Concrete enough for implementation: yes. The fixture, mocks, render mechanism, expected-output source, assertions, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It adds test coverage around existing boundaries with no planned production change.
- Blast radius reasonable: yes. One new test file and one task checkbox are expected beyond this slice document.
- Review/revert comfort: yes. The implementation is isolated test coverage plus a completion-status change.
- Observable/testable acceptance criteria: yes. Ordering, exclusion, scores, reasons, dynamic settings, regressions, lint, and TypeScript validation all have direct checks.
