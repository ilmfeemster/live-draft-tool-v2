# Current Slice: Normalize Recommendation Ranking Context

## Completion Status

Complete. Added the normalized recommendation-ranking context types, pure snapshot normalizer, structured validation failures, neutral overall-tier fallback, and nullable ADP preservation. Focused validation passed with 1 test file and 19 tests, TypeScript passed, and lint passed with only the previously recorded unrelated `stripLocations` unused-helper warning.

## Goal

Create the pure Phase 5.5 boundary that converts one immutable ranking snapshot into normalized recommendation facts containing nullable ADP and an explicit overall tier, without changing recommendation scoring or workflow behavior.

## Scope

### Goals

- Define a recommendation-ranking context that carries each canonical ranking entry with:
  - nullable `adpRank` from the snapshot;
  - a positive `overallTier`;
  - an `overallTierOrigin` of `source` or `defaulted-neutral`.
- Normalize complete `source-overall` tier metadata into player-aligned recommendation facts.
- Materialize overall tier `1` with `defaulted-neutral` origin for every player when source tiers are absent, explicitly `none`, or legacy-ambiguous.
- Preserve complete, partial, and entirely absent ADP without treating null as an error.
- Reject malformed supplied ADP and partial, malformed, contradictory, or entry-mismatched `source-overall` tiers through structured failures.
- Keep overall/source tiers separate from the existing position-local `RankingEntry.tier` value.
- Produce deterministic output without mutating the source snapshot.

### Non-Goals

- Do not change `RecommendationInput` or any recommendation scoring function.
- Do not add overall-tier or ADP score components, caps, evidence, or reasons.
- Do not propagate snapshot metadata through draft, Draft Room, transient-session, or replay workflows.
- Do not change ranking import, ranking-set validation, persistence, snapshot serialization, or scenario formats.
- Do not infer ADP values, tier boundaries, or position tiers.
- Do not add UI, dependencies, database changes, or a generic signal framework.

## Implementation Decisions

- Add the recommendation-context domain types beside the existing recommendation types in `src/types/draft.ts`; do not make `draft.ts` depend on ranking snapshot or persistence types.
- Add a pure normalizer in `src/lib/recommendationRankingContext.ts` that accepts a typed `RankingSnapshot` and returns a success-or-structured-failure result.
- Keep `RankingEntry.adpRank` nullable in the normalized context. Validate a supplied value as positive and finite, but assign no fallback value when it is null.
- Treat these snapshot states as one neutral overall tier:
  - missing `tierSemantics`;
  - source kind `none`;
  - source kind `legacy-ambiguous`.
- For source kind `source-overall`, require exactly one valid source-tier record for every ranking entry. Match records by player identity and verify their recorded overall ranks.
- Validate source-overall tiers as positive integers that do not decrease in canonical overall-rank order. Preserve label gaps without assigning magnitude to them.
- Return structured errors with a stable code, path, and message. Use these codes:
  - `invalid-adp`;
  - `partial-overall-tiers`;
  - `invalid-overall-tiers`;
  - `tier-entry-mismatch`.
- Accumulate independent validation errors when safe, but return no partial context if any error exists.
- Preserve the existing position-local `tier` value unchanged inside each canonical ranking entry. Never use it as the overall-tier fallback.
- Return rankings in canonical snapshot order with a readonly context boundary and no mutation of nested player values.

## Implementation Steps

1. Define the normalized context contracts.

   In `src/types/draft.ts`:

   - add the `source | defaulted-neutral` overall-tier origin type;
   - add the recommendation-ranking fact type that pairs one existing canonical ranking entry with `overallTier` and `overallTierOrigin`;
   - add the readonly recommendation-ranking context type;
   - keep these types independent of `RankingSnapshot`, repositories, Prisma, React, and import contracts;
   - do not alter existing recommendation output types or make ADP non-null.

2. Implement pure context normalization.

   Create `src/lib/recommendationRankingContext.ts`:

   - define the four structured failure codes and the success/failure result union;
   - accept one `RankingSnapshot` and validate all non-null ADP values defensively;
   - use the neutral all-one tier context for missing, `none`, and legacy-ambiguous source semantics;
   - for `source-overall` semantics, validate complete one-to-one coverage, player IDs, recorded overall ranks, positive integer tiers, and non-decreasing tier order;
   - reject duplicate, missing, unknown, malformed, or contradictory source-tier records without returning a partial context;
   - preserve canonical snapshot order, nullable ADP, canonical position-local tiers, and tier-label gaps;
   - avoid mutating the snapshot, ranking entries, players, or tier metadata.

3. Add focused normalization tests.

   Create `src/lib/recommendationRankingContext.test.ts` with behavior-based coverage for:

   - a complete source-overall snapshot producing exact player-to-overall-tier facts with `source` origin;
   - missing, `none`, and legacy-ambiguous source semantics producing all-one `defaulted-neutral` facts;
   - complete, partial, and entirely absent ADP remaining valid with null preserved exactly;
   - malformed non-null ADP returning `invalid-adp`;
   - missing and duplicate source-tier coverage returning `partial-overall-tiers`;
   - unknown player IDs or recorded-rank mismatches returning `tier-entry-mismatch`;
   - non-positive, non-integer, or decreasing tiers returning `invalid-overall-tiers`;
   - non-contiguous valid tier labels being preserved;
   - existing position-local `RankingEntry.tier` values remaining unchanged and never becoming overall tiers;
   - repeated normalization producing exact deterministic output;
   - source snapshot objects remaining unchanged after success and failure.

4. Run focused validation.

   Run:

   ```text
   npm test -- src/lib/recommendationRankingContext.test.ts
   npx tsc --noEmit
   npm run lint
   ```

   Accept only already-recorded unrelated warnings if they remain unchanged. Do not run manual QA because this slice exposes no user-facing behavior.

5. Record completion only after validation passes.

   - Update this file with the validation result.
   - Mark only Task 1 complete in `docs/tasks.md`.
   - Stop without beginning snapshot propagation or scoring work.

## Expected Files

Production:

- `src/types/draft.ts`
- `src/lib/recommendationRankingContext.ts`

Focused tests:

- `src/lib/recommendationRankingContext.test.ts`

Planning and completion tracking:

- `docs/current-slice.md`
- `docs/tasks.md` only after the slice passes validation

Do not touch recommendation scoring, components, draft workflows, repositories, Prisma, imports, snapshots, scenarios, UI, package dependencies, project scope, architecture, or roadmap documents.

## Acceptance Criteria

- Complete valid source-overall metadata produces exact normalized overall tiers with `source` origin.
- Missing, `none`, and legacy-ambiguous source semantics produce overall tier `1` with `defaulted-neutral` origin for every player.
- Complete, partial, and absent ADP remain valid; every null ADP stays null.
- A ranking context with no ADP is normalized successfully.
- Malformed supplied ADP returns a structured `invalid-adp` failure.
- Partial, malformed, contradictory, duplicated, or entry-mismatched source-overall metadata returns structured failure and no partial context.
- Valid source tier gaps are preserved, while decreasing tiers are rejected.
- The existing position-local `RankingEntry.tier` value remains unchanged and semantically separate.
- Normalization is deterministic and does not mutate its snapshot input.
- No recommendation score, ordering, reason, draft workflow, persistence behavior, or scenario behavior changes.
- Focused tests, TypeScript, and lint pass with only explicitly recorded pre-existing warnings.

## Failure Handling

- If current `RankingSnapshot` types cannot distinguish absent, source-overall, and legacy-ambiguous semantics, stop and report the mismatch rather than changing snapshot persistence in this slice.
- If valid persisted snapshots can contain partially supplied source-overall metadata by approved Phase 5 rules, report the compatibility conflict before choosing a silent fallback or widening this slice.
- If the proposed context type creates a circular dependency between draft and ranking types, keep snapshot-specific input at the normalizer boundary and report before moving persistence types into `draft.ts`.
- If focused validation exposes unrelated failures, report them without modifying out-of-scope code or weakening tests.

## Follow-Up

After this slice passes, the next slice should promote Task 2: preserve ranking snapshot context through new, persisted, and transient draft workflows. Do not begin Task 2 automatically.

## Slice Review

- Smallest meaningful increment: yes. It establishes the one pure boundary required before either new recommendation signal can be implemented.
- Executable by a lower-reasoning pass: yes. The input, output, fallback states, failure codes, validation rules, expected files, and tests are explicit.
- Avoids unnecessary architecture changes: yes. It adds a small typed domain view and pure normalizer without changing persistence, workflow ownership, or scoring.
- Blast radius reasonable: yes. Implementation is limited to two production files and one focused test file, plus completion tracking.
- Review/revert comfort: yes. No existing runtime caller changes behavior in this slice.
- Observable/testable acceptance criteria: yes. Every normalization, fallback, failure, determinism, and non-mutation rule has direct automated coverage.
