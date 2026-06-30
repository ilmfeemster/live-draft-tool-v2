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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Set Name");
    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="Managed Rankings"/);
    expect(markup).toContain("Save Rename");
  });

  it("renders reorder controls from canonical order", () => {
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Player to Move");
    expect(markup).toContain("Target Rank");
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*value="1"/);
    expect(markup).toContain("Move Player");

    const qbOption = markup.indexOf("#1 - Quarterback One (QB)");
    const rbOption = markup.indexOf("#2 - Runner One (RB)");
    const wrOption = markup.indexOf("#3 - Wideout One (WR)");

    expect(qbOption).toBeGreaterThanOrEqual(0);
    expect(rbOption).toBeGreaterThan(qbOption);
    expect(wrOption).toBeGreaterThan(rbOption);
  });

  it("renders reorder errors through the structured error list", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[
          {
            code: "invalid-edit",
            message: "Ranking reorder target must be from 1 through 3.",
            path: "intent.toOverallRank",
          },
        ]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Edit Errors");
    expect(markup).toContain(
      "invalid-edit: Ranking reorder target must be from 1 through 3. (intent.toOverallRank)",
    );
  });

  it("renders player correction controls from canonical order", () => {
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Player to Correct");
    expect(markup).toContain("Player Name");
    expect(markup).toContain("Team");
    expect(markup).toContain("ADP Rank");
    expect(markup).toContain("Save Player Facts");
    expect(markup).toContain("ID: qb-1");
    expect(markup).toContain("Position: QB");

    const qbOption = markup.indexOf("#1 - Quarterback One (QB, TST)");
    const rbOption = markup.indexOf("#2 - Runner One (RB, TST)");
    const wrOption = markup.indexOf("#3 - Wideout One (WR, TST)");

    expect(qbOption).toBeGreaterThanOrEqual(0);
    expect(rbOption).toBeGreaterThan(qbOption);
    expect(wrOption).toBeGreaterThan(rbOption);
  });

  it("prefills selected player correction fields", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="Quarterback One"/);
    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="TST"/);
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*value="8.5"/);
  });

  it("renders null selected player ADP as an empty correction input", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet({
          entries: [
            createEntry("rb-1", "Runner One", "RB", 1, 1, 1, null),
            createEntry("qb-1", "Quarterback One", "QB", 2, 1, 1, 8.5),
          ],
        })}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("#1 - Runner One (RB, TST)");
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*value=""/);
    expect(markup).toContain("None");
  });

  it("renders correction errors through the structured error list", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[
          {
            code: "invalid-edit",
            message: "Player correction name is invalid.",
            path: "intent.changes.name",
          },
        ]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Edit Errors");
    expect(markup).toContain(
      "invalid-edit: Player correction name is invalid. (intent.changes.name)",
    );
  });

  it("renders tier assignment controls from represented positions", () => {
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
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Position Tiers");
    expect(markup).toContain("Tier capability:");
    expect(markup).toContain("source");
    expect(markup).toContain("Save Position Tiers");

    const qbOption = markup.indexOf(">QB</option>");
    const rbOption = markup.indexOf(">RB</option>");
    const wrOption = markup.indexOf(">WR</option>");

    expect(qbOption).toBeGreaterThanOrEqual(0);
    expect(rbOption).toBeGreaterThan(qbOption);
    expect(wrOption).toBeGreaterThan(rbOption);
  });

  it("renders selected-position tier inputs in canonical order", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet({
          entries: [
            createEntry("qb-2", "Quarterback Two", "QB", 3, 2, 4, 31),
            createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
            createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
          ],
        })}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    const qbOneRow = markup.indexOf("#1 - Quarterback One (qb-1)");
    const qbTwoRow = markup.indexOf("#3 - Quarterback Two (qb-2)");

    expect(qbOneRow).toBeGreaterThanOrEqual(0);
    expect(qbTwoRow).toBeGreaterThan(qbOneRow);
    expect(markup).toContain("Current tier: 1");
    expect(markup).toContain("Current tier: 4");
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*value="1"/);
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*value="4"/);
  });

  it("renders defaulted-neutral tier capability as editable through assignment", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[]}
        isSaving={false}
        rankingSet={createRankingSet({
          capabilities: createCapabilities({
            tiers: {
              WR: "defaulted-neutral",
              QB: "source",
            },
          }),
          entries: [
            createEntry("wr-1", "Wideout One", "WR", 1, 1, 1, 26),
            createEntry("qb-1", "Quarterback One", "QB", 2, 1, 1, 8.5),
          ],
        })}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Tier capability:");
    expect(markup).toContain("defaulted-neutral");
    expect(markup).toContain("#1 - Wideout One (wr-1)");
    expect(markup).toContain("Save Position Tiers");
  });

  it("renders tier assignment errors through the structured error list", () => {
    const markup = renderToStaticMarkup(
      <RankingSetEditorPanel
        errors={[
          {
            code: "invalid-edit",
            message: "Assigned tiers must not decrease within QB.",
            path: "intent.assignments",
          },
        ]}
        isSaving={false}
        rankingSet={createRankingSet()}
        onClose={vi.fn()}
        onAssignPositionTiers={vi.fn()}
        onCorrectPlayer={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(markup).toContain("Ranking Edit Errors");
    expect(markup).toContain(
      "invalid-edit: Assigned tiers must not decrease within QB. (intent.assignments)",
    );
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
