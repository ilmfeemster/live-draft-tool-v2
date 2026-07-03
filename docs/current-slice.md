# Current Slice: Build Tier-Aware Current and Forecasted Draft Pockets

## Completion Status

Complete. Added the typed, pure `DraftPocket` domain value and shared `createDraftPocket` builder with exact 6-12 player tier-aware boundaries, meaningful-tier and complete position counts, and deterministic descriptive diversity labels. Current pockets now exist for every forecast status, while forecasted pockets exist only for active forecasts. The forecast module remains uncalled by recommendation generation, so scoring and UI behavior are unchanged. Focused validation passed with 1 test file and 19 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Extend the completed board-forecast foundation with deterministic 6-12 player draft pockets that describe the user's meaningful current and forecasted choice sets by overall rank, meaningful overall/source tier, position, and non-scoring diversity labels.

## Scope

### Goals

- Define a typed, readonly `DraftPocket` domain value.
- Build all pockets through one shared pure function over normalized recommendation ranking facts.
- Select the top six players by overall rank and stable player ID when at least six remain.
- Extend beyond six only through the sixth player's meaningful supplied overall/source tier.
- Cap every pocket at 12 players.
- Return every remaining player when fewer than six remain.
- Build the current pocket for every forecast status.
- Build the forecasted pocket only when the completed board forecast is active.
- Expose deterministic player IDs, meaningful-tier summary, tier counts, complete position counts, and descriptive diversity labels.
- Keep all pocket output derived, roster-agnostic, unpersisted, and disconnected from scoring and UI.

### Non-Goals

- Do not derive candidate replacement quality, near replacements, skip safety, or profile transitions; Task 7 owns candidate interpretation.
- Do not add or integrate `draft_pocket_timing`, overall-tier, or legacy ADP score components.
- Do not add recommendation reasons or UI presentation.
- Do not treat diversity labels as score, urgency, roster need, or strategy.
- Do not infer position tiers or treat defaulted-neutral overall tiers as real quality boundaries.
- Do not change ADP normalization, target-pick derivation, removal ordering, or neutral forecast status behavior completed in Task 5.
- Do not call the forecast from recommendation generation or change recommendation, persistence, scenario, replay, or Draft Room behavior.
- Do not add dependencies or a generic aggregation framework.

## Implementation Decisions

- Extend the existing types in `src/types/draft.ts`:
  - `DraftPocketDiversityLabel = "thin" | "WR-heavy" | "RB-heavy" | "onesie-heavy" | "balanced" | "mixed"`;
  - readonly `DraftPocketOverallTierCount` entries with `overallTier`, `overallTierOrigin`, and `count`;
  - readonly `DraftPocket`;
  - `currentPocket: DraftPocket` and `forecastedPocket: DraftPocket | null` on `DraftPocketForecast`.
- Define `DraftPocket` with:

  ```text
  playerIds
  highestMeaningfulOverallTier
  overallTierCounts
  positionCounts
  diversityLabels
  ```

- Represent `positionCounts` as a readonly complete `Record<Position, number>` containing QB, RB, WR, TE, DST, and K, including zero counts. This avoids missing-key interpretation in later candidate analysis.
- Export one pure `createDraftPocket(rankings)` function from `src/lib/draftPocketForecast.ts`.
- `createDraftPocket` must make its own sorted copy by:
  1. overall rank;
  2. `player.id`.
- Pocket selection is exact:
  1. If zero through five players are supplied, include all.
  2. Otherwise include the first six.
  3. If the sixth player's `overallTierOrigin` is `source`, continue adding consecutive players from that same overall tier.
  4. Stop at the first different tier or after 12 total players.
  5. If the sixth player's tier is `defaulted-neutral`, stop at six.
- Source-tier extension uses overall-tier equality only. It must not inspect position-local `tier`, numeric tier gaps, ADP, position, or roster state.
- Preserve pocket `playerIds` in overall-rank/player-ID order.
- Build `overallTierCounts` from selected pocket players:
  - count source and defaulted-neutral origins separately;
  - order entries by numeric overall tier, then `source` before `defaulted-neutral` for deterministic output;
  - retain defaulted-neutral counts for diagnostics without treating them as meaningful.
- Set `highestMeaningfulOverallTier` to the lowest numeric selected overall tier whose origin is `source`; return null when the pocket has no source tier.
- Build complete position counts from selected players.
- Diversity labels are deterministic and descriptive:
  - add `thin` when fewer than six players are in the pocket;
  - use `WR-heavy` when WR is a strict majority;
  - otherwise use `RB-heavy` when RB is a strict majority;
  - otherwise use `onesie-heavy` when QB and TE together are a strict majority;
  - otherwise use `balanced` when at least three positions are represented;
  - otherwise use `mixed`.
- Return labels in deterministic order: optional `thin` first, followed by exactly one shape label.
- An empty pocket is `thin` and `mixed`, with null highest meaningful tier and zero counts.
- Update `createDraftPocketForecast` without changing its Task 5 semantics:
  - build `currentPocket` from the already rank-ordered current board for every status;
  - return `forecastedPocket: null` for `no-adp` and `no-next-pick`;
  - build `forecastedPocket` from the active forecasted board;
  - continue returning the existing board identity arrays unchanged.
- Keep the forecast module uncalled by `generatePlayerRecommendations`.

## Implementation Steps

1. Add pocket domain types.

   In `src/types/draft.ts`:

   - add the diversity-label union;
   - add the overall-tier-count and pocket types;
   - extend `DraftPocketForecast` with current and nullable forecasted pockets;
   - keep all new collections readonly and independent of persistence or UI types.

2. Implement the shared pocket builder.

   In `src/lib/draftPocketForecast.ts`:

   - export `createDraftPocket`;
   - sort a copied ranking list by overall rank and player ID;
   - apply the exact minimum-six, source-tier extension, and maximum-12 rules;
   - aggregate deterministic overall-tier and complete position counts;
   - derive highest meaningful tier and labels;
   - avoid mutation and any use of ADP, roster state, or position-local tiers.

3. Attach pockets to the forecast.

   In `src/lib/draftPocketForecast.ts`:

   - build the current pocket before forecast status branching;
   - add it to active and neutral outputs;
   - keep the forecasted pocket null for both neutral statuses;
   - build the active forecasted pocket from the remaining rank-ordered facts;
   - preserve all Task 5 status, target, fallback, removal-window, and board-ID output exactly.

4. Extend focused tests.

   In `src/lib/draftPocketForecast.test.ts`:

   - extend the normalized-ranking helper to vary overall tier, tier origin, and position without changing unrelated defaults;
   - test pocket sizes with 0, 5, 6, 7, 12, and more than 12 inputs;
   - assert a source tier crossing the sixth-player boundary extends through that tier;
   - assert a changed seventh-player tier stops at six;
   - assert a long sixth-player tier stops at 12;
   - assert defaulted-neutral tiers stop at six and yield null highest meaningful tier;
   - assert exact tier counts and deterministic ordering for supplied and neutral origins;
   - assert complete QB/RB/WR/TE/DST/K position counts;
   - cover `thin`, `WR-heavy`, `RB-heavy`, `onesie-heavy`, `balanced`, and `mixed` labels at strict-majority boundaries;
   - assert current pockets exist for active, `no-adp`, and `no-next-pick` outputs;
   - assert forecasted pockets exist only for active output;
   - retain all Task 5 target, ADP fallback, ordering, neutral-state, immutability, and determinism tests.

5. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/draftPocketForecast.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because the forecast module remains disconnected from recommendation generation and UI behavior.

6. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Mark Task 6 complete in `docs/tasks.md`.
   - Stop without beginning Task 7 candidate interpretation.

## Expected Files

Production:

- `src/types/draft.ts`
- `src/lib/draftPocketForecast.ts`

Focused tests:

- `src/lib/draftPocketForecast.test.ts`

Planning and completion tracking:

- `docs/current-slice.md`
- `docs/tasks.md` only after validation passes

Do not touch `src/lib/recommendations.ts`, existing recommendation tests, normalized-context logic, Draft Room, page props, transient sessions, snapshot mapping, repositories, imports, scenarios, Prisma, dependencies, project scope, architecture, roadmap, or future-ideas documents.

## Acceptance Criteria

- One pure shared function builds both current and forecasted pockets from normalized ranking facts.
- Pocket player IDs are ordered by overall rank and stable player ID.
- Pockets include all players below six, begin with six when possible, extend only through the sixth player's supplied overall tier, and never exceed 12.
- Defaulted-neutral tiers never extend a pocket or become the highest meaningful tier.
- Current pockets are present for active, `no-adp`, and `no-next-pick` forecasts.
- Forecasted pockets are present only for active forecasts and null for both neutral statuses.
- Tier counts retain exact tier and origin evidence in deterministic order.
- Position counts contain exact values for every supported position, including zeros.
- `thin`, position-heavy, `onesie-heavy`, `balanced`, and `mixed` labels follow the approved strict-majority rules and remain descriptive only.
- Empty and end-of-draft pockets return safe, deterministic summaries.
- Existing Task 5 status, target, fallback, board identity, immutability, and determinism behavior remains unchanged.
- No recommendation score, ordering, cap, adjustment, reason, UI, persistence, scenario, or replay behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If normalized ranking facts can mix source and defaulted-neutral tier origins in a supported context, preserve separate counts and report the case before inventing cross-origin tier semantics.
- If a valid supplied source tier is non-contiguous in overall-rank order, stop and report the normalization invariant conflict rather than extending across intervening tiers.
- If attaching pockets requires changing the completed Task 5 target, ADP, removal, or neutral-state contract, stop and report rather than folding unrelated corrections into this slice.
- If diversity labels require roster or strategy knowledge, keep objective counts and report the unsupported label rather than adding new inputs.
- If a pocket output would require persistence, UI, or recommendation-scoring changes, stop before broadening the slice.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 7: derive candidate replacement quality, skip safety, and profile transitions from the shared pockets. Do not begin Task 7 automatically.

## Slice Review

- Smallest meaningful increment: yes. It adds the shared tier-aware decision-space representation without candidate or scoring behavior.
- Executable by a lower-reasoning pass: yes. Types, selection boundaries, aggregation order, label thresholds, files, and exact tests are defined.
- Avoids unnecessary architecture changes: yes. It extends the completed pure forecast module and existing typed output.
- Blast radius reasonable: yes. Production changes remain within one type file and one forecast module, with one focused test file and planning records.
- Review/revert comfort: yes. The module remains uncalled by recommendations and has no user-visible integration.
- Observable/testable acceptance criteria: yes. Every pocket boundary, tier rule, count, label, neutral state, and regression constraint has direct coverage.
