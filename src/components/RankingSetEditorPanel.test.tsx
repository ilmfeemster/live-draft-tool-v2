import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Position, RankingEntry } from "@/types/draft";
import type {
  RankingSet,
  RankingSetCapabilities,
} from "@/types/rankings";
import {
  formatEditorCapabilitySummary,
  formatEditorManagementError,
  RankingSetEditorPanel,
} from "@/components/RankingSetEditorPanel";

describe("RankingSetEditorPanel", () => {
  it("renders ranking metadata and immutable snapshot copy", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Detail");
    expect(markup).toContain("Managed Rankings");
    expect(markup).toContain("External / fantasypros-csv / rankings.csv");
    expect(markup).toContain("Players");
    expect(markup).toContain("3");
    expect(markup).toContain("This is a mutable ranking set.");
    expect(markup).toContain("immutable snapshots");
    expect(markup).toContain("Close Detail");
  });

  it("renders canonical entries ordered by overall rank", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet({
          entries: [
            createEntry("wr-1", "Wideout One", "WR", 3, 1, 2, 26),
            createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
            createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
          ],
        })}
        onClose={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    const qbIndex = markup.indexOf("Quarterback One");
    const rbIndex = markup.indexOf("Runner One");
    const wrIndex = markup.indexOf("Wideout One");

    expect(qbIndex).toBeGreaterThanOrEqual(0);
    expect(rbIndex).toBeGreaterThan(qbIndex);
    expect(wrIndex).toBeGreaterThan(rbIndex);
    expect(markup).toContain("qb-1");
    expect(markup).toContain("TST");
    expect(markup).toContain("None");
  });

  it("renders capability provenance and structured errors", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[
          {
            code: "invalid-edit",
            message: "Ranking set rename requires a non-empty name.",
            path: "intent.name",
          },
        ]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(markup).toContain("Team: complete");
    expect(markup).toContain("ADP: partial");
    expect(markup).toContain("Position rank: derived");
    expect(markup).toContain("source tiers: QB, RB");
    expect(markup).toContain("defaulted-neutral tiers: WR");
    expect(markup).toContain("Ranking Edit Errors");
    expect(markup).toContain(
      "invalid-edit: Ranking set rename requires a non-empty name. (intent.name)",
    );
  });

  it("renders rename controls", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Set Name");
    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="Managed Rankings"/);
    expect(markup).toContain("Save Rename");
  });

  it("formats capability provenance and management errors", () => {
    expect(formatEditorCapabilitySummary(createCapabilities())).toBe(
      "Team: complete / ADP: partial / Position rank: derived / Tiers: source tiers: QB, RB; defaulted-neutral tiers: WR",
    );

    expect(
      formatEditorManagementError({
        code: "name-conflict",
        message: "A ranking set with this name already exists.",
        path: "name",
      }),
    ).toBe("name-conflict: A ranking set with this name already exists. (name)");
  });
});

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
    capabilities: createCapabilities(),
    entries: [
      createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
      createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
      createEntry("wr-1", "Wideout One", "WR", 3, 1, 2, 26),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-30T12:00:00.000Z"),
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

function createEntry(
  id: string,
  name: string,
  position: Position,
  overallRank: number,
  positionRank: number,
  tier: number,
  adpRank: number | null,
): RankingEntry {
  return {
    player: { id, name, team: "TST", position },
    overallRank,
    positionRank,
    tier,
    adpRank,
  };
}
