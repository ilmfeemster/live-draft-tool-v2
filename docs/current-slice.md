# Current Slice: Define League Setup and Validation

## Source Context

Phase 4 Task 1: Define League Setup and Validation.

The domain, hydration, repository, and Recommendation Engine already consume dynamic `LeagueSettings`, but draft creation still supplies fixed defaults. This slice establishes the pure setup boundary required before configured persistence or UI work begins.

The slice must produce the existing `LeagueSettings` shape and a valid user-team identity. It must not create a second persisted settings model, create drafts, or change engine behavior.

## Goal

Add a client-safe, deterministic `buildLeagueSetup` boundary that validates supported setup input and returns either structured field errors or the existing typed `LeagueSettings` plus derived `userTeamId`.

## Scope

### Goals

- Define the league-setup input and default input used by later server and form slices.
- Support team counts from 2 through 20.
- Support user draft positions from 1 through the selected team count.
- Support QB, RB, WR, TE, FLEX, DST, K, and BENCH roster counts.
- Require finite, non-negative integer roster counts.
- Require at least one non-BENCH starting slot.
- Require 1 through 30 total roster slots.
- Support only `SNAKE` and `PPR`.
- Validate total draft capacity against a supplied ranking player count.
- Generate deterministic ordered `RosterSlot[]` values with unique category/index IDs.
- Derive rounds from the generated roster-slot count.
- Derive `userTeamId` from the team created for the selected draft position.
- Return structured, deterministic validation errors without throwing for invalid setup input.
- Add exact unit coverage for defaults, non-defaults, slot generation, bounds, and invalid input.

### Non-Goals

- Changing `createNewDraftAction`, repository methods, hydration, Prisma, or persistence.
- Adding a draft setup form or other UI.
- Modifying the Draft State Engine or Recommendation Engine.
- Editing settings on an existing draft.
- Persisting roster counts as a separate model.
- Supporting arbitrary slot eligibility, custom positions, auction, keeper, dynasty, non-snake drafts, or non-PPR scoring.
- Changing the existing `LeagueSettings`, `RosterSlot`, `DraftType`, or `ScoringFormat` domain types.
- Refactoring `defaultLeagueSettings` or existing snapshot validation in this slice.
- Adding package dependencies.
- Beginning Phase 4 Task 2.

## Public Contract

Add `src/lib/leagueSetup.ts` as a pure module safe to import from client and server code.

Use the following contract names and meanings:

```ts
export const LEAGUE_SETUP_LIMITS = {
  minTeamCount: 2,
  maxTeamCount: 20,
  minRosterSlots: 1,
  maxRosterSlots: 30,
} as const;

export const LEAGUE_SETUP_ROSTER_CATEGORIES = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "DST",
  "K",
  "BENCH",
] as const;

export type LeagueSetupRosterCategory =
  (typeof LEAGUE_SETUP_ROSTER_CATEGORIES)[number];

export type LeagueSetupRosterCounts = Record<
  LeagueSetupRosterCategory,
  number
>;

export type LeagueSetupInput = {
  teamCount: number;
  userDraftPosition: number;
  draftType: DraftType;
  scoringFormat: ScoringFormat;
  rosterSlotCounts: LeagueSetupRosterCounts;
};

export type LeagueSetupValidationError = {
  field: string;
  message: string;
};

export type LeagueSetupResult =
  | {
      ok: true;
      leagueSettings: LeagueSettings;
      userTeamId: string;
    }
  | {
      ok: false;
      errors: LeagueSetupValidationError[];
    };

export const defaultLeagueSetupInput: LeagueSetupInput;

export function buildLeagueSetup(
  input: LeagueSetupInput,
  rankingPlayerCount: number,
): LeagueSetupResult;
```

The exact error-field type may be narrowed to a string union if that stays simple. Do not return partial settings on failure and do not throw for expected validation errors.

## Default Setup

`defaultLeagueSetupInput` must represent the current application defaults:

- 12 teams.
- User draft position 2.
- `SNAKE` draft.
- `PPR` scoring.
- QB: 1.
- RB: 2.
- WR: 2.
- TE: 1.
- FLEX: 2.
- DST: 1.
- K: 1.
- BENCH: 6.

Given enough ranking players, building this input must return settings exactly equal to the existing `defaultLeagueSettings` and `userTeamId` equal to `team-2`. Keep `defaultLeagueSettings` unchanged in this slice; the equality test protects the later migration to the shared builder.

## Roster-Slot Mapping

Generate slots in this fixed category order:

1. QB
2. RB
3. WR
4. TE
5. FLEX
6. DST
7. K
8. BENCH

For each category, generate one slot per configured count using a lowercase category and one-based index for the ID, such as `rb-1`, `rb-2`, and `bench-1`.

Use these labels and eligibility rules:

| Category | Label | Eligible positions |
| --- | --- | --- |
| QB | `QB` | QB |
| RB | `RB` | RB |
| WR | `WR` | WR |
| TE | `TE` | TE |
| FLEX | `FLEX` | RB, WR, TE |
| DST | `DST` | DST |
| K | `K` | K |
| BENCH | `BENCH` | QB, RB, WR, TE, DST, K |

Create fresh slots and eligible-position arrays on every successful call. Do not sort or infer category order from object property enumeration.

## Validation Rules

Validate in a stable order so identical invalid input returns identical errors:

1. Ranking player count is a finite non-negative integer.
2. Team count is a finite integer from 2 through 20.
3. User draft position is a finite integer and falls within the valid team range.
4. Draft type is exactly `SNAKE`.
5. Scoring format is exactly `PPR`.
6. Each roster category count is a finite non-negative integer, checked in the fixed category order.
7. At least one non-BENCH slot is configured.
8. Total roster slots are from 1 through 30.
9. `teamCount * totalRosterSlots` does not exceed `rankingPlayerCount`.

Aggregate roster and capacity checks should run only when the values they depend on are valid. Return all independent errors found in one result so the later form can show useful feedback without repeated submissions.

Use field paths suitable for later form mapping, such as:

- `rankingPlayerCount`
- `teamCount`
- `userDraftPosition`
- `draftType`
- `scoringFormat`
- `rosterSlotCounts.QB`
- `rosterSlotCounts`

Error messages should state the supported requirement and avoid implementation jargon.

## Team Identity Derivation

Use the existing `createDraftTeams(teamCount)` helper and select the team whose `draftPosition` matches `userDraftPosition`. Return that team's ID.

Do not construct an unrelated user-team naming scheme. If valid input cannot resolve the team, return a setup validation failure rather than a partial success.

## Implementation Steps

1. Add `src/lib/leagueSetup.ts` with the limits, categories, setup types, default input, deterministic roster-slot builder, validation, and `buildLeagueSetup` result boundary.
2. Reuse existing `DraftType`, `ScoringFormat`, `LeagueSettings`, `Position`, and `RosterSlot` types from `src/types/draft.ts` and `createDraftTeams` from `src/lib/draftOrder.ts`.
3. Add `src/lib/leagueSetup.test.ts` with exact success and failure assertions.
4. Run the focused test, full test suite, lint, and TypeScript validation.
5. If every acceptance criterion and validation command passes, check only Phase 4 Task 1 complete in `docs/tasks.md`. Do not begin Task 2.

## Expected Files

- `src/lib/leagueSetup.ts`
- `src/lib/leagueSetup.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 1 complete after validation passes

Do not modify existing source or test files. If the approved setup contract cannot be implemented with the existing domain and draft-order types, stop and report the conflict instead of expanding the slice.

## Test Cases

The focused test file should prove:

1. The default input builds settings exactly equal to `defaultLeagueSettings` and returns `team-2`.
2. A non-default configuration builds the expected team count, derived rounds, ordered slots, and selected user-team ID.
3. Every roster category produces the documented label, ID, and eligible-position array.
4. Identical input produces deeply equal output with fresh slot and eligibility-array references.
5. Team counts 2 and 20 pass; values below, above, fractional, infinite, and `NaN` fail.
6. Draft positions at 1 and `teamCount` pass; zero, above-team-count, fractional, infinite, and `NaN` fail.
7. Zero-count optional categories are allowed while a bench-only or all-zero roster fails.
8. Exactly 1 and 30 valid total slots pass when other rules and ranking capacity permit; more than 30 fails.
9. Ranking capacity exactly equal to total picks passes; one fewer player fails.
10. Negative, fractional, infinite, and `NaN` roster counts fail at their category field.
11. Unsupported runtime draft-type and scoring-format values fail even though normal TypeScript callers use the narrower domain types.
12. Multiple independent invalid fields return errors together in deterministic order.
13. Invalid input never returns partial `LeagueSettings` or a user-team ID.

Tests must assert exact fields and meaningful messages rather than only checking that an error exists.

## Automated Validation

Run from the repository root in this order:

```txt
npm test -- src/lib/leagueSetup.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused league-setup tests pass.
- The full Vitest suite passes unchanged.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No existing source or test behavior changes.

## Acceptance Criteria

- One pure client-safe module owns setup limits, defaults, validation, and settings construction.
- Valid setup input returns the existing `LeagueSettings` shape and a user-team ID from existing team generation.
- Default setup output exactly matches current application settings and Team 2.
- Non-default team count, roster construction, and draft position build correctly.
- Rounds derive from the generated roster-slot count.
- Slot order, IDs, labels, and eligibility are deterministic.
- Supported team, roster, draft, scoring, and ranking-capacity constraints are enforced.
- Invalid input returns deterministic structured errors without throwing or returning partial settings.
- The builder performs no persistence, React, browser, or server-only work.
- Existing domain types and team generation are reused without modification.
- Focused tests, full tests, lint, and TypeScript validation pass.
- No package dependency is added.
- Only Phase 4 Task 1 is checked complete after validation passes.
- Task 2 is not started.

## Failure Handling

- If the current default settings cannot be reproduced exactly from the approved count mapping, stop and report the discrepancy.
- If the existing `LeagueSettings` or `RosterSlot` model cannot represent an approved setup value, stop and report the conflict rather than changing the domain model.
- If draft position cannot map through existing team generation, return a validation error; do not invent a second identity scheme.
- If full validation exposes an unrelated failure, report it and do not broaden this slice to fix unrelated code.
- Do not weaken existing snapshot, draft-order, or recommendation tests.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 2: Create and Persist Configured Drafts. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It establishes the shared validated setup boundary needed by configured persistence and UI.
- Concrete enough for implementation: yes. The public contract, bounds, mapping, validation order, tests, commands, and failure behavior are explicit.
- Avoids unnecessary architecture changes: yes. It produces existing domain types and reuses team generation without touching engines or persistence.
- Blast radius reasonable: yes. Two additive code files are expected, plus the Task 1 checkbox after successful validation.
- Review/revert comfort: yes. The slice is isolated, pure, additive, and has no runtime consumers yet.
- Observable/testable acceptance criteria: yes. Exact settings, team identity, slots, boundaries, errors, and validation commands are directly checkable.
