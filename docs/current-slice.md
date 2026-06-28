# Current Slice: Define the Ranking Set Domain and Canonical Invariants

## Completion Status

Planned. This slice promotes Phase 5 Task 1 and must not begin later import, persistence, application, snapshot-integration, or UI tasks.

## Source Context

Phase 5 requires ranking data to become a first-class domain concept before untrusted external data can be parsed or persisted.

The existing Draft State Engine, Recommendation Engine, persisted ranking snapshots, and Scenario V1 all consume the current `RankingEntry[]` shape. This slice must preserve that seam while adding the domain vocabulary needed for mutable ranking sets and explicit field-capability metadata.

The approved design requires:

- local ranking-set identity rather than global player identity;
- canonical contiguous overall and position ranks;
- position-local tiers;
- explicit capability states for source-provided, derived, absent, or neutral-fallback data;
- a canonical unknown-team value;
- neutral per-position tiers that disable tier-cliff signal without making `tier` nullable;
- pure deterministic validation independent of Prisma, React, files, and transport formats.

## Goal

Define the Phase 5 ranking-set domain model and one pure validator that proves an already-canonical ranking set is internally valid without changing existing engine, snapshot, scenario, or persistence behavior.

## Scope

### Goals

- Add ranking-set domain types in a dedicated rankings type module.
- Keep `Player` and `RankingEntry` unchanged in `src/types/draft.ts`.
- Define mutable ranking-set metadata, source provenance, lightweight summary data, field capabilities, and the future snapshot value shape.
- Define `UNKNOWN_TEAM` as `"UNK"` and the neutral fallback tier as `1`.
- Add a pure `validateRankingSet` boundary returning either the unchanged valid domain value or deterministic structured errors.
- Validate set metadata, canonical entries, ordering, tier progression, and capability/value consistency.
- Return all safe independent errors in deterministic order.
- Add exact unit coverage for valid, invalid, complete-source, and safely degraded ranking sets.
- Check Phase 5 Task 1 complete only after this slice and its validation pass.

### Non-Goals

- Parsing CSV, JSON, browser files, or any untrusted transport document.
- Defining import-stage parsed, normalized, or validated candidate types.
- Normalizing aliases, generating player IDs, deriving fallbacks from source files, or converting candidates into ranking sets.
- Persisting ranking sets or adding Prisma models, migrations, repositories, or database tests.
- Changing `RankingEntry`, `Player`, `RecommendationInput`, recommendation scoring, or Draft State behavior.
- Changing ranking snapshot serialization or Scenario V1.
- Adding ranking editing operations, application workflows, server actions, or UI.
- Validating ranking-set display-name uniqueness across stored sets; that belongs to the repository boundary.
- Introducing global players or cross-source identity reconciliation.

## Implementation Design

### Domain Types

Add `src/types/rankings.ts`. It should import and reuse `Position` and `RankingEntry` from `src/types/draft.ts`.

Define the following domain vocabulary:

- `RankingSetSourceKind`: `"seed" | "external" | "canonical" | "manual"`.
- `RankingSetSource`: source kind plus optional non-authoritative `formatId: string`, positive-integer `formatVersion: number`, `label: string`, and `importedAt: Date`.
- `RankingDataAvailability`: `"complete" | "partial" | "none"`.
- Player-identity capability: `"provided" | "generated" | "mixed"`.
- Overall-order capability: `"explicit" | "row-derived"`.
- Position-rank capability: exactly `"derived"`.
- Per-position tier capability: `"source" | "defaulted-neutral"`.
- `RankingSetCapabilities` containing `team`, `playerIdentity`, `overallOrder`, `positionRank`, `adp`, and `tiers: Partial<Record<Position, TierCapability>>`.
- `RankingSet` containing local ID, name, source, capabilities, ordered canonical `entries`, `createdAt: Date`, and `updatedAt: Date`.
- `RankingSetSummary` containing local ID, name, source kind, entry count, capabilities, `createdAt: Date`, and `updatedAt: Date` without entries.
- `RankingSnapshot` containing readonly canonical `rankings`, optional copied capabilities, and optional `sourceRankingSetId`, `sourceRankingSetName`, and `capturedAt: Date` provenance for future Task 15 work.

Use readonly properties and readonly collections where they prevent accidental mutation without changing the existing mutable `RankingEntry` declaration.

Export these constants from the ranking domain module:

```ts
export const UNKNOWN_TEAM = "UNK" as const;
export const NEUTRAL_TIER = 1 as const;
```

Do not add portable JSON, parser, persistence, or UI fields to these domain types.

### Validation Result

Add `src/lib/rankingSetValidation.ts` with:

- a stable `RankingSetValidationErrorCode` union containing `invalid-id`, `invalid-name`, `invalid-source`, `invalid-date`, `empty-entries`, `invalid-player-id`, `duplicate-player-id`, `invalid-player-name`, `invalid-team`, `invalid-position`, `invalid-overall-rank`, `invalid-position-rank`, `invalid-adp-rank`, `invalid-tier`, and `invalid-capability`;
- `RankingSetValidationError` containing `code`, `path`, and `message`;
- a discriminated `RankingSetValidationResult`;
- `validateRankingSet(rankingSet)` as the public pure validator.

On success, return the same ranking-set reference without cloning, sorting, normalizing, or mutating it. On failure, return all safely detectable errors in deterministic order and do not return a ranking set.

Order errors by aggregate ID, name, source, lifecycle dates, entry collection, each entry in array/field order, then capabilities in `team`, `playerIdentity`, `overallOrder`, `positionRank`, `adp`, and `QB`, `RB`, `WR`, `TE`, `DST`, `K` tier order. Do not rely on object-key iteration for error ordering.

Validation paths should identify the aggregate field or entry index, for example:

```text
name
entries
entries[2].player.id
entries[2].overallRank
capabilities.tiers.WR
```

### Set Metadata Rules

Validate:

- ranking-set ID and name are non-empty after trimming;
- source kind is supported at runtime;
- optional source strings are non-empty when present;
- optional import timestamp and required lifecycle timestamps are valid `Date` values;
- `updatedAt` is not earlier than `createdAt`;
- entries is a non-empty array;
- capability enum values are supported at runtime.

Do not enforce repository-wide name uniqueness.

### Canonical Entry Rules

Validate entries in stored array order:

- player ID and name are non-empty after trimming;
- player IDs are unique within the set;
- team is non-empty; `UNKNOWN_TEAM` is valid;
- position is one of `QB`, `RB`, `WR`, `TE`, `DST`, or `K` at runtime;
- `overallRank` is exactly the one-based array index;
- `positionRank` is exactly the one-based count for that position encountered in overall order;
- `adpRank` is `null` or a positive finite number;
- tier is a positive integer;
- tier never decreases within a position when entries are traversed in overall order.

The validator checks canonical values only. It must not sort entries, repair ranks, create identities, or generate fallback values.

### Capability Consistency Rules

After validating enough entry data to evaluate capabilities, enforce:

- Team capability is `complete` when no entry uses `UNKNOWN_TEAM`, `none` when every entry uses it, and `partial` when usage is mixed.
- ADP capability is `complete` when no entry has `null`, `none` when every entry has `null`, and `partial` when values are mixed.
- Position-rank capability is exactly `derived`.
- Every valid position represented by an entry has exactly one tier-capability entry.
- Tier capabilities do not contain positions absent from the ranking set.
- A `defaulted-neutral` position has every entry at exactly `NEUTRAL_TIER`.
- A `source` tier position follows the normal positive, non-decreasing tier rules and may preserve gaps.
- Player-identity and overall-order capability values are validated as supported metadata but are not inferred from canonical entries in this slice.

Capability inconsistency is a validation failure. Do not silently rewrite capability metadata.

### Focused Tests

Add `src/lib/rankingSetValidation.test.ts` with small explicit fixtures. Cover:

- a complete-source valid set spanning multiple positions;
- a safely degraded valid set using unknown teams, nullable ADP, generated identity capability, row-derived order, and defaulted-neutral tiers;
- empty and whitespace-only set ID, name, player ID, player name, and team;
- unsupported runtime source kind, position, and capability values supplied through test casts;
- invalid dates and `updatedAt` before `createdAt`;
- empty entries and duplicate player IDs;
- non-contiguous or duplicate overall ranks;
- incorrect position rank after interleaved positions;
- invalid ADP values including zero, negative, `NaN`, and infinity;
- zero, negative, non-integer, and decreasing tiers;
- team and ADP capability mismatches;
- missing, extra, and invalid per-position tier capabilities;
- a defaulted-neutral position containing any tier other than `NEUTRAL_TIER`;
- multiple independent failures returned in stable order;
- success returns the same input reference and validation never mutates entries or metadata.

Tests should assert exact error codes and paths when behavior is deterministic, not merely that validation failed.

## Implementation Steps

1. Add `src/types/rankings.ts` with the approved domain types, capability vocabulary, `UNKNOWN_TEAM`, and `NEUTRAL_TIER`.
2. Add `src/lib/rankingSetValidation.ts` with structured result types and pure deterministic validation.
3. Add exact focused tests for valid complete, valid degraded, and invalid ranking sets.
4. Run focused tests and TypeScript validation; fix only failures caused by this slice.
5. Run the full automated suite and lint to prove the new isolated domain layer does not regress existing behavior.
6. After all acceptance criteria pass, mark only Phase 5 Task 1 complete in `docs/tasks.md`.
7. Report acceptance status and stop. Do not begin Task 2.

## Expected Files

- `src/types/rankings.ts`
- `src/lib/rankingSetValidation.ts`
- `src/lib/rankingSetValidation.test.ts`
- `docs/tasks.md`

No existing production source file, snapshot serializer, scenario contract, Prisma schema, generated client, dependency, package file, architecture document, decision document, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSetValidation.test.ts
npx tsc --noEmit
npm test
npm run lint
```

Expected result:

- Focused ranking-set validation tests pass with exact deterministic assertions.
- TypeScript no-emit validation passes.
- All existing Vitest files and tests continue to pass.
- ESLint exits with no new errors or warnings.
- No database, network, environment variable, build, or generated-client dependency is introduced.

No Prisma validation, production build, or manual browser QA is required because this slice changes only isolated domain types, pure validation, unit tests, and a task checkbox.

## Acceptance Criteria

- Ranking-set, summary, source, capability, and future snapshot types exist in a domain-only module.
- Existing `Player`, `RankingEntry`, `RecommendationInput`, snapshot serialization, and Scenario V1 shapes are unchanged.
- `UNKNOWN_TEAM` is exactly `"UNK"` and `NEUTRAL_TIER` is exactly `1`.
- `validateRankingSet` is pure, returns structured deterministic errors, and returns the same reference on success.
- Canonical entries require unique player IDs, one-based contiguous overall ranks, derived one-based position ranks, valid ADP, and positive position-local non-decreasing tiers.
- Complete, partial, and absent team and ADP capabilities match canonical entry values.
- Tier capability covers exactly the represented valid positions.
- Every `defaulted-neutral` position contains only `NEUTRAL_TIER` values and therefore cannot encode a tier cliff.
- Unsupported or inconsistent runtime metadata fails rather than being normalized or repaired.
- Existing engine, draft, persistence, snapshot, scenario, and UI behavior is unchanged.
- Focused tests, TypeScript, the full test suite, and lint pass.
- Only Phase 5 Task 1 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If the existing seed rankings do not satisfy the new canonical rules, do not edit seed data in this slice; report the discrepancy for Task 12.
- If existing snapshot or Scenario V1 types would need to change to compile, stop and report the boundary conflict rather than expanding this slice.
- If capability consistency cannot be derived from canonical entry values under the explicit rules above, return a structured error rather than adding parser or normalization behavior.
- If a proposed validation rule depends on comparing other stored ranking sets, defer it to the repository task.
- If focused tests expose current Recommendation Engine behavior that conflicts with neutral-tier assumptions, stop and report the design conflict rather than changing scoring.
- If unrelated existing tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 2: define import-stage contracts, structured diagnostics, transport preflight boundaries, and the frozen FantasyPros CSV and Canonical Ranking Set JSON V1 format profiles. Do not begin parser implementation in the same slice.

## Slice Review

- Smallest meaningful increment: yes. It establishes the canonical domain and validator required by every later Phase 5 boundary.
- Executable by a lower-reasoning pass: yes. Files, types, constants, validation order, error shape, tests, and commands are explicit.
- Avoids unnecessary architecture changes: yes. Existing engine-facing `RankingEntry[]`, snapshots, scenarios, persistence, and UI remain unchanged.
- Blast radius reasonable: yes. Three focused source/test files plus one task checkbox are expected.
- Review/revert comfort: yes. The slice is additive and has no persistence or runtime workflow integration.
- Observable/testable acceptance criteria: yes. Exact validator results, reference preservation, capability consistency, and regression commands are specified.
