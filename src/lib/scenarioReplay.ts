import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { draftPlayerInDraft } from "@/lib/draftState";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import type { Draft, PlayerRecommendation } from "@/types/draft";
import type { ScenarioV1 } from "@/types/scenario";

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
    rankings: scenario.rankingContext.rankings,
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
  });

  return {
    ok: true,
    draft: targetDraft,
    recommendations,
  };
}
