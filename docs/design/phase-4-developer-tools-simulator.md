# Phase 4 Design - Developer Tools & Simulator

## 1. Purpose and Phase Context

Phase 4 exists to shorten the feedback loop for developing the Fantasy Draft Decision Engine. The developer should be able to recreate a draft situation, inspect its recommendations, change engine behavior, and return to the same situation without manually rebuilding the draft.

The primary Phase 4 user is the developer tuning and validating the decision engine. The deliverable is a local development workbench around the existing Draft State Engine and Recommendation Engine. It is not a polished end-user draft room, a live-provider integration layer, or a general scenario-management product.

Phase 4 builds on the completed foundations:

- Phase 1 established the manual simulator and Draft State Engine.
- Phase 2 established persisted draft configuration, picks, and ranking snapshots.
- Phase 3 established deterministic recommendation scoring and score-backed reasons.

The domain and persistence layers already carry dynamic league settings, but the current draft-creation workflow still supplies fixed MVP defaults. Phase 4 must complete that configuration path first so replay, scenarios, and debugging are built against settings developers can actually create and persist without code changes.

The Phase 4 design must preserve the existing systems. League setup should produce the existing typed `LeagueSettings`; developer tools should then supply, rebuild, inspect, and explain state through existing domain boundaries rather than create alternate configuration, draft, or recommendation rules.

The desired outcome is fast reproducibility and stronger regression confidence: a valid scenario can be loaded or imported, replayed to a defined point within seconds, inspected, reset, and replayed again with deterministic results.

---

## 2. Architecture Overview

Phase 4 first completes configurable draft creation, then adds local scenario, replay, and debugging orchestration around the existing engines.

```text
Draft Setup Form
      |
League Setup Validator / Builder
      |
      +--> Typed LeagueSettings + User Team Identity
                    |
                    v
          Persistence Repository
                    |
                    v
            Typed Draft Hydration

Curated Scenario ---------+
                         |
Imported Scenario --------+--> Scenario Parser / Validator
                                      |
                                      v
                              Replay Coordinator
                                      |
                                      | ordered pick inputs
                                      v
Manual Simulator ----------------> Draft State Engine
                                      ^
                                      |
Persistence Repository --> Typed Draft Hydration
                                      |
                                      | valid typed draft state
                                      v
                            Recommendation Engine
                                      |
                                      | structured recommendation output
                                      v
                         Recommendation Debugger / UI

Typed manual or hydrated draft inputs --> Scenario Exporter --> Portable Scenario
```

Configured creation and scenario replay converge on the same domain settings and Draft State Engine. The setup form does not become a second settings model, and scenarios store the resulting typed league settings rather than form-specific roster counts.

Curated scenarios and imported scenarios are local Draft Sources in the Phase 4 sense: they provide reproducible inputs to the Draft State Engine. Phase 4 does not introduce the generalized provider interface, event normalization, remote ID mapping, or synchronization model reserved for Phase 7.

### State and Rule Ownership

The Draft State Engine remains the only owner of:

- Draft progression.
- Pick-number and active-team calculation.
- Pick validation.
- Roster assignment.
- Available-player tracking.
- Draft completion.
- Draft invariants.

The Replay Coordinator may sequence inputs and report where replay failed. It must not calculate draft order, assign a player directly to a roster, remove a player directly from the available pool, fabricate a final draft state, or relax domain validation.

The Recommendation Engine remains the only owner of:

- Base recommendation scoring.
- Modifiers and penalties.
- Context caps and totals.
- Deterministic recommendation ordering.
- Score-backed recommendation reasons.

The Recommendation Debugger is a read-only presentation of structured Recommendation Engine output. It must not recalculate scores, infer additional modifiers, reorder recommendations using separate rules, or generate parallel explanations.

### State Application Boundary

Scenario import and replay should be staged away from the currently active draft. Parsing, validation, base-state creation, and semantic replay must succeed before the reconstructed target state replaces the current in-memory state.

This staged approach gives Phase 4 an atomic application boundary:

1. The current draft remains usable while a scenario is checked.
2. A candidate state is created from scenario inputs.
3. The full scenario history is validated through the Draft State Engine.
4. The candidate state at the requested replay target is retained.
5. Only a successful candidate becomes the active simulator state.

No database transaction or new persistence system is required. The boundary protects local UI state and keeps validation failures from partially applying picks.

### Architecture Tradeoff Assessment

- **Complexity cost:** Phase 4 adds a versioned scenario contract, validation, replay coordination, and debugging presentation. It intentionally avoids a generic event framework or provider SDK.
- **Maintenance cost:** Reusing the existing engines minimizes duplicate business rules. The portable scenario contract becomes a maintained compatibility surface, so version handling must remain explicit.
- **Scaling implications:** The workbench is optimized for one local developer and draft-sized inputs. It does not need concurrency, streaming, queues, caching, or high-volume event processing.
- **Developer experience:** Self-contained scenarios and atomic replay make recommendation bugs easier to reproduce and compare across changes.
- **Deployment implications:** All tooling remains in the existing monolith-first Next.js application. It requires no new service, worker, queue, or deployment target.
- **Iteration speed:** Direct scenario selection, import, replay-to-target, reset, and score inspection remove repeated manual setup from recommendation development.

---

## 3. Configurable League Settings Foundation

Configurable league settings are the first Phase 4 milestone because every scenario, replay, persisted draft, and recommendation call depends on them. The MVP should expose the flexibility already present in the domain and repository without broadening into a general fantasy-league rules engine.

### Existing Foundation and Missing Boundary

The existing application already has:

- A typed `LeagueSettings` model with team count, rounds, draft type, scoring format, and roster slots.
- Draft-order and hydration behavior derived from persisted settings.
- JSON snapshot serialization and parsing for league settings.
- Repository creation and loading that preserve settings, user-team identity, ranking snapshots, and picks.
- Recommendation logic that consumes dynamic league and roster settings.

The missing boundary is creation. The current server action always uses `defaultLeagueSettings` and a fixed user team. Phase 4 should replace that code-only choice with a validated setup input while retaining the current defaults as the fast path.

### Supported MVP Configuration

The setup workflow should support:

- Team count from 2 through 20.
- User draft position from 1 through the selected team count.
- Non-negative roster counts for QB, RB, WR, TE, FLEX, DST, K, and BENCH.
- At least one non-BENCH starting slot.
- Between 1 and 30 total roster slots.
- `SNAKE` as the only supported draft type.
- `PPR` as the only supported scoring format.

The current 12-team, 16-round, Team 2 configuration remains the default form state. Supporting a setting means a developer can select it through the setup workflow, create the draft, reload it from persistence, and use it throughout the existing draft and recommendation flows.

Phase 4 does not add auction, linear, keeper, dynasty, half-PPR, standard-scoring, superflex-specific, or arbitrary custom-slot eligibility modes. Draft type and scoring format should be visible in setup as the active supported values, not presented as choices that the domain cannot honor.

### Roster Construction Mapping

The setup form uses counts because they are faster and safer for the developer than an arbitrary roster-slot editor. A pure setup builder converts those counts into the existing ordered `RosterSlot[]` representation:

- QB, RB, WR, TE, DST, and K slots use their matching eligible position.
- FLEX slots use RB, WR, and TE eligibility.
- BENCH slots use all currently supported positions.
- Slot IDs are generated deterministically by category and one-based index.
- Slot order is fixed by category so identical setup input creates identical settings.
- `rounds` is derived from the total generated roster-slot count and is not independently editable.

The generated `LeagueSettings` is the only domain configuration consumed after creation. Form counts are transport and presentation data; they are not persisted as a second source of truth.

### Validation and Capacity

One pure validation/building boundary should be reusable by the client for immediate feedback and by the server action as the authoritative check.

Validation should ensure:

- Team count, draft position, and every roster count are finite integers within the supported bounds.
- Draft position belongs to the generated team set.
- At least one starting slot and at least one total roster slot exist.
- Total roster slots do not exceed 30.
- Total draft capacity does not exceed the active ranking snapshot's player count.
- Draft type and scoring format exactly match supported domain values.
- Generated slot IDs are unique and generated settings satisfy existing league-settings parsing and Draft State Engine assumptions.

Validation failure should return field-level or form-level errors and must not create a database record. Client-side feedback may improve speed, but only server-side validation authorizes creation.

### Creation and Persistence Flow

1. The developer opens `Start New Draft` and receives the current MVP defaults.
2. The form submits a small league-setup input, not a complete `Draft` or persistence record.
3. The shared builder validates the input, creates typed `LeagueSettings`, derives rounds, creates the ordered teams, and derives `userTeamId` from draft position.
4. The server checks total capacity against the seed ranking snapshot.
5. The existing repository creates the draft using typed settings, rankings, and user-team identity.
6. The repository's existing JSON snapshot mapping persists and hydrates those values.
7. The app routes to the created draft and all downstream engines consume the hydrated typed workspace.

The automatic first-run/default draft path should use the same builder with default input so it does not bypass the supported configuration rules.

No Prisma schema change is required. League settings are already stored as JSON and user-team identity is already stored with the draft. A league configuration is immutable after draft creation; changing settings creates a new draft rather than migrating picks or mutating an in-progress draft.

### Ownership and Future-Phase Boundaries

- The setup builder owns conversion from form counts to valid `LeagueSettings`; it does not own draft progression.
- The Draft State Engine continues to own teams, order, picks, rosters, availability, and invariants after initialization.
- Persistence stores and hydrates typed settings but does not interpret UI form counts.
- The Recommendation Engine consumes settings exactly as it does now and gains no configuration UI logic.
- Scenario contracts embed the resulting `LeagueSettings`, team order, and user-team identity, not the setup form DTO.
- Phase 5 ranking management is not introduced; configured creation continues to use the current seed ranking snapshot.
- Phase 7 provider interfaces are unaffected; live providers will later normalize into the same domain settings and draft state.

### Configuration Tradeoff Assessment

- **Complexity cost:** A count-based input, pure validator/builder, and compact form add one narrow creation boundary without introducing a general rules engine.
- **Maintenance cost:** Supported slot categories and limits are explicit constants that must stay aligned with domain positions, but the persisted `LeagueSettings` shape remains unchanged.
- **Scaling implications:** Validation is synchronous and draft-sized. It adds no concurrency, storage-scale, or event-processing concerns.
- **Developer experience:** Defaults keep creation fast while non-default settings no longer require source edits.
- **Deployment implications:** Existing JSON persistence avoids a migration or new infrastructure.
- **Iteration speed:** Completing setup first gives every later Phase 4 scenario and replay task a real configurable input path to exercise.

---

## 4. Scenario Contract

A scenario is a portable, versioned recipe for rebuilding draft state. It contains source inputs and an ordered pick history; it does not contain an authoritative final draft state.

Phase 4 should use a self-contained JSON document. The following shape is conceptual rather than a final TypeScript declaration:

```text
Phase4Scenario
  schemaVersion
  metadata
    id
    name
    description
    tags
    provenance (optional and informational)
      source kind
      source id (optional)
      exported at
  leagueSettings
  draftConfiguration
    draftType
    team identities and draft order
    other existing domain configuration
  rankingContext
    embedded ranking snapshot
  userTeamContext
    user team identity
  pickHistory[]
    player identity
    expected pick number (optional validation assertion)
    expected team identity (optional validation assertion)
  replayTarget
    appliedPickCount
```

The implementation should reuse existing domain input types when their meaning matches instead of creating competing Phase 4 models. The portable contract should still be isolated from persistence records and UI state so it can be validated and evolved independently.

### Contract Responsibilities

#### Metadata and Versioning

- `schemaVersion` identifies the scenario contract version and is required.
- Phase 4 starts with one explicitly supported version.
- Unsupported versions are rejected with a clear error; Phase 4 does not require migrations for future versions.
- Metadata requires a scenario ID and name; description and tags are optional.
- The exporter supplies safe default metadata and may accept a lightweight name override. Phase 4 does not require a metadata editor.
- Optional provenance records whether the export came from a manual, persisted, or scenario session, its source ID when one exists, and the export timestamp.
- Provenance is informational and must not be used to look up source records, hydrate a draft, or affect replay.
- Descriptive metadata, provenance, and timestamps must not affect draft state or recommendation output.

#### League Settings and Draft Configuration

- The scenario carries the same domain-facing league settings needed to create a draft.
- It includes the supported roster configuration, team count, draft shape, and other settings used by the Draft State Engine.
- Draft configuration identifies the teams and their order and provides any existing input needed to create the draft.
- Round count and total pick capacity should be derived through existing domain rules where they are currently derived, not duplicated in the scenario format as competing truth.
- The contract must support valid non-default configurations already accepted by the project. It must not assume 12 teams, 16 rounds, or a specific user draft position.
- The contract carries the generated `LeagueSettings` and team order, not the league-setup form's roster-count DTO.

#### Ranking Context

- A Phase 4 scenario embeds the typed ranking snapshot required to reproduce Recommendation Engine inputs.
- The snapshot is scenario context, not a Phase 5 ranking import or ranking-management feature.
- Scenario loading validates the embedded snapshot but does not provide editing, tier management, arbitrary ranking-source parsing, or permanent ranking-library behavior.
- Embedding the snapshot makes exported scenarios self-contained and prevents later seed-ranking changes from silently changing their recommendation output.

#### User-Team Context

- The scenario identifies the user's team using a team identity present in the draft configuration.
- Roster need and other user-relative recommendation behavior are derived after replay from that identity and the reconstructed state.
- The scenario does not carry a separately serialized user roster.

#### Ordered Pick History

- Pick history is an ordered list of player selections.
- Player identity is the source input; pick number and active team remain Draft State Engine results.
- Optional expected pick-number or team fields may act as assertions that detect a scenario authored against a different draft order. They are not commands that override engine behavior.
- The history may extend beyond the replay target so one file can describe a longer known draft while opening at an intermediate investigation point.

#### Replay Target

- `appliedPickCount` is an integer from zero through the number of picks in the history.
- The target is defined as a count of applied picks to avoid inclusive/exclusive pick-number ambiguity.
- Zero represents a configured draft before any picks.
- A completed target applies the total pick capacity defined by the validated league and draft configuration.

### Data Explicitly Excluded

A portable scenario should not include authoritative copies of:

- Team rosters.
- The available-player pool.
- Current pick or active team.
- Draft completion flags.
- Recommendation scores, ordering, components, or reasons.
- Raw database rows, persistence JSON, or database identifiers that have no domain meaning.
- React component state, selected UI panels, filters, or transient errors.

These values are reconstructed or derived by the existing engines. Excluding them prevents conflicting sources of truth and makes replay a meaningful regression check.

---

## 5. Scenario Validation

Validation occurs before an imported or curated scenario can replace the current simulator state. It has three layers.

### Structural and Version Validation

The parser should reject:

- Invalid JSON or an otherwise malformed document.
- Missing required sections or fields.
- Incorrect primitive or collection types.
- An absent, malformed, or unsupported scenario version.
- A replay target that is not an integer or falls outside the pick-history range.
- A raw scenario file larger than 1 MiB.
- More than 1,000 ranking entries.
- A configured draft capacity or pick history greater than 1,000 picks.
- More than 50 metadata tags.

Errors should identify the affected field or section without exposing implementation internals.

The limits are Phase 4 browser-safety limits, not league defaults. Team count, rounds, and roster shape remain dynamic inside those bounds. The 1 MiB file limit is checked before JSON parsing; the array and draft-capacity limits are checked after structural parsing. Phase 5 may revisit ranking-scale limits when ranking management becomes active, but Phase 4 should not add configurable limits or large-file processing.

### Cross-Reference and Configuration Validation

The validator should confirm:

- League settings and the draft type are supported by the existing domain.
- Team count, team identities, draft order, roster configuration, and draft capacity are internally consistent.
- Team identities and player identities are unique where uniqueness is required.
- The user-team identity exists in the configured draft.
- Ranking context is present and contains the typed data required by the Recommendation Engine.
- Each pick references a player in the scenario's ranking/player context.
- No player appears more than once in pick history.
- Pick history does not exceed the configured draft capacity.
- Optional expected pick-number and team assertions match the configured draft order.
- A completed replay target agrees with the configured total pick capacity.

These checks should reuse existing domain validators where available. Phase 4 should not create a second implementation of league or draft rules merely to produce earlier errors.

### Semantic Replay Validation

The Draft State Engine remains the final authority for whether the ordered picks form a valid draft. Validation therefore creates a fresh candidate draft and applies the full pick history in order through the existing pick transition.

This catches cases such as:

- A pick that becomes invalid because of earlier history.
- Duplicate drafting that escaped structural validation.
- An invalid pick order or team assertion.
- Player availability or draft-completion violations.
- Configuration combinations rejected by the domain.

The candidate state at `appliedPickCount` is captured during the replay, but the entire supplied history must validate before the scenario is accepted. A scenario should not be partly valid depending on where it is opened.

### Failure Safety

On any parsing, validation, or replay failure:

- The current active draft state remains unchanged.
- No partial candidate state is installed.
- No persisted draft is created, updated, or deleted.
- The error reports the scenario section or pick index and a useful domain reason.
- The developer may correct or select another scenario and try again.

---

## 6. Replay System

The Replay Coordinator is a small orchestration layer. Its responsibility is to create a valid starting draft, apply ordered inputs, retain the requested target state, and return either a complete result or an error.

### Deterministic Replay Path

1. Parse the portable scenario.
2. Validate its version, shape, configuration, references, and replay target.
3. Create a fresh base draft using the same domain setup path used by the manual simulator.
4. Provide the scenario's ranking snapshot and user-team identity as recommendation context.
5. Apply each pick in order through the canonical Draft State Engine pick transition.
6. Capture the domain state after `appliedPickCount` picks.
7. Continue validating any remaining supplied history through the same transition.
8. If the entire history is valid, install the captured target state as the active simulator state.
9. Recompute recommendations from that state, the embedded ranking snapshot, league settings, and user-team identity.

Replay must not depend on wall-clock time, animation timing, random selection, or persisted recommendation output.

### Manual and Replay Equivalence

Given identical league settings, draft configuration, ranking context, user-team context, and ordered picks:

- Manual entry and replay must produce equivalent draft picks.
- Current pick, active team, rosters, available players, and completion state must match.
- Draft invariants must hold in both paths.
- Recommendation ordering, totals, components, and reasons must match.

The comparison concerns domain-relevant state. Transient UI state, metadata timestamps, and source labels do not need to match.

### Intermediate and Completed States

An intermediate target installs the state after the configured number of picks while retaining the scenario definition as the reset baseline. The developer can then make exploratory manual picks through the normal manual transition path.

A completed target is valid only when the applied-pick count reaches the configured draft capacity. The resulting state uses existing Draft State Engine completion behavior; replay does not set completion directly.

Phase 4 uses immediate replay to the scenario's declared target. The MVP does not include step-forward, step-back, pause, timing, or animation controls. After replay, the developer can explore forward with normal local manual picks or change the scenario target in the source file and reload it. Step controls may be reconsidered only after a concrete debugging need appears, and any future control must reuse the same coordinator rather than introduce a second execution model.

---

## 7. Import, Export, and Scenario Library

### Import

Scenario import accepts a local UTF-8 JSON file through the developer workbench. Import passes through the same parser, validator, and Replay Coordinator used by curated scenarios. Imported files receive no privileged path around validation.

Import is local and explicit. It does not create a database record, upload a file to a service, or add the scenario permanently to the curated library.

The browser rejects files over 1 MiB before parsing. Parsed scenarios remain subject to the ranking-entry, draft-capacity, pick-history, and metadata limits defined by scenario validation.

### Export

Export creates a portable scenario from canonical domain-facing inputs:

- The active league settings and draft configuration.
- The active ranking snapshot.
- The user-team identity.
- The ordered pick history.
- A chosen replay target, defaulting to the active applied-pick count.
- Generated metadata with an optional lightweight name override.
- Optional informational provenance for the source session.

Export must reconstruct source inputs from typed application/domain data. It must not serialize raw React state, Prisma records, hydrated database shapes, derived rosters, available-player collections, or recommendation output.

The existing `DraftWorkspace` boundary already contains the league settings, ranking snapshot, user-team identity, teams, and generated pick list needed for export. A narrow pure mapper should accept those typed workspace values, filter assigned picks into ordered history, and add scenario metadata. It should not query the repository or inspect React state.

A manually created or hydrated persisted draft may be exported when its typed workspace satisfies the scenario contract. A transient scenario session can use the same mapper because it carries the same typed draft, ranking, and settings inputs. Exporting never alters or saves the source draft.

### Round-Trip Expectations

An exported scenario that is imported without modification should reproduce:

- Equivalent league and draft configuration.
- The same ordered pick history.
- Equivalent domain state at the replay target.
- The same recommendation inputs and deterministic recommendation output.
- The same draft invariants.

The serialized file does not need byte-for-byte equality after a second export. Metadata formatting and canonical serialization may differ, but domain-relevant meaning must remain equivalent.

### Curated Scenario Library

The curated library is a small set of version-controlled scenario files that exercise meaningful development cases. Curated files use the same portable contract and validation path as imported files.

The library should favor representative cases such as:

- An early-draft baseline.
- A roster-need decision point.
- Tier-drop or scarcity pressure.
- Observed positional run pressure.
- A late or completed draft.
- At least one valid non-default league configuration.

The library is not intended to provide exhaustive combinatorial coverage, user-created collections, search and categorization infrastructure, cloud storage, or ranking-set management. New curated scenarios should earn their place by reproducing an important engine behavior or regression.

---

## 8. Recommendation Debugger

The Recommendation Debugger makes existing structured Recommendation Engine output inspectable. It is a developer-facing view associated with the currently reconstructed or manually progressed draft state.

For each recommendation, the debugger should be able to present engine-owned information including:

- Player identity and ranking context used by the engine.
- Base player value.
- Each applied scoring component or modifier.
- Negative components and penalties.
- Any engine-applied cap or adjustment needed to explain the total.
- Context subtotal and final total where those values exist in engine output.
- Score-backed reasons.
- Deterministic tie-break information if it is required to explain ordering.

The debugger may format labels, group fields, expand details, and select a player for inspection. It must preserve the Recommendation Engine's ordering and numeric values.

The existing Phase 3 result already exposes ranking data, total score, base score, applied context score, raw score components, and score-backed reasons. However, urgency and total-context caps can make the sum of raw component deltas differ from the final total. Phase 4 should add an engine-owned `scoreAdjustments` collection, or an equivalently small structured field, that records applied urgency-cap and context-cap adjustments. Component deltas plus adjustment deltas must reconcile exactly to the final total.

No additional tie-break model is required for the MVP. The engine's returned array order is authoritative, and the existing result already contains total score, base score, overall rank, position rank, and player ID. The debugger may display those values and the returned position but must not re-sort them or reproduce the comparator.

If any other diagnostic detail proves necessary, it must be added to structured Recommendation Engine output. The UI must not fill gaps by duplicating formulas or inferring reasons from draft state.

Recommendations are recomputed after replay, reset, restart, import, persisted hydration, and manual picks. They are never imported as authoritative scenario content and are never required for scenario export.

The debugger remains read-only. Changing modifier values, live-tuning weights, creating strategy profiles, or editing explanations is outside Phase 4.

---

## 9. Reset, Restart, and Simulator Iteration

Reset and restart are intentionally distinct operations.

### Scenario Session Persistence Boundary

Imported and curated scenarios run as transient local sessions. Replay, exploratory picks, and undo use the existing pure Draft State Engine transitions in memory and do not call draft repository mutations. Existing manual and hydrated persisted drafts retain their current server-action and persistence behavior.

This separation prevents scenario experiments from overwriting saved drafts while preserving one owner for draft transitions. Export is the explicit way to keep a transient scenario or its exploratory progress. Phase 4 does not add scenario autosave or a new scenario table.

### Reset Scenario

Reset is available for an active scenario session. It:

- Discards exploratory manual picks made after the scenario was loaded.
- Re-runs validation and deterministic replay from the scenario inputs.
- Restores the state at the scenario's defined `appliedPickCount` target.
- Recomputes recommendations from the restored state.
- Clears transient debugger selection and scenario-session errors where appropriate.
- Does not modify persisted drafts or the scenario file.

Reset should use the same staged replay path as initial loading. It must not restore a cached fabricated final state.

If exploratory local picks or undo have moved the active scenario away from its replay target, reset requires a lightweight native confirmation. An unchanged scenario resets immediately.

### Restart Configured Draft

Restart creates a fresh draft at zero applied picks using the active league settings, draft configuration, ranking snapshot, and user-team context. It:

- Clears all picks and derived rosters.
- Restores the full available-player pool through normal draft initialization.
- Recomputes recommendations for the new draft.
- Establishes a normal manual draft session rather than a scenario-target baseline.
- Does not overwrite or delete persisted data unless the developer later invokes an existing explicit persistence action.

Restart requires confirmation only when it would discard unexported local scenario changes. Restarting a transient scenario creates a transient manual session and does not call the persisted-draft reset action.

Replacing a dirty transient session by selecting or importing another scenario uses the same lightweight confirmation. Phase 4 does not add a global browser `beforeunload` prompt, autosave, or draft-recovery system. Persisted manual drafts keep their existing confirmation and save behavior.

### Focused Simulator Improvements

Phase 4 simulator work should be limited to controls that materially reduce development time:

- Select a curated scenario.
- Import and export a scenario file.
- Replay immediately to the target state.
- Reset the active scenario.
- Restart with the active configuration.
- See the active scenario name, replay target, and applied-pick count.
- Open recommendation details without navigating away from the simulator workflow.
- Surface concise validation and replay errors.

Phase 4 should not expand into animations, consumer onboarding, mobile polish, decorative draft boards, social features, or a broad design-system effort.

Existing React state and Context remain the default UI state-management approach. Phase 4 does not justify a new client-state library by itself.

---

## 10. Testing and Regression Strategy

Phase 4 testing should emphasize exact deterministic behavior and domain equivalence rather than UI implementation details.

### Unit Coverage

Unit tests should cover:

- League-setup bounds, supported values, and field-level errors.
- Deterministic conversion from roster counts to unique ordered roster slots.
- Round derivation from total roster slots.
- Draft-position to user-team identity derivation.
- Total draft capacity against the active ranking snapshot.
- Scenario structural validation and required fields.
- Supported and unsupported schema versions.
- Dynamic league and draft configuration validation.
- Missing or invalid ranking context.
- Duplicate player identities and duplicate picks.
- Missing player references.
- Invalid user-team references.
- Invalid expected pick-number or team assertions.
- Replay-target bounds and completed-target rules.
- Portable serialization and parsing of valid scenarios.
- Reset and restart input derivation where it can be tested independently.

### Integration Coverage

Integration tests should prove:

- A valid non-default setup creates, persists, hydrates, and resumes with identical settings and user-team identity.
- An invalid setup creates no database record.
- Default automatic creation and explicit configured creation use the same settings builder.
- The Recommendation Engine consumes the hydrated non-default settings without a separate mapping path.
- A valid imported scenario creates a base draft and applies picks through the Draft State Engine.
- Equivalent manual and replay inputs produce equivalent domain state.
- Scenario import commits state only after full validation succeeds.
- A failure at any pick leaves the previously active draft unchanged.
- Export followed by import preserves domain-relevant state and recommendation inputs.
- Reset returns to the scenario target after exploratory manual picks.
- Restart returns to a valid zero-pick draft with the same configuration and ranking context.
- A typed persisted draft can continue through its existing hydration workflow and, when exportable, round-trip through the scenario contract without exposing persistence shapes.

### Scenario Coverage

Curated scenario tests should assert exact expected behavior for representative cases:

- The reconstructed pick count and active team.
- Expected roster contents and available players.
- All draft invariants.
- Recommendation ordering and totals where deterministic.
- Expected score components, penalties, and reasons.
- Equivalent results across repeated replay.
- At least one intermediate target, one completed target, and one non-default league configuration.

### Regression Coverage

Regression tests should protect:

- Existing default draft creation and persisted draft history.
- Non-default settings after refresh, pick, undo, and reset.
- Manual draft behavior after replay infrastructure is introduced.
- Persisted draft hydration and continuation.
- Recommendation determinism for unchanged inputs.
- Atomic failure behavior for malformed or semantically invalid scenarios.
- Reset and restart isolation from persisted data.
- Existing draft invariants after replay and after subsequent manual picks.

Every significant replay, import, reset, or debugger bug should receive a focused regression test when practical. Tests must not weaken existing assertions or replace exact business-behavior checks with existence checks.

### Manual QA

Focused manual QA should confirm that a developer can:

- Create and resume a non-default persisted league without editing code.
- See clear validation feedback for an invalid team count, draft position, or roster construction.
- Confirm configured rounds, team count, draft position, and roster-driven recommendations survive refresh.
- Load each curated scenario and reach its target state within seconds.
- Import an exported scenario and reproduce the same visible state and recommendations.
- Understand a recommendation total from debugger output.
- Recover cleanly from an invalid import.
- Reset and replay repeatedly without stale state.
- Continue using manual and persisted draft workflows.

---

## 11. Boundaries and Non-Goals

Phase 4 preserves the following boundaries:

- The Draft State Engine owns all draft rules and transitions.
- The Recommendation Engine owns all recommendation math, ordering, and score-backed reasons.
- Scenarios contain inputs used to rebuild state, not saved final state.
- Replay is deterministic and local.
- Persistence stays behind its repository and hydration boundaries.
- League setup produces the existing typed `LeagueSettings`; it does not create a parallel domain model.
- Persisted league settings are immutable after draft creation; a different configuration creates a new draft.
- Dynamic league settings remain domain inputs; default 12-team assumptions are not embedded in replay logic.
- Existing manual and persisted draft workflows remain supported.
- The workbench remains inside the monolith-first Next.js application.

Phase 4 explicitly defers:

- A generalized Draft Source or live-provider interface.
- Provider event normalization and remote player-ID mapping.
- Polling, WebSockets, reconnect behavior, and synchronization recovery.
- ESPN, Yahoo, Sleeper, or other platform integration.
- Runtime ranking management and multiple managed ranking sets.
- Arbitrary ranking-source parsing, tier editing, and ranking-library workflows.
- Arbitrary roster-slot eligibility editors or custom position systems.
- Auction, keeper, dynasty, non-snake, or non-PPR league support.
- Editing league settings after picks or migrating an existing draft to new settings.
- AI-generated recommendations or explanations.
- Opponent modeling, draft simulations, strategy profiles, and Insight Engine behavior.
- Persisted recommendation output.
- Multi-user collaboration and accounts.
- A polished end-user draft room or unrelated UI expansion.
- New services, workers, queues, caches, or deployment infrastructure.

The Phase 4 scenario contract should not be promoted into the future live-provider event contract by default. Phase 7 may reuse concepts proven useful by replay, but it should design provider normalization around actual live-provider constraints when that phase becomes active.

---

## 12. Open Questions and Design Decisions

### Design Decisions

#### Configurable League Setup Is the Phase 4 Prerequisite

The setup workflow is completed before scenario contract, replay, or debugger work. Later Phase 4 features consume the same created and persisted settings rather than invent fixtures as their primary configuration path.

Tradeoff: scenario work starts later, but every later feature can be validated against real non-default drafts and avoids retrofitting configuration assumptions.

#### Roster Counts Build the Existing Slot Model

The MVP form configures counts for QB, RB, WR, TE, FLEX, DST, K, and BENCH. A pure builder generates deterministic `RosterSlot[]` values, and rounds are derived from the resulting slot count.

Tradeoff: arbitrary eligibility editing is unavailable, but the common redraft configurations needed by this project remain fast to create and the domain keeps one roster representation.

#### Supported Draft and Scoring Values Stay Narrow

Configured Phase 4 drafts use `SNAKE` and `PPR`, the only values currently represented by the domain. The setup UI makes these active assumptions visible without offering unsupported options.

Tradeoff: the UI is less broad than a commercial league editor, but no false capability or untested recommendation behavior is introduced.

#### Settings Are Immutable After Draft Creation

Creating a different league configuration creates a new persisted draft. Phase 4 does not mutate settings beneath existing picks or migrate draft history.

Tradeoff: correcting a setup requires starting another draft, but draft invariants and persisted history remain simple and trustworthy.

#### Existing JSON Persistence Remains the Storage Boundary

Configured creation uses the existing repository input, league-settings snapshot, user-team field, and hydration mapping. No Prisma schema change or form-specific persistence shape is added.

Tradeoff: settings are not independently queryable as normalized columns, but Phase 4 needs whole-draft create/load behavior rather than settings analytics.

#### Scenario v1 Is Self-Contained JSON

Phase 4 scenarios use a versioned JSON document and embed the ranking snapshot needed for deterministic reconstruction.

This increases file size modestly but makes scenarios portable and stable when seed rankings change. The embedded snapshot is read-only scenario context and does not introduce Phase 5 ranking management.

#### Scenarios Rebuild State Through Pick History

Rosters, availability, active pick, completion, and recommendations are derived by the engines. They are not authoritative scenario fields.

This makes scenarios useful as regression inputs and prevents a second source of domain truth.

#### Replay Application Is Atomic

The full scenario is validated and replayed in candidate state before its target state replaces the current simulator state.

This adds a small orchestration cost but prevents corrupt or partially applied imports.

#### Replay Uses Existing Draft Transitions

Phase 4 does not create a generic event bus, provider SDK, or second reducer. Manual and replay inputs converge on the existing Draft State Engine transition path.

This intentionally avoids Phase 7 live-provider architecture.

#### Reset Restores the Scenario Target; Restart Returns to Pick Zero

The two operations serve different developer workflows and should not share an ambiguous label.

Reset reproduces the investigation baseline. Restart preserves configuration and ranking context but begins a fresh manual draft.

#### Debug Output Comes From the Recommendation Engine

When the UI needs additional detail, that detail is added to structured Recommendation Engine output rather than reconstructed in presentation code.

This preserves one owner for scoring and explanation behavior.

#### Curated Scenarios Use the Public Phase 4 Contract

Checked-in scenarios must pass through the same parser, validator, and replay path as imported files. The library receives no hard-coded setup path.

This makes curated scenarios representative of real portability and regression behavior.

#### Recommendation Diagnostics Add Only Cap Adjustments

The existing recommendation result remains the debugger contract, with one additive engine-owned adjustment collection for urgency and context caps. Raw components remain intact as evidence, and adjustments make the arithmetic reconcile to the final total. The returned order remains authoritative, so Phase 4 does not add a separate tie-break model.

Tradeoff: the output type grows slightly, but the debugger can explain capped totals without duplicating formulas. This preserves Recommendation Engine ownership and does not affect Draft State, persistence, rankings, or future provider inputs.

#### Export Uses Typed Workspace Provenance

Export uses a pure domain-facing mapper over the typed workspace values already available to manual, hydrated persisted, and transient scenario sessions. Required scenario metadata receives safe defaults and an optional name override. Optional source kind, source ID, and export time are informational only.

Tradeoff: provenance can become stale after a file is copied or edited, so replay never relies on it. The mapper stays outside Prisma and React, introduces no ranking-management behavior, and has no relationship to future live-provider IDs.

#### Replay-to-Target Is the Only Phase 4 Playback Control

Loading, importing, or resetting a scenario immediately replays it to `appliedPickCount`. Step controls, timing, and animation are deferred until a real debugging case justifies them.

Tradeoff: inspecting every historical transition may require changing the target and reloading. The simpler model preserves deterministic Draft State Engine transitions and avoids prematurely resembling Phase 7 event streaming.

#### Dirty Transient Sessions Receive Targeted Confirmation

Scenario sessions are transient and become dirty only after local exploratory picks or undo diverge from their baseline. Reset, restart, or scenario replacement asks for confirmation only when it would discard those changes. Export remains the explicit preservation mechanism.

Tradeoff: the workbench must track a small amount of session provenance and dirty state. It avoids autosave and new persistence while protecting useful experiments; existing persisted-draft behavior remains unchanged.

#### Scenario Imports Have Fixed MVP Safety Limits

Phase 4 accepts at most 1 MiB of JSON, 1,000 ranking entries, 1,000 configured or historical picks, and 50 metadata tags. Limits are fixed constants with clear validation errors.

Tradeoff: unusually large synthetic scenarios are rejected, but realistic fantasy drafts and embedded ranking snapshots retain ample headroom. The limits protect local browser parsing without introducing streaming, configuration UI, Phase 5 ranking-scale architecture, or Phase 7 event-volume assumptions.

#### Scenario Sessions Are Transient

Imported and curated scenarios do not create or mutate database records. Replay and exploratory actions use existing pure draft transitions locally; manual and persisted draft sessions retain their existing repository workflow.

Tradeoff: scenario changes disappear unless exported, but persistence stays simple and experiments cannot corrupt saved drafts. A future need for saved scenario collections should be planned separately rather than folded into Phase 4.

### Boundary Verification

| Finalized decision | Draft State Engine | Recommendation Engine | Persistence | Phase 5 rankings | Phase 7 integrations |
| --- | --- | --- | --- | --- | --- |
| Configurable league setup | Receives validated existing settings and retains all draft-rule ownership. | Consumes hydrated settings through its existing input. | Uses the existing JSON snapshot and user-team field. | Continues using the seed ranking snapshot without ranking management. | Adds no provider model or normalization. |
| Count-based roster builder | Generates existing roster slots before draft initialization. | Reads the same eligible-position slots it already supports. | Persists only generated `LeagueSettings`. | Has no ranking-source behavior. | Does not define live-provider configuration contracts. |
| Cap adjustment diagnostics | No draft behavior changes. | Engine calculates and exposes adjustments. | Output remains derived and unpersisted. | Ranking snapshot remains an input. | Output remains source-agnostic. |
| Typed export mapper and provenance | Exports input history, not derived final state. | Recommendations are excluded. | Reads typed workspace data without repository access or writes. | Embedded snapshots are read-only scenario context. | Provenance is not a provider ID contract. |
| Immediate replay-to-target | Every pick uses the canonical transition. | Recommendations are recomputed after replay. | Candidate replay is local and atomic. | No ranking editing or source parsing is added. | No event timing or provider abstraction is introduced. |
| Dirty-only confirmation | Local transitions remain unchanged. | Recomputed output remains derived. | No autosave or scenario persistence is added. | No ranking behavior changes. | No synchronization or recovery model is implied. |
| Fixed import limits | Dynamic valid settings work inside safety bounds. | Ranking inputs remain validated before scoring. | No storage or migration impact. | Limits are Phase 4 safety constraints, not ranking-product rules. | Limits do not define provider event volume. |
| Transient scenario sessions | Local and persisted paths share pure transitions. | Both paths call the same pure engine. | Existing persisted workflows remain isolated. | Embedded snapshots are not managed ranking sets. | Local scenario state is not a live Draft Source interface. |

### Remaining Open Questions

None. Implementation may make local naming and file-placement choices within these decisions without reopening the architecture.
