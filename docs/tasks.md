# Tasks

## Current Focus

Build Vertical Slice 1:

- Import rankings
- Start a draft
- Enter picks manually
- Track available players
- Track user roster
- Generate recommendations

Success means a full mock draft can be completed without the app breaking.

---

## Next Tasks

### Project Setup

- [x] Create Next.js app
- [x] Configure TypeScript
- [x] Setup Tailwind CSS
- [x] Setup Git repository
- [x] Create docs folder

### Core Domain Modeling

- [x] Define Player type
- [x] Define RankingEntry type
- [x] Define DraftPick type
- [x] Define Draft type
- [x] Define Team type
- [ ] Define UserRoster type
- [x] Define Recommendation type

### Rankings System

- [x] Create seed rankings dataset
- [x] Load rankings into application state
- [x] Render available players table
- [x] Add position filtering
- [x] Add ranking sorting

### Draft Engine

- [x] Generate snake draft order
- [x] Track current pick
- [x] Track current round
- [x] Track active drafting team
- [x] Mark drafted players unavailable

### Manual Pick Entry

- [x] Build player search
- [x] Draft selected player
- [x] Advance draft state
- [x] Add undo functionality

### User Roster

- [x] Detect user picks
- [x] Add player to roster
- [x] Display roster slots
- [x] Display positional counts
- [ ] Detect overfilled positions

### Recommendation Engine V1

- [x] Add ranking score
- [x] Add roster need modifier
- [ ] Add scarcity modifier
- [x] Add tier-drop modifier
- [x] Generate top 5 recommendations
- [x] Generate recommendation explanations

### Recommendation UI

- [x] Display recommendations
- [x] Display recommendation reasons
- [x] Display tier warnings
- [ ] Display scarcity warnings
- [ ] Highlight user pick

---

## Validation Checklist

Before Vertical Slice 1 is complete:

- [ ] Complete full mock draft
- [ ] Verify drafted players disappear
- [ ] Verify roster tracking
- [ ] Verify recommendation updates
- [ ] Verify snake draft logic
- [ ] Verify undo functionality
- [ ] Verify no duplicate drafted players

---

## Backlog

Not required for MVP:

- Keyboard shortcuts
- Improved search UX
- Player notes
- Watchlist
- Player queue
- Draft recap grading
- ADP comparison
- Historical draft testing

See `future_ideas.md` for additional ideas.

---

## Completed

Move finished work here as development progresses.
