# Current Slice: Add Recommendation Boundary Scenarios

## Source Task

Task 9: Add Recommendation Scenario Validation.

This is the final Task 9 slice. Earlier slices covered core roster construction, QB timing, urgency, filled starters, bench depth, and late DEF/K behavior. This slice covers dynamic roster settings and persisted-workspace parity.

## Goal

Validate that Recommendation Engine output follows typed league configuration and remains identical across the existing persistence hydration boundary.

This is a boundary-validation slice. Production recommendation, persistence, and draft-state behavior must remain unchanged.

## Confidence Increment

- A non-default three-WR roster visibly changes recommendation ordering compared with the same draft under default slots.
- The same typed draft state and ranking snapshot produce identical recommendations before persistence and after repository reload.
- Task 9 scenario validation becomes complete.

## Current Context

Task 9 scenario coverage already proves:

- Heavy RB and heavy WR starts.
- Early, middle, and filled-slot QB behavior.
- Active and roster-irrelevant positional runs.
- Major tier cliffs and elite-value guardrails.
- Filled starters, FLEX relevance, bench depth, and late DEF/K behavior.
- Availability and deterministic full output in every Recommendation Engine scenario.

Two required boundaries remain:

1. At least one scenario must prove the engine follows non-default roster settings rather than MVP defaults.
2. Persisted-draft parity should be covered where practical.

The existing `createDraftRepository` accepts an injected fake database in tests and returns a typed `DraftWorkspace` through the same repository mapping used for application loads. This makes parity testing practical without a real database, network access, or persistence redesign.

## Scope

### Goals

- Add a dynamic three-WR roster scenario to `src/lib/recommendations.scenario.test.ts`.
- Compare the same draft and rankings under default and non-default roster slots.
- Add a persisted-workspace recommendation parity test to `src/lib/draftRepository.test.ts`.
- Compare pure in-memory draft progression against the reloaded typed workspace.
- Assert full recommendation equality, including ordering, scores, components, evidence, and reasons.
- Assert recommendations after reload contain only available players.
- Keep production code unchanged.
- Check Task 9 complete in `docs/tasks.md` only after all validation passes.

### Non-Goals

- Changing recommendation scoring, tuning, reason selection, or public types.
- Changing repository mapping, serialization, fake database behavior, Prisma, or schema.
- Adding a real database integration test.
- Testing UI wiring, server actions, or persisted workflow presentation; those belong to Task 10.
- Adding more strategy scenarios after Task 9 acceptance criteria are satisfied.
- Refactoring test helpers across files.
- Updating project, architecture, decision, testing, design, or roadmap documents.

If either boundary test exposes a production contradiction, stop and report it. Do not alter production behavior inside this validation-only slice.

## Expected Files

- `docs/current-slice.md`
- `src/lib/recommendations.scenario.test.ts`
- `src/lib/draftRepository.test.ts`
- `docs/tasks.md`

Do not modify production source files.

## Scenario 1: Dynamic Three-WR Roster Configuration

### Test Location

Append this scenario to `src/lib/recommendations.scenario.test.ts` using the existing local scenario helpers.

### Helper Adjustment

- Extend `createScenarioInput` with an optional `LeagueSettings` argument.
- Preserve its current default behavior when no override is supplied.
- Do not introduce a shared fixture module.

### Draft Setup

- Use a two-team, 16-round draft with `currentPickNumber` at `9`.
- Give the user:
  - one drafted QB;
  - one drafted RB;
  - two drafted WRs.
- Use opponent filler positions that do not create an RB or WR run.
- Available comparison players:
  - `config-rb` at overall rank `19`;
  - `config-wr` at overall rank `20`.
- Add three nearby available RBs and three nearby available WRs with flat tiers to neutralize scarcity and tier pressure.

### Non-Default League Settings

Create an explicit `LeagueSettings` value using the draft's team count and rounds, PPR snake settings, and these roster slots:

- one QB-only starter;
- one RB-only starter;
- three WR-only starters;
- one FLEX eligible for RB, WR, and TE;
- two BENCH slots eligible for all supported positions.

Use stable unique slot ids and labels. Do not mutate `defaultLeagueSettings`.

### Assertions

Generate recommendations twice from the same draft and rankings:

1. With default roster slots adjusted only for the two-team draft metadata.
2. With the explicit three-WR settings above.

Assert:

- Under default slots, `config-rb` ranks above `config-wr`.
- Under three-WR settings, `config-wr` ranks above `config-rb`.
- Under default slots:
  - `config-rb` has `roster_fit` timing `direct_starter_need`;
  - `config-wr` has timing `flex_need`.
- Under three-WR settings:
  - `config-wr` has `delta: 10`, direction `positive`, and timing `direct_starter_need`;
  - `config-rb` has `delta: 5`, direction `positive`, and timing `flex_need`.
- The three-WR recommendation includes `roster_fit:direct_starter_need` with exact text `Fills an open WR starter slot.`
- Both outputs contain only available players and remain deterministic.
- The settings objects are unchanged after recommendation generation.

This ordering reversal is the observable proof that configured roster slots—not MVP defaults—drive need.

## Scenario 2: Persisted Workspace Recommendation Parity

### Test Location

Add one focused test to `src/lib/draftRepository.test.ts` so it can reuse that file's injected fake database and repository fixture.

### Setup

- Import the pure `draftPlayerInDraft` transition and `generatePlayerRecommendations`.
- Create a non-default two-team, four-round workspace through `createDraftRepository(createFakeDraftDb())`.
- Use an explicit typed league setting and a compact ranking snapshot containing at least eight players across QB, RB, WR, and TE.
- Choose `team-1` as the user team.
- Select three distinct drafted player ids from the ranking snapshot.

### In-Memory Path

- Start from the created workspace's typed draft.
- Apply the three picks sequentially with `draftPlayerInDraft` without writing them through the repository.
- Generate `expectedRecommendations` from:
  - the resulting in-memory draft;
  - the created workspace rankings;
  - the created workspace league settings;
  - the created workspace user team id.

### Persisted And Reloaded Path

- Persist the same three player ids in the same order through `repository.draftPlayerInWorkspace`.
- Reload with `repository.getDraftWorkspaceById`.
- Fail explicitly if reload returns `null`.
- Generate `reloadedRecommendations` exclusively from the reloaded workspace's typed draft, rankings, league settings, and user team id.

### Assertions

- The reloaded draft equals the independently progressed in-memory draft for picks, current pick number, teams, rounds, and user team id.
- Reloaded rankings equal the original ranking snapshot.
- Reloaded league settings equal the original typed settings.
- `reloadedRecommendations` exactly equal `expectedRecommendations`, including:
  - player ordering;
  - total, base, and context scores;
  - components and evidence;
  - reasons.
- Neither result contains any of the three drafted player ids.
- Repeating generation from the reloaded workspace returns identical output.
- Recommendation input/output remains typed domain data; no raw database record or JSON storage shape is passed to the engine.

The fake repository test validates mapping and hydration parity. It does not claim real PostgreSQL integration coverage.

## Implementation Steps

1. Review the active boundary context.
   - Read `docs/current-slice.md`.
   - Read Task 9 in `docs/tasks.md`.
   - Read the Dynamic Roster Configuration and Loaded Persisted Draft scenarios in `docs/design/recommendation-engine.md`.
   - Read `src/lib/recommendations.scenario.test.ts`.
   - Read the public repository API and existing fake-client tests in `src/lib/draftRepository.ts` and `src/lib/draftRepository.test.ts`.

2. Add dynamic roster scenario support.
   - Extend only the local `createScenarioInput` signature to accept optional league settings.
   - Add a new `describe("recommendation boundary scenarios", ...)` block.
   - Construct the explicit default and three-WR settings inputs.
   - Assert the ordering reversal, exact roster-fit evidence/reason, availability, immutability, and determinism.

3. Add persisted recommendation parity.
   - Add one repository test using the existing fake database and public repository methods.
   - Build the independent in-memory draft path.
   - Persist and reload the same pick history.
   - Generate recommendations from both typed workspaces and assert full equality and availability.

4. Run validation before changing task status.
   - Run `npm test -- src/lib/recommendations.scenario.test.ts`.
   - Run `npm test -- src/lib/draftRepository.test.ts`.
   - Run `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/draftRepository.test.ts`.
   - Run `npm run lint`.
   - Fix only fixture or assertion failures caused by this slice.
   - If correct boundary data reveals a product contradiction, stop without changing production code or task status.

5. Complete Task 9 documentation.
   - After all validation passes, change only Task 9's checkbox in `docs/tasks.md` from `[ ]` to `[x]`.
   - Do not change Task 10 or Task 11.

6. Stop after Task 9.
   - Do not begin workflow wiring, UI changes, or Phase 3 completion validation.

## Acceptance Criteria

- A non-default three-WR configuration reverses the close RB/WR ordering produced by default slots.
- Roster-fit evidence and reason text identify the configured third WR starter need.
- Dynamic settings and scenario inputs are not mutated.
- In-memory and reloaded typed draft workspaces produce exactly equal recommendations.
- Persisted parity includes ordering, scores, components, evidence, and reasons.
- Drafted players remain excluded before and after reload.
- The persistence test uses the existing injected fake repository boundary and requires no database.
- Identical inputs remain deterministic.
- No production recommendation, persistence, draft-state, UI, or type code changes.
- Task 9 is checked complete only after all tests and lint pass.

## Suggested Tests

- Scenario test comparing default versus three-WR roster settings.
- Repository parity test comparing pure in-memory progression with persisted reload.
- Availability assertions for both boundary scenarios.
- Full-output determinism assertions for both boundary scenarios.

## Validation Notes

Expected validation commands:

```txt
npm test -- src/lib/recommendations.scenario.test.ts
npm test -- src/lib/draftRepository.test.ts
npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/draftRepository.test.ts
npm run lint
```

## Slice Review

- Smallest meaningful increment: yes. It completes the two remaining Task 9 boundaries without beginning workflow wiring.
- Concrete enough for implementation: yes. Settings, draft states, ranking comparisons, repository paths, parity inputs, assertions, and validation order are specified.
- Avoids unnecessary architecture changes: yes. It tests the existing pure engine and typed repository boundary without production changes or a real database.
- Blast radius reasonable: yes. Expected changes are limited to two test files and the Task 9 checkbox.
- Review/revert comfort: yes. The slice is isolated boundary validation and documentation status.
- Observable/testable acceptance criteria: yes. Ordering reversal, evidence, exact full-output parity, availability, determinism, and task completion are directly verifiable.
