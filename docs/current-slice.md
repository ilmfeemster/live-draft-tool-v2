# Current Slice: Add Draft Repository Query Functions

## Source Task

`docs/tasks.md` Task 5: Implement Draft Repository Mapping.

This slice completes the remaining unchecked Task 5 scope:

- add repository functions for creating, loading, and listing draft records
- add repository or integration tests for actual create/load/list behavior

## Goal

Add server-side repository functions that persist and load draft workspace source state through Prisma while returning typed domain-facing data.

This slice should connect the existing persistence pieces:

- Prisma schema
- league settings JSON mapper
- ranking snapshot JSON mapper
- draft repository mapping helper
- draft hydration helper

without adding server actions, UI wiring, or draft pick mutation persistence.

## User-Visible Increment

No app UI or runtime behavior should materially change.

The developer-visible increment is a repository module that can:

```txt
create persisted draft source records
load one draft as DraftWorkspace
list draft summaries without loading ranking snapshot JSON
```

## Problem

The project now has pure mappers that prove Prisma-shaped records can become `DraftWorkspace`, but no repository functions actually define the database access boundary.

Before server actions and UI loading are added, the codebase needs small repository functions that:

- accept typed domain inputs
- serialize league settings and rankings into JSON
- create the related Prisma records
- load persisted records with the needed relations
- map loaded records back into typed app-facing data
- list lightweight draft summaries without pulling full ranking snapshots

## Goals

- Add a Prisma client boundary if one does not already exist.
- Add `createDraftWorkspace` or equivalent.
- Add `getDraftWorkspaceById` or equivalent.
- Add `listDraftSummaries` or equivalent.
- Keep raw Prisma records and raw JSON behind the repository boundary.
- Use existing serializers and mappers instead of duplicating conversion logic.
- Include at least one non-default league configuration in repository tests.
- Verify loaded drafts remain valid with existing invariant helpers where practical.
- Update `docs/tasks.md` checkboxes only for Task 5 items directly completed by this slice.

## Non-Goals

- Adding server actions.
- Persisting draft pick mutations after draft creation.
- Adding draft/undo mutation repository functions.
- Wiring UI components or pages to persisted data.
- Adding draft history UI.
- Adding authentication or user/account models.
- Changing the Prisma schema unless implementation reveals a clear blocker.
- Running a migration against a real database unless local `DATABASE_URL` is already configured and the implementation approach requires it.
- Changing draft hydration behavior.
- Changing ranking snapshot mapper behavior.
- Changing league settings mapper behavior unless a bug is found.
- Changing recommendation behavior.
- Updating package dependencies.
- Broad documentation rewrites.

## Expected Files

- `src/lib/draftRepository.ts`
- `src/lib/draftRepository.test.ts` or equivalent repository-focused tests
- Possibly `src/lib/prisma.ts` for a centralized Prisma client
- Possibly `src/types/draft.ts` if a small `DraftSummary` type belongs with shared draft types
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing UI components, server actions, draft state helpers, recommendation logic, seed ranking data, project scope, roadmap scope, or unrelated documentation.

## Proposed API Shape

Use names that fit the codebase, but keep the API close to this shape:

```ts
type CreateDraftWorkspaceInput = {
  name?: string;
  leagueSettings: LeagueSettings;
  rankings: RankingEntry[];
  userTeamId: string;
};

type DraftSummary = {
  id: string;
  name: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  teamCount: number;
  rounds: number;
  userTeamId: string;
  draftedPickCount: number;
  createdAt: Date;
  updatedAt: Date;
};

async function createDraftWorkspace(input: CreateDraftWorkspaceInput): Promise<DraftWorkspace>;

async function getDraftWorkspaceById(id: string): Promise<DraftWorkspace | null>;

async function listDraftSummaries(): Promise<DraftSummary[]>;
```

If direct Prisma usage makes tests difficult, allow dependency injection while keeping the production default simple:

```ts
function createDraftRepository(db = prisma) {
  return {
    createDraftWorkspace,
    getDraftWorkspaceById,
    listDraftSummaries,
  };
}
```

## Expected Behavior

### Create Draft Workspace

- Accept typed `LeagueSettings` and `RankingEntry[]`.
- Serialize league settings with `serializeLeagueSettingsSnapshot`.
- Serialize rankings with `serializeRankingSnapshot`.
- Create a `RankingSnapshot` record.
- Create a `Draft` record linked to that ranking snapshot.
- Store no empty future pick rows.
- Return a hydrated `DraftWorkspace`.
- Default status should match the Prisma schema default unless an explicit status is needed.

### Load Draft Workspace

- Load draft by ID.
- Include ranking snapshot and made pick rows.
- Sort made pick rows by `pickNumber`.
- Return `null` if no draft exists.
- Use `mapDraftRecordToWorkspace` to return typed app-facing data.
- Do not expose raw JSON or Prisma records.

### List Draft Summaries

- Return lightweight summaries.
- Do not include full ranking snapshot JSON.
- Include enough fields for a future history list:
  - id
  - name
  - status
  - team count
  - rounds
  - user team id
  - drafted pick count
  - created/updated timestamps
- Parse league settings JSON for summary fields.
- Sort by most recently updated first.

## Testing Strategy

Prefer focused repository tests that do not require a long-lived external database.

Acceptable approaches:

- Use a small fake Prisma-like client to verify repository behavior and record shapes.
- Use dependency injection around the repository client so tests can exercise create/load/list behavior without a real database.
- If a local test database is already available and simple to run, an integration test is acceptable, but it is not required for this slice.

Tests should validate observable repository behavior, not Prisma internals.

## Implementation Steps

1. Add a repository module.
   - Define `CreateDraftWorkspaceInput`.
   - Define `DraftSummary` locally or in shared types if needed.
   - Add `createDraftRepository(db = prisma)` or equivalent.
   - Export production-friendly functions only after the repository can still be tested cleanly.

2. Implement create behavior.
   - Serialize league settings.
   - Serialize ranking snapshot.
   - Create linked ranking snapshot and draft records.
   - Return the created workspace through existing mapping logic.
   - Do not create pick rows during draft creation.

3. Implement load behavior.
   - Load one draft with ranking snapshot and picks.
   - Return `null` when absent.
   - Map the record to `DraftWorkspace`.
   - Ensure pick ordering is stable before hydration.

4. Implement list summary behavior.
   - Query drafts without full ranking snapshot JSON.
   - Include pick count or enough pick data to count made picks.
   - Parse league settings JSON for team count and rounds.
   - Return summaries ordered by `updatedAt` descending.

5. Add tests.
   - Creating a default draft stores serialized league settings and ranking snapshot source data.
   - Creating a non-default draft returns a valid hydrated workspace.
   - Loading an existing draft returns a typed `DraftWorkspace`.
   - Loading a missing draft returns `null`.
   - Listing summaries does not require ranking snapshot JSON.
   - Listing summaries includes non-default team count and rounds from league settings.
   - No empty future pick rows are created.

6. Update task tracking.
   - Update `docs/tasks.md` only for Task 5 checkboxes directly completed by this slice.
   - Do not check Task 6 or later items.

7. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- Repository functions exist for create, load, and list.
- Creating a draft stores league settings and ranking snapshot source state.
- Creating a draft does not store empty future pick rows.
- Loading a draft returns typed `DraftWorkspace`.
- Loading a missing draft returns `null`.
- Listing drafts returns summaries without loading full ranking snapshot JSON.
- Repository code does not expose raw JSON to app-facing callers.
- Repository code does not make UI, Draft State Engine, or Recommendation Engine import Prisma types.
- Tests cover default and non-default league settings.
- Tests prove list summaries derive team count and rounds from league settings.
- `docs/tasks.md` Task 5 checkboxes are updated for completed repository work.
- No server action, UI wiring, or draft mutation persistence is added.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser-based manual test is required for this slice. The app UI should be unchanged.

If the app is run manually, confirm the draft room still loads normally from the existing static default draft and seed rankings.

## Slice Review

- Smallest meaningful increment: yes, this finishes the repository read/create/list boundary before mutation persistence or UI integration.
- Concrete enough for implementation: yes, APIs, behavior, tests, and validation commands are specified.
- Avoids unnecessary architecture changes: yes, it follows the existing Prisma and mapper boundaries without adding server actions or UI dependencies.
- Blast radius reasonable: yes, expected changes are a repository module, focused tests, and task checkbox updates.
- Review/revert comfort: yes, app runtime behavior remains unchanged and repository behavior is tested at the boundary.
- Observable/testable acceptance criteria: yes, create/load/list outputs and task checkbox changes are directly verifiable.
