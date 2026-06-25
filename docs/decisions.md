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

## Template

### YYYY-MM-DD

### Decision Title

Decision:

Reason:

Tradeoffs:
