"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import { DraftSetupForm } from "@/components/DraftSetupForm";
import { DraftStatusPanel } from "@/components/DraftStatusPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { UserRosterPanel } from "@/components/UserRosterPanel";
import {
  createConfiguredDraftAction,
  draftPlayerAction,
  resetDraftAction,
  undoLastPickAction,
} from "@/app/actions/draftActions";
import type {
  LeagueSetupInput,
  LeagueSetupValidationError,
} from "@/lib/leagueSetup";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import type {
  Draft,
  LeagueSettings,
  RankingEntry,
  UserRosterPlayer,
} from "@/types/draft";

type DraftRoomProps = {
  draft: Draft;
  leagueSettings: LeagueSettings;
  rankings: RankingEntry[];
};

export function DraftRoom({ draft, leagueSettings, rankings }: DraftRoomProps) {
  const router = useRouter();
  const [activeDraft, setActiveDraft] = useState<Draft>(draft);
  const [isMutationPending, setIsMutationPending] = useState(false);
  const [isDraftSetupOpen, setIsDraftSetupOpen] = useState(false);
  const [draftSetupErrors, setDraftSetupErrors] = useState<
    LeagueSetupValidationError[]
  >([]);
  const [draftSetupFormError, setDraftSetupFormError] = useState<string | null>(null);

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
    return generatePlayerRecommendations({
      draft: activeDraft,
      rankings,
      leagueSettings,
      userTeamId: activeDraft.userTeamId,
    });
  }, [activeDraft, leagueSettings, rankings]);

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
  const isNewDraftDisabled = isMutationPending;
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

  function openDraftSetup() {
    if (isMutationPending) {
      return;
    }

    const isInProgressDraft = draftedPlayerIds.size > 0 && !isDraftComplete;

    if (isInProgressDraft) {
      const shouldCreateDraft = window.confirm(
        "Start a new draft? Your current draft and saved picks will remain available in draft history.",
      );

      if (!shouldCreateDraft) {
        return;
      }
    }

    clearDraftSetupErrors();
    setIsDraftSetupOpen(true);
  }

  function closeDraftSetup() {
    if (isMutationPending) {
      return;
    }

    clearDraftSetupErrors();
    setIsDraftSetupOpen(false);
  }

  function clearDraftSetupErrors() {
    setDraftSetupErrors([]);
    setDraftSetupFormError(null);
  }

  async function createConfiguredDraft(input: LeagueSetupInput) {
    if (isMutationPending) {
      return;
    }

    setIsMutationPending(true);
    clearDraftSetupErrors();

    try {
      const result = await createConfiguredDraftAction(input);

      if (!result.ok) {
        setDraftSetupErrors(result.errors);
        return;
      }

      router.push(`/?draftId=${encodeURIComponent(result.workspace.draft.id)}`);
    } catch (error) {
      console.error("Failed to create a configured draft.", error);
      setDraftSetupFormError("Unable to create the configured draft.");
    } finally {
      setIsMutationPending(false);
    }
  }

  if (isDraftSetupOpen) {
    return (
      <DraftSetupForm
        rankingPlayerCount={rankings.length}
        isPending={isMutationPending}
        serverErrors={draftSetupErrors}
        formError={draftSetupFormError}
        onCancel={closeDraftSetup}
        onClearServerErrors={clearDraftSetupErrors}
        onSubmit={createConfiguredDraft}
      />
    );
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
          isNewDraftDisabled={isNewDraftDisabled}
          isResetDisabled={isResetDisabled}
          isDraftComplete={isDraftComplete}
          isUserPick={isUserPick}
          onCreateNewDraft={openDraftSetup}
          onResetDraft={resetDraft}
          onUndoLastPick={undoLastPick}
        />
        <UserRosterPanel players={userRosterPlayers} />
      </div>
    </div>
  );
}
