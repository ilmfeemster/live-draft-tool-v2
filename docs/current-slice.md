# Current Slice: Add Ranking Snapshot JSON Mappers

## Source Task

`docs/tasks.md` Task 3: Add Ranking Snapshot JSON Mappers.

## Goal

Create pure mapper helpers that serialize and parse ranking snapshots while exposing typed `RankingEntry[]` to application code.

This slice should prove that persisted ranking snapshot JSON can stay behind a mapper boundary before Prisma, repositories, server actions, or UI loading are introduced.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is:

```txt
src/lib/rankingSnapshot.ts
src/lib/rankingSnapshot.test.ts
```

or equivalent files that provide and test ranking snapshot JSON serialization and validation.

## Problem

Phase 2 persistence will store ranking snapshots as JSON so a saved draft can keep using the exact rankings it started with, even if future seed rankings change.

The rest of the app should continue working with typed `RankingEntry[]`. Raw JSON should not leak into the Draft State Engine, Recommendation Engine, UI components, or future repository callers.

Before adding Prisma, the codebase needs a small pure mapper boundary that can:

- convert `RankingEntry[]` into repository-storable JSON data
- parse unknown JSON back into typed `RankingEntry[]`
- reject malformed snapshot data before it reaches draft or recommendation logic

## Goals

- Add pure ranking snapshot serialization.
- Add pure ranking snapshot parsing and validation.
- Preserve all current `RankingEntry` fields:
  - `player.id`
  - `player.name`
  - `player.team`
  - `player.position`
  - `overallRank`
  - `adpRank`
  - `positionRank`
  - `tier`
- Preserve `adpRank: null` as valid data.
- Fail clearly for malformed snapshot JSON.
- Add unit tests for valid snapshots.
- Add unit tests for malformed snapshots.
- Keep the mapper independent from Prisma and database-specific types.

## Non-Goals

- Adding Prisma.
- Creating database schemas or migrations.
- Adding repository functions.
- Adding server actions.
- Adding ranking import UI.
- Adding ranking management UI.
- Normalizing ranking rows.
- Changing `seedRankings`.
- Changing recommendation behavior.
- Changing UI components.
- Parsing CSV files.
- Updating package dependencies.
- Modifying `docs/tasks.md`.

## Expected Files

- `src/lib/rankingSnapshot.ts`
- `src/lib/rankingSnapshot.test.ts`
- Possibly `src/types/draft.ts` only if a small shared snapshot JSON type is clearly useful
- `docs/current-slice.md`

Avoid changing Prisma, package dependencies, UI components, recommendation logic, seed ranking data, project scope, roadmap scope, or task status for this slice.

## Proposed Helper Shape

Use names that fit the codebase, but keep the API close to this shape:

```ts
type RankingSnapshotJson = unknown;

function serializeRankingSnapshot(rankings: RankingEntry[]): RankingSnapshotJson;

function parseRankingSnapshotJson(snapshot: unknown): RankingEntry[];
```

Expected behavior:

- Serialization returns JSON-compatible data with the same ranking and player fields.
- Parsing accepts the serialized shape and returns typed `RankingEntry[]`.
- Parsing rejects non-array snapshots.
- Parsing rejects entries missing required ranking or player fields.
- Parsing rejects invalid field types.
- Parsing rejects invalid player positions outside the current `Position` union.
- `adpRank` may be a number or `null`; other ranking number fields must be numbers.
- The mapper should not silently coerce malformed data into valid-looking rankings.

## Implementation Steps

1. Add `src/lib/rankingSnapshot.ts`.
   - Import `RankingEntry` and `Position` types.
   - Define local validation helpers for records, strings, numbers, nullable numbers, and positions.
   - Implement `serializeRankingSnapshot`.
   - Implement `parseRankingSnapshotJson`.
   - Keep the implementation pure and free of Prisma/database imports.

2. Preserve ranking fields during serialization.
   - Include all current `RankingEntry` fields.
   - Return fresh plain objects rather than reusing input references.
   - Do not add storage-only metadata in this slice.

3. Validate unknown JSON during parsing.
   - Confirm the snapshot is an array.
   - Confirm each entry has a valid `player` object.
   - Confirm player fields are valid strings.
   - Confirm `player.position` is one of `"QB"`, `"RB"`, `"WR"`, `"TE"`, `"DST"`, or `"K"`.
   - Confirm ranking fields have valid number/null types.
   - Throw clear errors that identify the malformed field or entry.

4. Add unit tests.
   - Valid snapshot round-trips without losing player, rank, ADP, position rank, or tier data.
   - `adpRank: null` is preserved.
   - Serialization returns data that can be parsed back into typed rankings.
   - Non-array snapshots fail clearly.
   - Missing required player fields fail clearly.
   - Invalid position values fail clearly.
   - Invalid rank field types fail clearly.

5. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- A pure ranking snapshot mapper exists.
- Repository-facing code can serialize `RankingEntry[]` into JSON-compatible snapshot data.
- App-facing code can parse unknown snapshot JSON into typed `RankingEntry[]`.
- The mapper preserves player ID, name, NFL team, position, overall rank, ADP rank, position rank, and tier.
- `adpRank: null` remains valid and is preserved.
- Invalid snapshot JSON fails before reaching draft or recommendation engines.
- Tests prove valid snapshot round trips.
- Tests prove malformed snapshots are rejected.
- No Prisma, repository, server action, UI, ranking import, or normalized ranking-row implementation is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged.

If the app is run manually, confirm the draft room still loads normally with the existing seed rankings.

## Slice Review

- Smallest meaningful increment: yes, this isolates the ranking JSON boundary before database and repository work.
- Concrete enough for implementation: yes, files, helper shape, malformed cases, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, no database, server action, repository, UI, or normalized ranking model work is included.
- Blast radius reasonable: yes, expected changes are limited to one mapper module, one test module, and possibly a small shared type.
- Review/revert comfort: yes, the slice is pure data transformation logic with tests.
- Observable/testable acceptance criteria: yes, helper outputs, thrown validation errors, and validation commands verify the slice.
