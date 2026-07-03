import type {
  Draft,
  DraftPocketForecast,
  RecommendationRankingFact,
} from "@/types/draft";

type CreateDraftPocketForecastInput = Readonly<{
  draft: Draft;
  rankings: readonly RecommendationRankingFact[];
  userTeamId: string;
}>;

type ForecastRanking = Readonly<{
  normalizedAdp: number;
  ranking: RecommendationRankingFact;
}>;

function compareByOverallRank(
  a: RecommendationRankingFact,
  b: RecommendationRankingFact,
) {
  if (a.overallRank !== b.overallRank) {
    return a.overallRank - b.overallRank;
  }

  return a.player.id.localeCompare(b.player.id);
}

function compareByForecastRemoval(a: ForecastRanking, b: ForecastRanking) {
  if (a.normalizedAdp !== b.normalizedAdp) {
    return a.normalizedAdp - b.normalizedAdp;
  }

  return compareByOverallRank(a.ranking, b.ranking);
}

function getTargetPickNumber(draft: Draft, userTeamId: string) {
  return draft.picks.reduce<number | null>((targetPickNumber, pick) => {
    if (
      pick.teamId !== userTeamId ||
      pick.pickNumber <= draft.currentPickNumber
    ) {
      return targetPickNumber;
    }

    if (targetPickNumber === null || pick.pickNumber < targetPickNumber) {
      return pick.pickNumber;
    }

    return targetPickNumber;
  }, null);
}

function getCurrentBoard(
  draft: Draft,
  rankings: readonly RecommendationRankingFact[],
) {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return rankings
    .filter((ranking) => !draftedPlayerIds.has(ranking.player.id))
    .sort(compareByOverallRank);
}

export function createDraftPocketForecast({
  draft,
  rankings,
  userTeamId,
}: CreateDraftPocketForecastInput): DraftPocketForecast {
  const currentBoard = getCurrentBoard(draft, rankings);
  const currentBoardPlayerIds = currentBoard.map((ranking) => ranking.player.id);
  const targetPickNumber = getTargetPickNumber(draft, userTeamId);

  if (targetPickNumber === null) {
    return {
      status: "no-next-pick",
      targetPickNumber: null,
      picksToRemove: null,
      missingAdpFallback: null,
      currentBoardPlayerIds,
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
    };
  }

  const picksToRemove = targetPickNumber - draft.currentPickNumber;
  const validAdpValues = rankings.flatMap((ranking) => {
    return ranking.adpRank === null ? [] : [ranking.adpRank];
  });

  if (validAdpValues.length === 0) {
    return {
      status: "no-adp",
      targetPickNumber,
      picksToRemove,
      missingAdpFallback: null,
      currentBoardPlayerIds,
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
    };
  }

  const missingAdpFallback = Math.max(...validAdpValues) + 1;
  const removalOrder = currentBoard
    .map((ranking) => ({
      ranking,
      normalizedAdp: ranking.adpRank ?? missingAdpFallback,
    }))
    .sort(compareByForecastRemoval);
  const removalWindowPlayerIds = removalOrder
    .slice(0, picksToRemove)
    .map(({ ranking }) => ranking.player.id);
  const forecastedBoardPlayerIds = removalOrder
    .slice(picksToRemove)
    .map(({ ranking }) => ranking)
    .sort(compareByOverallRank)
    .map((ranking) => ranking.player.id);

  return {
    status: "active",
    targetPickNumber,
    picksToRemove,
    missingAdpFallback,
    currentBoardPlayerIds,
    removalWindowPlayerIds,
    forecastedBoardPlayerIds,
  };
}
