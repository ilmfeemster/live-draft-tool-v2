# Phase 4 Exit QA Checklist

## Purpose

Validate that the completed Developer Tools & Simulator phase meets its product success criteria without regressing manual drafting, recommendations, persistence, or draft invariants.

## Evidence

- Date: 2026-06-28
- Commit or branch:
- Browser:
- App URL:
- Tester:
- Overall result: Pending manual QA
- Representative scenario reconstruction time:
- Blocking issues: The in-app browser controller was unavailable, so the required end-to-end manual workflow could not be executed in this session.
- Notes: Automated validation completed successfully. Manual sections A through F remain pending.

## Automated Gates

- [x] Full Vitest suite passes: 27 files, 305 tests.
- [x] ESLint passes with no errors or warnings.
- [x] TypeScript no-emit validation passes.
- [x] Prisma schema validation passes.
- [x] Production Next.js build passes.
- [x] No dependency or lockfile changes are introduced.

## Acceptance Evidence

- [ ] Phase 4 Tasks 1 through 11 have automated, recorded manual, or accepted focused-QA evidence for every acceptance criterion.
- [ ] Previously accepted active-draft deletion, disclosure, and player-draft scroll behavior remains functional.

## A. Default and Invalid Setup

- [ ] Open a persisted workspace and confirm normal manual drafting is available without entering scenario mode.
- [ ] Open Start New Draft and confirm the default values, derived rounds, `SNAKE`, and `PPR`.
- [ ] Exercise invalid team count, draft position, roster count or total, bench-only construction, and insufficient ranking capacity where the UI permits.
- [ ] Confirm invalid setup shows useful feedback and creates no Draft History entry.
- [ ] Cancel setup and confirm the loaded workspace remains unchanged.

## B. Supported Non-Default Configuration

- [ ] Create a small non-default draft with a non-default team count and draft position and nonzero QB, RB, WR, TE, FLEX, DST, K, and BENCH counts within ranking capacity.
- [ ] Confirm rounds derive from total slots and the selected draft position maps to the correct user team.
- [ ] Make persisted picks and confirm available players, active pick, roster, and recommendations update consistently.
- [ ] Refresh and reopen from history; confirm settings, user-team identity, picks, roster, and recommendations hydrate identically.
- [ ] Exercise undo and reset; confirm valid state and recommendation recomputation.

## C. Portable Scenario and Atomic Failure

- [ ] Add representative persisted picks and export the non-default draft.
- [ ] Record the source draft ID, settings, pick count, top recommendations, and Draft History count in Notes.
- [ ] Import the exported file and confirm the transient scenario reproduces configuration, target pick count, available players, user roster, and recommendation inputs.
- [ ] Confirm import does not add or modify a persisted Draft History entry.
- [ ] Apply zero, intermediate, and maximum valid replay targets and confirm each displayed state.
- [ ] Attempt an out-of-range replay target and confirm useful feedback without replacing the current state.
- [ ] Import malformed or unsupported-version JSON and confirm a useful error while active state and persistence remain unchanged.
- [ ] Re-import the same valid scenario, record elapsed time, and confirm visible target state appears within 10 seconds without manual pick entry.
- [ ] Confirm repeated import produces the same draft state and recommendation ordering and totals.

## D. Transient Exploration and Diagnostics

- [ ] Make a local scenario pick and undo it; confirm no persisted write or history change.
- [ ] Inspect an uncapped recommendation and confirm its displayed total reconciles from engine-owned output.
- [ ] Inspect a capped recommendation when available and confirm its displayed total reconciles from components and adjustments.
- [ ] Confirm displayed score-backed reasons match the recommendation.
- [ ] Create dirty transient state and confirm reset, restart, and replacement request confirmation.
- [ ] Cancel each destructive confirmation once and confirm state remains unchanged.
- [ ] Accept reset and confirm the declared replay target is reconstructed.
- [ ] Make another local change, accept restart, and confirm a zero-pick transient manual draft with the same settings and rankings.
- [ ] Export the transient state and confirm it remains importable through the public scenario path.

## E. Persistence Isolation and History

- [ ] Return to the original persisted draft and confirm transient exploration changed neither its settings nor its picks.
- [ ] Confirm persisted pick, undo, reset, refresh, and resume still use the persisted workflow.
- [ ] Confirm inactive deletion removes history without changing the loaded workspace.
- [ ] Confirm active deletion loads the deterministic replacement or fallback workspace.
- [ ] Confirm browser Back does not revisit the deleted draft URL.
- [ ] Confirm Developer Workbench and Active Drafts disclosures retain their accepted behavior.
- [ ] Confirm recommendation and full-list drafting retain accepted page and table scroll behavior.

## F. Manual Draft and Invariants

- [ ] Re-run the default full-draft workflow from `docs/qa/manual-full-draft-qa.md` and record the Phase 4 result here.
- [ ] Confirm a player exists in exactly one location.
- [ ] Confirm drafted players are unavailable and available players are not rostered.
- [ ] Confirm drafted-player count matches pick progression.
- [ ] Confirm every drafted player belongs to exactly one team.
- [ ] Confirm undo restores valid state.
- [ ] Confirm recommendations contain only available players.
- [ ] Confirm the final pick completes the draft and blocks extra picks.
- [ ] Confirm completion produces no crash or stale recommendation or roster state.

## Pass/Fail Summary

- Overall result: Pending
- Automated result: Pass - 27 test files and 305 tests, lint, TypeScript, Prisma validation, and production build.
- Manual result: Pending
- Blocking issues: Manual QA could not be executed because the in-app browser controller was unavailable.
- Non-blocking issues:
- Task 12 completion status: Unchecked
- QA completed by:
- QA completed on:

## Notes

- Use drafts created specifically for this QA run where practical.
- Delete only QA drafts created during this run.
- Record exact reproduction details for any failed or unclear step.
- Do not change production behavior or test expectations during exit validation.
- Retry the manual checklist in a browser-capable session before checking Phase 4 Task 12 complete.
