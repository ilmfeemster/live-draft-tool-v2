"use client";

import { useMemo, useState } from "react";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import { DraftStatusPanel } from "@/components/DraftStatusPanel";
import type { Draft, RankingEntry } from "@/types/draft";

type DraftRoomProps = {
  draft: Draft;
  rankings: RankingEntry[];
};

export function DraftRoom({ draft, rankings }: DraftRoomProps) {
  const [activeDraft, setActiveDraft] = useState<Draft>(draft);

  const draftedPlayerIds = useMemo(() => {
    return new Set(
      activeDraft.picks
        .map((pick) => pick.playerId)
        .filter((playerId): playerId is string => Boolean(playerId)),
    );
  }, [activeDraft.picks]);

  const availableRankings = useMemo(() => {
    return rankings.filter((entry) => !draftedPlayerIds.has(entry.player.id));
  }, [draftedPlayerIds, rankings]);

  const canUndoLastPick = draftedPlayerIds.size > 0;

  function draftPlayer(playerId: string) {
    setActiveDraft((currentDraft) => {
      const totalPicks = currentDraft.teamCount * currentDraft.rounds;
      const currentPick = currentDraft.picks.find(
        (pick) => pick.pickNumber === currentDraft.currentPickNumber,
      );
      const isAlreadyDrafted = currentDraft.picks.some((pick) => pick.playerId === playerId);

      if (!currentPick || isAlreadyDrafted) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        currentPickNumber: Math.min(currentDraft.currentPickNumber + 1, totalPicks),
        picks: currentDraft.picks.map((pick) => {
          if (pick.pickNumber !== currentPick.pickNumber) {
            return pick;
          }

          return {
            ...pick,
            playerId,
          };
        }),
      };
    });
  }

  function undoLastPick() {
    setActiveDraft((currentDraft) => {
      const lastDraftedPick = currentDraft.picks.reduce(
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
        return currentDraft;
      }

      return {
        ...currentDraft,
        currentPickNumber: lastDraftedPick.pickNumber,
        picks: currentDraft.picks.map((pick) => {
          if (pick.pickNumber !== lastDraftedPick.pickNumber) {
            return pick;
          }

          return {
            ...pick,
            playerId: undefined,
          };
        }),
      };
    });
  }

  return (
    <div className="grid min-h-0 gap-6 xl:grid-cols-[1fr_320px]">
      <AvailablePlayersTable rankings={availableRankings} onDraftPlayer={draftPlayer} />
      <DraftStatusPanel
        draft={activeDraft}
        canUndoLastPick={canUndoLastPick}
        onUndoLastPick={undoLastPick}
      />
    </div>
  );
}
