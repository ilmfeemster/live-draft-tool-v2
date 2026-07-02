import type {
  RankingEntry,
  RecommendationOverallTierOrigin,
  RecommendationRankingContext,
  RecommendationRankingContextError,
  RecommendationRankingContextResult,
  RecommendationRankingFact,
} from "@/types/draft";
import type {
  RankingSnapshot,
  RankingSourceTierValue,
} from "@/types/rankings";

export type {
  RecommendationRankingContextError,
  RecommendationRankingContextErrorCode,
  RecommendationRankingContextResult,
} from "@/types/draft";

const DEFAULT_NEUTRAL_OVERALL_TIER = 1;

export function createRecommendationRankingContext(
  snapshot: RankingSnapshot,
): RecommendationRankingContextResult {
  const errors = validateAdp(snapshot.rankings);
  const source = snapshot.tierSemantics?.source;

  if (!source || source.kind !== "source-overall") {
    return errors.length > 0
      ? { ok: false, errors }
      : {
          ok: true,
          context: buildContext(
            snapshot.rankings,
            () => DEFAULT_NEUTRAL_OVERALL_TIER,
            "defaulted-neutral",
          ),
        };
  }

  const sourceTierResult = validateSourceOverallTiers(
    snapshot.rankings,
    source.values,
  );
  errors.push(...sourceTierResult.errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    context: buildContext(
      snapshot.rankings,
      (ranking) => sourceTierResult.tiersByPlayerId.get(ranking.player.id) as number,
      "source",
    ),
  };
}

function validateAdp(
  rankings: readonly RankingEntry[],
): RecommendationRankingContextError[] {
  return rankings.flatMap((ranking, index) => {
    if (
      ranking.adpRank === null ||
      (typeof ranking.adpRank === "number" &&
        Number.isFinite(ranking.adpRank) &&
        ranking.adpRank > 0)
    ) {
      return [];
    }

    return [
      {
        code: "invalid-adp" as const,
        path: `rankings[${index}].adpRank`,
        message: "ADP rank must be null or a positive finite number.",
      },
    ];
  });
}

function validateSourceOverallTiers(
  rankings: readonly RankingEntry[],
  sourceValues: readonly RankingSourceTierValue[] | undefined,
): {
  tiersByPlayerId: Map<string, number>;
  errors: RecommendationRankingContextError[];
} {
  const errors: RecommendationRankingContextError[] = [];
  const tiersByPlayerId = new Map<string, number>();
  const sourceIndexesByPlayerId = new Map<string, number>();
  const rankingsByPlayerId = new Map(
    rankings.map((ranking) => [ranking.player.id, ranking] as const),
  );
  const values = sourceValues ?? [];

  values.forEach((sourceValue, index) => {
    const path = `tierSemantics.source.values[${index}]`;
    const ranking = rankingsByPlayerId.get(sourceValue.playerId);

    if (!ranking) {
      errors.push({
        code: "tier-entry-mismatch",
        path: `${path}.playerId`,
        message: `Overall tier references unknown player ${sourceValue.playerId}.`,
      });
      return;
    }

    if (sourceIndexesByPlayerId.has(sourceValue.playerId)) {
      errors.push({
        code: "partial-overall-tiers",
        path: `${path}.playerId`,
        message: `Overall tier for player ${sourceValue.playerId} is duplicated.`,
      });
      return;
    }

    sourceIndexesByPlayerId.set(sourceValue.playerId, index);

    if (sourceValue.overallRank !== ranking.overallRank) {
      errors.push({
        code: "tier-entry-mismatch",
        path: `${path}.overallRank`,
        message: `Overall tier rank for player ${sourceValue.playerId} does not match the ranking entry.`,
      });
    }

    if (!Number.isInteger(sourceValue.tier) || sourceValue.tier <= 0) {
      errors.push({
        code: "invalid-overall-tiers",
        path: `${path}.tier`,
        message: "Overall tier must be a positive integer.",
      });
      return;
    }

    tiersByPlayerId.set(sourceValue.playerId, sourceValue.tier);
  });

  const missingPlayerIds = rankings
    .map((ranking) => ranking.player.id)
    .filter((playerId) => !sourceIndexesByPlayerId.has(playerId));

  if (missingPlayerIds.length > 0) {
    errors.push({
      code: "partial-overall-tiers",
      path: "tierSemantics.source.values",
      message: `Overall tiers are missing for: ${missingPlayerIds.join(", ")}.`,
    });
  }

  let previousTier = 0;

  [...rankings]
    .sort((left, right) => left.overallRank - right.overallRank)
    .forEach((ranking) => {
      const tier = tiersByPlayerId.get(ranking.player.id);

      if (tier === undefined) {
        return;
      }

      if (tier < previousTier) {
        const sourceIndex = sourceIndexesByPlayerId.get(ranking.player.id);
        errors.push({
          code: "invalid-overall-tiers",
          path:
            sourceIndex === undefined
              ? "tierSemantics.source.values"
              : `tierSemantics.source.values[${sourceIndex}].tier`,
          message: "Overall tiers must not decrease in overall-rank order.",
        });
      }

      previousTier = tier;
    });

  return { tiersByPlayerId, errors };
}

function buildContext(
  rankings: readonly RankingEntry[],
  getOverallTier: (ranking: RankingEntry) => number,
  overallTierOrigin: RecommendationOverallTierOrigin,
): RecommendationRankingContext {
  return {
    rankings: rankings.map((ranking): RecommendationRankingFact => ({
      player: {
        id: ranking.player.id,
        name: ranking.player.name,
        team: ranking.player.team,
        position: ranking.player.position,
      },
      overallRank: ranking.overallRank,
      adpRank: ranking.adpRank,
      positionRank: ranking.positionRank,
      tier: ranking.tier,
      overallTier: getOverallTier(ranking),
      overallTierOrigin,
    })),
  };
}
