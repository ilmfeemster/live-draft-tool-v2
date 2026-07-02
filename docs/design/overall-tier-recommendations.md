# Phase 5.5 Overall Tier Recommendations Design

## Status

Draft design baseline for Phase 5.5. No implementation tasks or slices have been approved by this document.

This design expands the existing deterministic Recommendation Engine with two first-class inputs:

- Overall/source tiers as an overall-board quality signal.
- ADP as the market-timing signal used to estimate the opportunity cost of waiting until the user's next turn.

ADP is integral to Phase 5.5 when a player has a published value, but ADP coverage may be partial because deeper players and niche-format players may have no ADP. Missing ADP produces a neutral component for that player rather than blocking import, draft creation, or recommendations. A ranking set with no ADP remains fully usable with every ADP component contributing zero.

---

## Context

The current Recommendation Engine already has a rank-derived base score and bounded components for roster fit, value opportunity, recommendation-eligible position-tier pressure, positional scarcity, and observed runs.

The current implementation does not yet satisfy Phase 5.5:

- `RankingEntry.adpRank` is nullable and the primary scorer does not use it.
- The current `value_opportunity` component compares overall rank with the current pick; it does not estimate whether a player is likely to survive until the user's next turn.
- Overall/source tiers are preserved in `RankingSnapshot.tierSemantics.source.values`, but the Recommendation Engine receives only `RankingEntry[]` and therefore cannot consume them.
- `RankingEntry.tier` is the engine-facing, position-local recommendation tier. It must not be reused for overall/source-tier scoring.
- Draft workspace mapping currently discards snapshot capability and tier-semantics metadata after hydration.

Phase 5.5 must preserve the corrected tier vocabulary while putting overall/source tiers to work according to their actual overall-board meaning.

This design supersedes only the earlier statement that overall/source tiers cannot affect scoring. It does not reverse the decision that overall/source tiers are not position tiers and cannot drive the existing position-tier-cliff component.

---

## Goals

- Make ADP an integral recommendation signal whenever a player has a valid published value.
- Estimate whether selecting a player can safely wait until the user's next turn.
- Use overall/source tiers to preserve meaningful quality boundaries on the overall board.
- Keep overall rank as the primary player-quality anchor.
- Keep overall-tier scoring distinct from position-tier pressure.
- Keep the scoring model additive, bounded, deterministic, and inspectable.
- Generate concise reasons directly from material overall-tier and ADP score components.
- Preserve immutable ranking snapshots as the reproducibility boundary.
- Define explicit neutral fallbacks for absent ADP and wholly absent overall-tier data without inventing market values or tier boundaries.
- Recalculate recommendations after every recorded pick so the user can preview the next decision between turns.

## Non-Goals

- Position-tier creation or inference from overall tiers, overall rank, or ADP.
- Projections, VORP, replacement-level values, or simulations.
- Probabilistic opponent modeling or claims that a particular opponent will select a player.
- Cross-provider ADP reconciliation or automated ADP ingestion.
- Strategy Engine or Insight Engine work.
- A generic scoring-component registry.
- Persisting recommendation output.
- Rewriting immutable historical snapshots to manufacture missing data.

---

## Signal Vocabulary

### Overall Rank

Overall rank is the ranking source's canonical total order and remains the anchor for player quality through the existing base score.

### Overall/Source Tier

An overall/source tier groups players on the source's overall board. It describes a quality band across positions.

It may answer:

- Is this player still in the best quality band currently available?
- Is the draft about to move from the best available overall tier into a lower tier?

It may not answer:

- Is this the last useful player at a position?
- Is a position about to experience a value cliff?
- Does the user's roster need this position?

Those are separate position-tier, scarcity, and roster-fit questions.

### Recommendation Tier

The existing engine-facing recommendation tier is position-local and drives the existing `tier_cliff` component only when explicitly recommendation-eligible.

Overall/source tiers never populate, replace, or implicitly enable this value.

### ADP

ADP is market-timing evidence. It estimates draft cost and the opportunity cost of waiting; it is not an independent measure of player quality.

The Recommendation Engine should use ADP to compare the current decision point with the user's next turn. It must not describe ADP as certainty, projection value, or knowledge of a specific opponent's behavior.

---

## Recommendation Context And Fallbacks

### Decision: Materialize Explicit Recommendation Facts

Before calling the Recommendation Engine, an application-layer builder should materialize a recommendation context from one immutable ranking snapshot.

Conceptually:

```ts
type RecommendationRanking = RankingEntry & {
  overallTier: number;
  overallTierOrigin: "source" | "defaulted-neutral";
};

type RecommendationRankingContext = Readonly<{
  rankings: readonly RecommendationRanking[];
}>;
```

`RankingEntry.adpRank` remains `number | null`. The exact TypeScript shape may preserve the existing entries plus player-id lookups instead of copying domain values. The behavioral contract is:

- A supplied ADP must be positive and finite; a missing ADP remains `null` and produces a neutral ADP component.
- Valid supplied overall/source tiers use `source-overall` semantics.
- Supplied overall-tier values are positive integers and non-decreasing by overall rank.
- Supplied tier gaps may be preserved but do not represent numeric distance or cliff magnitude.
- Player identity and overall rank in supplied tier metadata match the corresponding snapshot entry.
- If the ranking context has no overall/source-tier data, every entry receives overall tier `1` with `defaulted-neutral` origin.
- Partially supplied or malformed tiers must fail validation rather than mixing real and invented boundaries.
- The context is derived entirely from one immutable ranking snapshot.

The all-one fallback is intentionally neutral: with no lower tier available, the overall-tier component contributes `0` for every player and produces no tier reason.

### Decision: Keep Source Metadata Out Of The Scoring Core

The context builder may inspect `RankingSnapshot.capabilities` and `RankingSnapshot.tierSemantics` to validate supplied data and materialize neutral fallbacks. The scorer receives only normalized recommendation facts.

The scorer must not:

- Parse ranking imports.
- Interpret capability labels.
- Query a ranking set or repository.
- Invent missing ADP values.
- Invent tier boundaries when tiers are absent.
- Guess source semantics.

### Decision: Preserve Snapshot Metadata Through Workflows

Phase 5.5 requires the overall-tier metadata already stored in Ranking Snapshot V2. Draft hydration must stop discarding that metadata before recommendation generation.

The application boundary should preserve a complete `RankingSnapshot` or normalized `RecommendationRankingContext` through:

- New draft creation.
- Persisted draft loading.
- Draft room rendering.
- Scenario replay.
- Transient reset and replay sessions.

Do not add `sourceTier` to the existing position-local `RankingEntry.tier` field or overload that field with two meanings.

### Validation Failures

Missing ADP and wholly absent tiers are supported states, not failures. The context builder should still reject malformed supplied data and distinguish at least:

- `invalid-adp`: a supplied ADP value is non-finite or non-positive.
- `partial-overall-tiers`: only part of the ranking context supplies overall tiers.
- `invalid-overall-tiers`: supplied tier values or ordering violate the overall-tier contract.
- `tier-entry-mismatch`: tier metadata does not match snapshot player identity and overall rank.

Immutable historical snapshots are not modified. Fallbacks exist only in the derived recommendation context and do not rewrite persisted data.

---

## Recommendation Input Boundary

### Decision: Pass A Normalized Ranking Context

`RecommendationInput` should no longer rely on a bare `RankingEntry[]` for the Phase 5.5 scorer. It should receive a normalized ranking context carrying entries, nullable ADP, materialized overall-tier facts, and tier origin.

Conceptually:

```ts
type RecommendationInput = {
  draft: Draft;
  rankingContext: RecommendationRankingContext;
  leagueSettings: LeagueSettings;
  userTeamId: string;
};
```

This is preferable to passing the persistence-oriented snapshot directly into every scoring function:

- The application boundary validates supplied capabilities and semantics once.
- Scoring functions operate on explicit domain facts.
- Ranking import and persistence metadata remain outside the engine.
- Missing-data behavior is explicit and deterministic rather than spread across scoring functions.

The existing `RankingSnapshot` is still the source of truth and reproducibility boundary. `RecommendationRankingContext` is a derived, immutable view of that snapshot.

---

## Scoring Model

The existing rank-derived base score remains unchanged in purpose:

```text
total score = base player value + bounded context score
```

Phase 5.5 adds two explicit components:

- `overall_tier`
- `adp_availability`

The components form a new decision-timing group so their correlated urgency cannot stack without limit:

```text
position urgency = cap(
  recommendation-tier cliff
  + positional scarcity
  + observed positional run
)

decision timing = cap(
  overall-tier signal
  + ADP availability signal
)

raw context =
  roster fit
  + position urgency
  + decision timing
  + value opportunity

context score = cap(raw context)
total score = base player value + context score
```

Initial tuning direction:

| Component or group | Initial range | Purpose |
| --- | ---: | --- |
| Overall tier | `0` to `+6` | Preserve the best remaining overall quality band and recognize its boundary. |
| ADP availability | `0` to `+8` | Represent the risk that waiting until the next turn loses the player. |
| Decision timing group | `0` to `+10` | Prevent overall tier and ADP from double-counting the same draft-now urgency. |
| Existing position urgency group | Existing `0` to `+16` | Keep position-local tier, scarcity, and run pressure bounded together. |
| Total context | Existing `-24` to `+30` | Preserve the elite-player and total-context guardrail. |

Exact constants are tuning choices, but the separate components, decision-timing cap, and total-context cap are design requirements.

---

## Overall-Tier Component

### Inputs

- Candidate overall tier.
- Overall tiers of all available players.
- Candidate overall rank.
- Number of available players in the best available overall tier.
- Whether a lower overall tier is also available.

### Rules

1. Find the numerically lowest overall tier among available players. This is the best available overall tier.
2. Do not assign a tier bonus to a candidate outside that tier.
3. If every available player belongs to the same overall tier, return neutral because there is no active tier boundary.
4. Give candidates in the best available overall tier a bounded quality-band bonus.
5. Give a larger bounded bonus when only one player remains in that best overall tier.
6. Do not use the numeric gap between tier labels as a measure of cliff size.
7. Do not filter or compare by position.
8. Do not adjust the component for roster need; roster fit remains independent.

Initial behavior:

- Multiple players remain in the best overall tier and a lower tier exists: `+3`.
- One player remains in the best overall tier and a lower tier exists: `+6`.
- Candidate is outside the best overall tier: `0`.
- No lower tier exists: `0`.

This component intentionally reinforces a tier boundary without replacing overall rank. It should help prevent several lower-tier context bonuses from casually pushing a player across a meaningful overall quality boundary.

### Evidence

The component should expose:

- `candidateTier`
- `bestAvailableTier`
- `bestTierRemaining`
- `hasLowerTierAvailable`
- `thresholdMatched`

Recommended threshold labels:

- `last_in_best_overall_tier`
- `best_overall_tier_available`
- `outside_best_overall_tier`
- `no_overall_tier_boundary`

---

## ADP Availability Component

### Decision Point

Recommendations recalculate after every recorded pick. When another team is on the clock, the output is a preview of the user's next decision and updates again as players are drafted.

- On the user's turn, `decisionPickNumber` is the current pick.
- Between user turns, `decisionPickNumber` is the user's next scheduled pick and the result is marked as a preview.
- `nextTurnPickNumber` is the first user pick after `decisionPickNumber`.
- `turnSpan = nextTurnPickNumber - decisionPickNumber`.

If the user has no later pick after the decision point, the component is neutral because waiting until another turn is not an available decision. Preview scoring uses the same deterministic rules as on-turn scoring; it does not simulate intervening opponent picks. Actual recorded picks remove players and trigger a fresh preview.

### Inputs

- Candidate ADP.
- Decision pick number.
- Next-turn pick number.
- Whether the calculation is a between-turn preview.

### Rules

1. If candidate ADP is `null`, return a neutral component with `missing_adp` evidence and no reason.
2. Compare a supplied candidate ADP with the interval from the decision pick to the next-turn pick.
3. A player whose ADP is at or before the decision pick has already fallen past market cost and receives the strongest availability urgency.
4. A player whose ADP falls before the next-turn pick receives urgency proportional to how early in the turn interval the ADP falls.
5. A player whose ADP is after the next-turn pick receives no availability bonus.
6. ADP never creates a negative score. Expected availability later means there is no need to spend the pick now; it does not make the player worse.
7. The component must not use ADP to replace the base quality score.
8. Fractional ADP values remain valid and are compared without rounding.

Use a normalized interval so the signal works at both ends of a snake draft:

```text
turn progress = (nextTurnPickNumber - adpRank) / turnSpan
```

Initial behavior:

- `adpRank === null`: `0` (`missing_adp`).
- `adpRank <= decisionPickNumber`: `+8` (`available_past_adp`).
- `turn progress >= 2/3`: `+7` (`high_next_turn_risk`).
- `turn progress >= 1/3`: `+5` (`meaningful_next_turn_risk`).
- `turn progress >= 0`: `+3` (`borderline_next_turn_risk`).
- `adpRank > nextTurnPickNumber`: `0` (`expected_available_next_turn`).
- No next user pick: `0` (`no_next_turn`).

The thresholds are deterministic heuristics, not probability claims. Scenario testing may tune their numeric values without changing their semantics.

### Evidence

The component should expose:

- `adpRank`
- `decisionPickNumber`
- `nextTurnPickNumber`
- `turnSpan`
- `turnProgress`
- `isPreview`
- `thresholdMatched`

---

## Interaction With Existing Components

### Base Player Value

Overall rank remains the player-quality anchor. Neither overall tier nor ADP may replace the base curve.

### Value Opportunity

Keep the existing `value_opportunity` component conceptually separate:

- `value_opportunity` answers whether overall rank represents value at the current pick.
- `adp_availability` answers whether the player is expected to survive until the next turn.

The distinction must be visible in component identifiers, evidence, and reasons. Both remain inside the total context cap.

### Position-Tier Cliff

The existing `tier_cliff` component continues to use only explicit position-local recommendation tiers.

The new `overall_tier` component reads only validated source-overall tiers. The two components must not share a tier field, lookup, threshold name, or explanation copy.

### Positional Scarcity And Runs

ADP is market timing for an individual player. Scarcity and observed runs remain position-level context. They may coexist, but group and total caps prevent them from manufacturing unlimited urgency.

### Roster Fit

Overall tier and ADP do not prove roster need. Roster fit remains an independent positive or negative component and can still suppress a poor roster-construction choice through the total score.

---

## Explanation Contract

Reasons remain score-backed and limited by the existing reason-selection policy.

### Overall-Tier Reasons

Emit only when the component is positive and meets the materiality threshold.

Preferred copy:

- Last player in the best available overall tier: `Last player available in the top remaining overall tier.`
- Multiple players in the best overall tier: `Still in the top remaining overall tier.`

Do not mention a position, position cliff, or roster need in this reason.

### ADP Reasons

Emit only when ADP contributes a positive score and meets the materiality threshold.

Preferred copy:

- Past ADP: `Available past ADP #X and unlikely to last to pick Y.`
- Before next turn: `ADP #X falls before your next pick at Y.`

Do not say that a player will definitely be drafted, is better because of ADP, or is a projection value.

### Reason Priority

ADP availability should have high context priority because it directly answers whether the pick can wait. A last-player overall-tier reason should have comparable priority. The existing maximum of three reasons remains unchanged.

Neutral components do not generate reasons.

---

## Compatibility And Versioning

### Ranking Sets

Ranking sets with complete, partial, or absent ADP remain importable, manageable, and selectable for drafts. Valid supplied ADP activates the signal per player; missing ADP contributes zero.

Ranking sets with no supplied overall tiers materialize one neutral overall tier in the derived recommendation context. Partially supplied or malformed tier data fails validation because mixing real and invented boundaries would be misleading.

### Persisted Drafts

Ranking Snapshot V2 already stores capabilities and overall/source-tier values, so no new persistence schema is required to preserve provided tiers.

Draft hydration must preserve available metadata. Historical array-only snapshots remain loadable and recommendable: their nullable ADP values are used per player, and missing overall-tier metadata becomes one neutral tier.

The application must not mutate an immutable snapshot or substitute current ranking-set values into a historical draft.

### Scenarios And Replay

Phase 5.5 replay should carry the same ADP and overall-tier facts as the original recommendation context whenever its format supports them.

Scenario V1 contains nullable ADP in ranking entries but not overall/source-tier semantics. Existing Scenario V1 documents remain loadable and recommendable with their available ADP and a defaulted neutral overall tier.

A versioned scenario contract that embeds Ranking Snapshot V2-equivalent metadata is required to preserve supplied overall-tier signals through portable replay. Until then, Scenario V1 deterministically uses the neutral overall-tier fallback. Do not infer source-overall tiers from the legacy `tier` field.

---

## Validation Strategy

### Context Normalization

- Complete positive finite ADP activates the signal for every player.
- Partial ADP activates the signal only for players with values; null entries remain neutral.
- Absent ADP produces neutral ADP components for the complete set without blocking import or draft creation.
- A malformed supplied ADP still fails validation.
- Complete source-overall tier values activate the overall-tier signal.
- Wholly absent overall tiers materialize one defaulted neutral tier.
- Partial, malformed, legacy-ambiguous, or contradictory tier data must not be interpreted as real overall-tier boundaries.
- Tier metadata with a player-id or overall-rank mismatch fails.
- Tier values decreasing in overall order fail.

### Overall-Tier Scenarios

- Best available overall tier receives a bounded bonus only when a lower tier is available.
- Last player in the best available overall tier receives the larger bounded bonus.
- Lower-tier candidates receive no overall-tier bonus.
- Numeric tier gaps do not change the bonus.
- Overall tiers never produce a position-tier-cliff component or reason.

### ADP Scenarios

- A player already past ADP receives maximum bounded availability urgency.
- ADP in the first, middle, and final portions of the turn interval maps to deterministic risk bands.
- ADP after the next user pick produces no availability bonus.
- A player with null ADP remains recommendable with a neutral ADP component and no ADP reason.
- A complete ranking set with no ADP still produces recommendations with zero ADP weight.
- Fractional ADP behaves without rounding.
- The final user pick produces a neutral no-next-turn component.
- ADP changes timing but cannot by itself overcome a substantially stronger rank and overall-tier case after caps.

### Interaction Scenarios

- Overall tier and ADP share the decision-timing cap.
- Position urgency remains independently capped.
- Total positive and negative context caps remain enforced.
- Roster penalties can still matter when tier and ADP favor a player.
- Value opportunity and ADP availability remain separate components with distinct evidence.
- Identical draft state and snapshot inputs return identical scores, adjustments, order, and reasons.
- Recommendations recalculate deterministically after every pick, including preview states between user turns.

### Workflow Scenarios

- New draft setup accepts ranking sets with complete, partial, or absent ADP.
- New draft setup accepts wholly absent overall tiers through the neutral fallback.
- Supplied snapshot metadata reaches the Draft Room scorer after persistence round-trip.
- Historical snapshots without ADP or overall-tier metadata still produce recommendations using neutral fallbacks.
- Scenario V1 uses neutral overall tiers; a versioned scenario round-trip preserves supplied tier context and deterministic output.
- Between-turn previews update as each recorded pick changes player availability and draft state.

---

## Architecture Tradeoffs

- **Complexity cost:** A validated recommendation context and two new score components add explicit plumbing through draft and replay workflows. This is preferable to teaching the engine about import, persistence, or capability metadata.
- **Maintenance cost:** ADP bands, tier bonuses, and their caps need scenario fixtures. Keeping each calculation pure and evidence-backed localizes future tuning.
- **Scaling implications:** All calculations remain in-process over one immutable snapshot. No service, cache, queue, or background job is introduced.
- **Developer experience:** A normalized context centralizes null and fallback semantics while scoring components remain explicit about neutral data. Workflow types must preserve available snapshot metadata rather than flattening it prematurely.
- **Deployment implications:** Existing application and database boundaries remain sufficient. Ranking Snapshot V2 already stores the required facts.
- **Iteration speed:** Explicit components can be implemented and tuned independently, while the decision-timing cap provides a stable integration guardrail.

---

## Recommended Implementation Order

This is planning guidance, not an approved task list:

1. Add the Phase 5.5 recommendation-context type, normalization boundary, and focused fallback tests.
2. Preserve snapshot metadata through persisted draft and transient/replay workflows.
3. Add the pure overall-tier component and tests.
4. Add the pure ADP availability component and tests.
5. Integrate both components, the decision-timing cap, score adjustments, and reasons.
6. Add between-turn preview behavior and missing-data workflow coverage.
7. Version scenario portability for Phase 5.5 context and validate deterministic replay.
8. Run focused automated and manual recommendation scenarios before tuning constants.

---

## Resolved Product Decisions

- Recommendations recalculate after every recorded pick and show previews between user turns. If this later becomes computationally expensive, on-turn-only calculation may be reconsidered from measured performance evidence.
- ADP is optional per player and per ranking set. Missing ADP always contributes zero and never blocks import, draft creation, or recommendations.
- A future user-readiness phase may provide refreshed default ADP data. Provider choice, refresh cadence, freshness display, and failure behavior remain deferred; captured drafts must still snapshot the exact ADP values used.
- Wholly absent overall-tier data defaults the complete context to one neutral tier. Supplied tier boundaries must be complete and valid; partial or malformed boundaries are not guessed.
- Historical snapshots use the same fallback rules rather than a separate legacy recommendation model.

No active product question blocks task planning for this design.
