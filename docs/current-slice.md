# Current Slice: Export Canonical Ranking Set JSON V1

## Completion Status

Planned and awaiting approval. No implementation has started.

## Source Context

Phase 5 Tasks 1 through 7 are complete:

- canonical `RankingSet` aggregates and domain invariants are defined;
- Canonical Ranking Set JSON V1 transport types, profile, and parser exist;
- both supported import formats normalize into one candidate contract;
- complete candidates validate before conversion;
- validated candidates convert into canonical aggregates with local lifecycle identity and deterministic ranks;
- canonical imports preserve source provenance and declared capabilities while ignoring portable local identity;
- import preflight enforces valid UTF-8, a fixed 1 MiB input limit, and a 1,000-entry format limit.

This slice promotes Phase 5 Task 8 only. It adds the inverse portable boundary for canonical domain values: validate, map, and serialize one `RankingSet` as deterministic Canonical Ranking Set JSON V1 that can traverse the existing public import stages without losing domain-relevant values.

## Goal

Serialize a valid canonical `RankingSet` into deterministic, bounded, versioned Canonical Ranking Set JSON V1, preserving every engine-relevant entry value and provenance capability while excluding local lifecycle, draft, recommendation, parser, persistence, and UI state.

## Scope

### Goals

- Add one pure Canonical Ranking Set JSON V1 exporter.
- Require an explicit export timestamp so serialization remains deterministic and clock-free.
- Optionally include the local ranking-set ID as non-authoritative `sourceRankingSetId` provenance.
- Validate the domain aggregate with `validateRankingSet` before export.
- Enforce the existing portable entry-count and UTF-8 byte limits before returning success.
- Map the exact V1 envelope in a frozen property order.
- Preserve ranking-set name, source provenance, capabilities, canonical entry order, player identity, player values, ADP, position ranks, and tier gaps.
- Preserve `UNKNOWN_TEAM`, null ADP, `NEUTRAL_TIER`, and `defaulted-neutral` provenance exactly.
- Serialize source and export dates as ISO strings.
- Produce compact JSON with identical bytes for deeply equal ranking sets and equal export requests.
- Return the typed portable document, serialized text, and UTF-8 byte length.
- Build new transport objects without mutating or sharing nested domain objects.
- Prove complete and safely degraded export/import round trips through public preflight, parser, normalizer, candidate validator, and converter stages.
- Prove optional local identity is never reused automatically after import.
- Check Phase 5 Task 8 complete only after all validation passes.

### Non-Goals

- Exporting FantasyPros CSV or Scenario V1.
- Adding automatic format selection or a serializer registry.
- Reading files, choosing file names, triggering downloads, or adding UI.
- Querying repositories or persistence.
- Generating export timestamps inside the exporter.
- Persisting raw export documents.
- Importing the export implicitly or replacing an existing ranking set.
- Reusing portable `sourceRankingSetId` as local identity.
- Exporting local `createdAt` or `updatedAt` lifecycle timestamps.
- Exporting recommendations, drafts, league settings, scenarios, raw source records, diagnostics, source locations, or UI state.
- Recomputing canonical ranks, capabilities, fallbacks, tiers, or provenance.
- Repairing an invalid ranking set to make it exportable.
- Adding dependencies, migrations, generated code, or transport abstractions.

## Implementation Design

### Public API

Add `src/lib/canonicalRankingJsonExporter.ts` with:

```ts
type CanonicalRankingJsonExportRequest = Readonly<{
  exportedAt: Date;
  includeSourceRankingSetId?: boolean;
}>;

type CanonicalRankingJsonExportValue = Readonly<{
  document: CanonicalRankingSetDocumentV1;
  text: string;
  byteLength: number;
}>;

type CanonicalRankingJsonExportErrorCode =
  | "invalid-export-date"
  | "invalid-export-option"
  | "invalid-ranking-set"
  | "entry-limit-exceeded"
  | "output-too-large";

type CanonicalRankingJsonExportError = Readonly<{
  code: CanonicalRankingJsonExportErrorCode;
  message: string;
  path?: string;
}>;

type CanonicalRankingJsonExportResult =
  | Readonly<{
      ok: true;
      value: CanonicalRankingJsonExportValue;
    }>
  | Readonly<{
      ok: false;
      errors: readonly CanonicalRankingJsonExportError[];
    }>;

exportCanonicalRankingSetJson(
  rankingSet: RankingSet,
  request: CanonicalRankingJsonExportRequest,
): CanonicalRankingJsonExportResult
```

Keep export results separate from `RankingImportStageResult`. Export is not one of the staged import transitions, and adding a fictional import stage would blur the existing pipeline contract.

The exporter must not call `Date.now`, allocate a timestamp, access the filesystem, or query persistence.

### Request and Domain Validation

Validate in this order:

1. `request.exportedAt` is a valid `Date`;
2. when present, `includeSourceRankingSetId` is a boolean;
3. `validateRankingSet(rankingSet)` succeeds;
4. entry count is no greater than `RANKING_IMPORT_LIMITS.maxEntries`;
5. serialized UTF-8 output is no greater than `RANKING_IMPORT_LIMITS.maxBytes`.

Map each ordered canonical domain failure to `invalid-ranking-set`, preserving its message and path. Return no partial export when any error exists.

A ranking set may satisfy domain invariants yet exceed the portable format limits because domain collection and string sizes are not transport concerns. Such a set fails export explicitly rather than producing a document that public preflight or parsing cannot re-import.

Do not trim, default, reorder, or mutate valid domain values during validation.

### Frozen Document Mapping

Build a new `CanonicalRankingSetDocumentV1` with this root property order:

1. `schemaVersion`
2. `metadata`
3. `capabilities`
4. `entries`

Use `CANONICAL_RANKING_JSON_V1_PROFILE.schemaVersion` rather than a duplicate numeric constant.

Map `metadata` in this order:

1. `name`
2. `exportedAt`
3. optional `sourceRankingSetId`
4. `source`

`exportedAt` is `request.exportedAt.toISOString()`.

Include `sourceRankingSetId: rankingSet.id` only when `includeSourceRankingSetId === true`. Omit the property otherwise. It is portable provenance only; the current normalizer ignores it and later create conversion requires a separately supplied local ID.

Always include source provenance because every canonical domain set has it. Map source properties in this order:

1. `kind`
2. optional `formatId`
3. optional `formatVersion`
4. optional `label`
5. optional `importedAt` as `toISOString()`

Do not export local `createdAt` or `updatedAt`; those describe the current repository aggregate, not portable ranking meaning.

### Capability and Entry Mapping

Build a new capabilities object with fixed property order:

1. `team`
2. `playerIdentity`
3. `overallOrder`
4. `positionRank`
5. `adp`
6. `tiers`

Build the tier map in supported position order: `QB`, `RB`, `WR`, `TE`, `DST`, `K`. Include only positions present in `rankingSet.capabilities.tiers`. Domain validation already proves the keys match represented positions.

Map entries in existing canonical array order. Do not sort again or recalculate ranks. Each exported entry uses this property order:

1. `player`
2. `overallRank`
3. `positionRank`
4. `tier`
5. `adpRank`

Map player properties in this order:

1. `id`
2. `name`
3. `team`
4. `position`

Copy every domain-relevant value exactly. In particular:

- preserve explicit player IDs;
- preserve canonical overall and position ranks;
- preserve source tier values and gaps;
- preserve neutral tier values;
- preserve `UNKNOWN_TEAM` and null ADP;
- preserve capability states that distinguish source data from generated, derived, partial, absent, or defaulted data.

No domain object may be reused as a nested transport object.

### Deterministic Serialization and Bounds

Serialize the newly mapped document exactly once with:

```ts
const text = JSON.stringify(document);
```

Do not pretty-print, append a newline, depend on source-object insertion order, or use a generic key-sorting serializer. Determinism comes from the explicit mapping order above.

Calculate UTF-8 byte length with `new TextEncoder().encode(text).byteLength`. Return this value with the text and document.

If the encoded size exceeds `RANKING_IMPORT_LIMITS.maxBytes`, return `output-too-large` and no export value. An output exactly at the byte limit is allowed.

Repeated calls with deeply equal ranking sets and equal request values must return deeply equal documents, identical text, and equal byte lengths.

### Import Round-Trip Contract

Round-trip tests must pass the exported text through the public boundaries in order:

1. UTF-8 encode the export text;
2. `preflightRankingImport` with `canonical-ranking-json` version `1`;
3. `parseCanonicalRankingJson`;
4. `normalizeRankingSource` with an explicit import timestamp only where the canonical source contract needs it;
5. `validateNormalizedRankingCandidate`;
6. `convertValidatedRankingCandidate` with a newly supplied local create ID and timestamp.

Compare the round-tripped set to the source set semantically:

- same name;
- same source provenance;
- same capabilities and tier provenance;
- same canonical entries, player identities, order, ADP, and tiers.

Expected differences are:

- a new caller-issued local ID;
- new local lifecycle timestamps;
- export timestamp remains document metadata rather than domain lifecycle.

When `sourceRankingSetId` was included, assert that parsing preserves it as portable metadata, normalization does not turn it into local identity, and conversion still uses the new caller-issued ID.

### Distinction from Scenario V1 and Excluded State

The root must contain `schemaVersion`, `metadata`, `capabilities`, and `entries`. It must not contain Scenario V1 sections such as:

- `rankingContext`;
- `leagueSettings`;
- `draftConfiguration`;
- `userTeamContext`;
- `pickHistory`;
- `replayTarget`.

It also must not contain recommendations, draft state, repository records, raw parser records, diagnostics, locations, or UI state. The existing canonical parser should accept it, while Scenario V1 recognition remains untriggered.

### Ownership and Purity

The exporter must not mutate the ranking set, entries, players, source, capabilities, tier map, or dates.

The returned document must own new metadata, source, capabilities, tier map, entry, and player objects. The serialized text is derived from those new values. Mutating test-side copies must not demonstrate shared nested references with the domain input.

The optional source ID and export timestamp are request-controlled metadata only. Export does not alter the ranking set or create a new domain revision.

### Focused Tests

Add `src/lib/canonicalRankingJsonExporter.test.ts` covering:

- exact compact JSON text for a representative complete set;
- exact root, metadata, source, capability, tier-key, entry, and player property order;
- exported timestamp ISO conversion;
- optional `sourceRankingSetId` included only when explicitly requested;
- canonical entry order retained without resorting;
- explicit player identity and every engine-used value retained;
- source tier gaps retained exactly;
- safely degraded values and capability provenance retained exactly;
- source provenance optional fields omitted rather than serialized as null;
- local `createdAt` and `updatedAt` excluded;
- Scenario V1, draft, recommendation, parser, location, persistence, and UI fields absent;
- identical input values producing identical document, text, and byte length;
- ranking set and nested values unchanged and not shared with the returned document;
- invalid export date and invalid include-ID option;
- ordered mapping of canonical domain validation failures;
- 1,001 valid canonical entries rejected by the portable entry limit;
- multibyte UTF-8 content counted by bytes rather than JavaScript string length;
- output over 1 MiB rejected before success;
- representative complete export traversing every public import stage and preserving semantic domain values;
- safely degraded export/import round trip preserving unknown team, null ADP, neutral tiers, and defaulted capabilities;
- included portable source ID observable after parsing but ignored for new local identity during conversion;
- exported document accepted by canonical parsing and not recognized as Scenario V1;
- type-facing proof that the document satisfies `CanonicalRankingSetDocumentV1`.

Use small inline domain builders. A large-output test may use repeated valid strings and entries but must not read fixture files or weaken transport limits. No database, browser, file download, or manual QA is required.

## Implementation Steps

1. Add export request, value, error, and result types plus request/domain validation helpers in `canonicalRankingJsonExporter.ts`.
2. Map metadata, optional local-ID provenance, source provenance, capabilities, ordered tiers, canonical entries, and players into new V1 transport values.
3. Serialize once with compact `JSON.stringify`, calculate UTF-8 byte length, and enforce entry/byte bounds.
4. Add focused exact-output, deterministic, ownership, invalid-input, bound, exclusion, and Scenario-distinction tests.
5. Add complete and degraded public import-pipeline round-trip tests, including proof that portable local ID is not reused.
6. Run focused tests, TypeScript, and focused lint.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 8 complete in `docs/tasks.md` and update this slice status.
9. Report results and stop. Do not begin Task 9 editing operations.

## Expected Files

- `src/lib/canonicalRankingJsonExporter.ts`
- `src/lib/canonicalRankingJsonExporter.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import type, format profile, parser, preflight, normalizer, candidate validator, converter, canonical validator, domain type, engine, scenario, snapshot, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/canonicalRankingJsonExporter.test.ts
npx tsc --noEmit
npm run lint -- src/lib/canonicalRankingJsonExporter.ts src/lib/canonicalRankingJsonExporter.test.ts
npm test
npm run lint
```

Expected result:

- Focused export tests pass with exact JSON, property order, bounds, exclusions, ownership, and round-trip assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- Existing Tasks 1 through 7 behavior remains unchanged.
- No database, network, browser, environment-variable, build, migration, generated-client, or manual-QA requirement is introduced.

## Acceptance Criteria

- A valid portable-size canonical ranking set exports as typed Canonical Ranking Set JSON V1.
- Exported JSON is compact and byte-for-byte deterministic for equal domain values and request values.
- The V1 envelope, metadata, source, capability, tier, entry, and player property order is explicit and stable.
- Every engine-relevant player and ranking value survives export/import unchanged.
- Tier gaps, materialized fallbacks, and capability provenance survive export/import unchanged.
- Optional local identity is clearly non-authoritative and never reused automatically after import.
- Local lifecycle, draft, recommendation, Scenario V1, parser, persistence, and UI state are absent.
- Exported text passes public canonical preflight and parsing and is distinguishable from Scenario V1.
- Domain-invalid, entry-limit-exceeding, or byte-limit-exceeding sets return explicit failures and no partial export.
- Export is pure, clock-free, repository-free, and owns new transport values.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 8 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If the existing V1 transport type and parser disagree about field presence or shape, stop and report the contract mismatch rather than choosing a new format silently.
- If a domain-valid set cannot fit the frozen portable entry or byte bound, return the explicit export-limit failure rather than bypassing import preflight limits.
- If round-trip import changes an engine-relevant value or capability state, stop and report the boundary mismatch rather than weakening the comparison.
- If local identity would be reused without an explicit new conversion request, stop and preserve the existing create/replacement boundary.
- If deterministic output would require relying on uncontrolled object property order, replace that mapping with explicit ordered construction rather than adding a generic canonicalizer.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 9: add pure ranking-set edit and tier-management operations over complete canonical aggregates, preserving overall order and validating whole-set replacements.

## Slice Review

- Smallest meaningful increment: yes. It adds only the canonical portable export and lossless round-trip boundary.
- Executable by a lower-reasoning pass: yes. API, mapping order, bounds, serialization, diagnostics, exclusions, and round-trip steps are explicit.
- Avoids unnecessary architecture changes: yes. One explicit V1 serializer uses existing domain, transport, validation, and import contracts without a registry or new dependency.
- Blast radius reasonable: yes. Two source/test files plus Task 8 and slice-status documentation are expected.
- Review/revert comfort: yes. The exporter is additive, pure, and isolated from persistence, application workflows, engines, and UI.
- Observable/testable acceptance criteria: yes. Exact bytes, typed document values, round-trip semantics, limits, exclusions, and ownership are directly testable.
