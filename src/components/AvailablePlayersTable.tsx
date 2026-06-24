"use client";

import { useMemo, useState } from "react";
import type { Position, RankingEntry } from "@/types/draft";

type PositionFilter = Position | "ALL";

const positionFilters: PositionFilter[] = ["ALL", "QB", "RB", "WR", "TE", "DST", "K"];

type AvailablePlayersTableProps = {
  isDraftComplete: boolean;
  rankings: RankingEntry[];
  onDraftPlayer: (playerId: string) => void;
};

export function AvailablePlayersTable({
  isDraftComplete,
  rankings,
  onDraftPlayer,
}: AvailablePlayersTableProps) {
  const [selectedPosition, setSelectedPosition] = useState<PositionFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const availablePlayers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rankings
      .filter((entry) => {
        return selectedPosition === "ALL" || entry.player.position === selectedPosition;
      })
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          entry.player.name.toLowerCase().includes(normalizedQuery) ||
          entry.player.team.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => a.overallRank - b.overallRank);
  }, [rankings, searchQuery, selectedPosition]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Available Players</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {availablePlayers.length} players shown from the imported rankings.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            Search
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search players or teams"
              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 lg:w-72"
            />
          </label>

          <div className="flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-zinc-100 p-1">
            {positionFilters.map((position) => {
              const isSelected = selectedPosition === position;

              return (
                <button
                  key={position}
                  type="button"
                  className={`h-8 rounded px-3 text-sm font-medium transition ${
                    isSelected
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950"
                  }`}
                  onClick={() => setSelectedPosition(position)}
                >
                  {position}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-20 border-b border-zinc-200 px-4 py-3 font-semibold">Rank</th>
                <th className="border-b border-zinc-200 px-4 py-3 font-semibold">Player</th>
                <th className="w-24 border-b border-zinc-200 px-4 py-3 font-semibold">Team</th>
                <th className="w-28 border-b border-zinc-200 px-4 py-3 font-semibold">Pos</th>
                <th className="w-24 border-b border-zinc-200 px-4 py-3 font-semibold">Tier</th>
                <th className="w-28 border-b border-zinc-200 px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {availablePlayers.length > 0 ? (
                availablePlayers.map((entry) => (
                  <tr key={entry.player.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-zinc-700">{entry.overallRank}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-950">{entry.player.name}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{entry.player.team}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-950">
                        {entry.player.position}
                        {entry.positionRank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{entry.tier}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="h-8 rounded bg-emerald-700 px-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                        disabled={isDraftComplete}
                        onClick={() => onDraftPlayer(entry.player.id)}
                      >
                        Draft
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No available players match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
