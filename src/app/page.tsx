import { DraftRoom } from "@/components/DraftRoom";
import { DraftHistoryList } from "@/components/DraftHistoryList";
import { RankingLibraryPanel } from "@/components/RankingLibraryPanel";
import { loadDraftWorkspace } from "@/lib/draftWorkspaceLoader";
import { listManagedRankingSets } from "@/lib/rankingManagementWorkflow";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const requestedDraftId = getSingleSearchParam(
    resolvedSearchParams?.draftId,
  );
  const [draftWorkspaceResult, rankingLibraryResult] = await Promise.all([
    loadDraftWorkspace(requestedDraftId),
    listManagedRankingSets(),
  ]);
  const { workspace, summaries, requestedDraftMissing } = draftWorkspaceResult;
  const rankingSummaries = rankingLibraryResult.ok
    ? rankingLibraryResult.value
    : [];
  const rankingErrors = rankingLibraryResult.ok
    ? []
    : rankingLibraryResult.errors;

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

        <RankingLibraryPanel
          initialErrors={rankingErrors}
          initialSummaries={rankingSummaries}
        />

        <DraftHistoryList
          activeDraftId={workspace.draft.id}
          summaries={summaries}
        />

        <DraftRoom
          key={workspace.draft.id}
          draft={workspace.draft}
          leagueSettings={workspace.leagueSettings}
          rankings={workspace.rankings}
        />
      </div>
    </main>
  );
}

function formatDraftType(draftType: string): string {
  return draftType.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
