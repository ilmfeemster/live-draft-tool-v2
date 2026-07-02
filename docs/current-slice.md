# Current Slice: Preserve Persisted Recommendation Context Results

## Completion Status

Complete. Recommendation-context result contracts now live at the shared domain boundary, persisted draft workspace mapping preserves the normalizer's success-or-failure result, complete and neutral source-tier contexts hydrate correctly, and Phase 5-valid partial source tiers remain loadable as structured Phase 5.5 failures. Focused validation passed with 2 test files and 34 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning. Task 2 remains incomplete pending Draft Room and transient workflow propagation.

## Goal

Preserve the Phase 5.5 recommendation-context normalization result when a persisted draft workspace is hydrated, so valid snapshot context is available to later recommendation work while historical drafts with unusable partial tier metadata still load without guessed boundaries.

This is the first focused increment of Task 2. It does not yet pass the context into Draft Room or transient scenario recommendation callers.

## Scope

### Goals

- Make the recommendation-context success/failure result a domain-facing type rather than a type owned only by its normalizer module.
- Allow a `DraftWorkspace` to carry the recommendation-context normalization result.
- Normalize the parsed immutable ranking snapshot exactly once while mapping a persisted draft record.
- Preserve successful complete source-overall context through workspace hydration.
- Preserve the documented all-one neutral fallback for array-only, absent, `none`, and legacy-ambiguous source semantics.
- Keep persisted drafts loadable when their Phase 5-valid snapshot contains partial source-overall metadata that Phase 5.5 cannot safely score.
- Preserve structured normalization failures in the workspace instead of throwing, guessing tiers, or returning partial context.
- Leave all existing draft, ranking, persistence, and recommendation behavior unchanged.

### Non-Goals

- Do not pass recommendation context into `DraftRoom`, `RecommendationInput`, or scoring functions.
- Do not change recommendation scores, ordering, components, caps, evidence, or reasons.
- Do not update transient manual or Scenario V1 sessions yet.
- Do not change ranking-set validation, snapshot parsing, snapshot serialization, repository schemas, or Prisma.
- Do not reject draft loading because Phase 5.5 context normalization fails.
- Do not silently default partially supplied source-overall tiers.
- Do not add UI error handling, scenario versioning, or dependencies.

## Compatibility Decision

Phase 5 permits a persisted snapshot to preserve partial source-tier metadata. Phase 5.5 requires complete source-overall coverage before those tiers may influence recommendations. These requirements are reconciled at the workspace boundary:

- snapshot parsing and draft hydration continue to succeed for Phase 5-valid data;
- recommendation-context normalization returns its existing structured failure for partial or otherwise unusable Phase 5.5 tier metadata;
- the workspace carries that result for a later application boundary to handle;
- no partial context is exposed and no tier boundary is invented;
- historical array-only or tier-absent snapshots normalize successfully through the neutral all-one fallback.

## Implementation Decisions

- Move `RecommendationRankingContextErrorCode`, `RecommendationRankingContextError`, and `RecommendationRankingContextResult` into `src/types/draft.ts` beside the context types they describe.
- Re-export those types from `src/lib/recommendationRankingContext.ts` so existing imports remain compatible and the normalizer continues owning only behavior.
- Add an optional `recommendationRankingContextResult` field to `DraftWorkspace`.
  - Persisted workspace mapping must always populate it.
  - It remains optional at this stage because existing manual and transient workspace constructors do not yet carry snapshot semantics; the follow-up Task 2 slice will propagate context to those callers.
- In `mapDraftRecordToWorkspace`, parse the ranking snapshot once, normalize that parsed value once, and return the result with the existing draft, rankings, and league settings.
- Do not throw when normalization returns `{ ok: false }`; the structured result is data for the later recommendation application boundary.
- Continue throwing for invalid persisted snapshot JSON, invalid league settings, or invalid pick history through their existing validation paths.
- Do not rerun normalization from the flattened `workspace.rankings`, because that would discard snapshot tier semantics.

## Implementation Steps

1. Move context result contracts to the shared domain type boundary.

   In `src/types/draft.ts`:

   - add the four existing normalization error codes;
   - add the readonly error type with stable code, path, and message;
   - add the success/failure result union around `RecommendationRankingContext`;
   - add optional `recommendationRankingContextResult` to `DraftWorkspace`;
   - keep all types independent of snapshots, repositories, React, Prisma, and import formats.

   In `src/lib/recommendationRankingContext.ts`:

   - consume the shared result/error types instead of declaring duplicates;
   - re-export the moved types for compatibility with existing callers and tests;
   - do not change normalization behavior.

2. Preserve normalization results during persisted workspace mapping.

   In `src/lib/draftRepositoryMapping.ts`:

   - normalize the already-parsed `RankingSnapshot` before flattening its ranking entries into the existing workspace field;
   - include the success-or-failure result as `recommendationRankingContextResult` in the returned workspace;
   - preserve the existing canonical ranking copies, league settings, draft hydration, and pick-history behavior;
   - do not catch or reclassify existing parse and hydration errors.

3. Add focused mapping coverage.

   In `src/lib/draftRepositoryMapping.test.ts`:

   - assert an array-only historical snapshot produces a successful all-one `defaulted-neutral` context;
   - assert a V2 snapshot with complete source-overall values produces exact `source` overall-tier facts;
   - assert complete, partial, and absent ADP remain represented exactly in successful mapped context;
   - add a Phase 5-valid V2 snapshot with partial source-overall values and assert the workspace still loads with a structured `partial-overall-tiers` failure and no partial context;
   - retain existing coverage for recommendation-tier preservation, invalid snapshot JSON, league settings, pick history, and draft invariants;
   - verify mapping does not mutate serialized snapshot inputs.

4. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/recommendationRankingContext.test.ts src/lib/draftRepositoryMapping.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because this slice does not expose the context to user-facing behavior.

5. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Leave Task 2 unchecked because Draft Room and transient workflow propagation remain outstanding.
   - Stop without beginning the follow-up Task 2 slice or any scoring work.

## Expected Files

Production:

- `src/types/draft.ts`
- `src/lib/recommendationRankingContext.ts`
- `src/lib/draftRepositoryMapping.ts`

Focused tests:

- `src/lib/draftRepositoryMapping.test.ts`

Planning and completion record:

- `docs/current-slice.md`

Do not touch Draft Room, page props, actions, recommendation scoring, scenario sessions, ranking import, snapshot serialization, repositories, Prisma, dependencies, project scope, architecture, roadmap, or `docs/tasks.md` in this slice.

## Acceptance Criteria

- Persisted workspace mapping always includes a recommendation-context normalization result.
- Complete source-overall snapshot metadata produces exact normalized tiers with `source` origin.
- Array-only, absent, `none`, and legacy-ambiguous tier semantics produce one neutral overall tier with `defaulted-neutral` origin.
- Complete, partial, and entirely absent ADP remain supported and preserve each player's exact nullable value.
- A Phase 5-valid snapshot with partial source-overall metadata still loads its draft workspace and carries a structured Phase 5.5 normalization failure.
- Failed normalization exposes no partial recommendation context and does not invent tier boundaries.
- Invalid persisted JSON, league settings, and pick history retain their existing failure behavior.
- Existing draft hydration, canonical rankings, picks, invariants, and repository behavior remain unchanged.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If moving the result contracts creates a type cycle, stop and report rather than importing library behavior into `src/types/draft.ts`.
- If persisted mapping cannot carry a structured failure without changing repository or action contracts, stop and report before throwing on context failure or broadening this slice.
- If partial source-overall metadata is rejected by the existing snapshot parser before normalization, stop and report the discrepancy rather than weakening snapshot validation.
- If focused validation exposes unrelated failures, report them without changing out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, plan the remaining Task 2 propagation slice: pass the preserved result through page and Draft Room boundaries, then establish the corresponding neutral context for transient manual and Scenario V1 sessions. Do not begin that work automatically.

Task 3 overall-tier scoring must remain blocked until Task 2 propagation is complete.

## Slice Review

- Smallest meaningful increment: yes. It preserves the context result at the first boundary that currently discards snapshot semantics while retaining historical draft loadability.
- Executable by a lower-reasoning pass: yes. The moved types, workspace field, mapping behavior, compatibility rule, expected files, and tests are explicit.
- Avoids unnecessary architecture changes: yes. It reuses the existing normalizer and snapshot envelope without changing persistence or scoring.
- Blast radius reasonable: yes. Runtime changes are limited to three production files and one focused existing test file.
- Review/revert comfort: yes. The new workspace field is additive and no recommendation caller consumes it yet.
- Observable/testable acceptance criteria: yes. Success, fallback, structured failure, compatibility, and non-mutation behavior are directly testable at the mapping boundary.
