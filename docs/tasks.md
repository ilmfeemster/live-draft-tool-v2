# Tasks

## Current Focus

Phase 2: Persistence is complete.

The active next phase has not been selected yet. Completed Phase 1 and Phase 2 task history has been moved to `docs/completed-tasks.md`.

---

## Phase 2 Completion Summary

Phase 2 turned the in-memory manual draft simulator into a durable draft workspace. Draft setup, league settings, ranking snapshots, and pick history now survive refreshes and application restarts.

Success criteria completed:

- A user can create or load a persisted draft.
- A user can continue entering manual picks from persisted state.
- Available players, roster, and recommendations are derived correctly after reload.
- Draft history supports resume, new draft creation, compact completed-draft organization, and safe deletion.
- Persistence remains beneath the Draft State Engine.
- Raw ranking JSON stays behind repository and mapper boundaries.
- Persistence and hydration do not hard-code MVP league defaults.

---

## Next Tasks

No active tasks are currently defined.

Before starting the next implementation slice:

- Choose the next product phase or maintenance priority.
- Promote only the smallest meaningful increment into `docs/current-slice.md`.
- Add new active tasks here instead of re-expanding completed Phase 1 or Phase 2 history.

---

## Testing Status

Phase 1 testing is complete for the manual draft simulator scope. Automated coverage includes draft order, draft state transitions, invariants, recommendation updates, small workflow integration, full small-draft completion, undo after completion, and recommendation modifier behavior. Manual QA coverage is captured in `docs/manual-full-draft-qa.md`.

Phase 2 persistence validation is complete. Completed validation history is archived in `docs/completed-tasks.md`.

Future testing should be selected from the next active product slice.

---

## Backlog

Not required for Phase 2:

- Authentication
- Multi-user support
- Custom league settings UI
- Custom draft naming and renaming
- Normalized ranking tables
- Global player table
- Replay tooling
- Live provider integrations
- Keyboard shortcuts
- Improved search UX
- Player notes
- Watchlist
- Player queue
- Draft recap grading
- ADP comparison
- Historical draft analysis

See `future_ideas.md` for additional ideas.
