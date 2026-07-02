import { RANKING_IMPORT_LIMITS } from "@/lib/rankingImportPreflight";
import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position } from "@/types/draft";
import type {
  CanonicalRankingSetDocumentV2,
  CanonicalRankingSetSourceV1,
  RankingTierSemanticContract,
} from "@/types/rankingImport";
import {
  NEUTRAL_TIER,
  type RankingRecommendationTierSemantics,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSourceTierSemantics,
} from "@/types/rankings";

export type CanonicalRankingJsonExplicitTierDocument =
  CanonicalRankingSetDocumentV2;

export type CanonicalRankingJsonExportRequest = Readonly<{
  exportedAt: Date;
  includeSourceRankingSetId?: boolean;
}>;

export type CanonicalRankingJsonExportValue = Readonly<{
  document: CanonicalRankingSetDocumentV2;
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
  const text = JSON.stringify(document, null, 2);
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
): CanonicalRankingSetDocumentV2 {
  const metadata = {
    name: rankingSet.name,
    exportedAt: exportedAt.toISOString(),
    ...(includeSourceRankingSetId
      ? { sourceRankingSetId: rankingSet.id }
      : {}),
    source: mapSource(rankingSet),
  };
  const tierState = resolveTierState(rankingSet);

  return {
    schemaVersion: 2,
    metadata,
    tierSemantics: {
      sourceTier: mapSourceTierContract(tierState.sourceKind),
      recommendationTier: mapRecommendationTierContract(
        tierState.recommendation,
      ),
    },
    capabilities: mapCapabilities(
      rankingSet.capabilities,
      tierState.recommendation,
    ),
    entries: rankingSet.entries.map((entry) => ({
      player: {
        id: entry.player.id,
        name: entry.player.name,
        team: entry.player.team,
        position: entry.player.position,
      },
      overallRank: entry.overallRank,
      positionRank: entry.positionRank,
      sourceTier:
        tierState.sourceValues.get(sourceTierKey(entry.player.id, entry.overallRank)) ??
        null,
      recommendationTier:
        tierState.recommendation[entry.player.position] ===
        "recommendation-position"
          ? entry.tier
          : NEUTRAL_TIER,
      adpRank: entry.adpRank,
    })),
  };
}

type ExportTierState = Readonly<{
  sourceKind: RankingSourceTierSemantics;
  sourceValues: ReadonlyMap<string, number>;
  recommendation: Readonly<
    Partial<Record<Position, RankingRecommendationTierSemantics>>
  >;
}>;

function resolveTierState(rankingSet: RankingSet): ExportTierState {
  if (!rankingSet.tierSemantics) {
    const sourceValues = new Map<string, number>();
    const recommendation: Partial<
      Record<Position, RankingRecommendationTierSemantics>
    > = {};

    rankingSet.entries.forEach((entry) => {
      sourceValues.set(
        sourceTierKey(entry.player.id, entry.overallRank),
        entry.tier,
      );
      recommendation[entry.player.position] = "neutral";
    });

    return {
      sourceKind: "legacy-ambiguous",
      sourceValues,
      recommendation,
    };
  }

  const sourceValues = new Map<string, number>();
  rankingSet.tierSemantics.source.values?.forEach((value) => {
    sourceValues.set(
      sourceTierKey(value.playerId, value.overallRank),
      value.tier,
    );
  });

  return {
    sourceKind: rankingSet.tierSemantics.source.kind,
    sourceValues,
    recommendation: { ...rankingSet.tierSemantics.recommendation },
  };
}

function mapSourceTierContract(
  sourceKind: RankingSourceTierSemantics,
): RankingTierSemanticContract {
  if (sourceKind === "source-overall") {
    return {
      kind: "source-only",
      sourceScope: "overall",
      recommendationEligible: false,
    };
  }

  if (sourceKind === "legacy-ambiguous") {
    return {
      kind: "legacy-ambiguous",
      sourceScope: "unknown",
      recommendationEligible: false,
    };
  }

  return {
    kind: "absent",
    sourceScope: "unknown",
    recommendationEligible: false,
  };
}

function mapRecommendationTierContract(
  recommendation: ExportTierState["recommendation"],
): RankingTierSemanticContract {
  const recommendationEligible = Object.values(recommendation).includes(
    "recommendation-position",
  );

  return recommendationEligible
    ? {
        kind: "recommendation-eligible",
        sourceScope: "position",
        recommendationEligible: true,
      }
    : {
        kind: "neutral",
        sourceScope: "position",
        recommendationEligible: false,
      };
}

function sourceTierKey(playerId: string, overallRank: number): string {
  return `${playerId}\u0000${overallRank}`;
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
  recommendation: ExportTierState["recommendation"],
): RankingSetCapabilities {
  const tiers: RankingSetCapabilities["tiers"] = Object.fromEntries(
    POSITIONS.flatMap((position) => {
      const semantic = recommendation[position];
      return semantic === undefined
        ? []
        : [
            [
              position,
              semantic === "neutral" ? "defaulted-neutral" : "source",
            ],
          ];
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
