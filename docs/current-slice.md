# Current Slice: Recommendation UI V1

## Goal

Display the current top 5 ranking-based recommendations in the draft room.

The recommendation panel should appear above the available players list and search controls so the user sees the short decision-support view before scanning the full player pool.

## User-Visible Increment

The draft room shows a `Recommendations` panel above `Available Players`.

The panel lists the top 5 available players from the existing ranking-score engine. As players are drafted or undone, the panel updates because it is derived from the same available rankings as the table.

## Goals

- Render top 5 recommendations above the draft list and search bar.
- Use the existing `generateTopRecommendations` helper.
- Keep recommendation inputs derived from `availableRankings`.
- Display each recommended player's:
  - Rank/order in the recommendation list.
  - Name.
  - Team.
  - Position plus position rank.
  - Overall rank.
  - Score.
  - Reasons.
- Include a `Draft` button for each recommendation.
- Keep existing available players table behavior unchanged.
- Keep recommendation scoring unchanged.
- Keep roster need, scarcity, and tier-drop logic out of this slice.

## Non-Goals

- Roster need modifier.
- Positional scarcity modifier.
- Tier-drop modifier.
- ADP-based scoring.
- Tier warnings.
- Scarcity warnings.
- Highlighting the user's pick.
- Recommendation tuning.
- Recommendation persistence.
- Search/filtering inside recommendations.
- Collapsible panels.
- Keyboard shortcuts.
- New dependencies.

## Expected Files

- `src/components/RecommendationsPanel.tsx`
- `src/components/DraftRoom.tsx`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing `AvailablePlayersTable`, seed data, draft types, or recommendation scoring unless implementation reveals a direct compatibility issue.

## Implementation Constraint

Keep the panel presentational.

Do not add:

- New global state.
- Context.
- Reducers.
- API routes.
- Server actions.
- Package dependencies.
- New recommendation scoring rules.

## Layout Rules

- In `DraftRoom`, render the recommendations panel above `AvailablePlayersTable`.
- Keep the existing right sidebar layout for draft status and roster.
- On desktop, the main column should flow:
  1. Recommendations
  2. Available Players header/search/filter
  3. Available Players table
- On smaller widths, preserve the current stacked behavior.

## Component Shape

Create `src/components/RecommendationsPanel.tsx`.

Props:

- `recommendations: Recommendation[]`
- `onDraftPlayer: (playerId: string) => void`

Rendering:

- Use a section with heading `Recommendations`.
- Include a short helper line such as `Ranking-based suggestions from available players.`
- Render a compact list of recommendation rows or cards.
- Each item should show:
  - Recommendation index.
  - Player name.
  - Team and position.
  - Overall rank.
  - Score.
  - Reasons.
  - Draft button.
- If the list is empty, render a compact empty state.

## DraftRoom Integration

In `DraftRoom`:

1. Import `generateTopRecommendations`.
2. Import `RecommendationsPanel`.
3. Derive `recommendations` with `useMemo` from `availableRankings`.
4. Render `RecommendationsPanel` before `AvailablePlayersTable`.
5. Pass the existing `draftPlayer` handler into both the recommendation panel and table.

Do not duplicate draft logic.

## Implementation Steps

1. Create `src/components/RecommendationsPanel.tsx`.
   - Import `Recommendation` as a type.
   - Implement the presentational panel.
   - Keep styling consistent with existing white bordered panels.
   - Include a draft button per recommendation.

2. Update `src/components/DraftRoom.tsx`.
   - Import the recommendation helper and panel.
   - Derive recommendations from `availableRankings`.
   - Render the panel above `AvailablePlayersTable`.

3. Update `docs/tasks.md`.
   - Mark `Display recommendations` complete.
   - Mark `Display recommendation reasons` complete.
   - Leave tier warnings, scarcity warnings, and highlight user pick unchecked.

4. Validate.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If practical, request the local page and verify `Recommendations` renders above `Available Players`.

5. Manual smoke test.
   - Confirm the panel initially shows 5 recommendations.
   - Confirm Ja'Marr Chase is initially first.
   - Draft the top recommendation from the panel.
   - Confirm that player disappears from recommendations and available players.
   - Undo the pick.
   - Confirm that player returns to recommendations and available players.

## Acceptance Criteria

- A `Recommendations` panel renders above the available players list and search bar.
- The panel shows 5 recommendations when at least 5 players are available.
- The initial top recommendation is Ja'Marr Chase.
- Each recommendation shows player identity, overall rank, score, and reasons.
- Each recommendation has a working `Draft` button.
- Drafting from recommendations advances draft state.
- Drafted recommendation disappears from recommendations and available players.
- Undo restores the player to recommendations and available players when appropriate.
- Existing search and position filtering still work in `AvailablePlayersTable`.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This panel is still ranking-only. It is expected to mirror the highest available overall-ranked players, not account for roster construction yet.

Do not judge strategic usefulness from this slice alone. The purpose is to make the recommendation loop visible so later scoring slices can be validated quickly.

## Slice Review

- Smallest meaningful increment: yes, this only displays existing top-5 ranking recommendations and wires draft buttons.
- Concrete enough for implementation: yes, component props, layout, data flow, task updates, and acceptance criteria are explicit.
- Avoids unnecessary architecture changes: yes, recommendations remain derived from existing local draft state and pure helper logic.
- Blast radius reasonable: yes, expected changes are one new component, one parent component, and task docs.
- Review/revert comfort: yes, the UI panel can be removed without affecting draft state or scoring logic.
- Observable/testable acceptance criteria: yes, rendering, ordering, draft, undo, lint, and build are all directly testable.
