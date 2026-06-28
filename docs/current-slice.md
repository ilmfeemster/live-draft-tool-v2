# Current Slice: Add Transient Scenario Sessions and Reset/Restart

## Source Context

Phase 4 Task 10: Add Transient Scenario Sessions and Reset/Restart.

Tasks 1 through 9 are complete. Scenario JSON can be validated, replayed, imported, exported, selected from a curated library, and inspected through engine-owned recommendation diagnostics. Existing DraftRoom manual and hydrated persisted sessions still use server actions and repository mutations. This slice adds the pure transient session model that Task 11 will connect to workbench controls.

The persistence boundary must remain explicit: transient scenario and restarted-manual sessions use only existing pure draft transitions in memory. They never call the repository or server actions. Persisted DraftRoom behavior is not changed in this slice.

## Goal

Add a pure discriminated transient-session model that supports local pick/undo exploration, baseline-aware dirty tracking, scenario reset through fresh validation/replay, zero-pick restart with the same configuration, and a reusable confirmation policy for Task 11.

## Scope

### Goals

- Create a transient scenario session from successful JSON import.
- Retain the source JSON and normalized scenario needed for later reset/export/UI context.
- Store current draft, rankings, league settings, recommendations, baseline draft, and dirty status.
- Route local pick and undo through `draftPlayerInDraft` and `undoLastDraftPick`.
- Recompute recommendations after every accepted local transition.
- Mark a session dirty only when its current draft differs from its baseline.
- Clear dirty status when local transitions return exactly to the baseline.
- Reset a scenario by reparsing and replaying its retained source JSON.
- Restart either transient mode at a fresh zero-pick draft with the same settings, rankings, and user-team identity.
- Return restart as a transient manual session, not a scenario-target session.
- Expose a small dirty-only confirmation policy for reset, restart, and replacement.
- Preserve validation/replay failure data during initial load and reset.
- Prove the module has no persistence or action dependencies.

### Non-Goals

- Integrating sessions into `DraftRoom` or React state.
- Adding scenario selector, file import/export controls, reset/restart buttons, labels, or layout.
- Calling `window.confirm` inside domain/session code.
- Calling server actions, repositories, Prisma, or database APIs.
- Autosaving transient sessions or adding persistence tables.
- Converting a transient restart into a persisted draft.
- Changing existing persisted pick, undo, reset, new-draft, or confirmation behavior.
- Global `beforeunload`, navigation blocking, crash recovery, or session recovery.
- Caching a reset snapshot as the authoritative reset mechanism.
- Changing scenario, replay, portability, Draft State, or Recommendation Engine behavior.
- Adding a state-management or package dependency.
- Beginning Phase 4 Task 11.

## Public Session Boundary

Add `src/lib/scenarioSession.ts`.

Use public types equivalent to:

```ts
export const TRANSIENT_MANUAL_DRAFT_ID = "transient-manual" as const;

export type TransientSessionCore = {
  draft: Draft;
  baselineDraft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  recommendations: PlayerRecommendation[];
  isDirty: boolean;
};

export type TransientScenarioSession = TransientSessionCore & {
  kind: "scenario";
  sourceJson: string;
  scenario: ScenarioV1;
};

export type TransientManualSession = TransientSessionCore & {
  kind: "manual";
};

export type TransientDraftSession =
  | TransientScenarioSession
  | TransientManualSession;

export type TransientSessionLoadResult =
  | { ok: true; session: TransientScenarioSession }
  | Extract<ImportScenarioV1Result, { ok: false }>;

export type TransientSessionResetResult = TransientSessionLoadResult;

export type TransientDestructiveAction =
  | "reset"
  | "restart"
  | "replace";

export function createTransientScenarioSession(
  sourceJson: string,
): TransientSessionLoadResult;

export function draftPlayerInTransientSession(
  session: TransientDraftSession,
  playerId: string,
): TransientDraftSession;

export function undoLastPickInTransientSession(
  session: TransientDraftSession,
): TransientDraftSession;

export function resetTransientScenarioSession(
  session: TransientScenarioSession,
): TransientSessionResetResult;

export function restartTransientSession(
  session: TransientDraftSession,
): TransientManualSession;

export function requiresTransientSessionConfirmation(
  session: TransientDraftSession,
  action: TransientDestructiveAction,
): boolean;
```

Local naming may vary narrowly, but keep one discriminated union and avoid classes, reducers, contexts, or event frameworks.

## Session Creation

`createTransientScenarioSession` should:

1. Call `importScenarioV1Json(sourceJson)`.
2. Return validation or replay failures unchanged when import fails.
3. On success, create a `kind: "scenario"` session.
4. Store the original `sourceJson` exactly for future reset.
5. Store the normalized imported `scenario`.
6. Use imported scenario rankings and league settings.
7. Use the replayed target draft and recommendations as current values.
8. Retain the replayed target draft as `baselineDraft` for dirty comparison only.
9. Set `isDirty` to `false`.

Do not serialize the normalized scenario back over the original JSON. Reset must exercise the same raw source and import boundary again.

The shared `draft`/`baselineDraft` reference is safe at creation because existing transitions are immutable. Do not deep-clone merely to create a second reference.

## Local Pick and Undo

### Pick

`draftPlayerInTransientSession` should:

1. Call `draftPlayerInDraft(session.draft, playerId)` exactly once.
2. If the returned draft is the same reference, return the original session unchanged.
3. Otherwise recompute recommendations from the next draft, session rankings, session settings, and next draft user-team ID.
4. Return the same session kind and source context with updated draft/recommendations.
5. Recalculate dirty status by comparing the next draft with `baselineDraft`.

The function must not pre-validate player availability with a second draft-rule implementation.

### Undo

`undoLastPickInTransientSession` follows the same pattern with `undoLastDraftPick`:

- Same-reference no-op returns the original session.
- Accepted undo recomputes recommendations.
- Dirty status reflects divergence from the baseline, not merely whether an action occurred.

This means:

- Undoing a baseline scenario pick makes the scenario dirty.
- Re-applying the same player through the canonical transition can return the session to a clean baseline.
- Adding and then undoing an exploratory pick can return the session to clean.
- A restarted manual session becomes dirty after a pick and clean again when that pick is undone.

## Baseline Equality

Add one private draft equality helper used only for dirty tracking.

Compare complete typed draft value relevant to the session:

- Draft ID.
- Team count and rounds.
- User-team ID.
- Current pick number.
- Team identities/order.
- Generated pick fields/order and assigned player IDs.

A direct deterministic structural comparison such as `JSON.stringify(left) === JSON.stringify(right)` is acceptable because both values are trusted normalized in-memory `Draft` objects with stable property order and no cycles.

Do not compare recommendations for dirtiness. They are derived from draft state and ranking context.

## Reset Scenario

`resetTransientScenarioSession` accepts only `TransientScenarioSession` and must:

1. Call `createTransientScenarioSession(session.sourceJson)`.
2. Re-run byte checks, parsing, validation, and full deterministic replay.
3. On success, return a newly reconstructed clean scenario session.
4. On failure, return the original validation/replay failure shape and no replacement session.

Do not restore `baselineDraft`, cached recommendations, or `scenario` directly. Those fields support comparison and display but are not the reset authority.

This design lets Task 11 keep the active session unchanged when reset fails.

## Restart Configured Draft

`restartTransientSession` accepts either transient session kind and must:

1. Create a fresh draft with `hydrateDraftFromSettings` using:
   - `TRANSIENT_MANUAL_DRAFT_ID`.
   - The active session's league settings.
   - The active draft's user-team ID.
   - No pick history.
2. Recompute recommendations using the full active ranking snapshot.
3. Return `kind: "manual"`.
4. Set both current draft and baseline draft to the fresh zero-pick value.
5. Preserve rankings and league settings as typed values.
6. Set `isDirty` to `false`.
7. Drop scenario-only source JSON and metadata from the returned type.

Restart does not mutate or delete a persisted draft and does not call persisted reset. It creates an isolated transient manual workspace.

## Confirmation Policy

`requiresTransientSessionConfirmation` provides policy only; Task 11 owns the native prompt and whether an action proceeds.

- `restart` and `replace` return `session.isDirty` for either transient kind.
- `reset` returns `session.isDirty` for a scenario session.
- `reset` returns `false` for a transient manual session because scenario reset is not an available operation in that mode.
- Clean sessions return `false`.

Do not store confirmation state in the session or invoke browser APIs.

## Recommendation Recalculation

Use one private helper equivalent to:

```ts
generatePlayerRecommendations({
  draft,
  rankings: session.rankings,
  leagueSettings: session.leagueSettings,
  userTeamId: draft.userTeamId,
});
```

Use it after accepted pick, accepted undo, and restart. Scenario reset receives freshly recomputed recommendations from the existing import/replay path.

Do not reuse stale recommendations or calculate availability/rosters in the session module.

## Persistence Boundary

`src/lib/scenarioSession.ts` may import only pure domain/scenario modules and types needed for:

- Draft hydration.
- Draft pick/undo transitions.
- Recommendation generation.
- Scenario import.

It must not import:

- `draftRepository` or repository mapping.
- Server actions.
- Prisma.
- React or Next.js navigation.
- Browser APIs.

Existing persisted workflows remain untouched because this slice does not modify `DraftRoom`, actions, loaders, or repositories.

## Testing Strategy

Add `src/lib/scenarioSession.test.ts` with small scenarios loaded through the public JSON path. Reuse a curated scenario where useful and build focused typed fixtures only where a specific transition is easier to observe.

### Required Test Cases

1. Successful import creates a clean `kind: scenario` session at the declared target with normalized source context and recommendations.
2. Validation and replay failures remain staged and create no session.
3. A local scenario pick uses the canonical transition, updates recommendations, remains transient, and marks dirty.
4. A rejected/no-op local pick returns the original session reference.
5. Undo uses the canonical transition and recomputes recommendations.
6. Adding then undoing an exploratory pick returns exactly to the baseline and clears dirty status.
7. Undoing a baseline pick marks dirty; re-applying the same player restores the baseline and clears dirty status.
8. Reset after exploration reparses/replays source JSON and returns the exact declared target, recommendations, and clean status.
9. Reset does not trust a mutated/corrupted cached `baselineDraft`; successful output still comes from source JSON.
10. Reset failure returns validation/replay errors and no partial replacement session.
11. Restart from a scenario produces a zero-pick `kind: manual` session with the same settings, rankings, user-team identity, full availability implied by draft state, and fresh recommendations.
12. Restart from an already transient manual session returns a new clean zero-pick baseline.
13. A restarted manual session becomes dirty after a local pick and clean after undo.
14. Dirty scenario reset/restart/replacement require confirmation; clean equivalents do not.
15. Dirty transient manual restart/replacement require confirmation; manual reset does not.
16. Repository/server-action spies or injected fakes remain untouched throughout local pick, undo, reset, and restart tests.
17. Existing persisted DraftRoom action tests continue to pass unchanged.

Tests should compare transition results with direct `draftPlayerInDraft`/`undoLastDraftPick` output and exact Recommendation Engine output, proving reuse rather than parallel behavior.

## Implementation Steps

1. Add `src/lib/scenarioSession.ts` with the discriminated session types, public creation/transition/reset/restart/policy functions, private draft equality, and recommendation helper.
2. Add `src/lib/scenarioSession.test.ts` with public import, transition equivalence, dirty-baseline, fresh reset, restart, confirmation, failure, and no-persistence coverage.
3. Run focused session, portability, replay, curated, Draft State, workflow, DraftRoom, action, and repository tests, then the full suite, lint, and TypeScript validation.
4. If all acceptance criteria and validation pass, check only Phase 4 Task 10 complete in `docs/tasks.md`. Do not begin Task 11.

## Expected Files

- `src/lib/scenarioSession.ts`
- `src/lib/scenarioSession.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 10 complete after validation passes

Do not modify `DraftRoom`, components, actions, repositories, Prisma, scenario contracts/data, replay, portability, Draft State, Recommendation Engine, or domain types. If the session cannot be expressed by composing those existing public functions, stop and report the exact contract conflict rather than expanding scope.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/scenarioSession.test.ts src/lib/scenarioPortability.test.ts src/lib/scenarioReplay.test.ts src/lib/curatedScenarios.test.ts src/lib/draftState.test.ts src/lib/draftWorkflow.test.ts src/components/DraftRoom.test.tsx src/app/actions/draftActions.test.ts src/lib/draftRepository.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused transient-session and persisted-workflow regression tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because this slice adds a pure unintegrated session boundary. Task 11 will own UI confirmation and workbench interaction QA.

## Acceptance Criteria

- Successful scenario import creates a clean transient scenario session at its declared target.
- Local transient picks and undo use existing pure Draft State transitions and recompute recommendations.
- Dirty status represents actual divergence from the appropriate baseline and clears when state returns to it.
- Reset reparses and replays retained source JSON rather than restoring cached state.
- Reset failure exposes structured failure and no partial replacement session.
- Restart creates a clean zero-pick transient manual session with the same settings, rankings, and user-team identity.
- Restarted sessions use a deterministic transient ID and no persisted identity.
- Dirty destructive reset/restart/replacement actions require confirmation; clean actions proceed without it.
- Transient operations import no repository, action, Prisma, React, Next.js, or browser code and cause no persistence writes.
- Existing persisted manual/hydrated workflows and confirmations remain unchanged.
- Recommendations are deterministic and current after pick, undo, reset, and restart.
- No autosave, recovery system, package dependency, or final workbench UI is introduced.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- Only Phase 4 Task 10 is checked complete after implementation validation.
- Task 11 is not started.

## Failure Handling

- If import or reset fails, return its existing staged failure shape; do not convert it into an empty or partial session.
- If a local transition returns the same draft reference, preserve the original session and recommendations.
- If dirty comparison cannot be deterministic over normalized `Draft`, stop and define a small explicit field comparison; do not compare recommendations or UI state.
- If restart would require persisted data not present in the session, report the missing typed input rather than reading the repository.
- If a focused test reveals an existing persisted-flow regression, stop and report it instead of changing persisted semantics in this slice.
- If automated validation exposes an unrelated failure, report it without expanding scope.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 11: Integrate the Focused Developer Workbench Controls. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It establishes the transient state/persistence boundary and reset/restart semantics before adding controls.
- Concrete enough for implementation: yes. Session types, creation, transitions, equality, reset authority, restart, confirmation policy, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. One pure module composes existing functions without React state libraries, repositories, or event abstractions.
- Blast radius reasonable: yes. One production module, one focused test, and the completion checkbox are expected.
- Review/revert comfort: yes. The slice is additive, synchronous, pure, and not connected to existing persisted UI behavior.
- Observable/testable acceptance criteria: yes. Exact session state, reference behavior, dirty transitions, fresh replay, zero restart, confirmation policy, recommendations, and persistence isolation are directly asserted.
