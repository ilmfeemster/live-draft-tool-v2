# Current Slice: Define the Scenario V1 Contract

## Source Context

Phase 4 Task 1: Define the Scenario V1 Contract.

Phase 4 begins with a portable scenario contract that later tasks can validate, replay, import, and export. This slice defines only the trusted typed shape and deterministic serialization boundary. It does not accept untrusted data or create draft state.

The existing `LeagueSettings`, `RankingEntry`, and `Team` domain types already represent the settings, embedded ranking snapshot, and team order required by the design. Existing league-settings and ranking-snapshot serializers already provide fresh JSON-safe copies and should be reused rather than duplicated.

## Goal

Add a typed, versioned, self-contained `DraftScenarioV1` contract and deterministic JSON serializer that preserve all source inputs needed for future replay while excluding derived draft and recommendation state.

## Scope

### Goals

- Add one explicit scenario schema-version constant with value `1`.
- Define typed scenario metadata with required ID and name, optional description and tags, and optional informational provenance.
- Define provenance for manual, persisted, and scenario sources with an optional source ID and export timestamp.
- Define draft configuration using ordered existing `Team` values while keeping draft type, team count, rounds, scoring, and roster slots in existing `LeagueSettings`.
- Embed the complete `RankingEntry[]` snapshot under ranking context.
- Identify the user team separately from draft configuration.
- Define ordered scenario picks with required player ID and optional expected pick-number and team assertions.
- Define replay target as `appliedPickCount`.
- Add deterministic serialization for an already-valid typed scenario.
- Preserve array order for teams, rankings, roster slots, tags, and pick history because those orders are either meaningful or supplied contract data.
- Add focused tests for deterministic serialization, dynamic settings, provenance isolation, and exclusion of derived state.

### Non-Goals

- Parsing or validating unknown JSON.
- Enforcing file-size, ranking-count, pick-count, tag-count, cross-reference, or replay-target limits.
- Checking duplicate players, team consistency, pick order, or scenario versions at runtime.
- Replaying picks or creating Draft State Engine state.
- Adding scenario import, export-download, curated-library, simulator, or debugger UI.
- Reading from or writing to Prisma, repositories, server actions, React state, or browser APIs.
- Persisting scenarios or recommendation output.
- Adding Phase 5 ranking management or a Phase 7 Draft Source/provider interface.
- Modifying existing draft, recommendation, hydration, or persistence behavior.
- Adding package dependencies.

## Contract Shape

Create the scenario types in `src/types/scenario.ts` using this domain-facing shape:

```ts
export const DRAFT_SCENARIO_SCHEMA_VERSION = 1 as const;

export type DraftScenarioSourceKind = "manual" | "persisted" | "scenario";

export type DraftScenarioProvenance = {
  sourceKind: DraftScenarioSourceKind;
  sourceId?: string;
  exportedAt: string;
};

export type DraftScenarioMetadata = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  provenance?: DraftScenarioProvenance;
};

export type DraftScenarioPick = {
  playerId: string;
  expectedPickNumber?: number;
  expectedTeamId?: string;
};

export type DraftScenarioV1 = {
  schemaVersion: typeof DRAFT_SCENARIO_SCHEMA_VERSION;
  metadata: DraftScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: {
    teams: Team[];
  };
  rankingContext: {
    rankings: RankingEntry[];
  };
  userTeamContext: {
    userTeamId: string;
  };
  pickHistory: DraftScenarioPick[];
  replayTarget: {
    appliedPickCount: number;
  };
};
```

The exact exported type declarations may be split into named subtypes for readability, but their meaning must not change. Do not add alternate ranking-source variants, provider identifiers, database IDs as required state, derived rosters, available-player lists, current-pick fields, completion flags, or recommendation fields.

## Serialization Boundary

Add `serializeDraftScenario` in `src/lib/scenario.ts`.

The serializer should:

1. Accept only a typed `DraftScenarioV1`; it must not accept or validate `unknown`.
2. Build a fresh canonical JSON-safe object in the contract's declared field order.
3. Reuse `serializeLeagueSettingsSnapshot` for league settings.
4. Reuse `serializeRankingSnapshot` for ranking entries.
5. Copy nested metadata, provenance, teams, tags, picks, and optional assertion fields rather than retaining input object or array references.
6. Preserve caller-supplied array order; do not sort teams, rankings, tags, roster slots, or pick history.
7. Omit optional properties when they are `undefined`.
8. Return a two-space-indented JSON string with one trailing newline.
9. Produce identical text for repeated serialization of the same typed input.

This function serializes trusted data only. `JSON.parse`, unknown-input parsing, schema-version rejection, semantic validation, and safety limits belong to Task 2.

## Implementation Steps

1. Add `src/types/scenario.ts` with the schema constant and portable scenario types shown above, importing only existing domain types from `src/types/draft.ts`.
2. Add `src/lib/scenario.ts` with the trusted deterministic serializer, reusing the existing league-settings and ranking-snapshot serializers.
3. Add `src/lib/scenario.test.ts` with representative typed fixtures and exact behavior assertions.
4. Run the focused test, lint, and TypeScript validation commands.
5. If all acceptance criteria and validation pass, check only Phase 4 Task 1 complete in `docs/tasks.md`. Do not begin Task 2.

## Expected Files

- `src/types/scenario.ts`
- `src/lib/scenario.ts`
- `src/lib/scenario.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 1 complete after validation passes

Do not modify existing production or test files unless a direct compile issue proves that the approved contract cannot reuse the documented types. If that occurs, stop and report the conflict instead of broadening the slice.

## Test Cases

The focused test file should prove:

1. Repeated serialization of the same scenario produces exactly identical text.
2. Serialized JSON contains schema version, metadata, settings, team order, embedded rankings, user-team identity, ordered picks, optional assertions, and replay target.
3. A non-default fixture, such as 3 teams and 4 rounds with a custom roster-slot list, serializes without default 12-team assumptions.
4. League settings and ranking entries retain all existing domain fields through serialization.
5. Optional description, tags, provenance, source ID, and pick assertions are omitted when undefined.
6. Adding or changing provenance changes only metadata/provenance in the parsed serialized document; all replay-relevant fields remain equal.
7. The serialized document does not contain authoritative rosters, available rankings, current pick, completion status, recommendations, or persistence records.
8. Team, ranking, roster-slot, tag, and pick-history order remain unchanged.
9. The output uses two-space indentation and ends with exactly one newline.

Tests may use `JSON.parse` only to inspect output from the trusted serializer. Do not introduce an exported scenario parser in this slice.

## Automated Validation

Run from the repository root in this order:

```txt
npm test -- src/lib/scenario.test.ts
npm run lint
npx tsc --noEmit
```

Expected result:

- The focused scenario serializer tests pass.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- Existing files require no behavior changes.

## Acceptance Criteria

- `DraftScenarioV1` has one explicit schema version equal to `1`.
- The contract contains metadata, optional informational provenance, dynamic league settings, ordered team configuration, embedded rankings, user-team context, ordered pick history, and `appliedPickCount`.
- Pick assertions are optional data and are not implemented as draft commands.
- The contract contains no authoritative derived draft state or recommendation output.
- The serializer accepts typed trusted input and performs no parsing or validation.
- Repeated serialization of identical input produces identical JSON text.
- Serialization creates canonical fresh JSON data while preserving meaningful array order.
- Existing league-settings and ranking-snapshot serializers are reused.
- A non-default league fixture serializes successfully.
- Provenance cannot change replay-relevant serialized fields.
- Focused tests, lint, and TypeScript validation pass.
- No package dependency is added.
- Only Phase 4 Task 1 is checked complete after validation passes.
- Task 2 is not started.

## Failure Handling

- If the existing domain types cannot represent an approved scenario field without conflicting duplicate truth, stop and report the conflict.
- If reusing an existing snapshot serializer changes or loses required domain data, stop and report the discrepancy instead of duplicating the serializer silently.
- If lint, TypeScript, or existing tests expose an unrelated failure, report it and do not expand this slice to fix unrelated code.
- Do not add runtime validation merely to satisfy a test; validation is the next task.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 2: Add Scenario Parsing and Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It establishes the portable contract and trusted serialization boundary required by every later Phase 4 scenario feature.
- Concrete enough for implementation: yes. The type shape, serializer behavior, tests, commands, exclusions, and completion update are explicit.
- Avoids unnecessary architecture changes: yes. It reuses current domain types and snapshot serializers without adding state, persistence, providers, or UI.
- Blast radius reasonable: yes. Three code files are expected, plus the Task 1 checkbox after successful validation.
- Review/revert comfort: yes. The slice is additive and has no runtime consumers yet.
- Observable/testable acceptance criteria: yes. Exact serialized output properties, deterministic text, dynamic settings, provenance isolation, excluded fields, and validation commands are directly checkable.
