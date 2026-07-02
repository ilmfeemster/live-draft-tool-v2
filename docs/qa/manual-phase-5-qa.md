# Phase 5 Exit QA Checklist

## Purpose

Validate that the completed Rankings & Data phase meets its product success criteria without regressing deterministic draft, recommendation, persistence, snapshot, or replay behavior.

## Evidence

- Date: 2026-06-30
- Commit or branch: Working tree validation before commit
- App URL: `http://localhost:3000`
- Tester: Codex automated validation; interactive manual QA blocked
- Overall result: Blocked
- Blocking issue: Interactive browser control failed before the app could be opened, so the full manual QA checklist could not be completed in this run.
- Local persistence signal: `.env` contains `DATABASE_URL`.
- Local app smoke: `Invoke-WebRequest http://localhost:3000` returned HTTP 200 and the page contained `Draft Board`.
- Defects found: None in automated validation.

## Automated Gates

- [x] `npm test -- src/lib/rankingSetValidation.test.ts src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/canonicalRankingJsonExporter.test.ts src/lib/rankingImportWorkflow.test.ts`
  - Passed: 9 files, 168 tests.
- [x] `npm test -- src/lib/rankingSetEditing.test.ts src/lib/rankingSetRepository.test.ts src/lib/managedSeedRankingSet.test.ts src/lib/rankingManagementWorkflow.test.ts src/app/actions/rankingActions.test.ts`
  - Passed: 5 files, 92 tests passed, 1 skipped.
- [x] `npm test -- src/lib/rankingSnapshot.test.ts src/lib/draftCreationWorkflow.test.ts src/app/actions/draftActions.test.ts src/lib/draftWorkspaceLoader.test.ts`
  - Passed: 4 files, 51 tests.
- [x] `npm test -- src/components/RankingLibraryPanel.test.tsx src/components/RankingSetEditorPanel.test.tsx src/components/DraftSetupForm.test.tsx src/components/DraftRoom.test.tsx`
  - Passed: 4 files, 30 tests.
- [x] `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts`
  - Passed: 6 files, 136 tests.
- [x] `npx tsc --noEmit`
  - Passed.
- [x] `npm test`
  - Passed: 44 files, 608 tests passed, 1 skipped.
- [x] `npm run lint`
  - Passed.
- [x] `npm run build`
  - Passed.
- [x] `npm run prisma:validate`
  - Passed.

## Manual QA Checklist

- [ ] Confirm the managed seed ranking set is present after startup/bootstrap.
- [ ] Import a valid FantasyPros CSV ranking set and confirm it appears in the ranking library.
- [ ] Import or re-import a valid Canonical Ranking Set JSON V1 file and confirm it creates an independent set.
- [ ] Try an invalid CSV or JSON import and confirm actionable errors appear with no stored-data change.
- [ ] Edit a ranking set name, reorder one player, and correct supported player metadata; confirm saved values reload, source tiers and recommendation-tier availability remain distinct, and no unsupported position-tier assignment control appears.
- [ ] Export a ranking set, re-import it as a separate set, and confirm domain-relevant order, metadata, and tiers are preserved.
- [ ] Create one draft from the managed seed set and one draft from an alternate set; confirm each draft uses the selected set's recommendations.
- [ ] Edit and then delete the source ranking set for one created draft; refresh/resume that draft and confirm its captured snapshot still loads.
- [ ] Exercise missing/deleted selected set and oversized league-capacity failures in draft setup, confirming no partial draft is created.
- [ ] Export a scenario from a draft, import it into the developer workbench, adjust replay target, reset/restart as appropriate, and confirm deterministic replay behavior.
- [ ] Confirm cancel behavior, pending state, in-progress draft confirmation, transient-session confirmation, draft history, ranking library, current draft, scenario import/export, and replay still behave.

## Notes

- The automated validation suite gives coverage for the Phase 5 data boundaries, selected-ranking draft creation, immutable snapshots, UI rendering, scenario replay, and recommendation determinism.
- The interactive browser/manual QA checklist remains incomplete. Task 20 should not be marked complete until this blocker is accepted or the checklist is completed in a working manual QA environment.

## Tier Semantics Patch Exit Attempt - 2026-07-01

- Automated result: Passed.
- Focused results:
  - Import/domain: 9 files, 189 tests passed.
  - Persistence/snapshots: 9 files, 163 tests passed, 1 skipped.
  - Recommendations/scenarios: 8 files, 160 tests passed.
  - UI: 6 files, 30 tests passed.
- Full suite: 45 files, 648 tests passed, 1 skipped.
- TypeScript, Prisma schema validation, database migration status, and production build passed.
- Lint passed with one pre-existing unused `stripLocations` warning in `src/lib/rankingNormalizer.test.ts`.
- User-confirmed Slice 4 ranking-management and draft-workflow terminology QA passed.
- Remaining blocker: browser control could not initialize before navigation, so legacy Canonical V1 import, source edit/delete snapshot isolation, and Scenario V1 replay lifecycle were not manually re-observed in this exit attempt.
- Overall Phase 5 result remains blocked; Tier Semantics Patch Slice 5 is not complete.
