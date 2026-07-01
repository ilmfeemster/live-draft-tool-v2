# Tier Semantics Patch Tasks

## Current Focus

Patch project: Tier Semantics Correction.

This patch is complete when tier meanings are explicit, legacy data remains usable through conservative compatibility behavior, and no supported recommendation path treats overall/source tiers as position-tier pressure.

The source documents for this task plan are:

- `docs/patches/tier-semantics-project.md`
- `docs/design/tier-semantics.md`
- `docs/project.md`
- `docs/design/rankings-data.md`
- `docs/design/recommendation-engine.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/testing.md`

Do not begin a remaining slice until it has been promoted into `docs/current-slice.md` at the user's request.

---

## Completed Foundation

- [x] Define source tiers, recommendation tiers, neutral tiers, and legacy ambiguous tiers.
- [x] Align project, architecture, design, decision, and testing documentation.
- [x] Update import-stage contracts so FantasyPros `TIERS` are source-tier data.
- [x] Add domain tier semantics, validation, and a neutral recommendation-tier fallback.
- [x] Preserve FantasyPros source tiers while converting engine-facing entries to neutral recommendation tiers.
- [x] Persist ranking-set tier semantics and conservatively map legacy ranking sets.
- [x] Neutralize ambiguous tiers when hydrating legacy persisted draft snapshots.
- [x] Make neutral recommendation tiers an explicit no-op in modern and legacy recommendation paths.
- [x] Verify that invalid tier pressure produces no score component or recommendation reason.

The remaining work is intentionally divided into five independently reviewable slices.

---

## Remaining Slice Ordering

1. Canonical Ranking JSON compatibility.
2. New draft snapshot semantics.
3. Scenario V1 compatibility.
4. Focused UI terminology.
5. Regression coverage and patch exit validation.

Each slice should be planned in `docs/current-slice.md` and implemented separately. Do not combine slices unless the user explicitly approves a broader implementation.

---

## Slice 1 - Canonical Ranking JSON Compatibility

- [ ] Complete

### Goal

Make portable ranking exports preserve explicit tier meanings while keeping legacy Canonical Ranking Set JSON V1 files readable without restoring false recommendation pressure.

### Scope

- Implement the approved explicit tier-semantics canonical document shape for new exports.
- Round-trip source-tier metadata, recommendation-tier values, and recommendation-tier eligibility without collapsing them into one ambiguous `tier` field.
- Keep the legacy Canonical Ranking Set JSON V1 reader available.
- Treat legacy V1 `tier` values as ambiguous and recommendation-ineligible by default.
- Preserve existing import diagnostics and atomic create/replacement behavior.
- Keep canonical ranking documents distinct from Scenario V1 documents.

### Non-Goals

- Do not derive position tiers from rank, ADP, or source tiers.
- Do not add a generic migration or format-plugin framework.
- Do not add new ranking source formats.
- Do not change recommendation scoring.
- Do not update snapshot or scenario compatibility in this slice.

### Acceptance Criteria

- A new canonical export and re-import preserve explicit source and recommendation tier semantics.
- New canonical documents do not rely on an ambiguous lone `tier` field.
- Legacy V1 documents remain importable.
- Legacy V1 tier values cannot become recommendation-tier pressure by default.
- Malformed explicit tier metadata fails through stable diagnostics without replacing stored data.

### Suggested Tests

- Export/re-import round-trip tests for explicit source and recommendation tier semantics.
- Legacy V1 fixture tests proving ambiguous tiers become recommendation-ineligible.
- Malformed explicit tier-metadata diagnostics and replacement-isolation tests.
- Type checking for parser, normalizer, exporter, and repository boundaries.

---

## Slice 2 - New Draft Snapshot Semantics

- [ ] Complete

### Goal

Ensure newly created draft snapshots persist the ranking set's exact tier semantics and remain immutable, while retaining the completed neutral compatibility behavior for legacy snapshots.

### Scope

- Persist explicit tier-semantics metadata when creating new ranking snapshots.
- Preserve source-tier metadata separately from engine-facing recommendation tiers.
- Hydrate new snapshots according to their stored eligibility instead of inferring meaning from numeric tier values.
- Keep legacy snapshots with missing semantics metadata deterministic and recommendation-neutral.
- Verify snapshot isolation after the source ranking set is edited or deleted.

### Non-Goals

- Do not rewrite historical snapshots.
- Do not make snapshots depend on mutable source ranking sets.
- Do not persist recommendation output.
- Do not change Scenario V1 parsing.
- Do not add a general snapshot migration framework.

### Acceptance Criteria

- New snapshots store explicit tier semantics with their immutable ranking data.
- New snapshots preserve source-tier data without making it recommendation-eligible.
- Explicit recommendation-tier eligibility, when present, survives snapshot creation and hydration.
- Legacy snapshots continue to load deterministically with neutral tier pressure.
- Source ranking-set edits or deletion do not alter an existing snapshot's tier behavior.

### Suggested Tests

- New snapshot creation and hydration round-trip tests.
- Source-only and explicit recommendation-eligible snapshot fixtures.
- Legacy snapshot neutralization regression tests.
- Source edit/delete snapshot-isolation tests.

---

## Slice 3 - Scenario V1 Compatibility

- [ ] Complete

### Goal

Keep existing Scenario V1 fixtures replayable and deterministic while preventing their ambiguous tier values from creating recommendation pressure.

### Scope

- Add a Scenario V1-specific compatibility path for ranking entries with no tier-semantics metadata.
- Treat Scenario V1 `tier` values as legacy ambiguous and recommendation-ineligible.
- Neutralize ambiguous scenario tiers before they reach recommendation evaluation.
- Preserve replay without requiring a mutable ranking set or database lookup.
- Preserve existing non-tier scenario behavior, output shape, and deterministic ordering.

### Non-Goals

- Do not create Scenario V2.
- Do not retrofit explicit source-tier metadata into legacy Scenario V1 files.
- Do not change generic canonical ranking import behavior in this slice.
- Do not tune recommendation weights or add recommendation factors.
- Do not rewrite existing scenario fixtures merely for cosmetic consistency.

### Acceptance Criteria

- Existing Scenario V1 fixtures continue to parse and replay.
- Ambiguous Scenario V1 tiers produce no tier-drop score component or reason.
- Repeated replay of identical Scenario V1 input remains deterministic.
- Non-tier recommendation behavior remains unchanged.
- Scenario replay remains independent of mutable ranking-set persistence.

### Suggested Tests

- Scenario V1 parser compatibility tests.
- Replay regression proving ambiguous tiers are neutralized.
- Determinism and score-component reconciliation tests.
- Existing scenario-session and replay suites.

---

## Slice 4 - Focused UI Terminology

- [ ] Complete

### Goal

Remove user-facing language that implies imported overall/source tiers are position tiers or directly control recommendation pressure.

### Scope

- Audit tier labels in the existing ranking-library, ranking-detail, editor, and draft/recommendation views touched by the patch.
- Label preserved FantasyPros tiers as source tiers wherever they are displayed.
- Replace inaccurate position-tier or recommendation-pressure wording with the approved tier vocabulary.
- Ensure existing recommendation explanations do not claim a tier cliff when tier pressure is neutral.
- Add or update focused component tests for changed labels and explanations.

### Non-Goals

- Do not redesign ranking-management screens.
- Do not add manual recommendation-tier authoring.
- Do not add new warning panels, badges, or editing controls unless required to correct existing misleading UI.
- Do not duplicate domain validation in UI code.
- Do not expose future projection, VORP, or position-tier controls.

### Acceptance Criteria

- FantasyPros `TIERS` are not labeled as position tiers anywhere in the affected UI.
- Existing UI does not imply that editing a source tier tunes recommendation pressure.
- Neutralized tier data produces no tier-cliff explanation.
- Changed labels use the terminology defined by the tier-semantics design.
- Existing ranking and draft workflows remain functional.

### Suggested Tests

- Focused component tests for tier labels and explanatory text.
- Recommendation display test proving neutral data has no tier-cliff reason.
- Manual inspection of the affected ranking and draft views.

---

## Slice 5 - Regression Coverage and Patch Exit Validation

- [ ] Complete

### Goal

Prove that every supported ranking-to-recommendation path applies the corrected semantics, then close the patch without expanding into future tier features.

### Scope

- Add any missing focused regression tests across import, canonical portability, persistence, snapshots, scenario replay, recommendations, and changed UI terminology.
- Verify FantasyPros source tiers never become position-tier recommendation pressure.
- Verify legacy ranking sets, exports, snapshots, and Scenario V1 fixtures remain usable through their documented compatibility paths.
- Run the approved focused suites, full automated suite, type checking, and other validation required by `docs/testing.md`.
- Complete the tier-semantics manual QA checks for the ranking-to-draft workflow.
- Update patch tracking and active task documentation to reflect the verified final state.

### Non-Goals

- Do not add new behavior solely to broaden test coverage.
- Do not weaken assertions that expose old incorrect semantics.
- Do not begin projection-based or value-based tier work.
- Do not tune recommendation scoring.
- Do not begin the next project slice automatically.

### Acceptance Criteria

- Tests fail if overall/source tiers are again treated as position-tier recommendation pressure.
- New canonical exports and snapshots preserve explicit semantics through round trips.
- Legacy ranking sets, exports, snapshots, and Scenario V1 fixtures load with conservative tier behavior.
- Recommendation components and reasons reconcile and remain deterministic.
- Required automated validation and manual QA pass, or any failure is recorded as an explicit blocker.
- Patch documentation records the patch as complete and future position-tier work as deferred.

### Suggested Tests

- Focused import, canonical JSON, repository, snapshot, replay, recommendation, and UI suites.
- Full automated test suite.
- Type checking, linting, and build validation where required by the project workflow.
- Tier-semantics manual QA checklist.

---

## Deferred Work

The following items are not required to finish this patch:

- Deriving position tiers from overall rank, position rank, ADP, or source tiers.
- Projection, VORP, replacement-level, or simulation-based tiering.
- Manual recommendation-tier authoring or editing UI.
- New tier warning panels, dashboards, or broad ranking-screen redesigns.
- Recommendation factor additions or scoring-weight tuning.
- Scenario V2, unless Scenario V1 compatibility proves technically impossible.
- Historical data rewrites when conservative read compatibility is sufficient.
- New ranking source formats, generic column mapping, or tier plugin systems.
- Live provider integration, player catalog work, or cross-source player matching.

---

## Completed Validation

Import/export contract validation:

- `npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/canonicalRankingJsonExporter.test.ts`
- `npx tsc --noEmit`

Domain tier-semantics validation:

- `npm test -- src/lib/rankingSetValidation.test.ts`
- `npx tsc --noEmit`

FantasyPros normalization and conversion validation:

- `npm test -- src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingImportWorkflow.test.ts`
- `npm test`
- `npx tsc --noEmit`

Recommendation neutralization validation:

- `npm test -- src/lib/recommendations.test.ts src/lib/recommendations.scenario.test.ts src/lib/draftWorkflow.test.ts src/lib/draftRepository.test.ts src/lib/scenarioReplay.test.ts src/lib/scenarioSession.test.ts`
- `npm test`
- `npx tsc --noEmit`

Previously completed compatibility coverage includes ranking-set semantics persistence and legacy persisted-draft tier neutralization. The five remaining slices close the portable-format, new-snapshot, scenario, UI-language, and exit-validation gaps.
