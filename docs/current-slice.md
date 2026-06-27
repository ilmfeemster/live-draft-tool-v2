# Current Slice: Restore Clean TypeScript Validation

## Source Context

Task 10: Wire Recommendation Engine Into Draft Workflow.

The first Task 10 wiring slice is implemented and passes its targeted tests, the full Vitest suite, and lint. Its required `npx tsc --noEmit` validation is blocked by four pre-existing test-only typing issues outside the wiring files.

This slice removes that validation blocker before Task 10 presentation/load validation continues.

## Goal

Restore a clean TypeScript validation baseline by fixing only the reported test-type mismatches, without changing production behavior, weakening assertions, or broadening into runtime refactors.

## Current TypeScript Failures

`npx tsc --noEmit` currently reports:

1. `src/lib/draftRepository.test.ts`
   - The fake workspace mapper reads `draft.rankingSnapshot.id`, but `FakeDraftRecord` declares only `rankingSnapshot.rankings` even though fake records already store an id.
2. `src/lib/leagueSettingsSnapshot.test.ts`
   - The test accesses `snapshot.rosterSlots` directly even though the serializer intentionally returns a recursive JSON-value union.
3. `src/lib/rankingSnapshot.test.ts`
   - The test accesses `snapshot[0].player` directly even though each serialized array element is intentionally typed as a recursive JSON-value union.
4. `src/lib/recommendations.scenario.test.ts`
   - Component lookup helpers use a Vitest assertion for existence, but TypeScript cannot use that matcher to narrow the returned value before direct `.delta` access.

These failures are in test support code. The newly wired page, Draft Room, Recommendations panel, and workflow test report no TypeScript errors.

## Scope

### Goals

- Align the fake repository record type with the fake record shape it already creates.
- Add explicit runtime narrowing in snapshot tests before accessing serialized JSON properties.
- Make scenario component helpers return a definitely present score component.
- Preserve the meaning and strength of every existing assertion.
- Run focused tests for all affected files.
- Restore a clean full test, lint, and TypeScript validation baseline.

### Non-Goals

- Changing production serializers, repository code, recommendation code, types, or runtime behavior.
- Broadening JSON serializer return types.
- Replacing meaningful reference-identity assertions with weaker existence assertions.
- Using `any`, `@ts-ignore`, `@ts-expect-error`, or unchecked double casts to silence errors.
- Refactoring fake database infrastructure.
- Adding new product behavior or UI validation.
- Checking off Task 10.
- Updating `docs/tasks.md` or other planning documents.

## Expected Files

- `docs/current-slice.md`
- `src/lib/draftRepository.test.ts`
- `src/lib/leagueSettingsSnapshot.test.ts`
- `src/lib/rankingSnapshot.test.ts`
- `src/lib/recommendations.scenario.test.ts`

Do not modify production files.

## Implementation Details

### Fake Repository Record

In `src/lib/draftRepository.test.ts`:

- Add `id: string` to the nested `rankingSnapshot` property of `FakeDraftRecord`.
- Do not change fake record creation or mapping behavior; both already create and consume the id.
- Do not loosen `rankingSnapshot` to `unknown` or an index signature.

### League Settings Snapshot Narrowing

In the `serializes to fresh objects instead of reusing input references` test:

- Keep assertions that:
  - the serialized snapshot deeply equals the source settings;
  - the root snapshot is a fresh object;
  - the first roster slot is a fresh object;
  - its `eligiblePositions` array is fresh.
- Narrow the serialized JSON shape before nested access:
  1. Confirm the snapshot is a non-null, non-array object.
  2. Read `rosterSlots` through the narrowed record.
  3. Confirm `rosterSlots` is an array and the first entry is a non-null, non-array object.
  4. Confirm the first entry's `eligiblePositions` is an array.
  5. Perform the existing reference-identity assertions on those narrowed values.
- Throw explicit test errors if an expected serialized shape is absent. Do not rely on casts alone.

### Ranking Snapshot Narrowing

In the equivalent fresh-object test:

- Keep assertions that:
  - the serialized snapshot deeply equals the source rankings;
  - the first serialized ranking is a fresh object;
  - its nested player is a fresh object.
- Narrow the first serialized JSON entry before nested access:
  1. Read the first entry.
  2. Confirm it is a non-null, non-array object.
  3. Read its `player` property through the narrowed record.
  4. Confirm `player` is a non-null, non-array object.
  5. Perform the existing reference-identity assertions.
- Throw explicit test errors for unexpected shape. Do not weaken the serializer test.

### Scenario Component Helpers

In `src/lib/recommendations.scenario.test.ts`:

- Update both `getRosterFitComponent` and `getScoreComponent`.
- After `.find`, use an explicit `if (!component) { throw new Error(...) }` guard.
- Return `component` after the guard so TypeScript infers `RecommendationScoreComponent` rather than `RecommendationScoreComponent | undefined`.
- Preserve the current descriptive error messages.
- Remove the redundant `expect(...).toBeDefined()` matcher if the explicit guard replaces it.
- Do not change scenario data or assertions.

## Implementation Steps

1. Review the exact reported failures.
   - Read `docs/current-slice.md`.
   - Read only the affected ranges in the four test files.
   - Read serializer return types only as needed to implement correct narrowing.

2. Align the fake repository type.
   - Add the existing snapshot id field to `FakeDraftRecord`.

3. Narrow serialized JSON values in tests.
   - Add explicit object/array guards in the league-settings and ranking snapshot fresh-reference tests.
   - Preserve all original deep-equality and reference-identity assertions.

4. Make scenario component lookups definite.
   - Replace matcher-only existence checks with explicit throwing guards.

5. Run focused validation.
   - Run `npm test -- src/lib/draftRepository.test.ts src/lib/leagueSettingsSnapshot.test.ts src/lib/rankingSnapshot.test.ts src/lib/recommendations.scenario.test.ts`.
   - Run `npx tsc --noEmit`.
   - If TypeScript reports a new error caused by these edits, fix only that error.

6. Run full validation.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npx tsc --noEmit` again after final edits.
   - Stop if any unrelated new blocker appears; do not broaden scope.

7. Stop after restoring the validation baseline.
   - Do not begin Task 10 presentation/load validation.
   - Do not check off Task 10.

## Acceptance Criteria

- `npx tsc --noEmit` exits successfully.
- All four affected test files pass.
- The full Vitest suite passes.
- Lint passes.
- Snapshot tests still prove deep equality and fresh nested references.
- Scenario tests retain all existing behavior assertions.
- Fake repository runtime behavior is unchanged.
- No `any`, suppression comments, unchecked double casts, or weakened assertions are introduced.
- No production files are changed.

## Suggested Tests

- Focused Vitest run for the four affected test files.
- Full Vitest regression suite.
- ESLint.
- TypeScript no-emit validation.

## Validation Notes

Expected commands:

```txt
npm test -- src/lib/draftRepository.test.ts src/lib/leagueSettingsSnapshot.test.ts src/lib/rankingSnapshot.test.ts src/lib/recommendations.scenario.test.ts
npx tsc --noEmit
npm test
npm run lint
npx tsc --noEmit
```

## Follow-Up Slice

After this validation baseline is clean:

- Complete Task 10 presentation/load validation for rendered score-backed reasons and hydrated-workspace wiring, then check Task 10 complete if all acceptance criteria pass.

## Slice Review

- Smallest meaningful increment: yes. It removes the exact blocker preventing clean validation of the completed wiring slice.
- Concrete enough for implementation: yes. Each error, narrowing rule, preserved assertion, and validation command is explicit.
- Avoids unnecessary architecture changes: yes. It is test-only type hygiene with no runtime changes.
- Blast radius reasonable: yes. Four focused test files are affected.
- Review/revert comfort: yes. Changes are local declarations and guards.
- Observable/testable acceptance criteria: yes. Focused tests, full tests, lint, and TypeScript validation provide direct evidence.
