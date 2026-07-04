import { describe, expect, it } from "vitest";
import { createDraftTeams } from "@/lib/draftOrder";
import {
  serializeScenarioV1,
  serializeScenarioV2,
} from "@/lib/scenarioSerialization";
import { parseScenarioV2Json } from "@/lib/scenarioValidation";
import type { LeagueSettings, Position, RankingEntry } from "@/types/draft";
import {
  SCENARIO_SCHEMA_VERSION,
  SCENARIO_V2_SCHEMA_VERSION,
  type ScenarioV1,
  type ScenarioV2,
} from "@/types/scenario";

describe("scenario v1 serialization", () => {
  it("exposes one supported schema version and serializes the complete source shape", () => {
    const scenario: ScenarioV1 = createScenario();

    expect(SCENARIO_SCHEMA_VERSION).toBe(1);
    expect(JSON.parse(serializeScenarioV1(scenario))).toEqual(scenario);
  });

  it("produces stable newline-terminated JSON without mutating its input", () => {
    const scenario = createScenario();
    const before = structuredClone(scenario);

    const first = serializeScenarioV1(scenario);
    const second = serializeScenarioV1(scenario);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(scenario).toEqual(before);
  });

  it("omits absent optional fields", () => {
    const scenario = createScenario({ includeOptionalFields: false });
    const serialized = JSON.parse(serializeScenarioV1(scenario)) as ScenarioV1;

    expect(serialized.metadata).toEqual({
      id: "non-default-scenario",
      name: "Non-default scenario",
    });
    expect(serialized.pickHistory).toEqual([
      { playerId: "player-qb" },
      { playerId: "player-rb" },
      { playerId: "player-wr" },
      { playerId: "player-te" },
    ]);
  });

  it("keeps metadata and provenance separate from reconstruction inputs", () => {
    const withProvenance = JSON.parse(
      serializeScenarioV1(createScenario()),
    ) as Record<string, unknown>;
    const withoutProvenance = JSON.parse(
      serializeScenarioV1(
        createScenario({
          metadata: {
            id: "renamed-scenario",
            name: "Renamed scenario",
          },
        }),
      ),
    ) as Record<string, unknown>;

    const { metadata: firstMetadata, ...firstInputs } = withProvenance;
    const { metadata: secondMetadata, ...secondInputs } = withoutProvenance;

    expect(firstMetadata).not.toEqual(secondMetadata);
    expect(firstInputs).toEqual(secondInputs);
  });

  it("represents dynamic non-default settings and preserves semantic array order", () => {
    const scenario = createScenario();
    const serialized = JSON.parse(serializeScenarioV1(scenario)) as ScenarioV1;

    expect(serialized.leagueSettings.teamCount).toBe(2);
    expect(serialized.leagueSettings.rounds).toBe(2);
    expect(serialized.leagueSettings.rosterSlots.map((slot) => slot.id)).toEqual([
      "QB-1",
      "BENCH-1",
    ]);
    expect(serialized.draftConfiguration.teams.map((team) => team.id)).toEqual([
      "team-1",
      "team-2",
    ]);
    expect(serialized.rankingContext.rankings.map(({ player }) => player.id)).toEqual([
      "player-qb",
      "player-rb",
      "player-wr",
      "player-te",
    ]);
    expect(serialized.metadata.tags).toEqual(["non-default", "ordering"]);
    expect(serialized.pickHistory.map(({ playerId }) => playerId)).toEqual([
      "player-qb",
      "player-rb",
      "player-wr",
      "player-te",
    ]);
    expect(serialized.userTeamContext.userTeamId).toBe("team-2");
  });

  it.each([
    ["zero", 0],
    ["intermediate", 2],
    ["completed", 4],
  ])("represents a %s applied-pick-count target", (_label, appliedPickCount) => {
    const scenario = createScenario();
    scenario.replayTarget.appliedPickCount = appliedPickCount;

    const serialized = JSON.parse(serializeScenarioV1(scenario)) as ScenarioV1;

    expect(serialized.replayTarget).toEqual({ appliedPickCount });
  });

  it("does not serialize authoritative derived state", () => {
    const serialized = JSON.parse(
      serializeScenarioV1(createScenario()),
    ) as Record<string, unknown>;

    expect(serialized).not.toHaveProperty("draft");
    expect(serialized).not.toHaveProperty("rosters");
    expect(serialized).not.toHaveProperty("availablePlayers");
    expect(serialized).not.toHaveProperty("currentPickNumber");
    expect(serialized).not.toHaveProperty("recommendations");
  });
});

describe("scenario v2 serialization", () => {
  it("serializes and parses the complete portable ranking context", () => {
    const scenario = createScenarioV2();
    const serialized = serializeScenarioV2(scenario);
    const document = JSON.parse(serialized) as Record<string, unknown>;

    expect(document).toEqual(scenario);
    expect(parseScenarioV2Json(serialized)).toEqual({ ok: true, scenario });
  });

  it("is deterministic, newline-terminated, and non-mutating", () => {
    const scenario = createScenarioV2();
    const before = structuredClone(scenario);

    const first = serializeScenarioV2(scenario);
    const second = serializeScenarioV2(scenario);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(scenario).toEqual(before);
  });

  it("canonicalizes recommendation semantic position order", () => {
    const scenario = createScenarioV2();
    scenario.rankingContext.tierSemantics = {
      ...scenario.rankingContext.tierSemantics,
      recommendation: {
        TE: "neutral",
        WR: "neutral",
        RB: "neutral",
        QB: "neutral",
      },
    };
    const serialized = JSON.parse(serializeScenarioV2(scenario)) as ScenarioV2;

    expect(Object.keys(serialized.rankingContext.tierSemantics.recommendation)).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
    ]);
  });

  it("omits mutable source identity and all derived recommendation output", () => {
    const document = JSON.parse(
      serializeScenarioV2(createScenarioV2()),
    ) as Record<string, unknown>;
    const json = JSON.stringify(document);

    expect(json).not.toContain("sourceRankingSetId");
    expect(json).not.toContain("sourceRankingSetName");
    expect(json).not.toContain("capturedAt");
    expect(document).not.toHaveProperty("forecast");
    expect(document).not.toHaveProperty("recommendations");
    expect(document).not.toHaveProperty("scoreComponents");
    expect(json).not.toContain("missingAdpFallback");
  });
});

type CreateScenarioOptions = {
  includeOptionalFields?: boolean;
  metadata?: ScenarioV1["metadata"];
};

function createScenario(options: CreateScenarioOptions = {}): ScenarioV1 {
  const includeOptionalFields = options.includeOptionalFields ?? true;

  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    metadata:
      options.metadata ??
      (includeOptionalFields
        ? {
            id: "non-default-scenario",
            name: "Non-default scenario",
            description: "Exercises a compact two-team draft.",
            tags: ["non-default", "ordering"],
            provenance: {
              sourceKind: "persisted",
              sourceId: "draft-123",
              exportedAt: "2026-06-27T12:00:00.000Z",
            },
          }
        : {
            id: "non-default-scenario",
            name: "Non-default scenario",
          }),
    leagueSettings: createLeagueSettings(),
    draftConfiguration: {
      teams: createDraftTeams(2),
    },
    rankingContext: {
      rankings: [
        createRanking("player-qb", 1, "QB"),
        createRanking("player-rb", 2, "RB"),
        createRanking("player-wr", 3, "WR"),
        createRanking("player-te", 4, "TE"),
      ],
    },
    userTeamContext: {
      userTeamId: "team-2",
    },
    pickHistory: [
      createPick("player-qb", 1, "team-1", includeOptionalFields),
      createPick("player-rb", 2, "team-2", includeOptionalFields),
      createPick("player-wr", 3, "team-2", includeOptionalFields),
      createPick("player-te", 4, "team-1", includeOptionalFields),
    ],
    replayTarget: {
      appliedPickCount: 2,
    },
  };
}

function createScenarioV2(): ScenarioV2 {
  const scenario = createScenario();
  const rankings = scenario.rankingContext.rankings.map((ranking, index) => ({
    ...ranking,
    player: { ...ranking.player },
    adpRank: index % 2 === 0 ? index + 1 : null,
  }));

  return {
    ...scenario,
    schemaVersion: SCENARIO_V2_SCHEMA_VERSION,
    leagueSettings: {
      ...scenario.leagueSettings,
      rosterSlots: scenario.leagueSettings.rosterSlots.map((slot) => ({
        ...slot,
        id: slot.id.toLowerCase(),
      })),
    },
    rankingContext: {
      rankings,
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: rankings.map((ranking, index) => ({
            playerId: ranking.player.id,
            overallRank: ranking.overallRank,
            tier: index < 2 ? 1 : 2,
          })),
        },
        recommendation: {
          QB: "neutral",
          RB: "neutral",
          WR: "neutral",
          TE: "neutral",
        },
      },
    },
  };
}

function createLeagueSettings(): LeagueSettings {
  return {
    teamCount: 2,
    rounds: 2,
    draftType: "SNAKE",
    scoringFormat: "PPR",
    rosterSlots: [
      {
        id: "QB-1",
        label: "QB",
        eligiblePositions: ["QB"],
      },
      {
        id: "BENCH-1",
        label: "BENCH",
        eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"],
      },
    ],
  };
}

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
): RankingEntry {
  return {
    player: {
      id,
      name: id,
      team: "TEST",
      position,
    },
    overallRank,
    adpRank: null,
    positionRank: 1,
    tier: 1,
  };
}

function createPick(
  playerId: string,
  expectedPickNumber: number,
  expectedTeamId: string,
  includeOptionalFields: boolean,
): ScenarioV1["pickHistory"][number] {
  if (!includeOptionalFields) {
    return { playerId };
  }

  return {
    playerId,
    expectedPickNumber,
    expectedTeamId,
  };
}
