import type { Recommendation } from "@/types/draft";

type RecommendationsPanelProps = {
  isDraftComplete: boolean;
  isUserPick: boolean;
  recommendations: Recommendation[];
  onDraftPlayer: (playerId: string) => void;
};

export function RecommendationsPanel({
  isDraftComplete,
  isUserPick,
  recommendations,
  onDraftPlayer,
}: RecommendationsPanelProps) {
  return (
    <section
      className={
        isUserPick
          ? "rounded-md border border-emerald-300 bg-emerald-50/40 p-4 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
          : "rounded-md border border-zinc-200 bg-white p-4"
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-zinc-950">Recommendations</h2>
        <p className="text-sm text-zinc-600">
          Ranking-based suggestions from available players.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-4 rounded border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">
          No recommendations available.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {recommendations.map((recommendation, index) => {
            const { ranking, reasons, score } = recommendation;

            return (
              <div
                key={ranking.player.id}
                className="grid gap-3 rounded border border-zinc-200 p-3 md:grid-cols-[2.5rem_1fr_auto]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-sm font-semibold text-emerald-800">
                  {index + 1}
                </div>

                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="font-semibold text-zinc-950">{ranking.player.name}</h3>
                    <span className="text-sm font-medium text-zinc-600">
                      {ranking.player.team} - {ranking.player.position}
                      {ranking.positionRank}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>Overall #{ranking.overallRank}</span>
                    <span>Score {score}</span>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-1">
                    {reasons.map((reason) => (
                      <li
                        key={reason}
                        className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
                      >
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-start md:justify-end">
                  <button
                    type="button"
                    className="h-8 rounded bg-emerald-700 px-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                    disabled={isDraftComplete}
                    onClick={() => onDraftPlayer(ranking.player.id)}
                  >
                    Draft
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
