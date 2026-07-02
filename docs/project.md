# Project

## Active Phase

No active implementation phase.

Phase 5 - Rankings & Data is complete. Ranking data can be imported, validated, managed, selected, and snapshotted without regenerating typed seed files or changing application code. No subsequent roadmap phase has been promoted into active scope.

Phase 1 established the manual Draft State Engine, Phase 2 added durable draft persistence and ranking snapshots, Phase 3 added deterministic recommendations anchored to those snapshots, and Phase 4 added replay and simulator tooling. Phase 5 should preserve those workflows while making ranking sets first-class product data.

---

## Product Goal

Build a single-user fantasy football draft assistant that recommends players based on draft context rather than static rankings alone.

The tool helps users make better draft decisions by combining rankings, roster context, positional scarcity, recommendation-eligible tier pressure when available, and current draft state during a live draft.

The app is a companion decision engine, not a fantasy platform or replacement draft room.

For Phase 5, ranking data should be able to evolve independently of application releases. A user or developer should be able to bring in a supported custom ranking source, correct and organize it, select it for a draft, and preserve the exact ranking state used for deterministic recommendations and replay.

---

## Target User

The Phase 5 user is a single user or developer who wants control over the ranking data that anchors recommendations.

They need to maintain multiple ranking sets, understand validation failures, inspect source tier data, manage only supported recommendation-tier data, choose the appropriate set for a draft, and reproduce past recommendation behavior from a stable snapshot. Phase 5 supports deliberate data management; it is not an automated fantasy-news, projection, or value-over-replacement service.

---

## Phase Goals

Phase 5 should deliver:

- Ranking sets that are managed as first-class data rather than compiled application code.
- Import of supported custom ranking sources through a deterministic parser and validation boundary.
- Export of ranking sets in a documented, portable format.
- Clear validation for malformed records, missing required data, duplicate players, invalid ranks, and invalid tier semantics.
- Multiple named ranking sets that can coexist and be selected without changing code.
- Tier management that preserves imported source tiers separately from recommendation-eligible tiers while preserving deterministic ordering.
- Stable ranking snapshots that preserve the exact recommendation inputs used by a draft or replay.
- Compatibility with the existing Draft State Engine, Recommendation Engine, persistence, and scenario workflows.
- Focused automated and manual validation of ranking transformations and their effect on user-facing draft workflows.

The phase is successful only if ranking data can change without an application code change while draft and recommendation behavior remains deterministic and reproducible.

---

## Scope

### In Scope

- Define a typed domain model for a ranking set and its ranking entries.
- Create, name, list, select, update, and remove multiple ranking sets within the single-user product.
- Import at least one documented ranking format suitable for custom ranking data.
- Parse imported data into the existing domain-facing ranking shape without exposing parser or storage details to the engines.
- Validate required player identity, supported positions, ranking order, duplicate records, numeric fields, and tier semantics before accepting imported or edited data.
- Report actionable validation failures without partially replacing a valid ranking set.
- Export a ranking set in a documented format that can be imported again without losing domain-relevant ranking information.
- Preserve and update supported tier data while maintaining an unambiguous overall ranking order and avoiding false recommendation-tier pressure.
- Choose a ranking set when creating or configuring a supported draft or scenario.
- Create an immutable ranking snapshot for a draft so later edits to the source ranking set do not alter that draft's recommendation inputs.
- Continue loading existing persisted draft snapshots through typed repository boundaries.
- Preserve the active `RankingEntry[]`-style input boundary consumed by the Draft State Engine and Recommendation Engine unless an approved design establishes a compatible domain replacement.
- Provide deterministic unit, integration, regression, and manual workflow coverage proportional to ranking parsing, validation, persistence, snapshotting, and draft integration risk.

### Out of Scope

- Automated projection generation.
- Automated news, injury, depth-chart, or ADP ingestion.
- Scheduled ranking refreshes, web scraping, or third-party ranking APIs.
- Real-time ranking feeds or provider synchronization.
- Supporting arbitrary file formats or every external ranking source.
- Automatic player identity resolution across external providers.
- Combining or algorithmically blending multiple ranking sources.
- Advanced statistical models, VORP, simulations, or machine learning.
- New recommendation factors, strategic insights, or Phase 6 explainability work.
- Live draft platform integrations.
- Authentication, accounts, cloud sharing, or multi-user ranking collaboration.
- A public ranking marketplace or community ranking library.
- Broad UI redesign unrelated to ranking management.

---

## MVP League Settings

- 12 Teams
- Redraft
- Snake Draft
- 1QB
- PPR assumed

### Starting Lineup

- QB
- RB
- RB
- WR
- WR
- TE
- FLEX
- FLEX
- DST
- K

### Bench

- 6 Bench Spots

Ranking sets and snapshots should remain compatible with the dynamic league settings already supported by the domain and persistence layers. Phase 5 does not expand the supported league formats.

---

## Core Workflow

### Add or Choose Rankings

- View the available named ranking sets.
- Select an existing set or import a supported custom source.
- Parse and validate the complete input before storing or activating it.
- Receive clear errors for records that cannot form a valid ranking set.

### Manage Ranking Data

- Review the ordered ranking entries, source tier data, and any recommendation-tier capability state.
- Make supported corrections or tier-semantic changes without editing application code.
- Export a portable copy when needed.
- Keep other ranking sets unchanged.

### Use Rankings in a Draft

- Select a valid ranking set for a new supported draft or scenario.
- Capture an immutable snapshot of that set as part of the draft's source configuration.
- Feed the typed snapshot into the existing Draft State Engine and Recommendation Engine.
- Continue receiving deterministic recommendations even if the source ranking set is later edited or removed.

### Reproduce Past Behavior

- Load or replay a draft using its captured ranking snapshot.
- Confirm the same ranking inputs and recommendation output are available for the same draft state.
- Distinguish the draft snapshot from the current mutable source ranking set.

---

## Milestones

### Milestone 1 - Ranking Domain and Validation Boundary

Establish the project-level contract for named ranking sets, ordered entries, optional supported metadata, source tiers, recommendation-tier eligibility, validation results, and stable identity.

The contract should keep imported records, persistence models, and UI state outside the Draft State Engine and Recommendation Engine while remaining compatible with their typed ranking input.

### Milestone 2 - Ranking Import and Export

Provide deterministic parsing and complete pre-commit validation for at least one documented custom ranking format, plus a portable export format that preserves domain-relevant information through a round trip.

Invalid input should produce actionable errors and leave existing valid ranking data unchanged.

### Milestone 3 - Multiple Ranking Set Management

Allow multiple named ranking sets to be stored, listed, selected, updated, and removed within the single-user application.

The existing built-in rankings should remain available through an explicit seed or migration path rather than continuing as the only code-owned runtime source.

### Milestone 4 - Tier Semantics Management

Preserve source tier information and allow only supported recommendation-tier information to evolve without making overall ranking order or recommendation eligibility ambiguous.

Tier-semantic updates should flow through the same domain validation and persistence boundaries as other ranking changes. FantasyPros `TIERS` are treated as source tiers for the current supported CSV profile, not as position-local recommendation-tier input.

### Milestone 5 - Snapshot and Draft Integration

Connect a selected mutable ranking set to draft creation by capturing an immutable ranking snapshot. Existing persisted drafts should continue to load their saved snapshots, and Recommendation Engine inputs should remain source-agnostic.

Scenario and replay workflows should consume captured ranking context without becoming coupled to ranking storage records.

### Milestone 6 - Workflow Confidence

Validate import/export round trips, invalid input handling, multiple-set isolation, tier-semantic updates, snapshot immutability, persisted-draft compatibility, and deterministic recommendation behavior.

Complete focused manual QA of the ranking-management-to-draft workflow without broadening into Phase 6 strategy or Phase 7 live integrations.

---

## Architecture Impact

Phase 5 introduces a first-class Rankings & Data capability alongside the existing draft persistence layer. Mutable ranking sets become managed source data; immutable ranking snapshots remain the inputs owned by individual drafts.

The intended flow becomes:

```text
Supported Ranking Import
          |
  Parser + Validation
          |
 Mutable Ranking Sets <----> Ranking Management / Export
          |
   Snapshot Boundary
          |
 Immutable Draft Ranking Snapshot
          |
  Draft State Engine
          |
 Recommendation Engine
```

The Draft State Engine and Recommendation Engine should continue consuming typed domain ranking data. They should not parse files, query ranking persistence directly, depend on ranking-management UI state, or know whether data originated from built-in seed rankings or a custom import.

The repository layer should hide the chosen storage representation for ranking sets and entries. Phase 2 draft snapshots stored as JSON remain valid immutable draft inputs; making source ranking sets first-class does not require past drafts to follow later edits or depend on a live ranking-set record.

Important boundaries:

- Parsing converts a supported external representation into typed candidate data; validation decides whether the complete candidate can become a ranking set.
- Invalid imports or edits should be atomic from the user's perspective and must not corrupt an existing valid set.
- A mutable ranking set and an immutable draft ranking snapshot are different lifecycle concepts.
- Snapshot creation should copy the domain-relevant ranking values needed for deterministic recommendations and replay.
- Player and ranking-set identity should be explicit enough to prevent silent duplicates or accidental cross-set updates.
- Overall rank remains the deterministic ordering anchor. Source tiers may be preserved for inspection and export, but recommendation tier pressure requires explicit recommendation-tier eligibility and must not be inferred from source tiers.
- Recommendation output remains derived and is not stored as part of ranking data.
- The solution should remain inside the monolith-first Next.js application and existing PostgreSQL/Prisma deployment model.
- Automated feeds, background refresh jobs, external provider adapters, and generalized source plugins remain deferred.

### Architecture Tradeoff Assessment

- **Complexity cost:** Phase 5 adds mutable ranking-set lifecycles, parser and validation boundaries, and an explicit snapshot transition. Keeping the number of supported import formats small avoids a premature provider framework.
- **Maintenance cost:** Documented formats and validation rules require compatibility care as the ranking model evolves. Separating domain data from transport and persistence shapes localizes that maintenance.
- **Scaling implications:** Ranking sets are small, single-user datasets used primarily as whole ordered collections. No distributed storage, caching, queues, or high-volume ingestion architecture is required.
- **Developer experience:** First-class ranking data removes the seed-regeneration loop and makes realistic recommendation testing faster, but clear validation diagnostics are necessary to keep imports debuggable.
- **Deployment implications:** Ranking management should use the existing application and database. Phase 5 should not add services, scheduled jobs, or new operational infrastructure.
- **Iteration speed:** Stable snapshots let ranking data and recommendation logic evolve independently while preserving reproducible drafts and scenarios.

---

## Success Criteria

Phase 5 is successful when a user or developer can:

1. Import a supported custom ranking source and create a valid named ranking set without changing or rebuilding application code.
2. Receive clear, record-level validation feedback for malformed, duplicated, unsupported, or inconsistent ranking data before any valid existing set is replaced.
3. Maintain at least two ranking sets independently and explicitly select which one will anchor a new supported draft.
4. Export a valid ranking set, import it again, and preserve its domain-relevant player order, supported metadata, source tier data, and recommendation-tier eligibility state.
5. Preserve or update supported tier data while retaining deterministic overall rank ordering and valid Recommendation Engine input.
6. Start a draft from a selected ranking set and capture an immutable snapshot containing the ranking information required by draft and recommendation behavior.
7. Edit or remove the source ranking set without changing the snapshot or recommendations of an existing draft.
8. Load an existing persisted draft and continue using its saved ranking snapshot without requiring the source ranking set to exist.
9. Replay the same draft or scenario from the same state and ranking snapshot and receive the same recommendation ordering and score-backed reasons.
10. Use built-in seed rankings through the new ranking-data workflow without losing the existing manual, persisted, replay, or recommendation workflows.
11. Confirm through automated tests that parsing, validation, import/export round trips, set isolation, tier-semantic changes, and snapshot creation produce exact deterministic outputs.
12. Complete focused manual QA of importing rankings, reviewing tier semantics, selecting a set, starting and saving a draft, changing the source set, and reloading the unchanged draft snapshot.

Rankings should feel like durable, inspectable product data rather than a fixture embedded in the codebase.

---

## Product Principles

- Treat ranking sets as first-class mutable source data and draft snapshots as immutable historical inputs.
- Validate complete candidate data before changing stored rankings.
- Keep ranking transport, persistence, and UI representations behind typed domain boundaries.
- Preserve deterministic overall ordering and recommendation behavior.
- Preserve source tiers separately from recommendation-tier pressure; do not derive position tiers from rank-only or ADP-only data.
- Support a small number of documented formats before generalizing source adapters.
- Keep the Recommendation Engine pure, derived, and unaware of ranking origin.
- Preserve existing manual, persisted, replay, and scenario workflows.
- Keep the feature inside the existing monolith and deployment model.
- Defer automated ingestion, advanced strategy, live providers, accounts, and ranking marketplaces to later phases.
