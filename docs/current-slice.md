# Current Slice: Replace and Delete Ranking Sets Atomically

## Completion Status

Implemented locally, with required isolated PostgreSQL validation blocked. The repository replace/delete APIs, fake-client rollback and isolation coverage, and opt-in draft-snapshot survival integration test are implemented. Focused validation passes 23 tests with one database-only skip; TypeScript no-emit and focused lint pass. The normal full suite passes 37 files and 524 tests with that same intentional skip, and repository-wide lint passes. `RANKING_SET_TEST_DATABASE_URL` is not available in the current shell or standard local environment file, so the real database test was not run and Phase 5 Task 11 remains incomplete.

## Source Context

- The ranking-set repository already creates, loads, and lists complete canonical `RankingSet` aggregates behind strict domain mapping.
- `createRankingSet` validates before persistence, uses a nested atomic write, normalizes names for database uniqueness, and maps normalized-name conflicts into a domain-facing result.
- `RankingSetEntry` rows already cascade only when their owning mutable `RankingSet` is deleted.
- Immutable `RankingSnapshot` records are owned by drafts and have no schema relation or cascade path from mutable ranking sets.
- Pure ranking edits preserve the ranking-set local identity, source provenance, and creation metadata while returning a complete validated aggregate with an updated lifecycle timestamp.
- The existing repository fake snapshots its in-memory records around `$transaction`, and the existing opt-in PostgreSQL harness uses an explicitly isolated `RANKING_SET_TEST_DATABASE_URL`.
- The repository has no checked-in Prisma migration baseline. Task 11 does not require a schema change.

## Goal

Complete the mutable ranking-set repository lifecycle by replacing one existing set from a complete canonical aggregate and deleting a set by local identity, with explicit outcomes and tests proving atomicity, set isolation, and immutable draft-snapshot independence.

## Scope

### Goals

- Add a repository replacement operation that accepts one complete canonical `RankingSet`.
- Use the aggregate's `id` as both the lookup identity and the preserved persisted identity.
- Validate the complete replacement before any database call.
- Replace all mutable set metadata, capability metadata, lifecycle values, and canonical entries as one atomic operation.
- Remove the prior entry collection and create the replacement entry collection inside the same nested update and transaction.
- Reconstruct and revalidate the persisted replacement before the transaction commits.
- Return explicit invalid-ranking-set, not-found, and normalized-name-conflict results without leaking expected Prisma errors.
- Add a repository deletion operation keyed only by local ranking-set ID.
- Delete the set and its owned entry rows while returning an explicit not-found result for a missing ID.
- Preserve all other ranking sets during replacement and deletion.
- Prove with an isolated PostgreSQL integration test that deleting a mutable source set leaves an existing draft and its immutable ranking snapshot unchanged and loadable.
- Preserve existing create, load, list, mapping, ordering, and conflict behavior.

### Non-Goals

- Exposing entry-level insert, update, reorder, or delete operations.
- Persisting edit intents or allowing intermediate invalid ranking sets.
- Adding optimistic concurrency, versions, revisions, history, restore, soft deletion, or audit logs.
- Changing the ranking-set or draft-snapshot schema.
- Adding a relation between `RankingSet` and `RankingSnapshot`.
- Deleting, rewriting, or repairing draft snapshots or scenarios.
- Adding application actions, import orchestration, seed bootstrap, draft selection, or UI.
- Adding ownership, accounts, authorization, caching, pagination, or generic repository abstractions.
- Changing dependencies, generated Prisma source, or migration policy.

## Implementation Design

### Public Repository Results

Keep the existing create result unchanged. Add focused exported result types:

```ts
type ReplaceRankingSetError = Readonly<{
  code: "invalid-ranking-set" | "not-found" | "name-conflict";
  message: string;
  path?: string;
}>;

type ReplaceRankingSetResult =
  | Readonly<{ ok: true; rankingSet: RankingSet }>
  | Readonly<{
      ok: false;
      errors: readonly ReplaceRankingSetError[];
    }>;

type DeleteRankingSetError = Readonly<{
  code: "not-found";
  message: string;
  path: "id";
}>;

type DeleteRankingSetResult =
  | Readonly<{ ok: true; id: string }>
  | Readonly<{ ok: false; errors: readonly DeleteRankingSetError[] }>;
```

Expose the operations through both the injected repository and default-client wrappers:

```ts
replaceRankingSet(rankingSet: RankingSet): Promise<ReplaceRankingSetResult>
deleteRankingSetById(id: string): Promise<DeleteRankingSetResult>
```

Use these stable expected failures:

- invalid replacement input: ordered `invalid-ranking-set` errors mapped from `validateRankingSet`;
- missing replacement or deletion target: one `not-found` error with `path: "id"` and message `"Ranking set was not found."`;
- replacement name conflict: the existing `name-conflict` message and `path: "name"`.

Do not change `getRankingSetById` missing behavior; reads continue returning `null`.

### Replacement Persistence Shape

Extend the private structural client only with the methods and shapes needed by this slice:

- `rankingSet.update` with `where: { id }`, complete replacement data, and the existing ordered full-record include;
- `rankingSet.delete` with `where: { id }` and a minimal `select: { id: true }`.

Add a private update-data mapper that:

- never puts `id` in update data;
- writes the display name and recomputed private normalized name;
- writes all source provenance fields, including clearing optional persisted values when the canonical aggregate omits them;
- writes all capability metadata, including the complete tier-capability JSON value;
- writes caller-owned `createdAt` and `updatedAt` lifecycle values from the validated aggregate;
- maps ADP null and every canonical entry exactly as create does;
- sets nested entries to `deleteMany: {}` plus `create: [...]`.

Reuse small mapping helpers where that removes duplication, but do not add a generic persistence mapper or repository abstraction.

### Atomic Replace Flow

`replaceRankingSet` must:

1. Call `validateRankingSet` before touching the database.
2. Return all ordered validation failures as `invalid-ranking-set`; do not check existence first.
3. Run one `rankingSet.update` inside `runRepositoryTransaction`, targeting `validation.rankingSet.id`.
4. Replace metadata and the full owned entry collection through one nested update.
5. Map and revalidate the returned full record inside the transaction callback so a mapping failure aborts the transaction.
6. Return the independently owned canonical replacement on success.
7. Map only an attributable normalized-name `P2002` to `name-conflict`.
8. Map `P2025` from the target update to `not-found`.
9. Rethrow unrelated unique, mapping, and persistence failures.

The operation must not perform a check-then-update read. The database write determines whether the target exists and whether the normalized name conflicts, avoiding a race between validation and replacement.

The replacement aggregate's `id` is authoritative and immutable during the operation: it appears only in `where`, while every other persisted aggregate field is replaced from the validated input.

### Delete Flow

`deleteRankingSetById` must:

1. Call one `rankingSet.delete` with `where: { id }` and `select: { id: true }`.
2. Return `{ ok: true, id }` only after the delete succeeds.
3. Map `P2025` to the stable `not-found` result.
4. Rethrow all unrelated persistence failures.

Rely on the existing `RankingSetEntry.rankingSet` cascade for owned entry cleanup. Do not query or mutate `Draft`, `RankingSnapshot`, scenario data, or any other aggregate before or after deletion.

### Expected Prisma Error Mapping

Keep normalized-name conflict detection as narrow as the existing create path. Add a small private `P2025` predicate based on the Prisma error code; do not infer not-found from arbitrary messages.

Expected replace/delete outcomes are returned as domain-facing results. Unexpected database failures and malformed persisted records remain thrown errors.

### Focused Fake-Client Tests

Extend the existing in-memory repository fake rather than creating a second harness:

- add `update` and `delete` methods to its structural `rankingSet` object;
- reuse its transaction record snapshot so simulated nested replacement failures restore the exact previous set;
- make the existing entry-failure control apply to replacement entry creation;
- add operation counters only where needed to prove invalid input is rejected before persistence;
- preserve normalized-name uniqueness and clone returned records to exercise repository ownership and ordering.

Cover:

- a successful replacement preserves the local ID and exactly replaces name, normalized-name behavior, source provenance, capabilities, lifecycle values, and canonical entries;
- replacement reload returns canonical overall-rank order even if the fake returns reversed entry rows;
- capability changes and fallback values survive replacement and reload without inconsistency;
- invalid replacement input performs no update and leaves the prior set byte-for-byte equivalent at the domain boundary;
- a simulated failure partway through nested entry creation rolls back all metadata and entries;
- a name-conflicting replacement returns `name-conflict` and leaves both sets unchanged;
- replacement of a missing ID returns `not-found`;
- unrelated `P2002`, non-`P2025`, and generic persistence failures still throw;
- deleting a set returns its ID, removes its owned entries, and leaves another set unchanged;
- deleting a missing set returns `not-found`;
- replacing or deleting one set never changes another set, including when player identities overlap;
- repeated loads after a successful canonical replacement are deterministic and expose no persistence-only fields.

Do not weaken existing create/load/list assertions while extending the fake.

### Isolated PostgreSQL Validation

Extend the existing opt-in `ranking set repository PostgreSQL` block, still gated by both:

- `RUN_RANKING_SET_DB_TESTS === "1"`;
- `RANKING_SET_TEST_DATABASE_URL`.

Use only fixed test-owned ranking-set, ranking-snapshot, and draft IDs. Clean those records before and after the integration test in foreign-key-safe order.

The real database path must:

1. Create two independent ranking sets.
2. Replace one with the same local ID but changed metadata, capabilities, lifecycle values, and entries.
3. Reload both sets and prove the replacement is exact while the other set is unchanged.
4. Exercise replacement name-conflict and not-found outcomes.
5. Persist a test-owned immutable `RankingSnapshot` and a `Draft` that references it, using ranking JSON captured before source deletion.
6. Delete the mutable source ranking set through `deleteRankingSetById`.
7. Reload the draft with its snapshot through Prisma and prove the draft still exists, its snapshot identity and ranking JSON are unchanged, and the other mutable set remains loadable.
8. Exercise delete not-found behavior.

The integration test may use Prisma directly only to arrange and inspect the draft/snapshot independence assertion. Repository replacement and deletion must run through the public injected repository API.

Never run schema push against an unverified database. This slice has no schema change, so reuse the isolated database already prepared with the current schema. If the isolated database is absent or stale, follow the existing Task 10 safety rule and apply the current schema only after `DATABASE_URL` is explicitly set to `RANKING_SET_TEST_DATABASE_URL`.

## Implementation Steps

1. Add replace/delete result types and the two injected-repository methods to `src/lib/rankingSetRepository.ts`.
2. Extend the private structural client types and add the complete update-data mapping without changing the Prisma schema.
3. Implement validated transactional replacement with nested entry delete/create, in-transaction reconstruction, normalized-name conflict mapping, and explicit not-found mapping.
4. Implement delete-by-ID with minimal return selection and explicit not-found mapping.
5. Add default-client wrappers for replacement and deletion.
6. Extend the existing fake client and focused tests for exact replacement, rollback, validation, conflicts, not-found outcomes, deletion, ownership, determinism, and multi-set isolation.
7. Extend the opt-in isolated PostgreSQL test to cover real replacement and draft-snapshot survival after source deletion.
8. Run focused tests, TypeScript no-emit, and focused lint.
9. Run the isolated PostgreSQL repository test using the dedicated test database.
10. Run the full test suite and repository-wide lint.
11. After every acceptance criterion, including the real database snapshot-survival test, passes, mark only Phase 5 Task 11 complete in `docs/tasks.md` and update this slice's completion status.
12. Report results and stop. Do not begin Task 12 seed bootstrap.

## Expected Files

- `src/lib/rankingSetRepository.ts`
- `src/lib/rankingSetRepository.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No Prisma schema, generated client, draft repository, domain type, editing operation, import/export pipeline, snapshot serializer, scenario, dependency, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSetRepository.ts src/lib/rankingSetRepository.test.ts
npm test
npm run lint
```

Run the isolated database path with the existing safe environment contract:

```text
$env:DATABASE_URL=$env:RANKING_SET_TEST_DATABASE_URL
$env:RUN_RANKING_SET_DB_TESTS="1"
npm test -- src/lib/rankingSetRepository.test.ts
```

Use equivalent environment syntax outside PowerShell.

Expected result:

- focused fake-client tests pass for exact replacement, rollback, conflicts, not-found outcomes, deletion, and isolation;
- the isolated PostgreSQL test passes for replacement and immutable draft-snapshot survival after mutable source deletion;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with the database block skipped unless explicitly enabled;
- repository-wide lint passes;
- existing create/load/list and Tasks 1 through 10 behavior remain unchanged.

## Acceptance Criteria

- A valid complete replacement persists under the same local ranking-set ID and reloads without domain-value loss.
- Metadata, capability metadata, lifecycle values, and the entire canonical entry collection change all-or-nothing.
- Invalid input, name conflict, mapping failure, or nested entry failure leaves the previously stored set unchanged.
- Capability metadata inconsistent with canonical fallback values is rejected before persistence.
- Missing replacement and deletion targets return explicit `not-found` results without leaking Prisma errors.
- Deleting one set removes only that set and its owned entries; all other ranking sets remain unchanged.
- Deleting a mutable source set leaves an existing draft and its immutable ranking snapshot unchanged and loadable in the isolated PostgreSQL test.
- Replacement and deletion remain deterministic for canonical inputs and return no persistence-only fields.
- Existing create, load, list, normalized-name conflict, strict mapping, and summary behavior continue to pass.
- Focused tests, isolated PostgreSQL validation, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 11 is checked complete after all validation passes.
- No schema, migration, dependency, generated source, snapshot, scenario, application-action, or UI change is introduced.

## Failure Handling

- If complete replacement cannot be expressed as one nested Prisma update inside the existing transaction boundary, stop rather than splitting metadata and entry writes.
- If post-write reconstruction fails, let the in-transaction mapping error roll back replacement; do not return or repair a partial aggregate.
- If a `P2002` cannot be attributed to `normalizedName`, rethrow it instead of reporting a false name conflict.
- If an error is not exactly a `P2025` from replace/delete, do not report not-found.
- If the fake cannot prove exact rollback, strengthen its transaction snapshot behavior rather than weakening the assertion.
- If the schema or real database reveals any cascade from `RankingSet` to `Draft` or `RankingSnapshot`, stop and report the architecture violation.
- If no explicitly isolated PostgreSQL database is available, do not use another database and do not mark Task 11 complete; report the missing integration validation.
- If the isolated database schema is stale, apply the current schema only with its URL explicitly assigned as `DATABASE_URL`.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 12: bootstrap the existing seed rankings as one deterministic managed ranking set through the supported conversion and repository path, with idempotent initialization and no duplicate set on repeated startup.

## Documentation Recommendation

No architecture or decision update is expected for Task 11 because the mutable-set lifecycle and immutable-snapshot boundary are already documented. After implementation, update only Task 11 completion and this slice status unless implementation reveals a new durable decision.

The existing recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains open before production deployment; do not fold it into this slice.

## Slice Review

- Smallest meaningful increment: yes. It completes only repository replacement and deletion, leaving seed bootstrap and application workflows for later tasks.
- Executable by a lower-reasoning pass: yes. APIs, result shapes, transaction order, error mapping, fake behavior, database proof, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It extends the existing repository and transaction seams without changing schema boundaries or adding abstractions.
- Blast radius reasonable: yes. Four source/document files are expected.
- Review/revert comfort: yes. The change is confined to two repository files plus task/status documentation and has no migration.
- Observable/testable acceptance criteria: yes. Exact reloads, rollback, stable outcomes, isolation, and real snapshot survival are directly asserted.
