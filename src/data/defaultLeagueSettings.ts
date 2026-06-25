import type { LeagueSettings, RosterSlot } from "@/types/draft";

const defaultRosterSlots: RosterSlot[] = [
  { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
  { id: "rb-1", label: "RB", eligiblePositions: ["RB"] },
  { id: "rb-2", label: "RB", eligiblePositions: ["RB"] },
  { id: "wr-1", label: "WR", eligiblePositions: ["WR"] },
  { id: "wr-2", label: "WR", eligiblePositions: ["WR"] },
  { id: "te-1", label: "TE", eligiblePositions: ["TE"] },
  { id: "flex-1", label: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { id: "flex-2", label: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  { id: "dst-1", label: "DST", eligiblePositions: ["DST"] },
  { id: "k-1", label: "K", eligiblePositions: ["K"] },
  { id: "bench-1", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
  { id: "bench-2", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
  { id: "bench-3", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
  { id: "bench-4", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
  { id: "bench-5", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
  { id: "bench-6", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] },
];

export const defaultLeagueSettings: LeagueSettings = {
  teamCount: 12,
  rounds: defaultRosterSlots.length,
  draftType: "SNAKE",
  scoringFormat: "PPR",
  rosterSlots: defaultRosterSlots,
};
