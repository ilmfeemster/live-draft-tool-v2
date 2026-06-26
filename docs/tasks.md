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

### [x] 8. Add Draft History And Resume Flow

Goal:

Provide a simple way to reopen previously created drafts.

Scope:

- [x] Add a draft summary list.
- [x] Allow selecting and loading an existing draft.
- [x] Show enough summary data to distinguish drafts.
- [x] Keep the flow single-user and local to Phase 2 scope.

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

### [x] 9. Add New Draft Creation Flow

Goal:

Provide a clear way to start a fresh persisted draft without manually editing the database or relying on reset.

The app currently persists and resumes drafts, but it does not give the user an intentional workflow for creating a new draft after completion or by choice. Reset is useful for manual QA, but it is not the same product action as saving a completed draft and starting another one.

Scope:

- Add a server action that creates a new persisted draft using the current MVP default settings and seed ranking snapshot.
- Add a visible "New Draft" or "Start New Draft" control to the draft page or draft history area.
- After creation, navigate to the newly created draft using the existing `?draftId=<id>` resume flow.
- Preserve existing completed drafts in draft history.
- When the current draft is complete, show a clear completion prompt with an option to start a new draft.
- Keep the flow single-user and local to Phase 2 scope.

Non-Goals:

- Custom league setup UI.
- Ranking import or ranking selection UI.
- Draft templates.
- Draft duplication.
- Deleting completed drafts.
- Accounts or multi-user draft ownership.
- Changing the current auto-save behavior.

Acceptance Criteria:

- A user can intentionally create a new persisted draft.
- Creating a new draft does not overwrite, reset, or delete the current draft.
- The new draft appears in draft history.
- The app navigates to the newly created draft.
- A completed draft shows an obvious option to start another draft.
- Existing resume, draft, undo, and reset behavior still work.

### [ ] 10. Use Distinguishable Automatic Draft Names

Goal:

Make newly created drafts easy to tell apart without adding a naming or editing workflow.

The current creation flow names every user-created draft `New Draft`, while the first automatically created workspace may be named `Default Draft`. That is enough for persistence plumbing, but it becomes confusing as soon as draft history contains more than one record.

Scope:

- Replace generic draft names with deterministic automatic names.
- Prefer creation date and time in the display name, such as `Draft - Jun 26, 2026, 5:42 PM`.
- Apply the naming behavior consistently to drafts created by the default loader and the Start New Draft action.
- Keep names readable in draft history cards.
- Add focused test coverage for the naming behavior at the creation boundary.

Non-Goals:

- User-entered draft names.
- Draft renaming.
- Draft templates.
- League-specific naming.
- Backfilling or migrating existing draft names.

Acceptance Criteria:

- Newly created persisted drafts no longer all appear as `New Draft`.
- Automatically created first drafts no longer rely on `Default Draft` as the long-term display pattern.
- Draft history can distinguish multiple newly created drafts by name and timestamp.
- Existing persisted drafts without the new naming pattern still render safely.
- Existing create, load, resume, draft, undo, reset, and history behavior still works.

### [ ] 11. Make Draft History Compact And Separate Completed Drafts

Goal:

Keep draft history useful without letting it push the active draft workspace down the page.

Draft history is currently rendered as a growing grid above the main draft room. That works for one or two drafts, but it becomes noisy once the app supports starting multiple drafts. Completed drafts are especially different from active drafts: they are useful history, but they should not compete with the current draft workflow.

Scope:

- Replace the large stacked history grid with a compact history surface.
- Use a horizontal scroll row, collapsible section, or similarly small-footprint layout for active and in-progress drafts.
- Keep the currently loaded draft visually clear.
- Move completed drafts into a separate completed/history section.
- Make the completed section lower priority than active/in-progress drafts and allow it to be collapsed or visually minimized.
- Preserve resume links through the existing `?draftId=<id>` route.
- Preserve the summary information needed to distinguish drafts.

Non-Goals:

- Full draft management screen.
- Search, filters, tags, or sorting controls beyond simple status grouping.
- Draft deletion.
- Draft renaming.
- Advanced historical analytics.
- Mobile-first redesign.

Acceptance Criteria:

- A growing draft history no longer pushes the main draft room far down the page.
- Active and in-progress drafts remain easy to reopen.
- Completed drafts are displayed separately from active/in-progress drafts.
- The loaded draft remains obvious.
- Resume links still load the selected persisted draft.
- Existing new draft, draft, undo, reset, recommendation, and roster behavior still works.

### [ ] 12. Add Safe Draft Deletion

Goal:

Allow unwanted persisted drafts to be removed intentionally so local draft history stays manageable.

Reset clears the current draft's picks, but it does not remove a draft workspace. Once new draft creation exists, the app needs a separate destructive workflow for deleting accidental, test, or old drafts.

Scope:

- Add repository support for deleting a draft workspace and its owned persistence records.
- Add a server action for deleting a draft by id.
- Add delete controls in the draft history UI for current and historical drafts.
- Require browser confirmation before deletion.
- If the currently loaded draft is deleted, navigate to the latest remaining draft or allow the existing loader to create/load a fallback draft.
- Keep deletion single-user and local to Phase 2.
- Add focused repository and server-action test coverage.

Non-Goals:

- Bulk deletion.
- Archive/restore.
- Soft delete.
- Audit log.
- Account-aware authorization.
- Deleting individual picks outside the existing undo/reset flows.

Acceptance Criteria:

- A user can delete an unwanted persisted draft from draft history.
- Deleting a draft removes it from draft history after navigation or refresh.
- Deleting one draft does not delete or mutate other drafts.
- Deleting the currently loaded draft leaves the app in a valid loaded-draft state.
- Destructive deletion requires confirmation.
- Existing create, resume, draft, undo, reset, available-player, roster, and recommendation behavior still works.

### [ ] 13. Complete Phase 2 Persistence Validation

Goal:

Prove that persistence preserves the manual draft workflow end to end.

Scope:

- [x] Add or update integration coverage for save/load round trips.
- [x] Validate draft invariants after hydration.
- [x] Validate recommendation inputs before and after reload.
- [x] Include a non-default league configuration test.
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
- [x] Start a new persisted draft without overwriting an existing draft.
- [ ] Use distinguishable automatic names for new persisted drafts.
- [ ] Keep completed drafts separate from the active draft workflow.
- [ ] Delete unwanted persisted drafts safely.
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
- Custom draft naming and renaming
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
