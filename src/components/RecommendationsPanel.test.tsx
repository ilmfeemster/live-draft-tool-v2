import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import type { PlayerRecommendation } from "@/types/draft";

describe("RecommendationsPanel diagnostics", () => {
  it("renders engine order, raw scores, cap evidence, and exact reasons", () => {
    const recommendations = createRecommendations();
    const markup = renderToStaticMarkup(
      <RecommendationsPanel
        isDraftComplete={false}
        isUserPick={true}
        recommendations={recommendations}
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
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain("disabled=\"\"");
  });
});

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
