import { describe, expect, it } from "vitest";
import type { LeagueSettings } from "@/types/draft";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";

describe("defaultLeagueSettings", () => {
  it("represents the MVP league setup as reusable data", () => {
    expect(defaultLeagueSettings).toMatchObject({
      teamCount: 12,
      rounds: 16,
      draftType: "SNAKE",
      scoringFormat: "PPR",
    });
    expect(defaultLeagueSettings.rosterSlots).toHaveLength(16);
  });

  it("uses a LeagueSettings type that can represent non-default draft sizes", () => {
    const nonDefaultSettings: LeagueSettings = {
      ...defaultLeagueSettings,
      teamCount: 10,
      rounds: 14,
      rosterSlots: defaultLeagueSettings.rosterSlots.slice(0, 14),
    };

    expect(nonDefaultSettings.teamCount).toBe(10);
    expect(nonDefaultSettings.rounds).toBe(14);
    expect(nonDefaultSettings.rosterSlots).toHaveLength(14);
  });
});
