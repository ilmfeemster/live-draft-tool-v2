
# Roadmap

> This roadmap defines the evolution of the **Fantasy Draft Decision Engine**. The product is not a draft board; it is a decision engine that consumes draft state and produces actionable recommendations and strategic insights. The draft simulator exists primarily to develop, test, and validate the decision engine before and alongside live integrations.

---

# Architectural Vision

```
Recommendation Window
        │
Presentation Layer
        │
Insight Engine
        │
Recommendation Engine
        │
Draft State Engine
        │
Draft Source
   ├── Manual Simulator
   ├── Replay Files
   ├── Sleeper
   ├── ESPN
   └── Yahoo
```

The **Draft State Engine** is the core of the system. Every feature should either:

- Provide draft state.
- Consume draft state.
- Explain draft state.

No platform-specific logic should leak into the core engine.

---

# Phase 0 — Foundation

## Purpose

Establish architecture, conventions, documentation, testing philosophy, and domain models.

## Product Goals

- Stable engineering foundation.

## Technical Goals

- Project structure
- Shared types
- Documentation
- Testing infrastructure
- CI/linting/formatting

## Major Deliverables

- Documentation set
- Architecture boundaries
- Domain models
- Initial test framework

## Architecture Changes

Introduce the Draft State domain model.

## Future Enables

Everything.

## Non-Goals

Business logic, persistence, integrations.

## Exit Criteria

Project is structured for long-term development.

---

# Phase 1 — Draft State Engine

## Purpose

Build the engine capable of representing and progressing any draft regardless of data source.

## Product Goals

Complete manual mock drafts.

## Technical Goals

- Draft lifecycle
- Snake logic
- Pick validation
- Roster tracking
- League settings
- Recommendation inputs

## Major Deliverables

- Draft engine
- Manual simulator
- Default rankings
- Recommendation scaffolding

## Architecture Changes

Introduce the Draft State Engine.

## Future Enables

Persistence, recommendations, replay testing, live providers.

## Non-Goals

Platform integration, accounts, advanced strategy.

## Exit Criteria

Any draft can be represented accurately in memory.

---

# Phase 2 — Persistence

## Purpose

Persist draft state and configuration.

## Product Goals

Resume work across sessions.

## Technical Goals

- Database
- API layer
- Draft persistence
- Ranking snapshots
- Configuration persistence

## Major Deliverables

- Save/load drafts
- Persistent settings
- Draft history

## Architecture Changes

Introduce Persistence Layer beneath the Draft State Engine.

## Future Enables

Replay testing, historical analysis, user accounts.

## Non-Goals

Authentication and multiplayer.

## Exit Criteria

Drafts survive application restarts.

---

# Phase 3 — Recommendation Engine

## Purpose

Score players based on draft context.

## Product Goals

Provide useful recommendations beyond static rankings.

## Technical Goals

- Scoring pipeline
- Recommendation models
- Extensible modifiers
- Deterministic outputs

## Major Deliverables

- Recommendation engine
- Recommendation scoring
- Recommendation reasons

## Architecture Changes

Recommendation Engine sits above Draft State Engine.

## Future Enables

Insights, explainability, strategy.

## Non-Goals

Opponent modeling and AI-generated reasoning.

## Exit Criteria

Recommendations consistently outperform simple rankings.

---

# Phase 4 — Developer Tools & Simulator

## Purpose

Accelerate development of the decision engine.

## Product Goals

Allow rapid testing of draft scenarios.

## Technical Goals

- Scenario replay
- Draft import/export
- Recommendation debugger
- Reset tools
- Manual simulator improvements

## Major Deliverables

- Replay system
- Scenario library
- Debug tooling

## Architecture Changes

Introduce replay and simulator infrastructure as Draft Sources.

## Future Enables

Regression testing and rapid iteration.

## Non-Goals

Polished end-user draft room.

## Exit Criteria

Developers can recreate any draft state in seconds.

---

# Phase 5 — Rankings & Data

## Purpose

Decouple rankings from application code.

## Product Goals

Support custom ranking sources.

## Technical Goals

- Ranking parser
- Import/export
- Validation
- Tier management
- Snapshotting

## Major Deliverables

- Ranking management
- Multiple ranking sets

## Future Enables

Advanced strategy and personalization.

## Non-Goals

Automated projections and news ingestion.

## Exit Criteria

Rankings can evolve without code changes.

---

# Phase 5.5 — Overall Tier Recommendations

## Purpose

Expand the Recommendation Engine to incorporate overall/source tiers using their correct semantics and introduce ADP as an availability-risk signal. This phase improves recommendation quality by adding meaningful recommendation inputs while preserving the deterministic, explainable scoring model established in Phase 3.

## Product Goals

Improve recommendation quality by considering:

- Overall player rankings
- Overall/source tiers
- ADP availability risk

Recommendations should better answer **who should be drafted now**, not simply **who is the best player**.

## Technical Goals

- Overall tier recommendation signal
- ADP availability-risk signal
- Recommendation scoring integration
- Recommendation explanations
- Validation

## Major Deliverables

- Overall tier recommendation signal
- ADP availability-risk signal
- Updated recommendation scoring
- Recommendation reasons for overall tiers and ADP availability

## Architecture Changes

Expand the Recommendation Engine to consume multiple independent recommendation signals.

Overall/source tiers are recommendation inputs and must not be interpreted as position-tier pressure.

ADP is an availability-risk signal that estimates the opportunity cost of waiting for a player. It complements player rankings but does not represent player quality and should not override substantially stronger ranking or tier signals.

The Recommendation Engine should remain deterministic, additive, and easily extensible for future recommendation signals.

## Future Enables

- Projection-based recommendation signals
- Position-tier recommendation signals
- VORP/value-based recommendation signals
- Enhanced opportunity-cost modeling
- Confidence modeling

## Non-Goals

- Position tiers
- Projection models
- VORP calculations
- Strategy engine changes
- Additional ranking sources
- Cross-provider ADP reconciliation
- Machine learning

## Exit Criteria

- Overall/source tiers contribute appropriately to recommendations without being interpreted as position-tier pressure.
- ADP contributes as an availability-risk signal that influences draft timing rather than player quality.
- Recommendation quality improves through the combination of rankings, overall tiers, and ADP while preserving deterministic behavior.
- The Recommendation Engine remains ready for future projection-based and value-based recommendation signals without requiring architectural changes.

---

# Phase 6 — Strategy & Insight Engine

## Purpose

Move from recommending players to recommending decisions.

## Product Goals

Explain the reasoning behind recommendations.

## Technical Goals

- Insight engine
- Strategy detection
- Roster analysis
- Future pick planning
- Explainability

## Major Deliverables

- Strategic insights
- Recommendation explanations
- Confidence metrics

## Architecture Changes

Insight Engine above Recommendation Engine.

## Future Enables

Premium intelligence and personalized drafting.

## Non-Goals

Machine learning and auto drafting.

## Exit Criteria

The system explains both *what* to do and *why*.

---

# Phase 7 — Live Integration Platform

## Purpose

Abstract external draft providers.

## Product Goals

Consume live drafts without changing recommendation logic.

## Technical Goals

- Provider interface
- Event normalization
- ID mapping
- Polling/WebSocket support
- Sync recovery

## Major Deliverables

- Draft provider abstraction
- Manual, replay, and live providers

## Architecture Changes

Introduce Draft Source abstraction.

## Future Enables

Platform integrations.

## Non-Goals

Supporting every platform simultaneously.

## Exit Criteria

Recommendation engine is unaware of the source of draft events.

---

# Phase 8 — Live Product

## Purpose

Use the decision engine during real drafts.

## Product Goals

A lightweight recommendation window beside an existing fantasy platform.

## Technical Goals

- First platform integration
- Live synchronization
- Compact recommendation UI
- Reliability

## Major Deliverables

- Sleeper/first provider support
- Recommendation window
- Manual fallback

## Architecture Changes

Recommendation Window becomes the primary user interface.

## Future Enables

Public beta and production use.

## Non-Goals

Replacing existing fantasy draft rooms.

## Exit Criteria

A complete live draft can be conducted using the assistant.

---

# Phase 9 — Accounts & Personalization

## Purpose

Support multiple users and long-term personalization.

## Major Deliverables

- Authentication
- User settings
- Saved ranking profiles
- Personal strategy preferences

## Future Enables

Cloud sync and subscriptions.

---

# Phase 10 — Production Hardening

## Purpose

Prepare the application for public reliability.

## Major Deliverables

- Monitoring
- Logging
- Analytics
- Accessibility
- Comprehensive testing
- Deployment pipeline

## Exit Criteria

Reliable production-quality application.

---

# Phase 11 — Product Expansion

## Purpose

Expand beyond the core assistant after validating the product.

## Potential Deliverables

- Draft review
- Historical analytics
- Premium insights
- Team collaboration
- Additional integrations
- Monetization

---

# Planning Flow

Every planning document should increase detail without duplicating the previous level.

```
roadmap.md
    ↓
Select a Phase

project.md
    ↓
Break into milestones

tasks.md
    ↓
Break into implementation tasks

current-slice.md
    ↓
One focused coding slice
```
