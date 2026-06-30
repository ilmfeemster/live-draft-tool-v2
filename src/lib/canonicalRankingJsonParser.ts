import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  CANONICAL_RANKING_JSON_V1_PROFILE,
} from "@/lib/rankingImportPreflight";
import type {
  ParsedRankingField,
  ParsedRankingSourceDocument,
  ParsedRankingSourceRecord,
  PreflightRankingDocument,
  RankingImportDiagnostic,
  RankingImportDiagnosticLocation,
  RankingImportStageResult,
} from "@/types/rankingImport";

export type CanonicalRankingJsonParserDiagnosticCode =
  | "wrong-format"
  | "malformed-json"
  | "invalid-root"
  | "wrong-document-type"
  | "missing-schema-version"
  | "unsupported-schema-version"
  | "missing-envelope-field"
  | "invalid-envelope-field"
  | "invalid-entry-shape"
  | "too-many-records";

export type CanonicalRankingJsonParsedMetadata = Readonly<{
  schemaVersion: ParsedRankingField;
  documentMetadata: ParsedRankingField;
  capabilities: ParsedRankingField;
}>;

type ParserDiagnostic =
  RankingImportDiagnostic<CanonicalRankingJsonParserDiagnosticCode>;
type ParserResult = RankingImportStageResult<
  ParsedRankingSourceDocument,
  CanonicalRankingJsonParserDiagnosticCode
>;
type JsonObject = Record<string, unknown>;

const SCENARIO_FIELDS = [
  "leagueSettings",
  "draftConfiguration",
  "userTeamContext",
  "pickHistory",
  "replayTarget",
] as const;

const ENTRY_FIELD_MAPPINGS = [
  ["overallRank", "overallOrder"],
  ["positionRank", "sourcePositionRank"],
  ["tier", "tier"],
  ["adpRank", "adpRank"],
] as const;

const PLAYER_FIELD_MAPPINGS = [
  ["id", "playerId"],
  ["name", "playerName"],
  ["team", "team"],
  ["position", "position"],
] as const;

export function parseCanonicalRankingJson(
  document: PreflightRankingDocument,
): ParserResult {
  if (
    document.format.id !== CANONICAL_RANKING_JSON_V1_FORMAT.id ||
    document.format.version !== CANONICAL_RANKING_JSON_V1_FORMAT.version
  ) {
    return failure([
      error(
        "wrong-format",
        "Canonical ranking JSON parser requires canonical-ranking-json version 1.",
      ),
    ]);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(document.text) as unknown;
  } catch {
    return failure([
      error("malformed-json", "Canonical ranking JSON is malformed.", {
        path: "$",
      }),
    ]);
  }

  if (!isJsonObject(parsed)) {
    return failure([
      error(
        "invalid-root",
        "Canonical ranking JSON must have an object root.",
        { path: "$" },
      ),
    ]);
  }

  if (isScenarioDocument(parsed)) {
    return failure([
      error(
        "wrong-document-type",
        "Scenario V1 JSON cannot be imported as a canonical ranking set.",
        { path: "$" },
      ),
    ]);
  }

  if (!hasOwn(parsed, "schemaVersion")) {
    return failure([
      error(
        "missing-schema-version",
        "Canonical ranking JSON must declare schemaVersion.",
        { path: "schemaVersion" },
      ),
    ]);
  }

  if (
    parsed.schemaVersion !==
    CANONICAL_RANKING_JSON_V1_PROFILE.schemaVersion
  ) {
    return failure([
      error(
        "unsupported-schema-version",
        "Canonical ranking JSON schemaVersion must be the number 1.",
        { path: "schemaVersion" },
      ),
    ]);
  }

  const envelopeErrors = validateEnvelope(parsed);

  if (envelopeErrors.length > 0) {
    return failure(envelopeErrors);
  }

  const entries = parsed.entries as unknown[];

  if (entries.length > CANONICAL_RANKING_JSON_V1_PROFILE.maxEntries) {
    return failure([
      error(
        "too-many-records",
        `Canonical ranking JSON must not contain more than ${CANONICAL_RANKING_JSON_V1_PROFILE.maxEntries} entries.`,
        { path: "entries" },
      ),
    ]);
  }

  const entryErrors = entries.flatMap((entry, index) => {
    if (isJsonObject(entry)) {
      return [];
    }

    return [
      error(
        "invalid-entry-shape",
        "Canonical ranking JSON entries must be objects.",
        { path: entryPath(index) },
      ),
    ];
  });

  if (entryErrors.length > 0) {
    return failure(entryErrors);
  }

  const metadata: CanonicalRankingJsonParsedMetadata = {
    schemaVersion: parsedField(
      parsed.schemaVersion,
      "schemaVersion",
      "schemaVersion",
    ),
    documentMetadata: parsedField(
      parsed.metadata,
      "metadata",
      "metadata",
    ),
    capabilities: parsedField(
      parsed.capabilities,
      "capabilities",
      "capabilities",
    ),
  };

  return {
    ok: true,
    value: {
      format: document.format,
      metadata,
      tierSemantics: CANONICAL_RANKING_JSON_V1_PROFILE.tierSemantics,
      records: (entries as JsonObject[]).map(mapEntry),
    },
    warnings: [],
  };
}

function validateEnvelope(root: JsonObject): ParserDiagnostic[] {
  const errors: ParserDiagnostic[] = [];

  validateEnvelopeField(root, "metadata", isJsonObject, errors);
  validateEnvelopeField(root, "capabilities", isJsonObject, errors);
  validateEnvelopeField(root, "entries", Array.isArray, errors);

  return errors;
}

function validateEnvelopeField(
  root: JsonObject,
  field: "metadata" | "capabilities" | "entries",
  isValid: (value: unknown) => boolean,
  errors: ParserDiagnostic[],
): void {
  if (!hasOwn(root, field)) {
    errors.push(
      error(
        "missing-envelope-field",
        `Canonical ranking JSON must contain ${field}.`,
        { path: field },
      ),
    );
    return;
  }

  if (!isValid(root[field])) {
    const expectedShape = field === "entries" ? "an array" : "an object";
    errors.push(
      error(
        "invalid-envelope-field",
        `Canonical ranking JSON ${field} must be ${expectedShape}.`,
        { path: field },
      ),
    );
  }
}

function mapEntry(entry: JsonObject, index: number): ParsedRankingSourceRecord {
  const fields: Record<string, ParsedRankingField> = {};
  const basePath = entryPath(index);

  for (const [sourceField, semanticField] of ENTRY_FIELD_MAPPINGS) {
    if (hasOwn(entry, sourceField)) {
      fields[semanticField] = parsedField(
        entry[sourceField],
        `${basePath}.${sourceField}`,
        semanticField,
      );
    }
  }

  if (hasOwn(entry, "player")) {
    if (isJsonObject(entry.player)) {
      for (const [sourceField, semanticField] of PLAYER_FIELD_MAPPINGS) {
        if (hasOwn(entry.player, sourceField)) {
          fields[semanticField] = parsedField(
            entry.player[sourceField],
            `${basePath}.player.${sourceField}`,
            semanticField,
          );
        }
      }
    } else {
      fields.player = parsedField(
        entry.player,
        `${basePath}.player`,
        "player",
      );
    }
  }

  return {
    sourceIndex: index,
    fields,
  };
}

function parsedField(
  value: unknown,
  path: string,
  field: string,
): ParsedRankingField {
  return {
    value,
    location: { path, field },
  };
}

function isScenarioDocument(root: JsonObject): boolean {
  return (
    hasOwn(root, "rankingContext") &&
    SCENARIO_FIELDS.some((field) => hasOwn(root, field))
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object: JsonObject, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function entryPath(index: number): string {
  return `entries[${index}]`;
}

function error(
  code: CanonicalRankingJsonParserDiagnosticCode,
  message: string,
  location?: RankingImportDiagnosticLocation,
): ParserDiagnostic {
  return {
    code,
    stage: "parse",
    severity: "error",
    message,
    ...(location === undefined ? {} : { location }),
  };
}

function failure(errors: readonly ParserDiagnostic[]): ParserResult {
  return { ok: false, errors, warnings: [] };
}
