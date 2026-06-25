import type { Draft, RankingEntry, UserRosterPlayer } from "@/types/draft";

export type DraftInvariantViolation =
  | "duplicate-drafted-player"
  | "drafted-player-available"
  | "available-player-on-roster"
  | "drafted-count-mismatch"
  | "drafted-player-missing-team"
  | "recommendation-player-unavailable";

export type DraftInvariantInput = {
  draft: Draft;
  availableRankings?: RankingEntry[];
  rosterPlayers?: UserRosterPlayer[];
  recommendationRankings?: RankingEntry[];
};

export function findDraftInvariantViolations({
  draft,
  availableRankings,
  rosterPlayers,
  recommendationRankings,
}: DraftInvariantInput): DraftInvariantViolation[] {
  const violations = new Set<DraftInvariantViolation>();
  const draftedPlayerIds = draft.picks
    .map((pick) => pick.playerId)
    .filter((playerId): playerId is string => Boolean(playerId));
  const draftedPlayerIdSet = new Set<string>();
  const totalPicks = draft.teamCount * draft.rounds;
  const isDraftComplete = draft.picks.every((pick) => Boolean(pick.playerId));
  const expectedDraftedCount = isDraftComplete
    ? totalPicks
    : Math.min(draft.currentPickNumber - 1, totalPicks);

  draftedPlayerIds.forEach((playerId) => {
    if (draftedPlayerIdSet.has(playerId)) {
      violations.add("duplicate-drafted-player");
    }

    draftedPlayerIdSet.add(playerId);
  });

  if (draftedPlayerIds.length !== expectedDraftedCount) {
    violations.add("drafted-count-mismatch");
  }

  if (draft.picks.some((pick) => pick.playerId && !pick.teamId)) {
    violations.add("drafted-player-missing-team");
  }

  if (availableRankings) {
    const availablePlayerIds = new Set(
      availableRankings.map((ranking) => ranking.player.id),
    );
    const availablePlayerNames = new Set(
      availableRankings.map((ranking) => ranking.player.name),
    );

    if (draftedPlayerIds.some((playerId) => availablePlayerIds.has(playerId))) {
      violations.add("drafted-player-available");
    }

    if (rosterPlayers?.some((player) => availablePlayerNames.has(player.name))) {
      violations.add("available-player-on-roster");
    }

    if (
      recommendationRankings?.some((ranking) => {
        return !availablePlayerIds.has(ranking.player.id);
      })
    ) {
      violations.add("recommendation-player-unavailable");
    }
  }

  return Array.from(violations);
}

export function isValidDraftState(input: DraftInvariantInput): boolean {
  return findDraftInvariantViolations(input).length === 0;
}
