# Tasks

## Current Focus

Phase 5: Rankings & Data.

Phase 5 makes rankings first-class managed data while preserving the existing immutable snapshot boundary. Work begins with canonical domain invariants and staged import contracts, then adds format-specific parsing, normalization, validation, domain conversion, persistence, application workflows, snapshot integration, and focused UI.

The source documents for this task plan are:

- `docs/project.md`
- `docs/design/rankings-data.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/testing.md`

Phase 4 is complete. Its developer workbench, Scenario V1 contract, replay path, persisted draft behavior, and manual QA remain regression constraints throughout Phase 5.

---

## Phase 5 Task Ordering

Tasks are ordered so untrusted external data crosses explicit boundaries before it can become domain data or engine input:

1. Define the ranking-set domain and canonical entry invariants.
2. Define import-stage contracts, diagnostics, and the two supported format profiles.
3. Parse FantasyPros CSV into source-shaped records.
4. Parse Canonical Ranking Set JSON V1 into source-shaped records.
5. Normalize parsed formats into one source-neutral candidate.
6. Validate complete normalized candidates without creating domain objects.
7. Convert validated candidates into canonical ranking sets.
8. Export canonical ranking sets deterministically as JSON V1.
9. Add pure ranking-set edit and tier-management operations.
10. Persist, load, and list first-class ranking sets.
11. Replace and delete ranking sets atomically.
12. Bootstrap the existing seed rankings through the managed ranking path.
13. Add the application import workflow.
14. Add application ranking-management and export workflows.
15. Formalize immutable snapshot creation from managed rankings.
16. Integrate explicit ranking-set selection into draft creation.
17. Add the ranking library and import/export UI.
18. Add focused ranking and tier editing UI.
19. Add ranking-set selection to draft setup.
20. Complete Phase 5 regression and exit validation.

Do not promote multiple unrelated tasks into `docs/current-slice.md` at once. Parser, normalization, validation, conversion, repository, and UI tasks should retain their documented boundaries when split into implementation slices.

---

## Task 1 - Define the Ranking Set Domain and Canonical Invariants

- [x] Complete

### Goal

Establish the pure domain model and reusable invariant checks for mutable ranking sets, canonical entries, summaries, source provenance, and immutable snapshot values.

### Scope

- Define a domain `RankingSet` with local identity, unique display name, source provenance, field-capability metadata, canonical entries, and lifecycle metadata.
- Preserve the existing `RankingEntry` and `Player` shapes as the Draft State and Recommendation Engine compatibility seam.
- Define lightweight ranking-set summaries without persistence or UI types.
- Treat player identity as opaque and unique only within a ranking set or snapshot.
- Define overall rank as contiguous canonical order and position rank as derived contiguous order within each position.
- Define the canonical unknown-team value and nullable ADP behavior without adding scoring signal.
- Define tiers as positive, position-local, non-decreasing values whose source gaps remain meaningful and whose neutral fallback disables tier-cliff behavior.
- Define capability states for team, identity, source order, position rank, ADP, and per-position tier availability.
- Add pure invariant checks over already-canonical ranking values with structured domain failures.
- Keep all new domain types and checks independent of Prisma, React, files, and transport formats.

### Non-Goals

- Do not parse or normalize external input.
- Do not add repositories or persistence models.
- Do not generate cross-source player identity.
- Do not change recommendation scoring.
- Do not add ranking UI.

### Acceptance Criteria

- Canonical ranking sets can be represented without importing persistence, UI, or format-specific types.
- Invariant checks reject empty sets, duplicate player IDs, invalid canonical ranks, unsupported positions, malformed supplied ADP, invalid tier progression, and capability metadata inconsistent with canonical values.
- Position rank is demonstrably derived from overall order rather than independently authoritative.
- A neutral per-position tier produces no tier-cliff signal, while the capability records that source tiers were unavailable.
- Two ranking sets may contain unrelated identities without being merged.
- Existing Draft State, Recommendation Engine, snapshot, and scenario code continues compiling against `RankingEntry[]`.

### Suggested Tests

- Unit tests for valid canonical sets and every set-wide invariant.
- Unit tests for position-local tier progression and preserved tier gaps.
- Unit tests for unknown team, nullable ADP, neutral tiers, and capability consistency.
- Unit tests for canonical overall and position rank ordering.
- Type boundary test proving domain code has no Prisma or React dependency.

---

## Task 2 - Define Import Contracts, Diagnostics, and Format Profiles

- [x] Complete

### Goal

Define the typed handoffs between import stages and freeze the supported source contracts before parser implementation.

### Scope

- Define distinct parsed-source, normalized-candidate, validated-candidate, and import-result contracts.
- Define structured diagnostics with stage, stable code, severity, message, and optional document, row, or field location.
- Define bounded transport-preflight input and failure contracts.
- Freeze the FantasyPros CSV Profile V1 contract using the source profile already used for seed rankings.
- Define accepted encoding, required and optional columns, null markers, supported aliases, tier interpretation, missing-field fallbacks, and maximum input size for that profile.
- Define Canonical Ranking Set JSON V1 as a separate versioned format profile.
- Define the explicit field-capability/fallback matrix as part of the shared import contract.
- Keep Ranking Set JSON distinct from Scenario V1 JSON.
- Define a small explicit supported-format identifier set without runtime plugin discovery.

### Non-Goals

- Do not parse files yet.
- Do not create domain ranking sets.
- Do not build generic user-configurable column mapping.
- Do not persist raw files or transient candidates.
- Do not add UI.

### Acceptance Criteria

- Every import stage has one documented input and output contract.
- Parsed source records cannot be passed directly to engines or repositories.
- The FantasyPros CSV fixture contract is precise enough to implement complete and missing-optional-column inputs without guessing headers, fallbacks, or tier semantics.
- Unsupported format and version failures have stable diagnostic categories.
- Canonical ranking JSON and Scenario V1 cannot be confused at the type or format-selection boundary.

### Suggested Tests

- Compile-time fixtures for stage handoffs.
- Unit tests for transport-preflight bounds and format selection.
- Contract fixtures for the minimum and representative FantasyPros CSV documents.
- Contract fixtures omitting team, tier, ADP, player ID, and position-rank columns where the matrix permits it.
- Contract fixtures for supported and unsupported canonical versions.

---

## Task 3 - Parse FantasyPros CSV Source Records

- [x] Complete

### Goal

Parse the exact FantasyPros CSV Profile V1 syntax into located source records without applying domain normalization or validation.

### Scope

- Accept preflight-approved text and the explicit FantasyPros CSV format identifier.
- Parse the documented CSV grammar, including quoted values and row boundaries required by the frozen profile.
- Identify required source columns and preserve optional supported source values.
- Return source-shaped records with row and field locations.
- Report malformed CSV, missing required columns, duplicate required columns, and unsupported source shape as parser diagnostics.
- Preserve the absence of optional columns as source-shape information for normalization rather than treating it as a parser failure.
- Ignore or warn about documented non-domain columns without adding them to canonical types.
- Keep source strings unnormalized for the next stage.

### Non-Goals

- Do not trim or canonicalize player, team, position, numeric, or tier values beyond syntax handling.
- Do not create player IDs or ranking entries.
- Do not validate set-wide ranking invariants.
- Do not call repositories or engines.
- Do not add a general CSV framework beyond the supported profile.

### Acceptance Criteria

- A valid representative FantasyPros CSV produces deterministic located source records.
- Quoted values and supported line endings parse correctly.
- Malformed syntax and header problems return parser-stage diagnostics.
- Source records retain enough original location data for later normalization and validation errors.
- Missing optional columns reach normalization without invented values.
- No parsed record is a `RankingEntry` or `RankingSet`.

### Suggested Tests

- Fixture tests for minimum and representative valid CSV files.
- Tests for quoted commas, escaped quotes, blank lines, and supported line endings.
- Tests for missing, duplicate, and unknown headers.
- Tests distinguishing missing required columns from missing optional columns.
- Tests proving source casing and raw numeric strings are preserved.

---

## Task 4 - Parse Canonical Ranking Set JSON V1

- [ ] Complete

### Goal

Parse Canonical Ranking Set JSON V1 into located source records without trusting it as domain data.

### Scope

- Accept preflight-approved text and the explicit canonical JSON format identifier.
- Parse JSON syntax and reject non-object roots.
- Validate only the format envelope needed to identify schema version, metadata, and entry locations.
- Reject missing or unsupported schema versions clearly.
- Preserve entry field values as parsed source data for shared normalization and validation.
- Preserve field-capability metadata from the portable envelope without trusting it as accurate.
- Distinguish ranking-set JSON from Scenario V1 and other JSON documents.
- Preserve portable player IDs as source values without yet declaring them valid.

### Non-Goals

- Do not bypass normalization because the file is application-owned.
- Do not create a ranking set or reuse local repository identity automatically.
- Do not replay scenarios.
- Do not perform set-wide domain validation.
- Do not persist parsed data.

### Acceptance Criteria

- Valid JSON V1 produces deterministic located source records.
- Malformed JSON, incorrect roots, missing versions, unsupported versions, and scenario-shaped documents fail at the parser boundary.
- Portable metadata, capability metadata, and entry values remain available to later stages.
- Local ranking-set identity is not accepted as authoritative import identity.
- Parsed JSON records cannot be passed directly to repositories or engines.

### Suggested Tests

- Unit tests for valid minimum and representative documents.
- Tests for malformed JSON and unsupported versions.
- Test proving Scenario V1 is rejected as ranking-set JSON.
- Test proving explicit portable player IDs survive parsing unchanged.
- Test proving capability metadata is parsed but not treated as validated domain data.

---

## Task 5 - Normalize Supported Sources into Ranking Candidates

- [ ] Complete

### Goal

Convert either supported parsed source format into one source-neutral ranking candidate without declaring it domain-valid.

### Scope

- Normalize documented whitespace, casing, team labels, position aliases, numeric representations, and null markers.
- Establish an unambiguous source order while retaining source locations.
- Map FantasyPros fields and canonical JSON fields into the same candidate shape.
- Preserve explicit canonical player IDs.
- Generate deterministic source-local player ID candidates for the CSV profile when no identity is supplied.
- Preserve position-local tier gaps and the profile's documented tier semantics.
- Apply the explicit field matrix: unknown team for absent team data, `null` for absent ADP, derived position rank, and one neutral tier for every player at a position with missing or partial tiers.
- Record complete, partial, generated, derived, source, or `defaulted-neutral` capability states as defined for each field.
- Emit warnings for safe degradation while keeping missing optional values distinct from malformed supplied values.
- Return normalization diagnostics for values that cannot be interpreted under a documented format policy.
- Keep normalization pure and deterministic.

### Non-Goals

- Do not enforce complete set-wide invariants.
- Do not assign local ranking-set identity.
- Do not persist candidates.
- Do not resolve ambiguous players against other ranking sets.
- Do not invent strategic tier cliffs, silently discard malformed supplied values, or guess ambiguous order.

### Acceptance Criteria

- Both supported formats produce the same source-neutral candidate shape.
- Identical source values produce identical normalized output and generated player ID candidates.
- Unsupported aliases, ambiguous order, and identity collisions remain diagnosable rather than guessed.
- Missing optional fields produce deterministic materialized fallbacks, capability states, and warning diagnostics.
- Missing tiers neutralize the entire affected position rather than mixing source and fallback tiers.
- Source locations survive normalization.
- Normalized candidates remain distinct from canonical domain ranking sets.

### Suggested Tests

- Table tests for team, position, numeric, null, and text normalization.
- Matrix tests for every required, derived, defaultable, and unsupported field classification.
- Cross-format test showing semantically equivalent inputs produce equivalent candidates.
- Determinism tests for generated player identity candidates.
- Tests for missing team, tier, ADP, ID, and position-rank columns.
- Tests distinguishing safe absence from malformed values, ambiguous aliases, and unusable source order.

---

## Task 6 - Validate Complete Normalized Ranking Candidates

- [ ] Complete

### Goal

Validate complete source-neutral candidates and return actionable diagnostics without creating domain aggregates or mutating existing data.

### Scope

- Validate required set metadata and non-empty bounded entry collections.
- Validate player identity candidates, names, team labels, supported positions, ranks, ADP, and tiers.
- Reject duplicate or colliding player identities and ambiguous overall ordering.
- Validate position-local tier progression while preserving meaningful gaps.
- Validate field-capability states against source availability and materialized fallback values.
- Require every `defaulted-neutral` position to contain one consistent neutral tier and no fabricated tier gaps.
- Reject malformed supplied optional values even when the same field supports a fallback when absent.
- Validate cross-record consistency and all reusable canonical entry invariants that can be established before conversion.
- Accumulate independent row-level errors where safe.
- Return an explicit validated-candidate result that is the only accepted input to domain conversion.
- Keep ranking-set validity separate from league-specific draft capacity.

### Non-Goals

- Do not assign local set identity or lifecycle metadata.
- Do not assign final canonical overall or position ranks.
- Do not call repositories.
- Do not validate a particular league's total pick capacity.
- Do not change active data on failure.

### Acceptance Criteria

- Invalid candidates cannot reach domain conversion through the typed public boundary.
- Multiple independent semantic problems are returned in one result when safe.
- Duplicate identities, invalid values, ambiguous order, invalid tier progression, and inconsistent capability metadata identify relevant source locations.
- Complete and safely degraded candidates both validate, while malformed supplied optional data fails.
- A valid but small ranking set can pass set validation and later fail draft compatibility.
- Validation is pure and deterministic.

### Suggested Tests

- Unit tests for every field and set-wide rule.
- Tests for capability/value consistency and neutral tier positions.
- Tests for multiple accumulated errors and stable diagnostic ordering.
- Tests distinguishing absent optional data from malformed supplied data.
- Tests distinguishing fatal normalization failures from validation failures.
- Test proving league capacity is not part of ranking-set validity.

---

## Task 7 - Convert Validated Candidates into Canonical Ranking Sets

- [ ] Complete

### Goal

Create complete canonical `RankingSet` aggregates only from validated candidates.

### Scope

- Assign a new local ranking-set identity for create workflows.
- Preserve the existing local identity only for an explicit replacement workflow.
- Assign contiguous overall ranks from validated source order.
- Derive contiguous position ranks from canonical overall order.
- Remove parser locations and format-specific fields.
- Create canonical source provenance, field-capability metadata, and lifecycle metadata.
- Recheck canonical domain invariants before returning the aggregate.
- Guarantee that conversion does not mutate the validated candidate.

### Non-Goals

- Do not persist the ranking set.
- Do not parse, normalize, or repair invalid candidates.
- Do not preserve portable set identity as local repository identity.
- Do not create a draft snapshot yet.
- Do not add UI.

### Acceptance Criteria

- Validated inputs produce complete canonical ranking sets.
- Final overall and position ranks are contiguous and deterministic.
- Source rank gaps do not alter canonical ordinal rank, while source tier gaps remain intact and defaulted positions remain neutral.
- Create and explicit replacement workflows have unambiguous identity behavior.
- The output passes the canonical invariant checker and contains no parser-specific data.

### Suggested Tests

- Exact conversion tests for both source formats.
- Tests for canonical overall and position rank assignment.
- Tests preserving capability states and neutral fallback values.
- Tests for create versus replacement identity behavior.
- Immutability test for validated input.

---

## Task 8 - Export Canonical Ranking Set JSON V1

- [ ] Complete

### Goal

Serialize a valid domain ranking set into one deterministic, lossless, versioned portable format.

### Scope

- Map domain ranking-set metadata, field-capability metadata, and entries into Canonical Ranking Set JSON V1.
- Include explicit player identities and every value used by the engines.
- Preserve canonical entry order and tier gaps.
- Preserve the provenance of derived and defaulted fields so re-import does not present fallbacks as source data.
- Treat local set identity as optional non-authoritative provenance, never import identity.
- Produce deterministic serialization for identical domain values.
- Parse, normalize, validate, and convert exported files through the public import stages in tests.
- Exclude recommendations, drafts, league settings, raw source records, and UI state.

### Non-Goals

- Do not export FantasyPros CSV.
- Do not query persistence from the serializer.
- Do not overwrite an existing set during import implicitly.
- Do not export Scenario V1.
- Do not add file-download UI.

### Acceptance Criteria

- Export followed by the public import pipeline preserves all domain-relevant entry values, portable metadata, and field-capability states.
- Repeated serialization of the same set is deterministic.
- The exported document is clearly distinguishable from Scenario V1.
- Local repository identity is not reused automatically after import.
- No recommendation or draft state is present.

### Suggested Tests

- Exact serialization test for a representative set.
- Semantic export/import round-trip test.
- Round-trip test for a safely degraded set with unknown team, nullable ADP, and defaulted-neutral tiers.
- Determinism test.
- Test proving excluded state is absent.

---

## Task 9 - Add Pure Ranking Set Editing and Tier Operations

- [ ] Complete

### Goal

Provide pure domain operations for supported ranking corrections, reordering, and tier management without allowing intermediate invalid aggregates.

### Scope

- Support rename, supported player-field correction, overall reorder, tier assignment, and tier update intents.
- Recalculate canonical overall and position ranks after ordering changes.
- Validate the complete proposed set before returning an updated aggregate.
- Preserve local ranking-set identity, source provenance, and creation metadata while updating lifecycle and field-capability metadata.
- Reject name, identity, position, ADP, order, and tier changes that would violate domain invariants.
- Recompute or verify affected capability states after edits; completing valid tiers for a defaulted position may replace `defaulted-neutral` with explicit tier availability.
- Return structured domain failures suitable for later application and UI feedback.
- Keep operations immutable and deterministic.

### Non-Goals

- Do not persist edits.
- Do not add authoring history or undo stacks.
- Do not merge ranking sets or reconcile players across sources.
- Do not edit immutable snapshots.
- Do not add UI.

### Acceptance Criteria

- Every successful edit returns a new complete valid ranking set.
- Failed edits leave the original set unchanged.
- Reordering deterministically recalculates overall and position ranks.
- Tier edits preserve position-local non-decreasing progression and meaningful gaps.
- Field-capability metadata remains consistent after correction, reorder, and tier edits.
- No operation can target a snapshot.

### Suggested Tests

- Unit tests for every supported edit intent.
- Tests for rank recalculation after movement across positions.
- Tests for valid and invalid tier changes.
- Tests for capability transitions after filling previously defaulted tier data or ADP values.
- Immutability and deterministic-output tests.

---

## Task 10 - Persist, Load, and List Ranking Sets

- [ ] Complete

### Goal

Add a dedicated repository boundary for creating, loading, and listing first-class mutable ranking sets.

### Scope

- Add persistence capable of storing ranking-set metadata, field-capability metadata, and individually addressable canonical entries.
- Add a ranking-set repository that accepts and returns domain values only.
- Create a complete validated set transactionally.
- Load one complete set by local identity and reconstruct canonical ordering.
- List lightweight summaries without loading every entry.
- Enforce case-insensitive display-name uniqueness through a domain-facing conflict result.
- Keep persistence records and client types private to repository mapping.
- Add focused fake-client tests and a real persistence round-trip path.

### Non-Goals

- Do not replace, delete, import, or export yet.
- Do not expose entry-level repository mutation.
- Do not normalize a global player catalog.
- Do not change draft snapshot persistence.
- Do not add UI.

### Acceptance Criteria

- A canonical ranking set can be created and loaded without losing domain values, capability states, or order.
- Listing summaries does not load full entry collections.
- Duplicate names return an explicit conflict without partial data.
- Domain callers never receive persistence records or Prisma types.
- A real persistence round trip proves repository mapping and storage work together.

### Suggested Tests

- Repository create/load tests with injected fakes.
- Summary projection test proving entries are not loaded.
- Name-conflict and transaction rollback tests.
- Real persistence integration test for one representative set.
- Real persistence round trip for one safely degraded set.

---

## Task 11 - Replace and Delete Ranking Sets Atomically

- [ ] Complete

### Goal

Complete the mutable ranking-set repository lifecycle while preserving set-wide validity and snapshot independence.

### Scope

- Replace an existing set with a complete validated aggregate using the same local identity.
- Replace metadata and entries atomically so readers never observe a partial set.
- Replace field-capability metadata in the same transaction as its canonical entries.
- Delete a ranking set by identity.
- Return explicit not-found and name-conflict outcomes.
- Prove multiple ranking sets remain isolated through replacement and deletion.
- Ensure deletion has no cascade path to draft ranking snapshots or scenarios.
- Keep optimistic concurrency or revision history deferred unless existing application behavior requires it.

### Non-Goals

- Do not expose individual row updates.
- Do not add soft deletion, audit logs, revisions, or restore.
- Do not delete or rewrite draft snapshots.
- Do not add application actions or UI.
- Do not add multi-user ownership.

### Acceptance Criteria

- Successful replacement is all-or-nothing and preserves local set identity.
- Failed replacement leaves the previously stored set unchanged.
- Replacement cannot persist capability metadata inconsistent with canonical fallback values.
- Deleting one set leaves other sets and all draft snapshots unchanged.
- Not-found and name conflicts do not leak database errors.
- Repository behavior remains deterministic for canonical inputs.

### Suggested Tests

- Transactional replacement and rollback tests.
- Capability consistency test across replacement and reload.
- Multiple-set isolation tests.
- Delete and not-found tests.
- Integration test proving draft snapshot survival after source deletion.

---

## Task 12 - Bootstrap Seed Rankings as a Managed Set

- [ ] Complete

### Goal

Make the existing seed rankings available through the Phase 5 domain and repository path without changing their recommendation behavior.

### Scope

- Convert the existing seed data into one valid initial managed ranking set with seed provenance.
- Run seed data through canonical domain invariant checks before persistence.
- Make bootstrap idempotent so repeated startup or setup does not duplicate the set.
- Preserve existing player identities, canonical order, ADP, position ranks, and tiers.
- Record complete source capabilities for the fields supplied by the seed data.
- Provide a clear failure if existing seed data violates the new domain contract.
- Keep the seed asset as bootstrap input rather than the runtime source for every new draft.
- Prove recommendations from the managed seed set match recommendations from the existing seed array for identical draft inputs.

### Non-Goals

- Do not silently repair invalid seed data.
- Do not remove legacy snapshot readers.
- Do not import external files during bootstrap.
- Do not add user-facing seed controls.
- Do not change recommendation tuning.

### Acceptance Criteria

- One managed seed ranking set exists after bootstrap, even when bootstrap runs repeatedly.
- The managed set is domain-equivalent to the current seed data and records no neutral fallback where complete source data exists.
- Existing deterministic recommendation outputs remain unchanged for equivalent inputs.
- New runtime ranking selection can load the seed set through the repository.
- Bootstrap failure is explicit and leaves no partial set.

### Suggested Tests

- Idempotent bootstrap test.
- Exact seed-to-managed-set equivalence test.
- Recommendation parity regression test.
- Failure test for invalid seed input.

---

## Task 13 - Add the Application Import Workflow

- [ ] Complete

### Goal

Orchestrate preflight, format parsing, normalization, validation, domain conversion, and atomic persistence without allowing invalid imports to affect stored data.

### Scope

- Accept import text, explicit supported format, desired set name, and create or explicit replacement intent.
- Execute the public import stages in the documented order.
- Stop at the failing stage and return structured diagnostics.
- Return successful degradation warnings and computed capability states alongside the saved result.
- Create a new local set by default.
- Preserve local set identity only for an explicit authorized replacement.
- Commit only a complete canonical domain aggregate through the ranking-set repository.
- Return the saved domain set or summary after success.
- Keep transient parser and candidate data out of persistence.

### Non-Goals

- Do not read browser files in the domain workflow.
- Do not add UI or preview state.
- Do not auto-detect arbitrary formats.
- Do not merge imported rows into an existing set.
- Do not create drafts or scenarios.

### Acceptance Criteria

- Valid CSV and canonical JSON imports create independent managed sets.
- CSV imports with permitted missing optional fields succeed with deterministic fallbacks, capability metadata, and warnings.
- Invalid import at any stage creates or replaces nothing.
- Replacement requires explicit intent and preserves the target set's local identity.
- Diagnostics retain stage and source location through the application boundary.
- The workflow never passes parsed or normalized records to the repository.

### Suggested Tests

- End-to-end application tests for both supported formats.
- End-to-end import test for a source missing team, tier, ADP, ID, and position-rank columns.
- Failure isolation test for each import stage.
- Create-versus-replace identity tests.
- Test proving an existing valid set survives failed replacement.

---

## Task 14 - Add Application Ranking Management and Export Workflows

- [ ] Complete

### Goal

Expose repository-backed list, load, edit, delete, and canonical export operations through application boundaries suitable for UI use.

### Scope

- List lightweight ranking-set summaries.
- Load one complete domain ranking set for review or editing.
- Apply supported pure edit intents and persist only complete valid replacements.
- Delete a ranking set without affecting snapshots.
- Export a loaded valid set through the canonical serializer.
- Preserve and return field-capability metadata for inspection and export.
- Return structured not-found, conflict, validation, and persistence failures.
- Keep application results free of persistence records and framework-specific state.

### Non-Goals

- Do not add UI.
- Do not expose direct entry persistence.
- Do not add history, undo, set merge, or cross-source comparison.
- Do not export source-specific CSV.
- Do not edit snapshots or existing drafts.

### Acceptance Criteria

- List and load operations return domain-facing values.
- Supported edits use the pure domain operations and atomic repository replacement.
- Invalid edits and conflicts preserve the current stored set.
- Delete leaves existing draft snapshots loadable.
- Export is deterministic and performs no persistence mutation.
- Editing and export never recast neutral fallback values as source-provided data.

### Suggested Tests

- Application tests for list, load, edit, delete, and export.
- Failure mapping tests for not-found, conflict, and invalid edits.
- Snapshot-survival integration test after deletion.
- Test proving export does not write.

---

## Task 15 - Formalize Immutable Snapshot Creation from Managed Rankings

- [ ] Complete

### Goal

Create a pure snapshot boundary that copies canonical ranking entries and preserves all existing persisted and scenario compatibility.

### Scope

- Add or formalize pure snapshot creation from a valid `RankingSet` or validated ranking context.
- Deep-copy every domain-relevant player and ranking value.
- Copy field-capability metadata for inspection while keeping canonical entry values authoritative for scoring.
- Keep source-set identity and name optional, non-authoritative provenance outside engine input.
- Expose no snapshot update or refresh operation.
- Preserve the current Phase 2 serialized ranking-array reader as a supported legacy representation.
- Ensure Scenario V1 continues embedding complete canonical ranking entries.
- Keep neutral tiers and nullable ADP materialized so Scenario V1 replay does not require capability metadata to reproduce recommendation behavior.
- Reuse canonical ranking-entry validation between managed imports, snapshots, and scenarios without conflating their document rules.

### Non-Goals

- Do not change draft setup yet.
- Do not migrate or rewrite existing snapshot records.
- Do not link snapshot loading to a source ranking set.
- Do not persist recommendations.
- Do not introduce a generic snapshot-version framework before the entry shape changes.

### Acceptance Criteria

- Snapshot creation returns a complete value copy with no shared mutable player or entry objects.
- New snapshots preserve capability metadata without making it an independent Recommendation Engine input.
- Changing or deleting the source set cannot change the snapshot value.
- Existing Phase 2 snapshots still parse and hydrate exactly.
- Existing Scenario V1 files still validate and replay.
- Engines continue receiving only canonical `RankingEntry[]` values.

### Suggested Tests

- Deep-copy and source-mutation tests.
- Legacy snapshot parsing regression tests.
- Scenario V1 validation and replay regression tests.
- Replay regression proving a defaulted-neutral position produces no tier-cliff signal without scenario capability metadata.
- Deterministic snapshot serialization test.

---

## Task 16 - Integrate Ranking Set Selection into Draft Creation

- [ ] Complete

### Goal

Create new drafts from an explicitly selected managed ranking set while preserving atomic snapshot persistence and existing draft behavior.

### Scope

- Accept a ranking-set identity in configured draft creation.
- Load the selected set through the ranking-set repository.
- Validate ranking count against the selected league configuration at draft creation time.
- Create an immutable snapshot from the selected canonical entries.
- Persist the draft and its snapshot atomically through the existing draft repository boundary.
- Stop using the code-owned seed array as an implicit runtime input for configured creation.
- Preserve existing draft hydration, pick, undo, reset, delete, recommendation, and resume behavior.
- Reject attempts to switch ranking sets on an existing persisted draft.

### Non-Goals

- Do not add draft-setup UI selection yet.
- Do not edit or refresh an existing draft snapshot.
- Do not persist source-set dependence in engine inputs.
- Do not add ranking merge or new draft-time fallback behavior; all field fallbacks must already be materialized by import normalization.
- Do not alter recommendation scoring.

### Acceptance Criteria

- A new draft uses the exact selected ranking set snapshot.
- An insufficient set fails before any draft or snapshot is created.
- Later edit or deletion of the source set does not alter or prevent loading the draft.
- Existing draft operations and deterministic recommendations use the captured snapshot.
- Existing drafts created before Phase 5 continue to load.

### Suggested Tests

- Application test for draft creation with two distinct ranking sets.
- Insufficient-capacity failure isolation test.
- Source-edit and source-delete snapshot isolation tests.
- Existing persisted draft compatibility regression.

---

## Task 17 - Add Ranking Library and Import/Export UI

- [ ] Complete

### Goal

Allow a user to view managed ranking sets, import supported files, export a set, and delete a set through a focused ranking-library workflow.

### Scope

- Display lightweight ranking-set summaries with name, source kind, entry count, and lifecycle metadata.
- Surface concise capability status for missing team, ADP, and per-position tier data.
- Add explicit FantasyPros CSV and Canonical JSON import choices.
- Read selected local files and submit text to the application import workflow.
- Display parser, normalization, validation, conflict, and persistence diagnostics with row or field locations when available.
- Distinguish successful degradation warnings from import-blocking errors and explain which features are neutralized.
- Refresh the library after successful import or deletion.
- Export the selected set using the canonical JSON workflow.
- Confirm destructive deletion and explain that existing draft snapshots remain unchanged.
- Preserve the current draft and workbench state when import fails.

### Non-Goals

- Do not implement ranking entry or tier editing yet.
- Do not build generic column mapping or source previews beyond concise diagnostics.
- Do not import Scenario V1 as rankings.
- Do not add cloud storage, drag-and-drop polish, or source refresh scheduling.
- Do not redesign the Draft Room.

### Acceptance Criteria

- A user can import each supported format and see the resulting set in the library.
- Invalid files show actionable stage-specific diagnostics and create no set.
- Files missing permitted optional columns import successfully and clearly disclose their fallbacks.
- A user can export canonical JSON and re-import it as an independent set.
- Deleting a set removes it from the library without affecting existing drafts.
- UI code performs no ranking normalization, validation, or export mapping.

### Suggested Tests

- Component tests for summary loading and empty state.
- Integration tests for successful CSV and JSON import.
- Component tests for stage-specific diagnostics.
- Component tests for capability badges and successful fallback warnings.
- Export/re-import and delete-confirmation workflow tests.
- Manual QA with one valid and one invalid source file.

---

## Task 18 - Add Ranking and Tier Editing UI

- [ ] Complete

### Goal

Allow supported ranking corrections, reordering, and tier changes while keeping domain rules authoritative.

### Scope

- Load one complete ranking set from the application management workflow.
- Display canonical order, position rank, player facts, ADP, and position-local tier.
- Display whether each supported field is source-provided, derived, absent, or defaulted-neutral.
- Collect rename, supported player-field correction, reorder, and tier-change intents.
- Submit edits through pure domain operations and atomic application replacement.
- Display structured validation and conflict failures without replacing the current valid view.
- Refresh from the saved canonical aggregate after success.
- Refresh capability states after edits, including replacement of neutral tier fallback with complete valid manual tiers.
- Clearly distinguish mutable ranking sets from immutable draft snapshots.

### Non-Goals

- Do not calculate ranks or tier validity independently in the UI.
- Do not add spreadsheet-grade bulk editing, drag animation, history, or undo.
- Do not edit source files or past draft snapshots.
- Do not merge or compare sets.
- Do not add recommendation tuning controls.

### Acceptance Criteria

- Supported edits persist and reload as a valid canonical ranking set.
- Reordering displays domain-derived overall and position ranks after save.
- Invalid tier or player edits return useful feedback and preserve stored data.
- Capability provenance remains accurate and visible after successful edits.
- Existing drafts created from earlier set values remain unchanged.
- UI contains no duplicated domain validation or rank calculations.

### Suggested Tests

- Component tests for loading and displaying canonical values.
- Integration tests for rename, reorder, correction, and tier edits.
- Failure tests for invalid tiers, conflicts, and stale not-found targets.
- Tests for capability-state changes after completing missing tier or ADP data.
- Snapshot-isolation regression after editing a source set.

---

## Task 19 - Add Ranking Set Selection to Draft Setup

- [ ] Complete

### Goal

Allow the user to choose which managed ranking set will anchor a new draft.

### Scope

- Load available ranking-set summaries into the existing configured draft setup workflow.
- Require an explicit valid ranking-set selection.
- Default to the managed seed set when available without hard-coding its entries into draft creation.
- Show set name, source kind, and player count needed to make a useful selection.
- Show a concise warning when the selected set has neutralized tier positions or missing optional data without blocking draft creation.
- Surface league-capacity incompatibility before or during authoritative creation validation.
- Submit ranking-set identity to the shared draft-creation application workflow.
- Preserve cancel behavior and existing in-progress-draft confirmation.
- Make clear that the selected set is snapshotted and cannot be switched on the created draft.

### Non-Goals

- Do not edit rankings inside draft setup.
- Do not blend multiple ranking sets.
- Do not allow existing drafts to switch snapshots.
- Do not add league presets or account preferences.
- Do not redesign unrelated draft controls.

### Acceptance Criteria

- A user can create two drafts from different sets and receive the corresponding deterministic recommendations.
- The managed seed set provides a quick default path.
- Missing, deleted, or insufficient ranking sets produce clear failures without partial draft creation.
- Safely degraded sets remain selectable and produce deterministic recommendations from their materialized canonical values.
- Refresh and resume continue using each draft's captured snapshot.
- Draft setup UI passes identity only and contains no ranking-copy logic.

### Suggested Tests

- Component test for summary loading, default selection, and empty state.
- Integration test creating drafts from two distinct sets.
- Failure tests for missing, deleted, and insufficient sets.
- Persisted refresh/resume snapshot regression test.

---

## Task 20 - Complete Phase 5 Regression and Exit Validation

- [ ] Complete

### Goal

Prove Phase 5 meets its success criteria without regressing deterministic draft, recommendation, persistence, or replay behavior.

### Scope

- Run focused and full automated validation across domain, import, persistence, application, snapshot, draft, replay, and UI boundaries.
- Confirm FantasyPros CSV and Canonical JSON contracts with frozen fixtures.
- Confirm every field-capability matrix row with complete, missing, and malformed source fixtures as applicable.
- Confirm import/export semantic round trips and deterministic serialization.
- Confirm invalid imports and edits never partially replace stored data.
- Confirm multiple-set isolation, tier management, and atomic lifecycle behavior.
- Confirm neutral team, ADP, and tier fallbacks never fabricate recommendation evidence and remain visible through export, persistence, snapshots, and UI.
- Confirm source edits and deletion do not affect existing draft snapshots or Scenario V1 replay.
- Confirm legacy Phase 2 snapshots and existing persisted drafts still load.
- Confirm recommendation output remains deterministic for identical draft and snapshot inputs.
- Complete focused manual QA from import through draft creation, source edit, reload, export, and deletion.
- Validate linting, type checking, production build, persistence integration, and full tests.

### Non-Goals

- Do not add new Phase 5 features during exit validation.
- Do not weaken tests or silently change expected recommendation behavior.
- Do not add unsupported formats, player reconciliation, feeds, or Phase 6 strategy.
- Do not normalize historical snapshots merely to simplify validation.
- Do not begin live-provider integration.

### Acceptance Criteria

- Every Phase 5 task acceptance criterion is satisfied.
- Both supported import profiles pass exact positive and negative fixtures.
- Permitted missing-column imports succeed with exact warnings, capability states, and canonical fallback values; malformed supplied values fail.
- A canonical export/import round trip preserves domain-relevant ranking values.
- At least two managed sets remain isolated through import, edit, selection, and deletion.
- Existing drafts and scenarios remain usable after their source set changes or is deleted.
- Manual, persisted, and replay workflows continue producing deterministic recommendations.
- Full automated and manual validation passes with no Phase 5 non-goals introduced.

### Suggested Tests

- Run the full automated suite and project validation commands.
- Complete a real persistence round trip for a managed set and selected draft snapshot.
- Run existing curated scenarios before and after managed ranking changes.
- Compare complete-source recommendations with safely degraded inputs and verify only unavailable signals are neutralized.
- Complete the Phase 5 manual QA checklist.
- Compare exact recommendation output for repeated identical snapshot inputs.

---

## Testing Status

Phase 1 manual simulator, Phase 2 persistence, Phase 3 recommendation, and Phase 4 developer workbench coverage are complete.

Phase 4 exit validation passed 27 automated test files and 305 tests, ESLint, TypeScript no-emit validation, Prisma schema validation, the production build, and the recorded manual QA in `docs/qa/manual-phase-4-qa.md`.

Phase 5 testing is planned through Tasks 1-20. Each implementation task includes focused validation; Task 20 is the cross-feature regression and manual exit gate.

---

## Backlog

Not required for Phase 5:

- Canonical cross-provider player catalog or automatic player reconciliation
- Arbitrary CSV column mapping or runtime parser plugins
- Additional ranking formats beyond the approved FantasyPros CSV and Canonical JSON profiles
- Ranking-set merge, comparison, blending, history, undo, or collaboration
- Raw-file retention, scheduled refresh, scraping, news, projections, or third-party feeds
- Authentication, accounts, cloud sharing, or ranking marketplaces
- Recommendation model changes, simulations, opponent modeling, or Phase 6 insights
- Generic Draft Source or live-provider interfaces
- ESPN, Yahoo, or Sleeper integration
- Polling, WebSockets, reconnect behavior, or provider event normalization
- Existing-draft ranking-set switching or snapshot rewriting
- Mobile-first redesign or broad draft-room polish
- New services, queues, workers, or deployment infrastructure

See `future_ideas.md` for additional deferred ideas.
