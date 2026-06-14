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
- [ ] Define DraftPick type
- [ ] Define Draft type
- [ ] Define Team type
- [ ] Define UserRoster type
- [ ] Define Recommendation type

### Rankings System

- [x] Create seed rankings dataset
- [x] Load rankings into application state
- [x] Render available players table
- [x] Add position filtering
- [x] Add ranking sorting

### Draft Engine

- [ ] Generate snake draft order
- [ ] Track current pick
- [ ] Track current round
- [ ] Track active drafting team
- [ ] Mark drafted players unavailable

### Manual Pick Entry

- [ ] Build player search
- [ ] Draft selected player
- [ ] Advance draft state
- [ ] Add undo functionality

### User Roster

- [ ] Detect user picks
- [ ] Add player to roster
- [ ] Display roster slots
- [ ] Display positional counts
- [ ] Detect overfilled positions

### Recommendation Engine V1

- [ ] Add ranking score
- [ ] Add roster need modifier
- [ ] Add scarcity modifier
- [ ] Add tier-drop modifier
- [ ] Generate top 5 recommendations
- [ ] Generate recommendation explanations

### Recommendation UI

- [ ] Display recommendations
- [ ] Display recommendation reasons
- [ ] Display tier warnings
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
