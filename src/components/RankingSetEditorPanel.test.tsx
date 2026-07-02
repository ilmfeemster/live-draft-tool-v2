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
    const markup = renderPanel();

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
    const markup = renderPanel(
      createRankingSet({
        entries: [
          createEntry("wr-1", "Wideout One", "WR", 3, 1, 1, 26),
          createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
          createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
        ],
      }),
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

  it("preserves rename, reorder, and player correction controls", () => {
    const markup = renderPanel();

    expect(markup).toContain("Ranking Set Name");
    expect(markup).toMatch(/<input[^>]*type="text"[^>]*value="Managed Rankings"/);
    expect(markup).toContain("Save Rename");
    expect(markup).toContain("Player to Move");
    expect(markup).toContain("Target Rank");
    expect(markup).toContain("Move Player");
    expect(markup).toContain("Player to Correct");
    expect(markup).toContain("Player Name");
    expect(markup).toContain("ADP Rank");
    expect(markup).toContain("Save Player Facts");
    expect(markup).toContain("ID: qb-1");
    expect(markup).toContain("Position: QB");
  });

  it("prefills player correction fields and preserves null ADP", () => {
    const populatedMarkup = renderPanel();
    const nullMarkup = renderPanel(
      createRankingSet({
        entries: [
          createEntry("rb-1", "Runner One", "RB", 1, 1, 1, null),
          createEntry("qb-1", "Quarterback One", "QB", 2, 1, 1, 8.5),
        ],
      }),
    );

    expect(populatedMarkup).toMatch(
      /<input[^>]*type="text"[^>]*value="Quarterback One"/,
    );
    expect(populatedMarkup).toMatch(/<input[^>]*type="text"[^>]*value="TST"/);
    expect(populatedMarkup).toMatch(/<input[^>]*type="number"[^>]*value="8.5"/);
    expect(nullMarkup).toContain("#1 - Runner One (RB, TST)");
    expect(nullMarkup).toMatch(/<input[^>]*type="number"[^>]*value=""/);
  });

  it("renders structured edit errors", () => {
    const markup = renderPanel(createRankingSet(), [
      {
        code: "invalid-edit",
        message: "Ranking set rename requires a non-empty name.",
        path: "intent.name",
      },
    ]);

    expect(markup).toContain("Ranking Edit Errors");
    expect(markup).toContain(
      "invalid-edit: Ranking set rename requires a non-empty name. (intent.name)",
    );
  });

  it("separates preserved source tiers from eligible recommendation tiers", () => {
    const rankingSet = createRankingSet({
      capabilities: createCapabilities({
        tiers: { QB: "source", RB: "defaulted-neutral" },
      }),
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: [{ playerId: "qb-1", overallRank: 1, tier: 71 }],
        },
        recommendation: { QB: "recommendation-position", RB: "neutral" },
      },
      entries: [
        createEntry("qb-1", "Quarterback One", "QB", 1, 1, 3, 8.5),
        createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
      ],
    });
    const markup = renderPanel(rankingSet);

    expect(markup).toContain("Source Tier");
    expect(markup).toContain("Recommendation Tier");
    expect(markup).toContain("71");
    expect(markup).toContain("3");
    expect(markup).toContain("Neutral");
    expect(markup).toContain(
      "Source tiers: preserved overall values (not recommendation pressure)",
    );
    expect(markup).toContain("Recommendation tiers: eligible: QB; neutral: RB");
  });

  it("labels legacy tiers and neutralizes missing semantics without inference", () => {
    const legacyMarkup = renderPanel(
      createRankingSet({
        tierSemantics: {
          source: {
            kind: "legacy-ambiguous",
            values: [{ playerId: "qb-1", overallRank: 1, tier: 88 }],
          },
          recommendation: { QB: "neutral", RB: "neutral", WR: "neutral" },
        },
      }),
    );
    const compatibilityMarkup = renderPanel(
      createRankingSet({
        tierSemantics: undefined,
        entries: [
          createEntry("qb-1", "Quarterback One", "QB", 1, 1, 93, 8.5),
        ],
      }),
    );

    expect(legacyMarkup).toContain("Legacy Tier");
    expect(legacyMarkup).toContain("88");
    expect(legacyMarkup).toContain(
      "Legacy tiers: ambiguous and recommendation-neutral",
    );
    expect(legacyMarkup).toContain("Recommendation tiers: neutral: QB, RB, WR");
    expect(compatibilityMarkup).toContain("Legacy tiers: semantics unavailable");
    expect(compatibilityMarkup).toContain(
      "Recommendation tiers: neutral (compatibility)",
    );
    expect(compatibilityMarkup).toContain("Neutral (compatibility)");
    expect(compatibilityMarkup).not.toContain(">93<");
  });

  it("matches source values by player identity and overall rank", () => {
    const markup = renderPanel(
      createRankingSet({
        tierSemantics: {
          source: {
            kind: "source-overall",
            values: [{ playerId: "qb-1", overallRank: 2, tier: 97 }],
          },
          recommendation: { QB: "neutral" },
        },
        entries: [
          createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
        ],
      }),
    );

    expect(markup).toContain("—");
    expect(markup).not.toContain(">97<");
  });

  it("removes ambiguous tier authoring controls and headings", () => {
    const markup = renderPanel();

    expect(markup).not.toContain("Position Tiers");
    expect(markup).not.toContain("Save Position Tiers");
    expect(markup).not.toContain("Tier capability");
    expect(markup).not.toContain("Current tier");
    expect(markup).not.toMatch(/>Tier<\/th>/);
  });

  it("formats tier provenance and management errors", () => {
    expect(formatEditorCapabilitySummary(createRankingSet())).toBe(
      "Team: complete / ADP: partial / Position rank: derived / Source tiers: preserved overall values (not recommendation pressure) / Recommendation tiers: neutral: QB, RB, WR",
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

function renderPanel(
  rankingSet = createRankingSet(),
  errors: Parameters<typeof RankingSetEditorPanel>[0]["errors"] = [],
): string {
  return renderToStaticMarkup(
    <RankingSetEditorPanel
      errors={errors}
      isSaving={false}
      rankingSet={rankingSet}
      onClose={vi.fn()}
      onCorrectPlayer={vi.fn()}
      onRename={vi.fn()}
      onReorder={vi.fn()}
    />,
  );
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
    capabilities: createCapabilities(),
    tierSemantics: {
      source: {
        kind: "source-overall",
        values: [
          { playerId: "qb-1", overallRank: 1, tier: 11 },
          { playerId: "rb-1", overallRank: 2, tier: 12 },
          { playerId: "wr-1", overallRank: 3, tier: 13 },
        ],
      },
      recommendation: { QB: "neutral", RB: "neutral", WR: "neutral" },
    },
    entries: [
      createEntry("qb-1", "Quarterback One", "QB", 1, 1, 1, 8.5),
      createEntry("rb-1", "Runner One", "RB", 2, 1, 1, null),
      createEntry("wr-1", "Wideout One", "WR", 3, 1, 1, 26),
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
      QB: "defaulted-neutral",
      RB: "defaulted-neutral",
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
