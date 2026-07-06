# Tasks

## Current Focus

Phase 6: Strategy & Insight Engine.

Phase 6 adds a pure Insight Engine above the deterministic Recommendation Engine. The Insight Engine explains the current draft decision by interpreting existing recommendation outputs, score components, roster state, ranking snapshot context, and board-forecast observations. It must not change scores, reorder recommendations, add new scoring signals, simulate opponents, predict exact player availability, or generate unsupported strategy claims.

The source documents for this task plan are:

- `docs/project.md`
- `docs/design/strategy-insight-engine.md`
- `docs/domain/phase6-domain-knowledge-dive.md`
- `docs/design/recommendation-engine.md`
- `docs/design/phase5.5-profile-transitions.md`
- `docs/architecture.md`
- `docs/testing.md`

Phase 5.5 is complete. Its overall-tier, draft-pocket forecast, profile-transition, monotonic timing-allocation, scenario, replay, persistence, and manual draft workflows remain regression constraints throughout Phase 6.

---

## Phase 6 Task Ordering

Tasks are ordered so the Insight Engine contract exists before any insight selection, and domain insights are validated before UI presentation:

1. Add the Insight Engine contract and neutral bundle.
2. Generate primary decision frames and top-candidate summaries.
3. Add top-options tradeoff insights.
4. Add roster construction insights.
5. Add board and next-pocket insights.
6. Present strategic insights in the draft experience.
7. Complete Phase 6 regression and exit validation.

Promote only one task at a time into `docs/current-slice.md`. Keep the domain contract, decision framing, tradeoff analysis, roster interpretation, board/pocket interpretation, presentation integration, and exit validation as separate reviewable increments.

---

## Task 1 - Add the Insight Engine Contract and Neutral Bundle

- [ ] Pending

### Goal

Create the pure domain boundary for Phase 6 without changing recommendation scoring, recommendation ordering, or draft UI behavior.

### Scope

- Define the Insight Engine input boundary over typed draft state, league settings, user team identity, immutable ranking snapshot entries, recommendation output, and optional forecast output.
- Define structured insight output for summary, primary insight, candidate insights, tradeoff insights, roster insights, board insights, caveats, and suppressed signals.
- Represent stable insight kinds, severities, decision frames, score-gap labels, support references, and suppression reasons.
- Return a deterministic neutral bundle for empty, missing, or non-material recommendation states.
- Keep the boundary pure, derived, unpersisted, and independent of React, Prisma, repositories, import formats, mutable ranking sets, and draft source.
- Add focused tests proving equivalent inputs produce equivalent neutral output.

### Non-Goals

- Do not generate visible strategic advice yet.
- Do not change Recommendation Engine output, score components, reasons, or ordering.
- Do not add UI presentation.
- Do not persist insight output.
- Do not introduce AI-generated text, simulations, opponent modeling, or new score signals.

### Acceptance Criteria

- The Insight Engine can be called with the current draft inputs and recommendation output.
- The returned bundle has stable structured fields and deterministic defaults.
- Empty or unavailable recommendations return `no_material_insight` without throwing.
- Every insight or suppressed signal shape can reference supporting player, component, reason, adjustment, evidence, or forecast profile identifiers.
- No database, UI, mutable ranking-set, or import-format type crosses into the Insight Engine boundary.
- Recommendation scores and ordering are unchanged.

### Suggested Tests

- Unit tests for empty recommendations, one recommendation, and multiple recommendations.
- Determinism tests for equivalent inputs.
- Boundary tests proving insight output is derived and unpersisted.
- Type-level or fixture tests for support references and suppression reasons.

---

## Task 2 - Generate Primary Decision Frames and Top-Candidate Summaries

- [ ] Pending

### Goal

Produce the first useful strategic insight by explaining the top recommendation's decision shape from existing score components and evidence.

### Scope

- Select a primary decision frame from supported states such as clean best-player pick, value-over-need pick, need-over-value pick, pocket-pressure pick, tier-boundary pick, run-pressure pick, caveated top pick, close call, or no material insight.
- Derive score-gap labels from deterministic recommendation score differences.
- Generate a concise top-candidate summary using material supported components such as base value, overall tier, roster fit, value opportunity, draft-pocket timing, tier pressure, scarcity, run pressure, or meaningful negative caveats.
- Prefer structured component ids and evidence over reason text alone.
- Suppress frames and summaries when signals are neutral, defaulted, unsupported, capped below materiality, or too small to explain confidently.
- Preserve existing score-backed recommendation reasons as lower-level output without replacing them.

### Non-Goals

- Do not compare multiple top options yet beyond the minimum needed to identify close-call and score-gap labels.
- Do not add roster construction summaries or board/pocket notes yet.
- Do not change component scoring or reason generation.
- Do not add UI presentation yet.

### Acceptance Criteria

- A clean top player produces a concise best-player or player-quality frame.
- A top player with material roster/timing support produces the appropriate supported frame.
- A top player with a meaningful negative component produces a caveated frame or caveat insight.
- Close top scores avoid overstated certainty.
- Unsupported or neutral tier, forecast, run, and timing signals do not produce claims.
- Every generated insight includes traceable `supportedBy` references.

### Suggested Tests

- Clean top-player scenario.
- Need-over-value and value-over-need frame fixtures.
- Pocket-pressure, tier-boundary, run-pressure, and caveated-top fixtures using existing recommendation components.
- Close-score cluster fixture.
- Suppression tests for neutral/defaulted/unsupported/capped signals.

---

## Task 3 - Add Top-Options Tradeoff Insights

- [ ] Pending

### Goal

Explain the strongest meaningful contrast among the top recommendations so the user understands what decision they are actually making.

### Scope

- Compare the top two or three recommendations when their scores are close enough for a real decision.
- Identify material differences across player quality, roster fit, timing pressure, value opportunity, and caveats.
- Generate one concise tradeoff insight when the comparison is supported and useful.
- Distinguish the player-quality play from the roster/timing play when those signals disagree.
- Avoid manufacturing tradeoffs when one candidate is clearly ahead or when component differences are immaterial.
- Include support references for both sides of the tradeoff.

### Non-Goals

- Do not change recommendation ranking or tie-breaking.
- Do not create broad draft strategy lectures.
- Do not add board or next-pocket insights beyond existing component interpretation.
- Do not add UI presentation yet.

### Acceptance Criteria

- Close top options with different strengths produce a deterministic tradeoff insight.
- A stronger overall player versus stronger roster fit scenario is explained without implying one-dimensional certainty.
- Timing-pressure tradeoffs are explained only when timing components materially support them.
- Clear leaders do not receive unnecessary tradeoff text.
- Every tradeoff references the relevant players and supporting components.

### Suggested Tests

- Stronger player-quality versus stronger roster-fit fixture.
- Stronger roster/timing versus stronger base-value fixture.
- Similar-score same-position fixture with no useful tradeoff.
- Clear-leader fixture proving tradeoff suppression.
- Determinism test for equivalent top-candidate ordering.

---

## Task 4 - Add Roster Construction Insights

- [ ] Pending

### Goal

Summarize the user's roster shape in terms of lineup utility so recommendation context is easier to understand during the draft.

### Scope

- Derive roster construction state from league settings, roster slots, flex eligibility, current user roster, and remaining roster needs.
- Surface material open starter, flex, bench-depth, limited-need, and saturated-position context.
- Describe single-start positions such as QB, DST, and K cautiously according to league settings and draft phase evidence already present in recommendations.
- Preserve RB/WR/FLEX utility language for default two-flex PPR settings while deriving behavior from configured slots.
- Generate roster insight only when it helps explain the current decision or top-candidate context.
- Suppress roster insight when roster state is neutral or unrelated to the top decision.

### Non-Goals

- Do not add or retune roster-fit scoring.
- Do not hard-code MVP roster counts into domain logic.
- Do not introduce strategy profiles or whole-draft planning.
- Do not add UI presentation yet.

### Acceptance Criteria

- Open direct starter needs can produce supported roster context.
- Flex openings keep eligible positions relevant without overstating TE depth.
- Saturated positions produce caveats only when material to a visible recommendation.
- QB is described as a single-start slot unless league settings support broader utility.
- DST/K caveats appear only when existing recommendation evidence supports timing concerns.
- Non-default roster settings produce insight from configured slots rather than MVP constants.

### Suggested Tests

- Open RB/WR starter and flex scenarios.
- Filled starter slots with useful flex or bench depth.
- Saturated WR/RB caveat scenario.
- Open QB with stronger RB/WR timing scenario.
- Early DST/K caveat scenario.
- Non-default roster configuration fixture.

---

## Task 5 - Add Board and Next-Pocket Insights

- [ ] Pending

### Goal

Interpret existing Phase 5.5 board-forecast and profile-transition observations as supported near-term planning insight without predicting exact player availability.

### Scope

- Consume active forecast status, current pocket, forecasted pocket, profile transitions, replacement quality, skip safety, and draft-pocket timing evidence.
- Generate board or next-pocket insights when comparable profiles are thin, limited, absent, or safely represented in the forecasted next pocket.
- Explain profile-level timing pressure without claiming that specific players will or will not be drafted.
- Surface skip-safe context by suppressing urgency or noting that comparable profiles remain when useful.
- Suppress forecast insights for no-ADP, no later user pick, inactive, neutral, outside-pocket, DST/K, zero-allocation, or unsupported states.
- Preserve the distinction between overall/source tiers, recommendation-eligible tiers, and defaulted-neutral tier behavior.

### Non-Goals

- Do not change forecast construction, profile transitions, candidate timing allocation, scoring, or reasons.
- Do not introduce opponent modeling, probabilities, exact-player predictions, or ADP-as-quality language.
- Do not serialize forecast or insight output.
- Do not add UI presentation yet.

### Acceptance Criteria

- Low or medium skip safety can produce supported next-pocket pressure language for material current-pocket candidates.
- High skip safety suppresses urgency and may support wait-safe language when useful.
- Defaulted-neutral profiles never produce meaningful overall-tier disappearance claims.
- No-ADP and no-next-pick states produce no unsupported future-pick claims.
- Same-profile candidates read the same profile-transition evidence established in Phase 5.5.
- Every board or pocket insight traces to forecast/profile evidence and, where applicable, material recommendation components.

### Suggested Tests

- Pocket-cliff scenario with absent comparable profiles.
- Limited comparable or near-profile scenario.
- Skip-safe scenario with comparable profiles remaining.
- Defaulted-neutral tier scenario.
- No ADP, no later user pick, and inactive forecast scenarios.
- Jefferson/London-style same-profile evidence regression.

---

## Task 6 - Present Strategic Insights in the Draft Experience

- [ ] Pending

### Goal

Expose the structured Insight Engine output in the draft experience while preserving existing recommendation details and live-draft speed.

### Scope

- Call the Insight Engine from the existing recommendation calculation flow after recommendations are generated.
- Display the primary decision frame, top-candidate summary, strongest tradeoff, roster or next-pocket note, and material caveat in a compact draft-room presentation.
- Preserve existing recommendation ordering, scores, reasons, pick entry, undo, reset, load, replay, and preview behavior.
- Keep recommendation reasons available as lower-level detail where they already appear.
- Handle neutral, empty, missing, or suppressed insight states gracefully.
- Keep UI changes narrowly scoped to presenting the new insight output.

### Non-Goals

- Do not redesign the Draft Room broadly.
- Do not add new controls, settings, filters, or recommendation tuning UI.
- Do not change recommendation scoring, ordering, or reason selection.
- Do not persist insight output.
- Do not add live-provider integration.

### Acceptance Criteria

- Draft Room users can see the current decision frame and concise supported insight near recommendations.
- Insight output updates after pick, undo, reset, load, replay-target changes, and between-turn previews.
- Empty or neutral bundles do not create broken or misleading UI.
- Existing recommendation details remain accessible.
- The UI does not display unsupported opponent, probability, exact-player availability, AI, or ADP-quality claims.
- Existing manual draft and replay workflows remain usable.

### Suggested Tests

- Component or integration tests for insight rendering states.
- Draft Room workflow tests for pick, undo, reset, load, and preview recomputation.
- Scenario replay/workbench rendering regression.
- Manual QA for scan speed, wording clarity, and no layout regression.

---

## Task 7 - Complete Phase 6 Regression and Exit Validation

- [ ] Pending

### Goal

Prove the Strategy & Insight Engine improves decision understanding without changing recommendation behavior or introducing unsupported strategic claims.

### Scope

- Run focused and full validation across Insight Engine contract, decision frames, candidate summaries, tradeoffs, roster insights, board/pocket insights, presentation, persisted drafts, scenarios, replay, and manual Draft Room workflows.
- Validate deterministic output for identical draft state and ranking snapshot inputs.
- Confirm recommendation ordering, scores, components, reasons, caps, forecast output, and profile-transition behavior remain unchanged except for intentionally added insight output.
- Confirm no insight text asserts exact player availability, opponent predictions, probability estimates, ADP-as-quality, source tiers as position tiers, projections, VORP, or AI reasoning.
- Complete focused manual QA for realistic clean-pick, value-versus-need, timing-pressure, skip-safe, close-call, caveated, no-forecast, persisted, and replay states.
- Run project validation commands appropriate for the phase.

### Non-Goals

- Do not tune recommendation scoring during exit validation.
- Do not add new insight categories or broaden UI scope during validation.
- Do not weaken tests or replace meaningful assertions with existence checks.
- Do not begin live integrations, accounts, simulations, or Phase 7 work.

### Acceptance Criteria

- Every Phase 6 task acceptance criterion is satisfied.
- Insight output is deterministic, structured, traceable, and derived.
- Recommendation scores and ordering remain unchanged by insights.
- Unsupported insight claims are absent in automated and manual validation.
- Persisted drafts and portable scenarios recompute the same insights from captured inputs.
- Manual draft, persisted draft, preview, final-pick, reset, undo, scenario, replay, and workbench workflows remain usable.
- Full automated and manual validation passes with no Phase 6 non-goals introduced.

### Suggested Tests

- Run the full automated suite and project validation commands.
- Run exact insight fixtures for all approved decision frames and suppression states.
- Run scenario and replay determinism tests.
- Run persisted draft recomputation tests.
- Complete manual Draft Room QA across representative Phase 6 insight states.

---

## Testing Status

Phase 5.5 exit validation completed on 2026-07-06. Task 16 evidence included the focused Phase 5.5 regression set with 323 passing tests, the full automated suite with 810 passing tests and 1 intentionally skipped DB-gated test in the default run, TypeScript validation, lint with only the documented pre-existing `rankingNormalizer.test.ts` warning, production build, Prisma validation, PostgreSQL integration validation for ranking-set repository behavior, and user-completed browser QA across managed rankings, missing data, Draft Room, recommendation behavior, scenario/replay, export/re-import, and determinism.

Phase 6 testing has not started. The next testing work should focus on deterministic Insight Engine contract and decision-frame behavior before UI presentation.

---

## Backlog

Not required for Phase 6:

- New recommendation scoring signals
- Recommendation score tuning unrelated to insight presentation
- Projection, VORP, replacement-level, or simulation-based strategy
- Opponent modeling or predictions about specific picks
- AI-generated reasoning
- Automated or scheduled ranking, ADP, projection, or news ingestion
- Position-tier generation or inference from overall/source tiers
- Cross-provider ranking or ADP reconciliation
- Generic recommendation-signal plugins or registries
- Live platform integrations
- Accounts, cloud sharing, or multi-user workflows
- Background workers, queues, or speculative performance infrastructure
- Broad Draft Room redesign

See `future_ideas.md` for additional deferred ideas.
