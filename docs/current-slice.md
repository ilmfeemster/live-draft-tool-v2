# Current Slice: Complete Phase 3 Validation

## Source Context

Task 11: Phase 3 Completion Validation.

Phase 3 Tasks 1-10 are complete. The Recommendation Engine is implemented, covered by deterministic unit and scenario tests, wired into manual and persisted draft workflows, and validated through the Draft Room render boundary.

The remaining phase-exit work is to rerun the existing automated evidence and complete a short manual QA flow against the persisted Draft Room. This slice validates existing behavior; it does not add recommendation features or begin Phase 4.

## Goal

Close Phase 3 by recording passing automated validation and completing a reproducible manual QA checklist for visible recommendation updates, undo restoration, and persisted refresh/resume behavior.

## Scope

### Goals

- Run the focused Recommendation Engine tests that cover scoring, modifiers, ordering, reasons, determinism, and representative scenarios.
- Run the workflow tests that cover manual picks, undo restoration, persisted parity, workspace loading, and rendered recommendation presentation.
- Run the full Vitest suite, ESLint, and TypeScript no-emit validation.
- Complete the manual QA checklist below using a fresh persisted draft.
- Record enough manual evidence to reproduce or diagnose the result.
- Confirm Phase 3 non-goals were not introduced.
- Check Task 11 complete only after automated and manual validation pass.

### Non-Goals

- Changing Recommendation Engine scoring, modifier weights, reason selection, or tuning.
- Adding or weakening automated tests unless validation exposes a direct Phase 3 coverage defect.
- Fixing unrelated production defects during this validation slice.
- Redesigning the Draft Room or recommendation presentation.
- Completing another full 12-team, 16-round draft; Phase 1 already records that QA.
- Adding browser automation, a DOM test dependency, or package dependencies.
- Updating project scope, architecture, decisions, or roadmap documents.
- Beginning Phase 4 replay or simulator work.

## Expected Files

- `docs/current-slice.md`
- `docs/tasks.md`

No source or test file should change when validation passes. If validation exposes a direct Phase 3 defect, stop and report it so a focused corrective slice can be planned instead of expanding this slice.

## Automated Validation

Run these commands from the repository root in the listed order.

### 1. Recommendation behavior and scenarios

```txt
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts
```

Expected result:

- Both test files pass unchanged.
- Coverage includes base value, roster fit, value opportunity, tier-drop risk, scarcity, run pressure, bounded scores, deterministic ordering, and score-backed reasons.
- Scenario coverage demonstrates context-sensitive ordering while preserving elite base value.

### 2. Manual and persisted workflow boundaries

```txt
npm test -- src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/draftWorkspaceLoader.test.ts src/components/DraftRoom.test.tsx
```

Expected result:

- All four test files pass unchanged.
- Pick and undo tests prove recommendation updates and exact restoration.
- Repository tests prove equivalent in-memory and hydrated state produce equivalent recommendations.
- Loader tests prove selected/latest workspace behavior.
- Draft Room rendering proves engine order, scores, reasons, drafted-player exclusion, user team identity, and non-default league settings reach presentation intact.

### 3. Full project validation

```txt
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.

## Manual QA Preconditions

- [ ] Local dependencies are already installed.
- [ ] PostgreSQL is running.
- [ ] `DATABASE_URL` points to the intended local development database.
- [ ] The current Prisma schema has already been applied to that database.
- [ ] The app starts with `npm run dev` and the terminal reports its local URL.
- [ ] The browser is opened to that exact local URL.
- [ ] No production source or persisted fixture data is edited during the QA run.

If any precondition fails, record it as a blocker. Do not change application behavior merely to complete QA.

## Manual QA Evidence

Record before executing the checklist:

- Date:
- Commit or branch:
- Browser and version:
- App URL:
- QA draft ID from the URL after creation:
- Tester:
- Automated validation result: Pass / Fail
- Manual validation result: Pass / Fail
- Notes or failure reproduction:

For recommendation comparisons, record player name, displayed score, and displayed reasons in visible order:

| Checkpoint | Pick | Ordered recommendations, scores, and reasons |
| --- | ---: | --- |
| A: Before user pick | 2 | |
| B: After user pick | 3 | |
| C: After undo | 2 | |
| D: After re-draft and refresh | 3 | |

## Manual QA Checklist

### 1. Create an isolated persisted draft

- [ ] Click `Start New Draft`.
- [ ] If the current draft is in progress, accept the confirmation only after confirming it will preserve the existing draft in history.
- [ ] Confirm the URL contains a new `draftId`.
- [ ] Record that ID as the QA draft ID.
- [ ] Confirm `Current Pick` is 1, recommendations are visible, and `Your Roster` has no drafted players.
- [ ] Confirm each visible recommendation includes a score and at least one visible reason where the engine supplies reasons.

Expected result: a fresh persisted draft loads without altering older draft history, and recommendations contain only currently available players.

### 2. Advance to the first user pick

- [ ] In `Available Players`, record the highest-ranked available player at pick 1.
- [ ] Draft that player using the table's `Draft` button.
- [ ] Confirm `Current Pick` advances from 1 to 2 and the panel shows `Your pick` for Team 2.
- [ ] Confirm the drafted player is absent from both `Available Players` and `Recommendations`.
- [ ] Record checkpoint A: all visible recommendations in order, including each displayed score and reason text.

Expected result: the persisted opponent pick changes availability, advances draft state exactly once, and recommendations are recomputed for the user's pick.

### 3. Make and verify the user pick

- [ ] Draft the first recommendation using its `Draft` button.
- [ ] Confirm `Current Pick` advances from 2 to 3.
- [ ] Confirm the selected player disappears from `Available Players` and `Recommendations`.
- [ ] Confirm the selected player appears exactly once in `Your Roster` with pick number 2 and the correct position.
- [ ] Record checkpoint B in visible recommendation order with scores and reasons.
- [ ] Confirm checkpoint B differs from checkpoint A because the selected player is no longer available.
- [ ] Confirm every displayed recommendation still refers to an available player.

Expected result: a manual user pick updates availability, roster state, scores, ordering, and visible score-backed reasons without a reload.

### 4. Verify undo and deterministic restoration

- [ ] Click `Undo Last Pick` once.
- [ ] Confirm `Current Pick` returns from 3 to 2.
- [ ] Confirm the undone player returns to `Available Players`.
- [ ] Confirm the undone player is removed from `Your Roster`.
- [ ] Record checkpoint C in visible recommendation order with scores and reasons.
- [ ] Compare checkpoints C and A exactly.
- [ ] Confirm player order, displayed scores, and reason text all match.

Expected result: undo restores the exact recommendation presentation for the identical draft state.

### 5. Verify persisted refresh/resume parity

- [ ] Draft the same first recommendation again at pick 2.
- [ ] Confirm `Current Pick` advances to 3 and the player returns to `Your Roster` at pick 2.
- [ ] Record the visible recommendations, scores, and reasons before refreshing.
- [ ] Refresh the browser at the same URL without changing `draftId`.
- [ ] Confirm the same QA draft remains selected in draft history.
- [ ] Confirm `Current Pick` remains 3.
- [ ] Confirm the pick-2 player remains on `Your Roster` exactly once.
- [ ] Record checkpoint D after refresh.
- [ ] Confirm checkpoint D exactly matches the pre-refresh recommendation order, scores, and reasons.
- [ ] Confirm neither drafted player appears in `Available Players` or `Recommendations`.

Expected result: loading persisted state recomputes the same recommendation presentation as the equivalent in-memory state.

### 6. Scope and usability review

- [ ] Confirm the short flow exposed deterministic scores and concrete reason text rather than AI-generated or unsupported advice.
- [ ] Confirm no simulation, opponent prediction, live-provider integration, strategy profile, or other Phase 3 non-goal appeared in the workflow.
- [ ] Confirm the app did not crash, freeze, duplicate a pick, or lose the active draft during the flow.
- [ ] Record any failure with the exact checkpoint, player, pick number, expected result, observed result, and reproduction steps.

## Failure Handling

- If an automated command fails because of this phase's code or tests, stop and report the failing command and test output.
- If manual QA exposes a reproducible product defect, stop and document the exact reproduction. Do not fix it inside this validation slice.
- If infrastructure prevents manual QA, leave Task 11 unchecked and report the unmet precondition.
- Do not weaken an assertion, reinterpret a failed expectation, or check Task 11 complete while evidence is incomplete.

## Task Status Update

After every automated command and manual checklist item passes:

- Among task completion checkboxes, change only Task 11 in `docs/tasks.md` from unchecked to checked.
- Update the `Current Focus` summary in `docs/tasks.md` to state that Phase 3 validation is complete without promoting or starting Phase 4.
- Update the Phase 3 testing-status paragraph in `docs/tasks.md` to state that Phase 3 validation is complete and briefly record the automated and manual evidence.
- Do not archive Phase 3 tasks or promote Phase 4 in this slice.
- Stop after reporting the phase-validation result.

## Acceptance Criteria

- Focused Recommendation Engine and scenario tests pass unchanged.
- Focused workflow, repository, loader, and Draft Room presentation tests pass unchanged.
- The full Vitest suite passes.
- ESLint passes with no errors or warnings.
- `npx tsc --noEmit` passes.
- Manual QA confirms recommendations update after an opponent pick and a user pick.
- Manual QA confirms drafted players leave availability and recommendations.
- Manual QA confirms the user's pick appears exactly once on the user roster.
- Manual QA confirms undo restores the prior recommendation order, displayed scores, and exact reason text.
- Manual QA confirms refresh/resume preserves draft state and recomputes identical visible recommendations.
- Automated scenario evidence confirms context can reorder static rankings while base value remains the anchor.
- Automated component and reason tests confirm roster fit, value opportunity, tier pressure, scarcity, run pressure, and score-backed explanations are observable and bounded.
- Phase 3 non-goals remain absent.
- No package dependency is added.
- No production or test code changes when existing behavior passes.
- Task 11 is checked complete only after all evidence passes.
- Phase 4 is not started.

## Follow-Up Slice

After Task 11 is complete, plan the smallest Phase 4 slice from the approved project and roadmap direction. Do not begin Phase 4 automatically.

## Slice Review

- Smallest meaningful increment: yes. It contains only the automated and manual exit checks needed to close Phase 3.
- Concrete enough for implementation: yes. Commands, preconditions, UI labels, checkpoints, evidence fields, expected results, and failure handling are explicit.
- Avoids unnecessary architecture changes: yes. This is validation-only unless a failure requires a separately planned corrective slice.
- Blast radius reasonable: yes. Only `docs/current-slice.md` and the Task 11/testing-status lines in `docs/tasks.md` should change when validation passes.
- Review/revert comfort: yes. The slice is documentation and completion status with no planned production changes.
- Observable/testable acceptance criteria: yes. Automated exits and manual pick, undo, refresh, roster, availability, score, order, and reason checks are directly observable.
