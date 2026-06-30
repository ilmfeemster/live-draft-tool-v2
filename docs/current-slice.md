# Current Slice: Tier Semantics Task 4 - Add Domain Tier Semantics and Validation

## Completion Status

Complete. Domain tier semantics, validation, focused tests, and type checking passed.

## Source Context

- Patch project: `docs/patches/tier-semantics-project.md`
- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Completed prerequisite: Task 3, import/export contracts now classify FantasyPros `TIERS` as source-only and Canonical JSON V1 `tier` as legacy ambiguous.
- Relevant domain files:
  - `src/types/rankings.ts`
  - `src/lib/rankingSetValidation.ts`
  - `src/lib/rankingSetValidation.test.ts`

This slice adds the domain model and validation target that later normalization, conversion, persistence, export, snapshot, recommendation, and UI slices will populate. It must not change FantasyPros import behavior or recommendation scoring yet.

## Goal

Extend the ranking domain model and validation rules so source tiers, recommendation tiers, neutral recommendation tiers, and legacy ambiguous tiers can be represented and checked without confusing preserved source information with engine-facing recommendation tier pressure.

## Scope

### Goals

- Add domain-facing tier semantics types in `src/types/rankings.ts`.
- Preserve current `RankingEntry[]` compatibility for the Draft State Engine and Recommendation Engine.
- Keep `RankingEntry.tier` as the engine-facing recommendation-tier value.
- Add optional ranking-set and snapshot metadata that can preserve source tier values separately from `RankingEntry.tier`.
- Add validation for source-tier metadata as source data, not position-local tier-cliff data.
- Add validation for recommendation-tier semantics when a ranking set explicitly claims recommendation eligibility.
- Add validation that neutral recommendation tiers are internally consistent and cannot create tier cliffs.
- Add validation that legacy ambiguous tier metadata remains loadable but is not recommendation-eligible by default.
- Keep existing ranking sets without the new metadata valid until later compatibility and migration slices populate it.
- Add focused tests for domain semantics and validation.

### Non-Goals

- Do not derive position tiers from overall rank, position rank, ADP, or source tiers.
- Do not change FantasyPros normalization or domain conversion.
- Do not update repositories, persistence mappers, snapshots, scenario serialization, canonical import/export mapping, Recommendation Engine scoring, UI components, or data files.
- Do not rename or remove `RankingEntry.tier`.
- Do not rename the existing `capabilities.tiers` states in this slice unless required to keep validation coherent.
- Do not materialize neutral tiers during import in this slice.
- Do not update `docs/tasks.md`.
- Do not mark Task 4 complete unless focused validation passes.

## Implementation Steps

1. Inspect the current domain contract.

   Review `src/types/rankings.ts` and `src/lib/rankingSetValidation.ts`.

   Current important facts:

   - `RankingEntry.tier` is a required positive number consumed by existing engine-facing ranking arrays.
   - `RankingSetCapabilities.tiers` currently uses `"source" | "defaulted-neutral"`.
   - `validateRankingSet` currently validates every `entry.tier` as positive and non-decreasing within position, regardless of semantic provenance.
   - Existing callers and tests expect ranking sets without any explicit source-tier metadata to remain valid.

2. Add domain tier semantics types.

   In `src/types/rankings.ts`, add small explicit types aligned with `docs/design/tier-semantics.md`.

   The domain model must be able to represent:

   - no source tier data;
   - source-overall tier data;
   - legacy ambiguous source tier data;
   - neutral recommendation tiers;
   - recommendation-position tiers.

   Prefer a narrow metadata shape rather than changing `RankingEntry`:

   - source tier values should be preserved outside `RankingEntry.tier`;
   - recommendation-tier state should describe the meaning of `RankingEntry.tier`;
   - `RankingSet` and `RankingSnapshot` should be able to carry the metadata;
   - absence of the new metadata should remain a compatibility state for existing in-memory tests until Task 6.

   Suggested shape, adjustable if the implementation finds a simpler equivalent:

   ```ts
   export type RankingSourceTierSemantics =
     | "none"
     | "source-overall"
     | "legacy-ambiguous";

   export type RankingRecommendationTierSemantics =
     | "neutral"
     | "recommendation-position";

   export type RankingSourceTierValue = Readonly<{
     playerId: string;
     overallRank: number;
     tier: number;
   }>;

   export type RankingTierSemantics = Readonly<{
     source: Readonly<{
       kind: RankingSourceTierSemantics;
       values?: readonly RankingSourceTierValue[];
     }>;
     recommendation: Readonly<Partial<Record<Position, RankingRecommendationTierSemantics>>>;
   }>;
   ```

   If this shape is revised during implementation, preserve the same capabilities and keep the blast radius local.

3. Extend ranking set and snapshot types.

   Add optional `tierSemantics?: RankingTierSemantics` to `RankingSet` and `RankingSnapshot`.

   Do not add parser, repository, or UI values yet. This slice establishes the domain target and validation rules only.

4. Add source-tier metadata validation.

   In `src/lib/rankingSetValidation.ts`, validate `rankingSet.tierSemantics` only when present.

   Source-tier validation should ensure:

   - the source metadata shape is valid;
   - `source.kind: "none"` has no source-tier values;
   - `source.kind: "source-overall"` and `source.kind: "legacy-ambiguous"` may carry values;
   - every source-tier value has a non-empty `playerId`, positive integer `overallRank`, and positive integer `tier`;
   - source-tier values reference existing canonical entries by player ID and overall rank;
   - source-tier values do not need to be position-local, contiguous, gapless, or non-decreasing within position.

   Use stable `invalid-capability` or `invalid-tier` errors unless a new error code is necessary. Prefer paths under `tierSemantics.source`.

5. Add recommendation-tier semantics validation.

   Validate the `recommendation` metadata only when `tierSemantics` is present.

   Recommendation-tier validation should ensure:

   - recommendation metadata is an object keyed only by supported represented positions;
   - every represented position has an explicit recommendation semantic when `tierSemantics` is present;
   - absent positions do not have recommendation metadata;
   - `"neutral"` positions have every `RankingEntry.tier` equal to `NEUTRAL_TIER`;
   - `"recommendation-position"` positions rely on the existing positive, position-local, non-decreasing `RankingEntry.tier` validation;
   - legacy ambiguous source metadata does not allow recommendation-position eligibility by default.

   Keep existing `capabilities.tiers` validation. If `tierSemantics` is present, also check that:

   - `recommendation: "neutral"` aligns with `capabilities.tiers[position] === "defaulted-neutral"`;
   - `recommendation: "recommendation-position"` aligns with the existing non-neutral capability state used by the app today.

6. Update validation tests.

   In `src/lib/rankingSetValidation.test.ts`, add focused tests proving:

   - valid source-overall tier metadata accepts overall-board tier values without requiring position-local progression;
   - source-tier metadata with malformed, duplicate, or unknown entry references fails with stable paths;
   - valid neutral recommendation metadata requires neutral `RankingEntry.tier` values for the affected position;
   - neutral recommendation metadata rejects non-neutral tier values;
   - recommendation-position metadata accepts complete position-local non-decreasing tiers;
   - recommendation-position metadata rejects decreasing tiers through the existing entry-tier rule;
   - legacy ambiguous source metadata remains loadable only with neutral recommendation metadata;
   - existing ranking sets without `tierSemantics` still validate to preserve compatibility before Task 6.

   Do not update parser, normalizer, conversion, repository, snapshot, scenario, recommendation, or UI tests unless TypeScript forces a local type-boundary adjustment. If broader updates are needed, stop and report that Task 4 needs to be split.

7. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/rankingSetValidation.test.ts
   npx tsc --noEmit
   ```

   If TypeScript shows the new optional metadata affects adjacent pure domain helpers, run the smallest directly affected tests and report them.

8. Finalize the slice.

   If all acceptance criteria and focused validation pass:

   - update `docs/patches/tier-semantics-tasks.md` to mark Task 4 complete;
   - update this file's Completion Status to complete;
   - do not update `docs/tasks.md`.

## Expected Files

- `src/types/rankings.ts`
- `src/lib/rankingSetValidation.ts`
- `src/lib/rankingSetValidation.test.ts`
- `docs/patches/tier-semantics-tasks.md`, after validation, to mark Task 4 complete
- `docs/current-slice.md`, after validation, to record completion status

Do not touch these files in this slice unless implementation proves the type change cannot compile without a narrowly scoped adjustment:

- `src/types/draft.ts`
- `src/lib/rankingNormalizer.ts`
- `src/lib/rankingSetConversion.ts`
- `src/lib/rankingSetRepository.ts`
- `src/lib/rankingSnapshot.ts`
- `src/lib/recommendationEngine.ts`
- UI components
- fixtures or data files
- `docs/tasks.md`

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingSetValidation.test.ts
npx tsc --noEmit
```

Expected result:

- Domain types can represent source tiers and recommendation tiers independently.
- Source-tier metadata validates as source data rather than position-tier cliff data.
- Neutral recommendation metadata requires neutral engine-facing tier values.
- Recommendation-position metadata requires complete position-local valid tier values.
- Legacy ambiguous tier metadata is represented without becoming recommendation-eligible by default.
- Existing ranking sets without explicit tier semantics remain valid for compatibility.
- Existing Draft State and Recommendation Engine `RankingEntry[]` boundaries still compile.

## Manual QA

No app manual QA is required for this domain-validation slice.

Manual review should confirm:

- no recommendation scoring behavior changed;
- no import normalization behavior changed;
- no repository, snapshot, scenario, or UI behavior changed;
- source-tier values are modeled separately from `RankingEntry.tier`.

## Acceptance Criteria

- Domain values can represent source tiers and recommendation tiers independently.
- Neutral recommendation tiers are internally consistent and cannot produce tier cliffs.
- Legacy ambiguous tiers are represented without making them recommendation-eligible.
- Recommendation-eligible tiers require complete, position-local, non-decreasing data.
- Source tiers are validated as source metadata and not as position-local recommendation tiers.
- Existing draft and recommendation boundaries still compile against canonical `RankingEntry[]`.
- No FantasyPros normalization, domain conversion, persistence, snapshot, scenario, recommendation, UI, dependency, data-file, or `docs/tasks.md` changes are introduced.
- Focused tests and `npx tsc --noEmit` pass.
- `docs/patches/tier-semantics-tasks.md` marks Task 4 complete only after validation passes.

## Failure Handling

- If adding optional domain metadata requires broad repository, snapshot, export, scenario, or UI changes, stop and report that Task 4 needs to be split.
- If `RankingEntry` must change to preserve source tier values, stop and report the conflict before editing `src/types/draft.ts`.
- If legacy compatibility conflicts with strict new metadata validation, keep metadata optional in this slice and defer migration behavior to Task 6.
- If tests fail outside the touched domain surface, report the failure rather than broadening the slice.
- If unrelated worktree changes appear in target files, preserve them and edit around them.

## Follow-Up

After this slice is complete, the next slice should implement Task 5 from `docs/patches/tier-semantics-tasks.md`: correct FantasyPros tier normalization and domain conversion so FantasyPros `TIERS` populate source-tier metadata while engine-facing recommendation tiers become neutral.

## Slice Review

- Smallest meaningful increment: yes. This slice adds only domain semantics and validation before import/conversion behavior changes.
- Executable by a lower-reasoning pass: yes. Target files, suggested types, validation rules, tests, and non-goals are explicit.
- Avoids unnecessary architecture changes: yes. The existing `RankingEntry[]` engine boundary remains intact.
- Blast radius reasonable: yes. Expected runtime files are limited to domain types and domain validation.
- Review/revert comfort: yes. Domain metadata and validation can be reviewed independently from persistence, export, snapshot, recommendation, and UI behavior.
- Observable/testable acceptance criteria: yes. Focused validation tests and TypeScript prove the new domain boundary.
