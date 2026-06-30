# Current Slice: Add Application Ranking Management and Export Workflows

## Completion Status

Planned. Phase 5 Task 13 is complete; this slice promotes Phase 5 Task 14 only. Stop after implementing and validating this slice; do not begin snapshot formalization, draft ranking-set selection, ranking library UI, editing UI, or Phase 5 regression work.

## Source Context

- `src/lib/rankingSetRepository.ts` already exposes domain-facing repository operations for:
  - listing lightweight ranking-set summaries;
  - loading one complete ranking set by local ID;
  - atomically replacing a complete ranking set;
  - deleting a ranking set by local ID.
- `src/lib/rankingSetEditing.ts` already exposes pure edit intents and `editRankingSet`, which returns a complete validated replacement aggregate or structured edit errors.
- `src/lib/canonicalRankingJsonExporter.ts` already exposes `exportCanonicalRankingSetJson`, which validates a loaded ranking set and returns deterministic Canonical Ranking Set JSON V1 without mutating persistence.
- `src/lib/rankingImportWorkflow.ts` now provides the create/replace import workflow. This slice should complement it with management/export workflows; it should not change the import workflow.
- Repository deletion already proved, through the database-gated repository integration test, that deleting mutable ranking sets leaves independent draft ranking snapshots unchanged. This application slice should not query or mutate snapshots.

## Goal

Expose repository-backed ranking management and canonical export operations through a focused application boundary suitable for later UI use, while preserving domain values, mapping expected failures into structured application results, using pure edit operations for replacements, and avoiding any snapshot or UI coupling.

## Scope

### Goals

- Add one application-level ranking management workflow module.
- List ranking-set summaries through the repository.
- Load one complete ranking set through the repository and return an explicit not-found result for missing IDs.
- Apply supported pure edit intents by:
  - loading the current ranking set;
  - running `editRankingSet`;
  - persisting only the complete edited aggregate through `replaceRankingSet`;
  - returning the saved repository-owned aggregate.
- Delete one ranking set through the repository and map not-found to a structured result.
- Export a loaded ranking set through `exportCanonicalRankingSetJson`.
- Preserve field-capability metadata in list, load, edit, and export results.
- Map expected not-found, validation/edit, name-conflict, invalid-ranking-set, delete, and export failures into structured application errors.
- Keep application results free of persistence records, Prisma errors, React state, browser file APIs, and framework-specific objects.

### Non-Goals

- Do not add UI, server actions, file downloads, routing, or browser file handling.
- Do not add import workflow changes.
- Do not expose direct entry persistence or repository internals.
- Do not add history, undo, restore, merge, comparison, duplicate, or cross-source reconciliation.
- Do not export FantasyPros CSV or any format other than Canonical Ranking Set JSON V1.
- Do not edit, refresh, migrate, query, or rewrite snapshots or existing drafts.
- Do not change recommendation scoring, draft creation, scenario behavior, seed bootstrap, Prisma schema, migrations, generated client, or dependencies.

## Implementation Design

### Public API

Add `src/lib/rankingManagementWorkflow.ts` with small application-facing functions. Use exact names where practical:

```ts
type RankingManagementError = Readonly<{
  code:
    | "not-found"
    | "invalid-request"
    | "invalid-edit"
    | "name-conflict"
    | "invalid-ranking-set"
    | "export-failed"
    | "persistence-rejected";
  message: string;
  path?: string;
}>;

type RankingManagementResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; errors: readonly RankingManagementError[] }>;

export async function listManagedRankingSets(...): Promise<RankingManagementResult<readonly RankingSetSummary[]>>;
export async function loadManagedRankingSet(...): Promise<RankingManagementResult<RankingSet>>;
export async function editManagedRankingSet(...): Promise<RankingManagementResult<RankingSet>>;
export async function deleteManagedRankingSet(...): Promise<RankingManagementResult<{ id: string }>>;
export async function exportManagedRankingSetJson(...): Promise<RankingManagementResult<CanonicalRankingJsonExportValue>>;
```

The implementation may refine result type names, but it must keep one consistent result pattern and avoid throwing for expected user-facing failures.

### Repository Contract

Use a local structural repository type that includes only the methods this workflow needs:

- `listRankingSetSummaries`
- `getRankingSetById`
- `replaceRankingSet`
- `deleteRankingSetById`

Default to the existing exported repository wrappers. Tests should inject a focused fake repository.

### List Flow

`listManagedRankingSets` must:

1. Call repository `listRankingSetSummaries`.
2. Return the summaries as domain-facing values.
3. Avoid selecting or returning full ranking entries through this workflow.

Do not add pagination, filtering, sorting changes, or search in this slice.

### Load Flow

`loadManagedRankingSet(id)` must:

1. Validate that `id` is a non-empty string.
2. Call repository `getRankingSetById(id)`.
3. Return the loaded complete ranking set on success.
4. Return one `not-found` error with `path: "id"` when missing.

Do not expose `null` from the application workflow.

### Edit Flow

`editManagedRankingSet(input)` must:

1. Validate a non-empty ranking-set ID and valid `updatedAt` request date enough to return application errors for malformed requests.
2. Load the current set by ID.
3. Return `not-found` if missing.
4. Call `editRankingSet(current, { intent, updatedAt })`.
5. Map edit errors to application errors with `code: "invalid-edit"` while preserving messages and paths.
6. If editing succeeds, call repository `replaceRankingSet(edited.rankingSet)`.
7. Map repository outcomes:
   - `name-conflict` -> `name-conflict`;
   - `invalid-ranking-set` -> `invalid-ranking-set`;
   - `not-found` -> `not-found`;
   - any future expected result error -> `persistence-rejected`.
8. Return the repository-owned saved ranking set.

Do not persist anything when load or pure edit fails. Do not patch individual entries directly. Do not recompute edit behavior outside `editRankingSet`.

### Delete Flow

`deleteManagedRankingSet(id)` must:

1. Validate that `id` is a non-empty string.
2. Call repository `deleteRankingSetById(id)`.
3. Return `{ id }` on success.
4. Map repository not-found to `not-found`.

Do not query or mutate draft snapshots, drafts, scenarios, recommendations, or managed seed bootstrap state. Snapshot survival is owned by the repository/database boundary already tested in Task 11.

### Export Flow

`exportManagedRankingSetJson(input)` must:

1. Validate a non-empty ranking-set ID and valid `exportedAt` date enough to return application errors for malformed requests.
2. Load the set by ID.
3. Return `not-found` if missing.
4. Call `exportCanonicalRankingSetJson(loaded, { exportedAt, includeSourceRankingSetId })`.
5. Return the exporter's `value` on success.
6. Map exporter failures to `export-failed`, preserving messages and paths.

Export must not call create, replace, delete, or any mutation repository method. It should not reclassify defaulted-neutral values as source-provided; rely on the exporter preserving capability metadata.

### Error Mapping

Use stable, domain-facing application errors:

- `invalid-request` for malformed workflow inputs;
- `not-found` for missing ranking-set IDs;
- `invalid-edit` for pure edit failures;
- `name-conflict` for repository normalized-name conflicts;
- `invalid-ranking-set` for repository replacement validation failures;
- `export-failed` for canonical exporter failures;
- `persistence-rejected` for any future expected repository result that cannot be mapped more narrowly.

Unexpected thrown repository or exporter failures should still throw. Do not catch and reword unknown infrastructure failures.

### Tests

Add `src/lib/rankingManagementWorkflow.test.ts` with a focused fake repository. Cover:

- list returns summaries without loading full entries;
- load returns a complete domain ranking set and maps missing/blank IDs to structured errors;
- rename edit loads, applies `editRankingSet`, persists through `replaceRankingSet`, returns the saved aggregate, and preserves all unrelated values;
- player correction, reorder, and tier update/assignment are passed through the pure edit path and persisted only as complete valid replacements;
- invalid edit intent/date/player/tier failures return `invalid-edit` or `invalid-request` and do not call replace;
- repository replace name-conflict, invalid-ranking-set, and not-found outcomes map to stable errors and preserve the prior fake record;
- delete returns the deleted ID, removes only that record in the fake, and maps missing/blank IDs to stable errors;
- delete does not call load, replace, export, or any snapshot-like method;
- export loads a set, returns deterministic canonical JSON/text/byteLength, can include source ranking-set ID when requested, and performs no repository mutation;
- export missing/blank ID or invalid exportedAt returns structured errors;
- export preserves degraded/defaulted capability metadata in the document;
- all returned ranking sets, summaries, and export documents are independently owned values.

Keep the fake repository local to the test file, clone stored/returned values, count calls, and support configured repository result failures.

## Implementation Steps

1. Add `src/lib/rankingManagementWorkflow.ts` with request/result types, injected repository dependency, list/load/edit/delete/export functions, validation helpers, and error mapping.
2. Add `src/lib/rankingManagementWorkflow.test.ts` with focused fake-repository tests for list, load, edit persistence, edit failure isolation, delete, export, failure mapping, no mutation during export, and ownership.
3. Keep repository, pure editing, exporter, import workflow, seed, draft, snapshot, scenario, and UI files unchanged unless TypeScript requires a tiny exported type.
4. Run focused workflow tests.
5. Run focused tests for `rankingSetEditing`, `canonicalRankingJsonExporter`, and `rankingSetRepository`.
6. Run TypeScript no-emit and focused lint for the new workflow files.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 14 complete in `docs/tasks.md` and update this slice's completion status.
9. Report results and stop. Do not begin Task 15.

## Expected Files

- `src/lib/rankingManagementWorkflow.ts`
- `src/lib/rankingManagementWorkflow.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

Avoid changes to Prisma schema, migrations, generated client, dependencies, import workflow, seed bootstrap, draft repository, draft workflow, recommendation engine, scenario files, snapshot files, and UI files.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingManagementWorkflow.test.ts
npm test -- src/lib/rankingSetEditing.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingManagementWorkflow.ts src/lib/rankingManagementWorkflow.test.ts
npm test
npm run lint
```

Expected result:

- focused management workflow tests pass for list, load, edit, delete, export, error mapping, and mutation isolation;
- focused editing/exporter/repository tests continue to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Acceptance Criteria

- List and load operations return domain-facing values and never persistence records.
- Supported edits use `editRankingSet` and atomic repository replacement.
- Invalid edits, missing targets, conflicts, and repository validation failures preserve the current stored set.
- Delete removes only the requested mutable ranking set through the repository and maps not-found without leaking persistence errors.
- Delete does not query or mutate drafts, snapshots, scenarios, or recommendations.
- Export is deterministic, performs no persistence mutation, and returns Canonical Ranking Set JSON V1 values.
- Editing and export preserve field-capability metadata and never recast neutral fallback values as source-provided data.
- Expected not-found, conflict, validation, edit, delete, and export failures return structured application errors.
- Existing import workflow, repository, editing, export, seed, draft, snapshot, scenario, and recommendation behavior remains unchanged.
- Only Phase 5 Task 14 is checked complete after validation passes.
- No schema, dependency, generated source, UI, draft creation, snapshot, scenario, or recommendation-tuning change is introduced.

## Failure Handling

- If load returns missing before edit/export, return `not-found`; do not attempt edit/export/persist.
- If pure editing fails, return mapped edit errors and do not call repository replacement.
- If repository replacement returns not-found after a successful load, return `not-found`; do not create a new set.
- If repository deletion returns not-found, return `not-found`; do not infer success.
- If canonical export fails, return mapped export errors and do not persist anything.
- If unexpected repository or exporter errors throw, let them throw.
- If a test expectation suggests changing pure editing, repository, or exporter behavior, stop and report the discrepancy rather than broadening the slice.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 15: formalize immutable snapshot creation from managed rankings while preserving legacy snapshot loading, Scenario V1 replay, and source-set edit/delete isolation.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 14 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains a thin application boundary over already documented repository, editing, export, and immutable snapshot separation.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It adds only application management/export boundaries over existing repository, edit, delete, and export capabilities.
- Executable by a lower-reasoning pass: yes. Inputs, flows, error mapping, tests, expected files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing modules without schema, UI, snapshot, or repository refactors.
- Blast radius reasonable: yes. Two source/test files plus task/status documentation are expected.
- Review/revert comfort: yes. The workflow is isolated and has no migration or UI coupling.
- Observable/testable acceptance criteria: yes. List/load/edit/delete/export results, mutation isolation, deterministic export, and failure mapping are directly asserted.
