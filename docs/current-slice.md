# Current Slice: Change the New-Draft Default Position to Team 1

## Completion Status

Complete. The Team 1 correction passed focused and full automated validation. Phase 4 Task 12 then resumed and completed using the user's manual QA attestation recorded in `docs/qa/manual-phase-4-qa.md`. No later phase has been promoted.

## Source Context

Phase 4 exit QA found one approved product correction: the New Draft Setup form currently defaults Draft Position to 2, but the desired default is position 1.

The value comes from the shared `defaultLeagueSetupInput`. That input supplies:

- the setup form's initial value;
- automatic default creation in the draft action;
- automatic default/fallback creation in the workspace loader;
- the derived default `userTeamId` produced by the shared league-setup builder.

The previous Team 2 default was deliberately preserved during Phase 4 Task 1. The user has now explicitly approved replacing it with Team 1. Existing persisted drafts must retain their stored user-team identity; only newly created default drafts and newly opened setup forms change.

Phase 4 Task 12 remains paused during this correction. After implementation and validation, resume the Phase 4 exit QA rather than marking Task 12 complete automatically.

## Goal

Make position 1 the single authoritative default for new draft setup and automatic default draft creation, with exact tests and documentation aligned to Team 1.

## Scope

### Goals

- Change `defaultLeagueSetupInput.userDraftPosition` from `2` to `1`.
- Make New Draft Setup render Draft Position `1` initially.
- Make the shared default setup builder derive `team-1` as the default user team.
- Make automatic default creation through the action pass `team-1` to the repository.
- Make automatic/fallback creation through the workspace loader pass `team-1` to the repository.
- Update only tests whose expectations describe the shared default path.
- Update the two Phase 4 documentation statements that explicitly define Team 2 as the default.
- Preserve non-default configuration and all existing persisted drafts.

### Non-Goals

- Changing team count, roster construction, rounds, draft type, or scoring defaults.
- Changing the valid draft-position range or user-team derivation rules.
- Migrating or rewriting persisted drafts that already use Team 2 or another user team.
- Changing scenario fixtures, curated scenarios, replay data, or tests that independently use Team 2.
- Renaming teams or changing snake draft order.
- Changing recommendation, persistence, reset, deletion, history, or workbench behavior.
- Checking Phase 4 Task 12 complete inside this correction slice.
- Promoting another project phase.

## Implementation Design

### Shared Default

Update `src/lib/leagueSetup.ts`:

```ts
export const defaultLeagueSetupInput: LeagueSetupInput = {
  teamCount: 12,
  userDraftPosition: 1,
  // existing remaining defaults unchanged
};
```

Do not add a form-specific override. `DraftSetupForm`, `createDraftAction`, and `loadDraftWorkspace` already consume the shared input and should inherit the change without production edits.

### Focused Regression Expectations

Update only default-path assertions:

- `src/lib/leagueSetup.test.ts`
  - default input still produces `defaultLeagueSettings`;
  - default user team becomes `team-1`.
- `src/components/DraftSetupForm.test.tsx`
  - initial `userDraftPosition` value becomes `1`.
- `src/app/actions/draftActions.test.ts`
  - automatic default creation passes `userTeamId: "team-1"`.
- `src/lib/draftWorkspaceLoader.test.ts`
  - every automatic default/fallback creation expectation passes `userTeamId: "team-1"`.

Do not change unrelated Team 2 fixtures. Tests for hydration, repositories, draft order, scenarios, serialization, validation, and explicit non-default inputs should keep their independent identities.

### Documentation Consistency

Update the explicit default statements:

- `docs/tasks.md`
  - Task 1 scope says the default is the 12-team, 16-round Team 1 league;
  - Task 1 acceptance says default input produces Team 1 identity.
- `docs/design/phase-4-developer-tools-simulator.md`
  - supported MVP configuration says the 12-team, 16-round Team 1 configuration is the default form state.

This is a user-approved default correction, not a change to supported capabilities or architecture.

## Implementation Steps

1. Change the shared default draft position to `1` in `leagueSetup.ts`.
2. Update the exact default builder and setup-form assertions.
3. Update automatic action and workspace-loader default-creation assertions to `team-1`.
4. Update the Team 2 default statements in `docs/tasks.md` and the Phase 4 design document.
5. Run focused default setup, form, action, and loader tests.
6. Run the full test suite, lint, TypeScript, Prisma validation, and production build because Phase 4 exit gates must remain valid after the production correction.
7. Manually open New Draft Setup, confirm Draft Position starts at 1, create the default draft, and confirm Team 1 is the selected user team after refresh/resume.
8. Report results and resume Phase 4 exit QA planning. Do not check Task 12 automatically.

## Expected Files

- `src/lib/leagueSetup.ts`
- `src/lib/leagueSetup.test.ts`
- `src/components/DraftSetupForm.test.tsx`
- `src/app/actions/draftActions.test.ts`
- `src/lib/draftWorkspaceLoader.test.ts`
- `docs/tasks.md`
- `docs/design/phase-4-developer-tools-simulator.md`

No form production component, action production code, loader production code, persistence schema, scenario, package, lockfile, project-scope, roadmap, or architecture change is expected.

The seven-file blast radius is a mechanical fan-out from one shared default plus two pre-existing documentation statements. It does not represent seven independent behavior changes.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/leagueSetup.test.ts src/components/DraftSetupForm.test.tsx src/app/actions/draftActions.test.ts src/lib/draftWorkspaceLoader.test.ts
npm test
npm run lint
npx tsc --noEmit
npm run prisma:validate
npm run build
```

Expected result:

- Focused shared-default, form, action, and loader tests pass.
- All Vitest files and tests pass.
- ESLint exits with no errors or warnings.
- TypeScript no-emit validation passes.
- Prisma schema validation passes without schema changes.
- The production Next.js build succeeds.
- No dependency or lockfile changes are introduced.

## Focused Manual QA

1. From an existing persisted draft, open Start New Draft.
2. Confirm Team Count remains 12, roster counts remain unchanged, rounds remain 16, Draft Type remains Snake, and Scoring remains PPR.
3. Confirm Draft Position initially displays `1`.
4. Cancel and reopen setup; confirm Draft Position again starts at `1`.
5. Create the default draft without editing any fields.
6. Confirm the resulting draft identifies Team 1 as the user's team and retains the 12-team, 16-round configuration.
7. Make a Team 1 pick and confirm the user roster and recommendations update normally.
8. Refresh and reopen the draft from history; confirm Team 1 identity and draft state persist.
9. Open a previously persisted Team 2 draft and confirm its stored user-team identity is unchanged.

## Acceptance Criteria

- `defaultLeagueSetupInput.userDraftPosition` is exactly `1`.
- New Draft Setup initially renders Draft Position `1`.
- The default builder returns `userTeamId: "team-1"` with otherwise unchanged default league settings.
- Automatic action creation passes `team-1` to the repository.
- Automatic/fallback loader creation passes `team-1` to the repository.
- Explicit non-default draft positions still derive the matching user team.
- Existing persisted drafts retain their stored user-team identity.
- Team count, rounds, roster slots, draft type, and scoring defaults are unchanged.
- Independent Team 2 fixtures and scenario behavior are unchanged.
- Tasks and Phase 4 design documentation describe Team 1 as the new default.
- Focused tests, full suite, lint, TypeScript, Prisma validation, production build, and focused manual QA pass.
- No dependency, lockfile, migration, or persisted-data rewrite is introduced.
- Phase 4 Task 12 remains unchecked pending resumed exit QA.
- No later phase is started.

## Failure Handling

- If changing the shared default alters an unrelated explicit Team 2 fixture, stop and inspect whether that fixture incorrectly depends on the default before editing it.
- If a persisted draft changes user-team identity after the correction, stop and report a persistence-boundary regression rather than adding migration logic.
- If the setup form still displays `2`, stop and trace its initialization before adding a second default.
- If an automated expectation appears to represent an explicit non-default Team 2 case, leave it unchanged.
- If an environment-dependent exit gate fails, report it separately and do not check Task 12.

## Follow-Up Slice

After this correction passes, restore Phase 4 Task 12 as the active slice, record the corrected default-path QA in `docs/qa/manual-phase-4-qa.md`, complete any remaining manual evidence, and only then check Task 12.

## Slice Review

- Smallest meaningful increment: yes. One user-visible default changes through its existing shared source.
- Executable by a lower-reasoning pass: yes. The constant, exact assertions, documentation statements, commands, and manual checks are specified.
- Avoids unnecessary architecture changes: yes. Existing consumers continue using the shared builder.
- Blast radius reasonable: yes. The seven files are one production constant, four direct regression files, and two documentation corrections.
- Review/revert comfort: yes. The correction is a one-line behavior change with explicit expectation updates.
- Observable/testable acceptance criteria: yes. Form value, derived team identity, repository inputs, persistence behavior, and unchanged defaults are directly observable.
