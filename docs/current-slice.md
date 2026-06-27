# Current Slice: Create and Persist Configured Drafts

## Source Context

Phase 4 Task 2: Create and Persist Configured Drafts.

Task 1 is complete. `buildLeagueSetup` now validates setup input, enforces ranking capacity, generates deterministic `LeagueSettings`, and derives `userTeamId`.

The repository already accepts typed `LeagueSettings`, rankings, and user-team identity, persists settings as JSON, and hydrates a dynamic draft workspace. The missing work is to place the completed builder at both creation entry points: explicit configured creation and automatic first-run/default creation.

## Goal

Add a validated configured-draft server action and route all default creation through `buildLeagueSetup`, while preserving the existing repository schema, existing UI-facing `createNewDraftAction()` contract, and existing draft workflows.

## Scope

### Goals

- Add an explicit server action that accepts `LeagueSetupInput`.
- Validate configured creation with `buildLeagueSetup(input, seedRankings.length)` before repository access.
- Return structured setup errors without calling the repository for invalid input.
- Create valid configured drafts through the existing `createDraftWorkspace` repository function.
- Continue using the seed ranking snapshot and automatic draft naming.
- Preserve the existing no-argument `createNewDraftAction(): Promise<DraftWorkspace>` contract used by the current Draft Room.
- Route `createNewDraftAction()` through the same builder using `defaultLeagueSetupInput`.
- Route automatic first-run and stale-summary fallback creation through the same default builder.
- Prove a non-default configured draft persists and hydrates with identical settings, team order, pick order, and user-team identity.
- Preserve all existing pick, undo, reset, delete, history, and load behavior.

### Non-Goals

- Adding or changing the draft setup UI.
- Modifying `DraftRoom`, `DraftStatusPanel`, page routing, or client behavior.
- Changing repository production code, repository interfaces, hydration, or snapshot formats.
- Adding a Prisma migration or normalized settings columns.
- Editing settings on an existing draft or migrating picks.
- Changing rankings or adding ranking selection/management.
- Changing Draft State Engine or Recommendation Engine behavior.
- Adding alternate draft or scoring formats.
- Adding package dependencies.
- Beginning Phase 4 Task 3.

## Configured Creation Contract

In `src/app/actions/draftActions.ts`, add an exported discriminated result for configured creation:

```ts
export type CreateConfiguredDraftActionResult =
  | {
      ok: true;
      workspace: DraftWorkspace;
    }
  | {
      ok: false;
      errors: LeagueSetupValidationError[];
    };

export async function createConfiguredDraftAction(
  input: LeagueSetupInput,
): Promise<CreateConfiguredDraftActionResult>;
```

The action should:

1. Call `buildLeagueSetup(input, seedRankings.length)`.
2. Return `{ ok: false, errors }` immediately when validation fails.
3. Avoid calling `createDraftWorkspace` on failure, which also prevents draft and nested ranking-snapshot writes.
4. On success, call `createDraftWorkspace` once with:
   - `name: formatAutomaticDraftName()`
   - the generated `leagueSettings`
   - `rankings: seedRankings`
   - the generated `userTeamId`
5. Return `{ ok: true, workspace }`.

Repository and unexpected infrastructure errors should continue to reject rather than be converted into setup-validation errors. Only `buildLeagueSetup` failures belong in the action's error branch.

## Default Action Compatibility

Keep the current exported signature:

```ts
export async function createNewDraftAction(): Promise<DraftWorkspace>;
```

It must build `defaultLeagueSetupInput` against `seedRankings.length` and use the generated settings and user-team identity for repository creation.

The current Draft Room expects a `DraftWorkspace`, so do not change this action to return a discriminated result in this slice. If the committed default setup unexpectedly fails validation, throw an internal configuration error containing the validation messages. Do not silently fall back to the old hard-coded values.

The configured and default actions may share a private helper inside `draftActions.ts`, but do not add a general service abstraction or another file for two straightforward call sites.

## First-Run Loader Behavior

Update `src/lib/draftWorkspaceLoader.ts` so automatic creation when no usable draft exists also calls:

```ts
buildLeagueSetup(defaultLeagueSetupInput, seedRankings.length)
```

Use its generated settings and user-team identity in the existing injected repository call. Remove direct creation-time dependence on `defaultLeagueSettings` and the hard-coded `defaultUserTeamId`.

The loader must retain:

- Selected draft loading.
- Latest draft fallback.
- Stale summary handling.
- Existing automatic naming.
- Existing repository injection used by focused tests.
- Existing actionable persistence error boundary and original error as its cause.

If the committed default setup is invalid, throw an internal configuration error rather than reverting to hard-coded settings. The loader's existing outer error boundary may wrap that error, but the cause must remain available.

## Persistence Boundary

Do not change `CreateDraftWorkspaceInput`, repository production code, Prisma schema, or snapshot mappers.

The existing repository path remains authoritative:

```text
LeagueSetupInput
      |
buildLeagueSetup
      |
LeagueSettings + userTeamId
      |
createDraftWorkspace
      |
JSON settings snapshot + ranking snapshot
      |
typed workspace hydration
```

Strengthen existing repository coverage to prove that a non-default settings object generated by `buildLeagueSetup` survives create and reload without losing:

- Team count.
- Derived rounds.
- Ordered roster slots and eligibility.
- Draft type and scoring format.
- User-team identity.
- Generated teams and snake pick order.

This is a test-only repository change. If the existing repository cannot round-trip the generated settings, stop and report the discrepancy rather than changing storage architecture inside this slice.

## Implementation Steps

1. Update `src/app/actions/draftActions.ts` with the configured action result, configured action, shared validation path, and default action compatibility.
2. Extend `src/app/actions/draftActions.test.ts` for valid configured creation, invalid no-write behavior, and default action equivalence.
3. Update `src/lib/draftWorkspaceLoader.ts` to build automatic defaults through `buildLeagueSetup`.
4. Extend `src/lib/draftWorkspaceLoader.test.ts` to retain exact default creation expectations and cover the default-builder failure cause if practical without weakening existing persistence-error assertions.
5. Strengthen the existing non-default test in `src/lib/draftRepository.test.ts` to use builder output and verify exact create/load round-trip behavior.
6. Run the focused tests, full test suite, lint, and TypeScript validation.
7. If every acceptance criterion and validation command passes, check only Phase 4 Task 2 complete in `docs/tasks.md`. Do not begin Task 3.

## Expected Files

- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `src/lib/draftWorkspaceLoader.ts`
- `src/lib/draftWorkspaceLoader.test.ts`
- `src/lib/draftRepository.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 2 complete after validation passes

The five code/test files form the maximum expected blast radius. Do not modify Prisma, repository production code, mappers, UI components, or existing domain types.

## Test Cases

### Server Action

1. A valid non-default setup returns `{ ok: true, workspace }`.
2. The valid action calls the repository exactly once with generated settings, `seedRankings`, derived user-team identity, and the automatic name.
3. An invalid field setup returns the exact builder errors and never calls the repository.
4. A capacity-invalid setup also returns errors and never calls the repository.
5. `createNewDraftAction()` still returns a bare workspace and supplies settings exactly equal to `defaultLeagueSettings` with `team-2`.
6. Repository failures from either valid creation path remain rejected errors rather than validation results.

### First-Run Loader

7. No-summary creation still supplies settings equal to `defaultLeagueSettings`, `seedRankings`, and `team-2`.
8. Stale-summary fallback uses the same generated defaults.
9. Selected/latest draft loading never creates a replacement workspace.
10. Existing persistence setup errors remain actionable and preserve their cause.

### Repository Round Trip

11. Build a non-default setup with `buildLeagueSetup` rather than hand-constructing persisted settings.
12. Create and reload that workspace through the injected fake repository.
13. Loaded settings exactly equal the builder output, including ordered roster slots.
14. Loaded draft teams, rounds, total picks, snake team order, and user-team identity match the generated configuration.
15. No empty pick rows are persisted at creation.

Assertions should validate exact settings and calls where behavior is deterministic, not merely that a workspace exists.

## Automated Validation

Run from the repository root in this order:

```txt
npm test -- src/app/actions/draftActions.test.ts src/lib/draftWorkspaceLoader.test.ts src/lib/draftRepository.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused action, loader, and repository tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No database or network connection is required because repository tests use the existing injected fake client.

## Acceptance Criteria

- Configured creation validates setup input against `seedRankings.length` before repository access.
- Valid configured input creates exactly one workspace through the existing repository boundary.
- Invalid configured input returns structured errors and creates no draft or ranking snapshot.
- The new configured action is ready for Task 3 UI consumption.
- Existing `createNewDraftAction()` remains source-compatible with the Draft Room.
- Explicit default creation and automatic first-run creation both use `defaultLeagueSetupInput` and `buildLeagueSetup`.
- Defaults remain behaviorally identical to `defaultLeagueSettings` and Team 2.
- A non-default generated configuration survives repository create/load hydration exactly.
- Generated teams and snake order match team count, rounds, and user draft position.
- Existing selected/latest loading, pick, undo, reset, delete, and persistence behavior remain unchanged.
- No Prisma schema, repository production, snapshot, domain-type, or UI changes are introduced.
- Focused tests, full tests, lint, and TypeScript validation pass.
- No package dependency is added.
- Only Phase 4 Task 2 is checked complete after validation passes.
- Task 3 is not started.

## Failure Handling

- If generated settings do not round-trip through the existing repository, stop and report the exact lost or changed field.
- If preserving the current no-argument action requires UI changes, stop and report the conflict instead of expanding into Task 3.
- If a builder failure reaches the repository, treat it as a slice defect; do not weaken validation assertions.
- If full validation exposes an unrelated failure, report it and do not broaden this slice to fix unrelated code.
- Do not change the Prisma schema, snapshot format, or repository contract merely to satisfy a test.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 3: Add the Draft Setup Workflow. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It creates a complete validated server/persistence path while deliberately preserving the existing UI contract.
- Concrete enough for implementation: yes. Action signatures, validation flow, loader behavior, persistence assertions, tests, and failure handling are explicit.
- Avoids unnecessary architecture changes: yes. It reuses the completed builder and existing repository/snapshot boundaries without migrations or new abstractions.
- Blast radius reasonable: yes. Five code/test files are expected, plus the Task 2 checkbox after successful validation.
- Review/revert comfort: yes. Changes are limited to creation entry points and focused tests; existing mutation flows are untouched.
- Observable/testable acceptance criteria: yes. Exact repository calls, validation errors, hydrated settings, teams, picks, and validation commands are directly checkable.
