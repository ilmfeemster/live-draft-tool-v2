# Project

## Active Phase

Phase 4 - Developer Tools & Simulator

The current project phase is focused on making draft scenarios fast to reproduce, inspect, and reset so the decision engine can be developed with short, reliable feedback loops.

Phase 1 established the manual draft simulator and in-memory Draft State Engine. Phase 2 added durable draft persistence. Phase 3 added deterministic, explainable recommendations. Phase 4 should preserve those workflows while adding local replay, scenario, and debugging capabilities around the existing engines.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context rather than static rankings alone.

The tool helps users make better draft decisions by combining rankings, roster context, positional scarcity, tier information, and current draft state during a live draft.

The app is a companion decision engine, not a fantasy platform or replacement draft room.

For Phase 4, the product should also function as an effective development environment for that decision engine. A developer should be able to recreate a meaningful draft situation, inspect the recommendation calculation, make changes, and repeat the scenario without manually rebuilding the draft each time.

---

## Target User

The Phase 4 user is the developer building and tuning the decision engine.

The developer needs to reproduce draft situations quickly, compare deterministic recommendation behavior, diagnose unexpected scores or reasons, and return the simulator to a known state. These tools support product development and regression confidence; they are not intended to become a polished end-user draft room.

---

## Phase Goals

Phase 4 should deliver:

- Deterministic replay of valid draft scenarios through the existing Draft State Engine.
- Portable draft scenario import and export for supported draft configurations.
- A small, curated scenario library for important recommendation and draft-state situations.
- Recommendation debugging that exposes the score components and reasons already produced by the Recommendation Engine.
- Reliable reset and restart controls that return a scenario or manual draft to a known valid state.
- Focused manual simulator improvements that reduce the time required to create, replay, and inspect scenarios.
- Regression confidence that manual entry, replay, and imported scenarios produce consistent domain state and recommendation output.

The phase is successful only if developers can recreate and investigate draft states in seconds without bypassing domain rules or duplicating recommendation logic.

---

## Scope

### In Scope

- Represent a reproducible scenario using the inputs needed to rebuild supported league settings, draft progress, ranking context, and user-team context.
- Replay an ordered sequence of valid picks through the existing Draft State Engine.
- Import a portable draft scenario and validate it before applying it.
- Export a supported draft or scenario so it can be replayed later.
- Provide a curated local library of representative scenarios.
- Recreate intermediate and completed draft states without manually re-entering every pick.
- Inspect recommendation totals, scoring components, penalties, and score-backed reasons for a replayed or manually created state.
- Reset a scenario to its defined starting point.
- Restart a draft from a clean state using its existing configuration.
- Improve simulator controls only where they directly shorten scenario setup, replay, reset, or debugging.
- Preserve the existing manual draft, persisted draft, and recommendation workflows.
- Add deterministic unit, integration, scenario, and regression coverage for replay and scenario behavior.

### Out of Scope

- A polished end-user draft room.
- Live platform integrations.
- A generic external-provider interface or network event normalization.
- ESPN, Yahoo, or Sleeper support.
- Real-time synchronization, polling, or WebSockets.
- Multi-user or collaborative simulation.
- Authentication or accounts.
- Automated draft strategy simulation or opponent modeling.
- AI-generated recommendations or explanations.
- New recommendation factors or Insight Engine behavior.
- Runtime ranking management, arbitrary ranking source import, tier editing, or other Phase 5 capabilities.
- Persisting recommendation output as source data.
- A broad plugin or event-sourcing architecture.
- Mobile-first or visual-polish work unrelated to developer speed.

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

Scenario and replay infrastructure should respect the dynamic league settings already supported by the domain and persistence layers rather than introduce new hard-coded assumptions.

---

## Core Workflow

### Create or Select a Scenario

- Choose a curated scenario, import a portable scenario, or use the current manual draft configuration.
- Validate the scenario configuration, ranking context, and pick history.
- Establish a known starting state.

### Replay and Inspect

- Replay picks through the Draft State Engine.
- Stop at the required draft position or restore the scenario's defined target state.
- Confirm available players, rosters, active pick, and other draft invariants.
- Generate recommendations from the reconstructed state.
- Inspect recommendation scores, contributing components, penalties, and reasons.

### Iterate

- Make additional manual picks when useful.
- Reset the scenario to its starting state or restart the configured draft.
- Replay the same inputs and compare deterministic output after engine changes.
- Export a useful reproducible scenario for later development or regression testing.

---

## Milestones

### Milestone 1 – Configurable League Settings

Complete the league configuration system so supported draft formats can be created, persisted, validated, and consumed by the Draft State Engine.

Deliverables include:

- configurable team count
- configurable roster construction
- configurable draft position
- supported scoring/draft settings
- persistence integration
- validation

Replay, scenarios, and recommendation tooling should consume these settings rather than introduce separate configuration.

### Milestone 2 - Reproducible Scenario Contract

Define the project-level information a portable scenario must carry to reconstruct supported draft state and recommendation inputs without exposing database records or transient React state.

The contract should support validation, deterministic replay, import/export round trips, and future evolution while leaving general live-provider concerns to Phase 7.

### Milestone 3 - Replay System

Provide a deterministic path for applying scenario picks through the existing Draft State Engine and recreating valid intermediate or completed states.

Manual entry and replay should share draft rules and transitions so the same inputs produce equivalent domain state.

### Milestone 4 - Scenario Portability and Library

Allow supported scenarios to be imported, exported, and selected from a small curated library.

The library should emphasize representative draft-state and recommendation situations rather than attempt exhaustive coverage or become a ranking-management system.

### Milestone 5 - Recommendation Debugger

Make existing Recommendation Engine output inspectable at the component level for a selected scenario state.

Debug information should trace recommendation totals and reasons back to structured engine output without recalculating scoring rules in the UI.

### Milestone 6 - Fast Simulator Iteration

Complete the reset, restart, and focused simulator improvements needed to move repeatedly from a known scenario to an inspectable recommendation state in seconds.

Validate that replay remains deterministic, preserves draft invariants, and does not regress the existing manual or persisted draft workflows.

---

## Architecture Impact

Phase 4 introduces replay and simulator infrastructure as local Draft Sources around the existing Draft State Engine. It does not introduce the full external-provider abstraction planned for Phase 7.

The intended flow becomes:

```text
Curated / Imported Scenario
             |
      Replay Draft Source
             |
      Draft State Engine
             |
   Recommendation Engine
             |
Recommendation Debugger

Manual Simulator --------> Draft State Engine
Persistence -------------> Draft State Engine hydration
```

The Draft State Engine remains the only owner of draft progression, pick validation, rosters, available players, and draft invariants. Replay should provide ordered inputs to that engine rather than inject a fabricated final state or reproduce draft rules.

The Recommendation Engine remains pure and derived. The debugger should present its structured scoring components and reasons rather than implement parallel scoring or explanation logic. Recommendation output should be recomputed from reconstructed draft state and ranking context, not imported as authoritative scenario data.

Important boundaries:

- Scenario data should use a typed, validated, portable domain-facing contract rather than database rows, raw persistence JSON, or UI state.
- Manual entry, replay, and imported scenarios should converge on the same Draft State Engine behavior.
- Replay ordering and results should be deterministic.
- Reset should restore a defined valid state without weakening draft invariants.
- Ranking snapshots may be carried or referenced only as needed for reproducible Phase 4 scenarios; general ranking ingestion and management remain Phase 5 work.
- Provider polling, reconnect behavior, remote identifiers, generalized event normalization, and live-provider interfaces remain Phase 7 work.
- The solution should remain inside the monolith-first Next.js application and should not require new services, queues, or deployment infrastructure.

### Architecture Tradeoff Assessment

- **Complexity cost:** Phase 4 adds a scenario contract, validation, and replay orchestration, but should avoid a generalized event framework or provider SDK.
- **Maintenance cost:** One shared draft-transition path limits duplicated rules; scenario format evolution will require explicit compatibility handling.
- **Scaling implications:** Local replay is optimized for developer workflows, not concurrent users or high-volume event processing. No scaling architecture is required in this phase.
- **Developer experience:** Curated and portable scenarios should make recommendation bugs reproducible and scoring changes easier to inspect.
- **Deployment implications:** The tools should run within the existing application and deployment model without new infrastructure.
- **Iteration speed:** Fast reset, replay, and score inspection should shorten the feedback loop for recommendation tuning and regression diagnosis.

---

## Success Criteria

Phase 4 is successful when a developer can:

1. Select or import a valid supported scenario and recreate its target draft state within seconds, without manually entering its full pick history.
2. Replay the same scenario repeatedly and receive the same draft state and recommendation output for the same inputs.
3. Export a supported scenario, import it again, and reproduce the same domain-relevant state and recommendation inputs.
4. Use a curated scenario library to exercise representative recommendation and draft-state situations.
5. Inspect each displayed recommendation's total score, contributing components, penalties, and score-backed reasons without consulting internal code.
6. Reset a scenario to its defined starting point and restart a configured draft without leaving stale picks, rosters, available-player state, or recommendations.
7. Confirm that replayed picks follow the same validation and state transitions as manual picks.
8. Receive a clear validation failure for malformed or incompatible scenario data without corrupting the current draft state.
9. Confirm draft invariants after replay, import, reset, and subsequent manual picks.
10. Continue using existing manual and persisted draft workflows without regression.
11. Validate replay equivalence, deterministic recommendations, import/export behavior, reset behavior, and representative scenarios with automated tests and focused manual QA.
12. A developer can create and persist any supported league configuration without modifying code, and replay/scenario tooling respects those settings.

The product should feel like a compact development workbench for the decision engine, not an expanded consumer draft room.

---

## Product Principles

- Optimize Phase 4 for reproducibility and iteration speed.
- Reuse the Draft State Engine for every pick transition.
- Keep recommendation behavior in the Recommendation Engine.
- Make scenario inputs portable, typed, validated, and deterministic.
- Prefer a small curated scenario library over a broad scenario-management product.
- Preserve existing manual and persisted draft workflows.
- Keep developer tooling local to the existing monolith and deployment model.
- Defer live-provider generalization to Phase 7 and ranking management to Phase 5.
- Avoid turning simulator improvements into end-user draft-room polish.
