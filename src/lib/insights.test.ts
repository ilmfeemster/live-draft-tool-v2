import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { generateStrategicInsights } from "@/lib/insights";
import type {
  Draft,
  DraftPocketForecast,
  InsightInput,
  PlayerRecommendation,
  Position,
  RankingEntry,
} from "@/types/draft";

function createRanking(
  id: string,
  overallRank: number,
  position: Position = "RB",
): RankingEntry {
  return {
    player: {
      id,
      name: id,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank: null,
    positionRank: overallRank,
    tier: 1,
  };
}

function createRecommendation(
  ranking: RankingEntry,
  totalScore = 100 - ranking.overallRank,
): PlayerRecommendation {
  return {
    ranking,
    playerId: ranking.player.id,
    totalScore,
    baseScore: totalScore,
    contextScore: 0,
    components: [
      {
        id: "base_value",
        delta: totalScore,
        direction: totalScore > 0 ? "positive" : "neutral",
        evidence: { overallRank: ranking.overallRank },
      },
    ],
    scoreAdjustments: [],
    reasons: [
      {
        id: "base_value:overall_rank",
        text: `Ranked #${ranking.overallRank} overall.`,
        sourceComponentId: "base_value",
        priority: 10,
      },
    ],
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

function createTestForecast(): DraftPocketForecast {
  const currentPocket = {
    playerIds: ["player-1"],
    highestMeaningfulOverallTier: null,
    overallTierCounts: [],
    positionCounts: { QB: 0, RB: 1, WR: 0, TE: 0, DST: 0, K: 0 },
    diversityLabels: ["thin", "RB-heavy"] as const,
  };

  return {
    status: "no-adp",
    targetPickNumber: 3,
    picksToRemove: 2,
    missingAdpFallback: null,
    currentBoardPlayerIds: ["player-1"],
    removalWindowPlayerIds: [],
    forecastedBoardPlayerIds: [],
    currentPocket,
    forecastedPocket: null,
  };
}

function createInsightInput(
  recommendations: PlayerRecommendation[],
  overrides: Partial<InsightInput> = {},
): InsightInput {
  const rankings = recommendations.map((recommendation) => {
    return recommendation.ranking;
  });

  return {
    draft: createTestDraft(),
    rankings,
    leagueSettings: defaultLeagueSettings,
    userTeamId: "team-1",
    recommendations,
    ...overrides,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("generateStrategicInsights", () => {
  it("returns a complete neutral bundle for empty recommendations", () => {
    expect(generateStrategicInsights(createInsightInput([]))).toEqual({
      summary: {
        leadingPlayerId: null,
        decisionFrame: "no_material_insight",
        scoreGapLabel: "unavailable",
      },
      primaryInsight: null,
      candidateInsights: [],
      tradeoffInsights: [],
      rosterInsights: [],
      boardInsights: [],
      caveats: [],
      suppressedSignals: [],
    });
  });

  it("preserves the first recommendation as the leading player without adding advice", () => {
    const ranking = createRanking("player-1", 1);
    const recommendation = createRecommendation(ranking);

    expect(
      generateStrategicInsights(createInsightInput([recommendation])),
    ).toEqual({
      summary: {
        leadingPlayerId: "player-1",
        decisionFrame: "no_material_insight",
        scoreGapLabel: "unavailable",
      },
      primaryInsight: null,
      candidateInsights: [],
      tradeoffInsights: [],
      rosterInsights: [],
      boardInsights: [],
      caveats: [],
      suppressedSignals: [],
    });
  });

  it("does not sort or reinterpret multiple recommendations", () => {
    const first = createRecommendation(createRanking("first", 10, "WR"), 80);
    const second = createRecommendation(createRanking("second", 1, "RB"), 99);

    expect(
      generateStrategicInsights(createInsightInput([first, second])).summary,
    ).toEqual({
      leadingPlayerId: "first",
      decisionFrame: "no_material_insight",
      scoreGapLabel: "unavailable",
    });
  });

  it("returns deterministic output for equivalent inputs", () => {
    const recommendations = [
      createRecommendation(createRanking("player-1", 1)),
      createRecommendation(createRanking("player-2", 2, "WR")),
    ];
    const input = createInsightInput(recommendations, {
      forecast: createTestForecast(),
    });

    expect(generateStrategicInsights(input)).toEqual(
      generateStrategicInsights(cloneJson(input)),
    );
  });

  it("does not mutate draft, rankings, recommendations, or forecast input", () => {
    const recommendations = [
      createRecommendation(createRanking("player-1", 1)),
      createRecommendation(createRanking("player-2", 2, "WR")),
    ];
    const input = createInsightInput(recommendations, {
      forecast: createTestForecast(),
    });
    const before = cloneJson(input);

    generateStrategicInsights(input);

    expect(input).toEqual(before);
  });
});
