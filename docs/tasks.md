# Tasks

## Current Focus

Phase 3: Recommendation Engine.

Phase 2 persistence is complete. Phase 3 turns hydrated draft state and ranking snapshots into deterministic, explainable player recommendations.

The source documents for this task plan are:

- `docs/project.md`
- `docs/design/recommendation-engine.md`
- `docs/architecture.md`
- `docs/testing.md`

Completed Phase 1 and Phase 2 task history remains archived in `docs/completed-tasks.md`.

---

## Phase 3 Task Ordering

The tasks are ordered to preserve architecture boundaries:

1. Align architecture and decision documentation before implementation begins.
2. Establish the pure recommendation engine contract and tuning configuration.
3. Build the base scoring pipeline and deterministic ordering.
4. Add bounded modifiers one at a time.
5. Add reason selection once scoring components exist.
6. Add scenario validation after the core behavior is present.
7. Wire the engine into the existing manual and persisted draft workflow.

Do not promote multiple unrelated tasks into `docs/current-slice.md` at once.

---

## Task 1 - Align Phase 3 Architecture Documentation

- [x] Complete

### Goal

Reflect the approved Recommendation Engine design in the project-level architecture and decision documents before code implementation begins.

### Scope

- Update `docs/architecture.md` to describe the pure Recommendation Engine boundary.
- Update `docs/architecture.md` with the bounded additive scoring model at a high level.
- Update `docs/architecture.md` to state that explanations come directly from scoring components.
- Update `docs/decisions.md` with the Phase 3 scoring model decision.
- Update `docs/decisions.md` with the Phase 3 reason-generation decision.
- Record deferred alternatives from the design where they affect future development.

### Non-Goals

- Do not implement recommendation code.
- Do not update `docs/current-slice.md`.
- Do not redesign the scoring model.
- Do not add implementation tasks beyond documentation alignment.

### Acceptance Criteria

- `docs/architecture.md` matches the approved design at architecture level.
- `docs/decisions.md` records the meaningful Phase 3 decisions.
- The documentation keeps AI reasoning, simulations, opponent modeling, and Phase 6 insight strategy out of Phase 3.
- The documentation preserves dynamic league settings, roster settings, and draft configuration support.

### Suggested Tests

- Documentation review only.

---

## Task 2 - Define Recommendation Engine Contract

- [x] Complete

### Goal

Create the domain-facing Recommendation Engine boundary and output model without coupling it to UI, persistence, or draft sources.

### Scope

- Define recommendation input types that consume typed draft state, rankings, league settings, and user team identity.
- Define recommendation output types for player recommendations, total score, base score, context score, score components, and reasons.
- Define a recommendation tuning configuration for engine-level constants.
- Add a pure engine entry point that can return deterministic recommendations.
- Ensure recommendation results only consider available players.

### Non-Goals

- Do not add scoring modifiers beyond what is needed to support the contract.
- Do not persist recommendation output.
- Do not read from Prisma or server actions inside the engine.
- Do not introduce a generic plugin or modifier registry.
- Do not change draft state transition behavior.
- Do not change UI presentation.

### Acceptance Criteria

- Recommendation code accepts typed domain inputs rather than database records or React state.
- Recommendation output includes score fields, component data, and reason fields needed by later tasks.
- The engine can be called with dynamic league and roster settings.
- The same input produces the same output ordering.
- Drafted players are excluded from recommendation results.

### Suggested Tests

- Unit test that the engine returns only available players.
- Unit test that identical inputs produce identical ordering.
- Unit test that the engine accepts a non-default league setting fixture.
- Type or compile validation for the public recommendation types.

---

## Task 3 - Implement Base Ranking Scoring

- [x] Complete

### Goal

Implement the rank-derived base player value score and deterministic recommendation ordering.

### Scope

- Score each available player using the approved base value formula from `overallRank`.
- Sort recommendations by total score, base score, overall rank, position rank, and player id.
- Include a base-value score component for each recommendation.
- Keep context score at zero until modifier tasks add behavior.
- Preserve output stability for the same ranking snapshot.

### Non-Goals

- Do not add roster need, scarcity, tier, run-pressure, or value-opportunity modifiers.
- Do not add UI changes.
- Do not normalize rankings or introduce projection data.
- Do not use ADP as the base score source.

### Acceptance Criteria

- Base recommendations are ordered by the rank-derived score.
- Higher-ranked available players generally score above lower-ranked available players.
- Tie-breaking is deterministic.
- The base score curve keeps top-ranked players meaningfully separated while compressing later players.
- Recommendation results remain independent from persistence implementation details.

### Suggested Tests

- Unit test for the base score formula.
- Unit test for deterministic tie-break ordering.
- Unit test that drafted players are not scored.
- Unit test that a lower-ranked player does not outrank a higher-ranked player when no context modifiers apply.

---

## Task 4 - Add Roster Fit And Timing Modifier

- [x] Complete

### Goal

Add the primary team-context modifier for starter needs, FLEX needs, bench depth, saturation, and DEF/K timing.

### Scope

- Derive roster need from configured roster slots and eligible positions.
- Reward open required starter needs.
- Account for FLEX-eligible positions without hard-coding MVP defaults.
- Add bench-depth credit after starters are mostly filled.
- Penalize saturated positions.
- Apply early timing penalties for DEF and K.
- Add roster-fit score components that later reason generation can use.

### Non-Goals

- Do not add positional scarcity, run pressure, tier cliffs, or value opportunity.
- Do not hard-code 12 teams, 16 rounds, default starter counts, or default bench size.
- Do not introduce strategy profiles.
- Do not change roster derivation in the Draft State Engine unless a genuine bug blocks the modifier.

### Acceptance Criteria

- Open starter slots increase recommendations for eligible positions.
- Saturated positions are de-emphasized without fully hiding elite value.
- FLEX settings affect positional need in observable ways.
- DEF/K are heavily de-emphasized before the late phase and become valid needs when their configured slots remain empty late.
- Non-default roster configurations influence scoring correctly.

### Suggested Tests

- Unit test for open starter need.
- Unit test for FLEX eligibility affecting need.
- Unit test for position saturation penalty.
- Unit test for early DEF/K timing penalty.
- Unit test using a non-default roster configuration.

---

## Task 5 - Add Value Opportunity Modifier

- [x] Complete

### Goal

Reward players who have fallen relative to the current pick and lightly penalize unsupported reaches.

### Scope

- Compare candidate overall rank against current pick number.
- Add bounded positive score components for falling value.
- Add bounded negative score components for clear reaches without contextual support.
- Keep value opportunity separate from base ranking value.
- Use existing ranking fields only.

### Non-Goals

- Do not add projections or value-over-replacement.
- Do not make ADP a required dependency.
- Do not add UI-only labels.
- Do not let value opportunity override the total context caps.

### Acceptance Criteria

- Players who have fallen meaningfully receive a bounded positive modifier.
- Clear reaches can receive a small negative modifier.
- Value opportunity does not duplicate or replace base score.
- The modifier behaves deterministically for the same current pick and rankings.
- The modifier works with loaded persisted drafts because it only depends on typed draft state.

### Suggested Tests

- Unit test for small, clear, and major value opportunities.
- Unit test for clear reach penalty.
- Unit test that base score still anchors ordering when value opportunity is absent.
- Unit test that value opportunity remains within configured bounds.

---

## Task 6 - Add Tier-Drop Risk Modifier

- [x] Complete

### Goal

Reward players near meaningful positional tier cliffs when the position still matters to the roster.

### Scope

- Detect remaining available players in the candidate's position and tier.
- Compare current tier depth with the next available tier.
- Consider distance to the user's next pick when calculating tier pressure.
- Scale tier pressure by roster relevance.
- Add bounded tier score components.

### Non-Goals

- Do not simulate future picks.
- Do not predict specific opponent behavior.
- Do not introduce Phase 6 strategy advice.
- Do not let tier pressure stack beyond the combined urgency cap.

### Acceptance Criteria

- Last-few-in-tier situations increase recommendations for relevant positions.
- Tier pressure is reduced when the position is already solved or low-value for the roster.
- Tier pressure cannot move a much lower-value player above an elite player by itself.
- Tier score components include the data needed for reason generation.

### Suggested Tests

- Unit test for mild tier pressure.
- Unit test for major tier cliff at a needed position.
- Unit test that filled positions reduce tier impact.
- Unit test that the scarcity plus tier combined cap is respected once scarcity exists.

---

## Task 7 - Add Positional Scarcity And Run Pressure Modifier

- [x] Complete

### Goal

Reward positions where useful remaining options are thinning, including observed positional runs, without predicting future opponent behavior.

### Scope

- Measure remaining available quality by position.
- Detect recent observed positional runs from draft pick history.
- Apply scarcity pressure only when the candidate position remains relevant to the user's roster.
- Combine scarcity and tier pressure through the approved urgency cap.
- Add scarcity and run-pressure score components.

### Non-Goals

- Do not model opponents.
- Do not simulate future draft rooms.
- Do not let positional runs force bad picks.
- Do not make provider-specific assumptions.
- Do not replace tier-drop risk.

### Acceptance Criteria

- Thin remaining positional quality creates bounded scarcity credit.
- Recent positional runs add pressure only when tied to roster relevance.
- A run at a solved position has minimal or no effect.
- Scarcity plus tier pressure respects the combined cap.
- The modifier remains independent from manual, replay, or future live draft sources.

### Suggested Tests

- Unit test for mild and clear scarcity.
- Unit test for observed run pressure at a needed position.
- Unit test that run pressure is ignored or minimized for solved positions.
- Unit test that scarcity does not overpower a large base-value gap.
- Unit test that combined urgency is capped.

---

## Task 8 - Add Explanation Selection

- [x] Complete

### Goal

Generate concise, deterministic recommendation reasons directly from scoring components.

### Scope

- Convert score components into reason candidates.
- Return up to three reasons per recommendation.
- Prioritize strongest positive context, tier or scarcity pressure, base value or value opportunity, and one meaningful negative caveat when relevant.
- Apply reason thresholds from the tuning configuration.
- Ensure reason text or reason data reflects actual scoring inputs.

### Non-Goals

- Do not generate AI-written explanations.
- Do not add unsupported strategic claims.
- Do not predict opponent behavior.
- Do not create a long-form insight system.
- Do not change scoring values solely to make reasons easier to display.

### Acceptance Criteria

- Each displayed reason traces back to a score component.
- Recommendations return no more than three reasons.
- Reasons are stable for the same input.
- Meaningful roster need, tier cliff, scarcity, value, and negative caveat reasons can be selected.
- Generic or unsupported advice is not generated.

### Suggested Tests

- Unit test that only score-backed reasons are emitted.
- Unit test reason priority ordering.
- Unit test reason count limit.
- Unit test negative caveat selection when a player remains recommended despite a penalty.
- Unit test that low-impact components below threshold do not produce reasons.

---

## Task 9 - Add Recommendation Scenario Validation

- [x] Complete

### Goal

Create deterministic scenario coverage for representative draft situations from the approved design.

### Scope

- Add scenario fixtures for heavy RB start.
- Add scenario fixtures for heavy WR start.
- Add scenario fixtures for ignoring QB early.
- Add scenario fixtures for positional runs.
- Add scenario fixtures for tier cliffs.
- Add scenario fixtures for starter positions filled.
- Add scenario fixtures for bench depth decisions.
- Add scenario fixtures for late-round DEF/K strategy.
- Add scenario fixtures for at least one non-default roster configuration.
- Add persisted-draft parity coverage where the existing persistence boundary makes this practical.

### Non-Goals

- Do not assert every player in a full ranking list.
- Do not depend on fragile UI rendering.
- Do not add live-provider or replay tooling.
- Do not redesign scoring during scenario creation unless a scenario exposes a direct contradiction.

### Acceptance Criteria

- Scenario tests assert top recommendation sets or important relative ordering.
- Scenario tests assert key reasons where explanations are part of the expected behavior.
- Scenarios prove recommendations remain deterministic.
- Scenarios prove recommendation results only contain available players.
- At least one scenario validates dynamic roster settings rather than MVP defaults.

### Suggested Tests

- Scenario tests for each required scenario listed in scope.
- Regression tests for any scoring behavior fixed during scenario validation.
- Integration-style test for persisted draft parity if an existing hydrated draft fixture is available.

---

## Task 10 - Wire Recommendation Engine Into Draft Workflow

- [x] Complete

### Goal

Use the Phase 3 Recommendation Engine in the existing manual and persisted draft workflows.

### Scope

- Replace any basic recommendation scaffolding with the new engine output.
- Feed the engine typed draft state, ranking snapshot data, league settings, and user team identity.
- Display ordered recommendations in the existing draft workflow.
- Display concise score-backed reasons using existing UI surfaces where practical.
- Preserve recommendation updates after manual picks, undo, draft load, and persisted draft resume.

### Non-Goals

- Do not redesign the draft room UI.
- Do not add a new recommendation window product surface.
- Do not persist recommendation output.
- Do not add live provider integration.
- Do not add AI explanations or Phase 6 insights.
- Do not change persistence storage shape unless an existing mapper bug blocks typed engine input.

### Acceptance Criteria

- Manual pick entry updates recommendations through the new engine.
- Loaded persisted drafts recompute recommendations from hydrated state.
- Recommendation output remains independent from database storage details.
- Reasons displayed in the UI match score-backed engine reasons.
- Existing draft invariants remain true after pick and undo flows.
- The workflow still supports dynamic league settings and roster configuration.

### Suggested Tests

- Integration test that drafting a player updates recommendation ordering.
- Integration test that undo restores prior recommendation behavior.
- Integration or regression test that a loaded draft produces the same recommendations as the same in-memory state.
- Existing draft workflow tests should continue to pass.
- Manual QA for a short draft flow with recommendation reasons visible.

---

## Task 11 - Phase 3 Completion Validation

- [ ] Complete

### Goal

Validate that Phase 3 meets the project success criteria before the phase is marked complete.

### Scope

- Confirm recommendations differ from static rankings when context justifies it.
- Confirm base value still anchors elite recommendations.
- Confirm roster need, positional scarcity, tier-drop risk, and value opportunity are observable.
- Confirm explanations are score-backed.
- Confirm manual and persisted workflows both use the same engine.
- Confirm representative scenario tests pass.
- Update task status when each Phase 3 task is completed.

### Non-Goals

- Do not add new recommendation features during completion validation.
- Do not weaken scenario expectations to make validation pass.
- Do not start Phase 4 replay or simulator tooling.
- Do not add Phase 6 insight behavior.

### Acceptance Criteria

- All Phase 3 task acceptance criteria are satisfied.
- Relevant automated tests pass.
- Manual validation confirms recommendations update during draft workflow.
- Recommendation results remain deterministic for identical inputs.
- No Phase 3 non-goals were introduced.

### Suggested Tests

- Run the relevant automated test suite.
- Run focused recommendation scenario tests.
- Complete a short manual QA draft flow.

---

## Testing Status

Phase 1 testing is complete for the manual draft simulator scope. Automated coverage includes draft order, draft state transitions, invariants, recommendation updates, small workflow integration, full small-draft completion, undo after completion, and recommendation modifier behavior. Manual QA coverage is captured in `docs/manual-full-draft-qa.md`.

Phase 2 persistence validation is complete. Completed validation history is archived in `docs/completed-tasks.md`.

Phase 3 testing should prioritize deterministic business logic:

- Recommendation score calculation.
- Modifier behavior and bounds.
- Recommendation ordering.
- Explanation generation.
- Scenario validation.
- Manual and persisted workflow integration.

---

## Backlog

Not required for Phase 3:

- Authentication
- Multi-user support
- Custom league settings UI
- Normalized ranking tables
- Global player table
- Replay tooling
- Live provider integrations
- Opponent modeling
- Draft simulations
- AI-generated reasoning
- Strategy profiles
- Phase 6 insight engine behavior
- Recommendation window product surface
- Keyboard shortcuts
- Improved search UX
- Player notes
- Watchlist
- Player queue
- Draft recap grading
- Historical draft analysis

See `future_ideas.md` for additional ideas.
