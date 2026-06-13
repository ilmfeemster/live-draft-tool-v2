# Testing

## Testing Philosophy

The MVP prioritizes confidence and correctness over test quantity.

Focus on validating:

- Core draft workflow
- Draft state transitions
- Recommendation behavior
- Roster tracking
- User-facing functionality

Avoid writing tests solely to increase coverage metrics.

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

### Validation

- Ranking import validation
- Duplicate player prevention
- Draft state validation

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
- A complete 12-team draft can be completed without failure.

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
- Fix bugs before adding complexity.
- Validate complete workflows frequently.
- A feature is not complete until it passes its acceptance criteria.