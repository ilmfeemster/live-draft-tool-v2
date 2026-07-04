import type { LeagueSettings, RankingEntry, Team } from "@/types/draft";
import type { RankingTierSemantics } from "@/types/rankings";

export const SCENARIO_SCHEMA_VERSION = 1 as const;
export const SCENARIO_V1_SCHEMA_VERSION = SCENARIO_SCHEMA_VERSION;
export const SCENARIO_V2_SCHEMA_VERSION = 2 as const;

export type ScenarioSchemaVersion =
  | typeof SCENARIO_V1_SCHEMA_VERSION
  | typeof SCENARIO_V2_SCHEMA_VERSION;

export type ScenarioSourceKind = "manual" | "persisted" | "scenario";

export type ScenarioProvenance = {
  sourceKind: ScenarioSourceKind;
  sourceId?: string;
  exportedAt: string;
};

export type ScenarioMetadata = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  provenance?: ScenarioProvenance;
};

export type ScenarioDraftConfiguration = {
  teams: Team[];
};

export type ScenarioRankingContext = {
  rankings: RankingEntry[];
};

export type ScenarioRankingContextV2 = ScenarioRankingContext & {
  tierSemantics: RankingTierSemantics;
};

export type ScenarioUserTeamContext = {
  userTeamId: string;
};

export type ScenarioPick = {
  playerId: string;
  expectedPickNumber?: number;
  expectedTeamId?: string;
};

export type ScenarioReplayTarget = {
  appliedPickCount: number;
};

export type ScenarioV1 = {
  schemaVersion: typeof SCENARIO_V1_SCHEMA_VERSION;
  metadata: ScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: ScenarioDraftConfiguration;
  rankingContext: ScenarioRankingContext;
  userTeamContext: ScenarioUserTeamContext;
  pickHistory: ScenarioPick[];
  replayTarget: ScenarioReplayTarget;
};

export type ScenarioV2 = {
  schemaVersion: typeof SCENARIO_V2_SCHEMA_VERSION;
  metadata: ScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: ScenarioDraftConfiguration;
  rankingContext: ScenarioRankingContextV2;
  userTeamContext: ScenarioUserTeamContext;
  pickHistory: ScenarioPick[];
  replayTarget: ScenarioReplayTarget;
};

export type ScenarioDocument = ScenarioV1 | ScenarioV2;
