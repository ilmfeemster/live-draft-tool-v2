# Current Slice: Derive Candidate Replacement Quality and Skip Safety

## Completion Status

Planned. Not started.

## Goal

Interpret the completed shared current and forecasted pockets for one recommendation candidate at a time, producing deterministic replacement-quality, skip-safety, and profile-transition evidence without creating candidate-specific forecasts or changing recommendation scores.

## Scope

### Goals

- Define a typed, readonly candidate pocket signal.
- Evaluate candidates against one already-created shared `DraftPocketForecast`.
- Restrict active interpretation to candidates in the current pocket.
- Use same position and an inclusive 12-rank proximity window for replacement candidates.
- Distinguish comparable replacements from near replacements using meaningful overall/source tiers.
- Derive exact high, medium, low, and neutral replacement-quality states.
- Derive skip safety from replacement quality plus whether the candidate remains in the forecasted pocket.
- Expose candidate membership, profile counts, profile disappearance, and highest-meaningful-tier disappearance as objective evidence.
- Preserve RB/WR depth and QB/TE onesie interpretation through generic profile rules rather than hardcoded position preferences.
- Keep candidate analysis pure, roster-agnostic, derived, unpersisted, and disconnected from scoring and UI.

### Non-Goals

- Do not create a new board forecast for each candidate.
- Do not add or integrate `draft_pocket_timing`, timing deltas, overall-tier scoring, or legacy ADP scoring; Task 8 owns scoring.
- Do not add recommendation reasons or UI presentation.
- Do not read user roster, lineup needs, bench needs, strategy, or subjective position preferences.
- Do not treat exact-player removal, raw ADP, the ADP fallback, removal-window membership, or diversity labels as replacement or urgency evidence.
- Do not infer position tiers or use the legacy position-local `tier`.
- Do not change Task 5 forecast ordering or Task 6 pocket construction.
- Do not change recommendation, persistence, scenario, replay, or Draft Room behavior.

## Implementation Decisions

- Extend `src/types/draft.ts` with:
  - `DraftPocketSignalLevel = "high" | "medium" | "low" | "neutral"`;
  - readonly `CandidatePocketSignal`.
- Define `CandidatePocketSignal` with:

  ```text
  candidatePlayerId
  candidatePosition
  candidateInCurrentPocket
  candidateInForecastedPocket
  comparableReplacementCount
  nearReplacementCount
  replacementQuality
  skipSafety
  currentProfileCount
  forecastedProfileCount
  profileDisappeared
  highestMeaningfulTierDisappeared
  ```

- Do not add `timingDelta` in this slice. Task 8 converts the categorical signal into score.
- Export one pure `createCandidatePocketSignal` function from `src/lib/draftPocketForecast.ts`.
- The function should accept:
  - one normalized `RecommendationRankingFact` candidate;
  - the already-created shared `DraftPocketForecast`;
  - the same complete normalized `RecommendationRankingFact[]` context used to build the forecast.
- Resolve current and forecasted pocket player IDs through a local player-ID map over the supplied normalized context. Do not query persistence or rebuild the board forecast.
- Active candidate analysis requires:
  - `forecast.status === "active"`;
  - a non-null `forecast.forecastedPocket`;
  - candidate membership in `forecast.currentPocket.playerIds`.
- Return neutral replacement quality and skip safety when any active requirement is absent.
- Neutral output preserves objective current-pocket membership and its current profile count when available, but returns:
  - zero replacement counts;
  - false forecast membership;
  - zero forecast profile count;
  - false disappearance flags.
- Exclude the candidate itself from comparable and near-replacement counts.
- A forecasted-pocket player is eligible for replacement classification only when:
  - it has the same position as the candidate; and
  - its absolute overall-rank distance from the candidate is 12 or fewer.
- Classify an eligible replacement as **comparable** when:
  - both entries have meaningful source tiers and the replacement's overall tier is the same or better numerically; or
  - both entries have defaulted-neutral tiers, so position plus rank proximity is the only supported comparison.
- Classify an eligible source-tier replacement as **near** when its meaningful overall tier is worse numerically than the candidate's tier.
- The normalized context is expected to use one overall-tier origin consistently. If candidate and replacement origins differ, do not invent cross-origin comparability; stop and report the invariant conflict during implementation.
- Replacement quality is exact:

  ```text
  high:
    at least two total replacements
    and at least one comparable replacement

  medium:
    at least one replacement
    but the high threshold is not met

  low:
    no comparable or near replacements

  neutral:
    forecast inactive or candidate outside current pocket
  ```

- Skip safety is exact:

  ```text
  high:
    replacement quality is high

  medium:
    replacement quality is medium
    or the candidate itself remains in the forecasted pocket

  low:
    replacement quality is low
    and the candidate is absent from the forecasted pocket

  neutral:
    replacement quality is neutral
  ```

- Candidate profile counts are separate from replacement counts:
  - for a source-tier candidate, profile members share the candidate's position, source origin, and exact overall tier;
  - for a defaulted-neutral candidate, profile members share the candidate's position and fall within the same inclusive 12-rank window;
  - the current profile count may include the candidate itself;
  - the forecasted profile count may include the candidate when it remains.
- `profileDisappeared` is true only when the active current profile count is greater than zero and the forecasted profile count is zero.
- `highestMeaningfulTierDisappeared` is true only when:
  - the candidate has a source tier;
  - the candidate's overall tier equals the current pocket's highest meaningful tier; and
  - no source-tier player of that overall tier remains anywhere in the forecasted pocket.
- Analyze DST and K objectively when they are current-pocket candidates. Task 8, not this slice, owns their scoring ineligibility.
- RB/WR, QB/TE, and every other position use the same classification algorithm. Position-specific strategy emerges from replacement evidence rather than position-specific weights.
- Keep diversity labels entirely out of candidate analysis.

## Implementation Steps

1. Add candidate signal types.

   In `src/types/draft.ts`:

   - add the four-level signal union;
   - add the readonly candidate signal with exact membership, count, category, and transition fields;
   - do not add score or reason fields.

2. Implement candidate pocket analysis.

   In `src/lib/draftPocketForecast.ts`:

   - export `createCandidatePocketSignal`;
   - resolve pocket IDs through the supplied normalized ranking context;
   - implement neutral eligibility before forecast comparison;
   - classify same-position candidates with the inclusive 12-rank window;
   - count comparable and near replacements while excluding the candidate itself;
   - derive replacement quality and skip safety through the approved thresholds;
   - derive source-tier or neutral profile counts and disappearance evidence;
   - derive highest-meaningful-tier disappearance without position-tier inference;
   - avoid mutation, forecast reconstruction, roster inputs, scoring, and diversity-label reads.

3. Extend focused tests.

   In `src/lib/draftPocketForecast.test.ts`:

   - add a small active-forecast fixture helper that reuses `createDraftPocket` for supplied current and forecasted ranking sets;
   - test comparable replacements in the same and better source tiers;
   - test near replacements in worse source tiers;
   - assert the 12-rank boundary is included and 13 ranks is excluded;
   - test high, medium, low, and neutral replacement quality;
   - test high, medium, low, and neutral skip safety;
   - assert candidate presence upgrades otherwise-low skip safety to medium without counting the candidate as its own replacement;
   - test defaulted-neutral comparability through position and rank proximity only;
   - test source-tier profile counts, profile disappearance, and highest-meaningful-tier disappearance;
   - assert neutral forecasts and candidates outside the current pocket produce neutral categories and no false transition evidence;
   - cover deep-WR, disappearing-RB, both-deep, and both-thin scenarios without hardcoded position preference;
   - cover QB/TE profile loss and prove that changing an `onesie-heavy` label alone cannot change candidate output;
   - assert DST/K can be described objectively without adding score eligibility;
   - retain all Task 5 and Task 6 forecast, pocket, count, label, immutability, and determinism tests.

4. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/draftPocketForecast.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because candidate analysis remains disconnected from recommendation generation and UI behavior.

5. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Mark Task 7 complete in `docs/tasks.md`.
   - Stop without beginning Task 8 scoring integration.

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

- One pure candidate-analysis function interprets the existing shared forecast without rebuilding or mutating it.
- Only active current-pocket candidates receive non-neutral replacement and skip-safety categories.
- Replacement eligibility requires same position and an absolute rank distance of 12 or fewer.
- Comparable, near, and excluded replacements follow the approved overall-tier-origin and tier-quality rules.
- Replacement quality exactly matches the approved count thresholds.
- Skip safety exactly combines replacement quality with candidate forecasted-pocket presence.
- The candidate is never counted as its own replacement.
- Source-tier and defaulted-neutral profile counts use their distinct approved semantics.
- Profile and highest-meaningful-tier disappearance flags are based on pocket transitions, not exact-player ADP removal.
- Deep WR profiles are high-safety, disappearing RB profiles are low-safety, and both-deep or both-thin cases remain free of hardcoded position preference.
- QB/TE results respond only to candidate-specific profile evidence; `onesie-heavy` alone has no effect.
- Neutral forecasts and candidates outside the current pocket produce no false replacement or transition evidence.
- Existing Task 5 and Task 6 behavior and tests remain unchanged.
- No recommendation score, ordering, cap, adjustment, reason, UI, persistence, scenario, or replay behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If pocket player IDs cannot be resolved from the supplied normalized context, stop and report the input-boundary mismatch rather than silently dropping players.
- If a supported normalized context mixes source and defaulted-neutral tier origins, stop and report before inventing cross-origin replacement semantics.
- If candidate analysis requires rebuilding the board forecast or consulting ADP/removal-window membership, stop and report the architecture conflict.
- If RB/WR or QB/TE behavior cannot be expressed through the shared generic classification rules, report the domain gap rather than adding position-specific weights.
- If adding the signal requires scoring, reason, roster, UI, or persistence changes, stop before broadening the slice.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 8: integrate overall-tier and `draft_pocket_timing` scoring while replacing the superseded direct ADP score. Do not begin Task 8 automatically.

## Slice Review

- Smallest meaningful increment: yes. It adds candidate-specific interpretation of one shared forecast without scoring or integration.
- Executable by a lower-reasoning pass: yes. Types, inputs, eligibility, tier rules, thresholds, evidence, files, and exact tests are defined.
- Avoids unnecessary architecture changes: yes. It extends the existing pure forecast module and typed recommendation-domain values.
- Blast radius reasonable: yes. Production changes remain within one type file and one forecast module, with one focused test file and planning records.
- Review/revert comfort: yes. Candidate analysis remains uncalled by recommendation generation and has no user-visible effect.
- Observable/testable acceptance criteria: yes. Every eligibility, boundary, category, profile transition, positional scenario, and regression constraint has direct coverage.
