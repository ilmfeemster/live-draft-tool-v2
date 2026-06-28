# Current Slice: Add Deterministic Replay Infrastructure

## Source Context

Phase 4 Task 6: Add Deterministic Replay Infrastructure.

Tasks 1 through 5 are complete. The project now has a portable Scenario V1 contract, deterministic serialization, and a pure parser/validator that establishes supported settings, canonical teams, ranking references, ordered pick assertions, history bounds, and replay-target bounds. This slice consumes that validated typed scenario and reconstructs draft state exclusively through the existing Draft State Engine transition.

The coordinator is orchestration, not a new engine. It creates a fresh base draft, applies the full history, retains the requested target state, and derives recommendations only after every supplied pick succeeds.

## Goal

Add a pure replay coordinator that deterministically reconstructs zero-pick, intermediate, and completed scenario targets, rejects any no-op engine transition atomically, and returns Recommendation Engine output equivalent to the manual path for the same inputs.

## Scope

### Goals

- Accept an already parsed and validated `ScenarioV1`.
- Create a fresh base draft with existing typed hydration.
- Use a fixed replay draft ID so metadata and provenance cannot affect domain output.
- Apply every history selection through `draftPlayerInDraft` in array order.
- Capture the state after exactly `replayTarget.appliedPickCount` successful transitions.
- Continue applying and validating history after an intermediate target.
- Treat any unchanged/no-op transition as replay failure.
- Return the failing pick index, player identity, attempted pick number, and a stable reason.
- Return no draft, target state, or recommendations on failure.
- Generate recommendations from the captured target only after full-history success.
- Prove deterministic equivalence with manual transitions for default and non-default configurations.
- Keep replay local, synchronous, pure, and independent of persistence and UI state.

### Non-Goals

- Parsing or revalidating untrusted JSON inside the coordinator.
- Reimplementing structural, reference, assertion, or safety-limit validation from Task 5.
- Hydrating picks directly through `pickHistory` or overlaying player IDs onto generated picks.
- Injecting rosters, availability, current pick, active team, or completion flags.
- Changing Draft State Engine behavior to accommodate a scenario.
- Persisting replayed picks, recommendations, or scenario sessions.
- Installing replay output into React state.
- Import/export mapping or UI.
- Step-forward, step-back, pause, animation, timing, or playback controls.
- Reset/restart or dirty-session behavior.
- Introducing a Draft Source interface, event bus, reducer framework, or provider abstraction.
- Adding package dependencies.
- Beginning Phase 4 Task 7.

## Public Replay Boundary

Add `src/lib/scenarioReplay.ts` with the following public API:

```ts
export const SCENARIO_REPLAY_DRAFT_ID = "scenario-replay" as const;

export type ScenarioReplayError = {
  code: "pick-rejected";
  pickIndex: number;
  playerId: string;
  pickNumber: number;
  message: string;
};

export type ScenarioReplayResult =
  | {
      ok: true;
      draft: Draft;
      recommendations: PlayerRecommendation[];
    }
  | {
      ok: false;
      error: ScenarioReplayError;
    };

export function replayScenarioV1(
  scenario: ScenarioV1,
): ScenarioReplayResult;
```

The coordinator accepts the normalized result of `parseScenarioV1Json`; it does not accept raw JSON. Task 7 may compose parsing and replay for import, but this slice keeps those pure boundaries separate.

## Deterministic Base Draft

Create the zero-pick candidate with:

```ts
hydrateDraftFromSettings({
  id: SCENARIO_REPLAY_DRAFT_ID,
  leagueSettings: scenario.leagueSettings,
  userTeamId: scenario.userTeamContext.userTeamId,
});
```

Do not pass scenario history into hydration. Every replay pick must visibly cross `draftPlayerInDraft`.

Use the fixed `SCENARIO_REPLAY_DRAFT_ID` rather than metadata ID, provenance source ID, a random value, or a timestamp. Scenario metadata is informational and must not alter reconstructed domain state or deterministic equality.

The validated `draftConfiguration.teams` is an assertion about the generated configuration; hydration remains the owner of constructing the draft teams and order.

## Replay Algorithm

1. Create the fresh base draft.
2. If `appliedPickCount` is zero, retain the base draft as the target.
3. Iterate over every `scenario.pickHistory` entry in array order.
4. Before each transition, record the current draft and its current pick number.
5. Call `draftPlayerInDraft(currentDraft, pick.playerId)` exactly once.
6. If the returned object is the same reference as the input draft, return a `pick-rejected` failure for that history index.
7. Otherwise advance the working draft.
8. When the successful applied count equals `appliedPickCount`, retain that immutable draft value as the target.
9. Continue through all remaining history entries even after capturing an intermediate target.
10. Only after the full history succeeds, generate recommendations for the retained target.
11. Return the target draft and recommendations.

Because existing transitions are immutable, retaining a prior target reference is sufficient. Do not deep-clone draft state between picks.

Task 5 guarantees target bounds for parsed scenarios. The coordinator may treat a missing target as an impossible programmer error; do not add a second public validation result or silently fall back to the base/full-history state.

## Failure Semantics

An unchanged transition is the Draft State Engine's rejection signal. Return:

- `code`: `pick-rejected`.
- `pickIndex`: zero-based index into `scenario.pickHistory`.
- `playerId`: attempted player identity.
- `pickNumber`: the candidate draft's `currentPickNumber` before the attempt.
- `message`: a stable developer-readable message identifying the rejected history entry.

Do not attempt to infer or duplicate every internal rejection rule. The error reports where replay stopped; Task 5 already supplies detailed structural/reference/assertion failures before a normal caller reaches replay.

On failure, the result must not expose:

- The working draft.
- The captured intermediate target.
- Partial recommendations.
- A callback or mutation that could install partial state.

The input scenario must remain unchanged.

## Recommendation Output

After full-history success, call:

```ts
generatePlayerRecommendations({
  draft: targetDraft,
  rankings: scenario.rankingContext.rankings,
  leagueSettings: scenario.leagueSettings,
  userTeamId: scenario.userTeamContext.userTeamId,
});
```

Return the engine's authoritative ordering and structured output unchanged. Do not filter, sort, recalculate, serialize, or persist it in the coordinator.

For a completed target, existing Recommendation Engine behavior should naturally return an empty list because no ranked players remain available. Do not special-case completion.

## Manual and Replay Equivalence

Tests should build the manual comparison state from the same zero-pick hydration and reduce the same leading target selections through `draftPlayerInDraft`. Compare:

- Full `Draft` value, including team count, rounds, user-team ID, current pick, teams, generated pick order, assigned player IDs, and completion shape.
- Drafted and available ranking identities derived from the draft and embedded rankings.
- User-team selections derived from picks.
- Full `PlayerRecommendation[]`, including order, totals, components, evidence, and reasons.

Do not compare transient metadata or introduce UI/persistence fields into equivalence.

## Testing Strategy

Add `src/lib/scenarioReplay.test.ts` with small validated fixtures. Build fixtures through `buildLeagueSetup`, serialize them, and pass them through `parseScenarioV1Json` before normal replay tests so configuration assumptions match the public path.

### Required Test Cases

1. Zero target returns the fresh configured base draft and its deterministic recommendations.
2. Intermediate target returns state after exactly the requested leading picks while the coordinator still validates later history.
3. Completed target returns a completed valid draft and empty recommendations.
4. Repeated replay of the same scenario returns deeply equal draft and recommendation output.
5. Changing metadata, tags, or provenance leaves replayed draft and recommendations unchanged.
6. Replay does not mutate the typed scenario.
7. A non-default team count, roster construction, round count, and user-team position replay successfully.
8. Manual and replay paths produce field-for-field equivalent draft state for the same target inputs.
9. Manual and replay paths produce exactly equal recommendation output.
10. Available-player identities and user-team picks derived from manual and replay drafts are equal.
11. A late no-op/rejected transition fails even when `appliedPickCount` targets an earlier valid state.
12. Failure identifies the zero-based history index, player ID, attempted current pick number, and stable error code.
13. A failed replay result contains no draft or recommendations.
14. Completed-state behavior is produced by normal engine transitions rather than direct flags or fabricated state.

The late-failure test may create a typed duplicate-player history after parsing a valid fixture to exercise coordinator defense directly. Do not weaken Task 5 validation or add an invalid JSON fixture just to reach replay.

## Implementation Steps

1. Add `src/lib/scenarioReplay.ts` with the fixed replay ID, result/error types, full-history transition loop, target capture, atomic failure, and post-success recommendation call.
2. Add `src/lib/scenarioReplay.test.ts` with parsed fixtures and zero, intermediate, completed, determinism, metadata-independence, non-default, manual-equivalence, and late-rejection coverage.
3. Run focused replay, validation, Draft State, workflow, and recommendation tests, then the full suite, lint, and TypeScript validation.
4. If all acceptance criteria and validation pass, check only Phase 4 Task 6 complete in `docs/tasks.md`. Do not begin Task 7.

## Expected Files

- `src/lib/scenarioReplay.ts`
- `src/lib/scenarioReplay.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 6 complete after validation passes

Do not modify the scenario contract, serializer, validator, hydration, Draft State Engine, Recommendation Engine, repository, Prisma, actions, or UI unless an approved interface proves impossible to consume. If that occurs, stop and report the exact conflict rather than broadening the slice.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/scenarioReplay.test.ts src/lib/scenarioValidation.test.ts src/lib/draftState.test.ts src/lib/draftWorkflow.test.ts src/lib/recommendations.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused replay, validation, Draft State, workflow, and recommendation tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because replay is pure and has no runtime integration in this slice. Inspecting exact draft and recommendation equality in automated tests is the acceptance evidence.

## Acceptance Criteria

- Replay creates a fresh zero-pick draft through existing hydration.
- Every supplied history item crosses `draftPlayerInDraft` in order.
- Zero, intermediate, and completed targets return valid reconstructed draft state.
- The entire history must succeed even when the retained target is intermediate.
- An unchanged/no-op transition returns a stable indexed error and no partial state.
- Recommendations are generated only after full-history success from the retained target and embedded inputs.
- Repeated replay of identical input produces identical draft and recommendation output.
- Metadata and provenance do not affect domain output.
- Manual and replay inputs produce equivalent draft state, available players, user-team picks, and recommendations.
- Dynamic non-default settings replay without fixed 12-team or 16-round assumptions.
- Completed output follows existing engine completion behavior and has no recommendations.
- The input scenario is not mutated.
- Replay performs no persistence, UI, timing, randomness, direct state injection, or alternate draft-rule behavior.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- No package dependency or unrelated architecture change is introduced.
- Only Phase 4 Task 6 is checked complete after implementation validation.
- Task 7 is not started.

## Failure Handling

- If hydration cannot create the same canonical base represented by a validated scenario, stop and report the exact mismatch; do not construct draft order manually in the coordinator.
- If `draftPlayerInDraft` cannot distinguish acceptance from rejection through its current immutable return contract, stop and report the conflict rather than changing engine semantics in this slice.
- If recommendation generation requires data not present in the validated scenario, stop and report the missing contract field rather than reading persistence or UI state.
- If a focused equivalence assertion exposes an existing manual-path inconsistency, report it without changing unrelated behavior.
- If automated validation exposes an unrelated failure, report it without expanding the slice.
- Do not bypass the engine by hydrating scenario picks directly or fabricating the target draft.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 7: Add Portable Import and Export Round Trips. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It adds the one orchestration layer needed to turn validated scenarios into trustworthy draft and recommendation output.
- Concrete enough for implementation: yes. The API, fixed identity, transition loop, capture timing, failure contract, recommendation call, comparisons, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. It composes existing hydration, Draft State, and Recommendation Engine functions without a new event or source abstraction.
- Blast radius reasonable: yes. Two code/test files are expected, plus the Task 6 checkbox after successful validation.
- Review/revert comfort: yes. The coordinator is additive, synchronous, pure, and unintegrated with persistence or UI.
- Observable/testable acceptance criteria: yes. Exact state/recommendation equality and indexed atomic failure are directly asserted with deterministic fixtures.
