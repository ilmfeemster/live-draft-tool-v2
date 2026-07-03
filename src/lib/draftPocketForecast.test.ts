import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  createDraftPocket,
  createDraftPocketForecast,
} from "@/lib/draftPocketForecast";
import type {
  Draft,
  Position,
  RecommendationOverallTierOrigin,
  RecommendationRankingFact,
} from "@/types/draft";

function createRanking(
  id: string,
  overallRank: number,
  adpRank: number | null,
  position: Position = "RB",
  options: {
    overallTier?: number;
    overallTierOrigin?: RecommendationOverallTierOrigin;
  } = {},
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
    overallTier: options.overallTier ?? 1,
    overallTierOrigin: options.overallTierOrigin ?? "source",
  };
}

function createPositionCounts(
  overrides: Partial<Record<Position, number>> = {},
): Record<Position, number> {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    DST: 0,
    K: 0,
    ...overrides,
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

describe("createDraftPocket", () => {
  it("returns a safe empty pocket", () => {
    expect(createDraftPocket([])).toEqual({
      playerIds: [],
      highestMeaningfulOverallTier: null,
      overallTierCounts: [],
      positionCounts: createPositionCounts(),
      diversityLabels: ["thin", "mixed"],
    });
  });

  it("returns every player below six and exactly six at the minimum", () => {
    const rankings = [
      createRanking("rank-5", 5, 5, "K"),
      createRanking("rank-2", 2, 2, "WR"),
      createRanking("rank-1", 1, 1, "RB"),
      createRanking("rank-4", 4, 4, "TE"),
      createRanking("rank-3", 3, 3, "QB"),
      createRanking("rank-6", 6, 6, "DST"),
    ];

    expect(createDraftPocket(rankings.slice(0, 5)).playerIds).toHaveLength(5);
    expect(createDraftPocket(rankings).playerIds).toEqual([
      "rank-1",
      "rank-2",
      "rank-3",
      "rank-4",
      "rank-5",
      "rank-6",
    ]);
  });

  it("extends through the sixth player's supplied tier and stops at a new tier", () => {
    const extendedRankings = Array.from({ length: 8 }, (_, index) => {
      const overallRank = index + 1;
      const overallTier = overallRank <= 5 ? 1 : overallRank <= 7 ? 2 : 3;

      return createRanking(`rank-${overallRank}`, overallRank, overallRank, "RB", {
        overallTier,
      });
    });
    const stoppedRankings = extendedRankings.map((ranking) => {
      return ranking.overallRank === 7
        ? { ...ranking, overallTier: 3 }
        : ranking;
    });

    expect(createDraftPocket(extendedRankings).playerIds).toEqual([
      "rank-1",
      "rank-2",
      "rank-3",
      "rank-4",
      "rank-5",
      "rank-6",
      "rank-7",
    ]);
    expect(createDraftPocket(stoppedRankings).playerIds).toEqual([
      "rank-1",
      "rank-2",
      "rank-3",
      "rank-4",
      "rank-5",
      "rank-6",
    ]);
  });

  it("caps a long sixth-player tier at twelve", () => {
    const rankings = Array.from({ length: 14 }, (_, index) => {
      const overallRank = index + 1;

      return createRanking(`rank-${overallRank}`, overallRank, overallRank, "WR", {
        overallTier: overallRank <= 5 ? 1 : 2,
      });
    });

    expect(createDraftPocket(rankings.slice(0, 12)).playerIds).toHaveLength(12);
    expect(createDraftPocket(rankings).playerIds).toEqual(
      Array.from({ length: 12 }, (_, index) => `rank-${index + 1}`),
    );
  });

  it("does not extend a defaulted-neutral tier", () => {
    const rankings = Array.from({ length: 7 }, (_, index) => {
      const overallRank = index + 1;

      return createRanking(`rank-${overallRank}`, overallRank, overallRank, "RB", {
        overallTierOrigin: "defaulted-neutral",
      });
    });

    expect(createDraftPocket(rankings)).toEqual({
      playerIds: ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5", "rank-6"],
      highestMeaningfulOverallTier: null,
      overallTierCounts: [
        {
          overallTier: 1,
          overallTierOrigin: "defaulted-neutral",
          count: 6,
        },
      ],
      positionCounts: createPositionCounts({ RB: 6 }),
      diversityLabels: ["RB-heavy"],
    });
  });

  it("returns deterministic tier and complete position counts", () => {
    const rankings = [
      createRanking("tier-2-qb", 1, 1, "QB", { overallTier: 2 }),
      createRanking("neutral-rb", 2, 2, "RB", {
        overallTier: 1,
        overallTierOrigin: "defaulted-neutral",
      }),
      createRanking("tier-1-wr", 3, 3, "WR", { overallTier: 1 }),
      createRanking("neutral-te", 4, 4, "TE", {
        overallTier: 1,
        overallTierOrigin: "defaulted-neutral",
      }),
      createRanking("tier-2-dst", 5, 5, "DST", { overallTier: 2 }),
      createRanking("tier-1-k", 6, 6, "K", { overallTier: 1 }),
    ];

    expect(createDraftPocket(rankings)).toEqual({
      playerIds: [
        "tier-2-qb",
        "neutral-rb",
        "tier-1-wr",
        "neutral-te",
        "tier-2-dst",
        "tier-1-k",
      ],
      highestMeaningfulOverallTier: 1,
      overallTierCounts: [
        { overallTier: 1, overallTierOrigin: "source", count: 2 },
        {
          overallTier: 1,
          overallTierOrigin: "defaulted-neutral",
          count: 2,
        },
        { overallTier: 2, overallTierOrigin: "source", count: 2 },
      ],
      positionCounts: createPositionCounts({
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 1,
        DST: 1,
        K: 1,
      }),
      diversityLabels: ["balanced"],
    });
  });

  it.each([
    {
      label: "WR-heavy",
      positions: ["WR", "WR", "WR", "WR", "RB", "RB"] as Position[],
    },
    {
      label: "RB-heavy",
      positions: ["RB", "RB", "RB", "RB", "WR", "WR"] as Position[],
    },
    {
      label: "onesie-heavy",
      positions: ["QB", "QB", "TE", "TE", "RB", "WR"] as Position[],
    },
    {
      label: "balanced",
      positions: ["RB", "RB", "WR", "WR", "QB", "QB"] as Position[],
    },
    {
      label: "mixed",
      positions: ["RB", "RB", "RB", "WR", "WR", "WR"] as Position[],
    },
  ])("derives the $label shape at strict-majority boundaries", ({ label, positions }) => {
    const rankings = positions.map((position, index) => {
      const overallRank = index + 1;

      return createRanking(`rank-${overallRank}`, overallRank, overallRank, position);
    });

    expect(createDraftPocket(rankings).diversityLabels).toEqual([label]);
  });
});

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
      currentPocket: {
        playerIds: ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 5 },
        ],
        positionCounts: createPositionCounts({ RB: 5 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
      forecastedPocket: {
        playerIds: ["rank-4", "rank-5"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 2 },
        ],
        positionCounts: createPositionCounts({ RB: 2 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
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
      currentPocket: {
        playerIds: ["missing", "early", "middle"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 3 },
        ],
        positionCounts: createPositionCounts({ RB: 3 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
      forecastedPocket: {
        playerIds: ["missing"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 1 },
        ],
        positionCounts: createPositionCounts({ RB: 1 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
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
      currentPocket: {
        playerIds: ["rank-1", "rank-2"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 2 },
        ],
        positionCounts: createPositionCounts({ RB: 2 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
      forecastedPocket: null,
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
      currentPocket: {
        playerIds: ["final-option"],
        highestMeaningfulOverallTier: 1,
        overallTierCounts: [
          { overallTier: 1, overallTierOrigin: "source", count: 1 },
        ],
        positionCounts: createPositionCounts({ RB: 1 }),
        diversityLabels: ["thin", "RB-heavy"],
      },
      forecastedPocket: null,
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
