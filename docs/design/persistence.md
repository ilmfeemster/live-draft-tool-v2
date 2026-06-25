# Persistence Design

## Purpose

Phase 2 introduces durable storage for draft state and configuration.

The goal of this document is to remove architectural ambiguity before implementation tasks are created. It defines the persistence boundary, durable data shape, state reconstruction flow, and the decisions that should guide Phase 2 planning.

This is a design document, not an implementation task list.

---

## Context

Phase 1 produced an in-memory manual draft simulator built around the `Draft` domain model.

Current draft behavior is derived from:

- `Draft`
- `DraftPick[]`
- `Team[]`
- `RankingEntry[]`

The app currently derives available players, user roster, draft status, and recommendations from those inputs. That derivation should remain true in Phase 2.

Phase 2 should make drafts durable without changing the product into a fantasy platform, account system, or live provider integration.

---

## Goals

Persistence should support:

- Saving draft setup.
- Saving league settings as source configuration for each draft.
- Saving pick progress.
- Loading an incomplete or complete draft.
- Restoring the same available player pool after reload.
- Restoring the same user roster after reload.
- Restoring recommendations from the loaded draft state and ranking snapshot.
- Listing previous drafts.
- Preserving draft invariants after save and load.
- Supporting non-default league configurations without changing persistence code.

---

## Non-Goals

Phase 2 should not introduce:

- Authentication.
- User accounts.
- Multi-user drafts.
- Real-time collaboration.
- External provider sync.
- Replay tooling.
- Advanced historical analytics.
- A generic event sourcing system.
- A full rankings management product.
- Normalized ranking tables.

---

## Architecture Decisions

### Decision: Use Postgres With Prisma

Use PostgreSQL as the durable database and Prisma as the data access layer.

Reason:

This follows the existing architecture document and keeps the app on the monolith-first path. Prisma is enough for the current domain size and keeps database access explicit.

Tradeoffs:

- Adds migration and local database setup work.
- Requires clear mapping between Prisma records and domain types.
- Avoids hand-written SQL for now, which is good for speed but may hide some database-specific constraints.

### Decision: Keep Persistence Beneath The Draft State Engine

Persistence stores and restores draft source state. It does not own draft rules.

The architecture for Phase 2 should be:

```text
Presentation Layer
        |
Recommendation Engine
        |
Draft State Engine
        |
Persistence Layer
        |
PostgreSQL
```

Draft mutations should still flow through draft-domain behavior. The persistence layer should save the result of draft-domain transitions rather than reimplementing draft rules in database code.

Examples:

- Drafting a player should use the draft state transition logic, then persist the changed pick history.
- Undo should use the draft state transition logic, then persist the changed pick history.
- Loading a draft should hydrate the domain model, then let existing derivation produce available players, roster, and recommendations.

### Decision: Store Source State, Not Derived Views

Persist the state required to reconstruct the draft:

- Draft metadata.
- League and draft configuration.
- Draft-local teams or enough configuration to derive them.
- Pick history.
- Ranking snapshot JSON.

Do not persist derived views in Phase 2:

- Available players.
- User roster.
- Recommendation output.
- Draft status display data.
- Draft size or total pick count as hard-coded constants.

Reason:

These are currently deterministic outputs from draft state, league settings, pick history, and rankings. Persisting derived outputs would create multiple sources of truth and increase the chance of stale data.

### Decision: Make Persistence Configuration-Driven

No Phase 2 persistence model, API, repository method, seed data, test fixture, or hydration path should hard-code the default MVP league size.

Persist league settings as source configuration for each draft. Derive draft size, team count, round count, pick count, active team, and roster structure from those persisted settings.

Reason:

The current UI may still create drafts using MVP defaults, but persistence should not bake those defaults into storage or loading. Phase 2 is the point where draft state becomes durable, so the durable model should not require later migration just to support non-default league sizes.

Guardrails:

- Do not hard-code 12 teams.
- Do not hard-code 16 rounds.
- Do not hard-code roster slots.
- Do not hard-code user draft position.
- Do not hard-code draft order length.
- Do not hard-code total pick count.
- Do not assume snake draft order except through an explicit persisted draft type or settings value.

### Decision: Rebuild Draft State From Settings, Ranking Snapshot, And Pick History

Hydration should rebuild the domain-facing `Draft` from persisted league settings, ranking snapshot data, and pick history.

The database does not need to persist every empty future draft slot as source data. Instead, the repository should:

- Read persisted league settings.
- Generate the expected draft order from those settings.
- Overlay persisted pick history onto the generated order.
- Derive `currentPickNumber` from the first undrafted pick, unless the draft is complete.
- Return the hydrated domain `Draft`.

Reason:

This keeps draft size and order configuration-driven. It also avoids storing redundant empty pick slots whose count is already implied by the persisted league settings.

When this recommendation stops being appropriate:

- Draft order generation becomes provider-specific or externally supplied.
- Imported drafts need to preserve irregular historical pick slots.
- Replay files or live integrations introduce event order semantics beyond manual pick history.

### Decision: Store Ranking Snapshots As JSON For Phase 2

Store the ranking snapshot as JSON rather than normalized ranking rows.

Reason:

Phase 2 only needs durable save/load and draft hydration. Ranking snapshots are loaded as whole-draft inputs, not queried independently. JSON better preserves the exact ranking state used by a draft, avoids premature schema complexity while the ranking model is still evolving, and defers normalized ranking storage until Phase 5 when rankings become a first-class feature.

Guardrails:

- Raw JSON must not leak into the Draft State Engine.
- Raw JSON must not leak into the Recommendation Engine.
- Repository functions must expose typed ranking data, such as `RankingEntry[]`.
- The rest of the app should depend on a domain-facing type, not the database storage shape.
- The JSON storage implementation should remain replaceable later without changing engine code.

The snapshot JSON must include enough player data to reconstruct `RankingEntry[]`:

- Player id.
- Player name.
- Player team.
- Player position.
- Overall rank.
- ADP rank.
- Position rank.
- Tier.

### Decision: Do Not Introduce A Global Player Table Yet

For Phase 2, player identity can live inside ranking snapshot JSON.

Reason:

The current app has no independent player catalog. A global `Player` table would mostly anticipate future ranking management and external provider mapping. Phase 2 only needs stable saved drafts.

When this recommendation stops being appropriate:

- Multiple ranking sets share the same player catalog.
- External providers need cross-source player ID mapping.
- News, injuries, projections, or player metadata become first-class product data.
- Phase 5 begins and rankings become a first-class feature.

### Decision: Use Simple Server-Side Data Access Functions

Use server-side persistence functions that expose app-level operations, not raw Prisma access to UI components.

Examples of operation-level boundaries:

- Create draft.
- List draft summaries.
- Load draft workspace.
- Save drafted player.
- Undo last pick.

Reason:

The UI should not understand database shape. The persistence layer should return domain objects or app DTOs that match the draft engine and presentation needs.

### Decision: Prefer Server Actions For Same-App Mutations

For Phase 2, server actions are the preferred boundary for same-app draft mutations and loading flows. Route handlers should be reserved for cases where an HTTP API is specifically needed.

Reason:

The current app is a Next.js monolith without external clients. Server actions keep the flow simple and avoid designing a public API before one exists.

When this recommendation stops being appropriate:

- A browser extension, mobile client, or external integration needs HTTP endpoints.
- Live provider webhooks or polling endpoints become active scope.
- API contracts need to be consumed outside the Next.js app.

---

## Domain-Facing Configuration

Persistence should define or support a typed league configuration shape before writing it to storage.

Suggested shape:

```ts
type LeagueSettings = {
  teamCount: number;
  rounds: number;
  draftType: "SNAKE";
  scoringFormat: "PPR";
  rosterSlots: RosterSlot[];
};

type RosterSlot = {
  id: string;
  label: string;
  eligiblePositions: Position[];
};
```

Notes:

- The exact type can evolve during implementation planning.
- `teamCount` and `rounds` should come from persisted settings, not constants.
- Roster structure should come from persisted settings, not UI defaults.
- The current UI can still create this configuration from MVP defaults.
- Repository and hydration tests should include at least one non-default configuration.

---

## Proposed Durable Model

This model describes durable concepts. Exact Prisma syntax should be decided during implementation planning.

### Draft

Represents one saved draft workspace.

Suggested fields:

- `id`
- `name`
- `status`
- `leagueSettingsJson`
- `userTeamId`
- `rankingSnapshotId`
- `createdAt`
- `updatedAt`

Notes:

- `status` can start simple, such as `IN_PROGRESS` and `COMPLETE`.
- Pick count should be derived from `leagueSettingsJson`, not stored as a hard-coded value.
- Team count should be read from `leagueSettingsJson`.
- Rounds should be read from `leagueSettingsJson`.
- Roster slots should be read from `leagueSettingsJson`.
- `userTeamId` may remain a draft-local identifier, such as `team-2`.
- Current pick can be derived from pick history during hydration. If stored for convenience, it must be validated against pick history and settings.

### DraftTeam

Represents a team inside a draft when team names or draft-local identity need to be persisted separately from generated defaults.

Suggested fields:

- `id`
- `draftId`
- `teamId`
- `name`
- `draftPosition`

Notes:

- `teamId` should preserve the domain identifier shape, such as `team-2`.
- `draftId` plus `teamId` should be unique.
- No user account relationship should be added in Phase 2.
- Team count must agree with persisted league settings.
- If team names remain generated defaults, this table can be deferred and teams can be derived from league settings.

### DraftPick

Represents one drafted player in the pick history.

Suggested fields:

- `id`
- `draftId`
- `pickNumber`
- `playerId`
- `draftedAt`

Notes:

- Only made picks need to be persisted.
- `draftId` plus `pickNumber` should be unique.
- `draftId` plus `playerId` should prevent duplicate drafted players.
- `pickNumber` must be valid for the draft size derived from persisted league settings.
- `round`, `pickInRound`, and `teamId` should be derived during hydration from persisted settings and pick number.

### RankingSnapshot

Represents the ranking context frozen for a draft.

Suggested fields:

- `id`
- `name`
- `source`
- `rankingsJson`
- `createdAt`

Notes:

- The snapshot is immutable once a draft uses it.
- `rankingsJson` stores the full ranking snapshot for Phase 2.
- Repository code must parse and validate `rankingsJson` into `RankingEntry[]`.
- Phase 2 does not need ranking profile management or normalized ranking rows.

---

## Hydration Shape

Loading a draft should produce a workspace object that can feed the current app:

```ts
type DraftWorkspace = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
};
```

The persistence layer should map database records into this shape.

The UI and engines should receive typed domain-facing data. They should not receive database JSON blobs.

The UI should continue deriving:

- Drafted player IDs.
- Available rankings.
- User roster players.
- Recommendations.
- Draft completion status.

---

## Hydration Flow

Load draft should:

- Query draft metadata, league settings JSON, pick history, and ranking snapshot JSON.
- Parse and validate league settings into a typed domain-facing configuration.
- Parse and validate ranking snapshot JSON into `RankingEntry[]`.
- Generate draft teams from persisted settings, unless persisted team names override generated names.
- Generate draft order from persisted settings.
- Overlay pick history onto the generated draft order.
- Derive `currentPickNumber` from the first undrafted pick, unless the draft is complete.
- Sort rankings by overall rank.
- Map the result to `Draft`, `RankingEntry[]`, and `LeagueSettings`.
- Validate basic draft invariants before returning when practical.

Hydration must not assume the MVP default team count, rounds, roster slots, draft position, draft order length, or total pick count.

---

## Mutation Flow

### Create Draft

Create draft should:

- Accept typed league settings.
- Accept typed rankings.
- Store league settings as the draft's source configuration.
- Store rankings as immutable snapshot JSON.
- Create a draft record.
- Create draft-local teams only if team names or identities need persistence beyond generated defaults.
- Return a hydrated `DraftWorkspace`.

The current UI may pass MVP defaults, but the create flow should accept non-default settings.

### Draft Player

Draft player should:

- Load the draft aggregate.
- Hydrate the domain `Draft` from persisted settings, ranking snapshot, and pick history.
- Validate that the player exists in the draft ranking snapshot.
- Apply the existing draft transition.
- Persist changed pick history in a transaction.
- Return the updated `DraftWorkspace` or updated `Draft`.

### Undo Last Pick

Undo should:

- Load the draft aggregate.
- Hydrate the domain `Draft` from persisted settings, ranking snapshot, and pick history.
- Apply the existing undo transition.
- Persist changed pick history in a transaction.
- Return the updated `DraftWorkspace` or updated `Draft`.

### List Drafts

List drafts should:

- Return draft summaries.
- Avoid loading full ranking snapshot JSON unless needed.
- Derive summary fields from persisted settings and pick history when practical.

---

## Consistency Rules

The persistence layer should protect these rules:

- League settings must be valid before a draft is created.
- Team count, rounds, roster slots, draft type, and scoring format must come from persisted settings.
- A persisted pick number must be within the total pick count derived from league settings.
- Every persisted pick belongs to exactly one draft.
- A drafted player cannot appear in more than one pick for the same draft.
- A drafted player must exist in the draft's typed ranking snapshot.
- `currentPickNumber` should be derived from the first undrafted pick, unless the draft is complete.
- Draft completion should be derived from pick history or synchronized from it.
- Ranking snapshot JSON must not change after drafts reference it.

The database should enforce simple structural constraints. Repository validation and integration tests should enforce behavior-level rules.

---

## Testing Strategy Impact

Phase 2 should add persistence confidence without overbuilding test infrastructure.

Important test coverage areas:

- Mapping database records to `Draft`.
- Parsing ranking snapshot JSON into `RankingEntry[]`.
- Parsing league settings JSON into typed settings.
- Save and load round trips.
- Drafting a player and reloading the draft.
- Undoing a pick and reloading the draft.
- Duplicate drafted player prevention.
- Draft invariants after load.
- Recommendation inputs are the same before and after load.
- At least one persistence or hydration test using a non-default league configuration.

Database-backed integration tests are valuable here because persistence bugs often live at the boundary between records and domain objects.

Tests should not hard-code the default MVP league size unless the test is explicitly about the default UI-created draft.

---

## Alternatives And Open Questions

### Database Provider

Option A: Local Docker PostgreSQL.

Pros:

- Good local development isolation.
- No cloud account required.
- Matches production Postgres behavior closely.

Cons:

- Requires Docker setup.
- Slightly more local environment management.

Option B: Hosted PostgreSQL such as Supabase or Neon.

Pros:

- Easier persistence across machines.
- Closer to likely deployed environment.
- Less local infrastructure once configured.

Cons:

- Requires account/project setup.
- Network dependency during development.
- Environment variable management becomes important earlier.

Recommendation:

Keep the architecture provider-neutral and use Postgres-compatible Prisma migrations. Choose the provider during implementation planning based on the desired development workflow.

Open question before task planning:

Should the first implementation target local Docker Postgres, hosted Postgres, or both local and hosted environments?

### Draft Completion Storage

Option A: Store `status` on `Draft`.

Pros:

- Draft history can quickly show complete or in-progress state.
- Simple UI filtering later.

Cons:

- Status can drift from pick history if updates are buggy.

Option B: Derive completion from picks every time.

Pros:

- No duplicated state.
- Impossible for status to drift.

Cons:

- Slightly less convenient for draft history queries.

Recommendation:

Store a simple `status`, but treat pick history as the source of truth. Update status inside the same transaction as pick changes.

Open question before task planning:

Is draft history expected to filter or group by status in Phase 2, or can status be derived until the UI needs it?

---

## Implementation Planning Guidance

When tasks are created, they should preserve this sequence of responsibility:

```text
database records
        |
persistence mappers and validators
        |
domain Draft, LeagueSettings, and RankingEntry objects
        |
existing draft and recommendation logic
        |
UI
```

Avoid tasks that make React components speak directly to Prisma models.

Avoid tasks that make the Draft State Engine or Recommendation Engine parse raw JSON.

Avoid tasks that persist derived recommendation or roster output.

Avoid tasks that hard-code MVP default league size into repository methods, seed data, fixtures, or hydration paths.

Avoid tasks that introduce users, providers, or replay abstractions as part of Phase 2 persistence.
