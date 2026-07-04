# Current Slice — Task 12B: Preserve Authoritative Tier Semantics Through Workspace State

## Status

Planned. Not yet implemented.

## Goal

Carry authoritative `RankingTierSemantics` alongside canonical rankings through persisted draft workspace hydration and transient-session state so the final workbench slice can export Scenario V2 without reconstructing or inferring tier meaning.

This is the second of three Task 12 slices. Task 12A completed version-aware replay/import. This slice changes state propagation only. Task 12C will connect the preserved semantics to Draft Room props and version-aware workbench import/export.

## Current Constraint

- Persisted snapshot parsing already materializes validated V2-equivalent `tierSemantics`, but `mapDraftRecordToWorkspace` drops them after creating normalized recommendation context.
- `DraftWorkspace` therefore exposes canonical rankings and normalized recommendation facts but not the authoritative distinction between recommendation tiers and overall/source tiers.
- Transient V1 sessions retain normalized context but not an explicit portable tier-semantics value that can be carried through restart and later exported as Scenario V2.
- Reconstructing recommendation-tier eligibility from numeric `tier` values or overall tiers from recommendation facts would violate the approved tier-semantics boundary.

## Scope

### Goals

- Add an optional `rankingTierSemantics` field to `DraftWorkspace` for compatibility with existing test/workflow constructors.
- Populate that field for every persisted workspace mapped from a ranking snapshot.
- Preserve the exact validated source and recommendation semantics from V2 snapshot envelopes.
- Preserve the materialized legacy-ambiguous/neutral semantics produced for historical array-only snapshots.
- Add required `rankingTierSemantics` ownership to transient session core state.
- Materialize explicit V1-compatible semantics for transient Scenario V1 sessions:
  - source kind `none` with no source values;
  - `neutral` recommendation semantics for every represented position.
- Use the same transient tier-semantics value to build normalized recommendation context and to generate recommendations.
- Preserve semantics through accepted pick, rejected pick, undo, reset, restart, and dirty-state transitions without mutation or reconstruction.
- Keep semantics independent of mutable ranking-set identity and provenance.

### Non-goals

- Do not change scenario replay/import APIs completed in Task 12A.
- Do not import Scenario V2 into transient sessions yet; Task 12C owns switching the workbench to version-aware import.
- Do not add Draft Room props, page wiring, Scenario V2 workspace export, serializer selection, download behavior, or replay-target UI changes; those belong to Task 12C.
- Do not make `rankingTierSemantics` mandatory on every historical `DraftWorkspace` test fixture or repository collaborator in this slice.
- Do not infer recommendation-tier eligibility from numeric `tier` values.
- Do not infer overall/source tiers from recommendation tiers or normalized recommendation facts.
- Do not alter ranking snapshot parsing, tier validation, forecast behavior, scoring, reasons, draft transitions, persistence schema, or database records.

## Implementation Steps

1. Extend `DraftWorkspace` in `src/types/draft.ts` with `rankingTierSemantics?: RankingTierSemantics`. Keep it optional as a compatibility boundary; live persisted mapping must populate it, while older in-memory test collaborators remain valid until explicitly upgraded.
2. Update `mapDraftRecordToWorkspace` in `src/lib/draftRepositoryMapping.ts` to return the parsed snapshot’s validated `tierSemantics` alongside rankings and `recommendationRankingContextResult`. Do not expose ranking-set ID/name, capabilities, or capture timestamps.
3. Extend `src/lib/draftRepositoryMapping.test.ts` to prove:
   - complete source-overall values and recommendation semantics survive mapping exactly;
   - explicitly eligible recommendation-position semantics remain distinct from source semantics;
   - historical array-only snapshots expose their materialized `legacy-ambiguous` source semantics and neutral recommendation semantics;
   - `none` and legacy source kinds remain neutral for overall-tier normalization;
   - mapped semantics are fresh and persisted input is not mutated;
   - structured normalized-context failures do not discard the authoritative tier semantics.
4. Add required `rankingTierSemantics: RankingTierSemantics` to `TransientSessionCore` in `src/lib/scenarioSession.ts`.
5. When creating a current Scenario V1 transient session, derive explicit V1 portable semantics from the already-neutralized imported rankings: source kind `none`, no source values, and neutral recommendation semantics for each represented position. Pass this same value into `createRecommendationRankingContext`.
6. Retain the field unchanged through `updateTransientSessionDraft`, rejected no-op transitions, undo, and generic spread-based updates. Explicitly copy it into `restartTransientSession`; reset continues to reparse source JSON and recreate clean semantics rather than trusting cached values.
7. Update `src/lib/scenarioSession.test.ts` to assert exact semantics at initial load, identity preservation through pick/undo/restart, clean recreation on reset after cached corruption, stable neutral behavior across represented positions, no mutation, and recommendation equality using the session’s rankings plus retained semantics.
8. Run focused workspace mapping, repository, transient-session, recommendation-context, and Scenario V1 compatibility tests, followed by TypeScript validation, lint, and `git diff --check`.
9. After validation, add completion notes to this file. Do not mark Task 12 complete in `docs/tasks.md`; Task 12C workbench integration remains.

## Expected Files

- `src/types/draft.ts`
- `src/lib/draftRepositoryMapping.ts`
- `src/lib/draftRepositoryMapping.test.ts`
- `src/lib/scenarioSession.ts`
- `src/lib/scenarioSession.test.ts`
- `docs/current-slice.md` for completion notes after validation

Expected blast radius: five implementation/test files plus this active-slice status update.

## Acceptance Criteria

- Every workspace produced by persisted snapshot mapping exposes the snapshot’s authoritative `RankingTierSemantics` separately from normalized recommendation facts.
- A V2 snapshot with source-overall tiers preserves every source value exactly and keeps recommendation-tier semantics distinct.
- A historical array-only snapshot exposes materialized legacy-ambiguous source semantics and neutral recommendation semantics without activating overall-tier or position-tier pressure.
- A structured recommendation-context failure does not erase or replace otherwise parsed authoritative tier semantics.
- Every transient session owns explicit tier semantics consistent with the rankings used for its normalized context and recommendations.
- Current Scenario V1 sessions use source kind `none`, no source values, and neutral recommendation semantics for all represented positions.
- Pick, rejected pick, undo, restart, and other local transient transitions retain the same immutable semantics value; reset recreates equivalent fresh semantics from source JSON.
- No semantics are reconstructed from numeric tiers, normalized overall-tier facts, ranking-set identity, or provenance.
- Existing draft invariants, recommendation output, transient dirty-state behavior, persistence mapping, and Scenario V1 compatibility remain unchanged.
- Focused tests, TypeScript validation, and lint pass without new warnings.

## Failure Conditions

Stop and report instead of broadening the slice if:

- authoritative persisted semantics cannot be exposed without changing the database schema or stored snapshot contract;
- transient V1 semantics require interpreting legacy `tier` values rather than explicitly neutralizing them;
- state propagation requires changing Draft Room, workbench, or Scenario V2 import/export behavior before Task 12C;
- implementation requires weakening snapshot or recommendation-context validation;
- validation fails for an issue unrelated to this slice.

## Validation Commands

```powershell
npm test -- src/lib/draftRepositoryMapping.test.ts src/lib/draftRepository.test.ts src/lib/scenarioSession.test.ts src/lib/recommendationRankingContext.test.ts src/lib/scenarioPortability.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

The existing unrelated lint warning in `src/lib/rankingNormalizer.test.ts` may remain, but this slice must introduce no new warnings.

## Follow-up

Plan Task 12C to require the preserved semantics at the live Draft Room boundary, switch workbench import/reset/replay-target flows to version-aware Scenario V1/V2 APIs, export Scenario V2 from persisted and transient sessions, and prove export/import independence from the original ranking set and derived recommendation output.

## Slice Review

1. Smallest meaningful increment: yes — it closes the authoritative state-ownership gap without mixing in UI or export behavior.
2. Executable without redefining the approach: yes — field ownership, V1 materialization, transition behavior, compatibility handling, tests, and deferred boundaries are explicit.
3. Avoids unnecessary architecture changes: yes — it carries an existing validated domain value and adds no persistence, registry, or reconstruction abstraction.
4. Reasonable blast radius: yes — five implementation/test files plus active-slice completion notes.
5. Comfortably reviewable and revertible: yes — propagation is additive and isolated from replay, UI, serialization, and scoring.
6. Observable and testable acceptance criteria: yes — exact semantics, reference preservation, reset recreation, context consistency, and regression output are directly assertable.
