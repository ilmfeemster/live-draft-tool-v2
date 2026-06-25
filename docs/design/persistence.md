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
- Saving pick progress.
- Loading an incomplete or complete draft.
- Restoring the same available player pool after reload.
- Restoring the same user roster after reload.
- Restoring recommendations from the loaded draft state and ranking snapshot.
- Listing previous drafts.
- Preserving draft invariants after save and load.

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

---

## Architecture Decision

### Decision: Use Postgres With Prisma

Use PostgreSQL as the durable database and Prisma as the data access layer.

Reason:

This follows the existing architecture document and keeps the app on the monolith-first path. Prisma is enough for the current domain size and keeps database access explicit.

Tradeoffs:

- Adds migration and local database setup work.
- Requires clear mapping between Prisma records and domain types.
- Avoids hand-written SQL for now, which is good for speed but may hide some database-specific constraints.

### Decision: Keep Persistence Beneath The Draft State Engine

Persistence stores and restores draft state. It does not own draft rules.

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

- Drafting a player should use the draft state transition logic, then persist the changed draft.
- Undo should use the draft state transition logic, then persist the changed draft.
- Loading a draft should hydrate the domain model, then let existing derivation produce available players, roster, and recommendations.

### Decision: Store Source State, Not Derived Views

Persist the state required to reconstruct the draft:

- Draft metadata.
- League and draft configuration.
- Teams.
- Full draft order.
- Pick assignments.
- Ranking snapshot.

Do not persist derived views in Phase 2:

- Available players.
- User roster.
- Recommendation output.
- Draft status display data.

Reason:

These are currently deterministic outputs from draft state plus rankings. Persisting them would create multiple sources of truth and increase the chance of stale data.

### Decision: Persist Full Draft Order

Store every pick slot when a draft is created, including empty future picks.

Reason:

The current `Draft` model contains the full `picks` array. Persisting the full order makes hydration straightforward and avoids recomputing historical draft order if draft generation rules change later.

Tradeoffs:

- Slightly more rows at draft creation.
- Simpler load behavior and easier invariant checks.

### Decision: Use Ranking Snapshots Per Draft

Every draft should reference an immutable ranking snapshot.

Reason:

Recommendations, available players, and roster reconstruction depend on rankings. If the global seed rankings change later, old drafts should still resume with the same player pool and ranking context they started with.

The snapshot must include enough player data to reconstruct `RankingEntry[]`:

- Player id.
- Player name.
- Player team.
- Player position.
- Overall rank.
- ADP rank.
- Position rank.
- Tier.

### Decision: Do Not Introduce A Global Player Table Yet

For Phase 2, player identity can live inside ranking snapshots.

Reason:

The current app has no independent player catalog. A global `Player` table would mostly anticipate future ranking management and external provider mapping. Phase 2 only needs stable saved drafts.

When this recommendation stops being appropriate:

- Multiple ranking sets share the same player catalog.
- External providers need cross-source player ID mapping.
- News, injuries, projections, or player metadata become first-class product data.

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

## Proposed Durable Model

This model describes durable concepts. Exact Prisma syntax should be decided during implementation planning.

### Draft

Represents one saved draft workspace.

Suggested fields:

- `id`
- `name`
- `status`
- `teamCount`
- `rounds`
- `draftType`
- `scoringFormat`
- `userTeamId`
- `currentPickNumber`
- `rankingSnapshotId`
- `createdAt`
- `updatedAt`

Notes:

- `status` can start simple, such as `IN_PROGRESS` and `COMPLETE`.
- `draftType` can start as `SNAKE`.
- `scoringFormat` can start as `PPR`.
- `currentPickNumber` should be persisted because it is part of the existing domain model. It should be validated against picks during load or mutation.

### DraftTeam

Represents a team inside a draft.

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

### DraftPick

Represents one slot in the draft order.

Suggested fields:

- `id`
- `draftId`
- `pickNumber`
- `round`
- `pickInRound`
- `teamId`
- `playerId`
- `draftedAt`

Notes:

- `playerId` is nullable until the pick is made.
- `draftId` plus `pickNumber` should be unique.
- `draftId` plus `playerId` should prevent duplicate drafted players when `playerId` is present.
- `teamId` should refer to the draft-local team identifier, not a global team account.

### RankingSnapshot

Represents the ranking context frozen for a draft.

Suggested fields:

- `id`
- `name`
- `source`
- `createdAt`

Notes:

- The snapshot is immutable once a draft uses it.
- Phase 2 does not need ranking profile management.

### RankingSnapshotEntry

Represents one ranked player inside a ranking snapshot.

Suggested fields:

- `id`
- `rankingSnapshotId`
- `playerId`
- `playerName`
- `playerTeam`
- `playerPosition`
- `overallRank`
- `adpRank`
- `positionRank`
- `tier`

Notes:

- `rankingSnapshotId` plus `playerId` should be unique.
- `rankingSnapshotId` plus `overallRank` should be unique unless ties are intentionally supported later.
- This table should be enough to rebuild `RankingEntry[]`.

---

## Hydration Shape

Loading a draft should produce a workspace object that can feed the current app:

```ts
type DraftWorkspace = {
  draft: Draft;
  rankings: RankingEntry[];
};
```

The persistence layer should map database records into this shape.

The UI should continue deriving:

- Drafted player IDs.
- Available rankings.
- User roster players.
- Recommendations.
- Draft completion status.

---

## Mutation Flow

### Create Draft

Create draft should:

- Create or copy a ranking snapshot.
- Create a draft record.
- Create draft teams.
- Create the full snake draft order as pick rows.
- Return a hydrated `DraftWorkspace`.

### Draft Player

Draft player should:

- Load the draft aggregate.
- Hydrate the domain `Draft`.
- Validate that the player exists in the draft ranking snapshot.
- Apply the existing draft transition.
- Persist changed pick state and current pick number in a transaction.
- Return the updated `DraftWorkspace` or updated `Draft`.

### Undo Last Pick

Undo should:

- Load the draft aggregate.
- Hydrate the domain `Draft`.
- Apply the existing undo transition.
- Persist changed pick state and current pick number in a transaction.
- Return the updated `DraftWorkspace` or updated `Draft`.

### Load Draft

Load draft should:

- Query draft metadata, teams, picks, and ranking snapshot entries.
- Sort teams by draft position.
- Sort picks by pick number.
- Sort rankings by overall rank.
- Map records to `Draft` and `RankingEntry[]`.
- Validate basic draft invariants before returning when practical.

---

## Consistency Rules

The persistence layer should protect these rules:

- A draft must have exactly `teamCount * rounds` pick rows.
- Every pick belongs to exactly one draft.
- Every pick references a draft-local team.
- A drafted player cannot appear in more than one pick for the same draft.
- `currentPickNumber` should match the first undrafted pick, unless the draft is complete.
- Draft completion should be derived from pick state or synchronized from it.
- Ranking snapshot entries must not change after drafts reference them.

The database should enforce simple structural constraints. Domain and integration tests should enforce behavior-level rules.

---

## Testing Strategy Impact

Phase 2 should add persistence confidence without overbuilding test infrastructure.

Important test coverage areas:

- Mapping database records to `Draft`.
- Mapping ranking snapshot entries to `RankingEntry[]`.
- Save and load round trips.
- Drafting a player and reloading the draft.
- Undoing a pick and reloading the draft.
- Duplicate drafted player prevention.
- Draft invariants after load.
- Recommendation inputs are the same before and after load.

Database-backed integration tests are valuable here because persistence bugs often live at the boundary between records and domain objects.

---

## Alternatives And Open Questions

### Ranking Snapshot Storage Shape

Option A: Normalized `RankingSnapshotEntry` rows.

Pros:

- Easy to query and validate.
- Aligns with future ranking management.
- Keeps player fields explicit.
- Easier to inspect during debugging.

Cons:

- More schema and migration work.
- More rows per draft snapshot.
- Slightly more implementation overhead than storing JSON.

Option B: Store the full `RankingEntry[]` snapshot as JSON.

Pros:

- Fastest implementation.
- Very close to the current app shape.
- Easy to hydrate back into TypeScript.

Cons:

- Harder to query and validate.
- Weaker database-level constraints.
- More likely to need migration when ranking management becomes active.

Recommendation:

Use normalized `RankingSnapshotEntry` rows if Phase 2 is intended to establish the durable foundation for later ranking management. Use JSON only if the immediate priority is the smallest possible persistence slice.

Open question before task planning:

Should Phase 2 optimize for the durable future ranking path, or the fastest possible saved-draft implementation?

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

- Status can drift from pick state if updates are buggy.

Option B: Derive completion from picks every time.

Pros:

- No duplicated state.
- Impossible for status to drift.

Cons:

- Slightly less convenient for draft history queries.

Recommendation:

Store a simple `status`, but treat pick state as the source of truth. Update status inside the same transaction as pick changes.

Open question before task planning:

Is draft history expected to filter or group by status in Phase 2, or can status be derived until the UI needs it?

---

## Implementation Planning Guidance

When tasks are created, they should preserve this sequence of responsibility:

```text
database records
        |
persistence mappers
        |
domain Draft and RankingEntry objects
        |
existing draft and recommendation logic
        |
UI
```

Avoid tasks that make React components speak directly to Prisma models.

Avoid tasks that persist derived recommendation or roster output.

Avoid tasks that introduce users, providers, or replay abstractions as part of Phase 2 persistence.
