import { describe, expect, it } from "vitest";
import { hydrateDraftFromSettings } from "@/lib/draftHydration";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { buildLeagueSetup, type LeagueSetupInput } from "@/lib/leagueSetup";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import {
  DEFAULT_EXPORTED_SCENARIO_ID,
  DEFAULT_EXPORTED_SCENARIO_NAME,
  exportWorkspaceToScenarioV1,
  importScenarioJson,
  importScenarioV1Json,
  importScenarioV2Json,
} from "@/lib/scenarioPortability";
import {
  serializeScenarioV1,
  serializeScenarioV2,
} from "@/lib/scenarioSerialization";
import { materializeScenarioV1Rankings } from "@/lib/scenarioValidation";
import type {
  Draft,
  DraftWorkspace,
  Position,
  RankingEntry,
} from "@/types/draft";
import { NEUTRAL_TIER, type RankingSnapshot } from "@/types/rankings";
import {
  SCENARIO_SCHEMA_VERSION,
  SCENARIO_V2_SCHEMA_VERSION,
  type ScenarioDocument,
  type ScenarioV2,
} from "@/types/scenario";

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

  it("imports Scenario V2 through both version-aware entry points", () => {
    const scenario = createPortableScenarioV2(0);
    const json = serializeScenarioV2(scenario);
    const versionAware = importScenarioJson(json);
    const v2Only = importScenarioV2Json(json);

    expect(versionAware).toEqual(v2Only);
    expect(v2Only.ok).toBe(true);
    if (!v2Only.ok) {
      throw new Error("Expected Scenario V2 import success.");
    }
    expect(v2Only.scenario).toEqual(scenario);
    expect(v2Only.recommendations).toEqual(
      generateRecommendationsForScenario(scenario, v2Only.draft),
    );
    expect(v2Only.recommendations[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "overall_tier", delta: 6 }),
        expect.objectContaining({
          id: "draft_pocket_timing",
          evidence: expect.objectContaining({ forecastStatus: "active" }),
        }),
      ]),
    );
  });

  it("keeps version-specific import APIs strict", () => {
    const v1Json = serializeScenarioV1(
      exportWorkspaceToScenarioV1(createManualWorkspace(0)),
    );
    const v2Json = serializeScenarioV2(createPortableScenarioV2(0));

    expect(importScenarioJson(v1Json).ok).toBe(true);
    expect(importScenarioV1Json(v2Json)).toMatchObject({
      ok: false,
      stage: "validation",
      errors: [
        { code: "unsupported-version", path: "schemaVersion" },
      ],
    });
    expect(importScenarioV2Json(v1Json)).toMatchObject({
      ok: false,
      stage: "validation",
      errors: [
        { code: "unsupported-version", path: "schemaVersion" },
      ],
    });
  });

  it("keeps V2 provenance out of imported draft and recommendations", () => {
    const firstScenario = createPortableScenarioV2(2);
    const secondScenario: ScenarioV2 = {
      ...structuredClone(firstScenario),
      metadata: {
        id: "renamed",
        name: "Renamed scenario",
        provenance: {
          sourceKind: "scenario",
          sourceId: "different-source",
          exportedAt: "2027-01-01T00:00:00.000Z",
        },
      },
    };
    const first = importScenarioJson(serializeScenarioV2(firstScenario));
    const second = importScenarioJson(serializeScenarioV2(secondScenario));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("Expected Scenario V2 imports to succeed.");
    }
    expect(first.draft).toEqual(second.draft);
    expect(first.recommendations).toEqual(second.recommendations);
  });

  it("imports Scenario V1 tiers as neutral without tier recommendation evidence", () => {
    const workspace = createManualWorkspace(0);
    workspace.rankings.find(({ player }) => player.id === "player-rb-2")!.tier = 4;
    const scenario = exportWorkspaceToScenarioV1(workspace);
    const imported = importScenarioV1Json(serializeScenarioV1(scenario));

    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      throw new Error("Expected legacy scenario import to succeed.");
    }
    expect(imported.scenario.rankingContext.rankings).toEqual(
      workspace.rankings.map((ranking) => ({
        ...ranking,
        tier: NEUTRAL_TIER,
      })),
    );
    for (const recommendation of imported.recommendations) {
      expect(recommendation.components.some(({ id }) => id === "tier_cliff")).toBe(
        false,
      );
      expect(
        recommendation.reasons.some(
          ({ sourceComponentId }) => sourceComponentId === "tier_cliff",
        ),
      ).toBe(false);
    }
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
    generateRecommendationsForScenario(imported.scenario, expectedDraft),
  );
  expect(
    isValidDraftState({
      draft: imported.draft,
      availableRankings: getAvailableRankings(imported.draft, workspace.rankings),
    }),
  ).toBe(true);
}

function createPortableScenarioV2(appliedPickCount: number): ScenarioV2 {
  const v1 = exportWorkspaceToScenarioV1(
    createManualWorkspace(appliedPickCount),
  );
  const rankings = v1.rankingContext.rankings.map((ranking, index) => ({
    ...ranking,
    player: { ...ranking.player },
    adpRank: index % 2 === 0 ? ranking.overallRank : null,
    tier: NEUTRAL_TIER,
  }));

  return {
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
}

function generateRecommendationsForScenario(
  scenario: ScenarioDocument,
  draft: Draft,
) {
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
