# Current Slice: Add Manual Full-Draft QA Checklist

## Source Task

`docs/test-tasks.md` Task 6: Add Manual Full-Draft QA Checklist.

## Goal

Create a repeatable manual QA checklist for validating that the Phase 1 manual draft simulator can complete a full MVP draft without breaking core draft behavior.

This slice should document the validation workflow only. It should not add automated browser tests or change runtime app behavior.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
docs/manual-full-draft-qa.md
```

defines a repeatable checklist another pass can follow to validate a complete 12-team, 16-round mock draft.

## Problem

Automated unit tests now cover draft order, draft state transitions, invariants, and basic recommendation updates. Phase 1 still needs a manual validation artifact for the full draft workflow because the MVP success criteria include completing a full live-style mock draft in the app.

The checklist should make manual validation consistent enough that pass/fail results can be compared across runs.

## Goals

- Add a concise manual QA checklist for a full 12-team, 16-round snake draft.
- Cover setup, pick entry, available-player removal, user roster tracking, recommendation updates, undo, duplicate prevention, and draft completion.
- Define evidence to record after the run.
- Mark Task 6 complete in `docs/test-tasks.md` after the checklist is created.

## Non-Goals

- Automated browser tests.
- React component tests.
- Playwright setup.
- New test runner configuration.
- Production code changes.
- UI redesign or workflow changes.
- New draft helpers or abstractions.
- Exhaustive recommendation strategy validation.
- Live provider or platform integration validation.
- Performance or accessibility audits.

## Expected Files

- `docs/manual-full-draft-qa.md`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing source files, package metadata, Vitest config, seed data, ranking data, or app UI for this slice.

## Checklist Document Shape

Create `docs/manual-full-draft-qa.md` with these sections:

- `# Manual Full-Draft QA Checklist`
- `## Purpose`
- `## Preconditions`
- `## Evidence To Record`
- `## Checklist`
- `## Pass/Fail Summary`
- `## Notes`

Keep the checklist practical and short enough to use during development. Prefer checkbox items over long prose.

## Required Checklist Coverage

The checklist must include validation for:

- starting from a clean local app run
- opening the draft tool
- confirming MVP settings are represented: 12 teams, 16 rounds, snake draft
- entering at least the first several picks manually
- confirming the active pick advances after each valid pick
- confirming drafted players disappear from the available player list
- confirming duplicate picks are blocked or cannot be selected again
- confirming user-team picks appear on the user roster
- confirming recommendations update after picks
- confirming undo restores the previous pick state
- continuing the draft through the final pick
- confirming the draft reaches completion without application failure
- spot-checking final drafted-player count against 192 total picks

## Implementation Steps

1. Create `docs/manual-full-draft-qa.md`.
   - Add the required sections listed above.
   - State that the checklist validates the Phase 1 MVP manual draft workflow.
   - Keep the wording executable by another developer without requiring hidden context.

2. Add preconditions.
   - Include running the app locally.
   - Include using the current seed rankings or current default app data.
   - Include starting from a fresh page state when possible.

3. Add evidence requirements.
   - Record date of run.
   - Record commit or branch.
   - Record browser used.
   - Record pass/fail result.
   - Record notes for any failed or unclear step.

4. Add checklist steps grouped by workflow.
   - Setup and initial state.
   - Early draft picks.
   - Available-player and duplicate behavior.
   - User roster behavior.
   - Recommendation behavior.
   - Undo behavior.
   - Full draft completion.

5. Add pass/fail summary fields.
   - Overall result.
   - Blocking issues.
   - Follow-up task links or notes.

6. Update `docs/test-tasks.md`.
   - Mark `Task 6: Add Manual Full-Draft QA Checklist` as complete.
   - Do not mark Task 7 complete.

7. Validate.
   - Review the checklist for clarity and completeness.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- `docs/manual-full-draft-qa.md` exists.
- Checklist covers the Phase 1 success path from app startup through draft completion.
- Checklist includes undo validation.
- Checklist includes duplicate-prevention validation.
- Checklist includes available-player removal validation.
- Checklist includes user-roster validation.
- Checklist includes recommendation-update validation.
- Checklist includes final draft completion validation.
- Checklist defines evidence to record for each run.
- Checklist defines pass/fail summary fields.
- No production source files are changed.
- No browser automation or new test dependencies are added.
- `docs/test-tasks.md` marks only Task 6 newly complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice creates the checklist; it does not require executing the full manual QA run as part of implementation. A future validation pass can run the checklist and record results.

If the checklist reveals ambiguity in the app workflow, document the ambiguity in the checklist notes rather than expanding this slice into UI or product changes.

## Slice Review

- Smallest meaningful increment: yes, it creates only the manual QA artifact required by Task 6.
- Concrete enough for implementation: yes, file names, sections, checklist coverage, docs update, and validation commands are listed.
- Avoids unnecessary architecture changes: yes, no source code, app workflow, or test infrastructure changes are planned.
- Blast radius reasonable: yes, expected changes are one new docs file, task tracking, and this slice plan.
- Review/revert comfort: yes, documentation-only and isolated.
- Observable/testable acceptance criteria: yes, checklist presence, required sections, task status, and validation commands verify the slice.
