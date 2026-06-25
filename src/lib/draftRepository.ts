import type { DraftWorkspace, LeagueSettings, RankingEntry } from "@/types/draft";
import {
  mapDraftRecordToWorkspace,
  type PersistedDraftWorkspaceRecord,
} from "@/lib/draftRepositoryMapping";
import {
  parseLeagueSettingsSnapshotJson,
  serializeLeagueSettingsSnapshot,
} from "@/lib/leagueSettingsSnapshot";
import { getPrismaClient } from "@/lib/prisma";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";

export type CreateDraftWorkspaceInput = {
  name?: string;
  leagueSettings: LeagueSettings;
  rankings: RankingEntry[];
  userTeamId: string;
};

export type DraftSummary = {
  id: string;
  name: string | null;
  status: DraftStatus;
  teamCount: number;
  rounds: number;
  userTeamId: string;
  draftedPickCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

type DraftRepositoryDb = {
  draft: {
    create(args: DraftCreateArgs): Promise<PersistedDraftWorkspaceRecord>;
    findUnique(args: DraftFindUniqueArgs): Promise<PersistedDraftWorkspaceRecord | null>;
    findMany(args: DraftFindManyArgs): Promise<PersistedDraftSummaryRecord[]>;
  };
};

type DraftCreateArgs = {
  data: {
    name: string | null;
    leagueSettings: unknown;
    userTeamId: string;
    rankingSnapshot: {
      create: {
        rankings: unknown;
      };
    };
  };
  include: DraftWorkspaceInclude;
};

type DraftFindUniqueArgs = {
  where: {
    id: string;
  };
  include: DraftWorkspaceInclude;
};

type DraftFindManyArgs = {
  select: {
    id: true;
    name: true;
    status: true;
    leagueSettings: true;
    userTeamId: true;
    picks: {
      select: {
        pickNumber: true;
      };
    };
    createdAt: true;
    updatedAt: true;
  };
  orderBy: {
    updatedAt: "desc";
  };
};

type DraftWorkspaceInclude = {
  rankingSnapshot: true;
  picks: {
    orderBy: {
      pickNumber: "asc";
    };
  };
};

type PersistedDraftSummaryRecord = {
  id: string;
  name: string | null;
  status: DraftStatus;
  leagueSettings: unknown;
  userTeamId: string;
  picks: { pickNumber: number }[];
  createdAt: Date;
  updatedAt: Date;
};

const draftWorkspaceInclude = {
  rankingSnapshot: true,
  picks: {
    orderBy: {
      pickNumber: "asc",
    },
  },
} as const;

const draftSummarySelect = {
  id: true,
  name: true,
  status: true,
  leagueSettings: true,
  userTeamId: true,
  picks: {
    select: {
      pickNumber: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

export function createDraftRepository(db: DraftRepositoryDb) {
  return {
    async createDraftWorkspace(
      input: CreateDraftWorkspaceInput,
    ): Promise<DraftWorkspace> {
      const createdDraft = await db.draft.create({
        data: {
          name: input.name ?? null,
          leagueSettings: serializeLeagueSettingsSnapshot(input.leagueSettings),
          userTeamId: input.userTeamId,
          rankingSnapshot: {
            create: {
              rankings: serializeRankingSnapshot(input.rankings),
            },
          },
        },
        include: draftWorkspaceInclude,
      });

      return mapDraftRecordToWorkspace(createdDraft);
    },

    async getDraftWorkspaceById(id: string): Promise<DraftWorkspace | null> {
      const draft = await db.draft.findUnique({
        where: { id },
        include: draftWorkspaceInclude,
      });

      if (!draft) {
        return null;
      }

      return mapDraftRecordToWorkspace(draft);
    },

    async listDraftSummaries(): Promise<DraftSummary[]> {
      const drafts = await db.draft.findMany({
        select: draftSummarySelect,
        orderBy: {
          updatedAt: "desc",
        },
      });

      return drafts.map(mapDraftRecordToSummary);
    },
  };
}

export async function createDraftWorkspace(
  input: CreateDraftWorkspaceInput,
): Promise<DraftWorkspace> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .createDraftWorkspace(input);
}

export async function getDraftWorkspaceById(
  id: string,
): Promise<DraftWorkspace | null> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .getDraftWorkspaceById(id);
}

export async function listDraftSummaries(): Promise<DraftSummary[]> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .listDraftSummaries();
}

function mapDraftRecordToSummary(record: PersistedDraftSummaryRecord): DraftSummary {
  const leagueSettings = parseLeagueSettingsSnapshotJson(record.leagueSettings);

  return {
    id: record.id,
    name: record.name,
    status: record.status,
    teamCount: leagueSettings.teamCount,
    rounds: leagueSettings.rounds,
    userTeamId: record.userTeamId,
    draftedPickCount: record.picks.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
