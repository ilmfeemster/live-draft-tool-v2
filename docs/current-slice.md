# Current Slice: Tier Semantics Task 2 - Align Documentation and Decisions

## Completion Status

Planned. Implementation has not begun.

## Source Context

- Patch project: `docs/patches/tier-semantics-project.md`
- Patch task plan: `docs/patches/tier-semantics-tasks.md`
- Approved design: `docs/design/tier-semantics.md`
- Existing Phase 5 docs:
  - `docs/project.md`
  - `docs/architecture.md`
  - `docs/decisions.md`
  - `docs/design/rankings-data.md`
  - `docs/design/recommendation-engine.md`
  - `docs/testing.md`

The tier-semantics design is complete. The next implementation focus is documentation and decision alignment before code, import contracts, domain types, persistence compatibility, recommendation behavior, or UI copy are changed.

## Goal

Align project-level documentation with the approved tier-semantics design so future implementation work consistently distinguishes source tiers, position tiers, recommendation tiers, neutral recommendation tiers, and legacy ambiguous tiers.

## Scope

### Goals

- Update `docs/project.md` to correct Phase 5 tier-management language.
- Update `docs/architecture.md` to clarify that source tiers and recommendation-tier inputs are separate concepts.
- Update `docs/decisions.md` with a durable decision for preserving source tiers separately from recommendation-tier pressure.
- Update `docs/design/rankings-data.md` to supersede assumptions that imported FantasyPros `TIERS` are position-local tiers.
- Update `docs/design/recommendation-engine.md` to clarify that tier-drop risk requires explicit recommendation-tier eligibility.
- Update `docs/testing.md` only if its strategy language needs to distinguish source tiers from recommendation tiers.
- Keep `docs/patches/tier-semantics-project.md`, `docs/design/tier-semantics.md`, and `docs/patches/tier-semantics-tasks.md` consistent if wording drift appears while editing.

### Non-Goals

- Do not implement runtime behavior.
- Do not update import parsers, normalizers, validators, repositories, snapshots, recommendation code, UI components, tests, or data files.
- Do not update `docs/tasks.md` in this slice.
- Do not mark any patch implementation task complete unless all acceptance criteria for this slice are satisfied.
- Do not update package dependencies.
- Do not derive position tiers from ADP-only or rank-only data.
- Do not add projections, VORP, simulations, new recommendation factors, scoring tuning, live integrations, or new ranking source formats.
- Do not update `docs/current-slice.md` again after implementation except to reflect completion status or blockers.

## Implementation Steps

1. Review the current wording in the target docs.

   Read only the files listed in Source Context that need editing. Focus on language around tiers, tier management, tier-drop risk, source capabilities, FantasyPros `TIERS`, neutral fallbacks, snapshots, scenarios, and recommendation explanations.

2. Update `docs/project.md`.

   Correct Phase 5 language so it no longer implies that imported FantasyPros tiers are position-local recommendation-tier inputs. Preserve the broader Phase 5 goal of managed ranking data, deterministic snapshots, import/export, validation, and ranking-set selection.

3. Update `docs/architecture.md`.

   Clarify that ranking data may preserve source-tier metadata while the Recommendation Engine consumes only engine-facing recommendation-tier values that are explicitly eligible. Keep the existing monolith-first, repository, snapshot, and pure-engine boundaries unchanged.

4. Update `docs/decisions.md`.

   Add a dated decision recording:

   - FantasyPros `TIERS` are source tiers for the current supported CSV profile.
   - Recommendation tier pressure requires explicit recommendation-tier eligibility.
   - Rank-only and ADP-only data should not be used to derive position tiers.
   - Legacy ambiguous tier values should remain loadable but neutralized for recommendation pressure by default.

5. Update `docs/design/rankings-data.md`.

   Replace or amend sections that describe tiers as position-local imported values. The document should now describe source tiers, recommendation tiers, neutral recommendation tiers, and legacy ambiguous tiers in terms consistent with `docs/design/tier-semantics.md`.

6. Update `docs/design/recommendation-engine.md`.

   Clarify that tier-drop risk is still a valid recommendation category only when the active ranking snapshot contains explicitly recommendation-eligible tier data. Source-only, neutral, absent, and legacy ambiguous tiers should no-op for tier pressure.

7. Review `docs/testing.md`.

   Update only if existing strategy text would mislead future testing work into treating FantasyPros source tiers as position-tier recommendation pressure. Keep changes strategy-level, not implementation-task-level.

8. Keep patch docs consistent if needed.

   If the edited documentation introduces a clearer term or a necessary wording correction, mirror that wording only where needed in:

   - `docs/patches/tier-semantics-project.md`
   - `docs/design/tier-semantics.md`
   - `docs/patches/tier-semantics-tasks.md`

   Do not expand patch scope while doing this.

9. Perform a documentation consistency review.

   Search or directly inspect the edited files for misleading phrases such as:

   - imported tiers as position tiers;
   - FantasyPros `TIERS` as recommendation-tier input;
   - tier cliffs from source-only tiers;
   - neutral fallback values described as real tier evidence.

   Update only documentation touched by this slice.

10. Finalize the slice.

   If all acceptance criteria are satisfied:

   - update this file's Completion Status to complete;
   - update `docs/patches/tier-semantics-tasks.md` to mark Task 2 complete.

   Do not update `docs/tasks.md`.

## Expected Files

- `docs/project.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/design/rankings-data.md`
- `docs/design/recommendation-engine.md`
- `docs/testing.md`, only if needed
- `docs/patches/tier-semantics-project.md`, only if wording consistency requires it
- `docs/design/tier-semantics.md`, only if wording consistency requires it
- `docs/patches/tier-semantics-tasks.md`, to mark Task 2 complete after acceptance criteria are met
- `docs/current-slice.md`, to record completion status

## Tests

No automated tests are required for this documentation-only slice.

Recommended validation:

```text
git diff --check
```

Optional validation if already convenient:

```text
npm run lint
```

Do not add or modify automated tests in this slice.

## Manual QA

No app manual QA is required for this documentation-only slice.

Manual review should confirm the edited docs consistently use:

- source tier for FantasyPros `TIERS`;
- recommendation tier for engine-facing tier pressure;
- neutral recommendation tier for unavailable tier pressure;
- legacy ambiguous tier for pre-patch values with untrusted semantics;
- future/deferred language for position tiers that need value-based inputs.

## Acceptance Criteria

- `docs/project.md` no longer implies FantasyPros `TIERS` are position-local recommendation-tier input.
- `docs/architecture.md` documents the separation between source-tier preservation and recommendation-tier eligibility.
- `docs/decisions.md` records the source-tier versus recommendation-tier decision and its tradeoffs.
- `docs/design/rankings-data.md` no longer treats imported FantasyPros tiers as position-local recommendation tiers.
- `docs/design/recommendation-engine.md` states that tier-drop risk requires explicit recommendation-tier eligibility.
- `docs/testing.md` is either already compatible with the corrected terminology or has been updated at strategy level.
- Future position-tier support remains deferred until value-based inputs such as projections or VORP are active scope.
- No runtime code, tests, dependencies, data files, `docs/tasks.md`, or unrelated documentation are changed.
- `docs/patches/tier-semantics-tasks.md` marks Task 2 complete only after the documentation updates satisfy this slice.

## Failure Handling

- If an existing document conflicts with the approved tier-semantics design, follow the design and document the alignment in the relevant file.
- If the documentation reveals a product or architecture question not answered by `docs/design/tier-semantics.md`, stop and report the unresolved question instead of inventing new scope.
- If implementation appears necessary to make the docs truthful, stop after documentation alignment and leave code work for the next slice.
- If unrelated worktree changes appear in target files, preserve them and edit around them rather than reverting them.

## Follow-Up

After this slice is complete, the next slice should implement Task 3 from `docs/patches/tier-semantics-tasks.md`: update tier import and portable-format contracts.

## Slice Review

- Smallest meaningful increment: yes. This slice aligns documentation and decisions before code changes.
- Executable by a lower-reasoning pass: yes. Target files, wording goals, and acceptance criteria are explicit.
- Avoids unnecessary architecture changes: yes. It records the approved design without changing runtime architecture.
- Blast radius reasonable: yes. Expected changes are documentation-only and limited to tier-semantics references.
- Review/revert comfort: yes. Documentation alignment can be reviewed independently from implementation.
- Observable/testable acceptance criteria: yes. The edited docs can be inspected for the corrected terminology and decision record.
