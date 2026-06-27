import { serializeLeagueSettingsSnapshot } from "@/lib/leagueSettingsSnapshot";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";
import type { ScenarioV1 } from "@/types/scenario";

export function serializeScenarioV1(scenario: ScenarioV1): string {
  const document = {
    schemaVersion: scenario.schemaVersion,
    metadata: {
      id: scenario.metadata.id,
      name: scenario.metadata.name,
      ...(scenario.metadata.description === undefined
        ? {}
        : { description: scenario.metadata.description }),
      ...(scenario.metadata.tags === undefined
        ? {}
        : { tags: [...scenario.metadata.tags] }),
      ...(scenario.metadata.provenance === undefined
        ? {}
        : {
            provenance: {
              sourceKind: scenario.metadata.provenance.sourceKind,
              ...(scenario.metadata.provenance.sourceId === undefined
                ? {}
                : { sourceId: scenario.metadata.provenance.sourceId }),
              exportedAt: scenario.metadata.provenance.exportedAt,
            },
          }),
    },
    leagueSettings: serializeLeagueSettingsSnapshot(scenario.leagueSettings),
    draftConfiguration: {
      teams: scenario.draftConfiguration.teams.map((team) => ({
        id: team.id,
        name: team.name,
        draftPosition: team.draftPosition,
      })),
    },
    rankingContext: {
      rankings: serializeRankingSnapshot(scenario.rankingContext.rankings),
    },
    userTeamContext: {
      userTeamId: scenario.userTeamContext.userTeamId,
    },
    pickHistory: scenario.pickHistory.map((pick) => ({
      playerId: pick.playerId,
      ...(pick.expectedPickNumber === undefined
        ? {}
        : { expectedPickNumber: pick.expectedPickNumber }),
      ...(pick.expectedTeamId === undefined
        ? {}
        : { expectedTeamId: pick.expectedTeamId }),
    })),
    replayTarget: {
      appliedPickCount: scenario.replayTarget.appliedPickCount,
    },
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}
