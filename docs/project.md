# Project

## Active Phase

Phase 3 - Recommendation Engine

The current project phase is focused on turning draft state into deterministic, explainable player recommendations.

Phase 1 established the manual draft simulator and in-memory Draft State Engine. Phase 2 established durable draft persistence. Phase 3 should preserve the existing manual and persisted draft workflows while making recommendation quality the primary product focus.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context rather than static rankings alone.

The tool helps users make better draft decisions by combining rankings, roster context, positional scarcity, tier information, and current draft state during a live draft.

The app is a companion decision engine, not a fantasy platform or replacement draft room.

For Phase 3, the product should move from basic recommendation scaffolding to a meaningful recommendation engine that scores available players, orders them consistently, and explains the major reasons behind each recommendation.

---

## Target User

The initial user is the developer.

The user participates in live fantasy football drafts and wants better decision support than a static rankings sheet provides.

During Phase 3, the user should be able to open or resume a draft, enter picks manually, and receive recommendations that respond to roster needs, draft context, scarcity, and tier pressure.

---

## Phase Goals

Phase 3 should deliver:

- A deterministic recommendation scoring pipeline.
- Recommendation models that expose score, ordering, and reasons.
- Extensible scoring modifiers for ranking value, roster need, positional scarcity, and tier-drop risk.
- Recommendation output that updates from the current draft state.
- Recommendation reasons that explain the highest-impact scoring factors.
- Test coverage that proves recommendation behavior is stable, observable, and tied to business rules.

The phase is successful only if recommendations provide useful decision support beyond static rankings while remaining inspectable and predictable.

---

## Scope

### In Scope

- Score available players from the current draft state.
- Rank recommendations using deterministic scoring rules.
- Preserve static ranking value as a primary input.
- Apply roster need modifiers based on the user's current roster and league settings.
- Apply positional scarcity modifiers based on remaining available players.
- Apply tier-drop modifiers when waiting could meaningfully reduce player quality at a position.
- Generate recommendation reasons from scoring inputs.
- Keep recommendation logic independent from persistence implementation details.
- Keep recommendation logic independent from draft source or platform provider assumptions.
- Support the existing manual draft workflow.
- Support recommendations after loading a persisted draft.
- Add scenario-level confidence for representative draft situations.

### Out of Scope

- Opponent modeling.
- AI-generated reasoning.
- Machine learning recommendations.
- Draft simulations.
- Auto drafting.
- Strategy profiles.
- Advanced insight engine behavior.
- Live platform integrations.
- ESPN integration.
- Yahoo integration.
- Sleeper integration.
- WebSocket sync.
- Authentication.
- Multi-user support.
- Dynasty support.
- Auction drafts.
- Keeper leagues.
- News or injury ingestion.
- Payments.
- Recommendation UI redesign beyond what is necessary to display Phase 3 outputs.

---

## MVP League Settings

- 12 Teams
- Redraft
- Snake Draft
- 1QB
- PPR assumed

### Starting Lineup

- QB
- RB
- RB
- WR
- WR
- TE
- FLEX
- FLEX
- DST
- K

### Bench

- 6 Bench Spots

---

## Core Workflow

### Before Draft

- Create or load a draft.
- Select or use saved rankings.
- Confirm draft position and league settings.
- Start or resume the draft.

### During Draft

- Enter picks manually.
- Track drafted players.
- Update available player pool.
- Update user roster.
- Generate scored recommendations.
- Display recommendation reasons.
- Persist draft progress when persistence is available.

### Returning to a Draft

- View existing drafts.
- Load an incomplete draft.
- Restore draft setup, picks, available players, user roster, and recommendations.
- Continue entering picks from the correct draft position.

### On User Pick

Display:

- Top recommendations.
- Recommendation score or ordering.
- Recommendation reasoning.
- Tier warnings.
- Positional scarcity warnings.
- Roster need signals.

---

## Milestones

### Milestone 1 - Recommendation Model

Define the project-level recommendation output shape used by the app.

The model should represent recommended players, scores, scoring components, and human-readable reasons without coupling the engine to UI rendering, database storage, or future platform providers.

### Milestone 2 - Scoring Pipeline

Establish the deterministic scoring flow that starts from available players and current draft state, applies scoring factors, and returns ordered recommendations.

The scoring pipeline should be explicit enough to debug and small enough to adjust as recommendation quality improves.

### Milestone 3 - Core Modifiers

Introduce the initial recommendation factors:

- Base ranking value.
- Roster need.
- Positional scarcity.
- Tier-drop risk.

Each modifier should have an understandable impact on score and should be able to produce reasons when it materially affects a recommendation.

### Milestone 4 - Recommendation Reasons

Provide clear, deterministic explanations for why players are recommended.

Reasons should come from scoring inputs and should avoid generic, AI-generated, or unverifiable claims.

### Milestone 5 - Scenario Validation

Validate recommendation behavior across representative draft states.

Testing should prove recommendation ordering, modifier behavior, and reasons remain stable for defined scenarios, including loaded persisted draft states where practical.

---

## Architecture Impact

Phase 3 introduces the Recommendation Engine above the Draft State Engine.

The intended architecture becomes:

```text
Presentation Layer
        |
Recommendation Engine
        |
Draft State Engine
        |
Persistence Layer
        |
Database
```

The Draft State Engine should remain the source of draft rules, picks, rosters, available players, and league settings. The Recommendation Engine should consume draft state and ranking data; it should not own draft progression, persistence, or provider-specific behavior.

The recommendation engine should follow the existing monolith-first Next.js direction:

- TypeScript domain functions for deterministic scoring.
- Simple data structures before broad abstractions.
- React/UI code consumes recommendation output rather than duplicating scoring rules.
- Persistence hydrates draft state and ranking snapshots before recommendation logic runs.

Important boundaries:

- Recommendation logic must consume draft state, not database implementation details.
- Recommendation logic must be independent from manual, replay, or future live draft sources.
- Recommendation explanations should come directly from scoring components.
- Scoring rules should remain inspectable and adjustable.
- Modifier extensibility should stay simple and local until real duplication or complexity appears.
- Phase 3 should not introduce the Phase 6 Insight Engine, opponent modeling, or AI-generated reasoning.

---

## Success Criteria

Phase 3 is successful when a user can:

1. Open or resume a draft with the existing league assumptions.
2. Enter manual picks and see recommendations update from the new draft state.
3. Receive ordered recommendations that differ from static rankings when draft context justifies it.
4. See roster need influence recommendations in observable draft situations.
5. See positional scarcity influence recommendations in observable draft situations.
6. See tier-drop risk influence recommendations in observable draft situations.
7. Understand the main reasons a player is recommended.
8. Confirm recommendation output is deterministic for the same draft state and rankings.
9. Confirm recommendation results only contain available players.
10. Validate representative recommendation scenarios with automated tests.

The product should feel like a draft decision engine rather than a persisted draft board with rankings attached.

---

## Product Principles

- Prioritize recommendation usefulness over recommendation sophistication.
- Keep recommendation behavior deterministic.
- Keep scoring rules inspectable and easy to tune.
- Preserve the working manual and persisted draft workflows.
- Keep draft rules in the Draft State Engine.
- Keep persistence below the Draft State Engine and outside recommendation scoring.
- Explain recommendations using concrete scoring inputs.
- Avoid AI, simulations, opponent modeling, and strategy-engine complexity during Phase 3.
