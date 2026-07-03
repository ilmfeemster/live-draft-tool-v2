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

Missing ADP should be handled by assigning:

```text
Highest ADP in dataset + 1
```

This reflects the assumption that players without ADP are generally expected to go undrafted while preserving deterministic behavior.

---

## Step 4

Sort remaining players by:

1. ADP
2. Overall ranking
3. Stable identifier (to guarantee deterministic ordering)

---

## Step 5

Remove the number of expected intervening selections.

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

These descriptors become useful inputs for recommendation logic without requiring simulations.

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