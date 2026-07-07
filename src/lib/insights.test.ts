import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { generateStrategicInsights } from "@/lib/insights";
import type {
  Draft,
  DraftPocketForecast,
  InsightInput,
  LeagueSettings,
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

function createRosterFitComponent(
  position: Position,
  timing: string,
  delta: number,
  evidence: RecommendationScoreComponent["evidence"] = {},
) {
  return createComponent("roster_fit", delta, {
    position,
    directStarterSlots: 1,
    flexSlots: position === "RB" || position === "WR" || position === "TE" ? 2 : 0,
    benchSlots: 6,
    directStarterOpenings: timing === "direct_starter_need" ? 1 : 0,
    flexOpenings: timing === "flex_need" ? 1 : 0,
    benchOpenings: timing === "bench_depth" ? 1 : 0,
    rosterCountAtPosition: 0,
    timing,
    ...evidence,
  });
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

function createDraftWithUserPicks(playerIds: string[]): Draft {
  return createTestDraft({
    currentPickNumber: playerIds.length + 1,
    picks: playerIds.map((playerId, index) => ({
      pickNumber: index + 1,
      round: index + 1,
      pickInRound: 1,
      teamId: "team-1",
      playerId,
    })),
  });
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

function createInputWithRoster({
  recommendations,
  rosterRankings,
  leagueSettings = defaultLeagueSettings,
}: {
  recommendations: PlayerRecommendation[];
  rosterRankings: RankingEntry[];
  leagueSettings?: LeagueSettings;
}) {
  return createInsightInput(recommendations, {
    draft: createDraftWithUserPicks(
      rosterRankings.map((ranking) => ranking.player.id),
    ),
    rankings: [
      ...recommendations.map((recommendation) => recommendation.ranking),
      ...rosterRankings,
    ],
    leagueSettings,
  });
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

  it("generates a player-quality versus roster-fit tradeoff", () => {
    const top = createRecommendation({
      id: "quality-wr",
      overallRank: 1,
      position: "WR",
      totalScore: 100,
      baseScore: 100,
    });
    const second = createRecommendation({
      id: "need-rb",
      overallRank: 8,
      totalScore: 95,
      baseScore: 80,
      components: [
        createBaseComponent(8, 80),
        createComponent("roster_fit", 10, {
          position: "RB",
          timing: "direct_starter_need",
        }),
      ],
    });

    const bundle = generateStrategicInsights(createInsightInput([top, second]));

    expect(bundle.tradeoffInsights).toEqual([
      expect.objectContaining({
        id: "tradeoff:player_quality_vs_roster_timing:quality-wr:need-rb",
        kind: "tradeoff",
        title: "Player quality versus roster/timing",
        supportedBy: [
          expect.objectContaining({
            playerId: "quality-wr",
            componentId: "base_value",
          }),
          expect.objectContaining({
            playerId: "need-rb",
            componentId: "roster_fit",
          }),
        ],
      }),
    ]);
  });

  it("explains a roster/timing recommendation against a stronger base-value option", () => {
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
      id: "quality-wr",
      overallRank: 1,
      position: "WR",
      totalScore: 95,
      baseScore: 100,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights[0],
    ).toMatchObject({
      id: "tradeoff:player_quality_vs_roster_timing:quality-wr:need-rb",
      title: "Player quality versus roster/timing",
    });
  });

  it("generates a roster-fit versus timing-pressure tradeoff", () => {
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
      id: "timing-wr",
      overallRank: 9,
      position: "WR",
      totalScore: 96,
      baseScore: 80,
      components: [
        createBaseComponent(9, 80),
        createComponent("draft_pocket_timing", 6, timingEvidence({
          candidatePosition: "WR",
          profilePosition: "WR",
        })),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights[0],
    ).toMatchObject({
      id: "tradeoff:roster_fit_vs_timing_pressure:need-rb:timing-wr",
      title: "Roster fit versus timing pressure",
      supportedBy: [
        expect.objectContaining({
          playerId: "need-rb",
          componentId: "roster_fit",
        }),
        expect.objectContaining({
          playerId: "timing-wr",
          componentId: "draft_pocket_timing",
        }),
      ],
    });
  });

  it("generates a player-quality with caveat tradeoff", () => {
    const top = createRecommendation({
      id: "quality-wr",
      overallRank: 1,
      position: "WR",
      totalScore: 100,
      baseScore: 100,
      components: [
        createBaseComponent(1, 100),
        createComponent("roster_fit", -12, {
          position: "WR",
          timing: "saturated",
        }),
      ],
    });
    const second = createRecommendation({
      id: "clean-rb",
      overallRank: 8,
      totalScore: 96,
      baseScore: 80,
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights[0],
    ).toMatchObject({
      id: "tradeoff:player_quality_vs_caveat:quality-wr:clean-rb",
      severity: "warning",
      title: "Player quality with a caveat",
      supportedBy: [
        expect.objectContaining({
          playerId: "quality-wr",
          componentId: "base_value",
        }),
        expect.objectContaining({
          playerId: "quality-wr",
          componentId: "roster_fit",
        }),
      ],
    });
  });

  it("generates a value versus roster/timing tradeoff", () => {
    const top = createRecommendation({
      id: "value-wr",
      overallRank: 12,
      position: "WR",
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(12, 80),
        createComponent("value_opportunity", 5, {
          currentPickNumber: 24,
          overallRank: 12,
          thresholdMatched: "clear_value",
        }),
      ],
    });
    const second = createRecommendation({
      id: "need-rb",
      overallRank: 14,
      totalScore: 96,
      baseScore: 80,
      components: [
        createBaseComponent(14, 80),
        createComponent("roster_fit", 10, {
          position: "RB",
          timing: "direct_starter_need",
        }),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights[0],
    ).toMatchObject({
      id: "tradeoff:value_vs_roster_timing:value-wr:need-rb",
      title: "Value versus roster/timing",
    });
  });

  it("generates a restrained close-cluster tradeoff for similar supported cases", () => {
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
      id: "need-wr",
      overallRank: 9,
      position: "WR",
      totalScore: 98,
      baseScore: 80,
      components: [
        createBaseComponent(9, 80),
        createComponent("roster_fit", 10, {
          position: "WR",
          timing: "direct_starter_need",
        }),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights[0],
    ).toMatchObject({
      id: "tradeoff:close_same_strength:need-rb:need-wr",
      title: "Close options with similar support",
    });
  });

  it("suppresses tradeoffs for a clear leader", () => {
    const top = createRecommendation({
      id: "quality-wr",
      overallRank: 1,
      position: "WR",
      totalScore: 100,
      baseScore: 100,
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
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights,
    ).toEqual([]);
  });

  it("suppresses tradeoffs when close same-position options have no useful contrast", () => {
    const top = createRecommendation({
      id: "need-rb-1",
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
      id: "need-rb-2",
      overallRank: 9,
      totalScore: 98,
      baseScore: 80,
      components: [
        createBaseComponent(9, 80),
        createComponent("roster_fit", 10, {
          position: "RB",
          timing: "direct_starter_need",
        }),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top, second]))
        .tradeoffInsights,
    ).toEqual([]);
  });

  it("generates roster context for an open RB starter need", () => {
    const top = createRecommendation({
      id: "starter-rb",
      overallRank: 8,
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(8, 80),
        createRosterFitComponent("RB", "direct_starter_need", 10),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights).toEqual([
      expect.objectContaining({
        id: "roster_context:direct_starter_need:starter-rb",
        kind: "roster_context",
        severity: "positive",
        title: "Open RB starter slot",
        body: "starter-rb fits one of 2 open RB starter slots.",
        supportedBy: [
          expect.objectContaining({
            playerId: "starter-rb",
            componentId: "roster_fit",
            reasonId: "roster_fit:reason",
          }),
        ],
      }),
    ]);
  });

  it("generates roster context for WR flex utility", () => {
    const top = createRecommendation({
      id: "flex-wr",
      overallRank: 12,
      position: "WR",
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(12, 80),
        createRosterFitComponent("WR", "flex_need", 5),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:flex_need:flex-wr",
      severity: "positive",
      title: "WR still carries flex utility",
      body: "flex-wr helps fill remaining flex utility in this roster format.",
    });
  });

  it("uses cautious TE flex language", () => {
    const top = createRecommendation({
      id: "flex-te",
      overallRank: 12,
      position: "TE",
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(12, 80),
        createRosterFitComponent("TE", "flex_need", 5),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:flex_need:flex-te",
      title: "TE has flex eligibility here",
      body: "flex-te is flex-eligible in this format, but TE depth should stay tied to supported roster need.",
    });
  });

  it("generates roster context for useful bench depth", () => {
    const top = createRecommendation({
      id: "bench-rb",
      overallRank: 24,
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(24, 80),
        createRosterFitComponent("RB", "bench_depth", 3),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:bench_depth:bench-rb",
      severity: "positive",
      title: "Bench depth is still useful at RB",
      body: "bench-rb still has useful bench-depth value for this roster shape.",
    });
  });

  it("generates a roster caveat for a saturated WR recommendation", () => {
    const top = createRecommendation({
      id: "saturated-wr",
      overallRank: 3,
      position: "WR",
      totalScore: 100,
      baseScore: 95,
      components: [
        createBaseComponent(3, 95),
        createRosterFitComponent("WR", "saturated", -12),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:saturated:saturated-wr",
      severity: "warning",
      title: "WR is close to saturated",
      body: "saturated-wr carries a roster caveat because WR is already near its useful capacity.",
    });
  });

  it("describes QB as a single-start slot when a close option carries that caveat", () => {
    const top = createRecommendation({
      id: "need-rb",
      overallRank: 10,
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(10, 80),
        createRosterFitComponent("RB", "direct_starter_need", 10),
      ],
    });
    const second = createRecommendation({
      id: "limited-qb",
      overallRank: 7,
      position: "QB",
      totalScore: 98,
      baseScore: 90,
      components: [
        createBaseComponent(7, 90),
        createRosterFitComponent("QB", "limited_need", -6),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([second, top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:limited_need:limited-qb",
      severity: "warning",
      title: "QB is a single-start slot here",
      body: "limited-qb has limited roster utility unless this format creates more QB demand.",
    });
  });

  it("generates an early DST roster caveat from existing roster-fit evidence", () => {
    const top = createRecommendation({
      id: "early-dst",
      overallRank: 80,
      position: "DST",
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(80, 80),
        createRosterFitComponent("DST", "early_def_k", -20),
      ],
    });
    const bundle = generateStrategicInsights(createInsightInput([top]));

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:early_def_k:early-dst",
      severity: "warning",
      title: "DST is early for this roster phase",
      body: "early-dst carries a roster-timing caveat for this draft phase.",
    });
  });

  it("suppresses roster context for neutral or unsupported roster-fit evidence", () => {
    const top = createRecommendation({
      id: "neutral-rb",
      overallRank: 12,
      totalScore: 100,
      baseScore: 90,
      components: [
        createBaseComponent(12, 90),
        createRosterFitComponent("RB", "neutral", 0),
      ],
    });

    expect(
      generateStrategicInsights(createInsightInput([top])).rosterInsights,
    ).toEqual([]);
  });

  it("derives single-start language from non-default roster settings", () => {
    const twoQbSettings: LeagueSettings = {
      ...defaultLeagueSettings,
      rosterSlots: [
        { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
        { id: "qb-2", label: "QB", eligiblePositions: ["QB"] },
        { id: "bench-1", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
      ],
    };
    const top = createRecommendation({
      id: "limited-qb",
      overallRank: 10,
      position: "QB",
      totalScore: 100,
      baseScore: 90,
      components: [
        createBaseComponent(10, 90),
        createRosterFitComponent("QB", "limited_need", -6),
      ],
    });
    const bundle = generateStrategicInsights(
      createInputWithRoster({
        recommendations: [top],
        rosterRankings: [createRanking("rostered-qb", 1, "QB")],
        leagueSettings: twoQbSettings,
      }),
    );

    expect(bundle.rosterInsights[0]).toMatchObject({
      id: "roster_context:limited_need:limited-qb",
      title: "Limited roster need at QB",
    });
  });

  it("includes deterministic roster-fit support references", () => {
    const top = createRecommendation({
      id: "supported-wr",
      overallRank: 12,
      position: "WR",
      totalScore: 100,
      baseScore: 80,
      components: [
        createBaseComponent(12, 80),
        createRosterFitComponent("WR", "flex_need", 5),
      ],
    });
    const input = createInsightInput([top]);

    expect(generateStrategicInsights(input).rosterInsights[0]?.supportedBy).toEqual([
      {
        playerId: "supported-wr",
        componentId: "roster_fit",
        evidenceKeys: [
          "benchOpenings",
          "benchSlots",
          "directStarterOpenings",
          "directStarterSlots",
          "flexOpenings",
          "flexSlots",
          "position",
          "rosterCountAtPosition",
          "timing",
        ],
        reasonId: "roster_fit:reason",
      },
    ]);
    expect(generateStrategicInsights(input)).toEqual(
      generateStrategicInsights(cloneJson(input)),
    );
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
