# Current Slice: Tier Semantics Patch Slice 4A - Ranking Management Terminology

## Completion Status

Implemented with automated validation complete, but not yet fully validated. Focused component validation passed (2 files, 17 tests), TypeScript no-emit validation passed, and lint passed with the one recorded pre-existing unused-helper warning in `src/lib/rankingNormalizer.test.ts`. Required browser QA is blocked because the in-app browser control session cannot initialize in the current environment, so no visual workflow claims have been marked complete.

## Source Context

- Patch task plan: `docs/patches/tier-semantics-tasks.md`, Slice 4.
- Approved design: `docs/design/tier-semantics.md`, especially Tier Vocabulary and UI and Editing Behavior.
- Project scope: ranking management may preserve source tiers and supported recommendation-tier data, but the UI must not conflate those concepts.
- Completed prerequisites:
  - FantasyPros `TIERS` are preserved as source-overall metadata while engine-facing recommendation tiers are neutral.
  - Canonical Ranking JSON and new draft snapshots preserve explicit source and recommendation semantics.
  - Legacy ranking sets, snapshots, and Scenario V1 inputs remain loadable with conservative recommendation-neutral behavior.
  - Neutral recommendation tiers produce no tier score component or reason.
- Current ranking-management UI facts:
  - ranking-library summaries call every `source` tier capability a source tier even though that capability can also represent explicit recommendation-position data;
  - ranking detail exposes the engine-facing `RankingEntry.tier` through a bare `Tier` column;
  - ranking detail presents `RankingEntry.tier` as editable `Position Tiers` and says neutral fallback values are editable through that assignment;
  - the tier assignment edit path does not preserve or intentionally transition the new `tierSemantics` metadata, so the UI cannot accurately claim that it edits source tiers or recommendation-eligible tiers;
  - the loaded `RankingSet` already carries the detailed `tierSemantics` needed for accurate read-only source and recommendation labels;
  - draft setup and draft-room terminology remain for the follow-up Slice 4B.

## Goal

Make the ranking library and ranking detail describe source tiers, recommendation tiers, neutral fallback, and legacy ambiguity accurately, while removing the unsupported ambiguous tier-authoring controls from the UI.

## Scope

### Goals

- Replace ranking-library capability copy that infers tier meaning from the legacy `capabilities.tiers` field.
- Present detailed source-tier and recommendation-tier state from `RankingSet.tierSemantics` without inferring semantics from numeric tier values.
- Display preserved source tier values separately from engine-facing recommendation tiers.
- Show recommendation tier numbers only for positions explicitly marked `recommendation-position`.
- Show neutral or compatibility-neutral states as text rather than displaying the numeric neutral sentinel as though it were authored tier data.
- Remove the ranking-detail `Position Tiers` assignment form and its ranking-library callback path.
- Preserve rename, reorder, player correction, import, export, delete, and ranking-detail workflows.

### Non-Goals

- Do not add manual source-tier, position-tier, or recommendation-tier authoring.
- Do not redesign the ranking library or ranking-detail layout beyond the tier-related copy and controls.
- Do not change ranking-set types, tier semantics, validation, normalization, editing operations, persistence, snapshots, or recommendation scoring.
- Do not delete or rename the domain `assign-position-tiers` edit intent; removing the inaccurate UI entry point is sufficient for this slice.
- Do not change draft setup, available-player, recommendation-panel, or draft-room copy in this slice.
- Do not expose source metadata in recommendation scoring or infer recommendation eligibility from source tiers.
- Do not update dependencies, `docs/tasks.md`, patch tracking, or unrelated documentation.

## UI Decisions

- `RankingSetCapabilities.tiers` is legacy capability metadata, not a complete semantic description. Library summaries may describe its values as `provided tier values` and `neutral fallback`, but must not call `source` capability values source tiers or position tiers.
- Ranking detail must use `rankingSet.tierSemantics` as the authoritative display source:
  - `source-overall` is labeled `Source tier` and described as preserved source data that does not drive recommendation pressure;
  - `legacy-ambiguous` is labeled `Legacy tier` and described as recommendation-neutral compatibility data;
  - `none` displays no source tier value;
  - missing semantics are displayed as legacy/compatibility-neutral rather than inferred from capabilities or entry numbers.
- Preserved source values are matched by both `playerId` and `overallRank`, consistent with the canonical tier metadata contract. A missing match displays an em dash; the UI does not repair data.
- An engine-facing numeric tier is shown only when that row's position is explicitly `recommendation-position`. A `neutral` or missing semantic displays `Neutral` or `Neutral (compatibility)`.
- The existing `Position Tiers` form is removed because it cannot truthfully distinguish source editing from recommendation-tier authoring under the current edit contract.
- The pure domain edit intent remains untouched for compatibility and possible future redesign.
- This 4A increment does not mark patch Slice 4 complete. Slice 4B must still correct draft setup and draft-room terminology.

## Implementation Steps

1. Make ranking-library capability wording semantics-safe.

   In `src/components/RankingLibraryPanel.tsx`:

   - update `formatCapabilitySummary` so `capabilities.tiers[position] === "source"` is described as a provided tier value, not as a source tier or position tier;
   - describe `defaulted-neutral` positions as recommendation-neutral fallback;
   - preserve deterministic position sorting and the existing team/ADP summary structure;
   - remove `assignLoadedPositionTiers` and the `onAssignPositionTiers` prop wiring after the editor prop is removed;
   - leave ranking import, load, rename, reorder, player correction, export, delete, status messages, and error handling unchanged.

2. Replace ambiguous ranking-detail tier presentation.

   In `src/components/RankingSetEditorPanel.tsx`:

   - remove the `onAssignPositionTiers` prop, tier assignment form state/effects, submit handler, inputs, and `Position Tiers` form;
   - do not replace the form with another editing control;
   - replace `formatEditorCapabilitySummary` with a helper that accepts the complete `RankingSet` or add a separate tier-semantics summary helper;
   - summarize preserved source semantics and per-position recommendation eligibility from `rankingSet.tierSemantics`;
   - keep all listed positions deterministic and sorted;
   - replace the bare `Tier` table column with separate semantic presentation for preserved source/legacy tier values and recommendation tier state;
   - use a small pure lookup/formatting helper so source values match rows by `playerId` plus `overallRank`;
   - render numeric recommendation tiers only for `recommendation-position`; render neutral and missing-semantics compatibility states as explicit text;
   - preserve row order and every non-tier field and control.

3. Update focused ranking-detail tests.

   In `src/components/RankingSetEditorPanel.test.tsx`:

   - remove the obsolete callback prop from component fixtures;
   - replace position-tier assignment-control tests with explicit semantics fixtures covering:
     - source-overall values displayed as `Source tier` data;
     - recommendation-position values displayed separately and numerically;
     - neutral recommendation positions displayed as `Neutral`;
     - legacy-ambiguous and missing semantics displayed as compatibility-neutral without semantic inference;
     - source values remaining distinct from recommendation values for the same row;
   - assert the rendered detail does not contain `Position Tiers`, `Save Position Tiers`, `Tier capability`, `Current tier`, or a bare ambiguous tier heading;
   - retain existing rename, reorder, correction, row-order, capability-summary, and error tests except for intentional tier-copy changes.

4. Update focused ranking-library tests.

   In `src/components/RankingLibraryPanel.test.tsx`:

   - update capability-summary expectations to the new semantics-safe wording;
   - assert summaries do not label a legacy `source` capability as `source tiers` or `position tiers`;
   - retain empty state, import controls, summary metadata, diagnostics, delete confirmation, and export-file-name coverage unchanged.

5. Run focused validation.

   Run:

   ```text
   npm test -- src/components/RankingSetEditorPanel.test.tsx src/components/RankingLibraryPanel.test.tsx
   npx tsc --noEmit
   npm run lint
   ```

   If lint reports only the already-recorded unrelated warning in `src/lib/rankingNormalizer.test.ts`, record it as pre-existing and do not change that file.

6. Complete focused manual QA.

   In the ranking library and ranking detail, verify:

   - a FantasyPros source-only set identifies preserved source tiers separately and never presents them as position tiers or recommendation pressure;
   - an explicit canonical recommendation-eligible fixture shows numeric recommendation tiers only for eligible positions;
   - a neutral or legacy-compatible set displays neutral recommendation state without exposing the numeric fallback as authored tier data;
   - no tier assignment control remains;
   - rename, reorder, player correction, export, close detail, and library navigation still work.

7. Finalize the slice after validation.

   If automated validation and manual QA pass:

   - update this file's Completion Status with the exact results;
   - do not mark Slice 4 complete in `docs/patches/tier-semantics-tasks.md` yet;
   - do not update `docs/tasks.md`;
   - stop before beginning Slice 4B.

## Expected Files

Production files:

- `src/components/RankingLibraryPanel.tsx`
- `src/components/RankingSetEditorPanel.tsx`

Focused tests:

- `src/components/RankingLibraryPanel.test.tsx`
- `src/components/RankingSetEditorPanel.test.tsx`

Tracking after successful implementation:

- `docs/current-slice.md`

Do not touch:

- ranking domain types, validation, normalization, conversion, editing, repository, or action modules;
- snapshot, scenario, recommendation, or scoring modules;
- draft setup, draft room, available-player, or recommendation components;
- Prisma, data files, dependencies, `docs/tasks.md`, or `docs/patches/tier-semantics-tasks.md`.

## Tests

Required automated validation:

```text
npm test -- src/components/RankingSetEditorPanel.test.tsx src/components/RankingLibraryPanel.test.tsx
npx tsc --noEmit
npm run lint
```

Expected result:

- ranking-library summaries no longer infer source or position semantics from capability values;
- ranking detail distinguishes source, recommendation-eligible, neutral, and legacy-compatible states;
- source values and engine-facing values cannot be mistaken for one another;
- the ambiguous position-tier editing UI is absent;
- unrelated ranking-management controls and workflows remain intact;
- type checking and lint remain clean apart from any explicitly recorded pre-existing warning.

## Acceptance Criteria

- Ranking-library summaries do not call a `source` tier capability a source tier or position tier.
- Ranking detail labels `source-overall` metadata as source tiers and explains that it does not drive recommendation pressure.
- Legacy ambiguous tier metadata is labeled legacy and displayed as recommendation-neutral compatibility data.
- Missing tier semantics are not inferred from numeric values or capability labels.
- Preserved source tier values are matched and displayed without replacing or mutating engine-facing recommendation tiers.
- Numeric recommendation tiers appear only for positions explicitly marked `recommendation-position`.
- Neutral positions display a textual neutral state instead of presenting `NEUTRAL_TIER` as authored tier data.
- The UI contains no `Position Tiers`, `Save Position Tiers`, `Tier capability`, or bare ambiguous `Tier` table label in ranking detail.
- Ranking detail no longer exposes a tier assignment form or calls the tier assignment action path.
- Rename, reorder, player correction, import, export, delete, and ranking-detail navigation behavior remain unchanged.
- No domain, persistence, snapshot, scenario, recommendation, draft-room, dependency, data-file, `docs/tasks.md`, or patch-tracking changes are introduced.
- Focused component tests, TypeScript no-emit validation, lint, and manual QA pass, or an exact blocker is reported.

## Failure Handling

- If a row has no matching preserved source value, display an em dash and keep rendering; do not infer from `RankingEntry.tier` or repair metadata in the UI.
- If `tierSemantics` is missing, display compatibility-neutral language; do not infer eligibility from `capabilities.tiers`.
- If removing the editor callback reveals another production caller, stop and report it before expanding beyond the two named components.
- If correct display requires changing `RankingSetSummary`, domain types, repository projections, or edit semantics, stop and defer that change to a separately planned slice.
- If unrelated component, type, or lint validation fails, report it rather than changing out-of-scope files.
- Preserve unrelated worktree changes and report any unsafe overlap.

## Follow-Up

After this slice is implemented and validated, plan Tier Semantics Patch Slice 4B - Draft Workflow Terminology. It should correct draft-setup neutralization guidance and remove or relabel ambiguous tier presentation in the available-player and recommendation surfaces, with focused component and browser QA. Only after 4B passes should patch Slice 4 be marked complete.

## Slice Review

- Smallest meaningful increment: yes. Ranking-library and ranking-detail terminology form one user-visible management workflow, while draft-room changes remain independently reviewable.
- Executable by a lower-reasoning pass: yes. The authoritative metadata, exact labels to remove, fallback behavior, files, tests, and failure boundaries are explicit.
- Avoids unnecessary architecture changes: yes. The slice consumes existing `tierSemantics` and removes an inaccurate UI entry point without changing domain contracts.
- Blast radius reasonable: yes. Runtime and test changes are limited to two existing component pairs, plus completion tracking in this file.
- Review/revert comfort: yes. The changes are localized presentation and prop removal with no persistence or scoring effects.
- Observable/testable acceptance criteria: yes. Labels, values, absent controls, neutral states, and preserved ranking-management workflows are directly testable and manually inspectable.
