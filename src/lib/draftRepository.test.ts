import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftRepository } from "@/lib/draftRepository";
import { isValidDraftState } from "@/lib/draftInvariants";
import { serializeLeagueSettingsSnapshot } from "@/lib/leagueSettingsSnapshot";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";
import type { LeagueSettings, Position, RankingEntry } from "@/types/draft";

describe("draft repository", () => {
  it("creates a default draft from source state without empty pick rows", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
    ];

    const workspace = await repository.createDraftWorkspace({
      name: "Test Draft",
      leagueSettings: defaultLeagueSettings,
      rankings,
      userTeamId: "team-2",
    });

    expect(db.drafts[0]).toMatchObject({
      name: "Test Draft",
      leagueSettings: serializeLeagueSettingsSnapshot(defaultLeagueSettings),
      userTeamId: "team-2",
      picks: [],
    });
    expect(db.rankingSnapshots[0].rankings).toEqual(
      serializeRankingSnapshot(rankings),
    );
    expect(workspace.draft.currentPickNumber).toBe(1);
    expect(workspace.draft.picks).toHaveLength(192);
    expect(workspace.rankings).toEqual(rankings);
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("creates and returns a valid non-default draft workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const leagueSettings = createLeagueSettings({ teamCount: 4, rounds: 3 });

    const workspace = await repository.createDraftWorkspace({
      leagueSettings,
      rankings: [createRanking("player-1", 1, "QB")],
      userTeamId: "team-3",
    });

    expect(workspace.leagueSettings.teamCount).toBe(4);
    expect(workspace.leagueSettings.rounds).toBe(3);
    expect(workspace.draft.teams).toHaveLength(4);
    expect(workspace.draft.picks).toHaveLength(12);
    expect(workspace.draft.userTeamId).toBe("team-3");
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("loads an existing draft as a typed draft workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const createdWorkspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    db.drafts[0].picks.push(
      { pickNumber: 2, playerId: "player-2" },
      { pickNumber: 1, playerId: "player-1" },
    );

    const loadedWorkspace = await repository.getDraftWorkspaceById(
      createdWorkspace.draft.id,
    );

    expect(loadedWorkspace?.draft.currentPickNumber).toBe(3);
    expect(loadedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(loadedWorkspace?.draft.picks[1].playerId).toBe("player-2");
    expect(loadedWorkspace?.rankings.map((ranking) => ranking.player.id)).toEqual([
      "player-1",
      "player-2",
    ]);
  });

  it("returns null when loading a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(repository.getDraftWorkspaceById("missing-draft")).resolves.toBeNull();
  });

  it("drafts a player, persists the pick, and reloads the current pick", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-1",
    );
    const reloadedWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(updatedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(reloadedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(reloadedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("returns null when drafting into a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.draftPlayerInWorkspace("missing-draft", "player-1"),
    ).resolves.toBeNull();
  });

  it("does not mutate pick history when drafting a player missing from the ranking snapshot", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "missing-player",
    );

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(1);
  });

  it("does not create another pick row for a duplicate drafted player", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-1",
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("undoes the latest persisted pick and reloads the restored current pick", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );
    const reloadedWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(updatedWorkspace?.draft.picks[1].playerId).toBeUndefined();
    expect(reloadedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(reloadedWorkspace?.draft.picks[1].playerId).toBeUndefined();
  });

  it("returns null when undoing a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.undoLastPickInWorkspace("missing-draft"),
    ).resolves.toBeNull();
  });

  it("does not mutate pick history when undoing an empty draft", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(1);
  });

  it("marks a completed draft complete and blocks extra picks after completion", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 1 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
        createRanking("player-3", 3, "QB"),
      ],
      userTeamId: "team-1",
    });

    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    const completedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-2",
    );
    const unchangedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-3",
    );

    expect(db.drafts[0].status).toBe("COMPLETE");
    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
      { pickNumber: 2, playerId: "player-2" },
    ]);
    expect(completedWorkspace?.draft.picks.every((pick) => pick.playerId)).toBe(
      true,
    );
    expect(unchangedWorkspace?.draft.picks.map((pick) => pick.playerId)).toEqual([
      "player-1",
      "player-2",
    ]);
  });

  it("restores in-progress status when undoing after completion", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 1 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );

    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("resets one draft pick history and reloads an empty workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const leagueSettings = createLeagueSettings({ teamCount: 2, rounds: 2 });
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
      createRanking("player-3", 3, "QB"),
    ];
    const workspace = await repository.createDraftWorkspace({
      name: "Reset Me",
      leagueSettings,
      rankings,
      userTeamId: "team-2",
    });
    const otherWorkspace = await repository.createDraftWorkspace({
      name: "Keep Me",
      leagueSettings,
      rankings,
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");
    await repository.draftPlayerInWorkspace(otherWorkspace.draft.id, "player-3");

    const resetWorkspace = await repository.resetDraftWorkspace(workspace.draft.id);

    expect(resetWorkspace).not.toBeNull();
    if (!resetWorkspace) {
      throw new Error("Expected reset to return a workspace.");
    }

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(db.drafts[1].picks).toEqual([
      { pickNumber: 1, playerId: "player-3" },
    ]);
    expect(db.drafts[1].status).toBe("IN_PROGRESS");
    expect(resetWorkspace.draft.id).toBe(workspace.draft.id);
    expect(resetWorkspace.draft.currentPickNumber).toBe(1);
    expect(resetWorkspace.draft.picks.every((pick) => !pick.playerId)).toBe(true);
    expect(resetWorkspace.rankings).toEqual(rankings);
    expect(resetWorkspace.leagueSettings).toEqual(leagueSettings);
    expect(resetWorkspace.draft.userTeamId).toBe("team-2");
    expect(isValidDraftState({ draft: resetWorkspace.draft })).toBe(true);
  });

  it("returns null when resetting a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.resetDraftWorkspace("missing-draft"),
    ).resolves.toBeNull();
  });

  it("lists lightweight draft summaries without loading ranking snapshot JSON", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const defaultWorkspace = await repository.createDraftWorkspace({
      name: "Default Draft",
      leagueSettings: defaultLeagueSettings,
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-2",
    });
    const nonDefaultSettings = createLeagueSettings({ teamCount: 4, rounds: 3 });
    const nonDefaultWorkspace = await repository.createDraftWorkspace({
      name: "Non-default Draft",
      leagueSettings: nonDefaultSettings,
      rankings: [createRanking("player-2", 1, "RB")],
      userTeamId: "team-3",
    });
    db.drafts[0].picks.push({ pickNumber: 1, playerId: "player-1" });
    db.drafts[0].updatedAt = new Date("2026-01-01T00:00:00.000Z");
    db.drafts[1].updatedAt = new Date("2026-01-02T00:00:00.000Z");

    const summaries = await repository.listDraftSummaries();

    expect(db.findManySelectedRankingSnapshot).toBe(false);
    expect(summaries).toEqual([
      {
        id: nonDefaultWorkspace.draft.id,
        name: "Non-default Draft",
        status: "NOT_STARTED",
        teamCount: 4,
        rounds: 3,
        userTeamId: "team-3",
        draftedPickCount: 0,
        createdAt: db.drafts[1].createdAt,
        updatedAt: db.drafts[1].updatedAt,
      },
      {
        id: defaultWorkspace.draft.id,
        name: "Default Draft",
        status: "NOT_STARTED",
        teamCount: 12,
        rounds: 16,
        userTeamId: "team-2",
        draftedPickCount: 1,
        createdAt: db.drafts[0].createdAt,
        updatedAt: db.drafts[0].updatedAt,
      },
    ]);
  });
});

type FakeDraftRecord = {
  id: string;
  name: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  leagueSettings: unknown;
  userTeamId: string;
  rankingSnapshot: {
    rankings: unknown;
  };
  picks: {
    pickNumber: number;
    playerId: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

function createFakeDraftDb() {
  const db = {
    drafts: [] as FakeDraftRecord[],
    rankingSnapshots: [] as { id: string; rankings: unknown }[],
    findManySelectedRankingSnapshot: false,
    draft: {
      async create(args: {
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
      }) {
        const draftNumber = db.drafts.length + 1;
        const rankingSnapshot = {
          id: `ranking-snapshot-${draftNumber}`,
          rankings: args.data.rankingSnapshot.create.rankings,
        };
        const draft = {
          id: `draft-${draftNumber}`,
          name: args.data.name,
          status: "NOT_STARTED" as const,
          leagueSettings: args.data.leagueSettings,
          userTeamId: args.data.userTeamId,
          rankingSnapshot,
          picks: [],
          createdAt: new Date(`2026-01-0${draftNumber}T00:00:00.000Z`),
          updatedAt: new Date(`2026-01-0${draftNumber}T00:00:00.000Z`),
        };

        db.rankingSnapshots.push(rankingSnapshot);
        db.drafts.push(draft);

        return toWorkspaceRecord(draft);
      },
      async findUnique(args: { where: { id: string } }) {
        const draft = db.drafts.find((candidate) => candidate.id === args.where.id);

        return draft ? toWorkspaceRecord(draft) : null;
      },
      async findMany(args: {
        select: Record<string, unknown>;
        orderBy: {
          updatedAt: "desc";
        };
      }) {
        db.findManySelectedRankingSnapshot = "rankingSnapshot" in args.select;

        return [...db.drafts]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .map((draft) => ({
            id: draft.id,
            name: draft.name,
            status: draft.status,
            leagueSettings: draft.leagueSettings,
            userTeamId: draft.userTeamId,
            picks: draft.picks.map((pick) => ({ pickNumber: pick.pickNumber })),
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          }));
      },
      async update(args: {
        where: { id: string };
        data: { status: FakeDraftRecord["status"] };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.where.id;
        });

        if (!draft) {
          throw new Error(`Draft ${args.where.id} was not found.`);
        }

        draft.status = args.data.status;
        draft.updatedAt = new Date(draft.updatedAt.getTime() + 1);

        return draft;
      },
    },
    draftPick: {
      async create(args: {
        data: {
          draftId: string;
          pickNumber: number;
          playerId: string;
        };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.data.draftId;
        });

        if (!draft) {
          throw new Error(`Draft ${args.data.draftId} was not found.`);
        }

        if (
          draft.picks.some((pick) => {
            return pick.pickNumber === args.data.pickNumber;
          })
        ) {
          throw new Error(`Pick ${args.data.pickNumber} already exists.`);
        }

        draft.picks.push({
          pickNumber: args.data.pickNumber,
          playerId: args.data.playerId,
        });

        return args.data;
      },
      async deleteMany(args: {
        where: {
          draftId: string;
          pickNumber?: number;
        };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.where.draftId;
        });

        if (!draft) {
          return { count: 0 };
        }

        const originalPickCount = draft.picks.length;
        draft.picks = draft.picks.filter((pick) => {
          if (args.where.pickNumber === undefined) {
            return false;
          }

          return pick.pickNumber !== args.where.pickNumber;
        });

        return {
          count: originalPickCount - draft.picks.length,
        };
      },
    },
  };

  return db;
}

function toWorkspaceRecord(draft: FakeDraftRecord) {
  return {
    id: draft.id,
    leagueSettings: draft.leagueSettings,
    userTeamId: draft.userTeamId,
    rankingSnapshot: {
      rankings: draft.rankingSnapshot.rankings,
    },
    picks: [...draft.picks].sort((left, right) => left.pickNumber - right.pickNumber),
  };
}

function createLeagueSettings({
  teamCount,
  rounds,
}: {
  teamCount: number;
  rounds: number;
}): LeagueSettings {
  return {
    ...defaultLeagueSettings,
    teamCount,
    rounds,
    rosterSlots: defaultLeagueSettings.rosterSlots.slice(0, rounds),
  };
}

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
): RankingEntry {
  return {
    player: {
      id,
      name: id,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank: null,
    positionRank: overallRank,
    tier: 1,
  };
}
