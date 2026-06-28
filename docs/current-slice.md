# Current Slice: Parse FantasyPros CSV Source Records

## Completion Status

Complete. The frozen FantasyPros CSV V1 syntax now parses into deterministic, located source records without normalizing values or constructing domain data. Validation passed with 21 focused parser tests, 365 full-suite tests, TypeScript checking, and focused and repository-wide linting.

## Source Context

Phase 5 Task 2 established:

- fatal UTF-8 byte preflight;
- fixed 1 MiB and 1,000-entry limits;
- generic import diagnostics and stage results;
- source-shaped parsed record contracts;
- the FantasyPros CSV V1 format reference and profile;
- required `PLAYER NAME`/`PLAYER` and `POS`/`POSITION` semantics;
- optional rank, tier, team, and ADP-delta semantics;
- known ignored `BYE`, `UPSIDE`, `BUST`, and `SOS` fields.

This slice begins only after a document has passed preflight. The parser owns CSV syntax, header recognition, source locations, and record shape. It must not interpret ranking meaning.

The current source file contains 487 data records. Its observed physical headers normalize to:

```text
RK | TIERS | PLAYER NAME | TEAM | POS | BYE | UPSIDE | BUST | SOS | ECR VS ADP
```

## Goal

Parse a preflight-approved FantasyPros CSV V1 document into deterministic located source records, rejecting malformed or incompatible CSV while preserving raw field values for the later normalization stage.

## Scope

### Goals

- Add one explicit FantasyPros CSV V1 parser.
- Accept only a preflight document whose format is `fantasypros-csv` version `1`.
- Parse commas, quoted fields, escaped double quotes, LF, CRLF, and quoted embedded line breaks.
- Preserve raw decoded cell values, including casing, whitespace, signs, and null markers.
- Skip physically blank lines without changing source line locations.
- Normalize header names only for semantic matching by trimming and uppercasing.
- Map recognized aliases to source-neutral semantic field keys.
- Require exactly one player-name semantic and one position semantic.
- Reject duplicate recognized semantics even when different aliases are used.
- Omit known ignored columns from parsed record fields without warnings.
- Warn once per unknown header and omit unknown columns from parsed record fields.
- Return zero-based source record indexes and one-based source row/column locations.
- Reject row-width mismatches, empty data sets, and more than 1,000 data records.
- Add exact unit coverage plus a regression that parses the real 487-row source file.
- Check Phase 5 Task 3 complete only after all validation passes.

### Non-Goals

- Reading files or decoding bytes inside the parser.
- Automatic format detection or accepting canonical JSON.
- Trimming or normalizing data-row values.
- Splitting `POS` into position and source position rank.
- Parsing numbers, tiers, ranks, or ADP deltas.
- Generating player IDs or applying team, tier, or ADP fallbacks.
- Validating ranking semantics, duplicates, order, or capabilities.
- Constructing `NormalizedRankingCandidate`, `RankingEntry`, or `RankingSet` values.
- Persistence, application workflows, server actions, or UI.
- Adding a generic CSV package, parser framework, or dependency.

## Implementation Design

### Parser Module

Add `src/lib/fantasyProsCsvParser.ts`.

Export:

```ts
parseFantasyProsCsv(
  document: PreflightRankingDocument,
): RankingImportStageResult<
  ParsedRankingSourceDocument,
  FantasyProsCsvParserDiagnosticCode
>
```

Define `FantasyProsCsvParserDiagnosticCode` as:

- `wrong-format`
- `malformed-csv`
- `missing-header`
- `missing-required-header`
- `duplicate-header`
- `row-length-mismatch`
- `empty-records`
- `too-many-records`
- `unknown-header`

`unknown-header` is a warning. Every other code is an error.

### CSV Grammar

Implement only the grammar required by this supported profile:

- comma delimiter;
- double-quote field quoting;
- doubled double quotes inside quoted fields represent one literal quote;
- commas and LF/CRLF line breaks may appear inside quoted fields;
- LF and CRLF terminate unquoted records;
- a bare CR outside a quoted field is malformed;
- quotes may begin only at the start of a field;
- after a closing quote, only a comma, LF, CRLF, or end-of-document is valid;
- trailing empty fields are preserved;
- the final record does not require a terminal newline;
- an unclosed quoted field is malformed.

Do not use `split(",")` or line-based parsing. Keep the CSV scanner private to the FantasyPros parser module rather than introducing a general CSV abstraction.

The scanner should produce decoded records with:

- field values;
- each field's one-based physical starting line and one-based physical starting column;
- each record's one-based starting line.

For multiline quoted values, later fields use their actual physical line locations.

### Blank Lines

Skip a record only when it consists of one unquoted empty field produced by a physically blank line. Do not treat `""`, `,`, or `,,` as blank records; those are explicit CSV records and remain subject to width and required-value handling in later stages.

Blank lines before the header are skipped. The first nonblank record is the header. Blank lines after the header do not increment `sourceIndex`, but their physical lines still affect later diagnostic locations.

### Header Mapping

Normalize decoded header values with `trim().toUpperCase()` for lookup only. Preserve the decoded physical headers in parser metadata.

Map aliases to these semantic field keys:

| Semantic key | Accepted normalized headers |
| --- | --- |
| `overallOrder` | `RK`, `RANK` |
| `tier` | `TIERS`, `TIER` |
| `playerName` | `PLAYER NAME`, `PLAYER` |
| `team` | `TEAM` |
| `position` | `POS`, `POSITION` |
| `adpDelta` | `ECR VS ADP` |

Treat `BYE`, `UPSIDE`, `BUST`, and `SOS` as recognized ignored headers.

Header rules:

- Missing `playerName` or `position` produces one `missing-required-header` error per missing semantic in that order.
- Two physical columns mapping to the same semantic produce `duplicate-header` at the later column, even if they use different aliases such as `PLAYER NAME` and `PLAYER`.
- Duplicate ignored headers remain ignored because they do not enter parsed records.
- Each other unknown header produces one `unknown-header` warning at header row and column.
- Empty header cells are unknown headers and warn using the physical column location.

If header errors exist, return failure before mapping data rows. Preserve any unknown-header warnings alongside the errors.

### Parsed Records

On success, return `ParsedRankingSourceDocument` with:

- the exact FantasyPros CSV V1 format reference from the preflight document;
- metadata containing decoded physical headers, normalized headers, and semantic-to-one-based-column mapping;
- one parsed record per nonblank data row;
- zero-based `sourceIndex` in returned record order;
- only recognized non-ignored semantic fields;
- `ParsedRankingField.value` as the raw decoded string without trimming or coercion;
- field location containing that field's physical starting row, one-based CSV column ordinal, and semantic field name.

For this parser, diagnostic/field `column` means one-based CSV column ordinal, not character offset. Scanner syntax errors may use the physical character column because no semantic column exists yet.

Do not include ignored or unknown columns in record field maps.

### Shape Validation

After syntax and header validation:

- Every nonblank data row must have exactly the same physical field count as the header.
- Report `row-length-mismatch` at the row start for each mismatched row that can be safely identified.
- Exclude mismatched rows from the success value; any mismatch makes the parse fail.
- Reject more than `RANKING_IMPORT_LIMITS.maxEntries` nonblank data rows with `too-many-records`.
- Reject zero nonblank data rows with `empty-records`.
- Preserve unknown-header warnings on shape failure.

Do not validate empty required cell values, source-position patterns, numeric syntax, tier progression, or ADP-delta syntax here. Those are normalization/validation responsibilities.

### Diagnostic Ordering

Return diagnostics deterministically:

1. `wrong-format` before reading text.
2. Fatal scanner `malformed-csv` at the first syntax failure.
3. Header errors by required-semantic order or later physical column, as applicable.
4. Row-width errors by physical row.
5. `too-many-records` or `empty-records` after row shape checks.

Warnings are ordered by physical header column. All parser diagnostics use stage `parse`. Errors use severity `error`; unknown headers use `warning`.

### Focused Tests

Add `src/lib/fantasyProsCsvParser.test.ts` covering:

- the actual 487-row source file after passing it through byte preflight;
- exact first and last parsed record raw values;
- required-only and missing-optional headers;
- accepted header aliases and case/outer-whitespace normalization;
- known ignored headers omitted without warnings;
- one and multiple unknown-header warnings in column order;
- duplicate semantics through identical headers and different aliases;
- both missing required semantics with deterministic order;
- quoted commas, doubled quote escapes, CRLF, LF, no final newline, and quoted multiline values;
- preservation of data value whitespace, casing, `+`/`-` signs, and `-` null markers;
- blank lines before the header and among data rows;
- explicit empty quoted records and comma-only records not treated as blank lines;
- too few and too many row fields;
- zero data rows;
- exactly 1,000 and 1,001 data rows;
- quote inside an unquoted field, text after a closing quote, unclosed quote, and bare CR;
- wrong preflight format;
- exact error/warning codes, stages, severities, paths/locations, and ordering.

Use small inline CSV strings for focused cases. The real-file regression may read only the known source file in the test; production parser code must not access the filesystem.

## Implementation Steps

1. Add the private CSV scanner and public FantasyPros parser in `fantasyProsCsvParser.ts`.
2. Map frozen profile headers into semantic parsed fields and metadata.
3. Add deterministic header, warning, row-shape, limit, and empty-record handling.
4. Add focused syntax, mapping, location, failure, and real-source regression tests.
5. Run focused tests, TypeScript, and focused lint.
6. Run the full test suite and repository-wide lint.
7. After all acceptance criteria pass, mark only Phase 5 Task 3 complete in `docs/tasks.md` and update this slice status.
8. Report results and stop. Do not normalize parsed records or begin Task 4.

## Expected Files

- `src/lib/fantasyProsCsvParser.ts`
- `src/lib/fantasyProsCsvParser.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import type, preflight, profile, CSV data, seed, domain, validator, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/fantasyProsCsvParser.test.ts
npx tsc --noEmit
npm run lint -- src/lib/fantasyProsCsvParser.ts src/lib/fantasyProsCsvParser.test.ts
npm test
npm run lint
```

Expected result:

- Focused parser tests pass with exact source and diagnostic assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- No dependency, database, network, browser, environment-variable, build, or generated-client requirement is introduced.

No Prisma validation, production build, or manual browser QA is required because this slice adds only pure parsing and unit/integration fixtures.

## Acceptance Criteria

- Only preflight-approved FantasyPros CSV V1 documents are accepted.
- Supported CSV quoting, escaping, delimiters, line endings, multiline fields, and final-record behavior parse deterministically.
- Malformed CSV returns one first-failure syntax diagnostic with a physical location.
- Header aliases map to exactly the six source-neutral semantic keys.
- Required headers, duplicate semantics, ignored headers, and unknown warnings follow the frozen profile.
- Raw data values are not trimmed, coerced, normalized, or converted into domain values.
- Every returned field has deterministic row, column ordinal, and semantic field location.
- Blank-line handling preserves physical locations and source-index order.
- Row widths, zero records, and the 1,000-record limit are enforced.
- The current FantasyPros source produces exactly 487 parsed records.
- Parsed output contains no `RankingEntry`, `RankingSet`, recommendation, draft, persistence, or UI state.
- Existing Task 1 and Task 2 behavior remains unchanged.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 3 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If the real CSV violates the frozen profile, stop and report the exact row/header discrepancy instead of adding a permissive special case.
- If a syntax choice requires a broader CSV standard than documented, reject it as malformed rather than generalizing the parser.
- If parser output needs normalized player, position, rank, tier, or ADP values, defer that need to Task 5.
- If a header could map to more than one semantic, treat the profile as ambiguous and report the blocker rather than guessing.
- If exact locations cannot be preserved through a scanner branch, fix location tracking before accepting the syntax.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 4: parse Canonical Ranking Set JSON V1 into located source records without trusting it as domain data.

## Slice Review

- Smallest meaningful increment: yes. It completes one format parser without crossing into normalization or domain logic.
- Executable by a lower-reasoning pass: yes. Grammar, headers, semantics, locations, diagnostics, tests, and commands are explicit.
- Avoids unnecessary architecture changes: yes. The scanner is private and no generic parser framework or dependency is introduced.
- Blast radius reasonable: yes. Two parser/test files plus Task 3 and slice-status documentation are expected.
- Review/revert comfort: yes. The parser is additive and isolated from engines, persistence, and UI.
- Observable/testable acceptance criteria: yes. Exact records, warnings, errors, locations, limits, and the real 487-row fixture are directly testable.
