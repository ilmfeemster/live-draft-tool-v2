# Current Slice: Add Configuration-Driven Draft Hydration Helpers

## Source Task

`docs/tasks.md` Task 2: Add Configuration-Driven Draft Hydration Helpers.

## Goal

Create pure helpers that rebuild a domain `Draft` from league settings and persisted pick history.

This slice should prove that draft state can be reconstructed from configuration-driven source data before adding Prisma, repositories, server actions, or ranking snapshot JSON storage.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is:

```txt
src/lib/draftHydration.ts
src/lib/draftHydration.test.ts
```

or equivalent files that provide and test pure draft hydration helpers.

## Problem

Phase 2 persistence should store source state:

- league settings
- ranking snapshot
- pick history

The app still needs a domain `Draft` for existing draft state, roster, and recommendation behavior. Before persistence is implemented, the codebase needs a pure conversion path from persisted-style pick history plus `LeagueSettings` into the existing `Draft` shape.

The helper must not assume the MVP defaults. It should derive team count, round count, pick count, active team, round, and pick-in-round from `LeagueSettings`.

## Goals

- Add a pure draft hydration helper.
- Generate teams from `LeagueSettings.teamCount`.
- Generate draft order from `LeagueSettings.teamCount`, `LeagueSettings.rounds`, and `LeagueSettings.draftType`.
- Overlay persisted pick history onto the generated draft order.
- Derive `currentPickNumber` from the first undrafted pick.
- Preserve valid completed-draft behavior.
- Add unit tests for MVP settings.
- Add unit tests for a non-default league configuration.
- Validate hydrated drafts with existing draft invariant helpers where practical.

## Non-Goals

- Adding Prisma.
- Creating database schemas or migrations.
- Adding repository functions.
- Adding server actions.
- Adding ranking snapshot JSON mappers.
- Loading or validating `RankingEntry[]`.
- Changing recommendation behavior.
- Changing UI components.
- Changing `defaultDraft` behavior unless required by the helper extraction.
- Modifying `docs/tasks.md`.

## Expected Files

- `src/lib/draftHydration.ts`
- `src/lib/draftHydration.test.ts`
- Possibly `src/types/draft.ts` only if a small persisted pick-history type belongs with shared draft types
- `docs/current-slice.md`

Avoid changing Prisma, package dependencies, UI components, recommendation logic, ranking data, project scope, roadmap scope, or task status for this slice.

## Proposed Helper Shape

Use names that fit the codebase, but keep the API close to this shape:

```ts
type DraftPickHistoryEntry = {
  pickNumber: number;
  playerId: string;
};

type HydrateDraftInput = {
  id: string;
  leagueSettings: LeagueSettings;
  userTeamId: string;
  pickHistory?: DraftPickHistoryEntry[];
};

function hydrateDraftFromSettings(input: HydrateDraftInput): Draft;
```

Expected behavior:

- `teams` come from `createDraftTeams(input.leagueSettings.teamCount)`.
- `picks` start from generated draft order.
- Each pick-history entry sets `playerId` on the generated pick with the matching `pickNumber`.
- `currentPickNumber` is the first pick without a `playerId`.
- If every generated pick has a `playerId`, `currentPickNumber` should remain within the existing `Draft` model's valid range, matching current completed-draft behavior.
- Unsupported draft types should fail clearly. Since only `"SNAKE"` exists today, this can be an exhaustive check rather than a broad abstraction.

## Implementation Steps

1. Add `src/lib/draftHydration.ts`.
   - Import `LeagueSettings` and `Draft`.
   - Define local or exported types for pick history and hydration input.
   - Implement `hydrateDraftFromSettings`.
   - Use existing `createDraftTeams` and `generateSnakeDraftOrder` helpers.
   - Avoid hard-coded team counts, rounds, total pick counts, or draft order lengths.

2. Overlay pick history.
   - Match pick-history entries by `pickNumber`.
   - Set only `playerId` on generated picks.
   - Leave `round`, `pickInRound`, and `teamId` derived from generated draft order.
   - Decide how invalid pick numbers should fail. Prefer a clear thrown error for this slice rather than silently ignoring invalid source data.

3. Derive current pick.
   - If there is an undrafted pick, use that pick number.
   - If all picks are drafted, keep `currentPickNumber` at the final pick number so existing completion logic remains compatible.
   - Do not store or require a persisted current pick value.

4. Add unit tests.
   - MVP settings with no pick history creates a valid empty draft.
   - MVP settings with partial pick history overlays players and derives current pick.
   - A completed draft remains valid according to existing completion behavior.
   - A non-default league configuration derives pick count, teams, rounds, active team, and current pick from settings.
   - Invalid pick history fails clearly.

5. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- A pure hydration helper exists.
- Hydration returns a valid `Draft` for MVP settings.
- Hydration returns a valid `Draft` for a non-default league configuration.
- Pick count is derived from `LeagueSettings`.
- Team count is derived from `LeagueSettings`.
- Round and pick-in-round are derived from generated draft order, not persisted pick history.
- Active team is derived from settings and pick number.
- Current pick is derived from pick history.
- Tests prove hydration does not assume MVP league size.
- Invalid pick history does not silently produce a misleading draft.
- No Prisma, repository, server action, UI, or ranking snapshot JSON implementation is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged.

If the app is run manually, confirm the draft room still loads normally with the default draft.

## Slice Review

- Smallest meaningful increment: yes, this isolates pure hydration before storage and repository work.
- Concrete enough for implementation: yes, files, helper shape, edge cases, and validation are specified.
- Avoids unnecessary architecture changes: yes, no database, server action, repository, UI, or ranking JSON work is included.
- Blast radius reasonable: yes, expected changes are limited to one helper module, one test module, and possibly a small shared type.
- Review/revert comfort: yes, the slice is pure domain conversion logic with tests.
- Observable/testable acceptance criteria: yes, helper outputs and validation commands verify the slice.
