"use client";

import { useState, type FormEvent } from "react";
import {
  buildLeagueSetup,
  defaultLeagueSetupInput,
  LEAGUE_SETUP_LIMITS,
  LEAGUE_SETUP_ROSTER_CATEGORIES,
  type LeagueSetupInput,
  type LeagueSetupRosterCategory,
  type LeagueSetupValidationField,
} from "@/lib/leagueSetup";
import type { Position } from "@/types/draft";
import type {
  RankingSetSourceKind,
  RankingSetSummary,
  RankingTierCapability,
} from "@/types/rankings";

type DraftSetupFormProps = {
  defaultRankingSetId: string;
  isPending: boolean;
  rankingSummaries: readonly RankingSetSummary[];
  serverErrors: DraftSetupValidationError[];
  formError: string | null;
  onCancel: () => void;
  onClearServerErrors: () => void;
  onSubmit: (input: DraftSetupSubmitInput) => Promise<void>;
};

type DraftSetupFormValues = {
  rankingSetId: string;
  teamCount: string;
  userDraftPosition: string;
  rosterSlotCounts: Record<LeagueSetupRosterCategory, string>;
};

export type DraftSetupSubmitInput = Readonly<{
  leagueSetup: LeagueSetupInput;
  rankingSetId: string;
}>;

export type DraftSetupValidationError = Readonly<{
  field: LeagueSetupValidationField | "rankingSetId" | "rankingSet";
  message: string;
}>;

export function DraftSetupForm({
  defaultRankingSetId,
  isPending,
  rankingSummaries,
  serverErrors,
  formError,
  onCancel,
  onClearServerErrors,
  onSubmit,
}: DraftSetupFormProps) {
  const [values, setValues] = useState<DraftSetupFormValues>(() =>
    createDefaultValues(rankingSummaries, defaultRankingSetId),
  );
  const [localErrors, setLocalErrors] = useState<DraftSetupValidationError[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const visibleErrors = serverErrors.length > 0 ? serverErrors : localErrors;
  const selectedSummary = getSelectedSummary(rankingSummaries, values.rankingSetId);
  const selectedWarnings = selectedSummary
    ? getRankingSummaryWarnings(selectedSummary)
    : [];
  const summary = getDraftSummary(values);
  const hasRankingSets = rankingSummaries.length > 0;

  function updateValue(
    field: "rankingSetId" | "teamCount" | "userDraftPosition",
    value: string,
  ) {
    const nextValues = { ...values, [field]: value };
    applyEditedValues(nextValues);
  }

  function updateRosterCount(
    category: LeagueSetupRosterCategory,
    value: string,
  ) {
    const nextValues = {
      ...values,
      rosterSlotCounts: {
        ...values.rosterSlotCounts,
        [category]: value,
      },
    };
    applyEditedValues(nextValues);
  }

  function applyEditedValues(nextValues: DraftSetupFormValues) {
    setValues(nextValues);
    onClearServerErrors();

    if (hasSubmitted) {
      setLocalErrors(validateDraftSetupValues(nextValues, rankingSummaries));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    const errors = validateDraftSetupValues(values, rankingSummaries);

    if (errors.length > 0) {
      setLocalErrors(errors);
      return;
    }

    setLocalErrors([]);
    await onSubmit({
      leagueSetup: toLeagueSetupInput(values),
      rankingSetId: values.rankingSetId,
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-md border border-zinc-200 bg-white p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          New Draft
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-950">New Draft Setup</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Configure a new persisted draft. Your current draft remains available in
          draft history. The selected ranking set is snapshotted for this draft
          and cannot be switched after creation.
        </p>
      </div>

      <form className="mt-6 grid gap-6" onSubmit={submit}>
        <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
          <label className="grid gap-1 text-sm text-zinc-700" htmlFor="ranking-set-id">
            <span className="font-medium">Ranking Set</span>
            <select
              id="ranking-set-id"
              name="rankingSetId"
              value={values.rankingSetId}
              disabled={isPending || !hasRankingSets}
              aria-invalid={getErrors(visibleErrors, "rankingSetId").length > 0}
              className="h-10 rounded border border-zinc-300 bg-white px-3 text-zinc-950 disabled:bg-zinc-100"
              onChange={(event) => {
                updateValue("rankingSetId", event.currentTarget.value);
              }}
            >
              <option value="">Choose a ranking set</option>
              {rankingSummaries.map((rankingSummary) => (
                <option key={rankingSummary.id} value={rankingSummary.id}>
                  {rankingSummary.name} - {rankingSummary.entryCount} players
                </option>
              ))}
            </select>
            <ErrorList errors={getErrors(visibleErrors, "rankingSetId")} />
          </label>

          {hasRankingSets ? null : (
            <p className="text-sm text-amber-800">
              A managed ranking set is required before creating a draft.
            </p>
          )}

          {selectedSummary ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryValue label="Selected Set" value={selectedSummary.name} />
              <SummaryValue
                label="Source"
                value={formatSourceKind(selectedSummary.sourceKind)}
              />
              <SummaryValue
                label="Players"
                value={selectedSummary.entryCount.toString()}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-600">
              Choose the managed ranking set that should anchor this draft.
            </p>
          )}

          {selectedWarnings.length > 0 ? (
            <div className="grid gap-1 text-sm text-amber-800">
              {selectedWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <ErrorList errors={getErrors(visibleErrors, "rankingSet")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="team-count"
            label="Team Count"
            name="teamCount"
            value={values.teamCount}
            min={LEAGUE_SETUP_LIMITS.minTeamCount}
            max={LEAGUE_SETUP_LIMITS.maxTeamCount}
            disabled={isPending}
            errors={getErrors(visibleErrors, "teamCount")}
            onChange={(value) => updateValue("teamCount", value)}
          />
          <NumberField
            id="draft-position"
            label="Draft Position"
            name="userDraftPosition"
            value={values.userDraftPosition}
            min={1}
            max={getFiniteNumber(values.teamCount) ?? LEAGUE_SETUP_LIMITS.maxTeamCount}
            disabled={isPending}
            errors={getErrors(visibleErrors, "userDraftPosition")}
            onChange={(value) => updateValue("userDraftPosition", value)}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Roster Construction</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Rounds are derived from the total number of roster slots.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {LEAGUE_SETUP_ROSTER_CATEGORIES.map((category) => (
              <NumberField
                key={category}
                id={`roster-${category.toLowerCase()}`}
                label={category}
                name={`rosterSlotCounts.${category}`}
                value={values.rosterSlotCounts[category]}
                min={0}
                max={LEAGUE_SETUP_LIMITS.maxRosterSlots}
                disabled={isPending}
                errors={getErrors(
                  visibleErrors,
                  `rosterSlotCounts.${category}`,
                )}
                onChange={(value) => updateRosterCount(category, value)}
              />
            ))}
          </div>
          <ErrorList errors={getErrors(visibleErrors, "rosterSlotCounts")} />
        </div>

        <div className="grid gap-4 rounded border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4">
          <SummaryValue label="Draft Type" value="Snake" />
          <SummaryValue label="Scoring" value="PPR" />
          <SummaryValue label="Rounds" value={summary?.rounds.toString() ?? "-"} />
          <SummaryValue
            label="Total Picks"
            value={summary?.totalPicks.toString() ?? "-"}
          />
        </div>

        <ErrorList errors={getErrors(visibleErrors, "rankingPlayerCount")} />
        {formError ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="h-10 rounded border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 rounded bg-emerald-700 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={isPending || !hasRankingSets}
          >
            {isPending ? "Creating Draft..." : "Create Draft"}
          </button>
        </div>
      </form>
    </section>
  );
}

function NumberField({
  id,
  label,
  name,
  value,
  min,
  max,
  disabled,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  min: number;
  max: number;
  disabled: boolean;
  errors: DraftSetupValidationError[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm text-zinc-700" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <input
        id={id}
        name={name}
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-invalid={errors.length > 0}
        className="h-10 rounded border border-zinc-300 bg-white px-3 text-zinc-950 disabled:bg-zinc-100"
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <ErrorList errors={errors} />
    </label>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function ErrorList({ errors }: { errors: DraftSetupValidationError[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 grid gap-1" role="alert">
      {errors.map((error) => (
        <p key={`${error.field}:${error.message}`} className="text-sm text-red-700">
          {error.message}
        </p>
      ))}
    </div>
  );
}

function createDefaultValues(
  rankingSummaries: readonly RankingSetSummary[],
  defaultRankingSetId: string,
): DraftSetupFormValues {
  const hasDefaultRankingSet = rankingSummaries.some((summary) => {
    return summary.id === defaultRankingSetId;
  });

  return {
    rankingSetId: hasDefaultRankingSet ? defaultRankingSetId : "",
    teamCount: defaultLeagueSetupInput.teamCount.toString(),
    userDraftPosition: defaultLeagueSetupInput.userDraftPosition.toString(),
    rosterSlotCounts: Object.fromEntries(
      LEAGUE_SETUP_ROSTER_CATEGORIES.map((category) => [
        category,
        defaultLeagueSetupInput.rosterSlotCounts[category].toString(),
      ]),
    ) as DraftSetupFormValues["rosterSlotCounts"],
  };
}

function validateDraftSetupValues(
  values: DraftSetupFormValues,
  rankingSummaries: readonly RankingSetSummary[],
): DraftSetupValidationError[] {
  const selectedSummary = getSelectedSummary(rankingSummaries, values.rankingSetId);

  if (!selectedSummary) {
    return [
      {
        field: "rankingSetId",
        message: rankingSummaries.length > 0
          ? "Choose a managed ranking set."
          : "A managed ranking set is required before creating a draft.",
      },
    ];
  }

  const setup = buildLeagueSetup(
    toLeagueSetupInput(values),
    selectedSummary.entryCount,
  );

  return setup.ok ? [] : setup.errors;
}

function toLeagueSetupInput(values: DraftSetupFormValues): LeagueSetupInput {
  return {
    teamCount: parseNumericValue(values.teamCount),
    userDraftPosition: parseNumericValue(values.userDraftPosition),
    draftType: "SNAKE",
    scoringFormat: "PPR",
    rosterSlotCounts: Object.fromEntries(
      LEAGUE_SETUP_ROSTER_CATEGORIES.map((category) => [
        category,
        parseNumericValue(values.rosterSlotCounts[category]),
      ]),
    ) as LeagueSetupInput["rosterSlotCounts"],
  };
}

function parseNumericValue(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function getDraftSummary(values: DraftSetupFormValues) {
  const teamCount = getFiniteNumber(values.teamCount);
  const rosterCounts = LEAGUE_SETUP_ROSTER_CATEGORIES.map((category) => {
    return getFiniteNumber(values.rosterSlotCounts[category]);
  });

  if (
    teamCount === null ||
    rosterCounts.some((count) => count === null || count < 0)
  ) {
    return null;
  }

  const rounds = rosterCounts.reduce<number>((total, count) => total + (count ?? 0), 0);

  return { rounds, totalPicks: teamCount * rounds };
}

function getFiniteNumber(value: string): number | null {
  const parsed = parseNumericValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrors(
  errors: readonly DraftSetupValidationError[],
  field: DraftSetupValidationError["field"],
) {
  return errors.filter((error) => error.field === field);
}

function getSelectedSummary(
  rankingSummaries: readonly RankingSetSummary[],
  rankingSetId: string,
) {
  return rankingSummaries.find((summary) => summary.id === rankingSetId) ?? null;
}

function getRankingSummaryWarnings(summary: RankingSetSummary): string[] {
  const warnings: string[] = [];
  const neutralTierPositions = getNeutralTierPositions(summary);

  if (neutralTierPositions.length > 0) {
    warnings.push(
      `Tiers were neutralized for ${neutralTierPositions.join(", ")}.`,
    );
  }

  if (summary.capabilities.team !== "complete") {
    warnings.push("Team metadata is missing or partial.");
  }

  if (summary.capabilities.adp !== "complete") {
    warnings.push("ADP metadata is missing or partial.");
  }

  return warnings;
}

function getNeutralTierPositions(summary: RankingSetSummary): Position[] {
  return (
    Object.entries(summary.capabilities.tiers) as [
      Position,
      RankingTierCapability,
    ][]
  )
    .filter(([, capability]) => capability === "defaulted-neutral")
    .map(([position]) => position)
    .sort();
}

function formatSourceKind(sourceKind: RankingSetSourceKind): string {
  return sourceKind
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
