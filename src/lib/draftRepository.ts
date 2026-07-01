import type { DraftWorkspace, LeagueSettings, RankingEntry } from "@/types/draft";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
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
import type { RankingSnapshot } from "@/types/rankings";

export type CreateDraftWorkspaceInput = {
  name?: string;
  leagueSettings: LeagueSettings;
  rankings: RankingEntry[];
  rankingSnapshotMetadata?: Omit<RankingSnapshot, "rankings">;
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
  $transaction?<T>(callback: (tx: DraftRepositoryTransactionDb) => Promise<T>): Promise<T>;
  draft: {
    create(args: DraftCreateArgs): Promise<PersistedDraftWorkspaceRecord>;
    findUnique(args: DraftFindUniqueArgs): Promise<PersistedDraftWorkspaceRecord | null>;
    findMany(args: DraftFindManyArgs): Promise<PersistedDraftSummaryRecord[]>;
    update(args: DraftUpdateArgs): Promise<unknown>;
    delete(args: DraftDeleteArgs): Promise<unknown>;
  };
  rankingSnapshot: {
    delete(args: RankingSnapshotDeleteArgs): Promise<unknown>;
  };
  draftPick: {
    create(args: DraftPickCreateArgs): Promise<unknown>;
    deleteMany(args: DraftPickDeleteManyArgs): Promise<unknown>;
  };
};

type DraftRepositoryTransactionDb = Omit<DraftRepositoryDb, "$transaction">;

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

type DraftUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    status: DraftStatus;
  };
};

type DraftPickCreateArgs = {
  data: {
    draftId: string;
    pickNumber: number;
    playerId: string;
  };
};

type DraftPickDeleteManyArgs = {
  where: {
    draftId: string;
    pickNumber?: number;
  };
};

type DraftDeleteArgs = {
  where: {
    id: string;
  };
};

type RankingSnapshotDeleteArgs = {
  where: {
    id: string;
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

type PersistedDraftDeleteRecord = PersistedDraftWorkspaceRecord & {
  rankingSnapshot: PersistedDraftWorkspaceRecord["rankingSnapshot"] & {
    id: string;
  };
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
              rankings: serializeRankingSnapshot({
                rankings: input.rankings,
                ...input.rankingSnapshotMetadata,
              }),
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

    async draftPlayerInWorkspace(
      draftId: string,
      playerId: string,
    ): Promise<DraftWorkspace | null> {
      return runRepositoryTransaction(db, async (tx) => {
        const workspace = await getWorkspaceById(tx, draftId);

        if (!workspace) {
          return null;
        }

        const playerExistsInSnapshot = workspace.rankings.some((ranking) => {
          return ranking.player.id === playerId;
        });

        if (!playerExistsInSnapshot) {
          return workspace;
        }

        const nextDraft = draftPlayerInDraft(workspace.draft, playerId);

        if (nextDraft === workspace.draft) {
          return workspace;
        }

        const persistedPick = nextDraft.picks.find((pick) => {
          return pick.pickNumber === workspace.draft.currentPickNumber;
        });

        if (!persistedPick?.playerId) {
          return workspace;
        }

        await tx.draftPick.create({
          data: {
            draftId,
            pickNumber: persistedPick.pickNumber,
            playerId: persistedPick.playerId,
          },
        });

        await tx.draft.update({
          where: { id: draftId },
          data: {
            status: getDraftStatusAfterDraft(nextDraft),
          },
        });

        return getWorkspaceById(tx, draftId);
      });
    },

    async undoLastPickInWorkspace(draftId: string): Promise<DraftWorkspace | null> {
      return runRepositoryTransaction(db, async (tx) => {
        const workspace = await getWorkspaceById(tx, draftId);

        if (!workspace) {
          return null;
        }

        const nextDraft = undoLastDraftPick(workspace.draft);

        if (nextDraft === workspace.draft) {
          return workspace;
        }

        const latestPersistedPick = workspace.draft.picks.reduce(
          (latestPick, pick) => {
            if (!pick.playerId) {
              return latestPick;
            }

            if (!latestPick || pick.pickNumber > latestPick.pickNumber) {
              return pick;
            }

            return latestPick;
          },
          undefined as DraftWorkspace["draft"]["picks"][number] | undefined,
        );

        if (!latestPersistedPick) {
          return workspace;
        }

        await tx.draftPick.deleteMany({
          where: {
            draftId,
            pickNumber: latestPersistedPick.pickNumber,
          },
        });

        await tx.draft.update({
          where: { id: draftId },
          data: {
            status: getDraftStatusAfterUndo(nextDraft),
          },
        });

        return getWorkspaceById(tx, draftId);
      });
    },

    async resetDraftWorkspace(draftId: string): Promise<DraftWorkspace | null> {
      return runRepositoryTransaction(db, async (tx) => {
        const workspace = await getWorkspaceById(tx, draftId);

        if (!workspace) {
          return null;
        }

        await tx.draftPick.deleteMany({
          where: {
            draftId,
          },
        });

        await tx.draft.update({
          where: { id: draftId },
          data: {
            status: "NOT_STARTED",
          },
        });

        return getWorkspaceById(tx, draftId);
      });
    },

    async deleteDraftWorkspace(draftId: string): Promise<boolean> {
      return runRepositoryTransaction(db, async (tx) => {
        const draft = await getDraftRecordById(tx, draftId);

        if (!draft) {
          return false;
        }

        await tx.draft.delete({
          where: {
            id: draftId,
          },
        });

        await tx.rankingSnapshot.delete({
          where: {
            id: draft.rankingSnapshot.id,
          },
        });

        return true;
      });
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

export async function draftPlayerInWorkspace(
  draftId: string,
  playerId: string,
): Promise<DraftWorkspace | null> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .draftPlayerInWorkspace(draftId, playerId);
}

export async function undoLastPickInWorkspace(
  draftId: string,
): Promise<DraftWorkspace | null> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .undoLastPickInWorkspace(draftId);
}

export async function resetDraftWorkspace(
  draftId: string,
): Promise<DraftWorkspace | null> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .resetDraftWorkspace(draftId);
}

export async function deleteDraftWorkspace(draftId: string): Promise<boolean> {
  return createDraftRepository(getPrismaClient() as unknown as DraftRepositoryDb)
    .deleteDraftWorkspace(draftId);
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

async function getWorkspaceById(
  db: DraftRepositoryTransactionDb,
  draftId: string,
): Promise<DraftWorkspace | null> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: draftWorkspaceInclude,
  });

  if (!draft) {
    return null;
  }

  return mapDraftRecordToWorkspace(draft);
}

async function getDraftRecordById(
  db: DraftRepositoryTransactionDb,
  draftId: string,
): Promise<PersistedDraftDeleteRecord | null> {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: draftWorkspaceInclude,
  });

  return draft as PersistedDraftDeleteRecord | null;
}

async function runRepositoryTransaction<T>(
  db: DraftRepositoryDb,
  callback: (tx: DraftRepositoryTransactionDb) => Promise<T>,
): Promise<T> {
  if (db.$transaction) {
    return db.$transaction(callback);
  }

  return callback(db);
}

function getDraftStatusAfterDraft(draft: DraftWorkspace["draft"]): DraftStatus {
  return draft.picks.every((pick) => Boolean(pick.playerId))
    ? "COMPLETE"
    : "IN_PROGRESS";
}

function getDraftStatusAfterUndo(draft: DraftWorkspace["draft"]): DraftStatus {
  return draft.picks.some((pick) => Boolean(pick.playerId))
    ? "IN_PROGRESS"
    : "NOT_STARTED";
}
