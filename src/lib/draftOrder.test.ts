import { describe, expect, it } from "vitest";
import {
  generateSnakeDraftOrder,
  getDraftPositionForPick,
  getPickInRound,
  getRoundForPick,
} from "@/lib/draftOrder";

describe("getRoundForPick", () => {
  it("calculates the round for a pick number", () => {
    expect(getRoundForPick(1, 4)).toBe(1);
    expect(getRoundForPick(4, 4)).toBe(1);
    expect(getRoundForPick(5, 4)).toBe(2);
    expect(getRoundForPick(8, 4)).toBe(2);
    expect(getRoundForPick(9, 4)).toBe(3);
  });
});

describe("getPickInRound", () => {
  it("calculates the pick position within a round", () => {
    expect(getPickInRound(1, 4)).toBe(1);
    expect(getPickInRound(4, 4)).toBe(4);
    expect(getPickInRound(5, 4)).toBe(1);
    expect(getPickInRound(8, 4)).toBe(4);
    expect(getPickInRound(9, 4)).toBe(1);
  });
});

describe("getDraftPositionForPick", () => {
  it("assigns odd-round picks from first draft position to last", () => {
    expect(getDraftPositionForPick(1, 4)).toBe(1);
    expect(getDraftPositionForPick(2, 4)).toBe(2);
    expect(getDraftPositionForPick(3, 4)).toBe(3);
    expect(getDraftPositionForPick(4, 4)).toBe(4);
  });

  it("assigns even-round picks from last draft position to first", () => {
    expect(getDraftPositionForPick(5, 4)).toBe(4);
    expect(getDraftPositionForPick(6, 4)).toBe(3);
    expect(getDraftPositionForPick(7, 4)).toBe(2);
    expect(getDraftPositionForPick(8, 4)).toBe(1);
  });
});

describe("generateSnakeDraftOrder", () => {
  it("creates an exact small snake draft order", () => {
    expect(generateSnakeDraftOrder(4, 2)).toEqual([
      { pickNumber: 1, round: 1, pickInRound: 1, teamId: "team-1" },
      { pickNumber: 2, round: 1, pickInRound: 2, teamId: "team-2" },
      { pickNumber: 3, round: 1, pickInRound: 3, teamId: "team-3" },
      { pickNumber: 4, round: 1, pickInRound: 4, teamId: "team-4" },
      { pickNumber: 5, round: 2, pickInRound: 1, teamId: "team-4" },
      { pickNumber: 6, round: 2, pickInRound: 2, teamId: "team-3" },
      { pickNumber: 7, round: 2, pickInRound: 3, teamId: "team-2" },
      { pickNumber: 8, round: 2, pickInRound: 4, teamId: "team-1" },
    ]);
  });

  it("creates the expected MVP draft boundaries", () => {
    const picks = generateSnakeDraftOrder(12, 16);

    expect(picks).toHaveLength(192);
    expect(picks[0]).toEqual({
      pickNumber: 1,
      round: 1,
      pickInRound: 1,
      teamId: "team-1",
    });
    expect(picks[11]).toEqual({
      pickNumber: 12,
      round: 1,
      pickInRound: 12,
      teamId: "team-12",
    });
    expect(picks[12]).toEqual({
      pickNumber: 13,
      round: 2,
      pickInRound: 1,
      teamId: "team-12",
    });
    expect(picks[191]).toEqual({
      pickNumber: 192,
      round: 16,
      pickInRound: 12,
      teamId: "team-1",
    });
  });
});
