# Project

## Goal

Build a single-user fantasy football draft assistant for live snake drafts.

The tool helps users make better draft decisions by combining rankings, roster context, positional scarcity, and tier information during a live draft.

The app is a companion tool, not a fantasy platform.

---

## Target User

The initial user is the developer.

The user participates in live fantasy football drafts and wants better decision support than a static rankings sheet provides.

---

## MVP League Settings

- 12 Teams
- Redraft
- Snake Draft
- 1QB
- PPR (assumed)

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

---

## Core Workflow

### Before Draft

- Create draft
- Import rankings
- Set draft position
- Start draft

### During Draft

- Enter picks manually
- Track drafted players
- Update available player pool
- Update user roster
- Generate recommendations

### On User Pick

Display:

- Top recommendations
- Recommendation reasoning
- Tier warnings
- Positional scarcity warnings
- Roster needs

---

## MVP Features

### Draft Setup

- Create draft
- Set draft position
- Import rankings

### Draft Tracking

- Manual pick entry
- Draft board
- Available player tracking
- User roster tracking
- Undo last pick

### Recommendations

Rule-based recommendation engine using:

- Rankings
- Roster need
- Positional scarcity
- Tier-drop risk

---

## Non-Goals

The MVP will NOT include:

- Authentication
- Multi-user support
- ESPN integration
- Yahoo integration
- Sleeper integration
- WebSocket sync
- AI chat assistant
- Simulations
- Dynasty support
- Auction drafts
- Keeper leagues
- Mobile app
- Machine learning recommendations
- News/injury ingestion
- Payments

---

## Success Criteria

The MVP is successful when a user can:

1. Import rankings.
2. Start a draft.
3. Enter picks manually.
4. Track drafted and available players.
5. Track their roster.
6. Receive updated recommendations after every pick.
7. Complete a full 12-team draft without application failure.

The MVP should provide better live-draft decision support than a static rankings sheet.

---

## Product Principles

- Prioritize draft speed over feature depth.
- Prefer simple, inspectable systems.
- Optimize for live-draft usability.
- Keep recommendation logic understandable.
- Avoid complexity until the core workflow is validated.
