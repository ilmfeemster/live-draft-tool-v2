import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { isValidDraftState } from "@/lib/draftInvariants";
import type { LeagueSettings } from "@/types/draft";

describe("hydrateDraftFromSettings", () => {
  it("creates a valid empty draft from MVP league settings", () => {
    const draft = hydrateDraftFromSettings({
      id: "mvp-draft",
      leagueSettings: defaultLeagueSettings,
      userTeamId: "team-2",
    });

    expect(draft).toMatchObject({
      id: "mvp-draft",
      teamCount: 12,
      rounds: 16,
      userTeamId: "team-2",
      currentPickNumber: 1,
    });
    expect(draft.teams).toHaveLength(12);
    expect(draft.picks).toHaveLength(192);
    expect(draft.picks[0]).toEqual({
      pickNumber: 1,
      round: 1,
      pickInRound: 1,
      teamId: "team-1",
    });
    expect(isValidDraftState({ draft })).toBe(true);
  });

  it("overlays MVP pick history and derives the current pick", () => {
    const draft = hydrateDraftFromSettings({
      id: "partial-mvp-draft",
      leagueSettings: defaultLeagueSettings,
      userTeamId: "team-2",
      pickHistory: [
        { pickNumber: 1, playerId: "player-1" },
        { pickNumber: 2, playerId: "player-2" },
      ],
    });

    expect(draft.currentPickNumber).toBe(3);
    expect(draft.picks[0]).toEqual({
      pickNumber: 1,
      round: 1,
      pickInRound: 1,
      teamId: "team-1",
      playerId: "player-1",
    });
    expect(draft.picks[1]).toEqual({
      pickNumber: 2,
      round: 1,
      pickInRound: 2,
      teamId: "team-2",
      playerId: "player-2",
    });
    expect(draft.picks[2].playerId).toBeUndefined();
    expect(isValidDraftState({ draft })).toBe(true);
  });

  it("keeps a completed draft on the final pick number", () => {
    const completedPickHistory = Array.from({ length: 4 }, (_, index) => {
      const pickNumber = index + 1;

      return {
        pickNumber,
        playerId: `player-${pickNumber}`,
      };
    });
    const draft = hydrateDraftFromSettings({
      id: "completed-draft",
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      userTeamId: "team-1",
      pickHistory: completedPickHistory,
    });

    expect(draft.currentPickNumber).toBe(4);
    expect(draft.picks.every((pick) => Boolean(pick.playerId))).toBe(true);
    expect(isValidDraftState({ draft })).toBe(true);
  });

  it("derives structure and active pick team from non-default league settings", () => {
    const draft = hydrateDraftFromSettings({
      id: "non-default-draft",
      leagueSettings: createLeagueSettings({ teamCount: 4, rounds: 3 }),
      userTeamId: "team-3",
      pickHistory: [
        { pickNumber: 1, playerId: "player-1" },
        { pickNumber: 2, playerId: "player-2" },
        { pickNumber: 3, playerId: "player-3" },
        { pickNumber: 4, playerId: "player-4" },
        { pickNumber: 5, playerId: "player-5" },
      ],
    });
    const activePick = draft.picks.find((pick) => {
      return pick.pickNumber === draft.currentPickNumber;
    });

    expect(draft.teamCount).toBe(4);
    expect(draft.rounds).toBe(3);
    expect(draft.teams).toHaveLength(4);
    expect(draft.picks).toHaveLength(12);
    expect(draft.currentPickNumber).toBe(6);
    expect(activePick).toEqual({
      pickNumber: 6,
      round: 2,
      pickInRound: 2,
      teamId: "team-3",
    });
    expect(isValidDraftState({ draft })).toBe(true);
  });

  it("rejects pick history outside the generated draft order", () => {
    expect(() => {
      hydrateDraftFromSettings({
        id: "invalid-draft",
        leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
        userTeamId: "team-1",
        pickHistory: [{ pickNumber: 5, playerId: "player-5" }],
      });
    }).toThrow("Pick history entry 5 is outside the generated draft order.");
  });
});

function createLeagueSettings({
  teamCount,
  rounds,
}: {
  teamCount: number;
  rounds: number;
}): LeagueSettings {
  return {
    ...defaultLeagueSettings,
    teamCount,
    rounds,
    rosterSlots: defaultLeagueSettings.rosterSlots.slice(0, rounds),
  };
}
