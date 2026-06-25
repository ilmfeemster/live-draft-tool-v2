# Current Slice: Add Recommendation Unit Test Foundation

## Goal

Set up the first automated test path and cover the existing recommendation engine with a small, deterministic unit test suite.

This gives the project a repeatable way to validate high-value business logic before changing recommendation behavior further.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

runs recommendation-engine unit tests successfully.

## Problem

`docs/testing.md` says Phase 1 should prioritize unit tests for deterministic business logic, especially recommendation scoring.

The app currently has:

- `npm run lint`
- `npm run build`
- Manual validation notes

It does not yet have an automated test runner or any unit tests.

## Recommended Approach

Use Vitest for the first test runner.

Reason:

- It is lightweight and TypeScript-friendly.
- It fits the current Next.js + TypeScript codebase without adding UI testing ceremony.
- It can test pure functions in `src/lib/recommendations.ts` without browser or React setup.

Tradeoff:

- This adds a dev dependency and package-lock change.
- It does not cover UI behavior or full draft workflows yet.

This recommendation stops being sufficient once we need component interaction tests, browser workflow tests, or integration tests across draft state and UI. Those should be separate later slices.

## Goals

- Add a unit test runner.
- Add an `npm test` script.
- Add focused unit tests for the recommendation engine.
- Keep tests close to the business logic they validate.
- Document the new test command in task tracking.

## Non-Goals

- React component tests.
- Browser or Playwright tests.
- End-to-end workflow tests.
- Coverage thresholds.
- Snapshot tests.
- Testing styling or layout.
- Refactoring recommendation logic.
- Changing recommendation scores, modifiers, ordering, or reason strings.
- Adding broad test utilities before duplication exists.

## Expected Files

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `src/lib/recommendations.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing UI components, seed rankings, draft data, or recommendation implementation unless a test exposes a real bug caused by this slice.

## Test Scope

Create tests for these existing exported functions from `src/lib/recommendations.ts`:

- `calculateRankingScore`
- `calculateRosterNeedModifier`
- `calculateTierDropModifier`
- `calculateScarcityModifier`
- `generateTopRecommendations`

Use small inline test ranking objects instead of importing the full seed ranking dataset.

Do not assert every internal constant directly. Assert behavior that matters:

- Better overall rank produces the expected base score.
- Empty roster creates direct starter need for an unfilled position.
- Filled direct starter slots remove the direct starter need bonus.
- A lone best-tier player receives a tier-drop modifier and reason.
- Multiple same-tier options do not create a tier-drop modifier.
- Scarcity applies when too few nearby same-position options remain.
- Scarcity does not apply for `K` or `DST`.
- Top recommendations are sorted by score, then overall rank, then player name.
- Limit handling returns only the requested number of recommendations.
- Recommendation reasons include ranking, ADP when present, and applicable rule reasons.

## Implementation Steps

1. Install Vitest.
   - Run `npm install --save-dev vitest`.
   - This should update `package.json` and `package-lock.json`.
   - Do not add React Testing Library, Playwright, jsdom, or coverage packages in this slice.

2. Add the test script.
   - In `package.json`, add:

```json
"test": "vitest run"
```

   - Keep existing scripts unchanged.

3. Add Vitest config.
   - Create `vitest.config.ts`.
   - Use `defineConfig` from `vitest/config`.
   - Configure the `@` alias to resolve to `src`.
   - Use the default Node test environment.

4. Add recommendation unit tests.
   - Create `src/lib/recommendations.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import the recommendation functions from `./recommendations`.
   - Define a small helper for creating `RankingEntry` test objects.
   - Keep test data local and readable.
   - Prefer behavior-oriented test names.

5. Update `docs/tasks.md`.
   - Add a small `Testing Foundation` section under `Next Tasks` if one does not exist.
   - Mark these items complete:
     - Configure unit test runner
     - Add recommendation engine unit tests
   - Do not mark future integration, scenario, or UI tests complete.

6. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- Vitest is installed as a dev dependency.
- `package.json` includes an `npm test` script.
- `vitest.config.ts` exists and supports the `@` import alias.
- `src/lib/recommendations.test.ts` tests the exported recommendation functions listed above.
- Tests use small inline fixtures, not the full seed ranking dataset.
- Tests validate behavior without changing recommendation implementation.
- `docs/tasks.md` records the completed testing foundation work.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser smoke test is required for this slice because app behavior is not intended to change.

If the app UI changes while implementing this slice, that is a signal the scope has drifted.

## Slice Review

- Smallest meaningful increment: yes, it creates the first automated test path and covers one high-value pure logic module.
- Concrete enough for implementation: yes, the runner, files, functions, scenarios, and validation commands are named.
- Avoids unnecessary architecture changes: yes, it adds a minimal unit test runner without UI, browser, coverage, or broad utility layers.
- Blast radius reasonable: yes, expected changes are package metadata, one config file, one test file, task docs, and this slice plan.
- Review/revert comfort: yes, the slice is isolated from runtime code and can be reverted without changing app behavior.
- Observable/testable acceptance criteria: yes, `npm test`, lint, build, and the test file contents directly verify the slice.
