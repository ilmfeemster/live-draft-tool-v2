# Tasks

## Current Focus

Phase 5.5: Overall Tier Recommendations and Draft Pocket Forecasting - complete.

Phase 5.5 expands the deterministic Recommendation Engine with an overall/source-tier quality signal and a draft-pocket timing signal. Overall rank remains the player-quality anchor. ADP is used only to construct a deterministic forecast of the user's next decision space: individual missing ADP sorts after the highest supplied snapshot ADP, while wholly absent ADP produces neutral forecast timing. Wholly absent overall-tier data becomes one neutral tier rather than blocking draft use.

The source documents for this task plan are:

- `docs/project.md`
- `docs/patches/phase5.5-patch.md`
- `docs/design/phase5.5-profile-transitions.md`
- `docs/domain/draft-pocket.md`
- `docs/architecture.md`
- `docs/testing.md`

Phase 5 is complete. Managed ranking sets, immutable ranking snapshots, persisted drafts, Scenario V1 compatibility, and existing recommendation behavior remain regression constraints throughout Phase 5.5.

---

## Phase 5.5 Task Ordering

Tasks are ordered so validated ranking context feeds one shared board forecast before timing affects scoring. Tasks 13-15 correct the completed candidate-relative interpretation by deriving timing from shared position/tier profile transitions before final exit validation:

1. Add the normalized recommendation ranking context.
2. Preserve ranking snapshot context through draft workflows.
3. Add the overall-tier score component.
4. Complete the original direct ADP availability component and decision-point work, retained as implementation history but superseded by the approved forecast design.
5. Add the deterministic board-forecast foundation.
6. Build tier-aware current and forecasted draft pockets.
7. Derive candidate replacement quality, skip safety, and profile transitions.
8. Integrate overall-tier and draft-pocket timing scoring under existing caps while replacing direct ADP scoring.
9. Add score-backed overall-tier and draft-pocket reasons.
10. Integrate between-turn draft-pocket recommendation previews.
11. Add a portable scenario contract for Phase 5.5 ranking context.
12. Integrate forecast context with scenario replay and workbench flows.
13. Add shared position/tier profile transition analysis.
14. Project profile transitions into monotonic candidate timing allocation.
15. Integrate profile-backed reasons and corrective workflow regressions.
16. Complete Phase 5.5 regression and exit validation.

Promote only one task at a time into `docs/current-slice.md`. Keep forecast construction, pocket analysis, profile transition analysis, candidate allocation, scoring integration, explanation behavior, UI integration, and scenario portability as separate reviewable increments.

---

## Task 1 - Add the Normalized Recommendation Ranking Context

- [x] Complete

### Goal

Create the pure boundary that converts one immutable ranking snapshot into explicit recommendation facts without exposing persistence or import metadata to scoring functions.

### Scope

- Represent nullable player ADP, materialized overall tier, and whether the overall tier was source-provided or defaulted-neutral.
- Validate supplied overall/source tiers against player identity, overall rank, completeness, and overall-order semantics.
- Materialize one neutral overall tier for every player when the snapshot has no supplied overall tiers.
- Preserve null ADP as a supported neutral state while rejecting malformed supplied values.
- Return structured failures for partial, malformed, contradictory, or mismatched supplied tier metadata.
- Keep position-local recommendation tiers distinct from overall/source tiers.
- Keep the boundary pure and independent of React, Prisma, repositories, and import formats.

### Non-Goals

- Do not add scoring components.
- Do not change recommendation ordering or reasons.
- Do not invent ADP values or overall-tier boundaries.
- Do not rewrite immutable snapshots.
- Do not add a generic recommendation-signal registry.

### Acceptance Criteria

- Complete source-overall tiers produce matching normalized overall-tier facts.
- A snapshot with no overall tiers produces one explicitly defaulted neutral tier across all players.
- Complete, partial, and absent ADP remain valid context inputs, with null preserved per player.
- Partial or malformed supplied tiers return structured failures rather than mixed real and invented boundaries.
- Position-local recommendation tiers remain unchanged and cannot be mistaken for overall tiers.
- Repeated normalization of the same snapshot produces exact equivalent output.

### Suggested Tests

- Unit tests for complete and defaulted-neutral overall-tier contexts.
- Unit tests for partial, malformed, decreasing, and mismatched tier metadata.
- Unit tests for complete, partial, and absent ADP.
- Boundary test proving persistence and import types do not enter the scoring context.

---

## Task 2 - Preserve Ranking Snapshot Context Through Draft Workflows

- [x] Complete

### Goal

Carry the immutable snapshot facts needed by Phase 5.5 from draft creation and hydration to every recommendation caller without changing snapshot ownership.

### Scope

- Preserve available ranking capabilities and tier semantics when creating and loading draft workspaces.
- Make the normalized recommendation context available to persisted draft, Draft Room, reset, and transient session workflows.
- Continue treating the captured ranking snapshot as the complete reproducibility boundary.
- Keep historical array-only snapshots loadable by applying the documented neutral overall-tier fallback.
- Prevent recommendation callers from querying mutable ranking sets or repositories for missing context.
- Preserve existing pick, undo, reset, delete, resume, and ranking-snapshot isolation behavior.

### Non-Goals

- Do not add either new score component.
- Do not change snapshot persistence schema solely to duplicate existing V2 metadata.
- Do not refresh existing snapshots from source ranking sets.
- Do not change scenario portability yet.
- Do not redesign draft setup or the Draft Room.

### Acceptance Criteria

- A new draft retains its supplied overall-tier metadata through persistence and hydration.
- An array-only historical snapshot hydrates with deterministic neutral overall-tier context.
- Partial or absent ADP survives hydration without blocking the workspace.
- Source ranking-set edits or deletion cannot affect the hydrated recommendation context.
- Existing draft operations continue using only the captured snapshot.

### Suggested Tests

- Draft creation and persistence round-trip tests with supplied overall tiers.
- Historical array-only snapshot fallback regression.
- Partial and absent ADP hydration tests.
- Source-edit and source-delete snapshot-isolation regressions.

---

## Task 3 - Add the Overall-Tier Score Component

- [x] Complete

### Goal

Implement a pure, bounded score component that recognizes the best remaining overall quality band without treating it as position-tier pressure.

### Scope

- Identify the best overall tier among available players.
- Apply the approved bounded bonus when a lower overall tier is available.
- Apply the larger approved bonus when one player remains in the best available overall tier.
- Return neutral behavior for lower-tier candidates, one-tier contexts, and defaulted-neutral tier data.
- Ignore numeric gaps between tier labels as measures of cliff size.
- Emit deterministic component evidence and threshold states for later explanation generation.
- Keep the component independent of roster need, position filtering, and position-local tier-cliff scoring.

### Non-Goals

- Do not integrate the component into total recommendation scores yet.
- Do not add explanation text.
- Do not create or infer position tiers.
- Do not tune unrelated recommendation modifiers.

### Acceptance Criteria

- Multiple players in the best remaining overall tier receive the approved bounded component when a lower tier exists.
- The final player in that tier receives the approved larger bounded component.
- Lower-tier and defaulted-neutral candidates receive zero.
- Tier-label gaps do not change the component value.
- The component never emits position-tier evidence or changes existing tier-cliff behavior.

### Suggested Tests

- Unit tests for multiple-player, last-player, lower-tier, and one-tier states.
- Unit test proving non-contiguous tier labels do not change scoring.
- Regression proving source-overall tiers do not activate position-tier cliffs.
- Determinism test for equivalent available-player inputs.

---

## Task 4 - Add the ADP Availability Component and Preview Decision Point

- [x] Complete

### Supersession Note

This completed task records the original direct player-level ADP approach. The approved Draft Pocket Forecasting design supersedes that scoring behavior. Tasks 5-8 reuse any valid decision-point groundwork but replace the direct ADP component; the final engine must not run both approaches.

### Goal

Implement the pure ADP signal that estimates the opportunity cost of waiting until the user's following turn for both on-turn decisions and between-turn previews.

### Scope

- Derive the current decision pick and following user pick from dynamic snake-draft state.
- Treat the current user pick as the decision point when the user is on the clock.
- Treat the next scheduled user pick as the preview decision point between user turns.
- Apply the approved normalized turn-interval risk bands for valid ADP.
- Return neutral behavior for null ADP, ADP after the next turn, and no remaining user turn.
- Keep ADP positive-only so expected later availability does not reduce player quality.
- Preserve fractional ADP without rounding.
- Emit deterministic component evidence, including preview state and threshold result.

### Non-Goals

- Do not integrate the component into total recommendation scores yet.
- Do not add ADP explanation text.
- Do not predict specific opponent picks or simulate future selections.
- Do not fetch, refresh, or synthesize default ADP.
- Do not hard-code team count, draft position, or turn distance.

### Acceptance Criteria

- ADP at or before the decision pick receives the approved maximum bounded component.
- ADP across the early, middle, and late portions of the turn interval maps to the approved risk bands.
- Null ADP contributes zero without excluding the player or blocking the ranking set.
- A ranking context with no ADP produces neutral ADP components for all players.
- Between-turn calculations expose preview state and use the next scheduled user decision.
- Final-turn and expected-available states remain neutral.

### Suggested Tests

- Unit tests for every ADP risk band and boundary.
- Null and all-absent ADP tests.
- Snake-draft tests from early, middle, and turn positions.
- Between-turn preview and final-turn tests.
- Fractional ADP and deterministic evidence tests.

---

## Task 5 - Add the Deterministic Board-Forecast Foundation

- [x] Complete

### Goal

Create the pure, roster-agnostic forecast that projects the available board at the user's next scheduled selection without scoring candidates or simulating opponents.

### Scope

- Define typed forecast statuses for active forecasting, wholly absent ADP, and no later user pick.
- Derive the first user pick strictly after the current overall pick from the generated draft order and calculate the exact removal count.
- When any valid snapshot ADP exists, assign missing ADP `max valid snapshot ADP + 1` for forecast ordering only.
- Sort the current available pool by normalized ADP, overall rank, and stable player ID.
- Remove the expected selections and expose deterministic removal-window and forecasted-board identities.
- Keep forecast output derived, unpersisted, reproducible, and independent of roster state, React, repositories, and source formats.

### Non-Goals

- Do not build draft pockets yet.
- Do not derive candidate replacement quality or skip safety.
- Do not add or integrate score components or reasons.
- Do not predict individual opponent behavior or assign probabilities.
- Do not write normalized fallback ADP into ranking snapshots.

### Acceptance Criteria

- On-turn and between-turn states derive the approved later user pick and removal count from draft order.
- Partial ADP uses the deterministic snapshot-wide fallback without changing player quality facts.
- Wholly absent ADP returns neutral forecast status while keeping recommendations usable.
- A final user turn returns neutral no-next-pick status.
- Equal normalized ADP values resolve by overall rank and stable player ID.
- Repeated equivalent inputs produce identical status, target, removal window, and forecasted board.

### Suggested Tests

- Pure target-pick tests from both ends and the middle of a snake turn.
- Partial, tied, fractional, and wholly absent ADP tests.
- Final-user-pick and completed-draft boundary tests.
- Exact removal-order and determinism tests.

---

## Task 6 - Build Tier-Aware Current and Forecasted Draft Pockets

- [x] Complete

### Goal

Convert current and forecasted boards into the bounded, tier-aware decision spaces used by Phase 5.5 analysis.

### Scope

- Build pockets by overall rank and stable player ID through one shared pure function.
- Take at least the top six available players when possible, extend through the sixth player's meaningful overall/source tier, and cap the pocket at 12.
- Keep a defaulted-neutral tier from extending the pocket because it is not a real quality boundary.
- Return every remaining player when fewer than six are available.
- Build the current pocket from the current available board and the forecasted pocket from the forecasted board.
- Expose player identities, highest meaningful overall tier, overall-tier counts, position counts, and deterministic diversity labels.
- Keep `thin`, position-heavy, `onesie-heavy`, `balanced`, and `mixed` labels descriptive and non-scoring.

### Non-Goals

- Do not derive candidate replacement quality, skip safety, or timing score.
- Do not create position tiers or extend pockets from defaulted-neutral tier data.
- Do not add UI presentation for pockets or labels.
- Do not persist pocket output.

### Acceptance Criteria

- Pockets contain 6-12 players whenever enough players remain and follow the approved tier-boundary rule.
- A meaningful sixth-player tier extends deterministically but never beyond 12 players.
- Defaulted-neutral tiers produce a six-player pocket rather than a guessed quality group.
- End-of-draft pockets safely contain every remaining player when fewer than six exist.
- Current and forecasted pockets expose exact deterministic tier, position, and diversity observations.
- Diversity labels never produce scoring behavior.

### Suggested Tests

- Pocket tests at 5, 6, 7, 12, and more than 12 available players.
- Tier-boundary, long-tier, and defaulted-neutral fixtures.
- Exact position-count and diversity-label tests.
- Deterministic ordering regressions.

---

## Task 7 - Derive Candidate Replacement Quality and Skip Safety

- [x] Complete

### Supersession Note

This completed task records the original candidate-relative interpretation of one shared forecast. Exit validation found that candidate-relative comparison centers can produce same-profile quality inversions. Tasks 13-15 replace that interpretation with shared position/tier profile transitions while preserving the single board forecast and pocket construction.

### Goal

Interpret one shared forecasted pocket for each current-pocket candidate without creating per-candidate board simulations.

### Scope

- Evaluate only candidates in the current pocket for forecast timing eligibility.
- Define rank proximity as an absolute overall-rank difference of 12 or fewer.
- Classify same-position forecasted players as comparable, near, or not replacements using meaningful overall/source tier and rank proximity.
- Derive high, medium, or low replacement quality from comparable and near-replacement counts.
- Derive skip safety from replacement quality plus whether the candidate remains in the forecasted pocket.
- Expose candidate profile disappearance, highest-meaningful-tier transition, replacement counts, and forecasted-pocket presence as objective evidence.
- Preserve RB/WR depth interpretation and QB/TE onesie caution without hardcoded position preferences or roster knowledge.
- Return neutral candidate signals when the shared forecast is neutral or the candidate is outside the current pocket.

### Non-Goals

- Do not score candidate signals yet.
- Do not create separate forecasts for candidates.
- Do not treat exact-player removal, diversity labels, or missing-ADP fallback as candidate urgency.
- Do not infer position tiers or subjective player preferences.
- Do not read roster construction inside forecast analysis.

### Acceptance Criteria

- Comparable and near replacements follow the exact position, rank-window, and overall-tier rules.
- Replacement-quality and skip-safety categories match the approved deterministic thresholds.
- A candidate remaining in the forecasted pocket cannot receive low skip safety solely because no replacement exists.
- Deep WR profiles remain safe to skip, disappearing RB profiles become low-safety cases, and both-deep or both-thin cases defer appropriately to player quality and later roster scoring.
- QB/TE thinness creates no independent signal beyond candidate-specific profile loss.
- One shared forecast produces identical candidate evidence across repeated runs.

### Suggested Tests

- Comparable, near, absent, and candidate-still-present fixtures.
- Rank-window boundary tests at 12 and 13 places.
- Source-tier and defaulted-neutral comparison tests.
- RB/WR both-deep, asymmetric, and both-thin scenarios.
- QB/TE profile-loss and generic onesie-thinness regressions.

---

## Task 8 - Integrate Overall-Tier and Draft-Pocket Timing Scoring

- [x] Complete

### Supersession Note

This completed task records the original direct mapping from candidate-relative skip safety to timing deltas. Tasks 13-15 preserve the `draft_pocket_timing` component and existing caps but replace its evidence and allocation with the approved profile-level contract.

### Goal

Integrate overall-tier quality and candidate-specific draft-pocket timing into the bounded additive Recommendation Engine while removing direct player-level ADP urgency.

### Scope

- Consume normalized ranking context and the shared forecast at the pure Recommendation Engine boundary.
- Add the completed overall-tier component to inspectable candidate score output.
- Add one `draft_pocket_timing` component with approved low, medium, and high skip-safety deltas of `+6`, `+3`, and `0`.
- Restrict forecast timing to active forecasts, current-pocket candidates, and QB/RB/WR/TE positions.
- Remove the direct `adp_availability` component from final scoring so ADP market timing is not counted twice.
- Include forecast timing under the existing urgency cap and preserve total positive and negative context caps.
- Preserve roster-fit effects for QB/TE so forecast timing cannot invent a onesie roster need.
- Preserve deterministic tie-breaking and component evidence for later reason generation.

### Non-Goals

- Do not add user-facing reason text yet.
- Do not retune unrelated roster, scarcity, run, tier-cliff, value-opportunity, or base-value rules.
- Do not add position-specific forecast weights or a generic modifier framework.
- Do not persist forecast or recommendation output.

### Acceptance Criteria

- Low, medium, and high skip safety produce exactly the approved bounded deltas.
- Raw ADP gap, exact-player removal, diversity labels, and missing-ADP fallback never score directly.
- The direct ADP component no longer contributes to final scores or creates duplicate evidence.
- Forecast timing participates in existing urgency and total-context caps with inspectable adjustments.
- Stronger base player-quality cases remain protected from forecast-only overrides.
- QB/TE roster penalties remain effective when a onesie position is already sufficiently filled.
- Identical draft and snapshot inputs produce identical components, adjustments, scores, and ordering.

### Suggested Tests

- Exact component tests for every eligibility and skip-safety state.
- Regression proving the legacy direct ADP component is absent from integrated scoring.
- Urgency and total-context cap interaction tests.
- Close-rank and clearly-superior-player ordering scenarios.
- QB/TE roster-fit interaction and DST/K neutrality tests.

---

## Task 9 - Add Score-Backed Overall-Tier and Draft-Pocket Reasons

- [x] Complete

### Supersession Note

The overall-tier reason behavior remains complete. Tasks 13-15 replace only draft-pocket reasons that depend on superseded candidate-relative evidence with reasons backed by shared profile transitions and material candidate allocation.

### Goal

Explain material overall-tier and draft-pocket timing contributions using only evidence produced by their integrated score components.

### Scope

- Add concise reasons for the best remaining meaningful overall tier and the last player in that tier.
- Add forecast reasons for thin comparable options, disappeared position/tier profiles, limited replacements, and applicable highest-tier transitions.
- Use the candidate's actual position and the forecasted next pocket in reason wording.
- Route new reasons through existing materiality, priority, caveat, and maximum-reason rules.
- Suppress reasons for neutral forecasts, high skip safety, defaulted-neutral tiers, candidates outside the current pocket, and immaterial components.
- Keep reason wording free of certainty, player-quality claims from ADP, subjective market claims, and position-tier language.

### Non-Goals

- Do not add raw ADP, exact-player-gone, diversity-only, or missing-ADP reasons.
- Do not add AI-generated or conversational reasoning.
- Do not redesign recommendation presentation.
- Do not change component scoring or caps.

### Acceptance Criteria

- Every new reason traces to a material non-zero score component and exact component evidence.
- Forecast reasons explain loss of comparable options rather than asserting individual availability.
- Defaulted-neutral tiers and neutral forecast states never create unsupported reasons.
- Generic WR-heavy, RB-heavy, or onesie-heavy labels never produce reasons by themselves.
- Existing reason limits, priorities, caveats, and deterministic selection remain intact.

### Suggested Tests

- Exact overall-tier and forecast-reason tests for each scored threshold.
- Suppression tests for neutral, missing, defaulted, descriptive-only, and immaterial evidence.
- Reason-priority and maximum-count interaction tests.
- Regression proving every displayed reason remains score-backed.

---

## Task 10 - Integrate Between-Turn Draft-Pocket Recommendation Previews

- [x] Complete

### Goal

Keep recommendations and their draft-pocket forecast current after every recorded state change, including previews between user turns.

### Scope

- Recalculate recommendations and the shared forecast after every accepted pick, undo, reset, load, and replay-state change.
- Use the normalized immutable snapshot context consistently in persisted and transient sessions.
- Use the approved later-user-pick target in both on-turn and between-turn states.
- Remove actually drafted players before each forecast and recommendation calculation.
- Distinguish preview output without changing forecast, scoring, or reason semantics.
- Preserve current Draft Room responsiveness and recommendation ordering behavior.

### Non-Goals

- Do not persist forecasts or recommendation output.
- Do not add background workers, caching, debouncing infrastructure, or speculative precomputation.
- Do not simulate opponents or create probability-based availability UI.
- Do not redesign unrelated Draft Room controls or add live-provider behavior.

### Acceptance Criteria

- Recommendations and forecast evidence refresh after every supported draft-state change.
- On-turn and between-turn states derive their target from the same deterministic rule.
- A player drafted by any team disappears from the next board, pocket, and recommendation calculation.
- Final-user-pick previews remain usable with neutral future timing.
- Persisted, transient, undo, reset, and resume workflows preserve existing draft invariants.

### Suggested Tests

- Draft Room integration tests across user and opponent picks.
- Undo, reset, persisted-load, and transient-session preview regressions.
- Tests proving drafted players never remain in board, pocket, or recommendation output.
- Manual QA through both ends of multiple snake-draft turns and the user's final pick.

---

## Task 11 - Add a Portable Scenario Contract for Phase 5.5 Ranking Context

- [x] Complete

### Goal

Define a versioned portable scenario representation that preserves the ranking facts required to recompute draft-pocket forecasts while retaining Scenario V1 compatibility.

### Scope

- Add an explicit scenario version capable of carrying Ranking Snapshot V2-equivalent ranking context.
- Preserve ranking entries, nullable ADP, tier semantics, and overall/source-tier values required for deterministic Phase 5.5 recommendations.
- Keep Scenario V1 readable with its existing entries, nullable ADP, and defaulted-neutral overall-tier behavior.
- Validate supplied tier metadata before scenario acceptance and serialize the new contract deterministically.
- Keep ranking-set identity and mutable source data non-authoritative.
- Recompute fallback ADP and forecast output after load rather than serializing derived values.

### Non-Goals

- Do not persist removal windows, pockets, candidate signals, score components, or recommendation output in scenarios.
- Do not reinterpret Scenario V1's legacy `tier` field as an overall tier.
- Do not rewrite existing scenarios or add migrations beyond explicit version readers.
- Do not change replay behavior yet.
- Do not add unrelated scenario authoring features.

### Acceptance Criteria

- The new scenario version round-trips supplied overall-tier context and nullable ADP exactly.
- Scenario V1 remains readable and normalizes to one neutral overall tier.
- Invalid or partial supplied overall-tier metadata fails with structured diagnostics.
- Derived forecast output is absent from the portable document and reproducible from captured inputs.
- Serialization is deterministic, explicit, version-safe, and independent of mutable ranking sets.

### Suggested Tests

- Exact serialization and round-trip tests for the new version.
- V1 compatibility and neutral-tier fallback regressions.
- Partial, malformed, and mismatched tier-metadata failures.
- Complete, partial, and absent ADP fixtures proving derived fallback is not serialized.

---

## Task 12 - Integrate Forecast Context with Scenario Replay and Workbench Flows

- [x] Complete

### Goal

Recompute deterministic Phase 5.5 forecasts and recommendations throughout scenario replay, transient sessions, and workbench import/export workflows.

### Scope

- Build normalized recommendation context from each supported scenario version.
- Use supplied overall tiers for the new scenario version and neutral overall tiers for Scenario V1.
- Preserve nullable ADP and apply forecast fallback rules only after scenario load.
- Recalculate shared forecasts, pockets, candidate signals, scores, and reasons as replay state changes.
- Export new portable scenarios with the ranking context used by the workbench session.
- Keep replay independent of mutable ranking sets, persistence records, and previously derived forecast output.
- Preserve existing validation, replay targets, reset, import, and export behavior.

### Non-Goals

- Do not add replay controls or scenario-library features.
- Do not infer missing overall tiers from recommendation tiers.
- Do not fetch current ADP or preserve stale forecast output during replay.
- Do not change draft-state replay rules.

### Acceptance Criteria

- Replaying the new scenario version reproduces the same forecasted board, pockets, candidate evidence, recommendation order, adjustments, and reasons.
- Scenario V1 continues replaying with neutral overall-tier behavior and its stored nullable ADP.
- Workbench reset and replay recompute forecast state from the scenario's captured inputs.
- Scenario export/import does not require the original ranking set or serialized recommendation output.
- Existing replay errors and draft invariants remain intact.

### Suggested Tests

- Exact deterministic replay tests for both scenario versions.
- Workbench import, reset, export, and re-import integration tests.
- Source-ranking deletion independence regression.
- On-turn, between-turn, and final-pick forecast tests during stepped replay.

---

## Task 13 - Add Shared Position/Tier Profile Transition Analysis

- [x] Complete

### Goal

Replace candidate-relative replacement analysis with one deterministic transition per current position/overall-tier profile without changing forecast construction or recommendation scoring yet.

### Scope

- Represent a profile by position, overall-tier origin, and overall/source-tier value.
- Group current-pocket candidates by profile and order each group by overall rank then stable player ID.
- Use the highest-ranked current profile member as the shared rank-window anchor.
- Compare each current profile with the forecasted pocket through exact, comparable, near, and unrelated option classifications.
- Preserve the existing 12-rank proximity boundary using the shared profile anchor rather than each candidate.
- Derive one set of profile counts, replacement quality, skip safety, disappearance observations, and highest-meaningful-tier transition evidence.
- Treat defaulted-neutral profiles as position depth without inventing meaningful tier boundaries.
- Keep profile transitions pure, roster-agnostic, derived, unpersisted, and deterministic.

### Non-Goals

- Do not integrate profile transitions into recommendation scores or ordering.
- Do not allocate modifiers to candidates or change reasons.
- Do not change ADP normalization, removal ordering, target-pick selection, pocket construction, or diversity labels.
- Do not create position tiers, per-candidate forecasts, simulations, or new persistence contracts.
- Do not remove existing candidate signals until the replacement boundary is validated.

### Acceptance Criteria

- Every distinct current position/tier profile produces exactly one deterministic transition.
- All candidates in one profile share the same anchor, forecast counts, replacement quality, and skip safety.
- Meaningful source-tier options classify as exact, comparable, or near according to position, tier order, and the shared rank window.
- Defaulted-neutral profiles compare same-position depth without emitting meaningful-tier transition evidence.
- Rank distances of 12 and 13 from the profile anchor are included and excluded respectively.
- Exact-player membership and ADP removal-window membership do not change profile replacement quality independently.
- No-ADP, no-next-pick, malformed-context, and empty/small-pocket states preserve their approved neutral or failure behavior.
- Equivalent inputs with different array order produce equivalent profile identities and transitions.

### Suggested Tests

- Pure profile identity, grouping, and stable-anchor tests.
- Exact, comparable, near, absent, and multiple-near transition fixtures.
- Source-tier and defaulted-neutral behavior tests.
- Shared rank-window boundary and stable-ID determinism tests.
- Jefferson/London fixture proving both read one WR/source-tier-2 transition.

---

## Task 14 - Project Profile Transitions Into Monotonic Candidate Timing Allocation

- [x] Complete

### Goal

Replace candidate-relative draft-pocket scoring with candidate projections from shared profile transitions and allocate bounded timing modifiers without allowing a lower-ranked profile member to receive a larger bonus.

### Scope

- Project each shared profile transition onto its ordered current-pocket candidates.
- Expose profile identity, anchor, candidate ordinal, allocation role, shared counts, replacement quality, skip safety, and disappearance evidence in candidate signals.
- Keep candidate forecast membership diagnostic and non-scoring.
- Allocate the existing timing values by profile safety and candidate order:
  - low safety: profile leader `+6`, other profile members `+3`;
  - medium safety: profile leader `+3`, other profile members `0`;
  - high or neutral safety: every profile member `0`.
- Preserve timing eligibility for active forecasts, current-pocket candidates, and QB/RB/WR/TE only.
- Keep the timing component within the existing urgency and total-context caps.
- Remove the superseded candidate-relative comparison path once profile-backed scoring is validated.

### Non-Goals

- Do not change reason wording or broader workflow integration yet.
- Do not add modifier magnitudes, position weights, tuning settings, or final-sort overrides.
- Do not retune base value, overall tier, roster fit, tier pressure, scarcity, run pressure, or value opportunity.
- Do not make exact-player availability, diversity labels, or raw ADP score directly.
- Do not change forecast, pocket, persistence, or scenario contracts.

### Acceptance Criteria

- Candidate replacement quality and skip safety come directly from one shared profile transition and are identical within a profile.
- For candidates ordered within one profile, every higher-ranked candidate receives a timing delta greater than or equal to each lower-ranked candidate's delta.
- Low, medium, high, and neutral profile states produce exactly the approved full/reduced allocations.
- When a profile leader becomes unavailable, the next-ranked member deterministically becomes leader and receives the full applicable modifier.
- The Jefferson/London case cannot award London a larger draft-pocket timing delta than Jefferson while both remain available in the same profile.
- Every recommendation score reconciles exactly from components and adjustments without hidden corrections.
- Existing urgency and total-context caps, roster-fit effects, tie-breaking, and deterministic output remain intact.
- Raw ADP, exact removal, forecast membership, missing-ADP fallback, and diversity labels remain non-scoring.

### Suggested Tests

- Exact allocation tests for every profile safety and candidate role.
- Two- and three-member profile monotonicity tests.
- Profile-leader removal and stable-ID tie tests.
- Jefferson/London integrated score and ordering regression.
- Urgency-cap, context-cap, QB/TE roster-fit, DST/K neutrality, and score-reconciliation regressions.

---

## Task 15 - Integrate Profile-Backed Reasons and Corrective Workflow Regressions

- [x] Complete

### Goal

Complete the corrective design by grounding draft-pocket reasons in shared profile transitions and proving the new behavior across persisted, preview, scenario, replay, and workbench workflows.

### Scope

- Generate draft-pocket reasons only from a material non-zero candidate allocation backed by its shared profile transition.
- Explain absent, limited, or lower-quality future profile options without asserting exact-player availability or market value.
- Suppress positive timing reasons for zero-allocation candidates even when their shared profile is low or medium safety.
- Keep defaulted-neutral reasons position-based and free of meaningful-tier disappearance claims.
- Preserve existing reason materiality, priority, caveat, and maximum-count rules.
- Recompute profile transitions, candidate projections, allocations, scores, and reasons after pick, undo, reset, load, restart, and replay-target changes.
- Prove persistence and Scenario V1/V2 workflows reproduce profile-backed output from captured inputs without serializing derived transitions.
- Add focused regressions for the reported inversion and representative RB/WR and QB/TE profile states.

### Non-Goals

- Do not redesign recommendation presentation or add new workbench controls.
- Do not serialize profiles, transitions, candidate signals, modifiers, scores, or reasons.
- Do not change scenario versions, database schema, snapshot ownership, or replay rules.
- Do not add AI-generated explanations, direct ADP reasons, or position-tier language.
- Do not begin general Phase 5.5 exit validation until the corrective workflow regressions pass.

### Acceptance Criteria

- Every positive draft-pocket reason traces to one material profile-backed timing component.
- Zero allocations do not produce unsupported positive timing reasons.
- Defaulted-neutral profiles never produce meaningful overall-tier disappearance language.
- Jefferson remains above London in the reported state, their evidence references the same profile transition, and London receives no larger timing reason or modifier.
- Deep, disappearing, both-deep, and both-thin RB/WR profiles and QB/TE roster-fit interactions preserve the approved bounded behavior.
- Pick, undo, reset, persisted reload, restart, replay-target, and between-turn preview changes recompute exact deterministic profile-backed output.
- Scenario V1/V2 export and replay remain independent of mutable ranking sets and serialized derived output.
- Existing draft invariants, overall-tier reasons, score reconciliation, reason selection, and workbench behavior remain intact.

### Suggested Tests

- Exact reason generation and suppression tests for full, reduced, and zero allocations.
- Defaulted-neutral reason-language regressions.
- Persisted and transient workflow recomputation tests.
- Scenario V1/V2 replay and export/re-import equivalence tests.
- Manual Draft Room reproduction of the Jefferson/London case before and after Jefferson is drafted.

---

## Task 16 - Complete Phase 5.5 Regression and Exit Validation

- [x] Complete

### Goal

Prove overall-tier quality and profile-level draft-pocket timing improve decisions without weakening deterministic scoring, snapshot reproducibility, or existing draft workflows.

### Scope

- Run focused and full validation across context normalization, forecast construction, pocket analysis, profile transitions, candidate allocation, scoring, explanations, persistence, Draft Room, scenarios, and replay.
- Validate pocket sizes and tier boundaries, ADP fallback and neutral states, target-pick boundaries, profile classification, shared replacement quality, skip safety, monotonic allocation, and deterministic ordering.
- Cover RB/WR deep, disappearing, both-deep, and both-thin cases plus QB/TE onesie and roster-fit interactions.
- Confirm raw ADP, exact-player removal, diversity labels, defaulted tiers, and missing-ADP fallback never create unsupported score or reason output.
- Confirm the superseded direct ADP component does not remain active or double-count market timing.
- Confirm the superseded candidate-relative comparison path cannot produce same-profile quality inversions.
- Validate urgency and total-context caps across aligned and conflicting player-quality, forecast, roster, scarcity, and run signals.
- Complete focused manual QA across managed rankings, new and historical drafts, snake-turn previews, final picks, persistence reload, scenarios, and replay.
- Validate linting, type checking, production build, persistence integration, and the full automated suite.

### Non-Goals

- Do not add features or new tuning dimensions during exit validation.
- Do not weaken assertions or change unrelated expected behavior to make validation pass.
- Do not add projections, VORP, position tiers, probabilistic forecasts, opponent modeling, or Phase 6 insights.
- Do not begin live-provider integration or performance infrastructure without measured need.

### Acceptance Criteria

- Every Phase 5.5 task acceptance criterion is satisfied.
- Identical draft and ranking snapshot inputs reproduce exact forecast and recommendation output.
- Overall/source tiers remain quality groupings and never masquerade as position-tier pressure.
- ADP affects only deterministic forecast order and contributes no direct player-quality or individual-availability score.
- Missing individual ADP and wholly absent ADP follow their distinct approved behaviors without blocking workflows.
- Forecast timing influences close decisions while urgency and total-context caps protect clearly stronger player-quality cases.
- Candidates in one profile share transition evidence, and timing allocation never gives a lower-ranked member a larger positive forecast modifier than a higher-ranked available member.
- Persisted drafts and portable scenarios reproduce their captured recommendation context and derived forecast behavior.
- Manual, persisted, preview, final-pick, reset, undo, and replay workflows remain usable.
- Full automated and manual validation passes with no Phase 5.5 non-goals introduced.

### Suggested Tests

- Run the full automated suite and project validation commands.
- Run exact forecast and recommendation fixtures for all approved domain transitions.
- Run exact profile-transition, allocation, and same-profile monotonicity fixtures.
- Complete persistence and scenario round trips with complete, partial, and absent optional data.
- Complete manual QA through multiple snake turns, between-turn previews, and the user's final pick.
- Compare repeated forecast and recommendation output for identical captured inputs.

---

## Testing Status

Phase 5 exit validation is complete. Phase 5.5 normalization, workflow propagation, overall-tier component, deterministic board forecasting, tier-aware pocket construction, the original candidate-relative replacement and skip-safety model, bounded scoring integration, score-backed explanations, persisted/transient preview wiring, the portable Scenario V2 ranking-context contract, and version-aware replay/workbench integration are complete through Task 12. The original direct-ADP component has been removed from executable code under its approved supersession. Task 12 validation passed on 2026-07-03: 208 focused scenario, portability, replay, Draft Room, repository-mapping, forecast, and recommendation tests; TypeScript validation; lint with only the documented pre-existing `rankingNormalizer.test.ts` warning; and `git diff --check`.

Exit validation exposed a same-profile quality inversion in which candidate-relative replacement analysis could award a larger timing modifier to a lower-ranked player in the same position/source-tier profile. Tasks 13-15 are complete: the engine derives shared position/tier profile transitions once, applies monotonic full/reduced/neutral timing modifiers, and emits reasons only from coherent material profile allocations. Defaulted-neutral profiles cannot emit meaningful-tier disappearance language. Task 15 automated validation passed on 2026-07-05 with 199 focused recommendation, scenario, replay, persistence-mapping, and Draft Room tests; TypeScript validation; lint with only the documented pre-existing `rankingNormalizer.test.ts` warning; and `git diff --check`. User-completed manual QA subsequently passed the Jefferson/London ordering and promotion, pick/undo recomputation, persisted load, Scenario V1/V2, replay-target, and export/re-import checks.

Phase 5.5 exit validation completed on 2026-07-06. Task 16 evidence includes the focused Phase 5.5 regression set with 323 passing tests, the full automated suite with 810 passing tests and 1 intentionally skipped DB-gated test in the default run, TypeScript validation, lint with only the documented pre-existing `rankingNormalizer.test.ts` warning, production build, Prisma validation, and `git diff --check`. The PostgreSQL integration gate was rerun with `RUN_RANKING_SET_DB_TESTS=1` and `RANKING_SET_TEST_DATABASE_URL` sourced from the configured development database, producing 28 passing ranking-set repository tests and validating real ranking-set, ranking-snapshot, and draft persistence isolation. User-completed browser QA passed the managed-ranking, missing-data, Draft Room, recommendation-behavior, scenario/replay, export/re-import, and determinism matrices. Phase 5.5 is complete with no product behavior changes, weakened assertions, schema changes, or unrelated modifications introduced during exit validation.

---

## Backlog

Not required for Phase 5.5:

- Automated or scheduled default ADP ingestion
- ADP provider selection, refresh cadence, and freshness UX
- Position-tier generation or inference
- Projection, VORP, replacement-level, or simulation-based recommendation signals
- Cross-provider ranking or ADP reconciliation
- Opponent modeling or predictions about specific picks
- Strategy Engine, Insight Engine, confidence modeling, or AI-generated reasoning
- Generic recommendation-signal plugins or registries
- Live platform integrations
- Accounts, cloud sharing, or multi-user workflows
- Background workers, queues, or speculative performance infrastructure
- Broad Draft Room redesign

See `future_ideas.md` for additional deferred ideas.
