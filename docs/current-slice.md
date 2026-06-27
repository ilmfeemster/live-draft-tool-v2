# Current Slice: Define the Scenario V1 Contract

## Source Context

Phase 4 Task 4: Define the Scenario V1 Contract.

Tasks 1 through 3 are complete. Supported league configurations can now be built, persisted, created through the Draft Room, and resumed. This slice establishes the small public scenario format that the later parser, replay coordinator, importer, exporter, and curated library will share.

The scenario is a portable recipe for reconstruction. It carries domain inputs and ordered player selections, not a saved final draft state. Validation of untrusted data and semantic replay belong to Tasks 5 and 6.

## Goal

Add a typed, versioned, self-contained scenario v1 contract and a deterministic serializer for already-valid typed scenarios, with no parsing, replay, persistence, or UI behavior.

## Scope

### Goals

- Define one explicit supported schema version: numeric version `1`.
- Keep scenario types isolated from persistence records and React state.
- Reuse `LeagueSettings`, `Team`, and `RankingEntry` where their domain meaning already matches.
- Represent required scenario metadata and optional informational provenance.
- Carry generated league settings, ordered team identities, an embedded ranking snapshot, and user-team identity.
- Represent ordered player selections with optional expected-pick and expected-team assertions.
- Represent the replay target as an applied-pick count with unambiguous zero, intermediate, and completed semantics.
- Serialize an already-valid `ScenarioV1` into stable, human-readable JSON with a fixed property order.
- Preserve semantic array order for roster slots, teams, rankings, tags, and pick history.
- Prove the contract represents supported non-default league settings without 12-team or 16-round assumptions.
- Prove metadata and provenance are informational and do not enter the domain-input sections of the document.

### Non-Goals

- Parsing or validating unknown JSON.
- Enforcing schema, metadata, ranking, team, pick, target, or safety-limit rules at runtime.
- Replaying picks or calling the Draft State Engine or Recommendation Engine.
- Import/export UI, file APIs, clipboard behavior, or downloads.
- Mapping an active manual, persisted, or transient workspace into a scenario.
- Curated scenarios or scenario-session state.
- Persisting scenarios or changing Prisma.
- Adding a generic Draft Source, provider event, or migration abstraction.
- Adding package dependencies.
- Beginning Phase 4 Task 5.

## Public Contract

Add `src/types/scenario.ts` with the following public concepts. Local names may vary only when TypeScript requires a narrow adjustment; do not change the shape without reporting the conflict.

```ts
export const SCENARIO_SCHEMA_VERSION = 1 as const;

export type ScenarioSchemaVersion = typeof SCENARIO_SCHEMA_VERSION;

export type ScenarioSourceKind = "manual" | "persisted" | "scenario";

export type ScenarioProvenance = {
  sourceKind: ScenarioSourceKind;
  sourceId?: string;
  exportedAt: string;
};

export type ScenarioMetadata = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  provenance?: ScenarioProvenance;
};

export type ScenarioDraftConfiguration = {
  teams: Team[];
};

export type ScenarioRankingContext = {
  rankings: RankingEntry[];
};

export type ScenarioUserTeamContext = {
  userTeamId: string;
};

export type ScenarioPick = {
  playerId: string;
  expectedPickNumber?: number;
  expectedTeamId?: string;
};

export type ScenarioReplayTarget = {
  appliedPickCount: number;
};

export type ScenarioV1 = {
  schemaVersion: ScenarioSchemaVersion;
  metadata: ScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: ScenarioDraftConfiguration;
  rankingContext: ScenarioRankingContext;
  userTeamContext: ScenarioUserTeamContext;
  pickHistory: ScenarioPick[];
  replayTarget: ScenarioReplayTarget;
};
```

Import `LeagueSettings`, `RankingEntry`, and `Team` from `src/types/draft.ts`; do not duplicate them.

### Field Semantics

- `metadata.id` identifies the portable scenario. It is not a persisted draft ID.
- `metadata.name` is the required display name. Description and tags are optional descriptive data.
- `provenance` records how an export was produced. It never authorizes a lookup or changes reconstruction.
- `provenance.exportedAt` is an ISO timestamp string by contract; runtime format validation is deferred to Task 5.
- `leagueSettings` is the generated domain configuration, not `LeagueSetupInput` or form counts.
- `leagueSettings.draftType` is the sole draft-type field. Do not duplicate it under `draftConfiguration`.
- `draftConfiguration.teams` is ordered by draft position and carries domain team identities. Task 5 will validate consistency with settings and generated order.
- `rankingContext.rankings` embeds the complete recommendation ranking input required by the scenario.
- `userTeamContext.userTeamId` must refer to a configured team; Task 5 enforces that relationship.
- `pickHistory` array order is authoritative selection order. `playerId` is the command input.
- `expectedPickNumber` and `expectedTeamId` are optional assertions only. They must never override engine results.
- `replayTarget.appliedPickCount` is a count, not a pick number: `0` means before all picks, an intermediate value applies that many leading history entries, and a completed value equals validated draft capacity.
- Pick history may extend beyond `appliedPickCount`; later replay must validate the full history before exposing the target state.

## Authoritative and Excluded Data

The scenario carries only inputs needed to reconstruct draft and recommendation state. Do not add authoritative copies of:

- Draft ID or database rows.
- Rosters or roster assignments.
- Available players.
- Current pick, active team, or completion flags.
- Recommendation totals, ordering, components, penalties, or reasons.
- Persistence snapshot JSON types.
- React state, selected UI state, filters, pending flags, or errors.

Those values remain derived by the existing engines or owned by their current boundaries.

## Deterministic Serialization Boundary

Add `src/lib/scenarioSerialization.ts` with one public function:

```ts
export function serializeScenarioV1(scenario: ScenarioV1): string;
```

The serializer should:

- Accept only an already-valid typed `ScenarioV1`; it must not parse or validate unknown input.
- Construct a fresh plain JSON-compatible document explicitly in the public contract order.
- Emit nested metadata, provenance, league settings, roster slots, teams, rankings, players, picks, and replay target in a fixed property order.
- Omit optional properties when their value is `undefined`.
- Preserve the supplied order of all arrays; do not sort semantic inputs.
- Reuse the existing league-settings and ranking snapshot serializers where practical, while keeping persistence-specific types out of the public scenario contract.
- Return `JSON.stringify(document, null, 2)` followed by one newline.
- Produce identical bytes for repeated serialization of the same typed value.
- Avoid mutating the input or retaining its nested references.

Determinism in this slice means identical typed input produces identical text. Canonical equivalence across differently ordered metadata tags or differently authored object instances is not required.

## Testing Strategy

Add `src/lib/scenarioSerialization.test.ts` using compact typed fixtures. Tests should exercise the public contract through the serializer rather than introduce a parser ahead of Task 5.

The focused tests should prove:

1. `SCENARIO_SCHEMA_VERSION` is `1` and a representative fixture is assignable to `ScenarioV1` under TypeScript validation.
2. Serialization emits the complete v1 source-input shape and parses back with `JSON.parse` to the expected plain object.
3. Repeated serialization of the same fixture is byte-for-byte identical and ends with one newline.
4. Serialization does not mutate the fixture and creates no authoritative derived-state fields.
5. Optional description, tags, provenance, source ID, and pick assertions are omitted when absent and emitted when present.
6. Changing or removing metadata/provenance changes only the serialized metadata section; league settings, draft configuration, ranking context, user-team context, pick history, and replay target remain equal.
7. A valid non-default configuration can be represented with dynamic team count, rounds, roster slots, team order, and user-team identity.
8. Replay targets for zero, intermediate, and completed counts can be represented without using inclusive pick-number semantics.
9. Pick-history and all other semantic array orders are preserved.

Do not add runtime rejection tests in this slice. Malformed, inconsistent, unsupported-version, duplicate, out-of-range, and oversized inputs belong to Task 5.

## Implementation Steps

1. Add `src/types/scenario.ts` with the schema-version constant and the public v1 contract exactly as defined above.
2. Add `src/lib/scenarioSerialization.ts` with explicit deterministic mapping and JSON text serialization for typed scenarios.
3. Add `src/lib/scenarioSerialization.test.ts` with default, optional-field, metadata-independence, replay-target, ordering, and non-default configuration coverage.
4. Run the focused test, full suite, lint, and TypeScript validation.
5. If all acceptance criteria and validation pass, check only Phase 4 Task 4 complete in `docs/tasks.md`. Do not begin Task 5.

## Expected Files

- `src/types/scenario.ts`
- `src/lib/scenarioSerialization.ts`
- `src/lib/scenarioSerialization.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 4 complete after validation passes

Do not modify existing draft types, snapshot parsers, engines, repository, Prisma, actions, or components unless the approved contract cannot be expressed with their exported types. If that occurs, stop and report the exact conflict rather than broadening the slice.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/scenarioSerialization.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused scenario serialization tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No database or browser manual QA is required because this slice adds only pure types and serialization. Review the emitted representative JSON in the focused test failure output or debugger if a shape assertion fails; do not add a checked-in generated artifact.

## Acceptance Criteria

- The public contract supports exactly schema version `1`.
- A scenario contains metadata, generated league settings, ordered team configuration, embedded rankings, user-team identity, ordered pick history, and an applied-pick-count replay target.
- Metadata and optional provenance are structurally separate from all reconstruction inputs.
- Player identity is the only required pick command; expected pick number and team ID are optional assertions.
- Replay target semantics are explicit for zero, intermediate, and completed counts.
- A supported non-default league is representable without fixed team-count, round-count, roster, or user-position assumptions.
- The contract contains no authoritative derived draft state, recommendation output, persistence records, or UI state.
- Serialization is byte-for-byte deterministic for identical typed input, human-readable, and newline-terminated.
- Serialization preserves semantic array order, omits absent optional fields, does not mutate input, and produces fresh JSON-compatible data.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- No package, persistence, engine, repository, action, or UI change is introduced.
- Only Phase 4 Task 4 is checked complete after implementation validation.
- Task 5 is not started.

## Failure Handling

- If an existing domain type cannot represent the documented contract without persistence or UI coupling, stop and report the specific mismatch.
- If reusing an existing snapshot serializer would leak a persistence type or prevent fixed scenario property order, map that nested domain value explicitly in the scenario serializer; do not alter persistence behavior.
- If deterministic output would require sorting a semantic array, preserve input order and report the ambiguity instead of changing scenario meaning.
- If automated validation exposes an unrelated failure, report it without expanding the slice.
- Do not add validation logic merely to reject an invalid test fixture; Task 5 owns untrusted-input validation.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 5: Add Scenario Parsing and Validation. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It defines the compatibility surface required by all later scenario work without pulling parsing or replay forward.
- Concrete enough for implementation: yes. The type shape, semantics, serializer output, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. It adds an isolated type boundary and pure serializer while reusing existing domain types.
- Blast radius reasonable: yes. Three code/test files are expected, plus the Task 4 checkbox after successful implementation validation.
- Review/revert comfort: yes. The slice is additive, pure, and has no runtime integration or persistence effects.
- Observable/testable acceptance criteria: yes. TypeScript checks the public contract and focused tests verify exact JSON shape, determinism, omission, independence, ordering, and non-default support.
