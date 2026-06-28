# Phase 4 Exit QA Checklist

## Purpose

Validate that the completed Developer Tools & Simulator phase meets its product success criteria without regressing manual drafting, recommendations, persistence, or draft invariants.

## Evidence

- Date: 2026-06-28
- Commit or branch: Working tree validation before commit
- Browser: User-confirmed manual browser session; browser not specified
- App URL: Local app; URL not specified
- Tester: User
- Overall result: Pass
- Representative scenario reconstruction time: Passed the within-10-seconds criterion by user attestation
- Blocking issues: None
- Notes: Automated validation completed successfully. The user attested that manual sections A through F passed after the Team 1 default correction.

## Automated Gates

- [x] Full Vitest suite passes: 27 files, 305 tests.
- [x] ESLint passes with no errors or warnings.
- [x] TypeScript no-emit validation passes.
- [x] Prisma schema validation passes.
- [x] Production Next.js build passes.
- [x] No dependency or lockfile changes are introduced.

## Acceptance Evidence

- [x] Phase 4 Tasks 1 through 11 have automated, recorded manual, or accepted focused-QA evidence for every acceptance criterion.
- [x] Previously accepted active-draft deletion, disclosure, and player-draft scroll behavior remains functional.

## A. Default and Invalid Setup

- [x] Open a persisted workspace and confirm normal manual drafting is available without entering scenario mode.
- [x] Open Start New Draft and confirm the default values, derived rounds, `SNAKE`, and `PPR`.
- [x] Exercise invalid team count, draft position, roster count or total, bench-only construction, and insufficient ranking capacity where the UI permits.
- [x] Confirm invalid setup shows useful feedback and creates no Draft History entry.
- [x] Cancel setup and confirm the loaded workspace remains unchanged.

## B. Supported Non-Default Configuration

- [x] Create a small non-default draft with a non-default team count and draft position and nonzero QB, RB, WR, TE, FLEX, DST, K, and BENCH counts within ranking capacity.
- [x] Confirm rounds derive from total slots and the selected draft position maps to the correct user team.
- [x] Make persisted picks and confirm available players, active pick, roster, and recommendations update consistently.
- [x] Refresh and reopen from history; confirm settings, user-team identity, picks, roster, and recommendations hydrate identically.
- [x] Exercise undo and reset; confirm valid state and recommendation recomputation.

## C. Portable Scenario and Atomic Failure

- [x] Add representative persisted picks and export the non-default draft.
- [x] Record the source draft ID, settings, pick count, top recommendations, and Draft History count in Notes.
- [x] Import the exported file and confirm the transient scenario reproduces configuration, target pick count, available players, user roster, and recommendation inputs.
- [x] Confirm import does not add or modify a persisted Draft History entry.
- [x] Apply zero, intermediate, and maximum valid replay targets and confirm each displayed state.
- [x] Attempt an out-of-range replay target and confirm useful feedback without replacing the current state.
- [x] Import malformed or unsupported-version JSON and confirm a useful error while active state and persistence remain unchanged.
- [x] Re-import the same valid scenario, record elapsed time, and confirm visible target state appears within 10 seconds without manual pick entry.
- [x] Confirm repeated import produces the same draft state and recommendation ordering and totals.

## D. Transient Exploration and Diagnostics

- [x] Make a local scenario pick and undo it; confirm no persisted write or history change.
- [x] Inspect an uncapped recommendation and confirm its displayed total reconciles from engine-owned output.
- [x] Inspect a capped recommendation when available and confirm its displayed total reconciles from components and adjustments.
- [x] Confirm displayed score-backed reasons match the recommendation.
- [x] Create dirty transient state and confirm reset, restart, and replacement request confirmation.
- [x] Cancel each destructive confirmation once and confirm state remains unchanged.
- [x] Accept reset and confirm the declared replay target is reconstructed.
- [x] Make another local change, accept restart, and confirm a zero-pick transient manual draft with the same settings and rankings.
- [x] Export the transient state and confirm it remains importable through the public scenario path.

## E. Persistence Isolation and History

- [x] Return to the original persisted draft and confirm transient exploration changed neither its settings nor its picks.
- [x] Confirm persisted pick, undo, reset, refresh, and resume still use the persisted workflow.
- [x] Confirm inactive deletion removes history without changing the loaded workspace.
- [x] Confirm active deletion loads the deterministic replacement or fallback workspace.
- [x] Confirm browser Back does not revisit the deleted draft URL.
- [x] Confirm Developer Workbench and Active Drafts disclosures retain their accepted behavior.
- [x] Confirm recommendation and full-list drafting retain accepted page and table scroll behavior.

## F. Manual Draft and Invariants

- [x] Re-run the default full-draft workflow from `docs/qa/manual-full-draft-qa.md` and record the Phase 4 result here.
- [x] Confirm a player exists in exactly one location.
- [x] Confirm drafted players are unavailable and available players are not rostered.
- [x] Confirm drafted-player count matches pick progression.
- [x] Confirm every drafted player belongs to exactly one team.
- [x] Confirm undo restores valid state.
- [x] Confirm recommendations contain only available players.
- [x] Confirm the final pick completes the draft and blocks extra picks.
- [x] Confirm completion produces no crash or stale recommendation or roster state.

## Pass/Fail Summary

- Overall result: Pass
- Automated result: Pass - 27 test files and 305 tests, lint, TypeScript, Prisma validation, and production build.
- Manual result: Pass - user attestation for all checklist items after the Team 1 default correction.
- Blocking issues: None
- Non-blocking issues: None reported
- Task 12 completion status: Complete
- QA completed by: User
- QA completed on: 2026-06-28

## Notes

- Manual evidence is recorded from the user's explicit attestation that every checklist item passed.
- The Team 1 new-draft default correction passed focused and full automated validation before Task 12 completion.
- No production behavior, test expectation, dependency, or lockfile changed during final exit-QA documentation.
