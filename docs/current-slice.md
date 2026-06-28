# Current Slice: Convert Validated Candidates into Canonical Ranking Sets

## Completion Status

Complete. Validated candidates now convert into canonical `RankingSet` aggregates through explicit create or replacement lifecycle requests. Conversion assigns contiguous overall and derived position ranks, preserves player values, tier gaps, fallbacks, provenance, and capabilities, removes import-only fields, owns new nested values and dates, and rechecks the final aggregate with `validateRankingSet`. Validation passed with 15 focused conversion tests, 449 full-suite tests, TypeScript checking, and focused and repository-wide linting.

## Source Context

Phase 5 Tasks 1 through 6 are complete:

- `RankingSet`, canonical entries, source provenance, capabilities, and lifecycle metadata are defined;
- reusable canonical domain validation exists in `validateRankingSet`;
- both supported V1 formats cross explicit preflight, parsing, and normalization boundaries;
- normalized candidates retain source order, source-only diagnostics, materialized fallbacks, and capability states;
- complete-candidate validation rejects malformed values, identity/order collisions, invalid tier progression, and inconsistent capabilities;
- successful candidate validation returns the existing `ValidatedRankingCandidate` wrapper required by conversion.

This slice promotes Phase 5 Task 7 only. It is the boundary where validated source-neutral data becomes a canonical domain aggregate. It assigns local lifecycle values and canonical ranks, removes import-only fields, and rechecks the final aggregate without persisting it.

## Goal

Convert a validated ranking candidate into a complete canonical `RankingSet` for either an explicit create or replacement workflow, assigning deterministic contiguous ranks and lifecycle values while preserving domain-relevant source data, fallbacks, capabilities, identity, and tier gaps.

## Scope

### Goals

- Add one conversion entry point that accepts only `ValidatedRankingCandidate`.
- Support exactly two explicit conversion workflows: create and replace.
- Require caller-issued local identity and lifecycle timestamps so conversion remains deterministic, repository-free, and clock-free.
- Assign a newly allocated caller-supplied local ID for create workflows.
- Preserve the caller-supplied existing local ID and original creation time only for replacement workflows.
- Sort a copied view of candidate entries by validated source order.
- Assign contiguous overall ranks from 1 through the entry count.
- Derive contiguous position ranks from canonical overall order.
- Preserve player identity, normalized name, team, position, ADP, tier values, and source tier gaps.
- Preserve materialized `UNKNOWN_TEAM`, null ADP, and `NEUTRAL_TIER` fallbacks.
- Copy source provenance and capability metadata into new domain-owned values.
- Remove source index, source order, supplied source-position rank, record location, and field locations from canonical entries.
- Recheck the completed aggregate with `validateRankingSet` before returning it.
- Map any final canonical invariant failure into stable convert-stage diagnostics.
- Guarantee that conversion does not mutate or alias mutable nested values from the validated candidate or conversion request.
- Add exact tests for create, replace, rank assignment, source formats, fallbacks, lifecycle failures, invariant recheck, and immutability.
- Check Phase 5 Task 7 complete only after all validation passes.

### Non-Goals

- Parsing, normalizing, validating, repairing, or defaulting an unvalidated candidate.
- Generating UUIDs or reading the clock inside conversion.
- Proving that a create ID is unused or that a replacement ID exists in persistence.
- Persisting, loading, listing, replacing, or deleting a ranking set.
- Enforcing case-insensitive ranking-set name uniqueness.
- Reusing portable `sourceRankingSetId` as local identity.
- Preserving source rank gaps as canonical overall-rank magnitude.
- Recomputing or changing capability states.
- Changing tier values, compressing tier gaps, or inventing tier cliffs.
- Creating a draft snapshot or validating league capacity.
- Refactoring the canonical validator, import stages, engines, scenarios, persistence, or UI.
- Adding dependencies, ID factories, repositories, or generic conversion infrastructure.

## Implementation Design

### Public API and Workflow Requests

Add `src/lib/rankingSetConversion.ts` with:

```ts
type RankingSetCreateConversionRequest = Readonly<{
  workflow: "create";
  rankingSetId: string;
  timestamp: Date;
}>;

type RankingSetReplaceConversionRequest = Readonly<{
  workflow: "replace";
  rankingSetId: string;
  createdAt: Date;
  timestamp: Date;
}>;

type RankingSetConversionRequest =
  | RankingSetCreateConversionRequest
  | RankingSetReplaceConversionRequest;

convertValidatedRankingCandidate(
  validatedCandidate: ValidatedRankingCandidate,
  request: RankingSetConversionRequest,
): RankingImportStageResult<
  ConvertedRankingSet,
  RankingSetConversionDiagnosticCode
>
```

The application boundary will eventually allocate local IDs and timestamps. This converter only assigns the explicit values it receives. It must not import persistence, call `crypto.randomUUID`, call `Date.now`, or create a current timestamp implicitly.

For create:

- `rankingSetId` is the newly allocated local identity;
- `createdAt` and `updatedAt` both copy `timestamp`.

For replace:

- `rankingSetId` is the existing local identity to preserve;
- `createdAt` copies the existing aggregate's original creation time;
- `updatedAt` copies `timestamp`;
- `timestamp` must not be earlier than `createdAt`.

Do not add these workflow request types to `src/types/rankingImport.ts`; they belong to the conversion operation and are exported beside it.

### Conversion Diagnostics

Define `RankingSetConversionDiagnosticCode` as:

- `invalid-validated-candidate`
- `invalid-workflow`
- `invalid-ranking-set-id`
- `invalid-lifecycle-date`
- `invalid-lifecycle-order`
- `canonical-invariant-failed`

All diagnostics use stage `convert` and severity `error`. Conversion emits no warnings.

Validate request fields in this order:

1. validated wrapper;
2. workflow discriminator;
3. ranking-set ID;
4. create timestamp, or replacement creation time followed by update timestamp;
5. replacement lifecycle ordering.

`rankingSetId` must be a non-empty string but must not be trimmed or rewritten. Each supplied date must be a valid `Date`. Reject an unknown runtime workflow rather than treating it as create or replace.

If `validateRankingSet` reports failures after conversion, return one `canonical-invariant-failed` diagnostic per domain failure, preserving domain error order and message. Map the domain error path to `location.path`. Do not return the invalid aggregate.

### Validated Input Boundary

Require an object with `validated === true` and a candidate object. A malformed runtime wrapper returns `invalid-validated-candidate` before request or conversion work.

The converter does not rerun normalization or complete-candidate validation. `ValidatedRankingCandidate` is the typed public gate. It may defensively reject a malformed wrapper, but it must not accept a raw `NormalizedRankingCandidate` or silently manufacture the wrapper.

Do not expose an overload that accepts unvalidated candidates.

### Canonical Ordering and Rank Assignment

Create a new sorted array with:

```ts
[...validatedCandidate.candidate.entries].sort(
  (left, right) => left.sourceOrder - right.sourceOrder,
)
```

The source order is already positive and unique because Task 6 validated it. Do not add a file-order tie breaker or repair invalid order.

Walk the sorted entries once:

1. canonical `overallRank` is the sorted zero-based index plus one;
2. keep a per-position counter initialized on first occurrence;
3. canonical `positionRank` is the next one-based counter for that entry's position;
4. create a new embedded `player` object;
5. copy `adpRank` and `tier` unchanged.

Source order gaps disappear only from canonical ordinal rank. For example, validated source orders `2`, `10`, and `40` become overall ranks `1`, `2`, and `3`. Tier values such as `1`, `1`, and `4` remain `1`, `1`, and `4`.

The canonical output must not contain:

- `sourceIndex`;
- `location`;
- `fieldLocations`;
- `sourceOrder`;
- `sourcePositionRank`;
- parser metadata or format-specific values.

### Domain Aggregate Construction

Construct one new `RankingSet` with:

- local `id` from the validated workflow request;
- `name` from the candidate;
- a newly allocated source provenance object with optional fields copied exactly;
- a newly allocated capabilities object and tier-capability map;
- newly allocated canonical entries and player objects;
- cloned lifecycle `Date` values.

If source provenance includes `importedAt`, clone that `Date`. Do not share candidate or request `Date` objects with the returned aggregate.

Copy capabilities without recomputation:

- team availability;
- player identity provenance;
- overall-order provenance;
- derived position-rank state;
- ADP availability;
- per-position tier provenance.

Task 6 already established that capability states match materialized candidate values. The final `validateRankingSet` call rechecks their consistency with canonical entries.

### Create and Replacement Identity Rules

Create and replace differ only in lifecycle authority:

| Workflow | Output ID | `createdAt` | `updatedAt` |
| --- | --- | --- | --- |
| `create` | caller-issued new local ID | request `timestamp` | request `timestamp` |
| `replace` | caller-supplied existing local ID | request `createdAt` | request `timestamp` |

No portable metadata field may influence output ID. Canonical import normalization has already discarded portable `sourceRankingSetId`; conversion must not search for or reconstruct it.

The repository will later prove create uniqueness and replacement existence atomically. This slice validates only that workflow identity and dates are structurally valid and unambiguous.

### Purity and Ownership

Conversion must not mutate:

- the validated wrapper;
- the candidate;
- candidate entry order;
- candidate entries or players;
- source provenance;
- capability or tier maps;
- any candidate or request `Date`.

The returned aggregate must own new objects for source, capabilities, tier capabilities, entries, players, and dates. Tests should mutate cloned test-side references where practical to prove no shared nested object or date reference crosses the boundary, without weakening readonly production types.

Repeated conversion with deeply equal validated input and request values must produce deeply equal output. Object identity may differ between calls.

### Canonical Invariant Recheck

Call `validateRankingSet` exactly once after the complete aggregate is constructed.

On success, return:

```ts
{
  ok: true,
  value: {
    converted: true,
    rankingSet,
  },
  warnings: [],
}
```

The returned `rankingSet` should be the same aggregate reference accepted by `validateRankingSet`.

The invariant recheck is defense in depth for conversion logic and lifecycle context. It does not authorize repair of a forged or invalid candidate. A hand-built forged validated wrapper may be used only to prove that a final domain failure becomes `canonical-invariant-failed` and no aggregate escapes.

### Focused Tests

Add `src/lib/rankingSetConversion.test.ts` covering:

- exact create conversion from a validated complete FantasyPros candidate;
- exact create conversion from a validated Canonical JSON candidate;
- explicit source order gaps and out-of-array source order becoming contiguous overall ranks;
- interleaved positions receiving independently contiguous position ranks;
- supplied source-position ranks removed and recomputed rather than copied;
- player IDs, names, teams, positions, ADP, and tiers preserved exactly;
- source tier gaps preserved while source overall-rank gaps disappear;
- degraded candidates preserving `UNKNOWN_TEAM`, null ADP, `NEUTRAL_TIER`, and defaulted capabilities;
- source provenance and capability metadata copied exactly into new objects;
- create using its caller-issued ID with equal cloned creation/update dates;
- replace preserving its caller-supplied existing ID and original creation time while assigning a later update time;
- create and replace date objects not shared with request values;
- portable canonical source identity never becoming local output identity;
- invalid validated wrapper, unknown workflow, empty ID, invalid dates, and replacement timestamp earlier than creation;
- final aggregate accepted by `validateRankingSet`;
- forged validated input producing mapped `canonical-invariant-failed` diagnostics and no result value;
- validated candidate, entry order, nested values, capabilities, source, and dates unchanged;
- repeated conversion producing deeply equal outputs without shared aggregate objects;
- type-facing proof that successful output is `ConvertedRankingSet`, not `ValidatedRankingCandidate` or a persistence record.

Use the existing public parser, normalizer, and candidate validator for the two representative format-path tests. Use a small validated-candidate builder for precise rank, fallback, replacement, request-failure, and immutability coverage. No fixture files, database, network, browser, or manual QA are required.

## Implementation Steps

1. Add exported create/replace request types, diagnostic codes, runtime request checks, and result helpers in `rankingSetConversion.ts`.
2. Implement non-mutating source-order sorting plus contiguous overall- and position-rank assignment into new canonical entry/player values.
3. Construct new source, capability, tier-map, lifecycle, and aggregate values for create and replacement workflows.
4. Recheck the completed aggregate with `validateRankingSet` and map ordered domain failures into convert-stage diagnostics.
5. Add focused direct and full import-path tests for both formats, ranks, fallbacks, identity workflows, invariant mapping, determinism, and ownership.
6. Run focused tests, TypeScript, and focused lint.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 7 complete in `docs/tasks.md` and update this slice status.
9. Report results and stop. Do not begin Task 8 export.

## Expected Files

- `src/lib/rankingSetConversion.ts`
- `src/lib/rankingSetConversion.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import type, parser, preflight, normalizer, candidate validator, canonical validator, domain type, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSetConversion.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSetConversion.ts src/lib/rankingSetConversion.test.ts
npm test
npm run lint
```

Expected result:

- Focused conversion tests pass with exact canonical aggregates, ranks, workflow identity, dates, ownership, and diagnostics.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- Existing Tasks 1 through 6 behavior remains unchanged.
- No database, network, browser, environment-variable, build, migration, generated-client, or manual-QA requirement is introduced.

## Acceptance Criteria

- Only an explicit `ValidatedRankingCandidate` wrapper can enter the conversion API.
- Create and replacement requests have distinct, deterministic identity and lifecycle behavior.
- Validated source order becomes contiguous canonical overall order without mutating candidate order.
- Canonical position rank is derived independently per position from canonical overall order.
- Player values, ADP, tier values, tier gaps, fallbacks, provenance, and capabilities are preserved.
- Import-only locations, indexes, source ranks, and supplied position ranks do not cross into canonical entries.
- Portable ranking-set identity never becomes local ranking-set identity.
- Returned nested values and dates are owned by the aggregate rather than shared with inputs.
- The completed aggregate passes `validateRankingSet` before it is returned.
- Any final invariant failure produces ordered convert-stage diagnostics and no aggregate.
- Conversion is deterministic, repository-free, clock-free, and does not mutate its inputs.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 7 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If conversion needs to infer a missing identity, timestamp, or lifecycle fact, return a conversion diagnostic rather than generating or guessing it.
- If a validated candidate lacks a value needed for canonical construction, allow the canonical invariant recheck to fail and return mapped diagnostics; do not default or repair it.
- If source order is tied or malformed despite the wrapper, do not add a tie breaker. Treat the wrapper as forged and return no successful aggregate.
- If create uniqueness or replacement existence must be checked, leave it to the repository/application workflow and do not add persistence to this slice.
- If canonical validation disagrees with an output that should follow the documented conversion, stop and report the rule mismatch rather than weakening either validator.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 8: export canonical ranking sets deterministically as Canonical Ranking Set JSON V1, preserving every domain-relevant value and provenance needed for lossless re-import.

## Slice Review

- Smallest meaningful increment: yes. It adds only the validated-candidate-to-domain conversion boundary.
- Executable by a lower-reasoning pass: yes. Workflow inputs, rank assignment, ownership, diagnostics, invariant mapping, and tests are explicit.
- Avoids unnecessary architecture changes: yes. Caller-issued lifecycle context keeps conversion pure without adding repositories, clocks, factories, or framework abstractions.
- Blast radius reasonable: yes. Two source/test files plus Task 7 and slice-status documentation are expected.
- Review/revert comfort: yes. The converter is additive and isolated before persistence and application orchestration.
- Observable/testable acceptance criteria: yes. Exact aggregate values, ranks, identity, dates, removed fields, domain validation, and immutability are directly testable.
