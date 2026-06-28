# Current Slice: Validate Complete Normalized Ranking Candidates

## Completion Status

Complete. Normalized ranking candidates now pass through a pure, source-located complete-candidate validation gate before domain conversion. Validation covers metadata, bounded collections, field values, identity and order collisions, supplied position ranks, position-local tier progression, capability consistency, neutral fallbacks, stable diagnostic ordering, and purity. Validation passed with 28 focused candidate-validation tests, 434 full-suite tests, TypeScript checking, and focused and repository-wide linting.

## Source Context

Phase 5 Tasks 1 through 5 are complete:

- canonical ranking-set values and reusable domain invariants exist;
- import preflight and both V1 format profiles are frozen;
- FantasyPros CSV and Canonical Ranking Set JSON V1 parse into located source records;
- both parser outputs normalize into one `NormalizedRankingCandidate` shape;
- normalized entries retain record and semantic field locations;
- CSV absence fallbacks are materialized, while Canonical JSON capability declarations remain preserved but untrusted.

This slice promotes Phase 5 Task 6 only. It validates a complete normalized candidate and returns the existing `ValidatedRankingCandidate` wrapper required by Task 7. It must not create a `RankingSet`, assign local identity, assign canonical ranks, or call canonical ranking-set validation with a fabricated aggregate.

## Goal

Validate complete source-neutral ranking candidates with deterministic, source-located diagnostics, allowing both complete and safely degraded data to proceed while preventing ambiguous order, collisions, malformed values, invalid tier progression, and inconsistent capabilities from reaching domain conversion.

## Scope

### Goals

- Add one pure complete-candidate validator.
- Return the existing explicit `ValidatedRankingCandidate` wrapper only on success.
- Validate candidate name, source provenance, collection shape, and the frozen 1,000-entry bound.
- Validate every entry's source index, player identity, name, team, position, source order, optional source-position rank, ADP, and tier.
- Reject duplicate explicit or generated player identity candidates at the later duplicate's source location.
- Reject duplicate source-order values without requiring source order to be contiguous.
- Preserve valid explicit source-order gaps for Task 7 to canonicalize.
- Require row-derived source order to equal `sourceIndex + 1` when the capability declares `row-derived`.
- Derive expected position rank from unique source order and compare it only when a source-position rank was supplied.
- Validate positive, position-local, non-decreasing tiers in unique source order while preserving gaps.
- Validate team and ADP availability capabilities against materialized candidate values.
- Validate identity, order, and position-rank capability states without attempting to infer identity provenance from ID text.
- Require tier capabilities for exactly the represented valid positions.
- Require every `defaulted-neutral` position to contain only `NEUTRAL_TIER` and no fabricated gap.
- Preserve valid source tier gaps for positions declared `source`.
- Accumulate independent candidate, entry, cross-record, and capability failures when safe.
- Use normalized semantic field locations for row-level and cross-record diagnostics.
- Add focused coverage for valid complete, safely degraded, malformed, ambiguous, and small candidates.
- Check Phase 5 Task 6 complete only after all validation passes.

### Non-Goals

- Parsing or normalizing any source document.
- Reinterpreting missing data or applying a new fallback.
- Sorting or mutating candidate entries.
- Assigning canonical contiguous overall or position ranks.
- Assigning local ranking-set identity, creation time, or update time.
- Creating `RankingEntry`, `RankingSet`, snapshot, scenario, or persistence values.
- Calling repositories, engines, server actions, or UI code.
- Checking ranking-set name uniqueness in persistence.
- Validating whether a candidate contains enough players for a particular league or draft.
- Inferring `provided`, `generated`, or `mixed` identity capability from player ID prefixes.
- Rejecting a valid candidate merely because it is small.
- Refactoring the existing canonical ranking-set validator or weakening its tests.
- Adding dependencies or a generic validation framework.

## Implementation Design

### Public API

Add `src/lib/rankingCandidateValidation.ts` with:

```ts
validateNormalizedRankingCandidate(
  candidate: NormalizedRankingCandidate,
): RankingImportStageResult<
  ValidatedRankingCandidate,
  RankingCandidateValidationDiagnosticCode
>
```

On success return:

```ts
{
  ok: true,
  value: {
    validated: true,
    candidate,
  },
  warnings: [],
}
```

Preserve the exact candidate reference and do not mutate the candidate, its source `Date`, entries, locations, capabilities, or tier map.

On failure return all safely independent validation errors, no candidate value, and an empty warnings array. Validation does not create warnings because safe degradation was already handled and warned during normalization.

Do not change `src/types/rankingImport.ts`; `ValidatedRankingCandidate` and the `validate` import stage already exist.

### Diagnostic Codes

Define `RankingCandidateValidationDiagnosticCode` as:

- `invalid-name`
- `invalid-source`
- `empty-entries`
- `too-many-entries`
- `invalid-entry`
- `invalid-source-index`
- `invalid-player-id`
- `duplicate-player-id`
- `invalid-player-name`
- `invalid-team`
- `invalid-position`
- `invalid-source-order`
- `duplicate-source-order`
- `invalid-source-position-rank`
- `invalid-adp-rank`
- `invalid-tier`
- `invalid-tier-progression`
- `invalid-capability`

Every diagnostic uses stage `validate` and severity `error`.

Use the candidate's retained locations:

- an entry field failure uses `entry.fieldLocations[field]`;
- when a field location is unexpectedly absent at runtime, fall back to `entry.location`;
- duplicate identity reports the later duplicate's `playerId` location;
- duplicate source order reports the later duplicate's `sourceOrder` location;
- source-position-rank disagreement reports `sourcePositionRank`;
- tier decrease or invalid neutral fallback reports `tier` on the first affected entry;
- row-derived order disagreement reports `sourceOrder` on the first mismatch;
- team and ADP availability disagreement reports the first relevant `team` or `adpRank` field;
- candidate-level metadata and unsupported capability values may omit location because normalization does not retain metadata/capability source paths.

Do not invent a CSV row or JSON path that is absent from the normalized candidate.

### Candidate Metadata and Collection

Validate in this order:

1. `name` is a non-empty string after trimming; do not rewrite it.
2. `source` is an object whose:
   - `kind` is `seed`, `external`, `canonical`, or `manual`;
   - optional `formatId` and `label` are non-empty strings;
   - optional `formatVersion` is a positive integer;
   - optional `importedAt` is a valid `Date`.
3. `entries` is an array with at least one entry and no more than `RANKING_IMPORT_LIMITS.maxEntries` entries.

An empty candidate produces `empty-entries` but remains distinct from a normalization failure. More than 1,000 entries produces `too-many-entries`. If `entries` is not an array at runtime, return `invalid-entry` at the candidate level and do not attempt record validation.

The validator accepts a valid one-entry candidate. League capacity belongs to draft creation, not ranking-set validity.

### Entry Validation

Visit entries in array order. A sparse, null, array, or primitive entry produces `invalid-entry` at the array index and does not stop validation of other object-shaped entries.

For each object-shaped entry, validate fields in this exact order:

1. `sourceIndex` is an integer equal to the entry's zero-based array index. This protects stable source locations and rejects gaps or duplicate indexes without introducing a separate ordering input.
2. `playerId` is a non-empty string; record the first valid occurrence and report later duplicates.
3. `playerName` is a non-empty string.
4. `team` is a non-empty string. `UNKNOWN_TEAM` is valid materialized absence.
5. `position` is one of `QB`, `RB`, `WR`, `TE`, `DST`, or `K`.
6. `sourceOrder` is a positive integer; record the first valid occurrence and report later duplicates. Do not require contiguity and do not reorder the array.
7. `sourcePositionRank` is either `null` or a positive integer.
8. `adpRank` is `null` or a positive finite number.
9. `tier` is a positive integer.

Candidate validation must tolerate runtime-invalid values despite the TypeScript contract. It must not coerce, trim, default, or repair them.

### Unique Order and Derived Checks

Source order is unambiguous only when every object-shaped entry has a valid unique positive `sourceOrder` and every position needed by the check is valid.

When order is unambiguous:

1. Create a separate sorted view by ascending `sourceOrder`; never sort the candidate array in place.
2. Count each supported position through that view.
3. When `sourcePositionRank` is non-null, require it to equal that position's derived one-based count.
4. Track the prior valid tier for each position and require later tiers not to decrease.
5. Preserve equal tiers and increasing gaps of any size.

When any source order is invalid or duplicated, emit the direct order diagnostic and skip derived position-rank comparison and tier-progression checks for the candidate. This avoids misleading secondary errors from an order that is not well-defined. Continue individual position-rank and tier shape validation.

If an entry has an invalid position, skip its position-derived checks while validating other entries whose position and order remain usable.

### Capability Validation

Validate capability keys in this fixed order:

1. `team`
2. `playerIdentity`
3. `overallOrder`
4. `positionRank`
5. `adp`
6. `tiers` in supported position order, followed by unknown keys in lexical order

Accepted states remain the existing domain unions:

- team and ADP: `complete`, `partial`, or `none`;
- player identity: `provided`, `generated`, or `mixed`;
- overall order: `explicit` or `row-derived`;
- position rank: `derived` only;
- each tier position: `source` or `defaulted-neutral`.

For valid entry fields:

- derive team availability from `team !== UNKNOWN_TEAM` and require the declared state to match;
- derive ADP availability from `adpRank !== null` and require the declared state to match;
- if overall order is `row-derived`, require every valid source order to equal `sourceIndex + 1`;
- do not infer identity capability from ID spelling; only validate that its state is supported;
- require a tier capability for each represented valid position;
- reject a tier capability for a position not represented in the candidate;
- reject unknown tier-position keys;
- for `defaulted-neutral`, require every valid tier at that position to equal `NEUTRAL_TIER`;
- for `source`, accept any already-valid non-decreasing position-local tier sequence, including a single tier or meaningful gaps.

If the entry values needed to derive one capability are themselves invalid, report their direct entry diagnostics and skip only that derived capability comparison. Still validate the capability value and unrelated capabilities.

### Diagnostic Ordering

Return errors deterministically:

1. candidate name and source errors;
2. collection-shape and bound errors;
3. entry errors by array index and the field order defined above, with duplicate errors emitted at the later occurrence;
4. derived source-position-rank errors in ascending source order;
5. tier-progression errors in ascending source order;
6. capability errors in the fixed order above.

Multiple errors for independent records and capabilities should be returned together. Do not emit a derived error when its prerequisite is invalid, and do not emit both a generic and specific error for the same malformed value.

### Relationship to Canonical Domain Validation

Candidate validation and `validateRankingSet` share business rules but operate at different lifecycle boundaries:

- candidate validation accepts source-order gaps and nullable source-position rank because Task 7 has not assigned canonical ranks;
- canonical ranking-set validation requires contiguous overall and derived position ranks on final `RankingEntry` values;
- both require non-empty identity/name/team, supported positions, valid ADP, positive non-decreasing position tiers, accurate availability capabilities, and neutral default tiers.

Implement the candidate checks locally and explicitly. Do not fabricate a `RankingSet`, assign fake identity or dates, or refactor the canonical validator in this slice. Focused tests must demonstrate that the shared rules agree on complete and degraded examples where their lifecycle shapes overlap.

### Focused Tests

Add `src/lib/rankingCandidateValidation.test.ts` covering:

- a complete valid candidate accepted with the same candidate reference;
- a normalized FantasyPros complete candidate accepted;
- a normalized safely degraded candidate with `UNKNOWN_TEAM`, null ADP, and neutral per-position tiers accepted;
- a valid one-entry candidate accepted without league-capacity checks;
- candidate and nested inputs unchanged after success and failure;
- empty and 1,001-entry candidates;
- malformed runtime entries and stable continuation to later entries;
- invalid and noncontiguous source indexes;
- missing/empty player IDs, names, and teams;
- every unsupported position;
- duplicate explicit IDs and generated identity collisions at the later source location;
- invalid, tied, gapped, and array-out-of-order source order;
- `row-derived` order consistency versus valid explicit gaps;
- null, valid, invalid, and inconsistent supplied source-position rank;
- null and positive ADP accepted; zero, negative, `NaN`, infinity, and string ADP rejected;
- positive tiers, equal tiers, and preserved gaps accepted;
- zero, negative, fractional, and position-local decreasing tiers rejected;
- derived rank and tier progression skipped when source order is ambiguous;
- valid complete, partial, and none team/ADP capabilities;
- mismatched availability capabilities located at relevant entry fields;
- supported and unsupported identity/order/position-rank capability states;
- exact represented-position tier capabilities, missing keys, extra known positions, and unknown positions;
- neutral tiers accepted only when every entry at that position equals `NEUTRAL_TIER`;
- `source` tiers allowed to contain one tier or meaningful gaps;
- multiple independent failures returned in exact stable order;
- a normalization failure remains stage `normalize` and never masquerades as candidate validation;
- type-facing proof that successful output is `ValidatedRankingCandidate`, not `RankingSet` or `RankingEntry[]`.

Use small candidate builders for direct invariant coverage and the existing public parser/normalizer path for representative complete and degraded integration-shaped fixtures. Do not read fixture files, access the database, or add UI/manual QA.

## Implementation Steps

1. Add the public validator, diagnostic union, success/failure helpers, and private runtime object/location guards in `rankingCandidateValidation.ts`.
2. Implement candidate metadata, source provenance, collection bound, and per-entry field validation in the specified order.
3. Add duplicate identity/order tracking and non-mutating source-order derivation for supplied position-rank and tier progression checks.
4. Add capability-state, availability, row-derived order, exact tier-position, and neutral-fallback consistency checks.
5. Add focused direct and parser/normalizer integration tests for complete, degraded, invalid, ambiguous, and small candidates.
6. Run focused tests, TypeScript, and focused lint.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 6 complete in `docs/tasks.md` and update this slice status.
9. Report results and stop. Do not begin Task 7 conversion.

## Expected Files

- `src/lib/rankingCandidateValidation.ts`
- `src/lib/rankingCandidateValidation.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import type, parser, preflight, normalizer, canonical ranking validator, domain, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingCandidateValidation.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingCandidateValidation.ts src/lib/rankingCandidateValidation.test.ts
npm test
npm run lint
```

Expected result:

- Focused candidate-validation tests pass with exact result wrappers, diagnostics, locations, and ordering.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- Existing Tasks 1 through 5 behavior remains unchanged.
- No database, network, browser, environment-variable, build, migration, generated-client, or manual-QA requirement is introduced.

## Acceptance Criteria

- A complete valid normalized candidate returns `ValidatedRankingCandidate` with the exact candidate reference.
- An invalid candidate returns deterministic validate-stage errors and no validated value.
- Multiple independent semantic problems are accumulated safely with source locations.
- Duplicate or colliding player IDs and duplicate source order report the later relevant entry.
- Explicit source-order gaps remain valid, while ties and invalid order fail.
- Supplied source-position rank and tier progression are checked only against unambiguous source order.
- Complete, partial, and absent optional data validate when capability states match materialized values.
- Malformed optional values fail rather than being treated as absence.
- `defaulted-neutral` positions contain exactly one neutral tier value across all their entries.
- Source tier gaps remain meaningful and valid when non-decreasing.
- Capability states and represented tier positions are consistent with candidate entries.
- A valid one-entry candidate passes without league-specific compatibility checks.
- Validation is pure, deterministic, and independent of repositories, engines, React, files, and transport parsing.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 6 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If candidate validation would need parser-specific data that normalization did not retain, stop and report the missing boundary data rather than importing parser types.
- If a capability mismatch cannot be diagnosed accurately because its prerequisite entry values are invalid, emit the direct entry errors and skip that derived comparison.
- If source order is ambiguous, report the direct order failures and skip derived position-rank and tier-progression checks rather than guessing file order.
- If candidate and canonical domain rules conflict for a shared canonical value, stop and report the discrepancy instead of choosing one silently.
- If implementation appears to require assigning temporary canonical ranks or constructing a fake `RankingSet`, stop and keep that work in Task 7.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 7: convert a validated candidate into a canonical `RankingSet`, assigning local lifecycle values plus contiguous overall and derived position ranks while removing source-only locations.

## Slice Review

- Smallest meaningful increment: yes. It adds only the complete-candidate validation gate between normalization and conversion.
- Executable by a lower-reasoning pass: yes. Public API, rules, prerequisites, diagnostics, locations, ordering, and tests are explicit.
- Avoids unnecessary architecture changes: yes. It uses the existing candidate and validated wrapper without refactoring the domain validator or adding a framework.
- Blast radius reasonable: yes. Two source/test files plus Task 6 and slice-status documentation are expected.
- Review/revert comfort: yes. The validator is additive, pure, and isolated from parsing, conversion, persistence, engines, and UI.
- Observable/testable acceptance criteria: yes. Result shape, error codes, source locations, ordering, and purity are directly testable.
