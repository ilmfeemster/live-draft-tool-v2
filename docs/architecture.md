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

The recommendation engine should be:

- Rule-based
- Deterministic
- Inspectable
- Debuggable

It should not use AI or machine learning during MVP.

Initial recommendation factors:

- Overall ranking value
- Roster need
- Positional scarcity
- Tier-drop risk

Conceptual scoring model:

```txt
recommendation score =
base ranking score
+ roster need modifier
+ scarcity modifier
+ tier modifier
```

Recommendation explanations should come directly from the scoring inputs.

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