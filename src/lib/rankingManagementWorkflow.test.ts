import { describe, expect, it } from "vitest";
import {
  deleteManagedRankingSet,
  editManagedRankingSet,
  exportManagedRankingSetJson,
  listManagedRankingSets,
  loadManagedRankingSet,
  type RankingManagementWorkflowRepository,
} from "@/lib/rankingManagementWorkflow";
import type {
  ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSetSummary,
} from "@/types/rankings";

const updatedAt = new Date("2026-06-30T12:00:00.000Z");
const exportedAt = new Date("2026-06-30T13:00:00.000Z");

describe("ranking management workflow", () => {
  it("lists summaries without loading full ranking sets", async () => {
    const fake = createFakeRepository([
      createCompleteSet(),
      createDegradedSet({ id: "set-2", name: "Degraded" }),
    ]);

    const result = await listManagedRankingSets(fake.repository);

    expectSuccess(result);
    expect(result.value).toEqual([
      createSummary(createCompleteSet()),
      createSummary(createDegradedSet({ id: "set-2", name: "Degraded" })),
    ]);
    expect(result.value[0]).not.toHaveProperty("entries");
    expect(fake.listCount).toBe(1);
    expect(fake.loadCount).toBe(0);
  });

  it("maps list persistence failures to structured errors", async () => {
    const fake = createFakeRepository([]);
    fake.listError = new TypeError(
      "Cannot read properties of undefined (reading 'findMany')",
    );

    const result = await listManagedRankingSets(fake.repository);

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "persistence-rejected",
          message: "Cannot read properties of undefined (reading 'findMany')",
          path: undefined,
        },
      ],
    });
    expect(fake.listCount).toBe(1);
  });

  it("loads a complete ranking set and maps missing or blank ids", async () => {
    const source = createCompleteSet();
    const fake = createFakeRepository([source]);

    const loaded = await loadManagedRankingSet(source.id, fake.repository);
    const missing = await loadManagedRankingSet("missing", fake.repository);
    const blank = await loadManagedRankingSet(" ", fake.repository);

    expectSuccess(loaded);
    expect(loaded.value).toEqual(source);
    expect(loaded.value).not.toBe(source);
    expect(loaded.value.entries[0]).not.toBe(source.entries[0]);
    expect(missing).toEqual({
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    });
    expect(blank).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-request",
          message: "Ranking set ID must be a non-empty string.",
          path: "id",
        },
      ],
    });
  });

  it("renames through pure editing and repository replacement", async () => {
    const source = createCompleteSet();
    const fake = createFakeRepository([source]);

    const result = await editManagedRankingSet(
      {
        id: source.id,
        updatedAt,
        intent: { type: "rename", name: "Renamed Rankings" },
      },
      fake.repository,
    );

    expectSuccess(result);
    expect(result.value).toEqual({
      ...source,
      name: "Renamed Rankings",
      updatedAt,
    });
    expect(fake.loadCount).toBe(1);
    expect(fake.replaceCount).toBe(1);
    expect(fake.records[0]).toEqual(result.value);
  });

  it("persists supported player correction, reorder, and tier edits as complete replacements", async () => {
    const fake = createFakeRepository([createCompleteSet()]);

    const corrected = await editManagedRankingSet(
      {
        id: "set-1",
        updatedAt,
        intent: {
          type: "correct-player",
          playerId: "qb-2",
          changes: { team: "BAL", adpRank: null },
        },
      },
      fake.repository,
    );
    expectSuccess(corrected);
    expect(corrected.value.entries[2]?.player.team).toBe("BAL");
    expect(corrected.value.capabilities.adp).toBe("partial");

    const reordered = await editManagedRankingSet(
      {
        id: "set-1",
        updatedAt: new Date("2026-06-30T12:01:00.000Z"),
        intent: {
          type: "reorder-player",
          playerId: "rb-1",
          toOverallRank: 1,
        },
      },
      fake.repository,
    );
    expectSuccess(reordered);
    expect(reordered.value.entries.map((entry) => entry.player.id)).toEqual([
      "rb-1",
      "qb-1",
      "qb-2",
    ]);
    expect(reordered.value.entries.map((entry) => entry.overallRank)).toEqual([
      1, 2, 3,
    ]);

    const tiers = await editManagedRankingSet(
      {
        id: "set-1",
        updatedAt: new Date("2026-06-30T12:02:00.000Z"),
        intent: {
          type: "assign-position-tiers",
          position: "QB",
          assignments: [
            { playerId: "qb-1", tier: 1 },
            { playerId: "qb-2", tier: 3 },
          ],
        },
      },
      fake.repository,
    );
    expectSuccess(tiers);
    expect(
      tiers.value.entries
        .filter((entry) => entry.player.position === "QB")
        .map((entry) => entry.tier),
    ).toEqual([1, 3]);
    expect(fake.replaceCount).toBe(3);
  });

  it("does not replace when request or pure edit validation fails", async () => {
    const source = createCompleteSet();
    const fake = createFakeRepository([source]);

    const invalidDate = await editManagedRankingSet(
      {
        id: source.id,
        updatedAt: new Date(Number.NaN),
        intent: { type: "rename", name: "Nope" },
      },
      fake.repository,
    );
    const invalidIntent = await editManagedRankingSet(
      {
        id: source.id,
        updatedAt,
        intent: {
          type: "update-tier",
          playerId: "missing-player",
          tier: 2,
        },
      },
      fake.repository,
    );

    expect(invalidDate).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-request",
          message: "Ranking set edit updatedAt must be a valid Date.",
          path: "updatedAt",
        },
      ],
    });
    expect(invalidIntent).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-edit",
          message: "Ranking player missing-player was not found.",
          path: "entries",
        },
      ],
    });
    expect(fake.replaceCount).toBe(0);
    expect(fake.records).toEqual([source]);
  });

  it("maps repository replacement failures and preserves the prior record", async () => {
    const source = createCompleteSet();
    const fake = createFakeRepository([source]);

    fake.replaceResult = {
      ok: false,
      errors: [
        {
          code: "name-conflict",
          message: "A ranking set with this name already exists.",
          path: "name",
        },
      ],
    };

    const conflict = await editManagedRankingSet(
      {
        id: source.id,
        updatedAt,
        intent: { type: "rename", name: "Conflicting" },
      },
      fake.repository,
    );

    expect(conflict).toEqual({
      ok: false,
      errors: [
        {
          code: "name-conflict",
          message: "A ranking set with this name already exists.",
          path: "name",
        },
      ],
    });
    expect(fake.records).toEqual([source]);

    fake.replaceResult = {
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    };
    await expect(
      editManagedRankingSet(
        {
          id: source.id,
          updatedAt,
          intent: { type: "rename", name: "Lost" },
        },
        fake.repository,
      ),
    ).resolves.toMatchObject({
      ok: false,
      errors: [{ code: "not-found", path: "id" }],
    });
  });

  it("deletes only the requested set and does not call unrelated operations", async () => {
    const first = createCompleteSet();
    const second = createDegradedSet({ id: "set-2", name: "Second" });
    const fake = createFakeRepository([first, second]);

    const deleted = await deleteManagedRankingSet(first.id, fake.repository);
    const missing = await deleteManagedRankingSet(first.id, fake.repository);
    const blank = await deleteManagedRankingSet(" ", fake.repository);

    expectSuccess(deleted);
    expect(deleted.value).toEqual({ id: first.id });
    expect(fake.records).toEqual([second]);
    expect(missing).toEqual({
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    });
    expect(blank).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-request",
          message: "Ranking set ID must be a non-empty string.",
          path: "id",
        },
      ],
    });
    expect(fake.deleteCount).toBe(2);
    expect(fake.loadCount).toBe(0);
    expect(fake.replaceCount).toBe(0);
  });

  it("exports deterministic canonical JSON without mutating persistence", async () => {
    const source = createCompleteSet();
    const fake = createFakeRepository([source]);

    const result = await exportManagedRankingSetJson(
      {
        id: source.id,
        exportedAt,
        includeSourceRankingSetId: true,
      },
      fake.repository,
    );

    expectSuccess(result);
    expect(result.value.document.metadata).toMatchObject({
      name: source.name,
      exportedAt: exportedAt.toISOString(),
      sourceRankingSetId: source.id,
    });
    expect(result.value.document.schemaVersion).toBe(2);
    expect(result.value.document.tierSemantics).toEqual({
      sourceTier: {
        kind: "legacy-ambiguous",
        sourceScope: "unknown",
        recommendationEligible: false,
      },
      recommendationTier: {
        kind: "neutral",
        sourceScope: "position",
        recommendationEligible: false,
      },
    });
    expect(result.value.document.capabilities).toEqual({
      ...source.capabilities,
      tiers: { QB: "defaulted-neutral", RB: "defaulted-neutral" },
    });
    expect(result.value.document.entries.map((entry) => ({
      sourceTier: entry.sourceTier,
      recommendationTier: entry.recommendationTier,
    }))).toEqual([
      { sourceTier: 1, recommendationTier: NEUTRAL_TIER },
      { sourceTier: 2, recommendationTier: NEUTRAL_TIER },
      { sourceTier: 4, recommendationTier: NEUTRAL_TIER },
    ]);
    expect(result.value.text).toBe(JSON.stringify(result.value.document));
    expect(result.value.byteLength).toBe(
      new TextEncoder().encode(result.value.text).byteLength,
    );
    expect(fake.records).toEqual([source]);
    expect(fake.loadCount).toBe(1);
    expect(fake.replaceCount).toBe(0);
    expect(fake.deleteCount).toBe(0);
  });

  it("exports degraded capability metadata without recasting fallbacks", async () => {
    const source = createDegradedSet();
    const fake = createFakeRepository([source]);

    const result = await exportManagedRankingSetJson(
      { id: source.id, exportedAt },
      fake.repository,
    );

    expectSuccess(result);
    expect(result.value.document.capabilities).toEqual({
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: {
        QB: "defaulted-neutral",
        RB: "defaulted-neutral",
      },
    });
    expect(
      result.value.document.entries.every(
        (entry) =>
          entry.player.team === UNKNOWN_TEAM &&
          entry.adpRank === null &&
          entry.recommendationTier === NEUTRAL_TIER &&
          !("tier" in entry),
      ),
    ).toBe(true);
  });

  it("maps export request, missing, and exporter validation failures", async () => {
    const fake = createFakeRepository([createCompleteSet()]);

    const invalidRequest = await exportManagedRankingSetJson(
      { id: " ", exportedAt: new Date(Number.NaN) },
      fake.repository,
    );
    const missing = await exportManagedRankingSetJson(
      { id: "missing", exportedAt },
      fake.repository,
    );
    const invalidLoaded = createFakeRepository([
      {
        ...createCompleteSet({ id: "invalid" }),
        entries: [],
      },
    ]);
    const exportFailed = await exportManagedRankingSetJson(
      { id: "invalid", exportedAt },
      invalidLoaded.repository,
    );

    expect(invalidRequest).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-request",
          message: "Ranking set ID must be a non-empty string.",
          path: "id",
        },
        {
          code: "invalid-request",
          message: "Canonical ranking export requires a valid exportedAt Date.",
          path: "exportedAt",
        },
      ],
    });
    expect(missing).toEqual({
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    });
    expectFailure(exportFailed);
    expect(exportFailed.errors[0]).toMatchObject({
      code: "export-failed",
      path: "entries",
    });
    expect(invalidLoaded.replaceCount).toBe(0);
  });
});

function createFakeRepository(initialRecords: readonly RankingSet[]) {
  const state = {
    records: initialRecords.map(cloneRankingSet),
    listCount: 0,
    loadCount: 0,
    replaceCount: 0,
    deleteCount: 0,
    replaceResult: undefined as ReplaceRankingSetResult | undefined,
    listError: undefined as Error | undefined,
  };

  const repository: RankingManagementWorkflowRepository = {
    async listRankingSetSummaries() {
      state.listCount += 1;

      if (state.listError) {
        throw state.listError;
      }

      return state.records.map(createSummary);
    },

    async getRankingSetById(id) {
      state.loadCount += 1;
      const record = state.records.find((candidate) => candidate.id === id);
      return record ? cloneRankingSet(record) : null;
    },

    async replaceRankingSet(rankingSet) {
      state.replaceCount += 1;

      if (state.replaceResult) {
        return state.replaceResult;
      }

      const index = state.records.findIndex(
        (candidate) => candidate.id === rankingSet.id,
      );

      if (index < 0) {
        return {
          ok: false,
          errors: [
            {
              code: "not-found",
              message: "Ranking set was not found.",
              path: "id",
            },
          ],
        };
      }

      const priorRecords = state.records.map(cloneRankingSet);

      if (
        state.records.some(
          (record, recordIndex) =>
            recordIndex !== index &&
            normalizeName(record.name) === normalizeName(rankingSet.name),
        )
      ) {
        state.records = priorRecords;
        return {
          ok: false,
          errors: [
            {
              code: "name-conflict",
              message: "A ranking set with this name already exists.",
              path: "name",
            },
          ],
        };
      }

      state.records[index] = cloneRankingSet(rankingSet);
      return { ok: true, rankingSet: cloneRankingSet(rankingSet) };
    },

    async deleteRankingSetById(id) {
      state.deleteCount += 1;
      const index = state.records.findIndex((candidate) => candidate.id === id);

      if (index < 0) {
        return {
          ok: false,
          errors: [
            {
              code: "not-found",
              message: "Ranking set was not found.",
              path: "id",
            },
          ],
        };
      }

      const [deleted] = state.records.splice(index, 1);
      return { ok: true, id: deleted.id };
    },
  };

  return {
    repository,
    get records() {
      return state.records.map(cloneRankingSet);
    },
    get listCount() {
      return state.listCount;
    },
    get loadCount() {
      return state.loadCount;
    },
    get replaceCount() {
      return state.replaceCount;
    },
    get deleteCount() {
      return state.deleteCount;
    },
    set replaceResult(value: ReplaceRankingSetResult | undefined) {
      state.replaceResult = value;
    },
    set listError(value: Error | undefined) {
      state.listError = value;
    },
  };
}

function createSummary(rankingSet: RankingSet): RankingSetSummary {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    sourceKind: rankingSet.source.kind,
    entryCount: rankingSet.entries.length,
    capabilities: cloneCapabilities(rankingSet.capabilities),
    createdAt: new Date(rankingSet.createdAt),
    updatedAt: new Date(rankingSet.updatedAt),
  };
}

function createCompleteSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "set-1",
    name: "Complete Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-27T12:00:00.000Z"),
    },
    capabilities: createCapabilities(),
    entries: [
      createEntry("qb-1", 1, "QB", 1, 1, "SEA", 1.5),
      createEntry("rb-1", 2, "RB", 1, 2, "BUF", 2.5),
      createEntry("qb-2", 3, "QB", 2, 4, "KC", 3.5),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    ...overrides,
  };
}

function createDegradedSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "degraded-set",
    name: "Degraded Rankings",
    source: { kind: "manual" },
    capabilities: {
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: {
        QB: "defaulted-neutral",
        RB: "defaulted-neutral",
      },
    },
    entries: [
      createEntry("generated-qb", 1, "QB", 1, 1, UNKNOWN_TEAM, null),
      createEntry("generated-rb", 2, "RB", 1, 1, UNKNOWN_TEAM, null),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    ...overrides,
  };
}

function createCapabilities(
  overrides: Partial<RankingSetCapabilities> = {},
): RankingSetCapabilities {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "explicit",
    positionRank: "derived",
    adp: "complete",
    tiers: { QB: "source", RB: "source" },
    ...overrides,
  };
}

function createEntry(
  id: string,
  overallRank: number,
  position: Position,
  positionRank: number,
  tier: number,
  team: string,
  adpRank: number | null,
): RankingEntry {
  return {
    player: { id, name: `Player ${id}`, team, position },
    overallRank,
    positionRank,
    tier,
    adpRank,
  };
}

function cloneRankingSet(rankingSet: RankingSet): RankingSet {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    source: {
      ...rankingSet.source,
      ...(rankingSet.source.importedAt === undefined
        ? {}
        : { importedAt: new Date(rankingSet.source.importedAt) }),
    },
    capabilities: cloneCapabilities(rankingSet.capabilities),
    entries: rankingSet.entries.map(cloneEntry),
    createdAt: new Date(rankingSet.createdAt),
    updatedAt: new Date(rankingSet.updatedAt),
  };
}

function cloneCapabilities(
  capabilities: RankingSetCapabilities,
): RankingSetCapabilities {
  return {
    ...capabilities,
    tiers: { ...capabilities.tiers },
  };
}

function cloneEntry(entry: RankingEntry): RankingEntry {
  return {
    player: { ...entry.player },
    overallRank: entry.overallRank,
    adpRank: entry.adpRank,
    positionRank: entry.positionRank,
    tier: entry.tier,
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

type WorkflowResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; errors: readonly unknown[] }>;

function expectSuccess<TValue>(
  result: WorkflowResult<TValue>,
): asserts result is Extract<WorkflowResult<TValue>, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected workflow success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure<TValue>(
  result: WorkflowResult<TValue>,
): asserts result is Extract<WorkflowResult<TValue>, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected workflow failure.");
  }
}
