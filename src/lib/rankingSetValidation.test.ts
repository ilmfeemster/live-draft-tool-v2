import { describe, expect, it } from "vitest";
import {
  validateRankingSet,
  type RankingSetValidationResult,
} from "@/lib/rankingSetValidation";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
} from "@/types/rankings";

describe("validateRankingSet", () => {
  it("accepts a complete canonical ranking set and preserves its reference", () => {
    const rankingSet = createCompleteRankingSet();
    const before = structuredClone(rankingSet);

    const result = validateRankingSet(rankingSet);

    expectSuccess(result);
    expect(result.rankingSet).toBe(rankingSet);
    expect(rankingSet).toEqual(before);
  });

  it("accepts deterministic neutral fallbacks and absent optional data", () => {
    const rankingSet = createDegradedRankingSet();

    const result = validateRankingSet(rankingSet);

    expectSuccess(result);
    expect(result.rankingSet.capabilities).toEqual({
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
  });

  it("accepts partial team and ADP availability", () => {
    const rankingSet = createCompleteRankingSet({
      entries: [
        createEntry("qb-1", 1, "QB", 1, 1, { team: UNKNOWN_TEAM, adpRank: null }),
        createEntry("rb-1", 2, "RB", 1, 1),
        createEntry("qb-2", 3, "QB", 2, 2),
      ],
      capabilities: createCapabilities({ team: "partial", adp: "partial" }),
    });

    expectSuccess(validateRankingSet(rankingSet));
  });

  it("returns metadata failures in deterministic order", () => {
    const rankingSet = createCompleteRankingSet({
      id: " ",
      name: "",
      source: {
        kind: "provider" as RankingSet["source"]["kind"],
        formatId: " ",
        formatVersion: 0,
        label: "",
        importedAt: new Date(Number.NaN),
      },
      createdAt: new Date(Number.NaN),
      updatedAt: new Date(Number.NaN),
    });

    const result = validateRankingSet(rankingSet);

    expectFailure(result);
    expect(result.errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid-id", path: "id" },
      { code: "invalid-name", path: "name" },
      { code: "invalid-source", path: "source.kind" },
      { code: "invalid-source", path: "source.formatId" },
      { code: "invalid-source", path: "source.label" },
      { code: "invalid-source", path: "source.formatVersion" },
      { code: "invalid-source", path: "source.importedAt" },
      { code: "invalid-date", path: "createdAt" },
      { code: "invalid-date", path: "updatedAt" },
    ]);
  });

  it("rejects updatedAt earlier than createdAt", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        createdAt: new Date("2026-06-28T12:00:00.000Z"),
        updatedAt: new Date("2026-06-28T11:59:59.000Z"),
      }),
    );

    expectError(result, "invalid-date", "updatedAt");
  });

  it("rejects an empty entry collection", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        entries: [],
        capabilities: createCapabilities({ tiers: {} }),
      }),
    );

    expectError(result, "empty-entries", "entries");
  });

  it("rejects invalid player fields and duplicate player IDs", () => {
    const entries = [...createCompleteRankingSet().entries];
    entries[0] = {
      ...entries[0],
      player: {
        id: " ",
        name: "",
        team: " ",
        position: "DL" as Position,
      },
    };
    entries[1] = {
      ...entries[1],
      player: { ...entries[1].player, id: entries[2].player.id },
    };

    const result = validateRankingSet(createCompleteRankingSet({ entries }));

    expectFailure(result);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-player-id", path: "entries[0].player.id" }),
        expect.objectContaining({ code: "invalid-player-name", path: "entries[0].player.name" }),
        expect.objectContaining({ code: "invalid-team", path: "entries[0].player.team" }),
        expect.objectContaining({ code: "invalid-position", path: "entries[0].player.position" }),
        expect.objectContaining({ code: "duplicate-player-id", path: "entries[2].player.id" }),
      ]),
    );
  });

  it("rejects non-canonical overall and interleaved position ranks", () => {
    const entries = [...createCompleteRankingSet().entries];
    entries[1] = { ...entries[1], overallRank: 1 };
    entries[2] = { ...entries[2], positionRank: 3 };

    const result = validateRankingSet(createCompleteRankingSet({ entries }));

    expectError(result, "invalid-overall-rank", "entries[1].overallRank");
    expectError(result, "invalid-position-rank", "entries[2].positionRank");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid ADP value %s",
    (adpRank) => {
      const entries = [...createCompleteRankingSet().entries];
      entries[0] = { ...entries[0], adpRank };

      expectError(
        validateRankingSet(createCompleteRankingSet({ entries })),
        "invalid-adp-rank",
        "entries[0].adpRank",
      );
    },
  );

  it.each([0, -1, 1.5])("rejects invalid tier value %s", (tier) => {
    const entries = [...createCompleteRankingSet().entries];
    entries[0] = { ...entries[0], tier };

    expectError(
      validateRankingSet(createCompleteRankingSet({ entries })),
      "invalid-tier",
      "entries[0].tier",
    );
  });

  it("rejects tiers that decrease within an interleaved position", () => {
    const entries = [...createCompleteRankingSet().entries];
    entries[0] = { ...entries[0], tier: 2 };
    entries[2] = { ...entries[2], tier: 1 };

    expectError(
      validateRankingSet(createCompleteRankingSet({ entries })),
      "invalid-tier",
      "entries[2].tier",
    );
  });

  it("rejects team and ADP capability mismatches", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        capabilities: createCapabilities({ team: "none", adp: "partial" }),
      }),
    );

    expectFailure(result);
    expect(result.errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid-capability", path: "capabilities.team" },
      { code: "invalid-capability", path: "capabilities.adp" },
    ]);
  });

  it("rejects unsupported capability values", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        capabilities: {
          team: "sometimes" as RankingSetCapabilities["team"],
          playerIdentity: "mapped" as RankingSetCapabilities["playerIdentity"],
          overallOrder: "sorted" as RankingSetCapabilities["overallOrder"],
          positionRank: "source" as RankingSetCapabilities["positionRank"],
          adp: "sometimes" as RankingSetCapabilities["adp"],
          tiers: { QB: "calculated" as RankingSetCapabilities["tiers"]["QB"], RB: "source" },
        },
      }),
    );

    expectFailure(result);
    expect(result.errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid-capability", path: "capabilities.team" },
      { code: "invalid-capability", path: "capabilities.playerIdentity" },
      { code: "invalid-capability", path: "capabilities.overallOrder" },
      { code: "invalid-capability", path: "capabilities.positionRank" },
      { code: "invalid-capability", path: "capabilities.adp" },
      { code: "invalid-capability", path: "capabilities.tiers.QB" },
    ]);
  });

  it("requires tier capabilities for exactly the represented positions", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        capabilities: createCapabilities({
          tiers: { QB: "source", WR: "source" },
        }),
      }),
    );

    expectFailure(result);
    expect(result.errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid-capability", path: "capabilities.tiers.RB" },
      { code: "invalid-capability", path: "capabilities.tiers.WR" },
    ]);
  });

  it("requires every defaulted-neutral tier to equal the neutral tier", () => {
    const result = validateRankingSet(
      createCompleteRankingSet({
        capabilities: createCapabilities({
          tiers: { QB: "defaulted-neutral", RB: "source" },
        }),
      }),
    );

    expectError(result, "invalid-capability", "capabilities.tiers.QB");
  });

  it("returns independent entry failures in stable array and field order", () => {
    const entries = [...createCompleteRankingSet().entries];
    entries[0] = {
      ...entries[0],
      player: { ...entries[0].player, id: "", name: "" },
      overallRank: 2,
      positionRank: 2,
      adpRank: 0,
      tier: 0,
    };

    const result = validateRankingSet(createCompleteRankingSet({ entries }));

    expectFailure(result);
    expect(result.errors.slice(0, 6).map(({ code, path }) => ({ code, path }))).toEqual([
      { code: "invalid-player-id", path: "entries[0].player.id" },
      { code: "invalid-player-name", path: "entries[0].player.name" },
      { code: "invalid-overall-rank", path: "entries[0].overallRank" },
      { code: "invalid-position-rank", path: "entries[0].positionRank" },
      { code: "invalid-adp-rank", path: "entries[0].adpRank" },
      { code: "invalid-tier", path: "entries[0].tier" },
    ]);
  });
});

function createCompleteRankingSet(
  overrides: Partial<RankingSet> = {},
): RankingSet {
  const createdAt = new Date("2026-06-28T12:00:00.000Z");

  return {
    id: "rankings-1",
    name: "Complete Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: createdAt,
    },
    capabilities: createCapabilities(),
    entries: [
      createEntry("qb-1", 1, "QB", 1, 1),
      createEntry("rb-1", 2, "RB", 1, 1),
      createEntry("qb-2", 3, "QB", 2, 2),
    ],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createDegradedRankingSet(): RankingSet {
  const createdAt = new Date("2026-06-28T12:00:00.000Z");

  return {
    id: "rankings-degraded",
    name: "Degraded Rankings",
    source: { kind: "external", formatId: "minimal-csv", formatVersion: 1 },
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
      createEntry("generated-qb", 1, "QB", 1, NEUTRAL_TIER, {
        team: UNKNOWN_TEAM,
        adpRank: null,
      }),
      createEntry("generated-rb", 2, "RB", 1, NEUTRAL_TIER, {
        team: UNKNOWN_TEAM,
        adpRank: null,
      }),
    ],
    createdAt,
    updatedAt: createdAt,
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
  overrides: { team?: string; adpRank?: number | null } = {},
): RankingEntry {
  return {
    player: {
      id,
      name: `Player ${id}`,
      team: overrides.team ?? "SEA",
      position,
    },
    overallRank,
    adpRank: overrides.adpRank === undefined ? overallRank + 0.5 : overrides.adpRank,
    positionRank,
    tier,
  };
}

function expectSuccess(
  result: RankingSetValidationResult,
): asserts result is Extract<RankingSetValidationResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success, received ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: RankingSetValidationResult,
): asserts result is Extract<RankingSetValidationResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected ranking-set validation failure.");
  }
}

function expectError(
  result: RankingSetValidationResult,
  code: string,
  path: string,
): void {
  expectFailure(result);
  expect(result.errors).toContainEqual(expect.objectContaining({ code, path }));
}
