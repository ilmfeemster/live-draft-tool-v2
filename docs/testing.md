# Testing

## Testing Philosophy

The MVP prioritizes confidence and correctness over test quantity.

Favor tests that validate observable behavior rather than implementation details.

Focus on validating:

- Core draft workflow
- Draft state transitions
- Recommendation behavior
- Roster tracking
- User-facing functionality

Avoid writing tests solely to increase coverage metrics.

Testing should scale with the maturity of the application. Early development should prioritize deterministic business logic and manual validation. As the recommendation engine becomes more sophisticated, increase investment in scenario and regression testing.

---

## Testing by Phase

### Phase 1 — Functional Draft Tracker

Testing should focus on ensuring a complete draft can be completed reliably.

Prioritize:

- Draft engine unit tests
- Recommendation scoring unit tests
- Draft state validation
- Manual end-to-end workflow testing
- A small number of integration tests covering the core draft flow

Do not over-invest in UI tests during Phase 1 unless the UI behavior is essential to completing a draft.

Phase 1 is sufficiently tested when:

- Core draft logic is covered by unit tests.
- Recommendation scoring logic is covered by unit tests.
- Manual checklist passes.
- A complete 12-team draft can be completed while maintaining a valid draft state throughout.

---

### Phase 2 — Intelligent Draft Assistant

Testing expands because recommendation behavior becomes the core product value.

Add:

- Scenario tests for realistic draft states
- Regression tests for recommendation behavior
- Tests for recommendation explanations
- Tests covering interactions between recommendation rules

Each new recommendation rule should include at least:

- One test proving when the rule should apply.
- One test proving when the rule should not apply, when practical.

---

### Phase 3 — Live Draft Experience

Testing should focus on validating external integrations without changing core draft behavior.

Add:

- Integration tests for live draft syncing
- Tests for duplicate, delayed, or missing draft events
- Tests verifying synced picks produce the same draft state as manual picks
- Manual testing against supported fantasy platforms

The recommendation engine should require minimal changes if the draft state remains consistent.

---

### Phase 4 — Advanced Strategy

Testing should focus on strategic correctness.

Add:

- Strategy profile tests
- Draft archetype recognition tests
- Future-planning scenario tests
- Regression tests for strategic recommendations

---

### Phase 5 — Fantasy Platform

Expand testing to platform functionality.

Add:

- Rankings and projections
- User settings
- Data persistence
- Premium features
- User accounts
- Supporting fantasy tools

---

### Phase 6 — Competitive Intelligence

Add tests for:

- Simulations
- Probability models
- Opponent modeling
- Personalized recommendations
- Confidence scores
- AI explanation layer

AI should explain deterministic recommendation logic rather than replace it.

---

## Unit Tests

Test pure business logic whenever possible.

### Draft Logic

- Snake draft order generation
- Round calculation
- Pick number calculation
- Active team calculation

### Recommendation Engine

- Ranking score calculation
- Roster need modifiers
- Positional scarcity modifiers
- Tier-drop modifiers
- Recommendation ordering
- Recommendation explanation generation

### Validation

- Ranking import validation
- Duplicate player prevention
- Draft state validation

---

## Draft Invariants

The following conditions should remain true after every draft action:

- A player exists in exactly one location.
- Drafted players never appear in the available player pool.
- Available players never appear on a roster.
- Total drafted players equals the current pick number minus one.
- Every drafted player belongs to exactly one team.
- Undo restores the previous valid draft state.
- Recommendation results only contain available players.

These invariants should be tested directly where practical and verified through integration and scenario tests.

---

## Integration Tests

Verify interactions between components and systems.

### Rankings

- Import rankings
- Load rankings into state
- Display rankings correctly

### Draft Flow

- Draft player
- Remove player from available pool
- Advance draft state
- Update draft board

### Roster Tracking

- Add drafted player to roster
- Update position counts
- Track roster needs

### Recommendations

- Recalculate after draft picks
- Update recommendation panel
- Display recommendation reasons

---

## Scenario Tests

Validate recommendation behavior using complete draft states.

Each scenario should define:

- Current draft state
- User roster
- Available players
- League settings
- Expected recommendation ordering
- Expected recommendation explanations (when applicable)

Recommended progression:

- Phase 1: 5–10 core recommendation scenarios
- Phase 2: 20–50 realistic draft scenarios
- Phase 3+: Expand scenarios as new recommendation systems are introduced

Scenario tests provide regression protection as recommendation logic becomes more sophisticated.

---

## Regression Tests

As recommendation logic grows:

- Add a regression test for every significant bug fix.
- Add tests for every new recommendation rule.
- Verify existing recommendation scenarios continue to behave as expected.
- Update expected results only when recommendation behavior intentionally changes.

---

## Testing Boundaries

Avoid testing:

- Styling
- Framework internals
- Third-party library behavior
- Simple getters and setters
- Temporary implementation details
- UI layouts that are expected to change frequently

Prefer testing stable business rules and observable application behavior.

---

## Manual Test Checklist

Before considering a feature complete:

### Draft Setup

- [ ] Draft can be created
- [ ] Draft position can be selected
- [ ] Rankings load successfully

### Draft Tracking

- [ ] Players can be drafted
- [ ] Draft board updates correctly
- [ ] Current pick updates correctly
- [ ] No duplicate drafted players

### Available Players

- [ ] Drafted players disappear
- [ ] Position filtering works
- [ ] Rankings remain sorted correctly

### User Roster

- [ ] User picks appear on roster
- [ ] Position counts update correctly
- [ ] Overfilled positions are detected

### Recommendations

- [ ] Top 5 recommendations display
- [ ] Recommendations update after picks
- [ ] Recommendation explanations appear
- [ ] Tier warnings appear when expected
- [ ] Scarcity warnings appear when expected

### Undo

- [ ] Last pick can be undone
- [ ] Draft state reverts correctly
- [ ] Player returns to available pool
- [ ] Recommendations recalculate correctly

---

## Vertical Slice Acceptance Criteria

Vertical Slice 1 is complete when:

- Rankings can be loaded.
- A draft can be started.
- Picks can be entered manually.
- Drafted players become unavailable.
- User roster updates correctly.
- Recommendations update after every pick.
- Undo functionality works.
- Draft invariants remain valid after each pick and undo.
- A complete 12-team draft can be completed while maintaining a valid draft state throughout.

---

## Bug Severity Guidelines

### Critical

Blocks completion of a draft.

Examples:

- Draft cannot continue
- Draft state becomes invalid
- Application crashes

### Major

Core functionality works incorrectly.

Examples:

- Incorrect recommendations
- Broken roster tracking
- Snake draft order errors

### Minor

Usability issue that does not prevent drafting.

Examples:

- Layout problems
- Sorting issues
- Visual inconsistencies

---

## Testing Principles

- Test business logic before UI details.
- Prefer simple, deterministic tests.
- Prefer behavior tests over implementation-detail tests.
- Fix bugs before adding complexity.
- Validate complete workflows frequently.
- Add regression tests for significant bug fixes.
- A feature is not complete until it passes its acceptance criteria.