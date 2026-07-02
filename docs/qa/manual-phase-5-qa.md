# Phase 5 Exit QA Checklist

## Purpose

Validate that the completed Rankings & Data phase meets its product success criteria without regressing deterministic draft, recommendation, persistence, snapshot, or replay behavior.

## Evidence

- Date: 2026-07-01
- Commit or branch: Working tree validation before commit
- App URL: `http://localhost:3000`
- Tester: Codex automated validation; user-confirmed interactive manual QA
- Overall result: Passed
- Blocking issue: None.
- Local persistence signal: `.env` contains `DATABASE_URL`.
- Local app smoke: `Invoke-WebRequest http://localhost:3000` returned HTTP 200 and the page contained `Draft Board`.
- Defects found and corrected: newly imported ranking sets initially required a page refresh before appearing in New Draft Setup; ranking-library cards initially hid content without shrinking because the grid stretched sibling cards; default-collapsed workspace panels were added and verified during final QA.

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

- [x] Confirm the managed seed ranking set is present after startup/bootstrap.
- [x] Import a valid FantasyPros CSV ranking set and confirm it appears in the ranking library.
- [x] Import or re-import a valid Canonical Ranking Set JSON V1 file and confirm it creates an independent set.
- [x] Try an invalid CSV or JSON import and confirm actionable errors appear with no stored-data change.
- [x] Edit a ranking set name, reorder one player, and correct supported player metadata; confirm saved values reload, source tiers and recommendation-tier availability remain distinct, and no unsupported position-tier assignment control appears.
- [x] Export a ranking set, re-import it as a separate set, and confirm domain-relevant order, metadata, and tiers are preserved.
- [x] Create one draft from the managed seed set and one draft from an alternate set; confirm each draft uses the selected set's recommendations.
- [x] Edit and then delete the source ranking set for one created draft; refresh/resume that draft and confirm its captured snapshot still loads.
- [x] Exercise missing/deleted selected set and oversized league-capacity failures in draft setup, confirming no partial draft is created.
- [x] Export a scenario from a draft, import it into the developer workbench, adjust replay target, reset/restart as appropriate, and confirm deterministic replay behavior.
- [x] Confirm cancel behavior, pending state, in-progress draft confirmation, transient-session confirmation, draft history, ranking library, current draft, scenario import/export, and replay still behave.

## Notes

- The automated validation suite gives coverage for the Phase 5 data boundaries, selected-ranking draft creation, immutable snapshots, UI rendering, scenario replay, and recommendation determinism.
- The user confirmed the interactive checklist after the recorded QA corrections. Task 20 and the tier-semantics patch exit gate are complete.

## Tier Semantics Patch Exit Completion - 2026-07-01

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
- User-confirmed manual result: Passed, including legacy compatibility, source edit/delete snapshot isolation, Scenario V1 replay lifecycle, no-refresh ranking synchronization, and final collapsed-panel behavior.
- Final full suite after QA corrections: 45 files, 649 tests passed, 1 skipped.
- Overall Phase 5 result: Passed. Tier Semantics Patch Slice 5 is complete.
