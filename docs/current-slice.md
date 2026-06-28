# Current Slice: Add Portable Import and Export Round Trips

## Source Context

Phase 4 Task 7: Add Portable Import and Export Round Trips.

Tasks 1 through 6 are complete. The project now has a typed Scenario V1 contract, deterministic JSON serialization, untrusted-input validation, and atomic deterministic replay. This slice connects those pure boundaries to the existing typed `DraftWorkspace` so manual, hydrated persisted, and transient replay workspaces can be exported and imported without touching Prisma, React, or active application state.

This is a domain portability slice, not the final workbench UI. Export produces a typed scenario that the existing serializer can turn into JSON. Import composes the existing parser and replay coordinator and preserves whether failure happened during validation or replay.

## Goal

Add a pure workspace export mapper and a pure JSON import coordinator, then prove semantic export/import round trips reproduce dynamic configuration, ordered pick history, target draft state, and deterministic recommendation inputs and output.

## Scope

### Goals

- Map the existing typed `DraftWorkspace` boundary into `ScenarioV1`.
- Export only canonical source inputs, not derived or persistence/UI data.
- Filter assigned draft picks into ordered scenario history.
- Add expected pick-number and team assertions from the typed draft order.
- Default `appliedPickCount` to the active assigned-pick count.
- Allow an explicit valid `appliedPickCount` override so a longer known history can open at an earlier target.
- Generate safe deterministic metadata defaults with an optional scenario ID and lightweight name override.
- Accept optional caller-supplied informational provenance without reading a clock or external state.
- Compose `parseScenarioV1Json` and `replayScenarioV1` for portable JSON import.
- Preserve validation failures separately from replay failures.
- Return the normalized imported scenario together with successful replay output.
- Prove semantic round trips for manual, hydrated persisted, and transient replay workspaces.
- Keep both import and export local, explicit, synchronous, and side-effect free.

### Non-Goals

- File picker, download, upload, clipboard, drag-and-drop, or browser UI.
- Persisting imported scenarios or exported files.
- Querying or mutating the draft repository.
- Accepting Prisma records, raw persistence JSON, or React state in the mapper.
- Requiring byte-for-byte equality after re-export.
- Autosave, saved scenario collections, or curated scenario files.
- Scenario-session reset, restart, or dirty-state behavior.
- Ranking-file import, ranking editing, or Phase 5 ranking management.
- Changing the Scenario V1 contract, parser, serializer, replay coordinator, engines, or persistence shape.
- Adding package dependencies.
- Beginning Phase 4 Task 8.

## Public Portability Boundary

Add `src/lib/scenarioPortability.ts` with the following public API:

```ts
export const DEFAULT_EXPORTED_SCENARIO_ID = "exported-scenario" as const;
export const DEFAULT_EXPORTED_SCENARIO_NAME = "Exported Draft Scenario" as const;

export type ExportWorkspaceScenarioOptions = {
  scenarioId?: string;
  name?: string;
  appliedPickCount?: number;
  provenance?: ScenarioProvenance;
};

export type ImportScenarioV1Result =
  | {
      ok: true;
      scenario: ScenarioV1;
      draft: Draft;
      recommendations: PlayerRecommendation[];
    }
  | {
      ok: false;
      stage: "validation";
      errors: ScenarioValidationError[];
    }
  | {
      ok: false;
      stage: "replay";
      error: ScenarioReplayError;
    };

export function exportWorkspaceToScenarioV1(
  workspace: DraftWorkspace,
  options?: ExportWorkspaceScenarioOptions,
): ScenarioV1;

export function importScenarioV1Json(json: string): ImportScenarioV1Result;
```

Keep this module domain-facing. It may import existing types and pure scenario functions, but it must not import the repository, actions, Prisma, React, browser APIs, or components.

## Export Mapping

### Metadata

- Default `metadata.id` to `DEFAULT_EXPORTED_SCENARIO_ID`.
- Default `metadata.name` to `DEFAULT_EXPORTED_SCENARIO_NAME`.
- Use a non-empty `scenarioId` or `name` override when supplied.
- If either override is empty, do not manufacture an invalid scenario: fall back to its safe default.
- Omit description and tags; this slice does not add a metadata editor.
- Include `options.provenance` only when supplied.
- Copy provenance into a fresh object, including optional `sourceId` only when present.
- Do not call `Date`, `Date.now`, random ID generation, crypto APIs, or persistence. The caller supplies `exportedAt` when provenance is desired.

Metadata and provenance remain informational and must not affect any other mapped section.

### League, Draft, Ranking, and User Context

Map:

- `workspace.leagueSettings` -> `scenario.leagueSettings`.
- `workspace.draft.teams` -> `scenario.draftConfiguration.teams`.
- `workspace.rankings` -> `scenario.rankingContext.rankings`.
- `workspace.draft.userTeamId` -> `scenario.userTeamContext.userTeamId`.

Create fresh nested arrays and objects for settings, roster slots, eligible positions, teams, rankings, and players. The mapper must not mutate the workspace or retain mutable nested references from it.

Do not include `workspace.draft.id`. A persisted draft ID may be represented only through optional informational provenance supplied by the caller.

### Ordered Pick History

1. Read `workspace.draft.picks` in ascending `pickNumber` order using a copied array.
2. Keep only picks with an assigned `playerId`.
3. Map each assigned pick to:

```ts
{
  playerId: pick.playerId,
  expectedPickNumber: pick.pickNumber,
  expectedTeamId: pick.teamId,
}
```

The existing valid workspace invariant is that assigned picks form the leading draft history. The mapper should not fill gaps, infer players, or repair a malformed typed workspace. A resulting invalid scenario will be rejected by the public parser during round-trip/import validation.

### Replay Target

- Default `appliedPickCount` to the number of assigned picks mapped into history.
- Permit an explicit integer from `0` through the mapped history length, inclusive.
- Throw a concise `RangeError` for an invalid trusted-code override. This is mapper option misuse, not untrusted JSON validation.
- An override changes only `replayTarget.appliedPickCount`; it does not truncate or reorder history.

This allows a caller with longer known history to export an intermediate investigation target while keeping the full ordered input.

## Import Composition

Implement `importScenarioV1Json` as a narrow composition:

1. Call `parseScenarioV1Json(json)`.
2. On parse/validation failure, return `{ ok: false, stage: "validation", errors }` unchanged.
3. On validation success, call `replayScenarioV1(parsed.scenario)`.
4. On replay failure, return `{ ok: false, stage: "replay", error }` unchanged.
5. On replay success, return the normalized scenario, target draft, and recommendations.

Do not catch and relabel impossible programmer errors from the replay coordinator. Normal untrusted import failures are represented by the parser and replay result contracts.

Import must not install state, invoke callbacks, navigate, persist, or mutate the source JSON or parsed scenario.

## Semantic Round-Trip Rules

For an exported workspace serialized with `serializeScenarioV1` and imported with `importScenarioV1Json`, compare domain meaning rather than persistence/session identity:

- League settings are equal.
- Team configuration is equal.
- Ranking snapshot and order are equal.
- User-team identity is equal.
- Ordered assigned pick history is equal.
- The imported target draft matches the workspace's domain-relevant draft state at the selected target.
- Draft ID is excluded from equality because replay intentionally uses `SCENARIO_REPLAY_DRAFT_ID`.
- Recommendation input values and full deterministic recommendation output are equal.
- Draft invariants remain valid.

When an explicit target is earlier than exported history, build the expected state by applying only the leading target picks through the normal Draft State Engine transition. Do not compare it with the later source workspace state.

## Testing Strategy

Add `src/lib/scenarioPortability.test.ts` with compact dynamic workspaces. Use existing builders, hydration, draft transitions, serializer, parser, replay coordinator, and recommendation engine rather than hand-building derived final state.

### Required Test Cases

1. Export defaults produce schema version `1`, safe metadata, no provenance, and target equal to assigned-pick count.
2. Non-empty scenario ID/name overrides and complete optional provenance are copied into metadata.
3. Empty metadata overrides fall back to safe defaults.
4. Export maps dynamic settings, canonical teams, embedded ranking order, user-team identity, and assigned picks with assertions.
5. Export sorts copied picks by pick number and does not mutate source order.
6. Exported scenarios omit draft ID, current pick, rosters, availability, recommendations, persistence records, and UI state.
7. Export creates fresh nested objects/arrays and does not mutate the workspace.
8. A valid explicit target override is preserved without truncating history.
9. Negative, fractional, or history-exceeding target overrides throw `RangeError`.
10. Import validation failures preserve `stage: validation` and structured errors.
11. Import replay failures preserve `stage: replay` and the indexed replay error. The test may stub or compose a typed coordinator case only if it can remain proportional; do not weaken validation to manufacture a public invalid JSON path.
12. Manual in-memory workspace export -> serialize -> import reproduces target state and recommendation output.
13. Hydrated persisted-style workspace export -> serialize -> import reproduces the same domain state without mutating or querying persistence.
14. A transient replay workspace, optionally followed by normal local picks, exports and reimports semantically.
15. A non-default league configuration survives round trip.
16. Informational provenance can change or be removed without changing imported draft or recommendations.
17. Re-export need not be byte-identical, but parsed domain sections remain semantically equal.
18. Round-tripped drafts satisfy existing invariants.

For the replay-stage import branch, prefer a small dependency injection seam only if necessary to test the union without exporting production-only hooks. Do not alter the replay coordinator or public validator solely for branch coverage; validation-stage and successful composition are required, while direct replay failure is already covered by Task 6.

## Implementation Steps

1. Add `src/lib/scenarioPortability.ts` with metadata defaults, fresh workspace mapping, ordered assigned-pick extraction, target handling, and staged import composition.
2. Add `src/lib/scenarioPortability.test.ts` with mapper, option, failure-stage, manual, hydrated, transient, metadata-independence, non-default, invariant, and semantic round-trip coverage.
3. Run focused portability, serialization, validation, replay, repository-mapping, workflow, and recommendation tests, then the full suite, lint, and TypeScript validation.
4. If all acceptance criteria and validation pass, check only Phase 4 Task 7 complete in `docs/tasks.md`. Do not begin Task 8.

## Expected Files

- `src/lib/scenarioPortability.ts`
- `src/lib/scenarioPortability.test.ts`
- `docs/tasks.md` only to mark Phase 4 Task 7 complete after validation passes

Do not modify the Scenario V1 contract, serializer, validator, replay coordinator, domain types, repository, Prisma, actions, or UI unless an approved interface proves impossible to consume. If that occurs, stop and report the exact conflict rather than broadening the slice.

## Automated Validation

Run from the repository root in this order:

```text
npm test -- src/lib/scenarioPortability.test.ts src/lib/scenarioSerialization.test.ts src/lib/scenarioValidation.test.ts src/lib/scenarioReplay.test.ts src/lib/draftRepositoryMapping.test.ts src/lib/draftWorkflow.test.ts src/lib/recommendations.test.ts
npm test
npm run lint
npx tsc --noEmit
```

Expected result:

- Focused portability and supporting boundary/regression tests pass.
- The full Vitest suite passes.
- ESLint exits successfully with no errors or warnings.
- TypeScript no-emit validation exits successfully.
- No dependency or lockfile change is introduced.

No browser or database manual QA is required because this slice is pure and does not integrate file controls or persistence. Automated semantic round trips are the acceptance evidence.

## Acceptance Criteria

- The exporter consumes `DraftWorkspace` and trusted mapping options only.
- Exported scenarios contain canonical source inputs and no authoritative derived, persistence, or UI state.
- Assigned picks become ordered player inputs with expected pick/team assertions.
- The default replay target equals active assigned-pick count; a valid override preserves longer history.
- Metadata defaults are safe and deterministic; optional provenance is caller supplied and informational.
- Export returns fresh nested data and does not mutate or persist the workspace.
- Import uses the shared parser/validator and replay coordinator with distinguishable failure stages.
- Successful import returns the normalized scenario, target draft, and authoritative recommendations.
- Manual, hydrated persisted-style, and transient workspaces round-trip semantically.
- Round trips preserve dynamic league configuration, rankings, user-team identity, ordered history, target state, recommendation inputs/output, and draft invariants.
- Provenance changes do not affect replay output.
- No byte-for-byte re-export equality is required.
- No repository, Prisma, React, browser API, or package dependency is introduced.
- Focused tests, the full suite, lint, and TypeScript validation pass.
- Only Phase 4 Task 7 is checked complete after implementation validation.
- Task 8 is not started.

## Failure Handling

- If `DraftWorkspace` lacks a required Scenario V1 source input, stop and report the missing field rather than reading persistence or UI state.
- If a valid typed workspace exports to JSON rejected by the shared parser, stop and report the exact mapping mismatch; do not bypass validation.
- If semantic round-trip differs only by replay draft ID, exclude only that identity field as documented; do not weaken other state comparisons.
- If an explicit target override is invalid, throw `RangeError` before creating the scenario rather than clamping it silently.
- If a focused round-trip exposes an existing hydration or recommendation inconsistency, report it without changing unrelated behavior.
- If automated validation exposes an unrelated failure, report it without expanding the slice.

## Follow-Up Slice

After this slice is implemented and reviewed, plan Phase 4 Task 8: Add the Curated Scenario Library. Do not begin it automatically.

## Slice Review

- Smallest meaningful increment: yes. It makes the completed scenario boundaries portable for every typed workspace without adding UI or persistence.
- Concrete enough for implementation: yes. The APIs, defaults, mapping rules, target behavior, staged import, comparisons, tests, files, and commands are explicit.
- Avoids unnecessary architecture changes: yes. One pure module composes existing workspace, serializer, validator, replay, and recommendation boundaries.
- Blast radius reasonable: yes. Two code/test files are expected, plus the Task 7 checkbox after successful validation.
- Review/revert comfort: yes. The work is additive, synchronous, and isolated from runtime state and storage.
- Observable/testable acceptance criteria: yes. Exact mapper output, failure staging, and semantic round trips are directly asserted with typed fixtures.
