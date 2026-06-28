import { replayScenarioV1, type ScenarioReplayError } from "@/lib/scenarioReplay";
import {
  parseScenarioV1Json,
  type ScenarioValidationError,
} from "@/lib/scenarioValidation";
import type {
  Draft,
  DraftWorkspace,
  PlayerRecommendation,
} from "@/types/draft";
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioProvenance,
  type ScenarioV1,
} from "@/types/scenario";

export const DEFAULT_EXPORTED_SCENARIO_ID = "exported-scenario" as const;
export const DEFAULT_EXPORTED_SCENARIO_NAME =
  "Exported Draft Scenario" as const;

export type ExportWorkspaceScenarioOptions = {
  scenarioId?: string;
  name?: string;
  appliedPickCount?: number;
  provenance?: ScenarioProvenance;
};

export type ImportScenarioV1Result =
  | {
      ok: true;
      scenario: ScenarioV1;
      draft: Draft;
      recommendations: PlayerRecommendation[];
    }
  | {
      ok: false;
      stage: "validation";
      errors: ScenarioValidationError[];
    }
  | {
      ok: false;
      stage: "replay";
      error: ScenarioReplayError;
    };

export function exportWorkspaceToScenarioV1(
  workspace: DraftWorkspace,
  options: ExportWorkspaceScenarioOptions = {},
): ScenarioV1 {
  const pickHistory = [...workspace.draft.picks]
    .sort((left, right) => left.pickNumber - right.pickNumber)
    .flatMap((pick) => {
      if (!pick.playerId) {
        return [];
      }

      return [
        {
          playerId: pick.playerId,
          expectedPickNumber: pick.pickNumber,
          expectedTeamId: pick.teamId,
        },
      ];
    });
  const appliedPickCount =
    options.appliedPickCount === undefined
      ? pickHistory.length
      : options.appliedPickCount;

  if (
    !Number.isInteger(appliedPickCount) ||
    appliedPickCount < 0 ||
    appliedPickCount > pickHistory.length
  ) {
    throw new RangeError(
      "appliedPickCount must be an integer within the exported pick history.",
    );
  }

  const scenarioId =
    options.scenarioId && options.scenarioId.length > 0
      ? options.scenarioId
      : DEFAULT_EXPORTED_SCENARIO_ID;
  const name =
    options.name && options.name.length > 0
      ? options.name
      : DEFAULT_EXPORTED_SCENARIO_NAME;
  const provenance = options.provenance;

  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    metadata: {
      id: scenarioId,
      name,
      ...(provenance === undefined
        ? {}
        : {
            provenance: {
              sourceKind: provenance.sourceKind,
              ...(provenance.sourceId === undefined
                ? {}
                : { sourceId: provenance.sourceId }),
              exportedAt: provenance.exportedAt,
            },
          }),
    },
    leagueSettings: {
      teamCount: workspace.leagueSettings.teamCount,
      rounds: workspace.leagueSettings.rounds,
      draftType: workspace.leagueSettings.draftType,
      scoringFormat: workspace.leagueSettings.scoringFormat,
      rosterSlots: workspace.leagueSettings.rosterSlots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        eligiblePositions: [...slot.eligiblePositions],
      })),
    },
    draftConfiguration: {
      teams: workspace.draft.teams.map((team) => ({
        id: team.id,
        name: team.name,
        draftPosition: team.draftPosition,
      })),
    },
    rankingContext: {
      rankings: workspace.rankings.map((ranking) => ({
        player: {
          id: ranking.player.id,
          name: ranking.player.name,
          team: ranking.player.team,
          position: ranking.player.position,
        },
        overallRank: ranking.overallRank,
        adpRank: ranking.adpRank,
        positionRank: ranking.positionRank,
        tier: ranking.tier,
      })),
    },
    userTeamContext: {
      userTeamId: workspace.draft.userTeamId,
    },
    pickHistory,
    replayTarget: {
      appliedPickCount,
    },
  };
}

export function importScenarioV1Json(json: string): ImportScenarioV1Result {
  const parsed = parseScenarioV1Json(json);

  if (!parsed.ok) {
    return {
      ok: false,
      stage: "validation",
      errors: parsed.errors,
    };
  }

  const replayed = replayScenarioV1(parsed.scenario);

  if (!replayed.ok) {
    return {
      ok: false,
      stage: "replay",
      error: replayed.error,
    };
  }

  return {
    ok: true,
    scenario: parsed.scenario,
    draft: replayed.draft,
    recommendations: replayed.recommendations,
  };
}
