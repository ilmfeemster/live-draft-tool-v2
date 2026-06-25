# Test Tasks

## Current Testing Phase

The project has completed Roadmap Phase 1 testing for the Draft State Engine/manual draft simulator scope.

The completed testing work builds confidence that the app can represent and progress a manual snake draft accurately in memory.

Completed Phase 1 testing covers:

- Draft engine logic
- Draft state transitions
- Manual draft workflow basics
- Available player tracking
- User roster tracking
- Undo behavior
- Basic recommendation updates from draft state
- Manual full-draft validation

Avoid planning tests for Phase 2+ work such as persistence, replay systems, live provider sync, accounts, advanced strategy, or production hardening.

---

## Task 1: Configure Unit Test Runner

Status: [x]

### Goal

Add the minimum automated test infrastructure needed to run deterministic business-logic tests.

### Test Type

- Unit

### Scope

- Install a lightweight TypeScript-friendly unit test runner.
- Add an `npm test` script.
- Add test configuration for existing TypeScript path aliases.
- Add one small smoke test or first real unit test to prove the runner works.

### Non-Goals

- Browser tests.
- React component tests.
- Coverage thresholds.
- CI setup.
- Snapshot testing.
- Broad test utility abstractions.

### Acceptance Criteria

- `npm test` exists and runs from the command line.
- The test runner can import project files using the `@` alias.
- At least one test executes successfully.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 2: Add Draft Order Unit Tests

Status: [x]

### Goal

Validate the pure snake draft order helpers that determine round, pick-in-round, draft position, and team assignment.

### Test Type

- Unit

### Scope

- Test `getRoundForPick`.
- Test `getPickInRound`.
- Test `getDraftPositionForPick`.
- Test `generateSnakeDraftOrder`.
- Use small draft sizes such as 4 teams and 2 or 3 rounds for readable expectations.
- Include at least one test for the configured MVP shape: 12 teams and 16 rounds.

### Non-Goals

- Manual pick entry tests.
- UI rendering tests.
- Recommendation tests.
- Persistence or database tests.

### Acceptance Criteria

- Odd rounds assign draft positions from first to last.
- Even rounds assign draft positions from last to first.
- Generated pick count equals `teamCount * rounds`.
- Generated picks include the expected `pickNumber`, `round`, `pickInRound`, and `teamId`.
- MVP draft order produces 192 picks for 12 teams and 16 rounds.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 3: Add Draft State Transition Tests

Status: [x]

### Goal

Validate the draft-state changes that happen when a player is drafted or a pick is undone.

### Test Type

- Unit

### Scope

- Test drafting a player into the current pick.
- Test advancing `currentPickNumber`.
- Test preventing duplicate drafted players.
- Test blocking picks after the draft is complete.
- Test undoing the most recent pick.
- Test undo when no picks have been made.

### Non-Goals

- UI click tests.
- Roster display tests.
- Recommendation scoring tests.
- Large refactors.

### Acceptance Criteria

- Drafting a valid player assigns that player to the current pick.
- Drafting advances the draft by exactly one pick until the draft is complete.
- Duplicate player IDs cannot be assigned to multiple picks.
- Extra picks are blocked after the final pick.
- Undo clears only the latest drafted pick and restores `currentPickNumber`.
- Undo on an empty draft leaves draft state unchanged.
- `npm test`, `npm run lint`, and `npm run build` pass.

### Implementation Note

If the transition logic is still local to a React component, the implementation slice may extract only the smallest pure helper needed to test the existing behavior. Do not redesign draft state management.

---

## Task 4: Add Draft Invariant Tests

Status: [x]

### Goal

Validate that important draft invariants remain true after picks and undo actions.

### Test Type

- Unit

### Scope

- Test invariant checks against draft states produced by Phase 1 draft actions.
- Validate that drafted players do not remain available.
- Validate that drafted player count matches draft progress.
- Validate that each drafted player belongs to exactly one pick/team.
- Validate that undo restores a previously valid draft state.

### Non-Goals

- Exhaustive property-based testing.
- UI tests.
- Database constraints.
- Live provider event tests.

### Acceptance Criteria

- Invariants pass for a valid empty draft.
- Invariants pass after one or more picks.
- Invariants pass after undo.
- A duplicate drafted player state is detected as invalid.
- A recommendation or available-player list containing a drafted player is detected as invalid where practical.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 5: Add Basic Recommendation Update Tests

Status: [x]

### Goal

Validate the Phase 1 requirement that recommendations are derived from current draft state and only include available players.

### Test Type

- Unit

### Scope

- Test that drafted players are excluded before generating recommendations.
- Test that recommendations return a limited list for available rankings.
- Test that recommendation output changes when the available player pool changes.
- Test that basic roster input can influence recommendation output.

### Non-Goals

- Deep recommendation strategy tests.
- Exhaustive scoring modifier coverage.
- Large scenario libraries.
- Advanced recommendation insight tests.
- Future-pick planning tests.

### Acceptance Criteria

- Recommendation results do not include drafted players.
- Recommendation results respect the requested limit.
- Recommendation results update when a player is removed from the available pool.
- A simple roster need case affects recommendation scoring or ordering.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 6: Add Manual Full-Draft QA Checklist

Status: [x]

### Goal

Create a repeatable manual QA checklist for validating a complete Phase 1 mock draft.

### Test Type

- Manual QA

### Scope

- Document the exact manual steps for completing a full 12-team, 16-round mock draft.
- Include checks for draft start, manual pick entry, available-player removal, roster updates, recommendation updates, undo, duplicate prevention, and draft completion.
- Define what evidence should be recorded after the checklist is completed.

### Non-Goals

- Automated browser tests.
- Platform integration tests.
- Performance testing.
- Accessibility audits.

### Acceptance Criteria

- Manual QA instructions are clear enough to be repeated by another implementation pass.
- Checklist covers the Phase 1 success path from draft start through draft completion.
- Checklist includes undo validation.
- Checklist includes draft invariant spot checks.
- Checklist defines pass/fail notes for each major workflow area.

---

## Task 7: Add Basic Draft Workflow Integration Test

Status: [x]

### Goal

Validate the interaction between draft state, available players, roster derivation, and basic recommendations for a small manual draft workflow.

### Test Type

- Integration

### Scope

- Use a small inline draft and ranking dataset.
- Simulate several picks through the same draft-state helpers used by the app.
- Verify drafted players are removed from available rankings.
- Verify user-team picks appear in the derived roster.
- Verify recommendations are regenerated from remaining players.

### Non-Goals

- Full 12-team draft automation.
- Browser or React component testing.
- Advanced recommendation scenario testing.
- Persistence, replay, or live provider tests.

### Acceptance Criteria

- The test starts from an empty valid draft state.
- The test applies multiple manual picks.
- Available players update after each pick.
- User roster derivation reflects user-team picks.
- Recommendations only include available players.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 8: Add Draft Completion And Undo Hardening Tests

Status: [x]

### Goal

Validate full small-draft completion and undo behavior after a draft has been fully filled.

### Test Type

- Integration
- Unit

### Scope

- Add a small full-draft completion test that drafts every pick.
- Confirm the completed draft state remains valid.
- Confirm all picks are filled exactly once.
- Confirm no available rankings or recommendations remain when all inline players are drafted.
- Add undo coverage after a draft is complete.

### Non-Goals

- Full 12-team automated draft.
- Browser or React component testing.
- New draft completion production behavior.

### Acceptance Criteria

- A full small draft can be completed in tests.
- The completed draft is valid.
- Undo after a completed draft clears the final pick.
- Undo after completion restores `currentPickNumber` to the final pick.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 9: Add Recommendation Modifier Behavior Tests

Status: [x]

### Goal

Strengthen recommendation confidence by testing modifier behavior and recommendation reasons without asserting exact scores.

### Test Type

- Unit

### Scope

- Test roster need modifier behavior through recommendation ordering.
- Test tier-drop modifier behavior through recommendation ordering.
- Test positional scarcity modifier behavior through recommendation ordering.
- Test recommendation reasons include ranking, ADP, and active modifier explanations.

### Non-Goals

- Exact score snapshot testing.
- Exhaustive recommendation scenario suite.
- Future-pick planning or advanced strategy tests.

### Acceptance Criteria

- Roster need can move a player ahead of a slightly higher-ranked player.
- Tier-drop risk can move a player ahead of a slightly higher-ranked player.
- Positional scarcity can move a player ahead of a slightly higher-ranked player.
- Recommendation reasons expose the active business rationale.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Task 10: Record Phase 1 Testing Completion

Status: [x]

### Goal

Reconcile the testing documentation now that Phase 1 automated and manual QA coverage has reached the completion signal.

### Test Type

- Documentation
- Planning

### Scope

- Confirm the Phase 1 completion signal in `docs/test-tasks.md` reflects the completed coverage.
- Update `docs/testing.md` to record the current Phase 1 testing status.
- Update `docs/tasks.md` if needed to keep validation/completion language aligned with the testing work.
- Identify the next testing direction at a high level without planning Phase 2 implementation in detail.

### Non-Goals

- Adding new automated tests.
- Changing production code.
- Expanding into Phase 2 feature work.
- Rewriting the testing strategy.
- Creating a large roadmap.

### Acceptance Criteria

- Testing docs clearly say Phase 1 testing is complete or identify the remaining blocker.
- Any next testing direction is framed as future work, not active implementation.
- No source files are changed.
- No test task checkboxes other than Task 10 are changed.
- `npm test`, `npm run lint`, and `npm run build` pass if validation is run.

---

## Phase 1 Completion Signal

Phase 1 testing is sufficient when:

- Unit test infrastructure exists.
- Draft order helpers are covered.
- Draft state transitions are covered.
- Core draft invariants are covered.
- Basic recommendation updates from draft state are covered.
- Full small-draft completion and undo-after-complete are covered.
- Recommendation modifier behavior and reasons are covered.
- A repeatable manual full-draft QA checklist exists.
- The manual checklist passes for a complete 12-team, 16-round mock draft.

This does not mean the whole product is fully tested. It means the current Draft State Engine phase has appropriate testing depth.
