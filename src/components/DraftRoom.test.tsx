import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftRoom } from "@/components/DraftRoom";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import type {
  CreateDraftWorkspaceInput,
  DraftSummary,
} from "@/lib/draftRepository";
import { loadDraftWorkspace } from "@/lib/draftWorkspaceLoader";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import type { DraftWorkspace, Position, RankingEntry } from "@/types/draft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/app/actions/draftActions", () => ({
  createConfiguredDraftAction: vi.fn(),
  draftPlayerAction: vi.fn(),
  resetDraftAction: vi.fn(),
  undoLastPickAction: vi.fn(),
}));

describe("DraftRoom loaded workspace recommendations", () => {
  it("preserves engine ordering, scores, and reasons at the render boundary", async () => {
    const persistedWorkspace = createPersistedWorkspace();
    const summary = createDraftSummary(persistedWorkspace);
    const repository = {
      createDraftWorkspace: vi.fn(
        async (input: CreateDraftWorkspaceInput) => {
          void input;
          return persistedWorkspace;
        },
      ),
      getDraftWorkspaceById: vi.fn(async (id: string) => {
        return id === persistedWorkspace.draft.id ? persistedWorkspace : null;
      }),
      listDraftSummaries: vi.fn(async () => [summary]),
    };

    const result = await loadDraftWorkspace(
      persistedWorkspace.draft.id,
      repository,
    );
    const { workspace } = result;
    const expectedRecommendations = generatePlayerRecommendations({
      draft: workspace.draft,
      rankings: workspace.rankings,
      leagueSettings: workspace.leagueSettings,
      userTeamId: workspace.draft.userTeamId,
    });
    const markup = renderToStaticMarkup(
      <DraftRoom
        draft={workspace.draft}
        rankings={workspace.rankings}
        leagueSettings={workspace.leagueSettings}
      />,
    );

    expect(markup).not.toContain("New Draft Setup");
    expect(markup).toContain("Developer Workbench");
    expect(markup).toContain("Persisted Draft");
    expect(markup).toContain("Persisted workspace");
    expect(markup).toContain("Not applicable");
    expect(markup).toContain("Export Scenario");
    expect(markup).not.toContain("Transient Scenario");

    expect(repository.getDraftWorkspaceById).toHaveBeenCalledWith(
      persistedWorkspace.draft.id,
    );
    expect(workspace.leagueSettings).toMatchObject({
      teamCount: 4,
      rounds: 3,
      rosterSlots: [
        { id: "qb", eligiblePositions: ["QB"] },
        { id: "flex", eligiblePositions: ["RB", "WR", "TE"] },
        { id: "bench", eligiblePositions: ["QB", "RB", "WR", "TE"] },
      ],
    });
    expect(workspace.draft.userTeamId).toBe("team-2");
    expect(expectedRecommendations).toHaveLength(5);
    expect(expectedRecommendations.some((recommendation) => {
      return recommendation.reasons.length > 0;
    })).toBe(true);

    const draftedPlayer = workspace.rankings[0];
    expect(draftedPlayer.player.id).toBe("drafted-player");
    expect(
      expectedRecommendations.map((recommendation) => recommendation.playerId),
    ).not.toContain(draftedPlayer.player.id);
    expect(markup).not.toContain(draftedPlayer.player.name);

    const renderedNamePositions = expectedRecommendations.map((recommendation) => {
      return markup.indexOf(recommendation.ranking.player.name);
    });
    expect(renderedNamePositions.every((position) => position >= 0)).toBe(true);
    expect(renderedNamePositions).toEqual(
      [...renderedNamePositions].sort((left, right) => left - right),
    );

    for (const recommendation of expectedRecommendations) {
      expect(markup).toContain(`Score ${recommendation.totalScore.toFixed(1)}`);

      for (const reason of recommendation.reasons) {
        expect(markup).toContain(reason.text);
      }
    }
  });
});

function createPersistedWorkspace(): DraftWorkspace {
  const teamCount = 4;
  const rounds = 3;
  const picks = generateSnakeDraftOrder(teamCount, rounds);

  return {
    draft: {
      id: "loaded-workspace",
      teamCount,
      rounds,
      userTeamId: "team-2",
      currentPickNumber: 2,
      teams: createDraftTeams(teamCount),
      picks: picks.map((pick) => {
        return pick.pickNumber === 1
          ? { ...pick, playerId: "drafted-player" }
          : pick;
      }),
    },
    rankings: [
      createRanking("drafted-player", "Drafted Veteran", "WR", 1, 1, 1),
      createRanking("receiver-one", "River Stone", "WR", 2, 1, 1),
      createRanking("quarterback-one", "Quinn Harbor", "QB", 3, 1, 1),
      createRanking("running-back-one", "Rowan Field", "RB", 4, 1, 1),
      createRanking("tight-end-one", "Taylor Ridge", "TE", 5, 1, 1),
      createRanking("receiver-two", "Remy Vale", "WR", 6, 2, 2),
      createRanking("quarterback-two", "Casey North", "QB", 7, 2, 2),
      createRanking("defense-one", "Metro Defense", "DST", 8, 1, 1),
    ],
    leagueSettings: {
      teamCount,
      rounds,
      draftType: "SNAKE",
      scoringFormat: "PPR",
      rosterSlots: [
        {
          id: "qb",
          label: "QB",
          eligiblePositions: ["QB"],
        },
        {
          id: "flex",
          label: "FLEX",
          eligiblePositions: ["RB", "WR", "TE"],
        },
        {
          id: "bench",
          label: "Bench",
          eligiblePositions: ["QB", "RB", "WR", "TE"],
        },
      ],
    },
  };
}

function createRanking(
  id: string,
  name: string,
  position: Position,
  overallRank: number,
  positionRank: number,
  tier: number,
): RankingEntry {
  return {
    player: {
      id,
      name,
      team: "TST",
      position,
    },
    overallRank,
    adpRank: overallRank,
    positionRank,
    tier,
  };
}

function createDraftSummary(workspace: DraftWorkspace): DraftSummary {
  return {
    id: workspace.draft.id,
    name: "Loaded Workspace",
    status: "IN_PROGRESS",
    teamCount: workspace.draft.teamCount,
    rounds: workspace.draft.rounds,
    userTeamId: workspace.draft.userTeamId,
    draftedPickCount: 1,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  };
}
