# Phase 5.5 Design: Draft Pocket Forecasting

## Purpose

This document defines the guiding architecture for incorporating ADP into the Phase 5.5 recommendation engine.

The goal is **not** to improve player rankings.

The goal is to improve draft recommendations by forecasting what the user's next decision will likely look like.

This document intentionally focuses on the MVP architecture. Projection models, VORP, simulations, opponent modeling, machine learning, and probability models are explicitly out of scope.

---

# Design Philosophy

The recommendation engine answers:

> **"Who should I draft now?"**

It does **not** answer:

> "Who is the best player?"

Those are different problems.

Player quality is already represented by:

- Overall rankings
- Overall/source tiers

ADP should **not** change player quality.

Instead, ADP exists to answer:

> **"What happens if I wait?"**

More specifically:

> **"What draft pocket am I likely to be choosing from at my next pick?"**

---

# Core Principle

Separate player quality from market timing.

## Player Quality

Determined by:

- Overall ranking
- Overall/source tier

This answers:

> "How good is this player?"

Player quality should remain independent of ADP.

---

## Market Timing

Determined by:

- ADP
- Picks until the user's next selection
- Current draft state

This answers:

> "What opportunities are likely to remain when I pick again?"

ADP measures **opportunity cost**, not player value.

---

# Recommended Architecture

The recommendation engine should conceptually consist of three layers.

```text
Player Quality
    ↓
Board Forecast
    ↓
Recommendation Decision
```

## Layer 1 — Player Quality

Responsible only for evaluating player strength.

Inputs:

- Overall ranking
- Overall/source tier

Outputs:

- Player quality signals

This layer should never use ADP.

---

## Layer 2 — Board Forecast

This is the primary Phase 5.5 feature.

Its responsibility is **not** to score players.

Its responsibility is to produce a deterministic forecast of what the board will likely look like at the user's next pick.

Inputs:

- Current draft state
- Remaining players
- ADP
- Picks until next user selection

Outputs:

- Forecasted board
- Draft pocket description
- Forecast signals

---

## Layer 3 — Recommendation Decision

Consumes:

- Player quality
- Forecast signals
- Existing roster state

Produces:

- Final recommendation score
- Recommendation ordering

This layer determines whether a player should be selected now based on how the current board compares to the forecasted board.

---

# Draft Pocket Forecasting

This should become the defining feature of Phase 5.5.

The engine should **not** attempt to predict individual player availability.

Instead, it should forecast the user's **next draft pocket**.

A draft pocket represents the realistic set of choices the user is expected to have when they are back on the clock.

Example:

Current pocket:

```text
Tier 2

RB
RB
WR
WR
WR
```

Forecasted next pocket:

```text
Tier 3

WR
WR
WR
QB
TE
```

The recommendation engine should recognize:

- The RB pocket disappeared.
- The WR pocket largely survived.
- The highest available overall tier dropped.
- The user's future decision space changed.

This is significantly more useful than determining whether one specific player survives.

---

# Forecast Algorithm

The MVP forecast should remain completely deterministic.

## Step 1

Determine:

- Current overall pick
- User's next overall pick
- Number of selections before the user picks again

---

## Step 2

Build the remaining available player pool.

---

## Step 3

Assign every remaining player an ADP.

When at least one valid ADP exists in the active ranking snapshot, missing ADP should be handled by assigning:

```text
Highest ADP in dataset + 1
```

This reflects the assumption that players without ADP are generally expected to go undrafted while preserving deterministic behavior. The fallback affects forecast order only; it must not reduce player quality or produce a negative recommendation reason.

When the complete ranking snapshot contains no valid ADP, the forecast timing contribution is neutral. The engine should continue to recommend from rank, overall/source tier, roster, and existing context without constructing an ADP-removal forecast.

---

## Step 4

Sort remaining players by:

1. ADP
2. Overall ranking
3. Stable identifier (to guarantee deterministic ordering)

---

## Step 5

Remove the number of expected selections before the target user pick.

The remaining players become the forecasted board.

No simulation is performed.

No probability is estimated.

No opponent modeling exists.

---

## Step 6

Analyze the forecasted board.

This analysis becomes the primary input into recommendation scoring.

---

# Draft Pocket Signals

The forecast layer should expose observations rather than scores.

Recommended signals include:

## Current Board

- Highest available overall tier
- Tier composition
- Position composition within each overall tier
- Top-N available players by user ranking

---

## Forecasted Board

- Forecasted highest available overall tier
- Forecasted tier composition
- Forecasted position composition
- Forecasted Top-N players
- Forecasted draft pocket

---

## Pocket Transition

Describe how the board changes.

Examples:

- Highest available tier decreases
- RB pocket disappears
- WR pocket remains deep
- TE remains stable
- QB becomes more represented

These transitions are more valuable than individual player availability.

---

## Replacement Quality

For every recommendation candidate ask:

> If I skip this player, what comparable opportunities are forecasted to remain?

Comparison should consider:

- Overall/source tier
- Position
- User ranking

No derived position tiers should ever be created.

---

## Skip Safety

Skip Safety becomes one of the most important recommendation signals.

High Skip Safety:

Passing this player is unlikely to reduce the quality of future options.

Low Skip Safety:

Passing this player significantly changes the quality or composition of the next draft pocket.

This is fundamentally different from urgency.

The engine should identify players that are **safe to skip**, not simply players that are unlikely to return.

---

## Pocket Diversity

The forecast should also describe characteristics of the next draft pocket.

Examples:

- WR-heavy
- RB-heavy
- Balanced
- Onesie-heavy (QB/TE)
- Thin

These descriptors are descriptive in the MVP. They must not change a candidate's score directly. Candidate-specific replacement quality and skip safety may use the underlying position counts, but a label such as `WR-heavy` or `onesie-heavy` is not itself a recommendation rule.

---

# Recommendation Philosophy

The recommendation engine should compare:

Current draft pocket

vs

Forecasted draft pocket

It should answer questions like:

- What opportunities disappear?
- What opportunities remain?
- Which player profiles become difficult to replace?
- Which profiles remain plentiful?
- Which players are safe to skip?

The recommendation engine should **not** reward players simply because they are projected to be drafted before the user's next pick.

Instead it should identify whether skipping them materially changes the user's future options.

---

# Recommendation Inputs

Player Quality:

- Overall ranking
- Overall/source tier

Forecast Signals:

- Highest available tier
- Forecasted highest tier
- Pocket transition
- Replacement quality
- Skip Safety
- Position representation within forecasted pocket
- Pocket diversity

Roster Signals:

- Existing roster construction
- Lineup requirements
- Position needs

---

# Resolved MVP Design Decisions

This section converts the domain guidance into an executable design contract. These rules are the default MVP behavior unless a later approved design explicitly replaces them.

## Decision Point and Forecast Target

The target user pick is the first pick owned by the user with a pick number strictly greater than the draft's current overall pick.

```text
target user pick = first user pick after current overall pick
picks to remove = target user pick - current overall pick
```

This produces consistent behavior in both supported states:

- When the user is on the clock, the removal count represents the current selection plus the intervening selections before the user picks again.
- Between user turns, the removal count represents the selections expected before the user's upcoming pick and supports the existing preview workflow.

The calculation uses the draft's generated pick order rather than deriving snake-draft arithmetic again inside the forecast.

If there is no later user pick, future timing has no decision value. The forecast returns a neutral `no-next-pick` status, and no forecast timing component, replacement quality, skip safety, or next-pocket reason is produced. If the draft is complete, the existing recommendation contract continues to return no recommendations.

## Draft Pocket Construction

A draft pocket is the top tier-aware group by the user's overall ranking. It is not the ADP removal window or the complete available board.

Build both the current and forecasted pockets with the same deterministic function:

1. Sort the supplied board by overall rank, then stable player ID.
2. Take the top six players, or every player when fewer than six remain.
3. When the sixth player has a meaningful supplied overall/source tier, continue through the end of that tier.
4. Stop after 12 players even when the tier continues.
5. A defaulted-neutral tier does not extend the pocket beyond six because it is not evidence of a real quality grouping.

The resulting pocket therefore contains 6–12 players while enough players remain. `Top-N` in forecast output means the players in this derived pocket; `N` is not a separate setting.

The current pocket is built from the current available board. The forecasted pocket is rebuilt from the board remaining after the deterministic ADP removal window. Overall rank and overall/source tier shape both pockets; ADP only determines which expected selections are removed.

## ADP Normalization and Forecast Ordering

ADP normalization uses the complete active ranking snapshot, not only the current pocket.

- If any valid ADP exists, every missing ADP receives `max valid snapshot ADP + 1` for forecast ordering.
- If no valid ADP exists, the forecast returns a neutral `no-adp` status.
- Equal normalized ADP values are ordered by overall rank and then `player.id`.
- Missing-ADP fallback status is forecast evidence only. It is never a quality penalty, independent score, or recommendation reason.

After normalization, sort the complete current available pool by normalized ADP, overall rank, and `player.id`. Remove exactly `picks to remove` players. The remaining ordered-independent set is the forecasted board, from which the forecasted pocket is built.

The forecast relies on existing draft-state validation for a coherent pick order and available-player pool. It does not attempt to repair invalid draft state.

## Shared Forecast and Candidate Evaluation

Create one shared board forecast per recommendation calculation. Do not create a counterfactual forecast for every candidate.

The shared forecast answers:

> What does the board and meaningful choice set look like at the target user pick?

The Recommendation Decision then evaluates each candidate against that shared forecast:

> What comparable options to this candidate remain in the forecasted pocket?

Only candidates in the current pocket are eligible for a forecast timing adjustment. Candidates outside the user's current meaningful decision space receive a neutral forecast component. The forecast may still describe their underlying board data, but it must not manufacture timing pressure for remote candidates.

The forecast layer remains roster-agnostic. It may consume available players, overall rank, validated overall/source tier, ADP, current pick, target user pick, and stable IDs. Roster construction, lineup needs, bench needs, and strategy enter only in the Recommendation Decision layer.

## Comparable Profile and Replacement Quality

For the MVP, a replacement must always share the candidate's position and be reasonably close in overall rank.

```text
rank proximity = absolute overall-rank difference of 12 or fewer
```

The 12-rank window matches the maximum pocket size and avoids introducing a second unrelated lookahead horizon.

Classify forecasted-pocket players other than the candidate as follows:

- **Comparable replacement:** Same position, within the 12-rank window, and in the same or a better meaningful overall/source tier. When tiers are defaulted-neutral, position plus rank proximity is sufficient.
- **Near replacement:** Same position and within the 12-rank window, but in a worse meaningful overall/source tier.
- **Not a replacement:** Different position or outside the 12-rank window.

No position tiers are inferred. A source tier is used only as its validated overall grouping, and a defaulted-neutral tier must not act like a real tier boundary.

Replacement quality is candidate-specific and derived from the shared forecasted pocket:

- **High:** At least two replacements remain, including at least one comparable replacement.
- **Medium:** Exactly one replacement remains, or multiple near replacements remain without a comparable replacement.
- **Low:** No comparable or near replacement remains.

## Skip Safety and Profile Transitions

Skip safety is derived from replacement quality plus whether the candidate itself remains in the forecasted pocket:

- **High:** Replacement quality is high.
- **Medium:** Replacement quality is medium, or the candidate itself remains in the forecasted pocket.
- **Low:** Replacement quality is low and the candidate is absent from the forecasted pocket.

The transition analysis should also expose objective evidence without adding separate scores for each observation:

- Candidate position and meaningful overall-tier profile count in each pocket.
- Whether that position/tier profile disappeared.
- Whether the candidate's overall tier was the current highest meaningful tier and is absent from the forecasted pocket.
- Comparable and near-replacement counts.
- Whether the candidate itself remains in the forecasted pocket.

These observations explain replacement quality and skip safety. They must not become overlapping modifiers that count the same opportunity cost more than once.

## Pocket Diversity Labels

Pocket output should always expose objective position counts. It may also expose the following deterministic, non-scoring labels:

- `thin` when fewer than six players remain in the pocket.
- `WR-heavy` when WR is a strict majority of the pocket.
- `RB-heavy` when RB is a strict majority of the pocket.
- `onesie-heavy` when QB and TE together are a strict majority of the pocket.
- `balanced` when no heavy label applies and at least three positions are represented.
- `mixed` when no other shape label applies.

`thin` may coexist with one shape label. Diversity labels describe the board for debugging, display, and explanations backed by a scored candidate signal; they never add score by themselves.

## Position-Specific Domain Interpretation

The forecast algorithm and candidate comparison rules remain consistent across positions, but the Recommendation Decision must preserve the different strategic interpretation of RB/WR depth and QB/TE onesie depth. This section does not assign inherent value to a position or introduce position-specific forecast weights.

### RB and WR

RB and WR are the primary depth-comparison positions for the MVP:

- When comparable WR options remain deep in the forecasted pocket, the current WR receives high skip safety and no forecast timing boost. The fact that one exact WR falls inside the ADP removal window does not change this result.
- When a current RB's comparable tier/rank profile disappears from the forecasted pocket, that RB receives low skip safety and the corresponding timing boost.
- When both RB and WR remain deep, forecast timing is neutral for both profiles. Overall rank, meaningful overall/source tier, and roster context determine the recommendation.
- When both RB and WR become thin, each candidate receives only the timing delta supported by its own replacement and skip-safety evidence. The stronger player-quality case should remain ahead unless roster context creates a meaningful reason to reorder them.

These rules are consequences of the shared replacement-quality contract, not hardcoded RB or WR preferences. The engine must not assume that RB is always scarce or that WR is always deep.

### QB and TE Onesie Positions

QB and TE require additional interpretation because the MVP lineup normally starts only one of each:

- `onesie-heavy` is descriptive and never produces a score by itself.
- A small number of QB or TE players in a pocket is not sufficient evidence to recommend the position.
- QB or TE timing pressure must come from candidate-specific loss of a comparable overall-tier/rank profile, using the same replacement-quality and skip-safety rules as other positions.
- A QB or TE is most defensible when its player-quality case is strong, its comparable profile becomes thin or disappears, and the separate roster-fit component supports the selection.
- Existing roster-fit penalties remain active when the user has limited need at QB or TE. Forecast timing must not convert generic onesie thinness into an unsupported roster need or bypass that penalty.

The forecast layer still computes QB/TE pocket facts without roster knowledge. The Recommendation Decision owns the combination of player quality, candidate timing, and roster fit.

The domain observation that a user may dislike the available RB/WR prices is not modeled as a new input because the MVP has no subjective preference signal. Overall rank, overall/source tier, value opportunity, and roster fit are the supported evidence for whether a QB or TE is preferable to the available RB/WR choices.

## Forecast Scoring Contract

The MVP uses one candidate-level `draft_pocket_timing` score component. It replaces the direct player-level ADP availability-risk component; both must not run together because that would count the same market-timing evidence twice.

The component is eligible only when:

- The forecast status is active.
- The candidate is in the current pocket.
- The candidate position is QB, RB, WR, or TE.
- A target user pick exists.

Initial deterministic deltas are:

```text
Low skip safety:     +6
Medium skip safety:  +3
High skip safety:     0
```

The maximum forecast delta matches the existing overall-tier component bound and remains below the former direct ADP availability maximum. This is strong enough to break close decisions without making ADP-derived timing the player-quality anchor.

The forecast delta participates in the existing urgency cap and total context cap. Profile disappearance, highest-tier transition, replacement quality, and skip safety are evidence for this single component, not separately additive bonuses. Raw ADP gap, membership in the removal window, diversity labels, and missing-ADP fallback status never score directly.

The following conditions always produce a neutral forecast component:

- No valid ADP in the complete ranking snapshot.
- No later user pick.
- Candidate outside the current pocket.
- Candidate position is DST or K.
- High skip safety.

## Recommendation Reasons

A forecast-backed reason may appear only when the `draft_pocket_timing` component has a material non-zero delta under the existing reason-selection rules.

Reason text should be generated from the strongest component evidence:

- Low skip safety: `Comparable RB options are thin in the forecasted next pocket.`
- Position/tier disappearance: `Similar TE options are not represented in the forecasted next pocket.`
- Medium skip safety: `Only limited comparable WR options remain in the forecasted next pocket.`
- Highest meaningful tier transition: `This overall tier is likely to be mostly gone by your next pick.`

Use the candidate's actual position in generated text. Do not say that a player will definitely be gone, that the market values the player, or that missing ADP is negative evidence.

High skip safety and descriptive diversity may be exposed in diagnostic forecast output, but they do not produce recommendation reasons because they contribute no score in the MVP.

## Typed Output and State Ownership

The forecast should return a typed derived value with these conceptual fields:

```text
DraftPocketForecast
  status: active | no-adp | no-next-pick
  targetPickNumber: number | null
  picksToRemove: number | null
  removalWindowPlayerIds: player ID[]
  forecastedBoardPlayerIds: player ID[]
  currentPocket: DraftPocket
  forecastedPocket: DraftPocket | null
  transition: shared tier and position observations | null

DraftPocket
  playerIds: player ID[]
  highestMeaningfulOverallTier: number | null
  overallTierCounts: tier/count values
  positionCounts: position/count values
  diversityLabels: label[]

CandidatePocketSignal
  candidatePlayerId: player ID
  replacementQuality: high | medium | low | neutral
  skipSafety: high | medium | low | neutral
  comparableReplacementCount: number
  nearReplacementCount: number
  candidateInForecastedPocket: boolean
  profileDisappeared: boolean
  timingDelta: number
```

The implementation may choose concrete collection shapes that fit existing domain conventions, but it must preserve these semantics and deterministic ordering.

Forecast output is derived and unpersisted. It belongs inside the pure Recommendation Engine boundary, requires no database schema or repository changes, and is recomputed from immutable ranking snapshot data plus current draft state. Replay with the same inputs must reproduce the same forecast, component evidence, recommendation ordering, and reasons.

---

# Explicitly Out of Scope

The MVP should intentionally avoid:

- Projection models
- VORP
- Machine learning
- Opponent modeling
- Monte Carlo simulations
- Probability estimates
- League tendency models
- Derived position tiers
- Artificial tiers generated from rankings or ADP

These can be layered onto the existing architecture later without changing its conceptual design.

---

# Design Principles

## Separate Concepts

Player Quality answers:

> "How good is this player?"

Board Forecast answers:

> "What opportunities will likely exist later?"

Recommendation Decision answers:

> "Given both, who should I draft now?"

---

## ADP is Market Timing

ADP should never become another player quality metric.

It exists solely to forecast the future decision space.

---

## Forecast the Board, Not the Player

The recommendation engine should care far more about:

> "What pocket will I draft from?"

than

> "Will this exact player still exist?"

---

## Forecast Decision Space

The objective is not predicting selections.

The objective is predicting the quality and composition of the user's next meaningful set of choices.

This creates a recommendation engine that remains:

- Deterministic
- Explainable
- Testable
- Maintainable
- Easily extensible into future phases

without introducing unnecessary complexity during the MVP.
