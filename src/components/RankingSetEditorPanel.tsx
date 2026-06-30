"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { RankingManagementError } from "@/lib/rankingManagementWorkflow";
import type { RankingEntry } from "@/types/draft";
import type {
  RankingSet,
  RankingSetCapabilities,
  RankingSetSource,
} from "@/types/rankings";

type RankingSetEditorPanelProps = {
  rankingSet: RankingSet;
  isSaving: boolean;
  errors: readonly RankingManagementError[];
  onRename: (name: string) => void;
  onReorder: (
    input: Readonly<{ playerId: string; toOverallRank: number }>,
  ) => void;
  onClose: () => void;
};

export function RankingSetEditorPanel({
  rankingSet,
  isSaving,
  errors,
  onRename,
  onReorder,
  onClose,
}: RankingSetEditorPanelProps) {
  const [name, setName] = useState(rankingSet.name);
  const orderedEntries = useMemo(() => {
    return orderEntries(rankingSet.entries);
  }, [rankingSet.entries]);
  const [reorderPlayerId, setReorderPlayerId] = useState(
    () => orderEntries(rankingSet.entries)[0]?.player.id ?? "",
  );
  const [targetOverallRank, setTargetOverallRank] = useState("1");

  useEffect(() => {
    // A newly loaded ranking set resets the local rename draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(rankingSet.name);
  }, [rankingSet.id, rankingSet.name]);

  useEffect(() => {
    // A saved reorder returns a fresh aggregate; reset the form to its new top row.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReorderPlayerId(orderedEntries[0]?.player.id ?? "");
    setTargetOverallRank("1");
  }, [rankingSet.id, orderedEntries]);

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onRename(name);
  }

  function submitReorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reorderPlayerId) {
      return;
    }

    onReorder({
      playerId: reorderPlayerId,
      toOverallRank: Number(targetOverallRank),
    });
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Ranking Detail
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold text-zinc-950">
            {rankingSet.name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            This is a mutable ranking set. Drafts use immutable snapshots, so
            saved drafts do not follow later edits here.
          </p>
        </div>

        <button
          type="button"
          className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          onClick={onClose}
        >
          Close Detail
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailMetric label="Source" value={formatSource(rankingSet.source)} />
        <DetailMetric label="Players" value={rankingSet.entries.length} />
        <DetailMetric label="Created" value={formatDateTime(rankingSet.createdAt)} />
        <DetailMetric label="Updated" value={formatDateTime(rankingSet.updatedAt)} />
      </div>

      <div className="mt-4 rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
        {formatEditorCapabilitySummary(rankingSet.capabilities)}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={submitRename}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-zinc-700">
          Ranking Set Name
          <input
            className="h-10 rounded border border-zinc-300 px-3 text-sm font-normal text-zinc-950"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Rename"}
        </button>
      </form>

      <form
        className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_8rem_auto]"
        onSubmit={submitReorder}
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-zinc-700">
          Player to Move
          <select
            className="h-10 rounded border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950"
            value={reorderPlayerId}
            onChange={(event) => {
              setReorderPlayerId(event.target.value);
            }}
          >
            {orderedEntries.map((entry) => (
              <option key={entry.player.id} value={entry.player.id}>
                {formatReorderOption(entry)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Target Rank
          <input
            className="h-10 rounded border border-zinc-300 px-3 text-sm font-normal text-zinc-950"
            inputMode="numeric"
            type="number"
            value={targetOverallRank}
            onChange={(event) => {
              setTargetOverallRank(event.target.value);
            }}
          />
        </label>

        <button
          type="submit"
          className="h-10 self-end rounded bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Move Player"}
        </button>
      </form>

      {errors.length > 0 ? <EditorErrorList errors={errors} /> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <TableHeader>Overall</TableHeader>
              <TableHeader>Player</TableHeader>
              <TableHeader>ID</TableHeader>
              <TableHeader>Team</TableHeader>
              <TableHeader>Position</TableHeader>
              <TableHeader>Pos Rank</TableHeader>
              <TableHeader>Tier</TableHeader>
              <TableHeader>ADP</TableHeader>
            </tr>
          </thead>
          <tbody>
            {orderedEntries.map((entry) => (
              <RankingEntryRow key={entry.player.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function orderEntries(entries: readonly RankingEntry[]): RankingEntry[] {
  return [...entries].sort((left, right) => {
    return left.overallRank - right.overallRank;
  });
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 break-words font-semibold text-zinc-950">
        {value}
      </div>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 font-semibold">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="border-b border-zinc-100 px-3 py-2">{children}</td>;
}

function RankingEntryRow({ entry }: { entry: RankingEntry }) {
  return (
    <tr className="text-zinc-700">
      <TableCell>{entry.overallRank}</TableCell>
      <TableCell>{entry.player.name}</TableCell>
      <TableCell>{entry.player.id}</TableCell>
      <TableCell>{entry.player.team}</TableCell>
      <TableCell>{entry.player.position}</TableCell>
      <TableCell>{entry.positionRank}</TableCell>
      <TableCell>{entry.tier}</TableCell>
      <TableCell>{formatAdp(entry.adpRank)}</TableCell>
    </tr>
  );
}

function formatReorderOption(entry: RankingEntry): string {
  return `#${entry.overallRank} - ${entry.player.name} (${entry.player.position})`;
}

function EditorErrorList({
  errors,
}: {
  errors: readonly RankingManagementError[];
}) {
  return (
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <h3 className="font-semibold">Ranking Edit Errors</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error, index) => (
          <li key={`${error.code}-${error.path ?? "root"}-${index}`}>
            {formatEditorManagementError(error)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function formatEditorCapabilitySummary(
  capabilities: RankingSetCapabilities,
): string {
  const tierEntries = Object.entries(capabilities.tiers);
  const sourcePositions = tierEntries
    .filter(([, capability]) => capability === "source")
    .map(([position]) => position)
    .sort();
  const neutralPositions = tierEntries
    .filter(([, capability]) => capability === "defaulted-neutral")
    .map(([position]) => position)
    .sort();
  const tierParts: string[] = [];

  if (sourcePositions.length > 0) {
    tierParts.push(`source tiers: ${sourcePositions.join(", ")}`);
  }

  if (neutralPositions.length > 0) {
    tierParts.push(`defaulted-neutral tiers: ${neutralPositions.join(", ")}`);
  }

  if (tierParts.length === 0) {
    tierParts.push("tiers: none");
  }

  return [
    `Team: ${capabilities.team}`,
    `ADP: ${capabilities.adp}`,
    `Position rank: ${capabilities.positionRank}`,
    `Tiers: ${tierParts.join("; ")}`,
  ].join(" / ");
}

export function formatEditorManagementError(
  error: RankingManagementError,
): string {
  const suffix = error.path ? ` (${error.path})` : "";

  return `${error.code}: ${error.message}${suffix}`;
}

function formatSource(source: RankingSetSource): string {
  const parts = [formatSourceKind(source.kind)];

  if (source.formatId) {
    parts.push(source.formatId);
  }

  if (source.label) {
    parts.push(source.label);
  }

  return parts.join(" / ");
}

function formatSourceKind(sourceKind: RankingSetSource["kind"]): string {
  return sourceKind
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAdp(adpRank: number | null): string {
  return adpRank === null ? "None" : String(adpRank);
}
