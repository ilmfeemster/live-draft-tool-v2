# Current Slice: Tier Semantics Patch Slice 5 - Regression Coverage and Patch Exit Validation

## Completion Status

Planned and awaiting implementation approval. Tier Semantics Patch Slices 1 through 4 are implemented. Slice 4B focused validation passed (4 files, 13 tests), TypeScript no-emit validation passed, lint reported only the recorded pre-existing unused-helper warning, and the user confirmed the remaining draft-workflow QA passed.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 5.
- Approved design: `docs/design/tier-semantics.md`.
- Active Phase 5 exit task: `docs/tasks.md`, Task 20.
- Existing QA record: `docs/qa/manual-phase-5-qa.md`.
- Completed tier-semantics behavior:
  - FantasyPros `TIERS` are preserved as source-overall metadata and materialize neutral engine-facing recommendation tiers;
  - explicit Canonical Ranking JSON and new snapshot semantics round-trip without conflating source and recommendation tiers;
  - legacy ranking sets, Canonical V1 files, snapshots, and Scenario V1 inputs remain usable with conservative recommendation-neutral behavior;
  - neutral tiers produce no tier-cliff score component or reason, while explicitly eligible engine inputs retain bounded positive tier pressure;
  - ranking-management and draft-workflow UI no longer calls imported source tiers position tiers or presents neutral sentinels as authored tier data;
  - canonical JSON exports are readable, deterministic, and covered by focused round-trip tests.
- Slice 4A and 4B automated validation passed, and the user confirmed their manual UI QA passed.
- `docs/qa/manual-phase-5-qa.md` still records an earlier blocked browser run and contains a stale instruction to update a position-tier assignment through UI that no longer exists.
- Phase 5 Task 20 is broader than this patch. Closing the tier-semantics patch must not mark the full Phase 5 exit task complete unless every separate Phase 5 criterion and manual workflow has also been verified.

## Goal

Prove every supported ranking-to-recommendation path obeys the corrected tier semantics, record the completed tier-specific QA, and close the tier-semantics patch without adding behavior or prematurely closing the broader Phase 5 exit gate.

## Scope

### Goals

- Run the focused tier-semantics regression matrix across import, canonical portability, domain validation, persistence, snapshots, recommendations, Scenario V1, and UI.
- Run the full automated project suite and required static/build validation.
- Verify the Prisma schema is valid and the tier-semantics migration is applied in the configured QA database.
- Complete or confirm the tier-specific manual ranking-to-draft workflow.
- Correct the stale tier-related item in the Phase 5 QA checklist and record tier-patch evidence separately from the broader Phase 5 result.
- Mark patch Slices 4 and 5 complete only after every tier-specific gate passes.
- Record the patch as complete in active task documentation while leaving Phase 5 Task 20 pending.

### Non-Goals

- Do not add or change production behavior during exit validation.
- Do not add tests merely to increase coverage or duplicate an already-protected boundary.
- Do not weaken, delete, or broadly rewrite assertions to make a gate pass.
- Do not derive position tiers, add manual recommendation-tier authoring, tune recommendation weights, or add recommendation factors.
- Do not rewrite historical data or reset the database.
- Do not mark Phase 5 Task 20 complete solely because this patch passes.
- Do not begin the next Phase 5 or roadmap slice automatically.

## Exit Decisions

- Existing focused suites from Slices 1 through 4 already cover every known supported tier-semantics boundary. This slice plans no source or test edits by default.
- A failing gate is diagnostic evidence, not permission for broad cleanup. Fix only a small defect caused by the tier patch when the correction remains inside the failed boundary; otherwise stop and plan a corrective slice.
- The full suite is required after focused suites so boundary-specific failures remain easy to locate.
- `npm run prisma:validate` proves schema validity. `npx prisma migrate status` proves the configured QA database has the existing `tierSemantics` migration; it must not create, reset, or rewrite migrations.
- The Phase 5 QA document may record a completed tier-semantics subsection while its broader overall result remains pending or blocked.
- The obsolete manual instruction to update a position-tier assignment must be replaced with read-only verification that source tiers and recommendation-tier availability are presented separately and that no unsupported tier-authoring control exists.
- Patch completion should be recorded in `docs/tasks.md` as a Task 20 prerequisite, without checking Task 20 complete.

## Implementation Steps

1. Confirm the exit baseline before running gates.

   - verify the worktree contains only the completed tier patch and intentional user changes;
   - verify Slices 1 through 4 behavior and tracking are present;
   - do not edit source or tests before a validation failure demonstrates a tier-specific defect;
   - preserve unrelated user work.

2. Run focused import, canonical, and domain validation.

   Run:

   ```text
   npm test -- src/lib/rankingSetValidation.test.ts src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
   ```

   Confirm:

   - FantasyPros tiers remain source-only and engine-neutral;
   - explicit Canonical V2 source and recommendation semantics round-trip;
   - legacy Canonical V1 remains loadable and recommendation-neutral;
   - malformed semantics fail atomically through stable diagnostics;
   - readable JSON formatting remains deterministic and within the measured byte limit.

3. Run focused persistence and snapshot validation.

   Run:

   ```text
   npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts
   ```

   Confirm:

   - ranking-set semantics persist and hydrate exactly;
   - legacy stored sets and snapshots neutralize ambiguous values;
   - new snapshots preserve explicit eligibility and remain immutable;
   - source edits or deletion do not alter an existing draft snapshot;
   - invalid create or replace operations remain atomic.

4. Run focused recommendation and scenario validation.

   Run:

   ```text
   npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts src/lib/curatedScenarios.test.ts
   ```

   Confirm:

   - neutral tiers produce no tier component or reason;
   - explicitly eligible recommendation tiers retain bounded tier pressure;
   - score components and totals reconcile deterministically;
   - Scenario V1 parse, replay, reset, restart, and transient picks remain neutral and deterministic;
   - no ranking-set or database lookup was added to replay.

5. Run focused UI validation.

   Run:

   ```text
   npm test -- src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/AvailablePlayersTable.test.tsx src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
   ```

   Confirm:

   - source, eligible recommendation, neutral, and legacy-compatible states remain distinct in ranking management;
   - unsupported tier-authoring controls remain absent;
   - draft setup describes recommendation tier pressure as unavailable for neutral positions;
   - available players expose no ambiguous tier column;
   - neutral recommendation cards show no tier-cliff explanation and explicit eligible fixtures retain valid explanations.

6. Run full project gates.

   Run:

   ```text
   npm test
   npx tsc --noEmit
   npm run lint
   npm run prisma:validate
   npx prisma migrate status
   npm run build
   ```

   Requirements:

   - record exact file/test counts and skipped tests;
   - record warnings separately from failures;
   - accept only the already-known unused `stripLocations` lint warning unless the file has since changed;
   - require migration status to report `20260630211500_add_ranking_set_tier_semantics` applied;
   - do not run reset, schema push, or migration-creation commands during exit validation.

7. Complete the tier-semantics manual QA matrix.

   Confirm and record:

   - importing FantasyPros CSV preserves visible source tiers without position-tier or recommendation-pressure claims;
   - ranking detail has no unsupported position-tier assignment control;
   - exporting and re-importing readable Canonical JSON preserves order, source metadata, and explicit recommendation semantics;
   - legacy Canonical V1 imports with compatibility-neutral recommendation behavior;
   - draft setup identifies positions without recommendation tier pressure and still permits creation;
   - available players show no ambiguous tier column;
   - neutral imported rankings create no tier-cliff component or reason;
   - an explicitly recommendation-eligible canonical fixture can still produce its valid bounded tier-cliff explanation;
   - an existing draft remains deterministic after its source ranking set is edited or deleted;
   - Scenario V1 import, replay, local pick, undo, reset, and restart remain deterministic and tier-neutral.

8. Update QA and patch tracking after all tier-specific gates pass.

   In `docs/qa/manual-phase-5-qa.md`:

   - replace the obsolete position-tier assignment instruction with the approved read-only semantics checks;
   - add a dated Tier Semantics Patch QA subsection with the automated and user-confirmed manual results;
   - do not change the broader Phase 5 overall result to passed unless every remaining checklist item was actually completed.

   In `docs/patches/tier-semantics-tasks.md`:

   - mark Slice 4 complete and record its 4A/4B focused validation plus manual QA;
   - mark Slice 5 complete;
   - append exact focused, full-suite, type, lint, Prisma, migration-status, build, and manual-QA results;
   - preserve deferred position-tier work as deferred.

   In `docs/tasks.md`:

   - add a concise note under Task 20 that the Tier Semantics Correction patch passed its exit gate;
   - leave Task 20 unchecked and preserve all broader Phase 5 acceptance criteria.

   In this file:

   - mark Completion Status complete with exact gate results;
   - record any accepted warning;
   - stop without beginning another slice.

## Expected Files

Documentation only when all gates pass:

- `docs/current-slice.md`
- `docs/patches/tier-semantics-tasks.md`
- `docs/qa/manual-phase-5-qa.md`
- `docs/tasks.md`

No production or test changes are expected.

Do not touch:

- production source, generated Prisma client files, migrations, dependencies, or data files;
- test files unless a failing tier-specific gate first demonstrates a real uncovered defect and the scope is re-planned;
- roadmap, project, architecture, decision, or design documents whose approved semantics are already current;
- Phase 5 Task 20 completion state.

## Tests

Required focused validation:

```text
npm test -- src/lib/rankingSetValidation.test.ts src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts src/lib/rankingSnapshot.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/draftCreationWorkflow.test.ts
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts src/lib/curatedScenarios.test.ts
npm test -- src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/AvailablePlayersTable.test.tsx src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
```

Required full validation:

```text
npm test
npx tsc --noEmit
npm run lint
npm run prisma:validate
npx prisma migrate status
npm run build
```

## Acceptance Criteria

- Focused tests protect every supported tier-semantics path across import, canonical portability, validation, persistence, snapshots, recommendations, Scenario V1, and UI.
- FantasyPros source tiers never become position-tier recommendation pressure.
- New canonical exports and snapshots preserve explicit source and recommendation semantics through deterministic round trips.
- Legacy ranking sets, Canonical V1 files, snapshots, persisted drafts, and Scenario V1 fixtures remain usable with conservative recommendation-neutral behavior.
- Neutral tiers emit no tier score component or reason; explicitly eligible tiers retain bounded positive coverage.
- Recommendation totals, components, reasons, ordering, replay, and snapshot behavior remain deterministic.
- Focused suites, the full automated suite, TypeScript, lint, Prisma validation, migration status, and production build pass, with only explicitly recorded pre-existing warnings.
- Tier-specific manual QA passes and is recorded without overstating the broader Phase 5 QA result.
- Patch Slices 4 and 5 and the patch itself are recorded complete.
- Phase 5 Task 20 remains pending unless its separate full acceptance criteria are completed.
- Future position-tier derivation and authoring remain explicitly deferred.
- No new behavior, architecture, dependency, migration, historical-data rewrite, or roadmap work is introduced.

## Failure Handling

- If a focused test fails, identify the exact semantic boundary and fix only a defect caused by this patch; otherwise stop and plan a corrective slice.
- If the full suite fails after focused suites pass, report the unrelated failure without weakening tests or expanding scope.
- If Prisma migration status is pending or drifted, stop and report the configured database state; do not reset or create a migration.
- If build validation fails because of an external service or environment dependency, record the exact blocker and keep the patch open.
- If manual QA reveals behavior beyond terminology or tier eligibility, keep the patch open and plan the smallest corrective slice.
- If only the known lint warning remains, record it as pre-existing rather than changing the unrelated test helper.
- Preserve user work and stop on unsafe overlap.

## Follow-Up

After this slice passes, return to Phase 5 Task 20 planning. The next slice should address only the remaining broader Phase 5 exit criteria and manual QA; do not begin future position-tier work or another roadmap phase automatically.

## Slice Review

- Smallest meaningful increment: yes. It validates and closes one completed semantic correction patch without folding in the broader Phase 5 exit task.
- Executable by a lower-reasoning pass: yes. Exact suites, gates, manual checks, documentation updates, and stop conditions are specified.
- Avoids unnecessary architecture changes: yes. No production or test changes are expected.
- Blast radius reasonable: yes. Successful completion changes four documentation files only.
- Review/revert comfort: yes. Validation is non-mutating and documentation updates are localized.
- Observable/testable acceptance criteria: yes. Every path, command, QA observation, and tracking result is explicit.
