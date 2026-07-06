import type { InsightInput, StrategicInsightBundle } from "@/types/draft";

export function generateStrategicInsights(
  input: InsightInput,
): StrategicInsightBundle {
  return {
    summary: {
      leadingPlayerId: input.recommendations[0]?.playerId ?? null,
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
