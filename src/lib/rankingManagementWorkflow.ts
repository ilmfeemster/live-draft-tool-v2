import {
  exportCanonicalRankingSetJson,
  type CanonicalRankingJsonExportValue,
} from "@/lib/canonicalRankingJsonExporter";
import {
  editRankingSet,
  type RankingSetEditIntent,
  type RankingSetEditResult,
} from "@/lib/rankingSetEditing";
import {
  deleteRankingSetById,
  getRankingSetById,
  listRankingSetSummaries,
  replaceRankingSet,
  type DeleteRankingSetError,
  type DeleteRankingSetResult,
  type ReplaceRankingSetError,
  type ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import type { RankingSet, RankingSetSummary } from "@/types/rankings";

export type RankingManagementError = Readonly<{
  code:
    | "not-found"
    | "invalid-request"
    | "invalid-edit"
    | "name-conflict"
    | "invalid-ranking-set"
    | "export-failed"
    | "persistence-rejected";
  message: string;
  path?: string;
}>;

export type RankingManagementResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; errors: readonly RankingManagementError[] }>;

export type RankingManagementWorkflowRepository = Readonly<{
  listRankingSetSummaries(): Promise<RankingSetSummary[]>;
  getRankingSetById(id: string): Promise<RankingSet | null>;
  replaceRankingSet(rankingSet: RankingSet): Promise<ReplaceRankingSetResult>;
  deleteRankingSetById(id: string): Promise<DeleteRankingSetResult>;
}>;

export type EditManagedRankingSetInput = Readonly<{
  id: string;
  updatedAt: Date;
  intent: RankingSetEditIntent;
}>;

export type ExportManagedRankingSetJsonInput = Readonly<{
  id: string;
  exportedAt: Date;
  includeSourceRankingSetId?: boolean;
}>;

const defaultRepository: RankingManagementWorkflowRepository = {
  listRankingSetSummaries,
  getRankingSetById,
  replaceRankingSet,
  deleteRankingSetById,
};

export async function listManagedRankingSets(
  repository = defaultRepository,
): Promise<RankingManagementResult<readonly RankingSetSummary[]>> {
  return { ok: true, value: await repository.listRankingSetSummaries() };
}

export async function loadManagedRankingSet(
  id: string,
  repository = defaultRepository,
): Promise<RankingManagementResult<RankingSet>> {
  const idError = validateId(id);

  if (idError) {
    return failure([idError]);
  }

  const rankingSet = await repository.getRankingSetById(id);

  if (!rankingSet) {
    return failure([notFoundError()]);
  }

  return { ok: true, value: rankingSet };
}

export async function editManagedRankingSet(
  input: EditManagedRankingSetInput,
  repository = defaultRepository,
): Promise<RankingManagementResult<RankingSet>> {
  const requestErrors = validateEditRequest(input);

  if (requestErrors.length > 0) {
    return failure(requestErrors);
  }

  const current = await repository.getRankingSetById(input.id);

  if (!current) {
    return failure([notFoundError()]);
  }

  const edited = editRankingSet(current, {
    updatedAt: input.updatedAt,
    intent: input.intent,
  });

  if (!edited.ok) {
    return failure(edited.errors.map(mapEditError));
  }

  return mapReplaceResult(await repository.replaceRankingSet(edited.rankingSet));
}

export async function deleteManagedRankingSet(
  id: string,
  repository = defaultRepository,
): Promise<RankingManagementResult<{ id: string }>> {
  const idError = validateId(id);

  if (idError) {
    return failure([idError]);
  }

  const deleted = await repository.deleteRankingSetById(id);

  if (deleted.ok) {
    return { ok: true, value: { id: deleted.id } };
  }

  return failure(deleted.errors.map(mapDeleteError));
}

export async function exportManagedRankingSetJson(
  input: ExportManagedRankingSetJsonInput,
  repository = defaultRepository,
): Promise<RankingManagementResult<CanonicalRankingJsonExportValue>> {
  const requestErrors = validateExportRequest(input);

  if (requestErrors.length > 0) {
    return failure(requestErrors);
  }

  const rankingSet = await repository.getRankingSetById(input.id);

  if (!rankingSet) {
    return failure([notFoundError()]);
  }

  const exported = exportCanonicalRankingSetJson(rankingSet, {
    exportedAt: input.exportedAt,
    ...(input.includeSourceRankingSetId === undefined
      ? {}
      : { includeSourceRankingSetId: input.includeSourceRankingSetId }),
  });

  if (exported.ok) {
    return { ok: true, value: exported.value };
  }

  return failure(
    exported.errors.map((error) => ({
      code: "export-failed",
      message: error.message,
      path: error.path,
    })),
  );
}

function validateEditRequest(
  input: EditManagedRankingSetInput,
): RankingManagementError[] {
  const errors: RankingManagementError[] = [];
  const idError = validateId(input.id);

  if (idError) {
    errors.push(idError);
  }

  if (!isValidDate(input.updatedAt)) {
    errors.push({
      code: "invalid-request",
      message: "Ranking set edit updatedAt must be a valid Date.",
      path: "updatedAt",
    });
  }

  return errors;
}

function validateExportRequest(
  input: ExportManagedRankingSetJsonInput,
): RankingManagementError[] {
  const errors: RankingManagementError[] = [];
  const idError = validateId(input.id);

  if (idError) {
    errors.push(idError);
  }

  if (!isValidDate(input.exportedAt)) {
    errors.push({
      code: "invalid-request",
      message: "Canonical ranking export requires a valid exportedAt Date.",
      path: "exportedAt",
    });
  }

  return errors;
}

function validateId(id: string): RankingManagementError | null {
  if (typeof id === "string" && id.trim().length > 0) {
    return null;
  }

  return {
    code: "invalid-request",
    message: "Ranking set ID must be a non-empty string.",
    path: "id",
  };
}

function mapEditError(
  error: Extract<RankingSetEditResult, { ok: false }>["errors"][number],
): RankingManagementError {
  return {
    code: "invalid-edit",
    message: error.message,
    path: error.path,
  };
}

function mapReplaceResult(
  result: ReplaceRankingSetResult,
): RankingManagementResult<RankingSet> {
  if (result.ok) {
    return { ok: true, value: result.rankingSet };
  }

  return failure(result.errors.map(mapReplaceError));
}

function mapReplaceError(error: ReplaceRankingSetError): RankingManagementError {
  switch (error.code) {
    case "invalid-ranking-set":
      return {
        code: "invalid-ranking-set",
        message: error.message,
        path: error.path,
      };
    case "name-conflict":
      return {
        code: "name-conflict",
        message: error.message,
        path: error.path,
      };
    case "not-found":
      return {
        code: "not-found",
        message: error.message,
        path: error.path,
      };
    default:
      return mapUnexpectedRepositoryError(error);
  }
}

function mapDeleteError(error: DeleteRankingSetError): RankingManagementError {
  switch (error.code) {
    case "not-found":
      return {
        code: "not-found",
        message: error.message,
        path: error.path,
      };
    default:
      return mapUnexpectedRepositoryError(error);
  }
}

function mapUnexpectedRepositoryError(error: {
  message: string;
  path?: string;
}): RankingManagementError {
  return {
    code: "persistence-rejected",
    message: error.message,
    path: error.path,
  };
}

function notFoundError(): RankingManagementError {
  return {
    code: "not-found",
    message: "Ranking set was not found.",
    path: "id",
  };
}

function failure<TValue>(
  errors: readonly RankingManagementError[],
): RankingManagementResult<TValue> {
  return { ok: false, errors };
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
