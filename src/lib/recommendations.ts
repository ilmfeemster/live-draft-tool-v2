import type {
  Draft,
  LeagueSettings,
  PlayerRecommendation,
  Position,
  RankingEntry,
  Recommendation,
  RecommendationScoreComponent,
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
const ROSTER_FIT_MIN_DELTA = -20;
const ROSTER_FIT_MAX_DELTA = 14;
const OPEN_DIRECT_STARTER_DELTA = 10;
const OPEN_FLEX_DELTA = 5;
const USEFUL_BENCH_DEPTH_DELTA = 3;
const LIMITED_BENCH_NEED_DELTA = -6;
const HEAVY_SATURATION_DELTA = -12;
const EARLY_DEF_K_TIMING_DELTA = -20;
const ROSTER_FIT_COMPONENT_PRIORITY = 20;
const VALUE_OPPORTUNITY_MIN_DELTA = -6;
const VALUE_OPPORTUNITY_MAX_DELTA = 8;
const SMALL_VALUE_OPPORTUNITY_DELTA = 2;
const CLEAR_VALUE_OPPORTUNITY_DELTA = 5;
const MAJOR_VALUE_OPPORTUNITY_DELTA = 8;
const CLEAR_REACH_DELTA = -4;
const MAJOR_REACH_DELTA = -6;
const VALUE_OPPORTUNITY_COMPONENT_PRIORITY = 15;

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

type DerivedRosterPlayer = Pick<UserRosterPlayer, "pickNumber" | "position">;

type RosterSlotAnalysis = {
  directStarterSlots: number;
  flexSlots: number;
  benchSlots: number;
  directStarterOpenings: number;
  flexOpenings: number;
  benchOpenings: number;
  rosterCountAtPosition: number;
  totalUsefulCapacity: number;
};

export function calculateRankingScore(ranking: RankingEntry) {
  return 1000 - ranking.overallRank;
}

export function calculateBasePlayerValueScore(
  overallRank: number,
  coefficient = defaultRecommendationTuningConfig.baseScoreCurveCoefficient,
) {
  const rankDistanceFromTop = Math.max(overallRank - 1, 0);

  return Math.max(0, 100 - coefficient * Math.sqrt(rankDistanceFromTop));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function comparePlayerRecommendations(a: PlayerRecommendation, b: PlayerRecommendation) {
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  if (b.baseScore !== a.baseScore) {
    return b.baseScore - a.baseScore;
  }

  return compareRankingsByStableDraftOrder(a.ranking, b.ranking);
}

function getUserRoster(input: RecommendationInput): DerivedRosterPlayer[] {
  const rankingsByPlayerId = new Map(
    input.rankings.map((ranking) => [ranking.player.id, ranking] as const),
  );

  return input.draft.picks.flatMap((pick) => {
    if (pick.teamId !== input.userTeamId || !pick.playerId) {
      return [];
    }

    const ranking = rankingsByPlayerId.get(pick.playerId);

    if (!ranking) {
      return [];
    }

    return [
      {
        pickNumber: pick.pickNumber,
        position: ranking.player.position,
      },
    ];
  });
}

function isBenchSlot(label: string) {
  return label.toUpperCase() === "BENCH";
}

function countRosterPosition(rosterPlayers: DerivedRosterPlayer[], position: Position) {
  return rosterPlayers.filter((player) => player.position === position).length;
}

function analyzeRosterSlots(
  leagueSettings: LeagueSettings,
  rosterPlayers: DerivedRosterPlayer[],
  candidatePosition: Position,
): RosterSlotAnalysis {
  const benchSlots = leagueSettings.rosterSlots.filter((slot) => {
    return isBenchSlot(slot.label) && slot.eligiblePositions.includes(candidatePosition);
  }).length;
  const directStarterSlots = leagueSettings.rosterSlots.filter((slot) => {
    return (
      !isBenchSlot(slot.label) &&
      slot.eligiblePositions.length === 1 &&
      slot.eligiblePositions[0] === candidatePosition
    );
  }).length;
  const flexSlots = leagueSettings.rosterSlots.filter((slot) => {
    return (
      !isBenchSlot(slot.label) &&
      slot.eligiblePositions.length > 1 &&
      slot.eligiblePositions.includes(candidatePosition)
    );
  }).length;
  const allFlexEligiblePositions = new Set(
    leagueSettings.rosterSlots
      .filter((slot) => !isBenchSlot(slot.label) && slot.eligiblePositions.length > 1)
      .flatMap((slot) => slot.eligiblePositions),
  );
  const rosterCountAtPosition = countRosterPosition(rosterPlayers, candidatePosition);
  const directStarterOpenings = Math.max(directStarterSlots - rosterCountAtPosition, 0);
  const flexEligibleSurplus = Array.from(allFlexEligiblePositions).reduce((surplus, position) => {
    const directSlotsForPosition = leagueSettings.rosterSlots.filter((slot) => {
      return (
        !isBenchSlot(slot.label) &&
        slot.eligiblePositions.length === 1 &&
        slot.eligiblePositions[0] === position
      );
    }).length;

    return surplus + Math.max(countRosterPosition(rosterPlayers, position) - directSlotsForPosition, 0);
  }, 0);
  const flexOpenings = Math.max(flexSlots - flexEligibleSurplus, 0);
  const totalNonBenchSlots = leagueSettings.rosterSlots.filter((slot) => !isBenchSlot(slot.label)).length;
  const benchUsed = Math.max(rosterPlayers.length - totalNonBenchSlots, 0);
  const benchOpenings = Math.max(benchSlots - benchUsed, 0);

  return {
    directStarterSlots,
    flexSlots,
    benchSlots,
    directStarterOpenings,
    flexOpenings,
    benchOpenings,
    rosterCountAtPosition,
    totalUsefulCapacity: directStarterSlots + flexSlots + benchSlots,
  };
}

function getDraftPhase(draft: Draft) {
  const totalPicks = Math.max(draft.teamCount * draft.rounds, 1);

  return draft.currentPickNumber / totalPicks;
}

function getRosterFitTimingLabel(delta: number, position: Position, isLateDraft: boolean) {
  if ((position === "DST" || position === "K") && !isLateDraft) {
    return "early_def_k";
  }

  if (delta >= OPEN_DIRECT_STARTER_DELTA) {
    return "direct_starter_need";
  }

  if (delta >= OPEN_FLEX_DELTA) {
    return "flex_need";
  }

  if (delta > 0) {
    return "bench_depth";
  }

  if (delta <= HEAVY_SATURATION_DELTA) {
    return "saturated";
  }

  if (delta < 0) {
    return "limited_need";
  }

  return "neutral";
}

export function calculateRosterFitComponent({
  ranking,
  rosterPlayers,
  leagueSettings,
  draft,
  tuning,
}: {
  ranking: RankingEntry;
  rosterPlayers: DerivedRosterPlayer[];
  leagueSettings: LeagueSettings;
  draft: Draft;
  tuning: RecommendationTuningConfig;
}): RecommendationScoreComponent {
  const position = ranking.player.position;
  const slotAnalysis = analyzeRosterSlots(leagueSettings, rosterPlayers, position);
  const draftPhase = getDraftPhase(draft);
  const isLateDraft = draftPhase >= tuning.lateDraftPickRatio;
  let delta = 0;

  if ((position === "DST" || position === "K") && !isLateDraft) {
    delta = EARLY_DEF_K_TIMING_DELTA;
  } else if (slotAnalysis.directStarterOpenings > 0) {
    delta = OPEN_DIRECT_STARTER_DELTA;
  } else if (slotAnalysis.flexOpenings > 0) {
    delta = OPEN_FLEX_DELTA;
  } else if (slotAnalysis.rosterCountAtPosition >= slotAnalysis.totalUsefulCapacity) {
    delta = HEAVY_SATURATION_DELTA;
  } else if (
    slotAnalysis.benchOpenings > 0 &&
    position !== "DST" &&
    position !== "K" &&
    (slotAnalysis.directStarterSlots > 1 || slotAnalysis.flexSlots > 0)
  ) {
    delta = USEFUL_BENCH_DEPTH_DELTA;
  } else {
    delta = LIMITED_BENCH_NEED_DELTA;
  }

  const boundedDelta = clamp(delta, ROSTER_FIT_MIN_DELTA, ROSTER_FIT_MAX_DELTA);

  return {
    id: "roster_fit",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : boundedDelta < 0 ? "negative" : "neutral",
    priority: ROSTER_FIT_COMPONENT_PRIORITY,
    evidence: {
      position,
      directStarterSlots: slotAnalysis.directStarterSlots,
      flexSlots: slotAnalysis.flexSlots,
      benchSlots: slotAnalysis.benchSlots,
      directStarterOpenings: slotAnalysis.directStarterOpenings,
      flexOpenings: slotAnalysis.flexOpenings,
      benchOpenings: slotAnalysis.benchOpenings,
      rosterCountAtPosition: slotAnalysis.rosterCountAtPosition,
      draftPhase,
      timing: getRosterFitTimingLabel(boundedDelta, position, isLateDraft),
    },
  };
}

export function calculateValueOpportunityComponent({
  ranking,
  currentPickNumber,
  rosterFitDelta,
  tuning,
}: {
  ranking: RankingEntry;
  currentPickNumber: number;
  rosterFitDelta: number;
  tuning: RecommendationTuningConfig;
}): RecommendationScoreComponent {
  const pickValueGap = currentPickNumber - ranking.overallRank;
  const reachGap = ranking.overallRank - currentPickNumber;
  let delta = 0;
  let thresholdMatched = "neutral";

  if (pickValueGap >= tuning.valueOpportunityMajorFallThreshold) {
    delta = MAJOR_VALUE_OPPORTUNITY_DELTA;
    thresholdMatched = "major_value";
  } else if (pickValueGap >= tuning.valueOpportunityClearFallThreshold) {
    delta = CLEAR_VALUE_OPPORTUNITY_DELTA;
    thresholdMatched = "clear_value";
  } else if (pickValueGap >= tuning.valueOpportunitySmallFallThreshold) {
    delta = SMALL_VALUE_OPPORTUNITY_DELTA;
    thresholdMatched = "small_value";
  } else if (
    reachGap >= tuning.valueOpportunityMajorFallThreshold &&
    rosterFitDelta <= 0
  ) {
    delta = MAJOR_REACH_DELTA;
    thresholdMatched = "major_reach";
  } else if (
    reachGap >= tuning.valueOpportunityClearFallThreshold &&
    rosterFitDelta <= 0
  ) {
    delta = CLEAR_REACH_DELTA;
    thresholdMatched = "clear_reach";
  }

  const boundedDelta = clamp(
    delta,
    VALUE_OPPORTUNITY_MIN_DELTA,
    VALUE_OPPORTUNITY_MAX_DELTA,
  );

  return {
    id: "value_opportunity",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : boundedDelta < 0 ? "negative" : "neutral",
    priority: VALUE_OPPORTUNITY_COMPONENT_PRIORITY,
    evidence: {
      currentPickNumber,
      overallRank: ranking.overallRank,
      pickValueGap,
      reachGap,
      thresholdMatched,
      rosterFitDelta,
    },
  };
}

export function generatePlayerRecommendations(
  input: RecommendationInput,
  options: GeneratePlayerRecommendationsOptions = {},
): PlayerRecommendation[] {
  const recommendationLimit = options.limit ?? DEFAULT_RECOMMENDATION_LIMIT;
  const tuning = options.tuning ?? defaultRecommendationTuningConfig;

  if (input.rankings.length === 0 || recommendationLimit <= 0) {
    return [];
  }

  const draftedPlayerIds = getDraftedPlayerIds(input);
  const rosterPlayers = getUserRoster(input);

  return input.rankings
    .filter((ranking) => !draftedPlayerIds.has(ranking.player.id))
    .map((ranking) => {
      const baseScore = calculateBasePlayerValueScore(
        ranking.overallRank,
        tuning.baseScoreCurveCoefficient,
      );
      const rosterFitComponent = calculateRosterFitComponent({
        ranking,
        rosterPlayers,
        leagueSettings: input.leagueSettings,
        draft: input.draft,
        tuning,
      });
      const valueOpportunityComponent = calculateValueOpportunityComponent({
        ranking,
        currentPickNumber: input.draft.currentPickNumber,
        rosterFitDelta: rosterFitComponent.delta,
        tuning,
      });
      const contextScore = clamp(
        rosterFitComponent.delta + valueOpportunityComponent.delta,
        tuning.maxNegativeContextScore,
        tuning.maxPositiveContextScore,
      );
      const totalScore = baseScore + contextScore;

      return {
        ranking,
        playerId: ranking.player.id,
        totalScore,
        baseScore,
        contextScore,
        components: [
          {
            id: "base_value",
            delta: baseScore,
            direction: baseScore > 0 ? "positive" : "neutral",
            priority: 10,
            evidence: {
              overallRank: ranking.overallRank,
              coefficient: tuning.baseScoreCurveCoefficient,
            },
          },
          rosterFitComponent,
          valueOpportunityComponent,
        ],
        reasons: [],
      };
    })
    .sort(comparePlayerRecommendations)
    .slice(0, Math.floor(recommendationLimit));
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
