# Current Slice: Player Search V1

## Goal

Make manual pick entry faster by adding a simple search input to the available players table.

This is a live-draft usability slice. The user should be able to quickly narrow the available player pool by typing part of a player name or NFL team abbreviation, then draft from the filtered results.

## User-Visible Increment

The `Available Players` panel includes a search input above the table. Typing into it filters the visible available players while preserving the existing position filter and ranking sort.

## Goals

- Add a search input to `AvailablePlayersTable`.
- Filter available rankings by:
  - Player name.
  - NFL team abbreviation.
- Keep the existing position filter.
- Combine search and position filtering.
- Keep filtered results sorted by `overallRank`.
- Show the filtered count in the existing helper text.
- Show a simple empty state when no players match the active search/filter.
- Keep drafting behavior unchanged.
- Keep search state local to `AvailablePlayersTable`.

## Non-Goals

- Fuzzy search.
- Search by position rank or tier.
- Keyboard shortcuts.
- Autocomplete.
- Highlighting matched text.
- Recent searches.
- Player queue.
- Watchlist.
- Recommendation changes.
- Draft state changes.
- New dependencies.
- URL query params or persistence.

## Expected Files

- `src/components/AvailablePlayersTable.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `DraftRoom`, draft types, seed data, recommendation logic, or package dependencies.

## Implementation Constraint

Use local React state inside `AvailablePlayersTable`.

Do not add:

- Context.
- Reducers.
- Global state.
- Search libraries.
- New components unless the table becomes meaningfully harder to read.
- New domain types.

## Search Behavior

The search query should:

- Be controlled by local component state.
- Trim leading and trailing whitespace before filtering.
- Match case-insensitively.
- Match against `entry.player.name`.
- Match against `entry.player.team`.
- Return all position-filtered players when the trimmed query is empty.
- Work together with the existing position filter.

Filtering order should be:

1. Position filter.
2. Search filter.
3. Sort by `overallRank`.

## UI Rules

- Place the search input in the `Available Players` header area near the existing position filter.
- Use a plain text input.
- Add an accessible label, either visible or screen-reader-only.
- Use placeholder text such as `Search players or teams`.
- Keep the existing position filter buttons visible.
- Keep the table layout intact.
- When no players match, render one table row or compact message inside the table area explaining that no available players match the current filters.

## Implementation Steps

1. Update `src/components/AvailablePlayersTable.tsx`.
   - Add local `searchQuery` state.
   - Normalize the search query inside the existing `useMemo`.
   - Apply position filtering, then search filtering, then ranking sorting.
   - Add a search input to the header area.
   - Keep the existing position filter controls.
   - Add an empty state for zero filtered results.
   - Keep `onDraftPlayer(entry.player.id)` unchanged.

2. Update `docs/tasks.md`.
   - Mark `Build player search` complete.
   - Do not change recommendation, roster, or backlog items.

3. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify the search input renders.

4. Manual test.
   - Search for part of a known player name.
   - Search using different casing.
   - Search for a team abbreviation.
   - Combine search with a position filter.
   - Clear the search and confirm the full position-filtered list returns.
   - Draft a searched player and confirm they disappear from available players.
   - Undo that pick and confirm the player returns if they still match the active search/filter.

## Acceptance Criteria

- `Available Players` renders a search input.
- Empty search preserves the existing available player list behavior.
- Searching by partial player name filters visible players.
- Searching by team abbreviation filters visible players.
- Search is case-insensitive.
- Search combines correctly with the existing position filter.
- Filtered results remain sorted by `overallRank`.
- The helper text count updates to match the filtered visible list.
- A clear empty state appears when no players match.
- Drafting a searched player still works.
- Undoing a searched pick makes the player available again when they match the active filters.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

Useful seeded examples:

- `chase` should find `Ja'Marr Chase`.
- `bal` should find Baltimore players or teams such as `BAL`.
- `te` should not be treated as a position filter through search; use the existing `TE` button for position filtering.

When testing draft and undo with an active search, prefer a player whose team/name uniquely narrows the table so the disappear/return behavior is easy to see.

## Slice Review

- Smallest meaningful increment: yes, this adds basic search only, without fuzzy matching or keyboard shortcut complexity.
- Concrete enough for implementation: yes, state location, filtering order, matched fields, empty state, and validation steps are explicit.
- Avoids unnecessary architecture changes: yes, search state stays local to `AvailablePlayersTable`.
- Blast radius reasonable: yes, expected implementation touches one component plus task docs.
- Review/revert comfort: yes, the slice is isolated to table filtering and display.
- Observable/testable acceptance criteria: yes, all behavior is visible in the UI and covered by lint/build plus manual checks.
