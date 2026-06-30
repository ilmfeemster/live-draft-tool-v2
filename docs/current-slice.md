# Current Slice: Bootstrap Seed Rankings as a Managed Set

## Completion Status

Planned. Phase 5 Task 11 is complete; this slice promotes Phase 5 Task 12 only. Stop after implementing and validating this slice; do not begin the application import workflow, ranking management workflow, snapshot formalization, draft-selection integration, or UI.

## Source Context

- The current seed rankings live in `src/data/seedRankings.ts` as a generated `RankingEntry[]` derived from `src/data/FantasyPros_2026_Draft_ALL_Rankings.csv`.
- The seed array currently remains the direct runtime input for default draft creation in `src/lib/draftWorkspaceLoader.ts`.
- The existing seed data already has canonical overall rank, player identity, player name, team, position, position rank, tier, and ADP values. Some ADP values are `null`, so seed ADP capability must be `partial`, not `complete`.
- Ranking-set validation already enforces canonical order, derived position rank, team/ADP capability consistency, and per-position tier capability consistency.
- The ranking-set repository now supports create, replace, load, list, and delete through complete canonical `RankingSet` aggregates.
- Draft snapshots remain immutable and independent from mutable ranking sets. This slice should make the seed set available through the managed ranking path without changing recommendation scoring or draft snapshot semantics.

## Goal

Create an idempotent bootstrap path that stores the existing seed rankings as one valid managed `RankingSet`, proves it is domain-equivalent to the current seed array, and proves recommendations are unchanged when the managed seed entries are used instead of the legacy seed array.

## Scope

### Goals

- Add one focused seed-ranking bootstrap module.
- Define stable managed-seed constants for local ranking-set ID and display name.
- Build a complete canonical seed `RankingSet` from `seedRankings`.
- Preserve every seed entry value exactly: player ID, name, team, position, overall rank, position rank, tier, and ADP.
- Use seed provenance with `source.kind: "seed"` and source metadata that identifies the checked-in FantasyPros seed asset.
- Derive capability metadata from the actual seed entries:
  - team: `complete` when every player has a non-empty non-unknown team;
  - playerIdentity: `provided`;
  - overallOrder: `explicit`;
  - positionRank: `derived`;
  - ADP: `partial` when at least one entry has ADP and at least one has `null`;
  - tiers: `source` for represented positions only, with no `defaulted-neutral` seed tier fallback.
- Validate the built seed set before persistence and return an explicit bootstrap failure if validation fails.
- Persist the seed set through the public injected ranking-set repository path.
- Make bootstrap idempotent: repeated calls must leave one managed seed set, not duplicate records.
- If the existing managed seed record is already domain-equivalent to the current seed aggregate, return it without writing.
- If the seed record exists but differs from the current seed aggregate, replace it atomically through `replaceRankingSet`.
- Make the managed seed set loadable by stable ID through the repository after bootstrap.
- Add focused tests for exact seed conversion, idempotency, replacement of stale seed data, explicit failure, and recommendation parity.

### Non-Goals

- Do not remove `src/data/seedRankings.ts`.
- Do not import external files during bootstrap.
- Do not parse the CSV at runtime.
- Do not add an application import workflow.
- Do not add ranking library, import/export, management, or edit UI.
- Do not change draft setup to require explicit ranking-set selection yet.
- Do not change recommendation tuning, scoring, explanations, or ordering rules.
- Do not change Prisma schema, migrations, generated client, dependencies, or seed CSV generation.
- Do not silently repair invalid seed data.
- Do not update existing draft snapshots or scenario documents.

## Implementation Design

### Public API

Add a small module, tentatively `src/lib/managedSeedRankingSet.ts`, exporting:

```ts
export const MANAGED_SEED_RANKING_SET_ID = "seed-rankings-2026-fantasypros";
export const MANAGED_SEED_RANKING_SET_NAME = "FantasyPros 2026 Seed Rankings";

export type BootstrapManagedSeedRankingSetResult =
  | Readonly<{ ok: true; rankingSet: RankingSet; created: boolean; replaced: boolean }>
  | Readonly<{ ok: false; errors: readonly BootstrapManagedSeedRankingSetError[] }>;

export function buildManagedSeedRankingSet(timestamp: Date): RankingSet;
export async function bootstrapManagedSeedRankingSet(
  repository?: ManagedSeedRankingSetRepository,
  timestamp?: Date,
): Promise<BootstrapManagedSeedRankingSetResult>;
export async function getManagedSeedRankingSet(
  repository?: Pick<ManagedSeedRankingSetRepository, "getRankingSetById">,
): Promise<RankingSet | null>;
```

The exact result shape may be adjusted during implementation if the tests show a simpler shape is clearer, but it must distinguish success from explicit bootstrap failure and should expose whether a write happened for idempotency assertions.

### Repository Contract

Use a local structural repository type that includes only:

- `createRankingSet`
- `replaceRankingSet`
- `getRankingSetById`

Default to the existing exported ranking-set repository wrappers. Tests should inject a fake repository instead of requiring a real database for focused bootstrap behavior.

### Seed Aggregate Construction

`buildManagedSeedRankingSet(timestamp)` must:

1. Require `timestamp` to be a valid `Date`.
2. Deep-copy every seed ranking entry so callers cannot mutate `seedRankings`.
3. Use the stable seed ID and name.
4. Set source provenance to:
   - `kind: "seed"`;
   - `formatId: "fantasypros-csv"`;
   - `formatVersion: 1`;
   - `label: "FantasyPros_2026_Draft_ALL_Rankings.csv"`;
   - `importedAt: timestamp`.
5. Set `createdAt` and `updatedAt` to clones of `timestamp`.
6. Derive capabilities from the copied entries, including `adp: "partial"` for the current seed file because it contains both numeric ADP values and `null`.
7. Validate with `validateRankingSet` before returning. If validation fails, throw a local construction error or return a failure through the bootstrap function; do not persist.

Do not pass the seed array through parser, normalizer, or import conversion stages. The checked-in seed array is already the current runtime canonical input, and this slice exists to bootstrap that canonical input into managed persistence.

### Bootstrap Flow

`bootstrapManagedSeedRankingSet(repository, timestamp)` must:

1. Build and validate the expected managed seed aggregate.
2. Load `MANAGED_SEED_RANKING_SET_ID`.
3. If no record exists, call `createRankingSet(expectedSeedSet)`.
4. If the loaded record is domain-equivalent to the expected seed set, return success without create or replace.
5. If the loaded record exists but differs from expected, call `replaceRankingSet(expectedSeedSet)`.
6. Map repository invalid, conflict, and not-found outcomes into explicit bootstrap errors. Do not swallow unexpected thrown persistence failures.

Domain equivalence should compare the ranking-set fields owned by this bootstrap aggregate. Since the seed aggregate uses the provided timestamp for lifecycle and source import time, tests should pass a fixed timestamp so equality is deterministic. If a pre-existing seed has the same entries and metadata but older lifecycle values, replacement is acceptable; do not invent partial-update behavior.

### Failure Results

Use stable bootstrap error codes, for example:

- `invalid-seed-ranking-set`
- `name-conflict`
- `not-found`
- `repository-rejected`

Validation failures must include the original domain paths/messages. A name conflict means another set owns the seed display name; return an explicit failure and leave existing data unchanged. A not-found during replacement means the loaded seed disappeared between load and replace; return an explicit failure rather than creating a second record.

### Focused Tests

Create `src/lib/managedSeedRankingSet.test.ts` with a small fake repository. Cover:

- `buildManagedSeedRankingSet` returns a valid canonical ranking set with the stable ID/name, seed provenance, copied entries, exact seed ranking values, `adp: "partial"`, `team: "complete"`, `playerIdentity: "provided"`, `overallOrder: "explicit"`, `positionRank: "derived"`, and source tier capabilities only for represented positions.
- Mutating the returned ranking set does not mutate `seedRankings`.
- Bootstrap creates the seed set when missing and the created set reloads by stable ID.
- Repeated bootstrap with the same timestamp performs no second create and no replace.
- A stale managed seed record is replaced atomically through `replaceRankingSet`.
- Invalid constructed seed data, repository validation rejection, name conflict, and replace not-found are returned as explicit bootstrap failures.
- Recommendation parity: for at least one deterministic draft input, `generatePlayerRecommendations` returns identical player IDs, scores, components, adjustments, and reasons when called with `seedRankings` versus the managed seed set's entries.

The fake repository can be local to the test file. It should store complete `RankingSet` values, clone them on read/write, enforce same-name conflicts, and count create/replace calls for idempotency assertions. Do not duplicate the ranking-set repository fake unless a small focused fake is insufficient.

### Runtime Loader Boundary

Do not make broad draft-creation changes in this slice. If a minimal integration is needed to satisfy "runtime ranking selection can load the seed set," expose `getManagedSeedRankingSet` and test that it reads the bootstrapped set by stable ID. Leave default draft creation's direct use of `seedRankings` in `draftWorkspaceLoader.ts` for the later ranking-set selection slice unless the implementation reveals a direct conflict with Task 12 acceptance criteria.

## Implementation Steps

1. Add `src/lib/managedSeedRankingSet.ts` with stable constants, seed aggregate construction, capability derivation, validation handling, bootstrap, and load helper.
2. Add `src/lib/managedSeedRankingSet.test.ts` with focused fake-repository tests for conversion, idempotency, stale replacement, explicit failures, and recommendation parity.
3. Keep repository code unchanged unless a tiny exported type or helper is clearly required by the bootstrap module.
4. Run focused tests for the new bootstrap module.
5. Run the existing ranking-set repository tests to guard the persistence path.
6. Run TypeScript no-emit and focused lint for the new files.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 12 complete in `docs/tasks.md` and update this slice's completion status.
9. Report results and stop. Do not begin Task 13.

## Expected Files

- `src/lib/managedSeedRankingSet.ts`
- `src/lib/managedSeedRankingSet.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

Avoid changes to Prisma schema, migrations, generated client, dependencies, seed CSV/source generation, draft repository, recommendation engine, scenario files, ranking import pipeline, and UI files. `src/lib/draftWorkspaceLoader.ts` is not expected to change in this slice.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/managedSeedRankingSet.test.ts
npm test -- src/lib/rankingSetRepository.test.ts
npx tsc --noEmit
npm run lint -- src/lib/managedSeedRankingSet.ts src/lib/managedSeedRankingSet.test.ts
npm test
npm run lint
```

Expected result:

- focused managed-seed tests pass;
- existing ranking-set repository lifecycle tests still pass;
- TypeScript no-emit passes;
- focused lint passes without warnings;
- the full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- repository-wide lint passes;
- existing draft loading, snapshot, scenario, and recommendation behavior remains unchanged.

## Acceptance Criteria

- The existing seed rankings can be represented as one valid canonical managed `RankingSet`.
- The managed seed set preserves every existing seed ranking entry value exactly.
- Seed capabilities accurately reflect current seed data, including partial ADP and source tiers with no neutral tier fallback.
- Bootstrap creates exactly one managed seed set when missing.
- Repeated bootstrap does not create duplicate seed sets.
- A stale managed seed set is replaced through the repository under the same local seed ID.
- A bootstrapped seed set can be loaded by stable ID through the repository.
- Invalid seed construction or repository rejection returns an explicit bootstrap failure and leaves no partial managed seed write.
- Recommendation output is identical for equivalent draft inputs using `seedRankings` and the managed seed set entries.
- Existing draft, repository, snapshot, scenario, and recommendation tests continue to pass.
- Only Phase 5 Task 12 is checked complete after validation passes.
- No schema, migration, dependency, generated source, external-file import, user-facing seed control, recommendation tuning, or UI change is introduced.

## Failure Handling

- If `seedRankings` fails canonical `RankingSet` validation, stop and report the validation errors instead of repairing the seed data.
- If idempotency cannot be achieved with the current repository API, stop and report the missing repository behavior instead of adding duplicate seed records.
- If the repository returns a name conflict for the seed name, return an explicit bootstrap failure; do not rename the seed set automatically.
- If replacement reports not-found after a successful load, return an explicit failure; do not create a second seed set in the same call.
- If recommendation parity fails, do not change recommendation tuning or expectations; identify the seed mapping discrepancy.
- If unrelated tests fail, report them separately and do not broaden this slice.

## Follow-Up Slice

Promote Phase 5 Task 13: add the application import workflow that orchestrates preflight, supported parser selection, normalization, validation, domain conversion, and atomic create/replace persistence without allowing invalid imports to affect stored data.

## Documentation Recommendation

After implementation, update only `docs/tasks.md` for Task 12 completion and this slice status unless implementation reveals a durable architecture or product decision. No architecture or decision update is expected if the slice remains a simple bootstrap helper around the already documented mutable ranking-set repository and immutable draft-snapshot boundary.

The open recommendation to establish a checked-in Prisma migration baseline and document local/CI database setup remains outside this slice.

## Slice Review

- Smallest meaningful increment: yes. It only bootstraps the existing seed rankings into one managed set and proves parity.
- Executable by a lower-reasoning pass: yes. Constants, API shape, flow, tests, failure handling, and validation commands are explicit.
- Avoids unnecessary architecture changes: yes. It uses the existing seed data and ranking-set repository without schema, UI, or workflow expansion.
- Blast radius reasonable: yes. Two source/test files plus task/status documentation are expected.
- Review/revert comfort: yes. The change is isolated and does not alter recommendation logic or persistence schema.
- Observable/testable acceptance criteria: yes. Exact seed equivalence, idempotency, stale replacement, loadability, failure results, and recommendation parity are directly asserted.
