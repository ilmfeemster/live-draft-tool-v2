"use server";

import {
  importRankingSet,
  type ImportRankingSetResult,
} from "@/lib/rankingImportWorkflow";
import {
  deleteManagedRankingSet,
  exportManagedRankingSetJson,
  listManagedRankingSets,
  type RankingManagementResult,
} from "@/lib/rankingManagementWorkflow";
import type { CanonicalRankingJsonExportValue } from "@/lib/canonicalRankingJsonExporter";
import type { RankingImportFormatId } from "@/types/rankingImport";
import type { RankingSetSummary } from "@/types/rankings";

export async function listRankingLibraryAction(): Promise<
  RankingManagementResult<readonly RankingSetSummary[]>
> {
  return listManagedRankingSets();
}

export async function importRankingLibraryFileAction(
  input: Readonly<{
    text: string;
    formatId: RankingImportFormatId;
    name: string;
    sourceLabel?: string;
  }>,
): Promise<ImportRankingSetResult> {
  return importRankingSet({
    text: input.text,
    formatId: input.formatId,
    name: input.name,
    ...(input.sourceLabel === undefined
      ? {}
      : { sourceLabel: input.sourceLabel }),
    importedAt: new Date(),
  });
}

export async function deleteRankingLibrarySetAction(
  id: string,
): Promise<RankingManagementResult<{ id: string }>> {
  return deleteManagedRankingSet(id);
}

export async function exportRankingLibrarySetJsonAction(
  id: string,
): Promise<RankingManagementResult<CanonicalRankingJsonExportValue>> {
  return exportManagedRankingSetJson({
    id,
    exportedAt: new Date(),
    includeSourceRankingSetId: true,
  });
}
