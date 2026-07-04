# Phase 5.5 Corrective Design: Profile-Level Draft-Pocket Transitions

## Status

Draft for approval and task planning.

## Purpose

This document patches the Phase 5.5 Draft Pocket Forecasting design after exit validation exposed a same-profile recommendation inversion.

The deterministic board forecast remains valid. The defect is in how the engine interprets that shared forecast for individual candidates. Candidate-relative replacement counts can make a lower-ranked player count as a replacement for a higher-ranked player, then give the lower-ranked player a larger timing bonus because the higher-ranked player is forecasted to leave the board first.

The reported default-ranking case is:

- Justin Jefferson: overall rank 9, ADP 10, WR, source tier 2.
- Drake London: overall rank 11, ADP 18, WR, source tier 2.
- The shared forecast can retain London and another WR while removing Jefferson.
- London then helps make Jefferson safe to skip, while London receives a larger candidate-specific timing bonus.
- The timing bonus can overcome their base-value difference and recommend London above Jefferson.

That result violates the intended separation between player quality and market timing. Draft-pocket timing should describe the opportunity cost of passing on a player profile, not make the weaker member of the same profile more valuable than its stronger member.

## Supersession Boundary

This design supersedes only the following parts of `docs/patches/phase5.5-patch.md`:

- candidate-specific comparable-replacement derivation;
- candidate-specific replacement-quality and skip-safety derivation;
- allocation of the `draft_pocket_timing` modifier to current candidates;
- candidate timing evidence used by forecast-backed reasons.

This design preserves:

- one shared deterministic board forecast;
- target-pick and removal-count rules;
- ADP normalization and removal ordering;
- current and forecasted pocket construction;
- overall/source-tier semantics;
- missing-ADP and no-next-pick neutral behavior;
- the bounded additive Recommendation Engine;
- urgency and total-context caps;
- roster-agnostic forecast construction;
- derived, unpersisted forecast and recommendation output;
- Scenario V1/V2, persistence, replay, and workbench contracts.

## Design Principles

1. Overall rank and overall/source tier remain player-quality inputs.
2. ADP remains a board-forecast input and never becomes player quality.
3. The engine forecasts the board once per recommendation calculation.
4. Timing is derived from changes to shared position-and-tier profiles, not from exact-player availability.
5. Every current candidate in the same profile reads the same profile transition.
6. Modifier allocation within a profile is monotonic: a lower-ranked candidate never receives a larger positive forecast modifier than a higher-ranked available candidate in that profile.
7. Profile observations remain roster-agnostic. Roster fit continues to enter only in the Recommendation Decision layer.
8. Score-backed reasons describe a material profile transition and never claim that a specific player will certainly be drafted.

## Profile Model

### Profile Identity

A draft-pocket profile is identified by:

```text
position + overall tier origin + overall/source tier value
```

Conceptually:

```ts
type DraftPocketProfile = {
  position: Position;
  overallTierOrigin: "source" | "defaulted-neutral";
  overallTier: number;
};
```

The tier remains an overall/source grouping. Combining it with position for pocket comparison does not convert it into a position tier and must not activate recommendation-tier pressure.

Profile keys must be compared structurally or through one deterministic canonical key. Display labels are not domain identity.

### Source-Tier Profiles

When complete, validated source tiers exist, candidates share a profile only when position, tier origin, and tier value all match.

Examples:

```text
WR + source tier 2
RB + source tier 2
WR + source tier 3
```

These are three different profiles.

Numeric tier gaps do not measure cliff magnitude. Tier order determines better, equal, or worse quality grouping; the size of a numeric gap does not increase a transition score.

### Defaulted-Neutral Profiles

When the normalized ranking context has no supplied overall tiers, every player retains the documented defaulted-neutral tier. Profile identity still includes position, origin, and the materialized neutral value.

For replacement analysis, a defaulted-neutral profile behaves as a position-only profile within the bounded rank window because the neutral tier contains no meaningful quality boundary.

Defaulted-neutral profiles may support position-depth timing, but they must never produce:

- a meaningful overall-tier disappearance claim;
- a source-tier cliff claim;
- a highest-meaningful-tier transition;
- recommendation-tier pressure.

## Shared Profile Transition Analysis

### Inputs

Profile transition analysis consumes only:

- the current pocket;
- the forecasted pocket;
- normalized recommendation ranking facts for those players;
- overall rank;
- validated overall-tier origin and value;
- stable player ID.

It does not consume roster state, scoring configuration, React state, persistence data, raw imports, or mutable ranking sets.

### Construction

For each distinct profile represented in the current pocket:

1. Resolve and sort its current candidates by overall rank, then stable player ID.
2. Select the first candidate as the profile anchor and record its overall rank.
3. Inspect forecasted-pocket players at the same position within an absolute overall-rank distance of 12 from the profile anchor.
4. Classify those forecasted players as exact-profile, comparable-profile, near-profile, or unrelated options.
5. Produce one immutable transition value for the current profile.

The rank window remains 12 to preserve the existing bounded notion of a reasonably close option. Using the profile anchor makes the window shared by every member of the profile and prevents candidate-relative replacement counts.

Stable player ID resolves an otherwise tied overall rank. It provides determinism only and never changes transition strength.

### Forecasted Option Classification

For a meaningful source-tier profile:

- **Exact-profile option:** same position, source origin, and source tier.
- **Comparable-profile option:** same position and same or better meaningful source tier, including exact-profile options.
- **Near-profile option:** same position and a worse meaningful source tier.
- **Unrelated option:** different position, different tier origin, or outside the shared 12-rank window.

For a defaulted-neutral profile:

- every same-position defaulted-neutral player inside the shared rank window is comparable;
- no player is classified as near solely from the neutral tier value;
- players outside the position or rank window are unrelated.

The normalized context is expected to prevent partial or contradictory overall-tier origins. If a transition encounters incompatible tier origins that should have been rejected at normalization, it returns the existing structured failure behavior rather than guessing.

### Transition Output

Each current profile transition exposes at least:

```text
profile
anchor player ID and overall rank
ordered current candidate IDs
current profile count
forecasted exact-profile count
forecasted comparable count
forecasted near count
replacement quality
skip safety
exact profile disappeared
highest meaningful overall tier disappeared
```

Counts are objective evidence. They do not create separate additive modifiers.

## Replacement Quality and Skip Safety

Replacement quality is derived once per current profile:

```text
High:
  at least two comparable forecasted options remain

Medium:
  exactly one comparable forecasted option remains
  OR no comparable option remains and at least one near option remains

Low:
  no comparable or near option remains
```

Multiple near options without a comparable option remain medium. A lower overall/source tier can preserve some positional choice, but it does not preserve the current quality profile.

Skip safety is the profile-level decision interpretation of replacement quality:

```text
High replacement quality   -> high skip safety
Medium replacement quality -> medium skip safety
Low replacement quality    -> low skip safety
```

Exact-player membership in the forecasted pocket remains diagnostic evidence only. It does not alter replacement quality, skip safety, or scoring. This prevents individual removal order from re-entering scoring through a candidate-specific side door.

Every current candidate in one profile receives the same replacement-quality and skip-safety observation. Candidate signals are projections of the shared profile transition, not independently recalculated analyses.

## Profile Transition Observations

The engine may expose these non-additive observations:

- **Exact profile disappeared:** the current profile has no exact-profile representation in the forecasted pocket.
- **Profile thinned:** exact-profile representation remains but decreases.
- **Comparable profile remains:** one or more same-or-better options remain within the shared rank window.
- **Near profile remains:** only worse-tier same-position options remain within the shared rank window.
- **Highest meaningful tier disappeared:** the profile belongs to the current pocket's highest meaningful overall tier and that tier is absent from the forecasted pocket.

These observations explain the single profile timing component. They must not become overlapping scores.

Pocket diversity labels remain descriptive and non-scoring.

## Candidate Projection and Modifier Allocation

### Candidate Ordering Within a Profile

Current candidates in a profile are ordered by:

1. overall rank ascending;
2. stable player ID ascending.

The first candidate is the profile leader. This is a deterministic quality ordering, not an ADP ordering.

### Eligibility

A profile timing modifier is eligible only when:

- the forecast status is active;
- a later user pick exists;
- the profile is represented in the current pocket;
- the position is QB, RB, WR, or TE;
- replacement quality and skip safety are non-neutral.

Candidates outside the current pocket remain timing-neutral. DST and K remain timing-neutral. No ADP and no-next-pick forecasts remain timing-neutral.

### Bounded Allocation

Reuse the existing approved timing values without adding tuning dimensions:

| Profile skip safety | Profile leader | Other candidates in profile |
| --- | ---: | ---: |
| Low | `+6` | `+3` |
| Medium | `+3` | `0` |
| High | `0` | `0` |
| Neutral | `0` | `0` |

This allocation gives the highest-ranked current option the full profile modifier. Additional members may receive a reduced modifier only for a low-safety profile, where the complete profile opportunity is absent from the forecasted pocket.

The allocation guarantees:

- no lower-ranked candidate in a profile receives a larger forecast modifier than a higher-ranked candidate in that profile;
- the strongest current player-quality option captures the strongest timing benefit;
- a profile can influence a close decision without converting ADP into player quality;
- no new modifier magnitude or cap is introduced.

The resulting candidate `draft_pocket_timing` component continues to participate in the existing urgency cap and total-context cap.

### Same-Profile Quality Invariant

For two current-pocket candidates `A` and `B` in the same profile:

```text
if A is ordered before B by overall rank and stable ID,
then timingDelta(A) >= timingDelta(B)
```

The engine must enforce this through explicit profile allocation, not through a final-sort override, hidden adjustment, score mutation, or hard-coded player exception.

The invariant applies to the forecast modifier. Other approved scoring components retain their existing rules.

## Candidate Signal Contract

Candidate-facing evidence remains useful for score inspection and reasons, but it is derived by projecting the shared transition onto a current candidate.

Conceptually:

```text
CandidatePocketSignal
  candidate player ID
  profile identity
  profile anchor player ID
  ordinal within current profile
  allocation role: full | reduced | neutral
  profile current count
  forecasted exact-profile count
  forecasted comparable count
  forecasted near count
  profile replacement quality
  profile skip safety
  candidate in forecasted pocket (diagnostic only)
  exact profile disappeared
  highest meaningful tier disappeared
```

Fields named `replacementQuality` and `skipSafety` may remain on the concrete candidate signal for compatibility, but their values must come directly from the referenced profile transition and therefore be identical for all current candidates in that profile.

The old behavior of scanning the forecasted pocket separately with each candidate's rank and tier as the comparison center is superseded.

## Recommendation Reasons

A forecast-backed reason may appear only when the candidate's allocated `draft_pocket_timing` delta is material and non-zero after normal component construction.

Reasons must use shared profile-transition evidence. Preferred meanings remain:

- low skip safety: comparable options for this position/profile are absent from the forecasted next pocket;
- medium skip safety: only limited comparable or near options remain;
- exact profile disappearance: this position and overall-tier profile is not represented in the next pocket;
- highest meaningful tier disappearance: this meaningful overall tier is absent from the next pocket.

Rules:

- A zero allocation produces no positive draft-pocket reason even when the shared profile is low or medium safety.
- Reduced allocations may use the same profile-backed reason because the profile transition materially contributes to their score.
- Defaulted-neutral profiles use position-depth language and never claim a meaningful tier disappeared.
- Reasons must not mention raw ADP, exact removal order, certainty that a player will be gone, or market valuation.
- Existing reason priority, materiality threshold, caveat selection, and maximum-reason rules remain unchanged.

## Deterministic Flow

```text
Immutable ranking snapshot + draft state
                 |
                 v
One shared ADP-ordered board forecast
                 |
                 v
Current pocket + forecasted pocket
                 |
                 v
One transition per current position/tier profile
                 |
                 v
Candidate projections from shared transitions
                 |
                 v
Monotonic full/reduced timing allocation
                 |
                 v
Existing bounded recommendation scoring and reasons
```

Equivalent normalized inputs must produce equivalent profile keys, anchors, transitions, candidate projections, deltas, adjustments, scores, reasons, and ordering.

## Edge Cases

### No ADP

When the complete ranking context has no valid ADP, the forecast remains `no-adp`. Profile timing, replacement quality, skip safety, allocations, and reasons are neutral.

### No Later User Pick

When no later user pick exists, future timing has no decision value. Profile transitions may be omitted or neutral, and all timing allocations and reasons are neutral.

### Partial ADP

The existing snapshot-wide `max valid ADP + 1` fallback remains forecast-order evidence only. It does not affect profile identity, quality ordering, modifier allocation, or reasons.

### Fewer Than Six Remaining Players

The existing pocket rule returns every remaining player. Profile transition and allocation rules operate on that smaller pocket without special thresholds.

### Candidate Outside the Current Pocket

The candidate receives no profile timing modifier or reason, even if its position/tier profile is represented by a current-pocket candidate.

### Tied Overall Rank

Stable player ID selects the profile anchor and candidate allocation order. This tie-break must be tested and must not depend on input array order.

### Mixed or Malformed Tier Semantics

The existing normalization boundary remains responsible for rejecting partial, malformed, or contradictory supplied tiers. Profile analysis must not repair, merge, or infer such data.

## State Ownership and Persistence

Profiles, transitions, candidate projections, components, scores, and reasons are derived values inside the pure Recommendation Engine boundary.

They must not be:

- persisted in draft records;
- serialized into Scenario V2;
- written back to ranking snapshots;
- reconstructed from mutable ranking sets;
- cached as authoritative state.

Manual drafts, persisted drafts, scenario replay, and transient workbench sessions recompute them from captured draft state and immutable ranking context.

No schema migration, repository change, API route, service, queue, cache, or background process is required.

## Validation Contract

Automated validation must cover:

1. The Jefferson/London regression: both share WR/source-tier-2 profile evidence, Jefferson receives at least London's timing delta, and timing cannot put London above Jefferson.
2. Low-safety allocation: profile leader receives `+6`; later members receive `+3`.
3. Medium-safety allocation: profile leader receives `+3`; later members receive `0`.
4. High and neutral safety: every profile member receives `0`.
5. Leader removal: when the higher-ranked candidate is drafted, the next candidate becomes profile leader and receives the full applicable modifier.
6. Shared evidence: every member of a profile receives identical transition counts, replacement quality, and skip safety.
7. Source-tier comparison: same/better tiers are comparable and worse tiers are near within the shared anchor window.
8. Defaulted-neutral behavior: same-position depth can be observed without meaningful-tier claims.
9. Rank-window boundaries at 12 and 13 positions from the shared profile anchor.
10. Stable-ID determinism for tied overall ranks and shuffled equivalent inputs.
11. No exact-player scoring: candidate membership in the removal window or forecasted pocket cannot independently change the profile signal or allocation.
12. Existing inactive forecast, outside-pocket, DST/K, cap, score reconciliation, reason materiality, scenario, replay, persistence, and preview regressions remain passing.

Manual validation must reproduce the reported default-ranking state, inspect the shared WR/source-tier-2 transition, confirm Jefferson remains above London, then remove Jefferson and confirm allocation deterministically promotes the next profile member.

## Architecture Tradeoffs

### Complexity Cost

The design adds an explicit profile key, a shared transition collection, and allocation roles. This is more domain structure than the current candidate loop, but it removes candidate-relative comparison behavior and avoids a final-order patch or hidden score correction.

### Maintenance Cost

Transition thresholds and full/reduced allocation require focused fixtures. Maintenance should improve because one profile transition explains every affected candidate, making disagreements and reason output easier to inspect.

### Scaling Implications

The engine groups at most 6-12 players in each pocket and derives a small transition set in process. Runtime and memory costs are negligible. The design requires no infrastructure or caching.

### Developer Experience

Named profile and transition values make the forecast-to-score path clearer than repeated candidate scans. The primary discipline is keeping source-tier profiles distinct from recommendation tiers and documenting that defaulted-neutral profiles have no meaningful tier boundary.

### Deployment Implications

There are no database, API, service, or deployment changes. The patch remains inside the existing Next.js monolith and pure Recommendation Engine.

### Iteration Speed

Implementing the patch as small ordered tasks is slower than adding a one-line eligibility guard, but it establishes the intended product semantics and prevents further same-profile inversions. Once implemented, tuning and regression analysis operate on one shared transition rather than many candidate-relative outcomes.

## Implementation Planning Guidance

Translate this design into small tasks in this order:

1. Add profile identity and shared current-to-forecast transition derivation without changing scoring.
2. Project shared transitions into candidate signals and add monotonic full/reduced modifier allocation.
3. Integrate profile-backed reasons, remove superseded candidate-relative analysis, and complete regression/workflow validation.

Do not implement all three milestones in one slice. Do not update `docs/current-slice.md` until the corrective tasks have been approved and the first task is promoted.

## Success Criteria

This corrective design is successful when:

- draft-pocket timing describes shared changes in position-and-tier opportunity;
- all candidates in one profile receive identical replacement-quality and skip-safety evidence;
- modifier allocation favors the highest-ranked current member of an affected profile;
- no lower-ranked candidate in a profile receives a larger positive forecast modifier than a higher-ranked available member;
- exact-player forecast membership cannot recreate direct ADP urgency;
- the Jefferson/London inversion is impossible without a final-sort override;
- existing deterministic forecast, caps, snapshot reproducibility, persistence, scenario, replay, and workbench behavior remain intact.
