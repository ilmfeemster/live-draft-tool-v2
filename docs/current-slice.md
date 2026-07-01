# Current Slice: Tier Semantics Patch Slice 1 - Canonical Ranking JSON Compatibility

## Completion Status

Planned. Awaiting implementation approval.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 1.
- Approved design: `docs/design/tier-semantics.md`, especially Canonical Ranking Set JSON and export compatibility.
- Project constraints: `docs/project.md` and `docs/decisions.md` preserve deterministic staged imports, mutable ranking sets, immutable draft snapshots, and conservative legacy compatibility.
- Completed prerequisites:
  - import contracts define source-tier and recommendation-tier concepts;
  - `RankingSet.tierSemantics` preserves source values separately from engine-facing recommendation tiers;
  - FantasyPros conversion materializes neutral recommendation tiers;
  - persisted ranking-set compatibility neutralizes legacy ambiguous tiers;
  - neutral recommendation tiers produce no score component or reason.
- Current Canonical JSON facts:
  - transport preflight selects `canonical-ranking-json` format version 1;
  - document `schemaVersion: 1` stores one ambiguous entry-level `tier` value;
  - V2 document types already sketch separate `sourceTier` and `recommendationTier` values plus explicit top-level semantics;
  - the executable exporter still writes V1;
  - the parser accepts only V1;
  - canonical V1 normalization currently forwards ambiguous `tier` values as engine-facing recommendation tiers.

## Goal

Export new canonical ranking documents with explicit tier semantics and round-trip them through the existing staged import workflow, while keeping Canonical Ranking Set JSON V1 readable with its ambiguous tiers preserved as legacy metadata and neutralized for recommendations.

## Scope

### Goals

- Make Canonical Ranking Set JSON V2 the only shape emitted by new exports.
- Keep `canonical-ranking-json` transport format version 1; use document `schemaVersion` to dispatch V1 versus V2.
- Preserve source-tier values, source-tier meaning, recommendation-tier values, and per-position recommendation eligibility across V2 export and re-import.
- Keep V1 parsing available and classify its lone `tier` field as legacy ambiguous.
- Preserve V1 tier numbers as legacy source metadata where possible, but materialize `NEUTRAL_TIER` for every engine-facing V1 entry.
- Validate V2 tier-semantics metadata and entry fields through stable staged diagnostics.
- Preserve import atomicity: malformed V2 input must not create or replace a stored ranking set.
- Preserve deterministic property order, entry order, UTF-8 byte limits, entry limits, source provenance, and local-identity behavior.

### Non-Goals

- Do not change FantasyPros CSV behavior.
- Do not derive recommendation tiers from source tiers, overall rank, position rank, or ADP.
- Do not add a new transport-format selector, runtime plugin system, or generic migration framework.
- Do not change ranking-set persistence schema or repository mapping.
- Do not change draft snapshot, Scenario V1, replay, recommendation scoring, or UI behavior.
- Do not rewrite existing files or database rows.
- Do not update dependencies, data files, `docs/tasks.md`, or documentation outside the two patch tracking files named in the finalization step.

## Canonical V2 Contract Decisions

- Continue passing `formatId: "canonical-ranking-json"` and `formatVersion: 1` through preflight. The JSON envelope's `schemaVersion` is authoritative for V1/V2 parsing.
- Emit `schemaVersion: 2` with root fields in this deterministic order:
  1. `schemaVersion`
  2. `metadata`
  3. `tierSemantics`
  4. `capabilities`
  5. `entries`
- Each V2 entry contains `player`, `overallRank`, `positionRank`, `sourceTier`, `recommendationTier`, and `adpRank`; it never contains the ambiguous `tier` field.
- Map domain source semantics as follows:
  - `source-overall` -> `sourceTier: { kind: "source-only", sourceScope: "overall", recommendationEligible: false }`;
  - `legacy-ambiguous` -> `sourceTier: { kind: "legacy-ambiguous", sourceScope: "unknown", recommendationEligible: false }`;
  - `none` -> `sourceTier: { kind: "absent", sourceScope: "unknown", recommendationEligible: false }`.
- The V2 `recommendationTier` contract declares that the entry field is position-scoped. Per-position eligibility comes from the existing tier capability together with `RankingSet.tierSemantics.recommendation`:
  - represented positions marked `recommendation-position` preserve their canonical entry tier and import as recommendation-eligible;
  - represented positions marked `neutral` export and import as `NEUTRAL_TIER` with `defaulted-neutral` capability;
  - absent or contradictory eligibility metadata is invalid rather than inferred from a number.
- For a domain set with missing tier semantics, export conservatively as legacy ambiguous: preserve its existing entry tiers in `sourceTier`, emit neutral `recommendationTier` values, and mark every represented position neutral. Never promote missing metadata to recommendation eligibility.
- V1 import maps each legacy `tier` value to legacy ambiguous source metadata and sets the candidate's recommendation tier to `NEUTRAL_TIER`. Its imported tier capabilities are neutralized for represented positions even if the V1 capability object claimed source tiers.

## Implementation Steps

1. Complete the shared canonical handoff types.

   In `src/types/rankingImport.ts`:

   - retain the existing V1 and V2 portable document types;
   - add the smallest source-neutral normalized tier-semantics handoff needed to carry source kind and per-position recommendation eligibility from normalization to conversion;
   - add that optional handoff to `NormalizedRankingCandidate`;
   - do not place parsed records or portable document objects on `RankingSet`.

2. Dispatch and map canonical V1 and V2 documents.

   In `src/lib/canonicalRankingJsonParser.ts`:

   - accept document `schemaVersion` 1 and 2 under the existing canonical transport format;
   - retain the Scenario V1 wrong-document guard and existing envelope/entry-count checks;
   - keep the V1 mapping isolated: map entry `tier` to the source-tier field and attach legacy-ambiguous semantics;
   - for V2, require an object `tierSemantics` envelope field and map entry `sourceTier` and `recommendationTier` separately;
   - preserve exact field locations such as `tierSemantics.recommendationTier` and `entries[n].sourceTier` for downstream diagnostics;
   - reject unsupported schema versions with the existing stable `unsupported-schema-version` category and a message listing 1 and 2;
   - reject structurally malformed V2 envelopes or non-object entries at parse stage without attempting normalization.

3. Normalize explicit V2 semantics and neutralize V1.

   In `src/lib/rankingNormalizer.ts`:

   - branch canonical normalization by parsed schema version rather than by a new transport format;
   - validate the V2 source and recommendation semantic contracts, including allowed kind, scope, and `recommendationEligible` combinations;
   - validate `sourceTier` as nullable or a positive integer and `recommendationTier` as a positive integer;
   - derive per-position recommendation eligibility only from the explicit V2 semantics plus the existing tier capability for that position;
   - require neutral positions to contain only `NEUTRAL_TIER` and require recommendation-eligible positions to remain eligible for normal canonical/domain tier validation;
   - normalize V1 legacy tiers into `sourceTier`, set engine-facing `tier` to `NEUTRAL_TIER`, set represented tier capabilities to `defaulted-neutral`, and attach legacy-ambiguous source semantics;
   - return stable `normalize` diagnostics with exact field paths for malformed or contradictory semantics;
   - preserve all non-tier canonical name, provenance, capability, entry, and warning behavior.

4. Convert normalized canonical semantics without format-specific inference.

   In `src/lib/rankingSetConversion.ts`:

   - replace the current `isFantasyProsCandidate` inference with the explicit normalized tier-semantics handoff;
   - build `RankingSet.tierSemantics.source.values` from validated source-tier values using canonical player IDs and overall ranks;
   - copy the normalized per-position recommendation semantic map;
   - use the normalized entry `tier` as the engine-facing recommendation tier; do not derive it from `sourceTier`;
   - preserve the current FantasyPros result through the same generalized path;
   - let existing conversion/domain validation reject invalid recommendation-tier ordering or capability mismatches before persistence.

5. Emit deterministic Canonical Ranking Set JSON V2.

   In `src/lib/canonicalRankingJsonExporter.ts`:

   - change the successful export value to `CanonicalRankingSetDocumentV2`;
   - map explicit domain tier semantics using the contract decisions above;
   - use `null` when an entry has no source-tier value;
   - emit recommendation tiers only according to explicit per-position eligibility, otherwise emit `NEUTRAL_TIER`;
   - apply the conservative legacy fallback when the domain set has no tier-semantics metadata;
   - retain domain validation, entry and byte limits, source identity option, deep-copy behavior, and deterministic JSON serialization;
   - do not retain a V1 export option.

6. Add focused parser and normalizer coverage.

   In `src/lib/canonicalRankingJsonParser.test.ts` and `src/lib/rankingNormalizer.test.ts`, prove:

   - representative V2 fields and their locations map correctly;
   - V1 remains readable and becomes legacy ambiguous plus recommendation-neutral;
   - malformed/missing V2 tier metadata, unsupported semantic combinations, invalid source tiers, and invalid recommendation tiers return ordered stable diagnostics;
   - Scenario V1 remains distinguishable;
   - unsupported document schema versions still fail deterministically;
   - existing non-tier V1 parser and canonical normalization behavior remains intact.

7. Replace V1 exporter expectations with V2 round-trip coverage.

   In `src/lib/canonicalRankingJsonExporter.test.ts`, prove:

   - exact compact V2 output and frozen property order;
   - V2 output contains no ambiguous entry-level `tier` field;
   - source-only FantasyPros semantics round-trip with source values preserved and recommendation tiers neutral;
   - explicit recommendation-position semantics and values round-trip unchanged;
   - mixed represented positions preserve their individual eligible/neutral states;
   - missing domain semantics export through the conservative legacy-ambiguous fallback and re-import neutral;
   - degraded capabilities, source identity, deterministic copies, byte limits, entry limits, and invalid-domain failures retain their existing behavior.

8. Prove atomic workflow behavior.

   In `src/lib/rankingImportWorkflow.test.ts`, add one focused replacement test that starts with an existing set, submits malformed V2 tier metadata, and proves:

   - the failure retains its parse or normalize stage and stable diagnostic path;
   - `replaceRankingSet` is not called;
   - the existing stored set is unchanged.

   Also update the existing canonical create fixture to V2 while retaining one explicit V1 create compatibility test.

9. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingImportPreflight.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
   npx tsc --noEmit
   ```

   Preflight coverage is regression-only: its canonical transport selector remains version 1 while document schema dispatch moves into the parser.

10. Finalize the slice after validation.

   If focused validation passes:

   - update this file's Completion Status to complete;
   - mark only Slice 1 complete in `docs/patches/tier-semantics-tasks.md`;
   - record the exact validation commands and results in the patch task file if its completed-validation section is maintained;
   - do not update `docs/tasks.md` or begin snapshot work automatically.

## Expected Files

Production and contract files:

- `src/types/rankingImport.ts`
- `src/lib/canonicalRankingJsonParser.ts`
- `src/lib/rankingNormalizer.ts`
- `src/lib/rankingSetConversion.ts`
- `src/lib/canonicalRankingJsonExporter.ts`

Focused tests:

- `src/lib/canonicalRankingJsonParser.test.ts`
- `src/lib/rankingNormalizer.test.ts`
- `src/lib/canonicalRankingJsonExporter.test.ts`
- `src/lib/rankingImportWorkflow.test.ts`

Tracking after successful implementation:

- `docs/current-slice.md`
- `docs/patches/tier-semantics-tasks.md`

Do not touch:

- `src/lib/rankingImportPreflight.ts` unless implementation proves schema dispatch cannot remain parser-local; stop and report that conflict before changing it.
- ranking repository production files or Prisma schema/migrations.
- draft snapshot, draft repository, Scenario V1, replay, recommendation, or UI files.
- `docs/tasks.md`.

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingImportPreflight.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
npx tsc --noEmit
```

Expected result:

- New exports are deterministic Canonical Ranking Set JSON V2 documents.
- V2 export/re-import preserves explicit source and recommendation tier semantics.
- Legacy V1 remains importable but cannot create recommendation-tier pressure.
- Malformed V2 semantics fail before persistence and cannot replace stored data.
- FantasyPros CSV, format preflight, validation, conversion, and workflow regressions remain green.

## Manual QA

No browser QA is required for this format-boundary slice.

Manual code review should confirm:

- new exports contain no ambiguous lone `tier` field;
- V1 compatibility never upgrades legacy values into recommendation eligibility;
- `sourceTier` never directly populates the engine-facing tier;
- per-position eligibility is copied from explicit semantics rather than inferred from tier numbers;
- no persistence, snapshot, scenario, recommendation, or UI boundary changed.

## Acceptance Criteria

- A new canonical export and re-import preserve explicit source-tier values and meaning.
- A new canonical export and re-import preserve recommendation-tier values and per-position eligibility/neutralization.
- New canonical documents use `schemaVersion: 2` and do not rely on an ambiguous lone `tier` field.
- Legacy Canonical Ranking Set JSON V1 documents remain importable.
- Legacy V1 tier values are preserved as legacy ambiguous metadata where practical and are materialized as neutral engine-facing tiers.
- V1 imports cannot create recommendation-tier pressure by default.
- Malformed or contradictory V2 tier metadata fails with stable staged diagnostics and exact locations.
- Failed V2 replacement imports do not call the repository replacement operation or mutate stored data.
- Canonical ranking documents remain distinct from Scenario V1 documents.
- Deterministic ordering, identity rules, source provenance, byte limits, entry limits, and non-tier canonical behavior remain unchanged.
- Required focused tests and `npx tsc --noEmit` pass.
- No persistence, snapshot, Scenario V1, replay, recommendation, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.

## Failure Handling

- If the existing V2 type shape cannot represent a currently valid `RankingSet.tierSemantics` state without loss, stop and report the exact state rather than silently flattening eligibility.
- If V2 requires changing the external transport `formatVersion`, stop and report the preflight/UI compatibility impact before broadening scope.
- If V1 source-tier preservation violates an existing canonical invariant, retain loadability and neutral recommendation behavior, then report the metadata limitation rather than restoring ambiguous pressure.
- If malformed V2 input reaches repository create or replace, fix only the staged import boundary responsible; do not add repository-format validation.
- If focused failures are unrelated to canonical tier semantics, report them rather than changing other workflows.
- Preserve unrelated worktree changes and report any unsafe overlap.

## Follow-Up

After this slice is implemented and validated, the next slice is Tier Semantics Patch Slice 2 - New Draft Snapshot Semantics. It should persist and hydrate explicit tier semantics in newly created immutable snapshots while retaining conservative legacy snapshot behavior. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. Export and import are kept together because the user-visible portable format must round-trip safely; either half alone is incomplete.
- Executable by a lower-reasoning pass: yes. Version dispatch, exact compatibility behavior, semantic mappings, files, tests, and failure rules are explicit.
- Avoids unnecessary architecture changes: yes. It extends the existing staged import handoff and versioned document contract without a new format selector, repository rule, or migration system.
- Blast radius reasonable: yes, with a documented exception to the five-file preference. The five production/contract files are the existing contiguous parse-normalize-convert-export boundary; additional changes are focused tests and tracking only.
- Review/revert comfort: yes. No persistence schema, snapshot, scenario, scoring, or UI change is included.
- Observable/testable acceptance criteria: yes. Exact JSON, round trips, diagnostics, neutralization, and repository call counts are directly assertable.
