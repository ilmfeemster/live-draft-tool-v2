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
