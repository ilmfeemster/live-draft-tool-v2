import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import {
  importScenarioV1Json,
  type ImportScenarioV1Result,
} from "@/lib/scenarioPortability";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import type {
  Draft,
  LeagueSettings,
  PlayerRecommendation,
  Position,
  RankingEntry,
  RecommendationRankingContextResult,
} from "@/types/draft";
import type { RankingTierSemantics } from "@/types/rankings";
import type { ScenarioV1 } from "@/types/scenario";

export const TRANSIENT_MANUAL_DRAFT_ID = "transient-manual" as const;

export type TransientSessionCore = {
  draft: Draft;
  baselineDraft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
  rankingTierSemantics: RankingTierSemantics;
  recommendations: PlayerRecommendation[];
  recommendationRankingContextResult: RecommendationRankingContextResult;
  isDirty: boolean;
};

export type TransientScenarioSession = TransientSessionCore & {
  kind: "scenario";
  sourceJson: string;
  scenario: ScenarioV1;
};

export type TransientManualSession = TransientSessionCore & {
  kind: "manual";
};

export type TransientDraftSession =
  | TransientScenarioSession
  | TransientManualSession;

export type TransientSessionLoadResult =
  | { ok: true; session: TransientScenarioSession }
  | Extract<ImportScenarioV1Result, { ok: false }>;

export type TransientSessionResetResult = TransientSessionLoadResult;

export type TransientDestructiveAction = "reset" | "restart" | "replace";

export function createTransientScenarioSession(
  sourceJson: string,
): TransientSessionLoadResult {
  const imported = importScenarioV1Json(sourceJson);

  if (!imported.ok) {
    return imported;
  }

  const rankings = imported.scenario.rankingContext.rankings;
  const rankingTierSemantics = createScenarioV1TierSemantics(rankings);
  const recommendationRankingContextResult =
    createRecommendationRankingContext({
      rankings,
      tierSemantics: rankingTierSemantics,
    });

  return {
    ok: true,
    session: {
      kind: "scenario",
      sourceJson,
      scenario: imported.scenario,
      draft: imported.draft,
      baselineDraft: imported.draft,
      rankings,
      leagueSettings: imported.scenario.leagueSettings,
      rankingTierSemantics,
      recommendations: generateRecommendations(
        imported.draft,
        rankings,
        imported.scenario.leagueSettings,
        recommendationRankingContextResult,
      ),
      recommendationRankingContextResult,
      isDirty: false,
    },
  };
}

export function draftPlayerInTransientSession(
  session: TransientScenarioSession,
  playerId: string,
): TransientScenarioSession;
export function draftPlayerInTransientSession(
  session: TransientManualSession,
  playerId: string,
): TransientManualSession;
export function draftPlayerInTransientSession(
  session: TransientDraftSession,
  playerId: string,
): TransientDraftSession;
export function draftPlayerInTransientSession(
  session: TransientDraftSession,
  playerId: string,
): TransientDraftSession {
  const nextDraft = draftPlayerInDraft(session.draft, playerId);

  if (nextDraft === session.draft) {
    return session;
  }

  return updateTransientSessionDraft(session, nextDraft);
}

export function undoLastPickInTransientSession(
  session: TransientScenarioSession,
): TransientScenarioSession;
export function undoLastPickInTransientSession(
  session: TransientManualSession,
): TransientManualSession;
export function undoLastPickInTransientSession(
  session: TransientDraftSession,
): TransientDraftSession;
export function undoLastPickInTransientSession(
  session: TransientDraftSession,
): TransientDraftSession {
  const nextDraft = undoLastDraftPick(session.draft);

  if (nextDraft === session.draft) {
    return session;
  }

  return updateTransientSessionDraft(session, nextDraft);
}

export function resetTransientScenarioSession(
  session: TransientScenarioSession,
): TransientSessionResetResult {
  return createTransientScenarioSession(session.sourceJson);
}

export function restartTransientSession(
  session: TransientDraftSession,
): TransientManualSession {
  const draft = hydrateDraftFromSettings({
    id: TRANSIENT_MANUAL_DRAFT_ID,
    leagueSettings: session.leagueSettings,
    userTeamId: session.draft.userTeamId,
  });

  return {
    kind: "manual",
    draft,
    baselineDraft: draft,
    rankings: session.rankings,
    leagueSettings: session.leagueSettings,
    rankingTierSemantics: session.rankingTierSemantics,
    recommendations: generateRecommendations(
      draft,
      session.rankings,
      session.leagueSettings,
      session.recommendationRankingContextResult,
    ),
    recommendationRankingContextResult:
      session.recommendationRankingContextResult,
    isDirty: false,
  };
}

export function requiresTransientSessionConfirmation(
  session: TransientDraftSession,
  action: TransientDestructiveAction,
): boolean {
  if (action === "reset" && session.kind !== "scenario") {
    return false;
  }

  return session.isDirty;
}

function updateTransientSessionDraft<TSession extends TransientDraftSession>(
  session: TSession,
  draft: Draft,
): TSession {
  return {
    ...session,
    draft,
    recommendations: generateRecommendations(
      draft,
      session.rankings,
      session.leagueSettings,
      session.recommendationRankingContextResult,
    ),
    isDirty: !areDraftsEqual(draft, session.baselineDraft),
  };
}

function generateRecommendations(
  draft: Draft,
  rankings: RankingEntry[],
  leagueSettings: LeagueSettings,
  recommendationRankingContextResult: RecommendationRankingContextResult,
): PlayerRecommendation[] {
  return generatePlayerRecommendations({
    draft,
    rankings,
    leagueSettings,
    userTeamId: draft.userTeamId,
    ...(recommendationRankingContextResult.ok
      ? {
          recommendationRankingContext:
            recommendationRankingContextResult.context,
        }
      : {}),
  });
}

function areDraftsEqual(left: Draft, right: Draft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createScenarioV1TierSemantics(
  rankings: readonly RankingEntry[],
): RankingTierSemantics {
  const recommendation: Partial<Record<Position, "neutral">> = {};

  rankings.forEach((ranking) => {
    recommendation[ranking.player.position] = "neutral";
  });

  return {
    source: { kind: "none" },
    recommendation,
  };
}
