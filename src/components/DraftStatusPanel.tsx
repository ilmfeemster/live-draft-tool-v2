import type { Draft, DraftPick } from "@/types/draft";

type DraftStatusPanelProps = {
  draft: Draft;
};

function getCurrentPick(draft: Draft): DraftPick {
  const currentPick = draft.picks.find((pick) => pick.pickNumber === draft.currentPickNumber);

  if (!currentPick) {
    throw new Error(`Current pick ${draft.currentPickNumber} is outside the draft order.`);
  }

  return currentPick;
}

export function DraftStatusPanel({ draft }: DraftStatusPanelProps) {
  const currentPick = getCurrentPick(draft);
  const activeTeam = draft.teams.find((team) => team.id === currentPick.teamId);
  const userTeam = draft.teams.find((team) => team.id === draft.userTeamId);
  const totalPicks = draft.teamCount * draft.rounds;

  return (
    <aside className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Draft Status</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Snake order is generated for a {draft.teamCount}-team draft.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-zinc-200 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Current Pick</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-950">
            {draft.currentPickNumber}
          </div>
          <div className="mt-1 text-xs text-zinc-500">of {totalPicks}</div>
        </div>

        <div className="rounded border border-zinc-200 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Round</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-950">{currentPick.round}</div>
          <div className="mt-1 text-xs text-zinc-500">Pick {currentPick.pickInRound}</div>
        </div>
      </div>

      <div className="rounded border border-zinc-200 p-3">
        <div className="text-xs uppercase tracking-wide text-zinc-500">On The Clock</div>
        <div className="mt-1 font-semibold text-zinc-950">{activeTeam?.name ?? "Unknown Team"}</div>
        <div className="mt-1 text-sm text-zinc-600">
          Draft position {activeTeam?.draftPosition ?? "unknown"}
        </div>
      </div>

      <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
        <div className="text-xs uppercase tracking-wide text-emerald-700">Your Team</div>
        <div className="mt-1 font-semibold text-emerald-950">{userTeam?.name ?? "Unknown Team"}</div>
        <div className="mt-1 text-sm text-emerald-800">
          Draft position {userTeam?.draftPosition ?? "unknown"}
        </div>
      </div>
    </aside>
  );
}
