import type { Draft, DraftPick, LeagueSettings } from "@/types/draft";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";

export type DraftPickHistoryEntry = {
  pickNumber: number;
  playerId: string;
};

export type HydrateDraftInput = {
  id: string;
  leagueSettings: LeagueSettings;
  userTeamId: string;
  pickHistory?: DraftPickHistoryEntry[];
};

export function hydrateDraftFromSettings(input: HydrateDraftInput): Draft {
  const { id, leagueSettings, userTeamId, pickHistory = [] } = input;
  const picks = overlayPickHistory(
    generateDraftOrder(leagueSettings),
    pickHistory,
  );
  const firstUndraftedPick = picks.find((pick) => !pick.playerId);
  const finalPick = picks[picks.length - 1];

  return {
    id,
    teamCount: leagueSettings.teamCount,
    rounds: leagueSettings.rounds,
    userTeamId,
    currentPickNumber: firstUndraftedPick?.pickNumber ?? finalPick?.pickNumber ?? 1,
    teams: createDraftTeams(leagueSettings.teamCount),
    picks,
  };
}

function generateDraftOrder(leagueSettings: LeagueSettings): DraftPick[] {
  switch (leagueSettings.draftType) {
    case "SNAKE":
      return generateSnakeDraftOrder(
        leagueSettings.teamCount,
        leagueSettings.rounds,
      );
    default:
      return assertUnsupportedDraftType(leagueSettings.draftType);
  }
}

function overlayPickHistory(
  generatedPicks: DraftPick[],
  pickHistory: DraftPickHistoryEntry[],
): DraftPick[] {
  const totalPicks = generatedPicks.length;
  const playerIds = new Set<string>();
  const playerIdsByPickNumber = new Map<number, string>();

  pickHistory.forEach(({ pickNumber, playerId }) => {
    if (pickNumber < 1 || pickNumber > totalPicks) {
      throw new Error(
        `Pick history entry ${pickNumber} is outside the generated draft order.`,
      );
    }

    if (playerIdsByPickNumber.has(pickNumber)) {
      throw new Error(`Pick history contains duplicate pick ${pickNumber}.`);
    }

    if (playerIds.has(playerId)) {
      throw new Error(`Pick history contains duplicate player ${playerId}.`);
    }

    playerIdsByPickNumber.set(pickNumber, playerId);
    playerIds.add(playerId);
  });

  return generatedPicks.map((pick) => {
    const playerId = playerIdsByPickNumber.get(pick.pickNumber);

    if (!playerId) {
      return pick;
    }

    return {
      ...pick,
      playerId,
    };
  });
}

function assertUnsupportedDraftType(draftType: never): never {
  throw new Error(`Unsupported draft type: ${String(draftType)}`);
}
