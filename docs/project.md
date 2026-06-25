# Project

## Active Phase

Phase 2 - Persistence

The current project phase is focused on making draft state and configuration durable across application sessions.

Phase 1 established the manual draft simulator and in-memory draft state engine. Phase 2 should preserve that working draft experience while introducing persistence underneath it.

---

## Product Goal

Build a single-user fantasy football draft assistant that can resume draft work across sessions.

The tool helps users make better draft decisions by combining rankings, roster context, positional scarcity, and tier information during a live draft.

The app is a companion tool, not a fantasy platform.

For Phase 2, the product should move from an in-memory draft simulator to a durable draft workspace where drafts, settings, picks, rosters, and ranking snapshots can survive browser refreshes and application restarts.

---

## Target User

The initial user is the developer.

The user participates in live fantasy football drafts and wants better decision support than a static rankings sheet provides.

During Phase 2, the user should be able to pause, close, refresh, or restart the app without losing draft setup or draft progress.

---

## Phase Goals

Phase 2 should deliver:

- Persistent draft state.
- Persistent draft configuration.
- Persistent ranking snapshots associated with drafts.
- A way to save and load existing drafts.
- Draft history for previously created drafts.
- A persistence layer that supports future replay testing, historical analysis, and user accounts without requiring those features now.

The phase is successful only if persistence supports the existing manual draft workflow without making the draft engine source-specific or platform-specific.

---

## Scope

### In Scope

- Store draft records.
- Store league and draft configuration.
- Store draft picks.
- Store enough roster-related state or derivable data to restore a draft accurately.
- Store ranking snapshots used by a draft.
- Load an existing draft into the current app workflow.
- Resume an incomplete draft after refresh or restart.
- View or select from previously created drafts.
- Keep the existing manual pick-entry workflow working.
- Introduce a simple API/data-access boundary for persistence.
- Preserve deterministic recommendation behavior after loading a draft.

### Out of Scope

- Authentication.
- Multi-user support.
- Cloud user accounts.
- Real-time collaboration.
- ESPN integration.
- Yahoo integration.
- Sleeper integration.
- WebSocket sync.
- AI chat assistant.
- Simulations.
- Dynasty support.
- Auction drafts.
- Keeper leagues.
- Mobile app.
- Machine learning recommendations.
- News/injury ingestion.
- Payments.
- Advanced historical analytics.
- Replay tooling beyond what persistence naturally enables.

---

## MVP League Settings

- 12 Teams
- Redraft
- Snake Draft
- 1QB
- PPR assumed

### Starting Lineup

- QB
- RB
- RB
- WR
- WR
- TE
- FLEX
- FLEX
- DST
- K

### Bench

- 6 Bench Spots

---

## Core Workflow

### Before Draft

- Create draft.
- Import or select rankings.
- Set draft position.
- Save draft setup.
- Start draft.

### During Draft

- Enter picks manually.
- Track drafted players.
- Update available player pool.
- Update user roster.
- Generate recommendations.
- Persist draft progress.

### Returning to a Draft

- View existing drafts.
- Load an incomplete draft.
- Restore draft setup, picks, available players, roster, and recommendations.
- Continue entering picks from the correct draft position.

### On User Pick

Display:

- Top recommendations.
- Recommendation reasoning.
- Tier warnings.
- Positional scarcity warnings.
- Roster needs.

---

## Milestones

### Milestone 1 - Persistence Model

Define the durable data shape for drafts, picks, league settings, draft settings, and ranking snapshots.

The model should reflect current domain concepts without introducing user accounts or provider-specific assumptions.

### Milestone 2 - Save Draft Progress

Persist draft setup and pick history as the manual draft progresses.

The existing in-memory workflow should continue to behave correctly while draft state is written to durable storage.

### Milestone 3 - Load And Resume Drafts

Load saved draft state back into the app and reconstruct the same draft workflow the user had before leaving.

Loaded drafts should restore available players, user roster, current pick, draft board, and recommendations.

### Milestone 4 - Draft History

Provide a simple way to see and reopen previously created drafts.

This should remain a utility for the single-user workflow, not an account or collaboration system.

### Milestone 5 - Persistence Validation

Validate that saved and loaded drafts preserve draft invariants and recommendation behavior.

Testing should prove that persistence does not corrupt draft state or create duplicate player availability.

---

## Architecture Impact

Phase 2 introduces a Persistence Layer beneath the Draft State Engine.

The intended architecture becomes:

```text
Presentation Layer
        |
Recommendation Engine
        |
Draft State Engine
        |
Persistence Layer
        |
Database
```

The Draft State Engine should remain the core source of draft rules and state transitions. Persistence should store and restore draft state; it should not own draft business rules.

The persistence layer should use the existing monolith-first Next.js direction:

- Next.js app routes or server actions where appropriate.
- Prisma for data access.
- PostgreSQL as the durable database.
- Simple repository/data-access functions before adding broader abstractions.

Important boundaries:

- Platform-specific provider logic must not leak into persisted core draft models.
- Recommendation logic should continue to consume draft state, not database implementation details.
- Ranking snapshots should make saved drafts stable even when future rankings change.
- Data models should be shaped for current single-user persistence, while avoiding choices that would block future accounts.

---

## Success Criteria

Phase 2 is successful when a user can:

1. Create a draft with the existing league assumptions.
2. Save draft setup and ranking context.
3. Enter manual picks.
4. Refresh or restart the app without losing draft progress.
5. Reopen an incomplete draft from draft history.
6. Continue drafting from the correct pick.
7. See drafted players, available players, user roster, and recommendations restored accurately.
8. Complete a full 12-team draft from a persisted draft state.
9. Confirm draft invariants still hold after saving and loading.

The product should feel like a durable draft workspace rather than a disposable in-memory simulator.

---

## Product Principles

- Prioritize draft speed over feature depth.
- Preserve the working manual draft flow.
- Prefer simple, inspectable persistence.
- Keep draft rules in the Draft State Engine.
- Keep recommendation logic understandable.
- Avoid account, provider, and multiplayer complexity during Phase 2.
- Add only the persistence structure needed to resume drafts reliably.
