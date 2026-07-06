import type { RankingTierSemantics } from "@/types/rankings";

export type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";
export type DraftType = "SNAKE";
export type ScoringFormat = "PPR";

export type Player = {
  id: string;
  name: string;
  team: string;
  position: Position;
};

export type RankingEntry = {
  player: Player;
  overallRank: number;
  adpRank: number | null;
  positionRank: number;
  tier: number;
};

export type RecommendationOverallTierOrigin =
  | "source"
  | "defaulted-neutral";

export type RecommendationRankingFact = Readonly<
  Omit<RankingEntry, "player"> & {
    player: Readonly<Player>;
    overallTier: number;
    overallTierOrigin: RecommendationOverallTierOrigin;
  }
>;

export type RecommendationRankingContext = Readonly<{
  rankings: readonly RecommendationRankingFact[];
}>;

export type DraftPocketForecastStatus =
  | "active"
  | "no-adp"
  | "no-next-pick";

export type DraftPocketDiversityLabel =
  | "thin"
  | "WR-heavy"
  | "RB-heavy"
  | "onesie-heavy"
  | "balanced"
  | "mixed";

export type DraftPocketOverallTierCount = Readonly<{
  overallTier: number;
  overallTierOrigin: RecommendationOverallTierOrigin;
  count: number;
}>;

export type DraftPocket = Readonly<{
  playerIds: readonly string[];
  highestMeaningfulOverallTier: number | null;
  overallTierCounts: readonly DraftPocketOverallTierCount[];
  positionCounts: Readonly<Record<Position, number>>;
  diversityLabels: readonly DraftPocketDiversityLabel[];
}>;

export type DraftPocketSignalLevel = "high" | "medium" | "low" | "neutral";

export type DraftPocketProfile = Readonly<{
  position: Position;
  overallTierOrigin: RecommendationOverallTierOrigin;
  overallTier: number;
}>;

export type DraftPocketProfileTransition = Readonly<{
  profile: DraftPocketProfile;
  anchorPlayerId: string;
  anchorOverallRank: number;
  currentPlayerIds: readonly string[];
  currentProfileCount: number;
  forecastedComparablePlayerIds: readonly string[];
  forecastedNearPlayerIds: readonly string[];
  forecastedExactProfileCount: number;
  forecastedComparableCount: number;
  forecastedNearCount: number;
  replacementQuality: DraftPocketSignalLevel;
  skipSafety: DraftPocketSignalLevel;
  exactProfileDisappeared: boolean;
  highestMeaningfulTierDisappeared: boolean;
}>;

export type DraftPocketTimingAllocationRole = "full" | "reduced" | "neutral";

export type CandidatePocketSignal = Readonly<{
  candidatePlayerId: string;
  candidatePosition: Position;
  profile: DraftPocketProfile;
  profileAnchorPlayerId: string | null;
  profileOrdinal: number | null;
  allocationRole: DraftPocketTimingAllocationRole;
  candidateInCurrentPocket: boolean;
  candidateInForecastedPocket: boolean;
  comparableReplacementCount: number;
  nearReplacementCount: number;
  replacementQuality: DraftPocketSignalLevel;
  skipSafety: DraftPocketSignalLevel;
  currentProfileCount: number;
  forecastedProfileCount: number;
  profileDisappeared: boolean;
  highestMeaningfulTierDisappeared: boolean;
}>;

export type DraftPocketForecast = Readonly<{
  status: DraftPocketForecastStatus;
  targetPickNumber: number | null;
  picksToRemove: number | null;
  missingAdpFallback: number | null;
  currentBoardPlayerIds: readonly string[];
  removalWindowPlayerIds: readonly string[];
  forecastedBoardPlayerIds: readonly string[];
  currentPocket: DraftPocket;
  forecastedPocket: DraftPocket | null;
}>;

export type RecommendationRankingContextErrorCode =
  | "invalid-adp"
  | "partial-overall-tiers"
  | "invalid-overall-tiers"
  | "tier-entry-mismatch";

export type RecommendationRankingContextError = Readonly<{
  code: RecommendationRankingContextErrorCode;
  path: string;
  message: string;
}>;

export type RecommendationRankingContextResult =
  | Readonly<{
      ok: true;
      context: RecommendationRankingContext;
    }>
  | Readonly<{
      ok: false;
      errors: readonly RecommendationRankingContextError[];
    }>;

export type Recommendation = {
  ranking: RankingEntry;
  score: number;
  reasons: string[];
};

export type RecommendationInput = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  userTeamId: string;
  recommendationRankingContext?: RecommendationRankingContext;
};

export type RecommendationScoreComponentDirection = "positive" | "negative" | "neutral";

export type RecommendationEvidenceValue = string | number | boolean | null;

export type RecommendationScoreComponent = {
  id: string;
  delta: number;
  direction: RecommendationScoreComponentDirection;
  priority?: number;
  evidence?: Record<string, RecommendationEvidenceValue>;
};

export type RecommendationScoreAdjustmentId =
  | "urgency_cap"
  | "context_cap";

export type RecommendationScoreAdjustment = {
  id: RecommendationScoreAdjustmentId;
  delta: number;
  direction: RecommendationScoreComponentDirection;
  evidence: {
    rawScore: number;
    adjustedScore: number;
    minScore?: number;
    maxScore?: number;
  };
};

export type RecommendationReason = {
  id: string;
  text: string;
  sourceComponentId: string;
  priority: number;
};

export type PlayerRecommendation = {
  ranking: RankingEntry;
  playerId: string;
  totalScore: number;
  baseScore: number;
  contextScore: number;
  components: RecommendationScoreComponent[];
  scoreAdjustments: RecommendationScoreAdjustment[];
  reasons: RecommendationReason[];
};

export type InsightInput = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  userTeamId: string;
  recommendations: PlayerRecommendation[];
  forecast?: DraftPocketForecast;
};

export type InsightKind =
  | "primary_decision"
  | "candidate_summary"
  | "tradeoff"
  | "roster_context"
  | "board_context"
  | "next_pocket"
  | "caveat"
  | "capability_note";

export type InsightSeverity = "positive" | "info" | "warning" | "neutral";

export type InsightDecisionFrame =
  | "clean_best_player"
  | "value_over_need"
  | "need_over_value"
  | "pocket_pressure"
  | "tier_boundary"
  | "run_pressure"
  | "caveated_top_pick"
  | "close_call"
  | "no_material_insight";

export type InsightScoreGapLabel =
  | "clear_lean"
  | "slight_lean"
  | "close_call"
  | "unavailable";

export type InsightSuppressionReason =
  | "neutral"
  | "below_threshold"
  | "defaulted_neutral"
  | "unsupported_semantics"
  | "inactive_forecast"
  | "capped"
  | "not_roster_relevant";

export type InsightSupport = {
  playerId?: string;
  componentId?: string;
  evidenceKeys?: string[];
  reasonId?: string;
  scoreAdjustmentId?: RecommendationScoreAdjustmentId;
  forecastProfileId?: string;
};

export type Insight = {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  body?: string;
  supportedBy: InsightSupport[];
};

export type CurrentDecisionSummary = {
  leadingPlayerId: string | null;
  decisionFrame: InsightDecisionFrame;
  scoreGapLabel: InsightScoreGapLabel;
};

export type SuppressedSignal = {
  id: string;
  reason: InsightSuppressionReason;
  supportedBy: InsightSupport[];
};

export type StrategicInsightBundle = {
  summary: CurrentDecisionSummary;
  primaryInsight: Insight | null;
  candidateInsights: Insight[];
  tradeoffInsights: Insight[];
  rosterInsights: Insight[];
  boardInsights: Insight[];
  caveats: Insight[];
  suppressedSignals: SuppressedSignal[];
};

export type RecommendationTuningConfig = {
  baseScoreCurveCoefficient: number;
  maxPositiveContextScore: number;
  maxNegativeContextScore: number;
  maxUrgencyScore: number;
  recentPickRunWindow: number;
  tierThinnessThreshold: number;
  valueOpportunitySmallFallThreshold: number;
  valueOpportunityClearFallThreshold: number;
  valueOpportunityMajorFallThreshold: number;
  earlyDraftPickRatio: number;
  lateDraftPickRatio: number;
  positiveReasonThreshold: number;
  negativeReasonThreshold: number;
  maxReasons: number;
};

export type UserRosterPlayer = {
  pickNumber: number;
  name: string;
  team: string;
  position: Position;
};

export type UserRoster = {
  players: UserRosterPlayer[];
};

export type Team = {
  id: string;
  name: string;
  draftPosition: number;
};

export type DraftPick = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  teamId: string;
  playerId?: string;
};

export type Draft = {
  id: string;
  teamCount: number;
  rounds: number;
  userTeamId: string;
  currentPickNumber: number;
  teams: Team[];
  picks: DraftPick[];
};

export type RosterSlot = {
  id: string;
  label: string;
  eligiblePositions: Position[];
};

export type LeagueSettings = {
  teamCount: number;
  rounds: number;
  draftType: DraftType;
  scoringFormat: ScoringFormat;
  rosterSlots: RosterSlot[];
};

export type DraftWorkspace = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  rankingTierSemantics?: RankingTierSemantics;
  recommendationRankingContextResult?: RecommendationRankingContextResult;
};
