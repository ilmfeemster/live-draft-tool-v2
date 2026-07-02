# Future Ideas

Purpose:

Prevent MVP scope creep while preserving useful ideas.

Features listed here are intentionally out of scope unless promoted into active development.

---

## Draft Intelligence

### Value & Timing

- ADP comparison
- Value above next pick
- Expected player availability
- Draft value indicators

### Strategy

- Draft strategy profiles
- Positional run prediction
- Opponent roster modeling
- Roster construction grading

### Analysis

- Draft recap grading
- Historical draft testing
- Draft trend analysis

---

## Platform Integrations

- Sleeper integration
- ESPN integration
- Yahoo integration
- Automatic pick syncing
- Live draft ingestion

---

## Recommendation Enhancements

- Simulation-based recommendations
- ML-assisted recommendations
- AI explanation layer
- Player news integration
- Injury alerts

---

## User Features

- Player notes
- Watchlist
- Player queue
- Custom draft naming and renaming
- Custom rankings
- Saved draft sessions
- Draft history
- Custom scoring systems

---

## Expanded League Support

- Dynasty
- Keeper leagues
- Auction drafts
- Superflex
- IDP
- Custom roster formats

---

## Platform & UX

- Mobile draft mode
- Tablet optimization
- Offline mode
- Dark mode
- Multi-user support

---

## Promotion Checklist

Before moving a feature into active development, ask:

1. Does it improve the core live-draft workflow?
2. Does it solve a real pain point?
3. Has the MVP already validated the need?
4. Can it be implemented incrementally?
5. Does the value justify the complexity?
6. Would users miss it if it did not exist?

If the answer is unclear, keep the feature here.

---

## Candidate Features For First Post-MVP Release

## Flexible Ranking Import Mapping

Allow users to import ranking files beyond the supported FantasyPros and Canonical JSON formats by mapping source columns to app fields.

### Goals

- Preview uploaded CSV headers and sample rows.
- Let users map columns to required fields such as player name, position, and overall rank/order.
- Let users optionally map team, ADP, player ID, and source tier columns.
- Validate mappings before import.
- Preserve source-tier semantics without treating arbitrary tier columns as recommendation-tier pressure.
- Import mapped files through the existing normalization, validation, and managed ranking-set workflow.

### Non-Goals

- Do not auto-trust arbitrary tier columns as recommendation tiers.
- Do not derive position tiers from rank or ADP.
- Do not add provider-specific scraping or live feeds.
- Do not require saved presets for the first version.