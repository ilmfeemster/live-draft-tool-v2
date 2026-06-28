# Current Slice: Complete Phase 4 Regression and Exit Validation

## Source Context

Phase 4 Tasks 1 through 11 are complete. The focused scroll-restoration and disclosure QA is also complete. The next ordered work is Phase 4 Task 12: prove the finished developer workbench meets the Phase 4 success criteria without regressing manual drafting, recommendations, persistence, or domain invariants.

This is a validation and evidence slice, not a feature slice. Existing automated coverage is broad, but Phase 4 still needs one recorded end-to-end manual pass across configured persistence and the transient scenario workflow. `docs/tasks.md` also contains a stale Testing Status statement saying Phase 4 implementation has not started; that status should be corrected only when exit validation succeeds.

## Goal

Produce repeatable automated and manual evidence that Phase 4 is complete, then mark Task 12 complete without changing production behavior or promoting another roadmap phase.

## Scope

### Goals

- Audit Phase 4 Tasks 1 through 11 against their acceptance criteria and existing automated/manual evidence.
- Run the complete deterministic unit, integration, scenario, component, action, repository, loader, and regression suite.
- Validate lint, TypeScript, Prisma schema, and production build gates.
- Record a focused Phase 4 manual QA pass in a dedicated checklist.
- Exercise every supported league-setup field together in one non-default persisted configuration.
- Confirm invalid setup does not create a persisted draft or ranking snapshot.
- Confirm persisted creation, refresh, resume, pick, recommendation, undo, reset, history, and deletion behavior.
- Confirm scenario import/export, replay target, invalid-import isolation, local picks, undo, reset, restart, dirty confirmation, and recommendation diagnostics.
- Confirm scenario sessions remain transient and persisted drafts remain unchanged.
- Confirm representative replay reaches its target within seconds and remains deterministic.
- Reconfirm core manual-draft completion and draft invariants.
- Mark Phase 4 Task 12 complete and update the task Testing Status only after every required gate passes.

### Non-Goals

- Adding a Phase 4 feature or changing existing expected behavior during exit validation.
- Weakening, deleting, or broadly rewriting tests to obtain a passing result.
- Changing Recommendation Engine scores, order, components, penalties, reasons, or caps.
- Changing the scenario contract, safety limits, replay semantics, persistence model, or draft rules.
- Expanding UI polish beyond reporting a direct validation blocker.
- Adding test dependencies, coverage tooling, services, workers, queues, or deployment infrastructure.
- Promoting Phase 5, changing `docs/project.md`, or beginning ranking-management work.
- Beginning Phase 7 provider integration work.

## Validation Design

### 1. Acceptance-Criteria Audit

Before manual QA, review Tasks 1 through 11 and map each acceptance criterion to one of:

- an existing passing automated test;
- an explicit step in the Phase 4 manual QA checklist;
- prior focused QA accepted by the user, including active-draft deletion, disclosures, and scroll restoration.

Do not add a new traceability document. Keep the mapping in implementation notes while executing the slice. If a criterion has no credible evidence or the product visibly does not implement it, stop and report the gap rather than modifying production code inside this validation slice.

### 2. Automated and Project Gates

Run the existing repository gates without changing expected output:

```text
npm test
npm run lint
npx tsc --noEmit
npm run prisma:validate
npm run build
```

Record exact test-file/test counts and each command result in the handoff. A failure caused by this repository should be reported with its narrow cause. An environmental failure, such as unavailable database or build-time service access, should be reported separately and must not be hidden by changing application behavior.

### 3. Phase 4 Manual QA Record

Create `docs/qa/manual-phase-4-qa.md` as the durable exit-validation record. It should contain:

- date;
- commit or branch;
- browser and local app URL;
- tester;
- automated gate results;
- per-section checkboxes;
- observed timing for representative scenario reconstruction;
- pass/fail summary, blockers, and notes.

The checklist should be executable in the following order so temporary state is understandable and cleanup is limited to drafts created during QA.

#### A. Default and Invalid Setup

- Open the current persisted workspace and confirm normal manual drafting remains available without entering scenario mode.
- Open Start New Draft and confirm default values, derived rounds, visible `SNAKE`, and visible `PPR`.
- Exercise invalid team count, draft position, roster count/total, bench-only construction, and insufficient ranking capacity where the UI permits.
- Confirm clear validation feedback and no new Draft History entry after invalid submission.
- Cancel setup and confirm the loaded workspace remains unchanged.

#### B. Supported Non-Default Configuration

- Create one small non-default draft that uses non-default team count and draft position and includes nonzero QB, RB, WR, TE, FLEX, DST, K, and BENCH counts within ranking capacity.
- Confirm rounds derive from the total slots and the selected draft position maps to the correct user team.
- Make picks through the persisted path and confirm available players, active pick, roster, and recommendations update consistently.
- Refresh and reopen the draft from history; confirm settings, user-team identity, picks, roster, and recommendations hydrate identically.
- Exercise undo and reset, confirming valid state and recommendation recomputation.

#### C. Portable Scenario and Atomic Failure

- Add representative picks to the persisted non-default draft and export it.
- Record the source draft ID, settings, pick count, top recommendations, and history count.
- Import the exported file and confirm a transient scenario reproduces the configuration, target pick count, available players, user roster, and recommendation inputs without adding or modifying a persisted history entry.
- Apply zero, intermediate, and maximum valid replay targets and confirm the displayed draft state matches each target.
- Attempt an out-of-range replay target and confirm useful feedback without replacing the current transient state.
- Import malformed or unsupported-version JSON and confirm a useful error while the active state and persistence remain unchanged.
- Re-import the same valid scenario and record the elapsed time from file selection to visible target state; the target should appear within 10 seconds on the local development machine without manual pick entry.
- Confirm repeated import produces the same draft state and recommendation ordering/totals.

#### D. Transient Exploration and Diagnostics

- Make a local scenario pick and undo it; confirm no persisted write or history change.
- Inspect at least one uncapped and one capped recommendation when available; confirm displayed totals reconcile from engine-owned components and adjustments and reasons match the recommendation.
- Create dirty transient state and verify destructive reset, restart, and replacement require confirmation.
- Cancel each confirmation once and confirm state remains unchanged.
- Accept reset and confirm the declared replay target is reconstructed.
- Make another local change, accept restart, and confirm a zero-pick transient manual draft with the same settings and rankings.
- Export the transient state and confirm the file remains importable through the same public path.

#### E. Persistence Isolation and History

- Return to the original persisted draft and confirm transient exploration did not change its settings or picks.
- Confirm persisted pick, undo, reset, refresh, and resume still use the repository path.
- Confirm inactive deletion leaves the loaded workspace unchanged.
- Confirm active deletion loads the deterministic replacement/fallback workspace and Back does not revisit the deleted URL.
- Confirm Developer Workbench and Active Drafts disclosures and player-draft scroll restoration retain their accepted behavior.

#### F. Manual Draft and Invariants

- Re-run the existing default full-draft workflow in `docs/qa/manual-full-draft-qa.md`, recording new Phase 4 evidence in `docs/qa/manual-phase-4-qa.md` rather than overwriting the historical checklist.
- Confirm a player exists in exactly one location, drafted players are unavailable, available players are not rostered, drafted count matches pick progression, each drafted player belongs to one team, undo restores valid state, and recommendations contain only available players.
- Confirm the final pick completes the draft and blocks extra picks without a crash or stale recommendation/roster state.

### 4. Completion Documentation

Only after the acceptance audit, automated gates, and every required manual checklist item pass:

- change Phase 4 Task 12 in `docs/tasks.md` from `[ ]` to `[x]`;
- replace the stale Testing Status claim with a concise statement that Phase 4 Tasks 1 through 12, automated validation, and manual exit QA are complete;
- retain the note that Phase 3's prior manual evidence was covered by the Phase 4 exit regression;
- do not change the active phase in `docs/project.md` or plan Phase 5 in the same slice.

If any required criterion fails, leave Task 12 unchecked, record the failure in `docs/qa/manual-phase-4-qa.md`, and report the smallest recommended correction slice.

## Implementation Steps

1. Audit Tasks 1 through 11 against existing automated coverage, accepted focused QA, and the planned Phase 4 manual checklist.
2. Create `docs/qa/manual-phase-4-qa.md` with the evidence fields and ordered checklist above.
3. Run the full automated suite, lint, TypeScript, Prisma schema validation, and production build.
4. Complete and record the Phase 4 manual QA checklist, including the default full-draft regression.
5. Review the resulting diff and dependency/lockfile status to confirm validation introduced no production or dependency changes.
6. If all evidence passes, check Task 12 and update only the Testing Status section in `docs/tasks.md`.
7. Report final acceptance status, evidence, files changed, blockers, and the recommended phase-planning prompt. Do not begin another phase.

## Expected Files

- `docs/qa/manual-phase-4-qa.md`
- `docs/tasks.md` only after all validation passes

No production source, tests, package manifest, lockfile, architecture, decisions, project-scope, or roadmap changes are expected.

## Automated Validation

Run from the repository root:

```text
npm test
npm run lint
npx tsc --noEmit
npm run prisma:validate
npm run build
```

Expected result:

- All Vitest files and tests pass with exact counts reported.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- Prisma schema validation passes without schema or generated-client changes.
- The production Next.js build succeeds.
- No dependency or lockfile changes are introduced.

## Acceptance Criteria

- Every Phase 4 Task 1 through 11 acceptance criterion has credible automated, recorded manual, or accepted focused-QA evidence.
- All automated and project gates pass without weakened assertions or changed expected recommendation behavior.
- The Phase 4 manual QA record is complete, dated, and reports an overall pass.
- Every supported league-setup field participates in a valid non-default persisted draft.
- Invalid setup produces clear feedback and no persisted draft/history entry.
- Non-default settings and user-team identity survive persistence, refresh, resume, picks, undo, and reset.
- Export/import reproduces domain-relevant state and recommendation inputs without mutating the source persisted draft.
- Zero, intermediate, and maximum replay targets reconstruct valid states.
- Invalid import and replay-target failures do not partially replace active state or mutate persistence.
- Local exploration, undo, reset, restart, dirty confirmation, and diagnostics behave correctly.
- Representative scenario reconstruction reaches visible target state within 10 seconds without manual history entry.
- Repeated scenario reconstruction produces identical draft state and recommendation ordering/totals.
- Core manual and persisted draft workflows, deletion behavior, disclosures, and scroll restoration remain functional.
- Draft invariants hold after replay, local exploration, reset, restart, refresh, resume, and full completion.
- No Phase 4 non-goal, future-phase architecture, production change, dependency, or lockfile change is introduced.
- Phase 4 Task 12 is checked complete only after all evidence passes.
- Phase 5 and Phase 7 work are not started.

## Failure Handling

- If an acceptance criterion lacks evidence, stop and report the gap; do not infer completion from adjacent tests.
- If manual QA exposes a product defect, record exact reproduction, expected behavior, observed behavior, and affected state, then leave Task 12 unchecked.
- If an existing test expectation appears incorrect, stop and report the discrepancy rather than changing it during exit validation.
- If only an environment-dependent gate fails, distinguish it from a product failure and leave Task 12 unchecked until the gate can be completed or explicitly waived by the user.
- If production or test code would need to change, stop and recommend a separate focused correction slice.
- Do not promote the next phase merely because Phase 4 validation passes; phase promotion requires a separate explicit request.

## Follow-Up

After Task 12 is complete, the recommended next prompt is:

```text
Plan the next project phase using AGENTS.md. Review the roadmap and required project-planning documents, then recommend whether to promote Phase 5 into active scope. Do not implement it yet.
```

## Slice Review

- Smallest meaningful increment: yes. Task 12 is one coherent exit-validation gate with no feature work.
- Executable by a lower-reasoning pass: yes. Commands, evidence fields, manual sequence, completion edits, and stop conditions are explicit.
- Avoids unnecessary architecture changes: yes. No production or architecture changes are planned.
- Blast radius reasonable: yes. One new QA record and one conditional task-status edit are expected.
- Review/revert comfort: yes. Validation evidence and status changes are isolated documentation.
- Observable/testable acceptance criteria: yes. Command results, persisted/transient state, timings, invariants, history isolation, and checklist results are directly observable.
