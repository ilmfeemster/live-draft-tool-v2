import { describe, expect, it, vi } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import { loadOrCreateDefaultDraftWorkspace } from "@/lib/draftWorkspaceLoader";
import type {
  CreateDraftWorkspaceInput,
  DraftSummary,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";

describe("draft workspace loader", () => {
  it("loads the most recently updated persisted draft workspace", async () => {
    const workspace = createDraftWorkspace("draft-latest");
    const repository = createFakeRepository({
      summaries: [
        createDraftSummary("draft-latest", new Date("2026-01-02T00:00:00.000Z")),
        createDraftSummary("draft-older", new Date("2026-01-01T00:00:00.000Z")),
      ],
      workspace,
    });

    const result = await loadOrCreateDefaultDraftWorkspace(repository);

    expect(repository.listDraftSummaries).toHaveBeenCalledOnce();
    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("draft-latest");
    expect(repository.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toBe(workspace);
  });

  it("creates a default persisted draft workspace when no summaries exist", async () => {
    const workspace = createDraftWorkspace("created-draft");
    const repository = createFakeRepository({
      summaries: [],
      createdWorkspace: workspace,
    });

    const result = await loadOrCreateDefaultDraftWorkspace(repository);

    expect(repository.getDraftWorkspaceById).not.toHaveBeenCalled();
    expect(repository.createDraftWorkspace).toHaveBeenCalledWith({
      name: "Default Draft",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-2",
    });
    expect(result).toBe(workspace);
  });

  it("creates a default persisted draft workspace when the latest summary is stale", async () => {
    const workspace = createDraftWorkspace("created-draft");
    const repository = createFakeRepository({
      summaries: [createDraftSummary("stale-draft")],
      workspace: null,
      createdWorkspace: workspace,
    });

    const result = await loadOrCreateDefaultDraftWorkspace(repository);

    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("stale-draft");
    expect(repository.createDraftWorkspace).toHaveBeenCalledWith({
      name: "Default Draft",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-2",
    });
    expect(result).toBe(workspace);
  });

  it("throws an actionable persistence setup error when the repository cannot load summaries", async () => {
    const repository = createFakeRepository({
      summaries: [],
    });
    repository.listDraftSummaries.mockRejectedValue(new Error("connection refused"));

    await expect(loadOrCreateDefaultDraftWorkspace(repository)).rejects.toThrow(
      "Unable to load the persisted draft workspace.",
    );
  });
});

function createFakeRepository({
  summaries,
  workspace = null,
  createdWorkspace = createDraftWorkspace("created-draft"),
}: {
  summaries: DraftSummary[];
  workspace?: DraftWorkspace | null;
  createdWorkspace?: DraftWorkspace;
}) {
  return {
    createDraftWorkspace: vi.fn(
      async (input: CreateDraftWorkspaceInput) => {
        void input;
        return createdWorkspace;
      },
    ),
    getDraftWorkspaceById: vi.fn(async (id: string) => {
      void id;
      return workspace;
    }),
    listDraftSummaries: vi.fn(async () => summaries),
  };
}

function createDraftSummary(
  id: string,
  updatedAt = new Date("2026-01-01T00:00:00.000Z"),
): DraftSummary {
  return {
    id,
    name: "Test Draft",
    status: "NOT_STARTED",
    teamCount: 2,
    rounds: 1,
    userTeamId: "team-1",
    draftedPickCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt,
  };
}

function createDraftWorkspace(id: string): DraftWorkspace {
  return {
    draft: {
      id,
      teamCount: 2,
      rounds: 1,
      userTeamId: "team-1",
      currentPickNumber: 1,
      teams: [
        {
          id: "team-1",
          name: "Team 1",
          draftPosition: 1,
        },
        {
          id: "team-2",
          name: "Team 2",
          draftPosition: 2,
        },
      ],
      picks: [
        {
          pickNumber: 1,
          round: 1,
          pickInRound: 1,
          teamId: "team-1",
        },
        {
          pickNumber: 2,
          round: 1,
          pickInRound: 2,
          teamId: "team-2",
        },
      ],
    },
    rankings: [
      {
        player: {
          id: "player-1",
          name: "Player 1",
          team: "TEST",
          position: "WR",
        },
        overallRank: 1,
        adpRank: null,
        positionRank: 1,
        tier: 1,
      },
    ],
    leagueSettings: {
      teamCount: 2,
      rounds: 1,
      draftType: "SNAKE",
      scoringFormat: "PPR",
      rosterSlots: [
        {
          id: "wr",
          label: "WR",
          eligiblePositions: ["WR"],
        },
      ],
    },
  };
}
