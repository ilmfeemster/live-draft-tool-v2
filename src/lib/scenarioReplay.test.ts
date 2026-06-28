import { describe, expect, it } from "vitest";
import { createDraftTeams } from "@/lib/draftOrder";
import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { buildLeagueSetup, type LeagueSetupInput } from "@/lib/leagueSetup";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import {
  replayScenarioV1,
  SCENARIO_REPLAY_DRAFT_ID,
} from "@/lib/scenarioReplay";
import { serializeScenarioV1 } from "@/lib/scenarioSerialization";
import { parseScenarioV1Json } from "@/lib/scenarioValidation";
import type { Draft, Position, RankingEntry } from "@/types/draft";
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioV1,
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

function generateRecommendations(scenario: ScenarioV1, draft: Draft) {
  return generatePlayerRecommendations({
    draft,
    rankings: scenario.rankingContext.rankings,
    leagueSettings: scenario.leagueSettings,
    userTeamId: scenario.userTeamContext.userTeamId,
  });
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
