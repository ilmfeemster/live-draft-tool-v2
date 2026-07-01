import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  importRankingSet,
  type ImportRankingSetResult,
} from "@/lib/rankingImportWorkflow";
import {
  deleteManagedRankingSet,
  editManagedRankingSet,
  exportManagedRankingSetJson,
  listManagedRankingSets,
  loadManagedRankingSet,
} from "@/lib/rankingManagementWorkflow";
import type { CanonicalRankingJsonExportValue } from "@/lib/canonicalRankingJsonExporter";
import type { Position, RankingEntry } from "@/types/draft";
import type { RankingSet, RankingSetSummary } from "@/types/rankings";
import {
  deleteRankingLibrarySetAction,
  editRankingLibrarySetAction,
  exportRankingLibrarySetJsonAction,
  importRankingLibraryFileAction,
  listRankingLibraryAction,
  loadRankingLibrarySetAction,
} from "./rankingActions";

vi.mock("@/lib/rankingImportWorkflow", () => ({
  importRankingSet: vi.fn(),
}));

vi.mock("@/lib/rankingManagementWorkflow", () => ({
  deleteManagedRankingSet: vi.fn(),
  editManagedRankingSet: vi.fn(),
  exportManagedRankingSetJson: vi.fn(),
  listManagedRankingSets: vi.fn(),
  loadManagedRankingSet: vi.fn(),
}));

const importRankingSetMock = vi.mocked(importRankingSet);
const listManagedRankingSetsMock = vi.mocked(listManagedRankingSets);
const deleteManagedRankingSetMock = vi.mocked(deleteManagedRankingSet);
const editManagedRankingSetMock = vi.mocked(editManagedRankingSet);
const exportManagedRankingSetJsonMock = vi.mocked(exportManagedRankingSetJson);
const loadManagedRankingSetMock = vi.mocked(loadManagedRankingSet);

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

  it("delegates loading a complete ranking set to the management workflow", async () => {
    const rankingSet = createRankingSet();
    loadManagedRankingSetMock.mockResolvedValue({
      ok: true,
      value: rankingSet,
    });

    const result = await loadRankingLibrarySetAction("set-1");

    expect(loadManagedRankingSetMock).toHaveBeenCalledWith("set-1");
    expect(result).toEqual({ ok: true, value: rankingSet });
  });

  it("returns structured load errors unchanged", async () => {
    const errors = [
      {
        code: "not-found" as const,
        message: "Ranking set was not found.",
        path: "id",
      },
    ];
    loadManagedRankingSetMock.mockResolvedValue({ ok: false, errors });

    const result = await loadRankingLibrarySetAction("missing-set");

    expect(result).toEqual({ ok: false, errors });
  });

  it("delegates edits with an action-owned timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T20:15:00.000Z"));

    const rankingSet = createRankingSet({ name: "Renamed Rankings" });
    editManagedRankingSetMock.mockResolvedValue({
      ok: true,
      value: rankingSet,
    });

    const result = await editRankingLibrarySetAction({
      id: "set-1",
      intent: { type: "rename", name: "Renamed Rankings" },
    });

    expect(editManagedRankingSetMock).toHaveBeenCalledWith({
      id: "set-1",
      intent: { type: "rename", name: "Renamed Rankings" },
      updatedAt: new Date("2026-06-30T20:15:00.000Z"),
    });
    expect(result).toEqual({ ok: true, value: rankingSet });
  });

  it("returns structured edit errors unchanged", async () => {
    const errors = [
      {
        code: "invalid-edit" as const,
        message: "Ranking set rename requires a non-empty name.",
        path: "intent.name",
      },
    ];
    editManagedRankingSetMock.mockResolvedValue({ ok: false, errors });

    const result = await editRankingLibrarySetAction({
      id: "set-1",
      intent: { type: "rename", name: "" },
    });

    expect(result).toEqual({ ok: false, errors });
  });

  it("delegates export with an action-owned timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T19:15:00.000Z"));

    const exported: CanonicalRankingJsonExportValue = {
      document: {
        schemaVersion: 2,
        metadata: {
          name: "Exported Rankings",
          exportedAt: "2026-06-30T19:15:00.000Z",
          sourceRankingSetId: "set-1",
        },
        tierSemantics: {
          sourceTier: {
            kind: "absent",
            sourceScope: "unknown",
            recommendationEligible: false,
          },
          recommendationTier: {
            kind: "neutral",
            sourceScope: "position",
            recommendationEligible: false,
          },
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

  it("keeps unexpected load and edit workflow failures rejected", async () => {
    const loadError = new Error("load failed");
    const editError = new Error("edit failed");
    loadManagedRankingSetMock.mockRejectedValue(loadError);
    editManagedRankingSetMock.mockRejectedValue(editError);

    await expect(loadRankingLibrarySetAction("set-1")).rejects.toBe(loadError);
    await expect(
      editRankingLibrarySetAction({
        id: "set-1",
        intent: { type: "rename", name: "Renamed" },
      }),
    ).rejects.toBe(editError);
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

function createRankingSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "set-1",
    name: "Managed Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-20T12:00:00.000Z"),
    },
    capabilities: {
      team: "complete",
      playerIdentity: "provided",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: "complete",
      tiers: { QB: "source", RB: "defaulted-neutral" },
    },
    entries: [
      createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1),
      createEntry("rb-1", "Runner One", "RB", 2, 1, 1),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-30T12:00:00.000Z"),
    ...overrides,
  };
}

function createEntry(
  id: string,
  name: string,
  position: Position,
  overallRank: number,
  positionRank: number,
  tier: number,
): RankingEntry {
  return {
    player: { id, name, team: "TST", position },
    overallRank,
    positionRank,
    tier,
    adpRank: overallRank + 0.5,
  };
}
