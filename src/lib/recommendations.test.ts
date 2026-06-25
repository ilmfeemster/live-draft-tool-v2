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
): RankingEntry {
  return {
    player: {
      id,
      name,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank: null,
    positionRank: overallRank,
    tier: 1,
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
});
