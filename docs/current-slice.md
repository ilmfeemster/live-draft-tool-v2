# Current Slice: Persist, Load, and List Ranking Sets

## Completion Status

Implementation complete; Task 10 completion is blocked only by the required real PostgreSQL validation. The Prisma schema, repository, strict mapping, transactional create, ordered load, lightweight summaries, conflict handling, focused fake-client coverage, TypeScript, and lint all pass. The full suite passes 515 tests with one intentional skip: the opt-in PostgreSQL round trip. `RANKING_SET_TEST_DATABASE_URL` is not configured, so no isolated database was available for safe schema push and integration execution. Task 10 remains unchecked until that test passes.

## Source Context

Phase 5 Tasks 1 through 9 are complete:

- canonical mutable `RankingSet` aggregates and lightweight `RankingSetSummary` values are defined;
- complete domain invariants validate identity, canonical order, tiers, ADP, source provenance, capabilities, and lifecycle metadata;
- import, conversion, export, and pure editing boundaries now produce complete canonical aggregates;
- immutable draft ranking snapshots remain serialized values owned by the existing draft repository;
- mutable ranking sets are explicitly designed to use first-class metadata and entry persistence behind a dedicated repository;
- the project uses PostgreSQL, Prisma 7 with `@prisma/adapter-pg`, an ignored generated client, and injected Prisma-like fake clients for focused repository tests;
- the repository currently has no checked-in Prisma migration history or database integration-test harness.

This slice promotes Phase 5 Task 10 only. It adds the first durable mutable ranking-set boundary: schema, create, load, summaries, conflict mapping, and a real isolated Postgres round trip. Replacement and deletion remain Task 11.

## Goal

Persist complete canonical ranking sets as first-class metadata plus individually addressable ordered entries, then load domain aggregates and list lightweight summaries without leaking Prisma records, JSON blobs, or database types across the repository boundary.

## Scope

### Goals

- Extend the Prisma schema with mutable ranking-set and ranking-entry storage.
- Keep existing draft and immutable `RankingSnapshot` persistence unchanged.
- Add one dedicated ranking-set repository with injected-client and default-client entry points.
- Accept and return domain `RankingSet` and `RankingSetSummary` values only.
- Validate a complete canonical set before attempting create persistence.
- Create set metadata and all entries atomically through one transaction and nested write.
- Preserve caller-issued local ID, display name, source provenance, capabilities, canonical entries, and lifecycle timestamps.
- Enforce case-insensitive, outer-whitespace-insensitive display-name uniqueness through a private normalized-name column and database unique constraint.
- Map normalized-name unique violations into a stable domain-facing name-conflict result.
- Load one set by local ID with entries ordered by canonical overall rank.
- Reconstruct new domain-owned source, capability, entry, player, and date values.
- Revalidate reconstructed aggregates with `validateRankingSet` before returning them.
- List `RankingSetSummary[]` using metadata, capabilities, and database entry counts without selecting entry rows.
- Sort summaries deterministically by most recently updated, then display name, then local ID.
- Add focused injected-fake tests for create/load/list, mapping, conflicts, atomic failure, and query shape.
- Add an opt-in real PostgreSQL integration path for complete and safely degraded create/load round trips.
- Run Prisma schema validation and client generation in addition to TypeScript, lint, and tests.
- Check Phase 5 Task 10 complete only after the real persistence round trip has actually passed.

### Non-Goals

- Replacing, renaming in persistence, deleting, or editing stored ranking sets.
- Exposing entry-level create/update/delete repository operations.
- Import/export application orchestration or server actions.
- Seed-ranking bootstrap.
- Draft creation from a selected ranking set.
- Changing draft snapshot JSON storage or the draft repository.
- Adding a global player catalog or cross-set player relation.
- Persisting raw imports, parser records, candidates, diagnostics, recommendations, or UI state.
- Adding accounts, ownership, author history, revisions, or soft deletion.
- Adding caching, pagination, search, background jobs, or generic repositories.
- Creating a production migration baseline in this slice when the repository has no established migration history; isolated integration setup uses Prisma schema push.
- Running destructive schema push against a non-isolated or production database.
- Adding UI or changing dependencies.

## Implementation Design

### Prisma Schema

Update `prisma/schema.prisma` with private persistence enums:

```prisma
enum RankingSourceKind {
  SEED
  EXTERNAL
  CANONICAL
  MANUAL
}

enum RankingDataAvailability {
  COMPLETE
  PARTIAL
  NONE
}

enum RankingPlayerIdentityCapability {
  PROVIDED
  GENERATED
  MIXED
}

enum RankingOverallOrderCapability {
  EXPLICIT
  ROW_DERIVED
}

enum RankingPosition {
  QB
  RB
  WR
  TE
  DST
  K
}
```

Add:

```prisma
model RankingSet {
  id                       String                          @id
  name                     String
  normalizedName           String                          @unique
  sourceKind               RankingSourceKind
  sourceFormatId           String?
  sourceFormatVersion      Int?
  sourceLabel              String?
  sourceImportedAt         DateTime?
  teamCapability           RankingDataAvailability
  playerIdentityCapability RankingPlayerIdentityCapability
  overallOrderCapability   RankingOverallOrderCapability
  adpCapability            RankingDataAvailability
  tierCapabilities         Json
  entries                  RankingSetEntry[]
  createdAt                DateTime
  updatedAt                DateTime

  @@index([updatedAt])
}

model RankingSetEntry {
  id           String          @id @default(cuid())
  rankingSetId String
  rankingSet   RankingSet      @relation(fields: [rankingSetId], references: [id], onDelete: Cascade)
  playerId     String
  playerName   String
  team         String
  position     RankingPosition
  overallRank  Int
  positionRank Int
  tier         Int
  adpRank      Float?

  @@unique([rankingSetId, playerId])
  @@unique([rankingSetId, overallRank])
  @@unique([rankingSetId, position, positionRank])
  @@index([rankingSetId, overallRank])
}
```

`positionRank` capability is always `derived` in the domain, so do not persist a redundant enum column for its one legal value. Repository mapping reconstructs `positionRank: "derived"` explicitly.

Store per-position tier capabilities as a small JSON metadata value because it is loaded as a whole map, not queried or independently mutated. Keep it behind strict repository parsing and canonical validation.

Do not add defaults for caller-owned aggregate identity or lifecycle timestamps. Repository creation must persist the canonical values it receives.

### Name Uniqueness

Persist both display `name` and private `normalizedName`.

Compute normalized name with one private helper:

```ts
name.trim().toLocaleLowerCase("en-US")
```

The canonical display name remains unchanged. The normalized key exists only to enforce single-user case-insensitive uniqueness safely under concurrent creates.

Do not perform a check-then-create query. Rely on the database unique constraint and map a Prisma-compatible `P2002` error whose target identifies `normalizedName` into the repository's `name-conflict` result.

Other persistence failures should propagate rather than being mislabeled as conflicts.

### Repository API

Add `src/lib/rankingSetRepository.ts` with an internal structural client contract and:

```ts
type CreateRankingSetError = Readonly<{
  code: "invalid-ranking-set" | "name-conflict";
  message: string;
  path?: string;
}>;

type CreateRankingSetResult =
  | Readonly<{
      ok: true;
      rankingSet: RankingSet;
    }>
  | Readonly<{
      ok: false;
      errors: readonly CreateRankingSetError[];
    }>;

createRankingSetRepository(db)

createRankingSet(rankingSet): Promise<CreateRankingSetResult>
getRankingSetById(id): Promise<RankingSet | null>
listRankingSetSummaries(): Promise<RankingSetSummary[]>
```

As with `draftRepository`, export convenience functions that obtain `getPrismaClient()` and cast it only at the private structural boundary. Do not export the structural client, persistence record, Prisma argument, or enum types.

The repository must not accept normalized candidates, converted wrappers, parser records, JSON export documents, or edit intents.

### Create Flow

Before touching the database:

1. call `validateRankingSet`;
2. if invalid, map ordered domain failures to `invalid-ranking-set`, preserving message and path;
3. compute normalized name;
4. map the complete domain aggregate into metadata plus nested entry-create records.

Run creation through `$transaction` when available. Inside it, perform one `rankingSet.create` with nested `entries.create` and an include that returns entries ordered by `overallRank` ascending.

The transaction callback returns the created persistence record. Map and validate that record before returning success.

If a unique normalized-name violation occurs, return:

```ts
{
  ok: false,
  errors: [{
    code: "name-conflict",
    message: "A ranking set with this name already exists.",
    path: "name",
  }],
}
```

Nested creation must be all-or-nothing. No metadata-only or partial entry result may remain after a failed create.

### Persistence Mapping

Keep persistence record types private in `rankingSetRepository.ts`; the slice does not need a second mapping module.

Map domain values to persistence as follows:

- source and capability string unions to explicit Prisma enum spellings;
- optional provenance fields to omitted/undefined values rather than fabricated defaults;
- tier capabilities to a plain JSON object in supported position order;
- canonical entries to nested rows in current overall-rank order;
- ADP null to database null;
- lifecycle dates as caller-provided values.

Map loaded records back into newly allocated domain values:

- enum spellings through exhaustive explicit maps, never case conversion guesses;
- tier-capability JSON through an `unknown` parser accepting only supported positions and `source` / `defaulted-neutral` values;
- entries through explicit player/ranking field mapping;
- positions through explicit supported enum mapping;
- dates through clones so returned aggregates do not share fake/client record references.

After reconstruction, call `validateRankingSet`. If stored data is malformed or inconsistent, throw a stable repository mapping error that includes the first canonical path/message. Do not repair storage data, omit invalid entries, or expose a partial aggregate.

### Load Flow

`getRankingSetById(id)` calls `rankingSet.findUnique` with:

```ts
{
  where: { id },
  include: {
    entries: {
      orderBy: { overallRank: "asc" },
    },
  },
}
```

Return `null` for a missing identity. Otherwise map the complete record into a domain `RankingSet` and revalidate it.

Do not accept portable source identity, display name, or player ID as a load key.

### Summary Listing

`listRankingSetSummaries()` calls `rankingSet.findMany` with a `select` containing only:

- `id`;
- `name`;
- `sourceKind`;
- capability metadata needed by `RankingSetSummary`;
- `_count.entries`;
- `createdAt`;
- `updatedAt`.

It must not select or include `entries`.

Use deterministic database ordering:

```ts
orderBy: [
  { updatedAt: "desc" },
  { name: "asc" },
  { id: "asc" },
]
```

Map `_count.entries` to `entryCount`, map source kind and capabilities to domain unions, reconstruct `positionRank: "derived"`, parse tier-capability JSON, and clone dates.

### Structural Client and Transaction Boundary

Define only the Prisma-like methods this repository needs:

- optional `$transaction(callback)`;
- `rankingSet.create`;
- `rankingSet.findUnique`;
- `rankingSet.findMany`.

The transaction client omits `$transaction`. Use a small `runRepositoryTransaction` helper matching the existing draft-repository convention so focused fakes can execute without Prisma.

Do not introduce a shared generic repository or transaction abstraction.

### Focused Fake-Client Tests

Add `src/lib/rankingSetRepository.test.ts` with an in-memory fake matching only the structural contract. Cover:

- creating and loading a representative complete set without value loss;
- creating and loading a safely degraded set with unknown teams, null ADP, neutral tiers, and defaulted capabilities;
- exact mapping of source provenance and optional fields;
- exact canonical entry order independent of fake storage insertion order;
- returned source, capabilities, tier map, entries, players, and dates are new domain-owned values;
- invalid domain input rejected before any database call;
- normalized name uses outer trim plus `en-US` lowercase while display name is preserved;
- names differing only by case or outer whitespace return `name-conflict`;
- unrelated `P2002` targets and non-Prisma failures propagate;
- a simulated nested-entry failure rolls back both set metadata and all staged entries;
- missing ID returns null;
- malformed stored enum, tier JSON, order, capability, or entry data throws the stable mapping error;
- summary list returns exact lightweight domain summaries;
- summary query does not request entry rows and uses `_count.entries`;
- summary ordering is deterministic;
- repository return types expose no persistence-only `normalizedName`, row IDs, foreign keys, or Prisma enums;
- separate sets with unrelated player IDs remain isolated.

Keep fake tests behavior-focused. They may inspect create/include and summary/select shapes only where required to prove atomic nested creation, canonical order, and lightweight listing.

### Real PostgreSQL Round Trip

In the same test file, add an opt-in integration `describe` gated by both:

- `RUN_RANKING_SET_DB_TESTS === "1"`;
- a dedicated `RANKING_SET_TEST_DATABASE_URL`.

The integration path must:

1. construct an isolated Prisma client with `PrismaPg` using `RANKING_SET_TEST_DATABASE_URL`;
2. create the repository through the same public factory;
3. delete only test-owned ranking-set IDs before and after the test;
4. create/load a representative complete set;
5. create/load a safely degraded set;
6. list both summaries without loading entries;
7. attempt a case-insensitive duplicate name and receive `name-conflict`;
8. disconnect in cleanup.

Before running the integration test, apply the current schema to the explicitly isolated database with Prisma schema push. Never run schema push against the default development URL merely because it exists.

Required validation commands for the opt-in path:

```text
$env:DATABASE_URL=$env:RANKING_SET_TEST_DATABASE_URL
npx prisma db push --skip-generate
$env:RUN_RANKING_SET_DB_TESTS="1"
npm test -- src/lib/rankingSetRepository.test.ts
```

Use equivalent environment syntax outside PowerShell.

If no isolated Postgres URL is available, focused fake tests may continue, but Task 10 must remain incomplete and the implementation report must name the missing real round trip as a blocker.

### Prisma Workflow

After editing the schema:

```text
npx prisma validate
npx prisma generate
```

The generated client remains ignored according to the existing repository convention. Do not edit generated files manually.

Because this repository has no established migration history, this slice uses schema push only for the isolated test database and does not introduce an incomplete migration baseline. Recommend establishing a deployment migration baseline before production deployment rather than silently treating schema push as production migration policy.

## Implementation Steps

1. Add ranking persistence enums, `RankingSet`, and `RankingSetEntry` models plus constraints/indexes to `prisma/schema.prisma` without changing draft/snapshot models.
2. Add private structural client/record types, enum and tier-capability mappers, domain validation mapping, and default-client wrappers in `rankingSetRepository.ts`.
3. Implement transactional nested create with normalized-name conflict mapping.
4. Implement canonical ordered load with strict record reconstruction and invariant revalidation.
5. Implement lightweight deterministic summary listing using `_count.entries` and no entry selection.
6. Add focused fake-client tests for complete/degraded round trips, conflicts, rollback, mapping failures, isolation, ownership, and summary query shape.
7. Add and run the opt-in real PostgreSQL complete/degraded round trip and conflict test against an explicitly isolated database.
8. Run Prisma validate/generate, focused tests, TypeScript, and focused lint.
9. Run the full test suite and repository-wide lint.
10. After every acceptance criterion, including the real database round trip, passes, mark only Phase 5 Task 10 complete in `docs/tasks.md` and update this slice status.
11. Report results and stop. Do not begin Task 11 replacement/deletion.

## Expected Files

- `prisma/schema.prisma`
- `src/lib/rankingSetRepository.ts`
- `src/lib/rankingSetRepository.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

Ignored generated Prisma client files may refresh through `prisma generate` but must not be edited manually or reported as source changes.

No draft repository, snapshot serializer, import/export pipeline, editing operation, domain type, engine, application action, dependency, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npx prisma validate
npx prisma generate
npm test -- src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSetRepository.ts src/lib/rankingSetRepository.test.ts
npm test
npm run lint
```

Then run the isolated real-database setup and focused test commands specified above.

Expected result:

- Prisma schema validation and client generation pass.
- Focused fake-client repository tests pass with exact mapping, conflict, rollback, ownership, and query-shape assertions.
- The opt-in real PostgreSQL complete/degraded create-load-list round trip and duplicate-name conflict pass.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes; the real-database block is skipped unless explicitly enabled.
- Repository-wide lint passes.
- Existing Tasks 1 through 9 behavior and draft snapshot persistence remain unchanged.
- No network, browser, build, migration, or manual-QA requirement is introduced beyond the explicitly authorized isolated Postgres validation.

## Acceptance Criteria

- A valid complete canonical ranking set creates and loads without domain-value loss.
- A safely degraded set preserves unknown team, null ADP, neutral tiers, and defaulted capability metadata.
- Create is atomic and never leaves metadata or partial entries after failure.
- Case-insensitive, outer-whitespace-insensitive duplicate names return an explicit domain-facing conflict.
- Load reconstructs canonical order and returns null for a missing local ID.
- Stored malformed or inconsistent values fail loudly at the repository mapping boundary rather than being repaired.
- Summary listing returns `RankingSetSummary[]` without selecting entry rows.
- Multiple ranking sets remain isolated even when player identities overlap or differ.
- Domain callers receive no persistence-only records, row IDs, normalized names, JSON blobs, or Prisma types.
- Prisma schema validation and generation pass.
- Focused fake-client tests, isolated real Postgres round trip, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 10 is checked complete after all validation, including the real database test.
- No dependency, draft snapshot, unrelated generated source, or unrelated documentation change is introduced.

## Failure Handling

- If the Prisma schema cannot express a documented uniqueness or ordering constraint, stop and report the mismatch rather than weakening it silently.
- If stored tier-capability JSON cannot be parsed exactly, fail mapping rather than defaulting capabilities.
- If a `P2002` target cannot be attributed to normalized name, rethrow it rather than reporting a false name conflict.
- If a nested create or transaction fake cannot prove rollback, improve the fake transaction semantics rather than weakening the atomicity assertion.
- If generated Prisma runtime does not expose the new model after schema generation, stop before claiming repository functionality.
- If no explicitly isolated Postgres database is available, do not run schema push against another database and do not mark Task 10 complete; report the integration blocker.
- If the real database round trip reveals schema/mapping disagreement, fix only this slice's persistence boundary and rerun all validation.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 11: atomically replace and delete persisted ranking sets while preserving identity, validating complete replacements, mapping missing/conflict outcomes, and proving draft snapshots remain unaffected.

## Documentation Recommendation

After Task 10 is implemented and a deployment database workflow is chosen, establish a checked-in Prisma migration baseline and document local/CI database setup. Do not make an ad hoc schema-push integration command the production migration policy.

## Slice Review

- Smallest meaningful increment: yes. It adds one complete create/load/list repository boundary without replacement, deletion, application orchestration, or UI.
- Executable by a lower-reasoning pass: yes. Schema, mapping, transaction, conflict, query, integration setup, and validation behavior are explicit.
- Avoids unnecessary architecture changes: yes. It follows the existing monolith, Prisma adapter, injected-client, and domain-mapping conventions without a generic repository layer.
- Blast radius reasonable: yes. Five source/document files are expected; generated Prisma output remains ignored.
- Review/revert comfort: yes. New tables and one isolated repository are additive and do not alter draft snapshot storage.
- Observable/testable acceptance criteria: yes. Exact domain round trips, conflict results, rollback, summary select shape, and real Postgres behavior are directly testable.
