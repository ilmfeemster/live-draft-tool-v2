# Tasks

## Current Focus

Build Phase 2: Persistence.

Phase 2 turns the in-memory manual draft simulator into a durable draft workspace. Draft setup, league settings, ranking snapshots, and pick history should survive refreshes and application restarts.

Success means a user can create or load a persisted draft, continue entering manual picks, and receive the same derived available players, roster, and recommendations after reload.

---

## Phase 2 Task Principles

- Keep persistence beneath the Draft State Engine.
- Store source state, not derived views.
- Expose typed domain-facing data from repositories.
- Do not let raw JSON leak into the Draft State Engine or Recommendation Engine.
- Do not hard-code MVP league defaults in persistence, hydration, fixtures, or repository APIs.
- Keep each task small enough to promote into `docs/current-slice.md`.

---

## Next Tasks

### [x] 1. Define League Settings And Draft Workspace Types

Goal:

Introduce typed domain-facing configuration and workspace shapes that persistence can use without exposing database storage details.

Scope:

- Define a `LeagueSettings` type.
- Define a `RosterSlot` type or equivalent roster configuration shape.
- Define a `DraftWorkspace` type containing `Draft`, `RankingEntry[]`, and league settings.
- Add default MVP league settings as data, not as persistence assumptions.
- Ensure existing draft creation can still use MVP defaults.

Non-Goals:

- Database schema.
- UI settings editor.
- Custom league setup UI.

Acceptance Criteria:

- Draft configuration can represent the current MVP settings.
- Draft configuration can represent at least one non-default team count and round count.
- Existing draft and recommendation code can still consume typed `Draft` and `RankingEntry[]`.
- No persistence-facing type requires 12 teams, 16 rounds, or fixed roster slots.

### [x] 2. Add Configuration-Driven Draft Hydration Helpers

Goal:

Create pure helpers that rebuild draft state from league settings, ranking snapshot data, and pick history.

Scope:

- Generate teams and draft order from `LeagueSettings`.
- Overlay persisted pick history onto generated draft order.
- Derive current pick from the first undrafted pick.
- Preserve existing draft invariants after hydration.
- Add unit tests, including one non-default league configuration.

Non-Goals:

- Prisma.
- Server actions.
- Database reads or writes.

Acceptance Criteria:

- Hydration returns a valid `Draft` for MVP settings.
- Hydration returns a valid `Draft` for a non-default league configuration.
- Pick count is derived from settings.
- Active team, round, and pick-in-round are derived from settings and pick history.
- Tests prove hydration does not assume MVP league size.

### [x] 3. Add Ranking Snapshot JSON Mappers

Goal:

Keep ranking snapshot JSON behind a mapper boundary and expose typed `RankingEntry[]` to the rest of the app.

Scope:

- Add serialization from `RankingEntry[]` to snapshot JSON.
- Add parsing and validation from snapshot JSON to `RankingEntry[]`.
- Preserve the exact ranking state needed for draft hydration and recommendations.
- Add tests for valid snapshots and malformed snapshots.

Non-Goals:

- Normalized ranking rows.
- Ranking management UI.
- Global player table.

Acceptance Criteria:

- Repository-facing code can serialize rankings into JSON.
- App-facing code receives typed `RankingEntry[]`.
- Invalid snapshot JSON fails before reaching draft or recommendation engines.
- Tests confirm the mapper preserves player, rank, ADP, position rank, and tier data.

### [x] 4. Configure Prisma And Persistence Schema

Goal:

Introduce the database foundation for persisted drafts, settings, pick history, and JSON ranking snapshots.

Scope:

- Add Prisma dependency and setup.
- Add the initial Prisma schema.
- Model drafts with league settings JSON, user team id, status, and ranking snapshot reference.
- Model ranking snapshots with JSON rankings.
- Model persisted draft pick history.
- Add migration workflow documentation or scripts as needed for the selected database provider.

Non-Goals:

- UI integration.
- Authentication.
- Normalized ranking rows.
- Provider-specific draft data.

Acceptance Criteria:

- Prisma schema supports persisted draft source state.
- Schema does not hard-code team count, round count, roster slots, draft size, or draft order length.
- Ranking snapshots are stored as JSON.
- Pick history stores made picks without requiring empty future pick rows.
- Existing app tests still pass.

### [x] 5. Implement Draft Repository Mapping

Goal:

Create the repository layer that maps database records to typed domain-facing draft workspaces.

Scope:

- [x] Add repository functions for creating, loading, and listing draft records.
- [x] Parse league settings JSON into typed settings.
- [x] Parse ranking snapshot JSON into `RankingEntry[]`.
- [x] Hydrate `Draft` through the configuration-driven helpers.
- [x] Keep raw JSON out of UI, Draft State Engine, and Recommendation Engine.
- [x] Add pure mapping tests using a non-default league configuration.
- [x] Add repository tests for create/load/list behavior.

Non-Goals:

- Draft pick mutation server actions.
- Draft history UI.
- Browser refresh flow.

Acceptance Criteria:

- Creating a draft stores league settings and ranking snapshot source state.
- Loading a draft returns `DraftWorkspace`.
- Listing drafts returns summaries without loading full ranking JSON unnecessarily.
- Tests prove loaded drafts are valid for default and non-default settings.
- No engine code imports Prisma types or parses raw JSON.

### [x] 6. Persist Manual Draft Pick Mutations

Goal:

Persist manual draft progress while preserving existing draft state transition behavior.

Scope:

- [x] Add repository operations for drafting a player and undoing the last pick.
- [x] Load and hydrate the draft before applying existing draft transition logic.
- [x] Persist changed pick history in a transaction.
- [x] Update draft status consistently with pick history.
- [x] Add tests for draft, reload, undo, duplicate prevention, and completion status.
- [x] Add server-side operations that call the repository mutations.

Non-Goals:

- Draft history UI.
- Custom draft settings UI.
- Recommendation logic changes.

Acceptance Criteria:

- Drafting a player persists the pick.
- Reloading the draft restores the pick and current pick position.
- Undo removes the latest persisted pick and restores the current pick.
- Duplicate drafted players are rejected or prevented.
- Recommendations remain derived from the loaded draft and ranking snapshot.

### [x] 7. Wire The App To Load A Persisted Draft Workspace

Goal:

Connect the current draft room to a persisted draft workspace without making UI components depend on database details.

Scope:

- [x] Load an existing or newly created persisted draft into the page.
- [x] Pass typed `DraftWorkspace` data into existing draft UI.
- [x] Replace direct usage of static `defaultDraft` where persistence is active.
- [x] Keep current UI behavior usable with MVP default settings.
- [x] Persist draft room draft and undo interactions through server actions.

Non-Goals:

- Full draft history screen.
- Custom league setup UI.
- Styling overhaul.

Acceptance Criteria:

- The draft room renders from a persisted `DraftWorkspace`.
- Available players, roster, status, and recommendations still derive correctly.
- Refreshing the page restores the persisted draft state.
- UI components do not import Prisma models or raw database JSON.

### [x] Phase 2 Manual QA Support: Reset Current Draft

Goal:

Add a safe, explicit reset control for clearing the current persisted draft's pick history during manual persistence testing.

Scope:

- Clear persisted picks for the current draft only.
- Preserve draft settings and ranking snapshot.
- Restore the current draft to pick 1 and `NOT_STARTED`.
- Require confirmation before resetting.

### [ ] 8. Add Draft History And Resume Flow

Goal:

Provide a simple way to reopen previously created drafts.

Scope:

- Add a draft summary list.
- Allow selecting and loading an existing draft.
- Show enough summary data to distinguish drafts.
- Keep the flow single-user and local to Phase 2 scope.

Non-Goals:

- Accounts.
- Sharing.
- Advanced historical analytics.
- Draft grading.

Acceptance Criteria:

- A user can see previously created drafts.
- A user can reopen an incomplete draft.
- Reopened drafts restore picks, available players, roster, and recommendations.
- Draft history does not require loading full ranking snapshot JSON for every row.

### [ ] 9. Complete Phase 2 Persistence Validation

Goal:

Prove that persistence preserves the manual draft workflow end to end.

Scope:

- Add or update integration coverage for save/load round trips.
- Validate draft invariants after hydration.
- Validate recommendation inputs before and after reload.
- Include a non-default league configuration test.
- Complete manual QA for refresh/restart and full draft completion from persisted state.

Non-Goals:

- Broad UI test suite.
- Live provider testing.
- Replay testing.

Acceptance Criteria:

- A persisted draft can survive refresh or restart.
- A full 12-team draft can be completed from persisted state.
- At least one non-default league configuration passes persistence or hydration tests.
- Draft invariants hold after save, load, draft, and undo.
- Existing Phase 1 regression coverage remains green.

---

## Phase 2 Validation Checklist

Before Phase 2 is complete:

- [x] Persist draft setup.
- [x] Persist league settings as source configuration.
- [x] Persist ranking snapshots as JSON.
- [x] Expose typed `RankingEntry[]` from repository mapping code.
- [ ] Persist manual pick history.
- [x] Hydrate `Draft` from settings, ranking snapshot, and pick history.
- [ ] Resume an incomplete draft after refresh or restart.
- [ ] Reopen a draft from draft history.
- [ ] Verify recommendations remain derived after reload.
- [x] Verify no raw ranking JSON reaches the Draft State Engine or Recommendation Engine.
- [x] Verify persistence and hydration do not assume MVP league defaults.
- [x] Verify at least one non-default league configuration.
- [ ] Complete a full persisted 12-team draft.

---

## Testing Status

Phase 1 testing is complete for the manual draft simulator scope. Automated coverage includes draft order, draft state transitions, invariants, recommendation updates, small workflow integration, full small-draft completion, undo after completion, and recommendation modifier behavior. Manual QA coverage is captured in `docs/manual-full-draft-qa.md`.

Phase 2 testing should focus on persistence boundaries:

- typed league settings validation
- ranking snapshot JSON mapping
- hydration from settings and pick history
- repository save/load behavior
- draft and undo persistence
- non-default league configuration coverage
- persisted full-draft manual QA

---

## Backlog

Not required for Phase 2:

- Authentication
- Multi-user support
- Custom league settings UI
- Normalized ranking tables
- Global player table
- Replay tooling
- Live provider integrations
- Keyboard shortcuts
- Improved search UX
- Player notes
- Watchlist
- Player queue
- Draft recap grading
- ADP comparison
- Historical draft analysis

See `future_ideas.md` for additional ideas.

---

## Completed

### Phase 1 - Draft State Engine

- [x] Create Next.js app
- [x] Configure TypeScript
- [x] Setup Tailwind CSS
- [x] Setup Git repository
- [x] Create docs folder
- [x] Define Player type
- [x] Define RankingEntry type
- [x] Define DraftPick type
- [x] Define Draft type
- [x] Define Team type
- [x] Define UserRoster type
- [x] Define Recommendation type
- [x] Create seed rankings dataset
- [x] Load rankings into application state
- [x] Render available players table
- [x] Add position filtering
- [x] Add ranking sorting
- [x] Generate snake draft order
- [x] Track current pick
- [x] Track current round
- [x] Track active drafting team
- [x] Mark drafted players unavailable
- [x] Build player search
- [x] Draft selected player
- [x] Advance draft state
- [x] Add undo functionality
- [x] Detect user picks
- [x] Add player to roster
- [x] Display roster slots
- [x] Display positional counts
- [x] Detect overfilled positions
- [x] Add ranking score
- [x] Add roster need modifier
- [x] Add scarcity modifier
- [x] Add tier-drop modifier
- [x] Generate top 5 recommendations
- [x] Generate recommendation explanations
- [x] Display recommendations
- [x] Display recommendation reasons
- [x] Display tier warnings
- [x] Display scarcity warnings
- [x] Highlight user pick
- [x] Complete full mock draft
- [x] Verify drafted players disappear
- [x] Verify roster tracking
- [x] Verify recommendation updates
- [x] Verify snake draft logic
- [x] Verify undo functionality
- [x] Verify no duplicate drafted players
- [x] Verify extra picks are blocked after the draft is complete
