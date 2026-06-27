# Tasks

## Current Focus

Phase 4: Developer Tools & Simulator.

Phase 4 first completes configurable league creation, then adds a local development workbench around the existing Draft State Engine and Recommendation Engine. The work should let developers create and persist supported non-default drafts before making scenarios portable, deterministic, fast to replay, and easy to inspect.

The source documents for this task plan are:

- `docs/project.md`
- `docs/design/phase-4-developer-tools-simulator.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/roadmap.md` for phase boundaries only

Completed Phase 1 and Phase 2 task history remains archived in `docs/completed-tasks.md`. Phase 3 engine implementation and automated coverage are complete; its former completion task was not marked complete in the previous plan, so Phase 4 completion validation must retain full manual and persisted-workflow regression coverage rather than assume that evidence.

---

## Phase 4 Task Ordering

The tasks are ordered to complete the shared configuration path before scenario infrastructure or workbench controls:

1. Define the league-setup input, supported bounds, and deterministic settings builder.
2. Create and persist configured drafts through the existing repository boundary.
3. Add the developer-facing draft setup workflow and prove persisted non-default use.
4. Define the portable scenario contract and serialization boundary using those settings.
5. Validate untrusted scenarios and enforce fixed MVP safety limits.
6. Replay validated pick history through the existing Draft State Engine.
7. Add typed import/export mapping and prove semantic round trips.
8. Build the curated scenario library on the public scenario path.
9. Make Recommendation Engine totals fully inspectable and display them read-only.
10. Add transient scenario-session, reset, restart, and dirty-state behavior.
11. Integrate the focused developer workbench controls.
12. Complete cross-feature regression and Phase 4 exit validation.

Do not promote multiple unrelated tasks into `docs/current-slice.md` at once.

---

## Task 1 - Define League Setup and Validation

- [x] Complete

### Goal

Create one pure, deterministic boundary that validates supported league-setup input and builds the existing `LeagueSettings` and user-team identity used by draft creation.

### Scope

- Define a small setup input for team count, user draft position, QB, RB, WR, TE, FLEX, DST, K, and BENCH counts, draft type, and scoring format.
- Keep the current 12-team, 16-round, Team 2 league as the default setup input.
- Support team counts from 2 through 20 and draft positions within the selected team count.
- Support non-negative roster counts with at least one non-BENCH starter and 1 through 30 total slots.
- Support only `SNAKE` and `PPR`.
- Generate deterministic ordered roster slots with unique category/index IDs and approved eligibility.
- Derive rounds from total roster slots and derive user-team identity from draft position.
- Validate total draft capacity against a supplied ranking-snapshot player count.
- Return structured validation failures suitable for server enforcement and form feedback.

### Non-Goals

- Do not add a setup form or change draft creation yet.
- Do not persist form counts as a second settings model.
- Do not add arbitrary slot eligibility, custom positions, auction, keeper, dynasty, or alternate scoring.
- Do not change Draft State Engine or Recommendation Engine behavior.
- Do not add package dependencies.

### Acceptance Criteria

- Valid setup input produces the existing typed `LeagueSettings` and a valid user-team ID.
- Identical input produces identical roster-slot order and IDs.
- Rounds equal the generated roster-slot count and are not independently supplied.
- Default input produces the current MVP league settings and Team 2 identity.
- Non-default team count, roster construction, and draft position produce valid dynamic settings.
- Invalid bounds, unsupported values, empty starting lineups, and insufficient ranking capacity return clear errors.
- No draft or persistence record is created by the builder.

### Suggested Tests

- Unit tests for default and non-default settings generation.
- Unit tests for every supported slot category and deterministic IDs.
- Boundary tests for team count, draft position, roster total, and ranking capacity.
- Unit tests rejecting non-integer counts, unsupported draft/scoring values, and bench-only rosters.

---

## Task 2 - Create and Persist Configured Drafts

- [x] Complete

### Goal

Use the shared league-setup builder at the server boundary so valid configured drafts are persisted and hydrated through the existing repository architecture.

### Scope

- Accept league-setup input in configured draft creation.
- Revalidate all setup input on the server before repository access.
- Check draft capacity against the seed ranking snapshot used for Phase 4 creation.
- Pass only generated `LeagueSettings`, seed rankings, and derived user-team identity into the existing repository input.
- Preserve the current JSON settings snapshot and `userTeamId` persistence shape.
- Return useful validation failure data without creating a draft.
- Route automatic first-run/default creation through the same default setup builder.
- Prove a non-default draft persists, hydrates, and resumes with identical settings and user-team identity.

### Non-Goals

- Do not add a Prisma migration or normalized settings tables.
- Do not edit settings on an existing draft or migrate existing picks.
- Do not add a client setup form yet.
- Do not change ranking sources or add ranking management.
- Do not alter pick, undo, reset, or delete semantics.

### Acceptance Criteria

- Valid configured creation writes one draft through the existing repository.
- Invalid setup creates no draft or ranking snapshot record.
- A persisted non-default draft hydrates the same team count, rounds, roster slots, draft type, scoring format, and user-team identity.
- The generated draft order and teams match the configured settings.
- Existing default creation remains behaviorally equivalent but uses the shared builder.
- No database schema change is required.

### Suggested Tests

- Server-action test for valid configured creation.
- Server-action test proving invalid input never calls the repository.
- Repository round-trip test for non-default settings and draft position.
- Loader regression test for automatic default creation.
- Existing persistence tests should continue to pass.

---

## Task 3 - Add the Draft Setup Workflow

- [ ] Complete

### Goal

Allow a developer to create and resume any supported league configuration from the application without modifying code.

### Scope

- Open a compact setup workflow from `Start New Draft` instead of immediately creating the fixed default.
- Prefill the current MVP team count, roster construction, draft position, `SNAKE`, and `PPR` values.
- Provide numeric controls for team count, draft position, and supported roster-slot counts.
- Show `SNAKE` and `PPR` as the active supported settings without offering unsupported choices.
- Show immediate shared-validation feedback and authoritative server failures.
- Submit configured creation, preserve the existing draft in history, and route to the new draft.
- Allow cancel without changing the active draft.
- Display the hydrated configured team count, rounds, draft position, scoring format, and draft type through existing draft surfaces.
- Confirm recommendations, picks, undo, reset, refresh, and resume consume the persisted non-default settings.

### Non-Goals

- Do not build an arbitrary roster-slot editor or custom eligibility UI.
- Do not edit an existing draft's settings.
- Do not add custom draft names, ranking selection, or saved league presets.
- Do not redesign the Draft Room beyond the compact setup flow and necessary feedback.
- Do not add unsupported scoring or draft formats.

### Acceptance Criteria

- A developer can create a valid non-default draft without source changes.
- Invalid fields are identified and no draft is created.
- The selected draft position maps to the correct user team.
- Rounds derive from roster construction and are visible after creation.
- Refresh and history resume preserve the configured settings.
- Draft State and Recommendation Engine behavior use the hydrated configuration.
- Existing default creation remains quick through prefilled values.

### Suggested Tests

- Component tests for defaults, field validation, cancel, and successful submit.
- Integration test for creating and routing to a non-default persisted draft.
- Regression test for in-progress-draft confirmation and history preservation.
- Workflow test for pick, recommendation, undo, reset, and refresh under non-default settings.
- Focused manual QA for one non-default configuration.

---

## Task 4 - Define the Scenario V1 Contract

- [ ] Complete

### Goal

Create the typed, versioned, self-contained scenario contract that later Phase 4 work can validate, replay, import, and export.

### Scope

- Define the Phase 4 scenario v1 shape for metadata, optional informational provenance, league settings, draft configuration, embedded ranking context, user-team identity, ordered pick history, and `appliedPickCount`.
- Reuse existing domain types where their meaning matches the scenario contract.
- Represent optional expected pick-number and team assertions without making them authoritative draft commands.
- Define deterministic serialization for an already-valid typed scenario.
- Keep the contract capable of representing supported dynamic league settings.
- Exclude rosters, availability, active pick, completion flags, recommendations, database rows, and React state from authoritative scenario data.

### Non-Goals

- Do not validate untrusted JSON yet.
- Do not replay picks.
- Do not add import/export UI.
- Do not add database storage for scenarios.
- Do not introduce ranking management or a generic Draft Source interface.

### Acceptance Criteria

- The contract has one explicit supported schema version.
- A scenario embeds the ranking snapshot needed for deterministic recommendation input.
- Metadata and provenance cannot affect reconstructed draft state or recommendation output.
- Replay target semantics are unambiguous for zero, intermediate, and completed pick counts.
- The contract supports a valid non-default league configuration without 12-team or 16-round assumptions.
- Serialized scenarios contain source inputs rather than fabricated derived state.

### Suggested Tests

- Type or compile validation for the public scenario types.
- Unit test for deterministic serialization of a representative typed scenario.
- Unit test that a non-default league fixture can be represented.
- Unit test that optional provenance does not alter serialized domain inputs.

---

## Task 5 - Add Scenario Parsing and Validation

- [ ] Complete

### Goal

Reject malformed, incompatible, unsafe, or internally inconsistent scenarios before they can reach replay or replace active state.

### Scope

- Parse untrusted scenario JSON into the v1 contract.
- Validate required fields, supported version, metadata, settings, draft configuration, ranking entries, user-team identity, pick references, optional assertions, and replay-target bounds.
- Reject duplicate ranking players, duplicate drafted players, invalid pick references, inconsistent team configuration, and history beyond draft capacity.
- Reuse existing league and draft validation rules where available instead of duplicating domain logic.
- Enforce the fixed Phase 4 limits: 1 MiB JSON, 1,000 ranking entries, 1,000 configured or historical picks, and 50 metadata tags.
- Return clear structured failures without mutating current or persisted draft state.

### Non-Goals

- Do not semantically apply the pick sequence yet.
- Do not migrate unsupported scenario versions.
- Do not make safety limits configurable.
- Do not parse external ranking formats or add Phase 5 ranking features.
- Do not add UI beyond error data needed by later work.

### Acceptance Criteria

- Valid v1 scenarios produce typed scenario data.
- Malformed JSON and unsupported versions fail clearly.
- Missing ranking context, invalid user-team references, duplicate players, invalid pick assertions, and out-of-range targets fail clearly.
- Dynamic valid league settings pass within the fixed safety limits.
- Oversized or over-complex scenarios fail before replay.
- Validation has no side effects on active or persisted drafts.

### Suggested Tests

- Unit tests for malformed JSON, missing fields, and unsupported versions.
- Unit tests for duplicate players, bad references, inconsistent settings, and invalid targets.
- Boundary tests for file size, rankings, picks, and metadata tags.
- Unit test for a valid non-default league configuration.

---

## Task 6 - Add Deterministic Replay Infrastructure

- [ ] Complete

### Goal

Reconstruct zero-pick, intermediate, and completed draft states by applying validated scenario history through the existing Draft State Engine.

### Scope

- Add a small replay coordinator that creates a fresh base draft from scenario settings and configuration.
- Apply every ordered pick through the canonical pure draft transition.
- Capture the state at `appliedPickCount` while continuing to validate the full supplied history.
- Return the target state only after the complete history succeeds.
- Treat rejected or no-op transitions as replay failures with the relevant pick index and reason.
- Recompute recommendations from the reconstructed state, embedded rankings, league settings, and user-team identity.
- Prove equivalent manual and replay inputs produce equivalent domain state and recommendation output.
- Support immediate replay-to-target only.

### Non-Goals

- Do not inject rosters, availability, current pick, or completion directly.
- Do not add step controls, timing, animation, or real-time playback.
- Do not write replay picks to persistence.
- Do not introduce an event bus, provider adapter, or Phase 7 normalization model.
- Do not change draft rules to accommodate invalid scenarios.

### Acceptance Criteria

- Replay uses the existing Draft State Engine transition for every pick.
- Zero, intermediate, and completed targets reconstruct valid domain state.
- The entire history must validate even when the target is intermediate.
- Repeated replay of identical input produces identical draft and recommendation output.
- Manual and replay paths are equivalent for the same inputs.
- A replay failure returns no partially reconstructed active state.

### Suggested Tests

- Unit tests for zero, intermediate, and completed replay targets.
- Integration test comparing manual and replay state field by field.
- Integration test comparing deterministic recommendation output.
- Regression test that a late invalid pick rejects the whole scenario.
- Replay test using a non-default league configuration.

---

## Task 7 - Add Portable Import and Export Round Trips

- [ ] Complete

### Goal

Convert typed manual, persisted, and transient workspaces into portable scenarios and reconstruct them without crossing persistence or UI boundaries.

### Scope

- Add a pure domain-facing export mapper over typed workspace data.
- Extract league settings, team configuration, user-team identity, embedded rankings, and ordered assigned picks without serializing derived state.
- Generate safe default scenario metadata, accept a lightweight name override, and include optional informational source provenance.
- Import through the shared parser, validator, and replay coordinator.
- Preserve `appliedPickCount`, defaulting export to the active drafted-pick count.
- Prove export/import semantic round trips for manual, hydrated persisted, and transient scenario states.
- Keep import and export local and explicit.

### Non-Goals

- Do not query Prisma or server actions from the mapper.
- Do not persist imported scenarios or exported recommendation output.
- Do not require byte-for-byte equality after re-export.
- Do not add arbitrary ranking-file import, tier editing, or ranking collections.
- Do not add final workbench controls yet.

### Acceptance Criteria

- The mapper consumes typed workspace values rather than database records or React state.
- Exported files contain canonical source inputs and no authoritative derived state.
- Importing an exported scenario reproduces equivalent domain state and recommendation input.
- Informational provenance can be removed or changed without changing replay output.
- Exporting a hydrated persisted draft performs no persistence mutation.
- Round trips preserve dynamic league configuration and ordered pick history.

### Suggested Tests

- Unit test for workspace-to-scenario mapping.
- Round-trip test for an in-memory manual workspace.
- Round-trip test for a hydrated persisted workspace.
- Round-trip test after transient scenario exploration.
- Test that derived rosters, availability, and recommendations are absent from export.

---

## Task 8 - Add the Curated Scenario Library

- [ ] Complete

### Goal

Provide a small version-controlled library of representative draft situations that uses the same contract and replay path as imported scenarios.

### Scope

- Add curated v1 scenarios for an early baseline, roster need, tier or scarcity pressure, observed run pressure, a late or completed draft, and a non-default league configuration.
- Load curated files through the public scenario parser, validator, and replay coordinator.
- Give each scenario concise metadata that explains the behavior it is intended to reproduce.
- Assert stable draft state and important recommendation behavior for each curated scenario.
- Keep the library deliberately small and regression-oriented.

### Non-Goals

- Do not add a special hard-coded setup path for curated scenarios.
- Do not build user scenario collections, search infrastructure, cloud storage, or exhaustive combinatorial coverage.
- Do not add new recommendation behavior merely to make a curated scenario interesting.
- Do not turn the library into ranking management.
- Do not add the final scenario-selector UI yet.

### Acceptance Criteria

- Every curated file passes the same validation as an imported file.
- Every curated file replays deterministically through the existing Draft State Engine.
- The library covers representative draft-state and recommendation cases without duplicating setup logic.
- At least one scenario proves dynamic non-default settings.
- Scenario assertions are exact where behavior is deterministic.

### Suggested Tests

- Parameterized validation and replay test for every curated scenario.
- Exact invariant checks for reconstructed draft state.
- Recommendation ordering, total, component, or reason checks appropriate to each scenario.
- Repeated-replay determinism test.

---

## Task 9 - Add Recommendation Diagnostics and Debugger

- [ ] Complete

### Goal

Make Recommendation Engine scoring fully reconcilable and inspectable without moving recommendation logic into the UI.

### Scope

- Extend structured Recommendation Engine output with engine-owned urgency-cap and context-cap adjustments when they apply.
- Ensure raw component deltas plus adjustment deltas reconcile exactly to the final total.
- Preserve existing base score, context score, components, penalties, reasons, ranking data, and authoritative returned order.
- Add a read-only developer debugger that displays totals, raw components, modifiers, penalties, cap adjustments, and score-backed reasons.
- Display returned position and existing tie-break values without re-sorting recommendations in the UI.
- Make the debugger usable for current manual and hydrated persisted drafts so the same view can later serve scenario sessions.

### Non-Goals

- Do not calculate scores, caps, reasons, or sort order in the UI.
- Do not add weight editing, live tuning, strategy profiles, or AI explanations.
- Do not persist diagnostics or recommendation output.
- Do not change scoring behavior except to expose existing applied adjustments.
- Do not redesign the draft room.

### Acceptance Criteria

- Every displayed recommendation total can be reconciled from engine-owned structured output.
- Capped and uncapped examples expose the correct adjustments.
- Negative modifiers and penalties remain visible.
- Debugger reasons exactly match Recommendation Engine reasons.
- The UI preserves engine ordering and adds no parallel recommendation rules.
- Existing recommendation output remains deterministic.

### Suggested Tests

- Unit tests for urgency-cap and context-cap adjustment output.
- Unit test that components plus adjustments equal total score.
- Regression tests proving recommendation order and reasons are unchanged.
- Component test for debugger rendering of positive, negative, and capped scores.

---

## Task 10 - Add Transient Scenario Sessions and Reset/Restart

- [ ] Complete

### Goal

Allow safe local exploration of replayed scenarios with distinct reset and restart behavior while preserving existing persisted-draft actions.

### Scope

- Introduce a transient scenario-session mode around a successful replay result.
- Route scenario picks and undo through existing pure Draft State Engine transitions without repository writes.
- Keep manual and hydrated persisted draft sessions on their existing server-action and repository path.
- Track the loaded scenario baseline and whether local exploratory changes have diverged from it.
- Reset a scenario by validating and replaying its source back to its target.
- Restart with the same settings, rankings, and user-team identity at zero picks as a transient manual session.
- Confirm reset, restart, or scenario replacement only when it would discard dirty local changes.
- Recompute recommendations after every local transition, reset, and restart.

### Non-Goals

- Do not autosave scenarios or add scenario persistence tables.
- Do not call persisted reset or pick actions from a transient scenario session.
- Do not add a global browser navigation warning or recovery system.
- Do not change existing persisted-draft confirmation or save behavior.
- Do not add final workbench layout polish.

### Acceptance Criteria

- Scenario exploration creates no database writes.
- Local picks and undo use the same pure transitions as persisted draft operations.
- Reset restores the declared replay target rather than a cached final state.
- Restart produces a valid zero-pick transient draft with the same configuration and rankings.
- Dirty destructive actions require confirmation; unchanged sessions proceed immediately.
- Existing manual and persisted draft actions behave as before.

### Suggested Tests

- Integration test proving scenario picks and undo avoid repository actions.
- Integration test for reset after exploratory picks.
- Integration test for restart at zero picks.
- Tests for dirty and unchanged confirmation behavior.
- Regression tests for existing persisted pick, undo, and reset flows.

---

## Task 11 - Integrate the Developer Workbench Controls

- [ ] Complete

### Goal

Expose the completed scenario, replay, export, debugger, reset, and restart capabilities in one focused simulator workflow.

### Scope

- Add a compact curated-scenario selector.
- Add local JSON import and export controls.
- Replay selected or imported scenarios immediately to their declared target.
- Show active scenario name, source, replay target, applied-pick count, and dirty state.
- Surface concise validation and replay errors without replacing the active draft on failure.
- Expose scenario reset and configured-draft restart actions with the finalized confirmation behavior.
- Keep recommendation details accessible in the same workflow.
- Preserve normal manual and persisted draft navigation and actions.

### Non-Goals

- Do not add step playback, animation, timelines, or event streaming.
- Do not add scenario editing, cloud storage, ranking editing, or user collections.
- Do not add consumer onboarding, mobile-first polish, or a broad design-system refactor.
- Do not add new services, queues, workers, or deployment infrastructure.
- Do not introduce Phase 7 provider controls.

### Acceptance Criteria

- A developer can select or import a scenario and reach its target state within seconds.
- Invalid import leaves the current draft unchanged and shows a useful error.
- Export is available for manual, persisted, and transient scenario states.
- Reset, restart, local picks, undo, and debugger inspection work from the scenario workflow.
- Workbench controls clearly distinguish transient scenario behavior from persisted draft behavior.
- Existing draft workflows remain usable without entering scenario mode.

### Suggested Tests

- Component or integration test for curated scenario selection and immediate replay.
- Component or integration test for successful and failed file import.
- Component test for source, target, count, and dirty-state indicators.
- Component test for export action and destructive confirmation behavior.
- Focused manual QA of the complete workbench loop.

---

## Task 12 - Complete Phase 4 Regression and Exit Validation

- [ ] Complete

### Goal

Prove the finished workbench meets Phase 4 success criteria and has not regressed the Draft State Engine, Recommendation Engine, or persistence workflows.

### Scope

- Run and complete deterministic unit, integration, scenario, and regression coverage across the Phase 4 path.
- Confirm every supported league-setup field validates, creates, persists, hydrates, and reaches the Draft State and Recommendation Engines correctly.
- Confirm invalid league setup creates no persisted draft or ranking snapshot.
- Confirm replay equivalence, import/export round trips, validation failure isolation, reset/restart behavior, and recommendation determinism.
- Confirm draft invariants after replay, local exploration, reset, restart, and completed scenarios.
- Confirm the curated library covers intermediate, completed, recommendation-focused, and non-default configurations.
- Re-run existing manual draft, recommendation, hydration, repository, and persisted-workflow coverage.
- Complete focused manual QA for scenario load, import, export, debugger inspection, dirty confirmation, reset, restart, and persisted-draft preservation.
- Verify the developer can recreate representative target states within seconds.

### Non-Goals

- Do not add new Phase 4 features during exit validation.
- Do not weaken existing assertions or change expected recommendation behavior without an approved product decision.
- Do not optimize for synthetic scale beyond the approved safety limits.
- Do not begin Phase 5 ranking work or Phase 7 provider work.
- Do not expand UI polish beyond a direct usability blocker.

### Acceptance Criteria

- All Phase 4 task acceptance criteria are satisfied.
- Relevant focused and full automated suites pass.
- Manual QA confirms the end-to-end developer workflow.
- A developer can create and resume a supported non-default configuration without modifying code.
- Replay and scenario tooling preserve the configured team count, roster construction, draft position, draft type, and scoring format.
- Manual and replay inputs produce equivalent domain state and recommendation output.
- Invalid scenarios never partially replace active state or mutate persistence.
- Existing manual and persisted draft workflows pass regression validation.
- No Phase 4 non-goals or future-phase architecture were introduced.

### Suggested Tests

- Run the full automated test suite and project validation commands.
- Create, persist, refresh, and resume one non-default league through the setup workflow.
- Run every curated scenario through validation and replay.
- Complete the focused Phase 4 manual QA checklist.
- Repeat one scenario after a reset and compare exact recommendation output.
- Export and import one hydrated persisted draft without mutating its source record.

---

## Testing Status

Phase 1 manual simulator coverage and Phase 2 persistence validation are complete and archived.

Phase 3 implementation and automated coverage are complete for deterministic recommendation scoring, bounded modifiers, ordering, explanations, representative scenarios, workflow integration, and persisted parity. The previous task plan did not record completion of its final manual validation gate; Phase 4 Task 12 therefore retains explicit manual and persisted-workflow regression checks.

Phase 4 implementation has not started. Tasks 1-12 are pending. Configurable league setup Tasks 1-3 are prerequisites for scenario contract work.

---

## Backlog

Not required for Phase 4:

- Authentication or multi-user support
- Scenario database storage, cloud sync, or user collections
- Runtime ranking management or multiple managed ranking sets
- Arbitrary ranking-source import or tier editing
- Generic Draft Source or live-provider interfaces
- ESPN, Yahoo, or Sleeper integration
- Polling, WebSockets, reconnect behavior, or provider event normalization
- Step-by-step or animated replay
- Opponent modeling or draft simulation
- AI-generated reasoning or Phase 6 insights
- Recommendation weight-editing UI
- Polished consumer draft-room expansion
- Mobile-first redesign
- New services, queues, workers, or deployment infrastructure

See `future_ideas.md` for additional deferred ideas.
