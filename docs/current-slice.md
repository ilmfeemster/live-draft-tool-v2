# Current Slice: Define Ranking Import Contracts and Format Profiles

## Completion Status

Planned. This slice promotes Phase 5 Task 2. It defines import-stage boundaries, diagnostics, transport preflight, and the two approved format profiles without implementing either parser.

## Source Context

Phase 5 Task 1 established canonical `RankingSet` values and runtime invariant validation. Imported data must now cross explicit typed stages before it can become domain data.

The approved import sequence is:

```text
transport preflight
        |
format parser
        |
normalization
        |
candidate validation
        |
domain conversion
        |
repository commit
```

This slice defines those handoffs and freezes the two Phase 5 formats. It does not implement parsing, normalization, validation, conversion, or persistence.

The existing FantasyPros source at `src/data/FantasyPros_2026_Draft_ALL_Rankings.csv` contains 487 records and this exact header row after CSV decoding:

```text
RK | TIERS | PLAYER NAME | TEAM | POS | BYE | UPSIDE  | BUST  | SOS | ECR VS ADP
```

The trailing space on each of `UPSIDE ` and `BUST ` is present in the raw header value. Header matching should trim outer whitespace before comparing names, so these become ignored `UPSIDE` and `BUST` fields.

Observed source facts:

- `RK`, `TIERS`, `PLAYER NAME`, `TEAM`, `POS`, `BYE`, `UPSIDE `, `BUST `, `SOS`, and `ECR VS ADP` are populated in the current file.
- `POS` combines a supported position and source position rank, such as `WR1`, `RB12`, `DST3`, or `K1`.
- `TIERS` contains positive integers.
- `ECR VS ADP` contains signed integer deltas, `0`, or `-`.
- `-` is the null marker for unavailable ADP comparison; it is distinct from a negative integer.
- The current seed conversion derives ADP rank as overall/source order plus the signed `ECR VS ADP` delta and uses `null` for `-`.
- Bye, upside, bust, and SOS values are not part of the Phase 5 canonical ranking domain.

## Goal

Create one source-agnostic import contract and one pure transport-preflight boundary that identify supported formats, reject unsafe or undecodable input, preserve stage separation, and make the FantasyPros CSV and Canonical Ranking Set JSON V1 profiles executable specifications for later parser slices.

## Scope

### Goals

- Define stable format identifiers and version references for FantasyPros CSV V1 and Canonical Ranking Set JSON V1.
- Define source-neutral import stages, severity, diagnostics, locations, and generic stage results.
- Define distinct preflight, parsed-source, normalized-candidate, validated-candidate, and domain-conversion handoff types.
- Keep parsed source records structurally distinct from `RankingEntry` and `RankingSet`.
- Define the valid Canonical Ranking Set JSON V1 envelope without treating parsed JSON as trusted domain data.
- Freeze the FantasyPros CSV header, alias, field-semantic, null-marker, and ignored-field contract.
- Define fixed Phase 5 input limits of 1 MiB and 1,000 ranking records.
- Add pure UTF-8 transport preflight over bytes.
- Reject unsupported format IDs, unsupported versions, empty input, oversized input, and invalid UTF-8 with structured diagnostics.
- Strip one leading UTF-8 BOM after successful decoding.
- Add exact contract and preflight tests.
- Check Phase 5 Task 2 complete only after all validation passes.

### Non-Goals

- Parsing CSV rows, quoting, headers, or JSON document structure.
- Normalizing player names, teams, positions, ranks, tiers, ADP, or IDs.
- Applying unknown-team, nullable-ADP, neutral-tier, or generated-ID fallbacks.
- Validating source-record semantics or canonical ranking-set invariants.
- Converting candidates into `RankingSet` values.
- Import application workflows, repositories, persistence, server actions, or UI.
- Generic column mapping, runtime plugins, automatic format detection, or additional ranking formats.
- Modifying the existing FantasyPros CSV, seed rankings, engines, snapshots, scenarios, or domain validator.
- Adding package dependencies.

## Implementation Design

### Import Type Module

Add `src/types/rankingImport.ts`. It may import existing ranking domain types only for the trusted portable-document output contract; parsed-source types must not extend or alias `RankingEntry` or `RankingSet`.

Define:

- `RankingImportFormatId`: `"fantasypros-csv" | "canonical-ranking-json"`.
- `RankingImportFormatRef`: `{ id: RankingImportFormatId; version: 1 }`.
- `RankingImportStage`: `"preflight" | "parse" | "normalize" | "validate" | "convert" | "persist"`.
- `RankingImportDiagnosticSeverity`: `"error" | "warning"`.
- `RankingImportDiagnosticLocation`: optional `path`, one-based `row`, one-based `column`, and source `field`.
- Generic `RankingImportDiagnostic<TCode extends string>` with stable code, stage, severity, message, and optional location.
- Generic `RankingImportStageResult<TValue, TCode extends string>` with:
  - success: `{ ok: true; value: TValue; warnings: readonly Diagnostic[] }`;
  - failure: `{ ok: false; errors: readonly Diagnostic[]; warnings: readonly Diagnostic[] }`.

Define these distinct handoffs:

- `PreflightRankingDocument`: supported format reference, decoded text, and original byte length.
- `ParsedRankingField`: untrusted value plus source location.
- `ParsedRankingSourceRecord`: stable zero-based source index and field map of parsed values.
- `ParsedRankingSourceDocument`: supported format reference, untrusted metadata, and parsed source records.
- `NormalizedRankingCandidateEntry`: source index/location plus source-neutral nullable primitives for player ID, name, team, position, source order, source position rank, tier, and ADP rank.
- `NormalizedRankingCandidate`: requested display name, source description, computed field-capability metadata, and normalized entries.
- `ValidatedRankingCandidate`: a distinct wrapper containing a normalized candidate and a literal validated marker. It must not be assignable directly from a parsed document.
- `ConvertedRankingSet`: a distinct wrapper around the canonical `RankingSet` returned by future domain conversion.

These are boundary contracts, not implementations. Do not add parser functions, validation functions, classes, dependency injection, or mutable pipeline state.

### Canonical Ranking Set JSON V1 Contract

Define the trusted portable-document output shape separately from untrusted parsed JSON:

```text
schemaVersion: 1
metadata:
  name: string
  exportedAt: ISO timestamp string
  sourceRankingSetId?: string       # non-authoritative provenance
  source?:
    kind
    formatId?
    formatVersion?
    label?
    importedAt?: ISO timestamp string
capabilities: RankingSetCapabilities
entries: readonly RankingEntry[]
```

The portable document must not contain drafts, league settings, picks, recommendations, repository records, or React state. Its local source-set ID is provenance only and cannot become imported local identity automatically.

The type represents a valid serializer output. Task 4 will still parse JSON from `unknown` and validate every field before constructing it.

### Format Profiles and Limits

Add profile constants and preflight behavior in `src/lib/rankingImportPreflight.ts`.

Export:

```ts
export const RANKING_IMPORT_LIMITS = {
  maxBytes: 1_048_576,
  maxEntries: 1_000,
} as const;
```

Export immutable supported-format references:

- `{ id: "fantasypros-csv", version: 1 }`
- `{ id: "canonical-ranking-json", version: 1 }`

Export a FantasyPros CSV V1 profile describing:

#### Header Matching

- Decode CSV header cells before semantic matching in Task 3.
- Trim outer whitespace and compare case-insensitively using uppercase normalized names.
- Reject two physical columns that normalize to the same recognized semantic header in Task 3.

#### Recognized Semantic Headers

| Semantic | Accepted normalized headers | Presence | Later behavior |
| --- | --- | --- | --- |
| Overall order | `RK`, `RANK` | Optional | Use explicit rank when the column exists; otherwise Task 5 uses row order |
| Tier | `TIERS`, `TIER` | Optional | Missing/partial values become neutral per-position tiers in Task 5 |
| Player name | `PLAYER NAME`, `PLAYER` | Required | Missing required header is a Task 3 parser error |
| Team | `TEAM` | Optional | Missing/blank values become `UNK` in Task 5 |
| Position | `POS`, `POSITION` | Required | Accept position token with optional positive numeric suffix |
| ADP delta | `ECR VS ADP` | Optional | Signed integer or `0`; `-` means unavailable |

Recognize `BYE`, `UPSIDE`, `BUST`, and `SOS` as ignored fields. Unknown headers are preserved or warned about by Task 3 but never added automatically to the ranking domain.

#### Source Value Semantics

- Position values use `QB`, `RB`, `WR`, `TE`, `DST`, or `K` plus an optional positive integer source position rank.
- `RK`, when present, is a positive integer source order.
- `TIERS`, when non-empty, is a positive integer.
- If the `RK` column is absent, Task 5 uses row order. If `RK` is present, every non-header row must eventually supply a positive integer; partial blank ranks are malformed rather than a mixed fallback.
- `TEAM`, tier, and ADP-delta cells may be blank where the shared fallback matrix permits absence.
- `ECR VS ADP` accepts `+N`, `-N`, `0`, or the exact null marker `-`.
- Future normalization derives ADP rank from canonical/source order plus the delta and rejects a non-positive result.
- This CSV profile has no player-ID column; Task 5 must generate source-local identities.

Profile constants document these semantics; this slice does not enforce row values.

Export a Canonical JSON V1 profile containing its format reference, schema version `1`, 1 MiB byte limit, 1,000-entry limit, and required root fields `schemaVersion`, `metadata`, `capabilities`, and `entries`.

### Transport Preflight

Define:

```ts
preflightRankingImport(input: {
  formatId: string;
  formatVersion: number;
  bytes: Uint8Array;
}): RankingImportStageResult<PreflightRankingDocument, RankingImportPreflightErrorCode>
```

Define `RankingImportPreflightErrorCode` as:

- `unsupported-format`
- `unsupported-version`
- `empty-input`
- `input-too-large`
- `invalid-encoding`

Preflight order is deterministic and fail-fast:

1. Validate format ID.
2. Validate version for that supported format.
3. Reject zero bytes or more than 1 MiB.
4. Decode bytes as UTF-8 using a fatal decoder.
5. Strip one leading UTF-8 BOM if present.
6. Reject decoded content that is empty or whitespace-only.
7. Return the typed supported format reference, decoded text, byte length, and no warnings.

Preflight does not inspect extensions, filenames, CSV syntax, JSON syntax, headers, rows, fields, or record counts.

Every preflight failure returns exactly one diagnostic with:

- stage `preflight`;
- severity `error`;
- the stable code above;
- no source location.

### Focused Tests

Add `src/lib/rankingImportPreflight.test.ts` covering:

- exact format IDs, versions, limits, recognized headers, aliases, ignored headers, null marker, and source-position pattern;
- the exact current FantasyPros header after trim/uppercase normalization;
- a minimum CSV header containing only required semantics;
- a permitted missing-optional-column header;
- canonical JSON V1 required root fields and schema version;
- successful UTF-8 preflight for both formats;
- UTF-8 BOM stripping;
- exact acceptance at 1 MiB and rejection at 1 MiB plus one byte;
- zero-byte and whitespace-only rejection;
- invalid UTF-8 rejection using an explicit invalid byte sequence;
- unsupported format and unsupported version priority over content failures;
- success preserving byte length and decoded text;
- success returning no warnings;
- exact diagnostic code, stage, severity, message, and lack of location for every failure.

Do not add parser tests in this slice.

## Implementation Steps

1. Add `src/types/rankingImport.ts` with generic diagnostics, stage results, stage handoffs, and the canonical JSON V1 output contract.
2. Add `src/lib/rankingImportPreflight.ts` with limits, supported profile constants, header semantics, and pure UTF-8 preflight.
3. Add exact profile-contract and preflight tests.
4. Run focused tests, TypeScript, and focused lint.
5. Run the full test suite and repository-wide lint.
6. After all acceptance criteria pass, mark only Phase 5 Task 2 complete in `docs/tasks.md` and update this slice status.
7. Report results and stop. Do not implement either parser or begin Task 3.

## Expected Files

- `src/types/rankingImport.ts`
- `src/lib/rankingImportPreflight.ts`
- `src/lib/rankingImportPreflight.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No existing CSV, seed, domain, validator, engine, snapshot, scenario, persistence, architecture, design, decision, project, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingImportPreflight.test.ts
npx tsc --noEmit
npm run lint -- src/types/rankingImport.ts src/lib/rankingImportPreflight.ts src/lib/rankingImportPreflight.test.ts
npm test
npm run lint
```

Expected result:

- Focused profile and preflight tests pass with exact assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- No database, network, browser, environment-variable, build, or generated-client dependency is introduced.

No Prisma validation, production build, or manual browser QA is required because this slice adds only isolated contracts, pure byte preflight, and unit tests.

## Acceptance Criteria

- Supported format identifiers and versions are explicit and closed to the two approved V1 profiles.
- The fixed limits are exactly 1 MiB and 1,000 entries.
- Import stages, diagnostic severity/location, and generic success/failure contracts are source-agnostic.
- Parsed records and normalized candidates are structurally distinct from canonical `RankingEntry` and `RankingSet` values.
- Canonical Ranking Set JSON V1 has an explicit trusted output envelope and remains distinct from Scenario V1.
- The FantasyPros profile exactly documents current headers, aliases, ignored fields, position encoding, tier semantics, ADP-delta values, and the `-` null marker.
- Required versus optional FantasyPros semantics match the approved fallback matrix.
- Preflight accepts only supported ID/version pairs, valid non-empty UTF-8, and at most 1 MiB.
- Preflight strips one leading UTF-8 BOM and preserves original byte length.
- Preflight errors are fail-fast, structured, deterministic, and location-free.
- No CSV or JSON parsing is implemented.
- Existing Task 1 domain and validator behavior remains unchanged.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 2 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If the raw FantasyPros source differs from the documented header or value semantics, stop and report the concrete discrepancy rather than broadening the format profile.
- If UTF-8 fatal decoding is unavailable in the supported runtime, stop and report the runtime constraint rather than adding a dependency.
- If a proposed handoff type exposes `RankingEntry` or `RankingSet` before domain conversion, revise the boundary rather than accepting the coupling.
- If canonical JSON V1 requires a field not approved by the design, stop and report the design gap rather than inventing it.
- If a test requires parser behavior, defer it to Task 3 or Task 4.
- If unrelated existing tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 3: parse the frozen FantasyPros CSV V1 syntax into located source records without normalization, domain validation, or persistence.

## Slice Review

- Smallest meaningful increment: yes. It establishes the safe typed boundary and frozen profiles required before either parser can exist.
- Executable by a lower-reasoning pass: yes. Types, formats, limits, headers, semantics, diagnostics, preflight order, tests, and commands are explicit.
- Avoids unnecessary architecture changes: yes. It uses two explicit profiles and generic stage results without plugins, registries, or framework coupling.
- Blast radius reasonable: yes. Three new source/test files plus Task 2 and slice-status documentation are expected.
- Review/revert comfort: yes. The slice is additive and has no persistence, UI, or engine integration.
- Observable/testable acceptance criteria: yes. Constants, byte boundaries, decoding, diagnostics, and type separation are directly testable.
