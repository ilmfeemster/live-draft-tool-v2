# Current Slice: Add Application Ranking Import Workflow

## Completion Status

Complete. The application ranking import workflow is implemented as a thin orchestrator over the existing preflight, parser, normalizer, candidate validation, conversion, and ranking-set repository boundaries. It supports create and explicit replace intents, preserves replacement identity and `createdAt`, accumulates warnings, maps expected repository outcomes to persist-stage diagnostics, and proves failure isolation before repository writes. Focused workflow tests pass 10 tests; underlying import-stage and repository tests pass 143 tests with one expected database-gated skip; TypeScript no-emit passes; focused lint passes; the full Vitest suite passes 39 files and 542 tests with one expected database-gated skip; repository-wide lint passes. Phase 5 Task 13 is complete.

## Source Context

- The import pipeline already has staged, typed public boundaries:
  - `preflightRankingImport` in `src/lib/rankingImportPreflight.ts`;
  - `parseFantasyProsCsv` in `src/lib/fantasyProsCsvParser.ts`;
  - `parseCanonicalRankingJson` in `src/lib/canonicalRankingJsonParser.ts`;
  - `normalizeRankingSource` in `src/lib/rankingNormalizer.ts`;
  - `validateNormalizedRankingCandidate` in `src/lib/rankingCandidateValidation.ts`;
  - `convertValidatedRankingCandidate` in `src/lib/rankingSetConversion.ts`;
  - `createRankingSet`, `replaceRankingSet`, and `getRankingSetById` in `src/lib/rankingSetRepository.ts`.
- `RankingImportStage` already includes `"persist"`, but no application workflow currently orchestrates the full import-to-repository sequence.
- `RankingImportDiagnostic` is the shared application-facing diagnostic shape and already supports stage, severity, message, and optional path/row/column/field location.
- Conversion requires a local ranking-set ID and lifecycle timestamp. Replacement also requires the existing set's `createdAt`.
- The repository accepts only complete canonical `RankingSet` aggregates and returns expected invalid-set, name-conflict, and not-found outcomes without leaking persistence records.
- The managed seed bootstrap from Task 12 is complete and is not part of this import workflow.

## Goal

Add a focused application import workflow that accepts supported ranking import text plus an explicit create or replace intent, executes the staged import pipeline in order, persists only a complete canonical ranking set, returns accumulated warnings and stable diagnostics, and proves invalid input at any stage leaves existing managed rankings unchanged.

## Scope

### Goals

- Add one application-level ranking import workflow module.
- Accept import text, explicit supported format ID/version, desired set name, optional source label, and create or explicit replacement intent.
- Convert text to UTF-8 bytes and run the existing preflight boundary before parsing.
- Dispatch only the two supported parsers:
  - FantasyPros CSV V1;
  - Canonical Ranking Set JSON V1.
- Normalize with the supplied name, source label, and import timestamp.
- Validate the normalized candidate before conversion.
- Convert only validated candidates into complete canonical `RankingSet` aggregates.
- Create a new local ranking set by default.
- Preserve local set identity only for an explicit replacement intent.
- For replacement, load the target set before conversion to preserve its `createdAt`; return a stable not-found diagnostic if it is missing.
- Persist only through repository `createRankingSet` or `replaceRankingSet`.
- Return the saved canonical ranking set and all non-blocking warnings on success.
- Return only diagnostics and accumulated warnings on failure.
- Ensure invalid imports, conversion failures, repository validation failures, conflicts, and missing replacement targets do not create or replace stored data.

### Non-Goals

- Do not read browser files directly.
- Do not add UI, previews, drag-and-drop, toasts, or server actions.
- Do not auto-detect arbitrary formats.
- Do not support unsupported format versions.
- Do not merge imported rows into an existing ranking set.
- Do not expose entry-level repository operations.
- Do not create drafts, snapshots, scenarios, or recommendation inputs.
- Do not alter parser, normalizer, validator, conversion, or repository contracts unless a tiny exported type is required.
- Do not change Prisma schema, migrations, generated client, dependencies, seed bootstrap, or ranking UI.

## Implementation Design

### Public API

Add `src/lib/rankingImportWorkflow.ts` with a small application-facing API. Use exact names where practical:

```ts
type ImportRankingSetIntent =
  | Readonly<{ kind: "create"; rankingSetId?: string }>
  | Readonly<{ kind: "replace"; rankingSetId: string }>;

type ImportRankingSetInput = Readonly<{
  text: string;
  formatId: RankingImportFormatId;
  formatVersion?: 1;
  name: string;
  sourceLabel?: string;
  intent?: ImportRankingSetIntent;
  importedAt?: Date;
}>;

type ImportRankingSetResult =
  | Readonly<{
      ok: true;
      rankingSet: RankingSet;
      warnings: readonly RankingImportDiagnostic[];
      created: boolean;
      replaced: boolean;
    }>
  | Readonly<{
      ok: false;
      errors: readonly RankingImportDiagnostic[];
      warnings: readonly RankingImportDiagnostic[];
    }>;

type RankingImportWorkflowRepository = Readonly<{
  createRankingSet(rankingSet: RankingSet): Promise<CreateRankingSetResult>;
  replaceRankingSet(rankingSet: RankingSet): Promise<ReplaceRankingSetResult>;
  getRankingSetById(id: string): Promise<RankingSet | null>;
}>;

export async function importRankingSet(
  input: ImportRankingSetInput,
  options?: Readonly<{
    repository?: RankingImportWorkflowRepository;
    generateRankingSetId?: () => string;
    now?: () => Date;
  }>,
): Promise<ImportRankingSetResult>;
```

The implementation may refine type names, but it must keep the surface focused and testable. Default dependencies should use the existing repository wrappers, a local ID generator, and `new Date()`. Tests should inject repository, ID, and timestamp dependencies for determinism.

### Workflow Order

`importRankingSet` must execute stages in this order:

1. Validate application input shape enough to produce diagnostics instead of throwing for ordinary user mistakes:
   - non-empty text;
   - supported `formatId`;
   - `formatVersion` defaults to `1`;
   - non-empty name;
   - valid `importedAt` or injected current time;
   - create intent or explicit replacement intent with non-empty target ID.
2. Encode text with `TextEncoder` and call `preflightRankingImport`.
3. Dispatch parser based on the preflighted format:
   - `fantasypros-csv` -> `parseFantasyProsCsv`;
   - `canonical-ranking-json` -> `parseCanonicalRankingJson`.
4. Call `normalizeRankingSource` with:
   - `name`;
   - `sourceLabel` when supplied;
   - `importedAt`.
5. Call `validateNormalizedRankingCandidate`.
6. For create:
   - use `intent.rankingSetId` if supplied, otherwise generate a new local ID;
   - call `convertValidatedRankingCandidate` with `workflow: "create"`.
7. For replace:
   - call `getRankingSetById(intent.rankingSetId)`;
   - if missing, return a `"persist"` stage not-found diagnostic;
   - call `convertValidatedRankingCandidate` with `workflow: "replace"`, the target ID, the existing set's `createdAt`, and the import timestamp.
8. Persist the converted ranking set with the matching repository operation.
9. Return the repository-owned saved ranking set on success.

Do not call repository create/replace before all earlier stages have succeeded. Do not pass parsed or normalized values to the repository.

### Diagnostic Handling

Accumulate warnings from each successful stage in order. When a stage fails:

- return that stage's errors;
- include warnings accumulated before the failure and warnings returned by the failed stage;
- do not continue to later stages.

Use existing diagnostics directly for preflight, parse, normalize, validate, and convert failures. Add only small workflow/persistence diagnostics where the orchestrator itself is responsible.

Use stable workflow/persist codes such as:

- `invalid-import-request`;
- `invalid-replacement-target`;
- `persistence-name-conflict`;
- `persistence-not-found`;
- `persistence-invalid-ranking-set`;
- `persistence-rejected`.

All repository outcome diagnostics must use `stage: "persist"` and `severity: "error"`. Preserve repository error paths where available as diagnostic `location.path`.

Unexpected thrown repository errors should still throw; only expected repository result failures become diagnostics.

### Create Identity

For create workflows:

- default intent is `{ kind: "create" }`;
- if a test supplies `rankingSetId`, use it directly;
- otherwise generate one local ID;
- if the generated or supplied ID is invalid, let conversion return a convert-stage diagnostic;
- never reuse portable canonical JSON source IDs as local IDs.

Do not query for uniqueness before create. Let the repository create operation report a name conflict or ID conflict as it does today.

### Replace Identity

For replacement workflows:

- require `intent.kind === "replace"` and a non-empty `rankingSetId`;
- load the existing set by that ID only to obtain `createdAt` and to produce an early, stable not-found diagnostic;
- preserve the loaded set's local ID and creation timestamp through conversion;
- use the import timestamp as `updatedAt`;
- persist through `replaceRankingSet`;
- if repository replacement returns not-found because the set disappeared after load, return a persist not-found diagnostic and do not create a new set.

Replacement must not merge imported rows with old rows. It replaces the entire set through the repository.

### Tests

Add `src/lib/rankingImportWorkflow.test.ts` with a small fake repository and injected ID/time. Cover:

- valid FantasyPros CSV create persists one canonical ranking set through `createRankingSet`, returns the saved set, generated local ID, and no persistence-only fields;
- valid Canonical Ranking JSON create persists an independent set and does not reuse portable `sourceRankingSetId`;
- CSV with permitted missing optional fields succeeds with materialized fallbacks and returns normalization warnings;
- unsupported format, invalid UTF-8/empty input, parser failure, normalization failure, validation failure, and conversion failure stop at the correct stage and perform no repository write;
- create name conflict maps to a persist-stage conflict diagnostic and leaves existing sets unchanged;
- replacement requires explicit target ID, loads the existing set, preserves local ID and original `createdAt`, updates lifecycle timestamp, and calls `replaceRankingSet`;
- failed replacement at any import stage leaves the existing set unchanged;
- replacement missing before conversion returns a persist-stage not-found diagnostic and performs no replace;
- replacement not-found returned by repository after conversion maps to a persist-stage not-found diagnostic;
- diagnostics retain row, field, or path locations through the application result;
- warnings are preserved on successful degraded imports and accumulated before later failures;
- parsed and normalized intermediate values never reach repository calls.

The fake repository should clone stored and returned ranking sets, count create/replace/load calls, enforce normalized-name conflicts where needed, and allow configured repository result failures.

### Suggested Fixtures

Use compact inline fixtures rather than reading large files:

- representative FantasyPros CSV:

```text
RK,TIERS,PLAYER NAME,TEAM,POS,ECR VS ADP
2,1,Runner,BUF,RB1,-
1,1,Passer,KC,QB1,+2
```

- degraded FantasyPros CSV:

```text
PLAYER NAME,POS
Fallback QB,QB
Fallback RB,RB
```

- canonical JSON V1 with `metadata.sourceRankingSetId` set to a value that must not become the local ID.

## Implementation Steps

1. Add `src/lib/rankingImportWorkflow.ts` with request/result types, injected dependencies, parser dispatch, stage orchestration, warning accumulation, create/replace conversion, repository persistence, and diagnostic mapping.
2. Add `src/lib/rankingImportWorkflow.test.ts` with focused fake-repository tests for successful CSV/JSON create, degraded create warnings, failure isolation at every stage, create conflicts, replacement identity/lifecycle behavior, missing replacement targets, and diagnostic location preservation.
3. Keep existing parser, normalizer, validator, conversion, repository, seed, draft, scenario, and UI files unchanged unless TypeScript requires a tiny exported type.
4. Run focused workflow tests.
5. Run focused tests for the underlying import/conversion/repository modules touched by the orchestration path.
6. Run TypeScript no-emit and focused lint for the new workflow files.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 13 complete in `docs/tasks.md` and update this slice's completion status.
9. Report results and stop. Do not begin Task 14.

## Expected Files

- `src/lib/rankingImportWorkflow.ts`
- `src/lib/rankingImportWorkflow.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

Avoid changes to Prisma schema, migrations, generated client, dependencies, managed seed bootstrap, draft repository, draft workflow, recommendation engine, scenario files, UI files, and parser/normalizer/validator behavior unless a minimal type export is required.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingImportWorkflow.test.ts
npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingImportWorkflow.ts src/lib/rankingImportWorkflow.test.ts
npm test
npm run lint
```

Expected result:

- focused workflow tests pass for create, replace, warnings, diagnostics, and failure isolation;
- underlying import-stage and repository tests continue to pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes.

## Acceptance Criteria

- Valid CSV and canonical JSON imports create independent managed ranking sets.
- CSV imports with permitted missing optional fields succeed with deterministic fallbacks, capability metadata, and returned warnings.
- Invalid import at preflight, parse, normalize, validate, convert, or persist stages creates or replaces nothing.
- Replacement requires explicit intent and preserves the target set's local identity and original `createdAt`.
- Replacement updates the target from the imported aggregate only after all non-persistence stages succeed.
- Repository name conflicts, invalid-set rejections, and not-found outcomes map to stable persist-stage diagnostics.
- Diagnostics retain stage and source location through the application boundary.
- The workflow never passes parsed or normalized records to the repository.
- Existing import-stage, repository, seed, draft, snapshot, scenario, and recommendation behavior remains unchanged.
- Only Phase 5 Task 13 is checked complete after validation passes.
- No schema, dependency, generated source, UI, draft creation, snapshot, scenario, or recommendation-tuning change is introduced.

## Failure Handling

- If a supported stage already returns diagnostics, propagate those diagnostics rather than rewording them.
- If parser dispatch receives an impossible supported format mismatch, return an unsupported-format parse diagnostic instead of falling through.
- If a replacement target is missing before conversion, return a persist-stage not-found diagnostic and do not convert or persist.
- If repository replacement reports not-found after a prior load, return a persist-stage not-found diagnostic and do not create a new set.
- If repository create or replace throws unexpectedly, let the error throw; do not turn unknown persistence failures into user-facing diagnostics.
- If a test expectation suggests changing parser, normalization, validation, conversion, or repository behavior, stop and report the discrepancy instead of broadening the slice.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 14: expose repository-backed ranking management and export workflows for list, load, pure edit replacement, delete, and canonical export through application boundaries suitable for later UI use.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 13 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains a thin application orchestrator over already documented import stages and repository boundaries.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It adds only the application import orchestration needed to create or replace managed rankings.
- Executable by a lower-reasoning pass: yes. Inputs, flow order, diagnostics, repository behavior, tests, files, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing stages and repository APIs without schema, UI, or pipeline refactors.
- Blast radius reasonable: yes. Two source/test files plus task/status documentation are expected.
- Review/revert comfort: yes. The change is isolated to a new workflow boundary and tests.
- Observable/testable acceptance criteria: yes. Success paths, failure isolation, diagnostics, warnings, replacement identity, and repository calls are directly asserted.
