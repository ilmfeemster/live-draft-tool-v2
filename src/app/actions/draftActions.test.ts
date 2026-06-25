import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  draftPlayerInWorkspace,
  undoLastPickInWorkspace,
} from "@/lib/draftRepository";
import type { DraftWorkspace } from "@/types/draft";
import { draftPlayerAction, undoLastPickAction } from "./draftActions";

vi.mock("@/lib/draftRepository", () => ({
  draftPlayerInWorkspace: vi.fn(),
  undoLastPickInWorkspace: vi.fn(),
}));

const draftPlayerInWorkspaceMock = vi.mocked(draftPlayerInWorkspace);
const undoLastPickInWorkspaceMock = vi.mocked(undoLastPickInWorkspace);

describe("draft mutation server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
