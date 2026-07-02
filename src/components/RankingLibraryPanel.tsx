"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteRankingLibrarySetAction,
  editRankingLibrarySetAction,
  exportRankingLibrarySetJsonAction,
  importRankingLibraryFileAction,
  listRankingLibraryAction,
  loadRankingLibrarySetAction,
} from "@/app/actions/rankingActions";
import { RankingSetEditorPanel } from "@/components/RankingSetEditorPanel";
import type { RankingManagementError } from "@/lib/rankingManagementWorkflow";
import type {
  RankingImportDiagnostic,
  RankingImportFormatId,
} from "@/types/rankingImport";
import type {
  RankingSet,
  RankingSetCapabilities,
  RankingSetSummary,
} from "@/types/rankings";

type OperationMessage = Readonly<{
  kind: "success" | "error";
  text: string;
}>;

type RankingLibraryPanelProps = {
  initialSummaries: readonly RankingSetSummary[];
  initialErrors?: readonly RankingManagementError[];
};

const importFormatOptions: readonly Readonly<{
  id: RankingImportFormatId;
  label: string;
}>[] = [
  { id: "fantasypros-csv", label: "FantasyPros CSV Profile V1" },
  { id: "canonical-ranking-json", label: "Canonical Ranking Set JSON V1" },
];

export function RankingLibraryPanel({
  initialSummaries,
  initialErrors = [],
}: RankingLibraryPanelProps) {
  const router = useRouter();
  const [visibleSummaries, setVisibleSummaries] = useState<RankingSetSummary[]>(
    () => [...initialSummaries],
  );
  const [isManagedSetsExpanded, setIsManagedSetsExpanded] = useState(false);
  const [isImportRankingsExpanded, setIsImportRankingsExpanded] =
    useState(false);
  const [formatId, setFormatId] =
    useState<RankingImportFormatId>("fantasypros-csv");
  const [rankingName, setRankingName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const [busySetId, setBusySetId] = useState<string | null>(null);
  const [loadedRankingSet, setLoadedRankingSet] = useState<RankingSet | null>(
    null,
  );
  const [message, setMessage] = useState<OperationMessage | null>(null);
  const [errors, setErrors] =
    useState<readonly RankingImportDiagnostic[]>([]);
  const [warnings, setWarnings] =
    useState<readonly RankingImportDiagnostic[]>([]);
  const [managementErrors, setManagementErrors] =
    useState<readonly RankingManagementError[]>(initialErrors);
  const [editorErrors, setEditorErrors] =
    useState<readonly RankingManagementError[]>([]);

  useEffect(() => {
    // Server refreshes provide the authoritative replacement for the local list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleSummaries([...initialSummaries]);
  }, [initialSummaries]);

  useEffect(() => {
    // Server refreshes may include structured listing errors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManagementErrors(initialErrors);
  }, [initialErrors]);

  const totalEntries = useMemo(() => {
    return visibleSummaries.reduce((total, summary) => {
      return total + summary.entryCount;
    }, 0);
  }, [visibleSummaries]);

  async function refreshSummaries() {
    const result = await listRankingLibraryAction();

    if (result.ok) {
      setVisibleSummaries([...result.value]);
      setManagementErrors([]);
      router.refresh();
      return true;
    }

    setManagementErrors(result.errors);
    setMessage({
      kind: "error",
      text: "Ranking library refresh failed. Showing the last loaded summaries.",
    });
    return false;
  }

  async function importSelectedFile() {
    if (isImporting) {
      return;
    }

    setMessage(null);
    setErrors([]);
    setWarnings([]);

    const trimmedName = rankingName.trim();

    if (!selectedFile) {
      setMessage({ kind: "error", text: "Choose a ranking file to import." });
      return;
    }

    if (!trimmedName) {
      setMessage({ kind: "error", text: "Enter a ranking set name." });
      return;
    }

    setIsImporting(true);

    try {
      const text = await selectedFile.text();
      const result = await importRankingLibraryFileAction({
        text,
        formatId,
        name: trimmedName,
        sourceLabel: selectedFile.name,
      });

      setWarnings(result.warnings);

      if (!result.ok) {
        setErrors(result.errors);
        setMessage({
          kind: "error",
          text: "Ranking import failed. Stored ranking sets were not changed.",
        });
        return;
      }

      setMessage({
        kind: "success",
        text: `Imported "${result.rankingSet.name}".`,
      });
      setErrors([]);
      await refreshSummaries();
    } catch (error) {
      console.error("Ranking import failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking import failed unexpectedly.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function exportSummary(summary: RankingSetSummary) {
    if (busySetId) {
      return;
    }

    setBusySetId(summary.id);
    setMessage(null);

    try {
      const result = await exportRankingLibrarySetJsonAction(summary.id);

      if (!result.ok) {
        setManagementErrors(result.errors);
        setMessage({
          kind: "error",
          text: "Ranking export failed. No file was downloaded.",
        });
        return;
      }

      downloadJsonText(result.value.text, createSafeExportFileName(summary));
      setManagementErrors([]);
      setMessage({
        kind: "success",
        text: `Exported "${summary.name}".`,
      });
    } catch (error) {
      console.error("Ranking export failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking export failed unexpectedly.",
      });
    } finally {
      setBusySetId(null);
    }
  }

  async function loadSummary(summary: RankingSetSummary) {
    if (busySetId) {
      return;
    }

    setBusySetId(summary.id);
    setMessage(null);
    setEditorErrors([]);

    try {
      const result = await loadRankingLibrarySetAction(summary.id);

      if (!result.ok) {
        if (loadedRankingSet) {
          setEditorErrors(result.errors);
        } else {
          setManagementErrors(result.errors);
        }
        setMessage({
          kind: "error",
          text: "Ranking set could not be loaded.",
        });
        return;
      }

      setLoadedRankingSet(result.value);
      setManagementErrors([]);
      setEditorErrors([]);
      setMessage({
        kind: "success",
        text: `Loaded "${result.value.name}" for review.`,
      });
    } catch (error) {
      console.error("Ranking load failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking load failed unexpectedly.",
      });
    } finally {
      setBusySetId(null);
    }
  }

  async function renameLoadedSet(name: string) {
    if (!loadedRankingSet || isSavingEditor) {
      return;
    }

    setIsSavingEditor(true);
    setMessage(null);
    setEditorErrors([]);

    try {
      const result = await editRankingLibrarySetAction({
        id: loadedRankingSet.id,
        intent: { type: "rename", name },
      });

      if (!result.ok) {
        setEditorErrors(result.errors);
        setMessage({
          kind: "error",
          text: "Ranking rename failed. The loaded set was not changed.",
        });
        return;
      }

      setLoadedRankingSet(result.value);
      setEditorErrors([]);
      setManagementErrors([]);
      setMessage({
        kind: "success",
        text: `Renamed ranking set to "${result.value.name}".`,
      });
      await refreshSummaries();
    } catch (error) {
      console.error("Ranking rename failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking rename failed unexpectedly.",
      });
    } finally {
      setIsSavingEditor(false);
    }
  }

  async function reorderLoadedSet(
    input: Readonly<{ playerId: string; toOverallRank: number }>,
  ) {
    if (!loadedRankingSet || isSavingEditor) {
      return;
    }

    setIsSavingEditor(true);
    setMessage(null);
    setEditorErrors([]);

    try {
      const result = await editRankingLibrarySetAction({
        id: loadedRankingSet.id,
        intent: {
          type: "reorder-player",
          playerId: input.playerId,
          toOverallRank: input.toOverallRank,
        },
      });

      if (!result.ok) {
        setEditorErrors(result.errors);
        setMessage({
          kind: "error",
          text: "Ranking reorder failed. The loaded set was not changed.",
        });
        return;
      }

      setLoadedRankingSet(result.value);
      setEditorErrors([]);
      setManagementErrors([]);
      setMessage({
        kind: "success",
        text: "Ranking order saved.",
      });
      await refreshSummaries();
    } catch (error) {
      console.error("Ranking reorder failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking reorder failed unexpectedly.",
      });
    } finally {
      setIsSavingEditor(false);
    }
  }

  async function correctLoadedPlayer(
    input: Readonly<{
      playerId: string;
      changes: Readonly<{
        name: string;
        team: string;
        adpRank: number | null;
      }>;
    }>,
  ) {
    if (!loadedRankingSet || isSavingEditor) {
      return;
    }

    setIsSavingEditor(true);
    setMessage(null);
    setEditorErrors([]);

    try {
      const result = await editRankingLibrarySetAction({
        id: loadedRankingSet.id,
        intent: {
          type: "correct-player",
          playerId: input.playerId,
          changes: input.changes,
        },
      });

      if (!result.ok) {
        setEditorErrors(result.errors);
        setMessage({
          kind: "error",
          text: "Ranking player correction failed. The loaded set was not changed.",
        });
        return;
      }

      setLoadedRankingSet(result.value);
      setEditorErrors([]);
      setManagementErrors([]);
      setMessage({
        kind: "success",
        text: "Ranking player facts saved.",
      });
      await refreshSummaries();
    } catch (error) {
      console.error("Ranking player correction failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking player correction failed unexpectedly.",
      });
    } finally {
      setIsSavingEditor(false);
    }
  }

  async function deleteSummary(summary: RankingSetSummary) {
    if (busySetId) {
      return;
    }

    const shouldDelete = window.confirm(createDeleteConfirmationMessage(summary));

    if (!shouldDelete) {
      return;
    }

    setBusySetId(summary.id);
    setMessage(null);

    try {
      const result = await deleteRankingLibrarySetAction(summary.id);

      if (!result.ok) {
        setManagementErrors(result.errors);

        if (result.errors.some((error) => error.code === "not-found")) {
          setVisibleSummaries((current) =>
            current.filter((candidate) => candidate.id !== summary.id),
          );
        }

        setMessage({
          kind: "error",
          text: "Ranking set could not be deleted.",
        });
        return;
      }

      setVisibleSummaries((current) =>
        current.filter((candidate) => candidate.id !== result.value.id),
      );
      if (loadedRankingSet?.id === result.value.id) {
        setLoadedRankingSet(null);
        setEditorErrors([]);
      }
      setManagementErrors([]);
      setMessage({
        kind: "success",
        text: `Deleted "${summary.name}". Existing draft snapshots are unchanged.`,
      });
      await refreshSummaries();
    } catch (error) {
      console.error("Ranking deletion failed.", error);
      setMessage({
        kind: "error",
        text: "Ranking deletion failed unexpectedly.",
      });
    } finally {
      setBusySetId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Ranking Library</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Manage imported ranking sets without changing active draft snapshots.
          </p>
        </div>
        {visibleSummaries.length > 0 ? (
          <div className="text-sm text-zinc-500">
            {visibleSummaries.length} set
            {visibleSummaries.length === 1 ? "" : "s"} / {totalEntries} players
          </div>
        ) : null}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Managed Sets
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                aria-controls="managed-ranking-sets-content"
                aria-expanded={isManagedSetsExpanded}
                aria-label={
                  isManagedSetsExpanded
                    ? "Minimize Managed Sets"
                    : "Expand Managed Sets"
                }
                onClick={() => {
                  setIsManagedSetsExpanded((current) => !current);
                }}
              >
                {isManagedSetsExpanded ? "Minimize" : "Expand"}
              </button>
              <button
                type="button"
                className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                onClick={() => {
                  void refreshSummaries();
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          <div
            id="managed-ranking-sets-content"
            hidden={!isManagedSetsExpanded}
          >
            {visibleSummaries.length > 0 ? (
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {visibleSummaries.map((summary) => (
                  <RankingSummaryCard
                    key={summary.id}
                    busySetId={busySetId}
                    summary={summary}
                    onDelete={deleteSummary}
                    onExport={exportSummary}
                    onReview={loadSummary}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
                No managed ranking sets are available yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Import Rankings
            </h3>
            <button
              type="button"
              className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              aria-controls="import-rankings-content"
              aria-expanded={isImportRankingsExpanded}
              aria-label={
                isImportRankingsExpanded
                  ? "Minimize Import Rankings"
                  : "Expand Import Rankings"
              }
              onClick={() => {
                setIsImportRankingsExpanded((current) => !current);
              }}
            >
              {isImportRankingsExpanded ? "Minimize" : "Expand"}
            </button>
          </div>

          <div
            id="import-rankings-content"
            className="mt-3 flex flex-col gap-3"
            hidden={!isImportRankingsExpanded}
          >
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              Format
              <select
                className="h-10 rounded border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950"
                value={formatId}
                onChange={(event) => {
                  setFormatId(event.target.value as RankingImportFormatId);
                }}
              >
                {importFormatOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              Ranking Set Name
              <input
                className="h-10 rounded border border-zinc-300 px-3 text-sm font-normal text-zinc-950"
                type="text"
                value={rankingName}
                onChange={(event) => {
                  setRankingName(event.target.value);
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              File
              <input
                accept=".csv,.json,application/json,text/json"
                className="text-sm font-normal text-zinc-700 file:mr-3 file:h-9 file:rounded file:border file:border-zinc-200 file:bg-white file:px-3 file:text-sm file:font-medium file:text-zinc-700"
                type="file"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
              />
            </label>

            <button
              type="button"
              className="h-10 rounded bg-emerald-700 px-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isImporting}
              onClick={() => {
                void importSelectedFile();
              }}
            >
              {isImporting ? "Importing..." : "Import File"}
            </button>
          </div>
        </div>
      </div>

      {message ? <OperationNotice message={message} /> : null}
      {managementErrors.length > 0 ? (
        <ManagementErrorList errors={managementErrors} />
      ) : null}
      {errors.length > 0 ? (
        <ImportDiagnosticList diagnostics={errors} title="Import Errors" />
      ) : null}
      {warnings.length > 0 ? (
        <ImportDiagnosticList diagnostics={warnings} title="Import Warnings" />
      ) : null}
      {loadedRankingSet ? (
        <RankingSetEditorPanel
          errors={editorErrors}
          isSaving={isSavingEditor}
          rankingSet={loadedRankingSet}
          onClose={() => {
            setLoadedRankingSet(null);
            setEditorErrors([]);
          }}
          onCorrectPlayer={(input) => {
            void correctLoadedPlayer(input);
          }}
          onRename={(name) => {
            void renameLoadedSet(name);
          }}
          onReorder={(input) => {
            void reorderLoadedSet(input);
          }}
        />
      ) : null}
    </section>
  );
}

function RankingSummaryCard({
  busySetId,
  summary,
  onDelete,
  onExport,
  onReview,
}: {
  busySetId: string | null;
  summary: RankingSetSummary;
  onDelete: (summary: RankingSetSummary) => void;
  onExport: (summary: RankingSetSummary) => void;
  onReview: (summary: RankingSetSummary) => void;
}) {
  const isBusy = busySetId === summary.id;
  const isDisabled = Boolean(busySetId);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-zinc-950">{summary.name}</h3>
          <div className="mt-1 text-sm text-zinc-600">
            Updated {formatUpdatedAt(summary.updatedAt)}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
          {formatSourceKind(summary.sourceKind)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <SummaryMetric label="Players" value={summary.entryCount} />
        <SummaryMetric
          label="Created"
          value={formatShortDate(summary.createdAt)}
        />
      </div>

      <div className="mt-3 rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        {formatCapabilitySummary(summary.capabilities)}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          disabled={isDisabled}
          onClick={() => {
            onReview(summary);
          }}
        >
          {isBusy ? "Working..." : "Review/Edit"}
        </button>
        <button
          type="button"
          className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
          disabled={isDisabled}
          onClick={() => {
            onExport(summary);
          }}
        >
          {isBusy ? "Working..." : "Export JSON"}
        </button>
        <button
          type="button"
          className="h-9 rounded border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
          disabled={isDisabled}
          onClick={() => {
            onDelete(summary);
          }}
        >
          {isBusy ? "Working..." : "Delete Set"}
        </button>
      </div>
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

function OperationNotice({ message }: { message: OperationMessage }) {
  const className =
    message.kind === "success"
      ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900";

  return <div className={className}>{message.text}</div>;
}

function ManagementErrorList({
  errors,
}: {
  errors: readonly RankingManagementError[];
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <h3 className="font-semibold">Ranking Library Errors</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error, index) => (
          <li key={`${error.code}-${error.path ?? "root"}-${index}`}>
            {formatManagementError(error)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportDiagnosticList({
  diagnostics,
  title,
}: {
  diagnostics: readonly RankingImportDiagnostic[];
  title: string;
}) {
  const isWarning = diagnostics.every((diagnostic) => {
    return diagnostic.severity === "warning";
  });

  return (
    <div
      className={
        isWarning
          ? "rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      }
    >
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {diagnostics.map((diagnostic, index) => (
          <li key={`${diagnostic.stage}-${diagnostic.code}-${index}`}>
            {formatImportDiagnostic(diagnostic)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function formatImportDiagnostic(
  diagnostic: RankingImportDiagnostic,
): string {
  const location = formatDiagnosticLocation(diagnostic.location);
  const suffix = location ? ` (${location})` : "";

  return `${diagnostic.stage}: ${diagnostic.code} - ${diagnostic.message}${suffix}`;
}

export function formatManagementError(error: RankingManagementError): string {
  const suffix = error.path ? ` (${error.path})` : "";

  return `${error.code}: ${error.message}${suffix}`;
}

export function formatCapabilitySummary(
  capabilities: RankingSetCapabilities,
): string {
  const tierEntries = Object.entries(capabilities.tiers);
  const providedPositions = tierEntries
    .filter(([, capability]) => capability === "source")
    .map(([position]) => position)
    .sort();
  const neutralPositions = tierEntries
    .filter(([, capability]) => capability === "defaulted-neutral")
    .map(([position]) => position)
    .sort();
  const tierParts: string[] = [];

  if (providedPositions.length > 0) {
    tierParts.push(`provided tier values: ${providedPositions.join(", ")}`);
  }

  if (neutralPositions.length > 0) {
    tierParts.push(
      `recommendation-neutral fallback: ${neutralPositions.join(", ")}`,
    );
  }

  if (tierParts.length === 0) {
    tierParts.push("tiers: none");
  }

  return [
    `Team: ${capabilities.team}`,
    `ADP: ${capabilities.adp}`,
    `Tiers: ${tierParts.join("; ")}`,
  ].join(" / ");
}

export function createDeleteConfirmationMessage(
  summary: Pick<RankingSetSummary, "name">,
): string {
  return `Delete "${summary.name}"? Existing draft snapshots remain unchanged.`;
}

export function createSafeExportFileName(
  summary: Pick<RankingSetSummary, "name">,
): string {
  const normalized = summary.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "ranking-set"}.json`;
}

function formatDiagnosticLocation(
  location: RankingImportDiagnostic["location"],
): string {
  if (!location) {
    return "";
  }

  const parts: string[] = [];

  if (location.path) {
    parts.push(`path ${location.path}`);
  }

  if (location.row !== undefined) {
    parts.push(`row ${location.row}`);
  }

  if (location.column !== undefined) {
    parts.push(`column ${location.column}`);
  }

  if (location.field) {
    parts.push(`field ${location.field}`);
  }

  return parts.join(", ");
}

function formatSourceKind(sourceKind: RankingSetSummary["sourceKind"]): string {
  return sourceKind
    .replace(/-/g, " ")
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

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function downloadJsonText(text: string, fileName: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
