import { describe, expect, it } from "vitest";
import {
  parseRankingSnapshotJson,
  serializeRankingSnapshot,
} from "@/lib/rankingSnapshot";
import type { Position, RankingEntry } from "@/types/draft";

describe("ranking snapshot mappers", () => {
  it("round-trips rankings without losing ranking or player fields", () => {
    const rankings = [
      createRanking("player-1", 1, "WR", {
        adpRank: 3,
        positionRank: 1,
        tier: 1,
        name: "Player One",
        team: "ONE",
      }),
      createRanking("player-2", 2, "RB", {
        adpRank: 4,
        positionRank: 1,
        tier: 2,
        name: "Player Two",
        team: "TWO",
      }),
    ];

    const snapshot = serializeRankingSnapshot(rankings);
    const parsedRankings = parseRankingSnapshotJson(snapshot);

    expect(parsedRankings).toEqual(rankings);
  });

  it("preserves null ADP ranks", () => {
    const rankings = [createRanking("player-1", 1, "QB", { adpRank: null })];

    const parsedRankings = parseRankingSnapshotJson(
      serializeRankingSnapshot(rankings),
    );

    expect(parsedRankings[0].adpRank).toBeNull();
  });

  it("serializes to fresh objects instead of reusing input references", () => {
    const rankings = [createRanking("player-1", 1, "TE")];
    const snapshot = serializeRankingSnapshot(rankings);

    expect(snapshot).toEqual(rankings);
    expect(snapshot[0]).not.toBe(rankings[0]);
    expect(snapshot[0].player).not.toBe(rankings[0].player);
  });

  it("rejects non-array snapshots", () => {
    expect(() => parseRankingSnapshotJson({ rankings: [] })).toThrow(
      "Ranking snapshot must be an array.",
    );
  });

  it("rejects entries missing required player fields", () => {
    const snapshot = [
      {
        player: {
          id: "player-1",
          team: "ONE",
          position: "WR",
        },
        overallRank: 1,
        adpRank: null,
        positionRank: 1,
        tier: 1,
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.player.name must be a string.",
    );
  });

  it("rejects invalid position values", () => {
    const snapshot = [
      {
        ...createRanking("player-1", 1, "WR"),
        player: {
          ...createRanking("player-1", 1, "WR").player,
          position: "CB",
        },
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.player.position must be a valid position.",
    );
  });

  it("rejects invalid rank field types", () => {
    const snapshot = [
      {
        ...createRanking("player-1", 1, "WR"),
        overallRank: "1",
      },
    ];

    expect(() => parseRankingSnapshotJson(snapshot)).toThrow(
      "Ranking snapshot entry 0.overallRank must be a number.",
    );
  });
});

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
  options: Partial<
    Pick<RankingEntry, "adpRank" | "positionRank" | "tier"> & {
      name: string;
      team: string;
    }
  > = {},
): RankingEntry {
  return {
    player: {
      id,
      name: options.name ?? id,
      team: options.team ?? "TEST",
      position,
    },
    overallRank,
    adpRank: options.adpRank ?? null,
    positionRank: options.positionRank ?? overallRank,
    tier: options.tier ?? 1,
  };
}
