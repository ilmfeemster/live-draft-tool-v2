import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  createCandidatePocketSignal,
  createDraftPocket,
  createDraftPocketForecast,
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

describe("createCandidatePocketSignal", () => {
  it("classifies same and better source-tier options as comparable replacements", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const sameTier = createRanking("same-tier-rb", 25, 25, "RB", {
      overallTier: 2,
    });
    const betterTier = createRanking("better-tier-rb", 18, 18, "RB", {
      overallTier: 1,
    });
    const rankings = [candidate, sameTier, betterTier];
    const forecast = createActiveForecast([candidate], [sameTier, betterTier]);

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toEqual({
      candidatePlayerId: "candidate-rb",
      candidatePosition: "RB",
      candidateInCurrentPocket: true,
      candidateInForecastedPocket: false,
      comparableReplacementCount: 2,
      nearReplacementCount: 0,
      replacementQuality: "high",
      skipSafety: "high",
      currentProfileCount: 1,
      forecastedProfileCount: 1,
      profileDisappeared: false,
      highestMeaningfulTierDisappeared: false,
    });
  });

  it("classifies a worse source tier as a near replacement", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const near = createRanking("near-rb", 25, 25, "RB", { overallTier: 3 });
    const rankings = [candidate, near];
    const forecast = createActiveForecast([candidate], [near]);

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toMatchObject({
      comparableReplacementCount: 0,
      nearReplacementCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
      forecastedProfileCount: 0,
      profileDisappeared: true,
      highestMeaningfulTierDisappeared: true,
    });
  });

  it("includes rank distance twelve and excludes rank distance thirteen", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const atBoundary = createRanking("boundary-rb", 32, 32, "RB", {
      overallTier: 2,
    });
    const outsideBoundary = createRanking("outside-rb", 33, 33, "RB", {
      overallTier: 2,
    });
    const rankings = [candidate, atBoundary, outsideBoundary];
    const forecast = createActiveForecast(
      [candidate],
      [atBoundary, outsideBoundary],
    );

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toMatchObject({
      comparableReplacementCount: 1,
      nearReplacementCount: 0,
      replacementQuality: "medium",
      skipSafety: "medium",
    });
  });

  it("keeps skip safety medium when the candidate remains without a replacement", () => {
    const candidate = createRanking("candidate-te", 20, 20, "TE", {
      overallTier: 2,
    });
    const rankings = [candidate];
    const forecast = createActiveForecast([candidate], [candidate]);

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toMatchObject({
      candidateInForecastedPocket: true,
      comparableReplacementCount: 0,
      nearReplacementCount: 0,
      replacementQuality: "low",
      skipSafety: "medium",
      currentProfileCount: 1,
      forecastedProfileCount: 1,
      profileDisappeared: false,
    });
  });

  it("uses position and rank proximity for defaulted-neutral replacements", () => {
    const candidate = createRanking("candidate-wr", 20, 20, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const nearbyOne = createRanking("nearby-wr-1", 25, 25, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const nearbyTwo = createRanking("nearby-wr-2", 32, 32, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const distant = createRanking("distant-wr", 33, 33, "WR", {
      overallTierOrigin: "defaulted-neutral",
    });
    const rankings = [candidate, nearbyOne, nearbyTwo, distant];
    const forecast = createActiveForecast(
      [candidate],
      [nearbyOne, nearbyTwo, distant],
    );

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toMatchObject({
      comparableReplacementCount: 2,
      nearReplacementCount: 0,
      replacementQuality: "high",
      skipSafety: "high",
      currentProfileCount: 1,
      forecastedProfileCount: 2,
      highestMeaningfulTierDisappeared: false,
    });
  });

  it("reports disappearing profile and highest meaningful tier evidence", () => {
    const candidate = createRanking("candidate-rb", 10, 10, "RB", {
      overallTier: 1,
    });
    const sameProfile = createRanking("same-profile-rb", 15, 15, "RB", {
      overallTier: 1,
    });
    const currentTierPeer = createRanking("tier-peer-wr", 12, 12, "WR", {
      overallTier: 1,
    });
    const lowerTier = createRanking("lower-tier-wr", 18, 18, "WR", {
      overallTier: 2,
    });
    const rankings = [candidate, sameProfile, currentTierPeer, lowerTier];
    const forecast = createActiveForecast(
      [candidate, sameProfile, currentTierPeer],
      [lowerTier],
    );

    expect(createCandidatePocketSignal({ candidate, forecast, rankings })).toEqual({
      candidatePlayerId: "candidate-rb",
      candidatePosition: "RB",
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
  });

  it("returns neutral evidence for neutral forecasts and candidates outside the current pocket", () => {
    const candidate = createRanking("candidate-rb", 10, null, "RB", {
      overallTier: 1,
    });
    const outside = createRanking("outside-wr", 30, null, "WR", {
      overallTier: 2,
    });
    const rankings = [candidate, outside];
    const activeForecast = createActiveForecast([candidate], [outside]);
    const neutralForecast: DraftPocketForecast = {
      ...activeForecast,
      status: "no-adp",
      forecastedPocket: null,
      forecastedBoardPlayerIds: [],
    };

    expect(
      createCandidatePocketSignal({ candidate, forecast: neutralForecast, rankings }),
    ).toMatchObject({
      candidateInCurrentPocket: true,
      replacementQuality: "neutral",
      skipSafety: "neutral",
      currentProfileCount: 1,
      forecastedProfileCount: 0,
      profileDisappeared: false,
      highestMeaningfulTierDisappeared: false,
    });
    expect(
      createCandidatePocketSignal({ candidate: outside, forecast: activeForecast, rankings }),
    ).toMatchObject({
      candidateInCurrentPocket: false,
      candidateInForecastedPocket: false,
      replacementQuality: "neutral",
      skipSafety: "neutral",
      currentProfileCount: 0,
      forecastedProfileCount: 0,
    });
  });

  it("derives deep-WR and disappearing-RB behavior without position-specific weights", () => {
    const candidateWr = createRanking("candidate-wr", 20, 20, "WR", {
      overallTier: 2,
    });
    const candidateRb = createRanking("candidate-rb", 21, 21, "RB", {
      overallTier: 2,
    });
    const replacementWrOne = createRanking("replacement-wr-1", 25, 25, "WR", {
      overallTier: 2,
    });
    const replacementWrTwo = createRanking("replacement-wr-2", 30, 30, "WR", {
      overallTier: 3,
    });
    const rankings = [
      candidateWr,
      candidateRb,
      replacementWrOne,
      replacementWrTwo,
    ];
    const forecast = createActiveForecast(
      [candidateWr, candidateRb],
      [replacementWrOne, replacementWrTwo],
    );

    expect(
      createCandidatePocketSignal({ candidate: candidateWr, forecast, rankings }),
    ).toMatchObject({
      replacementQuality: "high",
      skipSafety: "high",
    });
    expect(
      createCandidatePocketSignal({ candidate: candidateRb, forecast, rankings }),
    ).toMatchObject({
      replacementQuality: "low",
      skipSafety: "low",
    });
  });

  it("treats both-deep and both-thin RB/WR scenarios through the same rules", () => {
    const candidateWr = createRanking("candidate-wr", 20, 20, "WR", {
      overallTier: 2,
    });
    const candidateRb = createRanking("candidate-rb", 21, 21, "RB", {
      overallTier: 2,
    });
    const deepReplacements = [
      createRanking("wr-1", 25, 25, "WR", { overallTier: 2 }),
      createRanking("wr-2", 30, 30, "WR", { overallTier: 3 }),
      createRanking("rb-1", 26, 26, "RB", { overallTier: 2 }),
      createRanking("rb-2", 31, 31, "RB", { overallTier: 3 }),
    ];
    const rankings = [candidateWr, candidateRb, ...deepReplacements];
    const bothDeep = createActiveForecast(
      [candidateWr, candidateRb],
      deepReplacements,
    );
    const bothThin = createActiveForecast([candidateWr, candidateRb], []);

    for (const candidate of [candidateWr, candidateRb]) {
      expect(
        createCandidatePocketSignal({ candidate, forecast: bothDeep, rankings }),
      ).toMatchObject({ replacementQuality: "high", skipSafety: "high" });
      expect(
        createCandidatePocketSignal({ candidate, forecast: bothThin, rankings }),
      ).toMatchObject({ replacementQuality: "low", skipSafety: "low" });
    }
  });

  it("ignores onesie diversity labels and describes DST objectively", () => {
    const candidateTe = createRanking("candidate-te", 20, 20, "TE", {
      overallTier: 2,
    });
    const replacementTe = createRanking("replacement-te", 25, 25, "TE", {
      overallTier: 2,
    });
    const candidateDst = createRanking("candidate-dst", 30, 30, "DST", {
      overallTier: 3,
    });
    const replacementDst = createRanking("replacement-dst", 35, 35, "DST", {
      overallTier: 3,
    });
    const rankings = [candidateTe, replacementTe, candidateDst, replacementDst];
    const baseForecast = createActiveForecast(
      [candidateTe, candidateDst],
      [replacementTe, replacementDst],
    );
    const onesieForecast: DraftPocketForecast = {
      ...baseForecast,
      forecastedPocket: {
        ...baseForecast.forecastedPocket!,
        diversityLabels: ["onesie-heavy"],
      },
    };

    expect(
      createCandidatePocketSignal({ candidate: candidateTe, forecast: onesieForecast, rankings }),
    ).toEqual(
      createCandidatePocketSignal({ candidate: candidateTe, forecast: baseForecast, rankings }),
    );
    expect(
      createCandidatePocketSignal({ candidate: candidateDst, forecast: baseForecast, rankings }),
    ).toMatchObject({
      candidatePosition: "DST",
      comparableReplacementCount: 1,
      replacementQuality: "medium",
      skipSafety: "medium",
    });
  });

  it("rejects mixed tier origins and unresolved pocket identities", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const mixedReplacement = createRanking("mixed-rb", 25, 25, "RB", {
      overallTierOrigin: "defaulted-neutral",
    });
    const rankings = [candidate, mixedReplacement];
    const mixedForecast = createActiveForecast([candidate], [mixedReplacement]);
    const missingForecast: DraftPocketForecast = {
      ...mixedForecast,
      currentPocket: {
        ...mixedForecast.currentPocket,
        playerIds: ["missing-player"],
      },
    };

    expect(() => {
      createCandidatePocketSignal({ candidate, forecast: mixedForecast, rankings });
    }).toThrow("mixed overall-tier origins");
    expect(() => {
      createCandidatePocketSignal({ candidate, forecast: missingForecast, rankings });
    }).toThrow("missing from ranking context");
  });

  it("is deterministic and does not mutate the candidate, forecast, or rankings", () => {
    const candidate = createRanking("candidate-rb", 20, 20, "RB", {
      overallTier: 2,
    });
    const replacement = createRanking("replacement-rb", 25, 25, "RB", {
      overallTier: 2,
    });
    const rankings = [candidate, replacement];
    const forecast = createActiveForecast([candidate], [replacement]);
    const candidateBefore = structuredClone(candidate);
    const forecastBefore = structuredClone(forecast);
    const rankingsBefore = structuredClone(rankings);

    const first = createCandidatePocketSignal({ candidate, forecast, rankings });
    const second = createCandidatePocketSignal({ candidate, forecast, rankings });

    expect(second).toEqual(first);
    expect(candidate).toEqual(candidateBefore);
    expect(forecast).toEqual(forecastBefore);
    expect(rankings).toEqual(rankingsBefore);
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
