# Current Slice: Parse Canonical Ranking Set JSON V1

## Completion Status

Complete. The frozen Canonical Ranking Set JSON V1 envelope now parses into deterministic, located source records without trusting imported values as valid domain data. Validation passed with 22 focused parser tests, 387 full-suite tests, TypeScript checking, and focused and repository-wide linting.

## Source Context

Phase 5 Task 2 established:

- fatal UTF-8 byte preflight;
- fixed 1 MiB and 1,000-entry import limits;
- generic import diagnostics and stage results;
- source-shaped parsed record contracts;
- the `canonical-ranking-json` version `1` format reference;
- the required V1 root fields `schemaVersion`, `metadata`, `capabilities`, and `entries`;
- a portable document contract distinct from Scenario V1.

Phase 5 Task 3 proved the parser boundary with FantasyPros CSV. This slice adds the second explicit parser adapter. It owns canonical JSON syntax, envelope recognition, source shape, and JSON-path locations. It must not normalize values, validate ranking semantics, or construct domain data.

Canonical JSON is application-owned, but imported documents remain untrusted. Their field names are known; their values are not assumed to satisfy TypeScript types.

## Goal

Parse a preflight-approved Canonical Ranking Set JSON V1 document into deterministic located source records while preserving portable metadata, capabilities, player identities, and ranking values for later normalization and validation.

## Scope

### Goals

- Add one explicit Canonical Ranking Set JSON V1 parser.
- Accept only a preflight document whose format is `canonical-ranking-json` version `1`.
- Parse JSON with the platform JSON parser and reject malformed syntax.
- Require a non-null, non-array object root.
- Reject recognizable Scenario V1 documents as the wrong document type.
- Require an explicit numeric schema version and accept only version `1`.
- Require the V1 envelope fields in their frozen profile order.
- Require `metadata` and `capabilities` to be object-shaped and `entries` to be an array.
- Preserve metadata and capability objects as untrusted parsed values.
- Map documented entry properties into located source fields without coercion.
- Preserve explicit portable player IDs exactly as parsed.
- Use deterministic JSON paths for document, envelope, record, and field locations.
- Require each entry array element to be an object so it can form a source record.
- Enforce the frozen maximum of 1,000 parsed entry records.
- Add exact unit coverage for valid, malformed, mismatched, and boundary documents.
- Check Phase 5 Task 4 complete only after all validation passes.

### Non-Goals

- Reading files or decoding bytes inside the parser.
- Automatic format detection.
- Accepting FantasyPros CSV or Scenario V1.
- Implementing a custom JSON tokenizer or source-offset scanner.
- Reporting JSON character, line, or column offsets.
- Trimming strings, parsing dates, coercing numbers, or normalizing nulls.
- Validating metadata contents, capability enum values, player values, ranks, tiers, dates, or cross-record invariants.
- Recomputing or trusting imported capability metadata.
- Rejecting an empty `entries` array; the complete-candidate validator owns the non-empty domain invariant.
- Assigning or reusing a local ranking-set identity.
- Constructing `NormalizedRankingCandidate`, `RankingEntry`, or `RankingSet` values.
- Persistence, application workflows, server actions, export, or UI.
- Adding a schema-validation package, parser framework, or dependency.

## Implementation Design

### Parser Module

Add `src/lib/canonicalRankingJsonParser.ts`.

Export:

```ts
parseCanonicalRankingJson(
  document: PreflightRankingDocument,
): RankingImportStageResult<
  ParsedRankingSourceDocument,
  CanonicalRankingJsonParserDiagnosticCode
>
```

Define `CanonicalRankingJsonParserDiagnosticCode` as:

- `wrong-format`
- `malformed-json`
- `invalid-root`
- `wrong-document-type`
- `missing-schema-version`
- `unsupported-schema-version`
- `missing-envelope-field`
- `invalid-envelope-field`
- `invalid-entry-shape`
- `too-many-records`

Every diagnostic in this slice is a parser-stage error. The parser emits no warnings.

### Untrusted JSON Handling

Call `JSON.parse` once inside a `try`/`catch` and keep its result typed as `unknown`. Do not cast the result to `CanonicalRankingSetDocumentV1`.

Use a small private object-shape guard that accepts only non-null, non-array objects. Use own-property checks when inspecting recognized fields so inherited values never satisfy the contract.

On malformed syntax, return one `malformed-json` diagnostic at path `$`. Use a stable project-owned message rather than exposing the runtime-specific `JSON.parse` exception text.

Do not add a second JSON tokenizer solely to obtain line and character positions. Once syntax succeeds, JSON-path locations provide the stable locations required by the import pipeline.

### Root and Document-Type Recognition

After syntax parsing:

1. Reject null, arrays, strings, numbers, and booleans with `invalid-root` at path `$`.
2. Before canonical envelope validation, recognize Scenario V1 when the root contains `rankingContext` plus at least one Scenario-specific section such as `leagueSettings`, `draftConfiguration`, `userTeamContext`, `pickHistory`, or `replayTarget`.
3. Reject a recognizable scenario with `wrong-document-type` at path `$`.

Do not import scenario ranking context or reinterpret it as a ranking set.

### Schema Version

- If `schemaVersion` is not an own property, return `missing-schema-version` at path `schemaVersion`.
- If its raw value is anything other than the number `1`, return `unsupported-schema-version` at path `schemaVersion`.
- Do not coerce the string `"1"` or another representation into a supported version.

The selected preflight format version and the document schema version are separate checks. Both must be V1.

### Envelope Validation

After the schema version is accepted, inspect the remaining required root fields in this order:

1. `metadata`
2. `capabilities`
3. `entries`

For each absent own property, emit `missing-envelope-field` at that property path. For each present property with an invalid structural type, emit `invalid-envelope-field`:

- `metadata` must be a non-null, non-array object;
- `capabilities` must be a non-null, non-array object;
- `entries` must be an array.

Accumulate independent missing and invalid envelope errors in the order above. If envelope errors exist, return failure before creating source records.

Do not validate metadata child fields, capability keys or values, or entry semantics here.

### Parsed Metadata

Define and export a parser-specific metadata type:

```ts
type CanonicalRankingJsonParsedMetadata = Readonly<{
  schemaVersion: ParsedRankingField;
  documentMetadata: ParsedRankingField;
  capabilities: ParsedRankingField;
}>;
```

Populate it with the exact parsed values and these locations:

- `schemaVersion` at `schemaVersion`;
- `documentMetadata` at `metadata`;
- `capabilities` at `capabilities`.

The complete metadata and capability objects remain available to normalization, including `name`, `exportedAt`, optional source provenance, optional `sourceRankingSetId`, and capability declarations. Their presence in parsed metadata does not make any value valid or authoritative.

In particular, `sourceRankingSetId` is portable provenance only. The parser must not expose it as local ranking-set identity.

### Parsed Entry Records

Require each `entries[index]` value to be a non-null, non-array object. Emit `invalid-entry-shape` at `entries[index]` for each invalid element, ordered by ascending index. If any entry-shape errors exist, return failure without a partial parsed value.

For every valid entry object, return one `ParsedRankingSourceRecord`:

- `sourceIndex` is the zero-based array index;
- record order is the original array order;
- only own documented V1 properties are mapped;
- missing documented properties remain absent for normalization to diagnose;
- every present value remains `unknown` and is copied without coercion.

Map supported entry properties to parser semantic keys:

| Canonical JSON property | Parsed field key | Location path |
| --- | --- | --- |
| `player.id` | `playerId` | `entries[index].player.id` |
| `player.name` | `playerName` | `entries[index].player.name` |
| `player.team` | `team` | `entries[index].player.team` |
| `player.position` | `position` | `entries[index].player.position` |
| `overallRank` | `overallOrder` | `entries[index].overallRank` |
| `positionRank` | `sourcePositionRank` | `entries[index].positionRank` |
| `tier` | `tier` | `entries[index].tier` |
| `adpRank` | `adpRank` | `entries[index].adpRank` |

If `player` is a non-null, non-array object, map each documented child property that is present. If `player` is absent or has another raw type, add a `player` parsed field containing that raw value when present, located at `entries[index].player`. Do not reject or reinterpret it in this parser; Task 5 normalization will report the unusable player shape through the preserved field.

For every mapped field, set `location.path` and `location.field` to the path and semantic key respectively. Do not invent row or column values for JSON.

Ignore undocumented entry properties. They are not domain-relevant V1 values and do not extend the format contract implicitly.

### Entry Count

- Accept an empty `entries` array as syntactically and structurally valid. Task 6 owns the non-empty domain invariant.
- Accept exactly `RANKING_IMPORT_LIMITS.maxEntries` entries.
- Reject more than that limit with one `too-many-records` diagnostic at path `entries`.
- Check the count before mapping entry records.

### Diagnostic Ordering

Return diagnostics deterministically:

1. `wrong-format` before reading text.
2. `malformed-json` at the first syntax failure.
3. `invalid-root`.
4. `wrong-document-type`.
5. `missing-schema-version` or `unsupported-schema-version`.
6. Missing or invalid envelope fields in `metadata`, `capabilities`, `entries` order.
7. `too-many-records`.
8. `invalid-entry-shape` by ascending entry index.

All diagnostics use stage `parse` and severity `error`.

### Focused Tests

Add `src/lib/canonicalRankingJsonParser.test.ts` covering:

- a valid minimum V1 envelope;
- a representative V1 document containing metadata, provenance, capabilities, and all entry values;
- exact parsed metadata and record JSON paths;
- portable player IDs, source provenance, null ADP, strings, numbers, and malformed semantic values preserved unchanged;
- missing entry properties preserved as absence rather than parser defaults;
- a missing or non-object `player` preserved for normalization rather than treated as a valid player;
- malformed JSON;
- null, array, primitive, and string roots;
- a complete Scenario V1 fixture rejected as `wrong-document-type`;
- missing `schemaVersion`;
- numeric future/older versions and string `"1"` rejected without coercion;
- each missing required envelope field and deterministic multiple-error ordering;
- null, array, and primitive values for object-shaped envelope fields;
- non-array `entries`;
- non-object entry elements with exact indexed paths and deterministic ordering;
- an empty entries array accepted at the parser boundary;
- exactly 1,000 and 1,001 entries;
- wrong preflight format;
- exact error codes, stages, severities, messages, paths, and ordering;
- proof that output remains `ParsedRankingSourceDocument`, not `RankingSet` or `RankingEntry[]`.

Use small inline JSON values serialized with `JSON.stringify` except for malformed-syntax cases. Production parser code must not access the filesystem.

## Implementation Steps

1. Add the public parser, diagnostic union, parsed-metadata type, and private untrusted-object helpers in `canonicalRankingJsonParser.ts`.
2. Implement format, syntax, root, Scenario V1, schema-version, and envelope checks in the specified order.
3. Preserve raw metadata/capabilities and map documented entry properties to located source fields.
4. Add deterministic entry-shape and 1,000-record limit handling.
5. Add focused success, preservation, boundary, location, and failure tests.
6. Run focused tests, TypeScript, and focused lint.
7. Run the full test suite and repository-wide lint.
8. After all acceptance criteria pass, mark only Phase 5 Task 4 complete in `docs/tasks.md` and update this slice status.
9. Report results and stop. Do not begin Task 5 normalization.

## Expected Files

- `src/lib/canonicalRankingJsonParser.ts`
- `src/lib/canonicalRankingJsonParser.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import type, preflight, format-profile, FantasyPros parser, domain, validator, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/canonicalRankingJsonParser.test.ts
npx tsc --noEmit
npm run lint -- src/lib/canonicalRankingJsonParser.ts src/lib/canonicalRankingJsonParser.test.ts
npm test
npm run lint
```

Expected result:

- Focused parser tests pass with exact raw values, paths, and diagnostic assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- No dependency, database, network, browser, environment-variable, build, or generated-client requirement is introduced.

No Prisma validation, production build, or manual browser QA is required because this slice adds only pure parsing and unit fixtures.

## Acceptance Criteria

- Only preflight-approved Canonical Ranking Set JSON V1 documents are accepted.
- Malformed JSON and non-object roots fail deterministically.
- Recognizable Scenario V1 documents fail as the wrong document type rather than as ranking imports.
- Missing, nonnumeric, and unsupported schema versions fail without coercion.
- Required envelope fields and structural types follow the frozen V1 profile.
- Portable metadata and capability declarations remain available as untrusted located values.
- Every valid entry object produces one ordered record with a stable zero-based source index.
- Every documented present entry value is preserved without trimming, coercion, defaulting, or domain conversion.
- Explicit player IDs survive parsing unchanged.
- Missing and malformed semantic values reach normalization rather than being silently corrected.
- JSON diagnostics and fields use deterministic paths without invented row/column positions.
- Empty entries remain a later domain-validation concern, while the 1,000-record import limit is enforced.
- Parsed output contains no local ranking-set identity, domain ranking set, recommendation, draft, persistence, or UI state.
- Existing Tasks 1 through 3 behavior remains unchanged.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 4 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If the frozen canonical type and format profile disagree about a required envelope field, stop and report the mismatch rather than choosing one silently.
- If Scenario V1 cannot be distinguished with its documented root sections, stop and report the ambiguous fixture rather than accepting it.
- If a JSON value needs semantic interpretation to decide validity, preserve it and defer that decision to Task 5 or Task 6.
- If exact path locations cannot be retained through entry mapping, fix the mapping before accepting the parser output.
- If implementation appears to require a custom JSON tokenizer, report the requirement rather than broadening this slice.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 5: normalize both supported parsed source formats into one source-neutral ranking candidate, including documented fallbacks and capability derivation.

## Slice Review

- Smallest meaningful increment: yes. It adds only the second approved format parser and stops before normalization.
- Executable by a lower-reasoning pass: yes. Envelope rules, semantic mapping, paths, diagnostics, ordering, limits, and tests are explicit.
- Avoids unnecessary architecture changes: yes. It uses the existing generic import contracts and native JSON parser without a schema library or tokenizer.
- Blast radius reasonable: yes. Two parser/test files plus Task 4 and slice-status documentation are expected.
- Review/revert comfort: yes. The adapter is additive and isolated from engines, persistence, scenarios, and UI.
- Observable/testable acceptance criteria: yes. Exact raw values, paths, source indexes, limits, and failures are directly testable.
