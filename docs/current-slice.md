# Current Slice - Task 7: Complete Phase 6 Regression and Exit Validation

## Status

Blocked pending completion of manual browser QA. Automated validation, unsupported-claim inspection, and partial Browser-plugin QA were completed on 2026-07-07, but the Browser plugin began timing out after the reset confirmation flow before scenario import/replay and final reset verification could be completed.

## Context

Phase 6 added a pure Strategy & Insight Engine above the deterministic Recommendation Engine and exposed the resulting insight bundle in the Draft Room. Tasks 1-6 covered the Insight Engine contract, neutral behavior, primary decision frames, top-candidate summaries, top-options tradeoffs, roster construction insights, board and next-pocket insights, and compact recommendation-panel presentation.

Task 7 is the Phase 6 exit-validation slice. It should prove that strategic insights are deterministic, supported, and useful without changing recommendation scores, recommendation ordering, forecast behavior, persistence contracts, scenario/replay behavior, or manual draft workflows.

This slice is primarily validation and documentation. Do not add new insight categories, tune scoring, redesign UI, or broaden product scope during exit validation.

## Goal

Complete Phase 6 regression and exit validation so the Strategy & Insight Engine can be considered complete and ready for the next planning phase.

## Scope

### Goals

- Run focused and full automated validation for Phase 6 and its regression boundaries.
- Confirm Insight Engine outputs remain deterministic, structured, traceable, and derived.
- Confirm recommendation scores, ordering, components, reasons, caps, forecast output, and profile-transition behavior are unchanged except for intentionally added insight presentation.
- Confirm persisted drafts and portable scenarios recompute recommendations and insights from captured draft/ranking inputs.
- Confirm the Draft Room remains usable for manual draft, persisted draft, scenario import, replay-target changes, reset, undo, restart, and final-pick states.
- Confirm insight language does not contain unsupported claims about opponents, probabilities, exact player availability, AI reasoning, projections, VORP, ADP-as-quality, or source tiers as position tiers.
- Record validation evidence and any residual risks in project documentation after validation completes.

### Non-goals

- Do not change recommendation scoring, ordering, component weights, caps, reason generation, forecast construction, or profile-transition behavior.
- Do not add new insight categories, thresholds, wording systems, or domain semantics.
- Do not redesign the Draft Room or add controls, settings, filters, toggles, or tuning UI.
- Do not persist insight output or change database/schema/scenario serialization contracts.
- Do not introduce live-provider integration, accounts, simulations, AI reasoning, projections, VORP, or opponent modeling.
- Do not create broad testing infrastructure beyond what is needed to validate Phase 6.

## Implementation Steps

1. Review the current changed-file set and confirm Task 7 starts from completed Phase 6 Task 6 work.
2. Run focused Phase 6 automated validation:

   ```powershell
   npm test -- src/lib/insights.test.ts src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
   ```

3. Run focused regression validation for Recommendation Engine, forecast/profile-transition, scenario/replay, persisted workspace, ranking normalization, and ranking-set behavior using the existing relevant test files. Prefer targeted existing tests over adding new coverage unless a Phase 6 gap is discovered.
4. Run the full automated suite:

   ```powershell
   npm test
   ```

5. Run project validation commands:

   ```powershell
   npx tsc --noEmit
   npm run lint
   npm run build
   npm run prisma:validate
   git diff --check
   ```

6. Manually inspect the current insight text surface in source/test fixtures for unsupported claims:
   - opponent predictions;
   - probability estimates;
   - exact-player availability claims;
   - ADP-as-quality language;
   - source-tier-as-position-tier language;
   - AI-generated reasoning claims;
   - projection or VORP language.
7. Complete focused manual QA in the running app for representative Phase 6 states:
   - clean best-player or player-quality recommendation;
   - value-versus-need or need-versus-value decision;
   - close-call tradeoff;
   - roster-construction insight;
   - board or next-pocket context;
   - caveated recommendation;
   - neutral or missing-forecast state;
   - persisted draft load;
   - scenario import and replay-target change;
   - undo, reset/restart, and final-pick behavior.
8. If automated or manual validation exposes a bug caused by Phase 6, fix only the smallest issue necessary and rerun the affected validation. Stop and report if fixing requires changing non-goal areas or reinterpreting approved design.
9. After validation passes, update `docs/tasks.md` to mark Task 7 complete and summarize validation evidence.
10. Update `docs/current-slice.md` completion notes with:
    - commands run and results;
    - manual QA states covered;
    - any skipped or environment-gated validation;
    - residual risks or follow-up recommendations.

## Expected Files

Planning this slice only updates:

- `docs/current-slice.md`

Implementation of this slice is expected to update:

- `docs/current-slice.md`
- `docs/tasks.md`

Production source changes are not expected. Test changes are not expected unless validation reveals a Phase 6 regression or meaningful coverage gap. Do not edit Insight Engine, Recommendation Engine, persistence, scenario, schema, or UI files unless required to fix a validation failure directly caused by Phase 6.

## Acceptance Criteria

- Focused Phase 6 tests pass.
- Relevant existing regression tests for recommendations, forecast/profile transitions, scenarios/replay, persisted workspace loading, ranking normalization, and ranking-set behavior pass.
- Full automated test suite passes, except for any already-documented environment-gated tests.
- TypeScript validation, lint, production build, Prisma validation, and `git diff --check` pass or any pre-existing/environment-gated limitations are clearly documented.
- Manual QA confirms Draft Room usability across manual, persisted, scenario, replay, undo, reset/restart, neutral, caveated, and final-pick states.
- No visible insight text or tested insight fixture contains unsupported opponent, probability, exact availability, AI, projection, VORP, ADP-quality, or source-tier-as-position-tier claims.
- Recommendation scores, ordering, components, adjustments, reasons, forecast output, profile transitions, and persistence/scenario contracts remain unchanged except for the approved insight presentation from Task 6.
- `docs/tasks.md` and `docs/current-slice.md` record Phase 6 exit-validation evidence after validation completes.

## Partial Validation Notes

Completed on 2026-07-07:

- Focused Phase 6 validation passed:
  - `npm test -- src/lib/insights.test.ts src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx`
  - Result: 3 test files passed; 60 tests passed.
- Focused regression validation passed:
  - `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/draftPocketForecast.test.ts src/lib/recommendationRankingContext.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioSession.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioPortability.test.ts src/lib/draftWorkspaceLoader.test.ts src/lib/draftRepository.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/rankingNormalizer.test.ts src/lib/rankingSetValidation.test.ts src/lib/rankingSetRepository.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingSnapshot.test.ts src/lib/rankingImportWorkflow.test.ts src/lib/rankingImportPreflight.test.ts src/lib/rankingCandidateValidation.test.ts`
  - Result: 20 test files passed; 521 tests passed; 1 test skipped.
- Full automated suite passed after the lint fix:
  - `npm test`
  - Result: 48 test files passed; 865 tests passed; 1 test skipped.
- TypeScript validation passed:
  - `npx tsc --noEmit`
- Lint passed with only the documented pre-existing warning in `src/lib/rankingNormalizer.test.ts`:
  - `npm run lint`
- Production build passed:
  - `npm run build`
- Prisma validation passed:
  - `npm run prisma:validate`
- Diff whitespace validation passed with only CRLF normalization warnings:
  - `git diff --check`
- Unsupported-claim inspection found no opponent prediction, probability, projection, VORP, AI-reasoning, ADP-quality, exact player availability, or source-tier-as-position-tier claims in the current insight source and fixtures. The inspected "available" matches were current-board/player-pool language, not exact future availability predictions.
- Partial Browser-plugin manual QA completed after the Browser plugin became available:
  - Loaded the existing persisted draft at `http://localhost:3000/`.
  - Confirmed the complete persisted draft state showed disabled Draft buttons, Draft Complete status, persisted Draft Room sections, recommendation details, caveated insight output, close-call/tradeoff text, roster caveat text, and no-next-pick neutral timing diagnostics.
  - Opened New Draft Setup from the complete draft.
  - Confirmed missing ranking-set validation appears when creating a draft without selecting a ranking set.
  - Selected managed ranking set `Test4` and created a disposable persisted draft.
  - Confirmed the disposable draft loaded at `/?draftId=cmraogjs2000kb4uka8zn3ae3`, showed enabled Draft buttons, strategic insights, current-pocket pressure, a player-quality-versus-roster/timing tradeoff, and open WR starter context.
  - Drafted the top recommendation and confirmed the draft advanced to pick 2 of 192, recommendations recomputed, and insight output changed to a close-call/Bijan Robinson decision with open RB starter context.
  - Used Undo Last Pick and confirmed the draft returned to pick 1 of 192, Undo became disabled, and the original Ja'Marr Chase insight frame returned.
  - Started the reset path on the disposable draft and confirmed the reset confirmation dialog appeared.
  - Retried after the confirmation was accepted in the visible in-app browser and confirmed the disposable draft reset completed: the draft returned to pick 1 of 192, Undo Last Pick was disabled, Draft buttons were enabled, strategic insights were visible, and the original Ja'Marr Chase current-pocket/open-WR-starter insight returned.
  - Reopened the scenario file picker twice and provided the fixture path `src\data\scenarios\early-non-default-pressure.json` for import QA.

Blocked:

- Manual browser QA is still incomplete. The Browser plugin can open the scenario file picker but does not expose a supported file-upload method, and the scenario input remained empty after both picker attempts. Scenario import, replay-target change, restart/reset scenario, and scenario replay QA were not completed from Codex.

Follow-up required before marking Task 7 complete:

- Complete the remaining scenario import/replay manual QA states listed in step 7 using a user-selected scenario file in the native picker or another stable manual QA path.
- Rerun `git diff --check` after any documentation updates.
- Update `docs/tasks.md` to mark Task 7 complete only after manual QA passes.

## Failure Conditions

Stop and report instead of broadening the slice if:

- validation failures require recommendation scoring, forecast construction, profile-transition, persistence, schema, scenario serialization, or ranking import changes not directly caused by Phase 6;
- manual QA requires broad Draft Room redesign or new controls to consider Phase 6 complete;
- unsupported insight wording would require new domain semantics rather than correcting an obvious presentation or fixture issue;
- full validation depends on unavailable external services or a database state that cannot be reproduced in the current environment;
- completing validation requires adding live integrations, simulations, projections, VORP, AI reasoning, opponent modeling, or account/cloud features.

## Slice Review

1. Smallest meaningful increment: yes - this closes Phase 6 by validating the already-completed Insight Engine and presentation work.
2. Executable without redefining the approach: yes - commands, inspection targets, manual QA states, documentation updates, and stop conditions are explicit.
3. Avoids unnecessary architecture changes: yes - this is a validation slice and expects no production architecture changes.
4. Reasonable blast radius: yes - expected implementation changes are documentation-only unless validation reveals a Phase 6 bug.
5. Comfortably reviewable and revertible: yes - validation evidence and task status updates are isolated.
6. Observable and testable acceptance criteria: yes - command results, manual QA coverage, unsupported-claim inspection, and documentation updates are directly observable.

## Follow-up

After this slice passes, Phase 6 should be considered complete. The next slice should be a planning slice to choose and promote the next active project phase from the roadmap or project backlog.
