import type { DraftWorkspace } from "@/types/draft";
import { createDraftWorkspace } from "@/lib/draftRepository";
import {
  buildLeagueSetup,
  type LeagueSetupInput,
} from "@/lib/leagueSetup";
import {
  copyRankingEntries,
  createRankingSnapshotFromRankingSet,
} from "@/lib/rankingSnapshot";
import { getRankingSetById } from "@/lib/rankingSetRepository";
import type { RankingSet } from "@/types/rankings";

export type CreateConfiguredDraftFromRankingSetInput = Readonly<{
  leagueSetup: LeagueSetupInput;
  rankingSetId: string;
  name?: string;
  capturedAt?: Date;
}>;

export type CreateConfiguredDraftFromRankingSetError = Readonly<{
  code:
    | "invalid-request"
    | "ranking-set-not-found"
    | "invalid-league-setup"
    | "invalid-ranking-set";
  message: string;
  path?: string;
}>;

export type CreateConfiguredDraftFromRankingSetResult =
  | Readonly<{ ok: true; workspace: DraftWorkspace }>
  | Readonly<{
      ok: false;
      errors: readonly CreateConfiguredDraftFromRankingSetError[];
    }>;

export type DraftCreationWorkflowDependencies = Readonly<{
  getRankingSetById: (id: string) => Promise<RankingSet | null>;
  createDraftWorkspace: typeof createDraftWorkspace;
}>;

const defaultDependencies: DraftCreationWorkflowDependencies = {
  getRankingSetById,
  createDraftWorkspace,
};

export async function createConfiguredDraftFromRankingSet(
  input: CreateConfiguredDraftFromRankingSetInput,
  dependencies: DraftCreationWorkflowDependencies = defaultDependencies,
): Promise<CreateConfiguredDraftFromRankingSetResult> {
  const rankingSetId = input.rankingSetId.trim();

  if (!rankingSetId) {
    return failure({
      code: "invalid-request",
      path: "rankingSetId",
      message: "Ranking set ID is required.",
    });
  }

  const rankingSet = await dependencies.getRankingSetById(rankingSetId);

  if (!rankingSet) {
    return failure({
      code: "ranking-set-not-found",
      path: "rankingSetId",
      message: "Ranking set was not found.",
    });
  }

  const setup = buildLeagueSetup(input.leagueSetup, rankingSet.entries.length);

  if (!setup.ok) {
    return {
      ok: false,
      errors: setup.errors.map((error) => ({
        code: "invalid-league-setup",
        path: error.field,
        message: error.message,
      })),
    };
  }

  const snapshot = createRankingSnapshotFromRankingSet(rankingSet, {
    capturedAt: input.capturedAt,
  });

  if (!snapshot.ok) {
    return {
      ok: false,
      errors: snapshot.errors.map((error) => ({
        code: "invalid-ranking-set",
        path: error.path,
        message: error.message,
      })),
    };
  }

  const {
    rankings: snapshotRankings,
    ...rankingSnapshotMetadata
  } = snapshot.snapshot;

  const workspace = await dependencies.createDraftWorkspace({
    name: input.name,
    leagueSettings: setup.leagueSettings,
    rankings: copyRankingEntries(snapshotRankings),
    rankingSnapshotMetadata,
    userTeamId: setup.userTeamId,
  });

  return { ok: true, workspace };
}

function failure(
  error: CreateConfiguredDraftFromRankingSetError,
): CreateConfiguredDraftFromRankingSetResult {
  return { ok: false, errors: [error] };
}
