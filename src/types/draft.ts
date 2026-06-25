export type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";
export type DraftType = "SNAKE";
export type ScoringFormat = "PPR";

export type Player = {
  id: string;
  name: string;
  team: string;
  position: Position;
};

export type RankingEntry = {
  player: Player;
  overallRank: number;
  adpRank: number | null;
  positionRank: number;
  tier: number;
};

export type Recommendation = {
  ranking: RankingEntry;
  score: number;
  reasons: string[];
};

export type UserRosterPlayer = {
  pickNumber: number;
  name: string;
  team: string;
  position: Position;
};

export type UserRoster = {
  players: UserRosterPlayer[];
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

export type RosterSlot = {
  id: string;
  label: string;
  eligiblePositions: Position[];
};

export type LeagueSettings = {
  teamCount: number;
  rounds: number;
  draftType: DraftType;
  scoringFormat: ScoringFormat;
  rosterSlots: RosterSlot[];
};

export type DraftWorkspace = {
  draft: Draft;
  rankings: RankingEntry[];
  leagueSettings: LeagueSettings;
};
