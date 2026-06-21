import type { Position } from "@/types/draft";

export type UserRosterPlayer = {
  pickNumber: number;
  name: string;
  team: string;
  position: Position;
};

type UserRosterPanelProps = {
  players: UserRosterPlayer[];
};

const positions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function UserRosterPanel({ players }: UserRosterPanelProps) {
  const positionCounts = positions.map((position) => {
    return {
      position,
      count: players.filter((player) => player.position === position).length,
    };
  });

  return (
    <section className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Your Roster</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Players drafted by your team appear here.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {positionCounts.map(({ position, count }) => (
          <div key={position} className="rounded border border-zinc-200 p-2">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{position}</div>
            <div className="mt-1 text-lg font-semibold text-zinc-950">{count}</div>
          </div>
        ))}
      </div>

      {players.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">
          No players drafted yet.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded border border-zinc-200">
          {players.map((player) => (
            <li key={player.pickNumber} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <div className="font-medium text-zinc-950">{player.name}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  Pick {player.pickNumber} · {player.team}
                </div>
              </div>
              <div className="text-sm font-semibold text-zinc-700">{player.position}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
