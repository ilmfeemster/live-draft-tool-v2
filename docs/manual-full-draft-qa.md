# Manual Full-Draft QA Checklist

## Purpose

Validate that the Phase 1 MVP manual draft workflow can complete a full 12-team, 16-round snake draft without breaking core draft behavior.

This checklist is for manual QA. It records whether the current app can start a draft, enter picks, update available players, update the user roster, update recommendations, undo picks, prevent duplicate picks, and reach draft completion.

## Preconditions

- [x] Local dependencies are installed.
- [x] The app is running locally with `npm run dev`.
- [x] The browser is opened to the local app URL shown by the dev server.
- [x] The run starts from a fresh page state when practical.
- [x] The current seed rankings or current default app data are used.
- [x] No production source changes are made during the QA run.

## Evidence To Record

- Date:
- Commit or branch:
- Browser:
- App URL:
- Overall result: Pass / Fail
- Tester:
- Notes for failed or unclear steps:

## Checklist

### Setup And Initial State

- [x] Open the draft tool in the browser.
- [x] Confirm the draft is configured for 12 teams.
- [x] Confirm the draft is configured for 16 rounds.
- [x] Confirm the draft uses snake draft ordering.
- [x] Confirm the initial active pick is pick 1.
- [x] Confirm the available player list is visible.
- [x] Confirm recommendations are visible before any pick is made.
- [x] Confirm the user roster area is visible.

### Early Draft Picks

- [x] Draft an available player at pick 1.
- [x] Confirm the active pick advances to pick 2.
- [x] Draft an available player at pick 2.
- [x] Confirm the active pick advances to pick 3.
- [x] Draft at least three more available players.
- [x] Confirm each valid pick advances the active pick by exactly one.
- [x] Confirm the displayed round and pick context remain consistent with snake draft order.

### Available Player And Duplicate Behavior

- [x] After drafting a player, confirm that player no longer appears in the available player list.
- [x] Search or filter for a drafted player.
- [x] Confirm the drafted player cannot be selected again from the available player list.
- [x] Attempt a duplicate pick if the UI exposes a path to do so.
- [x] Confirm the app blocks or prevents the duplicate pick.
- [x] Confirm the active pick does not advance because of a duplicate-pick attempt.

### User Roster Behavior

- [x] Continue drafting until the user team makes its first pick.
- [x] Confirm the drafted player appears on the user roster.
- [x] Confirm the roster position count updates for that player's position.
- [x] Continue until the user team has at least two rostered players.
- [x] Confirm each user-team pick appears exactly once on the roster.
- [x] Confirm non-user-team picks do not appear on the user roster.

### Recommendation Behavior

- [x] Record the top recommendation before an early pick.
- [x] Draft a player from the available pool.
- [x] Confirm recommendations update after the pick.
- [x] If the drafted player was previously recommended, confirm that player is removed from the recommendation list.
- [x] Confirm recommendation reasons still appear after picks are entered.
- [x] Confirm recommendations only include players who remain available.

### Undo Behavior

- [x] Record the current active pick and most recent drafted player.
- [x] Use undo once.
- [x] Confirm the active pick returns to the undone pick number.
- [x] Confirm the undone player returns to the available player list.
- [x] Confirm the undone player is removed from the draft board or current pick record.
- [x] If the undone player belonged to the user team, confirm the player is removed from the user roster.
- [x] Confirm recommendations update after undo.
- [x] Re-draft a valid player into the restored pick.
- [x] Confirm the draft advances normally after re-drafting.

### Full Draft Completion

- [x] Continue entering valid picks through the final pick.
- [x] Confirm the draft reaches pick 192 for a 12-team, 16-round draft.
- [x] Confirm every pick has exactly one drafted player.
- [x] Confirm the final drafted-player count is 192.
- [x] Confirm drafted players do not appear in the available player list.
- [x] Confirm recommendation results do not include drafted players.
- [x] Confirm the app does not crash, freeze, or lose draft state during completion.
- [x] Confirm extra picks are blocked or unavailable after the draft is complete.

## Pass/Fail Summary

- Overall result: Pass / Fail
- Blocking issues:
- Non-blocking issues:
- Follow-up task links or notes:
- Manual QA completed by:
- Manual QA completed on:

## Notes

- Use this checklist to validate the workflow, not visual polish.
- If a step is ambiguous because the app does not expose a specific label or control, record the ambiguity in the notes instead of changing the app during the QA run.
- If a failure appears to be a product bug, record the exact step, observed result, expected result, and any relevant player or pick number.
