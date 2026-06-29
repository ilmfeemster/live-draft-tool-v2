# Current Slice: Add Pure Ranking Set Editing and Tier Operations

## Completion Status

Complete. Canonical ranking sets now support pure rename, player correction, single-player reorder, complete position-tier assignment, and individual source-tier update intents. Successful edits preserve local identity/source/creation metadata, own new nested values, update lifecycle and affected capabilities, derive canonical ranks, and pass whole-set validation; failed edits return structured errors without mutating the source set. Validation passed with 38 focused editing tests, 501 full-suite tests, TypeScript checking, and focused and repository-wide linting.

## Source Context

Phase 5 Tasks 1 through 8 are complete:

- canonical mutable `RankingSet` aggregates and immutable snapshot values are distinct domain concepts;
- canonical overall, position-rank, tier, ADP, identity, lifecycle, and capability invariants are enforced by `validateRankingSet`;
- supported imports cross preflight, parsing, normalization, complete-candidate validation, and canonical conversion boundaries;
- conversion creates complete domain-owned aggregates with local lifecycle identity;
- Canonical Ranking Set JSON V1 provides deterministic lossless portability;
- repository and application workflows have not yet been introduced for managed ranking sets.

This slice promotes Phase 5 Task 9 only. It adds pure in-memory authoring operations over a complete canonical `RankingSet`. Every operation proposes a new whole aggregate, recalculates derived values and affected capability metadata, and returns success only after canonical validation.

## Goal

Provide deterministic, immutable domain operations for renaming, player-field correction, overall reordering, complete position-tier assignment, and individual source-tier updates without exposing an intermediate invalid ranking set.

## Scope

### Goals

- Add one pure ranking-set edit entry point with explicit discriminated intents.
- Require an explicit update timestamp so editing remains deterministic and clock-free.
- Validate the source ranking set before applying any intent.
- Support rename without changing local identity, source provenance, creation time, entries, or capabilities.
- Support correction of player ID, name, team, position, and ADP.
- Preserve canonical overall order during player-field correction while recalculating all position ranks.
- Support deterministic movement of one player to a requested canonical overall rank.
- Recalculate contiguous overall and position ranks after a reorder.
- Mark manually changed overall order as `explicit`.
- Support complete tier assignment for exactly one represented position.
- Transition that position's tier capability to `source` after a complete valid assignment, including from `defaulted-neutral`.
- Support individual tier updates only for positions already marked `source`.
- Preserve meaningful tier gaps and reject position-local decreases.
- Recompute team and ADP availability capabilities from the complete proposed entries after relevant edits.
- Conservatively update identity capability after a player ID correction.
- Reconcile tier-capability keys when a position correction removes or introduces a represented position.
- Preserve local set identity, source provenance, creation time, and untouched canonical values.
- Assign a cloned update timestamp only on successful output.
- Validate the complete proposed aggregate with `validateRankingSet` before returning it.
- Return structured, path-aware domain failures without mutating the original set.
- Add focused coverage for every intent, capability transition, rank recalculation, failure mode, determinism, and ownership.
- Check Phase 5 Task 9 complete only after all validation passes.

### Non-Goals

- Persistence, transactions, repository name uniqueness, or concurrency control.
- Application workflows, server actions, forms, or UI.
- Editing immutable `RankingSnapshot` values or existing draft snapshots.
- Authoring history, undo/redo, revisions, audit logs, or optimistic locking.
- Merging ranking sets or reconciling identities across sources.
- Adding/removing players or changing ranking-set local identity.
- Changing source provenance after edits.
- Bulk arbitrary patch objects or JSON Patch.
- Moving multiple players in one reorder intent.
- Applying incomplete tier assignments to a defaulted position.
- Inferring strategic tier gaps or automatically repairing invalid requested tiers.
- Accepting parser, candidate, persistence, or UI representations.
- Adding dependencies or a generic command framework.

## Implementation Design

### Public API and Edit Intents

Add `src/lib/rankingSetEditing.ts` with:

```ts
type RenameRankingSetIntent = Readonly<{
  type: "rename";
  name: string;
}>;

type CorrectRankingPlayerIntent = Readonly<{
  type: "correct-player";
  playerId: string;
  changes: Readonly<{
    id?: string;
    name?: string;
    team?: string;
    position?: Position;
    adpRank?: number | null;
    tier?: number;
  }>;
}>;

type ReorderRankingPlayerIntent = Readonly<{
  type: "reorder-player";
  playerId: string;
  toOverallRank: number;
}>;

type AssignPositionTiersIntent = Readonly<{
  type: "assign-position-tiers";
  position: Position;
  assignments: readonly Readonly<{
    playerId: string;
    tier: number;
  }>[];
}>;

type UpdateRankingTierIntent = Readonly<{
  type: "update-tier";
  playerId: string;
  tier: number;
}>;

type RankingSetEditIntent =
  | RenameRankingSetIntent
  | CorrectRankingPlayerIntent
  | ReorderRankingPlayerIntent
  | AssignPositionTiersIntent
  | UpdateRankingTierIntent;

type RankingSetEditRequest = Readonly<{
  updatedAt: Date;
  intent: RankingSetEditIntent;
}>;

editRankingSet(
  rankingSet: RankingSet,
  request: RankingSetEditRequest,
): RankingSetEditResult
```

Keep edit request/result types beside the operation. Do not add authoring intents to canonical domain value types or import contracts.

`correct-player.changes.tier` is allowed only together with a position change. It provides an explicit tier for the corrected destination position instead of forcing a temporary invalid set. Standalone tier changes use the tier intents.

### Result and Error Contract

Define:

```ts
type RankingSetEditErrorCode =
  | "invalid-ranking-set"
  | "invalid-update-date"
  | "invalid-lifecycle-order"
  | "invalid-intent"
  | "player-not-found"
  | "invalid-player-correction"
  | "invalid-reorder"
  | "invalid-tier-assignment"
  | "invalid-tier-update"
  | "edit-invariant-failed";

type RankingSetEditError = Readonly<{
  code: RankingSetEditErrorCode;
  message: string;
  path?: string;
}>;

type RankingSetEditResult =
  | Readonly<{
      ok: true;
      rankingSet: RankingSet;
    }>
  | Readonly<{
      ok: false;
      errors: readonly RankingSetEditError[];
    }>;
```

Validate and report failures in this order:

1. source ranking-set canonical failures;
2. update timestamp shape and lifecycle order;
3. intent discriminator and intent-specific request shape;
4. target lookup/membership failures;
5. complete proposed-set invariant failures.

Map source domain failures to `invalid-ranking-set`. Map final `validateRankingSet` failures to `edit-invariant-failed`, preserving domain error order, message, and path. Return no proposed aggregate on failure.

The update timestamp must be a valid `Date` and must not be earlier than the original `updatedAt`. Equal timestamps are allowed for deterministic/idempotent callers. Do not read the clock.

### Immutable Proposal Construction

After request validation, copy the aggregate into newly owned values:

- preserve `id` exactly;
- preserve `source` fields and clone optional `source.importedAt`;
- clone capabilities and tier map;
- clone every entry and embedded player;
- clone `createdAt`;
- assign a clone of `request.updatedAt` to `updatedAt`.

Apply the intent only to the copied proposal. No path may mutate the original set or return an internally shared entry, player, capability map, source object, or `Date`.

After an intent changes entry order or position membership, run one shared canonical-rank derivation helper over the proposal entries:

1. preserve current array order;
2. assign `overallRank = index + 1`;
3. count positions in array order;
4. assign the next one-based `positionRank` for each position.

Do not sort by stale rank values after the requested order has been established.

### Rename

For `rename`:

- require `name` to be a non-empty string under the same domain rule;
- preserve the supplied value exactly rather than trimming silently;
- replace only the aggregate name and update timestamp;
- preserve identity, source, entries, ranks, tiers, and capabilities.

An empty or non-string runtime name is `invalid-intent` before domain validation.

### Player-Field Correction

For `correct-player`:

- locate exactly one current entry by `intent.playerId`;
- require a non-empty target ID;
- reject a missing target with `player-not-found` at `entries`;
- allow only `id`, `name`, `team`, `position`, `adpRank`, and conditional `tier` keys;
- require at least one supplied change;
- reject unknown runtime change keys;
- apply supplied values without coercion, trimming, or defaulting;
- preserve fields not explicitly changed;
- recalculate canonical position ranks after any position change;
- keep overall entry array order unchanged.

Tier rules for position correction:

- `changes.tier` without `changes.position` is `invalid-player-correction`;
- when position is unchanged, preserve the existing tier;
- when position changes and a tier is supplied, use it;
- when position changes without a tier, carry the existing tier and allow whole-set validation to decide whether it is valid in the destination sequence;
- if the destination position already exists, preserve its existing tier capability;
- if the destination position was previously absent, add `source` capability because the corrected canonical tier is now explicitly authored;
- if the source position becomes absent, remove its tier-capability key;
- a destination marked `defaulted-neutral` remains defaulted and therefore accepts only `NEUTRAL_TIER`; use complete assignment to transition it to source tiers.

After correction:

- recompute team availability from `team !== UNKNOWN_TEAM` across all entries;
- recompute ADP availability from `adpRank !== null` across all entries;
- preserve `overallOrder` because array order did not change;
- keep `positionRank` as `derived`;
- if player ID changed:
  - `provided` remains `provided`;
  - `mixed` remains `mixed` conservatively because per-entry provenance is not modeled;
  - `generated` becomes `provided` for a one-entry set, otherwise `mixed`;
- validate identity uniqueness and every other player/value invariant through final whole-set validation.

### Reorder One Player

For `reorder-player`:

- locate the target by current player ID;
- require `toOverallRank` to be an integer from 1 through the entry count;
- remove the target from its current array index and insert it at `toOverallRank - 1`;
- derive all canonical overall and position ranks from the new array order;
- set capability `overallOrder` to `explicit`;
- preserve tier values and every other entry value.

If the new order makes tiers decrease within a position, final whole-set validation rejects the edit. Do not renumber tiers or use original ranks as a tie breaker.

Moving a player to its current rank is valid and still returns a newly owned canonical set with the requested timestamp and `explicit` order capability.

### Complete Position-Tier Assignment

For `assign-position-tiers`:

- require a supported represented position;
- collect exactly the current players at that position in canonical order;
- require assignments to contain every and only those player IDs exactly once;
- reject duplicate, missing, foreign-position, and unknown player IDs;
- require every tier to be a positive integer;
- apply assignments by player ID without changing entry order;
- require assigned tiers to be non-decreasing in canonical position order;
- preserve meaningful positive gaps;
- set that position's tier capability to `source` only after the complete assignment is valid.

Assignment array order is not authoritative; player IDs determine application. Canonical entry order determines tier progression.

This is the only operation that transitions a represented position from `defaulted-neutral` to authored `source` tiers.

### Individual Tier Update

For `update-tier`:

- locate the target by player ID;
- require a positive integer tier;
- require the target position's capability to be `source`;
- reject updates to `defaulted-neutral` positions with `invalid-tier-update` and direct callers to complete position assignment;
- update only the target tier;
- preserve entry order and ranks;
- validate non-decreasing position-local progression through the final complete-set check.

Do not compress or renumber adjacent tiers.

### Capability Reconciliation

Use small pure helpers after intent application:

- team availability is `none` when every team is `UNKNOWN_TEAM`, `complete` when none are unknown, otherwise `partial`;
- ADP availability is `none` when every ADP is null, `complete` when none are null, otherwise `partial`;
- tier capability keys must exactly match represented positions;
- remove keys for positions no longer represented;
- preserve existing tier capability for positions that remain represented unless complete assignment changes its target to `source`;
- add `source` for a newly represented position introduced by explicit correction;
- position-rank capability remains `derived`;
- reorder changes overall-order capability to `explicit`;
- other intents preserve overall-order capability.

Do not recompute source provenance or treat manual edits as a new source kind. The design explicitly preserves source provenance across mutable authoring changes.

### Final Validation and Ownership

Call `validateRankingSet` on the complete proposal after all rank and capability updates.

On success, return the exact proposal reference accepted by the validator. On failure, map ordered errors to `edit-invariant-failed` and return no ranking set.

The operation is deterministic for deeply equal source values, requests, and timestamps. Every success returns a new aggregate, even for a semantic no-op. Every failure leaves the original aggregate unchanged.

Because the public function accepts `RankingSet`, a `RankingSnapshot` is not a valid typed input. A runtime snapshot-shaped value must fail source-set validation rather than being edited.

### Focused Tests

Add `src/lib/rankingSetEditing.test.ts` covering:

- valid rename preserving every non-name value and assigning a cloned update timestamp;
- empty and runtime-invalid rename rejected;
- player name and team correction;
- ADP correction producing complete, partial, and none capability transitions;
- player ID correction preserving uniqueness and applying the documented identity-capability transitions;
- duplicate corrected ID rejected through final validation;
- position correction recalculating all affected position ranks;
- position correction into an existing `source` position with valid and invalid tiers;
- position correction into a `defaulted-neutral` position requiring neutral tier;
- position correction introducing a new position with `source` tier capability;
- position correction removing the last player at a position and removing its capability key;
- tier-without-position correction rejected;
- unsupported or empty correction shapes rejected;
- player-not-found failures for correction, reorder, and tier update;
- reorder to first, middle, last, and unchanged rank;
- reorder recalculating interleaved overall and position ranks;
- reorder changing row-derived capability to explicit;
- reorder that would cause tier regression rejected without changing the source set;
- complete position-tier assignment on source tiers;
- complete assignment transitioning defaulted-neutral to source;
- assignment order independent of player order;
- tier gaps preserved;
- incomplete, duplicate, foreign-position, unknown-player, unsupported-position, non-positive, fractional, and decreasing assignments rejected;
- valid individual source-tier update;
- individual update causing a decrease rejected;
- individual update on defaulted-neutral position rejected;
- team/ADP/tier capability consistency after every relevant edit;
- invalid source set rejected before intent handling;
- invalid or backward update timestamp rejected;
- source identity, source provenance, and creation time preserved;
- source set and all nested values unchanged after success and failure;
- returned source, capabilities, tier map, entries, players, and dates owned independently;
- repeated equal edits producing deeply equal but separately owned outputs;
- runtime snapshot-shaped input rejected;
- every successful result accepted by `validateRankingSet`.

Use small inline canonical ranking-set builders. Do not call repositories, files, browser APIs, or UI code. No manual QA is required.

## Implementation Steps

1. Add exported edit intent/request/result/error types, runtime request guards, deep-copy helpers, and capability helpers in `rankingSetEditing.ts`.
2. Implement rename and player-field correction, including position-rank derivation and affected team/ADP/identity/tier capability reconciliation.
3. Implement single-player reorder with canonical rank recalculation and explicit-order capability transition.
4. Implement complete position-tier assignment and individual source-tier update with membership and progression checks.
5. Run final canonical validation, map ordered failures, and guarantee new ownership only on success.
6. Add focused tests for every intent, rank/capability transition, invalid request, lifecycle rule, determinism, and immutability.
7. Run focused tests, TypeScript, and focused lint.
8. Run the full test suite and repository-wide lint.
9. After all acceptance criteria pass, mark only Phase 5 Task 9 complete in `docs/tasks.md` and update this slice status.
10. Report results and stop. Do not begin Task 10 persistence.

## Expected Files

- `src/lib/rankingSetEditing.ts`
- `src/lib/rankingSetEditing.test.ts`
- `docs/tasks.md`
- `docs/current-slice.md` for completion status

No import/export type, parser, preflight, normalizer, candidate validator, converter, exporter, canonical validator, domain type, engine, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSetEditing.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSetEditing.ts src/lib/rankingSetEditing.test.ts
npm test
npm run lint
```

Expected result:

- Focused editing tests pass with exact aggregates, ranks, capabilities, lifecycle values, failures, and ownership assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- Existing Tasks 1 through 8 behavior remains unchanged.
- No database, network, browser, environment-variable, build, migration, generated-client, or manual-QA requirement is introduced.

## Acceptance Criteria

- Every supported valid intent returns a new complete canonical `RankingSet` accepted by `validateRankingSet`.
- Every failed intent returns structured errors and no proposed aggregate.
- Original aggregate and nested values remain unchanged after success and failure.
- Rename, supported player correction, single-player reorder, complete position-tier assignment, and source-tier update are explicit and deterministic.
- Reordering recalculates contiguous overall and position ranks and marks order provenance explicit.
- Tier operations preserve meaningful gaps and never allow position-local decreases or partial defaulted-tier activation.
- Team, ADP, identity, order, position-rank, and tier capability metadata follows the documented edit policies.
- Local identity, source provenance, and creation time are preserved; only successful `updatedAt` changes.
- No edit API accepts or mutates an immutable snapshot.
- Editing is pure, clock-free, repository-free, and UI-free.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- Only Phase 5 Task 9 is checked complete after validation.
- No dependency, migration, generated code, or unrelated documentation change is introduced.

## Failure Handling

- If an edit needs per-entry provenance that the domain does not model, follow the conservative capability transitions above rather than inventing hidden metadata.
- If a position correction cannot produce a valid complete tier/capability state from explicit request values, return mapped invariant failures rather than defaulting tiers.
- If a reorder or tier edit would require changing other tiers to pass, reject it instead of repairing adjacent entries.
- If a proposed capability transition disagrees with `validateRankingSet`, stop and report the discrepancy rather than weakening the validator.
- If repository name uniqueness, stale-write protection, or transactionality is needed, leave it for Tasks 10 and 11.
- If unrelated tests fail, report them separately and do not broaden the slice.

## Follow-Up Slice

Promote Phase 5 Task 10: persist, load, and list first-class mutable ranking sets behind a dedicated repository without exposing persistence records to the domain.

## Slice Review

- Smallest meaningful increment: yes. It adds the complete pure authoring behavior needed before persistence workflows.
- Executable by a lower-reasoning pass: yes. Intent shapes, lifecycle rules, capability transitions, rank derivation, validation, and tests are explicit.
- Avoids unnecessary architecture changes: yes. One discriminated edit operation uses existing domain values and validation without repositories, history, patches, or a command framework.
- Blast radius reasonable: yes. Two source/test files plus Task 9 and slice-status documentation are expected.
- Review/revert comfort: yes. Editing is additive, pure, and isolated from persistence, snapshots, application orchestration, and UI.
- Observable/testable acceptance criteria: yes. Exact ranks, capabilities, lifecycle values, errors, immutability, and canonical validation are directly testable.
