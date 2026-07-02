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
  recommendationRankingContextResult?: RecommendationRankingContextResult;
};
