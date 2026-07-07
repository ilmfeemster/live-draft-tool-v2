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
  RecommendationScoreComponent,
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

function createComponent(
  id: string,
  delta: number,
  evidence: RecommendationScoreComponent["evidence"] = {},
): RecommendationScoreComponent {
  return {
    id,
    delta,
    direction: delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral",
    priority:
      id === "roster_fit" || id === "draft_pocket_timing"
        ? 20
        : id === "overall_tier"
          ? 19
          : id === "tier_cliff"
            ? 18
            : id === "positional_run"
              ? 16
              : id === "value_opportunity"
                ? 15
                : 10,
    evidence,
  };
}

function createBaseComponent(overallRank: number, delta = 90) {
  return createComponent("base_value", delta, { overallRank });
}

function createRecommendation({
  id,
  overallRank,
  totalScore,
  baseScore,
  position = "RB",
  components,
}: {
  id: string;
  overallRank: number;
  totalScore: number;
  baseScore: number;
  position?: Position;
  components?: RecommendationScoreComponent[];
}): PlayerRecommendation {
  const ranking = createRanking(id, overallRank, position);
  const recommendationComponents =
    components ?? [createBaseComponent(overallRank, baseScore)];

  return {
    ranking,
    playerId: ranking.player.id,
    totalScore,
    baseScore,
    contextScore: totalScore - baseScore,
    components: recommendationComponents,
    scoreAdjustments: [],
    reasons: recommendationComponents.map((component) => ({
      id: `${component.id}:reason`,
      text: `${component.id} reason`,
      sourceComponentId: component.id,
      priority: component.priority ?? 0,
    })),
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

function timingEvidence(
  overrides: RecommendationScoreComponent["evidence"] = {},
): RecommendationScoreComponent["evidence"] {
  return {
    forecastStatus: "active",
    candidateInCurrentPocket: true,
    candidatePosition: "RB",
    profilePosition: "RB",
    skipSafety: "low",
    allocationRole: "full",
    thresholdMatched: "low_skip_safety",
    ...overrides,
  };
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

  it.each([
    { label: "unavailable with one recommendation", scores: [100], gap: "unavailable" },
    { label: "close", scores: [100, 98], gap: "close_call" },
    { label: "slight", scores: [100, 95], gap: "slight_lean" },
    { label: "clear", scores: [100, 91], gap: "clear_lean" },
  ])("derives $label score-gap labels", ({ scores, gap }) => {
    const recommendations = scores.map((score, index) => {
      return createRecommendation({
        id: `player-${index + 1}`,
        overallRank: index + 1,
        totalScore: score,
        baseScore: score,
      });
    });

    expect(
      generateStrategicInsights(createInsightInput(recommendations)).summary
        .scoreGapLabel,
    ).toBe(gap);
  });

  it("preserves the first recommendation as the leading player without sorting", () => {
    const first = createRecommendation({
      id: "first",
      overallRank: 10,
      position: "WR",
      totalScore: 80,
      baseScore: 80,
    });
    const second = createRecommendation({
      id: "second",
      overallRank: 1,
      totalScore: 99,
      baseScore: 99,
    });

    expect(
      generateStrategicInsights(createInsightInput([first, second])).summary
        .leadingPlayerId,
    ).toBe("first");
  });

  it("generates a clean best-player frame and top-candidate summary", () => {
    const top = createRecommendation({
      id: "top-rb",
      overallRank: 1,
      totalScore: 100,
      baseScore: 100,
    });
    const second = createRecommendation({
      id: "next-wr",
      overallRank: 2,
      position: "WR",
      totalScore: 90,
      baseScore: 90,
    });
    const bundle = generateStrategicInsights(createInsightInput([top, second]));

    expect(bundle.summary).toEqual({
      leadingPlayerId: "top-rb",
      decisionFrame: "clean_best_player",
      scoreGapLabel: "clear_lean",
    });
    expect(bundle.primaryInsight).toMatchObject({
      id: "primary_decision:clean_best_player",
      kind: "primary_decision",
      title: "Best player-quality case",
      supportedBy: [
        {
          playerId: "top-rb",
          componentId: "base_value",
          evidenceKeys: ["overallRank"],
          reasonId: "base_value:reason",
        },
      ],
    });
    expect(bundle.candidateInsights).toEqual([
      expect.objectContaining({
        id: "candidate_summary:top-rb",
        kind: "candidate_summary",
        title: "Ranked #1 overall.",
      }),
    ]);
  });

  it("generates a value-over-need frame for a top value with weak roster fit", () => {
    const top = createRecommendation({
      id: "value-wr",
      overallRank: 1,
      position: "WR",
      totalScore: 100,
      baseScore: 100,
      components: [
        createBaseComponent(1, 100),
        createComponent("roster_fit", -4, {
          position: "WR",
          timing: "limited_need",
        }),
      ],
    });
    const second = createRecommendation({
      id: "need-rb",
      overallRank: 8,
      totalScore: 91,
      baseScore: 80,
      components: [
        createBaseComponent(8, 80),
        createComponent("roster_fit", 10, {
          position: "RB",
          timing: "direct_starter_need",
        }),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary
        .decisionFrame,
    ).toBe("value_over_need");
  });

  it("generates a need-over-value frame when context beats a stronger base score", () => {
    const top = createRecommendation({
      id: "need-rb",
      overallRank: 8,
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(8, 80),
        createComponent("roster_fit", 10, {
          position: "RB",
          timing: "direct_starter_need",
        }),
      ],
    });
    const second = createRecommendation({
      id: "value-wr",
      overallRank: 1,
      totalScore: 91,
      baseScore: 90,
      position: "WR",
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary
        .decisionFrame,
    ).toBe("need_over_value");
  });

  it("generates a pocket-pressure frame from supported timing evidence", () => {
    const top = createRecommendation({
      id: "pocket-rb",
      overallRank: 5,
      totalScore: 100,
      baseScore: 85,
      components: [
        createBaseComponent(5, 85),
        createComponent("draft_pocket_timing", 6, timingEvidence()),
      ],
    });
    const second = createRecommendation({
      id: "next-wr",
      overallRank: 8,
      position: "WR",
      totalScore: 91,
      baseScore: 84,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary
        .decisionFrame,
    ).toBe("pocket_pressure");
  });

  it("generates a tier-boundary frame from supported tier evidence", () => {
    const top = createRecommendation({
      id: "tier-rb",
      overallRank: 5,
      totalScore: 100,
      baseScore: 85,
      components: [
        createBaseComponent(5, 85),
        createComponent("overall_tier", 6, {
          overallTierOrigin: "source",
          thresholdMatched: "last_in_best_overall_tier",
        }),
      ],
    });
    const second = createRecommendation({
      id: "next-wr",
      overallRank: 8,
      position: "WR",
      totalScore: 91,
      baseScore: 84,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary
        .decisionFrame,
    ).toBe("tier_boundary");
  });

  it("generates a run-pressure frame from supported run evidence", () => {
    const top = createRecommendation({
      id: "run-rb",
      overallRank: 5,
      totalScore: 100,
      baseScore: 85,
      components: [
        createBaseComponent(5, 85),
        createComponent("positional_run", 4, {
          position: "RB",
          thresholdMatched: "clear_run",
        }),
      ],
    });
    const second = createRecommendation({
      id: "next-wr",
      overallRank: 8,
      position: "WR",
      totalScore: 91,
      baseScore: 84,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary
        .decisionFrame,
    ).toBe("run_pressure");
  });

  it("generates a caveated top-pick frame from a material negative component", () => {
    const top = createRecommendation({
      id: "caveat-wr",
      overallRank: 2,
      position: "WR",
      totalScore: 100,
      baseScore: 95,
      components: [
        createBaseComponent(2, 95),
        createComponent("roster_fit", -12, {
          position: "WR",
          timing: "saturated",
        }),
      ],
    });
    const second = createRecommendation({
      id: "next-rb",
      overallRank: 6,
      totalScore: 91,
      baseScore: 80,
    });
    const bundle = generateStrategicInsights(createInsightInput([top, second]));

    expect(bundle.summary.decisionFrame).toBe("caveated_top_pick");
    expect(bundle.primaryInsight).toMatchObject({
      severity: "warning",
      title: "Recommended with a caveat",
    });
    expect(bundle.candidateInsights[0]).toMatchObject({
      severity: "warning",
      body: "Caveat: WR is already saturated.",
    });
  });

  it("uses the close-call frame before overstating other evidence", () => {
    const top = createRecommendation({
      id: "close-rb",
      overallRank: 5,
      totalScore: 100,
      baseScore: 85,
      components: [
        createBaseComponent(5, 85),
        createComponent("draft_pocket_timing", 6, timingEvidence()),
      ],
    });
    const second = createRecommendation({
      id: "close-wr",
      overallRank: 6,
      position: "WR",
      totalScore: 98,
      baseScore: 84,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second])).summary,
    ).toMatchObject({
      decisionFrame: "close_call",
      scoreGapLabel: "close_call",
    });
  });

  it.each([
    {
      label: "below-threshold positive evidence",
      component: createComponent("positional_run", 2, {
        position: "RB",
        thresholdMatched: "mild_run",
      }),
    },
    {
      label: "defaulted-neutral tier evidence",
      component: createComponent("overall_tier", 6, {
        overallTierOrigin: "defaulted-neutral",
        thresholdMatched: "last_in_best_overall_tier",
      }),
    },
    {
      label: "inactive timing evidence",
      component: createComponent("draft_pocket_timing", 6, timingEvidence({
        forecastStatus: "no-adp",
      })),
    },
    {
      label: "high skip-safety timing evidence",
      component: createComponent("draft_pocket_timing", 6, timingEvidence({
        skipSafety: "high",
        thresholdMatched: "high_skip_safety",
      })),
    },
    {
      label: "unsupported timing evidence",
      component: createComponent("draft_pocket_timing", 6, {
        adpRank: 2,
        exactPlayerDisappeared: true,
      }),
    },
  ])("suppresses $label", ({ component }) => {
    const top = createRecommendation({
      id: "unsupported",
      overallRank: 10,
      totalScore: 100,
      baseScore: 0,
      components: [createBaseComponent(10, 0), component],
    });
    const second = createRecommendation({
      id: "second",
      overallRank: 12,
      position: "WR",
      totalScore: 91,
      baseScore: 0,
      components: [createBaseComponent(12, 0)],
    });
    const bundle = generateStrategicInsights(createInsightInput([top, second]));

    expect(bundle.summary.decisionFrame).toBe("no_material_insight");
    expect(bundle.primaryInsight).toBeNull();
    expect(bundle.candidateInsights).toEqual([]);
  });

  it("returns deterministic output for equivalent inputs", () => {
    const recommendations = [
      createRecommendation({
        id: "player-1",
        overallRank: 1,
        totalScore: 100,
        baseScore: 100,
      }),
      createRecommendation({
        id: "player-2",
        overallRank: 2,
        position: "WR",
        totalScore: 90,
        baseScore: 90,
      }),
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
      createRecommendation({
        id: "player-1",
        overallRank: 1,
        totalScore: 100,
        baseScore: 100,
      }),
      createRecommendation({
        id: "player-2",
        overallRank: 2,
        position: "WR",
        totalScore: 90,
        baseScore: 90,
      }),
    ];
    const input = createInsightInput(recommendations, {
      forecast: createTestForecast(),
    });
    const before = cloneJson(input);

    generateStrategicInsights(input);

    expect(input).toEqual(before);
  });
});
