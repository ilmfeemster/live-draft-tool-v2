# Phase 6 Domain Knowledge Dive — Strategy & Insight Engine

## Purpose of This Note

This note is domain source material for designing Phase 6. It is not a task list and not an implementation plan. Its purpose is to equip the design agent with fantasy-football drafting logic so it can design an Insight Engine that explains existing recommendation outputs without adding new scoring signals.

Phase 6 should make the recommendation engine feel more strategic by explaining the current decision: why the recommended players matter, what tradeoffs exist, what the user's roster shape implies, and what the next-pick pocket suggests. It should not change player scores, simulate opponents, forecast exact player availability, ingest projections, or invent strategy claims not supported by deterministic inputs.

---

## 1. Core Fantasy Draft Decision Model

A fantasy draft pick is an opportunity-cost decision under positional constraints. The useful question is not only “Who is the best player?” but:

> Who is the best player to draft now, given my roster, the available board, the cost of waiting, and the likely shape of my next pick pocket?

For this app, the supported decision inputs already map well to five draft concepts:

1. **Player quality** — anchored by overall rank and overall/source tier.
2. **Roster utility** — whether the player fills a starter slot, flex slot, useful bench depth, or an already-saturated position.
3. **Timing pressure** — whether similar options, tier alternatives, or current-pocket profiles are likely to be thin by the next user pick.
4. **Market/value opportunity** — whether a player is available later than their rank/value would imply, while remembering that ADP is timing/market context rather than quality.
5. **Draft room pressure** — whether a recent positional run creates meaningful board pressure, but only when supported by roster relevance and remaining supply.

The Insight Engine should explain the interaction of those concepts. It should not re-score them.

---

## 2. Existing Scoring Surface the Insight Engine Should Interpret

The attached recommendation file already exposes a strong interpretation surface through named score components, evidence, score adjustments, and reasons. The design should consume these rather than recomputing hidden strategy.

Relevant component concepts:

- `base_value`
  - Player-quality anchor from overall rank.
  - Should be described as “ranked highest,” “stronger overall player,” or “best player-quality case.”
  - Do not describe it as projected points unless projections become an explicit input later.

- `overall_tier`
  - Overall/source tier context.
  - Useful for “best available overall tier” or “last player in the best available overall tier.”
  - Must not be described as a positional tier if the tier source is overall/source tier.

- `roster_fit`
  - Converts league settings and current user roster into direct starter need, flex need, useful bench depth, limited need, saturation, and early DST/K timing.
  - This is the main roster-construction signal.

- `tier_cliff`
  - Same-position tier drop risk using the ranking entry tier field.
  - Should be interpreted carefully depending on how `ranking.tier` is semantically defined in the data model. If this is a position/rank-set tier, it can support position-tier language. If it is an overall/source tier, it must not.
  - Strongest useful language: “the available options at this position drop after this group.”

- `positional_scarcity`
  - Same-position supply check over a nearby rank window.
  - Useful when there are few or no nearby same-position alternatives and the position is roster-relevant.

- `positional_run`
  - Recent draft-room behavior.
  - Should be framed as context, not a command. A run matters only if roster fit and supply/timing also matter.

- `draft_pocket_timing`
  - Phase 5.5 pocket signal.
  - Supports near-term “wait or act now” insight.
  - Should speak about comparable profiles or current-pocket representation, not certainty that individual players will or will not be available.

- `value_opportunity`
  - Current pick versus overall rank/value gap.
  - Useful for “value at this pick” or “reach relative to rank.”
  - Do not let this override the distinction between user ranking quality and market timing.

- `urgency_cap` and `context_cap`
  - Important for trust. If urgency/context was capped, the Insight Engine should avoid exaggerating stacked signals. Multiple forms of urgency may all point the same direction, but the score deliberately bounds their impact.

---

## 3. What the Insight Engine Should Answer

At each user pick, insights should answer four practical draft questions:

1. **Why this player?**
   - The clearest explanation of the top recommendation.
   - Example: “Top-ranked available player who also fills an open RB starter slot.”

2. **Why now?**
   - Whether the pick has timing pressure from tier, scarcity, run, or next-pocket observations.
   - Example: “Comparable RB profiles are thin in the forecasted next pocket.”

3. **What is the tradeoff?**
   - The strongest contrast among the top options.
   - Example: “The WR is the cleaner overall value; the RB is the stronger roster/timing fit.”

4. **What can wait?**
   - Supported skip-safety or low-pressure context.
   - Example: “The next pocket still shows comparable WR profiles, so WR timing pressure is not being surfaced here.”

The app should avoid broad strategy lectures during the draft. The user needs the current decision compressed into a few grounded signals.

---

## 4. Recommended Insight Types

### A. Primary Decision Frame

A single headline-style label that names the shape of the pick.

Useful deterministic frames:

- **Clean best-player pick**
  - Top candidate leads on base/player quality and has no major roster caveat.
  - Language: “Best available player without a major roster drawback.”

- **Value-over-need pick**
  - Candidate has stronger base/rank/value, while another candidate has better roster fit.
  - Language: “This is a value pick more than a roster-need pick.”

- **Need-over-value pick**
  - Candidate is not the strongest base-value option but has materially stronger roster fit and/or timing pressure.
  - Language: “This is a roster/timing pick over pure rank.”

- **Pocket-pressure pick**
  - Draft pocket timing indicates low or medium skip safety for a roster-relevant candidate.
  - Language: “This is the position/profile most at risk of thinning before your next pick.”

- **Tier-boundary pick**
  - Candidate is last or near-last in a meaningful tier, with a supported tier drop.
  - Language: “This pick protects you from a tier drop at this position.”

- **Run-pressure pick**
  - Recent picks show a position run and the position remains roster-relevant.
  - Language: “The room is moving on this position, and your roster still has use for it.”

- **Caveated top pick**
  - Candidate is recommended but has a meaningful negative component.
  - Language: “Recommended on value, but the roster fit is weaker.”

### B. Candidate Summary

One or two concise statements for the top candidate.

Good structure:

- “Why he ranks first” + “main caveat, if any.”
- Should use only material positive/negative components.
- Should not repeat every component.

Example patterns:

- “Ranks highest overall and is in the best available overall tier.”
- “Fills an open WR starter slot and still has useful flex/bench utility.”
- “Comparable RB options are thin in the forecasted next pocket.”
- “The only caveat is roster saturation at WR.”

### C. Top-Options Tradeoff

This may be the highest-value Phase 6 feature. The user often already sees the ranked list; what they need is the difference between the top two or three options.

Useful comparison dimensions:

- **Player quality gap:** base score / overall rank / overall tier.
- **Roster fit gap:** direct starter, flex, useful bench, limited need, saturation.
- **Timing gap:** tier cliff, scarcity, run, pocket skip safety.
- **Value gap:** current pick versus overall rank.
- **Caveat gap:** negative roster or reach signal.

Example language:

- “Player A is the better overall value; Player B better solves your roster.”
- “Player A has the stronger rank case, but Player B carries more near-term timing pressure.”
- “The top two are close: both fit the roster, but only Player A protects against a tier/pocket drop.”
- “The QB is a single-slot value; the RB/WR helps the flex build.”

### D. Roster Construction Snapshot

This should summarize the user roster in terms of lineup utility, not generic team quality.

Useful statements:

- “Open starter slots remain at RB and WR.”
- “Flex slots are still unfilled, so RB/WR/TE depth has direct lineup utility.”
- “You have enough WRs for direct starter slots, but WR still matters for flex/bench depth.”
- “QB is still open, but it is a single-start slot and does not help flex.”
- “DST/K should remain deprioritized until late unless settings or draft phase say otherwise.”
- “This position is saturated, so the recommendation needs a strong value/timing reason.”

For the MVP 12-team, 1QB, PPR, two-flex format, RB/WR depth usually has more recurring lineup utility than QB/DST/K depth because RB/WR can fill multiple direct and flex slots. TE is technically flex eligible in the roster configuration, but in most practical 1TE builds, TE depth should be explained cautiously unless the player is a strong rank/tier/value case.

### E. Next-Pocket Planning Note

The pocket note should help answer “What can I probably skip?” without pretending to know exactly what opponents will do.

Supported language:

- “The forecasted next pocket still contains comparable WR profiles.”
- “Comparable RB profiles are thin in the forecasted next pocket.”
- “This overall tier is not represented in the forecasted next pocket.”
- “The current pocket has more useful RB profiles than the next pocket.”
- “No active next-pick forecast is available, so this insight should stay focused on the current board.”

Avoid:

- “This player will be gone.”
- “You can get Player X next round.”
- “Opponents are likely to take these exact players.”
- “There is a 70% chance he is available.”

---

## 5. Domain Guidance by Signal

### Overall Rank / Base Value

Overall rank should remain the quality anchor. A strong Insight Engine should protect the user from overreacting to runs, roster need, or scarcity by reminding them when a top option is simply the better player-quality case.

Good insight behavior:

- If the top recommendation also has the best base value, say so.
- If a lower-ranked player jumps above a higher-ranked player due to context, explain the context clearly.
- If base-value difference is small, describe the candidates as a close group rather than overstating certainty.

### Overall Tier

Overall tiers are most useful for “quality shelf” language. They should not become position pressure unless the source explicitly represents positional tiers.

Good insight behavior:

- “Best available overall tier” is valid.
- “Last player in the best available overall tier” is valid.
- “Last RB in the tier” is not valid when the source tier is overall/source tier.
- If tiers are defaulted neutral, suppress tier insight or show a neutral capability note.

### Roster Fit

Roster fit is not simply “do I have a starter?” In a two-flex format, flex openings are strategically important because extra RB/WR/TE players can become weekly starters.

Good insight behavior:

- Direct starter need is strong early, but it should not automatically override a much better player.
- Flex need should keep RB/WR/TE relevant after direct starters are filled.
- Bench depth is useful for RB/WR and sometimes TE, but less useful for QB/DST/K in 1QB redraft.
- Saturation should not block a pick, but it should create a caveat.

### Tier Cliff

Tier cliff is a timing signal: it says “this type of option may not be replaceable at the same quality level.” It should not be used as a generic bonus for any player in a thin position.

Good insight behavior:

- Strongest when candidate is in the best available tier at the position and same-tier alternatives are thin.
- Weaker when the user's roster has no need for the position.
- Suppressed when tiers are neutral/defaulted or not meaningful.

### Positional Scarcity

Scarcity is about same-position alternatives near the candidate in the ranking set. It is useful for explaining why two similarly-ranked players are not equally replaceable.

Good insight behavior:

- “No nearby RB options remain in the next N ranks” is useful.
- “RB is scarce overall” is too broad unless backed by the current board.
- Scarcity should be muted when roster fit is negative.

### Positional Runs

A run is a draft-room observation, not proof that the user should chase that position. Runs create actionable insight only when they combine with roster need, tier pressure, or scarcity.

Good insight behavior:

- “The recent run adds pressure to an already-thin position.”
- “A recent WR run is visible, but WR timing is not otherwise thin.”
- Avoid implying the run itself makes a bad value good.

### Draft Pocket Timing

Pocket timing is the most domain-specific Phase 6 feature. It should be explained as profile availability, not player prediction.

Good insight behavior:

- “Comparable options are thin in the forecasted next pocket.”
- “The profile disappears from the next pocket.”
- “The current pocket has better skip risk than the next pocket.”
- “High skip safety” should usually suppress urgency language rather than produce a verbose message.

### Value Opportunity

Value opportunity should explain price/rank relationship. It should not imply that ADP or current pick is player quality.

Good insight behavior:

- “Ranked #32 at pick 45” is concrete and useful.
- “Market value” should be used carefully if the signal is current pick versus user rank rather than ADP.
- If future ADP-specific insight is added, ADP should be described as expected draft cost and room behavior, not quality.

---

## 6. Position-Specific Domain Notes for 12-Team 1QB PPR with Two FLEX

These notes should guide wording and interpretation, not add new score signals.

### QB

- In 1QB redraft, QB is a single-start position.
- QB can be valuable when the player is clearly ahead by rank/tier/value, but a generic open QB starter slot should not be over-explained as urgent if comparable QBs remain.
- Useful wording: “single-slot value,” “fills QB but does not help flex,” “only worth pushing if the rank/tier gap is meaningful.”

### RB

- RB has direct starter slots and flex utility.
- RB scarcity often matters because usable workload can thin quickly.
- Insight should avoid generic RB panic. Use board-specific supply, tier, and pocket evidence.
- Useful wording: “RB helps both starter/flex construction,” “RB alternatives thin out in the next pocket,” “RB is the timing-sensitive position here.”

### WR

- WR has direct starter slots and flex utility, especially in PPR.
- WR depth is valuable, but if many similar WRs remain, WR can often be a skip-safe position.
- Useful wording: “WR is the stronger overall value,” “WR remains deep enough to wait,” “WR adds flexible weekly lineup depth.”

### TE

- TE is a single direct starter but may be flex eligible by settings.
- Elite TE/tier advantage can matter, but ordinary TE depth should not be treated the same as RB/WR flex depth unless the ranking/tier/value case supports it.
- Useful wording: “TE creates a starter-slot advantage,” “TE is viable here because the tier/rank case is strong,” “TE depth is less flexible than RB/WR depth in practice.”

### DST / K

- Usually late-draft only in this product scope.
- Existing scoring already penalizes early DST/K timing.
- Useful wording: “early for DST/K relative to roster timing,” “late-round roster fill.”

---

## 7. Recommended Insight Output Shape

A good Phase 6 output does not need long prose. It should be structured so the UI can show compact cards while preserving inspectability.

Suggested conceptual output:

```ts
type StrategicInsightBundle = {
  summary: CurrentDecisionSummary;
  primaryInsight: Insight | null;
  candidateInsights: CandidateInsight[];
  tradeoffInsights: TradeoffInsight[];
  rosterInsights: Insight[];
  boardInsights: Insight[];
  caveats: Insight[];
  suppressedSignals?: SuppressedSignal[];
};
```

Suggested insight fields:

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
  severity?: "info" | "positive" | "warning" | "neutral";
  title: string;
  body?: string;
  supportedBy: Array<{
    playerId?: string;
    componentId?: string;
    evidenceKeys?: string[];
    reasonId?: string;
    scoreAdjustmentId?: string;
  }>;
};
```

Why this shape works:

- It separates strategic text from scoring.
- It lets UI show compact insight cards.
- It makes every insight traceable to a component/evidence/reason.
- It supports deterministic testing.
- It avoids using raw prose as the data model.

---

## 8. Score-Aware Language Rules

The Insight Engine should be score-aware without exposing raw math as the primary user experience.

Recommended language levels:

- **Clear lean** — top candidate has a meaningful total-score lead and its leading signals agree.
- **Slight lean** — top candidates are close, but one has a supported edge.
- **Tradeoff / close call** — player-quality and roster/timing signals disagree.
- **Caveated recommendation** — top candidate is still first, but a negative component matters.
- **No material insight** — signal exists but is neutral, defaulted, capped, or below threshold.

Important: these labels should be derived from deterministic score gaps and component evidence. The exact thresholds can be design decisions, but the behavior should avoid overstating tiny score differences.

---

## 9. Preferred Wording Patterns

### Good wording

- “The recommendation favors player quality here.”
- “This is a roster/timing pick more than a pure-rank pick.”
- “RB is the position with the strongest current-pocket pressure.”
- “The WR option is safer to wait on because comparable profiles remain in the next pocket.”
- “This player is in the best available overall tier.”
- “This position is already saturated, so the pick needs a strong value reason.”
- “A recent run adds pressure, but the recommendation is still grounded in rank, fit, and remaining supply.”

### Wording to avoid

- “He will not be available next round.”
- “Your opponents will take the remaining RBs.”
- “This player is projected to score more.”
- “ADP proves he is better.”
- “Draft this position because a run is happening.”
- “This is the correct pick with certainty.”
- “The model thinks…” when the output is deterministic component interpretation.

---

## 10. High-Value Scenarios to Validate

These are domain scenarios the design should support. They are not implementation tasks, but they should inform test coverage.

1. **Clean top player**
   - Top candidate has best base score, positive roster fit, and no major caveat.
   - Insight should be short and confident.

2. **Value versus need**
   - WR is ranked much higher, RB fills a direct starter need.
   - Insight should explain the tradeoff rather than pretending the choice is one-dimensional.

3. **Need versus timing**
   - QB fills an open starter slot, but RB/WR pocket is much thinner.
   - Insight should note QB is single-slot while RB/WR affects flex construction.

4. **Pocket cliff**
   - Candidate's comparable profile is not represented in forecasted next pocket.
   - Insight should say comparable profile/tier is thin, not that the player is guaranteed gone.

5. **Skip-safe position**
   - Candidate is good, but comparable profiles remain in next pocket.
   - Insight should avoid urgency language for that position.

6. **Recent run with real pressure**
   - Five RBs drafted in recent window; RB roster fit positive; scarcity/pocket also thin.
   - Insight can say the run reinforces existing pressure.

7. **Recent run without real pressure**
   - WR run occurs, but user's WR is saturated or next pocket still has comparable WRs.
   - Insight should avoid recommending a chase.

8. **Default-neutral tiers**
   - Tier data is neutral/defaulted.
   - No tier insight should appear, or only a capability note saying tier context is unavailable.

9. **Inactive forecast / no remaining user pick**
   - No future pick is available.
   - Insight should stay current-board focused and suppress next-pocket claims.

10. **DST/K before late draft**
    - DST/K appears in available rankings before late-draft phase.
    - Insight should present early-timing caveat if surfaced.

11. **Context or urgency cap active**
    - Multiple urgency signals stack but are capped.
    - Insight should avoid presenting every urgency signal as separately decisive.

12. **Close-score cluster**
    - Top three candidates within a small score range.
    - Insight should frame the decision as a close tradeoff rather than a hard recommendation.

---

## 11. Agent Design Guidance

When turning this into a design document, the agent should preserve this separation:

- Recommendation Engine: decides score and order.
- Insight Engine: interprets score, components, evidence, reasons, caps, roster state, and forecast observations.
- Presentation Layer: displays compact, actionable insight output.

The Insight Engine should consume stable structured inputs, not reason text alone. Reasons are useful for display, but the design should prefer component ids and evidence keys as the source of truth.

The most valuable design outcome is not “more reasons.” It is a small set of higher-level strategic interpretations:

- Why the top player is recommended.
- Whether this is a value, need, timing, or tradeoff pick.
- Which top option is the player-quality play versus the roster/timing play.
- Which positions look safer to wait on before the next user pick.
- Which signals are intentionally suppressed because they are neutral, defaulted, or unsupported.

---

## 12. Final Domain Recommendation

Design Phase 6 around **decision framing** rather than explanation verbosity.

A good live-draft insight does not need to explain the whole scoring model. It needs to tell the user:

1. The main reason the top option is first.
2. The strongest tradeoff among the top options.
3. Whether the current pick has timing pressure before the next user pick.
4. Any major caveat that should prevent blind trust.

That is the strategic layer this phase should add.
