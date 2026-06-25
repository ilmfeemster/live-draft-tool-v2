# Current Slice: Configure Unit Test Runner

## Source Task

`docs/test-tasks.md` Task 1: Configure Unit Test Runner.

## Goal

Add the minimum automated test infrastructure needed to run deterministic TypeScript business-logic tests.

This slice should make `npm test` real without committing the project to a broad testing stack.

## User-Visible Increment

No app UI or runtime behavior should change.

The developer-visible increment is:

```txt
npm test
```

runs successfully from the command line.

## Problem

Phase 1 testing should focus on Draft State Engine confidence, but the project does not yet have an automated test runner.

Before adding draft order, draft transition, invariant, or workflow tests, the project needs a small test foundation that can import TypeScript source files and path aliases.

## Recommended Approach

Use Vitest as the initial unit test runner.

Reason:

- It is lightweight and TypeScript-friendly.
- It can test pure business logic without browser or React setup.
- It keeps the first testing slice small and reversible.

Tradeoffs:

- Adds one dev dependency and updates `package-lock.json`.
- Does not provide browser, React component, or coverage tooling yet.

This recommendation stops being appropriate if the immediate target becomes browser workflows, component interactions, or coverage reporting. Those should remain separate later slices.

## Goals

- Install a lightweight TypeScript-friendly unit test runner.
- Add an `npm test` script.
- Add test configuration for the existing `@/*` TypeScript path alias.
- Add one small test that proves the runner can import project source.
- Mark Task 1 complete in `docs/test-tasks.md`.

## Non-Goals

- Draft order test coverage.
- Draft state transition test coverage.
- Recommendation scoring test coverage.
- React component tests.
- Browser or Playwright tests.
- Coverage thresholds.
- CI setup.
- Snapshot testing.
- Broad test helper abstractions.
- Production behavior changes.

## Expected Files

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `src/lib/draftOrder.test.ts`
- `docs/test-tasks.md`
- `docs/current-slice.md`

Avoid changing app components, draft behavior, recommendation behavior, seed data, styling, or roadmap/project scope docs.

## Implementation Steps

1. Install Vitest.
   - Run `npm install --save-dev vitest`.
   - Confirm only test-runner dependency changes are introduced.
   - Do not add React Testing Library, Playwright, jsdom, coverage packages, or CI packages.

2. Add the test script.
   - In `package.json`, add:

```json
"test": "vitest run"
```

   - Keep existing scripts unchanged.

3. Add Vitest config.
   - Create `vitest.config.ts`.
   - Import `defineConfig` from `vitest/config`.
   - Import `fileURLToPath` from `node:url`.
   - Configure the `@` alias to resolve to `./src`.
   - Use the default Node environment.

4. Add the first smoke-style source test.
   - Create `src/lib/draftOrder.test.ts`.
   - Import `describe`, `expect`, and `it` from `vitest`.
   - Import at least one draft order helper through the `@` alias so alias resolution is proven.
   - Keep assertions intentionally small.
   - Suggested assertion:
     - `generateSnakeDraftOrder(2, 2)` returns four picks.
     - The pick team order is `team-1`, `team-2`, `team-2`, `team-1`.

5. Update `docs/test-tasks.md`.
   - Mark `Task 1: Configure Unit Test Runner` as complete.
   - Do not mark Task 2 or later tasks complete.

6. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.

## Acceptance Criteria

- Vitest is installed as a dev dependency.
- `package.json` includes `test: vitest run`.
- `vitest.config.ts` exists.
- Vitest resolves the existing `@/*` alias.
- `src/lib/draftOrder.test.ts` proves the test runner can import project source.
- The first test is intentionally small and does not try to cover all draft order behavior.
- `docs/test-tasks.md` marks only Task 1 complete.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

No browser or manual draft smoke test is required for this slice because runtime app behavior is not intended to change.

If UI or draft behavior changes while implementing this slice, the implementation has drifted beyond scope.

## Slice Review

- Smallest meaningful increment: yes, it only makes automated tests runnable.
- Concrete enough for implementation: yes, the dependency, script, config, smoke test, docs update, and validation commands are named.
- Avoids unnecessary architecture changes: yes, no test utilities, React testing, browser testing, CI, or coverage infrastructure are introduced.
- Blast radius reasonable: yes, expected changes are package metadata, one config file, one tiny test file, test-task docs, and this slice plan.
- Review/revert comfort: yes, it is isolated from production behavior.
- Observable/testable acceptance criteria: yes, `npm test`, lint, build, and the Task 1 checkbox verify the slice.
