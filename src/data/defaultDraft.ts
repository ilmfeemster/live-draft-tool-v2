import type { Draft } from "@/types/draft";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";

const userDraftPosition = 2;

export const defaultDraft: Draft = {
  id: "default-draft",
  teamCount: defaultLeagueSettings.teamCount,
  rounds: defaultLeagueSettings.rounds,
  userTeamId: `team-${userDraftPosition}`,
  currentPickNumber: 1,
  teams: createDraftTeams(defaultLeagueSettings.teamCount),
  picks: generateSnakeDraftOrder(defaultLeagueSettings.teamCount, defaultLeagueSettings.rounds),
};
