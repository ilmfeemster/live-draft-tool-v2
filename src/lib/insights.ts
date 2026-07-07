import type {
  Insight,
  InsightDecisionFrame,
  InsightInput,
  InsightScoreGapLabel,
  InsightSupport,
  LeagueSettings,
  PlayerRecommendation,
  Position,
  RecommendationScoreComponent,
  StrategicInsightBundle,
} from "@/types/draft";

const POSITIVE_MATERIAL_DELTA = 3;
const NEGATIVE_MATERIAL_DELTA = -6;
const CLOSE_SCORE_GAP = 3;
const SLIGHT_LEAN_SCORE_GAP = 8;

type SupportedComponent = {
  component: RecommendationScoreComponent;
  support: InsightSupport;
};

type TradeoffCandidate = {
  recommendation: PlayerRecommendation;
  playerQuality: SupportedComponent | null;
  rosterFit: SupportedComponent | null;
  timingPressure: SupportedComponent | null;
  valueOpportunity: SupportedComponent | null;
  caveat: SupportedComponent | null;
};

type TradeoffType =
  | "player_quality_vs_roster_timing"
  | "roster_fit_vs_timing_pressure"
  | "player_quality_vs_caveat"
  | "value_vs_roster_timing"
  | "close_same_strength";

type TradeoffSelection = {
  type: TradeoffType;
  candidates: [TradeoffCandidate, TradeoffCandidate];
  support: InsightSupport[];
};

type RosterInsightTiming =
  | "direct_starter_need"
  | "flex_need"
  | "bench_depth"
  | "saturated"
  | "early_def_k"
  | "limited_need";

type RosterPlayer = {
  position: Position;
};

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

type RosterInsightCandidate = {
  recommendation: PlayerRecommendation;
  component: RecommendationScoreComponent;
  support: InsightSupport;
  timing: RosterInsightTiming;
  position: Position;
  slotAnalysis: RosterSlotAnalysis;
};

type ForecastSignalLevel = "high" | "medium" | "low" | "neutral";

type TimingAllocationRole = "full" | "reduced" | "neutral";

type OverallTierOrigin = "source" | "defaulted-neutral";

type BoardInsightType =
  | "low_skip_safety"
  | "medium_skip_safety"
  | "meaningful_tier_disappears"
  | "wait_safe";

type DraftPocketTimingEvidence = {
  forecastStatus: string | null;
  targetPickNumber: number | null;
  candidatePosition: Position;
  profilePosition: Position;
  profileOverallTierOrigin: OverallTierOrigin | null;
  profileOverallTier: number | null;
  profileAnchorPlayerId: string | null;
  profileOrdinal: number | null;
  allocationRole: TimingAllocationRole | null;
  candidateInCurrentPocket: boolean | null;
  candidateInForecastedPocket: boolean | null;
  comparableReplacementCount: number | null;
  nearReplacementCount: number | null;
  replacementQuality: ForecastSignalLevel | null;
  skipSafety: ForecastSignalLevel | null;
  currentProfileCount: number | null;
  forecastedProfileCount: number | null;
  profileDisappeared: boolean | null;
  highestMeaningfulTierDisappeared: boolean | null;
  thresholdMatched: string | null;
};

type BoardInsightCandidate = {
  recommendation: PlayerRecommendation;
  component: RecommendationScoreComponent;
  support: InsightSupport;
  evidence: DraftPocketTimingEvidence;
  type: BoardInsightType;
  priority: number;
  recommendationIndex: number;
};

function getComponent(
  recommendation: PlayerRecommendation,
  componentId: string,
) {
  return recommendation.components.find((component) => {
    return component.id === componentId;
  });
}

function getReasonId(
  recommendation: PlayerRecommendation,
  componentId: string,
) {
  return recommendation.reasons.find((reason) => {
    return reason.sourceComponentId === componentId;
  })?.id;
}

function getEvidenceKeys(component: RecommendationScoreComponent) {
  return component.evidence ? Object.keys(component.evidence).sort() : [];
}

function createComponentSupport(
  recommendation: PlayerRecommendation,
  component: RecommendationScoreComponent,
): InsightSupport {
  return {
    playerId: recommendation.playerId,
    componentId: component.id,
    evidenceKeys: getEvidenceKeys(component),
    reasonId: getReasonId(recommendation, component.id),
  };
}

function isMaterialPositive(component: RecommendationScoreComponent) {
  return (
    component.direction === "positive" &&
    component.delta >= POSITIVE_MATERIAL_DELTA
  );
}

function isMaterialNegative(component: RecommendationScoreComponent) {
  return (
    component.direction === "negative" &&
    component.delta <= NEGATIVE_MATERIAL_DELTA
  );
}

function getStringEvidence(
  component: RecommendationScoreComponent,
  key: string,
) {
  const value = component.evidence?.[key];

  return typeof value === "string" ? value : null;
}

function getNumberEvidence(
  component: RecommendationScoreComponent,
  key: string,
) {
  const value = component.evidence?.[key];

  return typeof value === "number" ? value : null;
}

function getBooleanEvidence(
  component: RecommendationScoreComponent,
  key: string,
) {
  const value = component.evidence?.[key];

  return typeof value === "boolean" ? value : null;
}

function isPosition(value: string | null): value is Position {
  return (
    value === "QB" ||
    value === "RB" ||
    value === "WR" ||
    value === "TE" ||
    value === "DST" ||
    value === "K"
  );
}

function isForecastSignalLevel(
  value: string | null,
): value is ForecastSignalLevel {
  return (
    value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "neutral"
  );
}

function isTimingAllocationRole(
  value: string | null,
): value is TimingAllocationRole {
  return value === "full" || value === "reduced" || value === "neutral";
}

function isOverallTierOrigin(value: string | null): value is OverallTierOrigin {
  return value === "source" || value === "defaulted-neutral";
}

function deriveScoreGapLabel(
  recommendations: readonly PlayerRecommendation[],
): InsightScoreGapLabel {
  if (recommendations.length < 2) {
    return "unavailable";
  }

  const scoreGap = recommendations[0].totalScore - recommendations[1].totalScore;

  if (scoreGap <= CLOSE_SCORE_GAP) {
    return "close_call";
  }

  if (scoreGap <= SLIGHT_LEAN_SCORE_GAP) {
    return "slight_lean";
  }

  return "clear_lean";
}

function isSupportedRosterFit(component: RecommendationScoreComponent) {
  const timing = getStringEvidence(component, "timing");

  return (
    isMaterialPositive(component) &&
    (timing === "direct_starter_need" ||
      timing === "flex_need" ||
      timing === "bench_depth")
  );
}

function getRosterInsightTiming(
  component: RecommendationScoreComponent,
): RosterInsightTiming | null {
  if (component.id !== "roster_fit") {
    return null;
  }

  const timing = getStringEvidence(component, "timing");

  if (
    isMaterialPositive(component) &&
    (timing === "direct_starter_need" ||
      timing === "flex_need" ||
      timing === "bench_depth")
  ) {
    return timing;
  }

  if (
    isMaterialNegative(component) &&
    (timing === "saturated" ||
      timing === "early_def_k" ||
      timing === "limited_need")
  ) {
    return timing;
  }

  return null;
}

function isSupportedCaveat(component: RecommendationScoreComponent) {
  if (!isMaterialNegative(component)) {
    return false;
  }

  if (component.id === "roster_fit") {
    const timing = getStringEvidence(component, "timing");

    return (
      timing === "saturated" ||
      timing === "limited_need" ||
      timing === "early_def_k"
    );
  }

  if (component.id === "value_opportunity") {
    const threshold = getStringEvidence(component, "thresholdMatched");

    return threshold === "clear_reach" || threshold === "major_reach";
  }

  return true;
}

function isSupportedDraftPocketTiming(
  component: RecommendationScoreComponent,
) {
  if (!isMaterialPositive(component)) {
    return false;
  }

  const threshold = getStringEvidence(component, "thresholdMatched");
  const forecastStatus = getStringEvidence(component, "forecastStatus");
  const skipSafety = getStringEvidence(component, "skipSafety");
  const allocationRole = getStringEvidence(component, "allocationRole");
  const candidateInCurrentPocket = getBooleanEvidence(
    component,
    "candidateInCurrentPocket",
  );

  if (
    forecastStatus !== "active" ||
    candidateInCurrentPocket !== true ||
    (skipSafety !== "low" && skipSafety !== "medium")
  ) {
    return false;
  }

  if (skipSafety === "low") {
    return (
      threshold === "low_skip_safety" &&
      (allocationRole === "full" || allocationRole === "reduced")
    );
  }

  return threshold === "medium_skip_safety" && allocationRole === "full";
}

function isSupportedOverallTier(component: RecommendationScoreComponent) {
  if (!isMaterialPositive(component)) {
    return false;
  }

  const origin = getStringEvidence(component, "overallTierOrigin");
  const threshold = getStringEvidence(component, "thresholdMatched");

  return (
    origin === "source" &&
    (threshold === "best_overall_tier_available" ||
      threshold === "last_in_best_overall_tier")
  );
}

function isSupportedTierCliff(component: RecommendationScoreComponent) {
  if (!isMaterialPositive(component)) {
    return false;
  }

  const threshold = getStringEvidence(component, "thresholdMatched");

  return (
    threshold === "mild_tier_pressure" ||
    threshold === "last_in_tier" ||
    threshold === "major_tier_cliff"
  );
}

function isSupportedRunPressure(component: RecommendationScoreComponent) {
  if (!isMaterialPositive(component)) {
    return false;
  }

  const threshold = getStringEvidence(component, "thresholdMatched");

  return threshold === "mild_run" || threshold === "clear_run";
}

function isSupportedValueOpportunity(component: RecommendationScoreComponent) {
  if (!isMaterialPositive(component)) {
    return false;
  }

  const threshold = getStringEvidence(component, "thresholdMatched");

  return (
    threshold === "small_value" ||
    threshold === "clear_value" ||
    threshold === "major_value"
  );
}

function isSupportedPositiveComponent(
  component: RecommendationScoreComponent,
) {
  if (component.id === "base_value") {
    return isMaterialPositive(component);
  }

  if (component.id === "roster_fit") {
    return isSupportedRosterFit(component);
  }

  if (component.id === "draft_pocket_timing") {
    return isSupportedDraftPocketTiming(component);
  }

  if (component.id === "overall_tier") {
    return isSupportedOverallTier(component);
  }

  if (component.id === "tier_cliff") {
    return isSupportedTierCliff(component);
  }

  if (component.id === "positional_run") {
    return isSupportedRunPressure(component);
  }

  if (component.id === "value_opportunity") {
    return isSupportedValueOpportunity(component);
  }

  if (component.id === "positional_scarcity") {
    return isMaterialPositive(component);
  }

  return false;
}

function getSupportedComponent(
  recommendation: PlayerRecommendation,
  componentId: string,
  predicate: (component: RecommendationScoreComponent) => boolean,
): SupportedComponent | null {
  const component = getComponent(recommendation, componentId);

  if (!component || !predicate(component)) {
    return null;
  }

  return {
    component,
    support: createComponentSupport(recommendation, component),
  };
}

function getMaterialCaveat(recommendation: PlayerRecommendation) {
  const caveats = recommendation.components
    .filter(isSupportedCaveat)
    .sort((a, b) => {
      if (a.delta !== b.delta) {
        return a.delta - b.delta;
      }

      return a.id.localeCompare(b.id);
    });

  const [component] = caveats;

  return component
    ? {
        component,
        support: createComponentSupport(recommendation, component),
      }
    : null;
}

function hasStrongerBaseScore(
  recommendations: readonly PlayerRecommendation[],
  topRecommendation: PlayerRecommendation,
) {
  return recommendations.some((recommendation) => {
    return recommendation.baseScore > topRecommendation.baseScore;
  });
}

function hasHighestBaseScore(
  recommendations: readonly PlayerRecommendation[],
  topRecommendation: PlayerRecommendation,
) {
  return recommendations.every((recommendation) => {
    return topRecommendation.baseScore >= recommendation.baseScore;
  });
}

function getSupportedUrgencyComponent(recommendation: PlayerRecommendation) {
  return (
    getSupportedComponent(
      recommendation,
      "draft_pocket_timing",
      isSupportedDraftPocketTiming,
    ) ??
    getSupportedComponent(recommendation, "tier_cliff", isSupportedTierCliff) ??
    getSupportedComponent(
      recommendation,
      "positional_run",
      isSupportedRunPressure,
    ) ??
    getSupportedComponent(
      recommendation,
      "positional_scarcity",
      isMaterialPositive,
    )
  );
}

function getSupportedValueOpportunityComponent(
  recommendation: PlayerRecommendation,
) {
  return getSupportedComponent(
    recommendation,
    "value_opportunity",
    isSupportedValueOpportunity,
  );
}

function classifyTradeoffCandidate(
  recommendation: PlayerRecommendation,
): TradeoffCandidate {
  return {
    recommendation,
    playerQuality: getSupportedComponent(
      recommendation,
      "base_value",
      isMaterialPositive,
    ),
    rosterFit: getSupportedComponent(
      recommendation,
      "roster_fit",
      isSupportedRosterFit,
    ),
    timingPressure: getSupportedUrgencyComponent(recommendation),
    valueOpportunity: getSupportedValueOpportunityComponent(recommendation),
    caveat: getMaterialCaveat(recommendation),
  };
}

function getComparisonCandidates(
  recommendations: readonly PlayerRecommendation[],
  scoreGapLabel: InsightScoreGapLabel,
) {
  if (scoreGapLabel !== "close_call" && scoreGapLabel !== "slight_lean") {
    return [];
  }

  const [topRecommendation] = recommendations;

  if (!topRecommendation) {
    return [];
  }

  return recommendations
    .slice(0, 3)
    .filter((recommendation) => {
      return topRecommendation.totalScore - recommendation.totalScore <= SLIGHT_LEAN_SCORE_GAP;
    })
    .map(classifyTradeoffCandidate);
}

function getCandidatePairs(candidates: readonly TradeoffCandidate[]) {
  const pairs: Array<[TradeoffCandidate, TradeoffCandidate]> = [];

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < candidates.length;
      secondIndex += 1
    ) {
      pairs.push([candidates[firstIndex], candidates[secondIndex]]);
    }
  }

  return pairs;
}

function hasRosterOrTiming(candidate: TradeoffCandidate) {
  return Boolean(candidate.rosterFit ?? candidate.timingPressure);
}

function getRosterOrTimingSupport(candidate: TradeoffCandidate) {
  return candidate.rosterFit?.support ?? candidate.timingPressure?.support ?? null;
}

function hasSamePosition(
  first: TradeoffCandidate,
  second: TradeoffCandidate,
) {
  return (
    first.recommendation.ranking.player.position ===
    second.recommendation.ranking.player.position
  );
}

function getPlayerQualityVsRosterTimingTradeoff(
  pairs: readonly [TradeoffCandidate, TradeoffCandidate][],
): TradeoffSelection | null {
  for (const [first, second] of pairs) {
    const firstPlayerQuality = first.playerQuality;
    const secondPlayerQuality = second.playerQuality;
    const firstQualityAdvantage =
      firstPlayerQuality &&
      first.recommendation.baseScore > second.recommendation.baseScore &&
      hasRosterOrTiming(second);
    const secondQualityAdvantage =
      secondPlayerQuality &&
      second.recommendation.baseScore > first.recommendation.baseScore &&
      hasRosterOrTiming(first);

    if (firstQualityAdvantage) {
      const contrastSupport = getRosterOrTimingSupport(second);

      if (contrastSupport) {
        return {
          type: "player_quality_vs_roster_timing",
          candidates: [first, second],
          support: [firstPlayerQuality.support, contrastSupport],
        };
      }
    }

    if (secondQualityAdvantage) {
      const contrastSupport = getRosterOrTimingSupport(first);

      if (contrastSupport) {
        return {
          type: "player_quality_vs_roster_timing",
          candidates: [second, first],
          support: [secondPlayerQuality.support, contrastSupport],
        };
      }
    }
  }

  return null;
}

function getRosterVsTimingTradeoff(
  pairs: readonly [TradeoffCandidate, TradeoffCandidate][],
): TradeoffSelection | null {
  for (const [first, second] of pairs) {
    if (first.rosterFit && second.timingPressure) {
      return {
        type: "roster_fit_vs_timing_pressure",
        candidates: [first, second],
        support: [first.rosterFit.support, second.timingPressure.support],
      };
    }

    if (second.rosterFit && first.timingPressure) {
      return {
        type: "roster_fit_vs_timing_pressure",
        candidates: [second, first],
        support: [second.rosterFit.support, first.timingPressure.support],
      };
    }
  }

  return null;
}

function getPlayerQualityVsCaveatTradeoff(
  pairs: readonly [TradeoffCandidate, TradeoffCandidate][],
): TradeoffSelection | null {
  for (const [first, second] of pairs) {
    const firstPlayerQuality = first.playerQuality;
    const firstCaveat = first.caveat;
    const secondPlayerQuality = second.playerQuality;
    const secondCaveat = second.caveat;
    const firstQualityWithCaveat =
      firstPlayerQuality &&
      firstCaveat &&
      first.recommendation.baseScore > second.recommendation.baseScore &&
      !second.caveat;
    const secondQualityWithCaveat =
      secondPlayerQuality &&
      secondCaveat &&
      second.recommendation.baseScore > first.recommendation.baseScore &&
      !first.caveat;

    if (firstQualityWithCaveat) {
      return {
        type: "player_quality_vs_caveat",
        candidates: [first, second],
        support: [firstPlayerQuality.support, firstCaveat.support],
      };
    }

    if (secondQualityWithCaveat) {
      return {
        type: "player_quality_vs_caveat",
        candidates: [second, first],
        support: [secondPlayerQuality.support, secondCaveat.support],
      };
    }
  }

  return null;
}

function getValueVsRosterTimingTradeoff(
  pairs: readonly [TradeoffCandidate, TradeoffCandidate][],
): TradeoffSelection | null {
  for (const [first, second] of pairs) {
    if (first.valueOpportunity && hasRosterOrTiming(second)) {
      const contrastSupport = getRosterOrTimingSupport(second);

      if (contrastSupport) {
        return {
          type: "value_vs_roster_timing",
          candidates: [first, second],
          support: [first.valueOpportunity.support, contrastSupport],
        };
      }
    }

    if (second.valueOpportunity && hasRosterOrTiming(first)) {
      const contrastSupport = getRosterOrTimingSupport(first);

      if (contrastSupport) {
        return {
          type: "value_vs_roster_timing",
          candidates: [second, first],
          support: [second.valueOpportunity.support, contrastSupport],
        };
      }
    }
  }

  return null;
}

function getPrimaryStrength(candidate: TradeoffCandidate) {
  return (
    candidate.rosterFit ??
    candidate.timingPressure ??
    candidate.valueOpportunity ??
    candidate.playerQuality
  );
}

function getCloseSameStrengthTradeoff(
  pairs: readonly [TradeoffCandidate, TradeoffCandidate][],
): TradeoffSelection | null {
  for (const [first, second] of pairs) {
    const firstStrength = getPrimaryStrength(first);
    const secondStrength = getPrimaryStrength(second);

    if (
      firstStrength &&
      secondStrength &&
      firstStrength.component.id === secondStrength.component.id &&
      !hasSamePosition(first, second)
    ) {
      return {
        type: "close_same_strength",
        candidates: [first, second],
        support: [firstStrength.support, secondStrength.support],
      };
    }
  }

  return null;
}

function selectTradeoffInsight({
  recommendations,
  scoreGapLabel,
}: {
  recommendations: readonly PlayerRecommendation[];
  scoreGapLabel: InsightScoreGapLabel;
}): Insight | null {
  const candidates = getComparisonCandidates(recommendations, scoreGapLabel);
  const pairs = getCandidatePairs(candidates);
  const selection =
    getPlayerQualityVsRosterTimingTradeoff(pairs) ??
    getRosterVsTimingTradeoff(pairs) ??
    getPlayerQualityVsCaveatTradeoff(pairs) ??
    getValueVsRosterTimingTradeoff(pairs) ??
    getCloseSameStrengthTradeoff(pairs);

  return selection ? createTradeoffInsight(selection) : null;
}

function isBenchSlot(label: string) {
  return label.toUpperCase() === "BENCH";
}

function getUserRosterPlayers(input: InsightInput): RosterPlayer[] {
  const rankingsByPlayerId = new Map(
    input.rankings.map((ranking) => {
      return [ranking.player.id, ranking] as const;
    }),
  );

  return input.draft.picks.flatMap((pick) => {
    if (pick.teamId !== input.userTeamId || !pick.playerId) {
      return [];
    }

    const ranking = rankingsByPlayerId.get(pick.playerId);

    return ranking ? [{ position: ranking.player.position }] : [];
  });
}

function countRosterPosition(
  rosterPlayers: readonly RosterPlayer[],
  position: Position,
) {
  return rosterPlayers.filter((player) => player.position === position).length;
}

function getDirectStarterSlots(
  leagueSettings: LeagueSettings,
  position: Position,
) {
  return leagueSettings.rosterSlots.filter((slot) => {
    return (
      !isBenchSlot(slot.label) &&
      slot.eligiblePositions.length === 1 &&
      slot.eligiblePositions[0] === position
    );
  });
}

function getFlexSlots(leagueSettings: LeagueSettings, position: Position) {
  return leagueSettings.rosterSlots.filter((slot) => {
    return (
      !isBenchSlot(slot.label) &&
      slot.eligiblePositions.length > 1 &&
      slot.eligiblePositions.includes(position)
    );
  });
}

function analyzeRosterSlots({
  leagueSettings,
  rosterPlayers,
  position,
}: {
  leagueSettings: LeagueSettings;
  rosterPlayers: readonly RosterPlayer[];
  position: Position;
}): RosterSlotAnalysis {
  const benchSlots = leagueSettings.rosterSlots.filter((slot) => {
    return isBenchSlot(slot.label) && slot.eligiblePositions.includes(position);
  }).length;
  const directStarterSlots = getDirectStarterSlots(
    leagueSettings,
    position,
  ).length;
  const flexSlots = getFlexSlots(leagueSettings, position).length;
  const allFlexEligiblePositions = new Set(
    leagueSettings.rosterSlots
      .filter((slot) => !isBenchSlot(slot.label) && slot.eligiblePositions.length > 1)
      .flatMap((slot) => slot.eligiblePositions),
  );
  const rosterCountAtPosition = countRosterPosition(rosterPlayers, position);
  const directStarterOpenings = Math.max(
    directStarterSlots - rosterCountAtPosition,
    0,
  );
  const flexEligibleSurplus = Array.from(allFlexEligiblePositions).reduce(
    (surplus, eligiblePosition) => {
      const directSlotsForPosition = getDirectStarterSlots(
        leagueSettings,
        eligiblePosition,
      ).length;

      return (
        surplus +
        Math.max(
          countRosterPosition(rosterPlayers, eligiblePosition) -
            directSlotsForPosition,
          0,
        )
      );
    },
    0,
  );
  const flexOpenings = Math.max(flexSlots - flexEligibleSurplus, 0);
  const totalNonBenchSlots = leagueSettings.rosterSlots.filter((slot) => {
    return !isBenchSlot(slot.label);
  }).length;
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

function getRosterPosition(
  recommendation: PlayerRecommendation,
  component: RecommendationScoreComponent,
): Position | null {
  const evidencePosition = getStringEvidence(component, "position");

  if (isPosition(evidencePosition)) {
    return evidencePosition;
  }

  return recommendation.ranking.player.position;
}

function classifyRosterInsightCandidate(
  input: InsightInput,
  rosterPlayers: readonly RosterPlayer[],
  recommendation: PlayerRecommendation,
): RosterInsightCandidate | null {
  const component = getComponent(recommendation, "roster_fit");

  if (!component) {
    return null;
  }

  const timing = getRosterInsightTiming(component);
  const position = getRosterPosition(recommendation, component);

  if (!timing || !position) {
    return null;
  }

  return {
    recommendation,
    component,
    support: createComponentSupport(recommendation, component),
    timing,
    position,
    slotAnalysis: analyzeRosterSlots({
      leagueSettings: input.leagueSettings,
      rosterPlayers,
      position,
    }),
  };
}

function getRosterInsightCandidates({
  input,
  scoreGapLabel,
}: {
  input: InsightInput;
  scoreGapLabel: InsightScoreGapLabel;
}) {
  const rosterPlayers = getUserRosterPlayers(input);
  const recommendationCandidates =
    scoreGapLabel === "close_call" || scoreGapLabel === "slight_lean"
      ? input.recommendations.slice(0, 3)
      : input.recommendations.slice(0, 1);

  return recommendationCandidates.flatMap((recommendation) => {
    const candidate = classifyRosterInsightCandidate(
      input,
      rosterPlayers,
      recommendation,
    );

    return candidate ? [candidate] : [];
  });
}

function getRosterTimingPriority(timing: RosterInsightTiming) {
  const priorities: Record<RosterInsightTiming, number> = {
    direct_starter_need: 1,
    flex_need: 2,
    saturated: 3,
    early_def_k: 4,
    bench_depth: 5,
    limited_need: 6,
  };

  return priorities[timing];
}

function selectRosterInsight({
  input,
  scoreGapLabel,
}: {
  input: InsightInput;
  scoreGapLabel: InsightScoreGapLabel;
}): Insight | null {
  const candidates = getRosterInsightCandidates({ input, scoreGapLabel });
  const leadingCandidate = candidates.find((candidate) => {
    return candidate.recommendation === input.recommendations[0];
  });
  const selected =
    leadingCandidate ??
    candidates.sort((a, b) => {
      return getRosterTimingPriority(a.timing) - getRosterTimingPriority(b.timing);
    })[0];

  return selected ? createRosterInsight(selected) : null;
}

function isSingleStartOnly(candidate: RosterInsightCandidate) {
  return (
    candidate.slotAnalysis.directStarterSlots === 1 &&
    candidate.slotAnalysis.flexSlots === 0
  );
}

function createRosterInsight(candidate: RosterInsightCandidate): Insight {
  const { recommendation, position, slotAnalysis, timing } = candidate;
  const titles: Record<RosterInsightTiming, string> = {
    direct_starter_need: `Open ${position} starter slot`,
    flex_need:
      position === "TE"
        ? "TE has flex eligibility here"
        : `${position} still carries flex utility`,
    bench_depth: `Bench depth is still useful at ${position}`,
    saturated: `${position} is close to saturated`,
    early_def_k: `${position} is early for this roster phase`,
    limited_need: isSingleStartOnly(candidate)
      ? `${position} is a single-start slot here`
      : `Limited roster need at ${position}`,
  };
  const bodies: Record<RosterInsightTiming, string> = {
    direct_starter_need:
      slotAnalysis.directStarterOpenings > 1
        ? `${recommendation.ranking.player.name} fits one of ${slotAnalysis.directStarterOpenings} open ${position} starter slots.`
        : `${recommendation.ranking.player.name} fits an open ${position} starter slot.`,
    flex_need:
      position === "TE"
        ? `${recommendation.ranking.player.name} is flex-eligible in this format, but TE depth should stay tied to supported roster need.`
        : `${recommendation.ranking.player.name} helps fill remaining flex utility in this roster format.`,
    bench_depth:
      `${recommendation.ranking.player.name} still has useful bench-depth value for this roster shape.`,
    saturated:
      `${recommendation.ranking.player.name} carries a roster caveat because ${position} is already near its useful capacity.`,
    early_def_k:
      `${recommendation.ranking.player.name} carries a roster-timing caveat for this draft phase.`,
    limited_need: isSingleStartOnly(candidate)
      ? `${recommendation.ranking.player.name} has limited roster utility unless this format creates more ${position} demand.`
      : `${recommendation.ranking.player.name} has limited roster utility for the current roster shape.`,
  };

  return {
    id: `roster_context:${timing}:${recommendation.playerId}`,
    kind: "roster_context",
    severity:
      timing === "direct_starter_need" ||
      timing === "flex_need" ||
      timing === "bench_depth"
        ? "positive"
        : "warning",
    title: titles[timing],
    body: bodies[timing],
    supportedBy: [candidate.support],
  };
}

function getDraftPocketTimingEvidence(
  component: RecommendationScoreComponent,
): DraftPocketTimingEvidence | null {
  const candidatePosition = getStringEvidence(component, "candidatePosition");
  const profilePosition = getStringEvidence(component, "profilePosition");

  if (!isPosition(candidatePosition) || !isPosition(profilePosition)) {
    return null;
  }

  const profileOverallTierOrigin = getStringEvidence(
    component,
    "profileOverallTierOrigin",
  );
  const allocationRole = getStringEvidence(component, "allocationRole");
  const replacementQuality = getStringEvidence(component, "replacementQuality");
  const skipSafety = getStringEvidence(component, "skipSafety");

  return {
    forecastStatus: getStringEvidence(component, "forecastStatus"),
    targetPickNumber: getNumberEvidence(component, "targetPickNumber"),
    candidatePosition,
    profilePosition,
    profileOverallTierOrigin: isOverallTierOrigin(profileOverallTierOrigin)
      ? profileOverallTierOrigin
      : null,
    profileOverallTier: getNumberEvidence(component, "profileOverallTier"),
    profileAnchorPlayerId: getStringEvidence(component, "profileAnchorPlayerId"),
    profileOrdinal: getNumberEvidence(component, "profileOrdinal"),
    allocationRole: isTimingAllocationRole(allocationRole)
      ? allocationRole
      : null,
    candidateInCurrentPocket: getBooleanEvidence(
      component,
      "candidateInCurrentPocket",
    ),
    candidateInForecastedPocket: getBooleanEvidence(
      component,
      "candidateInForecastedPocket",
    ),
    comparableReplacementCount: getNumberEvidence(
      component,
      "comparableReplacementCount",
    ),
    nearReplacementCount: getNumberEvidence(component, "nearReplacementCount"),
    replacementQuality: isForecastSignalLevel(replacementQuality)
      ? replacementQuality
      : null,
    skipSafety: isForecastSignalLevel(skipSafety) ? skipSafety : null,
    currentProfileCount: getNumberEvidence(component, "currentProfileCount"),
    forecastedProfileCount: getNumberEvidence(
      component,
      "forecastedProfileCount",
    ),
    profileDisappeared: getBooleanEvidence(component, "profileDisappeared"),
    highestMeaningfulTierDisappeared: getBooleanEvidence(
      component,
      "highestMeaningfulTierDisappeared",
    ),
    thresholdMatched: getStringEvidence(component, "thresholdMatched"),
  };
}

function getForecastProfileId(evidence: DraftPocketTimingEvidence) {
  if (
    evidence.profileOverallTierOrigin === null ||
    evidence.profileOverallTier === null
  ) {
    return undefined;
  }

  return `profile:${evidence.profilePosition}:${evidence.profileOverallTierOrigin}:${evidence.profileOverallTier}`;
}

function createForecastComponentSupport(
  recommendation: PlayerRecommendation,
  component: RecommendationScoreComponent,
  evidence: DraftPocketTimingEvidence,
): InsightSupport {
  return {
    ...createComponentSupport(recommendation, component),
    forecastProfileId: getForecastProfileId(evidence),
  };
}

function hasActiveForecastContext(
  input: InsightInput,
  evidence: DraftPocketTimingEvidence,
) {
  if (input.forecast && input.forecast.status !== "active") {
    return false;
  }

  return evidence.forecastStatus === "active";
}

function isBoardEligibleTimingEvidence({
  input,
  evidence,
}: {
  input: InsightInput;
  evidence: DraftPocketTimingEvidence;
}) {
  return (
    hasActiveForecastContext(input, evidence) &&
    evidence.candidateInCurrentPocket === true &&
    evidence.candidatePosition !== "DST" &&
    evidence.candidatePosition !== "K"
  );
}

function hasPressureAllocation(evidence: DraftPocketTimingEvidence) {
  return evidence.allocationRole === "full" || evidence.allocationRole === "reduced";
}

function hasAbsentComparableProfiles(evidence: DraftPocketTimingEvidence) {
  return (
    evidence.comparableReplacementCount === 0 ||
    evidence.forecastedProfileCount === 0 ||
    evidence.profileDisappeared === true
  );
}

function hasLimitedComparableProfiles(evidence: DraftPocketTimingEvidence) {
  return (
    evidence.replacementQuality === "medium" ||
    (evidence.comparableReplacementCount !== null &&
      evidence.comparableReplacementCount <= 1) ||
    (evidence.nearReplacementCount !== null && evidence.nearReplacementCount > 0)
  );
}

function hasWaitSafeProfiles(evidence: DraftPocketTimingEvidence) {
  return (
    evidence.replacementQuality === "high" ||
    (evidence.comparableReplacementCount !== null &&
      evidence.comparableReplacementCount >= 2) ||
    (evidence.forecastedProfileCount !== null &&
      evidence.forecastedProfileCount >= 2)
  );
}

function createBoardInsightCandidate({
  input,
  recommendation,
  component,
  recommendationIndex,
  type,
  priority,
}: {
  input: InsightInput;
  recommendation: PlayerRecommendation;
  component: RecommendationScoreComponent;
  recommendationIndex: number;
  type: BoardInsightType;
  priority: number;
}): BoardInsightCandidate | null {
  const evidence = getDraftPocketTimingEvidence(component);

  if (!evidence || !isBoardEligibleTimingEvidence({ input, evidence })) {
    return null;
  }

  return {
    recommendation,
    component,
    support: createForecastComponentSupport(recommendation, component, evidence),
    evidence,
    type,
    priority,
    recommendationIndex,
  };
}

function classifyBoardInsightCandidates({
  input,
  recommendation,
  recommendationIndex,
}: {
  input: InsightInput;
  recommendation: PlayerRecommendation;
  recommendationIndex: number;
}) {
  const component = getComponent(recommendation, "draft_pocket_timing");

  if (!component) {
    return [];
  }

  const evidence = getDraftPocketTimingEvidence(component);

  if (!evidence || !isBoardEligibleTimingEvidence({ input, evidence })) {
    return [];
  }

  const candidates: BoardInsightCandidate[] = [];
  const materialPressure =
    isMaterialPositive(component) && hasPressureAllocation(evidence);
  const addCandidate = (type: BoardInsightType, priority: number) => {
    const candidate = createBoardInsightCandidate({
      input,
      recommendation,
      component,
      recommendationIndex,
      type,
      priority,
    });

    if (candidate) {
      candidates.push(candidate);
    }
  };

  if (
    materialPressure &&
    evidence.skipSafety === "low" &&
    evidence.thresholdMatched === "low_skip_safety" &&
    hasAbsentComparableProfiles(evidence)
  ) {
    addCandidate("low_skip_safety", 1);
  }

  if (
    materialPressure &&
    evidence.skipSafety === "medium" &&
    evidence.thresholdMatched === "medium_skip_safety" &&
    evidence.allocationRole === "full" &&
    hasLimitedComparableProfiles(evidence)
  ) {
    addCandidate("medium_skip_safety", 2);
  }

  if (
    materialPressure &&
    evidence.profileOverallTierOrigin === "source" &&
    evidence.highestMeaningfulTierDisappeared === true
  ) {
    addCandidate("meaningful_tier_disappears", 3);
  }

  if (
    component.direction === "neutral" &&
    evidence.skipSafety === "high" &&
    evidence.thresholdMatched === "high_skip_safety" &&
    hasWaitSafeProfiles(evidence)
  ) {
    addCandidate("wait_safe", 4);
  }

  return candidates;
}

function selectBoardInsight(input: InsightInput): Insight | null {
  const candidates = input.recommendations
    .slice(0, 3)
    .flatMap((recommendation, recommendationIndex) => {
      return classifyBoardInsightCandidates({
        input,
        recommendation,
        recommendationIndex,
      });
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return a.recommendationIndex - b.recommendationIndex;
    });
  const [selected] = candidates;

  return selected ? createBoardInsight(selected) : null;
}

function createBoardInsight(candidate: BoardInsightCandidate): Insight {
  const { evidence, recommendation, type } = candidate;
  const titles: Record<BoardInsightType, string> = {
    low_skip_safety: "Next-pocket profile pressure",
    medium_skip_safety: "Limited next-pocket support",
    meaningful_tier_disappears: "Current-pocket tier context",
    wait_safe: "Comparable profiles remain",
  };
  const bodies: Record<BoardInsightType, string> = {
    low_skip_safety:
      `Comparable ${evidence.profilePosition} profiles thin out before your next pick.`,
    medium_skip_safety:
      `This ${evidence.profilePosition} profile has limited next-pocket support.`,
    meaningful_tier_disappears:
      `Current-pocket timing is supported for this ${evidence.profilePosition} profile.`,
    wait_safe:
      `Comparable ${evidence.profilePosition} profiles remain in the next pocket.`,
  };
  const insightKind = type === "meaningful_tier_disappears"
    ? "board_context"
    : "next_pocket";

  return {
    id: `${insightKind}:${type}:${recommendation.playerId}`,
    kind: insightKind,
    severity:
      type === "low_skip_safety" || type === "meaningful_tier_disappears"
        ? "warning"
        : "info",
    title: titles[type],
    body: bodies[type],
    supportedBy: [candidate.support],
  };
}

function createTradeoffInsight(selection: TradeoffSelection): Insight {
  const [first, second] = selection.candidates;
  const playerNames = [
    first.recommendation.ranking.player.name,
    second.recommendation.ranking.player.name,
  ];
  const titles: Record<TradeoffType, string> = {
    player_quality_vs_roster_timing: "Player quality versus roster/timing",
    roster_fit_vs_timing_pressure: "Roster fit versus timing pressure",
    player_quality_vs_caveat: "Player quality with a caveat",
    value_vs_roster_timing: "Value versus roster/timing",
    close_same_strength: "Close options with similar support",
  };
  const bodies: Record<TradeoffType, string> = {
    player_quality_vs_roster_timing:
      `${playerNames[0]} has the stronger player-quality case; ${playerNames[1]} has the stronger roster or timing support.`,
    roster_fit_vs_timing_pressure:
      `${playerNames[0]} has the cleaner roster-fit case; ${playerNames[1]} carries more timing pressure.`,
    player_quality_vs_caveat:
      `${playerNames[0]} has the stronger player-quality case, but the recommendation carries a material caveat.`,
    value_vs_roster_timing:
      `${playerNames[0]} is the value case; ${playerNames[1]} has the stronger roster or timing support.`,
    close_same_strength:
      `${playerNames[0]} and ${playerNames[1]} are close options with similar supported cases.`,
  };

  return {
    id: `tradeoff:${selection.type}:${first.recommendation.playerId}:${second.recommendation.playerId}`,
    kind: "tradeoff",
    severity: selection.type === "player_quality_vs_caveat" ? "warning" : "info",
    title: titles[selection.type],
    body: bodies[selection.type],
    supportedBy: selection.support,
  };
}

function getPrimaryFrame({
  recommendations,
  scoreGapLabel,
}: {
  recommendations: readonly PlayerRecommendation[];
  scoreGapLabel: InsightScoreGapLabel;
}): {
  frame: InsightDecisionFrame;
  support: InsightSupport[];
} {
  const topRecommendation = recommendations[0];

  if (!topRecommendation) {
    return { frame: "no_material_insight", support: [] };
  }

  if (scoreGapLabel === "close_call") {
    return {
      frame: "close_call",
      support: [{ playerId: topRecommendation.playerId }],
    };
  }

  const caveat = getMaterialCaveat(topRecommendation);

  if (caveat) {
    return {
      frame: "caveated_top_pick",
      support: [caveat.support],
    };
  }

  const pocketTiming = getSupportedComponent(
    topRecommendation,
    "draft_pocket_timing",
    isSupportedDraftPocketTiming,
  );

  if (pocketTiming) {
    return {
      frame: "pocket_pressure",
      support: [pocketTiming.support],
    };
  }

  const tierBoundary =
    getSupportedComponent(
      topRecommendation,
      "overall_tier",
      isSupportedOverallTier,
    ) ??
    getSupportedComponent(topRecommendation, "tier_cliff", isSupportedTierCliff);

  if (tierBoundary) {
    return {
      frame: "tier_boundary",
      support: [tierBoundary.support],
    };
  }

  const runPressure = getSupportedComponent(
    topRecommendation,
    "positional_run",
    isSupportedRunPressure,
  );

  if (runPressure) {
    return {
      frame: "run_pressure",
      support: [runPressure.support],
    };
  }

  const rosterFit = getSupportedComponent(
    topRecommendation,
    "roster_fit",
    isSupportedRosterFit,
  );
  const urgency = getSupportedUrgencyComponent(topRecommendation);

  if (
    (rosterFit || urgency) &&
    hasStrongerBaseScore(recommendations, topRecommendation)
  ) {
    return {
      frame: "need_over_value",
      support: [rosterFit?.support ?? urgency?.support].filter(
        Boolean,
      ) as InsightSupport[],
    };
  }

  const topRosterFit = getComponent(topRecommendation, "roster_fit");

  if (
    hasHighestBaseScore(recommendations, topRecommendation) &&
    topRosterFit &&
    topRosterFit.direction !== "positive"
  ) {
    return {
      frame: "value_over_need",
      support: [createComponentSupport(topRecommendation, topRosterFit)],
    };
  }

  const baseValue = getSupportedComponent(
    topRecommendation,
    "base_value",
    isMaterialPositive,
  );

  if (baseValue && hasHighestBaseScore(recommendations, topRecommendation)) {
    return {
      frame: "clean_best_player",
      support: [baseValue.support],
    };
  }

  return { frame: "no_material_insight", support: [] };
}

function createPrimaryInsight(
  frame: InsightDecisionFrame,
  support: InsightSupport[],
): Insight | null {
  if (frame === "no_material_insight") {
    return null;
  }

  const titles: Record<Exclude<InsightDecisionFrame, "no_material_insight">, string> = {
    clean_best_player: "Best player-quality case",
    value_over_need: "Value over need",
    need_over_value: "Roster and timing over pure rank",
    pocket_pressure: "Current-pocket pressure",
    tier_boundary: "Tier boundary matters",
    run_pressure: "Run pressure is visible",
    caveated_top_pick: "Recommended with a caveat",
    close_call: "Close call at the top",
  };

  const bodies: Partial<
    Record<Exclude<InsightDecisionFrame, "no_material_insight">, string>
  > = {
    clean_best_player:
      "The leading recommendation is supported by the strongest player-quality case.",
    value_over_need:
      "The leading recommendation is more about player quality than roster need.",
    need_over_value:
      "The leading recommendation is supported by roster or timing context.",
    pocket_pressure:
      "Timing evidence supports acting on this profile now.",
    tier_boundary:
      "Tier evidence materially supports the leading recommendation.",
    run_pressure:
      "Recent draft-room movement supports the leading recommendation.",
    caveated_top_pick:
      "The leading recommendation still has a material drawback.",
    close_call:
      "The top recommendations are close enough that this should be treated as a lean, not certainty.",
  };

  return {
    id: `primary_decision:${frame}`,
    kind: "primary_decision",
    severity: frame === "caveated_top_pick" ? "warning" : "info",
    title: titles[frame],
    body: bodies[frame],
    supportedBy: support,
  };
}

function compareSupportedComponents(
  a: SupportedComponent,
  b: SupportedComponent,
) {
  const aPriority = a.component.priority ?? 0;
  const bPriority = b.component.priority ?? 0;

  if (bPriority !== aPriority) {
    return bPriority - aPriority;
  }

  if (b.component.delta !== a.component.delta) {
    return b.component.delta - a.component.delta;
  }

  return a.component.id.localeCompare(b.component.id);
}

function describePositiveComponent(component: RecommendationScoreComponent) {
  if (component.id === "base_value") {
    const overallRank = getNumberEvidence(component, "overallRank");

    return overallRank === null
      ? "Strong player-quality case."
      : `Ranked #${overallRank} overall.`;
  }

  if (component.id === "roster_fit") {
    const position = getStringEvidence(component, "position");
    const timing = getStringEvidence(component, "timing");

    if (position && timing === "direct_starter_need") {
      return `Fills an open ${position} starter slot.`;
    }

    if (position && timing === "flex_need") {
      return `${position} helps fill flex utility.`;
    }

    return "Roster fit supports the recommendation.";
  }

  if (component.id === "draft_pocket_timing") {
    const position =
      getStringEvidence(component, "profilePosition") ??
      getStringEvidence(component, "candidatePosition");

    return position
      ? `Comparable ${position} profiles are under timing pressure.`
      : "Draft-pocket timing supports the recommendation.";
  }

  if (component.id === "overall_tier") {
    return "This player is in the best available overall tier.";
  }

  if (component.id === "tier_cliff") {
    const position = getStringEvidence(component, "position");

    return position
      ? `${position} tier pressure supports the pick.`
      : "Tier pressure supports the pick.";
  }

  if (component.id === "positional_run") {
    const position = getStringEvidence(component, "position");

    return position
      ? `Recent ${position} draft movement supports the pick.`
      : "Recent draft-room movement supports the pick.";
  }

  if (component.id === "value_opportunity") {
    const currentPick = getNumberEvidence(component, "currentPickNumber");
    const overallRank = getNumberEvidence(component, "overallRank");

    return currentPick !== null && overallRank !== null
      ? `Value at pick ${currentPick}: ranked #${overallRank} overall.`
      : "Value relative to the current pick supports the recommendation.";
  }

  return "A material scoring component supports the recommendation.";
}

function describeCaveat(component: RecommendationScoreComponent) {
  if (component.id === "roster_fit") {
    const position = getStringEvidence(component, "position");
    const timing = getStringEvidence(component, "timing");

    if (position && timing === "early_def_k") {
      return `Caveat: early for ${position} relative to roster timing.`;
    }

    if (position && timing === "saturated") {
      return `Caveat: ${position} is already saturated.`;
    }

    if (position) {
      return `Caveat: limited roster need at ${position}.`;
    }
  }

  if (component.id === "value_opportunity") {
    return "Caveat: this is a reach relative to rank.";
  }

  return "Caveat: a material negative component applies.";
}

function createCandidateSummary(
  recommendation: PlayerRecommendation,
): Insight | null {
  const positiveComponents = recommendation.components
    .filter(isSupportedPositiveComponent)
    .map((component) => ({
      component,
      support: createComponentSupport(recommendation, component),
    }))
    .sort(compareSupportedComponents);
  const [positive] = positiveComponents;

  if (!positive) {
    return null;
  }

  const caveat = getMaterialCaveat(recommendation);

  return {
    id: `candidate_summary:${recommendation.playerId}`,
    kind: "candidate_summary",
    severity: caveat ? "warning" : "positive",
    title: describePositiveComponent(positive.component),
    body: caveat ? describeCaveat(caveat.component) : undefined,
    supportedBy: caveat
      ? [positive.support, caveat.support]
      : [positive.support],
  };
}

export function generateStrategicInsights(
  input: InsightInput,
): StrategicInsightBundle {
  const [topRecommendation] = input.recommendations;
  const scoreGapLabel = deriveScoreGapLabel(input.recommendations);
  const primaryFrame = getPrimaryFrame({
    recommendations: input.recommendations,
    scoreGapLabel,
  });
  const primaryInsight = createPrimaryInsight(
    primaryFrame.frame,
    primaryFrame.support,
  );
  const tradeoffInsight = selectTradeoffInsight({
    recommendations: input.recommendations,
    scoreGapLabel,
  });
  const rosterInsight = selectRosterInsight({
    input,
    scoreGapLabel,
  });
  const boardInsight = selectBoardInsight(input);
  const candidateSummary = topRecommendation
    ? createCandidateSummary(topRecommendation)
    : null;

  return {
    summary: {
      leadingPlayerId: topRecommendation?.playerId ?? null,
      decisionFrame: primaryFrame.frame,
      scoreGapLabel,
    },
    primaryInsight,
    candidateInsights: candidateSummary ? [candidateSummary] : [],
    tradeoffInsights: tradeoffInsight ? [tradeoffInsight] : [],
    rosterInsights: rosterInsight ? [rosterInsight] : [],
    boardInsights: boardInsight ? [boardInsight] : [],
    caveats: [],
    suppressedSignals: [],
  };
}
