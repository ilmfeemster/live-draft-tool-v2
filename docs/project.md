# Project

## Active Phase

Phase 5.5 - Overall Tier Recommendations is the active implementation phase.

Phase 5 - Rankings & Data is complete. Ranking data can be imported, validated, managed, selected, and snapshotted without regenerating typed seed files or changing application code.

Phase 1 established the manual Draft State Engine, Phase 2 added durable draft persistence and ranking snapshots, Phase 3 added deterministic recommendations, Phase 4 added replay and simulator tooling, and Phase 5 made ranking sets first-class product data. Phase 5.5 builds on that foundation by using overall/source tiers and ADP as distinct recommendation signals while preserving the existing deterministic scoring model.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context rather than static rankings alone.

The tool helps users decide who to draft now by combining overall ranking quality, overall tier context, ADP availability risk, roster context, positional scarcity, and current draft state. It remains a companion decision engine, not a fantasy platform or replacement draft room.

For Phase 5.5, recommendations should distinguish player quality from the opportunity cost of waiting. Overall rank remains the quality anchor, overall/source tiers identify meaningful groups in the source's overall ordering, and ADP estimates whether a player is likely to remain available. These signals must improve timing decisions without becoming unsupported position-tier, projection, or strategy claims.

---

## Target User

The Phase 5.5 user is a single fantasy football drafter using a managed ranking set during a manual, persisted, or replayed draft.

They need recommendations that remain easy to understand while accounting for more than static rank. The user should be able to see when an overall tier boundary or a player's expected availability materially affected a recommendation, without needing to understand the scoring implementation.

---

## Phase Goals

Phase 5.5 should deliver:

- An overall-tier recommendation signal derived from valid overall/source tier data in the active ranking snapshot.
- An ADP availability-risk signal that reflects the opportunity cost of waiting rather than player quality.
- Deterministic integration of both signals into the bounded additive Recommendation Engine.
- Score-backed recommendation reasons when overall-tier context or ADP availability materially affects an output.
- Explicit fallback behavior: missing ADP is neutral for that player, and wholly absent overall/source-tier data becomes one neutral overall tier for the complete ranking context.
- Focused validation that the new signals improve recommendation timing without overwhelming stronger ranking information or changing existing engine boundaries.

The phase is successful only if recommendations better answer who should be drafted now while remaining deterministic, inspectable, and anchored to the selected ranking snapshot.

---

## Scope

### In Scope

- Consume valid overall/source tier values from the active ranking snapshot as an overall-tier recommendation input.
- Treat overall/source tiers according to their overall ranking semantics, not as position-local tiers or position-tier-drop pressure.
- Consume valid ADP values from the active ranking snapshot as an availability-risk input while allowing individual players or an entire ranking set to lack ADP and remain usable with neutral ADP signals.
- Model ADP as a draft-timing signal that complements overall rank without redefining player quality.
- Integrate overall-tier and ADP signals into the existing deterministic, bounded additive scoring model.
- Bound individual and total context effects so substantially stronger ranking or tier information is not overridden by ADP alone.
- Preserve deterministic ordering and tie-breaking.
- Recalculate recommendations after every draft pick so the user can preview the next decision between turns.
- Produce recommendation reasons directly from the scoring components when a new signal has a meaningful effect.
- Preserve existing ranking-set, snapshot, manual draft, persistence, scenario, and replay workflows.
- Validate normal, missing-data, boundary, and conflicting-signal behavior with deterministic automated scenarios and focused manual QA.

### Out of Scope

- Position tiers or position-local tier-drop modeling derived from overall/source tiers.
- Projection ingestion or projection-based scoring.
- Value-over-replacement calculations.
- Opponent modeling, draft simulations, or predictive availability models beyond the active snapshot's ADP signal.
- Strategy or Insight Engine changes, including future-pick planning, confidence metrics, or broad strategic advice.
- New ranking sources, automated ADP feeds, scheduled refreshes, or cross-provider ADP reconciliation.
- Machine learning or AI-generated recommendation reasoning.
- Live draft platform integrations.
- Authentication, accounts, cloud sharing, or multi-user workflows.
- Broad UI redesign unrelated to presenting the updated recommendation output.

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

The Recommendation Engine should continue to derive behavior from the dynamic league settings and roster configuration already carried by draft state. Phase 5.5 does not expand supported league formats.

---

## Core Workflow

### Start or Resume a Draft

- Start, load, or replay a supported draft with its immutable ranking snapshot.
- Continue using the existing draft-state and ranking-selection workflows.
- Recompute recommendations from the current draft state rather than loading persisted recommendation output.

### Evaluate the Current Pick

- Anchor candidate quality to overall rank from the active snapshot.
- Consider whether an overall tier boundary makes one similarly ranked option more urgent.
- Consider ADP as evidence about whether waiting may forfeit the opportunity to select a player.
- Combine these inputs with the existing bounded context signals without allowing one modifier to dominate the recommendation.

### Understand the Recommendation

- Show score-backed reasons when overall-tier context or ADP availability materially contributes.
- Keep reasons silent when the relevant data is absent or had no meaningful scoring effect.
- Describe ADP in terms of availability or timing, not player quality.
- Do not describe overall/source tiers as position scarcity or position-tier pressure.

### Reproduce Behavior

- Replay the same draft state with the same ranking snapshot and receive the same recommendation order, scores, and reasons.
- Preserve the result even if the mutable source ranking set later changes or is removed.

---

## Milestones

### Milestone 1 - Signal Semantics and Scoring Contract

Define the project-level behavior of the overall-tier and ADP signals, including their neutral states, bounded influence, interaction with base rank, and distinction from existing position-tier pressure.

### Milestone 2 - Overall Tier Recommendation Signal

Use valid overall/source tier context to improve ordering among relevant candidates without treating the data as position-local tiers or producing position-tier-drop claims.

### Milestone 3 - ADP Availability-Risk Signal

Use available ADP to represent the risk of waiting for a player. Keep the signal subordinate to substantially stronger player-quality evidence and neutral when ADP is missing or unusable.

### Milestone 4 - Recommendation Integration and Reasons

Integrate both signals into the bounded additive scoring output and expose concise, score-backed reasons for material contributions.

### Milestone 5 - Recommendation Confidence

Validate deterministic behavior across representative scenarios, missing data, tier boundaries, ADP disagreement, persisted drafts, and replay workflows. Tune only within the approved signal semantics and scoring bounds.

---

## Architecture Impact

Phase 5.5 expands the existing Recommendation Engine; it does not introduce a new architectural layer or persistence lifecycle.

The intended flow becomes:

```text
Immutable Draft Ranking Snapshot
  |-- Overall Rank ---------> Base Player Value
  |-- Overall/Source Tier --> Overall Tier Signal
  `-- ADP ------------------> Availability-Risk Signal
                                  |
Draft State + Existing Context ---+--> Bounded Additive Scoring
                                           |
                                 Recommendations + Reasons
```

The Recommendation Engine remains a pure domain layer. It consumes typed draft state, league settings, user team identity, and immutable ranking snapshot data; it does not parse imports, query ranking persistence, mutate draft state, depend on React, or persist its output.

Important boundaries:

- Overall rank remains the scoring anchor for player quality.
- Overall/source tiers may inform an overall-tier signal but must not be interpreted as position-local tier-drop pressure.
- Existing recommendation-tier eligibility continues to govern any position-tier-pressure behavior; Phase 5.5 does not create or infer position tiers.
- ADP represents expected availability and draft timing, not player quality, projections, or certainty about opponent behavior.
- Each new modifier and the combined context effect remain bounded.
- Recommendation reasons remain direct descriptions of scoring inputs that materially affected the result.
- Missing ADP produces a neutral ADP component for the affected player; an entire ranking set without ADP remains usable with zero ADP weight. Wholly absent overall-tier data materializes one explicitly defaulted neutral tier; malformed or partially supplied tier data must not create guessed boundaries.
- Ranking snapshots remain the complete reproducibility boundary; recommendation output remains derived.

### Architecture Tradeoff Assessment

- **Complexity cost:** Two additional signals add interaction and tuning cases. Keeping them explicit inside the current scoring pipeline avoids a premature generic modifier framework.
- **Maintenance cost:** Signal semantics, bounds, and explanations require scenario coverage as ranking data evolves. Pure scoring functions and score-backed reasons keep that maintenance localized.
- **Scaling implications:** Recommendation scoring remains an in-process calculation over one draft snapshot. No additional services, caches, queues, or background processing are required.
- **Developer experience:** Independent score components make behavior easier to debug, but named semantics and representative fixtures are needed to prevent accidental overlap with existing tier or scarcity signals.
- **Deployment implications:** The phase stays within the existing Next.js monolith and PostgreSQL/Prisma deployment model and requires no new operational infrastructure.
- **Iteration speed:** Small, independently testable signals support fast tuning while deterministic replay protects against regressions.

---

## Success Criteria

Phase 5.5 is successful when a user or developer can:

1. Receive a deterministic recommendation that incorporates valid overall/source tier context from the active ranking snapshot.
2. Confirm that overall/source tiers affect only the overall-tier signal and never masquerade as position-local tier pressure.
3. Receive a deterministic ADP-based availability adjustment when valid ADP indicates that waiting creates meaningful risk.
4. Confirm that ADP alone does not override a substantially stronger overall ranking or overall-tier case.
5. Receive concise, score-backed reasons when overall-tier or ADP signals materially affect a recommendation.
6. Receive no unsupported overall-tier or ADP reason when the corresponding signal is missing, defaulted-neutral, neutral, or immaterial.
7. Continue receiving recommendations for players without ADP and ranking contexts without supplied overall tiers, with those unavailable signals contributing zero rather than guessed values.
8. See deterministic recommendation previews recalculate after every recorded pick, including between the user's turns.
9. Replay the same draft state and ranking snapshot and receive the same recommendation ordering, component scores, and reasons.
10. Preserve existing manual draft, ranking management, persistence, scenario, and replay workflows.
11. Confirm through focused automated scenarios that tier boundaries, ADP disagreement, missing data, modifier bounds, total context caps, and deterministic tie-breaking behave as approved.
12. Complete focused manual QA showing that updated recommendations clearly communicate player quality, overall-tier context, availability risk, and neutral fallbacks as distinct concepts.

Recommendations should feel more aware of draft timing without becoming opaque, speculative, or detached from the ranking snapshot.

---

## Product Principles

- Answer who should be drafted now, not merely who has the best static rank.
- Keep overall rank as the player-quality anchor.
- Treat overall/source tiers according to their overall semantics; never present them as position tiers.
- Treat ADP as uncertain availability evidence, not quality or opponent certainty.
- Keep context modifiers bounded, additive, deterministic, and inspectable.
- Generate reasons only from scoring components that materially affected the recommendation.
- Use ADP whenever a player has a valid published value and remain neutral when that player does not.
- Materialize one explicitly defaulted neutral overall tier when a ranking context has no supplied tiers; never invent tier boundaries.
- Preserve immutable snapshots and reproducible recommendation behavior.
- Keep the Recommendation Engine pure and independent of ranking origin, persistence, UI state, and draft source.
- Avoid a generic signal framework until real duplication or extension pressure justifies one.
- Defer projections, VORP, position-tier modeling, strategic insights, live providers, accounts, and machine learning to future phases.
