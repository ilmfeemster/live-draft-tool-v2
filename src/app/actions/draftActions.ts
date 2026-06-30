"use server";

import type { DraftWorkspace } from "@/types/draft";
import { seedRankings } from "@/data/seedRankings";
import { formatAutomaticDraftName } from "@/lib/draftNames";
import {
  buildLeagueSetup,
  defaultLeagueSetupInput,
  type LeagueSetupInput,
  type LeagueSetupValidationError,
} from "@/lib/leagueSetup";
import {
  createDraftWorkspace,
  deleteDraftWorkspace,
  draftPlayerInWorkspace,
  resetDraftWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";
import {
  createConfiguredDraftFromRankingSet,
  type CreateConfiguredDraftFromRankingSetResult,
} from "@/lib/draftCreationWorkflow";

export type CreateConfiguredDraftActionResult =
  | {
      ok: true;
      workspace: DraftWorkspace;
    }
  | {
      ok: false;
      errors: LeagueSetupValidationError[];
    };

export async function createNewDraftAction(): Promise<DraftWorkspace> {
  const result = await createDraftFromSetup(defaultLeagueSetupInput);

  if (!result.ok) {
    throw new Error(formatInvalidDefaultSetupMessage(result.errors));
  }

  return result.workspace;
}

export async function createConfiguredDraftAction(
  input: LeagueSetupInput,
): Promise<CreateConfiguredDraftActionResult> {
  return createDraftFromSetup(input);
}

export async function createConfiguredDraftFromRankingSetAction(
  input: Readonly<{
    leagueSetup: LeagueSetupInput;
    rankingSetId: string;
  }>,
): Promise<CreateConfiguredDraftFromRankingSetResult> {
  return createConfiguredDraftFromRankingSet({
    leagueSetup: input.leagueSetup,
    rankingSetId: input.rankingSetId,
    name: formatAutomaticDraftName(),
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

async function createDraftFromSetup(
  input: LeagueSetupInput,
): Promise<CreateConfiguredDraftActionResult> {
  const setup = buildLeagueSetup(input, seedRankings.length);

  if (!setup.ok) {
    return setup;
  }

  const workspace = await createDraftWorkspace({
    name: formatAutomaticDraftName(),
    leagueSettings: setup.leagueSettings,
    rankings: seedRankings,
    userTeamId: setup.userTeamId,
  });

  return { ok: true, workspace };
}

function formatInvalidDefaultSetupMessage(
  errors: LeagueSetupValidationError[],
): string {
  return `Default league setup is invalid: ${errors
    .map((error) => `${error.field}: ${error.message}`)
    .join("; ")}`;
}
