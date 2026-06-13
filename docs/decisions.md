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

## Template

### YYYY-MM-DD

### Decision Title

Decision:

Reason:

Tradeoffs: