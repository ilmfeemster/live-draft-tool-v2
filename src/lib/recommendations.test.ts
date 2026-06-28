import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { draftPlayerInDraft } from "@/lib/draftState";
import {
  calculateBasePlayerValueScore,
  calculatePositionalRunComponent,
  calculatePositionalScarcityComponent,
  calculateTierDropRiskComponent,
  calculateValueOpportunityComponent,
  defaultRecommendationTuningConfig,
  generatePlayerRecommendations,
  generateTopRecommendations,
  selectRecommendationReasons,
} from "@/lib/recommendations";
import type {
  Draft,
  LeagueSettings,
  PlayerRecommendation,
  Position,
  RankingEntry,
  RecommendationScoreComponent,
} from "@/types/draft";

function expectScoreToReconcile(recommendation: PlayerRecommendation) {
  const componentTotal = recommendation.components.reduce((total, component) => {
    return total + component.delta;
  }, 0);
  const adjustmentTotal = recommendation.scoreAdjustments.reduce(
    (total, adjustment) => total + adjustment.delta,
    0,
  );

  expect(componentTotal + adjustmentTotal).toBeCloseTo(
    recommendation.totalScore,
    12,
  );
}

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

function createDraftWithRecentPicks(playerIds: string[]): Draft {
  const teamCount = 2;
  const rounds = Math.ceil((playerIds.length + 1) / teamCount);
  const picks = generateSnakeDraftOrder(teamCount, rounds).map((pick, index) => {
    const playerId = playerIds[index];

    return playerId ? { ...pick, playerId } : pick;
  });

  return createTestDraft({
    teamCount,
    rounds,
    userTeamId: "user-team-with-no-picks",
    teams: createDraftTeams(teamCount),
    picks,
    currentPickNumber: playerIds.length + 1,
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
      totalScore: 116,
      baseScore: 100,
      contextScore: 16,
      reasons: [
        {
          id: "roster_fit:direct_starter_need",
          text: "Fills an open RB starter slot.",
          sourceComponentId: "roster_fit",
          priority: 20,
        },
        {
          id: "positional_scarcity:clear_scarcity",
          text: "No nearby RB options remain in the next 24 ranks.",
          sourceComponentId: "positional_scarcity",
          priority: 17,
        },
        {
          id: "base_value:overall_rank",
          text: "Ranked #1 overall.",
          sourceComponentId: "base_value",
          priority: 10,
        },
      ],
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
    expect(recommendation.scoreAdjustments).toEqual([]);
    expectScoreToReconcile(recommendation);
  });

  it("adds roster fit to context score", () => {
    const rankings = [createRanking("player-1", 25, "RB")];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );

    expect(recommendation.contextScore).toBe(16);
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

    expect(recommendation.contextScore).toBe(16);
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

    expect(quarterback?.contextScore).toBe(11);
    expect(runningBack?.contextScore).toBe(11);
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

    expect(recommendation.contextScore).toBe(16);
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
    expect(positiveRecommendation.scoreAdjustments).toEqual([
      {
        id: "context_cap",
        delta: -12,
        direction: "negative",
        evidence: {
          rawScore: 16,
          adjustedScore: 4,
          minScore: -24,
          maxScore: 4,
        },
      },
    ]);
    expect(negativeRecommendation.scoreAdjustments).toEqual([
      {
        id: "context_cap",
        delta: 12,
        direction: "positive",
        evidence: {
          rawScore: -20,
          adjustedScore: -8,
          minScore: -8,
          maxScore: 30,
        },
      },
    ]);
    expectScoreToReconcile(positiveRecommendation);
    expectScoreToReconcile(negativeRecommendation);
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
    expect(recommendation.contextScore).toBe(16);
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

  it("adds mild tier pressure when two players remain in a relevant tier", () => {
    const tierComponent = calculateTierDropRiskComponent({
      ranking: createRanking("tier-rb-1", 20, "RB", "tier-rb-1", { tier: 1 }),
      availableRankings: [
        createRanking("tier-rb-1", 20, "RB", "tier-rb-1", { tier: 1 }),
        createRanking("tier-rb-2", 21, "RB", "tier-rb-2", { tier: 1 }),
        createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 2 }),
      ],
      distanceToNextUserPick: null,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(tierComponent).toMatchObject({
      id: "tier_cliff",
      delta: 4,
      direction: "positive",
      evidence: expect.objectContaining({
        sameTierRemaining: 2,
        nextTier: 2,
        tierGap: 1,
        thresholdMatched: "mild_tier_pressure",
      }),
    });
  });

  it("adds major tier pressure before a multi-tier drop at a needed position", () => {
    const rankings = [
      createRanking("tier-rb", 20, "RB", "tier-rb", { tier: 1 }),
      createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 3 }),
    ];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );
    const tierComponent = recommendation.components.find((component) => {
      return component.id === "tier_cliff";
    });

    expect(tierComponent).toEqual(
      expect.objectContaining({
        delta: 12,
        direction: "positive",
        evidence: expect.objectContaining({
          position: "RB",
          currentTier: 1,
          sameTierRemaining: 1,
          nextTier: 3,
          tierGap: 2,
          thresholdMatched: "major_tier_cliff",
        }),
      }),
    );
    expect(recommendation.contextScore).toBe(25);
  });

  it("does not add tier pressure when tier depth is not thin", () => {
    const tierComponent = calculateTierDropRiskComponent({
      ranking: createRanking("tier-rb-1", 20, "RB", "tier-rb-1", { tier: 1 }),
      availableRankings: [
        createRanking("tier-rb-1", 20, "RB", "tier-rb-1", { tier: 1 }),
        createRanking("tier-rb-2", 21, "RB", "tier-rb-2", { tier: 1 }),
        createRanking("tier-rb-3", 22, "RB", "tier-rb-3", { tier: 1 }),
        createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 2 }),
      ],
      distanceToNextUserPick: null,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(tierComponent).toMatchObject({
      delta: 0,
      direction: "neutral",
      evidence: expect.objectContaining({
        thresholdMatched: "tier_not_thin",
      }),
    });
  });

  it("does not add tier pressure outside the best available tier", () => {
    const tierComponent = calculateTierDropRiskComponent({
      ranking: createRanking("second-tier-rb", 25, "RB", "second-tier-rb", { tier: 2 }),
      availableRankings: [
        createRanking("top-tier-rb", 20, "RB", "top-tier-rb", { tier: 1 }),
        createRanking("second-tier-rb", 25, "RB", "second-tier-rb", { tier: 2 }),
        createRanking("third-tier-rb", 30, "RB", "third-tier-rb", { tier: 3 }),
      ],
      distanceToNextUserPick: null,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(tierComponent).toMatchObject({
      delta: 0,
      evidence: expect.objectContaining({
        thresholdMatched: "not_best_available_tier",
      }),
    });
  });

  it("reduces tier pressure for filled or low-value roster positions", () => {
    const tierComponent = calculateTierDropRiskComponent({
      ranking: createRanking("tier-rb", 20, "RB", "tier-rb", { tier: 1 }),
      availableRankings: [
        createRanking("tier-rb", 20, "RB", "tier-rb", { tier: 1 }),
        createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 3 }),
      ],
      distanceToNextUserPick: null,
      rosterFitDelta: -12,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(tierComponent).toEqual(
      expect.objectContaining({
        delta: 3,
        evidence: expect.objectContaining({
          rosterFitDelta: -12,
          thresholdMatched: "major_tier_cliff",
        }),
      }),
    );
  });

  it("does not let tier pressure alone move a much lower base-value player above an elite player", () => {
    const rankings = [
      createRanking("elite-wr", 1, "WR", "elite-wr", { tier: 1 }),
      createRanking("tier-rb", 40, "RB", "tier-rb", { tier: 1 }),
      createRanking("next-tier-rb", 55, "RB", "next-tier-rb", { tier: 3 }),
    ];

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
    );

    expect(getPlayerRecommendationIds(recommendations).slice(0, 2)).toEqual([
      "elite-wr",
      "tier-rb",
    ]);
  });

  it("caps tier urgency with the tuning max urgency score", () => {
    const rankings = [
      createRanking("tier-rb", 20, "RB", "tier-rb", { tier: 1 }),
      createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 3 }),
    ];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings }),
      {
        tuning: {
          ...defaultRecommendationTuningConfig,
          maxUrgencyScore: 5,
        },
      },
    );
    const tierComponent = recommendation.components.find((component) => {
      return component.id === "tier_cliff";
    });

    expect(tierComponent).toEqual(expect.objectContaining({ delta: 12 }));
    expect(recommendation.contextScore).toBe(15);
    expect(recommendation.scoreAdjustments).toEqual([
      {
        id: "urgency_cap",
        delta: -10,
        direction: "negative",
        evidence: {
          rawScore: 15,
          adjustedScore: 5,
          maxScore: 5,
        },
      },
    ]);
    expectScoreToReconcile(recommendation);
  });

  it("adds mild scarcity when one or two nearby same-position options remain", () => {
    const ranking = createRanking("candidate-rb", 10, "RB");
    const component = calculatePositionalScarcityComponent({
      ranking,
      availableRankings: [
        ranking,
        createRanking("nearby-rb-1", 20, "RB"),
        createRanking("nearby-rb-2", 30, "RB"),
      ],
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toEqual(
      expect.objectContaining({
        id: "positional_scarcity",
        delta: 3,
        direction: "positive",
        evidence: expect.objectContaining({
          position: "RB",
          nearbySamePositionOptions: 2,
          lookaheadRanks: 24,
          rosterFitDelta: 10,
          thresholdMatched: "mild_scarcity",
        }),
      }),
    );
  });

  it("adds clear scarcity when no nearby same-position options remain", () => {
    const ranking = createRanking("candidate-te", 10, "TE");
    const component = calculatePositionalScarcityComponent({
      ranking,
      availableRankings: [ranking, createRanking("distant-te", 40, "TE")],
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toMatchObject({
      delta: 6,
      direction: "positive",
      evidence: expect.objectContaining({
        nearbySamePositionOptions: 0,
        thresholdMatched: "clear_scarcity",
      }),
    });
  });

  it("does not add scarcity when nearby same-position depth remains", () => {
    const ranking = createRanking("candidate-wr", 10, "WR");
    const component = calculatePositionalScarcityComponent({
      ranking,
      availableRankings: [
        ranking,
        createRanking("nearby-wr-1", 11, "WR"),
        createRanking("nearby-wr-2", 12, "WR"),
        createRanking("nearby-wr-3", 13, "WR"),
      ],
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toMatchObject({
      delta: 0,
      direction: "neutral",
      evidence: expect.objectContaining({ thresholdMatched: "enough_nearby_options" }),
    });
  });

  it("adds observed run pressure at a needed position", () => {
    const recentPlayerIds = Array.from({ length: 5 }, (_, index) => `recent-rb-${index}`);
    const draft = createDraftWithRecentPicks(recentPlayerIds);
    const ranking = createRanking("candidate-rb", 20, "RB");
    const rankings = [
      ranking,
      ...recentPlayerIds.map((id, index) => createRanking(id, index + 1, "RB")),
    ];
    const component = calculatePositionalRunComponent({
      ranking,
      rankings,
      picks: draft.picks,
      currentPickNumber: draft.currentPickNumber,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toEqual(
      expect.objectContaining({
        id: "positional_run",
        delta: 4,
        direction: "positive",
        evidence: expect.objectContaining({
          position: "RB",
          recentPickWindow: defaultRecommendationTuningConfig.recentPickRunWindow,
          recentPositionPickCount: 5,
          rosterFitDelta: 10,
          thresholdMatched: "clear_run",
        }),
      }),
    );
  });

  it("ignores observed run pressure for a solved position", () => {
    const recentPlayerIds = Array.from({ length: 5 }, (_, index) => `recent-qb-${index}`);
    const draft = createDraftWithRecentPicks(recentPlayerIds);
    const ranking = createRanking("candidate-qb", 20, "QB");
    const component = calculatePositionalRunComponent({
      ranking,
      rankings: [
        ranking,
        ...recentPlayerIds.map((id, index) => createRanking(id, index + 1, "QB")),
      ],
      picks: draft.picks,
      currentPickNumber: draft.currentPickNumber,
      rosterFitDelta: 0,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toMatchObject({
      delta: 0,
      direction: "neutral",
      evidence: expect.objectContaining({ thresholdMatched: "roster_irrelevant" }),
    });
  });

  it("ignores recent pick player ids missing from rankings", () => {
    const draft = createDraftWithRecentPicks([
      "known-rb-1",
      "unknown-player-1",
      "known-rb-2",
      "unknown-player-2",
      "unknown-player-3",
    ]);
    const ranking = createRanking("candidate-rb", 20, "RB");
    const component = calculatePositionalRunComponent({
      ranking,
      rankings: [
        ranking,
        createRanking("known-rb-1", 1, "RB"),
        createRanking("known-rb-2", 2, "RB"),
      ],
      picks: draft.picks,
      currentPickNumber: draft.currentPickNumber,
      rosterFitDelta: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(component).toMatchObject({
      delta: 0,
      evidence: expect.objectContaining({
        recentPositionPickCount: 2,
        thresholdMatched: "no_meaningful_run",
      }),
    });
  });

  it("shares the urgency cap across tier, scarcity, and run pressure", () => {
    const recentPlayerIds = Array.from({ length: 5 }, (_, index) => `recent-rb-${index}`);
    const draft = createDraftWithRecentPicks(recentPlayerIds);
    const rankings = [
      ...recentPlayerIds.map((id, index) => createRanking(id, index + 1, "RB")),
      createRanking("candidate-rb", 20, "RB", "candidate-rb", { tier: 1 }),
      createRanking("next-tier-rb", 30, "RB", "next-tier-rb", { tier: 3 }),
    ];

    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
      {
        tuning: {
          ...defaultRecommendationTuningConfig,
          maxUrgencyScore: 7,
          maxPositiveContextScore: 12,
        },
      },
    );

    expect(recommendation.playerId).toBe("candidate-rb");
    expect(recommendation.contextScore).toBe(12);
    expect(recommendation.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tier_cliff", delta: 12 }),
        expect.objectContaining({ id: "positional_scarcity", delta: 3 }),
        expect.objectContaining({ id: "positional_run", delta: 4 }),
      ]),
    );
    expect(recommendation.scoreAdjustments).toEqual([
      {
        id: "urgency_cap",
        delta: -12,
        direction: "negative",
        evidence: {
          rawScore: 19,
          adjustedScore: 7,
          maxScore: 7,
        },
      },
      {
        id: "context_cap",
        delta: -5,
        direction: "negative",
        evidence: {
          rawScore: 17,
          adjustedScore: 12,
          minScore: -24,
          maxScore: 12,
        },
      },
    ]);
    expectScoreToReconcile(recommendation);
  });

  it("does not let scarcity and run pressure move a much lower-value player above an elite player", () => {
    const recentPlayerIds = Array.from({ length: 5 }, (_, index) => `recent-rb-${index}`);
    const draft = createDraftWithRecentPicks(recentPlayerIds);
    const rankings = [
      ...recentPlayerIds.map((id, index) => createRanking(id, index + 10, "RB")),
      createRanking("elite-wr", 1, "WR"),
      createRanking("lower-rb", 50, "RB"),
    ];

    const recommendations = generatePlayerRecommendations(
      createRecommendationInput({ draft, rankings }),
    );

    expect(getPlayerRecommendationIds(recommendations).slice(0, 2)).toEqual([
      "elite-wr",
      "lower-rb",
    ]);
  });

  it("emits only reasons backed by recommendation score components", () => {
    const [recommendation] = generatePlayerRecommendations(
      createRecommendationInput({ rankings: [createRanking("candidate-rb", 1, "RB")] }),
    );
    const componentIds = new Set(recommendation.components.map((component) => component.id));

    expect(recommendation.reasons).toHaveLength(defaultRecommendationTuningConfig.maxReasons);
    expect(
      recommendation.reasons.every((reason) => componentIds.has(reason.sourceComponentId)),
    ).toBe(true);
  });

  it("maps supported component evidence into deterministic reason text and priority order", () => {
    const ranking = createRanking("candidate-rb", 10, "RB");
    const components: RecommendationScoreComponent[] = [
      {
        id: "base_value",
        delta: 82,
        direction: "positive",
        priority: 10,
        evidence: { overallRank: 10 },
      },
      {
        id: "roster_fit",
        delta: 10,
        direction: "positive",
        priority: 20,
        evidence: { position: "RB", timing: "direct_starter_need" },
      },
      {
        id: "tier_cliff",
        delta: 4,
        direction: "positive",
        priority: 18,
        evidence: {
          position: "RB",
          sameTierRemaining: 2,
          thresholdMatched: "mild_tier_pressure",
        },
      },
      {
        id: "positional_scarcity",
        delta: 6,
        direction: "positive",
        priority: 17,
        evidence: {
          position: "RB",
          lookaheadRanks: 24,
          thresholdMatched: "clear_scarcity",
        },
      },
      {
        id: "positional_run",
        delta: 4,
        direction: "positive",
        priority: 16,
        evidence: {
          position: "RB",
          recentPositionPickCount: 5,
          recentPickWindow: 12,
          thresholdMatched: "clear_run",
        },
      },
      {
        id: "value_opportunity",
        delta: 8,
        direction: "positive",
        priority: 15,
        evidence: {
          currentPickNumber: 34,
          overallRank: 10,
          thresholdMatched: "major_value",
        },
      },
    ];

    const reasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 1,
      tuning: { ...defaultRecommendationTuningConfig, maxReasons: 10 },
    });

    expect(reasons).toEqual([
      expect.objectContaining({
        id: "roster_fit:direct_starter_need",
        text: "Fills an open RB starter slot.",
      }),
      expect.objectContaining({
        id: "tier_cliff:mild_tier_pressure",
        text: "Only 2 RB options remain in this tier.",
      }),
      expect.objectContaining({
        id: "positional_scarcity:clear_scarcity",
        text: "No nearby RB options remain in the next 24 ranks.",
      }),
      expect.objectContaining({
        id: "positional_run:clear_run",
        text: "5 RB players were drafted in the last 12 picks.",
      }),
      expect.objectContaining({
        id: "value_opportunity:major_value",
        text: "Value at pick 34: ranked #10 overall.",
      }),
      expect.objectContaining({
        id: "base_value:overall_rank",
        text: "Ranked #10 overall.",
      }),
    ]);
  });

  it("clamps the reason limit to a non-negative integer", () => {
    const ranking = createRanking("candidate-rb", 10, "RB");
    const components: RecommendationScoreComponent[] = [
      {
        id: "base_value",
        delta: 82,
        direction: "positive",
        priority: 10,
        evidence: { overallRank: 10 },
      },
      {
        id: "roster_fit",
        delta: 10,
        direction: "positive",
        priority: 20,
        evidence: { position: "RB", timing: "direct_starter_need" },
      },
      {
        id: "tier_cliff",
        delta: 8,
        direction: "positive",
        priority: 18,
        evidence: { position: "RB", thresholdMatched: "last_in_tier" },
      },
    ];

    const limitedReasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 1,
      tuning: { ...defaultRecommendationTuningConfig, maxReasons: 2.9 },
    });
    const disabledReasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 1,
      tuning: { ...defaultRecommendationTuningConfig, maxReasons: -1 },
    });

    expect(limitedReasons.map((reason) => reason.id)).toEqual([
      "roster_fit:direct_starter_need",
      "tier_cliff:last_in_tier",
    ]);
    expect(disabledReasons).toEqual([]);
  });

  it("selects one meaningful negative caveat and places it last", () => {
    const ranking = createRanking("candidate-dst", 25, "DST");
    const components: RecommendationScoreComponent[] = [
      {
        id: "base_value",
        delta: 70,
        direction: "positive",
        priority: 10,
        evidence: { overallRank: 25 },
      },
      {
        id: "tier_cliff",
        delta: 8,
        direction: "positive",
        priority: 18,
        evidence: { position: "DST", thresholdMatched: "last_in_tier" },
      },
      {
        id: "roster_fit",
        delta: -20,
        direction: "negative",
        priority: 20,
        evidence: { position: "DST", timing: "early_def_k" },
      },
      {
        id: "value_opportunity",
        delta: -6,
        direction: "negative",
        priority: 15,
        evidence: {
          currentPickNumber: 1,
          overallRank: 25,
          thresholdMatched: "major_reach",
        },
      },
    ];

    const reasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 1,
      tuning: defaultRecommendationTuningConfig,
    });
    const singleReason = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 1,
      tuning: { ...defaultRecommendationTuningConfig, maxReasons: 1 },
    });

    expect(reasons.map((reason) => reason.id)).toEqual([
      "tier_cliff:last_in_tier",
      "base_value:overall_rank",
      "roster_fit:early_def_k",
    ]);
    expect(reasons.at(-1)).toEqual(
      expect.objectContaining({
        text: "Early for DST relative to roster timing.",
        sourceComponentId: "roster_fit",
      }),
    );
    expect(singleReason.map((reason) => reason.id)).toEqual(["tier_cliff:last_in_tier"]);
  });

  it("suppresses below-threshold context and falls back to base value", () => {
    const ranking = createRanking("candidate-wr", 40, "WR");
    const components: RecommendationScoreComponent[] = [
      {
        id: "base_value",
        delta: 60,
        direction: "positive",
        priority: 10,
        evidence: { overallRank: 40 },
      },
      {
        id: "positional_run",
        delta: 2,
        direction: "positive",
        priority: 16,
        evidence: {
          position: "WR",
          recentPositionPickCount: 3,
          recentPickWindow: 12,
          thresholdMatched: "mild_run",
        },
      },
      {
        id: "value_opportunity",
        delta: -4,
        direction: "negative",
        priority: 15,
        evidence: {
          currentPickNumber: 20,
          overallRank: 40,
          thresholdMatched: "clear_reach",
        },
      },
    ];

    const reasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 10,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(reasons).toEqual([
      {
        id: "base_value:overall_rank",
        text: "Ranked #40 overall.",
        sourceComponentId: "base_value",
        priority: 10,
      },
    ]);
  });

  it("does not emit a reason when required component evidence is missing", () => {
    const ranking = createRanking("candidate-te", 20, "TE");
    const components: RecommendationScoreComponent[] = [
      {
        id: "base_value",
        delta: 70,
        direction: "positive",
        priority: 10,
        evidence: { overallRank: 20 },
      },
      {
        id: "positional_scarcity",
        delta: 6,
        direction: "positive",
        priority: 17,
        evidence: { position: "TE", thresholdMatched: "clear_scarcity" },
      },
    ];

    const reasons = selectRecommendationReasons({
      ranking,
      components,
      availableValueRank: 8,
      tuning: defaultRecommendationTuningConfig,
    });

    expect(reasons.map((reason) => reason.id)).toEqual(["base_value:overall_rank"]);
  });

  it("keeps recommendation scoring, ordering, and reason output deterministic", () => {
    const rankings = [
      createRanking("candidate-rb", 10, "RB", "candidate-rb", { tier: 1 }),
      createRanking("candidate-wr", 11, "WR", "candidate-wr", { tier: 1 }),
      createRanking("next-rb", 20, "RB", "next-rb", { tier: 2 }),
    ];
    const input = createRecommendationInput({ rankings });

    const recommendationsWithReasons = generatePlayerRecommendations(input);
    const repeatedRecommendations = generatePlayerRecommendations(input);
    const recommendationsWithoutReasons = generatePlayerRecommendations(input, {
      tuning: { ...defaultRecommendationTuningConfig, maxReasons: 0 },
    });

    expect(repeatedRecommendations).toEqual(recommendationsWithReasons);
    expect(
      recommendationsWithReasons.map(({ playerId, totalScore, baseScore, contextScore }) => ({
        playerId,
        totalScore,
        baseScore,
        contextScore,
      })),
    ).toEqual(
      recommendationsWithoutReasons.map(({ playerId, totalScore, baseScore, contextScore }) => ({
        playerId,
        totalScore,
        baseScore,
        contextScore,
      })),
    );
    expect(recommendationsWithoutReasons.every((recommendation) => {
      return recommendation.reasons.length === 0;
    })).toBe(true);
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
