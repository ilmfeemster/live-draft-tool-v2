# Current Slice: Add the Deterministic Board-Forecast Foundation

## Completion Status

Complete. Added the typed, pure `DraftPocketForecast` foundation and a focused `createDraftPocketForecast` module that derives the next user pick, normalizes missing ADP for removal ordering, excludes drafted players, and returns deterministic current-board, removal-window, and forecasted-board identities. The module remains uncalled by recommendation generation, so scoring and UI behavior are unchanged. Focused validation passed with 1 test file and 8 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Implement the pure, roster-agnostic foundation that deterministically projects the available board at the user's next scheduled selection from draft state and normalized ranking facts, without constructing draft pockets or changing recommendation behavior.

## Scope

### Goals

- Derive the first user-owned pick strictly after the current overall pick from the generated draft schedule.
- Calculate the exact number of selections to remove before that target pick.
- Build the current available board from the normalized ranking context and recorded draft picks.
- Use valid snapshot ADP only to order expected removals.
- Assign individual missing ADP `max valid snapshot ADP + 1` when any valid ADP exists.
- Return neutral forecast status when the complete snapshot has no ADP or the user has no later pick.
- Expose deterministic current-board, removal-window, and forecasted-board player identities.
- Keep the forecast pure, derived, roster-agnostic, unpersisted, and independent of recommendation scoring.

### Non-Goals

- Do not construct the 6-12 player current or forecasted draft pockets; Task 6 owns pocket construction.
- Do not derive tier composition, position composition, diversity labels, replacement quality, skip safety, or profile transitions.
- Do not calculate or integrate `draft_pocket_timing`, overall-tier, or legacy ADP score components.
- Do not call the forecast from `generatePlayerRecommendations` or change recommendation totals, ordering, caps, reasons, or UI behavior.
- Do not modify or remove the completed legacy `adp_availability` component; Task 8 owns its scoring replacement.
- Do not simulate opponent behavior, assign probabilities, or claim individual-player availability.
- Do not persist normalized fallback ADP, forecast output, or recommendation output.
- Do not change ranking normalization, snapshots, drafts, scenarios, repositories, UI, or dependencies.

## Implementation Decisions

- Add a focused pure module at `src/lib/draftPocketForecast.ts` rather than expanding the existing recommendation module.
- Add the forecast domain types to `src/types/draft.ts` beside the existing recommendation types:
  - `DraftPocketForecastStatus = "active" | "no-adp" | "no-next-pick"`;
  - a readonly `DraftPocketForecast` foundation containing status, target metadata, fallback evidence, and board identity arrays.
- The forecast function should accept:
  - the current `Draft`;
  - the complete normalized `RecommendationRankingFact[]` snapshot context;
  - the explicit user team identity.
- Include these foundation fields:

  ```text
  status
  targetPickNumber
  picksToRemove
  missingAdpFallback
  currentBoardPlayerIds
  removalWindowPlayerIds
  forecastedBoardPlayerIds
  ```

- Build `currentBoardPlayerIds` by removing every recorded `playerId` from the complete ranking context, then order the remaining identities by overall rank and `player.id`.
- Determine `targetPickNumber` as the first scheduled pick where:
  - `pick.teamId === userTeamId`; and
  - `pick.pickNumber > draft.currentPickNumber`.
- Calculate `picksToRemove = targetPickNumber - draft.currentPickNumber`.
- This target rule intentionally differs from the superseded direct ADP decision-point helper:
  - when the user is on the clock, the count includes the current selection and intervening selections before the user picks again;
  - between user turns, the count includes the pending selections before the user's upcoming pick.
- Evaluate `no-next-pick` before ADP availability. With no later user pick:
  - keep the deterministic current board;
  - return null target, removal-count, and fallback fields;
  - return empty removal-window and forecasted-board arrays.
- When a target exists but the complete snapshot has no valid ADP:
  - return `no-adp`;
  - retain the target and removal count for diagnostics;
  - set `missingAdpFallback` to null;
  - return empty removal-window and forecasted-board arrays.
- When any valid snapshot ADP exists:
  - calculate the maximum across the complete normalized snapshot, including already drafted players;
  - assign every missing ADP that maximum plus one for forecast ordering only;
  - preserve fractional ADP without rounding;
  - do not mutate ranking facts or expose fallback as player quality.
- For active forecast removal, sort available players by:
  1. normalized ADP;
  2. overall rank;
  3. `player.id`.
- Preserve removal-window identities in removal order.
- After removal, reorder the remaining forecasted board by overall rank and `player.id`. ADP must not become the board's quality order.
- Use ordinary immutable array transformations and return new readonly arrays. Do not mutate the draft, ranking facts, or their nested players.
- Rely on existing draft-state validation for coherent schedules and available-player invariants. Do not add repair logic for invalid drafts in this slice.

## Implementation Steps

1. Add the forecast foundation types.

   In `src/types/draft.ts`:

   - add the three-state forecast status union;
   - add the readonly forecast foundation with nullable target/fallback metadata and readonly player-ID arrays;
   - keep the types independent of persistence and UI models;
   - do not change existing recommendation or ranking-context contracts.

2. Implement the pure board forecast.

   In `src/lib/draftPocketForecast.ts`:

   - add deterministic overall-rank/player-ID and normalized-ADP comparators;
   - filter recorded drafted player IDs from normalized ranking facts;
   - derive the target user pick and removal count from `draft.picks`;
   - implement the approved `no-next-pick` and `no-adp` neutral outputs;
   - calculate the snapshot-wide missing-ADP fallback for active forecasts;
   - create the exact removal window and remaining board without mutation;
   - return the typed foundation output;
   - do not import recommendation scoring functions or call this function from production recommendation generation.

3. Add focused forecast tests.

   In `src/lib/draftPocketForecast.test.ts`:

   - build schedules with `generateSnakeDraftOrder` instead of hand-writing turn assumptions;
   - use normalized `RecommendationRankingFact` fixtures;
   - assert on-turn targeting uses the user's following pick and includes the current selection in the removal count;
   - assert between-turn targeting uses the user's upcoming pick;
   - cover a non-default user draft position and snake-turn boundary;
   - assert drafted players are absent from all board outputs;
   - assert complete ADP produces exact removal order and a rank-ordered forecasted board;
   - assert partial ADP uses the complete snapshot maximum plus one, including when that maximum belongs to a drafted player;
   - assert equal and fractional ADP resolve without rounding through overall rank and player ID;
   - assert wholly absent ADP returns `no-adp` with target metadata but no removal forecast;
   - assert the final user pick and no-later-pick states return `no-next-pick`;
   - assert the input draft and normalized ranking facts remain unchanged;
   - assert repeated equivalent inputs return exact equivalent output.

4. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/draftPocketForecast.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because the new pure module is not connected to recommendation or UI behavior.

5. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Mark Task 5 complete in `docs/tasks.md`.
   - Stop without beginning Task 6 pocket construction.

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

- The forecast is a pure typed domain function with no persistence, React, repository, or roster dependency.
- The current board contains every normalized ranking fact not already recorded as drafted, ordered by overall rank and stable player ID.
- The target is the first user pick strictly after the current pick, with an exact schedule-derived removal count.
- On the user's turn, the removal count includes the current selection; between turns, it targets the upcoming user selection.
- Active forecasts remove players by normalized ADP, overall rank, and stable player ID in that order.
- Missing individual ADP uses exactly the complete snapshot's maximum valid ADP plus one and does not mutate or penalize the player.
- The removal window preserves forecast removal order, while the remaining forecasted board returns to overall-rank/player-ID order.
- Wholly absent ADP returns `no-adp`, preserves target metadata, and constructs no removal forecast.
- No later user pick returns `no-next-pick` with no future forecast, even when ADP exists.
- Fractional and tied ADP remain deterministic without rounding.
- Equivalent inputs return exact equivalent output, and no input is mutated.
- No recommendation score, ordering, cap, adjustment, reason, UI, persistence, scenario, or replay behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If the normalized ranking facts do not contain enough identity and ADP information to construct the forecast without consulting persistence or import metadata, stop and report rather than widening the boundary.
- If the target rule cannot be derived from the existing scheduled picks, stop and report rather than duplicating snake-draft arithmetic or adding UI state.
- If the design would require using legacy direct-ADP decision semantics, stop and report the conflict rather than silently reusing the helper.
- If a valid draft can require removing more players than remain before a scheduled user pick, report the draft-state invariant conflict rather than adding repair or clamping behavior.
- If readonly forecast output requires changing unrelated shared contracts, stop and report before broadening the slice.
- If the new unused module changes recommendation behavior, remove the unintended call path and report the discrepancy.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 6: build the tier-aware current and forecasted draft pockets from this foundation. Do not begin Task 6 automatically.

## Slice Review

- Smallest meaningful increment: yes. It produces one deterministic forecasted-board foundation without combining pocket semantics or scoring.
- Executable by a lower-reasoning pass: yes. Inputs, output fields, status precedence, target rule, fallback, sorting, files, and exact tests are defined.
- Avoids unnecessary architecture changes: yes. It adds one pure domain module and typed value inside the existing Recommendation Engine boundary.
- Blast radius reasonable: yes. Production work is limited to one type file and one new pure module, plus one focused test file and planning records.
- Review/revert comfort: yes. The module remains uncalled by recommendation generation and cannot change user-visible behavior.
- Observable/testable acceptance criteria: yes. Every target, neutral state, fallback, ordering rule, determinism rule, and mutation boundary has direct unit coverage.
