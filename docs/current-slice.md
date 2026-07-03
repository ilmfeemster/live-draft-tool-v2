# Current Slice: Integrate Overall-Tier and Draft-Pocket Timing Scoring

## Completion Status

Planned. Not started.

## Goal

Integrate normalized overall-tier quality and candidate-specific draft-pocket timing into the pure bounded additive Recommendation Engine, replacing the superseded direct player-level ADP component without yet threading the new context through Draft Room or scenario workflows.

## Scope

### Goals

- Let the pure Recommendation Engine consume an explicitly supplied normalized recommendation ranking context.
- Build one shared draft-pocket forecast per recommendation calculation.
- Add the completed overall-tier component to candidate scores and inspectable output.
- Convert candidate skip safety into one bounded `draft_pocket_timing` score component.
- Apply exact timing deltas of `+6`, `+3`, and `0`.
- Restrict timing score eligibility to QB, RB, WR, and TE candidates in an active current pocket.
- Include draft-pocket timing under the existing urgency cap.
- Include overall-tier quality and capped urgency under the existing total context cap.
- Remove the superseded direct `adp_availability` component and its obsolete unit contract.
- Preserve deterministic score reconciliation, ordering, adjustments, and evidence.

### Non-Goals

- Do not add user-facing overall-tier or draft-pocket reason text; Task 9 owns reasons.
- Do not thread normalized context through Draft Room, persisted-session UI, or between-turn presentation; Task 10 owns that workflow integration.
- Do not change scenario portability, replay, or transient-session context threading; Tasks 11-12 own those workflows.
- Do not retune base value, roster fit, value opportunity, tier cliff, scarcity, observed runs, or global cap values.
- Do not add position-specific forecast weights, negative skip-safety penalties, probabilities, simulations, or a generic signal registry.
- Do not persist forecast, component, or recommendation output.
- Do not use raw ADP, exact-player removal, diversity labels, or missing-ADP fallback status as direct score inputs.

## Implementation Decisions

- Add an optional `recommendationRankingContext?: RecommendationRankingContext` field to `RecommendationInput`.
- Optionality is transitional and preserves existing production callers until their dedicated integration tasks:
  - when context is absent, preserve the current recommendation components, scores, reasons, and ordering exactly;
  - when context is supplied, activate overall-tier and draft-pocket scoring;
  - do not synthesize neutral overall tiers inside the Recommendation Engine.
- Keep raw `rankings` in `RecommendationInput` for existing engine components. The normalized context supplies only the validated Phase 5.5 facts and forecast input.
- When normalized context is supplied, require it to represent the same complete player identity set as `input.rankings`. Stop on missing or extra identities rather than partially applying Phase 5.5 scoring.
- Build one shared forecast before mapping candidates:

  ```text
  createDraftPocketForecast({
    draft: input.draft,
    rankings: input.recommendationRankingContext.rankings,
    userTeamId: input.userTeamId
  })
  ```

- Filter drafted players independently from both raw and normalized rankings, preserving the same available-player identity set.
- Resolve each raw recommendation candidate to its normalized `RecommendationRankingFact` by stable player ID.
- Continue returning raw `RankingEntry` values in `PlayerRecommendation.ranking`; normalized facts remain internal scoring inputs.
- Delete the superseded direct ADP implementation from `src/lib/recommendations.ts`:
  - `ADP_AVAILABILITY_*` constants;
  - `calculateAdpAvailabilityComponent`;
  - its private decision-point helper;
  - its focused tests and import.
- Do not add a compatibility wrapper for direct ADP scoring. ADP now influences score only through the shared forecast and candidate signal.

## Draft-Pocket Timing Component

- Add an exported pure `calculateDraftPocketTimingComponent` beside the existing component functions.
- Accept:
  - one `CandidatePocketSignal`;
  - the shared `DraftPocketForecast`.
- Use component ID `draft_pocket_timing`, fixed priority `20`, minimum `0`, and maximum `6`.
- Eligibility requires:
  - `forecast.status === "active"`;
  - candidate membership in the current pocket;
  - candidate position QB, RB, WR, or TE;
  - non-neutral candidate skip safety.
- Apply exact deltas:

  ```text
  low skip safety:     +6
  medium skip safety:  +3
  high skip safety:     0
  neutral/ineligible:   0
  ```

- Use deterministic threshold labels:
  - `low_skip_safety`;
  - `medium_skip_safety`;
  - `high_skip_safety`;
  - `inactive_forecast`;
  - `outside_current_pocket`;
  - `ineligible_position`;
  - `neutral_candidate_signal`.
- Return positive direction only for non-zero deltas; otherwise return neutral.
- Component evidence should include only score-relevant forecast observations:
  - forecast status and target pick;
  - candidate position and pocket membership;
  - replacement quality and skip safety;
  - comparable and near-replacement counts;
  - current and forecasted profile counts;
  - candidate forecasted-pocket presence;
  - profile and highest-meaningful-tier disappearance flags;
  - threshold label.
- Do not include raw ADP, normalized fallback ADP, removal-window membership, or diversity labels in component evidence.

## Scoring Integration

- When normalized context is supplied, calculate for every available candidate:
  - `overall_tier` from the candidate fact and available normalized facts;
  - one candidate pocket signal from the shared forecast;
  - `draft_pocket_timing` from that signal and forecast.
- Include both components in inspectable component output, including neutral states.
- Overall-tier quality is not urgency. Add its raw delta directly to the context calculation.
- Draft-pocket timing is urgency. Add its raw delta to the existing urgency group:

  ```text
  raw urgency =
    tier cliff
    + positional scarcity
    + observed run
    + draft-pocket timing

  capped urgency = min(raw urgency, maxUrgencyScore)
  ```

- Preserve the existing urgency adjustment contract and evidence.
- Calculate raw context as:

  ```text
  roster fit
  + overall-tier delta
  + capped urgency
  + value opportunity
  ```

- Preserve the existing positive/negative context cap and adjustment contract.
- When normalized context is absent:
  - do not create the forecast;
  - do not emit overall-tier or draft-pocket components;
  - use zero for both Phase 5.5 contributions;
  - preserve all existing tests and output.
- Existing reason selection should ignore the new components until Task 9 adds explicit reason builders. Do not add placeholder or generic reasons.
- QB/TE timing uses the same `+6/+3/0` mapping, but existing roster-fit penalties remain in raw context and cannot be bypassed.
- DST and K receive a neutral `draft_pocket_timing` component even when their objective candidate signal is non-neutral.

## Implementation Steps

1. Extend the recommendation input contract.

   In `src/types/draft.ts`:

   - add optional normalized recommendation context to `RecommendationInput`;
   - preserve every existing caller and output type;
   - do not add forecast or score state to workspaces or persistence.

2. Remove the superseded direct ADP component.

   In `src/lib/recommendations.ts` and `src/lib/recommendations.test.ts`:

   - remove the direct ADP constants, function, helper, import, and dedicated tests;
   - confirm no production code or remaining test imports the removed API;
   - retain Task 4 history in documentation rather than executable scoring code.

3. Add the draft-pocket timing component.

   In `src/lib/recommendations.ts`:

   - import the forecast and candidate-analysis functions;
   - add fixed bounds, deltas, eligibility positions, and priority;
   - implement `calculateDraftPocketTimingComponent` with exact evidence and threshold states;
   - keep the component pure and independently unit-testable.

4. Integrate normalized Phase 5.5 scoring.

   In `generatePlayerRecommendations`:

   - validate optional raw/normalized identity alignment;
   - create one shared forecast only when normalized context exists;
   - build available normalized facts and a stable fact lookup;
   - calculate overall-tier and timing components per available candidate;
   - add timing to the existing urgency cap;
   - add overall-tier quality and capped urgency to raw context;
   - append both inspectable components only when normalized context is supplied;
   - preserve score reconciliation, adjustment order, deterministic tie-breaking, limit behavior, and context-absent output.

5. Update focused recommendation tests.

   In `src/lib/recommendations.test.ts`:

   - extend the recommendation-input helper to optionally accept a normalized context;
   - add exact component tests for low, medium, high, neutral, inactive, outside-pocket, and DST/K states;
   - assert component evidence contains forecast facts but no raw ADP, fallback, removal-window, or diversity evidence;
   - assert supplied context adds overall-tier and timing components while absent context preserves previous output;
   - assert the direct `adp_availability` component and API are absent;
   - test identity mismatch failure rather than partial scoring;
   - test urgency-cap adjustment with forecast timing stacked beside existing urgency;
   - test total-context cap reconciliation with overall-tier and timing contributions;
   - test close-ranked candidates can reorder from timing while a clearly superior player remains protected;
   - test QB/TE roster penalties remain effective and DST/K timing stays neutral;
   - test missing individual ADP is handled only through forecast behavior and wholly absent ADP produces neutral timing;
   - assert exact deterministic components, adjustments, totals, and ordering across repeated inputs;
   - retain existing recommendation regressions except the intentionally removed direct ADP component tests.

6. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/draftPocketForecast.test.ts src/lib/recommendations.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Manual QA is not required because normalized context is not yet threaded into production UI or scenario callers.

7. Record completion only after validation passes.

   - Update this file with exact validation results.
   - Mark Task 8 complete in `docs/tasks.md`.
   - Stop without beginning Task 9 reason generation or Task 10 workflow integration.

## Expected Files

Production:

- `src/types/draft.ts`
- `src/lib/recommendations.ts`

Focused tests:

- `src/lib/recommendations.test.ts`
- existing `src/lib/draftPocketForecast.test.ts` remains unchanged but is included in validation

Planning and completion tracking:

- `docs/current-slice.md`
- `docs/tasks.md` only after validation passes

Do not touch `src/lib/draftPocketForecast.ts`, Draft Room, page props, scenario replay, transient sessions, normalized-context creation, workspace loaders, repositories, imports, Prisma, dependencies, project scope, architecture, roadmap, or future-ideas documents.

## Acceptance Criteria

- Context-absent recommendation input preserves existing components, scores, reasons, ordering, and caller compatibility.
- Supplied normalized context is identity-aligned with raw rankings or fails explicitly.
- One shared forecast is reused for every candidate in a recommendation calculation.
- Overall-tier quality contributes through its existing exact `0/+3/+6` component and bypasses the urgency group.
- Low, medium, and high skip safety produce exact timing deltas of `+6`, `+3`, and `0`.
- Inactive forecasts, candidates outside the current pocket, DST, and K produce neutral timing.
- Raw ADP, exact-player removal, diversity labels, and missing-ADP fallback never score directly or appear as component evidence.
- The direct `adp_availability` API and component are removed and cannot double-count market timing.
- Draft-pocket timing participates in the existing urgency cap with inspectable adjustment evidence.
- Overall-tier quality, capped urgency, roster fit, and value opportunity participate in the existing total-context cap.
- Existing roster-fit penalties remain effective for filled QB/TE positions.
- Forecast timing can break close decisions but cannot overcome a clearly superior player-quality case by itself.
- Score components plus adjustments reconcile exactly to total score.
- Equivalent draft, raw rankings, normalized context, league settings, and tuning produce exact deterministic output.
- No user-facing reason, UI, persistence, scenario, replay, or Draft Room behavior changes in this slice.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If optional context cannot preserve existing production callers without synthesizing domain facts inside the engine, stop and report rather than broadening into Tasks 10-12.
- If raw and normalized ranking identity sets differ, fail explicitly rather than applying partial Phase 5.5 scoring.
- If integrating timing requires reading ADP, removal windows, diversity labels, or roster state inside the timing component, stop and report the boundary violation.
- If existing reason selection emits unsupported text for the new components before Task 9, suppress that unsupported path without adding new reason content.
- If urgency or context reconciliation fails, correct only the new component placement and adjustment math; do not retune unrelated components or caps.
- If clearly superior base-value scenarios are overturned by the approved `+6` maximum, report the product discrepancy rather than changing the bound silently.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 9: add score-backed overall-tier and draft-pocket reason generation. Task 10 will then thread normalized context through Draft Room and between-turn previews. Do not begin either task automatically.

## Slice Review

- Smallest meaningful increment: yes. It activates the completed Phase 5.5 domain signals inside the pure engine without combining reason or workflow integration.
- Executable by a lower-reasoning pass: yes. Transitional input behavior, component mapping, cap placement, evidence, files, removals, and exact tests are defined.
- Avoids unnecessary architecture changes: yes. It reuses the existing normalized context, forecast, candidate signal, component model, and caps.
- Blast radius reasonable: yes. Production changes are limited to the recommendation input type and engine, with one focused recommendation test file and planning records.
- Review/revert comfort: yes. Production callers remain compatible and context-absent output is required to stay exact.
- Observable/testable acceptance criteria: yes. Every eligibility state, delta, cap interaction, alignment failure, ordering scenario, and regression boundary has direct coverage.
