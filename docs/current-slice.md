# Current Slice: Normalize Supported Ranking Sources

## Completion Status

Planned and awaiting approval. No implementation has started.

## Source Context

Phase 5 Tasks 1 through 4 are complete:

- the canonical ranking-set domain and capability invariants exist;
- import preflight and the two V1 format profiles are frozen;
- FantasyPros CSV parses into located source records;
- Canonical Ranking Set JSON V1 parses into located source records.

This slice promotes Phase 5 Task 5 only. Both parsers deliberately preserve untrusted values, while `NormalizedRankingCandidate` is the shared handoff to complete-candidate validation. The normalizer owns documented interpretation and safe fallback; it does not declare a complete candidate domain-valid.

## Goal

Convert either supported parsed V1 source document into the same deterministic, source-neutral ranking candidate, preserving source locations and provenance while making missing optional data explicit through canonical fallback values, capabilities, and warnings.

## Scope

### Goals

- Add one pure normalization entry point for both supported format references.
- Accept caller-supplied import context so CSV imports can receive a ranking-set name, source label, and deterministic import timestamp without reading files, environment state, or the clock.
- Normalize player names, teams, positions, numeric values, null markers, ordering, tiers, ADP, source provenance, and capability metadata according to the selected format.
- Preserve explicit Canonical JSON player IDs exactly; do not trim, case-fold, slug, or replace them.
- Generate deterministic FantasyPros source-local player ID candidates from normalized player name and position, excluding team.
- Carry a stable record location and semantic field locations into every normalized entry for Task 6 diagnostics.
- Use explicit overall order when the FantasyPros rank column is present; otherwise use one-based parsed record order.
- Preserve supplied order values and tier gaps without assigning canonical contiguous ranks.
- Derive FantasyPros source-position rank from the numeric suffix in values such as `WR12`; preserve Canonical JSON's supplied position-rank value only as non-authoritative diagnostic input.
- Derive FantasyPros ADP rank from normalized source order plus the signed `ECR VS ADP` delta; map the documented `-` marker and absent values to `null`.
- Materialize `UNKNOWN_TEAM`, nullable ADP, and `NEUTRAL_TIER` fallbacks for safely missing CSV data.
- Neutralize every entry at a represented position when that position has absent or partial CSV tier data.
- Compute CSV team, identity, order, position-rank, ADP, and per-position tier capabilities from normalized source availability.
- Parse and preserve Canonical JSON source provenance and declared capability states as typed candidate values, leaving Task 6 to verify them against entries.
- Emit deterministic normalization errors for missing, incorrectly typed, empty, or uninterpretable supplied values.
- Emit deterministic warnings for each safely degraded capability.
- Add focused tests for both formats, fallback behavior, source locations, generated identity, and determinism.
- Check Phase 5 Task 5 complete only after all validation passes.

### Non-Goals

- Parsing bytes, CSV syntax, JSON syntax, headers, or envelope structure again.
- Accepting a format other than `fantasypros-csv` version `1` or `canonical-ranking-json` version `1`.
- Proving complete-candidate validity or calling `validateRankingSet`.
- Rejecting duplicate/generated player IDs, tied explicit ranks, decreasing tiers, or capability/value inconsistencies; Task 6 owns set-wide validation.
- Assigning canonical contiguous overall or position ranks; Task 7 owns domain conversion.
- Assigning or reusing local ranking-set identity.
- Guessing players across ranking sets or including team in generated identity.
- Treating malformed supplied values as missing optional values.
- Persistence, repositories, import orchestration, export, snapshots, server actions, or UI.
- Adding dependencies, a generic adapter registry, schema library, or configurable column mapper.

## Implementation Design

### Public API and Candidate Locations

Add `src/lib/rankingNormalizer.ts` with:

```ts
normalizeRankingSource(
  document: ParsedRankingSourceDocument,
  context: RankingNormalizationContext,
): RankingImportStageResult<
  NormalizedRankingCandidate,
  RankingNormalizerDiagnosticCode
>
```

Add `RankingNormalizationContext` in `src/types/rankingImport.ts`:

```ts
type RankingNormalizationContext = Readonly<{
  name?: string;
  sourceLabel?: string;
  importedAt: Date;
}>;
```

The caller supplies `importedAt`; the normalizer must never call `Date.now()` or `new Date()` without an input value. Copy valid dates before returning them so callers cannot mutate candidate provenance.

Replace the currently unused single `location` member on `NormalizedRankingCandidateEntry` with:

```ts
type NormalizedRankingCandidateField =
  | "playerId"
  | "playerName"
  | "team"
  | "position"
  | "sourceOrder"
  | "sourcePositionRank"
  | "tier"
  | "adpRank";

type NormalizedRankingCandidateEntry = Readonly<{
  sourceIndex: number;
  location: RankingImportDiagnosticLocation;
  fieldLocations: Readonly<
    Partial<
      Record<
        NormalizedRankingCandidateField,
        RankingImportDiagnosticLocation
      >
    >
  >;
  // Existing normalized value fields remain unchanged.
}>;
```

For CSV, the record location is the first available parsed field location on that record, normally its physical row. For Canonical JSON it is `entries[index]`. A directly normalized field keeps its parsed field location. A derived or fallback field uses the closest relevant source location: generated identity uses the player-name location, row-derived order and neutral tier use the record location, and derived ADP uses the ADP-delta location.

Do not introduce parser-specific fields into the candidate.

### Normalization Diagnostics

Define `RankingNormalizerDiagnosticCode` as:

- `unsupported-format`
- `invalid-import-context`
- `missing-name`
- `invalid-metadata`
- `invalid-capabilities`
- `missing-required-value`
- `invalid-text`
- `invalid-position`
- `invalid-team`
- `invalid-number`
- `invalid-null-marker`
- `team-defaulted`
- `adp-defaulted`
- `tiers-defaulted-neutral`

All diagnostics use stage `normalize`. The first ten codes are errors; the final three are warnings.

Accumulate independent record errors when safe. Order diagnostics as follows:

1. unsupported format or invalid context;
2. name, metadata, source, and capability errors in document order;
3. record errors by `sourceIndex`, then semantic field order: player ID, name, team, position, order, source-position rank, tier, ADP;
4. fallback warnings after successful value normalization: team, ADP, then tier positions in `QB`, `RB`, `WR`, `TE`, `DST`, `K` order.

If any error exists, return no partial candidate but retain all deterministic warnings discovered from otherwise interpretable data.

### Shared Text and Number Rules

- Player name: require a string and trim outer whitespace only. Preserve internal whitespace, punctuation, case, and Unicode. An empty trimmed result is an error.
- Team: require a string when supplied, trim it, and uppercase it. An empty CSV value is absence; an empty Canonical JSON value is malformed because canonical exports materialize `UNKNOWN_TEAM`. Do not invent an NFL-team enum in this slice; the existing domain accepts normalized non-empty labels.
- Position: require a string, trim it, and uppercase it. Accept only `QB`, `RB`, `WR`, `TE`, `DST`, or `K` after format-specific suffix handling. Do not guess aliases such as `D/ST`, `DEF`, or `PK`.
- CSV integer fields: trim and require base-10 integer syntax with no decimals or exponent notation. Tier, explicit order, and position suffix must be positive integers. ADP delta must match the frozen signed-delta profile or `-`.
- Canonical numeric fields: accept JSON numbers only. Overall order, source-position rank, and tier must be positive integers; do not coerce numeric strings. ADP must be `null` or a positive finite number.
- Preserve parsed records and fields without mutation.

### Import Name and Source Provenance

- Trim `context.name` when present. A non-string or empty explicit name is an `invalid-import-context` error.
- For CSV, require the explicit context name. Missing name is `missing-name` because CSV has no portable metadata.
- For Canonical JSON, use a valid explicit context name when supplied; otherwise read and trim `metadata.name`. Explicit import intent deliberately overrides the portable display name so a re-import may be named independently.
- Require `context.importedAt` to be a valid `Date` for CSV and for Canonical JSON without preserved source provenance.
- CSV source is `{ kind: "external", formatId: "fantasypros-csv", formatVersion: 1, importedAt }` plus a trimmed non-empty `sourceLabel` when supplied.
- Canonical JSON must require a valid ISO `metadata.exportedAt` string even though it is not retained in the candidate.
- When Canonical JSON contains `metadata.source`, normalize only the documented `kind`, optional `formatId`, positive integer `formatVersion`, optional `label`, and optional ISO `importedAt`. Reject malformed supplied source values. Preserve this source provenance rather than relabeling it as a new external source.
- When Canonical JSON omits `metadata.source`, create `{ kind: "canonical", formatId: "canonical-ranking-json", formatVersion: 1, importedAt: context.importedAt }`.
- Ignore `sourceRankingSetId` as non-authoritative portable provenance; it must never become local candidate identity.

### FantasyPros CSV Adapter

Normalize every parsed CSV record as follows:

- `playerName`: required trimmed text.
- `position`: match the frozen profile after trim and uppercase. Split the canonical position prefix from its positive numeric suffix. The suffix, when present, becomes `sourcePositionRank`; absence remains `null` for later validation/diagnostics.
- `playerId`: generate
  `fantasypros-v1:<lowercase-position>:<encodeURIComponent(lowercase-normalized-name)>`.
  Lowercase with locale-independent `toLowerCase()`. Use the trimmed player name and canonical position, exclude team and rank, and do not append an occurrence counter. Identical stable inputs intentionally produce colliding candidates for Task 6 to reject.
- `team`: normalize a supplied non-empty value; otherwise materialize `UNKNOWN_TEAM`.
- `sourceOrder`: if the parsed document has an `overallOrder` field on any record, require a valid explicit order on every record. If it is absent from every record, use `sourceIndex + 1`. Do not mix explicit and row-derived order.
- `tier`: parse positive supplied integers. After all records are interpreted, group by valid position. If a position has no supplied tier or any empty/missing tier, set every entry at that position to `NEUTRAL_TIER` and record `defaulted-neutral`. A non-empty malformed tier remains an error and is not neutralized.
- `adpRank`: an absent/empty delta or `-` becomes `null`. Otherwise parse the frozen signed integer and calculate `sourceOrder + delta`. Preserve the resulting number even if it is non-positive so Task 6 can report the complete-candidate invariant; syntax errors remain normalization errors.

Compute capabilities:

- `team`: `complete`, `partial`, or `none` from the count of non-empty supplied team values;
- `playerIdentity`: `generated`;
- `overallOrder`: `explicit` only when every record uses the column, otherwise `row-derived`;
- `positionRank`: `derived` even though a parsed position suffix is retained diagnostically;
- `adp`: `complete`, `partial`, or `none` from non-null derived ADP values;
- `tiers[position]`: `source` for complete supplied tier data at that represented position, otherwise `defaulted-neutral`.

Emit one `team-defaulted` warning when at least one team is defaulted, one `adp-defaulted` warning when at least one ADP is null, and one `tiers-defaulted-neutral` warning per defaulted represented position. Warning messages must include affected counts; tier warnings include the position.

### Canonical Ranking JSON V1 Adapter

Treat Canonical JSON as lossless typed transport, not as a permissive external source:

- Require the parser metadata wrapper to contain object-shaped `documentMetadata` and `capabilities` values. A malformed wrapper is `invalid-metadata` or `invalid-capabilities`.
- Require each documented canonical entry field. Missing canonical player ID, name, team, position, order, position rank, tier, or ADP is `missing-required-value`; do not apply CSV absence fallbacks.
- Preserve a string player ID exactly. Its non-empty and uniqueness invariants remain Task 6 concerns.
- Apply the shared canonical text and numeric rules to every other field.
- Preserve supplied overall order, source-position rank, tier, and ADP values without assigning contiguous ranks.
- Parse declared capabilities into the existing `RankingSetCapabilities` union values. Reject unknown capability keys or states at normalization. Preserve per-position tier declarations only for the six supported positions.
- Do not recompute canonical capabilities from entry values and do not silently repair disagreements. Task 6 must diagnose declared capability/value inconsistency.
- Do not emit fallback warnings merely because a canonical entry contains `UNKNOWN_TEAM`, `null` ADP, neutral tiers, or a defaulted capability; the portable document already carries that provenance.

### Separation from Task 6

This slice may reject an individual supplied value that cannot be interpreted, but it must return a candidate for individually interpretable records even when the complete set later fails because of:

- zero entries;
- duplicate explicit or generated identities;
- tied or contradictory explicit overall order;
- order gaps;
- source-position-rank disagreement;
- decreasing position-local tiers;
- non-positive derived ADP;
- capability states inconsistent with materialized entries.

Do not call canonical domain validation to collapse those distinctions.

### Focused Tests

Add `src/lib/rankingNormalizer.test.ts` covering:

- representative and minimum FantasyPros candidates;
- representative and minimum Canonical JSON candidates;
- semantically equivalent cross-format entries reaching the same normalized value shape when the canonical fixture uses the generated CSV identity and equivalent capabilities;
- exact import-name precedence and source provenance for both formats;
- invalid context dates, empty names, malformed canonical metadata, malformed source provenance, and malformed capabilities;
- player-name outer trimming without internal text rewriting;
- position casing, suffix extraction, and unsupported aliases;
- team uppercase normalization, full/partial/none availability, and unknown-team fallback;
- explicit CSV order, row-derived order, mixed explicit/missing errors, and preserved gaps/ties;
- canonical numeric strictness versus CSV numeric-string parsing;
- FantasyPros ADP positive/negative/zero deltas, `-`, blank, absent column, and derived non-positive values left to Task 6;
- complete, absent, and partial CSV tiers across multiple positions, including whole-position neutralization and preserved source gaps;
- exact canonical capability preservation without recomputation;
- exact generated player ID strings, team-independent identity, repeated-call determinism, and intentional collision candidates;
- exact record and semantic field locations for CSV and JSON;
- deterministic diagnostic and warning codes, messages, locations, counts, and ordering;
- proof that inputs are not mutated and output remains `NormalizedRankingCandidate`, not `RankingSet` or `RankingEntry[]`;
- unsupported format failure.

Use parsed fixtures from the existing public parsers in integration-shaped tests. Small hand-built `ParsedRankingSourceDocument` values may be used only for otherwise unreachable runtime-boundary failures such as an unsupported format or malformed parser metadata wrapper.

## Implementation Steps

1. Extend `src/types/rankingImport.ts` with normalization context and per-field candidate location types; do not change domain ranking types.
2. Add shared format dispatch, context validation, object guards, locations, diagnostics, and primitive text/number helpers in `rankingNormalizer.ts`.
3. Implement Canonical JSON metadata, source provenance, capability, and entry normalization without recomputation or fallback repair.
4. Implement FantasyPros field normalization, deterministic player IDs, explicit/row-derived ordering, ADP-delta conversion, and capability counts.
5. Apply whole-position tier neutralization and deterministic safe-degradation warnings after record interpretation.
6. Add focused tests for both adapters, cross-format equivalence, locations, fallbacks, errors, warnings, and determinism.
7. Run focused tests, TypeScript, and focused lint.
8. Run the full test suite and repository-wide lint.
9. After all acceptance criteria pass, mark only Phase 5 Task 5 complete in `docs/tasks.md` and update this slice status.
10. Report results and stop. Do not begin Task 6 validation.

## Expected Files

- `src/types/rankingImport.ts`
- `src/lib/rankingNormalizer.ts`
- `src/lib/rankingNormalizer.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No parser, preflight profile, ranking-domain, domain-validator, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingNormalizer.test.ts
npx tsc --noEmit
npm run lint -- src/types/rankingImport.ts src/lib/rankingNormalizer.ts src/lib/rankingNormalizer.test.ts
npm test
npm run lint
```

Expected result:

- Focused normalization tests pass with exact candidates, capabilities, locations, diagnostics, warnings, and deterministic identities.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- Existing Tasks 1 through 4 behavior remains unchanged.
- No database, network, browser, environment-variable, build, migration, generated-client, or manual-QA requirement is introduced.

## Acceptance Criteria

- Both supported parsed V1 formats normalize into `NormalizedRankingCandidate` and no other format is accepted.
- Normalization is pure and deterministic for identical document and context inputs.
- CSV and Canonical JSON use the same source-neutral entry shape without leaking parser metadata.
- Explicit canonical player IDs survive unchanged; CSV player ID candidates are stable, team-independent, and collision-visible.
- Player text, team values, position values, numeric representations, null markers, and source provenance follow the explicit rules above.
- Explicit source order and row-derived order remain distinguishable, unambiguous at the individual-record boundary, and non-canonical.
- CSV ADP delta conversion is deterministic and absence materializes as `null`.
- Missing CSV team data materializes as `UNKNOWN_TEAM` with accurate complete/partial/none capability state.
- Missing or partial CSV tier data neutralizes the entire represented position with `NEUTRAL_TIER`, a `defaulted-neutral` capability, and one position warning.
- Canonical declared capabilities and source provenance are typed and preserved without being trusted as set-wide valid.
- Malformed supplied values produce normalization errors rather than fallbacks.
- Record and semantic field locations survive for Task 6 diagnostics.
- Set-wide invariants remain deferred to Task 6, and canonical ranks remain deferred to Task 7.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 5 is checked complete after validation.
- No dependency, parser, domain, persistence, generated-code, or unrelated documentation change is introduced.

## Failure Handling

- If either parser cannot distinguish an absent column/property from a supplied empty value needed by the fallback matrix, stop and report the contract gap rather than guessing.
- If the existing candidate type cannot retain a source location required by Task 6, extend only the location metadata described here; do not add parser records to the candidate.
- If Canonical JSON provenance or capability metadata cannot be typed without silently changing its meaning, return a normalization diagnostic rather than recomputing it.
- If CSV ADP-delta direction conflicts with the existing seed-data interpretation (`adpRank = sourceOrder + delta`), stop and report the discrepancy before changing the formula.
- If a failure depends on comparing multiple otherwise interpretable records, leave it for Task 6 unless it is required to materialize a position-wide tier fallback.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 6: validate complete normalized ranking candidates, including required metadata, unique identities, unambiguous source order, valid position-local tier progression, ADP validity, and capability consistency without creating domain objects.

## Slice Review

- Smallest meaningful increment: yes. It completes only the shared normalization boundary required before validation.
- Executable by a lower-reasoning pass: yes. Public types, format rules, fallback behavior, diagnostics, ordering, and test cases are explicit.
- Avoids unnecessary architecture changes: yes. It adds one pure dispatcher with two explicit adapters and no plugin, schema, repository, or UI abstraction.
- Blast radius reasonable: yes. Three source/test files plus Task 5 and slice-status documentation are expected.
- Review/revert comfort: yes. The change is isolated between existing parser outputs and the not-yet-implemented validator.
- Observable/testable acceptance criteria: yes. Values, capabilities, warnings, errors, locations, and identity strings are exact and deterministic.
