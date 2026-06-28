import type { PlayerRecommendation } from "@/types/draft";

type RecommendationsPanelProps = {
  isDraftComplete: boolean;
  isUserPick: boolean;
  recommendations: PlayerRecommendation[];
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
          Context-aware suggestions from the current draft state.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-4 rounded border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">
          No recommendations available.
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {recommendations.map((recommendation, index) => {
            const {
              ranking,
              reasons,
              totalScore,
              baseScore,
              contextScore,
              components,
              scoreAdjustments,
            } = recommendation;

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
                    <span>Score {totalScore.toFixed(1)}</span>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-1">
                    {reasons.map((reason) => (
                      <li
                        key={reason.id}
                        className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
                      >
                        {reason.text}
                      </li>
                    ))}
                  </ul>

                  <details className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
                    <summary className="cursor-pointer font-medium text-zinc-800">
                      Score details
                    </summary>

                    <div className="mt-3 grid gap-3">
                      <dl className="grid gap-1 sm:grid-cols-2">
                        <DiagnosticValue label="Returned position" value={`#${index + 1}`} />
                        <DiagnosticValue label="Player ID" value={ranking.player.id} />
                        <DiagnosticValue label="Overall rank" value={`#${ranking.overallRank}`} />
                        <DiagnosticValue label="Position rank" value={`#${ranking.positionRank}`} />
                        <DiagnosticValue label="Final total" value={totalScore.toFixed(2)} />
                        <DiagnosticValue label="Base value" value={baseScore.toFixed(2)} />
                        <DiagnosticValue
                          label="Applied context"
                          value={contextScore.toFixed(2)}
                        />
                      </dl>

                      <div>
                        <h4 className="font-semibold text-zinc-900">Raw components</h4>
                        <ul className="mt-1 grid gap-1">
                          {components.map((component) => (
                            <li
                              key={component.id}
                              className="rounded border border-zinc-200 bg-white p-2"
                            >
                              <div className="flex flex-wrap justify-between gap-2">
                                <span className="font-medium">{component.id}</span>
                                <span>
                                  {formatSignedScore(component.delta)} ({component.direction})
                                </span>
                              </div>
                              {component.evidence ? (
                                <dl className="mt-1 grid gap-x-3 gap-y-1 text-zinc-500 sm:grid-cols-2">
                                  {Object.entries(component.evidence).map(([key, value]) => (
                                    <DiagnosticValue
                                      key={key}
                                      label={key}
                                      value={String(value)}
                                    />
                                  ))}
                                </dl>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-zinc-900">Cap adjustments</h4>
                        {scoreAdjustments.length === 0 ? (
                          <p className="mt-1 text-zinc-500">No cap adjustments.</p>
                        ) : (
                          <ul className="mt-1 grid gap-1">
                            {scoreAdjustments.map((adjustment) => (
                              <li
                                key={adjustment.id}
                                className="rounded border border-zinc-200 bg-white p-2"
                              >
                                <div className="flex flex-wrap justify-between gap-2">
                                  <span className="font-medium">{adjustment.id}</span>
                                  <span>
                                    {formatSignedScore(adjustment.delta)} ({adjustment.direction})
                                  </span>
                                </div>
                                <dl className="mt-1 grid gap-x-3 gap-y-1 text-zinc-500 sm:grid-cols-2">
                                  {Object.entries(adjustment.evidence).map(([key, value]) => (
                                    <DiagnosticValue
                                      key={key}
                                      label={key}
                                      value={String(value)}
                                    />
                                  ))}
                                </dl>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-zinc-900">
                          Score-backed reasons
                        </h4>
                        {reasons.length === 0 ? (
                          <p className="mt-1 text-zinc-500">
                            No score-backed reasons.
                          </p>
                        ) : (
                          <ul className="mt-1 grid gap-1">
                            {reasons.map((reason) => (
                              <li
                                key={reason.id}
                                className="rounded border border-zinc-200 bg-white p-2"
                              >
                                <div className="font-medium">{reason.id}</div>
                                <div className="text-zinc-500">
                                  Source: {reason.sourceComponentId}
                                </div>
                                <div className="mt-1">{reason.text}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
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

function DiagnosticValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-zinc-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatSignedScore(value: number): string {
  const formatted = value.toFixed(2);
  return value > 0 ? `+${formatted}` : formatted;
}
