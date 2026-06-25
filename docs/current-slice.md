# Current Slice: Add Draft Repository Mapping Helpers

## Source Task

`docs/tasks.md` Task 5: Implement Draft Repository Mapping.

## Goal

Create pure repository mapping helpers that convert Prisma-shaped draft records into typed domain-facing draft workspaces.

This slice should prove that database records, league settings JSON, ranking snapshot JSON, and pick history can be mapped into existing app types before adding database queries, server actions, draft mutation persistence, or UI loading.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is:

```txt
src/lib/leagueSettingsSnapshot.ts
src/lib/draftRepositoryMapping.ts
src/lib/draftRepositoryMapping.test.ts
```

or equivalent files that provide and test the repository mapping boundary.

## Problem

Phase 2 persistence now has:

- a Prisma schema for draft source records
- a pure draft hydration helper
- a pure ranking snapshot JSON mapper

The next missing boundary is repository mapping: application code should receive a typed `DraftWorkspace`, not raw Prisma records or JSON blobs.

Before adding actual Prisma queries, server actions, or UI integration, the codebase needs pure mapping helpers that can validate persisted JSON, convert pick rows into hydration input, and return the domain-facing shape used by the current draft room.

## Goals

- Add a league settings JSON parser/serializer if one does not already exist.
- Add pure draft repository mapping helpers.
- Map a Prisma-shaped draft record into `DraftWorkspace`.
- Parse and validate persisted `leagueSettings` JSON into `LeagueSettings`.
- Parse and validate persisted ranking snapshot JSON into `RankingEntry[]`.
- Convert persisted draft pick rows into `DraftPickHistoryEntry[]`.
- Hydrate the domain `Draft` through `hydrateDraftFromSettings`.
- Return typed domain-facing data only.
- Add unit tests for default MVP settings.
- Add unit tests for a non-default league configuration.
- Validate mapped drafts with existing draft invariant helpers where practical.

## Non-Goals

- Adding database query functions.
- Instantiating or exporting a Prisma client.
- Creating, loading, listing, updating, or deleting real database records.
- Running database-backed integration tests.
- Adding server actions.
- Persisting draft pick mutations.
- Adding draft history UI.
- Wiring the app page to a persisted workspace.
- Changing the Prisma schema.
- Changing draft hydration behavior.
- Changing ranking snapshot mapper behavior unless a bug is found while mapping.
- Changing recommendation behavior.
- Changing UI components.
- Updating package dependencies.
- Modifying `docs/tasks.md`.

## Expected Files

- `src/lib/leagueSettingsSnapshot.ts`
- `src/lib/leagueSettingsSnapshot.test.ts`, if league settings parsing is substantial enough to test independently
- `src/lib/draftRepositoryMapping.ts`
- `src/lib/draftRepositoryMapping.test.ts`
- Possibly `src/types/draft.ts` only if a small shared `DraftSummary` type is needed
- `docs/current-slice.md`

Avoid changing Prisma schema, package dependencies, UI components, server actions, recommendation logic, seed ranking data, project scope, roadmap scope, or task status for this slice.

## Proposed Helper Shape

Use names that fit the codebase, but keep the API close to this shape:

```ts
type PersistedDraftPickRecord = {
  pickNumber: number;
  playerId: string;
};

type PersistedRankingSnapshotRecord = {
  rankings: unknown;
};

type PersistedDraftWorkspaceRecord = {
  id: string;
  leagueSettings: unknown;
  userTeamId: string;
  rankingSnapshot: PersistedRankingSnapshotRecord;
  picks: PersistedDraftPickRecord[];
};

function mapDraftRecordToWorkspace(record: PersistedDraftWorkspaceRecord): DraftWorkspace;
```

Optional summary mapping may be included only if it stays small and does not require loading ranking snapshot JSON:

```ts
type PersistedDraftSummaryRecord = {
  id: string;
  name: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  leagueSettings: unknown;
  picks: PersistedDraftPickRecord[];
  createdAt: Date;
  updatedAt: Date;
};

function mapDraftRecordToSummary(record: PersistedDraftSummaryRecord): DraftSummary;
```

Expected behavior:

- `leagueSettings` is parsed from unknown JSON before hydration.
- `rankingSnapshot.rankings` is parsed with the existing ranking snapshot mapper.
- `picks` are sorted by `pickNumber` before hydration.
- Only `pickNumber` and `playerId` flow from persisted pick rows into hydration.
- Generated draft order, teams, current pick, round, pick-in-round, and active team remain derived from `LeagueSettings`.
- Invalid league settings fail clearly.
- Invalid ranking snapshot JSON fails clearly through the existing ranking snapshot parser.
- Invalid pick history fails clearly through the existing hydration helper.

## League Settings Validation

If adding a league settings mapper in this slice, validate:

- settings value is an object
- `teamCount` is a positive integer
- `rounds` is a positive integer
- `draftType` is `"SNAKE"`
- `scoringFormat` is `"PPR"`
- `rosterSlots` is an array
- each roster slot has string `id` and `label`
- each roster slot has a non-empty `eligiblePositions` array
- each eligible position is one of `"QB"`, `"RB"`, `"WR"`, `"TE"`, `"DST"`, or `"K"`

The parser should not silently coerce malformed settings into valid-looking settings.

## Implementation Steps

1. Add league settings JSON mapping.
   - Add a pure parser for unknown JSON into `LeagueSettings`.
   - Add a serializer only if useful for future repository create functions.
   - Reuse the existing `Position`, `LeagueSettings`, and `RosterSlot` types.
   - Keep the mapper independent from Prisma imports.

2. Add `src/lib/draftRepositoryMapping.ts`.
   - Define local persisted record input types that mirror the Prisma fields needed for mapping.
   - Import `hydrateDraftFromSettings`.
   - Import `parseRankingSnapshotJson`.
   - Import the league settings parser from step 1.
   - Implement `mapDraftRecordToWorkspace`.

3. Map records into domain-facing data.
   - Parse league settings.
   - Parse ranking snapshot rankings.
   - Convert pick rows into pick history entries.
   - Sort pick history by `pickNumber`.
   - Hydrate `Draft`.
   - Return `{ draft, rankings, leagueSettings }`.

4. Add unit tests.
   - A default MVP-shaped persisted record maps to a valid `DraftWorkspace`.
   - A partially drafted record overlays pick history and derives current pick.
   - A non-default league configuration derives team count, pick count, and active pick from settings.
   - Ranking snapshot JSON is exposed as typed `RankingEntry[]`.
   - Invalid league settings fail clearly.
   - Invalid ranking snapshot JSON fails clearly.
   - Invalid pick history fails clearly.

5. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- A pure repository mapping helper exists.
- Mapping returns a typed `DraftWorkspace`.
- Raw league settings JSON does not reach app-facing code.
- Raw ranking snapshot JSON does not reach app-facing code.
- Pick history is converted into hydration input without storing derived draft-order fields.
- Hydrated drafts are valid for MVP settings.
- Hydrated drafts are valid for a non-default league configuration.
- Tests prove mapping does not assume MVP league size.
- Invalid league settings fail clearly.
- Invalid ranking snapshot JSON fails clearly.
- Invalid pick history fails clearly.
- No Prisma client query functions, server actions, UI wiring, mutation persistence, package dependency changes, or schema changes are added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged.

If the app is run manually, confirm the draft room still loads normally from the existing static default draft and seed rankings.

## Slice Review

- Smallest meaningful increment: yes, this proves the record-to-domain mapping boundary before adding live database access.
- Concrete enough for implementation: yes, input record shapes, helper behavior, validation rules, tests, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it keeps Prisma details below the domain boundary and avoids server actions or UI wiring.
- Blast radius reasonable: yes, expected changes are limited to mapper modules and tests.
- Review/revert comfort: yes, the slice is pure data transformation logic with no runtime app behavior dependency.
- Observable/testable acceptance criteria: yes, helper outputs, thrown validation errors, invariant checks, and validation commands verify the slice.
