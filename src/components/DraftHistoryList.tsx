"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDraftAction } from "@/app/actions/draftActions";
import type { DraftSummary } from "@/lib/draftRepository";

type DraftHistoryListProps = {
  activeDraftId: string;
  summaries: DraftSummary[];
};

export function DraftHistoryList({
  activeDraftId,
  summaries,
}: DraftHistoryListProps) {
  const router = useRouter();
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [visibleSummaries, setVisibleSummaries] =
    useState<DraftSummary[]>(summaries);

  useEffect(() => {
    // Server refreshes provide the authoritative replacement for the optimistic list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleSummaries(summaries);
  }, [summaries]);

  const activeSummaries = visibleSummaries.filter((summary) => {
    return summary.status !== "COMPLETE";
  });
  const completedSummaries = visibleSummaries.filter((summary) => {
    return summary.status === "COMPLETE";
  });
  const isActiveDraftComplete = completedSummaries.some((summary) => {
    return summary.id === activeDraftId;
  });

  async function deleteDraft(summary: DraftSummary) {
    if (deletingDraftId) {
      return;
    }

    const draftName = summary.name ?? "Untitled Draft";
    const shouldDelete = window.confirm(
      `Delete "${draftName}"? This permanently removes the saved draft from history.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingDraftId(summary.id);

    try {
      const wasDeleted = await deleteDraftAction(summary.id);

      if (!wasDeleted) {
        console.error(`Draft ${summary.id} could not be deleted.`);
        return;
      }

      const remainingSummaries = visibleSummaries.filter((candidate) => {
        return candidate.id !== summary.id;
      });
      setVisibleSummaries(remainingSummaries);

      if (summary.id === activeDraftId) {
        const nextSummary =
          remainingSummaries.find((candidate) => {
            return candidate.status !== "COMPLETE";
          }) ?? remainingSummaries[0];

        const destination = nextSummary
          ? `/?draftId=${encodeURIComponent(nextSummary.id)}`
          : "/";

        window.location.replace(destination);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to delete draft.", error);
    } finally {
      setDeletingDraftId(null);
    }
  }

  return (
    <details className="group/history">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">Draft History</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Reopen a persisted draft workspace.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            {visibleSummaries.length > 0 ? (
              <span>
                {activeSummaries.length} active / {completedSummaries.length}{" "}
                complete
              </span>
            ) : null}
            <span aria-hidden="true" className="font-medium text-zinc-600">
              <span className="group-open/history:hidden">Expand</span>
              <span className="hidden group-open/history:inline">Minimize</span>
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-3">
        {visibleSummaries.length > 0 ? (
          <div className="flex flex-col gap-3">
            <details className="group rounded-md border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
                    Active Drafts
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span>
                      {activeSummaries.length} draft
                      {activeSummaries.length === 1 ? "" : "s"}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-medium text-zinc-600"
                    >
                      <span className="group-open:hidden">Expand</span>
                      <span className="hidden group-open:inline">Minimize</span>
                    </span>
                  </div>
                </div>
              </summary>

              <div className="mt-3">
                {activeSummaries.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {activeSummaries.map((summary) => (
                      <DraftSummaryCard
                        key={summary.id}
                        activeDraftId={activeDraftId}
                        isDeleteDisabled={Boolean(deletingDraftId)}
                        isDeleting={deletingDraftId === summary.id}
                        summary={summary}
                        onDeleteDraft={deleteDraft}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
                    No active drafts. Completed drafts are available below.
                  </div>
                )}
              </div>
            </details>

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
                      isDeleteDisabled={Boolean(deletingDraftId)}
                      isDeleting={deletingDraftId === summary.id}
                      summary={summary}
                      onDeleteDraft={deleteDraft}
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
      </div>
    </details>
  );
}

function DraftSummaryCard({
  activeDraftId,
  isDeleteDisabled,
  isDeleting,
  summary,
  onDeleteDraft,
}: {
  activeDraftId: string;
  isDeleteDisabled: boolean;
  isDeleting: boolean;
  summary: DraftSummary;
  onDeleteDraft: (summary: DraftSummary) => void;
}) {
  const isActive = summary.id === activeDraftId;

  return (
    <div
      className={
        isActive
          ? "min-w-72 rounded-md border border-emerald-300 bg-emerald-50 p-3 transition hover:border-emerald-400"
          : "min-w-72 rounded-md border border-zinc-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
      }
    >
      <a
        aria-current={isActive ? "page" : undefined}
        className="block"
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

      <button
        type="button"
        className="mt-3 h-9 w-full rounded border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
        disabled={isDeleteDisabled}
        onClick={() => {
          onDeleteDraft(summary);
        }}
      >
        {isDeleting ? "Deleting..." : "Delete Draft"}
      </button>
    </div>
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
