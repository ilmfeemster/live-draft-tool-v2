import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  importRankingSet,
  type ImportRankingSetResult,
} from "@/lib/rankingImportWorkflow";
import {
  deleteManagedRankingSet,
  exportManagedRankingSetJson,
  listManagedRankingSets,
} from "@/lib/rankingManagementWorkflow";
import type { CanonicalRankingJsonExportValue } from "@/lib/canonicalRankingJsonExporter";
import type { RankingSetSummary } from "@/types/rankings";
import {
  deleteRankingLibrarySetAction,
  exportRankingLibrarySetJsonAction,
  importRankingLibraryFileAction,
  listRankingLibraryAction,
} from "./rankingActions";

vi.mock("@/lib/rankingImportWorkflow", () => ({
  importRankingSet: vi.fn(),
}));

vi.mock("@/lib/rankingManagementWorkflow", () => ({
  deleteManagedRankingSet: vi.fn(),
  exportManagedRankingSetJson: vi.fn(),
  listManagedRankingSets: vi.fn(),
}));

const importRankingSetMock = vi.mocked(importRankingSet);
const listManagedRankingSetsMock = vi.mocked(listManagedRankingSets);
const deleteManagedRankingSetMock = vi.mocked(deleteManagedRankingSet);
const exportManagedRankingSetJsonMock = vi.mocked(exportManagedRankingSetJson);

describe("ranking library server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates listing to the ranking management workflow", async () => {
    const summaries = [createSummary()];
    listManagedRankingSetsMock.mockResolvedValue({ ok: true, value: summaries });

    const result = await listRankingLibraryAction();

    expect(listManagedRankingSetsMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, value: summaries });
  });

  it("returns structured list errors unchanged", async () => {
    const errors = [
      {
        code: "persistence-rejected" as const,
        message: "Database unavailable.",
        path: "rankings",
      },
    ];
    listManagedRankingSetsMock.mockResolvedValue({ ok: false, errors });

    const result = await listRankingLibraryAction();

    expect(result).toEqual({ ok: false, errors });
  });

  it("delegates imports with an action-owned timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T18:45:00.000Z"));

    const workflowResult: ImportRankingSetResult = {
      ok: false,
      errors: [
        {
          code: "missing-required-column",
          stage: "parse",
          severity: "error",
          message: "Required column is missing.",
          location: { row: 1, field: "RK" },
        },
      ],
      warnings: [],
    };
    importRankingSetMock.mockResolvedValue(workflowResult);

    const result = await importRankingLibraryFileAction({
      text: "RK,PLAYER\n1,Example Player",
      formatId: "fantasypros-csv",
      name: "Imported Rankings",
      sourceLabel: "rankings.csv",
    });

    expect(importRankingSetMock).toHaveBeenCalledWith({
      text: "RK,PLAYER\n1,Example Player",
      formatId: "fantasypros-csv",
      name: "Imported Rankings",
      sourceLabel: "rankings.csv",
      importedAt: new Date("2026-06-30T18:45:00.000Z"),
    });
    expect(result).toBe(workflowResult);
  });

  it("omits source label from import requests when absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T18:45:00.000Z"));

    const workflowResult: ImportRankingSetResult = {
      ok: false,
      errors: [],
      warnings: [],
    };
    importRankingSetMock.mockResolvedValue(workflowResult);

    await importRankingLibraryFileAction({
      text: "{}",
      formatId: "canonical-ranking-json",
      name: "Canonical Import",
    });

    expect(importRankingSetMock).toHaveBeenCalledWith({
      text: "{}",
      formatId: "canonical-ranking-json",
      name: "Canonical Import",
      importedAt: new Date("2026-06-30T18:45:00.000Z"),
    });
  });

  it("delegates deletion to the ranking management workflow", async () => {
    deleteManagedRankingSetMock.mockResolvedValue({
      ok: true,
      value: { id: "set-1" },
    });

    const result = await deleteRankingLibrarySetAction("set-1");

    expect(deleteManagedRankingSetMock).toHaveBeenCalledWith("set-1");
    expect(result).toEqual({ ok: true, value: { id: "set-1" } });
  });

  it("delegates export with an action-owned timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T19:15:00.000Z"));

    const exported: CanonicalRankingJsonExportValue = {
      document: {
        schemaVersion: 1,
        metadata: {
          name: "Exported Rankings",
          exportedAt: "2026-06-30T19:15:00.000Z",
          sourceRankingSetId: "set-1",
        },
        capabilities: createSummary().capabilities,
        entries: [],
      },
      text: "{}",
      byteLength: 2,
    };
    exportManagedRankingSetJsonMock.mockResolvedValue({
      ok: true,
      value: exported,
    });

    const result = await exportRankingLibrarySetJsonAction("set-1");

    expect(exportManagedRankingSetJsonMock).toHaveBeenCalledWith({
      id: "set-1",
      exportedAt: new Date("2026-06-30T19:15:00.000Z"),
      includeSourceRankingSetId: true,
    });
    expect(result).toEqual({ ok: true, value: exported });
  });

  it("keeps unexpected workflow failures rejected", async () => {
    const workflowError = new Error("database unavailable");
    listManagedRankingSetsMock.mockRejectedValue(workflowError);

    await expect(listRankingLibraryAction()).rejects.toBe(workflowError);
  });
});

function createSummary(): RankingSetSummary {
  return {
    id: "set-1",
    name: "Managed Rankings",
    sourceKind: "external",
    entryCount: 3,
    capabilities: {
      team: "complete",
      playerIdentity: "provided",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: "complete",
      tiers: { QB: "source", RB: "defaulted-neutral" },
    },
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-30T12:00:00.000Z"),
  };
}
