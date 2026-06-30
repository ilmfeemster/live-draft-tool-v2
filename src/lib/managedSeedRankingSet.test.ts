import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import {
  bootstrapManagedSeedRankingSet,
  buildManagedSeedRankingSet,
  getManagedSeedRankingSet,
  MANAGED_SEED_RANKING_SET_ID,
  MANAGED_SEED_RANKING_SET_NAME,
  type ManagedSeedRankingSetRepository,
} from "@/lib/managedSeedRankingSet";
import {
  generatePlayerRecommendations,
} from "@/lib/recommendations";
import type {
  CreateRankingSetResult,
  ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import type { Draft, RankingEntry } from "@/types/draft";
import type { RankingSet } from "@/types/rankings";

describe("managed seed ranking set", () => {
  const timestamp = new Date("2026-06-29T12:00:00.000Z");

  it("builds the current seed rankings as one valid managed ranking set", () => {
    const rankingSet = buildManagedSeedRankingSet(timestamp);
    const representedPositions = new Set(
      seedRankings.map((entry) => entry.player.position),
    );

    expect(rankingSet).toMatchObject({
      id: MANAGED_SEED_RANKING_SET_ID,
      name: MANAGED_SEED_RANKING_SET_NAME,
      source: {
        kind: "seed",
        formatId: "fantasypros-csv",
        formatVersion: 1,
        label: "FantasyPros_2026_Draft_ALL_Rankings.csv",
        importedAt: timestamp,
      },
      capabilities: {
        team: "complete",
        playerIdentity: "provided",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "partial",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(rankingSet.entries).toEqual(seedRankings);
    expect(rankingSet.entries).not.toBe(seedRankings);
    expect(rankingSet.entries[0]).not.toBe(seedRankings[0]);
    expect(rankingSet.entries[0]?.player).not.toBe(seedRankings[0]?.player);
    expect(rankingSet.capabilities.tiers).toEqual(
      Object.fromEntries(
        [...representedPositions].sort().map((position) => [position, "source"]),
      ),
    );
    expect(
      Object.values(rankingSet.capabilities.tiers).every(
        (capability) => capability === "source",
      ),
    ).toBe(true);
  });

  it("returns seed values that are independently owned", () => {
    const rankingSet = buildManagedSeedRankingSet(timestamp);
    const mutableEntry = rankingSet.entries[0] as RankingEntry;

    mutableEntry.player.name = "Changed Locally";

    expect(seedRankings[0]?.player.name).toBe("Ja'Marr Chase");
  });

  it("creates the managed seed set when it is missing and loads it by stable id", async () => {
    const fake = createFakeSeedRepository();

    const result = await bootstrapManagedSeedRankingSet(fake.repository, timestamp);
    const loaded = await getManagedSeedRankingSet(fake.repository);

    expect(result).toEqual({
      ok: true,
      rankingSet: buildManagedSeedRankingSet(timestamp),
      created: true,
      replaced: false,
    });
    expect(loaded).toEqual(buildManagedSeedRankingSet(timestamp));
    expect(fake.createCount).toBe(1);
    expect(fake.replaceCount).toBe(0);
    expect(fake.records).toHaveLength(1);
  });

  it("does not duplicate an equivalent managed seed set on repeated bootstrap", async () => {
    const fake = createFakeSeedRepository();

    await bootstrapManagedSeedRankingSet(fake.repository, timestamp);
    const repeated = await bootstrapManagedSeedRankingSet(fake.repository, timestamp);

    expect(repeated).toEqual({
      ok: true,
      rankingSet: buildManagedSeedRankingSet(timestamp),
      created: false,
      replaced: false,
    });
    expect(fake.createCount).toBe(1);
    expect(fake.replaceCount).toBe(0);
    expect(fake.records).toHaveLength(1);
  });

  it("replaces a stale managed seed set under the same local id", async () => {
    const fake = createFakeSeedRepository();
    const stale = {
      ...buildManagedSeedRankingSet(new Date("2026-06-28T12:00:00.000Z")),
      name: "Old Seed Rankings",
      entries: seedRankings.slice(1).map(cloneEntry),
    };
    fake.records.push(cloneRankingSet(stale));

    const result = await bootstrapManagedSeedRankingSet(fake.repository, timestamp);

    expect(result).toEqual({
      ok: true,
      rankingSet: buildManagedSeedRankingSet(timestamp),
      created: false,
      replaced: true,
    });
    expect(fake.createCount).toBe(0);
    expect(fake.replaceCount).toBe(1);
    expect(fake.records).toEqual([buildManagedSeedRankingSet(timestamp)]);
  });

  it("returns explicit failures when the repository rejects create or replace", async () => {
    const conflictFake = createFakeSeedRepository();
    conflictFake.createResult = {
      ok: false,
      errors: [
        {
          code: "name-conflict",
          message: "A ranking set with this name already exists.",
          path: "name",
        },
      ],
    };

    await expect(
      bootstrapManagedSeedRankingSet(conflictFake.repository, timestamp),
    ).resolves.toEqual({
      ok: false,
      errors: [
        {
          code: "name-conflict",
          message: "A ranking set with this name already exists.",
          path: "name",
        },
      ],
    });
    expect(conflictFake.records).toEqual([]);

    const notFoundFake = createFakeSeedRepository();
    notFoundFake.records.push(
      buildManagedSeedRankingSet(new Date("2026-06-28T12:00:00.000Z")),
    );
    notFoundFake.replaceResult = {
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
      bootstrapManagedSeedRankingSet(notFoundFake.repository, timestamp),
    ).resolves.toEqual({
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    });
    expect(notFoundFake.records).toHaveLength(1);
  });

  it("returns an explicit failure when the seed aggregate cannot be built", async () => {
    const fake = createFakeSeedRepository();

    await expect(
      bootstrapManagedSeedRankingSet(fake.repository, new Date("invalid")),
    ).resolves.toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-seed-ranking-set",
          message: "Managed seed ranking set timestamp must be a valid Date.",
        },
      ],
    });
    expect(fake.createCount).toBe(0);
    expect(fake.replaceCount).toBe(0);
    expect(fake.records).toEqual([]);
  });

  it("keeps recommendation output identical to the legacy seed array", () => {
    const managedSeed = buildManagedSeedRankingSet(timestamp);
    const draft = createRecommendationDraft();
    const legacyRecommendations = generatePlayerRecommendations({
      draft,
      rankings: seedRankings,
      leagueSettings: defaultLeagueSettings,
      userTeamId: "team-1",
    });
    const managedRecommendations = generatePlayerRecommendations({
      draft,
      rankings: managedSeed.entries.map(cloneEntry),
      leagueSettings: defaultLeagueSettings,
      userTeamId: "team-1",
    });

    expect(managedRecommendations).toEqual(legacyRecommendations);
  });
});

function createFakeSeedRepository() {
  const state = {
    records: [] as RankingSet[],
    createCount: 0,
    replaceCount: 0,
    createResult: undefined as CreateRankingSetResult | undefined,
    replaceResult: undefined as ReplaceRankingSetResult | undefined,
  };

  const repository: ManagedSeedRankingSetRepository = {
    async createRankingSet(rankingSet) {
      state.createCount += 1;

      if (state.createResult) {
        return state.createResult;
      }

      if (
        state.records.some(
          (record) =>
            normalizeName(record.name) === normalizeName(rankingSet.name),
        )
      ) {
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

      state.records.push(cloneRankingSet(rankingSet));
      return { ok: true, rankingSet: cloneRankingSet(rankingSet) };
    },

    async replaceRankingSet(rankingSet) {
      state.replaceCount += 1;

      if (state.replaceResult) {
        return state.replaceResult;
      }

      const index = state.records.findIndex(
        (record) => record.id === rankingSet.id,
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

      state.records[index] = cloneRankingSet(rankingSet);
      return { ok: true, rankingSet: cloneRankingSet(rankingSet) };
    },

    async getRankingSetById(id) {
      const record = state.records.find((candidate) => candidate.id === id);
      return record ? cloneRankingSet(record) : null;
    },
  };

  return {
    repository,
    get records() {
      return state.records;
    },
    get createCount() {
      return state.createCount;
    },
    get replaceCount() {
      return state.replaceCount;
    },
    set createResult(value: CreateRankingSetResult | undefined) {
      state.createResult = value;
    },
    set replaceResult(value: ReplaceRankingSetResult | undefined) {
      state.replaceResult = value;
    },
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
    capabilities: {
      ...rankingSet.capabilities,
      tiers: { ...rankingSet.capabilities.tiers },
    },
    entries: rankingSet.entries.map(cloneEntry),
    createdAt: new Date(rankingSet.createdAt),
    updatedAt: new Date(rankingSet.updatedAt),
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

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function createRecommendationDraft(): Draft {
  return {
    id: "draft-1",
    teamCount: 12,
    rounds: 16,
    userTeamId: "team-1",
    currentPickNumber: 8,
    teams: Array.from({ length: 12 }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      draftPosition: index + 1,
    })),
    picks: Array.from({ length: 192 }, (_, index) => ({
      pickNumber: index + 1,
      round: Math.floor(index / 12) + 1,
      pickInRound: (index % 12) + 1,
      teamId: `team-${(index % 12) + 1}`,
      ...(index === 1 ? { playerId: seedRankings[1]?.player.id } : {}),
      ...(index === 4 ? { playerId: seedRankings[4]?.player.id } : {}),
      ...(index === 6 ? { playerId: seedRankings[6]?.player.id } : {}),
    })),
  };
}
