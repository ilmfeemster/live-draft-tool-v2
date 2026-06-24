"use client";

import { useMemo, useState } from "react";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import { DraftStatusPanel } from "@/components/DraftStatusPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { UserRosterPanel } from "@/components/UserRosterPanel";
import { generateTopRecommendations } from "@/lib/recommendations";
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

  const userRosterPlayers = useMemo(() => {
    return activeDraft.picks
      .filter((pick) => pick.teamId === activeDraft.userTeamId && pick.playerId)
      .map((pick) => {
        const ranking = rankings.find((entry) => entry.player.id === pick.playerId);

        if (!ranking) {
          return undefined;
        }

        return {
          pickNumber: pick.pickNumber,
          name: ranking.player.name,
          team: ranking.player.team,
          position: ranking.player.position,
        };
      })
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
      .sort((a, b) => a.pickNumber - b.pickNumber);
  }, [activeDraft.picks, activeDraft.userTeamId, rankings]);

  const recommendations = useMemo(() => {
    return generateTopRecommendations(availableRankings, {
      rosterPlayers: userRosterPlayers,
    });
  }, [availableRankings, userRosterPlayers]);

  const currentPick = activeDraft.picks.find(
    (pick) => pick.pickNumber === activeDraft.currentPickNumber,
  );
  const isUserPick = currentPick?.teamId === activeDraft.userTeamId;
  const totalPicks = activeDraft.teamCount * activeDraft.rounds;
  const isDraftComplete =
    activeDraft.picks.length === totalPicks &&
    activeDraft.picks.every((pick) => Boolean(pick.playerId));
  const canUndoLastPick = draftedPlayerIds.size > 0;

  function draftPlayer(playerId: string) {
    setActiveDraft((currentDraft) => {
      const totalPicks = currentDraft.teamCount * currentDraft.rounds;
      const currentPick = currentDraft.picks.find(
        (pick) => pick.pickNumber === currentDraft.currentPickNumber,
      );
      const isAlreadyDrafted = currentDraft.picks.some((pick) => pick.playerId === playerId);
      const isDraftComplete = currentDraft.picks.every((pick) => Boolean(pick.playerId));

      if (!currentPick || currentPick.playerId || isAlreadyDrafted || isDraftComplete) {
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
      <div className="flex min-h-0 flex-col gap-6">
        <RecommendationsPanel
          isDraftComplete={isDraftComplete}
          isUserPick={isUserPick}
          recommendations={recommendations}
          onDraftPlayer={draftPlayer}
        />
        <AvailablePlayersTable
          isDraftComplete={isDraftComplete}
          rankings={availableRankings}
          onDraftPlayer={draftPlayer}
        />
      </div>
      <div className="flex flex-col gap-6">
        <DraftStatusPanel
          draft={activeDraft}
          canUndoLastPick={canUndoLastPick}
          isDraftComplete={isDraftComplete}
          isUserPick={isUserPick}
          onUndoLastPick={undoLastPick}
        />
        <UserRosterPanel players={userRosterPlayers} />
      </div>
    </div>
  );
}
