# Testing

## Goal

Define the testing strategy for the active project.

This document describes:

- What should be tested.
- What confidence is required before work is considered complete.
- How testing effort should be prioritized.
- How testing work should be planned.

This document defines testing strategy, not implementation tasks.

---

## Testing Philosophy

The project prioritizes confidence and correctness over test quantity.

Favor tests that validate observable behavior rather than implementation details.

Prioritize testing:

- Business logic
- Draft state transitions
- Recommendation behavior
- Data transformations
- User-facing workflows

Avoid writing tests solely to increase coverage metrics.

Testing should scale with the maturity and complexity of the application.

---

## Testing Documentation Workflow

Testing documentation follows the same progressive planning model as development.

```text
testing.md
        ↓
test-tasks.md
        ↓
current-slice.md
```

Each document adds detail without duplicating the previous level.

### testing.md

Defines:

- testing strategy
- testing priorities
- acceptance expectations
- testing principles

### test-tasks.md

Defines:

- executable testing work
- testing milestones
- task completion status

### current-slice.md

Defines:

- one focused testing implementation slice

---

## Testing Task Workflow

If `docs/test-tasks.md` does not exist when planning testing work, create it.

When asked to create or update testing tasks:

1. Read `docs/testing.md`.
2. Identify the requested testing area.
3. Break the work into small, reviewable testing tasks.
4. Replace or update `docs/test-tasks.md`.
5. Keep testing tasks independent whenever practical.

Testing tasks should remain implementation-focused rather than strategy-focused.

---

## Creating Testing Tasks

Testing tasks should represent vertical slices of testing work.

Each task should have:

```md
## Task

### Goal

### Test Type

- Unit
- Integration
- Scenario
- Regression
- Manual QA

### Scope

### Non-Goals

### Acceptance Criteria
```

Tasks should be:

- independently reviewable
- independently executable
- independently reversible

Avoid combining unrelated testing work into a single task.

---

## Creating Testing Slices

A testing task is not a testing slice.

When creating a testing slice:

- Select a single testing task.
- Keep the slice narrowly focused.
- Define exactly what should be tested.
- Avoid expanding into unrelated production code.
- Include observable acceptance criteria.

Testing slices should generally modify only the tests required for the selected task.

---

# Active Testing Scope

Current testing effort should focus on the active project.

Prioritize confidence in:

- Draft setup
- Manual draft workflow
- Draft state transitions
- Available player tracking
- User roster tracking
- Recommendation updates
- Undo functionality
- Complete draft completion

Avoid investing heavily in testing future capabilities before they become active project work.

---

# Testing Priorities

## Unit Tests

Unit tests should receive the greatest investment.

Prioritize deterministic business logic.

Examples include:

### Draft Engine

- Snake draft order generation
- Round calculation
- Pick number calculation
- Active team calculation
- Draft state transitions

### Recommendation Engine

- Ranking score calculation
- Roster need modifiers
- Positional scarcity modifiers
- Tier-drop modifiers
- Recommendation ordering
- Recommendation explanation generation

### Validation

- Ranking validation
- Duplicate player prevention
- Draft state validation

---

## Integration Tests

Verify interactions between application components.

Examples:

### Rankings

- Import rankings
- Load rankings into draft state

### Draft Flow

- Draft player
- Remove player from available pool
- Advance draft
- Update recommendations

### Roster Tracking

- Add drafted players
- Update position counts
- Update roster needs

---

## Scenario Tests

Scenario tests validate complete draft situations.

Each scenario should define:

- Draft state
- Available players
- User roster
- League settings
- Expected recommendation ordering
- Expected recommendation reasoning

Scenario tests become increasingly valuable as recommendation complexity grows.

---

## Regression Tests

Every significant bug fix should include a regression test whenever practical.

Regression tests should verify:

- Previously fixed bugs remain fixed.
- Recommendation behavior remains stable.
- Existing scenarios continue producing expected results.

Update expected behavior only when recommendation logic intentionally changes.

---

## Manual QA

Manual testing validates complete user workflows.

Manual testing should confirm:

- Core workflow remains usable.
- Recommendations appear correctly.
- Draft state remains valid.
- Common user interactions behave as expected.

Manual QA complements automated testing rather than replacing it.

---

# Draft Invariants

The following conditions should remain true after every draft action.

- A player exists in exactly one location.
- Drafted players never appear in the available player pool.
- Available players never appear on a roster.
- Total drafted players equals the current pick number minus one.
- Every drafted player belongs to exactly one team.
- Undo restores the previous valid draft state.
- Recommendation results only contain available players.

Whenever practical, invariants should be validated directly by automated tests.

---

# Acceptance Criteria

A feature should not be considered complete until:

- Relevant acceptance criteria have been satisfied.
- Required automated tests pass.
- Manual validation has been completed when appropriate.
- Existing regression tests continue passing.
- New regression tests have been added for significant bug fixes.

Testing depth should remain proportional to feature complexity.

---

# Testing Principles

Always prefer:

- Deterministic tests
- Business logic tests
- Behavior-based assertions
- Small independent tests
- Readable test names
- Stable test data

Avoid:

- Testing framework internals
- Styling
- Temporary implementation details
- Brittle UI tests
- Excessive mocking
- Tests that duplicate other tests

---

# Testing Maturity

Testing depth should match the current maturity of the system.

Do not build the full testing suite before the product logic requires it.

## Manual Draft Simulator Stage

When the app is mainly a manual draft simulator/dev tool, testing should stay basic.

Focus on:

- Draft can start
- Picks can be entered
- Draft order advances correctly
- Drafted players become unavailable
- User roster updates
- Undo works
- Basic recommendations update after picks
- A full mock draft can be completed manually

Testing level:

- Unit tests for draft engine logic
- Basic integration tests for draft workflow
- Manual QA checklist for full draft completion

Avoid heavy testing of:

- UI polish
- edge-case recommendation behavior
- advanced scenarios
- live sync
- platform integration

## Recommendation Engine Stage

When recommendation logic becomes a major product focus, increase testing depth.

Add:

- Recommendation scoring tests
- Modifier tests
- Recommendation ordering tests
- Scenario tests
- Regression tests
- Explanation tests

Each meaningful recommendation rule should usually have tests for:

- when it applies
- when it does not apply
- how it affects ordering
- what reason or warning it produces

## Strategy / Insight Stage

When the product starts giving strategic draft advice, scenario testing becomes more important.

Add tests for:

- roster construction detection
- positional run warnings
- tier-drop warnings
- future-pick planning
- strategy profile detection
- recommendation confidence

At this stage, realistic draft scenarios matter more than isolated unit tests.

## Live Integration Stage

When live draft integration begins, testing should prove that live providers produce the same internal draft state as the manual simulator.

Add tests for:

- provider event normalization
- duplicate events
- delayed events
- missing events
- reconnect behavior
- player ID mapping

The recommendation engine should behave the same regardless of whether draft events come from manual entry or a live provider.

---

# Future Testing Expansion

As the project grows, testing may expand to include:

- Persistence
- Replay systems
- Live integrations
- User accounts
- Performance
- Accessibility
- Monitoring
- Additional recommendation systems

These areas should be added to the testing strategy only when they become active project work.