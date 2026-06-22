import type { RankingEntry, Recommendation } from "@/types/draft";

const DEFAULT_RECOMMENDATION_LIMIT = 5;

export function calculateRankingScore(ranking: RankingEntry) {
  return 1000 - ranking.overallRank;
}

function buildRecommendationReasons(ranking: RankingEntry) {
  const reasons = [`Ranked #${ranking.overallRank} overall`];

  if (ranking.adpRank !== null) {
    reasons.push(`ADP rank #${ranking.adpRank}`);
  }

  return reasons;
}

export function generateTopRecommendations(
  rankings: RankingEntry[],
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): Recommendation[] {
  if (rankings.length === 0 || limit <= 0) {
    return [];
  }

  return rankings
    .map((ranking) => {
      return {
        ranking,
        score: calculateRankingScore(ranking),
        reasons: buildRecommendationReasons(ranking),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.ranking.overallRank !== b.ranking.overallRank) {
        return a.ranking.overallRank - b.ranking.overallRank;
      }

      return a.ranking.player.name.localeCompare(b.ranking.player.name);
    })
    .slice(0, Math.floor(limit));
}
