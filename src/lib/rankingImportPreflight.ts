import type {
  PreflightRankingDocument,
  RankingImportFormatId,
  RankingImportFormatRef,
  RankingImportStageResult,
  RankingTierSemanticContract,
} from "@/types/rankingImport";

export const RANKING_IMPORT_LIMITS = {
  maxBytes: 1_048_576,
  maxEntries: 1_000,
} as const;

export const FANTASYPROS_CSV_V1_FORMAT = {
  id: "fantasypros-csv",
  version: 1,
} as const satisfies RankingImportFormatRef;

export const CANONICAL_RANKING_JSON_V1_FORMAT = {
  id: "canonical-ranking-json",
  version: 1,
} as const satisfies RankingImportFormatRef;

export const FANTASYPROS_CSV_V1_TIER_SEMANTICS = {
  kind: "source-only",
  sourceScope: "overall",
  recommendationEligible: false,
} as const satisfies RankingTierSemanticContract;

export const CANONICAL_RANKING_JSON_V1_TIER_SEMANTICS = {
  kind: "legacy-ambiguous",
  sourceScope: "unknown",
  recommendationEligible: false,
} as const satisfies RankingTierSemanticContract;

export const FANTASYPROS_CSV_V1_PROFILE = {
  format: FANTASYPROS_CSV_V1_FORMAT,
  maxBytes: RANKING_IMPORT_LIMITS.maxBytes,
  maxEntries: RANKING_IMPORT_LIMITS.maxEntries,
  headerNormalization: "trim-uppercase",
  observedHeaders: [
    "RK",
    "TIERS",
    "PLAYER NAME",
    "TEAM",
    "POS",
    "BYE",
    "UPSIDE ",
    "BUST ",
    "SOS",
    "ECR VS ADP",
  ],
  headers: {
    overallOrder: { aliases: ["RK", "RANK"], required: false },
    tier: {
      aliases: ["TIERS", "TIER"],
      required: false,
      tierSemantics: FANTASYPROS_CSV_V1_TIER_SEMANTICS,
    },
    playerName: { aliases: ["PLAYER NAME", "PLAYER"], required: true },
    team: { aliases: ["TEAM"], required: false },
    position: { aliases: ["POS", "POSITION"], required: true },
    adpDelta: { aliases: ["ECR VS ADP"], required: false },
  },
  ignoredHeaders: ["BYE", "UPSIDE", "BUST", "SOS"],
  adpDeltaNullMarker: "-",
  positionValuePattern: /^(QB|RB|WR|TE|DST|K)([1-9]\d*)?$/,
  adpDeltaValuePattern: /^(?:[+-][1-9]\d*|0|-)$/,
  hasPlayerIdColumn: false,
} as const;

export const CANONICAL_RANKING_JSON_V1_PROFILE = {
  format: CANONICAL_RANKING_JSON_V1_FORMAT,
  schemaVersion: 1,
  maxBytes: RANKING_IMPORT_LIMITS.maxBytes,
  maxEntries: RANKING_IMPORT_LIMITS.maxEntries,
  requiredRootFields: ["schemaVersion", "metadata", "capabilities", "entries"],
  tierSemantics: CANONICAL_RANKING_JSON_V1_TIER_SEMANTICS,
} as const;

export type RankingImportPreflightErrorCode =
  | "unsupported-format"
  | "unsupported-version"
  | "empty-input"
  | "input-too-large"
  | "invalid-encoding";

export type RankingImportPreflightInput = Readonly<{
  formatId: string;
  formatVersion: number;
  bytes: Uint8Array;
}>;

export function preflightRankingImport(
  input: RankingImportPreflightInput,
): RankingImportStageResult<
  PreflightRankingDocument,
  RankingImportPreflightErrorCode
> {
  const format = getSupportedFormat(input.formatId);

  if (!format) {
    return failure(
      "unsupported-format",
      `Ranking import format ${input.formatId} is unsupported.`,
    );
  }

  if (input.formatVersion !== format.version) {
    return failure(
      "unsupported-version",
      `Ranking import format ${format.id} version ${input.formatVersion} is unsupported.`,
    );
  }

  if (input.bytes.byteLength === 0) {
    return failure("empty-input", "Ranking import input must not be empty.");
  }

  if (input.bytes.byteLength > RANKING_IMPORT_LIMITS.maxBytes) {
    return failure(
      "input-too-large",
      `Ranking import input must not exceed ${RANKING_IMPORT_LIMITS.maxBytes} bytes.`,
    );
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch {
    return failure(
      "invalid-encoding",
      "Ranking import input must be valid UTF-8.",
    );
  }

  if (text.startsWith("\uFEFF")) {
    text = text.slice(1);
  }

  if (text.trim().length === 0) {
    return failure("empty-input", "Ranking import input must not be empty.");
  }

  return {
    ok: true,
    value: {
      format,
      text,
      byteLength: input.bytes.byteLength,
    },
    warnings: [],
  };
}

function getSupportedFormat(formatId: string): RankingImportFormatRef | null {
  const formats: readonly RankingImportFormatRef[] = [
    FANTASYPROS_CSV_V1_FORMAT,
    CANONICAL_RANKING_JSON_V1_FORMAT,
  ];

  return formats.find((format) => format.id === formatId) ?? null;
}

function failure(
  code: RankingImportPreflightErrorCode,
  message: string,
): RankingImportStageResult<
  PreflightRankingDocument,
  RankingImportPreflightErrorCode
> {
  return {
    ok: false,
    errors: [
      {
        code,
        stage: "preflight",
        severity: "error",
        message,
      },
    ],
    warnings: [],
  };
}

export function isRankingImportFormatId(
  value: string,
): value is RankingImportFormatId {
  return (
    value === FANTASYPROS_CSV_V1_FORMAT.id ||
    value === CANONICAL_RANKING_JSON_V1_FORMAT.id
  );
}
