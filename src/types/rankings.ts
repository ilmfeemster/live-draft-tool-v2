import type { Position, RankingEntry } from "@/types/draft";

export const UNKNOWN_TEAM = "UNK" as const;
export const NEUTRAL_TIER = 1 as const;

export type RankingSetSourceKind =
  | "seed"
  | "external"
  | "canonical"
  | "manual";

export type RankingSetSource = Readonly<{
  kind: RankingSetSourceKind;
  formatId?: string;
  formatVersion?: number;
  label?: string;
  importedAt?: Date;
}>;

export type RankingDataAvailability = "complete" | "partial" | "none";
export type RankingPlayerIdentityCapability =
  | "provided"
  | "generated"
  | "mixed";
export type RankingOverallOrderCapability = "explicit" | "row-derived";
export type RankingPositionRankCapability = "derived";
export type RankingTierCapability = "source" | "defaulted-neutral";
export type RankingSourceTierSemantics =
  | "none"
  | "source-overall"
  | "legacy-ambiguous";
export type RankingRecommendationTierSemantics =
  | "neutral"
  | "recommendation-position";

export type RankingSourceTierValue = Readonly<{
  playerId: string;
  overallRank: number;
  tier: number;
}>;

export type RankingTierSemantics = Readonly<{
  source: Readonly<{
    kind: RankingSourceTierSemantics;
    values?: readonly RankingSourceTierValue[];
  }>;
  recommendation: Readonly<
    Partial<Record<Position, RankingRecommendationTierSemantics>>
  >;
}>;

export type RankingSetCapabilities = Readonly<{
  team: RankingDataAvailability;
  playerIdentity: RankingPlayerIdentityCapability;
  overallOrder: RankingOverallOrderCapability;
  positionRank: RankingPositionRankCapability;
  adp: RankingDataAvailability;
  tiers: Readonly<Partial<Record<Position, RankingTierCapability>>>;
}>;

export type RankingSet = Readonly<{
  id: string;
  name: string;
  source: RankingSetSource;
  capabilities: RankingSetCapabilities;
  tierSemantics?: RankingTierSemantics;
  entries: readonly RankingEntry[];
  createdAt: Date;
  updatedAt: Date;
}>;

export type RankingSetSummary = Readonly<{
  id: string;
  name: string;
  sourceKind: RankingSetSourceKind;
  entryCount: number;
  capabilities: RankingSetCapabilities;
  createdAt: Date;
  updatedAt: Date;
}>;

export type RankingSnapshot = Readonly<{
  rankings: readonly RankingEntry[];
  capabilities?: RankingSetCapabilities;
  tierSemantics?: RankingTierSemantics;
  sourceRankingSetId?: string;
  sourceRankingSetName?: string;
  capturedAt?: Date;
}>;
