import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvailablePlayersTable } from "@/components/AvailablePlayersTable";
import type { RankingEntry } from "@/types/draft";

describe("AvailablePlayersTable", () => {
  it("renders draft information without ambiguous tier values", () => {
    const markup = renderToStaticMarkup(
      <AvailablePlayersTable
        isDraftComplete={false}
        rankings={[
          createRanking("qb-1", "Quarterback One", "SEA", "QB", 1, 1, 97),
          createRanking("wr-1", "Receiver One", "BUF", "WR", 2, 1, 98),
        ]}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain("Available Players");
    expect(markup).toContain(">Rank</th>");
    expect(markup).toContain(">Player</th>");
    expect(markup).toContain(">Team</th>");
    expect(markup).toContain(">Pos</th>");
    expect(markup).toContain(">Action</th>");
    expect(markup).toContain("Quarterback One");
    expect(markup).toContain("Receiver One");
    expect(markup).toContain("SEA");
    expect(markup).toContain("BUF");
    expect(markup).toContain("QB1");
    expect(markup).toContain("WR1");
    expect(markup.match(/>Draft<\/button>/g)).toHaveLength(2);
    expect(markup).not.toMatch(/>Tier<\/th>/);
    expect(markup).not.toContain("Source Tier");
    expect(markup).not.toContain("Position Tier");
    expect(markup).not.toContain("Recommendation Tier");
    expect(markup).not.toContain(">97</td>");
    expect(markup).not.toContain(">98</td>");
  });

  it("spans the five remaining columns in the empty state", () => {
    const markup = renderToStaticMarkup(
      <AvailablePlayersTable
        isDraftComplete={false}
        rankings={[]}
        onDraftPlayer={vi.fn()}
      />,
    );

    expect(markup).toContain('colSpan="5"');
    expect(markup).toContain("No available players match the current filters.");
  });
});

function createRanking(
  id: string,
  name: string,
  team: string,
  position: RankingEntry["player"]["position"],
  overallRank: number,
  positionRank: number,
  tier: number,
): RankingEntry {
  return {
    player: { id, name, team, position },
    overallRank,
    positionRank,
    tier,
    adpRank: null,
  };
}
