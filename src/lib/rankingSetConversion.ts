import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position, RankingEntry } from "@/types/draft";
import type {
  ConvertedRankingSet,
  RankingImportDiagnostic,
  RankingImportStageResult,
  ValidatedRankingCandidate,
} from "@/types/rankingImport";
import type {
  RankingSet,
  RankingSetCapabilities,
  RankingSetSource,
} from "@/types/rankings";

export type RankingSetCreateConversionRequest = Readonly<{
  workflow: "create";
  rankingSetId: string;
  timestamp: Date;
}>;

export type RankingSetReplaceConversionRequest = Readonly<{
  workflow: "replace";
  rankingSetId: string;
  createdAt: Date;
  timestamp: Date;
}>;

export type RankingSetConversionRequest =
  | RankingSetCreateConversionRequest
  | RankingSetReplaceConversionRequest;

export type RankingSetConversionDiagnosticCode =
  | "invalid-validated-candidate"
  | "invalid-workflow"
  | "invalid-ranking-set-id"
  | "invalid-lifecycle-date"
  | "invalid-lifecycle-order"
  | "canonical-invariant-failed";

type ConversionDiagnostic =
  RankingImportDiagnostic<RankingSetConversionDiagnosticCode>;
type ConversionResult = RankingImportStageResult<
  ConvertedRankingSet,
  RankingSetConversionDiagnosticCode
>;
type UnknownRecord = Record<string, unknown>;

export function convertValidatedRankingCandidate(
  validatedCandidate: ValidatedRankingCandidate,
  request: RankingSetConversionRequest,
): ConversionResult {
  const wrapper = asRecord(validatedCandidate);
  const candidate = asRecord(wrapper?.candidate);

  if (wrapper?.validated !== true || !candidate) {
    return failure([
      diagnostic(
        "invalid-validated-candidate",
        "Ranking set conversion requires a validated candidate wrapper.",
      ),
    ]);
  }

  const requestRecord = asRecord(request);

  if (
    !requestRecord ||
    (requestRecord.workflow !== "create" &&
      requestRecord.workflow !== "replace")
  ) {
    return failure([
      diagnostic(
        "invalid-workflow",
        "Ranking set conversion workflow must be create or replace.",
      ),
    ]);
  }

  const workflow = requestRecord.workflow;

  if (!isNonEmptyString(requestRecord.rankingSetId)) {
    return failure([
      diagnostic(
        "invalid-ranking-set-id",
        "Ranking set conversion requires a non-empty local ID.",
      ),
    ]);
  }

  const lifecycleResult = validateLifecycle(requestRecord, workflow);

  if (!lifecycleResult.ok) {
    return failure(lifecycleResult.errors);
  }

  const sourceEntries = candidate.entries;

  if (!Array.isArray(sourceEntries) || !hasUnambiguousSourceOrder(sourceEntries)) {
    return failure([
      diagnostic(
        "invalid-validated-candidate",
        "Validated candidate entries must have unique positive source order.",
      ),
    ]);
  }

  const rankingSet = buildRankingSet(
    validatedCandidate.candidate,
    requestRecord.rankingSetId,
    lifecycleResult.createdAt,
    lifecycleResult.updatedAt,
  );
  const invariantResult = validateRankingSet(rankingSet);

  if (!invariantResult.ok) {
    return failure(
      invariantResult.errors.map((domainError) =>
        diagnostic(
          "canonical-invariant-failed",
          domainError.message,
          { path: domainError.path },
        ),
      ),
    );
  }

  return {
    ok: true,
    value: { converted: true, rankingSet: invariantResult.rankingSet },
    warnings: [],
  };
}

type LifecycleResult =
  | { ok: true; createdAt: Date; updatedAt: Date }
  | { ok: false; errors: ConversionDiagnostic[] };

function validateLifecycle(
  request: UnknownRecord,
  workflow: "create" | "replace",
): LifecycleResult {
  if (workflow === "create") {
    if (!isValidDate(request.timestamp)) {
      return {
        ok: false,
        errors: [
          diagnostic(
            "invalid-lifecycle-date",
            "Create timestamp must be a valid Date.",
          ),
        ],
      };
    }

    return {
      ok: true,
      createdAt: cloneDate(request.timestamp),
      updatedAt: cloneDate(request.timestamp),
    };
  }

  const errors: ConversionDiagnostic[] = [];
  const createdAtValid = isValidDate(request.createdAt);
  const timestampValid = isValidDate(request.timestamp);

  if (!createdAtValid) {
    errors.push(
      diagnostic(
        "invalid-lifecycle-date",
        "Replacement createdAt must be a valid Date.",
      ),
    );
  }

  if (!timestampValid) {
    errors.push(
      diagnostic(
        "invalid-lifecycle-date",
        "Replacement timestamp must be a valid Date.",
      ),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (
    (request.timestamp as Date).getTime() <
    (request.createdAt as Date).getTime()
  ) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "invalid-lifecycle-order",
          "Replacement timestamp must not be earlier than createdAt.",
        ),
      ],
    };
  }

  return {
    ok: true,
    createdAt: cloneDate(request.createdAt as Date),
    updatedAt: cloneDate(request.timestamp as Date),
  };
}

function hasUnambiguousSourceOrder(entries: readonly unknown[]): boolean {
  const orders = new Set<number>();

  for (const value of entries) {
    const entry = asRecord(value);

    if (!entry || !isPositiveInteger(entry.sourceOrder)) {
      return false;
    }

    if (orders.has(entry.sourceOrder)) {
      return false;
    }

    orders.add(entry.sourceOrder);
  }

  return true;
}

function buildRankingSet(
  candidate: ValidatedRankingCandidate["candidate"],
  rankingSetId: string,
  createdAt: Date,
  updatedAt: Date,
): RankingSet {
  const positionCounts = new Map<Position, number>();
  const sortedEntries = [...candidate.entries].sort(
    (left, right) => (left.sourceOrder as number) - (right.sourceOrder as number),
  );
  const entries: RankingEntry[] = sortedEntries.map((entry, index) => {
    const position = entry.position as Position;
    const positionRank = (positionCounts.get(position) ?? 0) + 1;
    positionCounts.set(position, positionRank);

    return {
      player: {
        id: entry.playerId as string,
        name: entry.playerName as string,
        team: entry.team as string,
        position,
      },
      overallRank: index + 1,
      positionRank,
      tier: entry.tier as number,
      adpRank: entry.adpRank,
    };
  });

  return {
    id: rankingSetId,
    name: candidate.name,
    source: copySource(candidate.source),
    capabilities: copyCapabilities(candidate.capabilities),
    entries,
    createdAt: cloneDate(createdAt),
    updatedAt: cloneDate(updatedAt),
  };
}

function copySource(source: RankingSetSource): RankingSetSource {
  return {
    kind: source.kind,
    ...(source.formatId === undefined ? {} : { formatId: source.formatId }),
    ...(source.formatVersion === undefined
      ? {}
      : { formatVersion: source.formatVersion }),
    ...(source.label === undefined ? {} : { label: source.label }),
    ...(source.importedAt === undefined
      ? {}
      : {
          importedAt:
            source.importedAt instanceof Date
              ? cloneDate(source.importedAt)
              : source.importedAt,
        }),
  } as RankingSetSource;
}

function copyCapabilities(
  capabilities: RankingSetCapabilities,
): RankingSetCapabilities {
  return {
    team: capabilities.team,
    playerIdentity: capabilities.playerIdentity,
    overallOrder: capabilities.overallOrder,
    positionRank: capabilities.positionRank,
    adp: capabilities.adp,
    tiers: { ...capabilities.tiers },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function diagnostic(
  code: RankingSetConversionDiagnosticCode,
  message: string,
  location?: { path: string },
): ConversionDiagnostic {
  return {
    code,
    stage: "convert",
    severity: "error",
    message,
    ...(location === undefined ? {} : { location }),
  };
}

function failure(
  errors: readonly ConversionDiagnostic[],
): ConversionResult {
  return { ok: false, errors, warnings: [] };
}
