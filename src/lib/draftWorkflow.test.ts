import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { generateTopRecommendations } from "@/lib/recommendations";
import type { Draft, Position, RankingEntry, UserRosterPlayer } from "@/types/draft";

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
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
    teamCount: 3,
    rounds: 2,
    userTeamId: "team-2",
    currentPickNumber: 1,
    teams: createDraftTeams(3),
    picks: generateSnakeDraftOrder(3, 2),
    ...overrides,
  };
}

function getAvailableRankings(rankings: RankingEntry[], draft: Draft) {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return rankings.filter((ranking) => !draftedPlayerIds.has(ranking.player.id));
}

function getUserRosterPlayers(rankings: RankingEntry[], draft: Draft): UserRosterPlayer[] {
  return draft.picks
    .filter((pick) => pick.teamId === draft.userTeamId && pick.playerId)
    .map((pick) => {
      const ranking = rankings.find((entry) => entry.player.id === pick.playerId);

      if (!ranking) {
        return undefined;
      }

      return {
        pickNumber: pick.pickNumber,
        name: ranking.player.name,
        team: ranking.player.team,
        position: ranking.player.position,
      };
    })
    .filter((player): player is UserRosterPlayer => Boolean(player))
    .sort((a, b) => a.pickNumber - b.pickNumber);
}

function getRecommendationPlayerIds(recommendations: ReturnType<typeof generateTopRecommendations>) {
  return recommendations.map((recommendation) => recommendation.ranking.player.id);
}

function getRankingPlayerIds(rankings: RankingEntry[]) {
  return rankings.map((ranking) => ranking.player.id);
}

describe("draft workflow", () => {
  it("updates available players, user roster, and recommendations through a small manual draft", () => {
    const rankings = [
      createRanking("player-rb-1", 1, "RB"),
      createRanking("player-qb-user", 2, "QB"),
      createRanking("player-wr-1", 3, "WR"),
      createRanking("player-te-1", 4, "TE"),
      createRanking("player-rb-user", 5, "RB"),
      createRanking("player-wr-2", 6, "WR"),
    ];
    const initialDraft = createTestDraft();
    const initialAvailableRankings = getAvailableRankings(rankings, initialDraft);
    const initialUserRosterPlayers = getUserRosterPlayers(rankings, initialDraft);
    const initialRecommendationPlayerIds = getRecommendationPlayerIds(
      generateTopRecommendations(initialAvailableRankings, {
        rosterPlayers: initialUserRosterPlayers,
      }),
    );

    expect(initialDraft.currentPickNumber).toBe(1);
    expect(getRankingPlayerIds(initialAvailableRankings)).toEqual(
      getRankingPlayerIds(rankings),
    );
    expect(initialRecommendationPlayerIds[0]).toBe("player-rb-1");
    expect(initialUserRosterPlayers).toEqual([]);

    const afterPick1 = draftPlayerInDraft(initialDraft, "player-rb-1");
    const afterPick2 = draftPlayerInDraft(afterPick1, "player-qb-user");
    const afterPick3 = draftPlayerInDraft(afterPick2, "player-wr-1");
    const availableAfterPick3 = getAvailableRankings(rankings, afterPick3);
    const userRosterAfterPick3 = getUserRosterPlayers(rankings, afterPick3);
    const recommendationPlayerIdsAfterPick3 = getRecommendationPlayerIds(
      generateTopRecommendations(availableAfterPick3, {
        rosterPlayers: userRosterAfterPick3,
      }),
    );

    expect(afterPick3.currentPickNumber).toBe(4);
    expect(getRankingPlayerIds(availableAfterPick3)).toEqual([
      "player-te-1",
      "player-rb-user",
      "player-wr-2",
    ]);
    expect(userRosterAfterPick3).toEqual([
      {
        pickNumber: 2,
        name: "player-qb-user",
        team: "TEST",
        position: "QB",
      },
    ]);
    expect(recommendationPlayerIdsAfterPick3).not.toEqual(
      expect.arrayContaining(["player-rb-1", "player-qb-user", "player-wr-1"]),
    );
    expect(recommendationPlayerIdsAfterPick3).toEqual(
      expect.arrayContaining(getRankingPlayerIds(availableAfterPick3)),
    );

    const afterPick4 = draftPlayerInDraft(afterPick3, "player-te-1");
    const afterPick5 = draftPlayerInDraft(afterPick4, "player-rb-user");
    const availableAfterPick5 = getAvailableRankings(rankings, afterPick5);
    const userRosterAfterPick5 = getUserRosterPlayers(rankings, afterPick5);
    const recommendationPlayerIdsAfterPick5 = getRecommendationPlayerIds(
      generateTopRecommendations(availableAfterPick5, {
        rosterPlayers: userRosterAfterPick5,
      }),
    );

    expect(afterPick5.currentPickNumber).toBe(6);
    expect(getRankingPlayerIds(availableAfterPick5)).toEqual(["player-wr-2"]);
    expect(userRosterAfterPick5).toEqual([
      {
        pickNumber: 2,
        name: "player-qb-user",
        team: "TEST",
        position: "QB",
      },
      {
        pickNumber: 5,
        name: "player-rb-user",
        team: "TEST",
        position: "RB",
      },
    ]);
    expect(recommendationPlayerIdsAfterPick5).toEqual(["player-wr-2"]);
  });

  it("completes a small draft with a valid final state", () => {
    const rankings = [
      createRanking("player-rb-1", 1, "RB"),
      createRanking("player-qb-user", 2, "QB"),
      createRanking("player-wr-1", 3, "WR"),
      createRanking("player-te-1", 4, "TE"),
      createRanking("player-rb-user", 5, "RB"),
      createRanking("player-wr-2", 6, "WR"),
    ];
    const completedDraft = rankings.reduce((draft, ranking) => {
      return draftPlayerInDraft(draft, ranking.player.id);
    }, createTestDraft());
    const availableRankings = getAvailableRankings(rankings, completedDraft);
    const recommendations = generateTopRecommendations(availableRankings, {
      rosterPlayers: getUserRosterPlayers(rankings, completedDraft),
    });

    expect(completedDraft.currentPickNumber).toBe(6);
    expect(completedDraft.picks).toHaveLength(6);
    expect(completedDraft.picks.every((pick) => Boolean(pick.playerId))).toBe(true);
    expect(new Set(completedDraft.picks.map((pick) => pick.playerId))).toHaveLength(6);
    expect(isValidDraftState({ draft: completedDraft, availableRankings })).toBe(true);
    expect(availableRankings).toEqual([]);
    expect(recommendations).toEqual([]);
  });
});
