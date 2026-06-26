# Current Slice: Use Distinguishable Automatic Draft Names

## Source Task

Task 10: Use Distinguishable Automatic Draft Names.

## Goal

Make newly created persisted drafts easy to tell apart without adding user-entered names, renaming, draft templates, or a broader draft management screen.

This slice fixes the immediate product friction created by multiple drafts named `New Draft` or `Default Draft`. Future naming and renaming can become a real product feature later, but Phase 2 only needs automatic names that make history readable.

## User-Visible Increment

- Newly created drafts show a date/time-based name in draft history.
- The first auto-created draft and later `Start New Draft` drafts use the same naming pattern.
- Existing drafts with old names still render normally.

## Problem

The app can now create multiple persisted drafts, but the name field does not help the user distinguish them. The initial workspace uses `Default Draft`, and every new draft created through the explicit action uses `New Draft`. Once several drafts exist, draft history becomes ambiguous.

## Goals

- Add one shared helper for automatic draft display names.
- Use the helper in both creation paths:
  - `loadDraftWorkspace` fallback creation
  - `createNewDraftAction`
- Format names with local creation date and time, using a simple pattern such as `Draft - Jun 26, 2026, 5:42 PM`.
- Keep the format deterministic and covered by focused tests.
- Preserve existing create, load, resume, draft, undo, reset, recommendation, and history behavior.
- Update task tracking after implementation.

## Non-Goals

- User-entered draft names.
- Draft renaming.
- Draft templates.
- League-specific naming.
- Draft deletion.
- Draft history layout changes.
- Backfilling or migrating existing draft names.
- Prisma schema or migration changes.
- New package dependencies.

## Expected Files

- `src/lib/draftNames.ts`
- `src/lib/draftNames.test.ts`
- `src/lib/draftWorkspaceLoader.ts`
- `src/lib/draftWorkspaceLoader.test.ts`
- `src/app/actions/draftActions.ts`
- `src/app/actions/draftActions.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md`

Avoid changing repository APIs, Prisma schema, route structure, draft history layout, recommendation logic, ranking seed data, or unrelated UI behavior unless implementation reveals a real blocker.

## Naming Helper Shape

Add a small helper in `src/lib/draftNames.ts`:

```ts
export function formatAutomaticDraftName(createdAt = new Date()): string
```

Expected behavior:

- Return a string beginning with `Draft - `.
- Include month abbreviation, day, year, hour, and minute.
- Use local time components.
- Use 12-hour time with `AM`/`PM`.
- Zero-pad minutes.

Example:

```ts
formatAutomaticDraftName(new Date(2026, 5, 26, 17, 42))
// "Draft - Jun 26, 2026, 5:42 PM"
```

Keep this helper presentation-focused and dependency-free. Do not introduce a date library.

## Implementation Steps

1. Add the naming helper.
   - Create `src/lib/draftNames.ts`.
   - Add `formatAutomaticDraftName(createdAt = new Date())`.
   - Use a local month abbreviation array and local `Date` getters.
   - Handle midnight/noon correctly:
     - `0` hours should display as `12:xx AM`.
     - `12` hours should display as `12:xx PM`.
     - `13` hours should display as `1:xx PM`.

2. Test the helper.
   - Create `src/lib/draftNames.test.ts`.
   - Add exact-output tests for:
     - afternoon time, e.g. `Draft - Jun 26, 2026, 5:42 PM`
     - midnight
     - noon
     - zero-padded minutes

3. Update default workspace creation.
   - In `src/lib/draftWorkspaceLoader.ts`, replace `defaultDraftName` with `formatAutomaticDraftName()`.
   - Keep the existing MVP default settings, seed rankings, and user team id unchanged.
   - Do not change load/fallback behavior.

4. Update loader tests.
   - In `src/lib/draftWorkspaceLoader.test.ts`, update tests that expect `Default Draft`.
   - Use fake timers or another deterministic approach so expected names are stable.
   - Assert the repository receives the automatic name while preserving existing expectations for league settings, rankings, and user team id.
   - Restore timers after tests if fake timers are used.

5. Update explicit new draft creation.
   - In `src/app/actions/draftActions.ts`, replace `"New Draft"` with `formatAutomaticDraftName()`.
   - Keep the action small and continue returning the created workspace.

6. Update action tests.
   - In `src/app/actions/draftActions.test.ts`, update the create action test to expect the automatic name.
   - Use the same deterministic clock strategy as the loader tests where practical.
   - Keep existing mutation tests unchanged.

7. Update task tracking.
   - In `docs/tasks.md`, mark Task 10 complete only if all acceptance criteria are satisfied.
   - Check `Use distinguishable automatic names for new persisted drafts` in the Phase 2 validation checklist if validated.
   - Do not mark unrelated Phase 2 validation items complete.

8. Validate.
   - Run `npm test`.
   - Run `npm run lint`.
   - Run `npm run build`.
   - If a dev server is already running or can be started locally, manually create a new draft and confirm draft history shows the generated date/time name.

## Acceptance Criteria

- Newly created persisted drafts no longer all appear as `New Draft`.
- Automatically created first drafts no longer rely on `Default Draft`.
- The fallback loader and explicit `Start New Draft` action use the same automatic naming helper.
- Draft names include enough date/time information to distinguish multiple new drafts.
- Existing persisted drafts with old names still render safely.
- Existing create, load, resume, draft, undo, reset, available-player, roster, and recommendation behavior still works.
- Focused tests cover the automatic naming helper.
- Existing loader and server-action tests cover automatic names at creation boundaries.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes or any environment-specific blocker is reported clearly.

## Manual Test Notes

Recommended manual checks after implementation:

- Start the app with no existing drafts and confirm the auto-created draft has a date/time name.
- Use `Start New Draft` and confirm the new draft has a date/time name.
- Create more than one new draft and confirm draft history names are distinguishable.
- Reopen an older draft named `Default Draft` or `New Draft`, if present, and confirm it still renders.
- Verify drafting, undo, reset, and resume still operate on the selected draft.

## Slice Review

- Smallest meaningful increment: yes, it addresses only automatic naming and leaves layout/deletion for later tasks.
- Concrete enough for implementation: yes, files, helper shape, expected format, tests, and validation are specified.
- Avoids unnecessary architecture changes: yes, it adds one small shared helper because two creation paths need the same rule.
- Blast radius reasonable: yes, expected changes are limited to one helper, two creation callers, their tests, and task tracking.
- Review/revert comfort: yes, the change can be reverted without schema, repository, or route changes.
- Observable/testable acceptance criteria: yes, created draft names can be asserted in tests and seen in draft history.
