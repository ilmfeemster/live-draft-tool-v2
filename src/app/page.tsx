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
  const activeSummaries = summaries.filter((summary) => {
    return summary.status !== "COMPLETE";
  });
  const completedSummaries = summaries.filter((summary) => {
    return summary.status === "COMPLETE";
  });
  const isActiveDraftComplete = completedSummaries.some((summary) => {
    return summary.id === activeDraftId;
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Draft History</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Reopen a persisted draft workspace.
          </p>
        </div>
        {summaries.length > 0 ? (
          <div className="text-sm text-zinc-500">
            {activeSummaries.length} active / {completedSummaries.length} complete
          </div>
        ) : null}
      </div>

      {summaries.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
                Active Drafts
              </h3>
              <div className="text-sm text-zinc-500">
                {activeSummaries.length} draft{activeSummaries.length === 1 ? "" : "s"}
              </div>
            </div>

            {activeSummaries.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {activeSummaries.map((summary) => (
                  <DraftSummaryCard
                    key={summary.id}
                    activeDraftId={activeDraftId}
                    summary={summary}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
                No active drafts. Completed drafts are available below.
              </div>
            )}
          </div>

          {completedSummaries.length > 0 ? (
            <details
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              open={isActiveDraftComplete}
            >
              <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-600">
                Completed Drafts ({completedSummaries.length})
              </summary>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {completedSummaries.map((summary) => (
                  <DraftSummaryCard
                    key={summary.id}
                    activeDraftId={activeDraftId}
                    summary={summary}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          No saved drafts were listed before this workspace loaded.
        </div>
      )}
    </section>
  );
}

function DraftSummaryCard({
  activeDraftId,
  summary,
}: {
  activeDraftId: string;
  summary: DraftSummary;
}) {
  const isActive = summary.id === activeDraftId;

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "min-w-72 rounded-md border border-emerald-300 bg-emerald-50 p-3 transition hover:border-emerald-400"
          : "min-w-72 rounded-md border border-zinc-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
      }
      href={`/?draftId=${encodeURIComponent(summary.id)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-950">
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

        <div className="shrink-0 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
          {formatDraftStatus(summary.status)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <SummaryMetric
          label="Picks"
          value={`${summary.draftedPickCount}/${summary.teamCount * summary.rounds}`}
        />
        <SummaryMetric label="Teams" value={summary.teamCount} />
        <SummaryMetric label="Rounds" value={summary.rounds} />
      </div>
    </a>
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
