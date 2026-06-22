# Current Slice: FantasyPros Seed Rankings V1

## Goal

Replace the small handwritten seed rankings with the larger FantasyPros CSV data set so recommendation work can be tested against a more realistic player pool.

The app should continue using the existing `RankingEntry[]` shape.

## User-Visible Increment

The `Available Players` table loads the larger FantasyPros rankings data. Existing search, position filtering, drafting, undo, and roster behavior continue working.

## Goals

- Use `src/data/FantasyPros_2026_Draft_ALL_Rankings.csv` as the source for seed rankings.
- Convert CSV rows into the existing `RankingEntry` structure.
- Preserve current supported positions:
  - `QB`
  - `RB`
  - `WR`
  - `TE`
  - `DST`
  - `K`
- Parse `POS` values such as `WR12` into:
  - `position: "WR"`
  - `positionRank: 12`
- Parse `RK` into `overallRank`.
- Parse `ECR VS ADP` into `adpRank` by adding it to `RK` when the offset is numeric.
- Store `adpRank: null` when `ECR VS ADP` is `-`.
- Parse `TIERS` into `tier`.
- Preserve player name and team abbreviation.
- Keep app behavior unchanged outside the larger data set.
- Fix only app issues directly caused by the larger data set.

## Non-Goals

- Runtime CSV upload/import UI.
- CSV editing UI.
- New database work.
- Prisma integration.
- Recommendation engine logic.
- Recommendation UI.
- Player metadata beyond the current type plus derived ADP rank.
- Bye week, upside, bust, or SOS usage.
- New dependencies.
- Changing draft order, team count, or rounds.

## Expected Files

- `src/data/seedRankings.ts`
- `docs/current-slice.md`
- `docs/decisions.md` if a durable data-source decision is useful

Do not update `docs/tasks.md` unless an existing unchecked task is directly completed by this slice.

Avoid changing components unless the larger data set reveals a concrete rendering or interaction bug.

## Implementation Constraint

Keep `seedRankings` as a typed `RankingEntry[]` export so current imports do not need to change.

Do not add:

- A runtime CSV parser.
- A CSV upload workflow.
- A new state management layer.
- A database.
- Package dependencies.

## Data Conversion Rules

For each CSV row:

1. `RK` becomes `overallRank`.
2. `ECR VS ADP` is parsed as a signed numeric offset when available.
3. `overallRank + ECR VS ADP` becomes `adpRank`.
4. `ECR VS ADP` value `-` becomes `adpRank: null`.
5. `TIERS` becomes `tier`.
6. `PLAYER NAME` becomes `player.name`.
7. `TEAM` becomes `player.team`.
8. `POS` is split into position letters and numeric rank.
9. Position letters must match the existing `Position` union.
10. Numeric rank becomes `positionRank`.
11. `player.id` is generated from player name, team, and position rank to avoid duplicate-name collisions.

If a row cannot be parsed into the current model, skip it only if necessary and document the skipped row in the final report.

## Implementation Steps

1. Inspect the CSV shape.
   - Confirm required columns exist.
   - Confirm positions are limited to the supported position union.
   - Confirm row count.

2. Update `src/data/seedRankings.ts`.
   - Replace the small handwritten list with rankings generated from the CSV.
   - Keep `import type { RankingEntry } from "@/types/draft";`.
   - Keep `export const seedRankings: RankingEntry[] = [...]`.
   - Ensure generated data is valid TypeScript.

3. Validate app compatibility.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify the larger available-player count renders.

4. Manual smoke test.
   - Search for a player from the new data set.
   - Filter each supported position.
   - Draft and undo at least one player.
   - Confirm the roster still updates.

## Acceptance Criteria

- `seedRankings` contains the larger FantasyPros player pool.
- All exported ranking entries conform to the existing `RankingEntry` type.
- Overall rank, ADP rank, tier, position, and position rank are parsed correctly.
- Player ids are stable and unique.
- The app renders the larger available-player count.
- Existing search still works.
- Existing position filters still work.
- Drafting a player still removes them from available players.
- Undo still returns the player to available players.
- User roster still updates for user picks.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

The CSV currently contains 487 player rows after the header.

The default draft remains a 4-team, 16-round test draft. This slice intentionally does not change that because the goal is data breadth for recommendation testing, not draft configuration.

## Slice Review

- Smallest meaningful increment: yes, this updates only the seed rankings data source needed before recommendations.
- Concrete enough for implementation: yes, the CSV columns, parsing rules, validation, and non-goals are explicit.
- Avoids unnecessary architecture changes: yes, the app keeps the existing `RankingEntry[]` contract and avoids runtime import complexity.
- Blast radius reasonable: yes, expected implementation is one data module plus this plan, with docs decision only if warranted.
- Review/revert comfort: yes, the data update can be reverted independently of recommendation work.
- Observable/testable acceptance criteria: yes, row count, rendering, filters, draft, undo, lint, and build are all testable.
