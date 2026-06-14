export type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";

export type Player = {
  id: string;
  name: string;
  team: string;
  position: Position;
};

export type RankingEntry = {
  player: Player;
  overallRank: number;
  positionRank: number;
  tier: number;
};

export type Team = {
  id: string;
  name: string;
  draftPosition: number;
};

export type DraftPick = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  teamId: string;
  playerId?: string;
};

export type Draft = {
  id: string;
  teamCount: number;
  rounds: number;
  userTeamId: string;
  currentPickNumber: number;
  teams: Team[];
  picks: DraftPick[];
};
