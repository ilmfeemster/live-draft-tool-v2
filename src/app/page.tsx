import { DraftRoom } from "@/components/DraftRoom";
import type { DraftSummary } from "@/lib/draftRepository";
import { loadDraftWorkspace } from "@/lib/draftWorkspaceLoader";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const requestedDraftId = getSingleSearchParam(
    resolvedSearchParams?.draftId,
  );
  const {
    workspace,
    summaries,
    requestedDraftMissing,
  } = await loadDraftWorkspace(requestedDraftId);

  return (
    <main className="flex min-h-screen flex-col bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-2 border-b border-zinc-300 pb-5">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            Live Draft Tool
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-950">Draft Board</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Imported rankings are loaded as the first available player pool.
                Draft tracking and recommendations will build on this table.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Teams</div>
                <div className="mt-1 font-semibold text-zinc-950">
                  {workspace.leagueSettings.teamCount}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Format</div>
                <div className="mt-1 font-semibold text-zinc-950">
                  {workspace.leagueSettings.scoringFormat}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Draft</div>
                <div className="mt-1 font-semibold text-zinc-950">
                  {formatDraftType(workspace.leagueSettings.draftType)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {requestedDraftMissing ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            That draft could not be found. The latest available draft is loaded
            instead.
          </div>
        ) : null}

        <DraftHistoryList
          activeDraftId={workspace.draft.id}
          summaries={summaries}
        />

        <DraftRoom
          key={workspace.draft.id}
          draft={workspace.draft}
          rankings={workspace.rankings}
        />
      </div>
    </main>
  );
}

function DraftHistoryList({
  activeDraftId,
  summaries,
}: {
  activeDraftId: string;
  summaries: DraftSummary[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Draft History</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Reopen a persisted draft workspace.
        </p>
      </div>

      {summaries.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {summaries.map((summary) => {
            const isActive = summary.id === activeDraftId;

            return (
              <a
                key={summary.id}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-md border border-emerald-300 bg-emerald-50 p-4 transition hover:border-emerald-400"
                    : "rounded-md border border-zinc-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50"
                }
                href={`/?draftId=${encodeURIComponent(summary.id)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-950">
                        {summary.name ?? "Untitled Draft"}
                      </h3>
                      {isActive ? (
                        <span className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium uppercase tracking-wide text-white">
                          Loaded
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Updated {formatUpdatedAt(summary.updatedAt)}
                    </div>
                  </div>

                  <div className="text-left text-sm font-medium text-zinc-700 sm:text-right">
                    {formatDraftStatus(summary.status)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <SummaryMetric
                    label="Picks"
                    value={`${summary.draftedPickCount}/${summary.teamCount * summary.rounds}`}
                  />
                  <SummaryMetric label="Teams" value={summary.teamCount} />
                  <SummaryMetric label="Rounds" value={summary.rounds} />
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          No saved drafts were listed before this workspace loaded.
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function formatDraftType(draftType: string): string {
  return draftType.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDraftStatus(status: DraftSummary["status"]): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(updatedAt: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(updatedAt);
}

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
