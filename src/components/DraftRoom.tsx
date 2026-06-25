"use client";

import { useMemo, useState } from "react";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import { DraftStatusPanel } from "@/components/DraftStatusPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { UserRosterPanel } from "@/components/UserRosterPanel";
import {
  draftPlayerAction,
  resetDraftAction,
  undoLastPickAction,
} from "@/app/actions/draftActions";
import { generateTopRecommendations } from "@/lib/recommendations";
import type { Draft, RankingEntry, UserRosterPlayer } from "@/types/draft";

type DraftRoomProps = {
  draft: Draft;
  rankings: RankingEntry[];
};

export function DraftRoom({ draft, rankings }: DraftRoomProps) {
  const [activeDraft, setActiveDraft] = useState<Draft>(draft);
  const [isMutationPending, setIsMutationPending] = useState(false);

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
  const canUndoLastPick = draftedPlayerIds.size > 0 && !isMutationPending;
  const isResetDisabled = isMutationPending;
  const areDraftActionsDisabled = isDraftComplete || isMutationPending;

  async function draftPlayer(playerId: string) {
    if (isMutationPending) {
      return;
    }

    setIsMutationPending(true);

    try {
      const workspace = await draftPlayerAction(activeDraft.id, playerId);

      if (workspace) {
        setActiveDraft(workspace.draft);
      }
    } catch (error) {
      console.error("Failed to draft player.", error);
    } finally {
      setIsMutationPending(false);
    }
  }

  async function undoLastPick() {
    if (isMutationPending) {
      return;
    }

    setIsMutationPending(true);

    try {
      const workspace = await undoLastPickAction(activeDraft.id);

      if (workspace) {
        setActiveDraft(workspace.draft);
      }
    } catch (error) {
      console.error("Failed to undo draft pick.", error);
    } finally {
      setIsMutationPending(false);
    }
  }

  async function resetDraft() {
    if (isMutationPending) {
      return;
    }

    const shouldReset = window.confirm(
      "Reset the current draft? This will clear all saved picks for this draft.",
    );

    if (!shouldReset) {
      return;
    }

    setIsMutationPending(true);

    try {
      const workspace = await resetDraftAction(activeDraft.id);

      if (workspace) {
        setActiveDraft(workspace.draft);
      }
    } catch (error) {
      console.error("Failed to reset draft.", error);
    } finally {
      setIsMutationPending(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-6">
        <RecommendationsPanel
          isDraftComplete={areDraftActionsDisabled}
          isUserPick={isUserPick}
          recommendations={recommendations}
          onDraftPlayer={draftPlayer}
        />
        <AvailablePlayersTable
          isDraftComplete={areDraftActionsDisabled}
          rankings={availableRankings}
          onDraftPlayer={draftPlayer}
        />
      </div>
      <div className="flex flex-col gap-6">
        <DraftStatusPanel
          draft={activeDraft}
          canUndoLastPick={canUndoLastPick}
          isResetDisabled={isResetDisabled}
          isDraftComplete={isDraftComplete}
          isUserPick={isUserPick}
          onResetDraft={resetDraft}
          onUndoLastPick={undoLastPick}
        />
        <UserRosterPanel players={userRosterPlayers} />
      </div>
    </div>
  );
}
