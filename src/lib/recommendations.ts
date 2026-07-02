import type {
  Draft,
  LeagueSettings,
  PlayerRecommendation,
  Position,
  RankingEntry,
  Recommendation,
  RecommendationReason,
  RecommendationScoreAdjustment,
  RecommendationScoreComponent,
  RecommendationInput,
  RecommendationRankingFact,
  RecommendationTuningConfig,
  UserRosterPlayer,
} from "@/types/draft";
import { NEUTRAL_TIER } from "@/types/rankings";

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
const TIER_CLIFF_MIN_DELTA = 0;
const TIER_CLIFF_MAX_DELTA = 12;
const MILD_TIER_PRESSURE_DELTA = 4;
const LAST_PLAYER_TIER_PRESSURE_DELTA = 8;
const MAJOR_TIER_CLIFF_DELTA = 12;
const SOLVED_POSITION_TIER_CAP = 3;
const TIER_CLIFF_COMPONENT_PRIORITY = 18;
const OVERALL_TIER_MIN_DELTA = 0;
const OVERALL_TIER_MAX_DELTA = 6;
const BEST_OVERALL_TIER_DELTA = 3;
const LAST_IN_BEST_OVERALL_TIER_DELTA = 6;
const OVERALL_TIER_COMPONENT_PRIORITY = 19;
const POSITIONAL_SCARCITY_MIN_DELTA = 0;
const POSITIONAL_SCARCITY_MAX_DELTA = 6;
const MILD_POSITIONAL_SCARCITY_DELTA = 3;
const CLEAR_POSITIONAL_SCARCITY_DELTA = 6;
const POSITIONAL_SCARCITY_COMPONENT_PRIORITY = 17;
const POSITIONAL_RUN_MIN_DELTA = 0;
const POSITIONAL_RUN_MAX_DELTA = 4;
const MILD_POSITIONAL_RUN_DELTA = 2;
const CLEAR_POSITIONAL_RUN_DELTA = 4;
const POSITIONAL_RUN_COMPONENT_PRIORITY = 16;
const urgencyPositions = new Set<Position>(["QB", "RB", "WR", "TE"]);

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

type RecommendationReasonCandidate = {
  reason: RecommendationReason;
  delta: number;
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

export function calculateOverallTierComponent({
  ranking,
  availableRankings,
}: {
  ranking: RecommendationRankingFact;
  availableRankings: readonly RecommendationRankingFact[];
}): RecommendationScoreComponent {
  if (ranking.overallTierOrigin === "defaulted-neutral") {
    return {
      id: "overall_tier",
      delta: 0,
      direction: "neutral",
      priority: OVERALL_TIER_COMPONENT_PRIORITY,
      evidence: {
        candidateTier: ranking.overallTier,
        bestAvailableTier: null,
        bestTierRemaining: 0,
        hasLowerTierAvailable: false,
        overallTierOrigin: ranking.overallTierOrigin,
        thresholdMatched: "defaulted_neutral_overall_tier",
      },
    };
  }

  const bestAvailableTier =
    availableRankings.length === 0
      ? null
      : Math.min(...availableRankings.map((candidate) => candidate.overallTier));
  const bestTierRemaining =
    bestAvailableTier === null
      ? 0
      : availableRankings.filter((candidate) => {
          return candidate.overallTier === bestAvailableTier;
        }).length;
  const hasLowerTierAvailable =
    bestAvailableTier !== null &&
    availableRankings.some((candidate) => {
      return candidate.overallTier > bestAvailableTier;
    });
  let delta = 0;
  let thresholdMatched = "no_overall_tier_boundary";

  if (!hasLowerTierAvailable || bestAvailableTier === null) {
    thresholdMatched = "no_overall_tier_boundary";
  } else if (ranking.overallTier !== bestAvailableTier) {
    thresholdMatched = "outside_best_overall_tier";
  } else if (bestTierRemaining === 1) {
    delta = LAST_IN_BEST_OVERALL_TIER_DELTA;
    thresholdMatched = "last_in_best_overall_tier";
  } else {
    delta = BEST_OVERALL_TIER_DELTA;
    thresholdMatched = "best_overall_tier_available";
  }

  const boundedDelta = clamp(
    delta,
    OVERALL_TIER_MIN_DELTA,
    OVERALL_TIER_MAX_DELTA,
  );

  return {
    id: "overall_tier",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : "neutral",
    priority: OVERALL_TIER_COMPONENT_PRIORITY,
    evidence: {
      candidateTier: ranking.overallTier,
      bestAvailableTier,
      bestTierRemaining,
      hasLowerTierAvailable,
      overallTierOrigin: ranking.overallTierOrigin,
      thresholdMatched,
    },
  };
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

function getDistanceToNextUserPick(input: RecommendationInput) {
  const nextUserPick = input.draft.picks.find((pick) => {
    return pick.teamId === input.userTeamId && pick.pickNumber > input.draft.currentPickNumber;
  });

  return nextUserPick ? nextUserPick.pickNumber - input.draft.currentPickNumber : null;
}

export function calculateTierDropRiskComponent({
  ranking,
  availableRankings,
  distanceToNextUserPick,
  rosterFitDelta,
  tuning,
}: {
  ranking: RankingEntry;
  availableRankings: RankingEntry[];
  distanceToNextUserPick: number | null;
  rosterFitDelta: number;
  tuning: RecommendationTuningConfig;
}): RecommendationScoreComponent {
  const position = ranking.player.position;
  const samePositionRankings = availableRankings
    .filter((candidate) => candidate.player.position === position)
    .sort(compareRankingsByStableDraftOrder);
  const sameTierRemaining = samePositionRankings.filter((candidate) => {
    return candidate.tier === ranking.tier;
  }).length;

  if (
    ranking.tier === NEUTRAL_TIER &&
    samePositionRankings.length > 0 &&
    samePositionRankings.every((candidate) => candidate.tier === NEUTRAL_TIER)
  ) {
    return {
      id: "tier_cliff",
      delta: 0,
      direction: "neutral",
      priority: TIER_CLIFF_COMPONENT_PRIORITY,
      evidence: {
        position,
        currentTier: ranking.tier,
        sameTierRemaining,
        nextTier: null,
        tierGap: null,
        distanceToNextUserPick,
        rosterFitDelta,
        thresholdMatched: "neutral_recommendation_tiers",
      },
    };
  }

  const bestAvailableTier = Math.min(...samePositionRankings.map((candidate) => candidate.tier));
  const nextTier =
    samePositionRankings
      .map((candidate) => candidate.tier)
      .filter((tier) => tier > ranking.tier)
      .sort((a, b) => a - b)[0] ?? null;
  const tierGap = nextTier === null ? null : nextTier - ranking.tier;
  let delta = 0;
  let thresholdMatched = "neutral";

  if (samePositionRankings.length === 0) {
    thresholdMatched = "no_position_options";
  } else if (ranking.tier !== bestAvailableTier) {
    thresholdMatched = "not_best_available_tier";
  } else if (nextTier === null || tierGap === null) {
    thresholdMatched = "no_next_tier";
  } else if (sameTierRemaining > tuning.tierThinnessThreshold) {
    thresholdMatched = "tier_not_thin";
  } else if (distanceToNextUserPick !== null && sameTierRemaining > distanceToNextUserPick) {
    thresholdMatched = "likely_available_next_pick";
  } else if (sameTierRemaining === 1 && tierGap > 1) {
    delta = MAJOR_TIER_CLIFF_DELTA;
    thresholdMatched = "major_tier_cliff";
  } else if (sameTierRemaining === 1) {
    delta = LAST_PLAYER_TIER_PRESSURE_DELTA;
    thresholdMatched = "last_in_tier";
  } else {
    delta = MILD_TIER_PRESSURE_DELTA;
    thresholdMatched = "mild_tier_pressure";
  }

  let relevanceAdjustedDelta = delta;

  if (rosterFitDelta === 0) {
    relevanceAdjustedDelta = Math.floor(delta / 2);
  } else if (rosterFitDelta < 0) {
    relevanceAdjustedDelta = Math.min(delta, SOLVED_POSITION_TIER_CAP);
  }

  const boundedDelta = clamp(
    relevanceAdjustedDelta,
    TIER_CLIFF_MIN_DELTA,
    TIER_CLIFF_MAX_DELTA,
  );

  return {
    id: "tier_cliff",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : "neutral",
    priority: TIER_CLIFF_COMPONENT_PRIORITY,
    evidence: {
      position,
      currentTier: ranking.tier,
      sameTierRemaining,
      nextTier,
      tierGap,
      distanceToNextUserPick,
      rosterFitDelta,
      thresholdMatched,
    },
  };
}

export function calculatePositionalScarcityComponent(input: {
  ranking: RankingEntry;
  availableRankings: RankingEntry[];
  rosterFitDelta: number;
  tuning: RecommendationTuningConfig;
}): RecommendationScoreComponent {
  const { ranking, availableRankings, rosterFitDelta } = input;
  const position = ranking.player.position;
  const nearbySamePositionOptions = availableRankings
    .filter((candidate) => {
      return (
        candidate.player.position === position &&
        candidate.overallRank > ranking.overallRank &&
        candidate.overallRank <= ranking.overallRank + SCARCITY_LOOKAHEAD_RANKS
      );
    })
    .sort(compareRankingsByStableDraftOrder).length;
  let delta = 0;
  let thresholdMatched = "enough_nearby_options";

  if (!urgencyPositions.has(position)) {
    thresholdMatched = "position_not_supported";
  } else if (rosterFitDelta < 0) {
    thresholdMatched = "roster_irrelevant";
  } else if (nearbySamePositionOptions === 0) {
    delta = CLEAR_POSITIONAL_SCARCITY_DELTA;
    thresholdMatched = "clear_scarcity";
  } else if (nearbySamePositionOptions <= 2) {
    delta = MILD_POSITIONAL_SCARCITY_DELTA;
    thresholdMatched = "mild_scarcity";
  }

  if (rosterFitDelta === 0) {
    delta = Math.floor(delta / 2);
  }

  const boundedDelta = clamp(
    delta,
    POSITIONAL_SCARCITY_MIN_DELTA,
    POSITIONAL_SCARCITY_MAX_DELTA,
  );

  return {
    id: "positional_scarcity",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : "neutral",
    priority: POSITIONAL_SCARCITY_COMPONENT_PRIORITY,
    evidence: {
      position,
      nearbySamePositionOptions,
      lookaheadRanks: SCARCITY_LOOKAHEAD_RANKS,
      rosterFitDelta,
      thresholdMatched,
    },
  };
}

export function calculatePositionalRunComponent({
  ranking,
  rankings,
  picks,
  currentPickNumber,
  rosterFitDelta,
  tuning,
}: {
  ranking: RankingEntry;
  rankings: RankingEntry[];
  picks: Draft["picks"];
  currentPickNumber: number;
  rosterFitDelta: number;
  tuning: RecommendationTuningConfig;
}): RecommendationScoreComponent {
  const position = ranking.player.position;
  const rankingsByPlayerId = new Map(
    rankings.map((candidate) => [candidate.player.id, candidate] as const),
  );
  const recentPicks = picks
    .filter((pick) => pick.pickNumber < currentPickNumber)
    .sort((a, b) => b.pickNumber - a.pickNumber)
    .slice(0, tuning.recentPickRunWindow);
  const recentPositionPickCount = recentPicks.reduce((count, pick) => {
    if (!pick.playerId) {
      return count;
    }

    return rankingsByPlayerId.get(pick.playerId)?.player.position === position
      ? count + 1
      : count;
  }, 0);
  let delta = 0;
  let thresholdMatched = "no_meaningful_run";

  if (!urgencyPositions.has(position)) {
    thresholdMatched = "position_not_supported";
  } else if (rosterFitDelta <= 0) {
    thresholdMatched = "roster_irrelevant";
  } else if (recentPositionPickCount >= 5) {
    delta = CLEAR_POSITIONAL_RUN_DELTA;
    thresholdMatched = "clear_run";
  } else if (recentPositionPickCount >= 3) {
    delta = MILD_POSITIONAL_RUN_DELTA;
    thresholdMatched = "mild_run";
  }

  const boundedDelta = clamp(delta, POSITIONAL_RUN_MIN_DELTA, POSITIONAL_RUN_MAX_DELTA);

  return {
    id: "positional_run",
    delta: boundedDelta,
    direction: boundedDelta > 0 ? "positive" : "neutral",
    priority: POSITIONAL_RUN_COMPONENT_PRIORITY,
    evidence: {
      position,
      recentPickWindow: tuning.recentPickRunWindow,
      recentPositionPickCount,
      rosterFitDelta,
      thresholdMatched,
    },
  };
}

function getStringEvidence(component: RecommendationScoreComponent, key: string) {
  const value = component.evidence?.[key];

  return typeof value === "string" ? value : null;
}

function getNumberEvidence(component: RecommendationScoreComponent, key: string) {
  const value = component.evidence?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createReasonCandidate(
  component: RecommendationScoreComponent,
  reasonId: string,
  text: string,
): RecommendationReasonCandidate {
  return {
    reason: {
      id: reasonId,
      text,
      sourceComponentId: component.id,
      priority: component.priority ?? 0,
    },
    delta: component.delta,
  };
}

function buildRosterFitReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  const position = getStringEvidence(component, "position");
  const timing = getStringEvidence(component, "timing");

  if (!position || !timing) {
    return null;
  }

  const textByTiming: Record<string, string> =
    component.direction === "positive"
      ? {
          direct_starter_need: `Fills an open ${position} starter slot.`,
          flex_need: "Helps fill an open FLEX slot.",
          bench_depth: `Adds useful ${position} depth.`,
        }
      : component.direction === "negative"
        ? {
            early_def_k: `Early for ${position} relative to roster timing.`,
            saturated: `${position} is already saturated on the roster.`,
            limited_need: `Limited current roster need at ${position}.`,
          }
        : {};
  const text = textByTiming[timing];

  return text ? createReasonCandidate(component, `${component.id}:${timing}`, text) : null;
}

function buildTierCliffReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  if (component.direction !== "positive") {
    return null;
  }

  const position = getStringEvidence(component, "position");
  const thresholdMatched = getStringEvidence(component, "thresholdMatched");

  if (!position || !thresholdMatched) {
    return null;
  }

  if (thresholdMatched === "major_tier_cliff") {
    return createReasonCandidate(
      component,
      `${component.id}:${thresholdMatched}`,
      `A major ${position} tier drop follows.`,
    );
  }

  if (thresholdMatched === "last_in_tier") {
    return createReasonCandidate(
      component,
      `${component.id}:${thresholdMatched}`,
      `Last ${position} available in this tier.`,
    );
  }

  if (thresholdMatched === "mild_tier_pressure") {
    const sameTierRemaining = getNumberEvidence(component, "sameTierRemaining");

    return sameTierRemaining === null
      ? null
      : createReasonCandidate(
          component,
          `${component.id}:${thresholdMatched}`,
          `Only ${sameTierRemaining} ${position} options remain in this tier.`,
        );
  }

  return null;
}

function buildScarcityReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  if (component.direction !== "positive") {
    return null;
  }

  const position = getStringEvidence(component, "position");
  const thresholdMatched = getStringEvidence(component, "thresholdMatched");

  if (!position || !thresholdMatched) {
    return null;
  }

  if (thresholdMatched === "clear_scarcity") {
    const lookaheadRanks = getNumberEvidence(component, "lookaheadRanks");

    return lookaheadRanks === null
      ? null
      : createReasonCandidate(
          component,
          `${component.id}:${thresholdMatched}`,
          `No nearby ${position} options remain in the next ${lookaheadRanks} ranks.`,
        );
  }

  if (thresholdMatched === "mild_scarcity") {
    const nearbyOptions = getNumberEvidence(component, "nearbySamePositionOptions");

    return nearbyOptions === null
      ? null
      : createReasonCandidate(
          component,
          `${component.id}:${thresholdMatched}`,
          `Only ${nearbyOptions} nearby ${position} options remain.`,
        );
  }

  return null;
}

function buildRunReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  if (component.direction !== "positive") {
    return null;
  }

  const position = getStringEvidence(component, "position");
  const thresholdMatched = getStringEvidence(component, "thresholdMatched");
  const recentPositionPickCount = getNumberEvidence(component, "recentPositionPickCount");
  const recentPickWindow = getNumberEvidence(component, "recentPickWindow");

  if (
    !position ||
    (thresholdMatched !== "mild_run" && thresholdMatched !== "clear_run") ||
    recentPositionPickCount === null ||
    recentPickWindow === null
  ) {
    return null;
  }

  return createReasonCandidate(
    component,
    `${component.id}:${thresholdMatched}`,
    `${recentPositionPickCount} ${position} players were drafted in the last ${recentPickWindow} picks.`,
  );
}

function buildValueOpportunityReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  const currentPickNumber = getNumberEvidence(component, "currentPickNumber");
  const overallRank = getNumberEvidence(component, "overallRank");
  const thresholdMatched = getStringEvidence(component, "thresholdMatched");

  if (currentPickNumber === null || overallRank === null || !thresholdMatched) {
    return null;
  }

  const positiveThresholds = new Set(["small_value", "clear_value", "major_value"]);
  const negativeThresholds = new Set(["clear_reach", "major_reach"]);

  if (component.direction === "positive" && positiveThresholds.has(thresholdMatched)) {
    return createReasonCandidate(
      component,
      `${component.id}:${thresholdMatched}`,
      `Value at pick ${currentPickNumber}: ranked #${overallRank} overall.`,
    );
  }

  if (component.direction === "negative" && negativeThresholds.has(thresholdMatched)) {
    return createReasonCandidate(
      component,
      `${component.id}:${thresholdMatched}`,
      `Reach at pick ${currentPickNumber}: ranked #${overallRank} overall.`,
    );
  }

  return null;
}

function buildContextReasonCandidate(
  component: RecommendationScoreComponent,
): RecommendationReasonCandidate | null {
  if (component.id === "roster_fit") {
    return buildRosterFitReasonCandidate(component);
  }

  if (component.id === "tier_cliff") {
    return buildTierCliffReasonCandidate(component);
  }

  if (component.id === "positional_scarcity") {
    return buildScarcityReasonCandidate(component);
  }

  if (component.id === "positional_run") {
    return buildRunReasonCandidate(component);
  }

  if (component.id === "value_opportunity") {
    return buildValueOpportunityReasonCandidate(component);
  }

  return null;
}

function comparePositiveReasonCandidates(
  a: RecommendationReasonCandidate,
  b: RecommendationReasonCandidate,
) {
  if (b.reason.priority !== a.reason.priority) {
    return b.reason.priority - a.reason.priority;
  }

  if (b.delta !== a.delta) {
    return b.delta - a.delta;
  }

  return a.reason.id.localeCompare(b.reason.id);
}

function compareNegativeReasonCandidates(
  a: RecommendationReasonCandidate,
  b: RecommendationReasonCandidate,
) {
  if (a.delta !== b.delta) {
    return a.delta - b.delta;
  }

  if (b.reason.priority !== a.reason.priority) {
    return b.reason.priority - a.reason.priority;
  }

  return a.reason.id.localeCompare(b.reason.id);
}

export function selectRecommendationReasons({
  ranking,
  components,
  availableValueRank,
  tuning,
}: {
  ranking: RankingEntry;
  components: RecommendationScoreComponent[];
  availableValueRank: number;
  tuning: RecommendationTuningConfig;
}): RecommendationReason[] {
  const reasonLimit = Math.max(0, Math.floor(tuning.maxReasons));

  if (reasonLimit === 0) {
    return [];
  }

  const contextualPositiveCandidates = components.flatMap((component) => {
    if (
      component.id === "base_value" ||
      component.direction !== "positive" ||
      component.delta < tuning.positiveReasonThreshold
    ) {
      return [];
    }

    const candidate = buildContextReasonCandidate(component);

    return candidate ? [candidate] : [];
  });
  const negativeCandidates = components
    .flatMap((component) => {
      if (
        component.direction !== "negative" ||
        component.delta > tuning.negativeReasonThreshold
      ) {
        return [];
      }

      const candidate = buildContextReasonCandidate(component);

      return candidate ? [candidate] : [];
    })
    .sort(compareNegativeReasonCandidates);
  const positiveCandidates = [...contextualPositiveCandidates];
  const baseValueComponent = components.find((component) => component.id === "base_value");
  const baseOverallRank = baseValueComponent
    ? getNumberEvidence(baseValueComponent, "overallRank")
    : null;

  if (
    baseValueComponent &&
    baseOverallRank === ranking.overallRank &&
    (availableValueRank <= 5 || contextualPositiveCandidates.length === 0)
  ) {
    positiveCandidates.push(
      createReasonCandidate(
        baseValueComponent,
        "base_value:overall_rank",
        `Ranked #${baseOverallRank} overall.`,
      ),
    );
  }

  positiveCandidates.sort(comparePositiveReasonCandidates);

  const caveat = reasonLimit >= 2 ? negativeCandidates[0] : undefined;
  const positiveLimit = caveat ? reasonLimit - 1 : reasonLimit;
  const reasons = positiveCandidates.slice(0, positiveLimit).map((candidate) => candidate.reason);

  if (caveat) {
    reasons.push(caveat.reason);
  }

  return reasons;
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
  const availableRankings = input.rankings.filter((ranking) => {
    return !draftedPlayerIds.has(ranking.player.id);
  });
  const availableValueRanks = new Map(
    [...availableRankings]
      .sort(compareRankingsByStableDraftOrder)
      .map((ranking, index) => [ranking.player.id, index + 1] as const),
  );
  const distanceToNextUserPick = getDistanceToNextUserPick(input);

  return availableRankings
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
      const tierCliffComponent = calculateTierDropRiskComponent({
        ranking,
        availableRankings,
        distanceToNextUserPick,
        rosterFitDelta: rosterFitComponent.delta,
        tuning,
      });
      const positionalScarcityComponent = calculatePositionalScarcityComponent({
        ranking,
        availableRankings,
        rosterFitDelta: rosterFitComponent.delta,
        tuning,
      });
      const positionalRunComponent = calculatePositionalRunComponent({
        ranking,
        rankings: input.rankings,
        picks: input.draft.picks,
        currentPickNumber: input.draft.currentPickNumber,
        rosterFitDelta: rosterFitComponent.delta,
        tuning,
      });
      const valueOpportunityComponent = calculateValueOpportunityComponent({
        ranking,
        currentPickNumber: input.draft.currentPickNumber,
        rosterFitDelta: rosterFitComponent.delta,
        tuning,
      });
      const rawUrgencyScore =
        tierCliffComponent.delta +
        positionalScarcityComponent.delta +
        positionalRunComponent.delta;
      const urgencyScore = Math.min(rawUrgencyScore, tuning.maxUrgencyScore);
      const rawContextScore =
        rosterFitComponent.delta + urgencyScore + valueOpportunityComponent.delta;
      const contextScore = clamp(
        rawContextScore,
        tuning.maxNegativeContextScore,
        tuning.maxPositiveContextScore,
      );
      const totalScore = baseScore + contextScore;
      const components: RecommendationScoreComponent[] = [
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
        ...(tierCliffComponent.evidence?.thresholdMatched ===
          "neutral_recommendation_tiers"
          ? []
          : [tierCliffComponent]),
        positionalScarcityComponent,
        positionalRunComponent,
        valueOpportunityComponent,
      ];
      const scoreAdjustments: RecommendationScoreAdjustment[] = [];
      const urgencyAdjustmentDelta = urgencyScore - rawUrgencyScore;

      if (urgencyAdjustmentDelta !== 0) {
        scoreAdjustments.push({
          id: "urgency_cap",
          delta: urgencyAdjustmentDelta,
          direction: urgencyAdjustmentDelta > 0 ? "positive" : "negative",
          evidence: {
            rawScore: rawUrgencyScore,
            adjustedScore: urgencyScore,
            maxScore: tuning.maxUrgencyScore,
          },
        });
      }

      const contextAdjustmentDelta = contextScore - rawContextScore;

      if (contextAdjustmentDelta !== 0) {
        scoreAdjustments.push({
          id: "context_cap",
          delta: contextAdjustmentDelta,
          direction: contextAdjustmentDelta > 0 ? "positive" : "negative",
          evidence: {
            rawScore: rawContextScore,
            adjustedScore: contextScore,
            minScore: tuning.maxNegativeContextScore,
            maxScore: tuning.maxPositiveContextScore,
          },
        });
      }
      const reasons = selectRecommendationReasons({
        ranking,
        components,
        availableValueRank: availableValueRanks.get(ranking.player.id) ?? Number.MAX_SAFE_INTEGER,
        tuning,
      });

      return {
        ranking,
        playerId: ranking.player.id,
        totalScore,
        baseScore,
        contextScore,
        components,
        scoreAdjustments,
        reasons,
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

  if (
    ranking.tier === NEUTRAL_TIER &&
    samePositionRankings.length > 0 &&
    samePositionRankings.every((candidate) => candidate.tier === NEUTRAL_TIER)
  ) {
    return { modifier: 0, reason: null };
  }

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
