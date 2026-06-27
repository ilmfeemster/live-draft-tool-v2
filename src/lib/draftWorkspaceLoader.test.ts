import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import {
  loadDraftWorkspace,
  loadOrCreateDefaultDraftWorkspace,
} from "@/lib/draftWorkspaceLoader";
import type {
  CreateDraftWorkspaceInput,
  DraftSummary,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";

describe("draft workspace loader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a selected persisted draft workspace", async () => {
    const selectedWorkspace = createDraftWorkspace("draft-selected");
    const latestWorkspace = createDraftWorkspace("draft-latest");
    const summaries = [
      createDraftSummary("draft-latest", new Date("2026-01-02T00:00:00.000Z")),
      createDraftSummary("draft-selected", new Date("2026-01-01T00:00:00.000Z")),
    ];
    const repository = createFakeRepository({
      summaries,
      workspacesById: {
        "draft-latest": latestWorkspace,
        "draft-selected": selectedWorkspace,
      },
    });

    const result = await loadDraftWorkspace("draft-selected", repository);

    expect(repository.listDraftSummaries).toHaveBeenCalledOnce();
    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("draft-selected");
    expect(repository.getDraftWorkspaceById).not.toHaveBeenCalledWith("draft-latest");
    expect(repository.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      workspace: selectedWorkspace,
      summaries,
      selectedDraftId: "draft-selected",
      requestedDraftMissing: false,
    });
  });

  it("loads the most recently updated persisted draft workspace", async () => {
    const workspace = createDraftWorkspace("draft-latest");
    const summaries = [
      createDraftSummary("draft-latest", new Date("2026-01-02T00:00:00.000Z")),
      createDraftSummary("draft-older", new Date("2026-01-01T00:00:00.000Z")),
    ];
    const repository = createFakeRepository({
      summaries,
      workspacesById: {
        "draft-latest": workspace,
      },
    });

    const result = await loadDraftWorkspace(undefined, repository);

    expect(repository.listDraftSummaries).toHaveBeenCalledOnce();
    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("draft-latest");
    expect(repository.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      workspace,
      summaries,
      selectedDraftId: "draft-latest",
      requestedDraftMissing: false,
    });
  });

  it("uses the latest draft workspace for the default workspace compatibility wrapper", async () => {
    const workspace = createDraftWorkspace("draft-latest");
    const repository = createFakeRepository({
      summaries: [createDraftSummary("draft-latest")],
      workspacesById: {
        "draft-latest": workspace,
      },
    });

    await expect(
      loadOrCreateDefaultDraftWorkspace(repository),
    ).resolves.toBe(workspace);
  });

  it("creates a default persisted draft workspace when no summaries exist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace("created-draft");
    const repository = createFakeRepository({
      summaries: [],
      createdWorkspace: workspace,
    });

    const result = await loadDraftWorkspace(undefined, repository);

    expect(repository.getDraftWorkspaceById).not.toHaveBeenCalled();
    expect(repository.createDraftWorkspace).toHaveBeenCalledWith({
      name: "Draft - Jun 26, 2026, 5:42 PM",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-2",
    });
    expect(result).toEqual({
      workspace,
      summaries: [],
      selectedDraftId: "created-draft",
      requestedDraftMissing: false,
    });
  });

  it("creates a default persisted draft workspace when the latest summary is stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace("created-draft");
    const repository = createFakeRepository({
      summaries: [createDraftSummary("stale-draft")],
      createdWorkspace: workspace,
    });

    const result = await loadDraftWorkspace(undefined, repository);

    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("stale-draft");
    expect(repository.createDraftWorkspace).toHaveBeenCalledWith({
      name: "Draft - Jun 26, 2026, 5:42 PM",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-2",
    });
    expect(result.workspace).toBe(workspace);
    expect(result.selectedDraftId).toBe("created-draft");
    expect(result.requestedDraftMissing).toBe(false);
  });

  it("falls back to the latest draft when a selected draft is missing", async () => {
    const latestWorkspace = createDraftWorkspace("draft-latest");
    const summaries = [createDraftSummary("draft-latest")];
    const repository = createFakeRepository({
      summaries,
      workspacesById: {
        "draft-latest": latestWorkspace,
      },
    });

    const result = await loadDraftWorkspace("missing-draft", repository);

    expect(repository.getDraftWorkspaceById).toHaveBeenNthCalledWith(
      1,
      "missing-draft",
    );
    expect(repository.getDraftWorkspaceById).toHaveBeenNthCalledWith(
      2,
      "draft-latest",
    );
    expect(repository.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      workspace: latestWorkspace,
      summaries,
      selectedDraftId: "draft-latest",
      requestedDraftMissing: true,
    });
  });

  it("creates the default draft when a selected draft is missing and no summaries exist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace("created-draft");
    const repository = createFakeRepository({
      summaries: [],
      createdWorkspace: workspace,
    });

    const result = await loadDraftWorkspace("missing-draft", repository);

    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("missing-draft");
    expect(repository.createDraftWorkspace).toHaveBeenCalledWith({
      name: "Draft - Jun 26, 2026, 5:42 PM",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-2",
    });
    expect(result).toEqual({
      workspace,
      summaries: [],
      selectedDraftId: "created-draft",
      requestedDraftMissing: true,
    });
  });

  it("treats a blank selected draft id like no selected draft id", async () => {
    const workspace = createDraftWorkspace("draft-latest");
    const repository = createFakeRepository({
      summaries: [createDraftSummary("draft-latest")],
      workspacesById: {
        "draft-latest": workspace,
      },
    });

    const result = await loadDraftWorkspace("  ", repository);

    expect(repository.getDraftWorkspaceById).toHaveBeenCalledOnce();
    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith("draft-latest");
    expect(result.requestedDraftMissing).toBe(false);
    expect(result.workspace).toBe(workspace);
  });

  it("throws an actionable persistence setup error when the repository cannot load summaries", async () => {
    const repository = createFakeRepository({
      summaries: [],
    });
    const cause = new Error("connection refused");
    repository.listDraftSummaries.mockRejectedValue(cause);

    try {
      await loadOrCreateDefaultDraftWorkspace(repository);
      throw new Error("Expected workspace loading to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        "Unable to load the persisted draft workspace.",
      );
      expect((error as Error).cause).toBe(cause);
    }
  });
});

function createFakeRepository({
  summaries,
  workspacesById = {},
  createdWorkspace = createDraftWorkspace("created-draft"),
}: {
  summaries: DraftSummary[];
  workspacesById?: Record<string, DraftWorkspace>;
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
      return workspacesById[id] ?? null;
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
