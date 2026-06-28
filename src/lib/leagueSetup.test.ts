import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import {
  buildLeagueSetup,
  defaultLeagueSetupInput,
  type LeagueSetupInput,
  type LeagueSetupResult,
} from "@/lib/leagueSetup";
import type { DraftType, ScoringFormat } from "@/types/draft";

const ampleRankingPlayerCount = 1_000;

describe("buildLeagueSetup", () => {
  it("builds the current default settings and user team", () => {
    const result = buildLeagueSetup(
      defaultLeagueSetupInput,
      ampleRankingPlayerCount,
    );

    expect(result).toEqual({
      ok: true,
      leagueSettings: defaultLeagueSettings,
      userTeamId: "team-1",
    });
  });

  it("builds non-default settings with derived rounds and user team", () => {
    const input = createInput({
      teamCount: 3,
      userDraftPosition: 3,
      rosterSlotCounts: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 0,
        FLEX: 1,
        DST: 0,
        K: 0,
        BENCH: 2,
      },
    });

    const result = buildLeagueSetup(input, ampleRankingPlayerCount);

    expect(result).toEqual({
      ok: true,
      userTeamId: "team-3",
      leagueSettings: {
        teamCount: 3,
        rounds: 6,
        draftType: "SNAKE",
        scoringFormat: "PPR",
        rosterSlots: [
          { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
          { id: "rb-1", label: "RB", eligiblePositions: ["RB"] },
          { id: "wr-1", label: "WR", eligiblePositions: ["WR"] },
          {
            id: "flex-1",
            label: "FLEX",
            eligiblePositions: ["RB", "WR", "TE"],
          },
          {
            id: "bench-1",
            label: "BENCH",
            eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"],
          },
          {
            id: "bench-2",
            label: "BENCH",
            eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"],
          },
        ],
      },
    });
  });

  it("generates every roster category in deterministic order", () => {
    const result = buildLeagueSetup(
      createInput({
        teamCount: 2,
        userDraftPosition: 1,
        rosterSlotCounts: {
          QB: 1,
          RB: 1,
          WR: 1,
          TE: 1,
          FLEX: 1,
          DST: 1,
          K: 1,
          BENCH: 1,
        },
      }),
      ampleRankingPlayerCount,
    );

    expectSuccess(result);
    expect(result.leagueSettings.rosterSlots).toEqual([
      { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
      { id: "rb-1", label: "RB", eligiblePositions: ["RB"] },
      { id: "wr-1", label: "WR", eligiblePositions: ["WR"] },
      { id: "te-1", label: "TE", eligiblePositions: ["TE"] },
      {
        id: "flex-1",
        label: "FLEX",
        eligiblePositions: ["RB", "WR", "TE"],
      },
      { id: "dst-1", label: "DST", eligiblePositions: ["DST"] },
      { id: "k-1", label: "K", eligiblePositions: ["K"] },
      {
        id: "bench-1",
        label: "BENCH",
        eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"],
      },
    ]);
  });

  it("returns equal settings with fresh slot and eligibility references", () => {
    const first = buildLeagueSetup(
      defaultLeagueSetupInput,
      ampleRankingPlayerCount,
    );
    const second = buildLeagueSetup(
      defaultLeagueSetupInput,
      ampleRankingPlayerCount,
    );

    expectSuccess(first);
    expectSuccess(second);
    expect(first).toEqual(second);
    expect(first.leagueSettings).not.toBe(second.leagueSettings);
    expect(first.leagueSettings.rosterSlots).not.toBe(
      second.leagueSettings.rosterSlots,
    );
    expect(first.leagueSettings.rosterSlots[0]).not.toBe(
      second.leagueSettings.rosterSlots[0],
    );
    expect(first.leagueSettings.rosterSlots[0]?.eligiblePositions).not.toBe(
      second.leagueSettings.rosterSlots[0]?.eligiblePositions,
    );
  });

  it.each([2, 20])("accepts team-count boundary %s", (teamCount) => {
    const result = buildLeagueSetup(
      createInput({
        teamCount,
        userDraftPosition: teamCount,
        rosterSlotCounts: minimalRosterCounts(),
      }),
      teamCount,
    );

    expectSuccess(result);
    expect(result.leagueSettings.teamCount).toBe(teamCount);
    expect(result.userTeamId).toBe(`team-${teamCount}`);
  });

  it.each([1, 21, 2.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid team count %s",
    (teamCount) => {
      const result = buildLeagueSetup(
        createInput({ teamCount }),
        ampleRankingPlayerCount,
      );

      expectFailure(result);
      expect(result.errors).toContainEqual({
        field: "teamCount",
        message: "Team count must be an integer from 2 through 20.",
      });
    },
  );

  it.each([1, 12])("accepts draft-position boundary %s", (userDraftPosition) => {
    const result = buildLeagueSetup(
      createInput({ userDraftPosition }),
      ampleRankingPlayerCount,
    );

    expectSuccess(result);
    expect(result.userTeamId).toBe(`team-${userDraftPosition}`);
  });

  it.each([0, 13])("rejects out-of-range draft position %s", (userDraftPosition) => {
    const result = buildLeagueSetup(
      createInput({ userDraftPosition }),
      ampleRankingPlayerCount,
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      field: "userDraftPosition",
      message: "Draft position must be between 1 and the selected team count.",
    });
  });

  it.each([2.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects non-integer draft position %s",
    (userDraftPosition) => {
      const result = buildLeagueSetup(
        createInput({ userDraftPosition }),
        ampleRankingPlayerCount,
      );

      expectFailure(result);
      expect(result.errors).toContainEqual({
        field: "userDraftPosition",
        message: "Draft position must be an integer.",
      });
    },
  );

  it("allows zero-count categories when a starting slot remains", () => {
    const result = buildLeagueSetup(
      createInput({ rosterSlotCounts: minimalRosterCounts() }),
      12,
    );

    expectSuccess(result);
    expect(result.leagueSettings.rounds).toBe(1);
    expect(result.leagueSettings.rosterSlots).toEqual([
      { id: "qb-1", label: "QB", eligiblePositions: ["QB"] },
    ]);
  });

  it.each([
    { name: "bench-only", counts: { ...emptyRosterCounts(), BENCH: 1 } },
    { name: "all-zero", counts: emptyRosterCounts() },
  ])("rejects a $name roster", ({ counts }) => {
    const result = buildLeagueSetup(
      createInput({ rosterSlotCounts: counts }),
      ampleRankingPlayerCount,
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      field: "rosterSlotCounts",
      message: "At least one non-BENCH starting slot is required.",
    });
  });

  it.each([
    { name: "one", benchCount: 0, expectedRounds: 1 },
    { name: "thirty", benchCount: 29, expectedRounds: 30 },
  ])("accepts a $name-slot roster", ({ benchCount, expectedRounds }) => {
    const result = buildLeagueSetup(
      createInput({
        teamCount: 2,
        userDraftPosition: 2,
        rosterSlotCounts: {
          ...minimalRosterCounts(),
          BENCH: benchCount,
        },
      }),
      60,
    );

    expectSuccess(result);
    expect(result.leagueSettings.rounds).toBe(expectedRounds);
  });

  it("rejects more than thirty roster slots", () => {
    const result = buildLeagueSetup(
      createInput({
        rosterSlotCounts: {
          ...minimalRosterCounts(),
          BENCH: 30,
        },
      }),
      ampleRankingPlayerCount,
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      field: "rosterSlotCounts",
      message: "Total roster slots must be between 1 and 30.",
    });
  });

  it("accepts exact ranking capacity and rejects one fewer player", () => {
    const input = createInput({
      teamCount: 3,
      rosterSlotCounts: {
        ...minimalRosterCounts(),
        BENCH: 1,
      },
    });

    expectSuccess(buildLeagueSetup(input, 6));

    const failure = buildLeagueSetup(input, 5);
    expectFailure(failure);
    expect(failure.errors).toEqual([
      {
        field: "rankingPlayerCount",
        message: "Draft requires 6 players, but only 5 ranking players are available.",
      },
    ]);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid RB roster count %s",
    (RB) => {
      const result = buildLeagueSetup(
        createInput({
          rosterSlotCounts: {
            ...minimalRosterCounts(),
            RB,
          },
        }),
        ampleRankingPlayerCount,
      );

      expectFailure(result);
      expect(result.errors).toContainEqual({
        field: "rosterSlotCounts.RB",
        message: "RB roster count must be a non-negative integer.",
      });
    },
  );

  it("rejects unsupported runtime draft and scoring values", () => {
    const result = buildLeagueSetup(
      createInput({
        draftType: "LINEAR" as DraftType,
        scoringFormat: "STANDARD" as ScoringFormat,
      }),
      ampleRankingPlayerCount,
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      { field: "draftType", message: "Draft type must be SNAKE." },
      { field: "scoringFormat", message: "Scoring format must be PPR." },
    ]);
  });

  it("returns multiple independent errors in deterministic order", () => {
    const result = buildLeagueSetup(
      createInput({
        teamCount: 1,
        userDraftPosition: Number.NaN,
        draftType: "LINEAR" as DraftType,
        scoringFormat: "STANDARD" as ScoringFormat,
        rosterSlotCounts: {
          ...minimalRosterCounts(),
          QB: -1,
        },
      }),
      -1,
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "rankingPlayerCount",
          message: "Ranking player count must be a non-negative integer.",
        },
        {
          field: "teamCount",
          message: "Team count must be an integer from 2 through 20.",
        },
        {
          field: "userDraftPosition",
          message: "Draft position must be an integer.",
        },
        { field: "draftType", message: "Draft type must be SNAKE." },
        { field: "scoringFormat", message: "Scoring format must be PPR." },
        {
          field: "rosterSlotCounts.QB",
          message: "QB roster count must be a non-negative integer.",
        },
      ],
    });
    expect(result).not.toHaveProperty("leagueSettings");
    expect(result).not.toHaveProperty("userTeamId");
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects invalid ranking player count %s",
    (rankingPlayerCount) => {
      const result = buildLeagueSetup(
        defaultLeagueSetupInput,
        rankingPlayerCount,
      );

      expectFailure(result);
      expect(result.errors).toContainEqual({
        field: "rankingPlayerCount",
        message: "Ranking player count must be a non-negative integer.",
      });
    },
  );
});

function createInput(
  overrides: Omit<Partial<LeagueSetupInput>, "rosterSlotCounts"> & {
    rosterSlotCounts?: LeagueSetupInput["rosterSlotCounts"];
  } = {},
): LeagueSetupInput {
  return {
    ...defaultLeagueSetupInput,
    ...overrides,
    rosterSlotCounts:
      overrides.rosterSlotCounts ?? {
        ...defaultLeagueSetupInput.rosterSlotCounts,
      },
  };
}

function emptyRosterCounts(): LeagueSetupInput["rosterSlotCounts"] {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    DST: 0,
    K: 0,
    BENCH: 0,
  };
}

function minimalRosterCounts(): LeagueSetupInput["rosterSlotCounts"] {
  return {
    ...emptyRosterCounts(),
    QB: 1,
  };
}

function expectSuccess(
  result: LeagueSetupResult,
): asserts result is Extract<LeagueSetupResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected setup success, received: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: LeagueSetupResult,
): asserts result is Extract<LeagueSetupResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected setup failure.");
  }
}
