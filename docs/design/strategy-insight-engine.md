# Strategy & Insight Engine Design

## Status

Draft for approval and task planning.

## Purpose

Phase 6 introduces the Strategy & Insight Engine as the layer that explains the current draft decision above the existing Recommendation Engine.

The goal of this document is to remove architectural ambiguity before implementation tasks are created. It defines the Insight Engine boundary, supported inputs, output shape, insight taxonomy, language rules, validation scenarios, and tradeoffs.

This is a design document, not an implementation task list.

---

## Context

The product is a Fantasy Draft Decision Engine. Earlier phases established:

- A Draft State Engine that owns draft rules and current draft state.
- Ranking snapshots as immutable draft inputs.
- A pure Recommendation Engine that scores and orders players through deterministic bounded additive scoring.
- Score-backed recommendation reasons.
- Overall/source-tier and ADP-based draft-pocket signals that remain deterministic and non-speculative.

Phase 6 should make recommendations easier to understand and act on during a live draft. It should explain why the leading option matters, what tradeoffs exist among top options, how the user's roster shape affects the decision, and what the next-pick pocket suggests.

Phase 6 should not change recommendation scores, add new scoring signals, simulate opponents, forecast exact player availability, ingest projections, or generate unsupported strategy claims.

---

## Goals

The Insight Engine should support:

- Producing deterministic strategic insights for the user's current pick.
- Interpreting existing recommendation output, score components, reasons, caps, roster state, ranking context, and board forecast observations.
- Framing the top recommendation as a value, need, timing, pocket-pressure, tier-boundary, run-pressure, clean best-player, or caveated pick when supported.
- Explaining material tradeoffs among top candidates.
- Summarizing roster construction in terms of lineup utility.
- Describing current-board and next-pocket pressure without claiming exact player availability.
- Returning structured insight data that the UI can display compactly.
- Remaining independent from persistence, React, raw imports, mutable ranking sets, and future draft sources.
- Staying deterministic and reproducible for the same draft state and ranking snapshot.

Good Phase 6 behavior means:

- The user can understand the main reason the top recommendation is first.
- The user can see whether the pick is mainly about player quality, roster utility, timing pressure, or a close tradeoff.
- The user can identify which top option is the player-quality play versus the roster/timing play.
- The user can understand what appears safer to wait on before the next user pick.
- The UI avoids verbose strategy lectures and unsupported certainty.

---

## Non-Goals

Phase 6 should not introduce:

- New recommendation scoring modifiers.
- Changes to recommendation ordering.
- AI-generated reasoning.
- Machine learning.
- Opponent modeling.
- Monte Carlo simulations.
- Whole-draft optimization.
- Probability estimates.
- Exact-player availability predictions.
- Projection or VORP-based strategy.
- Live provider integration.
- Persisted recommendation or insight output.
- A broad UI redesign.

---

## Architecture Decisions

### Decision: Add A Pure Insight Engine Above Recommendations

The Insight Engine should be a pure domain layer.

It should accept typed draft inputs plus derived recommendation outputs and return structured insight output. It should not read from the database, mutate draft state, write persistence records, depend on React, call external services, or parse imported ranking files.

Conceptual flow:

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

### Decision: Do Not Re-Score In The Insight Engine

Recommendation scoring remains owned by the Recommendation Engine.

The Insight Engine may compare totals, component deltas, evidence, ranking facts, roster state, and forecast observations to decide which insight to show. It must not create hidden score modifiers or reorder recommendations.

If the Insight Engine discovers that the best explanation would require a new score signal, that is a product/design gap, not something to patch with insight text.

### Decision: Use Structured Evidence, Not Reason Text Alone

Reasons are useful display artifacts, but they should not be the only source of insight logic.

The Insight Engine should prefer structured inputs:

- Recommendation ids and player ids.
- Total score, base score, context score, and score gaps.
- Component ids, deltas, direction, priority, and evidence keys.
- Existing recommendation reasons and reason ids.
- Roster slot state derived from league settings.
- Board forecast status, profile transitions, replacement quality, skip safety, and related observations.
- Active caps such as urgency or total context caps.

Reason text may be reused for presentation, but insight selection should trace to stable component ids and evidence.

### Decision: Keep Insights Derived And Unpersisted

Insights are derived from draft state, ranking snapshot, league settings, recommendations, and forecast observations.

Persisting insight output would create another source of truth and make wording or threshold tuning harder. Loaded drafts should hydrate typed draft inputs, recompute recommendations, then recompute insights.

### Decision: Optimize For Decision Framing Over Verbosity

The Insight Engine should not produce long strategy reports.

The live-draft experience benefits most from a small set of high-signal outputs:

- One primary decision frame.
- One concise top-candidate summary.
- One strongest top-options tradeoff when present.
- One roster construction or next-pocket note when material.
- A caveat only when a meaningful negative component matters.

---

## Conceptual Input Shape

Exact type names can be decided during implementation planning, but the boundary should remain domain-facing.

```ts
type InsightInput = {
  draft: Draft;
  leagueSettings: LeagueSettings;
  userTeamId: string;
  rankings: RankingEntry[];
  recommendations: PlayerRecommendation[];
  forecast?: DraftPocketForecastOutput;
};
```

The Insight Engine should receive recommendation output that is already calculated for the current draft state.

It may derive:

- Top candidate group.
- Score gaps among top recommendations.
- Best base-value candidate.
- Best roster-fit candidate.
- Strongest timing-pressure candidate.
- Strongest value-opportunity candidate.
- Meaningful negative caveats.
- Roster construction summary.
- Next-pocket safety or pressure by profile or position.

The engine should not load or recompute mutable ranking-set data. Ranking snapshots remain the reproducibility boundary.

---

## Conceptual Output Shape

Insight output should be structured so the UI can show compact cards while preserving inspectability.

```ts
type StrategicInsightBundle = {
  summary: CurrentDecisionSummary;
  primaryInsight: Insight | null;
  candidateInsights: CandidateInsight[];
  tradeoffInsights: TradeoffInsight[];
  rosterInsights: Insight[];
  boardInsights: Insight[];
  caveats: Insight[];
  suppressedSignals: SuppressedSignal[];
};
```

Suggested insight shape:

```ts
type Insight = {
  id: string;
  kind:
    | "primary_decision"
    | "candidate_summary"
    | "tradeoff"
    | "roster_context"
    | "board_context"
    | "next_pocket"
    | "caveat"
    | "capability_note";
  severity: "positive" | "info" | "warning" | "neutral";
  title: string;
  body?: string;
  supportedBy: InsightSupport[];
};

type InsightSupport = {
  playerId?: string;
  componentId?: string;
  evidenceKeys?: string[];
  reasonId?: string;
  scoreAdjustmentId?: string;
  forecastProfileId?: string;
};
```

Suggested summary shape:

```ts
type CurrentDecisionSummary = {
  leadingPlayerId: string | null;
  decisionFrame:
    | "clean_best_player"
    | "value_over_need"
    | "need_over_value"
    | "pocket_pressure"
    | "tier_boundary"
    | "run_pressure"
    | "caveated_top_pick"
    | "close_call"
    | "no_material_insight";
  scoreGapLabel: "clear_lean" | "slight_lean" | "close_call" | "unavailable";
};
```

Output should avoid using prose as the data model. The UI can render text from structured insight records, but tests should be able to assert stable ids, kinds, support references, and selected message variants.

---

## Insight Taxonomy

### Primary Decision Frame

The primary frame names the shape of the pick.

Supported frames:

- `clean_best_player`: The top recommendation leads on player quality and has no major roster caveat.
- `value_over_need`: The top recommendation has the stronger player-quality or value case while another candidate has a stronger roster fit.
- `need_over_value`: The top recommendation is not the strongest player-quality option but wins through supported roster and timing context.
- `pocket_pressure`: Draft-pocket timing shows low or medium skip safety for a roster-relevant candidate or profile.
- `tier_boundary`: A supported tier boundary materially affects the recommendation.
- `run_pressure`: Recent draft-room behavior reinforces an already-supported roster, scarcity, or timing case.
- `caveated_top_pick`: The top recommendation remains first despite a meaningful negative component.
- `close_call`: The top candidates are close and the main insight is the tradeoff.
- `no_material_insight`: No supported signal is strong enough to frame the decision beyond the recommendation order.

Frame selection should be deterministic. When multiple frames are eligible, prefer the frame that best explains the top recommendation's material advantage over the next alternatives.

### Candidate Summary

Candidate summaries explain why the leading player ranks first and identify a major caveat when present.

Examples of supported meanings:

- Stronger overall rank or base value.
- Best available overall tier.
- Open starter or flex utility.
- Useful bench depth.
- Material value opportunity.
- Material draft-pocket timing contribution.
- Meaningful roster saturation or early DST/K caveat.

Candidate summaries should not repeat every component.

### Top-Options Tradeoff

Tradeoff insights compare the top two or three recommendations.

Supported comparison dimensions:

- Player quality gap: base score, overall rank, or overall/source tier.
- Roster fit gap: direct starter, flex, bench depth, limited need, saturation.
- Timing gap: tier pressure, scarcity, run pressure, or pocket skip safety.
- Value gap: current pick versus rank-derived value.
- Caveat gap: negative roster or timing penalties.

The best tradeoff insight usually has this shape:

```text
Player A is the better overall value; Player B is the stronger roster/timing fit.
```

If candidates are not close enough for a real decision, the engine should avoid manufacturing a tradeoff.

### Roster Construction Snapshot

Roster insights summarize lineup utility, not team quality.

Supported statements:

- Open starter slots remain at specific positions.
- Flex slots keep RB/WR/TE depth useful.
- RB/WR depth has recurring lineup utility in the MVP two-flex format.
- QB is a single-start slot and does not help flex unless settings say otherwise.
- TE depth should be described cautiously unless the rank, tier, or value case is strong.
- DST/K are early-timing caveats until late draft conditions make them normal needs.
- A saturated position requires a strong value or timing reason to remain attractive.

Roster insight must be derived from the current league settings and roster configuration, not hard-coded MVP constants. MVP defaults can guide wording in default scenarios.

### Board And Next-Pocket Insight

Board insights interpret existing current-pocket and forecasted-pocket observations.

Supported meanings:

- Comparable profiles are thin in the forecasted next pocket.
- Comparable profiles remain, so urgency should be muted.
- The current pocket has better representation for a position/profile than the next pocket.
- A meaningful overall tier is absent from the forecasted next pocket.
- Forecast is inactive or unavailable, so insight stays focused on the current board.

Board insights must not claim:

- A specific player will be gone.
- A specific player can be drafted later.
- Opponents will make specific picks.
- A probability of availability.
- ADP is player quality.

### Caveats

Caveats should appear only when the top recommendation has a meaningful negative component or when a visible signal was intentionally suppressed.

Supported caveats:

- Position is already saturated.
- Candidate is a clear reach relative to rank/value.
- DST/K timing is early.
- Context or urgency caps are active, so stacked urgency should not be over-read.
- Tier, forecast, or ADP context is unavailable or defaulted neutral.

Do not show caveats for minor noise.

---

## Materiality And Selection Rules

The Insight Engine should be score-aware without making raw math the primary user experience.

Recommended materiality concepts:

- `clear_lean`: The top candidate has a meaningful total-score lead and its leading components agree.
- `slight_lean`: The top candidate leads, but the gap is small or the evidence is mixed.
- `close_call`: The top candidates are clustered and the tradeoff matters more than certainty.
- `caveated`: The top candidate is first despite a meaningful negative component.
- `no_material_insight`: Signals are neutral, defaulted, capped, below threshold, or unsupported.

Initial thresholds can be implementation planning decisions, but the design should preserve these behaviors:

- Do not overstate tiny score gaps.
- Do not surface a component that had no material effect.
- Do not show urgency when the timing delta is zero.
- Do not show tier insight when tiers are defaulted neutral or source-only in a way that does not support the claim.
- Do not show forecast insight when forecast status is no ADP, no later user pick, inactive, or neutral.
- When urgency or context caps are active, prefer one consolidated insight over listing every capped urgency signal as decisive.

The engine should return suppressed signal records for debugging and tests when a visible-seeming signal was intentionally omitted.

Conceptual suppressed signal shape:

```ts
type SuppressedSignal = {
  id: string;
  reason:
    | "neutral"
    | "below_threshold"
    | "defaulted_neutral"
    | "unsupported_semantics"
    | "inactive_forecast"
    | "capped"
    | "not_roster_relevant";
  supportedBy: InsightSupport[];
};
```

Suppressed signals are primarily for inspectability. The UI does not need to display them by default.

---

## Language Rules

Insight language should be concise, deterministic, and grounded in supported inputs.

Preferred wording patterns:

- "The recommendation favors player quality here."
- "This is a roster/timing pick more than a pure-rank pick."
- "This position has the strongest current-pocket pressure."
- "Comparable profiles remain in the next pocket, so urgency is muted."
- "This player is in the best available overall tier."
- "This position is already saturated, so the pick needs a strong value reason."
- "A recent run adds pressure, but the recommendation is still grounded in rank, fit, and remaining supply."

Avoid:

- "He will not be available next round."
- "Your opponents will take the remaining players at this position."
- "This player is projected to score more."
- "ADP proves he is better."
- "Draft this position because a run is happening."
- "This is the correct pick with certainty."
- "The model thinks..."

Overall/source tiers may support overall-quality-shelf language. They must not become position-tier-pressure language unless the input is explicitly recommendation-eligible for that semantic.

ADP may support next-pocket timing language. It must not be described as player quality, certainty, or a forecast of exact opponent behavior.

---

## Position Interpretation Guidance

Position-specific wording should guide interpretation, not add new scoring signals.

### QB

In 1QB redraft, QB is a single-start position. A QB can be a strong recommendation when rank, tier, value, or roster context supports it, but an open QB slot should not be over-explained as urgent when comparable options remain.

Useful language:

- "single-slot value"
- "fills QB but does not help flex"
- "worth pushing only because the rank or tier case is strong"

### RB

RB has direct starter slots and flex utility. RB timing often matters when board-specific supply, tier, scarcity, or pocket evidence supports it.

Useful language:

- "helps both starter and flex construction"
- "alternatives thin out in the next pocket"
- "the timing-sensitive position here"

Avoid generic RB panic without current-board evidence.

### WR

WR has direct starter slots and flex utility, especially in PPR. WR depth is valuable, but it may be skip-safe when comparable profiles remain.

Useful language:

- "stronger overall value"
- "adds flexible weekly lineup depth"
- "deep enough to wait"

### TE

TE is a direct starter and may be flex eligible by settings, but ordinary TE depth should be treated more cautiously than RB/WR depth unless the rank, tier, or value case supports it.

Useful language:

- "creates a starter-slot advantage"
- "viable because the rank or tier case is strong"
- "less flexible than RB/WR depth in practice"

### DST / K

DST and K are usually late-draft roster fills in this scope. Existing scoring already owns early timing penalties.

Useful language:

- "early for DST/K relative to roster timing"
- "late-round roster fill"

---

## Presentation Guidance

The presentation layer should show insight output compactly.

Recommended display priority:

1. Primary decision frame.
2. Top-candidate summary.
3. Top-options tradeoff.
4. Roster or next-pocket note.
5. Caveat, if material.

The UI should not need to know scoring internals. It should render structured insight records and use `supportedBy` references for drilldown, tooltips, debugging, or test inspection.

Insight presentation should preserve existing recommendation details rather than replacing them. Score-backed recommendation reasons remain useful lower-level context; Phase 6 adds a higher-level decision frame above those reasons.

---

## Edge Cases

### No Recommendations

Return an empty or neutral bundle with `decisionFrame: "no_material_insight"` and no primary insight.

### One Recommendation

Show candidate summary and caveat if supported. Suppress tradeoff insights.

### Close Score Cluster

Use `close_call` language when top candidates are clustered. Explain the main tradeoff instead of implying a hard recommendation.

### No Active Forecast

Suppress next-pocket claims. If useful, return a capability note that insight is focused on the current board because no active forecast is available.

### No Later User Pick

Suppress future-pick planning and next-pocket urgency. Focus on current board, roster, and value context.

### No ADP

Suppress ADP-derived forecast insight. Do not create urgency from missing market data.

### Defaulted-Neutral Tiers

Suppress meaningful tier-boundary language. Position-depth language may still appear if supported by non-tier board observations.

### Source Tiers Versus Recommendation Tiers

Source tiers may support overall-quality-shelf language only. They must not produce position-tier pressure language.

### Active Caps

When urgency or context caps are active, avoid presenting every capped signal as separately decisive. Prefer a consolidated insight and preserve cap support for inspectability.

### Persisted Drafts And Replays

Insights must recompute from hydrated draft state and immutable ranking snapshots. The same state and snapshot should produce the same bundle.

---

## Validation Strategy

Phase 6 should add scenario-heavy validation around deterministic insight behavior.

Required scenario coverage:

1. Clean top player: top candidate has best base value, positive roster fit, and no major caveat.
2. Value versus need: one candidate is the better overall value while another better fills roster need.
3. Need versus timing: a single-start position fills a slot, but RB/WR pocket pressure is materially stronger.
4. Pocket cliff: comparable profiles are absent or thin in the forecasted next pocket.
5. Skip-safe position: comparable profiles remain, so urgency language is suppressed.
6. Recent run with real pressure: run pressure reinforces roster fit and supply pressure.
7. Recent run without real pressure: run is visible but not roster-relevant or not otherwise thin.
8. Default-neutral tiers: no meaningful tier insight appears.
9. No active forecast or no later user pick: next-pocket claims are suppressed.
10. Early DST/K: caveat appears only when the recommendation output supports it.
11. Context or urgency cap active: insight avoids exaggerating stacked signals.
12. Close-score cluster: output frames a close tradeoff rather than certainty.
13. Persisted draft replay: identical state and ranking snapshot produce identical insights.

Tests should assert:

- Insight ids and kinds.
- Selected decision frame.
- Relevant player ids.
- Support references to components, reasons, evidence, or forecast profiles.
- Suppression of unsupported claims.
- Deterministic output for equivalent inputs.

Manual QA should confirm that the draft screen remains fast to scan and that insight language helps the current decision without feeling speculative or verbose.

---

## Architecture Tradeoffs

### Complexity Cost

The design adds a new domain layer, structured output types, materiality rules, and scenario tests. The added complexity is justified because strategic explanation is now active product scope and should not be mixed into scoring or UI-only text.

### Maintenance Cost

Insight wording must stay aligned with supported inputs as recommendation components evolve. Requiring `supportedBy` references and deterministic scenarios keeps maintenance localized.

### Scaling Implications

Insights are in-process derived outputs over one draft state, ranking snapshot, and recommendation list. No new services, queues, caches, or background jobs are required.

### Developer Experience

A separate Insight Engine keeps scoring tests and strategy-language tests distinct. It also makes it easier to debug why a message appeared or was suppressed.

### Deployment Implications

There are no database, API, service, or deployment changes required by the domain design. The phase stays inside the existing Next.js monolith and PostgreSQL/Prisma deployment model.

### Iteration Speed

Structured insight records and scenario fixtures allow wording and thresholds to improve without rewriting recommendation scoring, persistence, or draft-source code.

---

## Implementation Planning Guidance

Translate this design into tasks in this order:

1. Define the Insight Engine contract and structured output without changing UI behavior.
2. Generate primary decision frames and top-candidate summaries from existing recommendation components.
3. Add top-options tradeoff and roster construction insights.
4. Add next-pocket and board-context insights from existing forecast observations.
5. Present insight output in the draft experience while preserving existing recommendation details.
6. Complete deterministic scenario, regression, replay, and manual QA validation.

Do not implement all milestones in one slice. Do not update `docs/current-slice.md` until tasks are approved and the first task is promoted.

---

## Success Criteria

This design is successful when:

- The Insight Engine has a clear pure-domain boundary above the Recommendation Engine.
- Insight output is structured, deterministic, traceable, and unpersisted.
- Recommendation scores and ordering remain owned by the Recommendation Engine.
- Strategic language is grounded in supported facts, score components, reasons, roster state, and forecast observations.
- Unsupported opponent predictions, probabilities, exact-player availability claims, AI reasoning, and ADP-as-quality claims are excluded.
- The user can understand the top recommendation, strongest tradeoff, relevant roster context, timing pressure, and major caveat without reading raw scoring internals.
- Scenario tests can prove both surfaced insights and intentionally suppressed claims.
