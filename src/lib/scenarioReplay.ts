import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { draftPlayerInDraft } from "@/lib/draftState";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import { materializeScenarioV1Rankings } from "@/lib/scenarioValidation";
import type { Draft, PlayerRecommendation } from "@/types/draft";
import type { RankingSnapshot } from "@/types/rankings";
import type {
  ScenarioDocument,
  ScenarioV1,
  ScenarioV2,
} from "@/types/scenario";

export const SCENARIO_REPLAY_DRAFT_ID = "scenario-replay" as const;

export type ScenarioReplayError = {
  code: "pick-rejected";
  pickIndex: number;
  playerId: string;
  pickNumber: number;
  message: string;
};

export type ScenarioReplayResult =
  | {
      ok: true;
      draft: Draft;
      recommendations: PlayerRecommendation[];
    }
  | {
      ok: false;
      error: ScenarioReplayError;
    };

export function replayScenarioV1(scenario: ScenarioV1): ScenarioReplayResult {
  return replayScenario(scenario);
}

export function replayScenarioV2(scenario: ScenarioV2): ScenarioReplayResult {
  return replayScenario(scenario);
}

export function replayScenario(
  scenario: ScenarioDocument,
): ScenarioReplayResult {
  const rankingSnapshot = createScenarioRankingSnapshot(scenario);
  const rankings = [...rankingSnapshot.rankings];
  const recommendationRankingContextResult =
    createRecommendationRankingContext(rankingSnapshot);

  if (!recommendationRankingContextResult.ok) {
    throw new Error(
      "Validated scenario ranking context could not be normalized.",
    );
  }

  const baseDraft = hydrateDraftFromSettings({
    id: SCENARIO_REPLAY_DRAFT_ID,
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
  });
  let workingDraft = baseDraft;
  let targetDraft =
    scenario.replayTarget.appliedPickCount === 0 ? baseDraft : undefined;

  for (const [pickIndex, pick] of scenario.pickHistory.entries()) {
    const attemptedDraft = workingDraft;
    const nextDraft = draftPlayerInDraft(attemptedDraft, pick.playerId);

    if (nextDraft === attemptedDraft) {
      return {
        ok: false,
        error: {
          code: "pick-rejected",
          pickIndex,
          playerId: pick.playerId,
          pickNumber: attemptedDraft.currentPickNumber,
          message: `Pick history entry ${pickIndex} was rejected by the Draft State Engine.`,
        },
      };
    }

    workingDraft = nextDraft;

    if (pickIndex + 1 === scenario.replayTarget.appliedPickCount) {
      targetDraft = workingDraft;
    }
  }

  if (!targetDraft) {
    throw new Error("Validated scenario replay target was not reached.");
  }

  const recommendations = generatePlayerRecommendations({
    draft: targetDraft,
    rankings,
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
    recommendationRankingContext:
      recommendationRankingContextResult.context,
  });

  return {
    ok: true,
    draft: targetDraft,
    recommendations,
  };
}

function createScenarioRankingSnapshot(
  scenario: ScenarioDocument,
): RankingSnapshot {
  if (scenario.schemaVersion === 1) {
    return {
      rankings: materializeScenarioV1Rankings(
        scenario.rankingContext.rankings,
      ),
    };
  }

  return {
    rankings: scenario.rankingContext.rankings.map((ranking) => ({
      ...ranking,
      player: { ...ranking.player },
    })),
    tierSemantics: scenario.rankingContext.tierSemantics,
  };
}
