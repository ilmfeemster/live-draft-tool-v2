# Project

## Active Phase

Phase 5.5 - Overall Tier Recommendations and Draft Pocket Forecasting is the active implementation phase.

Phase 5 - Rankings & Data is complete. Ranking data can be imported, validated, managed, selected, and snapshotted without regenerating typed seed files or changing application code.

Phase 1 established the manual Draft State Engine, Phase 2 added durable draft persistence and ranking snapshots, Phase 3 added deterministic recommendations, Phase 4 added replay and simulator tooling, and Phase 5 made ranking sets first-class product data. Phase 5.5 builds on that foundation by using overall/source tiers for player-quality context and ADP to forecast the user's next draft pocket while preserving the existing deterministic scoring model.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context rather than static rankings alone.

The tool helps users decide who to draft now by combining overall ranking quality, overall tier context, a deterministic ADP-based forecast of the user's next decision space, roster context, positional scarcity, and current draft state. It remains a companion decision engine, not a fantasy platform or replacement draft room.

For Phase 5.5, recommendations should distinguish player quality from the opportunity cost of waiting. Overall rank remains the quality anchor, overall/source tiers identify meaningful groups in the source's overall ordering, and ADP forecasts the quality and composition of the board likely to remain at the user's next selection. These signals must improve timing decisions without turning ADP into player value or becoming unsupported position-tier, projection, probability, or strategy claims.

---

## Target User

The Phase 5.5 user is a single fantasy football drafter using a managed ranking set during a manual, persisted, or replayed draft.

They need recommendations that remain easy to understand while accounting for more than static rank. The user should be able to see when an overall tier boundary or a material change between the current and forecasted next draft pocket affected a recommendation, without needing to understand the scoring implementation.

---

## Phase Goals

Phase 5.5 should deliver:

- An overall-tier recommendation signal derived from valid overall/source tier data in the active ranking snapshot.
- A deterministic board forecast that uses ADP, current draft state, and picks until the user's next selection to describe the next likely draft pocket.
- Forecast observations for current and future tier composition, position composition, replacement quality, skip safety, and pocket diversity without converting those observations into player quality.
- Deterministic integration of overall-tier, forecast, and roster signals into the bounded additive Recommendation Engine.
- Score-backed recommendation reasons when overall-tier context or a forecasted pocket transition materially affects an output.
- Explicit fallback behavior: when the dataset contains ADP, a player with missing ADP is ordered after the dataset's highest ADP value; when the complete dataset lacks ADP, the forecast contribution remains neutral. Wholly absent overall/source-tier data becomes one neutral overall tier for the complete ranking context.
- Focused validation that the new signals improve recommendation timing without overwhelming stronger ranking information or changing existing engine boundaries.

The phase is successful only if recommendations better answer who should be drafted now while remaining deterministic, inspectable, and anchored to the selected ranking snapshot.

---

## Scope

### In Scope

- Consume valid overall/source tier values from the active ranking snapshot as an overall-tier recommendation input.
- Treat overall/source tiers according to their overall ranking semantics, not as position-local tiers or position-tier-drop pressure.
- Keep player quality independent of ADP and anchored to overall rank plus valid overall/source-tier context.
- Determine the user's next overall selection and the number of intervening selections from the current draft state.
- Build a deterministic forecast from the remaining player pool by sorting on ADP, then overall rank, then stable identifier, and removing the expected number of intervening selections.
- Assign players with missing ADP after the highest supplied ADP value when at least one valid dataset ADP exists, while keeping ranking sets with no ADP usable through a neutral forecast contribution.
- Describe the current and forecasted boards through their highest overall tier, tier composition, position composition within overall tiers, and top available players by user ranking.
- Derive pocket-transition observations, position representation, replacement quality, skip safety, and pocket diversity from the comparison between the current and forecasted boards.
- Compare current and forecasted draft pockets when scoring candidates, emphasizing opportunities that materially disappear or survive rather than whether one exact player is expected to remain.
- Integrate overall-tier, forecast, and roster signals into the existing deterministic, bounded additive scoring model.
- Bound individual and total context effects so substantially stronger player-quality information is not overridden by ADP-derived forecast signals alone.
- Preserve deterministic ordering and tie-breaking.
- Recalculate recommendations after every draft pick so the user can preview the next decision between turns.
- Produce recommendation reasons directly from scoring components when an overall-tier or forecast observation has a meaningful effect.
- Preserve existing ranking-set, snapshot, manual draft, persistence, scenario, and replay workflows.
- Validate normal, missing-data, boundary, and conflicting-signal behavior with deterministic automated scenarios and focused manual QA.

### Out of Scope

- Position tiers or position-local tier-drop modeling derived from overall/source tiers.
- Projection ingestion or projection-based scoring.
- Value-over-replacement calculations.
- Opponent modeling, draft simulations, Monte Carlo methods, probability estimates, or individual-player availability predictions beyond the deterministic next-pocket forecast.
- Strategy or Insight Engine changes, including planning beyond the user's next selection, confidence metrics, or broad strategic advice.
- Artificial tiers derived from rankings or ADP.
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
- Determine the user's next selection and forecast the remaining board after the expected intervening picks.
- Compare the current draft pocket with the forecasted next pocket to identify which tiers, positions, and comparable options disappear or remain plentiful.
- Evaluate replacement quality and skip safety without rewarding a player merely because their ADP falls before the user's next pick.
- Combine player quality, forecast observations, and existing roster context without allowing one modifier to dominate the recommendation.

### Understand the Recommendation

- Show score-backed reasons when overall-tier context or a forecasted pocket transition materially contributes.
- Keep reasons silent when the relevant data is absent or had no meaningful scoring effect.
- Describe ADP-derived effects in terms of the future decision space, replacement quality, or skip safety, not player quality or certainty about a specific player's availability.
- Do not describe overall/source tiers as position scarcity or position-tier pressure.

### Reproduce Behavior

- Replay the same draft state with the same ranking snapshot and receive the same recommendation order, scores, and reasons.
- Preserve the result even if the mutable source ranking set later changes or is removed.

---

## Milestones

### Milestone 1 - Signal Semantics and Scoring Contract

Define the project-level behavior of player quality, board forecasting, and recommendation decisions, including neutral states, bounded influence, interaction with base rank, and distinction from existing position-tier pressure.

### Milestone 2 - Overall Tier Recommendation Signal

Use valid overall/source tier context to improve ordering among relevant candidates without treating the data as position-local tiers or producing position-tier-drop claims.

### Milestone 3 - Deterministic Draft Pocket Forecast

Use available ADP, current draft state, and picks until the user's next selection to forecast the remaining board and describe current, future, and transitional pocket observations. Apply the documented missing-ADP fallback and keep wholly absent ADP neutral.

### Milestone 4 - Recommendation Integration and Reasons

Integrate overall-tier, board-forecast, and roster signals into the bounded additive scoring output and expose concise, score-backed reasons for material contributions.

### Milestone 5 - Recommendation Confidence

Validate deterministic behavior across representative scenarios, next-pick distances, missing data, tier boundaries, pocket transitions, ADP disagreement, persisted drafts, and replay workflows. Tune only within the approved signal semantics and scoring bounds.

---

## Architecture Impact

Phase 5.5 adds a conceptual Board Forecast layer inside the existing pure Recommendation Engine. It does not introduce a new service, persistence lifecycle, or external system boundary.

The intended flow becomes:

```text
Immutable Draft Ranking Snapshot
  |-- Overall Rank ---------> Player Quality
  |-- Overall/Source Tier ---^
  `-- ADP --------------------------.
                                      |
Draft State + Picks Until Next Pick --+--> Board Forecast
                                               |
Player Quality + Forecast Signals + Roster ----+--> Bounded Additive Scoring
                                                        |
                                              Recommendations + Reasons
```

The Recommendation Engine remains a pure domain layer. It consumes typed draft state, league settings, user team identity, and immutable ranking snapshot data; it does not parse imports, query ranking persistence, mutate draft state, depend on React, or persist its output.

Important boundaries:

- Overall rank remains the scoring anchor for player quality.
- Overall/source tiers may inform an overall-tier signal but must not be interpreted as position-local tier-drop pressure.
- Existing recommendation-tier eligibility continues to govern any position-tier-pressure behavior; Phase 5.5 does not create or infer position tiers.
- ADP is used only for deterministic market-timing forecasts of the next decision space; it does not contribute to player quality or claim certainty about opponent behavior.
- The Board Forecast observes the current board, removes the expected intervening selections in deterministic ADP order, and describes the resulting draft pocket; it does not simulate opponents or estimate probabilities.
- Forecast outputs remain observations until the Recommendation Decision combines them with player quality and roster context.
- Each new modifier and the combined context effect remain bounded.
- Recommendation reasons remain direct descriptions of scoring inputs that materially affected the result.
- When any valid dataset ADP exists, missing player ADP is assigned after the highest supplied ADP value for forecast ordering. An entire ranking set without ADP remains usable with a neutral forecast contribution. Wholly absent overall-tier data materializes one explicitly defaulted neutral tier; malformed or partially supplied tier data must not create guessed boundaries.
- Ranking snapshots remain the complete reproducibility boundary; recommendation output remains derived.

### Architecture Tradeoff Assessment

- **Complexity cost:** The forecast adds board projection and pocket-comparison logic plus new interaction and tuning cases. Keeping it deterministic and internal to the current scoring pipeline avoids simulation infrastructure or a premature generic signal framework.
- **Maintenance cost:** Forecast semantics, missing-data behavior, bounds, and explanations require scenario coverage as ranking data evolves. Pure functions and score-backed reasons keep that maintenance localized.
- **Scaling implications:** Forecasting sorts the remaining players and remains an in-process calculation over one draft snapshot. No additional services, caches, queues, or background processing are required.
- **Developer experience:** Separating player quality, forecast observations, and recommendation decisions makes behavior easier to debug, but named semantics and representative fixtures are needed to prevent accidental overlap with existing tier or scarcity signals.
- **Deployment implications:** The phase stays within the existing Next.js monolith and PostgreSQL/Prisma deployment model and requires no new operational infrastructure.
- **Iteration speed:** Small, independently testable signals support fast tuning while deterministic replay protects against regressions.

---

## Success Criteria

Phase 5.5 is successful when a user or developer can:

1. Receive a deterministic recommendation that incorporates valid overall/source tier context from the active ranking snapshot.
2. Confirm that overall/source tiers affect only the overall-tier signal and never masquerade as position-local tier pressure.
3. Produce a deterministic forecasted board from the remaining players, supplied ADP, picks until the user's next selection, overall rank, and stable identifiers.
4. Compare current and forecasted pockets through observable tier composition, position composition, top-ranked options, replacement quality, skip safety, and pocket diversity.
5. Recommend around material changes in the future decision space without treating ADP as player quality or rewarding a candidate solely because their ADP falls before the next user pick.
6. Confirm that ADP-derived forecast effects alone do not override a substantially stronger overall ranking or overall-tier case.
7. Receive concise, score-backed reasons when overall-tier or draft-pocket forecast signals materially affect a recommendation.
8. Receive no unsupported overall-tier or forecast reason when the corresponding signal is wholly absent, defaulted-neutral, neutral, or immaterial.
9. Continue receiving deterministic recommendations when individual players lack ADP by placing them after the highest supplied dataset ADP, and when the complete ranking context lacks ADP by keeping the forecast contribution neutral.
10. Continue receiving recommendations for ranking contexts without supplied overall tiers by using one explicitly defaulted neutral tier rather than guessed boundaries.
11. See deterministic recommendation previews recalculate after every recorded pick, including between the user's turns.
12. Replay the same draft state and ranking snapshot and receive the same forecasted board, recommendation ordering, component scores, and reasons.
13. Preserve existing manual draft, ranking management, persistence, scenario, and replay workflows.
14. Confirm through focused automated scenarios that tier boundaries, next-pick distance, pocket transitions, ADP disagreement, missing data, modifier bounds, total context caps, and deterministic tie-breaking behave as approved.
15. Complete focused manual QA showing that updated recommendations clearly communicate player quality, current-versus-forecasted pocket context, replacement quality, skip safety, and neutral fallbacks as distinct concepts.

Recommendations should feel more aware of draft timing without becoming opaque, speculative, or detached from the ranking snapshot.

---

## Product Principles

- Answer who should be drafted now, not merely who has the best static rank.
- Keep overall rank as the player-quality anchor.
- Treat overall/source tiers according to their overall semantics; never present them as position tiers.
- Treat ADP as market timing for a deterministic next-pocket forecast, not quality or opponent certainty.
- Forecast the board and future decision space rather than asserting that a specific player will or will not remain available.
- Prefer pocket transitions, replacement quality, and skip safety over raw ADP urgency.
- Keep context modifiers bounded, additive, deterministic, and inspectable.
- Generate reasons only from scoring components that materially affected the recommendation.
- Order missing player ADP after the highest supplied dataset value, and remain neutral only when the complete ranking context has no usable ADP.
- Materialize one explicitly defaulted neutral overall tier when a ranking context has no supplied tiers; never invent tier boundaries.
- Preserve immutable snapshots and reproducible recommendation behavior.
- Keep the Recommendation Engine pure and independent of ranking origin, persistence, UI state, and draft source.
- Avoid a generic signal framework until real duplication or extension pressure justifies one.
- Defer projections, VORP, position-tier modeling, probabilistic or simulated forecasts, multi-pick strategic insights, live providers, accounts, and machine learning to future phases.
