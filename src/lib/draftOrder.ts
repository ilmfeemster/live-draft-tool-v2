import type { DraftPick, Team } from "@/types/draft";

export function createDraftTeams(teamCount: number): Team[] {
  return Array.from({ length: teamCount }, (_, index) => {
    const draftPosition = index + 1;

    return {
      id: `team-${draftPosition}`,
      name: `Team ${draftPosition}`,
      draftPosition,
    };
  });
}

export function getRoundForPick(pickNumber: number, teamCount: number): number {
  return Math.ceil(pickNumber / teamCount);
}

export function getPickInRound(pickNumber: number, teamCount: number): number {
  return ((pickNumber - 1) % teamCount) + 1;
}

export function getDraftPositionForPick(pickNumber: number, teamCount: number): number {
  const round = getRoundForPick(pickNumber, teamCount);
  const pickInRound = getPickInRound(pickNumber, teamCount);

  if (round % 2 === 1) {
    return pickInRound;
  }

  return teamCount - pickInRound + 1;
}

export function generateSnakeDraftOrder(teamCount: number, rounds: number): DraftPick[] {
  return Array.from({ length: teamCount * rounds }, (_, index) => {
    const pickNumber = index + 1;
    const round = getRoundForPick(pickNumber, teamCount);
    const pickInRound = getPickInRound(pickNumber, teamCount);
    const draftPosition = getDraftPositionForPick(pickNumber, teamCount);

    return {
      pickNumber,
      round,
      pickInRound,
      teamId: `team-${draftPosition}`,
    };
  });
}
