# Recommendation Engine Design

## Purpose

Phase 3 introduces the Recommendation Engine as the layer that turns draft state into deterministic, explainable player recommendations.

The goal of this document is to remove architectural ambiguity before implementation tasks are created. It defines recommendation goals, scoring shape, modifier boundaries, reason generation, validation scenarios, and tuning philosophy.

This is a design document, not an implementation task list.

---

## Context

The product is a Fantasy Draft Decision Engine. The draft simulator and persistence work exist to provide reliable draft state that recommendation logic can consume.

Phase 3 should improve recommendations beyond static rankings while preserving these existing directions:

- The Draft State Engine owns draft rules and current draft state.
- Persistence stores and hydrates draft state and ranking snapshots.
- The Recommendation Engine consumes draft state, league settings, roster state, and ranking data.
- Recommendation output should be deterministic, rule-based, inspectable, and testable.

Phase 3 should not introduce AI reasoning, simulations, opponent modeling, live draft-room integration, or Phase 6 insight strategy.

---

## Goals

The Recommendation Engine should support:

- Scoring available players from the current draft state.
- Ranking players with deterministic, bounded scoring.
- Balancing best-player-available value with roster need, positional scarcity, tier pressure, and value opportunities.
- Producing reasons directly from scoring inputs.
- Supporting dynamic league settings and roster configurations.
- Returning stable output for the same draft state and ranking snapshot.
- Remaining easy to tune through constants and scenario tests.
- Staying independent from persistence storage shape, UI rendering, and future draft sources.

Good MVP recommendation behavior means:

- Elite players remain obvious recommendations when their value gap is large.
- Context can reorder similarly ranked players when roster construction or tier pressure justifies it.
- The engine does not chase need so hard that it recommends poor values too early.
- The engine does not blindly recommend best player available when a team is clearly imbalanced.
- Single-starter and late-round positions are handled with draft-phase discipline.
- Every displayed explanation can be traced to a score component.

---

## Non-Goals

Phase 3 should not introduce:

- AI-generated recommendation text.
- Machine learning.
- Draft simulations.
- Opponent modeling.
- Strategy profiles.
- Auto drafting.
- Live provider sync.
- Platform-specific recommendation behavior.
- A generic plugin architecture.
- Persisted recommendation output.
- A full Phase 6 Insight Engine.

---

## Architecture Decisions

### Decision: Use A Pure Recommendation Engine

The Recommendation Engine should be a pure domain layer.

It should accept typed draft inputs and return recommendation output. It should not read from the database, mutate draft state, write persistence records, or depend on React.

Recommended input shape conceptually includes:

```ts
type RecommendationInput = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  userTeamId: string;
};
```

Recommended output shape conceptually includes:

```ts
type PlayerRecommendation = {
  playerId: string;
  totalScore: number;
  baseScore: number;
  contextScore: number;
  components: RecommendationScoreComponent[];
  reasons: RecommendationReason[];
};
```

Exact type names can be decided during implementation planning, but the boundary should remain domain-facing.

### Decision: Do Not Persist Recommendation Output

Recommendations are derived from draft state, ranking snapshot, and league settings.

Persisting recommendation output would create a second source of truth and make tuning harder. Loaded drafts should hydrate typed draft inputs, then recompute recommendations.

### Decision: Use Explicit Modifier Functions Before Abstractions

Each scoring category should be implemented as a small pure calculation with a bounded output and optional reason metadata.

The first implementation does not need a generic plugin registry. Explicit local modifier functions are enough. A formal modifier interface can be introduced later if the number of modifiers grows or tuning workflows require it.

### Decision: Preserve Dynamic League And Roster Settings

Roster need must be derived from league settings and roster configuration.

Do not hard-code 12 teams, 16 rounds, 1QB assumptions, fixed starter counts, fixed flex rules, or default bench size into recommendation logic. The current MVP defaults can be used as test data, but the engine should compute need from the current draft's settings.

---

## Recommendation Goals

The MVP engine should optimize for the best current pick according to:

1. Player value from the active ranking snapshot.
2. Current roster construction.
3. Remaining positional quality.
4. Current tier pressure.
5. Value relative to draft position.

The engine is not trying to predict all future picks. It is trying to make the current choice better by using the draft state that is already known.

### Good Behavior In Realistic Drafts

Early in a draft:

- High overall ranking value should dominate.
- Elite RB/WR players should remain strong recommendations even when roster need is not perfect.
- QB and TE should rise only when their ranking value is strong enough or league settings make them more important.
- DEF and K should be heavily de-emphasized.

Middle rounds:

- Open starter slots should matter more.
- Tier cliffs should meaningfully affect ordering among similarly ranked players.
- Positional runs should create urgency only when the user's roster still benefits from the position.
- Falling value should remain visible even if the position is not the biggest need.

Late rounds:

- Bench depth should favor positions with repeatable roster value, usually RB/WR/FLEX-eligible depth under MVP settings.
- Single-starter backup positions should be de-emphasized unless the format or roster configuration supports them.
- DEF and K should become reasonable recommendations when their starting slots remain empty.
- The engine should avoid recommending backup DEF/K before useful depth picks.

---

## Scoring Model

Use a bounded additive scoring model:

```txt
recommendation score =
base player value
+ bounded context modifiers
```

The base score should anchor recommendations. Context modifiers should move players within a plausible range, especially within nearby ranking bands or tiers.

### Base Player Value

Use `RankingEntry.overallRank` from the active ranking snapshot as the source of base player value.

Recommended initial formula:

```txt
baseValueScore = max(0, 100 - 6 * sqrt(overallRank - 1))
```

Reason:

- It keeps top-ranked players meaningfully separated.
- It compresses the long tail of draftable players.
- It is deterministic and easy to inspect.
- It avoids needing projections or normalized value-over-replacement data before Phase 5.

The coefficient `6` is a tuning value. The architectural decision is to use a rank-derived base score as the anchor.

### Modifier Categories

Each modifier returns a numeric delta and optional reason metadata.

| Modifier | Range | Direction | Purpose |
| --- | ---: | --- | --- |
| Roster fit and timing | -20 to +14 | Positive or negative | Rewards open roster needs and de-emphasizes saturated or poorly timed positions. |
| Positional scarcity and run pressure | 0 to +10 | Positive only | Rewards positions where available quality is thinning or recent picks show pressure. |
| Tier-drop risk | 0 to +12 | Positive only | Rewards players near a meaningful cliff within their position. |
| Value opportunity | -6 to +8 | Positive or negative | Rewards players who have fallen relative to current pick and lightly penalizes clear reaches. |

Recommended group guardrails:

- `positional scarcity + tier-drop risk` should be capped at `+16` to avoid double-counting the same urgency.
- Total positive context should be capped at `+30`.
- Total negative context should be capped at `-24`.
- The final score should use deterministic tie breakers: total score, base score, overall rank, position rank, player id.

Recommended combination:

```txt
urgencyScore = min(positionalScarcity + tierDropRisk, 16)
rawContextScore = rosterFit + urgencyScore + valueOpportunity
contextScore = clamp(rawContextScore, -24, 30)
totalScore = baseValueScore + contextScore
```

### Roster Fit And Timing

Roster fit is the primary team-context modifier.

Inputs:

- User roster from current draft state.
- League roster slots and eligible positions.
- User picks made and remaining picks.
- Draft phase.
- Candidate position.

Expected behavior:

- Empty required starter slots create positive need.
- FLEX-eligible positions should receive need credit when FLEX slots remain realistically open.
- Bench depth should matter after starters are mostly filled.
- Saturated positions should receive a negative modifier.
- Single-starter positions should receive less bench-depth credit by default.
- DEF and K should receive strong negative timing before late rounds, then become normal needs if their starter slots remain empty.

Roster fit should not hard-code MVP roster counts. It should compute need from configured slots.

Suggested starting values:

- Critical open starter need: `+12` to `+14`.
- Normal open starter need: `+6` to `+10`.
- Useful bench depth: `+2` to `+6`.
- Neutral fit: `0`.
- Starter filled with limited bench need: `-6` to `-10`.
- Heavily saturated position: `-12` to `-16`.
- Early DEF/K timing penalty: up to `-20`.

### Positional Scarcity And Run Pressure

Scarcity should measure remaining available quality, not predict opponent behavior.

Inputs:

- Available players by position.
- Candidate position.
- Ranking bands or top available players by position.
- Recent picks from the actual draft history.
- Distance to the user's next pick from the draft order.
- Roster need for the candidate position.

Expected behavior:

- A position gets scarcity credit when the remaining useful options are thin.
- A recent run increases pressure only if the position still matters to the user's roster.
- A positional run should not cause panic recommendations for a position the user has already solved.
- Scarcity should help break ties among similar values, not overpower elite player value.

Suggested starting values:

- Mild scarcity: `+2` to `+4`.
- Clear scarcity: `+5` to `+7`.
- Scarcity plus active run pressure: `+8` to `+10`.

Run pressure should be based on observed picks, such as the last user-pick interval or recent draft window. It should not simulate future opponent choices.

### Tier-Drop Risk

Tier-drop risk should reward players who are among the last useful options in a meaningful tier.

Inputs:

- Candidate ranking tier.
- Available players at the same position and tier.
- Next available tier at the same position.
- Distance to the user's next pick.
- Roster need for the candidate position.

Expected behavior:

- A player in the last few remaining options of a strong tier should rise.
- A tier cliff matters more when the position fills a real roster need.
- Tier-drop risk should not stack unchecked with scarcity.
- Tier-drop reasons should explain the specific tier pressure.

Suggested starting values:

- Mild tier pressure: `+3` to `+5`.
- Last few players in a useful tier: `+6` to `+9`.
- Major cliff at a needed position: `+10` to `+12`.

### Value Opportunity

Value opportunity should identify players whose ranking value is unusually favorable at the current pick.

Inputs:

- Current overall pick number.
- Candidate overall rank.
- Optional ADP-derived fields if they are available and already part of `RankingEntry`.

Expected behavior:

- A player who has fallen meaningfully past overall rank should receive a small positive bump.
- A player who would be a large reach should receive a small negative modifier unless other context supports the pick.
- Value opportunity should not duplicate base score. It should highlight draft-position value.

Suggested starting values:

- Small fall: `+2` to `+3`.
- Clear value: `+4` to `+6`.
- Major value: `+7` to `+8`.
- Clear reach with no contextual support: `-3` to `-6`.

---

## Recommendation Balance

### Best Player Available

Best player available is the baseline.

The base score should make elite player value obvious. Context should only overcome base value when the ranking gap is close enough that roster construction, scarcity, tier pressure, or value timing reasonably changes the pick.

### Team Needs

Team need should influence the engine but not fully control it.

The engine should distinguish:

- Required starter needs.
- FLEX needs.
- Bench depth.
- Saturated positions.
- Positions that are poor uses of early picks.

Need should be strongest in middle rounds when starter construction is actively being shaped. It should be weaker in early rounds when elite value matters most and more selective in late rounds when bench depth and DEF/K timing matter.

### Positional Scarcity

Scarcity should raise positions where useful remaining options are thinning.

Scarcity should be meaningful only when:

- The candidate position fits current or future roster needs.
- Available quality at the position is genuinely limited.
- The candidate is close enough in base value to the competing recommendations.

### Positional Runs

Positional runs should be treated as observed pressure, not prediction.

The engine can look at recent picks and detect that a position is being drafted heavily. It should use that information as part of scarcity pressure. It should not assume specific opponents will continue the run.

Expected run behavior:

- If the user needs the position and the tier is thinning, run pressure can move the position up.
- If the user does not need the position, run pressure should usually be ignored or minimal.
- If better values exist at other positions, the run should not force a bad pick.

### Tier Cliffs

Tier cliffs should be one of the strongest contextual signals because tiers represent meaningful drops in expected quality.

Expected tier behavior:

- Last-player-in-tier situations can move a candidate above similarly ranked alternatives.
- A tier cliff at a filled or low-value position should have less impact.
- Tier pressure should be visible in explanations because it is one of the most useful draft-room signals.

### Value Opportunities

Falling value should keep high-quality players visible even when they are not the largest roster need.

Expected value behavior:

- A strong value at RB/WR should often remain high even if the position is not the top need.
- A falling QB or TE can rise when the roster slot is open, but should not automatically beat strong RB/WR values.
- A falling DEF/K should still respect phase timing.

### Draft Phase Behavior

Draft phase should be derived from the user's roster progress and total configured roster spots, not hard-coded round numbers.

Recommended phase definitions:

- Early draft: first third of user picks.
- Middle draft: second third of user picks.
- Late draft: final third of user picks.

Early draft behavior:

- Base value dominates.
- Roster modifiers are modest except for avoiding bad timing.
- Elite players should remain obvious.
- DEF/K should be suppressed.

Middle draft behavior:

- Roster construction matters more.
- Starter slots, tier cliffs, and scarcity can reorder similarly ranked players.
- Positional runs become useful context when tied to need.

Late draft behavior:

- Bench depth, remaining starter gaps, and DEF/K timing matter most.
- The engine should fill unfilled DEF/K slots near the end.
- The engine should avoid unnecessary backup DEF/K.
- The engine should still prefer meaningful bench value over low-impact roster fillers when starting slots are complete.

### Elite Player Guardrail

Elite players should remain obvious recommendations through the base score curve and context caps.

Recommended behavior:

- A top-tier available player should stay near the top unless the roster position is saturated or phase timing is truly poor.
- Context can move a close peer above an elite player, but should not let a much lower-ranked player jump only because of one modifier.
- If an elite player is pushed down, the reason components should make the penalty inspectable.

---

## Explanation Model

Explanations should be generated from score components, not from a separate reasoning system.

Each scoring component should be able to provide:

- Component id.
- Numeric delta.
- Direction: positive, negative, or neutral.
- Reason text or reason data.
- Priority.
- Evidence values used by the component.

Example component categories:

- `base_value`
- `roster_need`
- `roster_saturation`
- `positional_scarcity`
- `positional_run`
- `tier_cliff`
- `value_opportunity`
- `def_k_timing`

### Which Inputs Generate Explanations

Explanations should come from:

- High base value.
- Value opportunity.
- Open starter or FLEX need.
- Bench depth need.
- Saturated position penalty when relevant.
- Positional scarcity.
- Recent positional run pressure.
- Tier-drop risk.
- DEF/K late-round timing.

Explanations should not come from:

- Generic strategy claims.
- AI-written advice.
- Predictions about specific opponents.
- UI-only labels.
- Data that did not affect score.

### Number Of Reasons

Each recommendation should return up to three reasons.

The UI may choose to display fewer, but the engine should not generate a long list. More than three reasons makes the recommendation feel less inspectable during a live draft.

### Reason Selection Priority

Recommended priority:

1. Include the strongest positive context reason when one exists.
2. Include tier-cliff or scarcity pressure when it materially affected score.
3. Include high base value or value opportunity when the player is a strong ranking value.
4. Include one negative caveat only when the player remains recommended despite a meaningful penalty.

Thresholds:

- Positive component reasons should usually require a delta of at least `+3`.
- Negative caveats should usually require a delta of `-6` or lower.
- Base value reasons should be used when the player is among the top few available values or when no other strong reason exists.

### Explanation Guardrails

Explanations must remain directly tied to scoring inputs.

Good:

- "Fills an open WR starter slot."
- "One of the last RBs left in this tier."
- "Strong value relative to the current pick."
- "Recent TE run and few comparable options remain."

Avoid:

- "This player has league-winning upside" unless upside is an actual scoring input.
- "Your opponents will take this position soon" because Phase 3 does not model opponents.
- "This is the optimal strategy" because Phase 3 is not the Insight Engine.

---

## Scenario Validation

Recommendation behavior should be validated with small deterministic scenario fixtures.

Each scenario should define:

- League settings.
- Roster configuration.
- Draft state.
- User roster.
- Available rankings.
- Expected recommendation ordering or relative ordering.
- Expected reasons for key recommendations.

Scenario tests should assert the top recommendation set and important relative orderings rather than every player in a full ranking list.

### Required Scenarios

#### Heavy RB Start

Setup:

- User has drafted multiple RBs early.
- WR starter slots remain open.
- Comparable WR and RB values are available.

Expected behavior:

- WR recommendations rise because of starter need.
- Ordinary RB recommendations receive saturation pressure.
- An elite RB value can still remain high if the base value gap is large.
- Reasons mention WR need or RB saturation when those modifiers affect score.

#### Heavy WR Start

Setup:

- User has drafted multiple WRs early.
- RB starter slots remain open.
- Comparable RB and WR values are available.

Expected behavior:

- RB recommendations rise because of starter need.
- Ordinary WR recommendations receive saturation pressure.
- Elite WR value remains visible when appropriate.
- FLEX settings influence how strong the WR saturation penalty becomes.

#### Ignoring QB Early

Setup:

- User has no QB after early or middle picks.
- RB/WR values are still available.
- A QB in a strong tier is available.

Expected behavior:

- The engine does not force QB too early if RB/WR values are much stronger.
- In middle rounds, a strong QB value can rise when the starter slot remains empty.
- After the user drafts a QB, ordinary backup QBs drop unless roster configuration supports another QB.

#### Positional Run

Setup:

- Several recent picks at one position have occurred.
- The user's roster still benefits from that position.
- The remaining tier at that position is thinning.

Expected behavior:

- The affected position receives scarcity or run pressure.
- The run does not dominate if the user has already solved the position.
- Reasons mention observed pressure only when it affected score.

#### Tier Cliff

Setup:

- One or two players remain in a useful tier at a needed position.
- Similar base values exist at other positions with deeper remaining tiers.

Expected behavior:

- The last useful tier player rises above similar alternatives.
- The recommendation reason mentions tier pressure.
- The tier modifier does not let a much lower base value jump an elite player.

#### Starter Positions Filled

Setup:

- User has filled required starter slots for a position.
- Bench and FLEX capacity may still exist.

Expected behavior:

- That position receives reduced need credit.
- If FLEX or bench depth remains useful, the position is not fully suppressed.
- Backup QB, DEF, and K are de-emphasized unless league settings make them relevant.

#### Bench Depth Decisions

Setup:

- Most starters are filled.
- User is choosing bench players.
- RB/WR/FLEX-eligible players and single-starter backups are available.

Expected behavior:

- Bench recommendations favor useful depth and value.
- The engine avoids low-impact backup DEF/K.
- QB/TE bench recommendations require strong value or roster configuration support.

#### Late-Round DEF/K Strategy

Setup:

- Draft is in the late phase.
- DEF and K starter slots are empty or partially empty.
- Similar low-value bench players are available.

Expected behavior:

- DEF/K become reasonable recommendations near the end when starting slots remain empty.
- The engine prefers filling missing DEF/K slots over unnecessary extra depth at the very end.
- Once DEF/K slots are filled, backup DEF/K recommendations drop sharply.

#### Dynamic Roster Configuration

Setup:

- Use at least one non-default roster configuration, such as extra WR starters, extra FLEX slots, shorter bench, or a QB-eligible FLEX slot.

Expected behavior:

- Roster need changes according to configured slots.
- Recommendation logic does not assume MVP default starter counts.
- FLEX eligibility changes positional need in observable ways.

#### Loaded Persisted Draft

Setup:

- Same draft state is evaluated before and after persistence hydration.

Expected behavior:

- Recommendation ordering and reasons are identical.
- Recommendation results include only available players.
- No database storage shape appears in recommendation inputs or outputs.

---

## Tuning Philosophy

The engine should be tuned through small numeric constants and scenario validation, not architectural rewrites.

### Configurable Values

These values should live in a recommendation tuning configuration inside the engine:

- Base score curve coefficient.
- Modifier min and max values.
- Total context cap.
- Scarcity plus tier combined cap.
- Draft phase thresholds.
- Recent-pick run window size.
- Tier thinness thresholds.
- Value opportunity thresholds.
- DEF/K timing penalty thresholds.
- Reason inclusion thresholds.

Configuration here means engine-level tuning constants, not user-facing settings during Phase 3.

### Architectural Decisions That Should Remain Stable

These are design decisions, not tuning knobs:

- Recommendations are deterministic.
- Base ranking value anchors scoring.
- Context modifiers are bounded.
- Recommendation output is derived, not persisted.
- Reasons come directly from scoring components.
- The engine consumes typed draft state and league settings.
- The engine stays independent from persistence, UI rendering, and draft sources.
- Phase 3 avoids AI reasoning, simulations, and opponent modeling.

### Adding New Modifiers

New modifiers should follow these rules:

- Consume only recommendation input and derived recommendation context.
- Return a bounded score component.
- Include reason metadata when the modifier can affect visible output.
- Avoid mutating draft state.
- Avoid reading persistence or UI state.
- Include scenario coverage before the modifier is trusted.
- Fit within the total context cap unless there is a deliberate architectural reason to change the cap.

Do not add a generic modifier framework until explicit modifier functions become difficult to manage.

### Future Tuning Workflow

Future tuning should follow this loop:

1. Add or update a scenario that describes the desired behavior.
2. Adjust a tuning constant or small modifier rule.
3. Verify existing scenarios still pass.
4. Update expected behavior only when the product decision intentionally changes.

This keeps recommendation quality grounded in observable draft situations instead of subjective one-off tweaks.

---

## Deferred Alternatives

### Projection-Based Value Or VORP

Projection-based value and value-over-replacement can produce stronger recommendations once projections and rankings become first-class data.

Deferred because Phase 3 should work from the current ranking snapshot model. Phase 5 is a better time to expand ranking and projection data.

### Opponent Modeling

Opponent modeling could help estimate whether a player will survive to the next pick.

Deferred because it adds assumptions, complexity, and likely false confidence before live or historical draft data exists. Phase 3 should use observed draft state only.

### Draft Simulations

Simulations could evaluate expected value across many future draft paths.

Deferred because they require opponent behavior assumptions and additional validation infrastructure. They also reduce explainability for the MVP.

### AI-Generated Explanations

AI-generated explanations could make advice sound richer.

Deferred because Phase 3 explanations must be directly tied to scoring inputs. Generated text risks inventing unsupported reasons.

### Generic Modifier Registry

A plugin-like modifier registry could make future extension cleaner.

Deferred because the MVP has only a small number of modifiers. Explicit functions are easier to inspect and refactor.

---

## Architecture And Decision Updates To Make Later

Before implementation task planning begins, this design should be reflected in:

- `docs/architecture.md`: Expand the Recommendation Engine section with the bounded additive scoring model, pure engine boundary, and explanation rule.
- `docs/decisions.md`: Record the Phase 3 scoring model decision, reason-generation decision, and deferred alternatives.

No implementation tasks should be created until those project-level architecture and decision documents are aligned.
