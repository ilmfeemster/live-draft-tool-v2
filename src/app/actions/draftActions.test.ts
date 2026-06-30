import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { seedRankings } from "@/data/seedRankings";
import {
  buildLeagueSetup,
  defaultLeagueSetupInput,
  type LeagueSetupInput,
} from "@/lib/leagueSetup";
import {
  createDraftWorkspace as createDraftWorkspaceRepository,
  deleteDraftWorkspace,
  draftPlayerInWorkspace,
  resetDraftWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";
import { createConfiguredDraftFromRankingSet } from "@/lib/draftCreationWorkflow";
import type { DraftWorkspace } from "@/types/draft";
import {
  createConfiguredDraftAction,
  createConfiguredDraftFromRankingSetAction,
  createNewDraftAction,
  deleteDraftAction,
  draftPlayerAction,
  resetDraftAction,
  undoLastPickAction,
} from "./draftActions";

vi.mock("@/lib/draftCreationWorkflow", () => ({
  createConfiguredDraftFromRankingSet: vi.fn(),
}));

vi.mock("@/lib/draftRepository", () => ({
  createDraftWorkspace: vi.fn(),
  deleteDraftWorkspace: vi.fn(),
  draftPlayerInWorkspace: vi.fn(),
  resetDraftWorkspace: vi.fn(),
  undoLastPickInWorkspace: vi.fn(),
}));

const createDraftWorkspaceRepositoryMock = vi.mocked(
  createDraftWorkspaceRepository,
);
const deleteDraftWorkspaceMock = vi.mocked(deleteDraftWorkspace);
const draftPlayerInWorkspaceMock = vi.mocked(draftPlayerInWorkspace);
const resetDraftWorkspaceMock = vi.mocked(resetDraftWorkspace);
const undoLastPickInWorkspaceMock = vi.mocked(undoLastPickInWorkspace);
const createConfiguredDraftFromRankingSetMock = vi.mocked(
  createConfiguredDraftFromRankingSet,
);

describe("draft mutation server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a new draft workspace with MVP defaults", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace();
    createDraftWorkspaceRepositoryMock.mockResolvedValue(workspace);

    const result = await createNewDraftAction();

    expect(createDraftWorkspaceRepositoryMock).toHaveBeenCalledWith({
      name: "Draft - Jun 26, 2026, 5:42 PM",
      leagueSettings: defaultLeagueSettings,
      rankings: seedRankings,
      userTeamId: "team-1",
    });
    expect(result).toBe(workspace);
  });

  it("creates a configured draft workspace from validated setup input", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace();
    const input = createConfiguredInput();
    const expectedSetup = buildLeagueSetup(input, seedRankings.length);
    createDraftWorkspaceRepositoryMock.mockResolvedValue(workspace);

    if (!expectedSetup.ok) {
      throw new Error("Expected configured test setup to be valid.");
    }

    const result = await createConfiguredDraftAction(input);

    expect(createDraftWorkspaceRepositoryMock).toHaveBeenCalledOnce();
    expect(createDraftWorkspaceRepositoryMock).toHaveBeenCalledWith({
      name: "Draft - Jun 26, 2026, 5:42 PM",
      leagueSettings: expectedSetup.leagueSettings,
      rankings: seedRankings,
      userTeamId: "team-3",
    });
    expect(result).toEqual({ ok: true, workspace });
  });

  it("returns validation errors without creating an invalid configured draft", async () => {
    const input = createConfiguredInput({ teamCount: 1 });

    const result = await createConfiguredDraftAction(input);

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "teamCount",
          message: "Team count must be an integer from 2 through 20.",
        },
      ],
    });
    expect(createDraftWorkspaceRepositoryMock).not.toHaveBeenCalled();
  });

  it("returns capacity errors without creating a configured draft", async () => {
    const input = createConfiguredInput({
      teamCount: 20,
      userDraftPosition: 20,
      rosterSlotCounts: {
        QB: 1,
        RB: 0,
        WR: 0,
        TE: 0,
        FLEX: 0,
        DST: 0,
        K: 0,
        BENCH: 29,
      },
    });

    const result = await createConfiguredDraftAction(input);

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "rankingPlayerCount",
          message: `Draft requires 600 players, but only ${seedRankings.length} ranking players are available.`,
        },
      ],
    });
    expect(createDraftWorkspaceRepositoryMock).not.toHaveBeenCalled();
  });

  it("delegates selected-ranking configured draft creation with an automatic name", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 26, 17, 42));

    const workspace = createDraftWorkspace();
    const input = createConfiguredInput();
    createConfiguredDraftFromRankingSetMock.mockResolvedValue({
      ok: true,
      workspace,
    });

    const result = await createConfiguredDraftFromRankingSetAction({
      leagueSetup: input,
      rankingSetId: "rankings-1",
    });

    expect(createConfiguredDraftFromRankingSetMock).toHaveBeenCalledWith({
      leagueSetup: input,
      rankingSetId: "rankings-1",
      name: "Draft - Jun 26, 2026, 5:42 PM",
    });
    expect(result).toEqual({ ok: true, workspace });
  });

  it("returns selected-ranking workflow errors unchanged", async () => {
    const errors = [
      {
        code: "ranking-set-not-found" as const,
        path: "rankingSetId",
        message: "Ranking set was not found.",
      },
    ];
    createConfiguredDraftFromRankingSetMock.mockResolvedValue({
      ok: false,
      errors,
    });

    const result = await createConfiguredDraftFromRankingSetAction({
      leagueSetup: createConfiguredInput(),
      rankingSetId: "missing-rankings",
    });

    expect(result).toEqual({ ok: false, errors });
  });

  it("keeps selected-ranking workflow failures rejected", async () => {
    const workflowError = new Error("database unavailable");
    createConfiguredDraftFromRankingSetMock.mockRejectedValue(workflowError);

    await expect(
      createConfiguredDraftFromRankingSetAction({
        leagueSetup: createConfiguredInput(),
        rankingSetId: "rankings-1",
      }),
    ).rejects.toBe(workflowError);
  });

  it("keeps repository failures as rejected configured-creation errors", async () => {
    const repositoryError = new Error("database unavailable");
    createDraftWorkspaceRepositoryMock.mockRejectedValue(repositoryError);

    await expect(
      createConfiguredDraftAction(createConfiguredInput()),
    ).rejects.toBe(repositoryError);
  });

  it("keeps repository failures as rejected default-creation errors", async () => {
    const repositoryError = new Error("database unavailable");
    createDraftWorkspaceRepositoryMock.mockRejectedValue(repositoryError);

    await expect(createNewDraftAction()).rejects.toBe(repositoryError);
  });

  it("delegates delete mutations to the repository", async () => {
    deleteDraftWorkspaceMock.mockResolvedValue(true);

    const result = await deleteDraftAction("draft-1");

    expect(deleteDraftWorkspaceMock).toHaveBeenCalledWith("draft-1");
    expect(result).toBe(true);
  });

  it("returns false from delete mutations when the repository cannot find the draft", async () => {
    deleteDraftWorkspaceMock.mockResolvedValue(false);

    const result = await deleteDraftAction("missing-draft");

    expect(deleteDraftWorkspaceMock).toHaveBeenCalledWith("missing-draft");
    expect(result).toBe(false);
  });

  it("does not call the repository for blank delete inputs", async () => {
    await expect(deleteDraftAction(" ")).resolves.toBe(false);

    expect(deleteDraftWorkspaceMock).not.toHaveBeenCalled();
  });

  it("delegates draft player mutations to the repository", async () => {
    const workspace = createDraftWorkspace();
    draftPlayerInWorkspaceMock.mockResolvedValue(workspace);

    const result = await draftPlayerAction("draft-1", "player-1");

    expect(draftPlayerInWorkspaceMock).toHaveBeenCalledWith(
      "draft-1",
      "player-1",
    );
    expect(result).toBe(workspace);
  });

  it("returns null from draft player mutations when the repository cannot find the draft", async () => {
    draftPlayerInWorkspaceMock.mockResolvedValue(null);

    const result = await draftPlayerAction("missing-draft", "player-1");

    expect(draftPlayerInWorkspaceMock).toHaveBeenCalledWith(
      "missing-draft",
      "player-1",
    );
    expect(result).toBeNull();
  });

  it("does not call the repository for blank draft player inputs", async () => {
    await expect(draftPlayerAction("", "player-1")).resolves.toBeNull();
    await expect(draftPlayerAction("draft-1", " ")).resolves.toBeNull();

    expect(draftPlayerInWorkspaceMock).not.toHaveBeenCalled();
  });

  it("delegates undo mutations to the repository", async () => {
    const workspace = createDraftWorkspace();
    undoLastPickInWorkspaceMock.mockResolvedValue(workspace);

    const result = await undoLastPickAction("draft-1");

    expect(undoLastPickInWorkspaceMock).toHaveBeenCalledWith("draft-1");
    expect(result).toBe(workspace);
  });

  it("returns null from undo mutations when the repository cannot find the draft", async () => {
    undoLastPickInWorkspaceMock.mockResolvedValue(null);

    const result = await undoLastPickAction("missing-draft");

    expect(undoLastPickInWorkspaceMock).toHaveBeenCalledWith("missing-draft");
    expect(result).toBeNull();
  });

  it("does not call the repository for blank undo inputs", async () => {
    await expect(undoLastPickAction(" ")).resolves.toBeNull();

    expect(undoLastPickInWorkspaceMock).not.toHaveBeenCalled();
  });

  it("delegates reset mutations to the repository", async () => {
    const workspace = createDraftWorkspace();
    resetDraftWorkspaceMock.mockResolvedValue(workspace);

    const result = await resetDraftAction("draft-1");

    expect(resetDraftWorkspaceMock).toHaveBeenCalledWith("draft-1");
    expect(result).toBe(workspace);
  });

  it("returns null from reset mutations when the repository cannot find the draft", async () => {
    resetDraftWorkspaceMock.mockResolvedValue(null);

    const result = await resetDraftAction("missing-draft");

    expect(resetDraftWorkspaceMock).toHaveBeenCalledWith("missing-draft");
    expect(result).toBeNull();
  });

  it("does not call the repository for blank reset inputs", async () => {
    await expect(resetDraftAction(" ")).resolves.toBeNull();

    expect(resetDraftWorkspaceMock).not.toHaveBeenCalled();
  });
});

function createDraftWorkspace(): DraftWorkspace {
  return {
    draft: {
      id: "draft-1",
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

function createConfiguredInput(
  overrides: Omit<Partial<LeagueSetupInput>, "rosterSlotCounts"> & {
    rosterSlotCounts?: LeagueSetupInput["rosterSlotCounts"];
  } = {},
): LeagueSetupInput {
  return {
    ...defaultLeagueSetupInput,
    teamCount: 4,
    userDraftPosition: 3,
    rosterSlotCounts: {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 0,
      FLEX: 0,
      DST: 0,
      K: 0,
      BENCH: 0,
    },
    ...overrides,
  };
}
