import {
  replayScenario,
  replayScenarioV1,
  replayScenarioV2,
  type ScenarioReplayError,
  type ScenarioReplayResult,
} from "@/lib/scenarioReplay";
import {
  parseScenarioJson,
  parseScenarioV1Json,
  parseScenarioV2Json,
  type ParseScenarioResult,
  type ParseScenarioV1Result,
  type ParseScenarioV2Result,
  type ScenarioValidationError,
} from "@/lib/scenarioValidation";
import type {
  Draft,
  DraftWorkspace,
  PlayerRecommendation,
} from "@/types/draft";
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioDocument,
  type ScenarioProvenance,
  type ScenarioV1,
  type ScenarioV2,
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

type ImportScenarioFailure =
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

type ImportScenarioResultFor<TScenario extends ScenarioDocument> =
  | {
      ok: true;
      scenario: TScenario;
      draft: Draft;
      recommendations: PlayerRecommendation[];
    }
  | ImportScenarioFailure;

export type ImportScenarioV1Result = ImportScenarioResultFor<ScenarioV1>;
export type ImportScenarioV2Result = ImportScenarioResultFor<ScenarioV2>;
export type ImportScenarioResult = ImportScenarioResultFor<ScenarioDocument>;

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
  return importParsedScenario(parseScenarioV1Json(json), replayScenarioV1);
}

export function importScenarioV2Json(json: string): ImportScenarioV2Result {
  return importParsedScenario(parseScenarioV2Json(json), replayScenarioV2);
}

export function importScenarioJson(json: string): ImportScenarioResult {
  return importParsedScenario(parseScenarioJson(json), replayScenario);
}

function importParsedScenario<TScenario extends ScenarioDocument>(
  parsed:
    | ParseScenarioV1Result
    | ParseScenarioV2Result
    | ParseScenarioResult,
  replay: (scenario: TScenario) => ScenarioReplayResult,
): ImportScenarioResultFor<TScenario> {
  if (!parsed.ok) {
    return {
      ok: false,
      stage: "validation",
      errors: parsed.errors,
    };
  }

  const scenario = parsed.scenario as TScenario;
  const replayed = replay(scenario);

  if (!replayed.ok) {
    return {
      ok: false,
      stage: "replay",
      error: replayed.error,
    };
  }

  return {
    ok: true,
    scenario,
    draft: replayed.draft,
    recommendations: replayed.recommendations,
  };
}
