import {
  CANONICAL_RANKING_JSON_V1_PROFILE,
  RANKING_IMPORT_LIMITS,
} from "@/lib/rankingImportPreflight";
import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position } from "@/types/draft";
import type {
  CanonicalRankingSetDocumentV1,
  CanonicalRankingSetSourceV1,
} from "@/types/rankingImport";
import type { RankingSet, RankingSetCapabilities } from "@/types/rankings";

export type CanonicalRankingJsonExportRequest = Readonly<{
  exportedAt: Date;
  includeSourceRankingSetId?: boolean;
}>;

export type CanonicalRankingJsonExportValue = Readonly<{
  document: CanonicalRankingSetDocumentV1;
  text: string;
  byteLength: number;
}>;

export type CanonicalRankingJsonExportErrorCode =
  | "invalid-export-date"
  | "invalid-export-option"
  | "invalid-ranking-set"
  | "entry-limit-exceeded"
  | "output-too-large";

export type CanonicalRankingJsonExportError = Readonly<{
  code: CanonicalRankingJsonExportErrorCode;
  message: string;
  path?: string;
}>;

export type CanonicalRankingJsonExportResult =
  | Readonly<{
      ok: true;
      value: CanonicalRankingJsonExportValue;
    }>
  | Readonly<{
      ok: false;
      errors: readonly CanonicalRankingJsonExportError[];
    }>;

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function exportCanonicalRankingSetJson(
  rankingSet: RankingSet,
  request: CanonicalRankingJsonExportRequest,
): CanonicalRankingJsonExportResult {
  const requestRecord = asRecord(request);

  if (!isValidDate(requestRecord?.exportedAt)) {
    return failure([
      {
        code: "invalid-export-date",
        message: "Canonical ranking export requires a valid exportedAt Date.",
      },
    ]);
  }

  if (
    requestRecord.includeSourceRankingSetId !== undefined &&
    typeof requestRecord.includeSourceRankingSetId !== "boolean"
  ) {
    return failure([
      {
        code: "invalid-export-option",
        message:
          "Canonical ranking export includeSourceRankingSetId must be a boolean when present.",
      },
    ]);
  }

  const validation = validateRankingSet(rankingSet);

  if (!validation.ok) {
    return failure(
      validation.errors.map((domainError) => ({
        code: "invalid-ranking-set",
        message: domainError.message,
        path: domainError.path,
      })),
    );
  }

  if (rankingSet.entries.length > RANKING_IMPORT_LIMITS.maxEntries) {
    return failure([
      {
        code: "entry-limit-exceeded",
        message: `Canonical ranking export must not contain more than ${RANKING_IMPORT_LIMITS.maxEntries} entries.`,
        path: "entries",
      },
    ]);
  }

  const document = mapDocument(
    validation.rankingSet,
    requestRecord.exportedAt,
    requestRecord.includeSourceRankingSetId === true,
  );
  const text = JSON.stringify(document);
  const byteLength = new TextEncoder().encode(text).byteLength;

  if (byteLength > RANKING_IMPORT_LIMITS.maxBytes) {
    return failure([
      {
        code: "output-too-large",
        message: `Canonical ranking export must not exceed ${RANKING_IMPORT_LIMITS.maxBytes} UTF-8 bytes.`,
      },
    ]);
  }

  return {
    ok: true,
    value: { document, text, byteLength },
  };
}

function mapDocument(
  rankingSet: RankingSet,
  exportedAt: Date,
  includeSourceRankingSetId: boolean,
): CanonicalRankingSetDocumentV1 {
  const metadata = {
    name: rankingSet.name,
    exportedAt: exportedAt.toISOString(),
    ...(includeSourceRankingSetId
      ? { sourceRankingSetId: rankingSet.id }
      : {}),
    source: mapSource(rankingSet),
  };

  return {
    schemaVersion: CANONICAL_RANKING_JSON_V1_PROFILE.schemaVersion,
    metadata,
    capabilities: mapCapabilities(rankingSet.capabilities),
    entries: rankingSet.entries.map((entry) => ({
      player: {
        id: entry.player.id,
        name: entry.player.name,
        team: entry.player.team,
        position: entry.player.position,
      },
      overallRank: entry.overallRank,
      positionRank: entry.positionRank,
      tier: entry.tier,
      adpRank: entry.adpRank,
    })),
  };
}

function mapSource(rankingSet: RankingSet): CanonicalRankingSetSourceV1 {
  const source = rankingSet.source;

  return {
    kind: source.kind,
    ...(source.formatId === undefined ? {} : { formatId: source.formatId }),
    ...(source.formatVersion === undefined
      ? {}
      : { formatVersion: source.formatVersion }),
    ...(source.label === undefined ? {} : { label: source.label }),
    ...(source.importedAt === undefined
      ? {}
      : { importedAt: source.importedAt.toISOString() }),
  };
}

function mapCapabilities(
  capabilities: RankingSetCapabilities,
): RankingSetCapabilities {
  const tiers: RankingSetCapabilities["tiers"] = Object.fromEntries(
    POSITIONS.flatMap((position) => {
      const capability = capabilities.tiers[position];
      return capability === undefined ? [] : [[position, capability]];
    }),
  );

  return {
    team: capabilities.team,
    playerIdentity: capabilities.playerIdentity,
    overallOrder: capabilities.overallOrder,
    positionRank: capabilities.positionRank,
    adp: capabilities.adp,
    tiers,
  };
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function failure(
  errors: readonly CanonicalRankingJsonExportError[],
): CanonicalRankingJsonExportResult {
  return { ok: false, errors };
}
