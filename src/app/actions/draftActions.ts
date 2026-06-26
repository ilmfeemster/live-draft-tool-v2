"use server";

import type { DraftWorkspace } from "@/types/draft";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import { formatAutomaticDraftName } from "@/lib/draftNames";
import {
  createDraftWorkspace,
  deleteDraftWorkspace,
  draftPlayerInWorkspace,
  resetDraftWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";

const mvpUserTeamId = "team-2";

export async function createNewDraftAction(): Promise<DraftWorkspace> {
  return createDraftWorkspace({
    name: formatAutomaticDraftName(),
    leagueSettings: defaultLeagueSettings,
    rankings: seedRankings,
    userTeamId: mvpUserTeamId,
  });
}

export async function deleteDraftAction(draftId: string): Promise<boolean> {
  if (!draftId.trim()) {
    return false;
  }

  return deleteDraftWorkspace(draftId);
}

export async function draftPlayerAction(
  draftId: string,
  playerId: string,
): Promise<DraftWorkspace | null> {
  if (!draftId.trim() || !playerId.trim()) {
    return null;
  }

  return draftPlayerInWorkspace(draftId, playerId);
}

export async function undoLastPickAction(
  draftId: string,
): Promise<DraftWorkspace | null> {
  if (!draftId.trim()) {
    return null;
  }

  return undoLastPickInWorkspace(draftId);
}

export async function resetDraftAction(
  draftId: string,
): Promise<DraftWorkspace | null> {
  if (!draftId.trim()) {
    return null;
  }

  return resetDraftWorkspace(draftId);
}
