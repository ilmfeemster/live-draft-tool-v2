import { seedRankings } from "@/data/seedRankings";
import { formatAutomaticDraftName } from "@/lib/draftNames";
import {
  buildLeagueSetup,
  defaultLeagueSetupInput,
  type LeagueSetupValidationError,
} from "@/lib/leagueSetup";
import {
  createDraftWorkspace,
  type DraftSummary,
  getDraftWorkspaceById,
  listDraftSummaries,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";

type DraftWorkspaceLoaderRepository = {
  createDraftWorkspace: typeof createDraftWorkspace;
  getDraftWorkspaceById: typeof getDraftWorkspaceById;
  listDraftSummaries: typeof listDraftSummaries;
};

export type LoadDraftWorkspaceResult = {
  workspace: DraftWorkspace;
  summaries: DraftSummary[];
  selectedDraftId: string;
  requestedDraftMissing: boolean;
};

const defaultRepository: DraftWorkspaceLoaderRepository = {
  createDraftWorkspace,
  getDraftWorkspaceById,
  listDraftSummaries,
};

export async function loadOrCreateDefaultDraftWorkspace(
  repository = defaultRepository,
): Promise<DraftWorkspace> {
  const result = await loadDraftWorkspace(undefined, repository);

  return result.workspace;
}

export async function loadDraftWorkspace(
  selectedDraftId?: string,
  repository = defaultRepository,
): Promise<LoadDraftWorkspaceResult> {
  try {
    const requestedDraftId = selectedDraftId?.trim() ?? "";
    const summaries = await repository.listDraftSummaries();

    if (requestedDraftId) {
      const selectedWorkspace = await repository.getDraftWorkspaceById(
        requestedDraftId,
      );

      if (selectedWorkspace) {
        return {
          workspace: selectedWorkspace,
          summaries,
          selectedDraftId: selectedWorkspace.draft.id,
          requestedDraftMissing: false,
        };
      }
    }

    const latestSummary = summaries[0];
    if (latestSummary) {
      const workspace = await repository.getDraftWorkspaceById(latestSummary.id);

      if (workspace) {
        return {
          workspace,
          summaries,
          selectedDraftId: workspace.draft.id,
          requestedDraftMissing: Boolean(requestedDraftId),
        };
      }
    }

    const setup = getDefaultLeagueSetup();
    const workspace = await repository.createDraftWorkspace({
      name: formatAutomaticDraftName(),
      leagueSettings: setup.leagueSettings,
      rankings: seedRankings,
      userTeamId: setup.userTeamId,
    });

    return {
      workspace,
      summaries,
      selectedDraftId: workspace.draft.id,
      requestedDraftMissing: Boolean(requestedDraftId),
    };
  } catch (error) {
    throw new Error(
      "Unable to load the persisted draft workspace. Confirm PostgreSQL is running, DATABASE_URL points to the correct database, and the Prisma schema has been applied.",
      { cause: error },
    );
  }
}

function getDefaultLeagueSetup() {
  const result = buildLeagueSetup(defaultLeagueSetupInput, seedRankings.length);

  if (!result.ok) {
    throw new Error(formatInvalidDefaultSetupMessage(result.errors));
  }

  return result;
}

function formatInvalidDefaultSetupMessage(
  errors: LeagueSetupValidationError[],
): string {
  return `Default league setup is invalid: ${errors
    .map((error) => `${error.field}: ${error.message}`)
    .join("; ")}`;
}
