import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { draftPlayerInDraft } from "@/lib/draftState";
import {
  calculateBasePlayerValueScore,
  calculateValueOpportunityComponent,
  defaultRecommendationTuningConfig,
  generatePlayerRecommendations,
  generateTopRecommendations,
} from "@/lib/recommendations";
import type { Draft, LeagueSettings, Position, RankingEntry } from "@/types/draft";

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

function getPlayerRecommendationIds(
  recommendations: ReturnType<typeof generatePlayerRecommendations>,
) {
  return recommendations.map((recommendation) => recommendation.playerId);
}

function createRecommendationInput({
  draft = createTestDraft(),
  rankings = [],
  leagueSettings = defaultLeagueSettings,
  userTeamId = draft.userTeamId,
}: {
  draft?: Draft;
  rankings?: RankingEntry[];
  leagueSettings?: LeagueSettings;
  userTeamId?: string;
}) {
  return {
    draft,
    rankings,
    leagueSettings,
    userTeamId,
  };
}

function createDraftWithUserPicks(playerIds: string[], overrides: Partial<Draft> = {}): Draft {
  const teamCount = overrides.teamCount ?? 1;
  const rounds = overrides.rounds ?? Math.max(playerIds.length + 1, 1);
  const userTeamId = overrides.userTeamId ?? "team-1";
  const picks = generateSnakeDraftOrder(teamCount, rounds).map((pick, index) => {
    if (pick.teamId !== userTeamId) {
      return pick;
    }

    const playerId = playerIds[index];

    return playerId ? { ...pick, playerId } : pick;
  });

  return createTestDraft({
    teamCount,
    rounds,
    userTeamId,
    teams: createDraftTeams(teamCount),
    picks,
    currentPickNumber: Math.min(playerIds.length + 1, teamCount * rounds),
    ...overrides,
  });
}

describe("calculateBasePlayerValueScore", () => {
  it("uses the approved rank-derived curve", () => {
    expect(calculateBasePlayerValueScore(1)).toBe(100);
    expect(calculateBasePlayerValueScore(25)).toBeCloseTo(100 - 6 * Math.sqrt(24));
    expect(calculateBasePlayerValueScore(325)).toBe(0);
  });

  it("clamps invalid low ranks before calculating the curve", () => {
    expect(calculateBasePlayerValueScore(0)).toBe(100);
    expect(calculateBasePlayerValueScore(-10)).toBe(100);
  });
});

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

describe("generatePlayerRecommendations", () => {
  it("excludes drafted players from draft state", () => {
    const rankings = [
      createRanking("player-1", 1, "RB"),
      createRanking("player-2", 2, "WR"),
      createRanking("player-3", 3, "QB"),
    ];
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");
    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );

    expect(getPlayerRecommendationIds(recommendations)).toEqual(["player-2", "player-3"]);
  });

  it("returns deterministic ordering for identical input", () => {
    const rankings = [
      createRanking("player-c", 3, "RB"),
      createRanking("player-b", 2, "WR"),
      createRanking("player-a", 1, "QB"),
    ];
    const input = createRecommendationInput({ rankings });

    const firstRun = getPlayerRecommendationIds(generatePlayerRecommendations(input));
    const secondRun = getPlayerRecommendationIds(generatePlayerRecommendations(input));

    expect(firstRun).toEqual(["player-a", "player-b", "player-c"]);
    expect(secondRun).toEqual(firstRun);
  });

  it("uses stable tie breakers after overall rank", () => {
    const rankings = [
      createRanking("player-c", 10, "WR", "C", { positionRank: 3 }),
      createRanking("player-a", 10, "RB", "A", { positionRank: 2 }),
      createRanking("player-b", 10, "RB", "B", { positionRank: 2 }),
    ];

    const recommendations = generatePlayerRecommendations(createRecommendationInput({ rankings }));

    expect(getPlayerRecommendationIds(recommendations)).toEqual([
      "player-a",
      "player-b",
      "player-c",
    ]);
  });

  it("uses stable tie breakers when base scores are equal", () => {
    const rankings = [
      createRanking("player-c", 30, "WR", "C", { positionRank: 3 }),
      createRanking("player-a", 10, "RB", "A", { positionRank: 2 }),
      createRanking("player-b", 10, "RB", "B", { positionRank: 2 }),
    ];

    const recommendations = generatePlayerRecommendations(createRecommendationInput({ rankings }), {
      tuning: {
        ...defaultRecommendationTuningConfig,
        baseScoreCurveCoefficient: 0,
      },
    });

    expect(getPlayerRecommendationIds(recommendations)).toEqual([
      "player-a",
      "player-b",
      "player-c",
    ]);
  });

  it("accepts non-default league settings", () => {
    const nonDefaultSettings: LeagueSettings = {
      ...defaultLeagueSettings,
      teamCount: 4,
      rounds: 3,
      rosterSlots: defaultLeagueSettings.rosterSlots.slice(0, 3),
    };
    const draft = createTestDraft({
      teamCount: nonDefaultSettings.teamCount,
      rounds: nonDefaultSettings.rounds,
      teams: createDraftTeams(nonDefaultSettings.teamCount),
      picks: generateSnakeDraftOrder(nonDefaultSettings.teamCount, nonDefaultSettings.rounds),
    });
    const rankings = [createRanking("player-1", 1, "RB")];

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({
        draft,
        rankings,
        leagueSettings: nonDefaultSettings,
      }),
    );

    expect(getPlayerRecommendationIds(recommendations)).toEqual(["player-1"]);
  });

  it("returns contract fields for future scoring and reasons", () => {
    const rankings = [createRanking("player-1", 1, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );

    expect(recommendation).toMatchObject({
      playerId: "player-1",
      totalScore: 110,
      baseScore: 100,
      contextScore: 10,
      reasons: [],
    });
    expect(recommendation.components).toEqual(
      expect.arrayContaining([
        {
          id: "base_value",
          delta: 100,
          direction: "positive",
          priority: 10,
          evidence: {
            overallRank: 1,
            coefficient: defaultRecommendationTuningConfig.baseScoreCurveCoefficient,
          },
        },
        expect.objectContaining({
          id: "roster_fit",
          delta: 10,
          direction: "positive",
        }),
      ]),
    );
    expect(recommendation.ranking.player.id).toBe("player-1");
  });

  it("adds roster fit as the only context score source", () => {
    const rankings = [createRanking("player-1", 25, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );

    expect(recommendation.contextScore).toBe(10);
    expect(recommendation.totalScore).toBe(recommendation.baseScore + recommendation.contextScore);
    expect(recommendation.baseScore).toBeCloseTo(calculateBasePlayerValueScore(25));
  });

  it("does not let a lower-ranked player outrank a higher-ranked player without context modifiers", () => {
    const rankings = [
      createRanking("player-lower-ranked", 8, "WR"),
      createRanking("player-higher-ranked", 3, "RB"),
    ];

    const recommendations = generatePlayerRecommendations(createRecommendationInput({ rankings }));

    expect(getPlayerRecommendationIds(recommendations)).toEqual([
      "player-higher-ranked",
      "player-lower-ranked",
    ]);
    expect(recommendations[0].baseScore).toBeGreaterThan(recommendations[1].baseScore);
  });

  it("includes a base value score component with rank evidence", () => {
    const rankings = [createRanking("player-1", 200, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );

    expect(recommendation.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "base_value",
          delta: recommendation.baseScore,
          direction: recommendation.baseScore > 0 ? "positive" : "neutral",
          evidence: expect.objectContaining({
            overallRank: 200,
            coefficient: defaultRecommendationTuningConfig.baseScoreCurveCoefficient,
          }),
        }),
      ]),
    );
  });

  it("increases context score for an open configured starter slot", () => {
    const rankings = [createRanking("player-rb", 20, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );
    const rosterFitComponent = recommendation.components.find((component) => {
      return component.id === "roster_fit";
    });

    expect(recommendation.contextScore).toBe(10);
    expect(rosterFitComponent).toEqual(
      expect.objectContaining({
        delta: 10,
        direction: "positive",
        evidence: expect.objectContaining({
          position: "RB",
          directStarterOpenings: 2,
          timing: "direct_starter_need",
        }),
      }),
    );
  });

  it("uses FLEX-style slot eligibility from non-default roster settings", () => {
    const leagueSettings: LeagueSettings = {
      ...defaultLeagueSettings,
      rosterSlots: [
        { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
        { id: "superflex-1", label: "SUPERFLEX", eligiblePositions: ["QB", "RB"] },
      ],
    };
    const draft = createDraftWithUserPicks(["drafted-qb"]);
    const rankings = [
      createRanking("drafted-qb", 1, "QB"),
      createRanking("candidate-qb", 10, "QB"),
      createRanking("candidate-rb", 11, "RB"),
    ];

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings, leagueSettings }),
    );
    const quarterback = recommendations.find((recommendation) => {
      return recommendation.playerId === "candidate-qb";
    });
    const runningBack = recommendations.find((recommendation) => {
      return recommendation.playerId === "candidate-rb";
    });

    expect(quarterback?.contextScore).toBe(5);
    expect(runningBack?.contextScore).toBe(5);
  });

  it("penalizes a saturated position without hiding elite base value", () => {
    const draftedRunningBackIds = Array.from({ length: 10 }, (_, index) => `drafted-rb-${index}`);
    const draft = createDraftWithUserPicks(draftedRunningBackIds, {
      rounds: draftedRunningBackIds.length + 1,
      currentPickNumber: draftedRunningBackIds.length + 1,
    });
    const rankings = [
      ...draftedRunningBackIds.map((id, index) => createRanking(id, index + 50, "RB")),
      createRanking("elite-rb", 1, "RB"),
      createRanking("solid-wr", 20, "WR"),
    ];

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );
    const eliteRunningBack = recommendations.find((recommendation) => {
      return recommendation.playerId === "elite-rb";
    });

    expect(recommendations[0].playerId).toBe("elite-rb");
    expect(eliteRunningBack?.contextScore).toBe(-10);
  });

  it("applies an early DEF and K timing penalty", () => {
    const rankings = [createRanking("candidate-dst", 10, "DST")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );
    const rosterFitComponent = recommendation.components.find((component) => {
      return component.id === "roster_fit";
    });

    expect(recommendation.contextScore).toBe(-20);
    expect(rosterFitComponent).toEqual(
      expect.objectContaining({
        delta: -20,
        direction: "negative",
        evidence: expect.objectContaining({
          timing: "early_def_k",
        }),
      }),
    );
  });

  it("treats empty DEF and K slots as valid late starter needs", () => {
    const draft = createTestDraft({
      teamCount: 2,
      rounds: 16,
      teams: createDraftTeams(2),
      picks: generateSnakeDraftOrder(2, 16),
      currentPickNumber: 30,
    });
    const rankings = [createRanking("candidate-dst", 10, "DST")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );

    expect(recommendation.contextScore).toBe(15);
    expect(recommendation.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "roster_fit",
          evidence: expect.objectContaining({
            timing: "direct_starter_need",
          }),
        }),
      ]),
    );
  });

  it("uses non-default starter counts instead of MVP defaults", () => {
    const leagueSettings: LeagueSettings = {
      ...defaultLeagueSettings,
      rosterSlots: [
        { id: "wr-1", label: "WR", eligiblePositions: ["WR"] },
        { id: "wr-2", label: "WR", eligiblePositions: ["WR"] },
        { id: "wr-3", label: "WR", eligiblePositions: ["WR"] },
      ],
    };
    const draft = createDraftWithUserPicks(["drafted-wr-1", "drafted-wr-2"]);
    const rankings = [
      createRanking("drafted-wr-1", 1, "WR"),
      createRanking("drafted-wr-2", 2, "WR"),
      createRanking("candidate-wr", 10, "WR"),
    ];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings, leagueSettings }),
    );

    expect(recommendation.contextScore).toBe(10);
    expect(recommendation.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "roster_fit",
          evidence: expect.objectContaining({
            directStarterSlots: 3,
            directStarterOpenings: 1,
          }),
        }),
      ]),
    );
  });

  it("clamps roster context score to configured bounds", () => {
    const rankings = [createRanking("player-rb", 20, "RB")];

    const [positiveRecommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
      {
        tuning: {
          ...defaultRecommendationTuningConfig,
          maxPositiveContextScore: 4,
        },
      },
    );
    const [negativeRecommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings: [createRanking("candidate-dst", 10, "DST")] }),
      {
        tuning: {
          ...defaultRecommendationTuningConfig,
          maxNegativeContextScore: -8,
        },
      },
    );

    expect(positiveRecommendation.contextScore).toBe(4);
    expect(negativeRecommendation.contextScore).toBe(-8);
  });

  it("adds small, clear, and major value opportunity deltas for falling players", () => {
    const rankings = [
      createRanking("small-value", 19, "RB"),
      createRanking("clear-value", 13, "WR"),
      createRanking("major-value", 1, "TE"),
    ];
    const draft = createTestDraft({ currentPickNumber: 25 });

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );
    const valueDeltasByPlayerId = new Map(
      recommendations.map((recommendation) => {
        const valueComponent = recommendation.components.find((component) => {
          return component.id === "value_opportunity";
        });

        return [recommendation.playerId, valueComponent?.delta];
      }),
    );

    expect(valueDeltasByPlayerId.get("small-value")).toBe(2);
    expect(valueDeltasByPlayerId.get("clear-value")).toBe(5);
    expect(valueDeltasByPlayerId.get("major-value")).toBe(8);
  });

  it("applies clear and major unsupported reach penalties", () => {
    const clearReach = calculateValueOpportunityComponent({
      ranking: createRanking("clear-reach", 13, "RB"),
      currentPickNumber: 1,
      rosterFitDelta: 0,
      tuning: defaultRecommendationTuningConfig,
    });
    const majorReach = calculateValueOpportunityComponent({
      ranking: createRanking("major-reach", 25, "RB"),
      currentPickNumber: 1,
      rosterFitDelta: 0,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(clearReach).toMatchObject({
      id: "value_opportunity",
      delta: -4,
      direction: "negative",
      evidence: expect.objectContaining({
        reachGap: 12,
        thresholdMatched: "clear_reach",
      }),
    });
    expect(majorReach).toMatchObject({
      delta: -6,
      direction: "negative",
      evidence: expect.objectContaining({
        reachGap: 24,
        thresholdMatched: "major_reach",
      }),
    });
  });

  it("does not penalize a reach when roster fit supports the pick", () => {
    const valueComponent = calculateValueOpportunityComponent({
      ranking: createRanking("supported-reach", 25, "RB"),
      currentPickNumber: 1,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(valueComponent).toMatchObject({
      delta: 0,
      direction: "neutral",
      evidence: expect.objectContaining({
        thresholdMatched: "neutral",
        rosterFitDelta: 10,
      }),
    });
  });

  it("keeps neutral value opportunity separate from base score", () => {
    const rankings = [createRanking("neutral-value", 5, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );
    const valueComponent = recommendation.components.find((component) => {
      return component.id === "value_opportunity";
    });

    expect(valueComponent).toEqual(
      expect.objectContaining({
        delta: 0,
        direction: "neutral",
      }),
    );
    expect(recommendation.baseScore).toBeCloseTo(calculateBasePlayerValueScore(5));
    expect(recommendation.contextScore).toBe(10);
  });

  it("clamps context score after composing roster fit and value opportunity", () => {
    const draft = createTestDraft({ currentPickNumber: 25 });
    const rankings = [createRanking("major-value", 1, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
      {
        tuning: {
          ...defaultRecommendationTuningConfig,
          maxPositiveContextScore: 12,
        },
      },
    );

    expect(recommendation.contextScore).toBe(12);
  });

  it("keeps the value opportunity component within its own bounds", () => {
    const extremeValue = calculateValueOpportunityComponent({
      ranking: createRanking("extreme-value", 1, "RB"),
      currentPickNumber: 1000,
      rosterFitDelta: 0,
      tuning: defaultRecommendationTuningConfig,
    });
    const extremeReach = calculateValueOpportunityComponent({
      ranking: createRanking("extreme-reach", 1000, "RB"),
      currentPickNumber: 1,
      rosterFitDelta: 0,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(extremeValue.delta).toBe(8);
    expect(extremeReach.delta).toBe(-6);
  });

  it("includes value opportunity evidence from typed draft state and rankings", () => {
    const draft = createTestDraft({ currentPickNumber: 25 });
    const rankings = [createRanking("major-value", 1, "RB", "Major Value", { adpRank: 200 })];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );
    const valueComponent = recommendation.components.find((component) => {
      return component.id === "value_opportunity";
    });

    expect(valueComponent).toEqual(
      expect.objectContaining({
        delta: 8,
        direction: "positive",
        evidence: expect.objectContaining({
          currentPickNumber: 25,
          overallRank: 1,
          pickValueGap: 24,
          reachGap: -24,
          thresholdMatched: "major_value",
          rosterFitDelta: 10,
        }),
      }),
    );
  });

  it("does not mutate the input draft", () => {
    const draft = createTestDraft();
    const draftBeforeRecommendation = JSON.parse(JSON.stringify(draft)) as Draft;
    const rankings = [createRanking("player-1", 1, "RB")];

    generatePlayerRecommendations(createRecommendationInput({ draft, rankings }));

    expect(draft).toEqual(draftBeforeRecommendation);
  });

  it("respects requested limit and exposes default tuning config", () => {
    const rankings = [
      createRanking("player-1", 1, "RB"),
      createRanking("player-2", 2, "WR"),
      createRanking("player-3", 3, "QB"),
    ];

    const recommendations = generatePlayerRecommendations(createRecommendationInput({ rankings }), {
      limit: 2,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(getPlayerRecommendationIds(recommendations)).toEqual(["player-1", "player-2"]);
    expect(defaultRecommendationTuningConfig.maxReasons).toBe(3);
  });
});
