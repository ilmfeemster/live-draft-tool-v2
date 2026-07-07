import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import type {
  PlayerRecommendation,
  StrategicInsightBundle,
} from "@/types/draft";

describe("RecommendationsPanel diagnostics", () => {
  it("renders engine order, raw scores, cap evidence, and exact reasons", () => {
    const recommendations = createRecommendations();
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={recommendations}
        strategicInsights={createNeutralStrategicInsights()}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup.indexOf("Diagnostic Runner")).toBeLessThan(
      markup.indexOf("Uncapped Receiver"),
    );
    expect(markup).toContain("Score 108.0");
    expect(markup).toContain("Score details");
    expect(markup).toContain("Returned position");
    expect(markup).toContain("#1");
    expect(markup).toContain("diagnostic-rb");
    expect(markup).toContain("Final total");
    expect(markup).toContain("108.00");
    expect(markup).toContain("Base value");
    expect(markup).toContain("90.00");
    expect(markup).toContain("Applied context");
    expect(markup).toContain("18.00");
    expect(markup).toContain("roster_fit");
    expect(markup).toContain("+10.00 (positive)");
    expect(markup).toContain("value_opportunity");
    expect(markup).toContain("-4.00 (negative)");
    expect(markup).toContain("urgency_cap");
    expect(markup).toContain("-5.00 (negative)");
    expect(markup).toContain("context_cap");
    expect(markup).toContain("-3.00 (negative)");
    expect(markup).toContain("rawScore");
    expect(markup).toContain("adjustedScore");
    expect(markup).toContain("maxScore");
    expect(markup).toContain("tier_cliff:major_tier_cliff");
    expect(markup).toContain("Source: tier_cliff");
    expect(markup).toContain("A major RB tier drop follows.");
    expect(markup).toContain("No cap adjustments.");
    expect(markup).toContain("No score-backed reasons.");
    expect(markup).not.toContain("disabled=\"\"");
  });

  it("preserves disabled Draft buttons when the draft is complete", () => {
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={true}
        isUserPick={false}
        recommendations={createRecommendations().slice(0, 1)}
        strategicInsights={createNeutralStrategicInsights()}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain("disabled=\"\"");
  });

  it("renders neutral recommendation output without tier-cliff details", () => {
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={[createNeutralRecommendation()]}
        strategicInsights={createNeutralStrategicInsights()}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain("Neutral Receiver");
    expect(markup).toContain("Score 82.0");
    expect(markup).toContain("base_value");
    expect(markup).toContain("roster_fit");
    expect(markup).toContain("No cap adjustments.");
    expect(markup).toContain("No score-backed reasons.");
    expect(markup).not.toContain("tier_cliff");
    expect(markup).not.toContain("A major WR tier drop follows.");
  });

  it("renders strategic insights in deterministic order", () => {
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={createRecommendations()}
        strategicInsights={createStrategicInsights()}
        onDraftPlayer={vi.fn()}
      />,
    );

    const primaryPosition = markup.indexOf("Close call at the top");
    const candidatePosition = markup.indexOf("Diagnostic Runner carries starter utility.");
    const tradeoffPosition = markup.indexOf("Player quality versus roster timing");
    const rosterPosition = markup.indexOf("Open RB starter slot");
    const caveatPosition = markup.indexOf("Recommended with a caveat");

    expect(markup).toContain("strategic-insights");
    expect(primaryPosition).toBeGreaterThanOrEqual(0);
    expect(primaryPosition).toBeLessThan(candidatePosition);
    expect(candidatePosition).toBeLessThan(tradeoffPosition);
    expect(tradeoffPosition).toBeLessThan(rosterPosition);
    expect(rosterPosition).toBeLessThan(caveatPosition);
    expect(markup).not.toContain("Comparable profiles remain later");
  });

  it("falls back to a board insight when no roster insight is visible", () => {
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={createRecommendations()}
        strategicInsights={createStrategicInsights({ rosterInsights: [] })}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain("Comparable profiles remain later");
  });

  it("suppresses the strategic insight area for neutral bundles", () => {
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={createRecommendations()}
        strategicInsights={createNeutralStrategicInsights()}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).not.toContain("strategic-insights");
    expect(markup).not.toContain("Close call at the top");
  });
});

function createNeutralStrategicInsights(): StrategicInsightBundle {
  return {
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
  };
}

function createStrategicInsights(
  overrides: Partial<StrategicInsightBundle> = {},
): StrategicInsightBundle {
  return {
    ...createNeutralStrategicInsights(),
    summary: {
      leadingPlayerId: "diagnostic-rb",
      decisionFrame: "close_call",
      scoreGapLabel: "close_call",
    },
    primaryInsight: {
      id: "primary",
      kind: "primary_decision",
      severity: "info",
      title: "Close call at the top",
      body: "The top options are close enough to compare context.",
      supportedBy: [{ playerId: "diagnostic-rb" }],
    },
    candidateInsights: [
      {
        id: "candidate",
        kind: "candidate_summary",
        severity: "positive",
        title: "Diagnostic Runner carries starter utility.",
        body: "Existing roster evidence supports this candidate.",
        supportedBy: [{ playerId: "diagnostic-rb", componentId: "roster_fit" }],
      },
    ],
    tradeoffInsights: [
      {
        id: "tradeoff",
        kind: "tradeoff",
        severity: "info",
        title: "Player quality versus roster timing",
        body: "The second option offers a different decision shape.",
        supportedBy: [
          { playerId: "diagnostic-rb", componentId: "base_value" },
          { playerId: "uncapped-wr", componentId: "roster_fit" },
        ],
      },
    ],
    rosterInsights: [
      {
        id: "roster",
        kind: "roster_context",
        severity: "positive",
        title: "Open RB starter slot",
        body: "The current roster still has direct RB utility.",
        supportedBy: [{ playerId: "diagnostic-rb", componentId: "roster_fit" }],
      },
    ],
    boardInsights: [
      {
        id: "board",
        kind: "board_context",
        severity: "info",
        title: "Comparable profiles remain later",
        body: "Board evidence does not add urgency here.",
        supportedBy: [{ playerId: "uncapped-wr" }],
      },
    ],
    caveats: [
      {
        id: "caveat",
        kind: "caveat",
        severity: "warning",
        title: "Recommended with a caveat",
        body: "A negative component is still material.",
        supportedBy: [{ playerId: "diagnostic-rb", componentId: "value_opportunity" }],
      },
    ],
    suppressedSignals: [],
    ...overrides,
  };
}

function createNeutralRecommendation(): PlayerRecommendation {
  return {
    ranking: {
      player: {
        id: "neutral-wr",
        name: "Neutral Receiver",
        team: "TST",
        position: "WR",
      },
      overallRank: 12,
      adpRank: 13,
      positionRank: 5,
      tier: 1,
    },
    playerId: "neutral-wr",
    totalScore: 82,
    baseScore: 80,
    contextScore: 2,
    components: [
      { id: "base_value", delta: 80, direction: "positive" },
      { id: "roster_fit", delta: 2, direction: "positive" },
    ],
    scoreAdjustments: [],
    reasons: [],
  };
}

function createRecommendations(): PlayerRecommendation[] {
  return [
    {
      ranking: {
        player: {
          id: "diagnostic-rb",
          name: "Diagnostic Runner",
          team: "TST",
          position: "RB",
        },
        overallRank: 8,
        adpRank: 9,
        positionRank: 3,
        tier: 1,
      },
      playerId: "diagnostic-rb",
      totalScore: 108,
      baseScore: 90,
      contextScore: 18,
      components: [
        {
          id: "base_value",
          delta: 90,
          direction: "positive",
          evidence: { overallRank: 8 },
        },
        {
          id: "roster_fit",
          delta: 10,
          direction: "positive",
          evidence: { timing: "direct_starter_need" },
        },
        {
          id: "tier_cliff",
          delta: 12,
          direction: "positive",
          evidence: { thresholdMatched: "major_tier_cliff" },
        },
        {
          id: "positional_scarcity",
          delta: 5,
          direction: "positive",
        },
        {
          id: "positional_run",
          delta: 3,
          direction: "positive",
        },
        {
          id: "value_opportunity",
          delta: -4,
          direction: "negative",
          evidence: { thresholdMatched: "clear_reach" },
        },
      ],
      scoreAdjustments: [
        {
          id: "urgency_cap",
          delta: -5,
          direction: "negative",
          evidence: { rawScore: 17, adjustedScore: 12, maxScore: 12 },
        },
        {
          id: "context_cap",
          delta: -3,
          direction: "negative",
          evidence: {
            rawScore: 21,
            adjustedScore: 18,
            minScore: -24,
            maxScore: 18,
          },
        },
      ],
      reasons: [
        {
          id: "tier_cliff:major_tier_cliff",
          text: "A major RB tier drop follows.",
          sourceComponentId: "tier_cliff",
          priority: 18,
        },
      ],
    },
    {
      ranking: {
        player: {
          id: "uncapped-wr",
          name: "Uncapped Receiver",
          team: "TST",
          position: "WR",
        },
        overallRank: 9,
        adpRank: null,
        positionRank: 4,
        tier: 2,
      },
      playerId: "uncapped-wr",
      totalScore: 80,
      baseScore: 80,
      contextScore: 0,
      components: [
        { id: "base_value", delta: 80, direction: "positive" },
        { id: "roster_fit", delta: 0, direction: "neutral" },
      ],
      scoreAdjustments: [],
      reasons: [],
    },
  ];
}
