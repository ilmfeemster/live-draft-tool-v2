import type { LeagueSettings, RankingEntry, Team } from "@/types/draft";

export const SCENARIO_SCHEMA_VERSION = 1 as const;

export type ScenarioSchemaVersion = typeof SCENARIO_SCHEMA_VERSION;

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
  schemaVersion: ScenarioSchemaVersion;
  metadata: ScenarioMetadata;
  leagueSettings: LeagueSettings;
  draftConfiguration: ScenarioDraftConfiguration;
  rankingContext: ScenarioRankingContext;
  userTeamContext: ScenarioUserTeamContext;
  pickHistory: ScenarioPick[];
  replayTarget: ScenarioReplayTarget;
};
