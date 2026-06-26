# Architecture

## Architecture Goals

Optimize for:

- Fast iteration
- Simplicity
- Maintainability
- Debuggability
- Solo developer productivity
- Shipping a usable MVP quickly

Do not optimize for:

- Large-scale traffic
- Multi-user scaling
- Real-time synchronization
- Microservices
- Premature extensibility

---

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma

Possible database providers:

- Supabase
- Neon
- Local Docker PostgreSQL

---

## Application Structure

Use a monolith-first Next.js architecture.

The backend should use:

- Next.js app routes
- Server actions where appropriate
- Simple data access through Prisma

Avoid during MVP:

- Separate backend services
- GraphQL
- Event-driven systems
- Queues
- Service decomposition

---

## Core Domain Objects

Likely entities:

- Player
- RankingEntry
- Draft
- DraftPick
- Team
- UserRoster
- Recommendation

The MVP should favor straightforward models over generic abstractions.

---

## State Management

Use:

- Local React state
- React Context where appropriate

Avoid during MVP:

- Redux
- Event sourcing
- CQRS
- Overly abstract state systems

Possible future addition:

- Zustand

State complexity should only be added after actual friction appears.

---

## Recommendation Engine

The Recommendation Engine sits above the Draft State Engine.

It should be a pure domain layer that consumes typed draft state, ranking data, league settings, and user team identity. It should return recommendation output. It should not:

- Read from persistence directly.
- Mutate draft state.
- Depend on React.
- Depend on database records or raw JSON.
- Depend on whether draft state came from manual entry, replay, or a future live provider.

The recommendation engine should remain:

- Rule-based
- Deterministic
- Inspectable
- Debuggable

It should not use AI or machine learning during MVP.

Initial recommendation factors:

- Rank-derived base player value
- Roster fit and timing
- Value opportunity
- Tier-drop risk
- Positional scarcity
- Observed run pressure

Use a bounded additive scoring model:

```txt
recommendation score =
base player value
+ bounded context modifiers
```

The base player value should anchor recommendations. Context modifiers should move players within a bounded range, especially among similarly ranked players, without letting a single signal dominate recommendation quality.

Architecture guardrails:

- Base value should come from the active ranking snapshot.
- Context modifiers should be bounded.
- Total context impact should be capped.
- Scarcity and tier pressure should avoid double-counting the same urgency.
- Tie breaking should be deterministic.
- Recommendation output should be derived, not persisted.
- Roster need should be derived from league settings and roster configuration rather than MVP constants.

Recommendation explanations should come directly from scoring components. The engine should not generate explanation text from unsupported claims, AI reasoning, opponent predictions, or UI-only labels.

---

## UI Priorities

The UI should prioritize:

- Live-draft speed
- Keyboard-friendly pick entry
- Minimal click friction
- Clear information hierarchy
- Laptop-first usability

The MVP does not need:

- Advanced animations
- Complex design system work
- Mobile-first polish

---

## Deployment

Deployment should remain simple.

Preferred options:

- Vercel
- Railway
- Render

Avoid during MVP:

- Kubernetes
- Complex AWS infrastructure
- Container orchestration
- Complex CI/CD systems

---

## Architecture Non-Goals

The MVP should intentionally avoid:

- Platform integrations
- WebSocket sync
- Real-time collaborative draft state
- Advanced caching
- Background workers
- AI agents
- ML recommendation pipelines
- Plugin architecture
- Large-scale optimization

---

## Architecture Principles

- Use boring technology.
- Prefer simple mental models.
- Keep systems inspectable.
- Add complexity incrementally.
- Build in vertical slices.
- Optimize for fast feedback.
- Do not solve hypothetical future problems before validating the MVP.
