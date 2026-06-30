# Current Slice: Complete Task 20 - Phase 5 Regression and Exit Validation

## Completion Status

Blocked pending manual QA environment. Automated validation passed, but the interactive browser/manual QA checklist could not be completed in this run.

## Source Context

- Phase 5 Tasks 1-19 are complete.
- Task 20 is the Phase 5 exit gate: prove rankings and data management work end to end without adding new features.
- Phase 5 introduced:
  - canonical ranking-set domain invariants;
  - FantasyPros CSV and Canonical Ranking Set JSON V1 import paths;
  - normalization, validation, conversion, export, and edit workflows;
  - first-class ranking-set persistence;
  - managed seed bootstrap;
  - immutable draft snapshots from selected ranking sets;
  - ranking library, editor, and draft setup selection UI.
- Phase 4 replay, scenario, persisted draft, and developer workbench behavior remains a regression constraint.
- Task 20 must validate the completed phase only. It must not broaden scope into Phase 6 strategy, live-provider integrations, accounts, new formats, recommendation tuning, or schema changes.

## Goal

Complete Phase 5 regression and exit validation by running the automated validation gates, performing focused manual QA when local persistence is available, recording the result, and marking Phase 5 Task 20 complete only after validation passes or clearly reporting any blockers.

## Scope

### Goals

- Run focused automated tests across ranking import, validation, conversion, export, repository, management, snapshot, draft creation, draft setup, workspace loading, replay/scenario, and recommendation boundaries.
- Run the full automated suite and project validation commands.
- Confirm both supported import formats still pass positive and negative fixtures.
- Confirm safely degraded ranking sets preserve explicit capability states and materialized fallback values without fabricating recommendation evidence.
- Confirm import, replace, edit, delete, export, and draft creation failures do not partially corrupt stored data.
- Confirm multiple ranking sets remain isolated through import, edit, selection, snapshot creation, source edit, source deletion, refresh, and resume.
- Confirm legacy Phase 2 draft snapshots and existing persisted draft loading remain compatible.
- Confirm Scenario V1 export/import/replay remains deterministic with captured ranking entries.
- Confirm recommendation output remains deterministic for identical draft and snapshot inputs.
- Complete focused manual QA from ranking import through selected draft creation and source mutation if local database setup is available.
- Record manual QA results in a Phase 5 QA note.
- After validation succeeds, update `docs/tasks.md` to mark Task 20 complete and update this slice status.

### Non-Goals

- Do not add Phase 5 features during exit validation.
- Do not weaken tests or change deterministic expected outputs merely to make validation pass.
- Do not silently change recommendation scoring, tier semantics, import contracts, or snapshot behavior.
- Do not add unsupported ranking formats, player reconciliation, feeds, provider integrations, accounts, persistence schema changes, or package dependencies.
- Do not normalize or migrate historical draft snapshots.
- Do not begin Phase 6 strategy or insight work.

## Implementation Steps

1. Inspect the current working tree and validation surface.

   Use `git status --short` to identify pending changes and avoid reverting unrelated work. Confirm Task 19 changes are present and Task 20 is still unchecked in `docs/tasks.md`. Do not modify source code unless validation identifies a Task 20 regression that must be fixed inside Phase 5 scope.

2. Run focused automated regression tests.

   Run targeted tests covering Phase 5 and Phase 4 regression boundaries:

   ```text
   npm test -- src/lib/rankingSetValidation.test.ts src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
   npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts src/lib/managedSeedRankingSet.test.ts src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts
   npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftCreationWorkflow.test.ts src/app/actions/draftActions.test.ts src/lib/draftWorkspaceLoader.test.ts
   npm test -- src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx
   npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts
   ```

   If a named test file does not exist, stop and update the slice rather than substituting a broader command silently.

3. Run full automated validation.

   From the repository root, run:

   ```text
   npx tsc --noEmit
   npm test
   npm run lint
   npm run build
   npm run prisma:validate
   ```

   Expected result:

   - TypeScript no-emit passes.
   - Full Vitest suite passes, with database-gated tests skipped unless the local environment explicitly enables them.
   - ESLint passes.
   - Production build passes.
   - Prisma schema validation passes.

4. Complete focused manual QA if local persistence is available.

   Run the app locally only if practical and a local database/persistence environment is available:

   1. Confirm the managed seed ranking set is present after startup/bootstrap.
   2. Import a valid FantasyPros CSV ranking set and confirm it appears in the ranking library.
   3. Import or re-import a valid Canonical Ranking Set JSON V1 file and confirm it creates an independent set.
   4. Try an invalid CSV or JSON import and confirm actionable errors appear with no stored-data change.
   5. Edit a ranking set name, reorder one player, correct supported player metadata, and update a position tier assignment; confirm saved values reload.
   6. Export a ranking set, re-import it as a separate set, and confirm domain-relevant order, metadata, and tiers are preserved.
   7. Create one draft from the managed seed set and one draft from an alternate set; confirm each draft uses the selected set's recommendations.
   8. Edit and then delete the source ranking set for one created draft; refresh/resume that draft and confirm its captured snapshot still loads.
   9. Exercise missing/deleted selected set and oversized league-capacity failures in draft setup, confirming no partial draft is created.
   10. Export a scenario from a draft, import it into the developer workbench, adjust replay target, reset/restart as appropriate, and confirm deterministic replay behavior.
   11. Confirm cancel behavior, pending state, in-progress draft confirmation, transient-session confirmation, draft history, ranking library, current draft, scenario import/export, and replay still behave.

   If local persistence is unavailable, record manual QA as blocked by database setup. Do not change app behavior to avoid the blocker.

5. Record validation results.

   Create or update `docs/qa/manual-phase-5-qa.md` with:

   - date of validation;
   - automated commands run and outcomes;
   - manual QA environment;
   - manual QA checklist outcomes;
   - skipped database-gated tests or blocked manual steps, if any;
   - any defects found and whether they were fixed in this slice or left as blockers.

6. Handle failures conservatively.

   If validation fails because of a clear Phase 5 regression, fix only the narrow cause and rerun the affected focused tests plus full validation needed for confidence. If the failure appears unrelated, environment-specific, or requires scope outside Task 20, stop and report the blocker without broadening the slice.

7. Finalize documentation after successful validation.

   Only after required automated validation passes and manual QA is either passed or explicitly recorded as blocked:

   - update `docs/tasks.md` to mark Task 20 complete;
   - update this file's Completion Status to completed;
   - do not plan or begin any post-Phase 5 work.

## Expected Files

- `docs/current-slice.md`, for completion status after validation.
- `docs/tasks.md`, after validation, to mark Phase 5 Task 20 complete.
- `docs/qa/manual-phase-5-qa.md`, to record Phase 5 exit validation and manual QA outcomes.
- Source or test files only if validation exposes a narrow Phase 5 regression that must be fixed to satisfy Task 20.

## Tests

Run from the repository root:

```text
npm test -- src/lib/rankingSetValidation.test.ts src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts
npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts src/lib/managedSeedRankingSet.test.ts src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts
npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftCreationWorkflow.test.ts src/app/actions/draftActions.test.ts src/lib/draftWorkspaceLoader.test.ts
npm test -- src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run prisma:validate
```

Expected result:

- focused Phase 5 tests pass;
- Phase 4 replay/scenario/workbench regressions pass;
- full Vitest suite passes, with database-gated tests skipped unless explicitly enabled;
- TypeScript, lint, production build, and Prisma validation pass.

## Manual QA

Complete the checklist in Implementation Step 4 when local persistence is available.

If local persistence is unavailable, document the blocker in `docs/qa/manual-phase-5-qa.md` and report that manual QA could not be completed. Do not mark Task 20 complete unless the recorded blocker is acceptable to the user.

## Acceptance Criteria

- Every Phase 5 task acceptance criterion is satisfied or any exception is reported as a blocker.
- Both supported import profiles pass exact positive and negative automated coverage.
- Permitted missing-column imports succeed with exact warnings, capability states, and canonical fallback values; malformed supplied values fail.
- Canonical export/import round trips preserve domain-relevant ranking values.
- At least two managed ranking sets remain isolated through import, edit, selection, draft snapshot creation, source edit, and source deletion.
- Existing draft snapshots and Scenario V1 replay remain usable after source ranking sets change or are deleted.
- Manual, persisted, and replay workflows continue producing deterministic recommendations.
- Full automated validation passes.
- Focused manual QA passes or is explicitly documented as blocked by environment setup.
- No Phase 5 non-goals are introduced.
- After validation, Phase 5 Task 20 is marked complete in `docs/tasks.md`.

## Failure Handling

- If a focused test file listed in this slice does not exist, stop and revise the slice rather than silently replacing it.
- If automated validation fails because of this slice or a Phase 5 regression, fix the smallest local cause and rerun relevant validation.
- If automated validation fails for an unrelated reason, report it separately and do not broaden the slice.
- If manual QA requires unavailable database setup, record the blocker instead of changing product code.
- If validation appears to require new features, schema changes, recommendation tuning, additional ranking formats, or live integrations, stop and report the Task 20 boundary.

## Follow-Up

After Task 20 is complete, Phase 5 should be ready for review or for planning the next approved project phase. Do not begin post-Phase 5 planning automatically.

## Slice Review

- Smallest meaningful increment: yes. This slice is limited to Phase 5 exit validation and documentation of results.
- Executable by a lower-reasoning pass: yes. Commands, manual QA steps, failure handling, and documentation updates are explicit.
- Avoids unnecessary architecture changes: yes. It is validation-first and permits source changes only for narrow regressions found during validation.
- Blast radius reasonable: yes. Expected documentation changes are limited to the slice, Task 20 status, and a QA record; source changes are conditional on validation defects.
- Review/revert comfort: yes. Validation documentation and any narrow regression fix can be reviewed independently.
- Observable/testable acceptance criteria: yes. Automated command outcomes, QA checklist results, and Task 20 status are directly observable.
