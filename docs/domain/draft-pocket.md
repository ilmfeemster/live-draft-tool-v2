# Draft Pocket Forecasting Domain Brief

## Purpose of This Brief

This document is **domain guidance** for designing Draft Pocket Forecasting in Phase 5.5.

It is not intended to be pasted directly into the architecture/design document. Instead, use it to inform the design document's architecture, types, scoring contracts, and implementation decisions.

The main fantasy-football product question is:

> When I am on the clock, which player should I take now because the future decision space changes meaningfully if I wait?

The answer should come from comparing the **current draft pocket** to the **forecasted next draft pocket**, not from blindly chasing ADP.

---

## Core Fantasy Drafting Principle

Fantasy drafters do not need the app to say:

> This player will probably be gone.

That is too shallow.

They need the app to say:

> If you skip this player, will comparable options still be available when you pick again?

That distinction matters because many players can be individually unlikely to return while their **profile** remains easy to replace.

Example:

```text
Current pocket:
- WR
- WR
- WR
- RB
- TE
- QB

Forecasted next pocket:
- WR
- WR
- WR
- WR
- QB
- TE
```

In this case, the current WRs may be individually unlikely to survive, but WR as a profile remains deep. The app should not force a WR pick just because one specific WR is likely to be gone.

If the current RB profile disappears from the next pocket, the RB may deserve a timing boost even if the WRs have stronger raw ADP urgency.

---

## Recommended Product Interpretation

Use this mental model:

```text
Overall rank = player quality
Overall/source tier = quality grouping
ADP = market timing
Draft pocket = realistic future decision space
Recommendation = decision now
```

ADP should help answer:

> What will the board probably look like when I pick again?

ADP should not answer:

> How good is this player?

This keeps the app from becoming an ADP-chasing tool.

---

## What a Draft Pocket Should Mean

A draft pocket should represent the realistic set of players the user is choosing from at a pick.

It should not mean:

* every player who may be drafted before the user picks again
* every player available on the board
* every player with ADP near the current pick
* a probability-based availability group
* a simulated opponent outcome

A useful MVP draft pocket should be:

> The top tier-aware group of available players by the user's overall rankings that represents the meaningful decision space at the pick.

The pocket needs to be large enough to show whether a position remains deep, but small enough to reflect the actual choice set a drafter considers on the clock.

Recommended MVP size:

```text
minimum: 6 players
maximum: 12 players
```

Rationale:

* 6 players is enough to show whether a position or tier remains meaningfully available.
* 12 players equals one full round in the MVP 12-team league.
* The range avoids making the pocket either too narrow or too noisy.

---

## Current Pocket vs Forecasted Pocket

The system should compare two pockets:

```text
Current pocket:
The user's realistic choice set right now.

Forecasted next pocket:
The user's realistic choice set after expected intervening picks are removed by ADP order.
```

The forecasted pocket should be created by:

1. Starting with the current remaining player pool.
2. Sorting by ADP, then overall rank, then stable ID.
3. Removing the number of expected picks before the user's next selection.
4. Rebuilding the top available tier-aware pocket from the remaining board.

The ADP-ordered removal process creates the future board.

The pocket itself should still be described by the user's ranks and tiers.

---

## Important Domain Distinction

Do not confuse these two concepts:

```text
ADP removal window:
The players expected to leave the board before the user's next pick.

Draft pocket:
The best remaining player group the user is expected to choose from at the next pick.
```

The app should not score a candidate merely because they are in the ADP removal window.

The app should score a candidate when their player profile is not well represented in the forecasted pocket.

---

## Replacement Quality

Replacement quality is one of the most important domain concepts.

For each candidate, ask:

> If I skip this player, what comparable options are forecasted to remain?

Comparable options should generally mean:

* same position
* similar overall/source tier
* reasonably close overall rank

Do not require the exact same player to survive.

A player can be individually unlikely to return while still being easy to replace.

Example:

```text
Candidate:
WR ranked 31, Tier 4

Forecasted pocket:
WR ranked 34, Tier 4
WR ranked 38, Tier 4
WR ranked 44, Tier 5
RB ranked 47, Tier 5
TE ranked 49, Tier 5
QB ranked 50, Tier 5
```

This WR should probably have good replacement quality because similar WR options remain.

Contrast:

```text
Candidate:
RB ranked 32, Tier 4

Forecasted pocket:
WR ranked 34, Tier 4
WR ranked 38, Tier 4
WR ranked 44, Tier 5
TE ranked 49, Tier 5
QB ranked 50, Tier 5
WR ranked 52, Tier 5
```

This RB may have poor replacement quality because the RB profile disappeared.

---

## Skip Safety

Skip safety should answer:

> How safe is it to pass on this player profile?

This is different from urgency.

Bad MVP logic:

```text
Player ADP is before my next pick, so draft him now.
```

Better MVP logic:

```text
This player's position/tier profile is not represented in the next forecasted pocket, so skipping him has real opportunity cost.
```

Recommended interpretation:

```text
High skip safety:
Comparable options are forecasted to remain.

Medium skip safety:
Some near replacement exists, or the candidate may still be in the next pocket.

Low skip safety:
The candidate's profile is not represented in the forecasted next pocket.
```

The app should generally reduce timing pressure for high-skip-safety players and increase timing pressure for low-skip-safety players.

---

## Position and Tier Disappearance

The most useful pocket transition is not:

> This exact player disappears.

The more useful signal is:

> This position/tier profile disappears.

Example:

```text
Current pocket:
Tier 4 RB
Tier 4 RB
Tier 4 WR
Tier 4 WR
Tier 4 WR
Tier 5 TE

Forecasted pocket:
Tier 4 WR
Tier 4 WR
Tier 5 WR
Tier 5 QB
Tier 5 TE
Tier 5 WR
```

The app should notice:

```text
Tier 4 RB disappeared.
Tier 4 WR survived.
```

That is actionable.

It tells the drafter that RB timing may matter more than WR timing even if individual WRs have lower ADPs.

---

## Pocket Diversity

Pocket diversity describes the shape of the next choice set.

Useful labels:

```text
WR-heavy
RB-heavy
onesie-heavy
balanced
thin
mixed
```

These labels are helpful for display and explanation, but should be used carefully.

A label like `WR-heavy` should not directly mean:

```text
Draft WR.
```

or:

```text
Do not draft WR.
```

It should mean:

```text
The next pocket contains many WRs.
```

The recommendation layer can then decide whether that matters based on the candidate and roster context.

For MVP, diversity labels are best treated as descriptive unless converted into candidate-specific signals like replacement quality or skip safety.

---

## Onesie Positions

QB and TE require special caution.

In fantasy drafting, QB and TE are often “onesie” positions because most lineups start only one.

A QB or TE can be a strong pick when:

* the player is clearly in a better overall tier than alternatives,
* the next pocket loses that tier/profile,
* the user does not like the available RB/WR prices,
* the roster context supports taking a onesie position.

But the forecast layer should not independently decide:

```text
Take QB because QB is thin.
```

That requires roster and recommendation context.

The forecast can say:

```text
The forecasted pocket has limited comparable TE options.
```

The recommendation layer decides whether that matters enough to affect the pick.

---

## RB and WR Interpretation

RB and WR pockets are often the most important for this feature.

Useful domain behavior:

```text
If WR remains deep in the next pocket:
  Current WRs should often be safer to skip.

If RB disappears from the next pocket:
  Current RBs may deserve a timing boost.

If both RB and WR remain deep:
  Recommendation should lean more heavily on overall rank, tier, and roster context.

If both RB and WR become thin:
  Recommendation should prefer the stronger overall player unless roster context creates a clear need.
```

The feature is most valuable when it prevents bad timing decisions such as:

```text
Drafting a WR only because the exact WR is expected to be gone,
even though several similar WRs will remain.
```

---

## Missing ADP Domain Rule

The project decision should be preserved:

```text
If some ADP exists:
  missing ADP = max valid ADP + 1

If no ADP exists:
  forecast is neutral
```

Domain rationale:

Players missing ADP are usually players the market does not expect to be drafted. Assigning them after the highest ADP keeps the forecast deterministic without treating missing ADP as a quality penalty.

Important:

```text
Missing ADP affects forecast order only.
It should not reduce player quality.
It should not create a negative recommendation reason.
```

---

## No Remaining User Pick

If the user has no remaining pick, waiting has no decision value.

Recommended behavior:

```text
No next user pick:
  no forecast timing score
  no skip safety
  no replacement quality
  no next-pocket reason
```

If the draft is complete, there should be no recommendations.

If the user is making their final pick, recommendations can still be based on rank, tier, roster, and current context, but not on future-pocket logic.

---

## Shared Forecast vs Candidate-Specific Signals

Use one shared board forecast.

Then evaluate each candidate against that shared forecast.

Recommended mental model:

```text
Shared forecast:
  What does the next board look like?

Candidate replacement quality:
  What comparable options to this candidate remain?

Candidate skip safety:
  Is this candidate's profile safe to pass?

Candidate timing pressure:
  Does this candidate's profile disappear or become thin?
```

Avoid creating a separate forecast for every candidate in MVP. That would imply counterfactual simulation, which is outside the current feature's intent.

---

## What Should Affect MVP Scoring

The most appropriate scoring signals are candidate-specific and opportunity-cost based.

Good scoring candidates:

```text
replacement quality
skip safety
position/tier disappearance
candidate's profile remaining deep
highest tier drop only when candidate belongs to the disappearing tier
```

These help answer:

> Does waiting materially change the options available for this kind of player?

Avoid direct scoring from:

```text
raw ADP gap
exact player projected gone
exact player projected available
WR-heavy label by itself
RB-heavy label by itself
onesie-heavy label by itself
full pocket composition by itself
missing ADP fallback status
```

Those are either descriptive, too speculative, or likely to create ADP-chasing behavior.

---

## Recommended Modifier Philosophy

Forecast modifiers should be strong enough to break close calls.

They should not be strong enough to override a clearly better player.

Good product behavior:

```text
Two similarly ranked players:
  forecast can move the better-timed profile ahead.

Clearly superior player:
  forecast alone should not bury the better player.
```

In practical terms:

```text
Forecast should influence close decisions.
Forecast should not become the recommendation engine.
```

This is important because the project is still anchored to rankings and overall/source tiers.

---

## Recommendation Reasons

Forecast-backed reasons should be shown only when the forecast materially affected the recommendation.

Good reason style:

```text
Comparable RB options are thin in the forecasted next pocket.
```

```text
WR remains deep in the forecasted next pocket, making this player safer to skip.
```

```text
This overall tier is likely to be mostly gone by your next pick.
```

```text
Similar TE options are not represented in the forecasted next pocket.
```

Avoid:

```text
ADP says he will be gone.
```

```text
You have to take him now.
```

```text
The market likes him.
```

```text
He is a value because his ADP is earlier.
```

Those statements overstate certainty or turn ADP into quality.

---

## Forecast Layer Boundary

The forecast layer should be roster-agnostic.

It can know:

```text
available players
overall rank
overall/source tier
ADP
current pick
next user pick
picks until next user pick
stable player IDs
```

It should not know:

```text
user roster
lineup needs
bench needs
team construction
positional preferences
strategy
```

The forecast can describe:

```text
The next pocket is WR-heavy.
```

The recommendation layer decides:

```text
Whether that matters for this user, this roster, and this pick.
```

This keeps the architecture clean.

---

## Design Implications for the Agent

When writing the architecture/design document, preserve these product decisions:

```text
1. Define draft pocket as the user's tier-aware decision space, not the ADP removal window.

2. Use ADP only to remove expected intervening picks.

3. Describe the forecasted board using overall rank, overall/source tier, and position.

4. Use one shared forecast, then derive candidate-specific replacement quality and skip safety.

5. Do not reward candidates merely because ADP says they will be gone.

6. Reward candidates when their comparable profile is thin or absent in the forecasted pocket.

7. Treat pocket diversity labels as descriptive unless converted into candidate-specific scoring.

8. Keep the forecast layer roster-agnostic.

9. Keep forecast output derived and unpersisted.

10. Keep all forecast scoring bounded so it affects close decisions without overwhelming clear rank/tier advantages.
```

---

## Short Version for Design Decisions

If the design document needs a concise product contract, use this:

```text
Draft Pocket Forecasting should compare the user's current decision space to their forecasted next decision space.

ADP determines which players are removed before the user's next pick, but overall rank and overall/source tier determine the quality and shape of the pocket.

The app should not recommend a player simply because that player is unlikely to return.

The app should recommend around meaningful loss of comparable options.

Replacement quality and skip safety are candidate-specific interpretations of one shared forecasted pocket.

The forecast layer is roster-agnostic, deterministic, derived, and unpersisted.

Forecast signals should influence close decisions, not override clearly superior player-quality signals.
```
