# Tasks

## Current Focus

Phase 5.5: Overall Tier Recommendations - active.

Phase 5.5 expands the deterministic Recommendation Engine with an overall/source-tier signal and an ADP availability-risk signal. Overall rank remains the player-quality anchor. Missing ADP contributes no weight, and wholly absent overall-tier data becomes one neutral tier rather than blocking draft use.

The source documents for this task plan are:

- `docs/project.md`
- `docs/design/overall-tier-recommendations.md`
- `docs/architecture.md`
- `docs/testing.md`

Phase 5 is complete. Managed ranking sets, immutable ranking snapshots, persisted drafts, Scenario V1 compatibility, and existing recommendation behavior remain regression constraints throughout Phase 5.5.

---

## Phase 5.5 Task Ordering

Tasks are ordered so ranking metadata becomes validated recommendation context before either new signal affects scoring:

1. Add the normalized recommendation ranking context.
2. Preserve ranking snapshot context through draft workflows.
3. Add the overall-tier score component.
4. Add the ADP availability score component and preview decision point.
5. Integrate decision-timing scoring and caps.
6. Add score-backed overall-tier and ADP reasons.
7. Integrate between-turn recommendation previews.
8. Add a portable scenario contract for Phase 5.5 ranking context.
9. Integrate Phase 5.5 context with scenario replay and workbench flows.
10. Complete Phase 5.5 regression and exit validation.

Promote only one task at a time into `docs/current-slice.md`. Keep context normalization, workflow propagation, pure scoring, explanation behavior, UI integration, and scenario portability as separate reviewable increments.

---

## Task 1 - Add the Normalized Recommendation Ranking Context

- [ ] Not started

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

- [ ] Not started

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

- [ ] Not started

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

- [ ] Not started

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

## Task 5 - Integrate Decision-Timing Scoring and Caps

- [ ] Not started

### Goal

Integrate the overall-tier and ADP components into the existing bounded additive Recommendation Engine without allowing correlated urgency to overwhelm base player value.

### Scope

- Consume the normalized recommendation ranking context at the Recommendation Engine boundary.
- Add overall-tier and ADP components to each available player's inspectable score output.
- Combine them under the approved decision-timing cap.
- Preserve the independent existing position-urgency cap for recommendation-tier cliffs, scarcity, and observed runs.
- Preserve total positive and negative context caps and deterministic tie-breaking.
- Record score adjustments when the decision-timing or total-context cap changes a raw score.
- Keep value opportunity distinct from ADP availability.
- Preserve neutral behavior for missing ADP and defaulted overall tiers.

### Non-Goals

- Do not add user-facing reason text yet.
- Do not retune unrelated roster, scarcity, run, tier-cliff, or base-value rules.
- Do not add a generic modifier framework.
- Do not persist recommendation output.

### Acceptance Criteria

- Both new components affect ordering only through the approved bounded scoring model.
- Overall tier and ADP cannot exceed the decision-timing cap when combined.
- Existing position urgency remains independently capped.
- Total context caps continue protecting substantially stronger base-value cases.
- Missing ADP and neutral overall tiers add exactly zero weight.
- Identical draft state and snapshot context produce identical components, adjustments, scores, and order.

### Suggested Tests

- Unit tests for decision-timing and total-context cap adjustments.
- Ordering scenarios with aligned and conflicting rank, tier, ADP, and roster signals.
- Regression tests for existing position-urgency caps and deterministic tie-breaking.
- Neutral-fallback scoring regressions.

---

## Task 6 - Add Score-Backed Overall-Tier and ADP Reasons

- [ ] Not started

### Goal

Explain material overall-tier and ADP contributions using only evidence produced by their score components.

### Scope

- Add concise reasons for the best remaining overall tier and last player in that tier.
- Add concise reasons for a player available past ADP or whose ADP falls before the user's following turn.
- Route both reason types through the existing priority, materiality, caveat, and maximum-reason rules.
- Suppress reasons for null ADP, defaulted-neutral tiers, neutral components, and immaterial contributions.
- Describe ADP as availability evidence rather than player quality or certainty.
- Keep overall-tier wording free of position-tier, scarcity, and roster-need claims.

### Non-Goals

- Do not add AI-generated or conversational reasoning.
- Do not claim a specific opponent will select a player.
- Do not redesign recommendation presentation.
- Do not change component scoring or caps.

### Acceptance Criteria

- Every new reason references a score component that materially affected the recommendation.
- Null ADP and defaulted-neutral tiers never produce reasons.
- ADP reasons describe timing and the following user pick without certainty claims.
- Overall-tier reasons never describe position-tier pressure.
- Existing reason limits, priorities, and deterministic selection remain intact.

### Suggested Tests

- Exact reason tests for each positive threshold.
- Suppression tests for neutral, missing, defaulted, and immaterial inputs.
- Reason-priority and maximum-count interaction tests.
- Regression proving all displayed reasons remain score-backed.

---

## Task 7 - Integrate Between-Turn Recommendation Previews

- [ ] Not started

### Goal

Keep recommendations current after every recorded pick and present off-turn output as a preview of the user's next decision.

### Scope

- Recalculate recommendations after every accepted pick, undo, reset, load, and replay-state change.
- Use the normalized snapshot context consistently in persisted and transient sessions.
- Distinguish between on-turn recommendations and between-turn preview output without changing scoring semantics.
- Remove drafted players before each recalculation.
- Preserve current Draft Room responsiveness and recommendation ordering.
- Keep on-turn-only calculation as a future performance option rather than premature behavior.

### Non-Goals

- Do not add background workers, caching, debouncing infrastructure, or speculative precomputation.
- Do not simulate picks between the preview decision point and the following turn.
- Do not redesign unrelated Draft Room controls.
- Do not add live provider behavior.

### Acceptance Criteria

- Recommendations refresh after every draft-state change.
- Off-turn output uses the next scheduled user pick as its preview decision point.
- A player drafted by another team disappears from the next preview.
- On-turn and preview calculations use the same score components and caps.
- Existing pick, undo, reset, resume, and transient-session behavior remains valid.

### Suggested Tests

- Draft Room integration tests across user and opponent picks.
- Undo, reset, persisted-load, and transient-session preview regressions.
- Test proving drafted players never remain in preview results.
- Manual QA through both ends of a snake-draft turn.

---

## Task 8 - Add a Portable Scenario Contract for Phase 5.5 Ranking Context

- [ ] Not started

### Goal

Define and implement a versioned portable scenario representation that preserves supplied overall-tier metadata while retaining Scenario V1 compatibility.

### Scope

- Add a new explicit scenario version capable of carrying Ranking Snapshot V2-equivalent ranking context.
- Preserve ranking entries, nullable ADP, tier semantics, and overall/source-tier values required for deterministic Phase 5.5 recommendations.
- Keep Scenario V1 readable with its existing entries, nullable ADP, and defaulted-neutral overall-tier behavior.
- Validate supplied tier metadata before scenario acceptance.
- Serialize the new contract deterministically.
- Keep ranking-set identity and mutable source data non-authoritative.

### Non-Goals

- Do not reinterpret Scenario V1's legacy `tier` field as an overall tier.
- Do not rewrite existing scenario files.
- Do not add scenario migrations beyond explicit version readers.
- Do not change replay behavior yet.
- Do not add new scenario authoring features unrelated to ranking context.

### Acceptance Criteria

- The new scenario version round-trips supplied overall-tier context and nullable ADP exactly.
- Scenario V1 remains readable and normalizes to one neutral overall tier.
- Invalid or partial supplied overall-tier metadata fails with structured diagnostics.
- Serialization is deterministic and keeps mutable ranking-set dependencies out of the document.
- Scenario format selection remains explicit and version-safe.

### Suggested Tests

- Exact serialization and round-trip tests for the new version.
- V1 compatibility and neutral-tier fallback regressions.
- Partial, malformed, and mismatched tier-metadata failures.
- Complete, partial, and absent ADP fixtures.

---

## Task 9 - Integrate Phase 5.5 Context with Scenario Replay and Workbench Flows

- [ ] Not started

### Goal

Use preserved or defaulted Phase 5.5 ranking context throughout scenario replay, transient sessions, and workbench import/export workflows.

### Scope

- Build normalized recommendation context from each supported scenario version.
- Use supplied overall tiers for the new scenario version and neutral overall tiers for Scenario V1.
- Preserve nullable ADP behavior in replay recommendations.
- Recalculate deterministic on-turn and preview recommendations as replay state changes.
- Export new portable scenarios with the ranking context used by the workbench session.
- Keep replay independent of mutable ranking sets and persistence records.
- Preserve existing validation, replay targets, reset, import, and export behavior.

### Non-Goals

- Do not add new replay controls or scenario-library features.
- Do not infer missing overall tiers from recommendation tiers.
- Do not fetch current ADP during replay.
- Do not change draft-state replay rules.

### Acceptance Criteria

- Replaying the new scenario version reproduces the same recommendation order, components, adjustments, and reasons.
- Scenario V1 continues replaying with neutral overall-tier behavior and its stored nullable ADP.
- Workbench reset and replay preserve the scenario's normalized ranking context.
- Scenario export/import does not require the original ranking set to exist.
- Existing replay errors and draft invariants remain intact.

### Suggested Tests

- Deterministic replay tests for both scenario versions.
- Workbench import, reset, export, and re-import integration tests.
- Source-ranking deletion independence regression.
- Preview recommendation tests during stepped replay.

---

## Task 10 - Complete Phase 5.5 Regression and Exit Validation

- [ ] Not started

### Goal

Prove the new recommendation signals improve draft-timing decisions without weakening deterministic scoring, snapshot reproducibility, or existing draft workflows.

### Scope

- Run focused and full automated validation across context normalization, scoring, explanations, persistence, Draft Room, scenarios, and replay.
- Validate all approved overall-tier and ADP thresholds, neutral states, caps, and interactions.
- Confirm missing ADP never blocks import, draft creation, recommendation generation, or replay.
- Confirm wholly absent tiers use one neutral tier and partial or malformed supplied tiers never create guessed boundaries.
- Compare representative scenarios where rank, overall tier, ADP, roster fit, and position urgency align or conflict.
- Confirm recommendation previews update after every pick without violating draft invariants.
- Complete focused manual QA across managed rankings, new and historical drafts, snake-turn previews, persistence reload, and scenario replay.
- Validate linting, type checking, production build, persistence integration, and the full automated suite.

### Non-Goals

- Do not add new recommendation features during exit validation.
- Do not tune behavior by weakening assertions or changing unrelated expected output.
- Do not add default ADP feeds, projections, VORP, position tiers, simulations, or Phase 6 insights.
- Do not begin live-provider integration or performance infrastructure without measured need.

### Acceptance Criteria

- Every Phase 5.5 task acceptance criterion is satisfied.
- Identical draft and ranking snapshot inputs produce exact deterministic recommendation output.
- Overall tiers affect only the approved overall-tier component and never masquerade as position-tier pressure.
- ADP affects availability timing only when supplied and contributes zero when absent.
- Decision-timing, position-urgency, and total-context caps prevent a single or correlated signal from overwhelming player quality.
- Persisted drafts and portable scenarios reproduce their captured recommendation context.
- Manual, persisted, preview, reset, undo, and replay workflows remain usable.
- Full automated and manual validation passes with no Phase 5.5 non-goals introduced.

### Suggested Tests

- Run the full automated suite and project validation commands.
- Run exact deterministic scenario fixtures for aligned and conflicting signals.
- Complete persistence and scenario round trips with complete, partial, and absent optional data.
- Complete manual QA through multiple snake turns and between-turn previews.
- Compare repeated recommendation output for identical captured inputs.

---

## Testing Status

Phase 5 exit validation is complete. Phase 5.5 testing has not started.

Phase 5.5 should prioritize pure component tests, exact ordering and explanation assertions, realistic scenario tests, workflow regressions, and focused manual QA. Existing draft invariants and completed Phase 5 ranking, snapshot, persistence, and replay coverage remain mandatory regression gates.

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
