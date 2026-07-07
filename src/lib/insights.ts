import type {
  Insight,
  InsightDecisionFrame,
  InsightInput,
  InsightScoreGapLabel,
  InsightSupport,
  PlayerRecommendation,
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
    rosterInsights: [],
    boardInsights: [],
    caveats: [],
    suppressedSignals: [],
  };
}
