import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { createDraftPocketForecast } from "@/lib/draftPocketForecast";
import type {
  Draft,
  Position,
  RecommendationRankingFact,
} from "@/types/draft";

function createRanking(
  id: string,
  overallRank: number,
  adpRank: number | null,
  position: Position = "RB",
): RecommendationRankingFact {
  return {
    player: {
      id,
      name: id,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank,
    positionRank: overallRank,
    tier: 1,
    overallTier: 1,
    overallTierOrigin: "source",
  };
}

function createDraft({
  teamCount = 2,
  rounds = 4,
  userTeamId = "team-1",
  currentPickNumber = 1,
  draftedPlayers = {},
}: {
  teamCount?: number;
  rounds?: number;
  userTeamId?: string;
  currentPickNumber?: number;
  draftedPlayers?: Readonly<Record<number, string>>;
} = {}): Draft {
  const picks = generateSnakeDraftOrder(teamCount, rounds).map((pick) => {
    const playerId = draftedPlayers[pick.pickNumber];

    return playerId ? { ...pick, playerId } : pick;
  });

  return {
    id: "forecast-draft",
    teamCount,
    rounds,
    userTeamId,
    currentPickNumber,
    teams: createDraftTeams(teamCount),
    picks,
  };
}

describe("createDraftPocketForecast", () => {
  it("targets the following user pick on turn and includes the current selection", () => {
    const draft = createDraft({ currentPickNumber: 1 });
    const rankings = [
      createRanking("rank-4", 4, 4),
      createRanking("rank-2", 2, 2),
      createRanking("rank-5", 5, 5),
      createRanking("rank-1", 1, 1),
      createRanking("rank-3", 3, 3),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toEqual({
      status: "active",
      targetPickNumber: 4,
      picksToRemove: 3,
      missingAdpFallback: 6,
      currentBoardPlayerIds: ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"],
      removalWindowPlayerIds: ["rank-1", "rank-2", "rank-3"],
      forecastedBoardPlayerIds: ["rank-4", "rank-5"],
    });
  });

  it("targets the upcoming user pick between turns", () => {
    const draft = createDraft({ currentPickNumber: 2 });
    const rankings = [
      createRanking("first", 1, 1),
      createRanking("second", 2, 2),
      createRanking("third", 3, 3),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toMatchObject({
      status: "active",
      targetPickNumber: 4,
      picksToRemove: 2,
      removalWindowPlayerIds: ["first", "second"],
      forecastedBoardPlayerIds: ["third"],
    });
  });

  it("derives a one-pick turn for a user in a non-default draft position", () => {
    const draft = createDraft({
      teamCount: 3,
      rounds: 3,
      userTeamId: "team-3",
      currentPickNumber: 3,
    });
    const rankings = [
      createRanking("removed", 2, 1),
      createRanking("remaining", 1, 2),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toMatchObject({
      targetPickNumber: 4,
      picksToRemove: 1,
      removalWindowPlayerIds: ["removed"],
      forecastedBoardPlayerIds: ["remaining"],
    });
  });

  it("uses the complete snapshot maximum for missing ADP and excludes drafted players", () => {
    const draft = createDraft({
      currentPickNumber: 2,
      draftedPlayers: { 1: "drafted-max" },
    });
    const rankings = [
      createRanking("drafted-max", 1, 100.5),
      createRanking("missing", 2, null),
      createRanking("early", 3, 1.5),
      createRanking("middle", 4, 50.25),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toEqual({
      status: "active",
      targetPickNumber: 4,
      picksToRemove: 2,
      missingAdpFallback: 101.5,
      currentBoardPlayerIds: ["missing", "early", "middle"],
      removalWindowPlayerIds: ["early", "middle"],
      forecastedBoardPlayerIds: ["missing"],
    });
  });

  it("resolves tied fractional ADP by overall rank and stable player ID", () => {
    const draft = createDraft({ currentPickNumber: 1 });
    const rankings = [
      createRanking("same-rank-z", 1, 2.5),
      createRanking("same-rank-a", 1, 2.5),
      createRanking("later-rank", 2, 2.5),
      createRanking("forecasted", 4, 8.75),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toMatchObject({
      missingAdpFallback: 9.75,
      removalWindowPlayerIds: ["same-rank-a", "same-rank-z", "later-rank"],
      forecastedBoardPlayerIds: ["forecasted"],
    });
  });

  it("returns a neutral no-ADP forecast while preserving target metadata", () => {
    const draft = createDraft({ currentPickNumber: 2 });
    const rankings = [
      createRanking("rank-2", 2, null),
      createRanking("rank-1", 1, null),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toEqual({
      status: "no-adp",
      targetPickNumber: 4,
      picksToRemove: 2,
      missingAdpFallback: null,
      currentBoardPlayerIds: ["rank-1", "rank-2"],
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
    });
  });

  it("returns no next pick on the user's final turn before considering ADP", () => {
    const draft = createDraft({
      rounds: 2,
      currentPickNumber: 4,
      draftedPlayers: {
        1: "drafted-1",
        2: "drafted-2",
        3: "drafted-3",
      },
    });
    const rankings = [
      createRanking("drafted-1", 1, 1),
      createRanking("drafted-2", 2, 2),
      createRanking("drafted-3", 3, 3),
      createRanking("final-option", 4, 4),
    ];

    expect(
      createDraftPocketForecast({
        draft,
        rankings,
        userTeamId: draft.userTeamId,
      }),
    ).toEqual({
      status: "no-next-pick",
      targetPickNumber: null,
      picksToRemove: null,
      missingAdpFallback: null,
      currentBoardPlayerIds: ["final-option"],
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
    });
  });

  it("does not mutate inputs and returns equivalent output for equivalent calls", () => {
    const draft = createDraft({ currentPickNumber: 2 });
    const rankings = [
      createRanking("first", 1, 1.25),
      createRanking("second", 2, null),
      createRanking("third", 3, 3.5),
    ];
    const draftBefore = structuredClone(draft);
    const rankingsBefore = structuredClone(rankings);

    const first = createDraftPocketForecast({
      draft,
      rankings,
      userTeamId: draft.userTeamId,
    });
    const second = createDraftPocketForecast({
      draft,
      rankings,
      userTeamId: draft.userTeamId,
    });

    expect(second).toEqual(first);
    expect(draft).toEqual(draftBefore);
    expect(rankings).toEqual(rankingsBefore);
  });
});
