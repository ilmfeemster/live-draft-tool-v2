import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import {
  parseLeagueSettingsSnapshotJson,
  serializeLeagueSettingsSnapshot,
} from "@/lib/leagueSettingsSnapshot";

describe("league settings snapshot mappers", () => {
  it("round-trips league settings without losing roster slot data", () => {
    const snapshot = serializeLeagueSettingsSnapshot(defaultLeagueSettings);
    const parsedSettings = parseLeagueSettingsSnapshotJson(snapshot);

    expect(parsedSettings).toEqual(defaultLeagueSettings);
  });

  it("serializes to fresh objects instead of reusing input references", () => {
    const snapshot = serializeLeagueSettingsSnapshot(defaultLeagueSettings);

    expect(snapshot).toEqual(defaultLeagueSettings);
    expect(snapshot).not.toBe(defaultLeagueSettings);
    expect(snapshot.rosterSlots[0]).not.toBe(defaultLeagueSettings.rosterSlots[0]);
    expect(snapshot.rosterSlots[0].eligiblePositions).not.toBe(
      defaultLeagueSettings.rosterSlots[0].eligiblePositions,
    );
  });

  it("rejects non-object snapshots", () => {
    expect(() => parseLeagueSettingsSnapshotJson(null)).toThrow(
      "League settings snapshot must be an object.",
    );
  });

  it("rejects invalid team counts", () => {
    expect(() => {
      parseLeagueSettingsSnapshotJson({
        ...defaultLeagueSettings,
        teamCount: 0,
      });
    }).toThrow("leagueSettings.teamCount must be a positive integer.");
  });

  it("rejects unsupported draft types", () => {
    expect(() => {
      parseLeagueSettingsSnapshotJson({
        ...defaultLeagueSettings,
        draftType: "LINEAR",
      });
    }).toThrow("leagueSettings.draftType must be SNAKE.");
  });

  it("rejects empty eligible position arrays", () => {
    expect(() => {
      parseLeagueSettingsSnapshotJson({
        ...defaultLeagueSettings,
        rosterSlots: [
          {
            id: "bad-slot",
            label: "BAD",
            eligiblePositions: [],
          },
        ],
      });
    }).toThrow(
      "leagueSettings.rosterSlots[0].eligiblePositions must be a non-empty array.",
    );
  });

  it("rejects invalid eligible positions", () => {
    expect(() => {
      parseLeagueSettingsSnapshotJson({
        ...defaultLeagueSettings,
        rosterSlots: [
          {
            id: "bad-slot",
            label: "BAD",
            eligiblePositions: ["CB"],
          },
        ],
      });
    }).toThrow(
      "leagueSettings.rosterSlots[0].eligiblePositions[0] must be a valid position.",
    );
  });
});
