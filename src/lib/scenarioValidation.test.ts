import { describe, expect, it } from "vitest";
import { createDraftTeams } from "@/lib/draftOrder";
import { buildLeagueSetup, type LeagueSetupInput } from "@/lib/leagueSetup";
import { serializeScenarioV1 } from "@/lib/scenarioSerialization";
import {
  materializeScenarioV1Rankings,
  parseScenarioV1Json,
  SCENARIO_VALIDATION_LIMITS,
  type ScenarioValidationErrorCode,
} from "@/lib/scenarioValidation";
import type { Position, RankingEntry } from "@/types/draft";
import { NEUTRAL_TIER } from "@/types/rankings";
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioV1,
} from "@/types/scenario";

describe("scenario v1 parsing and validation", () => {
  it("normalizes a valid scenario into fresh typed data", () => {
    const scenario = createValidScenario();
    const result = parseScenarioV1Json(serializeScenarioV1(scenario));

    expect(result).toEqual({ ok: true, scenario });

    if (!result.ok) {
      throw new Error("Expected a valid scenario.");
    }

    expect(result.scenario).not.toBe(scenario);
    expect(result.scenario.metadata).not.toBe(scenario.metadata);
    expect(result.scenario.leagueSettings).not.toBe(scenario.leagueSettings);
    expect(result.scenario.rankingContext.rankings).not.toBe(
      scenario.rankingContext.rankings,
    );
  });

  it("materializes legacy ambiguous scenario tiers as fresh neutral rankings", () => {
    const scenario = createValidScenario();
    scenario.rankingContext.rankings.forEach((ranking, index) => {
      ranking.tier = index + 2;
    });
    const before = structuredClone(scenario);

    const mapped = materializeScenarioV1Rankings(
      scenario.rankingContext.rankings,
    );
    const result = parseScenarioV1Json(serializeScenarioV1(scenario));

    expect(scenario).toEqual(before);
    expect(mapped).toEqual(
      scenario.rankingContext.rankings.map((ranking) => ({
        ...ranking,
        tier: NEUTRAL_TIER,
      })),
    );
    expect(mapped[0]).not.toBe(scenario.rankingContext.rankings[0]);
    expect(mapped[0].player).not.toBe(
      scenario.rankingContext.rankings[0].player,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected a valid legacy scenario.");
    }
    expect(result.scenario.rankingContext.rankings).toEqual(mapped);
    expect(result.scenario.rankingContext.rankings.map(({ tier }) => tier)).toEqual(
      Array(mapped.length).fill(NEUTRAL_TIER),
    );
  });

  it("accepts zero, intermediate, and completed replay targets", () => {
    [0, 2, 4].forEach((appliedPickCount) => {
      const document = createDocument();
      document.replayTarget.appliedPickCount = appliedPickCount;

      expect(parseDocument(document).ok).toBe(true);
    });
  });

  it("rejects malformed JSON without exposing the native parser error", () => {
    const result = parseScenarioV1Json("{not-json");

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-json",
          path: "$",
          message: "Scenario must contain valid JSON.",
        },
      ],
    });
  });

  it.each([
    ["non-object root", [], "$", "invalid-type"],
    ["missing version", { ...createDocument(), schemaVersion: undefined }, "schemaVersion", "missing-field"],
    ["unsupported version", { ...createDocument(), schemaVersion: 2 }, "schemaVersion", "unsupported-version"],
    ["missing metadata", { ...createDocument(), metadata: undefined }, "metadata", "missing-field"],
  ] as const)("rejects a %s", (_label, document, path, code) => {
    expectFailure(parseDocument(document), path, code);
  });

  it("validates optional metadata and provenance", () => {
    const document = createDocument();
    document.metadata.provenance = {
      sourceKind: "manual",
      exportedAt: "2026-06-27T12:00:00.000Z",
    };

    expect(parseDocument(document).ok).toBe(true);

    document.metadata.provenance.sourceKind = "provider";
    expectFailure(
      parseDocument(document),
      "metadata.provenance.sourceKind",
      "invalid-value",
    );
  });

  it("rejects invalid tag entries, source IDs, and timestamps", () => {
    const invalidTag = createDocument();
    invalidTag.metadata.tags = [12];
    expectFailure(parseDocument(invalidTag), "metadata.tags[0]", "invalid-type");

    const invalidSourceId = createDocument();
    invalidSourceId.metadata.provenance.sourceId = "";
    expectFailure(
      parseDocument(invalidSourceId),
      "metadata.provenance.sourceId",
      "invalid-value",
    );

    const invalidTimestamp = createDocument();
    invalidTimestamp.metadata.provenance.exportedAt = "not-a-date";
    expectFailure(
      parseDocument(invalidTimestamp),
      "metadata.provenance.exportedAt",
      "invalid-value",
    );
  });

  it("enforces the UTF-8 byte limit before parsing", () => {
    const validJson = serializeScenarioV1(createValidScenario());
    const atLimit = validJson.padEnd(SCENARIO_VALIDATION_LIMITS.maxJsonBytes, " ");
    const overLimit = `${atLimit} `;

    expect(parseScenarioV1Json(atLimit).ok).toBe(true);
    expectFailure(parseScenarioV1Json(overLimit), "$", "limit-exceeded");

    const multibyte = createDocument();
    multibyte.metadata.description = "😀".repeat(
      Math.floor(SCENARIO_VALIDATION_LIMITS.maxJsonBytes / 4),
    );
    const multibyteJson = JSON.stringify(multibyte);

    expect(multibyteJson.length).toBeLessThan(SCENARIO_VALIDATION_LIMITS.maxJsonBytes);
    expectFailure(parseScenarioV1Json(multibyteJson), "$", "limit-exceeded");
  });

  it("enforces metadata, ranking, history, and configured-capacity limits", () => {
    const tooManyTags = createDocument();
    tooManyTags.metadata.tags = Array.from({ length: 51 }, (_, index) => `tag-${index}`);
    expectFailure(parseDocument(tooManyTags), "metadata.tags", "limit-exceeded");

    const tooManyRankings = createDocument();
    tooManyRankings.rankingContext.rankings = Array.from(
      { length: 1001 },
      (_, index) => createRanking(`player-${index}`, index + 1, "WR"),
    );
    expectFailure(
      parseDocument(tooManyRankings),
      "rankingContext.rankings",
      "limit-exceeded",
    );

    const tooManyPicks = createDocument();
    tooManyPicks.pickHistory = Array.from({ length: 1001 }, (_, index) => ({
      playerId: `player-${index}`,
    }));
    expectFailure(parseDocument(tooManyPicks), "pickHistory", "limit-exceeded");

    const tooMuchCapacity = createDocument();
    tooMuchCapacity.leagueSettings.teamCount = 34;
    tooMuchCapacity.leagueSettings.rounds = 30;
    expectFailure(parseDocument(tooMuchCapacity), "leagueSettings", "limit-exceeded");
  });

  it("rejects missing, empty, duplicate, and insufficient rankings", () => {
    const missing = createDocument();
    delete missing.rankingContext.rankings;
    expectFailure(
      parseDocument(missing),
      "rankingContext.rankings",
      "missing-field",
    );

    const empty = createDocument();
    empty.rankingContext.rankings = [];
    expectFailure(
      parseDocument(empty),
      "rankingContext.rankings",
      "invalid-value",
    );

    const duplicate = createDocument();
    getRankings(duplicate)[1].player.id = getRankings(duplicate)[0].player.id;
    expectFailure(
      parseDocument(duplicate),
      "rankingContext.rankings",
      "duplicate-identity",
    );

    const insufficient = createDocument();
    getRankings(insufficient).pop();
    expectFailure(
      parseDocument(insufficient),
      "rankingContext.rankings",
      "inconsistent-configuration",
    );
  });

  it.each([
    ["round mismatch", (document: ScenarioDocument) => { document.leagueSettings.rounds = 3; }],
    ["slot ID drift", (document: ScenarioDocument) => { document.leagueSettings.rosterSlots[0].id = "changed"; }],
    ["slot order drift", (document: ScenarioDocument) => { document.leagueSettings.rosterSlots.reverse(); }],
    ["eligibility drift", (document: ScenarioDocument) => { document.leagueSettings.rosterSlots[0].eligiblePositions = ["RB"]; }],
    ["bench only", (document: ScenarioDocument) => { document.leagueSettings.rosterSlots = [{ id: "bench-1", label: "BENCH", eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"] }]; document.leagueSettings.rounds = 1; }],
    ["unknown slot", (document: ScenarioDocument) => { document.leagueSettings.rosterSlots[0].label = "SUPERFLEX"; }],
  ] as const)("rejects non-canonical league settings: %s", (_label, mutate) => {
    const document = createDocument();
    mutate(document);

    const result = parseDocument(document);
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported draft and scoring values", () => {
    const draftType = createDocument();
    draftType.leagueSettings.draftType = "LINEAR";
    expectFailure(parseDocument(draftType), "leagueSettings", "invalid-value");

    const scoring = createDocument();
    scoring.leagueSettings.scoringFormat = "STANDARD";
    expectFailure(parseDocument(scoring), "leagueSettings", "invalid-value");
  });

  it("rejects duplicate or non-canonical teams", () => {
    const duplicate = createDocument();
    duplicate.draftConfiguration.teams[1].id = "team-1";
    expectFailure(
      parseDocument(duplicate),
      "draftConfiguration.teams",
      "duplicate-identity",
    );

    const renamed = createDocument();
    renamed.draftConfiguration.teams[0].name = "Renamed";
    expectFailure(
      parseDocument(renamed),
      "draftConfiguration.teams",
      "inconsistent-configuration",
    );

    const reordered = createDocument();
    reordered.draftConfiguration.teams.reverse();
    expectFailure(
      parseDocument(reordered),
      "draftConfiguration.teams",
      "inconsistent-configuration",
    );
  });

  it("rejects an unknown user team", () => {
    const document = createDocument();
    document.userTeamContext.userTeamId = "team-99";

    expectFailure(
      parseDocument(document),
      "userTeamContext.userTeamId",
      "invalid-reference",
    );
  });

  it("rejects unknown and duplicate picked players", () => {
    const unknown = createDocument();
    unknown.pickHistory[0].playerId = "missing-player";
    expectFailure(
      parseDocument(unknown),
      "pickHistory[0].playerId",
      "invalid-reference",
    );

    const duplicate = createDocument();
    duplicate.pickHistory[1].playerId = duplicate.pickHistory[0].playerId;
    expectFailure(
      parseDocument(duplicate),
      "pickHistory[1].playerId",
      "duplicate-identity",
    );
  });

  it("rejects history beyond configured capacity", () => {
    const document = createDocument();
    document.pickHistory.push({ playerId: "player-extra" });
    getRankings(document).push(
      createRanking("player-extra", 5, "WR"),
    );

    expectFailure(parseDocument(document), "pickHistory", "limit-exceeded");
  });

  it("checks optional assertions against generated draft order", () => {
    const valid = createDocument();
    expect(parseDocument(valid).ok).toBe(true);

    const pickNumber = createDocument();
    pickNumber.pickHistory[1].expectedPickNumber = 3;
    expectFailure(
      parseDocument(pickNumber),
      "pickHistory[1].expectedPickNumber",
      "inconsistent-configuration",
    );

    const team = createDocument();
    team.pickHistory[2].expectedTeamId = "team-1";
    expectFailure(
      parseDocument(team),
      "pickHistory[2].expectedTeamId",
      "inconsistent-configuration",
    );
  });

  it("rejects malformed and out-of-range replay targets", () => {
    [-1, 1.5, 5].forEach((appliedPickCount) => {
      const document = createDocument();
      document.replayTarget.appliedPickCount = appliedPickCount;

      expectFailure(
        parseDocument(document),
        "replayTarget.appliedPickCount",
        "invalid-value",
      );
    });
  });

  it("discards unknown derived-state properties", () => {
    const document = createDocument();
    document.currentPickNumber = 3;
    document.recommendations = [{ playerId: "player-qb" }];

    const result = parseDocument(document);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected a valid scenario.");
    }
    expect(result.scenario).not.toHaveProperty("currentPickNumber");
    expect(result.scenario).not.toHaveProperty("recommendations");
  });

  it("returns deterministic failures without mutating input", () => {
    const document = createDocument();
    document.pickHistory[0].playerId = "missing-player";
    const before = structuredClone(document);

    expect(parseDocument(document)).toEqual(parseDocument(document));
    expect(document).toEqual(before);
  });
});

type ScenarioDocument = Record<string, unknown> & {
  schemaVersion?: unknown;
  metadata: Record<string, unknown> & {
    description?: unknown;
    tags?: unknown[];
    provenance: Record<string, unknown> & {
      sourceKind: unknown;
      sourceId?: unknown;
      exportedAt: unknown;
    };
  };
  leagueSettings: Record<string, unknown> & {
    teamCount: number;
    rounds: number;
    draftType: unknown;
    scoringFormat: unknown;
    rosterSlots: Array<
      Record<string, unknown> & {
        id: unknown;
        label: unknown;
        eligiblePositions: unknown[];
      }
    >;
  };
  draftConfiguration: {
    teams: Array<
      Record<string, unknown> & {
        id: unknown;
        name: unknown;
        draftPosition: unknown;
      }
    >;
  };
  rankingContext: {
    rankings?: Array<
      Record<string, unknown> & {
        player: Record<string, unknown> & { id: string };
      }
    >;
  };
  userTeamContext: { userTeamId: unknown };
  pickHistory: Array<
    Record<string, unknown> & {
      playerId: string;
      expectedPickNumber?: unknown;
      expectedTeamId?: unknown;
    }
  >;
  replayTarget: { appliedPickCount: unknown };
};

function createValidScenario(): ScenarioV1 {
  const rankings = [
    createRanking("player-qb", 1, "QB"),
    createRanking("player-rb", 2, "RB"),
    createRanking("player-wr", 3, "WR"),
    createRanking("player-te", 4, "TE"),
  ];
  const setupInput: LeagueSetupInput = {
    teamCount: 2,
    userDraftPosition: 2,
    draftType: "SNAKE",
    scoringFormat: "PPR",
    rosterSlotCounts: {
      QB: 1,
      RB: 0,
      WR: 0,
      TE: 0,
      FLEX: 0,
      DST: 0,
      K: 0,
      BENCH: 1,
    },
  };
  const setup = buildLeagueSetup(setupInput, rankings.length);

  if (!setup.ok) {
    throw new Error("Expected valid test league setup.");
  }

  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    metadata: {
      id: "scenario-1",
      name: "Two-team scenario",
      description: "A compact non-default scenario.",
      tags: ["non-default", "validation"],
      provenance: {
        sourceKind: "persisted",
        sourceId: "draft-1",
        exportedAt: "2026-06-27T12:00:00.000Z",
      },
    },
    leagueSettings: setup.leagueSettings,
    draftConfiguration: {
      teams: createDraftTeams(setup.leagueSettings.teamCount),
    },
    rankingContext: { rankings },
    userTeamContext: { userTeamId: setup.userTeamId },
    pickHistory: [
      { playerId: "player-qb", expectedPickNumber: 1, expectedTeamId: "team-1" },
      { playerId: "player-rb", expectedPickNumber: 2, expectedTeamId: "team-2" },
      { playerId: "player-wr", expectedPickNumber: 3, expectedTeamId: "team-2" },
      { playerId: "player-te", expectedPickNumber: 4, expectedTeamId: "team-1" },
    ],
    replayTarget: { appliedPickCount: 2 },
  };
}

function createDocument(): ScenarioDocument {
  return JSON.parse(serializeScenarioV1(createValidScenario())) as ScenarioDocument;
}

function parseDocument(document: unknown) {
  return parseScenarioV1Json(JSON.stringify(document));
}

function getRankings(
  document: ScenarioDocument,
): NonNullable<ScenarioDocument["rankingContext"]["rankings"]> {
  const rankings = document.rankingContext.rankings;

  if (!rankings) {
    throw new Error("Expected test scenario rankings.");
  }

  return rankings;
}

function expectFailure(
  result: ReturnType<typeof parseScenarioV1Json>,
  path: string,
  code: ScenarioValidationErrorCode,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected scenario validation to fail.");
  }
  expect(result.errors[0]).toMatchObject({ path, code });
}

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
): RankingEntry {
  return {
    player: { id, name: id, team: "TEST", position },
    overallRank,
    adpRank: null,
    positionRank: overallRank,
    tier: 1,
  };
}
