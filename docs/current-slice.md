# Current Slice: Close Ranking Set Validator Edge Cases

## Completion Status

Planned. This corrective follow-up belongs to Phase 5 Task 1. Task 1 must not be treated as fully closed, and Task 2 must not begin, until both review findings and their regression tests pass.

## Source Context

The higher-reasoning review found two runtime gaps in the new canonical ranking-set validator:

1. `validateEntries` uses `Array.prototype.forEach`, which skips holes in sparse arrays. A sparse array can therefore have a positive `length` while avoiding all per-entry validation.
2. Tier-capability validation iterates only the six supported positions. It rejects supported positions that are absent from the set, but it does not inspect unknown object keys such as `DL`.

Both behaviors conflict with the approved Task 1 invariants:

- entries must be a genuinely populated canonical collection;
- tier capabilities must cover exactly the supported positions represented by entries;
- unsupported runtime metadata must fail rather than being ignored.

The existing domain types, error vocabulary, valid behavior, and architecture remain correct. This slice should close only these two validation gaps.

## Goal

Make canonical ranking-set validation reject sparse entry arrays and unknown tier-capability keys, with deterministic exact regression coverage and no change to valid ranking-set behavior.

## Scope

### Goals

- Visit every numeric index from zero through `entries.length - 1`, including sparse holes.
- Treat a sparse hole as an invalid entry at its actual array index using the existing field-level validation errors.
- Preserve current deterministic array and field error ordering.
- Inspect every own enumerable key in `capabilities.tiers`.
- Reject tier-capability keys outside `QB`, `RB`, `WR`, `TE`, `DST`, and `K`.
- Report each unknown key as `invalid-capability` at `capabilities.tiers.<key>`.
- Preserve the existing canonical position order for known tier-capability errors.
- Report unknown tier keys after known-position checks in lexicographic key order.
- Add exact focused regression tests for both findings.
- Re-run all validation required by the completed Task 1 slice.

### Non-Goals

- Changing `RankingSet`, `RankingSetCapabilities`, `RankingEntry`, or any other domain type.
- Adding a new validation error code.
- Changing valid source, team, ADP, identity, rank, tier, date, or capability behavior.
- Normalizing or repairing sparse arrays or unknown capability keys.
- Parsing imported files or adding import-stage contracts.
- Changing snapshots, scenarios, repositories, persistence, recommendations, or UI.
- Updating architecture, design, decisions, project scope, dependencies, or generated code.
- Beginning Phase 5 Task 2.

## Implementation Design

### Sparse Entry Validation

Update `src/lib/rankingSetValidation.ts` so `validateEntries` uses explicit indexed iteration rather than `forEach`:

```ts
for (let index = 0; index < entries.length; index += 1) {
  const value = entries[index];
  // existing validation body unchanged
}
```

JavaScript returns `undefined` when a sparse hole is read by index. The existing record and field validation should then produce deterministic errors for that index.

Do not compact the array, filter holes, synthesize an entry, or introduce an `invalid-entry` code. Preserve the current field-level behavior. For a one-slot sparse array with otherwise matching empty capabilities, the exact error code/path order should be:

1. `invalid-player-id` at `entries[0].player.id`
2. `invalid-player-name` at `entries[0].player.name`
3. `invalid-team` at `entries[0].player.team`
4. `invalid-position` at `entries[0].player.position`
5. `invalid-overall-rank` at `entries[0].overallRank`
6. `invalid-adp-rank` at `entries[0].adpRank`
7. `invalid-tier` at `entries[0].tier`

No position-rank error is expected because a valid position is required before an expected position rank can be derived.

### Unknown Tier-Capability Keys

After completing the existing `QB`, `RB`, `WR`, `TE`, `DST`, and `K` checks, inspect `Object.keys(tiers)`.

- Filter out the six supported position keys.
- Sort remaining keys lexicographically.
- Add one `invalid-capability` error per unknown key.
- Use path `capabilities.tiers.<key>`.
- Use a message stating that the tier-capability position is unsupported.

Keep unknown-key checks after the known-position loop so existing error ordering and tests remain stable.

Only own enumerable keys should be considered. Do not broaden this slice into prototype hardening or generic unknown-field rejection for other domain objects.

### Focused Regression Tests

Update `src/lib/rankingSetValidation.test.ts` with:

1. A one-slot sparse array created with `new Array<RankingEntry>(1)`, paired with `team: "none"`, `adp: "none"`, and an empty tier-capability map. Assert the exact seven errors and ordering listed above.
2. A valid complete ranking set whose tier capability object also contains `DL: "source"` through a runtime test cast. Assert one `invalid-capability` error at `capabilities.tiers.DL`.
3. An unknown-key ordering case with at least two unsupported keys supplied out of order, proving errors are returned in lexicographic key order after all supported-position checks.

Existing valid complete, degraded, partial, and capability tests must remain unchanged and pass.

## Implementation Steps

1. Replace sparse-skipping entry iteration with explicit indexed iteration in `rankingSetValidation.ts` without changing the validation body.
2. Add deterministic unknown tier-key rejection after the supported-position capability loop.
3. Add exact sparse-array and unknown-key regression tests.
4. Run the focused ranking-set validation tests.
5. Run TypeScript no-emit validation and focused lint.
6. Run the full test suite and repository-wide lint.
7. If every acceptance criterion passes, update this slice status to complete and retain Phase 5 Task 1 as complete.
8. Report results and stop. Do not begin Task 2.

## Expected Files

- `src/lib/rankingSetValidation.ts`
- `src/lib/rankingSetValidation.test.ts`
- `docs/current-slice.md` for completion status after implementation

No type, task, architecture, design, decision, project, snapshot, scenario, persistence, dependency, generated, or UI file should change.

## Automated Validation

Run from the repository root:

```text
npm test -- src/lib/rankingSetValidation.test.ts
npx tsc --noEmit
npm run lint -- src/lib/rankingSetValidation.ts src/lib/rankingSetValidation.test.ts
npm test
npm run lint
```

Expected result:

- Focused ranking-set validation tests pass with exact error assertions.
- TypeScript no-emit validation passes.
- Focused lint passes without warnings.
- The full Vitest suite passes.
- Repository-wide lint passes.
- No dependency, database, environment, network, build, or generated-client requirement is introduced.

No Prisma validation, production build, or manual browser QA is required because this slice changes only pure validation logic and unit tests.

## Acceptance Criteria

- Sparse holes are visited and rejected at their real array indexes.
- A one-slot sparse array returns the exact seven existing field-level errors in the specified order.
- Dense valid arrays continue producing no new errors.
- Every own enumerable tier-capability key outside the six supported positions is rejected.
- Unknown tier-key errors use `invalid-capability` and the exact unknown-key path.
- Multiple unknown tier keys are reported after known-position errors in lexicographic order.
- Existing error codes, valid ranking behavior, capability derivation, and success-reference semantics are unchanged.
- Existing complete, degraded, partial, rank, tier, and capability tests continue passing.
- Focused tests, TypeScript, focused lint, full tests, and repository-wide lint pass.
- No file outside the three expected files changes.
- Phase 5 Task 2 remains unstarted.

## Failure Handling

- If indexed iteration changes errors for dense arrays, stop and preserve the existing dense-array behavior before proceeding.
- If rejecting unknown keys requires changing `RankingSetCapabilities`, do not change the type; use runtime key inspection and report any blocker.
- If error ordering differs from the documented sequence, fix the iteration/check order rather than weakening exact assertions.
- If an unknown inherited property is encountered, leave it out of scope; only own enumerable keys are part of this correction.
- If unrelated tests fail, report them separately and do not broaden the slice.
- If either finding cannot be fixed without changing parser, snapshot, scenario, or engine behavior, stop and report the boundary conflict.

## Follow-Up Slice

After this correction passes, promote Phase 5 Task 2: define import-stage contracts, diagnostics, transport preflight boundaries, and the frozen FantasyPros CSV and Canonical Ranking Set JSON V1 profiles.

## Slice Review

- Smallest meaningful increment: yes. It closes exactly the two reviewed invariant gaps.
- Executable by a lower-reasoning pass: yes. Iteration behavior, key validation, error codes, paths, ordering, tests, and commands are explicit.
- Avoids unnecessary architecture changes: yes. Domain types and all downstream boundaries remain unchanged.
- Blast radius reasonable: yes. Two code/test files plus slice status are expected.
- Review/revert comfort: yes. The changes are local, additive validation hardening with regression tests.
- Observable/testable acceptance criteria: yes. Both previously accepted invalid shapes receive exact deterministic failures.
