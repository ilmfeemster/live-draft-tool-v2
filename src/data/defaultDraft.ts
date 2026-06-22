import type { Draft } from "@/types/draft";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";

const teamCount = 4;
const rounds = 16;
const userDraftPosition = 2;

export const defaultDraft: Draft = {
  id: "default-draft",
  teamCount,
  rounds,
  userTeamId: `team-${userDraftPosition}`,
  currentPickNumber: 1,
  teams: createDraftTeams(teamCount),
  picks: generateSnakeDraftOrder(teamCount, rounds),
};
