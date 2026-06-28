import { describe, expect, it } from "vitest";
import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { buildLeagueSetup, type LeagueSetupInput } from "@/lib/leagueSetup";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import {
  DEFAULT_EXPORTED_SCENARIO_ID,
  DEFAULT_EXPORTED_SCENARIO_NAME,
  exportWorkspaceToScenarioV1,
  importScenarioV1Json,
} from "@/lib/scenarioPortability";
import { serializeScenarioV1 } from "@/lib/scenarioSerialization";
import type {
  Draft,
  DraftWorkspace,
  Position,
  RankingEntry,
} from "@/types/draft";

describe("scenario portability", () => {
  it("exports safe defaults and the active assigned-pick count", () => {
    const workspace = createManualWorkspace(3);
    const scenario = exportWorkspaceToScenarioV1(workspace);

    expect(scenario.schemaVersion).toBe(1);
    expect(scenario.metadata).toEqual({
      id: DEFAULT_EXPORTED_SCENARIO_ID,
      name: DEFAULT_EXPORTED_SCENARIO_NAME,
    });
    expect(scenario.replayTarget.appliedPickCount).toBe(3);
  });

  it("copies metadata overrides and optional provenance", () => {
    const scenario = exportWorkspaceToScenarioV1(createManualWorkspace(1), {
      scenarioId: "custom-scenario",
      name: "Custom scenario",
      provenance: {
        sourceKind: "persisted",
        sourceId: "draft-123",
        exportedAt: "2026-06-27T12:00:00.000Z",
      },
    });

    expect(scenario.metadata).toEqual({
      id: "custom-scenario",
      name: "Custom scenario",
      provenance: {
        sourceKind: "persisted",
        sourceId: "draft-123",
        exportedAt: "2026-06-27T12:00:00.000Z",
      },
    });
  });

  it("falls back from empty metadata overrides", () => {
    const scenario = exportWorkspaceToScenarioV1(createManualWorkspace(0), {
      scenarioId: "",
      name: "",
    });

    expect(scenario.metadata.id).toBe(DEFAULT_EXPORTED_SCENARIO_ID);
    expect(scenario.metadata.name).toBe(DEFAULT_EXPORTED_SCENARIO_NAME);
  });

  it("maps dynamic source inputs and ordered pick assertions", () => {
    const workspace = createManualWorkspace(4);
    const scenario = exportWorkspaceToScenarioV1(workspace);

    expect(scenario.leagueSettings).toEqual(workspace.leagueSettings);
    expect(scenario.draftConfiguration.teams).toEqual(workspace.draft.teams);
    expect(scenario.rankingContext.rankings).toEqual(workspace.rankings);
    expect(scenario.userTeamContext.userTeamId).toBe(workspace.draft.userTeamId);
    expect(scenario.pickHistory).toEqual([
      { playerId: "player-qb", expectedPickNumber: 1, expectedTeamId: "team-1" },
      { playerId: "player-rb-1", expectedPickNumber: 2, expectedTeamId: "team-2" },
      { playerId: "player-wr-1", expectedPickNumber: 3, expectedTeamId: "team-3" },
      { playerId: "player-te", expectedPickNumber: 4, expectedTeamId: "team-3" },
    ]);
  });

  it("sorts copied picks without mutating source order", () => {
    const workspace = createManualWorkspace(3);
    workspace.draft.picks.reverse();
    const before = structuredClone(workspace.draft.picks);

    const scenario = exportWorkspaceToScenarioV1(workspace);

    expect(scenario.pickHistory.map((pick) => pick.expectedPickNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(workspace.draft.picks).toEqual(before);
  });

  it("creates fresh nested data and omits derived state", () => {
    const workspace = createManualWorkspace(2);
    const before = structuredClone(workspace);
    const scenario = exportWorkspaceToScenarioV1(workspace);
    const serialized = JSON.parse(serializeScenarioV1(scenario)) as Record<
      string,
      unknown
    >;

    expect(workspace).toEqual(before);
    expect(scenario.leagueSettings).not.toBe(workspace.leagueSettings);
    expect(scenario.leagueSettings.rosterSlots).not.toBe(
      workspace.leagueSettings.rosterSlots,
    );
    expect(scenario.draftConfiguration.teams).not.toBe(workspace.draft.teams);
    expect(scenario.rankingContext.rankings).not.toBe(workspace.rankings);
    expect(scenario.rankingContext.rankings[0].player).not.toBe(
      workspace.rankings[0].player,
    );
    expect(serialized).not.toHaveProperty("draft");
    expect(serialized).not.toHaveProperty("currentPickNumber");
    expect(serialized).not.toHaveProperty("recommendations");
    expect(JSON.stringify(serialized)).not.toContain(workspace.draft.id);
  });

  it("preserves a valid target override without truncating history", () => {
    const scenario = exportWorkspaceToScenarioV1(createManualWorkspace(5), {
      appliedPickCount: 2,
    });

    expect(scenario.pickHistory).toHaveLength(5);
    expect(scenario.replayTarget.appliedPickCount).toBe(2);
  });

  it.each([-1, 1.5, 4])(
    "rejects invalid target override %s",
    (appliedPickCount) => {
      expect(() =>
        exportWorkspaceToScenarioV1(createManualWorkspace(3), {
          appliedPickCount,
        }),
      ).toThrow(RangeError);
    },
  );

  it("preserves validation-stage import failures", () => {
    const result = importScenarioV1Json("{bad-json");

    expect(result).toEqual({
      ok: false,
      stage: "validation",
      errors: [
        {
          code: "invalid-json",
          path: "$",
          message: "Scenario must contain valid JSON.",
        },
      ],
    });
  });

  it("round-trips a manual workspace with equivalent state and recommendations", () => {
    const workspace = createManualWorkspace(4);
    assertSemanticRoundTrip(workspace);
  });

  it("round-trips a hydrated persisted-style workspace without mutating it", () => {
    const source = createManualWorkspace(4);
    const workspace: DraftWorkspace = {
      draft: hydrateDraftFromSettings({
        id: "persisted-draft-42",
        leagueSettings: source.leagueSettings,
        userTeamId: source.draft.userTeamId,
        pickHistory: source.draft.picks.flatMap((pick) =>
          pick.playerId
            ? [{ pickNumber: pick.pickNumber, playerId: pick.playerId }]
            : [],
        ),
      }),
      rankings: structuredClone(source.rankings),
      leagueSettings: structuredClone(source.leagueSettings),
    };
    const before = structuredClone(workspace);

    assertSemanticRoundTrip(workspace, {
      provenance: {
        sourceKind: "persisted",
        sourceId: workspace.draft.id,
        exportedAt: "2026-06-27T12:00:00.000Z",
      },
    });
    expect(workspace).toEqual(before);
  });

  it("round-trips a transient replay workspace after a local pick", () => {
    const source = createManualWorkspace(4);
    const initialScenario = exportWorkspaceToScenarioV1(source, {
      appliedPickCount: 2,
    });
    const imported = importScenarioV1Json(serializeScenarioV1(initialScenario));

    if (!imported.ok) {
      throw new Error("Expected initial transient import to succeed.");
    }

    const transientWorkspace: DraftWorkspace = {
      draft: draftPlayerInDraft(imported.draft, "player-wr-1"),
      rankings: imported.scenario.rankingContext.rankings,
      leagueSettings: imported.scenario.leagueSettings,
    };

    assertSemanticRoundTrip(transientWorkspace, {
      provenance: {
        sourceKind: "scenario",
        sourceId: imported.scenario.metadata.id,
        exportedAt: "2026-06-27T13:00:00.000Z",
      },
    });
  });

  it("keeps provenance changes out of imported state and recommendations", () => {
    const workspace = createManualWorkspace(3);
    const withoutProvenance = exportWorkspaceToScenarioV1(workspace);
    const withProvenance = exportWorkspaceToScenarioV1(workspace, {
      provenance: {
        sourceKind: "manual",
        exportedAt: "2026-06-27T12:00:00.000Z",
      },
    });
    const first = importScenarioV1Json(serializeScenarioV1(withoutProvenance));
    const second = importScenarioV1Json(serializeScenarioV1(withProvenance));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("Expected both imports to succeed.");
    }
    expect(first.draft).toEqual(second.draft);
    expect(first.recommendations).toEqual(second.recommendations);
  });

  it("preserves semantic sections after re-export", () => {
    const firstScenario = exportWorkspaceToScenarioV1(createManualWorkspace(3));
    const imported = importScenarioV1Json(serializeScenarioV1(firstScenario));

    if (!imported.ok) {
      throw new Error("Expected import to succeed.");
    }

    const reExported = exportWorkspaceToScenarioV1({
      draft: imported.draft,
      rankings: imported.scenario.rankingContext.rankings,
      leagueSettings: imported.scenario.leagueSettings,
    });

    expect(reExported.leagueSettings).toEqual(firstScenario.leagueSettings);
    expect(reExported.draftConfiguration).toEqual(
      firstScenario.draftConfiguration,
    );
    expect(reExported.rankingContext).toEqual(firstScenario.rankingContext);
    expect(reExported.userTeamContext).toEqual(firstScenario.userTeamContext);
    expect(reExported.pickHistory).toEqual(firstScenario.pickHistory);
    expect(reExported.replayTarget).toEqual(firstScenario.replayTarget);
  });
});

function assertSemanticRoundTrip(
  workspace: DraftWorkspace,
  options: Parameters<typeof exportWorkspaceToScenarioV1>[1] = {},
): void {
  const scenario = exportWorkspaceToScenarioV1(workspace, options);
  const imported = importScenarioV1Json(serializeScenarioV1(scenario));

  expect(imported.ok).toBe(true);
  if (!imported.ok) {
    throw new Error("Expected semantic round trip to succeed.");
  }

  const expectedDraft = replayWorkspaceToTarget(workspace, scenario.replayTarget.appliedPickCount);
  expect(withoutDraftId(imported.draft)).toEqual(withoutDraftId(expectedDraft));
  expect(imported.scenario.leagueSettings).toEqual(workspace.leagueSettings);
  expect(imported.scenario.rankingContext.rankings).toEqual(workspace.rankings);
  expect(imported.recommendations).toEqual(
    generatePlayerRecommendations({
      draft: expectedDraft,
      rankings: workspace.rankings,
      leagueSettings: workspace.leagueSettings,
      userTeamId: workspace.draft.userTeamId,
    }),
  );
  expect(
    isValidDraftState({
      draft: imported.draft,
      availableRankings: getAvailableRankings(imported.draft, workspace.rankings),
    }),
  ).toBe(true);
}

function createManualWorkspace(appliedPickCount: number): DraftWorkspace {
  const rankings = createRankings();
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
    throw new Error("Expected valid portability fixture setup.");
  }

  const draft = rankings
    .slice(0, appliedPickCount)
    .reduce((currentDraft, ranking) => {
      return draftPlayerInDraft(currentDraft, ranking.player.id);
    },
    hydrateDraftFromSettings({
      id: "manual-draft",
      leagueSettings: setup.leagueSettings,
      userTeamId: setup.userTeamId,
    }));

  return {
    draft,
    rankings,
    leagueSettings: setup.leagueSettings,
  };
}

function replayWorkspaceToTarget(
  workspace: DraftWorkspace,
  appliedPickCount: number,
): Draft {
  const playerIds = [...workspace.draft.picks]
    .sort((left, right) => left.pickNumber - right.pickNumber)
    .flatMap((pick) => (pick.playerId ? [pick.playerId] : []))
    .slice(0, appliedPickCount);

  return playerIds.reduce((draft, playerId) => {
    return draftPlayerInDraft(draft, playerId);
  },
  hydrateDraftFromSettings({
    id: workspace.draft.id,
    leagueSettings: workspace.leagueSettings,
    userTeamId: workspace.draft.userTeamId,
  }));
}

function withoutDraftId(draft: Draft): Omit<Draft, "id"> {
  return {
    teamCount: draft.teamCount,
    rounds: draft.rounds,
    userTeamId: draft.userTeamId,
    currentPickNumber: draft.currentPickNumber,
    teams: draft.teams,
    picks: draft.picks,
  };
}

function getAvailableRankings(
  draft: Draft,
  rankings: RankingEntry[],
): RankingEntry[] {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return rankings.filter((ranking) => !draftedPlayerIds.has(ranking.player.id));
}

function createRankings(): RankingEntry[] {
  return [
    createRanking("player-qb", 1, "QB"),
    createRanking("player-rb-1", 2, "RB"),
    createRanking("player-wr-1", 3, "WR"),
    createRanking("player-te", 4, "TE"),
    createRanking("player-rb-2", 5, "RB"),
    createRanking("player-wr-2", 6, "WR"),
  ];
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
