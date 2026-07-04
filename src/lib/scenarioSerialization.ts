import { serializeLeagueSettingsSnapshot } from "@/lib/leagueSettingsSnapshot";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";
import type { Position } from "@/types/draft";
import type { RankingTierSemantics } from "@/types/rankings";
import type { ScenarioDocument, ScenarioV1, ScenarioV2 } from "@/types/scenario";

const scenarioPositions: readonly Position[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "DST",
  "K",
];

export function serializeScenarioV1(scenario: ScenarioV1): string {
  return serializeScenarioDocument(scenario, {
    rankings: serializeRankingSnapshot(scenario.rankingContext.rankings),
  });
}

export function serializeScenarioV2(scenario: ScenarioV2): string {
  return serializeScenarioDocument(scenario, {
    rankings: serializeRankingSnapshot(scenario.rankingContext.rankings),
    tierSemantics: serializeTierSemantics(
      scenario.rankingContext.tierSemantics,
    ),
  });
}

function serializeScenarioDocument(
  scenario: ScenarioDocument,
  rankingContext: Record<string, unknown>,
): string {
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
    rankingContext,
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

function serializeTierSemantics(
  tierSemantics: RankingTierSemantics,
): RankingTierSemantics {
  const recommendation: Partial<
    Record<Position, "neutral" | "recommendation-position">
  > = {};

  scenarioPositions.forEach((position) => {
    const semantics = tierSemantics.recommendation[position];

    if (semantics) {
      recommendation[position] = semantics;
    }
  });

  return {
    source: {
      kind: tierSemantics.source.kind,
      ...(tierSemantics.source.values === undefined
        ? {}
        : {
            values: tierSemantics.source.values.map((value) => ({
              playerId: value.playerId,
              overallRank: value.overallRank,
              tier: value.tier,
            })),
          }),
    },
    recommendation,
  };
}
