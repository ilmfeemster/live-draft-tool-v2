# Tier Semantics Patch Project

## Status

Planning patch project. No implementation strategy has been selected.

This patch pauses further recommendation-engine tier work until the application distinguishes the tier concepts that are currently conflated.

Related task plan: `docs/patches/tier-semantics-tasks.md`.

---

## Problem

The application currently treats imported FantasyPros `TIERS` as though they are position-tier data. They are better understood as provider-supplied overall-board or source tiers.

That distinction matters because the Recommendation Engine uses tier pressure as a draft-decision signal. A position tier and an overall-board tier are not interchangeable:

- An overall/source tier describes grouping on the provider's overall draft board.
- A position tier describes grouping within a position.
- A recommendation tier-pressure signal describes actionable urgency for the current draft decision.

FantasyPros positional tiers can group players by position even when their draft cost differs materially. That can be useful for positional comparison, but it is not automatically useful as a draft-decision tier. High-quality position tiers likely need projections, value-over-replacement, or similar value-based inputs that the app does not currently own.

Because the current domain shape exposes a generic `tier` value, ranking import, validation, editing, persistence, snapshots, UI, and recommendation scoring can accidentally attach the wrong meaning to the same field.

---

## Desired End State

The application should have clear tier semantics across every boundary.

The desired end state is:

- FantasyPros `TIERS` are not described or used as position tiers unless a later design proves that interpretation for a specific supported source.
- Overall/source tiers and position tiers use explicit terminology in product documentation, domain contracts, UI labels, import/export contracts, tests, and recommendation explanations.
- Recommendation tier pressure consumes only data whose semantics are valid for the pressure being calculated.
- Current imported ranking data remains usable where practical, but ambiguous tier data must not create false positional urgency.
- Existing persisted drafts, ranking snapshots, scenarios, and exported ranking sets remain loadable through a documented compatibility path.
- Future position-tier support is treated as a separate capability that likely depends on projections, VORP, or other value-based inputs.

This patch should preserve the app's current monolith-first architecture, deterministic recommendations, immutable snapshot boundary, and managed ranking-set lifecycle.

---

## Terminology

### Overall/Source Tier

A tier supplied by a ranking provider or import source that groups players on the source's overall board.

For the current FantasyPros CSV profile, `TIERS` should be treated as an overall/source-tier concept until the design phase establishes a more precise supported interpretation.

### Position Tier

A tier that groups players within a single position for positional comparison.

The app should not assume high-quality position tiers can be derived from ADP or rank-only data. Position tiers may become useful later if the app has projection, VORP, or similar value-based inputs.

### Recommendation Tier Pressure

A recommendation signal that increases urgency when a meaningful tier cliff affects the current draft decision.

Recommendation tier pressure should be kept separate from raw imported tier data. It should only run when the tier input has semantics that support the reason being shown.

### Neutralized Tier Signal

A state where imported tier data is preserved or displayed, but recommendation tier-pressure behavior is disabled because the data does not support that recommendation signal.

---

## Scope

### In Scope

- Define the project-level tier terminology and domain problem.
- Review and correct documented assumptions that source tiers are position-local recommendation tiers.
- Identify how ranking import, normalization, validation, domain conversion, export, repository mapping, snapshots, scenarios, recommendation scoring, UI, editing, and testing are affected.
- Preserve existing ranking data and snapshots where practical through explicit compatibility rules.
- Decide during design whether ambiguous imported tiers should be preserved as source metadata, mapped to a separate domain field, converted through a compatibility boundary, or neutralized for recommendation tier pressure.
- Decide during design whether current recommendation tier pressure should be deferred, limited to known-valid data, or refactored to use a different tier concept.
- Update tests and manual QA expectations so tier semantics are observable and regression-protected.
- Keep future position-tier support visible as a future capability without making it part of this patch's implementation goal.

### Out of Scope

- Deriving position tiers from ADP-only or rank-only data.
- Adding projections, VORP, replacement-level models, simulations, or new strategic data sources.
- Adding new recommendation factors beyond correcting tier semantics.
- Tuning recommendation weights or changing the bounded additive scoring model except where needed to remove invalid tier-pressure input.
- Adding live fantasy-platform integrations, automated feeds, scraping, scheduled ranking refreshes, or provider synchronization.
- Creating a global player catalog or cross-source player reconciliation.
- Rewriting historical snapshots solely for cosmetic consistency.
- Broad ranking UI redesign unrelated to tier semantics.
- Replacing the Phase 5 ranking-management architecture.

---

## Affected Systems

### Ranking Import

The FantasyPros CSV profile currently needs semantic correction around `TIERS`. The design phase should determine how the parser, normalizer, and diagnostics describe the imported value and whether it is engine-eligible.

### Domain Model

The current `RankingEntry`-style compatibility seam uses an ambiguous `tier` value. The patch must define whether that field remains, is renamed, is supplemented, or is interpreted through compatibility metadata.

### Validation

Validation rules currently assume position-local tier progression and neutral per-position fallback behavior. Those rules may be invalid for source tiers and must be reconciled with the approved tier terminology.

### Editing Workflow

Ranking and tier editing must make clear whether the user is editing source tiers, future position tiers, recommendation tier-pressure inputs, or another approved tier concept.

### Persistence and Export

Mutable ranking sets, immutable draft snapshots, canonical exports, and legacy snapshot readers must preserve compatibility without silently changing the meaning of stored tier values.

### Recommendation Engine

Tier-drop risk currently depends on tier data as a recommendation signal. The patch must ensure the engine does not use overall/source tiers as positional tier cliffs unless the design explicitly validates that behavior.

### UI

Ranking library, ranking editor, draft setup, recommendation reasons, capability badges, and manual QA language should avoid calling imported source tiers "position tiers" when that is not what they are.

### Testing

Tests should prove that imported FantasyPros source tiers do not create false position-tier pressure and that compatibility behavior is deterministic across import, export, persistence, draft creation, replay, and recommendation output.

---

## Assumptions and Constraints

- The current product remains Phase 5: Rankings & Data.
- The Recommendation Engine stays deterministic, pure, derived, and source-agnostic.
- Drafts continue to use immutable ranking snapshots.
- Ranking sets remain mutable source data; snapshots remain immutable historical inputs.
- Existing persisted data should continue to load where practical.
- The app currently lacks projections, replacement values, or other data that would make high-quality position tiers reliable.
- The patch should prefer explicit terminology and compatibility handling over broad model rewrites.
- Implementation should not begin until a design document resolves the tier model and migration behavior.

---

## Migration and Compatibility Considerations

- Existing ranking sets and snapshots may contain a `tier` field whose intended meaning is ambiguous.
- Existing canonical exports may need a compatibility interpretation for legacy `tier` values.
- Scenario V1 replay should remain deterministic with existing embedded ranking entries.
- Recommendation output may intentionally change where prior behavior depended on invalid positional tier pressure.
- UI copy should help users understand degraded or neutralized tier-pressure behavior without implying that existing ranking data is corrupt.
- Compatibility rules must distinguish preserving source information from allowing that information to drive recommendation urgency.

---

## Success Criteria

This patch is successful when:

1. Project documentation clearly distinguishes overall/source tiers, position tiers, and recommendation tier pressure.
2. The approved design defines how existing imported `TIERS` values are represented, preserved, migrated, and exposed.
3. Recommendation tier pressure no longer consumes data with ambiguous or incorrect semantics.
4. Existing ranking sets, draft snapshots, and scenarios remain loadable through documented compatibility behavior.
5. UI labels and recommendation reasons do not imply that imported source tiers are position tiers.
6. Automated and manual validation cover the corrected semantics across import, editing, persistence, draft creation, replay, and recommendation output.
7. Future position-tier support is explicitly deferred unless value-based data becomes active scope.

---

## Design Document Determination

A design document is necessary before implementation.

Reason: this patch includes data modeling, import semantics, compatibility rules, recommendation-engine input boundaries, snapshot/export migration behavior, UI terminology, and testing strategy. Those are architecture and product-design decisions, not a simple implementation slice.

Recommended design document:

```text
docs/design/tier-semantics.md
```

That design should answer the unresolved questions in this patch before any code task is promoted into `docs/current-slice.md`.

---

## Architectural Risks

- Ambiguous legacy data could continue to influence recommendation behavior if compatibility rules are too loose.
- Renaming or splitting tier concepts could break existing snapshots, scenario fixtures, exports, or UI assumptions.
- Neutralizing tier pressure may reduce recommendation richness until a better tier source exists.
- Treating source tiers as draft-decision tiers could preserve current behavior but keep false confidence in recommendations.
- Adding a complex tier abstraction too early could slow Phase 5 and make future projection-based tiers harder to integrate.
- UI terminology could remain misleading if only domain code changes.
- Tests may pass while still asserting the old, incorrect tier semantics unless expectations are reviewed deliberately.

---

## Next Phase Recommendation

Create `docs/design/tier-semantics.md` next.

The design phase should decide the canonical tier vocabulary, legacy compatibility behavior, import/export contract changes, recommendation-engine eligibility rules, UI language, and validation strategy. Only after that should `docs/current-slice.md` be updated with the first implementation slice.
