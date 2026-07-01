import { describe, expect, it } from "vitest";
import {
  copyRankingEntries,
  createRankingSnapshotFromRankingSet,
  parsePersistedDraftRankingSnapshotJson,
  parseRankingSnapshotJson,
  serializeRankingSnapshot,
} from "@/lib/rankingSnapshot";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSnapshot,
} from "@/types/rankings";

describe("ranking snapshot mappers", () => {
  it("creates a managed ranking snapshot with copied entries, capabilities, and provenance", () => {
    const capturedAt = new Date("2026-06-29T12:00:00.000Z");
    const rankingSet = createManagedRankingSet();

    const result = createRankingSnapshotFromRankingSet(rankingSet, {
      capturedAt,
    });

    expectSuccess(result);
    expect(result.snapshot).toEqual({
      rankings: rankingSet.entries,
      capabilities: rankingSet.capabilities,
      tierSemantics: rankingSet.tierSemantics,
      sourceRankingSetId: rankingSet.id,
      sourceRankingSetName: rankingSet.name,
      capturedAt,
    });
    expect(result.snapshot.rankings).not.toBe(rankingSet.entries);
    expect(result.snapshot.rankings[0]).not.toBe(rankingSet.entries[0]);
    expect(result.snapshot.rankings[0].player).not.toBe(
      rankingSet.entries[0].player,
    );
    expect(result.snapshot.capabilities).not.toBe(rankingSet.capabilities);
    expect(result.snapshot.capabilities?.tiers).not.toBe(
      rankingSet.capabilities.tiers,
    );
    expect(result.snapshot.tierSemantics).not.toBe(rankingSet.tierSemantics);
    expect(result.snapshot.tierSemantics?.source.values).not.toBe(
      rankingSet.tierSemantics?.source.values,
    );
    expect(result.snapshot.capturedAt).not.toBe(capturedAt);
  });

  it("isolates snapshots from later source ranking mutations", () => {
    const capturedAt = new Date("2026-06-29T12:00:00.000Z");
    const rankingSet = createManagedRankingSet();
    const result = createRankingSnapshotFromRankingSet(rankingSet, {
      capturedAt,
    });

    expectSuccess(result);
    const before = structuredClone(result.snapshot);

    rankingSet.entries[0].player.name = "Changed Player";
    rankingSet.entries[0].overallRank = 99;
    mutateCapabilities(rankingSet.capabilities).tiers.QB = "defaulted-neutral";
    mutateCapabilities(rankingSet.capabilities).team = "none";
    capturedAt.setUTCFullYear(2030);

    expect(result.snapshot).toEqual(before);
  });

  it("creates a valid capture timestamp when one is not provided", () => {
    const result = createRankingSnapshotFromRankingSet(createManagedRankingSet());

    expectSuccess(result);
    expect(result.snapshot.capturedAt).toBeInstanceOf(Date);
    expect(result.snapshot.capturedAt?.getTime()).not.toBeNaN();
  });

  it("returns structured errors for invalid managed ranking sets", () => {
    const result = createRankingSnapshotFromRankingSet(
      createManagedRankingSet({
        entries: [],
        capabilities: createCapabilities({ tiers: {} }),
      }),
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "invalid-ranking-set",
      path: "entries",
      message: "Ranking set entries must be a non-empty array.",
    });
  });

  it("copies ranking entries without sharing entry or player references", () => {
    const rankings = [
      createRanking("player-1", 1, "QB", {
        adpRank: null,
        positionRank: 1,
        tier: NEUTRAL_TIER,
        team: UNKNOWN_TEAM,
      }),
      createRanking("player-2", 2, "RB", {
        adpRank: 8.5,
        positionRank: 1,
        tier: 3,
        team: "SEA",
      }),
    ];

    const copiedRankings = copyRankingEntries(rankings);

    expect(copiedRankings).toEqual(rankings);
    expect(copiedRankings).not.toBe(rankings);
    expect(copiedRankings[0]).not.toBe(rankings[0]);
    expect(copiedRankings[0].player).not.toBe(rankings[0].player);
  });

  it("round-trips rankings without losing ranking or player fields", () => {
    const rankings = [
      createRanking("player-1", 1, "WR", {
        adpRank: 3,
        positionRank: 1,
        tier: 1,
        name: "Player One",
        team: "ONE",
      }),
      createRanking("player-2", 2, "RB", {
        adpRank: 4,
        positionRank: 1,
        tier: 2,
        name: "Player Two",
        team: "TWO",
      }),
    ];

    const snapshot = serializeRankingSnapshot(rankings);
    const parsedRankings = parseRankingSnapshotJson(snapshot);

    expect(parsedRankings).toEqual(rankings);
  });

  it("neutralizes only persisted draft tiers while preserving all other values", () => {
    const rankings = [
      createRanking("player-1", 1, "WR", {
        adpRank: 3.5,
        positionRank: 1,
        tier: 2,
        name: "Player One",
        team: "ONE",
      }),
      createRanking("player-2", 2, "RB", {
        adpRank: null,
        positionRank: 1,
        tier: 4,
        name: "Player Two",
        team: "TWO",
      }),
    ];
    const serialized = serializeRankingSnapshot(rankings);
    const parsed = parsePersistedDraftRankingSnapshotJson(serialized);

    expect(parsed.rankings).toEqual([
      { ...rankings[0], player: { ...rankings[0].player }, tier: NEUTRAL_TIER },
      { ...rankings[1], player: { ...rankings[1].player }, tier: NEUTRAL_TIER },
    ]);
    expect(parsed.tierSemantics).toEqual({
      source: {
        kind: "legacy-ambiguous",
        values: [
          { playerId: "player-1", overallRank: 1, tier: 2 },
          { playerId: "player-2", overallRank: 2, tier: 4 },
        ],
      },
      recommendation: { WR: "neutral", RB: "neutral" },
    });
    expect(parsed.rankings).not.toBe(rankings);
    expect(parsed.rankings[0]).not.toBe(rankings[0]);
    expect(parsed.rankings[0].player).not.toBe(rankings[0].player);
    expect(rankings.map((entry) => entry.tier)).toEqual([2, 4]);
  });

  it("keeps persisted draft parser errors aligned with generic parsing", () => {
    expect(() =>
      parsePersistedDraftRankingSnapshotJson({ rankings: [] }),
    ).toThrow("Ranking snapshot schemaVersion must be 2.");
  });

  it("preserves null ADP ranks", () => {
    const rankings = [createRanking("player-1", 1, "QB", { adpRank: null })];

    const parsedRankings = parseRankingSnapshotJson(
      serializeRankingSnapshot(rankings),
    );

    expect(parsedRankings[0].adpRank).toBeNull();
  });

  it("serializes to fresh objects instead of reusing input references", () => {
    const rankings = [createRanking("player-1", 1, "TE")];
    const snapshot = serializeRankingSnapshot(rankings);

    expect(snapshot).toEqual(rankings);
    const firstRanking = snapshot[0];

    if (!firstRanking || typeof firstRanking !== "object" || Array.isArray(firstRanking)) {
      throw new Error("Expected serialized rankings to contain a ranking object.");
    }

    const player = firstRanking.player;

    if (!player || typeof player !== "object" || Array.isArray(player)) {
      throw new Error("Expected serialized ranking to contain a player object.");
    }

    expect(firstRanking).not.toBe(rankings[0]);
    expect(player).not.toBe(rankings[0].player);
  });

  it("round-trips source-only semantics in a V2 envelope without recommendation pressure", () => {
    const rankingSet = createManagedRankingSet({
      capabilities: createCapabilities({
        tiers: { QB: "defaulted-neutral", RB: "defaulted-neutral" },
      }),
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: [
            { playerId: "player-qb", overallRank: 1, tier: 2 },
            { playerId: "player-rb", overallRank: 2, tier: 3 },
            { playerId: "player-qb-2", overallRank: 3, tier: 4 },
          ],
        },
        recommendation: { QB: "neutral", RB: "neutral" },
      },
      entries: [
        createRanking("player-qb", 1, "QB", {
          positionRank: 1,
          tier: 1,
          adpRank: 1.5,
        }),
        createRanking("player-rb", 2, "RB", {
          positionRank: 1,
          tier: 1,
          adpRank: 2.5,
        }),
        createRanking("player-qb-2", 3, "QB", {
          positionRank: 2,
          tier: 1,
          adpRank: 3.5,
        }),
      ],
    });
    const created = createRankingSnapshotFromRankingSet(rankingSet, {
      capturedAt: new Date("2026-06-29T12:00:00.000Z"),
    });

    expectSuccess(created);
    const serialized = serializeRankingSnapshot(created.snapshot);
    const parsed = parsePersistedDraftRankingSnapshotJson(serialized);

    expect(serialized.schemaVersion).toBe(2);
    expect(serialized.tierSemantics.source.values?.map((value) => value.tier)).toEqual([
      2, 3, 4,
    ]);
    expect(serialized.rankings.every((entry) => entry.tier === NEUTRAL_TIER)).toBe(
      true,
    );
    expect(parsed).toEqual(created.snapshot);
  });

  it("round-trips mixed eligible and neutral recommendation positions", () => {
    const rankingSet = createManagedRankingSet({
      capabilities: createCapabilities({
        tiers: { QB: "source", RB: "defaulted-neutral" },
      }),
      tierSemantics: {
        source: { kind: "none" },
        recommendation: {
          QB: "recommendation-position",
          RB: "neutral",
        },
      },
      entries: [
        createRanking("player-qb", 1, "QB", {
          positionRank: 1,
          tier: 1,
          adpRank: 1.5,
        }),
        createRanking("player-rb", 2, "RB", {
          positionRank: 1,
          tier: 1,
          adpRank: 2.5,
        }),
        createRanking("player-qb-2", 3, "QB", {
          positionRank: 2,
          tier: 3,
          adpRank: 3.5,
        }),
      ],
    });
    const created = createRankingSnapshotFromRankingSet(rankingSet, {
      capturedAt: new Date("2026-06-29T12:00:00.000Z"),
    });

    expectSuccess(created);
    const parsed = parsePersistedDraftRankingSnapshotJson(
      serializeRankingSnapshot(created.snapshot),
    );

    expect(parsed.rankings.map((entry) => entry.tier)).toEqual([1, 1, 3]);
    expect(parsed.tierSemantics?.recommendation).toEqual({
      QB: "recommendation-position",
      RB: "neutral",
    });
  });

  it("materializes missing semantics as legacy ambiguous and neutral", () => {
    const rankingSet = createManagedRankingSet({ tierSemantics: undefined });
    const created = createRankingSnapshotFromRankingSet(rankingSet, {
      capturedAt: new Date("2026-06-29T12:00:00.000Z"),
    });

    expectSuccess(created);
    expect(created.snapshot.rankings.map((entry) => entry.tier)).toEqual([
      NEUTRAL_TIER,
      NEUTRAL_TIER,
      NEUTRAL_TIER,
    ]);
    expect(created.snapshot.capabilities?.tiers).toEqual({
      QB: "defaulted-neutral",
      RB: "defaulted-neutral",
    });
    expect(created.snapshot.tierSemantics).toEqual({
      source: {
        kind: "legacy-ambiguous",
        values: [
          { playerId: "player-qb", overallRank: 1, tier: 1 },
          { playerId: "player-rb", overallRank: 2, tier: 2 },
          { playerId: "player-qb-2", overallRank: 3, tier: 3 },
        ],
      },
      recommendation: { QB: "neutral", RB: "neutral" },
    });
  });

  it("rejects malformed or contradictory V2 tier metadata", () => {
    const snapshot = createExplicitSnapshot();
    const missingPosition = structuredClone(serializeRankingSnapshot(snapshot));
    const nonNeutralFallback = structuredClone(serializeRankingSnapshot(snapshot));
    const invalidSourceReference = structuredClone(
      serializeRankingSnapshot(snapshot),
    );

    delete (missingPosition.tierSemantics.recommendation as Partial<
      Record<Position, string>
    >).RB;
    (nonNeutralFallback.tierSemantics.recommendation as Partial<
      Record<Position, string>
    >).QB = "neutral";
    if (nonNeutralFallback.capabilities) {
      (nonNeutralFallback.capabilities.tiers as Partial<
        Record<Position, string>
      >).QB = "defaulted-neutral";
    }
    const sourceValue = invalidSourceReference.tierSemantics.source.values?.[0];
    if (!sourceValue) {
      throw new Error("Expected a source tier fixture value.");
    }
    (sourceValue as { playerId: string }).playerId = "missing-player";

    expect(() =>
      parsePersistedDraftRankingSnapshotJson(missingPosition),
    ).toThrow("RB recommendation tier semantics are unsupported");
    expect(() =>
      parsePersistedDraftRankingSnapshotJson(nonNeutralFallback),
    ).toThrow("defaulted-neutral tiers must all equal");
    expect(() =>
      parsePersistedDraftRankingSnapshotJson(invalidSourceReference),
    ).toThrow("does not match a canonical entry");
  });

  it("rejects non-array snapshots", () => {
    expect(() => parseRankingSnapshotJson({ rankings: [] })).toThrow(
      "Ranking snapshot must be an array.",
    );
  });

  it("rejects entries missing required player fields", () => {
    const snapshot = [
      {
        player: {
          id: "player-1",
          team: "ONE",
          position: "WR",
        },
        overallRank: 1,
        adpRank: null,
        positionRank: 1,
        tier: 1,
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.player.name must be a string.",
    );
  });

  it("rejects invalid position values", () => {
    const snapshot = [
      {
        ...createRanking("player-1", 1, "WR"),
        player: {
          ...createRanking("player-1", 1, "WR").player,
          position: "CB",
        },
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.player.position must be a valid position.",
    );
  });

  it("rejects invalid rank field types", () => {
    const snapshot = [
      {
        ...createRanking("player-1", 1, "WR"),
        overallRank: "1",
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.overallRank must be a number.",
    );
  });
});

type RankingSnapshotResult = ReturnType<typeof createRankingSnapshotFromRankingSet>;

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
  options: Partial<
    Pick<RankingEntry, "adpRank" | "positionRank" | "tier"> & {
      name: string;
      team: string;
    }
  > = {},
): RankingEntry {
  return {
    player: {
      id,
      name: options.name ?? id,
      team: options.team ?? "TEST",
      position,
    },
    overallRank,
    adpRank: options.adpRank ?? null,
    positionRank: options.positionRank ?? overallRank,
    tier: options.tier ?? 1,
  };
}

function createManagedRankingSet(
  overrides: Partial<RankingSet> = {},
): RankingSet {
  const createdAt = new Date("2026-06-28T12:00:00.000Z");

  return {
    id: "rankings-1",
    name: "Managed Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: createdAt,
    },
    capabilities: createCapabilities(),
    tierSemantics: {
      source: {
        kind: "source-overall",
        values: [
          { playerId: "player-qb", overallRank: 1, tier: 1 },
          { playerId: "player-rb", overallRank: 2, tier: 2 },
          { playerId: "player-qb-2", overallRank: 3, tier: 3 },
        ],
      },
      recommendation: {
        QB: "recommendation-position",
        RB: "recommendation-position",
      },
    },
    entries: [
      createRanking("player-qb", 1, "QB", {
        positionRank: 1,
        tier: 1,
        adpRank: 1.5,
      }),
      createRanking("player-rb", 2, "RB", {
        positionRank: 1,
        tier: 2,
        adpRank: 2.5,
      }),
      createRanking("player-qb-2", 3, "QB", {
        positionRank: 2,
        tier: 3,
        adpRank: 3.5,
      }),
    ],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createExplicitSnapshot(): RankingSnapshot {
  const created = createRankingSnapshotFromRankingSet(createManagedRankingSet(), {
    capturedAt: new Date("2026-06-29T12:00:00.000Z"),
  });

  expectSuccess(created);
  return created.snapshot;
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

function mutateCapabilities(
  capabilities: RankingSetCapabilities,
): {
  team: RankingSetCapabilities["team"];
  tiers: Record<string, RankingSetCapabilities["tiers"][Position]>;
} {
  return capabilities as {
    team: RankingSetCapabilities["team"];
    tiers: Record<string, RankingSetCapabilities["tiers"][Position]>;
  };
}

function expectSuccess(
  result: RankingSnapshotResult,
): asserts result is Extract<RankingSnapshotResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success, received ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: RankingSnapshotResult,
): asserts result is Extract<RankingSnapshotResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected ranking snapshot creation failure.");
  }
}
