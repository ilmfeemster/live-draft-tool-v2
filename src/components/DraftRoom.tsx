"use client";

import { useMemo, useState } from "react";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import { DraftStatusPanel } from "@/components/DraftStatusPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { UserRosterPanel } from "@/components/UserRosterPanel";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import { generateTopRecommendations } from "@/lib/recommendations";
import type { Draft, RankingEntry, UserRosterPlayer } from "@/types/draft";

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

  const userRosterPlayers = useMemo<UserRosterPlayer[]>(() => {
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
    setActiveDraft((currentDraft) => draftPlayerInDraft(currentDraft, playerId));
  }

  function undoLastPick() {
    setActiveDraft((currentDraft) => undoLastDraftPick(currentDraft));
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
