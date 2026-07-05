import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  createCandidatePocketSignal,
  createDraftPocket,
  createDraftPocketForecast,
  createDraftPocketProfileTransitions,
} from "@/lib/draftPocketForecast";
import type {
  Draft,
  DraftPocketForecast,
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

function createActiveForecast(
  currentRankings: readonly RecommendationRankingFact[],
  forecastedRankings: readonly RecommendationRankingFact[],
): DraftPocketForecast {
  return {
    status: "active",
    targetPickNumber: 10,
    picksToRemove: 5,
    missingAdpFallback: 100,
    currentBoardPlayerIds: currentRankings.map((ranking) => ranking.player.id),
    removalWindowPlayerIds: [],
    forecastedBoardPlayerIds: forecastedRankings.map((ranking) => ranking.player.id),
    currentPocket: createDraftPocket(currentRankings),
    forecastedPocket: createDraftPocket(forecastedRankings),
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

describe("createDraftPocketProfileTransitions", () => {
  it("groups the Jefferson and London profile around one shared anchor", () => {
    const jefferson = createRanking("justin-jefferson", 9, 10, "WR", {
      overallTier: 2,
    });
    const london = createRanking("drake-london", 11, 18, "WR", {
      overallTier: 2,
    });
    const taylor = createRanking("jonathan-taylor", 10, 8, "RB", {
      overallTier: 2,
    });
    const collins = createRanking("nico-collins", 12, 23, "WR", {
      overallTier: 3,
    });
    const rankings = [collins, london, taylor, jefferson];
    const forecast = createActiveForecast(
      [london, taylor, jefferson],
      [collins, london],
    );

    expect(
      createDraftPocketProfileTransitions({ forecast, rankings }),
    ).toEqual([
      {
        profile: {
          position: "WR",
          overallTierOrigin: "source",
          overallTier: 2,
        },
        anchorPlayerId: "justin-jefferson",
        anchorOverallRank: 9,
        currentPlayerIds: ["justin-jefferson", "drake-london"],
        currentProfileCount: 2,
        forecastedComparablePlayerIds: ["drake-london"],
        forecastedNearPlayerIds: ["nico-collins"],
        forecastedExactProfileCount: 1,
        forecastedComparableCount: 1,
        forecastedNearCount: 1,
        replacementQuality: "medium",
        skipSafety: "medium",
        exactProfileDisappeared: false,
        highestMeaningfulTierDisappeared: false,
      },
      {
        profile: {
          position: "RB",
          overallTierOrigin: "source",
          overallTier: 2,
        },
        anchorPlayerId: "jonathan-taylor",
        anchorOverallRank: 10,
        currentPlayerIds: ["jonathan-taylor"],
        currentProfileCount: 1,
        forecastedComparablePlayerIds: [],
        forecastedNearPlayerIds: [],
        forecastedExactProfileCount: 0,
        forecastedComparableCount: 0,
        forecastedNearCount: 0,
        replacementQuality: "low",
        skipSafety: "low",
        exactProfileDisappeared: true,
        highestMeaningfulTierDisappeared: false,
      },
    ]);
  });

  it("classifies same and better tiers as comparable and worse tiers as near", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const better = createRanking("better-rb", 18, 18, "RB", {
      overallTier: 1,
    });
    const exact = createRanking("exact-rb", 25, 25, "RB", {
      overallTier: 2,
    });
    const nearWithGap = createRanking("near-rb", 26, 26, "RB", {
      overallTier: 9,
    });
    const differentPosition = createRanking("different-wr", 21, 21, "WR", {
      overallTier: 2,
    });
    const transition = createDraftPocketProfileTransitions({
      forecast: createActiveForecast(
        [candidate],
        [nearWithGap, exact, differentPosition, better],
      ),
      rankings: [candidate, better, exact, nearWithGap, differentPosition],
    })[0];

    expect(transition).toMatchObject({
      forecastedComparablePlayerIds: ["better-rb", "exact-rb"],
      forecastedNearPlayerIds: ["near-rb"],
      forecastedExactProfileCount: 1,
      forecastedComparableCount: 2,
      forecastedNearCount: 1,
      replacementQuality: "high",
      skipSafety: "high",
    });
  });

  it("derives medium from near-only depth and low when no option remains", () => {
    const candidateRb = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const candidateTe = createRanking("candidate-te", 21, 21, "TE", {
      overallTier: 2,
    });
    const nearRb = createRanking("near-rb", 25, 25, "RB", {
      overallTier: 3,
    });
    const transitions = createDraftPocketProfileTransitions({
      forecast: createActiveForecast([candidateRb, candidateTe], [nearRb]),
      rankings: [candidateRb, candidateTe, nearRb],
    });

    expect(transitions[0]).toMatchObject({
      anchorPlayerId: "candidate-rb",
      forecastedComparableCount: 0,
      forecastedNearCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
      exactProfileDisappeared: true,
    });
    expect(transitions[1]).toMatchObject({
      anchorPlayerId: "candidate-te",
      forecastedComparableCount: 0,
      forecastedNearCount: 0,
      replacementQuality: "low",
      skipSafety: "low",
      exactProfileDisappeared: true,
    });
  });

  it("uses the shared anchor at rank-window boundaries for every profile member", () => {
    const laterMember = createRanking("later-member", 24, 24, "WR", {
      overallTier: 2,
    });
    const anchor = createRanking("anchor", 20, 20, "WR", {
      overallTier: 2,
    });
    const atBoundary = createRanking("at-boundary", 32, 32, "WR", {
      overallTier: 2,
    });
    const outsideBoundary = createRanking("outside-boundary", 33, 33, "WR", {
      overallTier: 2,
    });
    const transition = createDraftPocketProfileTransitions({
      forecast: createActiveForecast(
        [laterMember, anchor],
        [outsideBoundary, atBoundary],
      ),
      rankings: [laterMember, anchor, atBoundary, outsideBoundary],
    })[0];

    expect(transition).toMatchObject({
      anchorPlayerId: "anchor",
      anchorOverallRank: 20,
      currentPlayerIds: ["anchor", "later-member"],
      forecastedComparablePlayerIds: ["at-boundary"],
      forecastedComparableCount: 1,
      replacementQuality: "medium",
    });
  });

  it("treats defaulted-neutral tiers as position depth only", () => {
    const candidate = createRanking("candidate-wr", 20, 20, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const first = createRanking("first-wr", 25, 25, "WR", {
      overallTier: 8,
      overallTierOrigin: "defaulted-neutral",
    });
    const second = createRanking("second-wr", 32, 32, "WR", {
      overallTier: 9,
      overallTierOrigin: "defaulted-neutral",
    });
    const outside = createRanking("outside-wr", 33, 33, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const transition = createDraftPocketProfileTransitions({
      forecast: createActiveForecast(
        [candidate],
        [outside, second, first],
      ),
      rankings: [candidate, first, second, outside],
    })[0];

    expect(transition).toMatchObject({
      forecastedComparablePlayerIds: ["first-wr", "second-wr"],
      forecastedNearPlayerIds: [],
      forecastedExactProfileCount: 0,
      forecastedComparableCount: 2,
      forecastedNearCount: 0,
      replacementQuality: "high",
      skipSafety: "high",
      exactProfileDisappeared: true,
      highestMeaningfulTierDisappeared: false,
    });
  });

  it("tracks exact-profile and highest-tier disappearance independently", () => {
    const candidate = createRanking("candidate-rb", 10, 10, "RB", {
      overallTier: 1,
    });
    const sameTierOtherPosition = createRanking("tier-peer-wr", 12, 12, "WR", {
      overallTier: 1,
    });
    const lowerTier = createRanking("lower-tier-wr", 18, 18, "WR", {
      overallTier: 2,
    });
    const rankings = [candidate, sameTierOtherPosition, lowerTier];
    const tierRemains = createDraftPocketProfileTransitions({
      forecast: createActiveForecast([candidate], [sameTierOtherPosition]),
      rankings,
    })[0];
    const tierDisappears = createDraftPocketProfileTransitions({
      forecast: createActiveForecast([candidate], [lowerTier]),
      rankings,
    })[0];

    expect(tierRemains).toMatchObject({
      exactProfileDisappeared: true,
      highestMeaningfulTierDisappeared: false,
    });
    expect(tierDisappears).toMatchObject({
      exactProfileDisappeared: true,
      highestMeaningfulTierDisappeared: true,
    });
  });

  it("keeps shared safety independent of which exact member remains forecasted", () => {
    const jefferson = createRanking("justin-jefferson", 9, 10, "WR", {
      overallTier: 2,
    });
    const london = createRanking("drake-london", 11, 18, "WR", {
      overallTier: 2,
    });
    const collins = createRanking("nico-collins", 12, 23, "WR", {
      overallTier: 3,
    });
    const rankings = [jefferson, london, collins];
    const londonRemainsForecast = {
      ...createActiveForecast([jefferson, london], [london, collins]),
      removalWindowPlayerIds: [jefferson.player.id],
    };
    const jeffersonRemainsForecast = {
      ...createActiveForecast([jefferson, london], [jefferson, collins]),
      removalWindowPlayerIds: [london.player.id],
    };
    const londonRemains = createDraftPocketProfileTransitions({
      forecast: londonRemainsForecast,
      rankings,
    })[0];
    const jeffersonRemains = createDraftPocketProfileTransitions({
      forecast: jeffersonRemainsForecast,
      rankings,
    })[0];

    expect(londonRemains).toMatchObject({
      anchorPlayerId: "justin-jefferson",
      currentPlayerIds: ["justin-jefferson", "drake-london"],
      forecastedExactProfileCount: 1,
      forecastedComparableCount: 1,
      forecastedNearCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
    });
    expect(jeffersonRemains).toMatchObject({
      anchorPlayerId: "justin-jefferson",
      currentPlayerIds: ["justin-jefferson", "drake-london"],
      forecastedExactProfileCount: 1,
      forecastedComparableCount: 1,
      forecastedNearCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
    });
  });

  it("returns no transitions for inactive or empty forecasts", () => {
    const candidate = createRanking("candidate", 10, null, "RB", {
      overallTier: 1,
    });
    const active = createActiveForecast([candidate], [candidate]);
    const noAdp: DraftPocketForecast = {
      ...active,
      status: "no-adp",
      forecastedPocket: null,
    };
    const noNextPick: DraftPocketForecast = {
      ...active,
      status: "no-next-pick",
      forecastedPocket: null,
    };

    expect(
      createDraftPocketProfileTransitions({ forecast: noAdp, rankings: [] }),
    ).toEqual([]);
    expect(
      createDraftPocketProfileTransitions({ forecast: noNextPick, rankings: [] }),
    ).toEqual([]);
    expect(
      createDraftPocketProfileTransitions({
        forecast: createActiveForecast([], []),
        rankings: [],
      }),
    ).toEqual([]);
  });

  it("rejects mixed origins and unresolved pocket identities", () => {
    const candidate = createRanking("candidate", 20, 20, "RB", {
      overallTier: 2,
    });
    const mixed = createRanking("mixed", 25, 25, "RB", {
      overallTierOrigin: "defaulted-neutral",
    });
    const mixedForecast = createActiveForecast([candidate], [mixed]);
    const missingForecast: DraftPocketForecast = {
      ...mixedForecast,
      currentPocket: {
        ...mixedForecast.currentPocket,
        playerIds: ["missing-player"],
      },
    };

    expect(() => {
      createDraftPocketProfileTransitions({
        forecast: mixedForecast,
        rankings: [candidate, mixed],
      });
    }).toThrow("mixed overall-tier origins");
    expect(() => {
      createDraftPocketProfileTransitions({
        forecast: missingForecast,
        rankings: [candidate, mixed],
      });
    }).toThrow("missing from ranking context");
  });

  it("uses stable anchors and does not mutate shuffled equivalent inputs", () => {
    const tiedZ = createRanking("tied-z", 10, 10, "TE", {
      overallTier: 2,
    });
    const tiedA = createRanking("tied-a", 10, 10, "TE", {
      overallTier: 2,
    });
    const replacement = createRanking("replacement", 15, 15, "TE", {
      overallTier: 2,
    });
    const rankings = [tiedZ, replacement, tiedA];
    const shuffledRankings = [replacement, tiedA, tiedZ];
    const forecast = createActiveForecast([tiedZ, tiedA], [replacement]);
    const forecastBefore = structuredClone(forecast);
    const rankingsBefore = structuredClone(rankings);

    const first = createDraftPocketProfileTransitions({ forecast, rankings });
    const second = createDraftPocketProfileTransitions({
      forecast,
      rankings: shuffledRankings,
    });

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      anchorPlayerId: "tied-a",
      currentPlayerIds: ["tied-a", "tied-z"],
    });
    expect(forecast).toEqual(forecastBefore);
    expect(rankings).toEqual(rankingsBefore);
  });
});

describe("createCandidatePocketSignal", () => {
  it("projects shared low-safety evidence into full and reduced roles", () => {
    const leader = createRanking("leader-wr", 9, 10, "WR", {
      overallTier: 2,
    });
    const follower = createRanking("follower-wr", 11, 18, "WR", {
      overallTier: 2,
    });
    const rankings = [follower, leader];
    const forecast = createActiveForecast([follower, leader], []);
    const profileTransitions = createDraftPocketProfileTransitions({
      forecast,
      rankings,
    });

    expect(
      createCandidatePocketSignal({
        candidate: leader,
        forecast,
        profileTransitions,
      }),
    ).toEqual({
      candidatePlayerId: "leader-wr",
      candidatePosition: "WR",
      profile: {
        position: "WR",
        overallTierOrigin: "source",
        overallTier: 2,
      },
      profileAnchorPlayerId: "leader-wr",
      profileOrdinal: 1,
      allocationRole: "full",
      candidateInCurrentPocket: true,
      candidateInForecastedPocket: false,
      comparableReplacementCount: 0,
      nearReplacementCount: 0,
      replacementQuality: "low",
      skipSafety: "low",
      currentProfileCount: 2,
      forecastedProfileCount: 0,
      profileDisappeared: true,
      highestMeaningfulTierDisappeared: true,
    });
    expect(
      createCandidatePocketSignal({
        candidate: follower,
        forecast,
        profileTransitions,
      }),
    ).toMatchObject({
      profileAnchorPlayerId: "leader-wr",
      profileOrdinal: 2,
      allocationRole: "reduced",
      comparableReplacementCount: 0,
      nearReplacementCount: 0,
      replacementQuality: "low",
      skipSafety: "low",
      currentProfileCount: 2,
      forecastedProfileCount: 0,
      profileDisappeared: true,
      highestMeaningfulTierDisappeared: true,
    });
  });

  it("gives one shared medium-safety transition only to the profile leader", () => {
    const jefferson = createRanking("justin-jefferson", 9, 10, "WR", {
      overallTier: 2,
    });
    const london = createRanking("drake-london", 11, 18, "WR", {
      overallTier: 2,
    });
    const collins = createRanking("nico-collins", 12, 23, "WR", {
      overallTier: 3,
    });
    const rankings = [jefferson, london, collins];
    const forecast = createActiveForecast(
      [jefferson, london],
      [london, collins],
    );
    const profileTransitions = createDraftPocketProfileTransitions({
      forecast,
      rankings,
    });
    const jeffersonSignal = createCandidatePocketSignal({
      candidate: jefferson,
      forecast,
      profileTransitions,
    });
    const londonSignal = createCandidatePocketSignal({
      candidate: london,
      forecast,
      profileTransitions,
    });

    expect(jeffersonSignal).toMatchObject({
      profileAnchorPlayerId: "justin-jefferson",
      profileOrdinal: 1,
      allocationRole: "full",
      candidateInForecastedPocket: false,
      comparableReplacementCount: 1,
      nearReplacementCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
      currentProfileCount: 2,
      forecastedProfileCount: 1,
      profileDisappeared: false,
    });
    expect(londonSignal).toMatchObject({
      profileAnchorPlayerId: "justin-jefferson",
      profileOrdinal: 2,
      allocationRole: "neutral",
      candidateInForecastedPocket: true,
      comparableReplacementCount: 1,
      nearReplacementCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
      currentProfileCount: 2,
      forecastedProfileCount: 1,
      profileDisappeared: false,
    });
  });

  it("keeps every member neutral when shared skip safety is high", () => {
    const leader = createRanking("leader-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const follower = createRanking("follower-rb", 22, 22, "RB", {
      overallTier: 2,
    });
    const first = createRanking("first-rb", 25, 25, "RB", {
      overallTier: 2,
    });
    const second = createRanking("second-rb", 30, 30, "RB", {
      overallTier: 1,
    });
    const rankings = [leader, follower, first, second];
    const forecast = createActiveForecast(
      [leader, follower],
      [first, second],
    );
    const profileTransitions = createDraftPocketProfileTransitions({
      forecast,
      rankings,
    });

    for (const candidate of [leader, follower]) {
      expect(
        createCandidatePocketSignal({
          candidate,
          forecast,
          profileTransitions,
        }),
      ).toMatchObject({
        allocationRole: "neutral",
        comparableReplacementCount: 2,
        replacementQuality: "high",
        skipSafety: "high",
      });
    }
  });

  it("returns structural neutral evidence for inactive and outside candidates", () => {
    const candidate = createRanking("candidate-rb", 10, null, "RB", {
      overallTier: 1,
    });
    const outside = createRanking("outside-wr", 30, null, "WR", {
      overallTier: 2,
    });
    const activeForecast = createActiveForecast([candidate], [outside]);
    const neutralForecast: DraftPocketForecast = {
      ...activeForecast,
      status: "no-adp",
      forecastedPocket: null,
      forecastedBoardPlayerIds: [],
    };

    expect(
      createCandidatePocketSignal({
        candidate,
        forecast: neutralForecast,
        profileTransitions: [],
      }),
    ).toMatchObject({
      profile: {
        position: "RB",
        overallTierOrigin: "source",
        overallTier: 1,
      },
      profileAnchorPlayerId: null,
      profileOrdinal: null,
      allocationRole: "neutral",
      candidateInCurrentPocket: true,
      candidateInForecastedPocket: false,
      replacementQuality: "neutral",
      skipSafety: "neutral",
      currentProfileCount: 0,
      forecastedProfileCount: 0,
    });
    expect(
      createCandidatePocketSignal({
        candidate: outside,
        forecast: activeForecast,
        profileTransitions: createDraftPocketProfileTransitions({
          forecast: activeForecast,
          rankings: [candidate, outside],
        }),
      }),
    ).toMatchObject({
      profile: {
        position: "WR",
        overallTierOrigin: "source",
        overallTier: 2,
      },
      profileAnchorPlayerId: null,
      profileOrdinal: null,
      allocationRole: "neutral",
      candidateInCurrentPocket: false,
      candidateInForecastedPocket: true,
      replacementQuality: "neutral",
      skipSafety: "neutral",
    });
  });

  it("promotes the next profile member when the leader becomes unavailable", () => {
    const leader = createRanking("leader-wr", 9, 10, "WR", {
      overallTier: 2,
    });
    const follower = createRanking("follower-wr", 11, 18, "WR", {
      overallTier: 2,
    });
    const rankings = [leader, follower];
    const beforeForecast = createActiveForecast([leader, follower], []);
    const afterForecast = createActiveForecast([follower], []);
    const before = createCandidatePocketSignal({
      candidate: follower,
      forecast: beforeForecast,
      profileTransitions: createDraftPocketProfileTransitions({
        forecast: beforeForecast,
        rankings,
      }),
    });
    const after = createCandidatePocketSignal({
      candidate: follower,
      forecast: afterForecast,
      profileTransitions: createDraftPocketProfileTransitions({
        forecast: afterForecast,
        rankings,
      }),
    });

    expect(before).toMatchObject({
      profileAnchorPlayerId: "leader-wr",
      profileOrdinal: 2,
      allocationRole: "reduced",
    });
    expect(after).toMatchObject({
      profileAnchorPlayerId: "follower-wr",
      profileOrdinal: 1,
      allocationRole: "full",
    });
  });

  it("fails when an active current candidate lacks one matching transition", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const forecast = createActiveForecast([candidate], []);
    const [transition] = createDraftPocketProfileTransitions({
      forecast,
      rankings: [candidate],
    });

    expect(() => {
      createCandidatePocketSignal({
        candidate,
        forecast,
        profileTransitions: [],
      });
    }).toThrow("must resolve to exactly one");
    expect(() => {
      createCandidatePocketSignal({
        candidate,
        forecast,
        profileTransitions: [transition, transition],
      });
    }).toThrow("must resolve to exactly one");
    expect(() => {
      createCandidatePocketSignal({
        candidate,
        forecast,
        profileTransitions: [
          {
            ...transition,
            currentPlayerIds: [candidate.player.id, candidate.player.id],
          },
        ],
      });
    }).toThrow("must appear exactly once");
    expect(() => {
      createCandidatePocketSignal({
        candidate,
        forecast,
        profileTransitions: [
          {
            ...transition,
            profile: { ...transition.profile, overallTier: 3 },
          },
        ],
      });
    }).toThrow("does not match its draft-pocket profile transition");
  });

  it("uses stable profile ordinals and does not mutate inputs", () => {
    const tiedZ = createRanking("tied-z", 10, 10, "TE", {
      overallTier: 2,
    });
    const tiedA = createRanking("tied-a", 10, 10, "TE", {
      overallTier: 2,
    });
    const rankings = [tiedZ, tiedA];
    const forecast = createActiveForecast([tiedZ, tiedA], []);
    const profileTransitions = createDraftPocketProfileTransitions({
      forecast,
      rankings,
    });
    const forecastBefore = structuredClone(forecast);
    const transitionsBefore = structuredClone(profileTransitions);
    const candidateBefore = structuredClone(tiedZ);

    const first = createCandidatePocketSignal({
      candidate: tiedA,
      forecast,
      profileTransitions,
    });
    const second = createCandidatePocketSignal({
      candidate: tiedZ,
      forecast,
      profileTransitions,
    });

    expect(first).toMatchObject({
      profileAnchorPlayerId: "tied-a",
      profileOrdinal: 1,
      allocationRole: "full",
    });
    expect(second).toMatchObject({
      profileAnchorPlayerId: "tied-a",
      profileOrdinal: 2,
      allocationRole: "reduced",
    });
    expect(forecast).toEqual(forecastBefore);
    expect(profileTransitions).toEqual(transitionsBefore);
    expect(tiedZ).toEqual(candidateBefore);
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
