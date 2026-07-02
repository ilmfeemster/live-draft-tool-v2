# Current Slice: Propagate Recommendation Context Through Draft Sessions

## Completion Status

Complete. Persisted workspace context is now required at the page-to-Draft Room boundary, Scenario V1 transient sessions receive deterministic defaulted-neutral overall-tier context with exact nullable ADP, and pick, undo, reset, replay-target recreation, and restart paths preserve or rebuild context as designed. Existing recommendation generation remains unchanged. Focused validation passed with 4 test files and 50 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Complete Task 2 by carrying persisted recommendation-context results into the Draft Room boundary and by giving Scenario V1 and restarted manual transient sessions their own deterministic defaulted-neutral context result.

The context remains transport state in this slice. Existing recommendation generation continues consuming canonical `RankingEntry[]` until the later scoring-integration task.

## Scope

### Goals

- Require the loaded persisted workspace's recommendation-context result at the page-to-Draft Room boundary.
- Fail clearly at the page boundary if a workspace implementation violates the persisted-mapping contract and omits the result.
- Add the context result to the Draft Room prop contract without consuming it in scoring yet.
- Add a recommendation-context result to every transient session.
- Build Scenario V1 transient context from its validated canonical rankings with no source-overall metadata, producing the documented all-one `defaulted-neutral` overall tiers.
- Preserve nullable ADP exactly in Scenario V1 transient context.
- Preserve the same context result through transient pick, undo, reset, replay-target replacement, and restart operations.
- Preserve all current persisted and transient recommendation output.

### Non-Goals

- Do not change `RecommendationInput`, `generatePlayerRecommendations`, score components, caps, ordering, evidence, or reasons.
- Do not use persisted or transient context to affect recommendations yet.
- Do not render normalization failures or new context UI.
- Do not add Scenario V2 or change Scenario V1 serialization, validation, import, export, or replay semantics.
- Do not preserve source-overall tiers in Scenario V1; its documented behavior remains one neutral overall tier.
- Do not change draft repository mapping, workspace loaders, actions, persistence, Prisma, ranking imports, or dependencies.
- Do not add preview scoring; Task 7 owns user-visible between-turn previews.

## Implementation Decisions

- Add a required `recommendationRankingContextResult` prop to `DraftRoomProps`.
- Keep the new Draft Room prop out of the function's destructured values until a later scoring slice consumes it. The required prop still establishes and type-checks the application boundary without introducing unused local state.
- In `src/app/page.tsx`, narrow the optional `DraftWorkspace` field before rendering:
  - throw a concise invariant error if the persisted workspace lacks the result;
  - pass either the success or structured-failure result to `DraftRoom` unchanged;
  - do not reinterpret or display failures.
- Add required `recommendationRankingContextResult` to `TransientSessionCore`.
- In `createTransientScenarioSession`, call the existing pure normalizer with a snapshot-shaped value containing only the validated Scenario V1 rankings.
  - Missing tier semantics intentionally materialize one defaulted-neutral overall tier.
  - Nullable ADP remains unchanged.
  - Scenario V1 validation remains authoritative for rejecting malformed ranking entries before session creation.
- Store the normalizer result without branching into a second transient-session failure mode; valid Scenario V1 inputs should normalize successfully under the neutral fallback.
- Preserve the result by object spread during pick and undo updates, copy it unchanged when restarting as a manual session, and recompute it from source JSON when resetting or changing replay target through `createTransientScenarioSession`.
- Do not alter current recommendation calls; they continue using `session.rankings` and existing inputs.

## Implementation Steps

1. Require persisted context at the page-to-Draft Room boundary.

   In `src/app/page.tsx`:

   - read `workspace.recommendationRankingContextResult` after workspace loading;
   - throw a clear invariant error if it is absent, because production persisted workspace mapping must always populate it;
   - pass the narrowed result to `DraftRoom` with the existing draft, rankings, and league settings;
   - do not inspect `ok`, change rendering, or block a structured `{ ok: false }` result.

   In `src/components/DraftRoom.tsx`:

   - add required `recommendationRankingContextResult` to `DraftRoomProps` using the shared domain result type;
   - accept the prop at the component boundary without feeding it into existing recommendation generation;
   - preserve every current persisted and transient behavior.

2. Give transient sessions normalized recommendation context.

   In `src/lib/scenarioSession.ts`:

   - add the shared result type to `TransientSessionCore`;
   - normalize imported Scenario V1 rankings with no source-tier metadata during `createTransientScenarioSession`;
   - store the result on the created scenario session;
   - preserve the result through accepted pick and undo operations via the existing session spread;
   - preserve it unchanged when `restartTransientSession` creates a manual session;
   - continue reparsing and renormalizing source JSON for reset and replay-target replacement paths;
   - leave `generateRecommendations` unchanged.

3. Update Draft Room boundary coverage.

   In `src/components/DraftRoom.test.tsx`:

   - create a deterministic context result for the persisted workspace fixture;
   - pass it through the required Draft Room prop;
   - retain exact recommendation ordering, score, reason, availability, and markup assertions;
   - confirm adding the prop produces no user-visible recommendation change.

4. Add transient-context lifecycle coverage.

   In `src/lib/scenarioSession.test.ts`:

   - assert a created Scenario V1 session has a successful context result;
   - assert every transient ranking receives overall tier `1` with `defaulted-neutral` origin;
   - assert nullable ADP values match the Scenario V1 rankings exactly;
   - assert accepted pick and undo operations preserve the same context result;
   - assert reset reparses an equivalent context result rather than trusting a corrupted cached value;
   - assert restart preserves the context result in the manual session;
   - retain existing recommendation parity, legacy recommendation-tier neutrality, confirmation, and no-persistence coverage.

5. Run focused validation.

   Run:

   ```text
   npm test -- src/components/DraftRoom.test.tsx src/lib/scenarioSession.test.ts src/lib/recommendationRankingContext.test.ts src/lib/draftRepositoryMapping.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Manual QA is not required because this slice intentionally produces no visible behavior change.

6. Record completion only after validation passes.

   - Update this file with the exact validation result.
   - Mark Task 2 complete in `docs/tasks.md`.
   - Stop without beginning Task 3 overall-tier scoring.

## Expected Files

Production:

- `src/app/page.tsx`
- `src/components/DraftRoom.tsx`
- `src/lib/scenarioSession.ts`

Focused tests:

- `src/components/DraftRoom.test.tsx`
- `src/lib/scenarioSession.test.ts`

Planning and completion tracking:

- `docs/current-slice.md`
- `docs/tasks.md` only after validation passes

Do not touch recommendation scoring, recommendation tests, repository mapping, workspace loaders, actions, ranking imports, snapshots, scenario contracts, Prisma, dependencies, project scope, architecture, roadmap, or future-ideas documents.

## Acceptance Criteria

- The page requires and passes the persisted workspace's success-or-failure context result to Draft Room.
- A missing persisted context result fails with a clear invariant error rather than silently defaulting at the page boundary.
- Draft Room accepts the result without changing current recommendation output or UI.
- Every valid Scenario V1 transient session has a successful recommendation-context result.
- Scenario V1 context uses overall tier `1` with `defaulted-neutral` origin for every ranking.
- Complete, partial, and absent Scenario V1 ADP remain exact nullable values in transient context.
- Accepted pick and undo operations preserve the context result.
- Reset and replay-target recreation derive context again from source JSON.
- Restarted manual sessions preserve the originating context result.
- Existing persisted and transient recommendation ordering, scores, reasons, draft invariants, reset, restart, replay-target, and confirmation behavior remain unchanged.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If production workspace loading can legitimately return a persisted workspace without `recommendationRankingContextResult`, stop and report rather than adding a second page-level fallback.
- If a validated Scenario V1 can produce a failed neutral context result, stop and report the validation mismatch rather than hiding the failure or fabricating context.
- If making the Draft Room prop required forces unrelated component redesign, retain the existing boundary and report before making the prop optional or introducing global state.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, Task 2 is complete. The next slice should promote Task 3: implement the pure overall-tier score component without integrating it into total recommendation scores. Do not begin Task 3 automatically.

## Slice Review

- Smallest meaningful increment: yes. It completes context propagation without mixing in any scoring or scenario-version changes.
- Executable by a lower-reasoning pass: yes. The exact prop, session field, normalization source, lifecycle behavior, files, and tests are specified.
- Avoids unnecessary architecture changes: yes. It reuses the persisted result, existing pure normalizer, component props, and transient-session lifecycle.
- Blast radius reasonable: yes. Runtime and test changes are limited to five files, plus completion tracking.
- Review/revert comfort: yes. The slice adds typed transport state while leaving recommendation behavior untouched.
- Observable/testable acceptance criteria: yes. Propagation, neutral fallback, ADP preservation, lifecycle behavior, and recommendation parity are directly testable.
