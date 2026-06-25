import type { Draft } from "@/types/draft";

export function draftPlayerInDraft(draft: Draft, playerId: string): Draft {
  const totalPicks = draft.teamCount * draft.rounds;
  const currentPick = draft.picks.find((pick) => {
    return pick.pickNumber === draft.currentPickNumber;
  });
  const isAlreadyDrafted = draft.picks.some((pick) => pick.playerId === playerId);
  const isDraftComplete = draft.picks.every((pick) => Boolean(pick.playerId));

  if (!currentPick || currentPick.playerId || isAlreadyDrafted || isDraftComplete) {
    return draft;
  }

  return {
    ...draft,
    currentPickNumber: Math.min(draft.currentPickNumber + 1, totalPicks),
    picks: draft.picks.map((pick) => {
      if (pick.pickNumber !== currentPick.pickNumber) {
        return pick;
      }

      return {
        ...pick,
        playerId,
      };
    }),
  };
}

export function undoLastDraftPick(draft: Draft): Draft {
  const lastDraftedPick = draft.picks.reduce(
    (latestPick, pick) => {
      if (!pick.playerId) {
        return latestPick;
      }

      if (!latestPick || pick.pickNumber > latestPick.pickNumber) {
        return pick;
      }

      return latestPick;
    },
    undefined as Draft["picks"][number] | undefined,
  );

  if (!lastDraftedPick) {
    return draft;
  }

  return {
    ...draft,
    currentPickNumber: lastDraftedPick.pickNumber,
    picks: draft.picks.map((pick) => {
      if (pick.pickNumber !== lastDraftedPick.pickNumber) {
        return pick;
      }

      return {
        ...pick,
        playerId: undefined,
      };
    }),
  };
}
