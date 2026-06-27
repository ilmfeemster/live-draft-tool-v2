# Phase 4 Design - Developer Tools & Simulator

## 1. Purpose and Phase Context

Phase 4 exists to shorten the feedback loop for developing the Fantasy Draft Decision Engine. The developer should be able to recreate a draft situation, inspect its recommendations, change engine behavior, and return to the same situation without manually rebuilding the draft.

The primary Phase 4 user is the developer tuning and validating the decision engine. The deliverable is a local development workbench around the existing Draft State Engine and Recommendation Engine. It is not a polished end-user draft room, a live-provider integration layer, or a general scenario-management product.

Phase 4 builds on the completed foundations:

- Phase 1 established the manual simulator and Draft State Engine.
- Phase 2 established persisted draft configuration, picks, and ranking snapshots.
- Phase 3 established deterministic recommendation scoring and score-backed reasons.

The Phase 4 design must preserve those systems. Developer tools should supply, rebuild, inspect, and explain state through existing domain boundaries rather than create alternate draft or recommendation rules.

The desired outcome is fast reproducibility and stronger regression confidence: a valid scenario can be loaded or imported, replayed to a defined point within seconds, inspected, reset, and replayed again with deterministic results.

---

## 2. Architecture Overview

Phase 4 adds local scenario, replay, and debugging orchestration around the existing engines.

```text
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

## 3. Scenario Contract

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
    createdAt (optional and non-deterministic)
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
- Metadata provides stable developer-facing identification and discovery.
- Descriptive metadata and timestamps must not affect draft state or recommendation output.

#### League Settings and Draft Configuration

- The scenario carries the same domain-facing league settings needed to create a draft.
- It includes the supported roster configuration, team count, draft shape, and other settings used by the Draft State Engine.
- Draft configuration identifies the teams and their order and provides any existing input needed to create the draft.
- Round count and total pick capacity should be derived through existing domain rules where they are currently derived, not duplicated in the scenario format as competing truth.
- The contract must support valid non-default configurations already accepted by the project. It must not assume 12 teams, 16 rounds, or a specific user draft position.

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

## 4. Scenario Validation

Validation occurs before an imported or curated scenario can replace the current simulator state. It has three layers.

### Structural and Version Validation

The parser should reject:

- Invalid JSON or an otherwise malformed document.
- Missing required sections or fields.
- Incorrect primitive or collection types.
- An absent, malformed, or unsupported scenario version.
- A replay target that is not an integer or falls outside the pick-history range.

Errors should identify the affected field or section without exposing implementation internals.

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

## 5. Replay System

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

Phase 4 does not require real-time playback. Immediate replay to a target is the primary workflow. Step-by-step replay may be added only if it materially improves debugging and can reuse the same coordinator without introducing a second execution model.

---

## 6. Import, Export, and Scenario Library

### Import

Scenario import accepts a local UTF-8 JSON file through the developer workbench. Import passes through the same parser, validator, and Replay Coordinator used by curated scenarios. Imported files receive no privileged path around validation.

Import is local and explicit. It does not create a database record, upload a file to a service, or add the scenario permanently to the curated library.

### Export

Export creates a portable scenario from canonical domain-facing inputs:

- The active league settings and draft configuration.
- The active ranking snapshot.
- The user-team identity.
- The ordered pick history.
- A chosen replay target, defaulting to the active applied-pick count.
- Developer-provided or generated metadata.

Export must reconstruct source inputs from typed application/domain data. It must not serialize raw React state, Prisma records, hydrated database shapes, derived rosters, available-player collections, or recommendation output.

A manually created or hydrated persisted draft may be exported only after its typed configuration, ranking context, user-team context, and ordered picks can satisfy the same scenario contract. Exporting a persisted draft does not alter that draft.

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

## 7. Recommendation Debugger

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

If an existing recommendation result does not expose enough structured information to explain a displayed total, the engine-facing output contract should be extended at the Recommendation Engine boundary. The UI must not fill the gap by duplicating formulas or inferring reasons from draft state.

Recommendations are recomputed after replay, reset, restart, import, persisted hydration, and manual picks. They are never imported as authoritative scenario content and are never required for scenario export.

The debugger remains read-only. Changing modifier values, live-tuning weights, creating strategy profiles, or editing explanations is outside Phase 4.

---

## 8. Reset, Restart, and Simulator Iteration

Reset and restart are intentionally distinct operations.

### Reset Scenario

Reset is available for an active scenario session. It:

- Discards exploratory manual picks made after the scenario was loaded.
- Re-runs validation and deterministic replay from the scenario inputs.
- Restores the state at the scenario's defined `appliedPickCount` target.
- Recomputes recommendations from the restored state.
- Clears transient debugger selection and scenario-session errors where appropriate.
- Does not modify persisted drafts or the scenario file.

Reset should use the same staged replay path as initial loading. It must not restore a cached fabricated final state.

### Restart Configured Draft

Restart creates a fresh draft at zero applied picks using the active league settings, draft configuration, ranking snapshot, and user-team context. It:

- Clears all picks and derived rosters.
- Restores the full available-player pool through normal draft initialization.
- Recomputes recommendations for the new draft.
- Establishes a normal manual draft session rather than a scenario-target baseline.
- Does not overwrite or delete persisted data unless the developer later invokes an existing explicit persistence action.

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

## 9. Testing and Regression Strategy

Phase 4 testing should emphasize exact deterministic behavior and domain equivalence rather than UI implementation details.

### Unit Coverage

Unit tests should cover:

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

- Manual draft behavior after replay infrastructure is introduced.
- Persisted draft hydration and continuation.
- Recommendation determinism for unchanged inputs.
- Atomic failure behavior for malformed or semantically invalid scenarios.
- Reset and restart isolation from persisted data.
- Existing draft invariants after replay and after subsequent manual picks.

Every significant replay, import, reset, or debugger bug should receive a focused regression test when practical. Tests must not weaken existing assertions or replace exact business-behavior checks with existence checks.

### Manual QA

Focused manual QA should confirm that a developer can:

- Load each curated scenario and reach its target state within seconds.
- Import an exported scenario and reproduce the same visible state and recommendations.
- Understand a recommendation total from debugger output.
- Recover cleanly from an invalid import.
- Reset and replay repeatedly without stale state.
- Continue using manual and persisted draft workflows.

---

## 10. Boundaries and Non-Goals

Phase 4 preserves the following boundaries:

- The Draft State Engine owns all draft rules and transitions.
- The Recommendation Engine owns all recommendation math, ordering, and score-backed reasons.
- Scenarios contain inputs used to rebuild state, not saved final state.
- Replay is deterministic and local.
- Persistence stays behind its repository and hydration boundaries.
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
- AI-generated recommendations or explanations.
- Opponent modeling, draft simulations, strategy profiles, and Insight Engine behavior.
- Persisted recommendation output.
- Multi-user collaboration and accounts.
- A polished end-user draft room or unrelated UI expansion.
- New services, workers, queues, caches, or deployment infrastructure.

The Phase 4 scenario contract should not be promoted into the future live-provider event contract by default. Phase 7 may reuse concepts proven useful by replay, but it should design provider normalization around actual live-provider constraints when that phase becomes active.

---

## 11. Open Questions and Design Decisions

### Design Decisions

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

### Open Questions

1. **Recommendation diagnostic completeness:** Does the existing Phase 3 recommendation result expose applied caps, penalties, and deterministic tie-break information clearly enough for the debugger, or does its structured output need a small additive extension?
2. **Current state provenance:** Do the manual and persisted draft workflows retain all canonical inputs needed for scenario export, especially ordered pick history, user-team identity, and the exact ranking snapshot, or is a narrow domain-facing export mapper required?
3. **Replay controls:** Is immediate replay-to-target sufficient for the first Phase 4 increment, or does a concrete debugging case justify step-forward controls? Real-time playback and animation are not justified.
4. **Unsaved-change handling:** Should reset, restart, and scenario replacement require a lightweight confirmation after exploratory manual picks, or is immediate replacement preferable for the developer-only workbench?
5. **Import limits:** What practical local file-size and ranking-entry limits should protect the browser from accidental oversized imports without rejecting realistic embedded ranking snapshots?

Before implementation tasks are created, these questions should be resolved by mapping this design to the existing domain types, recommendation output, simulator state ownership, and persistence hydration boundary. That review should remain narrow and should not reopen the Phase 4 product scope.
