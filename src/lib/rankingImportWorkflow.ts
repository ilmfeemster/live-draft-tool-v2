import { parseCanonicalRankingJson } from "@/lib/canonicalRankingJsonParser";
import { parseFantasyProsCsv } from "@/lib/fantasyProsCsvParser";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  FANTASYPROS_CSV_V1_FORMAT,
  isRankingImportFormatId,
  preflightRankingImport,
} from "@/lib/rankingImportPreflight";
import { validateNormalizedRankingCandidate } from "@/lib/rankingCandidateValidation";
import { normalizeRankingSource } from "@/lib/rankingNormalizer";
import {
  createRankingSet,
  getRankingSetById,
  replaceRankingSet,
  type CreateRankingSetError,
  type CreateRankingSetResult,
  type ReplaceRankingSetError,
  type ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import { convertValidatedRankingCandidate } from "@/lib/rankingSetConversion";
import type {
  ParsedRankingSourceDocument,
  PreflightRankingDocument,
  RankingImportDiagnostic,
  RankingImportFormatId,
  RankingImportStageResult,
} from "@/types/rankingImport";
import type { RankingSet } from "@/types/rankings";

export type ImportRankingSetIntent =
  | Readonly<{ kind: "create"; rankingSetId?: string }>
  | Readonly<{ kind: "replace"; rankingSetId: string }>;

export type ImportRankingSetInput = Readonly<{
  text: string;
  formatId: RankingImportFormatId;
  formatVersion?: 1;
  name: string;
  sourceLabel?: string;
  intent?: ImportRankingSetIntent;
  importedAt?: Date;
}>;

export type ImportRankingSetResult =
  | Readonly<{
      ok: true;
      rankingSet: RankingSet;
      warnings: readonly RankingImportDiagnostic[];
      created: boolean;
      replaced: boolean;
    }>
  | Readonly<{
      ok: false;
      errors: readonly RankingImportDiagnostic[];
      warnings: readonly RankingImportDiagnostic[];
    }>;

export type RankingImportWorkflowRepository = Readonly<{
  createRankingSet(rankingSet: RankingSet): Promise<CreateRankingSetResult>;
  replaceRankingSet(rankingSet: RankingSet): Promise<ReplaceRankingSetResult>;
  getRankingSetById(id: string): Promise<RankingSet | null>;
}>;

export type ImportRankingSetOptions = Readonly<{
  repository?: RankingImportWorkflowRepository;
  generateRankingSetId?: () => string;
  now?: () => Date;
}>;

type StageOutcome<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Extract<ImportRankingSetResult, { ok: false }>;

const defaultRepository: RankingImportWorkflowRepository = {
  createRankingSet,
  replaceRankingSet,
  getRankingSetById,
};

export async function importRankingSet(
  input: ImportRankingSetInput,
  options: ImportRankingSetOptions = {},
): Promise<ImportRankingSetResult> {
  const repository = options.repository ?? defaultRepository;
  const now = options.now ?? (() => new Date());
  const importedAt = input.importedAt ?? now();
  const requestValidation = validateRequest(input, importedAt);

  if (requestValidation.length > 0) {
    return { ok: false, errors: requestValidation, warnings: [] };
  }

  const preflight = preflightRankingImport({
    formatId: input.formatId,
    formatVersion: input.formatVersion ?? 1,
    bytes: new TextEncoder().encode(input.text),
  });
  const warnings: RankingImportDiagnostic[] = [];
  const preflighted = collectStage(preflight, warnings);

  if (!preflighted.ok) {
    return preflighted;
  }

  const parsed = collectStage(parseDocument(preflighted.value), warnings);

  if (!parsed.ok) {
    return parsed;
  }

  const normalized = collectStage(
    normalizeRankingSource(parsed.value, {
      name: input.name,
      ...(input.sourceLabel === undefined
        ? {}
        : { sourceLabel: input.sourceLabel }),
      importedAt,
    }),
    warnings,
  );

  if (!normalized.ok) {
    return normalized;
  }

  const validated = collectStage(
    validateNormalizedRankingCandidate(normalized.value),
    warnings,
  );

  if (!validated.ok) {
    return validated;
  }

  const intent = input.intent ?? { kind: "create" };
  const rankingSetId =
    intent.kind === "create"
      ? intent.rankingSetId ?? (options.generateRankingSetId ?? generateRankingSetId)()
      : intent.rankingSetId;
  let createdAt = importedAt;

  if (intent.kind === "replace") {
    const existing = await repository.getRankingSetById(rankingSetId);

    if (!existing) {
      return failure([persistDiagnostic(
        "persistence-not-found",
        "Ranking set was not found.",
        "id",
      )], warnings);
    }

    createdAt = existing.createdAt;
  }

  const converted = collectStage(
    convertValidatedRankingCandidate(
      validated.value,
      intent.kind === "create"
        ? {
            workflow: "create",
            rankingSetId,
            timestamp: importedAt,
          }
        : {
            workflow: "replace",
            rankingSetId,
            createdAt,
            timestamp: importedAt,
          },
    ),
    warnings,
  );

  if (!converted.ok) {
    return converted;
  }

  if (intent.kind === "create") {
    const created = await repository.createRankingSet(
      converted.value.rankingSet,
    );

    return mapCreateResult(created, warnings);
  }

  const replaced = await repository.replaceRankingSet(
    converted.value.rankingSet,
  );

  return mapReplaceResult(replaced, warnings);
}

function validateRequest(
  input: ImportRankingSetInput,
  importedAt: Date,
): RankingImportDiagnostic[] {
  const errors: RankingImportDiagnostic[] = [];

  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    errors.push(requestDiagnostic("Ranking import text must not be empty.", "text"));
  }

  if (!isRankingImportFormatId(input.formatId)) {
    errors.push(
      requestDiagnostic(
        `Ranking import format ${String(input.formatId)} is unsupported.`,
        "formatId",
      ),
    );
  }

  if (input.formatVersion !== undefined && input.formatVersion !== 1) {
    errors.push(
      requestDiagnostic(
        `Ranking import format version ${String(input.formatVersion)} is unsupported.`,
        "formatVersion",
      ),
    );
  }

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    errors.push(requestDiagnostic("Ranking set name must not be empty.", "name"));
  }

  if (!isValidDate(importedAt)) {
    errors.push(
      requestDiagnostic("Ranking import timestamp must be a valid Date.", "importedAt"),
    );
  }

  const intent = input.intent;

  if (
    intent !== undefined &&
    intent.kind !== "create" &&
    intent.kind !== "replace"
  ) {
    errors.push(requestDiagnostic("Ranking import intent is unsupported.", "intent"));
  }

  if (
    intent?.kind === "replace" &&
    (typeof intent.rankingSetId !== "string" ||
      intent.rankingSetId.trim().length === 0)
  ) {
    errors.push(
      requestDiagnostic(
        "Replacement ranking set ID must be a non-empty string.",
        "intent.rankingSetId",
      ),
    );
  }

  return errors;
}

function parseDocument(
  document: PreflightRankingDocument,
): RankingImportStageResult<ParsedRankingSourceDocument> {
  switch (document.format.id) {
    case FANTASYPROS_CSV_V1_FORMAT.id:
      return parseFantasyProsCsv(document);
    case CANONICAL_RANKING_JSON_V1_FORMAT.id:
      return parseCanonicalRankingJson(document);
    default:
      return {
        ok: false,
        errors: [
          {
            code: "unsupported-format",
            stage: "parse",
            severity: "error",
            message: "Ranking parser received an unsupported format.",
          },
        ],
        warnings: [],
      };
  }
}

function collectStage<TValue>(
  result: RankingImportStageResult<TValue>,
  warnings: RankingImportDiagnostic[],
): StageOutcome<TValue> {
  warnings.push(...result.warnings);

  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: [...warnings] };
  }

  return { ok: true, value: result.value };
}

function mapCreateResult(
  result: CreateRankingSetResult,
  warnings: readonly RankingImportDiagnostic[],
): ImportRankingSetResult {
  if (result.ok) {
    return {
      ok: true,
      rankingSet: result.rankingSet,
      warnings,
      created: true,
      replaced: false,
    };
  }

  return failure(result.errors.map(mapRepositoryError), warnings);
}

function mapReplaceResult(
  result: ReplaceRankingSetResult,
  warnings: readonly RankingImportDiagnostic[],
): ImportRankingSetResult {
  if (result.ok) {
    return {
      ok: true,
      rankingSet: result.rankingSet,
      warnings,
      created: false,
      replaced: true,
    };
  }

  return failure(result.errors.map(mapRepositoryError), warnings);
}

function mapRepositoryError(
  error: CreateRankingSetError | ReplaceRankingSetError,
): RankingImportDiagnostic {
  switch (error.code) {
    case "invalid-ranking-set":
      return persistDiagnostic(
        "persistence-invalid-ranking-set",
        error.message,
        error.path,
      );
    case "name-conflict":
      return persistDiagnostic(
        "persistence-name-conflict",
        error.message,
        error.path,
      );
    case "not-found":
      return persistDiagnostic("persistence-not-found", error.message, error.path);
    default:
      return mapUnexpectedRepositoryError(error);
  }
}

function mapUnexpectedRepositoryError(error: {
  message: string;
  path?: string;
}): RankingImportDiagnostic {
  return persistDiagnostic("persistence-rejected", error.message, error.path);
}

function failure(
  errors: readonly RankingImportDiagnostic[],
  warnings: readonly RankingImportDiagnostic[],
): ImportRankingSetResult {
  return { ok: false, errors, warnings };
}

function requestDiagnostic(
  message: string,
  path: string,
): RankingImportDiagnostic {
  return {
    code: "invalid-import-request",
    stage: "preflight",
    severity: "error",
    message,
    location: { path },
  };
}

function persistDiagnostic(
  code: string,
  message: string,
  path?: string,
): RankingImportDiagnostic {
  return {
    code,
    stage: "persist",
    severity: "error",
    message,
    ...(path === undefined ? {} : { location: { path } }),
  };
}

function generateRankingSetId(): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `ranking-set-${randomId}`;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
