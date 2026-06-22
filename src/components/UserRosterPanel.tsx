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

type RosterSlot = {
  id: string;
  label: string;
  acceptedPositions: Position[];
  player: UserRosterPlayer | null;
};

const positions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const flexPositions: Position[] = ["RB", "WR", "TE"];
const allPositions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

const starterSlots: RosterSlot[] = [
  { id: "qb-1", label: "QB", acceptedPositions: ["QB"], player: null },
  { id: "rb-1", label: "RB", acceptedPositions: ["RB"], player: null },
  { id: "rb-2", label: "RB", acceptedPositions: ["RB"], player: null },
  { id: "wr-1", label: "WR", acceptedPositions: ["WR"], player: null },
  { id: "wr-2", label: "WR", acceptedPositions: ["WR"], player: null },
  { id: "te-1", label: "TE", acceptedPositions: ["TE"], player: null },
  { id: "flex-1", label: "FLEX", acceptedPositions: flexPositions, player: null },
  { id: "flex-2", label: "FLEX", acceptedPositions: flexPositions, player: null },
  { id: "dst-1", label: "DST", acceptedPositions: ["DST"], player: null },
  { id: "k-1", label: "K", acceptedPositions: ["K"], player: null },
];

const benchSlots: RosterSlot[] = Array.from({ length: 6 }, (_, index) => ({
  id: `bench-${index + 1}`,
  label: "Bench",
  acceptedPositions: allPositions,
  player: null,
}));

function assignPlayersToSlots(players: UserRosterPlayer[]) {
  const slots: RosterSlot[] = [...starterSlots, ...benchSlots].map((slot) => ({
    ...slot,
    acceptedPositions: [...slot.acceptedPositions],
    player: null,
  }));

  const assignToFirstOpenSlot = (player: UserRosterPlayer, labels: string[]) => {
    const slot = slots.find((candidate) => {
      return (
        labels.includes(candidate.label) &&
        candidate.player === null &&
        candidate.acceptedPositions.includes(player.position)
      );
    });

    if (!slot) {
      return;
    }

    slot.player = player;
  };

  players.forEach((player) => {
    if (player.position === "RB" || player.position === "WR" || player.position === "TE") {
      assignToFirstOpenSlot(player, [player.position, "FLEX", "Bench"]);
      return;
    }

    assignToFirstOpenSlot(player, [player.position, "Bench"]);
  });

  return slots;
}

export function UserRosterPanel({ players }: UserRosterPanelProps) {
  const positionCounts = positions.map((position) => {
    return {
      position,
      count: players.filter((player) => player.position === position).length,
    };
  });
  const rosterSlots = assignPlayersToSlots(players);

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
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-zinc-950">Roster Slots</h3>
        <div className="mt-2 grid gap-2">
          {rosterSlots.map((slot) => (
            <div
              key={slot.id}
              className="grid grid-cols-[4rem_1fr] items-center gap-3 rounded border border-zinc-200 px-3 py-2"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {slot.label}
              </div>
              {slot.player ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-950">{slot.player.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {slot.player.team} - Pick {slot.player.pickNumber}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-zinc-700">
                    {slot.player.position}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-400">Empty</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {players.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Drafted Players</h3>
          <ul className="mt-2 divide-y divide-zinc-100 rounded border border-zinc-200">
            {players.map((player) => (
              <li
                key={player.pickNumber}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div>
                  <div className="font-medium text-zinc-950">{player.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Pick {player.pickNumber} - {player.team}
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-700">{player.position}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
