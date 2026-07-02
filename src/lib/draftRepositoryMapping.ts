import type { DraftWorkspace } from "@/types/draft";
import {
  type DraftPickHistoryEntry,
  hydrateDraftFromSettings,
} from "@/lib/draftHydration";
import { parseLeagueSettingsSnapshotJson } from "@/lib/leagueSettingsSnapshot";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { parsePersistedDraftRankingSnapshotJson } from "@/lib/rankingSnapshot";

export type PersistedDraftPickRecord = {
  pickNumber: number;
  playerId: string;
};

export type PersistedRankingSnapshotRecord = {
  rankings: unknown;
};

export type PersistedDraftWorkspaceRecord = {
  id: string;
  leagueSettings: unknown;
  userTeamId: string;
  rankingSnapshot: PersistedRankingSnapshotRecord;
  picks: PersistedDraftPickRecord[];
};

export function mapDraftRecordToWorkspace(
  record: PersistedDraftWorkspaceRecord,
): DraftWorkspace {
  const leagueSettings = parseLeagueSettingsSnapshotJson(record.leagueSettings);
  const rankingSnapshot = parsePersistedDraftRankingSnapshotJson(
    record.rankingSnapshot.rankings,
  );
  const recommendationRankingContextResult =
    createRecommendationRankingContext(rankingSnapshot);
  const pickHistory = mapPickHistory(record.picks);
  const draft = hydrateDraftFromSettings({
    id: record.id,
    leagueSettings,
    userTeamId: record.userTeamId,
    pickHistory,
  });

  return {
    draft,
    rankings: [...rankingSnapshot.rankings],
    leagueSettings,
    recommendationRankingContextResult,
  };
}

function mapPickHistory(
  picks: PersistedDraftPickRecord[],
): DraftPickHistoryEntry[] {
  return picks
    .map((pick) => ({
      pickNumber: pick.pickNumber,
      playerId: pick.playerId,
    }))
    .sort((left, right) => left.pickNumber - right.pickNumber);
}
