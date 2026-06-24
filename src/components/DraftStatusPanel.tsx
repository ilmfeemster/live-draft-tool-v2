import type { Draft, DraftPick } from "@/types/draft";

type DraftStatusPanelProps = {
  draft: Draft;
  canUndoLastPick: boolean;
  isDraftComplete: boolean;
  isUserPick: boolean;
  onUndoLastPick: () => void;
};

function getCurrentPick(draft: Draft): DraftPick {
  const currentPick = draft.picks.find((pick) => pick.pickNumber === draft.currentPickNumber);

  if (!currentPick) {
    throw new Error(`Current pick ${draft.currentPickNumber} is outside the draft order.`);
  }

  return currentPick;
}

export function DraftStatusPanel({
  draft,
  canUndoLastPick,
  isDraftComplete,
  isUserPick,
  onUndoLastPick,
}: DraftStatusPanelProps) {
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

      <div
        className={
          isDraftComplete
            ? "rounded border border-zinc-200 bg-zinc-50 p-3"
            : isUserPick
              ? "rounded border border-emerald-200 bg-emerald-50 p-3"
              : "rounded border border-zinc-200 p-3"
        }
      >
        <div
          className={
            isDraftComplete
              ? "text-xs uppercase tracking-wide text-zinc-500"
              : isUserPick
                ? "text-xs uppercase tracking-wide text-emerald-700"
                : "text-xs uppercase tracking-wide text-zinc-500"
          }
        >
          {isDraftComplete ? "Draft Complete" : "On The Clock"}
        </div>
        <div
          className={
            isDraftComplete
              ? "mt-1 font-semibold text-zinc-950"
              : isUserPick
                ? "mt-1 font-semibold text-emerald-950"
                : "mt-1 font-semibold text-zinc-950"
          }
        >
          {isDraftComplete ? "All draft slots are filled." : (activeTeam?.name ?? "Unknown Team")}
        </div>
        {!isDraftComplete ? (
          <div
            className={isUserPick ? "mt-1 text-sm text-emerald-800" : "mt-1 text-sm text-zinc-600"}
          >
            Draft position {activeTeam?.draftPosition ?? "unknown"}
          </div>
        ) : null}
        {isUserPick && !isDraftComplete ? (
          <div className="mt-2 text-sm font-semibold text-emerald-800">Your pick</div>
        ) : null}
      </div>

      <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
        <div className="text-xs uppercase tracking-wide text-emerald-700">Your Team</div>
        <div className="mt-1 font-semibold text-emerald-950">{userTeam?.name ?? "Unknown Team"}</div>
        <div className="mt-1 text-sm text-emerald-800">
          Draft position {userTeam?.draftPosition ?? "unknown"}
        </div>
      </div>

      <button
        type="button"
        className="h-10 rounded bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
        disabled={!canUndoLastPick}
        onClick={onUndoLastPick}
      >
        Undo Last Pick
      </button>
    </aside>
  );
}
