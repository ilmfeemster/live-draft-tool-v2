import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  createRankingSetRepository,
} from "@/lib/rankingSetRepository";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
} from "@/types/rankings";

describe("ranking set repository", () => {
  it("creates and loads a complete canonical set without value loss", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const source = createCompleteSet();

    const created = await repository.createRankingSet(source);
    expect(created.ok).toBe(true);

    if (!created.ok) {
      throw new Error("Expected create success.");
    }

    const loaded = await repository.getRankingSetById(source.id);

    expect(fake.transactionCount).toBe(1);
    expect(fake.records[0]?.normalizedName).toBe("complete rankings");
    expect(fake.records[0]?.sourceKind).toBe("EXTERNAL");
    expect(created.rankingSet).toEqual(source);
    expect(loaded).toEqual(source);
    expect(loaded?.entries.map((entry) => entry.overallRank)).toEqual([1, 2, 3]);
    expect(loaded).not.toHaveProperty("normalizedName");
    expect(loaded?.entries[0]).not.toHaveProperty("rankingSetId");
  });

  it("round-trips safely degraded fields and capability metadata", async () => {
    const repository = createRankingSetRepository(createFakeRankingSetDb().db);
    const source = createDegradedSet();
    const created = await repository.createRankingSet(source);

    expect(created.ok).toBe(true);

    if (!created.ok) {
      throw new Error("Expected degraded create success.");
    }

    expect(created.rankingSet).toEqual(source);
    expect(created.rankingSet.capabilities.tiers).toEqual({
      QB: "defaulted-neutral",
      RB: "defaulted-neutral",
    });
    expect(
      created.rankingSet.entries.every(
        (entry) =>
          entry.player.team === UNKNOWN_TEAM &&
          entry.adpRank === null &&
          entry.tier === NEUTRAL_TIER,
      ),
    ).toBe(true);
  });

  it("returns independently owned domain values", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const source = createCompleteSet();
    await repository.createRankingSet(source);
    const loaded = await repository.getRankingSetById(source.id);

    if (!loaded) {
      throw new Error("Expected loaded set.");
    }

    expect(loaded.source).not.toBe(source.source);
    expect(loaded.source.importedAt).not.toBe(source.source.importedAt);
    expect(loaded.capabilities).not.toBe(source.capabilities);
    expect(loaded.capabilities.tiers).not.toBe(source.capabilities.tiers);
    expect(loaded.entries).not.toBe(source.entries);
    expect(loaded.entries[0]).not.toBe(source.entries[0]);
    expect(loaded.entries[0]?.player).not.toBe(source.entries[0]?.player);
    expect(loaded.createdAt).not.toBe(source.createdAt);
    expect(loaded.updatedAt).not.toBe(source.updatedAt);
    expect(loaded.createdAt).not.toBe(fake.records[0]?.createdAt);
  });

  it("rejects invalid domain input before touching the database", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const result = await repository.createRankingSet(
      createCompleteSet({ id: "", name: "" }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-ranking-set",
          message: "Ranking set ID must be a non-empty string.",
          path: "id",
        },
        {
          code: "invalid-ranking-set",
          message: "Ranking set name must be a non-empty string.",
          path: "name",
        },
      ],
    });
    expect(fake.createCount).toBe(0);
    expect(fake.transactionCount).toBe(0);
  });

  it("preserves display name while enforcing normalized name conflicts", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const first = createCompleteSet({ name: "  My Rankings  " });
    const second = createCompleteSet({
      id: "ranking-set-2",
      name: "my RANKINGS",
    });

    const created = await repository.createRankingSet(first);
    const conflict = await repository.createRankingSet(second);

    expect(created.ok).toBe(true);
    expect(fake.records[0]?.name).toBe("  My Rankings  ");
    expect(fake.records[0]?.normalizedName).toBe("my rankings");
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
    expect(fake.records).toHaveLength(1);
  });

  it("rethrows unrelated unique and persistence failures", async () => {
    const uniqueFake = createFakeRankingSetDb();
    uniqueFake.nextError = prismaError("P2002", ["id"]);
    const uniqueRepository = createRankingSetRepository(uniqueFake.db);

    await expect(
      uniqueRepository.createRankingSet(createCompleteSet()),
    ).rejects.toMatchObject({ code: "P2002" });

    const failedFake = createFakeRankingSetDb();
    failedFake.nextError = new Error("database unavailable");
    const failedRepository = createRankingSetRepository(failedFake.db);

    await expect(
      failedRepository.createRankingSet(createCompleteSet()),
    ).rejects.toThrow("database unavailable");
  });

  it("recognizes adapter P2002 name conflicts without target metadata", async () => {
    const fake = createFakeRankingSetDb();
    fake.nextError = Object.assign(
      new Error("Unique constraint failed on the fields: (`normalizedName`)"),
      { code: "P2002" },
    );
    const repository = createRankingSetRepository(fake.db);

    await expect(
      repository.createRankingSet(createCompleteSet()),
    ).resolves.toMatchObject({
      ok: false,
      errors: [{ code: "name-conflict" }],
    });
  });

  it("does not infer name conflicts from unverified error messages", async () => {
    const fake = createFakeRankingSetDb();
    fake.nextError = new Error(
      "Unique constraint failed while writing normalizedName",
    );
    const repository = createRankingSetRepository(fake.db);

    await expect(
      repository.createRankingSet(createCompleteSet()),
    ).rejects.toThrow("Unique constraint failed while writing normalizedName");
  });

  it("rolls back metadata and entries after a simulated nested failure", async () => {
    const fake = createFakeRankingSetDb();
    fake.failEntryIndex = 1;
    const repository = createRankingSetRepository(fake.db);

    await expect(
      repository.createRankingSet(createCompleteSet()),
    ).rejects.toThrow("simulated nested entry failure");
    expect(fake.records).toEqual([]);
    expect(fake.transactionCount).toBe(1);
  });

  it("returns null for a missing local identity", async () => {
    const repository = createRankingSetRepository(createFakeRankingSetDb().db);

    await expect(repository.getRankingSetById("missing")).resolves.toBeNull();
  });

  it.each([
    {
      name: "unsupported source enum",
      mutate(record: FakeRecord) {
        record.sourceKind = "PROVIDER" as FakeRecord["sourceKind"];
      },
      path: "source.kind",
    },
    {
      name: "malformed tier JSON",
      mutate(record: FakeRecord) {
        record.tierCapabilities = { QB: "invented" };
      },
      path: "capabilities.tiers.QB",
    },
    {
      name: "invalid canonical order",
      mutate(record: FakeRecord) {
        record.entries[0].overallRank = 2;
      },
      path: "entries[0].overallRank",
    },
    {
      name: "invalid capability",
      mutate(record: FakeRecord) {
        record.teamCapability = "NONE";
      },
      path: "capabilities.team",
    },
  ])("fails loudly for $name", async ({ mutate, path }) => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    await repository.createRankingSet(createCompleteSet());
    mutate(fake.records[0]);

    await expect(repository.getRankingSetById("ranking-set-1")).rejects.toMatchObject({
      name: "RankingSetRepositoryMappingError",
      path,
    });
  });

  it("lists lightweight summaries without selecting entry rows", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const older = createCompleteSet({
      id: "older",
      name: "Zeta",
      updatedAt: new Date("2026-06-27T12:00:00.000Z"),
    });
    const sameTimeA = createDegradedSet({
      id: "same-b",
      name: "Alpha B",
      updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    });
    const sameTimeB = createCompleteSet({
      id: "same-a",
      name: "Alpha A",
      updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    });
    await repository.createRankingSet(older);
    await repository.createRankingSet(sameTimeA);
    await repository.createRankingSet(sameTimeB);

    const summaries = await repository.listRankingSetSummaries();

    expect(fake.summarySelectedEntries).toBe(false);
    expect(fake.summarySelectedCount).toBe(true);
    expect(fake.summaryOrder).toEqual([
      { updatedAt: "desc" },
      { name: "asc" },
      { id: "asc" },
    ]);
    expect(summaries.map((summary) => summary.id)).toEqual([
      "same-a",
      "same-b",
      "older",
    ]);
    expect(summaries[1]).toEqual({
      id: "same-b",
      name: "Alpha B",
      sourceKind: "manual",
      entryCount: 2,
      capabilities: sameTimeA.capabilities,
      createdAt: sameTimeA.createdAt,
      updatedAt: sameTimeA.updatedAt,
    });
    expect(summaries[0]).not.toHaveProperty("entries");
    expect(summaries[0]).not.toHaveProperty("normalizedName");
  });

  it("keeps ranking sets isolated even when player identities overlap", async () => {
    const fake = createFakeRankingSetDb();
    const repository = createRankingSetRepository(fake.db);
    const first = createCompleteSet();
    const second = createCompleteSet({
      id: "ranking-set-2",
      name: "Second Rankings",
      entries: first.entries.map((entry) => ({
        ...entry,
        player: { ...entry.player },
      })),
    });
    await repository.createRankingSet(first);
    await repository.createRankingSet(second);

    await expect(repository.getRankingSetById(first.id)).resolves.toEqual(first);
    await expect(repository.getRankingSetById(second.id)).resolves.toEqual(second);
  });
});

const testDatabaseUrl = process.env.RANKING_SET_TEST_DATABASE_URL;
const runDatabaseTests =
  process.env.RUN_RANKING_SET_DB_TESTS === "1" && Boolean(testDatabaseUrl);

describe.runIf(runDatabaseTests)("ranking set repository PostgreSQL", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createRankingSetRepository>;
  const testIds = ["integration-complete", "integration-degraded"];

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl as string }),
    });
    repository = createRankingSetRepository(
      prisma as unknown as Parameters<typeof createRankingSetRepository>[0],
    );
    await prisma.rankingSet.deleteMany({ where: { id: { in: testIds } } });
  });

  afterAll(async () => {
    await prisma.rankingSet.deleteMany({ where: { id: { in: testIds } } });
    await prisma.$disconnect();
  });

  it("round-trips complete and degraded sets with conflicts and summaries", async () => {
    const complete = createCompleteSet({
      id: testIds[0],
      name: "Integration Complete",
    });
    const degraded = createDegradedSet({
      id: testIds[1],
      name: "Integration Degraded",
    });

    const completeResult = await repository.createRankingSet(complete);
    const degradedResult = await repository.createRankingSet(degraded);

    expect(completeResult).toEqual({ ok: true, rankingSet: complete });
    expect(degradedResult).toEqual({ ok: true, rankingSet: degraded });
    await expect(repository.getRankingSetById(complete.id)).resolves.toEqual(complete);
    await expect(repository.getRankingSetById(degraded.id)).resolves.toEqual(degraded);

    const conflict = await repository.createRankingSet(
      createCompleteSet({
        id: "integration-conflict",
        name: " integration COMPLETE ",
      }),
    );
    expect(conflict).toMatchObject({
      ok: false,
      errors: [{ code: "name-conflict" }],
    });

    const summaries = await repository.listRankingSetSummaries();
    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: complete.id, entryCount: 3 }),
        expect.objectContaining({ id: degraded.id, entryCount: 2 }),
      ]),
    );
  });
});

type RepositoryDb = Parameters<typeof createRankingSetRepository>[0];
type FakeRecord = Awaited<ReturnType<RepositoryDb["rankingSet"]["create"]>>;

function createFakeRankingSetDb() {
  const state = {
    records: [] as FakeRecord[],
    createCount: 0,
    transactionCount: 0,
    failEntryIndex: undefined as number | undefined,
    nextError: undefined as unknown,
    summarySelectedEntries: false,
    summarySelectedCount: false,
    summaryOrder: undefined as unknown,
  };

  const rankingSet: RepositoryDb["rankingSet"] = {
    async create(args) {
      state.createCount += 1;

      if (state.nextError) {
        const error = state.nextError;
        state.nextError = undefined;
        throw error;
      }

      if (
        state.records.some(
          (record) => record.normalizedName === args.data.normalizedName,
        )
      ) {
        throw prismaError("P2002", ["normalizedName"]);
      }

      if (state.records.some((record) => record.id === args.data.id)) {
        throw prismaError("P2002", ["id"]);
      }

      const record: FakeRecord = {
        id: args.data.id,
        name: args.data.name,
        normalizedName: args.data.normalizedName,
        sourceKind: args.data.sourceKind,
        sourceFormatId: args.data.sourceFormatId ?? null,
        sourceFormatVersion: args.data.sourceFormatVersion ?? null,
        sourceLabel: args.data.sourceLabel ?? null,
        sourceImportedAt: args.data.sourceImportedAt
          ? new Date(args.data.sourceImportedAt)
          : null,
        teamCapability: args.data.teamCapability,
        playerIdentityCapability: args.data.playerIdentityCapability,
        overallOrderCapability: args.data.overallOrderCapability,
        adpCapability: args.data.adpCapability,
        tierCapabilities: structuredClone(args.data.tierCapabilities),
        entries: [],
        createdAt: new Date(args.data.createdAt),
        updatedAt: new Date(args.data.updatedAt),
      };
      state.records.push(record);

      for (let index = 0; index < args.data.entries.create.length; index += 1) {
        if (state.failEntryIndex === index) {
          throw new Error("simulated nested entry failure");
        }

        const entry = args.data.entries.create[index];
        record.entries.push({
          id: `${record.id}-entry-${index + 1}`,
          rankingSetId: record.id,
          ...entry,
        });
      }

      return cloneRecord(record, true);
    },

    async findUnique(args) {
      const record = state.records.find(
        (candidate) => candidate.id === args.where.id,
      );
      return record ? cloneRecord(record, true) : null;
    },

    async findMany(args) {
      state.summarySelectedEntries = "entries" in args.select;
      state.summarySelectedCount = "_count" in args.select;
      state.summaryOrder = args.orderBy;

      return [...state.records]
        .sort((left, right) => {
          const dateOrder = right.updatedAt.getTime() - left.updatedAt.getTime();
          return (
            dateOrder ||
            left.name.localeCompare(right.name) ||
            left.id.localeCompare(right.id)
          );
        })
        .map((record) => ({
          id: record.id,
          name: record.name,
          sourceKind: record.sourceKind,
          teamCapability: record.teamCapability,
          playerIdentityCapability: record.playerIdentityCapability,
          overallOrderCapability: record.overallOrderCapability,
          adpCapability: record.adpCapability,
          tierCapabilities: structuredClone(record.tierCapabilities),
          _count: { entries: record.entries.length },
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        }));
    },
  };

  const db: RepositoryDb = {
    rankingSet,
    async $transaction(callback) {
      state.transactionCount += 1;
      const snapshot = structuredClone(state.records);

      try {
        return await callback({ rankingSet });
      } catch (error) {
        state.records.splice(0, state.records.length, ...snapshot);
        throw error;
      }
    },
  };

  return {
    db,
    get records() {
      return state.records;
    },
    get createCount() {
      return state.createCount;
    },
    get transactionCount() {
      return state.transactionCount;
    },
    get summarySelectedEntries() {
      return state.summarySelectedEntries;
    },
    get summarySelectedCount() {
      return state.summarySelectedCount;
    },
    get summaryOrder() {
      return state.summaryOrder;
    },
    set failEntryIndex(value: number | undefined) {
      state.failEntryIndex = value;
    },
    set nextError(value: unknown) {
      state.nextError = value;
    },
  };
}

function cloneRecord(record: FakeRecord, reverseEntries: boolean): FakeRecord {
  const cloned = structuredClone(record);
  cloned.entries.sort((left, right) => left.overallRank - right.overallRank);

  if (reverseEntries) {
    cloned.entries.reverse();
  }

  return cloned;
}

function prismaError(code: string, target: string[]) {
  return { code, meta: { target } };
}

function createCompleteSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "ranking-set-1",
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
