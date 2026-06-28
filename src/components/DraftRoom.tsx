"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import {
  DeveloperWorkbenchPanel,
  type WorkbenchStatus,
} from "@/components/DeveloperWorkbenchPanel";
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
import { exportWorkspaceToScenarioV1 } from "@/lib/scenarioPortability";
import {
  createTransientScenarioSession,
  draftPlayerInTransientSession,
  requiresTransientSessionConfirmation,
  resetTransientScenarioSession,
  restartTransientSession,
  type TransientDraftSession,
  type TransientSessionLoadResult,
  undoLastPickInTransientSession,
} from "@/lib/scenarioSession";
import { serializeScenarioV1 } from "@/lib/scenarioSerialization";
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

type TransientSource =
  | { kind: "imported"; fileName: string }
  | { kind: "restart" };

export function DraftRoom({ draft, leagueSettings, rankings }: DraftRoomProps) {
  const router = useRouter();
  const pendingDraftScrollPositionRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const [activeDraft, setActiveDraft] = useState<Draft>(draft);
  const [isMutationPending, setIsMutationPending] = useState(false);
  const [isDraftSetupOpen, setIsDraftSetupOpen] = useState(false);
  const [draftSetupErrors, setDraftSetupErrors] = useState<
    LeagueSetupValidationError[]
  >([]);
  const [draftSetupFormError, setDraftSetupFormError] = useState<string | null>(null);
  const [transientSession, setTransientSession] =
    useState<TransientDraftSession | null>(null);
  const [transientSource, setTransientSource] =
    useState<TransientSource | null>(null);
  const [workbenchErrors, setWorkbenchErrors] = useState<string[]>([]);
  const [isWorkbenchPending, setIsWorkbenchPending] = useState(false);
  const [replayTargetInput, setReplayTargetInput] = useState("");

  const displayedDraft = transientSession?.draft ?? activeDraft;
  const activeRankings = transientSession?.rankings ?? rankings;
  const activeLeagueSettings = transientSession?.leagueSettings ?? leagueSettings;
  const isAnyPending = isMutationPending || isWorkbenchPending;

  useLayoutEffect(() => {
    const pendingScrollPosition = pendingDraftScrollPositionRef.current;

    if (!pendingScrollPosition) {
      return;
    }

    pendingDraftScrollPositionRef.current = null;
    window.scrollTo({
      left: pendingScrollPosition.x,
      top: pendingScrollPosition.y,
      behavior: "auto",
    });
  }, [displayedDraft]);

  const draftedPlayerIds = useMemo(() => {
    return new Set(
      displayedDraft.picks
        .map((pick) => pick.playerId)
        .filter((playerId): playerId is string => Boolean(playerId)),
    );
  }, [displayedDraft.picks]);

  const availableRankings = useMemo(() => {
    return activeRankings.filter((entry) => !draftedPlayerIds.has(entry.player.id));
  }, [activeRankings, draftedPlayerIds]);

  const userRosterPlayers = useMemo<UserRosterPlayer[]>(() => {
    return displayedDraft.picks
      .filter((pick) => pick.teamId === displayedDraft.userTeamId && pick.playerId)
      .map((pick) => {
        const ranking = activeRankings.find((entry) => entry.player.id === pick.playerId);

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
  }, [activeRankings, displayedDraft.picks, displayedDraft.userTeamId]);

  const persistedRecommendations = useMemo(() => {
    return generatePlayerRecommendations({
      draft: activeDraft,
      rankings,
      leagueSettings,
      userTeamId: activeDraft.userTeamId,
    });
  }, [activeDraft, leagueSettings, rankings]);
  const recommendations =
    transientSession?.recommendations ?? persistedRecommendations;

  const currentPick = displayedDraft.picks.find(
    (pick) => pick.pickNumber === displayedDraft.currentPickNumber,
  );
  const isUserPick = currentPick?.teamId === displayedDraft.userTeamId;
  const totalPicks = displayedDraft.teamCount * displayedDraft.rounds;
  const isDraftComplete =
    displayedDraft.picks.length === totalPicks &&
    displayedDraft.picks.every((pick) => Boolean(pick.playerId));
  const canUndoLastPick = draftedPlayerIds.size > 0 && !isAnyPending;
  const isResetDisabled = isAnyPending;
  const isNewDraftDisabled = isAnyPending;
  const areDraftActionsDisabled = isDraftComplete || isAnyPending;

  async function draftPlayer(playerId: string) {
    if (isAnyPending) {
      return;
    }

    pendingDraftScrollPositionRef.current = {
      x: window.scrollX,
      y: window.scrollY,
    };

    if (transientSession) {
      const nextSession = draftPlayerInTransientSession(
        transientSession,
        playerId,
      );

      if (nextSession.draft === transientSession.draft) {
        pendingDraftScrollPositionRef.current = null;
        return;
      }

      setTransientSession(nextSession);
      return;
    }

    setIsMutationPending(true);

    try {
      const workspace = await draftPlayerAction(activeDraft.id, playerId);

      if (workspace) {
        setActiveDraft(workspace.draft);
      } else {
        pendingDraftScrollPositionRef.current = null;
      }
    } catch (error) {
      pendingDraftScrollPositionRef.current = null;
      console.error("Failed to draft player.", error);
    } finally {
      setIsMutationPending(false);
    }
  }

  async function undoLastPick() {
    if (isAnyPending) {
      return;
    }

    if (transientSession) {
      setTransientSession(undoLastPickInTransientSession(transientSession));
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
    if (isAnyPending) {
      return;
    }

    if (transientSession?.kind === "scenario") {
      resetScenario();
      return;
    }

    if (transientSession?.kind === "manual") {
      restartConfiguration();
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
    if (isAnyPending) {
      return;
    }

    if (
      transientSession &&
      requiresTransientSessionConfirmation(transientSession, "replace") &&
      !window.confirm(
        "Start a new draft? Unexported transient changes will be lost after creation.",
      )
    ) {
      return;
    }

    const isInProgressDraft =
      !transientSession && draftedPlayerIds.size > 0 && !isDraftComplete;

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
    if (isAnyPending) {
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
    if (isAnyPending) {
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

  function shouldReplaceTransientSession() {
    if (
      transientSession &&
      requiresTransientSessionConfirmation(transientSession, "replace")
    ) {
      return window.confirm(
        "Replace this transient session? Unexported local changes will be lost.",
      );
    }

    return true;
  }

  function installScenarioSession(
    sourceJson: string,
    source: Exclude<TransientSource, { kind: "restart" }>,
  ) {
    const result = createTransientScenarioSession(sourceJson);

    if (!result.ok) {
      setWorkbenchErrors(formatSessionFailure(result));
      return false;
    }

    setTransientSession(result.session);
    setTransientSource(source);
    setReplayTargetInput(
      String(result.session.scenario.replayTarget.appliedPickCount),
    );
    setWorkbenchErrors([]);
    return true;
  }

  async function importScenarioFile(file: File) {
    if (isAnyPending || !shouldReplaceTransientSession()) {
      return;
    }

    setIsWorkbenchPending(true);
    setWorkbenchErrors([]);

    try {
      const sourceJson = await file.text();
      installScenarioSession(sourceJson, {
        kind: "imported",
        fileName: file.name,
      });
    } catch (error) {
      console.error("Failed to read a scenario file.", error);
      setWorkbenchErrors(["Unable to read the selected scenario file."]);
    } finally {
      setIsWorkbenchPending(false);
    }
  }

  function exportScenario() {
    if (isAnyPending) {
      return;
    }

    setWorkbenchErrors([]);

    try {
      const activeScenario =
        transientSession?.kind === "scenario" ? transientSession.scenario : null;
      const scenario = exportWorkspaceToScenarioV1(
        {
          draft: displayedDraft,
          rankings: activeRankings,
          leagueSettings: activeLeagueSettings,
        },
        {
          name: activeScenario?.metadata.name,
          provenance: {
            sourceKind:
              transientSession?.kind === "scenario"
                ? "scenario"
                : transientSession?.kind === "manual"
                  ? "manual"
                  : "persisted",
            sourceId: activeScenario?.metadata.id ??
              (transientSession ? undefined : activeDraft.id),
            exportedAt: new Date().toISOString(),
          },
        },
      );
      const json = serializeScenarioV1(scenario);
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);

      try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${sanitizeFileName(scenario.metadata.name)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      console.error("Failed to export the active draft.", error);
      setWorkbenchErrors(["Unable to export the active draft."]);
    }
  }

  function resetScenario() {
    if (isAnyPending || transientSession?.kind !== "scenario") {
      return;
    }

    if (
      requiresTransientSessionConfirmation(transientSession, "reset") &&
      !window.confirm(
        "Reset this scenario? Unexported local changes will be lost.",
      )
    ) {
      return;
    }

    setWorkbenchErrors([]);
    const result = resetTransientScenarioSession(transientSession);

    if (!result.ok) {
      setWorkbenchErrors(formatSessionFailure(result));
      return;
    }

    setTransientSession(result.session);
    setReplayTargetInput(
      String(result.session.scenario.replayTarget.appliedPickCount),
    );
  }

  function applyReplayTarget() {
    if (isAnyPending || transientSession?.kind !== "scenario") {
      return;
    }

    const max = transientSession.scenario.pickHistory.length;
    const target = Number(replayTargetInput);

    if (
      replayTargetInput.trim() === "" ||
      !Number.isInteger(target) ||
      target < 0 ||
      target > max
    ) {
      setWorkbenchErrors([
        `Replay target must be an integer from 0 through ${max}.`,
      ]);
      return;
    }

    if (
      requiresTransientSessionConfirmation(transientSession, "replace") &&
      !window.confirm(
        "Apply a new replay target? Unexported local changes will be lost.",
      )
    ) {
      return;
    }

    const sourceJson = serializeScenarioV1({
      ...transientSession.scenario,
      replayTarget: { appliedPickCount: target },
    });
    const result = createTransientScenarioSession(sourceJson);

    if (!result.ok) {
      setWorkbenchErrors(formatSessionFailure(result));
      return;
    }

    setTransientSession(result.session);
    setReplayTargetInput(String(target));
    setWorkbenchErrors([]);
  }

  function restartConfiguration() {
    if (isAnyPending || !transientSession) {
      return;
    }

    if (
      requiresTransientSessionConfirmation(transientSession, "restart") &&
      !window.confirm(
        "Restart this configuration? Unexported local changes will be lost.",
      )
    ) {
      return;
    }

    setTransientSession(restartTransientSession(transientSession));
    setTransientSource({ kind: "restart" });
    setReplayTargetInput("");
    setWorkbenchErrors([]);
  }
  const workbenchStatus: WorkbenchStatus = transientSession
    ? {
        mode:
          transientSession.kind === "scenario"
            ? "scenario"
            : "transient-manual",
        name:
          transientSession.kind === "scenario"
            ? transientSession.scenario.metadata.name
            : "Restarted Configuration",
        source: formatTransientSource(transientSource),
        replayTarget:
          transientSession.kind === "scenario"
            ? transientSession.scenario.replayTarget.appliedPickCount
            : null,
        appliedPickCount: draftedPlayerIds.size,
        isDirty: transientSession.isDirty,
      }
    : {
        mode: "persisted",
        name: activeDraft.id,
        source: "Persisted workspace",
        replayTarget: null,
        appliedPickCount: draftedPlayerIds.size,
        isDirty: false,
      };

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
    <div className="grid gap-6">
      <DeveloperWorkbenchPanel
        status={workbenchStatus}
        errors={workbenchErrors}
        isPending={isAnyPending}
        canResetScenario={transientSession?.kind === "scenario"}
        canRestartTransient={Boolean(transientSession)}
        replayTargetInput={replayTargetInput}
        replayTargetMax={
          transientSession?.kind === "scenario"
            ? transientSession.scenario.pickHistory.length
            : null
        }
        canApplyReplayTarget={
          transientSession?.kind === "scenario" && !isAnyPending
        }
        onReplayTargetInputChange={setReplayTargetInput}
        onApplyReplayTarget={applyReplayTarget}
        onImportFile={importScenarioFile}
        onExport={exportScenario}
        onResetScenario={resetScenario}
        onRestartTransient={restartConfiguration}
      />

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
            draft={displayedDraft}
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
    </div>
  );
}

function formatSessionFailure(
  result: Extract<TransientSessionLoadResult, { ok: false }>,
): string[] {
  if (result.stage === "validation") {
    return result.errors.map((error) => `${error.path}: ${error.message}`);
  }

  return [`Pick ${result.error.pickIndex + 1}: ${result.error.message}`];
}

function formatTransientSource(source: TransientSource | null): string {
  if (!source) {
    return "Transient session";
  }

  switch (source.kind) {
    case "imported":
      return `Imported file: ${source.fileName}`;
    case "restart":
      return "Restarted transient configuration";
  }
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "draft-scenario";
}
