# Current Slice: Manual Testing Data V1

## Goal

Make local manual testing faster by shrinking the default draft and expanding the seed rankings.

This slice supports upcoming roster slot testing by making it easier to:

- reach the user's picks quickly,
- draft enough players to fill starter and bench slots,
- test multiple positions without running out of seed players.

## User-Visible Increment

The default draft uses 4 teams instead of 12, and the available player pool contains more seed players across all positions.

## Goals

- Change the default local draft from 12 teams to 4 teams.
- Keep the user draft position valid and easy to reach.
- Add enough seed rankings to manually draft through starter and bench scenarios.
- Include extra players at `RB`, `WR`, and `TE` so future FLEX and Bench behavior can be tested.
- Include multiple `QB`, `DST`, and `K` options.
- Keep this as seed/default data only.

## Non-Goals

- Do not change MVP league settings in `docs/project.md`.
- Do not change architecture docs.
- Do not add draft setup UI.
- Do not add roster slot assignment.
- Do not add recommendations.
- Do not add persistence.
- Do not change draft engine logic.
- Do not add new domain types.

## Expected Files

- `src/data/defaultDraft.ts`
- `src/data/seedRankings.ts`
- `docs/current-slice.md`

Do not update `docs/tasks.md`; this slice supports manual testing but does not complete a product checklist item.

## Implementation Constraint

Treat the 4-team draft as temporary local seed/default data for faster validation. Do not change the documented MVP target of a 12-team draft.

## Implementation Steps

1. Update `src/data/defaultDraft.ts`.
   - Change `teamCount` from `12` to `4`.
   - Keep `rounds` at `16`.
   - Set `userDraftPosition` to `2`.
   - Leave the rest of the file structure unchanged.

2. Update `src/data/seedRankings.ts`.
   - Expand `seedRankings` from 24 players to at least 48 players.
   - Preserve unique `id` values.
   - Preserve ascending `overallRank` values with no gaps.
   - Keep each entry typed as `RankingEntry`.
   - Add enough players to cover at least:
     - 6 QB
     - 12 RB
     - 16 WR
     - 6 TE
     - 4 DST
     - 4 K
   - Keep names real-ish and plausible.

3. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify it renders with the larger player pool.

## Acceptance Criteria

- The default draft has 4 teams.
- The user draft position is 2.
- The draft still has 16 rounds.
- The available player pool has at least 48 players.
- Seed player ids are unique.
- Overall ranks are sequential.
- The app renders the larger available player pool.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

With 4 teams and user draft position 2, user picks occur quickly at picks 2, 7, 10, 15, and so on. This makes it easier to test roster tracking and future roster slot assignment without entering many unrelated picks.

## Slice Review

- Smallest meaningful increment: yes, it changes only local test data needed for faster manual validation.
- Concrete enough for implementation: yes, exact file edits and data requirements are listed.
- Avoids unnecessary architecture changes: yes, no logic or architecture changes are required.
- Blast radius reasonable: yes, expected changes are two data files plus this slice plan.
- Review/revert comfort: yes, the slice is isolated to seed/default data.
- Observable/testable acceptance criteria: yes, counts, ranks, ids, and rendering can be checked directly.
