"use client";

import type { ChangeEvent } from "react";
import {
  CURATED_SCENARIO_IDS,
  type CuratedScenarioId,
} from "@/lib/curatedScenarios";

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
  selectedCuratedScenarioId: CuratedScenarioId | "";
  errors: string[];
  isPending: boolean;
  canResetScenario: boolean;
  canRestartTransient: boolean;
  onSelectCuratedScenario: (id: CuratedScenarioId) => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onResetScenario: () => void;
  onRestartTransient: () => void;
};

const curatedLabels: Record<CuratedScenarioId, string> = {
  "early-non-default-pressure": "Early Non-Default Pressure",
  "completed-draft": "Completed Draft",
};

const modeLabels: Record<WorkbenchMode, string> = {
  persisted: "Persisted Draft",
  scenario: "Transient Scenario",
  "transient-manual": "Transient Manual",
};

export function DeveloperWorkbenchPanel({
  status,
  selectedCuratedScenarioId,
  errors,
  isPending,
  canResetScenario,
  canRestartTransient,
  onSelectCuratedScenario,
  onImportFile,
  onExport,
  onResetScenario,
  onRestartTransient,
}: DeveloperWorkbenchPanelProps) {
  function handleScenarioChange(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value as CuratedScenarioId | "";

    if (id) {
      onSelectCuratedScenario(id);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onImportFile(file);
    }

    event.target.value = "";
  }

  return (
    <section className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-950">
          Developer Workbench
        </h2>
        <p className="text-sm text-zinc-600">
          Scenario sessions are transient until exported.
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] lg:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Curated scenario
          <select
            value={selectedCuratedScenarioId}
            disabled={isPending}
            onChange={handleScenarioChange}
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 font-normal text-zinc-950 disabled:bg-zinc-100"
          >
            <option value="">Select a curated scenario</option>
            {CURATED_SCENARIO_IDS.map((id) => (
              <option key={id} value={id}>
                {curatedLabels[id]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Import local JSON
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
    </section>
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
