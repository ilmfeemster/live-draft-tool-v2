import { describe, expect, it } from "vitest";
import {
  createRecommendationRankingContext,
  type RecommendationRankingContextResult,
} from "@/lib/recommendationRankingContext";
import type { Position, RankingEntry } from "@/types/draft";
import type {
  RankingSnapshot,
  RankingSourceTierSemantics,
  RankingSourceTierValue,
} from "@/types/rankings";

describe("createRecommendationRankingContext", () => {
  it("normalizes complete source-overall tiers in canonical snapshot order", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: [
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-2", overallRank: 2, tier: 1 },
        { playerId: "player-3", overallRank: 3, tier: 3 },
      ],
    });

    const result = createRecommendationRankingContext(snapshot);

    expectSuccess(result);
    expect(result.context.rankings).toEqual([
      {
        ...snapshot.rankings[0],
        player: { ...snapshot.rankings[0].player },
        overallTier: 1,
        overallTierOrigin: "source",
      },
      {
        ...snapshot.rankings[1],
        player: { ...snapshot.rankings[1].player },
        overallTier: 1,
        overallTierOrigin: "source",
      },
      {
        ...snapshot.rankings[2],
        player: { ...snapshot.rankings[2].player },
        overallTier: 3,
        overallTierOrigin: "source",
      },
    ]);
    expect(result.context.rankings[0].tier).toBe(snapshot.rankings[0].tier);
    expect(result.context.rankings[0].player).not.toBe(snapshot.rankings[0].player);
  });

  it.each([
    ["missing", undefined],
    ["none", "none"],
    ["legacy ambiguous", "legacy-ambiguous"],
  ] as const)(
    "materializes one neutral overall tier for %s source semantics",
    (_label, sourceKind) => {
      const snapshot = createSnapshot({ sourceKind });

      const result = createRecommendationRankingContext(snapshot);

      expectSuccess(result);
      expect(
        result.context.rankings.map((ranking) => ({
          overallTier: ranking.overallTier,
          origin: ranking.overallTierOrigin,
          recommendationTier: ranking.tier,
        })),
      ).toEqual([
        { overallTier: 1, origin: "defaulted-neutral", recommendationTier: 4 },
        { overallTier: 1, origin: "defaulted-neutral", recommendationTier: 6 },
        { overallTier: 1, origin: "defaulted-neutral", recommendationTier: 8 },
      ]);
    },
  );

  it("preserves complete, partial, and absent ADP without inventing values", () => {
    const complete = createSnapshot({ adpRanks: [1.5, 2.5, 3.5] });
    const partial = createSnapshot({ adpRanks: [1.5, null, 3.5] });
    const absent = createSnapshot({ adpRanks: [null, null, null] });

    const completeResult = createRecommendationRankingContext(complete);
    const partialResult = createRecommendationRankingContext(partial);
    const absentResult = createRecommendationRankingContext(absent);

    expectSuccess(completeResult);
    expectSuccess(partialResult);
    expectSuccess(absentResult);
    expect(completeResult.context.rankings.map((ranking) => ranking.adpRank)).toEqual([
      1.5, 2.5, 3.5,
    ]);
    expect(partialResult.context.rankings.map((ranking) => ranking.adpRank)).toEqual([
      1.5, null, 3.5,
    ]);
    expect(absentResult.context.rankings.map((ranking) => ranking.adpRank)).toEqual([
      null, null, null,
    ]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects malformed supplied ADP %s",
    (adpRank) => {
      const snapshot = createSnapshot({ adpRanks: [adpRank, null, null] });

      const result = createRecommendationRankingContext(snapshot);

      expectFailure(result);
      expect(result.errors).toContainEqual({
        code: "invalid-adp",
        path: "rankings[0].adpRank",
        message: "ADP rank must be null or a positive finite number.",
      });
    },
  );

  it("rejects missing source-overall tier coverage", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: [
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-2", overallRank: 2, tier: 1 },
      ],
    });

    const result = createRecommendationRankingContext(snapshot);

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "partial-overall-tiers",
      path: "tierSemantics.source.values",
      message: "Overall tiers are missing for: player-3.",
    });
  });

  it("rejects duplicate source-overall tier coverage", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: [
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-2", overallRank: 2, tier: 1 },
        { playerId: "player-3", overallRank: 3, tier: 2 },
      ],
    });

    const result = createRecommendationRankingContext(snapshot);

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "partial-overall-tiers",
      path: "tierSemantics.source.values[1].playerId",
      message: "Overall tier for player player-1 is duplicated.",
    });
  });

  it.each([
    {
      label: "unknown player",
      values: [
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-2", overallRank: 2, tier: 1 },
        { playerId: "unknown", overallRank: 3, tier: 2 },
      ],
      path: "tierSemantics.source.values[2].playerId",
    },
    {
      label: "mismatched overall rank",
      values: [
        { playerId: "player-1", overallRank: 1, tier: 1 },
        { playerId: "player-2", overallRank: 99, tier: 1 },
        { playerId: "player-3", overallRank: 3, tier: 2 },
      ],
      path: "tierSemantics.source.values[1].overallRank",
    },
  ])("rejects $label in tier metadata", ({ values, path }) => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: values,
    });

    const result = createRecommendationRankingContext(snapshot);

    expectFailure(result);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "tier-entry-mismatch", path }),
      ]),
    );
  });

  it.each([
    {
      label: "zero",
      tiers: [0, 1, 2],
      path: "tierSemantics.source.values[0].tier",
    },
    {
      label: "fractional",
      tiers: [1, 1.5, 2],
      path: "tierSemantics.source.values[1].tier",
    },
    {
      label: "decreasing",
      tiers: [1, 3, 2],
      path: "tierSemantics.source.values[2].tier",
    },
  ])("rejects $label overall tiers", ({ tiers, path }) => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: createSourceValues(tiers),
    });

    const result = createRecommendationRankingContext(snapshot);

    expectFailure(result);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-overall-tiers", path }),
      ]),
    );
  });

  it("preserves valid non-contiguous overall tier labels", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: createSourceValues([1, 4, 9]),
    });

    const result = createRecommendationRankingContext(snapshot);

    expectSuccess(result);
    expect(result.context.rankings.map((ranking) => ranking.overallTier)).toEqual([
      1, 4, 9,
    ]);
  });

  it("is deterministic and does not mutate snapshot inputs on success", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: createSourceValues([1, 1, 2]),
      adpRanks: [1.5, null, 5.5],
    });
    const before = structuredClone(snapshot);

    const first = createRecommendationRankingContext(snapshot);
    const second = createRecommendationRankingContext(snapshot);

    expectSuccess(first);
    expectSuccess(second);
    expect(first.context).toEqual(second.context);
    expect(snapshot).toEqual(before);
  });

  it("does not mutate snapshot inputs on failure", () => {
    const snapshot = createSnapshot({
      sourceKind: "source-overall",
      sourceValues: createSourceValues([2, 1, 3]),
    });
    const before = structuredClone(snapshot);

    expectFailure(createRecommendationRankingContext(snapshot));

    expect(snapshot).toEqual(before);
  });
});

function createSnapshot(
  options: {
    sourceKind?: RankingSourceTierSemantics;
    sourceValues?: readonly RankingSourceTierValue[];
    adpRanks?: readonly (number | null)[];
  } = {},
): RankingSnapshot {
  const rankings: RankingEntry[] = [
    createRanking("player-1", 1, "QB", 4, options.adpRanks?.[0] ?? null),
    createRanking("player-2", 2, "RB", 6, options.adpRanks?.[1] ?? null),
    createRanking("player-3", 3, "WR", 8, options.adpRanks?.[2] ?? null),
  ];

  return {
    rankings,
    ...(options.sourceKind === undefined
      ? {}
      : {
          tierSemantics: {
            source: {
              kind: options.sourceKind,
              ...(options.sourceValues === undefined
                ? {}
                : { values: options.sourceValues }),
            },
            recommendation: {
              QB: "recommendation-position",
              RB: "recommendation-position",
              WR: "recommendation-position",
            },
          },
        }),
  };
}

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
  tier: number,
  adpRank: number | null,
): RankingEntry {
  return {
    player: {
      id,
      name: `Player ${overallRank}`,
      team: "TEAM",
      position,
    },
    overallRank,
    adpRank,
    positionRank: 1,
    tier,
  };
}

function createSourceValues(tiers: readonly number[]): RankingSourceTierValue[] {
  return tiers.map((tier, index) => ({
    playerId: `player-${index + 1}`,
    overallRank: index + 1,
    tier,
  }));
}

function expectSuccess(
  result: RecommendationRankingContextResult,
): asserts result is Extract<RecommendationRankingContextResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

function expectFailure(
  result: RecommendationRankingContextResult,
): asserts result is Extract<RecommendationRankingContextResult, { ok: false }> {
  expect(result.ok).toBe(false);
}
