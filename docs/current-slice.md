# Current Slice: Real Draft Defaults

## Goal

Prepare the app for practical draft use by making the default draft match the documented MVP league settings.

The project docs define a 12-team redraft snake league with 16 roster spots. The app currently seeds a 4-team draft, which is useful for fast testing but no longer matches the intended MVP usage.

## User-Visible Increment

When the app loads, the draft status and snake order should reflect a 12-team, 16-round draft instead of a 4-team test draft.

The user should still be able to:

- Draft players manually.
- Undo picks.
- See available players update.
- See their roster update.
- See recommendations update.

## Goals

- Change the default draft from 4 teams to 12 teams.
- Keep the draft at 16 rounds.
- Keep the current static default draft approach.
- Keep the current user draft position as a simple constant for now.
- Preserve existing snake draft generation behavior.
- Preserve existing draft, undo, roster, available-player, and recommendation behavior.
- Keep the change small enough to review and revert comfortably.

## Non-Goals

- Draft setup form.
- Runtime draft-position selection.
- Runtime team-count selection.
- Runtime rankings import.
- Persistence.
- Database work.
- Recommendation scoring changes.
- UI redesign.
- New state management.
- New dependencies.

## Expected Files

- `src/data/defaultDraft.ts`
- `docs/current-slice.md`

Avoid changing recommendation logic, draft order helpers, UI components, seed rankings, or task docs unless implementation reveals a direct compatibility issue.

## Implementation Constraint

Keep this as a static configuration update.

Do not add:

- Forms.
- Context.
- Reducers.
- Global state.
- API routes.
- Server actions.
- Package dependencies.
- New UI components.

## Draft Defaults

Use the documented MVP defaults:

```txt
teamCount = 12
rounds = 16
```

Keep the existing `userDraftPosition` constant for this slice.

If the existing `userDraftPosition` is within the 12-team range, leave it unchanged. If implementation reveals it is invalid, set it to a valid draft position and note that in the final summary.

## Implementation Steps

1. Update `src/data/defaultDraft.ts`.
   - Change `teamCount` from `4` to `12`.
   - Leave `rounds` as `16`.
   - Leave `userDraftPosition` unchanged if valid.
   - Ensure `createDraftTeams(teamCount)` still receives the updated team count.
   - Ensure `generateSnakeDraftOrder(teamCount, rounds)` still receives the updated team count and rounds.

2. Validate draft shape with a quick local check.
   - `defaultDraft.teamCount` is `12`.
   - `defaultDraft.rounds` is `16`.
   - `defaultDraft.teams.length` is `12`.
   - `defaultDraft.picks.length` is `192`.
   - `defaultDraft.userTeamId` points to an existing team.

3. Run validation.
   - Run `npm run lint`.
   - Run `npm run build`.

4. Manual smoke test.
   - Load the app.
   - Confirm the draft status says a 12-team draft.
   - Draft a player.
   - Confirm available players update.
   - Confirm recommendations update.
   - Undo the pick.
   - Confirm the player returns to the available pool.

## Acceptance Criteria

- The default draft uses 12 teams.
- The default draft uses 16 rounds.
- The generated team list contains 12 teams.
- The generated pick list contains 192 picks.
- The user's default team exists in the generated team list.
- Draft status displays the 12-team draft correctly.
- Manual draft entry still works.
- Undo still works.
- Available players still update after draft and undo.
- User roster still updates for user picks.
- Recommendations still render and update.
- `npm run lint` passes.
- `npm run build` passes.

## Manual Test Notes

This slice intentionally keeps draft setup static. A full setup flow would be useful later, but it is not required before using the tool personally.

The useful mental model for this slice:

```txt
"Make the default draft match the real league shape"
```

not:

```txt
"Build draft setup"
```

## Slice Review

- Smallest meaningful increment: yes, it changes only the default draft configuration to match MVP settings.
- Concrete enough for implementation: yes, the exact constants and validation checks are specified.
- Avoids unnecessary architecture changes: yes, it keeps the static default draft approach.
- Blast radius reasonable: yes, expected changes are one config/data file and this plan doc.
- Review/revert comfort: yes, the change is easy to inspect and revert.
- Observable/testable acceptance criteria: yes, team count, pick count, UI status, draft, undo, and build checks are directly observable.
