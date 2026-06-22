import type { Position, RankingEntry, Recommendation } from "@/types/draft";

const DEFAULT_RECOMMENDATION_LIMIT = 5;
const DIRECT_STARTER_NEED_BONUS = 30;
const FLEX_NEED_BONUS = 15;
const flexPositions: Position[] = ["RB", "WR", "TE"];

type RosterNeedPlayer = {
  position: Position;
};

type GenerateTopRecommendationsOptions = {
  limit?: number;
  rosterPlayers?: RosterNeedPlayer[];
};

type RosterNeedResult = {
  modifier: number;
  reason: string | null;
};

export function calculateRankingScore(ranking: RankingEntry) {
  return 1000 - ranking.overallRank;
}

function countPosition(rosterPlayers: RosterNeedPlayer[], position: Position) {
  return rosterPlayers.filter((player) => player.position === position).length;
}

function countDirectStarterSurplus(rosterPlayers: RosterNeedPlayer[]) {
  const rbSurplus = Math.max(countPosition(rosterPlayers, "RB") - 2, 0);
  const wrSurplus = Math.max(countPosition(rosterPlayers, "WR") - 2, 0);
  const teSurplus = Math.max(countPosition(rosterPlayers, "TE") - 1, 0);

  return rbSurplus + wrSurplus + teSurplus;
}

export function calculateRosterNeedModifier(
  ranking: RankingEntry,
  rosterPlayers: RosterNeedPlayer[] = [],
): RosterNeedResult {
  const position = ranking.player.position;

  if (position === "QB" || position === "DST" || position === "K") {
    if (countPosition(rosterPlayers, position) < 1) {
      return {
        modifier: DIRECT_STARTER_NEED_BONUS,
        reason: `Fills ${position} starter need`,
      };
    }

    return { modifier: 0, reason: null };
  }

  if (position === "RB" && countPosition(rosterPlayers, "RB") < 2) {
    return {
      modifier: DIRECT_STARTER_NEED_BONUS,
      reason: "Fills RB starter need",
    };
  }

  if (position === "WR" && countPosition(rosterPlayers, "WR") < 2) {
    return {
      modifier: DIRECT_STARTER_NEED_BONUS,
      reason: "Fills WR starter need",
    };
  }

  if (position === "TE" && countPosition(rosterPlayers, "TE") < 1) {
    return {
      modifier: DIRECT_STARTER_NEED_BONUS,
      reason: "Fills TE starter need",
    };
  }

  if (flexPositions.includes(position) && countDirectStarterSurplus(rosterPlayers) < 2) {
    return {
      modifier: FLEX_NEED_BONUS,
      reason: "Helps fill FLEX need",
    };
  }

  return { modifier: 0, reason: null };
}

function buildRecommendationReasons(
  ranking: RankingEntry,
  rosterNeedResult: RosterNeedResult,
) {
  const reasons = [`Ranked #${ranking.overallRank} overall`];

  if (ranking.adpRank !== null) {
    reasons.push(`ADP rank #${ranking.adpRank}`);
  }

  if (rosterNeedResult.reason) {
    reasons.push(rosterNeedResult.reason);
  }

  return reasons;
}

export function generateTopRecommendations(
  rankings: RankingEntry[],
  options: GenerateTopRecommendationsOptions | number = {},
): Recommendation[] {
  const { limit, rosterPlayers } =
    typeof options === "number" ? { limit: options, rosterPlayers: [] } : options;
  const recommendationLimit = limit ?? DEFAULT_RECOMMENDATION_LIMIT;

  if (rankings.length === 0 || recommendationLimit <= 0) {
    return [];
  }

  return rankings
    .map((ranking) => {
      const rankingScore = calculateRankingScore(ranking);
      const rosterNeedResult = calculateRosterNeedModifier(ranking, rosterPlayers ?? []);

      return {
        ranking,
        score: rankingScore + rosterNeedResult.modifier,
        reasons: buildRecommendationReasons(ranking, rosterNeedResult),
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
    .slice(0, Math.floor(recommendationLimit));
}
