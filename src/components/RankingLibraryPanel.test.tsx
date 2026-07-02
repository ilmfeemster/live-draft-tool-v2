import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RankingImportDiagnostic } from "@/types/rankingImport";
import type {
  RankingSetCapabilities,
  RankingSetSummary,
} from "@/types/rankings";
import {
  createDeleteConfirmationMessage,
  createSafeExportFileName,
  formatCapabilitySummary,
  formatImportDiagnostic,
  formatManagementError,
  RankingLibraryPanel,
} from "@/components/RankingLibraryPanel";

vi.mock("@/app/actions/rankingActions", () => ({
  deleteRankingLibrarySetAction: vi.fn(),
  editRankingLibrarySetAction: vi.fn(),
  exportRankingLibrarySetJsonAction: vi.fn(),
  importRankingLibraryFileAction: vi.fn(),
  listRankingLibraryAction: vi.fn(),
  loadRankingLibrarySetAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("RankingLibraryPanel", () => {
  it("renders independently expanded ranking-library panel controls", () => {
    const markup = renderToStaticMarkup(
      <RankingLibraryPanel initialSummaries={[createSummary()]} />,
    );

    expect(markup).toMatch(
      /aria-controls="managed-ranking-sets-content"[^>]*aria-expanded="true"[^>]*aria-label="Minimize Managed Sets"/,
    );
    expect(markup).toMatch(
      /aria-controls="import-rankings-content"[^>]*aria-expanded="true"[^>]*aria-label="Minimize Import Rankings"/,
    );
    expect(markup).toContain('id="managed-ranking-sets-content"');
    expect(markup).toContain('id="import-rankings-content"');
    expect(markup).toContain("Managed Rankings");
    expect(markup).toContain("FantasyPros CSV Profile V1");
  });

  it("renders the empty library state and import controls", () => {
    const markup = renderToStaticMarkup(
      <RankingLibraryPanel initialSummaries={[]} />,
    );

    expect(markup).toContain("Ranking Library");
    expect(markup).toContain("No managed ranking sets are available yet.");
    expect(markup).toContain("Import Rankings");
    expect(markup).toContain("FantasyPros CSV Profile V1");
    expect(markup).toContain("Canonical Ranking Set JSON V1");
    expect(markup).toMatch(/<input[^>]*type="file"/);
  });

  it("renders summary cards with source, counts, dates, and capabilities", () => {
    const markup = renderToStaticMarkup(
      <RankingLibraryPanel initialSummaries={[createSummary()]} />,
    );

    expect(markup).toContain("Managed Rankings");
    expect(markup).toContain("External");
    expect(markup).toContain("Players");
    expect(markup).toContain("42");
    expect(markup).toContain("Updated Jun 30");
    expect(markup).toContain("Team: complete");
    expect(markup).toContain("ADP: partial");
    expect(markup).toContain("provided tier values: QB, RB");
    expect(markup).toContain("recommendation-neutral fallback: WR");
    expect(markup).not.toContain("source tiers");
    expect(markup).not.toContain("position tiers");
    expect(markup).toContain("Review/Edit");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Delete Set");
  });

  it("renders initial server errors distinctly", () => {
    const markup = renderToStaticMarkup(
      <RankingLibraryPanel
        initialSummaries={[]}
        initialErrors={[
          {
            code: "persistence-rejected",
            message: "Database unavailable.",
            path: "rankings",
          },
        ]}
      />,
    );

    expect(markup).toContain("Ranking Library Errors");
    expect(markup).toContain(
      "persistence-rejected: Database unavailable. (rankings)",
    );
  });

  it("formats import diagnostics with stage, code, message, and locations", () => {
    const diagnostic: RankingImportDiagnostic = {
      code: "invalid-position",
      stage: "validate",
      severity: "error",
      message: "Position is unsupported.",
      location: {
        path: "entries[2].position",
        row: 4,
        column: 3,
        field: "POS",
      },
    };

    expect(formatImportDiagnostic(diagnostic)).toBe(
      "validate: invalid-position - Position is unsupported. (path entries[2].position, row 4, column 3, field POS)",
    );
  });

  it("formats management errors and capability summaries", () => {
    expect(
      formatManagementError({
        code: "not-found",
        message: "Ranking set was not found.",
        path: "id",
      }),
    ).toBe("not-found: Ranking set was not found. (id)");

    expect(formatCapabilitySummary(createCapabilities())).toBe(
      "Team: complete / ADP: partial / Tiers: provided tier values: QB, RB; recommendation-neutral fallback: WR",
    );
  });

  it("keeps destructive delete copy explicit about draft snapshots", () => {
    const summary = createSummary();

    expect(createDeleteConfirmationMessage(summary)).toBe(
      'Delete "Managed Rankings"? Existing draft snapshots remain unchanged.',
    );
  });

  it("creates safe JSON export file names", () => {
    expect(createSafeExportFileName({ name: " My Rankings 2026! " })).toBe(
      "my-rankings-2026.json",
    );
    expect(createSafeExportFileName({ name: "!!!" })).toBe("ranking-set.json");
  });
});

function createSummary(
  overrides: Partial<RankingSetSummary> = {},
): RankingSetSummary {
  return {
    id: "set-1",
    name: "Managed Rankings",
    sourceKind: "external",
    entryCount: 42,
    capabilities: createCapabilities(),
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-30T18:30:00.000Z"),
    ...overrides,
  };
}

function createCapabilities(
  overrides: Partial<RankingSetCapabilities> = {},
): RankingSetCapabilities {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "explicit",
    positionRank: "derived",
    adp: "partial",
    tiers: {
      QB: "source",
      RB: "source",
      WR: "defaulted-neutral",
    },
    ...overrides,
  };
}
