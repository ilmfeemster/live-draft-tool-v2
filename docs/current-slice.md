# Current Slice: Complete Phase 2 Persistence Validation

## Source Task

Task 13: Complete Phase 2 Persistence Validation.

## Goal

Prove that the persisted manual draft workflow works end to end after the Phase 2 implementation work that is already checked off.

This slice is primarily validation and documentation. It should confirm the behavior that exists, record evidence, and update task tracking only for items that are actually verified.

## User-Visible Increment

- The project has clear evidence that a persisted draft can survive refresh/restart and continue correctly.
- The project has clear evidence that a full persisted 12-team draft can be completed.
- Phase 2 task tracking reflects validated behavior instead of assumed behavior.

## Current Context

`docs/tasks.md` shows Task 12 is complete. The next unchecked task is Task 13.

Task 13 already has several automated coverage items checked:

- Save/load round trips.
- Draft invariants after hydration.
- Recommendation inputs before and after reload.
- Non-default league configuration coverage.

The remaining work is focused on manual QA for refresh/restart and full draft completion from persisted state, plus task/checklist cleanup based on the evidence.

## Scope

### Goals

- Run the existing automated validation commands.
- Create or update a Phase 2 manual QA record for persisted draft behavior.
- Manually verify refresh/restart behavior for an incomplete persisted draft.
- Manually verify reopening a draft from draft history.
- Manually verify recommendations remain derived correctly after reload.
- Manually verify a full 12-team persisted draft can be completed.
- Update `docs/tasks.md` only for validation items proven by this slice.

### Non-Goals

- New persistence features.
- UI redesign.
- New draft-management workflows.
- New package dependencies.
- Broad automated test expansion unless validation exposes a narrow, high-value missing regression.
- Changing production code unless a real validation blocker is found.
- Updating roadmap, architecture, or project scope.

## Expected Files

- `docs/current-slice.md`
- `docs/tasks.md`
- `docs/manual-phase2-persistence-qa.md`

Only add or update source/test files if validation reveals a focused bug or a missing regression that must be fixed before Task 13 can honestly be marked complete.

## Implementation Steps

1. Inspect the minimum context needed.
   - Read `docs/tasks.md`.
   - Read `docs/testing.md`.
   - Read existing manual QA documentation only as a formatting/reference aid.
   - Read source or tests only if a validation failure needs diagnosis.

2. Run automated validation.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Run `npm run prisma:validate` if database/schema validation has not already been covered by the above commands.
   - Record pass/fail results and any environment-specific blockers in the manual QA document.

3. Create Phase 2 manual QA evidence.
   - Create `docs/manual-phase2-persistence-qa.md` if it does not exist.
   - Include date, branch or commit, browser, local app URL, tester, database/precondition notes, and overall result.
   - Keep this document focused on persistence validation, not Phase 1 general draft behavior.

4. Validate incomplete draft persistence.
   - Start the app locally.
   - Create or load a disposable persisted draft.
   - Make several picks.
   - Refresh the browser.
   - Confirm picks, current pick, available players, roster, and recommendations still reflect the persisted state.
   - Restart the dev server if practical.
   - Reopen the app and confirm the same persisted state loads.

5. Validate draft history resume.
   - Create or identify at least two disposable drafts.
   - Make picks in one draft.
   - Switch away using draft history.
   - Resume the picked draft from history.
   - Confirm picks, available players, roster, and recommendations are restored.

6. Validate recommendation derivation after reload.
   - Record the top recommendation or recommendation set before reload.
   - Refresh or restart.
   - Confirm recommendations contain only available players.
   - Confirm drafted players are excluded.
   - Confirm recommendations are consistent with the restored draft state.

7. Validate full persisted draft completion.
   - Complete a disposable 12-team, 16-round persisted draft.
   - Confirm the draft reaches completion.
   - Confirm all 192 picks are made exactly once.
   - Confirm extra picks are blocked or unavailable after completion.
   - Refresh after completion and confirm the completed state remains loaded or resumable.

8. Update task tracking.
   - In Task 13, check manual QA completion only after the manual QA document records passing evidence.
   - In the Phase 2 validation checklist, check only items proven by this slice.
   - Do not mark Task 13 complete if any acceptance criterion remains unverified.
   - Do not check unrelated backlog or future-scope items.

9. Stop if validation exposes a bug.
   - Record the failing step, expected behavior, actual behavior, and any relevant draft id or pick number.
   - Do not expand the slice into a broad fix.
   - If the fix is small and directly blocks validation, ask before implementing it or create a focused follow-up slice.

## Acceptance Criteria

- `npm test` passes or an environment-specific blocker is documented.
- `npm run lint` passes or an environment-specific blocker is documented.
- `npm run build` passes or an environment-specific blocker is documented.
- Prisma schema validation passes or the reason it was not run is documented.
- A Phase 2 persistence manual QA document exists.
- Manual QA confirms a persisted incomplete draft survives refresh or restart.
- Manual QA confirms a draft can be reopened from draft history with picks and derived state restored.
- Manual QA confirms recommendations remain derived from available players after reload.
- Manual QA confirms a full 12-team persisted draft can be completed.
- Manual QA confirms the completed draft remains valid after refresh.
- `docs/tasks.md` is updated only for proven Task 13 and Phase 2 validation checklist items.

## Manual QA Notes

Use disposable local drafts. Do not delete or overwrite useful local data while validating.

Suggested evidence to record:

- Date and tester.
- Branch or commit.
- Browser and local URL.
- Database/precondition notes.
- Automated command results.
- Draft ids or draft names used for incomplete, resumed, and completed validation.
- Pass/fail result for each acceptance criterion.
- Any blockers, follow-up tasks, or ambiguous observations.

## Slice Review

- Smallest meaningful increment: yes. It validates the remaining Phase 2 persistence behavior without adding new product capability.
- Concrete enough for implementation: yes. The validation commands, manual QA flows, evidence document, and task updates are specified.
- Avoids unnecessary architecture changes: yes. Production changes are out of scope unless validation reveals a focused blocker.
- Blast radius reasonable: yes. Expected changes are limited to documentation and task tracking.
- Review/revert comfort: yes. The slice can be reviewed as validation evidence plus checklist updates.
- Observable/testable acceptance criteria: yes. Each criterion can be confirmed through command output or manual QA evidence.
