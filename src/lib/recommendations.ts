import type {
  PlayerRecommendation,
  Position,
  RankingEntry,
  Recommendation,
  RecommendationInput,
  RecommendationTuningConfig,
  UserRosterPlayer,
} from "@/types/draft";

const DEFAULT_RECOMMENDATION_LIMIT = 5;
const DIRECT_STARTER_NEED_BONUS = 15;
const FLEX_NEED_BONUS = 5;
const TIER_DROP_MULTIPLIER = 5;
const MAX_TIER_DROP_BONUS = 10;
const SCARCITY_LOOKAHEAD_RANKS = 24;
const SCARCITY_MIN_NEARBY_OPTIONS = 2;
const SCARCITY_BONUS = 5;
const flexPositions: Position[] = ["RB", "WR", "TE"];

export const defaultRecommendationTuningConfig: RecommendationTuningConfig = {
  baseScoreCurveCoefficient: 6,
  maxPositiveContextScore: 30,
  maxNegativeContextScore: -24,
  maxUrgencyScore: 16,
  recentPickRunWindow: 12,
  tierThinnessThreshold: 2,
  valueOpportunitySmallFallThreshold: 6,
  valueOpportunityClearFallThreshold: 12,
  valueOpportunityMajorFallThreshold: 24,
  earlyDraftPickRatio: 1 / 3,
  lateDraftPickRatio: 2 / 3,
  positiveReasonThreshold: 3,
  negativeReasonThreshold: -6,
  maxReasons: 3,
};

type RosterNeedPlayer = Pick<UserRosterPlayer, "position">;

type GenerateTopRecommendationsOptions = {
  limit?: number;
  rosterPlayers?: RosterNeedPlayer[];
};

type RosterNeedResult = {
  modifier: number;
  reason: string | null;
};

type TierDropResult = {
  modifier: number;
  reason: string | null;
};

type ScarcityResult = {
  modifier: number;
  reason: string | null;
};

type GeneratePlayerRecommendationsOptions = {
  limit?: number;
  tuning?: RecommendationTuningConfig;
};

export function calculateRankingScore(ranking: RankingEntry) {
  return 1000 - ranking.overallRank;
}

function getDraftedPlayerIds(input: RecommendationInput) {
  return new Set(input.draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])));
}

function compareRankingsByStableDraftOrder(a: RankingEntry, b: RankingEntry) {
  if (a.overallRank !== b.overallRank) {
    return a.overallRank - b.overallRank;
  }

  if (a.positionRank !== b.positionRank) {
    return a.positionRank - b.positionRank;
  }

  return a.player.id.localeCompare(b.player.id);
}

export function generatePlayerRecommendations(
  input: RecommendationInput,
  options: GeneratePlayerRecommendationsOptions = {},
): PlayerRecommendation[] {
  const recommendationLimit = options.limit ?? DEFAULT_RECOMMENDATION_LIMIT;

  if (input.rankings.length === 0 || recommendationLimit <= 0) {
    return [];
  }

  const draftedPlayerIds = getDraftedPlayerIds(input);

  return input.rankings
    .filter((ranking) => !draftedPlayerIds.has(ranking.player.id))
    .sort(compareRankingsByStableDraftOrder)
    .slice(0, Math.floor(recommendationLimit))
    .map((ranking) => ({
      ranking,
      playerId: ranking.player.id,
      totalScore: 0,
      baseScore: 0,
      contextScore: 0,
      components: [],
      reasons: [],
    }));
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

export function calculateTierDropModifier(
  ranking: RankingEntry,
  availableRankings: RankingEntry[],
): TierDropResult {
  const samePositionRankings = availableRankings
    .filter((candidate) => candidate.player.position === ranking.player.position)
    .sort((a, b) => a.overallRank - b.overallRank);
  const bestAvailableTier = Math.min(...samePositionRankings.map((candidate) => candidate.tier));

  if (ranking.tier !== bestAvailableTier) {
    return { modifier: 0, reason: null };
  }

  const sameTierRankings = samePositionRankings.filter((candidate) => {
    return candidate.tier === ranking.tier;
  });

  if (sameTierRankings.length > 1) {
    return { modifier: 0, reason: null };
  }

  const rankingIndex = samePositionRankings.findIndex((candidate) => {
    return candidate.player.id === ranking.player.id;
  });

  if (rankingIndex === -1) {
    return { modifier: 0, reason: null };
  }

  const nextSamePositionRanking = samePositionRankings[rankingIndex + 1];

  if (!nextSamePositionRanking || nextSamePositionRanking.tier <= ranking.tier) {
    return { modifier: 0, reason: null };
  }

  const tierGap = nextSamePositionRanking.tier - ranking.tier;
  const modifier = Math.min(tierGap * TIER_DROP_MULTIPLIER, MAX_TIER_DROP_BONUS);
  const position = ranking.player.position;
  const reason =
    tierGap === 1
      ? `Tier drop after this ${position}`
      : `Tier drop after this ${position} by ${tierGap} tiers`;

  return { modifier, reason };
}

export function calculateScarcityModifier(
  ranking: RankingEntry,
  availableRankings: RankingEntry[],
): ScarcityResult {
  const position = ranking.player.position;

  if (position === "K" || position === "DST") {
    return { modifier: 0, reason: null };
  }

  const nearbySamePositionCount = availableRankings.filter((candidate) => {
    return (
      candidate.player.position === position &&
      candidate.overallRank > ranking.overallRank &&
      candidate.overallRank <= ranking.overallRank + SCARCITY_LOOKAHEAD_RANKS
    );
  }).length;

  if (nearbySamePositionCount >= SCARCITY_MIN_NEARBY_OPTIONS) {
    return { modifier: 0, reason: null };
  }

  return {
    modifier: SCARCITY_BONUS,
    reason: `Limited nearby ${position} options`,
  };
}

function buildRecommendationReasons(
  ranking: RankingEntry,
  rosterNeedResult: RosterNeedResult,
  tierDropResult: TierDropResult,
  scarcityResult: ScarcityResult,
) {
  const reasons = [`Ranked #${ranking.overallRank} overall`];

  if (ranking.adpRank !== null) {
    reasons.push(`ADP rank #${ranking.adpRank}`);
  }

  if (rosterNeedResult.reason) {
    reasons.push(rosterNeedResult.reason);
  }

  if (tierDropResult.reason) {
    reasons.push(tierDropResult.reason);
  }

  if (scarcityResult.reason) {
    reasons.push(scarcityResult.reason);
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
      const tierDropResult = calculateTierDropModifier(ranking, rankings);
      const scarcityResult = calculateScarcityModifier(ranking, rankings);

      return {
        ranking,
        score:
          rankingScore +
          rosterNeedResult.modifier +
          tierDropResult.modifier +
          scarcityResult.modifier,
        reasons: buildRecommendationReasons(
          ranking,
          rosterNeedResult,
          tierDropResult,
          scarcityResult,
        ),
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
