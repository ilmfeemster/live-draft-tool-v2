# Current Slice: Add Scenario Parsing and Validation

## Source Context

Phase 4 Task 5: Add Scenario Parsing and Validation.

Tasks 1 through 4 are complete. The project now has a typed `ScenarioV1` contract and deterministic serializer for trusted values. This slice adds the untrusted JSON boundary that normalizes supported v1 data, enforces fixed Phase 4 safety limits, and rejects structural or internally inconsistent scenarios before they can reach replay.

The Phase 4 design describes semantic replay as the final validation layer, but the ordered task plan assigns pick application to Task 6 and explicitly makes it a non-goal here. This slice may compare optional assertions with the generated draft order; it must not apply selections through `draftPlayerInDraft`, create candidate draft state, or compute recommendations.

## Goal

Add one pure, structured parser/validator for untrusted scenario JSON that returns a normalized `ScenarioV1` only when its version, structure, safety limits, league configuration, identities, references, assertions, history, and replay target are valid.

## Scope

### Goals

- Check the 1 MiB UTF-8 limit before calling `JSON.parse`.
- Parse untrusted JSON without throwing errors to callers.
- Accept exactly schema version `1`.
- Normalize the document into the existing `ScenarioV1` contract rather than returning the original object.
- Validate all required scenario sections, required primitive fields, optional metadata, optional provenance, and optional pick assertions.
- Reuse the existing league-settings and ranking snapshot parsers for domain-shaped nested data.
- Reuse `buildLeagueSetup` to enforce supported league bounds, canonical generated roster settings, and ranking capacity.
- Enforce fixed limits for rankings, configured draft capacity, pick history, and metadata tags.
- Validate canonical generated teams, unique identities, user-team membership, ranking references, duplicate selections, and expected pick/team assertions.
- Return stable structured errors with a code, field path, and developer-readable message.
- Keep parsing and validation pure and side-effect free.

### Non-Goals

- Applying any pick through the Draft State Engine.
- Determining whether the full pick sequence is semantically accepted by draft transitions.
- Capturing zero, intermediate, or completed candidate draft states.
- Computing recommendations.
- Import/export UI, file selection, downloads, or clipboard behavior.
- Installing a parsed scenario into active React state.
- Creating, updating, or deleting persisted drafts.
- Scenario migration or support for versions other than `1`.
- Configurable safety limits or streaming/large-file parsing.
- Ranking management, arbitrary ranking formats, or external provider IDs.
- Adding package dependencies.
- Beginning Phase 4 Task 6.

## Public Validation Boundary

Add `src/lib/scenarioValidation.ts` with this public API:

```ts
export const SCENARIO_VALIDATION_LIMITS = {
  maxJsonBytes: 1024 * 1024,
  maxRankings: 1000,
  maxDraftPicks: 1000,
  maxMetadataTags: 50,
} as const;

export type ScenarioValidationErrorCode =
  | "invalid-json"
  | "invalid-type"
  | "missing-field"
  | "unsupported-version"
  | "limit-exceeded"
  | "invalid-value"
  | "duplicate-identity"
  | "invalid-reference"
  | "inconsistent-configuration";

export type ScenarioValidationError = {
  code: ScenarioValidationErrorCode;
  path: string;
  message: string;
};

export type ParseScenarioV1Result =
  | { ok: true; scenario: ScenarioV1 }
  | { ok: false; errors: ScenarioValidationError[] };

export function parseScenarioV1Json(json: string): ParseScenarioV1Result;
```

`parseScenarioV1Json` is the only public entry point required by this slice. Keep parsing helpers private. Callers should never need a thrown exception to handle invalid input.

## Validation Order

Use the following layers so failures remain predictable and later checks do not operate on malformed values.

### 1. Raw JSON Boundary

1. Measure the input's UTF-8 byte length with `TextEncoder`, not JavaScript character count.
2. Reject input larger than `SCENARIO_VALIDATION_LIMITS.maxJsonBytes` before `JSON.parse`.
3. Parse with `JSON.parse` inside `try/catch`.
4. Return an `invalid-json` error at path `$` for malformed text.
5. Require the root value to be a non-null, non-array object.

The exact JSON parser exception text must not be exposed in returned messages.

### 2. Scenario-Owned Structure

Normalize these values into fresh objects and arrays:

- `schemaVersion`: required integer and exactly `SCENARIO_SCHEMA_VERSION`.
- `metadata.id` and `metadata.name`: required non-empty strings.
- `metadata.description`: optional string.
- `metadata.tags`: optional array of strings, limited to 50 entries.
- `metadata.provenance.sourceKind`: one of `manual`, `persisted`, or `scenario`.
- `metadata.provenance.sourceId`: optional non-empty string.
- `metadata.provenance.exportedAt`: required non-empty string when provenance exists and parseable as an ISO-style timestamp with `Date.parse`.
- `draftConfiguration.teams`: required array of objects containing non-empty `id`, non-empty `name`, and integer `draftPosition`.
- `userTeamContext.userTeamId`: required non-empty string.
- `pickHistory`: required array.
- Each pick's `playerId`: required non-empty string.
- `expectedPickNumber`: optional positive integer.
- `expectedTeamId`: optional non-empty string.
- `replayTarget.appliedPickCount`: required non-negative integer.

Missing required fields use `missing-field`; wrong primitive or collection shapes use `invalid-type`; values with the right primitive type but invalid content use `invalid-value`.

Unknown properties need not cause failure. The returned `ScenarioV1` must be reconstructed from approved fields only, so unknown or derived fields cannot become authoritative state.

If a required section is malformed, report that section and avoid cascaded cross-reference errors that depend on it. It is acceptable to return one or multiple safely detectable errors, but error ordering must be deterministic and follow document order.

### 3. Existing Domain-Shaped Parsing

- Parse `leagueSettings` with `parseLeagueSettingsSnapshotJson`.
- Parse `rankingContext.rankings` with `parseRankingSnapshotJson`.
- Catch their errors and convert them into structured validation errors; do not allow their exceptions to escape.
- Preserve their normalized outputs in the returned scenario.
- Do not expose stack traces or implementation details.

The existing parsers validate the nested domain fields and create fresh objects. This slice may translate their current field-oriented messages, but it must not change persistence snapshot behavior.

### 4. Fixed Safety Limits

After the relevant arrays and settings are structurally available, reject:

- More than 1,000 ranking entries.
- More than 1,000 pick-history entries.
- More than 50 metadata tags.
- A configured capacity greater than 1,000 picks.

Configured capacity is `leagueSettings.teamCount * leagueSettings.rounds`. Limits are fixed constants and use `limit-exceeded` errors at the closest relevant path.

The checks must remain independent: a ranking array under 1,000 may still be too small for the configured draft, and a pick history under 1,000 may still exceed its configured capacity.

## League and Team Consistency

Use existing rules rather than creating a second supported-settings model:

1. Convert the parsed generated roster slots back into counts for the eight supported labels: `QB`, `RB`, `WR`, `TE`, `FLEX`, `DST`, `K`, and `BENCH`.
2. Reject an unknown slot label before calling the builder.
3. Identify the configured user team and use its `draftPosition` as `userDraftPosition` for builder input.
4. Call `buildLeagueSetup` with parsed team count, draft type, scoring format, derived roster counts, user draft position, and the parsed ranking count.
5. Convert builder failures into scenario errors at the corresponding scenario paths.
6. Require the builder's generated `LeagueSettings` to equal the parsed settings exactly, including rounds, roster-slot order, IDs, labels, and eligible-position order.
7. Require `draftConfiguration.teams` to equal `createDraftTeams(teamCount)` in order and content.
8. Require the builder's derived user-team ID to equal `userTeamContext.userTeamId`.

This enforces Task 1's supported bounds, non-BENCH starter requirement, canonical roster construction, supported `SNAKE`/`PPR` values, and ranking capacity without exporting new setup helpers or duplicating slot definitions.

Also report duplicate team IDs or duplicate draft positions explicitly before or alongside the canonical-team comparison.

## Ranking and Pick Consistency

After structural parsing succeeds:

- Require at least one ranking entry.
- Require every ranking player ID to be non-empty and unique.
- Preserve ranking order; do not sort or deduplicate it.
- Require pick history length to be no greater than configured capacity.
- Require every pick player ID to exist in the ranking context.
- Reject a player selected more than once.
- Generate the canonical draft order with `generateSnakeDraftOrder(teamCount, rounds)`.
- For pick-history index `i`, treat the generated pick at index `i` as the assertion target.
- If `expectedPickNumber` is present, require it to equal the generated pick number.
- If `expectedTeamId` is present, require it to equal the generated team ID.
- Include the failing pick index in error paths such as `pickHistory[3].expectedTeamId`.

Generating draft order for assertion comparison does not apply a player or validate draft transitions. Do not call `draftPlayerInDraft` in this slice.

## Replay Target Rules

- `appliedPickCount` must be between `0` and `pickHistory.length`, inclusive.
- It must also be no greater than configured capacity.
- Zero is valid for empty or non-empty history.
- An intermediate target may be smaller than history length.
- A completed target is represented only by `appliedPickCount === configured capacity`; the history must contain that many picks because of the history-bound rule.
- Do not infer completion merely because the target equals a shorter history length.
- Validate the full supplied history structurally and by cross-reference even when the target is intermediate.

Task 6 remains responsible for applying the entire history, rejecting no-op transitions, and returning a target state only after semantic replay succeeds.

## Error Mapping

Use scenario paths, not form paths or persistence terminology. At minimum:

- League setup `teamCount` -> `leagueSettings.teamCount`.
- `draftType` -> `leagueSettings.draftType`.
- `scoringFormat` -> `leagueSettings.scoringFormat`.
- `rosterSlotCounts` or category errors -> `leagueSettings.rosterSlots`.
- `rankingPlayerCount` -> `rankingContext.rankings`.
- User draft-position errors -> `userTeamContext.userTeamId` or `draftConfiguration.teams` according to the actual cause.

Messages should state the failed rule and relevant limit or identity. Do not include raw JSON excerpts, stack traces, database details, or the native `JSON.parse` message.

## Testing Strategy

Add `src/lib/scenarioValidation.test.ts`. Build valid inputs as typed `ScenarioV1` fixtures, serialize them with `serializeScenarioV1`, then mutate plain parsed objects for invalid untrusted-input cases. Keep fixtures small and dynamic.

### Required Test Cases

1. A valid v1 scenario returns a normalized `ScenarioV1` equal in value but not nested object identity to the source object.
2. A valid non-default league configuration passes.
3. Malformed JSON, non-object roots, missing sections, wrong field types, missing version, and unsupported version fail with stable structured errors.
4. Optional metadata and provenance accept valid values and reject invalid source kinds, tag entries, source IDs, and timestamps.
5. The UTF-8 byte limit is enforced before parsing, including a multibyte input case.
6. Ranking, pick-history, configured-capacity, and metadata-tag limits pass at the boundary and fail one above it.
7. Missing ranking context, empty rankings, duplicate ranking player IDs, and insufficient ranking capacity fail.
8. Unsupported or non-canonical league settings fail, including team-count bounds, round mismatch, roster-slot mismatch, bench-only configuration, unsupported slot label, slot order/ID/eligibility drift, draft type, and scoring format.
9. Missing, duplicate, reordered, renamed, or otherwise inconsistent teams fail against canonical generated teams.
10. A missing or unknown user-team ID fails.
11. Unknown pick references, duplicate drafted players, history beyond capacity, and history beyond 1,000 fail.
12. Valid optional expected assertions pass; wrong, out-of-range, or incorrectly typed pick/team assertions fail at their indexed paths.
13. Replay targets accept zero, intermediate, and completed counts and reject negative, fractional, history-exceeding, and capacity-exceeding values.
14. Extra derived-state properties are discarded and absent from the normalized result.
15. Repeated parsing returns deterministic error ordering and does not mutate external state.

For limit tests, generate data programmatically in the test file. Do not add large checked-in JSON fixtures.

## Implementation Steps

1. Add `src/lib/scenarioValidation.ts` with constants, result/error types, raw JSON handling, structural normalization, domain-parser adapters, fixed limits, and cross-reference validation.
2. Reuse `buildLeagueSetup`, `createDraftTeams`, and `generateSnakeDraftOrder` for canonical configuration and assertion checks without changing those modules.
3. Add `src/lib/scenarioValidation.test.ts` with valid, malformed, boundary, configuration, identity, reference, assertion, normalization, and replay-target coverage.
4. Run the focused tests, full suite, lint, and TypeScript validation.
5. If all acceptance criteria and validation pass, check only Phase 4 Task 5 complete in `docs/tasks.md`. Do not begin Task 6.

## Expected Files

- `src/lib/scenarioValidation.ts`
- `src/lib/scenarioValidation.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 5 complete after validation passes

Do not modify the Scenario V1 contract, serializer, existing snapshot parsers, league builder, draft-order functions, Draft State Engine, Recommendation Engine, persistence, actions, or UI unless an approved interface proves impossible to consume. If that occurs, stop and report the exact conflict rather than broadening the slice.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/scenarioValidation.test.ts src/lib/scenarioSerialization.test.ts src/lib/leagueSetup.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused validation, serialization, and league-setup tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because this slice is a pure parsing boundary with no runtime integration. A short review of representative structured errors in tests is sufficient.

## Acceptance Criteria

- Valid scenario v1 JSON returns a normalized typed `ScenarioV1`.
- Malformed JSON, malformed roots, missing required data, and unsupported versions fail without throwing to the caller.
- Errors have deterministic codes, scenario paths, and useful messages without implementation leakage.
- The 1 MiB JSON, 1,000 ranking, 1,000 configured-pick, 1,000 history-pick, and 50-tag limits are enforced at their documented boundaries.
- Valid dynamic league settings pass without 12-team or 16-round assumptions.
- Unsupported or non-canonical settings, insufficient ranking capacity, and inconsistent generated teams fail.
- Ranking player IDs and team identities are unique where required.
- User-team and pick player references resolve within the scenario.
- Duplicate drafted players and history beyond configured capacity fail.
- Optional expected pick-number and team assertions match generated draft order or fail at the indexed field.
- Replay targets support zero, intermediate, and completed counts and remain within history and capacity.
- Unknown or derived-state properties do not enter the normalized result.
- Parsing and validation have no effects on active state, persistence, Draft State, or recommendations.
- No pick is semantically applied in this slice.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- No package dependency or unrelated architecture change is introduced.
- Only Phase 4 Task 5 is checked complete after implementation validation.
- Task 6 is not started.

## Failure Handling

- If the existing domain parsers reject a supported serialized Scenario V1 value, stop and report the exact type or shape mismatch.
- If `buildLeagueSetup` cannot validate generated settings without duplicating its rules, stop and report the missing reusable boundary rather than exporting private builder internals casually.
- If a malformed section prevents safe dependent checks, return the structural error and skip those checks instead of manufacturing cascaded failures.
- If assertion validation would require applying picks, defer that part to Task 6 and report the boundary conflict; do not call the Draft State Engine here.
- If automated validation exposes an unrelated failure, report it without expanding the slice.
- Do not weaken existing snapshot, setup, serialization, draft, persistence, or recommendation tests.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 6: Add Deterministic Replay Infrastructure. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It creates the safe typed boundary required before any scenario can reach replay, without applying state.
- Concrete enough for implementation: yes. The API, validation order, reuse points, limits, field mappings, consistency rules, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. It is one pure module over existing types, parsers, setup rules, and draft-order generation.
- Blast radius reasonable: yes. Two code/test files are expected, plus the Task 5 checkbox after successful validation.
- Review/revert comfort: yes. The work is additive, deterministic, and has no persistence or UI integration.
- Observable/testable acceptance criteria: yes. Every accepted shape, rejection category, boundary, identity rule, reference rule, assertion, and normalization behavior is covered through pure tests.
