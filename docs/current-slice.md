# Current Slice: Define League Settings And Draft Workspace Types

## Source Task

`docs/tasks.md` Task 1: Define League Settings And Draft Workspace Types.

## Goal

Introduce the typed domain-facing configuration needed for Phase 2 persistence without adding database code.

This slice should make league settings and draft workspace data explicit so later persistence work can store source configuration and return typed app data instead of leaking database storage shapes into the Draft State Engine, Recommendation Engine, or UI.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is:

```txt
src/types/draft.ts
src/data/defaultLeagueSettings.ts or equivalent
src/data/defaultDraft.ts
```

define reusable league settings and draft workspace types while preserving the current default draft behavior.

## Problem

Phase 2 persistence must be configuration-driven. The current default draft is created from local constants in `src/data/defaultDraft.ts`, and the app does not yet have a domain-facing type for league settings or draft workspaces.

Before adding hydration, JSON ranking snapshots, Prisma, or repositories, the codebase needs stable types for:

- league settings
- roster slots
- draft workspace data returned by future persistence code
- default MVP settings as data rather than hidden constants

## Goals

- Define a `LeagueSettings` type.
- Define a `RosterSlot` type or equivalent roster configuration type.
- Define a `DraftWorkspace` type containing `Draft`, `RankingEntry[]`, and `LeagueSettings`.
- Add default MVP league settings as reusable data.
- Update default draft creation to use the default league settings.
- Keep existing draft UI behavior unchanged.
- Keep this slice independent from Prisma and persistence implementation.

## Non-Goals

- Adding Prisma.
- Creating database schemas or migrations.
- Adding repository functions.
- Adding server actions.
- Adding hydration helpers for persisted pick history.
- Adding ranking snapshot JSON mappers.
- Adding a custom league setup UI.
- Changing recommendation behavior.
- Refactoring the full draft state model.
- Modifying `docs/tasks.md`.

## Expected Files

- `src/types/draft.ts`
- `src/data/defaultDraft.ts`
- `src/data/defaultLeagueSettings.ts` or another clearly named data module for default settings
- A focused test file only if useful to prove the default settings shape, such as `src/data/defaultLeagueSettings.test.ts`
- `docs/current-slice.md`

Avoid changing Prisma, package dependencies, UI components, recommendation logic, roadmap scope, or task status for this slice.

## Implementation Steps

1. Update `src/types/draft.ts`.
   - Add `DraftType`, initially `"SNAKE"`.
   - Add `ScoringFormat`, initially `"PPR"`.
   - Add `RosterSlot`.
   - Add `LeagueSettings`.
   - Add `DraftWorkspace`.
   - Keep existing exported types compatible with current imports.

2. Create default MVP league settings.
   - Add a small data module such as `src/data/defaultLeagueSettings.ts`.
   - Export `defaultLeagueSettings`.
   - Represent the current MVP defaults:
     - 12 teams
     - 16 rounds
     - snake draft
     - PPR scoring
     - roster slots for QB, RB, RB, WR, WR, TE, FLEX, FLEX, DST, K, and six bench spots
   - Store these as data in the settings object, not as persistence assumptions.

3. Update `src/data/defaultDraft.ts`.
   - Import `defaultLeagueSettings`.
   - Use `defaultLeagueSettings.teamCount` instead of a local team count constant.
   - Use `defaultLeagueSettings.rounds` instead of a local rounds constant.
   - Keep the current default user draft position behavior for now.
   - Keep the exported `defaultDraft` shape unchanged.

4. Add focused validation if useful.
   - Prefer a small unit test if the default settings shape has enough behavior to justify it.
   - At minimum, verify TypeScript, existing tests, lint, and build still pass.
   - Do not add broad persistence tests in this slice.

5. Review for configuration boundaries.
   - Confirm the new types do not hard-code 12 teams, 16 rounds, or fixed roster slots into type definitions.
   - Confirm defaults live in data, not in persistence-facing logic.
   - Confirm no raw JSON or database concepts are introduced.

## Acceptance Criteria

- `LeagueSettings` exists and can represent the current MVP settings.
- `LeagueSettings` can also represent a non-default team count and round count without changing the type.
- `RosterSlot` or equivalent roster configuration exists.
- `DraftWorkspace` exists and contains `Draft`, `RankingEntry[]`, and `LeagueSettings`.
- Current `defaultDraft` still represents the existing MVP draft setup.
- Existing app behavior remains unchanged.
- No Prisma, database, repository, server action, or ranking snapshot JSON implementation is added.
- No persistence-facing type requires 12 teams, 16 rounds, or fixed roster slots.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice unless the implementation unexpectedly changes app runtime behavior.

If the app is run manually, confirm the draft room still loads with the same default draft settings and no visible regression.

## Slice Review

- Smallest meaningful increment: yes, this only establishes the typed configuration boundary required before persistence.
- Concrete enough for implementation: yes, expected files, exported types, default data, and validation are listed.
- Avoids unnecessary architecture changes: yes, no database, repository, server action, or hydration implementation is included.
- Blast radius reasonable: yes, expected changes are limited to shared types, default settings data, default draft creation, and possibly one focused test.
- Review/revert comfort: yes, this slice is isolated and should not alter user-facing behavior.
- Observable/testable acceptance criteria: yes, exported types, default data usage, and validation commands verify the slice.
