# Phase 5 Rankings & Data Design

## Status

Design baseline for Phase 5. Implementation has not begun.

This document defines the architectural boundaries for ranking management, import/export, persistence, snapshots, draft integration, and replay compatibility. It intentionally does not define storage schemas, transport endpoints, UI components, or executable implementation tasks.

---

## Context

Rankings currently enter the application as code-owned seed data or as complete ranking arrays embedded in persisted drafts and portable scenarios. The Draft State Engine and Recommendation Engine already consume typed `RankingEntry[]` values without knowing where those values came from.

Phase 5 must make ranking sources manageable without weakening that boundary. Mutable ranking sets are authoring data. Immutable ranking snapshots are draft inputs. They have related content but different identities and lifecycles.

---

## Goals

- Make multiple ranking sets first-class domain data.
- Import a documented external ranking format through explicit parser and validation boundaries.
- Provide a lossless, versioned ranking-set export and re-import contract.
- Support tier management without making ranking order ambiguous.
- Preserve the exact ranking inputs used by every persisted draft and portable scenario.
- Keep the Draft State Engine and Recommendation Engine pure and source-agnostic.
- Keep domain models independent of Prisma, file formats, UI state, and framework concerns.
- Add only the extension points needed for a small number of supported ranking formats.

## Non-Goals

- A canonical cross-provider player catalog.
- Automatic player matching across unrelated ranking sources.
- Generic column-mapping or user-authored parser rules.
- Scheduled imports, scraping, feeds, news, projections, or background refresh.
- Ranking-source blending or statistical aggregation.
- Ranking-set history, branching, collaboration, or audit logs.
- Changes to recommendation scoring or explanation behavior.
- Live-provider integration.

---

## Architecture Overview

```text
External File / Canonical Export
              |
      Transport Preflight
              |
       Format Adapter
              |
     Parsed Source Records
              |
       Normalization
              |
  Source-Neutral Candidate
              |
        Validation
              |
   Validated Domain Candidate
              |
      Domain Conversion
              |
     Mutable Ranking Set
              |
    Ranking Set Repository
              |
       Snapshot Boundary
              |
  Immutable Ranking Snapshot
        |             |
 Persisted Draft   Scenario V1
        |             |
        +------ Draft State Engine
                       |
              Recommendation Engine
```

The engines receive only canonical ranking entries. They do not parse input, resolve formats, query ranking-set storage, or follow references back to mutable ranking sets.

---

## Domain Model

### Ranking Set

A `RankingSet` is the mutable aggregate used to author rankings for future drafts.

It contains:

- A local ranking-set identity.
- A non-empty display name.
- Source provenance describing whether it was seeded, imported from a supported external format, imported from the canonical format, or created locally.
- An ordered collection of canonical ranking entries.
- Creation and last-update metadata for display and lifecycle control.

The ranking-set identity is local persistence identity, not a portable or provider identity. Importing an exported set creates a new local identity unless the user explicitly chooses a replace workflow. Ranking-set names should be unique case-insensitively within the single-user repository so selection is unambiguous.

The aggregate owns ordering and tier invariants. Consumers must not update entry fields independently and leave the set temporarily invalid. A proposed edit or import is validated as a complete candidate before replacing the stored aggregate.

### Ranking Entry

The existing `RankingEntry` remains the canonical engine-facing value. A ranking set owns entries with these domain facts:

| Field | Meaning | Domain rule |
| --- | --- | --- |
| Player identity | Opaque identity used by picks, availability, and recommendations | Non-empty and unique within the set or snapshot |
| Player name | Display name | Non-empty after normalization |
| Team | Current normalized team label | Non-empty supported label; not used as identity by the engines |
| Position | Fantasy position | One of the positions already supported by the domain |
| Overall rank | Canonical total order | Positive, unique, and contiguous from 1 through the set size |
| Position rank | Order within a position | Derived from canonical overall order and contiguous within each position |
| Tier | Position-local grouping used by recommendation logic | Positive integer and non-decreasing within a position when ordered by overall rank; gaps are preserved |
| ADP rank | Optional comparison input | Positive finite value or null; uniqueness is not required |

Tier numbers are position-local. A tier number for a quarterback is not compared with the same number for a running back. Gaps are meaningful because the current Recommendation Engine interprets a larger gap as a larger tier cliff.

Overall and position ranks are canonical ordinal values, not raw source row numbers. A format adapter may accept source ranks with gaps, but normalization must produce an unambiguous source order and domain conversion must assign canonical contiguous ranks. Ambiguous ties are validation errors rather than being broken by file order.

### Player Identity

Phase 5 does not introduce a global player catalog. The canonical `Player` value remains embedded in each ranking entry and is copied into snapshots.

Canonical imports preserve explicit player identities. An external adapter that does not supply identities may generate deterministic, opaque identities from its normalized player fields. Such identities are guaranteed only within the resulting ranking set and its snapshots. If normalized input would produce a collision, import fails and requires corrected source data.

This supports draft state, replay, and deterministic recommendations without pretending to solve cross-provider player matching. Cross-set comparison, merge, and automatic reconciliation remain future work.

### Source Provenance

Source provenance is descriptive, not authoritative. It may record:

- Source kind.
- Supported format identifier and format version.
- A user-facing source label such as the original file name.
- Import time.

Local file paths, raw source files, and provider-specific records are not part of the domain model. Editing a ranking set does not require preserving or replaying its original external document.

### Ranking Set Summary

List views should use a lightweight summary projection containing identity, name, source kind, entry count, and lifecycle metadata. Loading summaries must not require loading every ranking entry. This follows the existing draft-summary repository pattern without coupling the domain to a storage projection.

### Ranking Snapshot

A `RankingSnapshot` is an immutable value collection captured for one draft or embedded scenario. It contains a complete canonical copy of the ranking entries needed by the engines.

Snapshot identity and capture metadata may exist outside the entry collection, but the engines receive only the entries. Source ranking-set identity and name may be retained as optional provenance; neither may be required to load or use the snapshot.

A snapshot is not a revision of a ranking set and cannot be edited, refreshed, or relinked. Creating a new draft from changed rankings creates a new snapshot.

---

## Import and Export Formats

### Initial Supported Formats

Phase 5 should begin with two explicit format profiles:

1. **FantasyPros CSV profile:** the external import profile corresponding to the CSV source already used to generate the seed rankings. Its accepted headers, required values, encoding, and tier semantics must be documented and fixture-backed.
2. **Canonical Ranking Set JSON V1:** the application's lossless, versioned import/export contract. It carries ranking-set metadata and every domain-relevant ranking entry value.

The canonical JSON format is the Phase 5 export format. Re-exporting a source-specific CSV is not required because source formats may omit internal identity or other domain-relevant information.

Ranking-set JSON and Scenario V1 JSON remain distinct contracts. Neither should be accepted as the other merely because both contain ranking entries.

### Format Selection

The import request identifies a supported format. File extension or content inspection may help the UI suggest a format, but the architecture does not rely on permissive automatic detection. Unknown or mismatched formats fail before domain conversion.

### Versioning

Portable ranking-set exports carry an explicit schema version. Unsupported future versions fail clearly rather than being partially interpreted. Backward-compatible readers or explicit migration functions may be added when a second version exists; a generic migration framework is not needed in Phase 5.

---

## Import Pipeline Boundaries

Import is a staged conversion. Each stage has one responsibility and a typed output suitable for the next stage.

### 1. Transport Preflight

Transport preflight accepts file content and import metadata. It enforces bounded input size, supported text encoding, and a supported format selection.

It does not interpret ranking semantics. Failure at this stage is fatal and produces a document-level diagnostic.

### 2. Format Parser

Each format adapter owns syntax and source-shape concerns for one documented format profile.

The parser:

- Reads the selected source grammar.
- Identifies required source sections or columns.
- Produces source records with row or field locations for diagnostics.
- Preserves source values without turning them directly into domain objects.
- Reports malformed syntax and unsupported source shape.

The parser does not call repositories, create ranking-set identities, apply domain defaults, or construct snapshots.

### 3. Normalization

Normalization maps parsed source records into a source-neutral ranking candidate.

It may:

- Trim and normalize text.
- Map documented position and team aliases.
- Interpret documented null markers.
- Convert supported numeric representations.
- Establish an unambiguous source order.
- Produce deterministic source-local player identities when the format lacks explicit identities.
- Carry source locations forward for error reporting.

Normalization may apply only policies documented for that format. It must not silently infer missing tiers, resolve ambiguous players, or invent ranks when source ordering is ambiguous.

### 4. Validation

Validation is pure and operates on the complete source-neutral candidate. It separates reusable domain invariants from format-specific diagnostics.

Validation covers:

- Required ranking-set metadata.
- Non-empty bounded entry collections.
- Supported player positions and valid player fields.
- Unique player identities.
- Unique and unambiguous overall ordering.
- Valid ADP values.
- Valid, position-local tier progression.
- Cross-record consistency.

Ranking-set validity is separate from draft compatibility. A set may be valid but too small for a particular league configuration. Draft creation performs the compatibility check using the selected league settings and ranking count.

Validation should accumulate actionable independent errors when safe. Fatal syntax failures may stop the pipeline, but a semantically invalid document should report multiple row-level issues in one result when possible.

### 5. Domain Conversion

Domain conversion accepts only a validated candidate. It:

- Assigns the local ranking-set identity for a create workflow or preserves it for an explicit replacement workflow.
- Assigns canonical contiguous overall and position ranks.
- Removes parser locations and source-only fields.
- Produces canonical ranking entries and ranking-set provenance.
- Returns a complete valid ranking-set aggregate.

No parser-specific record may cross this boundary.

### 6. Atomic Commit

The repository receives a complete valid domain aggregate. Creation or replacement is atomic from the caller's perspective. If persistence fails, the previous valid ranking set remains unchanged.

Parsed and normalized candidates may be held transiently for a preview, but they are not authoritative and are not persisted as partial ranking sets.

### Diagnostics

Pipeline diagnostics have:

- A stable category or code.
- A stage.
- A human-readable message.
- A document, row, or field location when available.
- Error or warning severity.

The UI renders diagnostics but does not determine their meaning. Warnings may describe ignored optional source data; errors prevent domain conversion and persistence.

---

## Export Architecture

Export begins from a valid domain `RankingSet`, not from raw persistence records or the original imported file.

The export mapper produces Canonical Ranking Set JSON V1 with:

- Schema version.
- Portable display metadata and source description.
- Canonical entry order.
- Explicit player identities.
- All ranking values used by the engines.

Local repository identity may be included as non-authoritative provenance but is not reused automatically when imported elsewhere. Importing an export creates a new set by default; replacing an existing set is a separate explicit lifecycle operation.

Canonical serialization should be deterministic for the same domain value. Recommendation output, draft picks, league settings, and UI state are not part of a ranking-set export.

---

## Repository Boundaries

### Ranking Set Repository

A dedicated ranking-set repository owns persistence of mutable ranking sets. Its domain-facing responsibilities are:

- Create a complete validated set.
- Load one complete set by identity.
- List lightweight summaries.
- Replace a set with a complete validated new aggregate.
- Delete a set.
- Report not-found and name-conflict outcomes without leaking database errors or records.

The repository accepts and returns domain values. It does not accept parser records, perform file parsing, generate recommendation output, or expose Prisma types.

Set-wide writes are transactional. Phase 5 does not need a generic unit-of-work abstraction, event bus, or repository per entry.

### Draft Repository and Snapshot Persistence

The existing draft repository remains responsible for atomically persisting a new draft with its ranking snapshot. Draft creation orchestration loads the selected ranking set, creates a pure value snapshot, and passes the complete snapshot into the existing draft-workspace creation boundary.

Snapshot persistence is intentionally not exposed as a mutable ranking-set repository. There is no update operation for a snapshot. Snapshot deletion follows the owning draft's existing lifecycle and must not affect the source ranking set.

### Repository Mapping

Persistence mapping and snapshot serialization stay inside repository-facing modules. Domain callers must not know whether mutable entries are rows, documents, or another storage representation.

Repository tests may continue using injected fakes for focused behavior, but the mutable set transaction and snapshot isolation require real persistence integration coverage before Phase 5 is considered complete.

---

## Ranking Set Lifecycle

```text
External / Canonical Input
          |
   transient candidate
          |
      validation
          |
     create set
          |
  persisted mutable set <---- validated replacement
          |
      snapshot copy
          |
 immutable draft/scenario input

persisted mutable set ---- delete
immutable snapshots ------ remain valid
```

Lifecycle rules:

- Import creates a new set by default.
- Rename, reorder, player-field correction, and tier changes are complete validated replacements of the same local set identity.
- An invalid replacement leaves the stored set untouched.
- Creating a draft copies the selected set into a new immutable snapshot.
- Changing or deleting a source set never changes an existing snapshot.
- Deleting a set does not cascade to drafts or scenarios.
- Phase 5 keeps no automatic revision history for mutable sets. Export and immutable draft snapshots provide portability and reproducibility, not authoring undo history.
- There is no global domain-level active set. Draft creation explicitly chooses a ranking set; remembering a last-used selection is presentation preference, not ranking-domain state.

The existing code-owned seed rankings should enter the same validation and repository boundary as an initial seeded ranking set. After bootstrap, runtime ranking changes use managed data rather than code regeneration. Seed origin may remain visible as provenance, but the engines receive the same canonical entries as for any other set.

---

## Immutable Ranking Snapshot Behavior

Snapshot creation is a pure boundary that copies every domain-relevant ranking entry value from a valid source set or validated scenario context.

Required behavior:

- Each persisted draft receives its own snapshot value at creation.
- Snapshot entries are complete and do not require the source set to exist.
- Snapshot values never follow later source edits.
- Snapshot values are never rewritten to adopt new defaults or current player metadata.
- Recommendation output is recomputed from the snapshot and draft state; it is not stored in the snapshot.
- Snapshot readers return new domain values rather than mutable persistence objects.
- Snapshot ordering and identities remain stable for the lifetime of the draft.

The current Phase 2 ranking snapshot array remains a valid legacy representation. Phase 5 does not require rewriting old snapshots. If the canonical ranking entry shape changes in a future phase, version-aware snapshot parsing and explicit migration policy must be designed then; readers must not silently reinterpret historical data.

---

## Draft Integration

Draft setup gains one input: the identity of the ranking set selected for the new draft.

The application orchestration boundary:

1. Loads the selected ranking set through its repository.
2. Checks compatibility with the validated league configuration, including whether the set contains enough unique players for the draft.
3. Creates a complete immutable ranking snapshot from canonical entries.
4. Creates the draft workspace and snapshot atomically through the draft repository.
5. Returns the existing `DraftWorkspace` shape with `RankingEntry[]` to the UI and engines.

The Draft State Engine remains unchanged. It receives player identities only through draft actions and does not read ranking sets or repositories.

The Recommendation Engine remains unchanged. It receives draft state, league settings, user-team identity, and snapshot entries. It remains deterministic for identical inputs.

A persisted draft cannot switch ranking sets in place. Doing so would change historical recommendation inputs. A user who wants changed rankings starts a new draft and receives a new snapshot.

---

## Replay and Scenario Compatibility

Scenario V1 already embeds a complete ranking context and replays picks through the Draft State Engine. Phase 5 preserves that behavior.

- Scenario export continues to copy the workspace snapshot, not the current source ranking set.
- Scenario import validates its embedded entries and does not require a matching persisted ranking set.
- Scenario replay continues to feed the embedded entries directly to the Recommendation Engine.
- Importing a ranking-set file does not create or replay a scenario.
- Importing a scenario does not automatically create a mutable ranking set.
- Starting a persisted draft from scenario rankings, if exposed later, creates a new draft snapshot from the validated scenario values rather than linking to scenario or ranking-set storage.

The canonical `RankingEntry` shape is the compatibility seam. Phase 5 additions to ranking-set metadata must not require a Scenario V1 change. Any future entry-shape change must preserve Scenario V1 readers or introduce an explicit new scenario version.

---

## Persistence Strategy

Mutable ranking sets and immutable snapshots have different storage needs.

### Mutable Ranking Sets

Mutable ranking sets should be persisted as first-class set metadata plus individually addressable ranking entries behind the repository boundary. This is the normalization deferred by the Phase 2 snapshot decision and is justified now by set listing, replacement, tier management, validation constraints, and multiple-set isolation.

The architecture does not require a separately normalized global player catalog. Player values may be duplicated across ranking sets because Phase 5 does not reconcile players across sources.

Complete set replacement should be transactional. Repository reads reconstruct a canonical domain aggregate and revalidate storage data at the mapping boundary when necessary.

### Immutable Snapshots

Draft ranking snapshots remain whole serialized values because they are written once and loaded as a complete draft input. They are not queried, filtered, or edited independently.

This hybrid strategy deliberately uses normalized persistence for mutable authoring data and serialized persistence for immutable historical values.

### Data Not Persisted

Phase 5 does not persist:

- Raw uploaded files.
- Parser-specific records.
- Validation previews.
- Recommendation results.
- A live dependency from a snapshot to its source set.
- Revision history for ranking-set edits.

---

## Responsibility Boundaries

| Concern | Owner |
| --- | --- |
| File selection and reading | UI / application boundary |
| Format choice and import intent | UI / application boundary |
| Source grammar and source field locations | Format adapter |
| Source aliases and documented source conversions | Format normalizer |
| Ranking-set and entry invariants | Domain validation |
| Canonical rank and position-rank assignment | Domain conversion |
| Tier edit rules and whole-set validity | Domain layer |
| Import orchestration and atomic commit decision | Application layer |
| Rendering diagnostics and previews | UI |
| Ranking-set storage and mapping | Ranking set repository |
| Draft and snapshot atomic persistence | Draft repository |
| Pick progression and draft invariants | Draft State Engine |
| Recommendation scoring and reasons | Recommendation Engine |

The UI may collect a user's desired edits, but it cannot declare data valid, calculate canonical ranks independently, or mutate a snapshot. It displays domain results and diagnostics.

---

## Extension Points Without Overengineering

Each additional ranking format should add one explicit adapter with:

- A stable format identifier and version.
- A parser for its documented source profile.
- Format-specific normalization rules.
- Fixture-backed conformance tests.
- Mapping into the existing source-neutral candidate.

Adapters share domain validation and conversion. They do not receive repositories or engine dependencies.

A small explicit adapter selection table is sufficient. Phase 5 should not add runtime plugin discovery, dependency injection infrastructure, generic user-configurable column mapping, or a provider SDK. If several real adapters later reveal repeated behavior, shared parser utilities may be extracted from demonstrated duplication.

New optional ranking attributes may be added only when the canonical domain and snapshot compatibility policy define how engines, exports, old snapshots, and scenarios treat absence. External-source fields should not be added to the domain merely because one format provides them.

---

## Testing Implications

### Parser and Normalization Tests

- Fixture tests for each supported format profile.
- Valid, malformed, empty, oversized, and unsupported-version documents.
- Header and alias normalization defined by the format profile.
- Numeric, null, team, position, and tier normalization.
- Stable row and field locations in diagnostics.
- Deterministic generated player identities and collision rejection.

### Domain Validation Tests

- Unique player identities and overall ranks.
- Canonical contiguous overall and position ranks.
- Supported positions and valid optional ADP.
- Position-local tier progression with meaningful gaps preserved.
- Multiple independent errors returned when safe.
- League compatibility validated separately from ranking-set validity.
- Domain conversion does not mutate parsed or normalized input.

### Import and Export Tests

- Canonical export/import round trips preserve every domain-relevant value.
- Repeated serialization of the same set is deterministic.
- Unsupported canonical versions fail clearly.
- Failed create or replacement imports leave existing sets unchanged.
- Importing the same portable set creates a new local set unless replacement is explicit.

### Repository Tests

- Create, load, summary listing, complete replacement, name conflict, and deletion behavior.
- Multiple-set isolation.
- Transactional replacement and rollback on failure.
- Mapping returns domain values and does not leak persistence records.
- At least one real persistence round trip for mutable entries and draft snapshot isolation, in addition to focused fake-client tests.

### Snapshot and Draft Integration Tests

- Draft creation captures the selected set exactly.
- Editing or deleting the source set does not change an existing draft.
- Existing Phase 2 snapshots still load.
- Insufficient ranking counts fail before draft creation without partial persistence.
- Equal draft state and snapshot inputs produce equal recommendation outputs.
- No Recommendation Engine or Draft State Engine path reads a ranking-set repository.

### Replay Regression Tests

- Existing Scenario V1 files continue to validate and replay.
- Scenario export uses workspace snapshot values after the source set changes.
- A replay remains deterministic without the source ranking set present.
- Pick identities remain resolvable within the embedded ranking context.

### Manual QA

Manual QA should cover importing the supported external format, understanding validation errors, managing two independent sets, editing tiers, exporting and re-importing, selecting a set for a draft, changing the source set, and reloading the unchanged draft snapshot.

---

## Major Decisions and Tradeoffs

### Mutable Sets and Immutable Snapshots Are Separate Aggregates

**Decision:** A draft copies a ranking set into an immutable snapshot instead of retaining a live reference.

**Rationale:** Historical drafts, replay, and recommendations remain reproducible when authoring data changes.

**Tradeoff:** Ranking values are duplicated, and correcting a source set does not repair an existing draft. This is intentional historical isolation.

### Normalize Mutable Data, Serialize Immutable Data

**Decision:** Mutable ranking sets use first-class entry persistence; draft snapshots remain whole serialized values.

**Rationale:** Mutable sets need management and isolation, while snapshots are always written and read as complete values.

**Tradeoff:** Two persistence mappings represent similar data. Repository boundaries prevent that difference from leaking into the domain.

### Use Strict Format Adapters

**Decision:** Support explicit, documented format profiles rather than a generic CSV mapper or plugin system.

**Rationale:** Strict adapters produce deterministic transformations and actionable validation with much less architecture.

**Tradeoff:** Each genuinely different source needs a small adapter and fixtures. That cost is preferable to supporting ambiguous arbitrary mappings.

### Keep Player Identity Source-Local

**Decision:** Do not create a canonical player catalog or automatic cross-source resolver in Phase 5.

**Rationale:** Drafts and replays only require identity stability within their complete ranking snapshot.

**Tradeoff:** Sets cannot be merged or compared safely by player identity, and imported updates may require explicit replacement rather than intelligent reconciliation.

### Replace Whole Valid Aggregates

**Decision:** Edits and imports replace a complete validated ranking-set aggregate atomically.

**Rationale:** Rank order, position rank, tiers, and uniqueness are set-wide invariants. Whole-set validation prevents partially valid persistence.

**Tradeoff:** Large edits rewrite more data than row-level mutation. Ranking sets are small enough that correctness and simplicity dominate.

### Derive Canonical Ranks

**Decision:** Overall rank is canonical contiguous order, and position rank is derived from it.

**Rationale:** This removes inconsistent rank combinations and gives deterministic engine inputs across formats.

**Tradeoff:** Source rank gaps are not preserved as overall-rank magnitude. Source order is preserved; meaningful tier gaps remain explicit.

### Export One Canonical Portable Format

**Decision:** Export canonical versioned JSON rather than attempting to reproduce every source format.

**Rationale:** A single lossless contract preserves identities and all domain values and is straightforward to version.

**Tradeoff:** Exported data may not be directly consumable by the original external tool without separate future adapters.

---

## Architectural Risks

- **Identity collisions:** External formats without stable IDs may contain indistinguishable normalized players. Imports must reject collisions rather than silently merge them.
- **Tier semantic drift:** External tier values may be global while the engine treats tiers as position-local. Each adapter must document and normalize tier semantics explicitly.
- **Snapshot compatibility:** Future additions to `RankingEntry` could break historical drafts and Scenario V1 if absence semantics are not designed first.
- **Boundary duplication:** Scenario validation and ranking import validation could diverge. Both should reuse canonical ranking-entry validation while keeping their document-level rules separate.
- **Partial writes:** Set replacement and draft-plus-snapshot creation must remain transactional at repository boundaries.
- **Hidden coupling to seed data:** Recommendation or UI code may assume current seed coverage or identifiers. Integration tests must exercise a custom set with different valid identities and ordering.
- **Overgeneralized imports:** A generic format framework would increase complexity before more than one real external profile exists.

---

## Open Design Questions

No unresolved architectural question blocks task planning.

Before implementation tasks are written, the initial FantasyPros CSV profile must be frozen as a concrete data contract: accepted headers, tier interpretation, null markers, maximum input size, and representative fixtures. Those are format-contract details within this design, not reasons to change the architecture.

---

## Implementation Planning Guardrails

- Plan the import pipeline and ranking-set domain before ranking-management UI work.
- Preserve `RankingEntry[]` as the engine and Scenario V1 compatibility seam.
- Add a dedicated ranking-set repository; do not expand the Draft State Engine or Recommendation Engine into data access.
- Prove legacy snapshot and replay compatibility early.
- Keep the first external adapter limited to the exact supported CSV profile.
- Do not add a player catalog, generic parser registry, background ingestion, or ranking history unless project scope changes.
