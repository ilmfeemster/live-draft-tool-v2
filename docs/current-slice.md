# Current Slice: Tier Semantics Task 5 - Correct FantasyPros Tier Normalization and Conversion

## Completion Status

Complete. Focused tests, the full automated test suite, and TypeScript validation pass.

## Source Context

- Patch project: `docs/patches/tier-semantics-project.md`
- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Completed prerequisite: Task 4 added optional `RankingSet.tierSemantics`, optional `RankingSnapshot.tierSemantics`, and domain validation for source, neutral, recommendation-position, and legacy ambiguous tier semantics.
- Relevant files:
  - `src/types/rankingImport.ts`
  - `src/lib/rankingNormalizer.ts`
  - `src/lib/rankingSetConversion.ts`
  - `src/lib/rankingNormalizer.test.ts`
  - `src/lib/rankingSetConversion.test.ts`
  - `src/lib/rankingImportWorkflow.test.ts`, only for import failure-isolation or warning propagation coverage if needed

Task 5 corrects the FantasyPros import pipeline so FantasyPros `TIERS` are preserved as source-tier metadata while engine-facing `RankingEntry.tier` values become neutral recommendation tiers. This slice must not add repository, export, snapshot, scenario, Recommendation Engine, or UI compatibility behavior; those remain later patch tasks.

## Goal

Make FantasyPros CSV normalization and domain conversion preserve valid `TIERS` as source-overall tier metadata while materializing neutral recommendation tiers for all FantasyPros-derived engine-facing entries.

## Scope

### Goals

- Preserve FantasyPros `TIERS` separately from `NormalizedRankingCandidateEntry.tier` and final `RankingEntry.tier`.
- Treat FantasyPros source tiers as overall/source metadata, not position-local recommendation tiers.
- Materialize neutral recommendation tiers for every represented FantasyPros position.
- Set FantasyPros tier capabilities to align with neutral recommendation semantics.
- Populate final converted `RankingSet.tierSemantics` for FantasyPros imports:
  - `source.kind: "source-overall"` with source-tier values when valid source tiers are supplied;
  - `source.kind: "none"` when FantasyPros tier data is absent;
  - `recommendation[position]: "neutral"` for every represented position.
- Preserve malformed supplied FantasyPros tier failures at the normalization boundary.
- Add focused tests for valid supplied tiers, absent tiers, malformed tiers, conversion output, and import failure isolation.

### Non-Goals

- Do not update ranking-set repository persistence mapping.
- Do not update canonical JSON import/export behavior beyond type-boundary adjustments forced by shared types.
- Do not update snapshot creation, snapshot readers, scenario serialization, or replay behavior.
- Do not change Recommendation Engine scoring or reason generation.
- Do not update UI labels, warnings, or manual QA.
- Do not add user-authored recommendation-tier mapping.
- Do not derive position tiers from rank, position rank, ADP, source tiers, or overall order.
- Do not update `docs/tasks.md`.

## Implementation Steps

1. Inspect the current FantasyPros normalization and conversion contract.

   Review:

   - `src/types/rankingImport.ts`
   - `src/lib/rankingNormalizer.ts`
   - `src/lib/rankingSetConversion.ts`
   - the focused tests for those files

   Current important facts:

   - `NormalizedRankingCandidateEntry.tier` currently carries the normalized FantasyPros `TIER` value.
   - `convertValidatedRankingCandidate` copies candidate `tier` directly into final `RankingEntry.tier`.
   - `RankingSetCapabilities.tiers[position] === "source"` currently means the app sees candidate tiers as non-neutral.
   - Task 4 validation requires neutral recommendation metadata to align with `capabilities.tiers[position] === "defaulted-neutral"`.
   - Real repository persistence of `tierSemantics` is not part of this slice.

2. Add a normalized source-tier carrier.

   In `src/types/rankingImport.ts`, add the smallest candidate-level shape needed to carry FantasyPros source tier values through conversion without changing `RankingEntry`.

   Preferred minimal approach:

   - add optional `sourceTier: number | null` to `NormalizedRankingCandidateEntry`;
   - add `"sourceTier"` to `NormalizedRankingCandidateField` if field-location support is useful for local tests or diagnostics;
   - keep `tier` as the candidate's engine-facing recommendation tier.

   If TypeScript shows a cleaner local shape is needed, preserve these semantics:

   - candidate `tier` means recommendation tier;
   - candidate source tier values are separate;
   - final domain source tier values are built during conversion using final canonical `overallRank`.

3. Update FantasyPros normalization.

   In `src/lib/rankingNormalizer.ts`, update only the FantasyPros path so:

   - valid `TIERS` values populate `sourceTier`;
   - `entry.tier` is always `NEUTRAL_TIER` for FantasyPros entries;
   - every represented FantasyPros position has `capabilities.tiers[position] === "defaulted-neutral"`;
   - when the `TIERS` column is absent for all records, no source-tier values are produced;
   - when the `TIERS` column is present with some valid blanks, preserve the supplied valid source-tier values and keep recommendation tiers neutral;
   - malformed supplied `TIERS` still fail normalization with the existing stable diagnostic code/path behavior;
   - add or reuse a warning/capability note that makes the preserved-but-not-used behavior inspectable through existing import diagnostics.

   Keep team, ADP, identity, order, and position-rank normalization unchanged.

4. Preserve source-tier metadata during conversion.

   In `src/lib/rankingSetConversion.ts`, build `RankingSet.tierSemantics` for FantasyPros-derived candidates.

   Required conversion behavior:

   - sort by source order as today;
   - create final `RankingEntry[]` with `tier: NEUTRAL_TIER` for FantasyPros entries;
   - create `tierSemantics.source.values` from each converted entry with a valid `sourceTier`, using the final canonical `overallRank`;
   - use `source.kind: "source-overall"` when any source-tier values exist;
   - use `source.kind: "none"` when no source-tier values exist;
   - create `tierSemantics.recommendation` entries of `"neutral"` for every represented position;
   - preserve existing final `validateRankingSet` invariant checking.

   Do not add repository or snapshot mapping here. If preserving `tierSemantics` through actual persistence requires repository schema or mapper changes, stop and report that this belongs to Task 6.

5. Keep canonical JSON behavior scoped.

   Do not implement Canonical JSON V2, explicit export semantics, or legacy ambiguous compatibility in this slice.

   If shared type changes force local canonical normalization or conversion adjustments, choose the smallest compatibility-preserving change and keep existing Canonical JSON V1 tests passing. Do not mark old Canonical JSON V1 as corrected or recommendation-eligible in this slice.

6. Update focused tests.

   Update or add tests proving:

   - FantasyPros normalization with valid `TIERS` preserves source tiers separately and sets candidate recommendation tiers to `NEUTRAL_TIER`;
   - FantasyPros normalization with valid `TIERS` reports the preserved-but-neutralized behavior through warnings or candidate metadata;
   - FantasyPros normalization with absent `TIERS` succeeds with no source-tier values and neutral recommendation tiers;
   - malformed supplied FantasyPros `TIERS` still fails at the normalization boundary;
   - conversion from a valid FantasyPros candidate produces neutral `RankingEntry.tier` values and `RankingSet.tierSemantics.source.kind === "source-overall"` when source tiers exist;
   - conversion from a FantasyPros candidate without source tiers produces `source.kind === "none"` and neutral recommendation metadata;
   - import workflow failure isolation still prevents repository writes for malformed supplied `TIERS`;
   - existing Canonical JSON V1 normalization and conversion tests still pass without broad compatibility work.

7. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingImportWorkflow.test.ts
   npx tsc --noEmit
   ```

   If TypeScript shows a narrower affected test set is sufficient because `rankingCandidateValidation` or `rankingImportWorkflow` were not touched, still run the listed tests unless they are clearly unrelated and report the reason for skipping.

8. Finalize the slice.

   If all acceptance criteria and focused validation pass:

   - update `docs/patches/tier-semantics-tasks.md` to mark Task 5 complete;
   - update this file's Completion Status to complete;
   - do not update `docs/tasks.md`.

## Expected Files

- `src/types/rankingImport.ts`
- `src/lib/rankingNormalizer.ts`
- `src/lib/rankingSetConversion.ts`
- `src/lib/rankingNormalizer.test.ts`
- `src/lib/rankingSetConversion.test.ts`
- `src/lib/rankingImportWorkflow.test.ts`, only if needed for failure-isolation or warning propagation coverage
- `docs/patches/tier-semantics-tasks.md`, after validation, to mark Task 5 complete
- `docs/current-slice.md`, after validation, to record completion status

Do not touch these files in this slice unless implementation proves the type change cannot compile without a narrowly scoped adjustment:

- `src/lib/rankingSetRepository.ts`
- `src/lib/canonicalRankingJsonParser.ts`
- `src/lib/canonicalRankingJsonExporter.ts`
- `src/lib/rankingSnapshot.ts`
- `src/lib/recommendationEngine.ts`
- Scenario or replay files
- UI components
- fixtures or data files
- `docs/tasks.md`

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingImportWorkflow.test.ts
npx tsc --noEmit
```

Expected result:

- FantasyPros source tiers are preserved outside engine-facing recommendation tiers.
- FantasyPros engine-facing tiers are neutralized.
- FantasyPros represented positions declare neutral tier capability state.
- FantasyPros malformed supplied tiers still fail before persistence.
- Converted FantasyPros ranking sets pass `validateRankingSet` with explicit tier semantics.
- Existing Canonical JSON V1 tests still pass without implementing Task 6 compatibility behavior.

## Manual QA

No app manual QA is required for this normalization/conversion slice.

Manual review should confirm:

- no Recommendation Engine code changed;
- no repository, export, snapshot, scenario, replay, or UI behavior changed;
- FantasyPros source-tier values are modeled separately from `RankingEntry.tier`;
- new warnings or metadata use existing import diagnostic boundaries.

## Acceptance Criteria

- FantasyPros imports with valid `TIERS` preserve source-tier values before persistence.
- FantasyPros imports with absent `TIERS` succeed with `source.kind: "none"` and neutral recommendation tiers.
- FantasyPros imports with malformed supplied `TIERS` fail without repository writes.
- Converted FantasyPros ranking entries used by engines contain neutral recommendation tiers.
- Converted FantasyPros ranking sets include tier semantics that distinguish source-overall tiers from neutral recommendation tiers.
- Import diagnostics or metadata make the preserved-but-neutralized behavior inspectable.
- Canonical JSON V1 compatibility behavior is not broadened in this slice.
- No repository, export, snapshot, scenario, recommendation, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Focused tests and `npx tsc --noEmit` pass.
- `docs/patches/tier-semantics-tasks.md` marks Task 5 complete only after validation passes.

## Failure Handling

- If preserving FantasyPros source-tier metadata requires repository schema or persistence mapper changes, stop and report that Task 5 needs to be split or coordinated with Task 6.
- If canonical import/export compatibility must change broadly to compile, stop and report that Task 6 should be promoted before or with this work.
- If neutralizing FantasyPros `RankingEntry.tier` requires Recommendation Engine changes, stop and report the conflict because scoring behavior belongs to Task 7.
- If validation fails outside the touched import/conversion surface, report the failure rather than broadening the slice.
- If unrelated worktree changes appear in target files, preserve them and edit around them.

## Follow-Up

After this slice is complete, the next slice should implement Task 6 from `docs/patches/tier-semantics-tasks.md`: preserve ranking-set, export, snapshot, and scenario compatibility so persisted data and portable formats can carry or conservatively neutralize tier semantics.

## Slice Review

- Smallest meaningful increment: yes. This slice corrects FantasyPros normalization and conversion without taking on persistence/export/snapshot compatibility.
- Executable by a lower-reasoning pass: yes. Target files, expected semantics, tests, non-goals, and stop conditions are explicit.
- Avoids unnecessary architecture changes: yes. The existing staged import pipeline remains intact and `RankingEntry[]` remains the engine boundary.
- Blast radius reasonable: yes. Runtime changes should stay in import types, normalizer, and conversion.
- Review/revert comfort: yes. The slice can be reviewed independently from repository/export/snapshot and Recommendation Engine changes.
- Observable/testable acceptance criteria: yes. Focused tests can prove source-tier preservation, neutral recommendation tiers, malformed-tier failure isolation, and TypeScript compatibility.
