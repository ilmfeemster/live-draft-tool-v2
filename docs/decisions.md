# Decisions

This file records meaningful product and engineering decisions.

Only record decisions that affect future development.

Do not record trivial implementation details.

---

## 2026-05-31

### Project Scope

Decision:

Build a fantasy football draft assistant focused on improving live draft decisions.

Reason:

The highest-value workflow is helping users draft better in real time rather than building a complete fantasy platform.

---

## 2026-05-31

### MVP User Model

Decision:

The MVP is single-user only.

Reason:

Multi-user support adds significant complexity without improving the core workflow being validated.

Tradeoffs:

- No collaborative drafts
- No shared draft rooms
- No account system requirements

---

## 2026-05-31

### Draft Input Method

Decision:

Use manual pick entry for MVP.

Reason:

Manual entry is the fastest way to validate the product without building platform integrations.

Tradeoffs:

- Requires user interaction for every pick
- May eventually be replaced with integrations

---

## 2026-05-31

### Recommendation Engine

Decision:

Use a deterministic rule-based recommendation engine.

Reason:

Recommendations must be explainable, debuggable, and easy to iterate on.

Tradeoffs:

- Less sophisticated than simulation-based systems
- Easier to validate and improve

---

## 2026-05-31

### Architecture Strategy

Decision:

Use a monolith-first architecture.

Reason:

Reduces deployment complexity and improves iteration speed.

Tradeoffs:

- Less scalable
- Simpler development workflow

---

## 2026-05-31

### State Management

Decision:

Use React state and Context before introducing additional state libraries.

Reason:

Current MVP complexity does not justify Redux or Zustand.

Tradeoffs:

- May require refactoring later
- Simpler mental model today

---

## 2026-05-31

### Recommendation Factors

Decision:

Recommendations will be based on:

- Overall ranking value
- Roster need
- Positional scarcity
- Tier-drop risk

Reason:

These are the primary signals that influence draft decisions.

---

## 2026-05-31

### MVP Platform Scope

Decision:

The MVP will not include:

- ESPN integration
- Yahoo integration
- Sleeper integration
- AI chat features
- Simulations
- Dynasty support
- Auction support

Reason:

Focus on validating the core live-draft workflow before expanding scope.

---

## 2026-06-22

### Seed Rankings Source

Decision:

Use the local FantasyPros CSV as the source for the MVP seed rankings, converted into the existing `RankingEntry[]` application shape.

Reason:

A larger realistic player pool is needed to test draft flow and upcoming recommendation logic without adding runtime CSV import, database work, or package dependencies.

Tradeoffs:

- CSV-only fields such as bye week, upside, bust, and SOS are not used yet.
- ECR-vs-ADP is stored as a derived `adpRank` for future recommendation logic, with `null` used when the CSV has no ADP offset.
- Updating rankings currently requires regenerating the typed seed data.
- The app keeps a simple static data path while recommendation behavior is still being validated.

---

## 2026-06-25

### Phase 2 Ranking Snapshot Storage

Decision:

Store Phase 2 ranking snapshots as JSON rather than normalized ranking rows.

Reason:

Phase 2 only needs durable save/load and draft hydration. Ranking snapshots are loaded as whole-draft inputs, not queried independently. JSON preserves the exact ranking state used by a draft and avoids premature schema complexity while the ranking model is still evolving.

Tradeoffs:

- Raw JSON must stay behind the repository layer.
- Repository code must expose typed ranking data such as `RankingEntry[]`.
- The Draft State Engine and Recommendation Engine must not depend on the database storage shape.
- Normalized ranking rows are deferred until Phase 5, when rankings become a first-class feature.

---

## 2026-06-25

### Phase 2 Dynamic Draft Configuration

Decision:

Phase 2 persistence must be driven by persisted league settings rather than MVP default constants.

Reason:

The current UI can still create drafts using MVP defaults, but storage and hydration should not hard-code 12 teams, 16 rounds, roster slots, draft position, draft order length, or total pick count. Persisting league settings as source configuration keeps save/load durable now and avoids forcing a persistence redesign when custom league sizes or roster configurations become active.

Tradeoffs:

- The persistence layer needs typed settings validation earlier.
- Hydration must derive draft size, pick count, active team, and roster structure from settings.
- Tests should include at least one non-default league configuration to prove persistence is not coupled to MVP defaults.

---

## 2026-06-25

### Prisma 7 Driver Adapter

Decision:

Use `@prisma/adapter-pg` with `pg` when constructing the Prisma client.

Reason:

The generated Prisma 7 client requires an adapter-backed constructor. The repository layer cannot safely rely on `new PrismaClient()` without explicit options.

Tradeoffs:

- Adds adapter dependencies alongside `@prisma/client` and `prisma`.
- Keeps the app aligned with Prisma 7's runtime model.
- Runtime database configuration must be tightened before beta so missing `DATABASE_URL` fails clearly outside local development.

---

## 2026-06-25

### Repository Tests Use Injected Fake Client

Decision:

Repository tests may use an injected Prisma-like fake client for focused create/load/list behavior tests.

Reason:

The repository boundary should be testable without requiring a long-lived external database for every unit test. Fake-client tests verify serialization, query shape, mapping, summary behavior, and domain outputs quickly.

Tradeoffs:

- Fake-client tests do not prove the real database, Prisma client, and migrations work together.
- Before beta, add real persistence validation through an integration test or documented manual database round trip.
- Keep fake tests focused on repository behavior and avoid asserting Prisma internals.

---

## 2026-06-26

### Phase 3 Bounded Additive Recommendation Scoring

Decision:

Use a bounded additive scoring model for Phase 3 recommendations:

```txt
recommendation score =
base player value
+ bounded context modifiers
```

Base player value should come from the active ranking snapshot. Context modifiers should include roster fit and timing, value opportunity, tier-drop risk, positional scarcity, and observed run pressure.

Reason:

This keeps recommendations deterministic, inspectable, and easy to tune while improving beyond static rankings. The model lets elite players remain obvious recommendations while still allowing contextual draft state to reorder similarly ranked players.

Tradeoffs:

- Less sophisticated than projection-based value, VORP, simulations, or opponent modeling.
- Requires scenario tests to keep tuning grounded in expected draft behavior.
- Modifier ranges and caps become important product tuning choices.
- Ranking snapshots remain the scoring anchor until rankings and projections become first-class product data.

---

## 2026-06-26

### Phase 3 Score-Backed Recommendation Explanations

Decision:

Generate recommendation explanations directly from scoring components.

Each displayed reason must trace back to an input that affected recommendation scoring, such as base value, roster need, value opportunity, tier pressure, scarcity, observed run pressure, or a meaningful penalty.

Reason:

The MVP must keep recommendations explainable and debuggable. Score-backed reasons prevent unsupported strategic claims and make it possible to validate explanation behavior with deterministic tests.

Tradeoffs:

- Explanations may be less conversational than AI-generated advice.
- Reason text is limited to what the scoring model actually knows.
- Future richer insight language should wait until the Insight Engine phase.

---

## 2026-06-26

### Phase 3 Recommendation Engine Boundary

Decision:

Keep the Recommendation Engine pure and derived.

The engine should consume typed draft state, ranking data, league settings, and user team identity. It should not read from persistence, mutate draft state, depend on React, depend on database records, or persist recommendation output.

Reason:

Recommendations are deterministic outputs of draft state and ranking context. Keeping the engine pure preserves architecture boundaries, makes the behavior easy to test, and ensures future manual, replay, and live draft sources can share the same recommendation logic.

Tradeoffs:

- UI and persistence layers must provide typed domain-facing inputs before calling the engine.
- Recommendation output is recomputed after loading a draft rather than reused from storage.
- Future performance optimization, if ever needed, must preserve derived-output semantics.

---

## 2026-06-26

### Phase 3 Deferred Recommendation Alternatives

Decision:

Defer projection-based value, VORP, opponent modeling, draft simulations, AI-generated explanations, and a generic modifier registry.

Reason:

These approaches either require data the MVP does not yet own, add assumptions that are hard to validate, reduce explainability, or introduce abstraction before the current modifier set needs it.

Tradeoffs:

- Phase 3 recommendations remain simpler than mature draft tools.
- Some advanced strategy behaviors wait for later roadmap phases.
- Future phases may revisit these alternatives after rankings, replay tooling, live integrations, or the Insight Engine become active scope.

---

## 2026-06-28

### Phase 5 Mutable Ranking Sets and Immutable Draft Snapshots

Decision:

Treat ranking sets as mutable authoring aggregates and draft ranking snapshots as separate immutable historical inputs. Draft creation copies the selected ranking set; existing drafts never follow later ranking-set edits or deletion.

Reason:

Recommendations and replay must remain deterministic and reproducible while ranking data evolves independently.

Tradeoffs:

- Ranking values are duplicated between source sets and snapshots.
- Correcting a ranking set does not rewrite existing drafts.
- Snapshot provenance may refer to a source set that no longer exists, but the snapshot remains complete and usable.

---

## 2026-06-28

### Phase 5 Staged Ranking Import Boundary

Decision:

Use an explicit import pipeline of format parsing, normalization, domain validation, and domain conversion. Begin with the documented FantasyPros CSV profile and a canonical versioned ranking-set JSON format. Add future formats as small explicit adapters into the same source-neutral candidate rather than building a generic plugin or column-mapping framework.

Reason:

The staged boundary keeps external syntax out of domain models, makes failures attributable and actionable, and preserves deterministic transformations without premature extensibility.

Tradeoffs:

- Each new source format requires its own adapter and conformance fixtures.
- Unsupported variants fail instead of being guessed.
- The initial format contract must be documented precisely before implementation.

---

## 2026-06-28

### Phase 5 Hybrid Ranking Persistence

Decision:

Persist mutable ranking sets as first-class set metadata and entries behind a dedicated ranking-set repository. Continue storing immutable draft ranking snapshots as whole serialized values behind the draft repository.

Reason:

Mutable ranking sets need management, validation, and isolation. Snapshots are written once and loaded as complete draft inputs, so normalizing them would add complexity without a query or editing requirement.

Tradeoffs:

- Similar ranking data has two persistence mappings.
- Repository mapping must keep both representations aligned with the canonical domain shape.
- Draft snapshot compatibility must be preserved when the ranking domain evolves.

---

## 2026-06-28

### Phase 5 Source-Local Player Identity

Decision:

Do not introduce a canonical cross-provider player catalog in Phase 5. Preserve explicit identities in canonical imports and allow supported external adapters to create deterministic identities that are stable within a ranking set and its snapshots.

Reason:

Draft state, recommendations, and replay require stable identity within a complete ranking context, not automatic reconciliation across unrelated sources.

Tradeoffs:

- Ranking sets cannot be safely merged or compared by player identity.
- Ambiguous normalized players must fail import rather than being silently matched.
- Cross-provider ID mapping remains deferred to later integration work.

---

## 2026-06-30

### Tier Semantics Correction

Decision:

Treat FantasyPros `TIERS` from the current supported CSV profile as source tiers, not position tiers or recommendation-tier-pressure input. Preserve source tier information separately from engine-facing recommendation tiers. Recommendation tier pressure requires explicit recommendation-tier eligibility, and rank-only or ADP-only data should not be used to derive position tiers. Legacy ambiguous `tier` values should remain loadable where practical but should be neutralized for recommendation pressure by default.

Reason:

The app does not currently own projections, value-over-replacement data, or similar value-based inputs needed to establish high-quality position tiers. Treating imported source tiers as position-local tier cliffs creates false recommendation urgency and misleading explanations.

Tradeoffs:

- Imported FantasyPros tier information remains inspectable and portable but may not enrich recommendation scoring until a valid recommendation-tier source exists.
- Some previous recommendation outputs may intentionally change once invalid tier pressure is neutralized.
- Compatibility readers need to distinguish loadability from recommendation eligibility.
- Future position-tier support is deferred until value-based data becomes active scope.

---

## Template

### YYYY-MM-DD

### Decision Title

Decision:

Reason:

Tradeoffs:
