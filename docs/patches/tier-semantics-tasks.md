# Tier Semantics Patch Tasks

## Current Focus

Patch project: Tier Semantics Correction.

This patch corrects the application-level conflation of source tiers, position tiers, and recommendation tier pressure before additional recommendation-engine tier work continues.

The source documents for this task plan are:

- `docs/patches/tier-semantics-project.md`
- `docs/design/tier-semantics.md`
- `docs/project.md`
- `docs/design/rankings-data.md`
- `docs/design/recommendation-engine.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/testing.md`

The patch preserves the Phase 5 ranking-management architecture while correcting tier semantics across import, domain validation, persistence/export compatibility, snapshots, scenarios, recommendation behavior, UI language, and QA.

Do not update `docs/current-slice.md` until the user explicitly asks to plan the first implementation slice from this patch task plan.

---

## Patch Task Ordering

Tasks are ordered so terminology and compatibility contracts are corrected before tier-bearing data can reach domain objects, snapshots, or recommendation scoring:

1. Design corrected tier semantics.
2. Align project documentation and decisions.
3. Update tier import and portable-format contracts.
4. Add domain tier semantics and validation.
5. Correct FantasyPros tier normalization and conversion.
6. Preserve ranking-set, export, snapshot, and scenario compatibility.
7. Neutralize invalid recommendation tier pressure.
8. Update UI, editing, and manual QA language.
9. Add regression coverage for corrected tier semantics.
10. Complete patch exit validation.

Do not combine unrelated layers in one implementation slice. Documentation alignment, import contracts, domain validation, compatibility readers, recommendation behavior, and UI copy should remain separately reviewable unless the user explicitly approves a larger slice.

---

## Task 1 - Design Corrected Tier Semantics

- [x] Complete

### Goal

Create a design document that defines tier meanings, data ownership, compatibility behavior, and recommendation eligibility before implementation begins.

### Scope

- Create `docs/design/tier-semantics.md`.
- Define source tiers, position tiers, recommendation tiers, neutral recommendation tiers, and legacy ambiguous tiers.
- Decide how FantasyPros `TIERS` should be represented.
- Decide how legacy `RankingEntry.tier` values should be interpreted.
- Decide when recommendation tier pressure is allowed to run.
- Decide whether position tiers are current scope or future capability.
- Define compatibility expectations for existing persisted ranking data, exports, snapshots, and scenarios.
- Define documentation, testing, and task-planning guidance.

### Non-Goals

- Do not implement code.
- Do not tune recommendation scoring.
- Do not introduce projections, VORP, simulations, or new data sources.
- Do not update `docs/current-slice.md`.

### Acceptance Criteria

- The design states that FantasyPros `TIERS` are source tiers for the current supported CSV profile.
- The design states that recommendation tier pressure requires explicit recommendation-tier eligibility.
- The design keeps rank-only and ADP-only position-tier derivation out of scope.
- The design defines a compatibility path for legacy ambiguous tier data.
- The design is detailed enough to produce implementation tasks without redefining the model.

---

## Task 2 - Align Documentation and Decisions

- [x] Complete

### Goal

Update project-level documentation so future work uses the corrected tier vocabulary and no longer treats FantasyPros source tiers as position-local recommendation tiers.

### Scope

- Update `docs/project.md` to correct Phase 5 tier-management language.
- Update `docs/architecture.md` to distinguish source tiers from recommendation-tier inputs at ranking and engine boundaries.
- Update `docs/decisions.md` with a durable decision for source-tier preservation and recommendation-tier eligibility.
- Update `docs/design/rankings-data.md` to supersede assumptions that imported FantasyPros tiers are position-local.
- Update `docs/design/recommendation-engine.md` to clarify when tier-drop risk may run.
- Update `docs/testing.md` only if the testing strategy needs tier-specific language.
- Keep the patch project and design docs consistent with any wording changes.

### Non-Goals

- Do not implement runtime behavior.
- Do not update `docs/tasks.md` or `docs/current-slice.md` unless the user explicitly promotes the patch into active Phase 5 work.
- Do not revise unrelated Phase 5 scope.
- Do not add new recommendation features.

### Acceptance Criteria

- Documentation consistently distinguishes source tiers, position tiers, recommendation tiers, neutral recommendation tiers, and legacy ambiguous tiers.
- The Phase 5 docs no longer describe FantasyPros `TIERS` as position-local recommendation-tier input.
- Future position-tier support is explicitly deferred until value-based inputs are active scope.
- The decision record captures the tradeoff that preserving source tiers is less important than preventing false recommendation urgency.

### Suggested Tests

- Documentation review only.
- Optional link check or markdown lint if already part of the local validation workflow.

---

## Task 3 - Update Tier Import and Portable-Format Contracts

- [x] Complete

### Goal

Revise import-stage and export-stage contracts so tier-bearing data carries explicit semantics before normalization, validation, persistence, export, or engine use.

### Scope

- Update supported import contract types to classify tier-like data as source-only, recommendation-eligible, unsupported, absent, neutral, or legacy ambiguous.
- Update FantasyPros CSV Profile V1 contract text and fixtures so `TIERS` is source-tier data.
- Update Canonical Ranking Set JSON planning so new exports carry explicit tier semantics.
- Preserve a reader path for existing Canonical Ranking Set JSON V1 with ambiguous `tier` values.
- Define diagnostics for unsupported, malformed, or semantically ambiguous supplied tier values.
- Ensure Scenario V1 and Ranking Set JSON remain distinct contracts.

### Non-Goals

- Do not parse or normalize files beyond contract-level changes.
- Do not create domain ranking sets.
- Do not add generic column mapping.
- Do not introduce a new ranking format beyond the approved canonical export evolution.
- Do not change recommendation scoring.

### Acceptance Criteria

- Contract types prevent raw source tiers from being passed as recommendation-tier input.
- FantasyPros `TIERS` are documented as source tiers, not position tiers.
- Missing FantasyPros `TIERS` remain safely importable.
- Malformed supplied tier values have stable diagnostics.
- New canonical exports have a path to preserve source-tier and recommendation-tier semantics without an ambiguous lone `tier` field.
- Legacy V1 files remain readable through a documented ambiguous-tier compatibility path.

### Suggested Tests

- Compile-time or type-boundary tests for import-stage handoffs.
- Contract fixture tests for FantasyPros with present, absent, and malformed `TIERS`.
- Contract fixture tests for legacy Canonical Ranking Set JSON V1 with ambiguous `tier`.
- Contract fixture tests for the new explicit tier-semantics export shape.

---

## Task 4 - Add Domain Tier Semantics and Validation

- [x] Complete

### Goal

Extend the ranking domain model and validation rules so source tiers, recommendation tiers, neutral tiers, and legacy ambiguous tiers cannot be confused.

### Scope

- Add domain-facing tier semantics metadata for ranking sets and snapshots.
- Preserve source tier values separately from engine-facing recommendation tier values.
- Define the neutral recommendation-tier fallback used when tier pressure is unavailable.
- Define validation for source tiers without applying position-local tier-cliff rules.
- Define validation for recommendation-eligible position tiers when a future or explicit source provides them.
- Define validation for legacy ambiguous tiers so they remain loadable but not recommendation-eligible by default.
- Keep `RankingEntry[]` compatibility for the Draft State Engine and Recommendation Engine.

### Non-Goals

- Do not derive position tiers from rank, position rank, ADP, or source tiers.
- Do not add projections, VORP, or replacement-level data.
- Do not add repositories or UI.
- Do not change recommendation scoring yet.
- Do not introduce a broad tier abstraction beyond the states needed by the approved design.

### Acceptance Criteria

- Domain values can represent source tiers and recommendation tiers independently.
- Neutral recommendation tiers are internally consistent and cannot produce tier cliffs.
- Legacy ambiguous tiers are represented without making them recommendation-eligible.
- Recommendation-eligible tiers require complete, position-local, non-decreasing data.
- Existing draft and recommendation boundaries still compile against canonical ranking entries.

### Suggested Tests

- Unit tests for source-tier validation.
- Unit tests for neutral recommendation-tier validation.
- Unit tests for recommendation-eligible position-tier validation.
- Unit tests for legacy ambiguous tier compatibility.
- Type-boundary tests proving parser-specific records cannot reach domain consumers.

---

## Task 5 - Correct FantasyPros Tier Normalization and Domain Conversion

- [x] Complete

### Goal

Make FantasyPros CSV imports preserve `TIERS` as source-tier metadata while materializing neutral recommendation tiers for engine-facing entries.

### Scope

- Parse and normalize FantasyPros `TIERS` as source-tier values.
- Do not copy FantasyPros source tiers into recommendation-tier pressure.
- Materialize neutral recommendation tiers during candidate conversion.
- Emit warnings or capability notes explaining that FantasyPros source tiers are preserved but not used for recommendation tier pressure.
- Preserve atomic import behavior for create and replacement workflows.
- Keep source locations attached to diagnostics through the import pipeline.

### Non-Goals

- Do not add user-authored tier mapping.
- Do not derive position tiers from FantasyPros rank or ADP data.
- Do not alter team, ADP, identity, or order semantics except where tier metadata requires consistency.
- Do not change UI beyond diagnostics surfaced by existing boundaries.

### Acceptance Criteria

- FantasyPros imports with valid `TIERS` preserve source-tier values.
- FantasyPros imports with absent `TIERS` succeed with no source-tier capability and neutral recommendation tiers.
- FantasyPros imports with malformed supplied `TIERS` fail without replacing stored data.
- Converted ranking entries used by engines contain neutral recommendation tiers unless explicit recommendation-tier eligibility exists.
- Import diagnostics make the preserved-but-neutralized behavior inspectable.

### Suggested Tests

- End-to-end import test for FantasyPros with valid source tiers.
- End-to-end import test for FantasyPros with missing `TIERS`.
- Failure-isolation test for malformed supplied `TIERS`.
- Domain conversion test proving source tiers and neutral recommendation tiers remain distinct.
- Regression test proving parsed and normalized records do not reach repositories or engines.

---

## Task 6 - Preserve Ranking Set, Export, Snapshot, and Scenario Compatibility

- [ ] Complete

### Goal

Keep existing persisted ranking sets, canonical exports, immutable draft snapshots, and Scenario V1 replay usable while applying conservative tier compatibility rules.

### Scope

- Update ranking-set repository mapping for explicit tier semantics.
- Load existing stored tier values as legacy ambiguous where semantics metadata is missing.
- Update canonical export/import to preserve explicit tier semantics for new exports.
- Continue reading legacy Canonical Ranking Set JSON V1 through the ambiguous-tier compatibility path.
- Update snapshot creation to copy source-tier metadata and neutral/recommendation-tier semantics as approved.
- Update snapshot readers so legacy snapshots load deterministically with neutralized tier pressure by default.
- Preserve Scenario V1 replay without requiring a mutable ranking set.

### Non-Goals

- Do not rewrite all historical snapshots for cosmetic consistency.
- Do not make snapshots depend on mutable source ranking sets.
- Do not persist recommendation output.
- Do not add a general migration framework unless required by existing persistence constraints.
- Do not create Scenario V2 unless implementation proves V1 cannot carry required compatibility behavior.

### Acceptance Criteria

- Existing ranking sets load without silently preserving false recommendation-tier pressure.
- Existing draft snapshots and Scenario V1 fixtures continue to load and replay deterministically.
- New snapshots capture corrected tier semantics and remain immutable after source-set edits or deletion.
- New exports round-trip source-tier and recommendation-tier semantics.
- Old exports remain readable as legacy ambiguous data.

### Suggested Tests

- Repository mapping tests for legacy and new tier metadata.
- Legacy snapshot hydration regression tests.
- Scenario V1 replay regression tests.
- Export/re-import round-trip tests for corrected tier semantics.
- Source edit/delete snapshot-isolation tests.

---

## Task 7 - Neutralize Invalid Recommendation Tier Pressure

- [ ] Complete

### Goal

Ensure the Recommendation Engine only applies tier-drop pressure when ranking inputs are explicitly recommendation-eligible.

### Scope

- Update recommendation input preparation or tier-drop logic so source-only, neutral, absent, and legacy ambiguous tier states no-op.
- Preserve the bounded additive scoring model and existing non-tier modifiers.
- Ensure score components and reasons are emitted only when tier pressure actually affects scoring.
- Keep the engine pure, deterministic, and independent of parser records, repositories, and mutable ranking-set state.
- Preserve deterministic tie breakers and existing base-value behavior.

### Non-Goals

- Do not add new recommendation factors.
- Do not tune unrelated scoring constants.
- Do not add projections, VORP, simulations, opponent modeling, or AI reasoning.
- Do not persist recommendation output.
- Do not introduce UI copy beyond reason text changes required by scoring output.

### Acceptance Criteria

- FantasyPros source tiers do not create tier-drop score components.
- Neutral recommendation tiers do not create tier-cliff reasons.
- Legacy ambiguous tiers do not remain recommendation-eligible by default.
- Roster fit, scarcity, observed run pressure, value opportunity, and base ranking behavior remain unchanged except for interactions with removed invalid tier pressure.
- Repeated evaluation of identical draft and snapshot inputs remains deterministic.

### Suggested Tests

- Recommendation scenario proving source tiers do not trigger tier-drop pressure.
- Recommendation scenario proving neutral tiers no-op.
- Legacy snapshot recommendation regression proving ambiguous tiers are neutralized.
- Explanation tests proving tier reasons are emitted only for score-backed recommendation-tier input.
- Regression tests for non-tier modifier behavior.

---

## Task 8 - Update UI, Editing, and Manual QA Language

- [ ] Complete

### Goal

Make tier semantics visible in the ranking-management and recommendation workflows without implying that source tiers tune recommendation pressure.

### Scope

- Update ranking-library labels and capability badges to say "source tier" when displaying FantasyPros `TIERS`.
- Update ranking editor labels and diagnostics to distinguish source-tier display from recommendation-tier behavior.
- Remove or rename UI language that calls imported FantasyPros tiers position tiers.
- Surface neutralized tier-pressure warnings in draft setup or ranking detail views without blocking draft creation.
- Ensure recommendation reasons do not claim tier cliffs for neutralized data.
- Update `docs/qa/manual-phase-5-qa.md` or a patch-specific QA checklist with tier-semantics checks.

### Non-Goals

- Do not redesign unrelated ranking-management screens.
- Do not add spreadsheet-grade tier editing.
- Do not add manual recommendation-tier authoring unless separately approved.
- Do not expose projections, VORP, or future position-tier controls.
- Do not duplicate domain validation in UI code.

### Acceptance Criteria

- UI no longer labels FantasyPros source tiers as position tiers.
- Users can tell when source tiers are preserved but not used for recommendation tier pressure.
- Draft setup can warn about unavailable tier pressure without treating the ranking set as invalid.
- Editing workflows do not imply source-tier edits tune recommendations.
- Manual QA covers import, display, draft setup, recommendation output, export/re-import, snapshot isolation, and replay.

### Suggested Tests

- Component tests for updated tier labels and badges.
- Component or integration tests for neutralized tier-pressure warnings.
- Recommendation display tests for absence of invalid tier-cliff reasons.
- Manual QA checklist execution after implementation.

---

## Task 9 - Add Tier Semantics Regression Coverage

- [ ] Complete

### Goal

Protect the corrected semantics across import, validation, persistence, snapshots, replay, recommendations, UI, and manual workflows.

### Scope

- Add focused regression tests for every layer touched by the patch.
- Cover FantasyPros source-tier import and neutral recommendation-tier conversion.
- Cover legacy ambiguous tier compatibility.
- Cover canonical export/import round trips.
- Cover snapshot creation, legacy snapshot hydration, and source-set isolation.
- Cover Recommendation Engine behavior for neutralized and recommendation-eligible tier inputs.
- Cover UI display of source-tier and neutralized-tier-pressure states.
- Update manual QA expectations for the corrected workflow.

### Non-Goals

- Do not weaken tests to preserve old incorrect semantics.
- Do not add broad unrelated UI tests.
- Do not expand into future recommendation strategy, live integration, projections, or VORP testing.
- Do not require external services for regression coverage unless the existing validation workflow already does.

### Acceptance Criteria

- Tests fail if FantasyPros source tiers are accidentally treated as position-tier recommendation pressure.
- Tests prove existing persisted or fixture data remains loadable through documented compatibility behavior.
- Tests prove new exports preserve explicit tier semantics.
- Tests prove recommendation tier reasons require score-backed recommendation-tier input.
- Manual QA includes tier-semantics checks across the ranking-to-draft workflow.

### Suggested Tests

- Unit tests for domain tier states.
- Import pipeline fixture tests for FantasyPros `TIERS`.
- Repository and snapshot compatibility tests.
- Scenario replay regression tests.
- Recommendation scenario tests.
- Component/integration tests for tier labels and warnings.

---

## Task 10 - Complete Patch Exit Validation

- [ ] Complete

### Goal

Confirm the patch has corrected tier semantics without broadening scope or regressing Phase 5 ranking, draft, persistence, replay, or recommendation workflows.

### Scope

- Run the approved automated validation commands.
- Complete the approved manual QA checklist.
- Confirm documentation reflects implemented behavior.
- Confirm future position-tier work remains deferred until value-based data is active scope.
- Confirm `docs/tasks.md` and `docs/current-slice.md` reflect the patch only if the user explicitly promoted it into active work.
- Summarize acceptance criteria status, files changed, validation results, remaining risks, and recommended next slice.

### Non-Goals

- Do not begin the next recommendation-engine feature.
- Do not add projection-based tiering.
- Do not promote future ideas into active scope.
- Do not rewrite historical data beyond the approved compatibility behavior.

### Acceptance Criteria

- All patch acceptance criteria are satisfied.
- No known path uses FantasyPros `TIERS` as position-tier recommendation pressure.
- Existing ranking-management, draft, persistence, replay, and recommendation workflows remain functional.
- Full selected automated validation passes.
- Manual QA passes or records explicit follow-up issues.
- Remaining position-tier work is clearly deferred to a future design or data-capability phase.

### Suggested Tests

- Run the full automated suite or the approved focused validation command set.
- Run type checking, linting, and build validation if required by the active implementation slice.
- Complete the tier-semantics manual QA checklist.
- Re-run at least one existing Phase 5 ranking import/export workflow.
- Re-run at least one persisted draft or scenario replay workflow.

---

## Testing Status

The tier-semantics design, documentation-alignment, import/export contract, domain-validation, and FantasyPros normalization/conversion tasks are complete.

Task 3 validation passed:

- `npm test -- src/lib/rankingImportPreflight.test.ts src/lib/fantasyProsCsvParser.test.ts src/lib/canonicalRankingJsonParser.test.ts src/lib/canonicalRankingJsonExporter.test.ts`
- `npx tsc --noEmit`

Task 4 validation passed:

- `npm test -- src/lib/rankingSetValidation.test.ts`
- `npx tsc --noEmit`

Task 5 validation passed:

- `npm test -- src/lib/rankingNormalizer.test.ts src/lib/rankingCandidateValidation.test.ts src/lib/rankingSetConversion.test.ts src/lib/rankingImportWorkflow.test.ts`
- `npm test`
- `npx tsc --noEmit`

The next task is Task 6, preserve ranking-set, export, snapshot, and scenario compatibility, unless the user chooses to revise the compatibility plan before implementation planning.

---

## Backlog

Not required for this patch:

- Deriving position tiers from ADP-only or rank-only data.
- Projection, VORP, replacement-level, or simulation-based tiering.
- New recommendation factors or scoring-weight tuning.
- Manual recommendation-tier authoring UI.
- Scenario V2 unless existing Scenario V1 compatibility proves insufficient.
- New ranking source formats.
- Generic tier plugin or column-mapping systems.
- Live provider integration, player catalog work, or cross-source player matching.
