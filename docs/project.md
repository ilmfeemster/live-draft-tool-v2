# Project

## Active Phase

Phase 6 - Strategy & Insight Engine is the active implementation phase.

Phase 5.5 - Overall Tier Recommendations and Draft Pocket Forecasting is complete. The Recommendation Engine can use valid overall/source tiers, ADP-based next-pocket forecasts, roster context, and bounded additive scoring to produce deterministic, score-backed recommendations without treating ADP as player quality or source tiers as position-tier pressure.

Phase 1 established the manual Draft State Engine, Phase 2 added durable draft persistence and ranking snapshots, Phase 3 added deterministic recommendations, Phase 4 added replay and simulator tooling, and Phase 5 made ranking sets first-class product data. Phase 6 builds on that foundation by turning recommendation outputs and draft-state observations into clear strategic insight for the current decision.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context and explains the strategic tradeoffs behind the current decision.

The tool helps users decide who to draft now by combining overall ranking quality, overall tier context, deterministic next-pocket forecasting, roster context, positional scarcity, and current draft state. Phase 6 adds an Insight Engine that interprets those existing recommendation inputs and outputs so the user can understand why the top options matter, what tradeoffs are present, and how the current pick affects the near-term draft plan.

The product remains a companion decision engine, not a fantasy platform, replacement draft room, live provider integration, or broad strategy simulator.

---

## Target User

The Phase 6 user is a single fantasy football drafter using a managed ranking set during a manual, persisted, or replayed draft.

They need recommendations that are fast to act on and easy to trust during a draft. The user should be able to see the main strategic reason behind the recommendation order, recognize important tradeoffs among top options, and understand near-term roster or board consequences without reading raw scoring components or relying on unsupported predictions.

---

## Phase Goals

Phase 6 should deliver:

- A pure Insight Engine layer above the Recommendation Engine.
- Strategic insights derived from draft state, league settings, user roster, ranking snapshot context, board forecast observations, and recommendation output.
- Explanations that connect recommendation results to current decision tradeoffs, roster construction, near-term board movement, and future pick planning.
- Concise, score-aware insight language that remains grounded in deterministic domain inputs.
- A clear separation between recommendation scoring and insight interpretation.
- Focused validation that insights are deterministic, supported by inputs, and useful during realistic draft states.

The phase is successful only if recommendations become easier to understand and act on without adding speculative opponent modeling, machine learning, or live-provider assumptions.

---

## Scope

### In Scope

- Consume existing typed draft state, league settings, user team identity, immutable ranking snapshot data, recommendation output, recommendation component scores, recommendation reasons, and board forecast observations.
- Produce derived strategic insights for the user's current decision.
- Explain why the leading recommendations are attractive in terms of supported scoring inputs and draft context.
- Identify meaningful tradeoffs among top options, such as stronger player quality versus roster fit, immediate need versus future pocket safety, or scarce position context versus better overall value.
- Summarize roster construction state using league settings and the user's current roster.
- Describe near-term future pick planning around the user's next selection without simulating opponents or planning the entire draft.
- Use Phase 5.5 forecast observations only as deterministic board-context inputs, not as claims that specific players will or will not be available.
- Keep insights deterministic, inspectable, and reproducible from the same draft state and ranking snapshot.
- Generate insight text only from facts, scoring components, or observations that materially support the message.
- Preserve existing manual draft, ranking management, persistence, scenario, replay, and recommendation workflows.
- Validate normal, edge-case, and missing-data behavior with deterministic automated scenarios and focused manual QA.

### Out of Scope

- New recommendation scoring signals beyond those already in active recommendation scope.
- Projection ingestion or projection-based strategy.
- Value-over-replacement calculations.
- Position-tier modeling derived from overall/source tiers.
- Opponent modeling, Monte Carlo simulations, probability estimates, or individual-player availability predictions.
- Multi-pick draft simulations or whole-draft optimization.
- AI-generated reasoning or natural-language claims not backed by deterministic inputs.
- Live draft platform integrations.
- Authentication, accounts, cloud sharing, or multi-user workflows.
- Automated ranking, ADP, projection, or news feeds.
- Broad UI redesign unrelated to presenting insight output.

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

The Draft State Engine, Recommendation Engine, and Insight Engine should continue to derive behavior from the dynamic league settings and roster configuration already carried by draft state. Phase 6 does not expand supported league formats.

---

## Core Workflow

### Start or Resume a Draft

- Start, load, or replay a supported draft with its immutable ranking snapshot.
- Continue using the existing draft-state and ranking-selection workflows.
- Recompute recommendations and insights from the current draft state rather than loading persisted output.

### Evaluate the Current Pick

- Generate deterministic recommendations from the existing Recommendation Engine.
- Interpret the recommendation output, current roster, current board, and forecasted next pocket.
- Surface the most important decision context for the current pick.
- Highlight tradeoffs among top candidates when those tradeoffs are materially supported by scoring components or forecast observations.
- Keep insight output focused on the current decision and near-term next pick rather than broad draft theory.

### Understand the Recommendation

- Show concise insight language that explains what matters right now.
- Connect insights to supported inputs such as player quality, roster construction, tier context, scarcity, value opportunity, and deterministic pocket changes.
- Avoid unsupported certainty, opponent predictions, probability language, or claims that ADP represents player quality.
- Keep existing score-backed recommendation reasons available as lower-level detail where useful.

### Reproduce Behavior

- Replay the same draft state with the same ranking snapshot and receive the same recommendation order, scores, reasons, and insights.
- Preserve the result even if the mutable source ranking set later changes or is removed.

---

## Milestones

### Milestone 1 - Insight Engine Contract

Define the boundary between recommendation scoring and insight interpretation, including inputs, outputs, neutral states, reproducibility expectations, and unsupported claim rules.

### Milestone 2 - Current Decision Insights

Derive concise insights that explain the leading recommendations and the main tradeoffs visible in the current draft state.

### Milestone 3 - Roster and Board Context Insights

Use roster construction, league settings, available players, and forecasted pocket observations to explain near-term decision pressure without changing recommendation scoring.

### Milestone 4 - Insight Presentation

Expose insight output in the draft experience in a way that supports fast live-draft decisions while preserving existing recommendation details.

### Milestone 5 - Insight Validation

Validate deterministic insight behavior across representative draft states, missing data, conflicting signals, roster shapes, tier boundaries, pocket transitions, persisted drafts, and replay workflows.

---

## Architecture Impact

Phase 6 introduces an Insight Engine above the Recommendation Engine. It does not introduce a new service, persistence lifecycle, external integration, or AI reasoning layer.

The intended flow becomes:

```text
Draft State + League Settings + User Team
             |
Immutable Draft Ranking Snapshot
             |
Recommendation Engine
             |
Recommendations + Scores + Reasons + Forecast Observations
             |
Insight Engine
             |
Strategic Insights
             |
Presentation Layer
```

The Insight Engine is a pure domain layer. It consumes typed draft state, league settings, ranking snapshot context, recommendation outputs, and supported forecast observations. It returns derived insight output. It must not parse imports, query persistence, mutate draft state, depend on React, call external services, use AI-generated reasoning, or persist its output.

Important boundaries:

- Recommendation scoring remains owned by the Recommendation Engine.
- The Insight Engine interprets scoring outputs and draft context; it does not create hidden score modifiers.
- Insights must be deterministic and reproducible from the same draft state and ranking snapshot.
- Insight language must trace to supported facts, recommendation components, or board observations.
- Unsupported strategy claims, opponent predictions, probability estimates, and certainty about player availability remain out of scope.
- Recommendation output and insight output remain derived rather than persisted.
- Manual, replay, persisted, and future live draft sources should be able to share the same engine boundary.

### Architecture Tradeoff Assessment

- **Complexity cost:** The phase adds a new interpretation layer and new validation cases, but keeps recommendation scoring unchanged and avoids simulation or AI infrastructure.
- **Maintenance cost:** Insight text must stay aligned with supported domain inputs. Keeping messages traceable to named observations reduces drift.
- **Scaling implications:** Insights are in-process derived outputs over one draft state and ranking snapshot. No new services, queues, caches, or background jobs are required.
- **Developer experience:** A separate Insight Engine makes it easier to test recommendation scoring and explanation behavior independently while preserving clear domain boundaries.
- **Deployment implications:** The phase stays within the existing Next.js monolith and PostgreSQL/Prisma deployment model.
- **Iteration speed:** Deterministic scenario tests and replay workflows should allow insight wording and thresholds to improve without changing persistence or draft-source architecture.

---

## Success Criteria

Phase 6 is successful when a user or developer can:

1. Receive deterministic strategic insights for the current draft decision.
2. Confirm that insights are derived from draft state, league settings, ranking snapshot context, recommendation outputs, component scores, reasons, and supported forecast observations.
3. Understand why the leading recommendations are attractive without reading raw scoring internals.
4. See meaningful tradeoffs among top options when those tradeoffs are materially supported by the data.
5. Understand roster construction and near-term board context without receiving unsupported whole-draft or opponent-modeling claims.
6. Confirm that insight output does not change recommendation scores or ordering.
7. Receive no unsupported insight when the relevant signal is absent, defaulted-neutral, neutral, or immaterial.
8. Replay the same draft state and ranking snapshot and receive the same insights.
9. Preserve existing manual draft, ranking management, persistence, scenario, replay, and recommendation workflows.
10. Validate representative insight scenarios through focused automated coverage and manual QA.

Insights should make the assistant feel more strategic and trustworthy while remaining deterministic, inspectable, and grounded in the existing decision engine.

---

## Product Principles

- Answer who should be drafted now and explain the current decision tradeoffs.
- Keep recommendation scoring deterministic, bounded, additive, and owned by the Recommendation Engine.
- Keep insight generation deterministic, derived, and inspectable.
- Use insights to interpret supported inputs, not to invent strategy claims.
- Preserve overall rank as the player-quality anchor.
- Treat overall/source tiers according to their overall semantics; never present them as position tiers.
- Treat ADP as market timing for deterministic next-pocket context, not player quality or opponent certainty.
- Prefer concise, actionable insight language over broad draft theory.
- Generate recommendation reasons and insights only from components that materially support the message.
- Preserve immutable snapshots and reproducible behavior.
- Keep engines pure and independent of ranking origin, persistence, UI state, and draft source.
- Avoid AI reasoning, simulations, opponent modeling, accounts, live providers, and broad product expansion until those roadmap phases become active.
