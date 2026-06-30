# Tier Semantics Design

## Status

Design baseline for the tier semantics patch. Implementation has not begun.

Source project: `docs/patches/tier-semantics-project.md`.

This document resolves the tier-semantics questions that must be answered before implementation tasks are created or promoted into `docs/current-slice.md`.

---

## Purpose

The app currently conflates three different concepts:

- Overall/source tiers from a ranking provider.
- Position tiers used for positional comparison.
- Recommendation tier pressure used as an actionable draft-decision signal.

The immediate problem is that FantasyPros `TIERS` were imported and treated as though they were position-local recommendation tiers. They should instead be treated as provider/source tiers for the current supported FantasyPros profile.

This design corrects the domain semantics while preserving Phase 5 boundaries:

- Ranking sets remain mutable source data.
- Draft snapshots remain immutable historical inputs.
- The Draft State Engine and Recommendation Engine remain pure and source-agnostic.
- Existing persisted data remains loadable where practical.

---

## Design Goals

- Give every tier-like value an explicit meaning.
- Preserve imported FantasyPros tier information without letting it create false positional urgency.
- Keep recommendation tier pressure disabled unless the input data is explicitly recommendation-eligible.
- Keep position-tier derivation from ADP-only or rank-only data out of scope.
- Preserve compatibility for legacy ranking sets, snapshots, exports, and scenarios.
- Provide enough direction to create implementation tasks without redefining the model.

## Non-Goals

- Do not derive position tiers from overall rank or ADP.
- Do not add projections, VORP, replacement-level values, simulations, or new data sources.
- Do not tune recommendation weights.
- Do not introduce new recommendation factors.
- Do not add a global player catalog.
- Do not redesign the ranking-management UI beyond terminology and tier-related controls.
- Do not rewrite historical snapshots solely for cosmetic consistency.

---

## Tier Vocabulary

### Source Tier

A tier supplied by an import source or provider.

For the FantasyPros CSV profile, `TIERS` is a source tier on the overall board. It may be useful for display, provenance, export, and future analysis, but it is not a position tier and is not recommendation-tier-pressure input.

### Position Tier

A tier that groups players within one position for positional comparison.

Position tiers are not active scope for this patch. The app should not create them from rank-only or ADP-only data. Future position-tier support should require an approved design using projection, VORP, or another value-based input.

### Recommendation Tier

The engine-facing tier concept used by tier-drop or tier-cliff scoring.

Recommendation tiers must be position-local, complete for each eligible position, validated, and explicitly marked recommendation-eligible. If those conditions are not satisfied, recommendation tier pressure must no-op.

### Neutral Recommendation Tier

A materialized engine-facing fallback that prevents tier-drop pressure from firing.

The neutral form should make every player at a position belong to one recommendation tier, so there is no next-tier cliff to score. Neutral tiers are not evidence of a real tier structure.

### Legacy Ambiguous Tier

A pre-patch `tier` value whose original semantics are not trustworthy enough to use for recommendation tier pressure.

Legacy ambiguous tiers may be loaded for compatibility, but they should be interpreted conservatively and neutralized for recommendation scoring unless an explicit migration proves they are recommendation-eligible.

---

## Core Decisions

### Decision: FantasyPros `TIERS` Are Source Tiers

FantasyPros `TIERS` from the current supported CSV profile should be represented as overall/source tier data.

They should not populate recommendation-tier pressure directly. They should not be called position tiers in docs, diagnostics, UI labels, tests, or recommendation explanations.

Reason:

The app does not currently own the projection or value-over-replacement data needed to establish high-quality position tiers. Treating provider source tiers as positional urgency creates false confidence in the Recommendation Engine.

### Decision: Recommendation Tier Pressure Requires Explicit Eligibility

Tier-drop scoring may run only when ranking data carries explicit recommendation-tier semantics.

Recommendation-eligible tier data must be:

- Position-local.
- Complete for every player in the eligible position.
- Non-decreasing within each position's canonical order.
- Validated as a recommendation input, not merely preserved as source metadata.
- Available in the immutable snapshot used by the draft or scenario.

If eligibility is absent, unknown, legacy ambiguous, or source-only, the engine-facing recommendation tier must be neutralized.

### Decision: Do Not Derive Position Tiers From Rank Or ADP

The patch should not create position tiers from overall rank, position rank, ADP rank, or FantasyPros source tier values.

Reason:

Those inputs describe draft cost and ordering. They do not reliably describe positional value cliffs. Position-tier support should wait for value-based data such as projections or VORP.

### Decision: Preserve Source Tiers Separately From Engine-Facing Tiers

The domain should distinguish preserved source tier information from the tier value passed to recommendation scoring.

The exact TypeScript names can be chosen during implementation, but the conceptual model should be:

```text
source tier metadata
    preserved for display, export, provenance, and compatibility

recommendation tier
    materialized in engine-facing ranking entries
    neutral unless explicitly recommendation-eligible
```

This keeps imported data inspectable while preventing it from fabricating recommendation evidence.

### Decision: Legacy `tier` Values Are Ambiguous By Default

Existing ranking sets, snapshots, scenarios, and canonical exports may contain a `tier` field with unclear semantics.

Pre-patch tier values should load through a compatibility path as legacy ambiguous tiers. They should not remain recommendation-eligible by default.

When practical, the raw legacy value may be preserved as source-tier-like metadata. When only engine-facing `RankingEntry[]` values exist, compatibility may be limited to loading the draft or scenario with neutralized recommendation tier behavior.

Reason:

The app cannot safely prove old `tier` values were valid position-local recommendation tiers. Preserving loadability matters; preserving false urgency does not.

---

## Domain Model Direction

The current single `tier` concept is insufficient. The corrected model should separate:

- Source tier value.
- Source tier semantics.
- Recommendation tier value.
- Recommendation-tier eligibility.

The engine-facing ranking entry may continue to expose a `tier`-shaped value for compatibility, but after this patch that value must mean recommendation tier, not raw source tier.

For ranking sets and snapshots, tier metadata should be able to express:

- `source-overall`: a provider/source overall-board tier.
- `recommendation-position`: a validated position-local recommendation tier.
- `neutral`: no recommendation tier pressure is available.
- `legacy-ambiguous`: a loaded pre-patch tier whose semantics are not trusted.
- `none`: no tier-like source data exists.

The exact enum names are implementation details. The required behavior is that code can tell whether a tier value is preserved source information or recommendation-eligible input.

---

## Import and Normalization

### FantasyPros CSV

For the FantasyPros CSV profile:

- Parse `TIERS` as a source-tier column.
- Normalize valid supplied values as source tier values.
- Validate source tiers against overall/source semantics, not position-local semantics.
- Do not copy source tier values into recommendation-tier pressure.
- Materialize neutral recommendation tiers for engine-facing entries.
- Emit a warning or capability note that FantasyPros source tiers are preserved but not used for recommendation tier pressure.

If `TIERS` is absent:

- Import can still succeed if other required data is valid.
- Source-tier capability is `none`.
- Recommendation tier remains neutral.

If `TIERS` is supplied but malformed:

- Import should fail rather than silently discard a bad supplied value.

### Canonical Ranking Set JSON

Canonical exports after this patch should use a new or revised contract that can carry tier semantics explicitly.

Design intent:

- Continue reading existing Canonical Ranking Set JSON V1 as a legacy format.
- Treat V1 `tier` values as legacy ambiguous unless the reader has explicit trusted semantics.
- Export corrected ranking sets using a versioned contract that distinguishes source tier from recommendation tier.

The implementation may choose the exact version label, but the contract must prevent a future importer from confusing source tiers with recommendation tiers again.

### Other Source Formats

Future formats must declare tier semantics before exposing tier data to the domain.

New adapters must classify tier-like input as one of:

- Source tier only.
- Recommendation-eligible position tier.
- Unsupported.
- Absent.

Unknown tier semantics must not be guessed.

---

## Validation Rules

### Source Tier Validation

Source tiers are preserved source data. For FantasyPros overall/source tiers, validation should ensure:

- Supplied values are positive integers or an explicitly supported null/absence marker.
- Values are compatible with the documented source profile.
- Values do not create ambiguous or contradictory source ordering claims.

Source tiers should not be validated as position-local tier cliffs.

### Recommendation Tier Validation

Recommendation tiers are engine input. If a ranking set or scenario claims recommendation-tier eligibility, validation must ensure:

- Each eligible position has complete tier values.
- Tier values are positive integers.
- Tier values are non-decreasing within position order.
- Tier gaps are intentional and preserved.
- Eligibility metadata agrees with the materialized entries.

If validation cannot prove eligibility, the data must be neutralized or rejected according to the importing contract. It must not be partially trusted.

### Neutral Tier Validation

Neutral recommendation tiers must be internally consistent:

- Every player in a neutralized position receives the same recommendation-tier value.
- Neutralized positions do not generate tier-drop pressure.
- Metadata must not describe neutralized values as source-provided recommendation tiers.

---

## Persistence and Export Compatibility

### Mutable Ranking Sets

Mutable ranking sets should persist enough tier metadata to preserve the distinction between source tiers and recommendation tiers.

Existing stored sets with only legacy `tier` data should load through a compatibility mapper. That mapper should:

- Preserve the set when possible.
- Mark old tier values as legacy ambiguous or source-like metadata.
- Materialize neutral recommendation tiers unless trusted eligibility exists.
- Avoid silently upgrading old values into recommendation-tier pressure.

### Immutable Draft Snapshots

New snapshots should capture:

- Engine-facing recommendation tiers.
- Tier eligibility or neutralization metadata when available for inspection.
- Preserved source tier information when practical.

Existing snapshots without semantics metadata should continue to load. Their legacy tier values should not be treated as recommendation-eligible by default.

This may intentionally change recommendation output for old drafts where prior output depended on invalid tier pressure. The compatibility requirement is loadability and deterministic behavior, not preservation of a known-wrong signal.

### Canonical Exports

Post-patch canonical exports should be explicit enough to round-trip:

- Source tier values.
- Source tier semantics.
- Recommendation tier values.
- Recommendation eligibility or neutralization state.

Old exports remain readable as legacy ambiguous data. New exports should not use an ambiguous `tier` field without semantic metadata.

### Scenarios and Replay

Existing Scenario V1 files should remain loadable and replayable.

Scenario V1 embedded `tier` values are legacy ambiguous unless the scenario contract is updated to declare semantics. For this patch:

- Existing scenarios load deterministically.
- Tier pressure is neutralized unless recommendation-tier semantics are explicit.
- Scenario replay must not require a mutable ranking set.

A future Scenario V2 may add explicit tier semantics if recommendation-tier scenarios need to be portable.

---

## Recommendation Engine Behavior

Recommendation tier pressure should not consume source tiers.

The preferred behavior is:

- Engine-facing entries contain neutral recommendation tiers unless explicitly eligible tier data exists.
- The tier-drop modifier no-ops for neutralized positions.
- Reasons do not mention tier cliffs when the tier-drop modifier did not affect scoring.
- Other modifiers remain unaffected.

The engine should remain pure and deterministic. It should not query ranking-set repositories, parse source metadata, or infer whether source tiers are useful.

If the implementation keeps tier eligibility metadata outside `RankingEntry[]`, the application boundary must still provide the Recommendation Engine with inputs that make tier pressure deterministic and source-agnostic. The engine must never inspect raw import records or mutable ranking-set state.

---

## UI and Editing Behavior

UI language should distinguish tier concepts clearly:

- Use "Source tier" for imported FantasyPros `TIERS`.
- Do not use "Position tier" for FantasyPros imported tiers.
- Do not show tier-cliff recommendation reasons for neutralized tier data.
- Explain that source tiers are preserved but not used for recommendation tier pressure.

Ranking editing should not imply that editing source tiers tunes recommendations.

Current patch behavior:

- Source-tier display and correction may be supported if narrowly scoped and clearly labeled.
- Manual recommendation-tier authoring is out of scope unless an approved implementation slice explicitly adds validated recommendation-tier editing.
- Position-tier creation remains future work.

Draft setup warnings should be concise:

- A ranking set may say tier pressure is unavailable or neutralized.
- That warning should not block draft creation.
- The warning should not imply the ranking set is invalid.

---

## Documentation Updates Required After Design Approval

Implementation tasks should update:

- `docs/project.md` to correct Phase 5 tier language.
- `docs/architecture.md` to clarify tier semantics at ranking and recommendation boundaries.
- `docs/decisions.md` with the source-tier versus recommendation-tier decision.
- `docs/design/rankings-data.md` to supersede position-local assumptions for imported FantasyPros tiers.
- `docs/design/recommendation-engine.md` to clarify tier-drop eligibility.
- `docs/testing.md` if testing strategy language needs to distinguish source tiers from recommendation tiers.
- Patch task docs or active tasks once the user approves promotion into implementation work.

Do not update `docs/current-slice.md` until the first implementation slice is intentionally planned.

---

## Testing Strategy

Tests should prove both semantic correction and compatibility.

### Import and Normalization

- FantasyPros `TIERS` import as source tiers.
- Missing FantasyPros `TIERS` succeeds with no source-tier capability.
- Malformed supplied `TIERS` fails.
- Source tiers do not populate recommendation-tier pressure.

### Domain Validation

- Source-tier validation is not position-local tier validation.
- Recommendation-tier eligibility requires complete position-local data.
- Neutral recommendation tiers cannot produce tier cliffs.
- Legacy ambiguous tiers are not recommendation-eligible by default.

### Persistence and Export

- Legacy ranking sets load through the compatibility mapper.
- New exports round-trip source-tier and recommendation-tier semantics.
- Old Canonical Ranking Set JSON V1 imports as legacy ambiguous where needed.
- Source edits and deletion do not affect existing snapshots.

### Recommendation Scenarios

- FantasyPros source tiers do not produce tier-cliff score components.
- Neutralized tier data does not produce tier-cliff reasons.
- Roster fit, scarcity, run pressure, value opportunity, and base ranking behavior remain stable.
- Deterministic output is preserved for identical draft and snapshot inputs.

### Replay and Manual QA

- Existing Scenario V1 files replay deterministically.
- Manual QA verifies import, source-tier display, draft setup warning, recommendation output, export/re-import, snapshot isolation, and replay.

---

## Task Planning Guidance

Recommended implementation task order:

1. Update docs and decisions to record the approved tier vocabulary.
2. Update import contracts and canonical export contracts for explicit tier semantics.
3. Add domain metadata and validation for source tier, recommendation tier, neutral tier, and legacy ambiguous tier states.
4. Update FantasyPros normalization so `TIERS` becomes source tier metadata and recommendation tiers are neutral.
5. Update legacy ranking-set, snapshot, export, and scenario readers for compatibility neutralization.
6. Update recommendation tier-drop behavior and tests so neutralized tiers no-op.
7. Update UI labels, warnings, editing language, and manual QA.
8. Run patch exit validation.

Each slice should be small enough to review independently. Do not combine import semantics, recommendation behavior, and UI copy into one large implementation slice unless the user explicitly requests it.

---

## Open Questions

No product or architecture question blocks task creation after this design.

Implementation planning still needs to choose exact TypeScript names, JSON version labels, migration helper names, and UI copy. Those are slice-level details and should follow this design without changing the tier model.

---

## Deferred Future Capability

Position tiers may be reconsidered when the app has value-based inputs such as projections, VORP, or replacement-level estimates.

At that point, a future design should decide:

- How position tiers are generated or imported.
- Whether they are user-editable.
- How they interact with recommendation tier pressure.
- How old snapshots and scenarios preserve deterministic behavior.

Until then, source tiers remain source metadata, and recommendation tier pressure should stay neutral unless a ranking context explicitly provides validated recommendation tiers.
