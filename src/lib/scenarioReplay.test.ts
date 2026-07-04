import { describe, expect, it } from "vitest";
import { createDraftTeams } from "@/lib/draftOrder";
import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { buildLeagueSetup, type LeagueSetupInput } from "@/lib/leagueSetup";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import {
  replayScenario,
  replayScenarioV1,
  replayScenarioV2,
  SCENARIO_REPLAY_DRAFT_ID,
} from "@/lib/scenarioReplay";
import {
  serializeScenarioV1,
  serializeScenarioV2,
} from "@/lib/scenarioSerialization";
import {
  materializeScenarioV1Rankings,
  parseScenarioV1Json,
  parseScenarioV2Json,
} from "@/lib/scenarioValidation";
import type { Draft, Position, RankingEntry } from "@/types/draft";
import { NEUTRAL_TIER, type RankingSnapshot } from "@/types/rankings";
import {
  SCENARIO_SCHEMA_VERSION,
  SCENARIO_V2_SCHEMA_VERSION,
  type ScenarioDocument,
  type ScenarioV1,
  type ScenarioV2,
} from "@/types/scenario";

describe("scenario replay", () => {
  it("returns the fresh configured draft and recommendations for a zero target", () => {
    const scenario = createParsedScenario(0);
    const result = replayScenarioV1(scenario);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected replay success.");
    }

    expect(result.draft).toEqual(createBaseDraft(scenario));
    expect(result.draft.picks.every((pick) => !pick.playerId)).toBe(true);
    expect(result.recommendations).toEqual(
      generateRecommendations(scenario, result.draft),
    );
  });

  it("returns the exact intermediate target after validating later history", () => {
    const scenario = createParsedScenario(3);
    const result = replayScenarioV1(scenario);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected replay success.");
    }

    const manualDraft = manuallyReplayToTarget(scenario);
    expect(result.draft).toEqual(manualDraft);
    expect(result.draft.picks.filter((pick) => pick.playerId)).toHaveLength(3);
    expect(result.draft.currentPickNumber).toBe(4);
  });

  it("returns normal completed engine state with no recommendations", () => {
    const scenario = createParsedScenario(6);
    const result = replayScenarioV1(scenario);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected replay success.");
    }

    expect(result.draft.currentPickNumber).toBe(6);
    expect(result.draft.picks.every((pick) => Boolean(pick.playerId))).toBe(true);
    expect(result.recommendations).toEqual([]);
    expect(isValidDraftState({ draft: result.draft, availableRankings: [] })).toBe(
      true,
    );
  });

  it("is deterministic for repeated replay", () => {
    const scenario = createParsedScenario(4);

    expect(replayScenarioV1(scenario)).toEqual(replayScenarioV1(scenario));
  });

  it("keeps metadata and provenance out of replay output", () => {
    const first = createParsedScenario(3);
    const second = structuredClone(first);
    second.metadata = {
      id: "different-id",
      name: "Different name",
      description: "Different description",
      tags: ["different"],
      provenance: {
        sourceKind: "manual",
        exportedAt: "2027-01-01T00:00:00.000Z",
      },
    };

    expect(replayScenarioV1(first)).toEqual(replayScenarioV1(second));
  });

  it("does not mutate the scenario", () => {
    const scenario = createParsedScenario(2);
    const before = structuredClone(scenario);

    replayScenarioV1(scenario);

    expect(scenario).toEqual(before);
  });

  it.each([
    ["complete", [1, 2, 3, 4, 5, 6], "active"],
    ["partial", [1, null, 3, null, 5, null], "active"],
    ["absent", [null, null, null, null, null, null], "no-adp"],
  ] as const)("replays Scenario V2 with %s ADP", (_label, adpRanks, forecastStatus) => {
    const scenario = createParsedScenarioV2(0, adpRanks);
    const replay = replayScenarioV2(scenario);

    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      throw new Error("Expected Scenario V2 replay success.");
    }
    expect(replay).toEqual(replayScenario(scenario));
    expect(replay.recommendations).toEqual(
      generateRecommendations(scenario, replay.draft),
    );
    const first = replay.recommendations[0];
    const timing = first.components.find(({ id }) => id === "draft_pocket_timing");

    expect(first.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "overall_tier", delta: 6 }),
      ]),
    );
    expect(timing).toMatchObject({
      evidence: {
        forecastStatus,
        targetPickNumber: 3,
      },
    });
    if (forecastStatus === "active") {
      expect(
        first.reasons.some(({ sourceComponentId }) => {
          return sourceComponentId === "overall_tier" ||
            sourceComponentId === "draft_pocket_timing";
        }),
      ).toBe(true);
    }
  });

  it("recomputes V2 forecast evidence at each replay target", () => {
    const atOpening = replayScenarioV2(
      createParsedScenarioV2(0, [1, 2, 3, 4, 5, 6]),
    );
    const atUserTurn = replayScenarioV2(
      createParsedScenarioV2(2, [1, 2, 3, 4, 5, 6]),
    );
    const afterFinalUserPick = replayScenarioV2(
      createParsedScenarioV2(4, [1, 2, 3, 4, 5, 6]),
    );

    expect(getFirstTimingEvidence(atOpening)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 3,
    });
    expect(getFirstTimingEvidence(atUserTurn)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 4,
    });
    expect(getFirstTimingEvidence(afterFinalUserPick)).toMatchObject({
      forecastStatus: "no-next-pick",
      targetPickNumber: null,
    });
  });

  it("uses stored V1 ADP while keeping overall tiers default-neutral", () => {
    const scenario = createScenario(0);
    scenario.rankingContext.rankings.forEach((ranking) => {
      ranking.adpRank = ranking.overallRank;
      ranking.tier = ranking.overallRank;
    });
    const parsed = parseScenarioV1Json(serializeScenarioV1(scenario));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("Expected Scenario V1 parsing success.");
    }
    const replay = replayScenarioV1(parsed.scenario);

    expect(getFirstTimingEvidence(replay)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 3,
    });
    expect(getFirstRecommendation(replay).components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "overall_tier",
          delta: 0,
          evidence: expect.objectContaining({
            overallTierOrigin: "defaulted-neutral",
          }),
        }),
      ]),
    );
  });

  it("neutralizes ambiguous tiers for direct typed replay callers", () => {
    const scenario = createScenario(0);
    scenario.rankingContext.rankings.find(
      ({ player }) => player.id === "player-rb-2",
    )!.tier = 4;
    const before = structuredClone(scenario);
    const unguarded = generatePlayerRecommendations({
      draft: createBaseDraft(scenario),
      rankings: scenario.rankingContext.rankings,
      leagueSettings: scenario.leagueSettings,
      userTeamId: scenario.userTeamContext.userTeamId,
    });
    const neutralScenario = structuredClone(scenario);
    neutralScenario.rankingContext.rankings.forEach((ranking) => {
      ranking.tier = NEUTRAL_TIER;
    });

    const first = replayScenarioV1(scenario);
    const second = replayScenarioV1(scenario);

    expect(
      unguarded.some((recommendation) =>
        recommendation.components.some(({ id }) => id === "tier_cliff"),
      ),
    ).toBe(true);
    expect(first).toEqual(second);
    expect(first).toEqual(replayScenarioV1(neutralScenario));
    expect(scenario).toEqual(before);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("Expected replay success.");
    }
    for (const recommendation of first.recommendations) {
      expect(recommendation.components.some(({ id }) => id === "tier_cliff")).toBe(
        false,
      );
      expect(
        recommendation.reasons.some(
          ({ sourceComponentId }) => sourceComponentId === "tier_cliff",
        ),
      ).toBe(false);
      const componentTotal = recommendation.components.reduce(
        (total, component) => total + component.delta,
        0,
      );
      const adjustmentTotal = recommendation.scoreAdjustments.reduce(
        (total, adjustment) => total + adjustment.delta,
        0,
      );
      expect(componentTotal + adjustmentTotal).toBeCloseTo(
        recommendation.totalScore,
        12,
      );
    }
  });

  it("replays dynamic non-default settings without default assumptions", () => {
    const scenario = createParsedScenario(2);
    const result = replayScenarioV1(scenario);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected replay success.");
    }

    expect(result.draft.teamCount).toBe(3);
    expect(result.draft.rounds).toBe(2);
    expect(result.draft.userTeamId).toBe("team-3");
    expect(result.draft.teams).toEqual(createDraftTeams(3));
    expect(result.draft.picks).toHaveLength(6);
  });

  it("matches manual draft, availability, user picks, and recommendations", () => {
    const scenario = createParsedScenario(4);
    const replay = replayScenarioV1(scenario);
    const manualDraft = manuallyReplayToTarget(scenario);

    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      throw new Error("Expected replay success.");
    }

    expect(replay.draft).toEqual(manualDraft);
    expect(getAvailablePlayerIds(replay.draft, scenario)).toEqual(
      getAvailablePlayerIds(manualDraft, scenario),
    );
    expect(getUserPickPlayerIds(replay.draft)).toEqual(
      getUserPickPlayerIds(manualDraft),
    );
    expect(replay.recommendations).toEqual(
      generateRecommendations(scenario, manualDraft),
    );
  });

  it("rejects a late no-op even when the target is earlier", () => {
    const scenario = createParsedScenario(2);
    scenario.pickHistory[5] = {
      ...scenario.pickHistory[5],
      playerId: scenario.pickHistory[0].playerId,
    };

    const result = replayScenarioV1(scenario);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "pick-rejected",
        pickIndex: 5,
        playerId: "player-qb",
        pickNumber: 6,
        message:
          "Pick history entry 5 was rejected by the Draft State Engine.",
      },
    });
    expect(result).not.toHaveProperty("draft");
    expect(result).not.toHaveProperty("recommendations");
  });
});

function createParsedScenario(appliedPickCount: number): ScenarioV1 {
  const scenario = createScenario(appliedPickCount);
  const parsed = parseScenarioV1Json(serializeScenarioV1(scenario));

  if (!parsed.ok) {
    throw new Error(`Expected valid scenario: ${JSON.stringify(parsed.errors)}`);
  }

  return parsed.scenario;
}

function createParsedScenarioV2(
  appliedPickCount: number,
  adpRanks: readonly (number | null)[],
): ScenarioV2 {
  const v1 = createScenario(appliedPickCount);
  const rankings = v1.rankingContext.rankings.map((ranking, index) => ({
    ...ranking,
    player: { ...ranking.player },
    adpRank: adpRanks[index] ?? null,
    tier: NEUTRAL_TIER,
  }));
  const scenario: ScenarioV2 = {
    ...v1,
    schemaVersion: SCENARIO_V2_SCHEMA_VERSION,
    rankingContext: {
      rankings,
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: rankings.map((ranking, index) => ({
            playerId: ranking.player.id,
            overallRank: ranking.overallRank,
            tier: index === 0 ? 1 : 2,
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
  const parsed = parseScenarioV2Json(serializeScenarioV2(scenario));

  if (!parsed.ok) {
    throw new Error(`Expected valid Scenario V2: ${JSON.stringify(parsed.errors)}`);
  }

  return parsed.scenario;
}

function createScenario(appliedPickCount: number): ScenarioV1 {
  const rankings = [
    createRanking("player-qb", 1, "QB"),
    createRanking("player-rb-1", 2, "RB"),
    createRanking("player-wr-1", 3, "WR"),
    createRanking("player-te", 4, "TE"),
    createRanking("player-rb-2", 5, "RB"),
    createRanking("player-wr-2", 6, "WR"),
  ];
  const setupInput: LeagueSetupInput = {
    teamCount: 3,
    userDraftPosition: 3,
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
    throw new Error("Expected valid replay fixture setup.");
  }

  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    metadata: {
      id: "replay-scenario",
      name: "Replay scenario",
      tags: ["replay", "non-default"],
      provenance: {
        sourceKind: "scenario",
        sourceId: "source-scenario",
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
      { playerId: "player-rb-1", expectedPickNumber: 2, expectedTeamId: "team-2" },
      { playerId: "player-wr-1", expectedPickNumber: 3, expectedTeamId: "team-3" },
      { playerId: "player-te", expectedPickNumber: 4, expectedTeamId: "team-3" },
      { playerId: "player-rb-2", expectedPickNumber: 5, expectedTeamId: "team-2" },
      { playerId: "player-wr-2", expectedPickNumber: 6, expectedTeamId: "team-1" },
    ],
    replayTarget: { appliedPickCount },
  };
}

function createBaseDraft(scenario: ScenarioV1): Draft {
  return hydrateDraftFromSettings({
    id: SCENARIO_REPLAY_DRAFT_ID,
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
  });
}

function manuallyReplayToTarget(scenario: ScenarioV1): Draft {
  return scenario.pickHistory
    .slice(0, scenario.replayTarget.appliedPickCount)
    .reduce((draft, pick) => {
      return draftPlayerInDraft(draft, pick.playerId);
    }, createBaseDraft(scenario));
}

function generateRecommendations(scenario: ScenarioDocument, draft: Draft) {
  const snapshot: RankingSnapshot =
    scenario.schemaVersion === SCENARIO_SCHEMA_VERSION
      ? {
          rankings: materializeScenarioV1Rankings(
            scenario.rankingContext.rankings,
          ),
        }
      : {
          rankings: scenario.rankingContext.rankings,
          tierSemantics: scenario.rankingContext.tierSemantics,
        };
  const contextResult = createRecommendationRankingContext(snapshot);

  if (!contextResult.ok) {
    throw new Error("Expected recommendation context normalization to succeed.");
  }

  return generatePlayerRecommendations({
    draft,
    rankings: [...snapshot.rankings],
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
    recommendationRankingContext: contextResult.context,
  });
}

function getFirstRecommendation(result: ReturnType<typeof replayScenario>) {
  if (!result.ok || !result.recommendations[0]) {
    throw new Error("Expected a replay recommendation.");
  }

  return result.recommendations[0];
}

function getFirstTimingEvidence(result: ReturnType<typeof replayScenario>) {
  const timing = getFirstRecommendation(result).components.find(
    ({ id }) => id === "draft_pocket_timing",
  );

  if (!timing?.evidence) {
    throw new Error("Expected draft-pocket timing evidence.");
  }

  return timing.evidence;
}

function getAvailablePlayerIds(draft: Draft, scenario: ScenarioV1): string[] {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return scenario.rankingContext.rankings
    .filter((ranking) => !draftedPlayerIds.has(ranking.player.id))
    .map((ranking) => ranking.player.id);
}

function getUserPickPlayerIds(draft: Draft): string[] {
  return draft.picks.flatMap((pick) => {
    if (pick.teamId !== draft.userTeamId || !pick.playerId) {
      return [];
    }

    return [pick.playerId];
  });
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
