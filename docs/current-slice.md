# Current Slice: Tier Semantics Patch Slice 4B - Draft Workflow Terminology

## Completion Status

Implemented with automated validation complete, but not yet fully validated. Focused draft-workflow validation passed (4 files, 13 tests), TypeScript no-emit validation passed, and lint passed with the recorded pre-existing unused `stripLocations` warning in `src/lib/rankingNormalizer.test.ts`. Required browser QA is blocked because the in-app browser control session cannot initialize in the current environment, so patch Slice 4 remains open and `docs/patches/tier-semantics-tasks.md` is unchanged.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 4.
- Approved design: `docs/design/tier-semantics.md`, especially UI and Editing Behavior.
- Completed Slice 4A:
  - ranking-library capability copy no longer infers source or position semantics;
  - ranking detail displays preserved source, recommendation-eligible, neutral, and legacy-compatible states separately;
  - the ambiguous tier-authoring UI and action callback were removed;
  - focused component tests, TypeScript, lint, and user-performed manual QA passed.
- Current draft-workflow facts:
  - `DraftSetupForm` identifies `defaulted-neutral` positions but says only that their tiers were neutralized;
  - `AvailablePlayersTable` receives only `RankingEntry[]`, with no snapshot tier-semantics metadata, and renders the engine-facing numeric `tier` under a bare `Tier` heading;
  - neutral recommendation tiers use a numeric sentinel that is not evidence of authored tier structure;
  - `RecommendationsPanel` renders engine-produced components and reasons and must continue displaying valid explicit recommendation-tier pressure;
  - neutral and legacy-compatible ranking paths already omit tier-cliff components and reasons before reaching the panel.
- Preserve the unrelated, already-validated canonical JSON pretty-print changes currently present in `src/lib/canonicalRankingJsonExporter.ts` and its test.

## Goal

Ensure the draft setup and draft room never present neutral engine fallback values as meaningful source or position tiers, while preserving valid recommendation-tier explanations produced from explicitly eligible data.

## Scope

### Goals

- Replace the draft-setup neutralization warning with concise recommendation-tier-pressure language.
- Remove the semantically ambiguous tier column from the available-player table.
- Keep player rank, identity, team, position rank, filtering, search, scroll preservation, and drafting behavior unchanged.
- Add focused component coverage proving neutral recommendations show no tier-cliff explanation.
- Retain the existing positive display coverage for valid explicit tier-cliff components and reasons.
- Complete focused draft-workflow manual QA.

### Non-Goals

- Do not pass ranking-set or snapshot tier metadata into `AvailablePlayersTable`.
- Do not add source-tier or recommendation-tier badges, columns, warnings, editors, or controls.
- Do not filter, rewrite, or suppress engine-generated recommendation components or reasons.
- Do not change recommendation scoring, reason generation, ranking snapshots, draft persistence, or Scenario V1 behavior.
- Do not redesign draft setup, the available-player table, recommendation cards, or score diagnostics.
- Do not change ranking management, import/export contracts, Prisma, dependencies, or data files.
- Do not update `docs/tasks.md` or begin patch exit validation automatically.

## UI Decisions

- `defaulted-neutral` reliably means recommendation tier pressure is unavailable for that position. The setup warning should say exactly that rather than implying source tier data was modified or discarded.
- `AvailablePlayersTable` cannot distinguish source, explicit recommendation, neutral, or legacy tier semantics from `RankingEntry.tier` alone. Remove the tier column instead of guessing a label or showing the neutral sentinel.
- Overall rank and position rank remain valid draft-room ranking information and stay visible.
- `RecommendationsPanel` remains a transparent renderer of engine output. It must not hide a valid tier-cliff reason merely because most current imported ranking sets are neutral.
- Neutral-data coverage should supply a recommendation with no tier-cliff component or reason and prove the panel does not invent one. Existing explicit positive tier-cliff coverage remains unchanged.
- This 4B increment completes patch Slice 4 only after focused automated validation and manual QA pass.

## Implementation Steps

1. Correct the draft-setup warning.

   In `src/components/DraftSetupForm.tsx`:

   - retain the existing deterministic detection and sorting of `defaulted-neutral` positions;
   - replace `Tiers were neutralized for ...` with `Recommendation tier pressure is unavailable for ...`;
   - keep the warning non-blocking;
   - preserve team and ADP warnings and all draft-setup validation and submission behavior.

2. Remove ambiguous tier presentation from available players.

   In `src/components/AvailablePlayersTable.tsx`:

   - remove the bare `Tier` table header and each row's `entry.tier` cell;
   - update the empty-state `colSpan` from six columns to five;
   - do not replace the column with source-tier, position-tier, recommendation-tier, or neutral text;
   - preserve overall rank, player, team, position rank, action, filters, search, sorting, scroll restoration, and disabled-completion behavior.

3. Update draft-setup component coverage.

   In `src/components/DraftSetupForm.test.tsx`:

   - update the safely degraded ranking-set expectation to the exact recommendation-tier-pressure warning;
   - assert the warning remains limited to sorted `defaulted-neutral` positions and does not include positions with provided values;
   - retain team, ADP, selection, validation, capacity, and form behavior coverage unchanged.

4. Add focused available-player presentation coverage.

   Create `src/components/AvailablePlayersTable.test.tsx`:

   - render representative rankings with neutral and non-neutral numeric `tier` values;
   - assert overall rank, player, team, position rank, and Draft actions remain visible;
   - assert no bare `Tier`, `Source Tier`, `Position Tier`, or `Recommendation Tier` heading is rendered;
   - assert distinctive raw tier numbers are not rendered as table values;
   - assert the empty state spans five columns;
   - keep interaction-heavy filtering and scroll behavior in existing draft-room coverage rather than recreating it here.

5. Add neutral recommendation-display regression coverage.

   In `src/components/RecommendationsPanel.test.tsx`:

   - add a focused recommendation fixture with neutral engine-facing tier data and no `tier_cliff` component or reason;
   - prove the rendered card contains its ordinary score/component output but no tier-cliff ID, source, or explanation;
   - retain the existing explicit non-neutral fixture and its positive tier-cliff component/reason assertions unchanged;
   - do not add filtering logic to `RecommendationsPanel`.

6. Run focused automated validation.

   Run:

   ```text
   npm test -- src/components/DraftSetupForm.test.tsx src/components/AvailablePlayersTable.test.tsx src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
   npx tsc --noEmit
   npm run lint
   ```

   If lint reports only the recorded unused `stripLocations` warning in `src/lib/rankingNormalizer.test.ts`, record it as pre-existing and do not change that file.

7. Complete focused manual QA.

   Verify in the draft workflow:

   - selecting a source-only or neutral ranking set displays recommendation tier pressure as unavailable for the correct positions;
   - the warning does not block draft creation;
   - the available-player table shows rank, player, team, position rank, and Draft action without a tier column;
   - search, position filtering, drafting, undo, and available-player scroll behavior remain functional;
   - neutral imported rankings produce no tier-cliff component or explanation in recommendations;
   - an explicitly recommendation-eligible test fixture may still display its valid tier-cliff explanation.

8. Finalize the slice after validation.

   If automated validation and manual QA pass:

   - update this file's Completion Status with exact results;
   - mark Slice 4 complete in `docs/patches/tier-semantics-tasks.md`;
   - record the Slice 4A and 4B focused validation and manual QA result in the patch task file;
   - leave `docs/tasks.md` unchanged;
   - stop before beginning Slice 5.

## Expected Files

Production files:

- `src/components/DraftSetupForm.tsx`
- `src/components/AvailablePlayersTable.tsx`

Focused tests:

- `src/components/DraftSetupForm.test.tsx`
- `src/components/AvailablePlayersTable.test.tsx` (new)
- `src/components/RecommendationsPanel.test.tsx`

Tracking after successful implementation:

- `docs/current-slice.md`
- `docs/patches/tier-semantics-tasks.md`

Do not touch:

- `src/components/RecommendationsPanel.tsx` unless implementation proves the current renderer invents output; stop and report before changing it;
- ranking-management components completed in Slice 4A;
- recommendation, ranking, snapshot, scenario, repository, or persistence production modules;
- the unrelated canonical JSON pretty-print changes;
- Prisma, dependencies, data files, or `docs/tasks.md`.

## Tests

Required automated validation:

```text
npm test -- src/components/DraftSetupForm.test.tsx src/components/AvailablePlayersTable.test.tsx src/components/RecommendationsPanel.test.tsx src/components/DraftRoom.test.tsx
npx tsc --noEmit
npm run lint
```

Expected result:

- draft setup describes neutral positions as lacking recommendation tier pressure;
- available players no longer expose ambiguous or neutral-sentinel tier values;
- rank, player, team, position rank, action, filtering, scroll, and draft behavior remain intact;
- neutral recommendation output contains no tier-cliff component or reason;
- explicit eligible engine output still renders its valid tier-cliff component and reason;
- type checking and lint remain clean apart from any explicitly recorded pre-existing warning.

## Acceptance Criteria

- Draft setup says `Recommendation tier pressure is unavailable for ...` for sorted `defaulted-neutral` positions.
- The draft-setup warning does not call source tiers position tiers or imply that preserved source data was discarded.
- The warning remains informational and does not block draft creation.
- The available-player table has no tier-related heading or raw tier-value column.
- Overall rank, player identity, team, position rank, filters, search, drafting, disabled completion, and scroll behavior remain unchanged.
- Neutral recommendation fixtures render no `tier_cliff` component ID, source, or explanatory text.
- Existing explicit recommendation-tier fixtures continue rendering valid tier-cliff components and reasons.
- `RecommendationsPanel` production behavior remains unchanged and does not become a semantic policy boundary.
- No ranking-set, snapshot, scenario, recommendation-engine, persistence, Prisma, dependency, data-file, or `docs/tasks.md` changes are introduced.
- The unrelated canonical JSON pretty-print changes remain intact and outside this slice's validation claims.
- Focused tests, TypeScript no-emit validation, lint, and manual QA pass, or an exact blocker is reported.

## Failure Handling

- If the available-player table needs semantic tier display, stop rather than threading new metadata through the draft component tree in this slice.
- If neutral recommendations still contain tier-cliff output, identify the upstream ranking/snapshot path and stop; do not filter invalid engine output in the panel.
- If removing the tier column breaks layout or empty-state rendering, correct only the local table structure.
- If existing valid tier-cliff display coverage fails, preserve that explicit engine contract and report the discrepancy.
- If unrelated draft-room, type, or lint validation fails, report it instead of changing out-of-scope files.
- Preserve unrelated worktree changes, especially the canonical JSON pretty-print patch, and report unsafe overlap.

## Follow-Up

After this slice is implemented and validated, the next slice is Tier Semantics Patch Slice 5 - Regression Coverage and Patch Exit Validation. It should run the complete automated and manual tier-semantics matrix, fill only demonstrated regression gaps, and close patch tracking without starting future position-tier work.

## Slice Review

- Smallest meaningful increment: yes. It closes the remaining setup-to-draft-room terminology path without revisiting completed ranking management.
- Executable by a lower-reasoning pass: yes. Exact copy, column removal, test fixtures, validation, and failure boundaries are specified.
- Avoids unnecessary architecture changes: yes. It removes a display that lacks semantic context rather than threading new metadata through the draft UI.
- Blast radius reasonable: yes. Runtime changes affect two components; focused coverage affects three test files, with no engine or persistence changes.
- Review/revert comfort: yes. Copy and table-column changes are localized, and recommendation production rendering remains untouched.
- Observable/testable acceptance criteria: yes. Warning text, column absence, retained fields/actions, and tier-reason presence or absence are directly assertable and manually visible.
