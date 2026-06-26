# Current Slice: Align Phase 3 Recommendation Architecture Docs

## Source Task

Task 1: Align Phase 3 Architecture Documentation.

## Goal

Update project-level architecture and decision documentation so it reflects the approved Phase 3 Recommendation Engine design before implementation begins.

This slice is documentation-only. It should make the design durable in the core project docs without creating implementation code, implementation tasks, or a new design document.

## User-Visible Increment

- The project has a clear architecture-level description of the Phase 3 Recommendation Engine.
- Future implementation slices can rely on `docs/architecture.md` and `docs/decisions.md` without reinterpreting `docs/design/recommendation-engine.md`.
- Phase 3 boundaries are explicit before code work begins.

## Current Context

`docs/tasks.md` defines Phase 3 as the active focus. The first task is documentation alignment because `docs/design/recommendation-engine.md` says architecture and decision docs should be updated before implementation task planning begins.

The approved design establishes:

- A pure Recommendation Engine boundary.
- A bounded additive scoring model.
- Rank-derived base player value.
- Bounded context modifiers.
- Score-backed recommendation reasons.
- No persisted recommendation output.
- No AI reasoning, simulations, opponent modeling, live provider logic, or Phase 6 insight strategy.
- Continued support for dynamic league settings, roster settings, and draft configuration.

## Scope

### Goals

- Update `docs/architecture.md` with the Phase 3 Recommendation Engine boundary.
- Update `docs/architecture.md` with the bounded additive scoring model at architecture level.
- Update `docs/architecture.md` to state that recommendation explanations come from scoring components.
- Update `docs/architecture.md` to preserve independence from persistence, UI rendering, and draft sources.
- Update `docs/decisions.md` with the Phase 3 bounded additive scoring decision.
- Update `docs/decisions.md` with the Phase 3 score-backed explanation decision.
- Update `docs/decisions.md` with deferred alternatives that affect future development.

### Non-Goals

- Implementing recommendation code.
- Creating or updating implementation tests.
- Updating `docs/tasks.md`.
- Updating `docs/project.md`.
- Creating another design document.
- Redesigning the recommendation engine.
- Adding AI reasoning, simulations, opponent modeling, strategy profiles, or live provider behavior.
- Changing persistence, draft state, or UI architecture.

## Expected Files

- `docs/current-slice.md`
- `docs/architecture.md`
- `docs/decisions.md`

Do not modify `docs/tasks.md` during this slice unless the user explicitly asks for task tracking updates after implementation.

## Implementation Steps

1. Review the approved design and active task.
   - Read `docs/design/recommendation-engine.md`.
   - Read `docs/tasks.md`.
   - Read `docs/architecture.md`.
   - Read `docs/decisions.md`.

2. Update `docs/architecture.md`.
   - Expand the Recommendation Engine section.
   - State that the engine is a pure domain layer that consumes typed draft state, rankings, league settings, and user team identity.
   - State that the engine does not read persistence, mutate draft state, depend on React, or depend on manual/live draft sources.
   - Document the bounded additive scoring shape:

```txt
recommendation score =
base player value
+ bounded context modifiers
```

   - Name the initial scoring inputs: rank-derived base value, roster fit and timing, value opportunity, tier-drop risk, positional scarcity, and observed run pressure.
   - Document guardrails at architecture level: bounded modifiers, capped context score, deterministic tie breaking, and no persisted recommendation output.
   - State that explanations are selected from scoring components.
   - Preserve existing MVP non-goals and explicitly keep AI/ML, simulations, opponent modeling, and Phase 6 insight behavior out of Phase 3.

3. Update `docs/decisions.md`.
   - Add a dated Phase 3 decision for the bounded additive scoring model.
   - Add a dated Phase 3 decision for score-backed explanation generation.
   - Add a dated Phase 3 decision to keep the engine pure and derived rather than persisted.
   - Record deferred alternatives where useful: projections/VORP, opponent modeling, draft simulations, AI-generated explanations, and a generic modifier registry.
   - Keep each decision concise and focused on future development impact.

4. Validate documentation consistency.
   - Confirm `docs/architecture.md` does not contradict `docs/design/recommendation-engine.md`.
   - Confirm `docs/decisions.md` records decisions rather than implementation details.
   - Confirm the docs preserve dynamic league settings, roster settings, and draft configuration support.
   - Confirm no implementation tasks, code changes, or tests were added.

5. Stop after documentation alignment.
   - Do not begin Task 2.
   - Do not update `docs/current-slice.md` again unless the slice needs correction.
   - Summarize files changed and any design/documentation conflicts found.

## Acceptance Criteria

- `docs/architecture.md` describes the Recommendation Engine as a pure domain layer.
- `docs/architecture.md` documents the bounded additive scoring model at architecture level.
- `docs/architecture.md` states that explanations come directly from scoring components.
- `docs/architecture.md` keeps recommendation logic independent from persistence, UI rendering, and draft sources.
- `docs/decisions.md` records the Phase 3 scoring model decision.
- `docs/decisions.md` records the Phase 3 explanation model decision.
- `docs/decisions.md` records the pure/derived engine boundary or equivalent architecture decision.
- Deferred alternatives are documented without promoting them into Phase 3 scope.
- No implementation code is changed.
- `docs/tasks.md` is not modified.
- `docs/project.md` is not modified.

## Validation Notes

This is a documentation slice. Automated tests are not required.

Suggested validation:

- Review the diff for `docs/architecture.md`.
- Review the diff for `docs/decisions.md`.
- Confirm the diff contains no source code, tests, package, or task changes.

## Slice Review

- Smallest meaningful increment: yes. It aligns the core docs required before Phase 3 implementation work.
- Concrete enough for implementation: yes. The target files and exact documentation topics are listed.
- Avoids unnecessary architecture changes: yes. It documents the approved design without changing code architecture.
- Blast radius reasonable: yes. Expected changes are limited to two project docs plus this planning file.
- Review/revert comfort: yes. The slice is documentation-only and can be reviewed as a focused diff.
- Observable/testable acceptance criteria: yes. Criteria can be verified through document review and diff inspection.
