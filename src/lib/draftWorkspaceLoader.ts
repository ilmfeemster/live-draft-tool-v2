import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import {
  createDraftWorkspace,
  getDraftWorkspaceById,
  listDraftSummaries,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";

const defaultDraftName = "Default Draft";
const defaultUserTeamId = "team-2";

type DraftWorkspaceLoaderRepository = {
  createDraftWorkspace: typeof createDraftWorkspace;
  getDraftWorkspaceById: typeof getDraftWorkspaceById;
  listDraftSummaries: typeof listDraftSummaries;
};

const defaultRepository: DraftWorkspaceLoaderRepository = {
  createDraftWorkspace,
  getDraftWorkspaceById,
  listDraftSummaries,
};

export async function loadOrCreateDefaultDraftWorkspace(
  repository = defaultRepository,
): Promise<DraftWorkspace> {
  try {
    const summaries = await repository.listDraftSummaries();
    const latestSummary = summaries[0];

    if (latestSummary) {
      const workspace = await repository.getDraftWorkspaceById(latestSummary.id);

      if (workspace) {
        return workspace;
      }
    }

    return repository.createDraftWorkspace({
      name: defaultDraftName,
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: defaultUserTeamId,
    });
  } catch (error) {
    throw new Error(
      "Unable to load the persisted draft workspace. Confirm PostgreSQL is running, DATABASE_URL points to the correct database, and the Prisma schema has been applied.",
      { cause: error },
    );
  }
}
