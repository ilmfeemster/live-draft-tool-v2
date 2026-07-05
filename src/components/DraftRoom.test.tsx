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
import { MANAGED_SEED_RANKING_SET_ID } from "@/lib/managedSeedRankingSet";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import type { DraftWorkspace, Position, RankingEntry } from "@/types/draft";
import type { RankingSetSummary } from "@/types/rankings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/app/actions/draftActions", () => ({
  createConfiguredDraftFromRankingSetAction: vi.fn(),
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
    const recommendationRankingContextResult =
      workspace.recommendationRankingContextResult;

    if (!recommendationRankingContextResult) {
      throw new Error("Expected persisted recommendation context result.");
    }
    if (!recommendationRankingContextResult.ok) {
      throw new Error("Expected persisted recommendation context to succeed.");
    }
    const expectedRecommendations = generatePlayerRecommendations({
      draft: workspace.draft,
      rankings: workspace.rankings,
      leagueSettings: workspace.leagueSettings,
      userTeamId: workspace.draft.userTeamId,
      recommendationRankingContext:
        recommendationRankingContextResult.context,
    });
    const markup = renderToStaticMarkup(
      <DraftRoom
        draft={workspace.draft}
        defaultRankingSetId={MANAGED_SEED_RANKING_SET_ID}
        rankings={workspace.rankings}
        rankingSummaries={[createRankingSummary()]}
        leagueSettings={workspace.leagueSettings}
        recommendationRankingContextResult={
          recommendationRankingContextResult
        }
      />,
    );

    expect(markup).not.toContain("New Draft Setup");
    expect(markup).toContain("Developer Workbench");
    expect(markup).toContain("Persisted Draft");
    expect(markup).toContain("Persisted workspace");
    expect(markup).toContain("Not applicable");
    expect(markup).toContain("Scenario Files");
    expect(markup).toContain("Open saved scenario");
    expect(markup).not.toContain("Curated scenario");
    expect(markup).not.toContain("Early Non-Default Pressure");
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Apply Target<\/button>/);
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
    expect(expectedRecommendations.some((recommendation) => {
      return recommendation.components.some(
        (component) => component.id === "draft_pocket_timing",
      );
    })).toBe(true);
    const profileBackedRecommendation = expectedRecommendations.find(
      (recommendation) => {
        return recommendation.components.some((component) => {
          return component.id === "draft_pocket_timing" && component.delta > 0;
        });
      },
    );
    const profileTiming = profileBackedRecommendation?.components.find(
      (component) => component.id === "draft_pocket_timing",
    );

    expect(profileBackedRecommendation).toBeDefined();
    expect(profileTiming).toMatchObject({
      direction: "positive",
      evidence: {
        profilePosition: expect.any(String),
        profileOverallTierOrigin: "defaulted-neutral",
        profileOverallTier: 1,
        profileAnchorPlayerId: expect.any(String),
        profileOrdinal: expect.any(Number),
        allocationRole: expect.stringMatching(/^(full|reduced)$/),
      },
    });
    expect(
      profileBackedRecommendation?.reasons.some((reason) => {
        return reason.sourceComponentId === "draft_pocket_timing";
      }),
    ).toBe(true);
    expect(markup).toContain("draft_pocket_timing");
    expect(markup).not.toContain(
      "This overall tier is not represented in the forecasted next pocket.",
    );

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

  it("does not fabricate ranking context after structured normalization failure", () => {
    const workspace = createPersistedWorkspace();
    const markup = renderToStaticMarkup(
      <DraftRoom
        draft={workspace.draft}
        defaultRankingSetId={MANAGED_SEED_RANKING_SET_ID}
        rankings={workspace.rankings}
        rankingSummaries={[createRankingSummary()]}
        leagueSettings={workspace.leagueSettings}
        recommendationRankingContextResult={{
          ok: false,
          errors: [
            {
              code: "partial-overall-tiers",
              path: "tierSemantics.source.values",
              message: "Supplied tiers are incomplete.",
            },
          ],
        }}
      />,
    );

    expect(markup).not.toContain("overall_tier");
    expect(markup).not.toContain("draft_pocket_timing");
    expect(markup).toContain("River Stone");
  });
});

function createPersistedWorkspace(): DraftWorkspace {
  const teamCount = 4;
  const rounds = 3;
  const picks = generateSnakeDraftOrder(teamCount, rounds);
  const rankings = [
    createRanking("drafted-player", "Drafted Veteran", "WR", 1, 1, 1),
    createRanking("receiver-one", "River Stone", "WR", 2, 1, 1),
    createRanking("quarterback-one", "Quinn Harbor", "QB", 3, 1, 1),
    createRanking("running-back-one", "Rowan Field", "RB", 4, 1, 1),
    createRanking("tight-end-one", "Taylor Ridge", "TE", 5, 1, 1),
    createRanking("receiver-two", "Remy Vale", "WR", 6, 2, 2),
    createRanking("quarterback-two", "Casey North", "QB", 7, 2, 2),
    createRanking("defense-one", "Metro Defense", "DST", 8, 1, 1),
  ];

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
    rankings,
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
    recommendationRankingContextResult: createRecommendationRankingContext({
      rankings,
    }),
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

function createRankingSummary(): RankingSetSummary {
  const timestamp = new Date("2026-06-30T12:00:00.000Z");

  return {
    id: MANAGED_SEED_RANKING_SET_ID,
    name: "FantasyPros 2026 Seed Rankings",
    sourceKind: "seed",
    entryCount: 500,
    capabilities: {
      team: "complete",
      playerIdentity: "provided",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: "complete",
      tiers: {
        QB: "source",
        RB: "source",
        WR: "source",
        TE: "source",
        DST: "source",
        K: "source",
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
