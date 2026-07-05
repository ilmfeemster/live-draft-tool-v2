"use client";

import type { ChangeEvent } from "react";

export type WorkbenchMode = "persisted" | "scenario" | "transient-manual";

export type WorkbenchStatus = {
  mode: WorkbenchMode;
  name: string;
  source: string;
  replayTarget: number | null;
  appliedPickCount: number;
  isDirty: boolean;
};

type DeveloperWorkbenchPanelProps = {
  status: WorkbenchStatus;
  errors: string[];
  isPending: boolean;
  canResetScenario: boolean;
  canRestartTransient: boolean;
  replayTargetInput: string;
  replayTargetMax: number | null;
  canApplyReplayTarget: boolean;
  onReplayTargetInputChange: (value: string) => void;
  onApplyReplayTarget: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onResetScenario: () => void;
  onRestartTransient: () => void;
};

const modeLabels: Record<WorkbenchMode, string> = {
  persisted: "Persisted Draft",
  scenario: "Transient Scenario",
  "transient-manual": "Transient Manual",
};

export function DeveloperWorkbenchPanel({
  status,
  errors,
  isPending,
  canResetScenario,
  canRestartTransient,
  replayTargetInput,
  replayTargetMax,
  canApplyReplayTarget,
  onReplayTargetInputChange,
  onApplyReplayTarget,
  onImportFile,
  onExport,
  onResetScenario,
  onRestartTransient,
}: DeveloperWorkbenchPanelProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onImportFile(file);
    }

    event.target.value = "";
  }

  return (
    <details className="group rounded-md border border-zinc-300 bg-zinc-50 p-4">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-zinc-950">
              Developer Workbench
            </h2>
            <p className="text-sm text-zinc-600">
              {modeLabels[status.mode]} - Scenario sessions are transient until
              exported.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 text-sm font-medium text-zinc-600"
          >
            <span className="group-open:hidden">Expand</span>
            <span className="hidden group-open:inline">Minimize</span>
          </span>
        </div>
      </summary>

      <div className="mt-4 rounded border border-zinc-200 bg-white p-3">
        <h3 className="font-semibold text-zinc-900">Scenario Files</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Open a previously exported scenario JSON file. Local files are not
          stored by the app.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            Open saved scenario
            <input
              type="file"
              accept=".json,application/json"
              disabled={isPending}
              onChange={handleFileChange}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-normal text-zinc-700 disabled:bg-zinc-100"
            />
          </label>

          <button
            type="button"
            disabled={isPending}
            onClick={onExport}
            className="h-9 rounded bg-zinc-800 px-3 text-sm font-medium text-white disabled:bg-zinc-300"
          >
            Export Scenario
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Export the active state to save it for later reuse.
        </p>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <StatusValue label="Mode" value={modeLabels[status.mode]} />
        <StatusValue label="Name" value={status.name} />
        <StatusValue label="Source" value={status.source} />
        <StatusValue
          label="Replay target"
          value={
            status.replayTarget === null
              ? "Not applicable"
              : String(status.replayTarget)
          }
        />
        <StatusValue label="Applied picks" value={String(status.appliedPickCount)} />
        <StatusValue label="Dirty" value={status.isDirty ? "Yes" : "No"} />
      </dl>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Replay target
          <input
            type="number"
            min="0"
            max={replayTargetMax ?? undefined}
            step="1"
            value={replayTargetInput}
            disabled={isPending || replayTargetMax === null}
            onChange={(event) => onReplayTargetInputChange(event.target.value)}
            className="h-9 w-40 rounded-md border border-zinc-300 bg-white px-3 font-normal text-zinc-950 disabled:bg-zinc-100"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !canApplyReplayTarget}
          onClick={onApplyReplayTarget}
          className="h-9 rounded bg-zinc-800 px-3 text-sm font-medium text-white disabled:bg-zinc-300"
        >
          Apply Target
        </button>
        <p className="w-full text-xs text-zinc-500">
          {replayTargetMax === null
            ? "Available after opening a saved scenario."
            : `0 through ${replayTargetMax} applied picks.`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || !canResetScenario}
          onClick={onResetScenario}
          className="h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          Reset Scenario
        </button>
        <button
          type="button"
          disabled={isPending || !canRestartTransient}
          onClick={onRestartTransient}
          className="h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          Restart Configuration
        </button>
      </div>

      <div aria-live="polite" className="mt-3 grid gap-1 text-sm text-red-700">
        {errors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </div>
    </details>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-2">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
