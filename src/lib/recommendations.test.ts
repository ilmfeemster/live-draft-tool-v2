import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { draftPlayerInDraft } from "@/lib/draftState";
import { generateTopRecommendations } from "@/lib/recommendations";
import type { Draft, Position, RankingEntry } from "@/types/draft";

function createRanking(
  id: string,
  overallRank: number,
  position: Position = "RB",
  name = id,
  options: Partial<Pick<RankingEntry, "adpRank" | "positionRank" | "tier">> = {},
): RankingEntry {
  return {
    player: {
      id,
      name,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank: options.adpRank ?? null,
    positionRank: options.positionRank ?? overallRank,
    tier: options.tier ?? 1,
  };
}

function createTestDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "test-draft",
    teamCount: 2,
    rounds: 2,
    userTeamId: "team-1",
    currentPickNumber: 1,
    teams: createDraftTeams(2),
    picks: generateSnakeDraftOrder(2, 2),
    ...overrides,
  };
}

function getAvailableRankings(rankings: RankingEntry[], draft: Draft) {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return rankings.filter((ranking) => !draftedPlayerIds.has(ranking.player.id));
}

function getRecommendationPlayerIds(recommendations: ReturnType<typeof generateTopRecommendations>) {
  return recommendations.map((recommendation) => recommendation.ranking.player.id);
}

describe("generateTopRecommendations", () => {
  it("excludes drafted players before generating recommendations", () => {
    const rankings = [
      createRanking("player-1", 1, "RB"),
      createRanking("player-2", 2, "WR"),
      createRanking("player-3", 3, "QB"),
    ];
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");
    const availableRankings = getAvailableRankings(rankings, draft);
    const recommendationPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(availableRankings),
    );

    expect(recommendationPlayerIds).not.toContain("player-1");
    expect(recommendationPlayerIds).toEqual(expect.arrayContaining(["player-2", "player-3"]));
  });

  it("respects the requested recommendation limit", () => {
    const rankings = [
      createRanking("player-1", 1, "RB"),
      createRanking("player-2", 2, "WR"),
      createRanking("player-3", 3, "QB"),
      createRanking("player-4", 4, "TE"),
      createRanking("player-5", 5, "RB"),
    ];

    const recommendationPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(rankings, { limit: 2 }),
    );

    expect(recommendationPlayerIds).toEqual(["player-1", "player-2"]);
  });

  it("updates recommendations when the available player pool changes", () => {
    const rankings = [
      createRanking("player-1", 1, "RB"),
      createRanking("player-2", 2, "WR"),
      createRanking("player-3", 3, "QB"),
    ];
    const initialRecommendationPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(rankings),
    );
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");
    const updatedRecommendationPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(getAvailableRankings(rankings, draft)),
    );

    expect(initialRecommendationPlayerIds[0]).toBe("player-1");
    expect(updatedRecommendationPlayerIds[0]).toBe("player-2");
  });

  it("uses basic roster input when ordering recommendations", () => {
    const rankings = [createRanking("player-qb", 10, "QB"), createRanking("player-rb", 20, "RB")];

    const emptyRosterPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(rankings, { rosterPlayers: [] }),
    );
    const rosterWithQuarterbackPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(rankings, { rosterPlayers: [{ position: "QB" }] }),
    );

    expect(emptyRosterPlayerIds).toEqual(["player-qb", "player-rb"]);
    expect(rosterWithQuarterbackPlayerIds).toEqual(["player-rb", "player-qb"]);
  });

  it("prioritizes an unfilled starter need over a slightly higher-ranked player", () => {
    const rankings = [
      createRanking("player-rb", 19, "RB"),
      createRanking("player-qb-need", 20, "QB"),
      createRanking("player-rb-depth-1", 25, "RB"),
      createRanking("player-rb-depth-2", 26, "RB"),
    ];
    const recommendations = generateTopRecommendations(rankings, {
      rosterPlayers: [
        { position: "RB" },
        { position: "RB" },
        { position: "RB" },
        { position: "WR" },
        { position: "WR" },
        { position: "WR" },
        { position: "TE" },
      ],
    });

    expect(recommendations[0].ranking.player.id).toBe("player-qb-need");
    expect(recommendations[0].reasons).toContain("Fills QB starter need");
  });

  it("prioritizes a tier-drop player over a slightly higher-ranked player", () => {
    const rankings = [
      createRanking("player-wr", 19, "WR"),
      createRanking("player-rb-tier-drop", 20, "RB"),
      createRanking("player-wr-depth-1", 21, "WR"),
      createRanking("player-wr-depth-2", 22, "WR"),
      createRanking("player-rb-next-tier-1", 25, "RB", "player-rb-next-tier-1", {
        tier: 2,
      }),
      createRanking("player-rb-next-tier-2", 26, "RB", "player-rb-next-tier-2", {
        tier: 2,
      }),
    ];
    const recommendations = generateTopRecommendations(rankings, {
      rosterPlayers: [
        { position: "QB" },
        { position: "RB" },
        { position: "RB" },
        { position: "RB" },
        { position: "WR" },
        { position: "WR" },
        { position: "WR" },
        { position: "TE" },
      ],
    });

    expect(recommendations[0].ranking.player.id).toBe("player-rb-tier-drop");
    expect(recommendations[0].reasons).toContain("Tier drop after this RB");
  });

  it("prioritizes a scarce position over a slightly higher-ranked player", () => {
    const rankings = [
      createRanking("player-wr", 19, "WR"),
      createRanking("player-qb-scarce", 20, "QB"),
      createRanking("player-wr-depth-1", 21, "WR"),
      createRanking("player-wr-depth-2", 22, "WR"),
    ];
    const recommendations = generateTopRecommendations(rankings, {
      rosterPlayers: [
        { position: "QB" },
        { position: "RB" },
        { position: "RB" },
        { position: "RB" },
        { position: "WR" },
        { position: "WR" },
        { position: "WR" },
        { position: "TE" },
      ],
    });

    expect(recommendations[0].ranking.player.id).toBe("player-qb-scarce");
    expect(recommendations[0].reasons).toContain("Limited nearby QB options");
  });

  it("includes recommendation reasons from ranking, ADP, and active modifiers", () => {
    const rankings = [
      createRanking("player-rb", 20, "RB", "player-rb", { adpRank: 18 }),
      createRanking("player-rb-next-tier-1", 25, "RB", "player-rb-next-tier-1", {
        tier: 2,
      }),
      createRanking("player-rb-next-tier-2", 26, "RB", "player-rb-next-tier-2", {
        tier: 2,
      }),
    ];
    const [recommendation] = generateTopRecommendations(rankings, {
      rosterPlayers: [{ position: "QB" }],
    });

    expect(recommendation.ranking.player.id).toBe("player-rb");
    expect(recommendation.reasons).toEqual(
      expect.arrayContaining([
        "Ranked #20 overall",
        "ADP rank #18",
        "Fills RB starter need",
        "Tier drop after this RB",
      ]),
    );
  });
});
