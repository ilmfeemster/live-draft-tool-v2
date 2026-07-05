import { describe, expect, it, vi } from "vitest";
import { curatedScenarioCatalog } from "@/lib/curatedScenarios";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import {
  exportWorkspaceToScenarioV2,
  importScenarioJson,
} from "@/lib/scenarioPortability";
import { serializeScenarioV2 } from "@/lib/scenarioSerialization";
import {
  createTransientScenarioSession,
  draftPlayerInTransientSession,
  requiresTransientSessionConfirmation,
  resetTransientScenarioSession,
  restartTransientSession,
  TRANSIENT_MANUAL_DRAFT_ID,
  type TransientScenarioSession,
  undoLastPickInTransientSession,
} from "@/lib/scenarioSession";
import { NEUTRAL_TIER } from "@/types/rankings";
import {
  SCENARIO_V2_SCHEMA_VERSION,
  type ScenarioV1,
  type ScenarioV2,
} from "@/types/scenario";

describe("transient scenario sessions", () => {
  it("creates a clean scenario session at the declared target", () => {
    const session = createEarlyScenarioSession();

    expect(session.kind).toBe("scenario");
    expect(session.sourceJson).toBe(getEarlyScenarioJson());
    expect(session.scenario.metadata.id).toBe("early-non-default-pressure");
    expect(session.scenario.replayTarget.appliedPickCount).toBe(8);
    expect(session.draft.currentPickNumber).toBe(9);
    expect(session.baselineDraft).toBe(session.draft);
    expect(session.isDirty).toBe(false);
    expect(session.rankingTierSemantics).toEqual({
      source: { kind: "none" },
      recommendation: {
        QB: "neutral",
        RB: "neutral",
        WR: "neutral",
        TE: "neutral",
        DST: "neutral",
        K: "neutral",
      },
    });
    expect(session.recommendationRankingContextResult.ok).toBe(true);
    if (!session.recommendationRankingContextResult.ok) {
      throw new Error("Expected transient recommendation context to succeed.");
    }
    expect(
      session.recommendationRankingContextResult.context.rankings.map(
        (ranking) => ({
          playerId: ranking.player.id,
          adpRank: ranking.adpRank,
          overallTier: ranking.overallTier,
          origin: ranking.overallTierOrigin,
        }),
      ),
    ).toEqual(
      session.rankings.map((ranking) => ({
        playerId: ranking.player.id,
        adpRank: ranking.adpRank,
        overallTier: 1,
        origin: "defaulted-neutral",
      })),
    );
    expect(session.recommendations).toEqual(
      generateRecommendationsForSession(session),
    );
    expect(session.recommendationRankingContextResult).toEqual(
      createRecommendationRankingContext({
        rankings: session.rankings,
        tierSemantics: session.rankingTierSemantics,
      }),
    );
  });

  it("preserves staged import failures without creating a session", () => {
    const result = createTransientScenarioSession("{bad-json");

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
    expect(result).not.toHaveProperty("session");
  });

  it("uses the canonical local pick transition and recomputes recommendations", () => {
    const session = createEarlyScenarioSession();
    const expectedDraft = draftPlayerInDraft(session.draft, "target-rb");

    const nextSession = draftPlayerInTransientSession(session, "target-rb");

    expect(nextSession.kind).toBe("scenario");
    expect(nextSession.draft).toEqual(expectedDraft);
    expect(nextSession.recommendations).toEqual(
      generateRecommendationsForSession(nextSession),
    );
    expect(nextSession.recommendationRankingContextResult).toBe(
      session.recommendationRankingContextResult,
    );
    expect(nextSession.rankingTierSemantics).toBe(
      session.rankingTierSemantics,
    );
    expect(nextSession.isDirty).toBe(true);
  });

  it.each([
    ["complete", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], "active"],
    ["partial", [1, null, 3, null, 5, null, 7, null, 9, null, 11, null, 13, null, 15, null], "active"],
    ["absent", Array(16).fill(null), "no-adp"],
  ] as const)("loads Scenario V2 with %s ADP and exact tier semantics", (
    _label,
    adpRanks,
    forecastStatus,
  ) => {
    const session = createEarlyScenarioV2Session(adpRanks);

    expect(session.scenario.schemaVersion).toBe(SCENARIO_V2_SCHEMA_VERSION);
    if (session.scenario.schemaVersion !== SCENARIO_V2_SCHEMA_VERSION) {
      throw new Error("Expected Scenario V2 session.");
    }
    expect(session.rankingTierSemantics).toEqual(
      session.scenario.rankingContext.tierSemantics,
    );
    expect(session.rankingTierSemantics).not.toBe(
      session.scenario.rankingContext.tierSemantics,
    );
    expect(session.recommendationRankingContextResult.ok).toBe(true);
    if (!session.recommendationRankingContextResult.ok) {
      throw new Error("Expected Scenario V2 recommendation context.");
    }
    expect(
      session.recommendationRankingContextResult.context.rankings.find(
        ({ player }) => player.id === "target-rb",
      ),
    ).toMatchObject({ overallTier: 1, overallTierOrigin: "source" });
    expect(getTimingEvidence(session)).toMatchObject({
      forecastStatus,
      profileOverallTierOrigin: "source",
      allocationRole: forecastStatus === "active" ? expect.any(String) : "neutral",
      profileAnchorPlayerId:
        forecastStatus === "active" ? expect.any(String) : null,
      profileOrdinal: forecastStatus === "active" ? expect.any(Number) : null,
    });
    expect(session.recommendations).toEqual(
      generateRecommendationsForSession(session),
    );
    expect(session.recommendations[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "overall_tier", delta: 6 }),
      ]),
    );
  });

  it("resets Scenario V2 from source and preserves its version and semantics", () => {
    const original = createEarlyScenarioV2Session(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    const explored = draftPlayerInTransientSession(original, "target-rb");
    const corrupted: TransientScenarioSession = {
      ...explored,
      rankingTierSemantics: {
        source: { kind: "none" as const },
        recommendation: {},
      },
    };
    const reset = resetTransientScenarioSession(corrupted);

    expect(reset.ok).toBe(true);
    if (!reset.ok) {
      throw new Error("Expected Scenario V2 reset success.");
    }
    expect(reset.session.scenario.schemaVersion).toBe(
      SCENARIO_V2_SCHEMA_VERSION,
    );
    expect(reset.session.rankingTierSemantics).toEqual(
      original.rankingTierSemantics,
    );
    expect(reset.session.rankingTierSemantics).not.toBe(
      original.rankingTierSemantics,
    );
    expect(reset.session.recommendations).toEqual(original.recommendations);
  });

  it.each([
    ["V1 scenario", () => createEarlyScenarioSession()],
    [
      "V2 scenario",
      () => createEarlyScenarioV2Session(
        Array.from({ length: 16 }, (_, index) => index + 1),
      ),
    ],
    ["restarted manual", () => restartTransientSession(createEarlyScenarioSession())],
  ] as const)("exports and re-imports %s state as Scenario V2", (_label, createSession) => {
    const session = createSession();
    const scenario = exportWorkspaceToScenarioV2({
      draft: session.draft,
      rankings: session.rankings,
      leagueSettings: session.leagueSettings,
      rankingTierSemantics: session.rankingTierSemantics,
    });
    const imported = importScenarioJson(serializeScenarioV2(scenario));

    expect(scenario.schemaVersion).toBe(SCENARIO_V2_SCHEMA_VERSION);
    expect(scenario.rankingContext.tierSemantics).toEqual(
      session.rankingTierSemantics,
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      throw new Error("Expected exported Scenario V2 to re-import.");
    }
    expect(imported.scenario.schemaVersion).toBe(SCENARIO_V2_SCHEMA_VERSION);
    expect(imported.draft).toEqual({
      ...session.draft,
      id: imported.draft.id,
    });
    expect(imported.recommendations).toEqual(session.recommendations);
    const serialized = serializeScenarioV2(scenario);
    expect(serialized).not.toContain("draft_pocket_timing");
    expect(serialized).not.toContain("profileAnchorPlayerId");
    expect(serialized).not.toContain("allocationRole");
  });

  it("refreshes active forecast evidence between turns, on turn, and at the final user pick", () => {
    const initial = createEarlyScenarioSessionWithAdp();

    expect(getTimingEvidence(initial)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 12,
      profileOverallTierOrigin: "defaulted-neutral",
      profileAnchorPlayerId: expect.any(String),
      profileOrdinal: expect.any(Number),
      allocationRole: expect.any(String),
    });

    const afterOpponentPick = draftPlayerInTransientSession(
      initial,
      "target-rb",
    );

    expect(
      afterOpponentPick.recommendations.some(
        (recommendation) => recommendation.playerId === "target-rb",
      ),
    ).toBe(false);
    expect(getTimingEvidence(afterOpponentPick)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 12,
      profileOverallTierOrigin: "defaulted-neutral",
      profileAnchorPlayerId: expect.any(String),
    });

    const onUserTurn = ["available-wr", "available-qb"].reduce(
      (session, playerId) => draftPlayerInTransientSession(session, playerId),
      afterOpponentPick,
    );

    expect(onUserTurn.draft.currentPickNumber).toBe(12);
    expect(getTimingEvidence(onUserTurn)).toMatchObject({
      forecastStatus: "active",
      targetPickNumber: 13,
      profileOverallTierOrigin: "defaulted-neutral",
      profileAnchorPlayerId: expect.any(String),
    });

    const finalUserPick = [
      "available-te",
      "available-dst",
      "available-k",
      "next-tier-rb",
    ].reduce(
      (session, playerId) => draftPlayerInTransientSession(session, playerId),
      onUserTurn,
    );

    expect(finalUserPick.draft.currentPickNumber).toBe(16);
    expect(finalUserPick.recommendations).toHaveLength(1);
    expect(getTimingEvidence(finalUserPick)).toMatchObject({
      forecastStatus: "no-next-pick",
      targetPickNumber: null,
      thresholdMatched: "inactive_forecast",
    });
  });

  it("recomputes context-aware recommendations when the replay target changes", () => {
    const targetEight = createEarlyScenarioSessionWithAdp();
    const targetSevenResult = createTransientScenarioSession(
      createEarlyScenarioJsonWithAdp(7),
    );

    expect(targetSevenResult.ok).toBe(true);
    if (!targetSevenResult.ok) {
      throw new Error("Expected the earlier replay target to load.");
    }

    expect(targetSevenResult.session.draft.currentPickNumber).toBe(8);
    expect(targetEight.draft.currentPickNumber).toBe(9);
    expect(
      targetSevenResult.session.recommendations.some(
        (recommendation) => recommendation.playerId === "run-rb-3",
      ),
    ).toBe(true);
    expect(
      targetEight.recommendations.some(
        (recommendation) => recommendation.playerId === "run-rb-3",
      ),
    ).toBe(false);
    expect(targetSevenResult.session.recommendations).toEqual(
      generateRecommendationsForSession(targetSevenResult.session),
    );
    expect(targetEight.recommendations).toEqual(
      generateRecommendationsForSession(targetEight),
    );
  });

  it("returns the original session for a rejected local pick", () => {
    const session = createEarlyScenarioSession();

    expect(draftPlayerInTransientSession(session, "user-qb")).toBe(session);
  });

  it("adds and undoes exploration back to a clean baseline", () => {
    const session = createEarlyScenarioSession();
    const afterPick = draftPlayerInTransientSession(session, "target-rb");
    const expectedDraft = undoLastDraftPick(afterPick.draft);

    const afterUndo = undoLastPickInTransientSession(afterPick);

    expect(afterUndo.draft).toEqual(expectedDraft);
    expect(afterUndo.draft).toEqual(session.baselineDraft);
    expect(afterUndo.recommendations).toEqual(session.recommendations);
    expect(afterUndo.recommendationRankingContextResult).toBe(
      session.recommendationRankingContextResult,
    );
    expect(afterUndo.rankingTierSemantics).toBe(
      session.rankingTierSemantics,
    );
    expect(afterUndo.isDirty).toBe(false);
  });

  it("marks an undone baseline dirty and clears after reapplying the player", () => {
    const session = createEarlyScenarioSession();
    const afterUndo = undoLastPickInTransientSession(session);

    expect(afterUndo.draft.currentPickNumber).toBe(8);
    expect(afterUndo.isDirty).toBe(true);

    const restored = draftPlayerInTransientSession(afterUndo, "run-rb-3");

    expect(restored.draft).toEqual(session.baselineDraft);
    expect(restored.recommendations).toEqual(session.recommendations);
    expect(restored.isDirty).toBe(false);
  });

  it("returns the original session when undo cannot change the draft", () => {
    const restarted = restartTransientSession(createEarlyScenarioSession());

    expect(undoLastPickInTransientSession(restarted)).toBe(restarted);
  });

  it("resets by reparsing source JSON instead of trusting cached baseline", () => {
    const original = createEarlyScenarioSession();
    const explored = draftPlayerInTransientSession(original, "target-rb");
    const corrupted: TransientScenarioSession = {
      ...explored,
      baselineDraft: {
        ...explored.baselineDraft,
        currentPickNumber: 1,
        picks: explored.baselineDraft.picks.map((pick) => ({
          ...pick,
          playerId: undefined,
        })),
      },
      recommendationRankingContextResult: {
        ok: false,
        errors: [
          {
            code: "partial-overall-tiers",
            path: "tierSemantics.source.values",
            message: "Corrupted cached result.",
          },
        ],
      },
      rankingTierSemantics: {
        source: {
          kind: "source-overall",
          values: [
            { playerId: "corrupted", overallRank: 1, tier: 1 },
          ],
        },
        recommendation: {},
      },
    };

    const result = resetTransientScenarioSession(corrupted);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected scenario reset to succeed.");
    }
    expect(result.session).toEqual(original);
    expect(result.session).not.toBe(original);
    expect(result.session.draft).not.toBe(original.draft);
    expect(result.session.recommendationRankingContextResult).toEqual(
      original.recommendationRankingContextResult,
    );
    expect(result.session.recommendationRankingContextResult).not.toBe(
      corrupted.recommendationRankingContextResult,
    );
    expect(result.session.rankingTierSemantics).toEqual(
      original.rankingTierSemantics,
    );
    expect(result.session.rankingTierSemantics).not.toBe(
      corrupted.rankingTierSemantics,
    );
    expect(result.session.rankingTierSemantics).not.toBe(
      original.rankingTierSemantics,
    );
    expect(result.session.isDirty).toBe(false);
  });

  it("returns reset validation failure without a replacement session", () => {
    const session: TransientScenarioSession = {
      ...createEarlyScenarioSession(),
      sourceJson: "{bad-json",
    };

    const result = resetTransientScenarioSession(session);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ stage: "validation" });
    expect(result).not.toHaveProperty("session");
  });

  it("restarts as a clean zero-pick transient manual session", () => {
    const scenarioSession = draftPlayerInTransientSession(
      createEarlyScenarioSession(),
      "target-rb",
    );

    const restarted = restartTransientSession(scenarioSession);

    expect(restarted.kind).toBe("manual");
    expect(restarted.draft.id).toBe(TRANSIENT_MANUAL_DRAFT_ID);
    expect(restarted.draft.userTeamId).toBe(scenarioSession.draft.userTeamId);
    expect(restarted.draft.picks.every((pick) => !pick.playerId)).toBe(true);
    expect(restarted.draft.currentPickNumber).toBe(1);
    expect(restarted.leagueSettings).toBe(scenarioSession.leagueSettings);
    expect(restarted.rankings).toBe(scenarioSession.rankings);
    expect(restarted.recommendationRankingContextResult).toBe(
      scenarioSession.recommendationRankingContextResult,
    );
    expect(restarted.rankingTierSemantics).toBe(
      scenarioSession.rankingTierSemantics,
    );
    expect(restarted.baselineDraft).toBe(restarted.draft);
    expect(restarted.recommendations).toEqual(
      generateRecommendationsForSession(restarted),
    );
    expect(restarted.isDirty).toBe(false);
    expect(restarted).not.toHaveProperty("sourceJson");
    expect(restarted).not.toHaveProperty("scenario");
  });

  it("restarts an explored manual session and restores its zero baseline", () => {
    const restarted = restartTransientSession(createEarlyScenarioSession());
    const explored = draftPlayerInTransientSession(restarted, "opening-wr-1");

    expect(explored.isDirty).toBe(true);

    const cleanRestart = restartTransientSession(explored);

    expect(cleanRestart.kind).toBe("manual");
    expect(cleanRestart.draft.picks.every((pick) => !pick.playerId)).toBe(true);
    expect(cleanRestart.isDirty).toBe(false);
  });

  it("clears restarted-manual dirtiness after undo", () => {
    const restarted = restartTransientSession(createEarlyScenarioSession());
    const explored = draftPlayerInTransientSession(restarted, "opening-wr-1");
    const restored = undoLastPickInTransientSession(explored);

    expect(explored.isDirty).toBe(true);
    expect(restored.draft).toEqual(restarted.baselineDraft);
    expect(restored.isDirty).toBe(false);
  });

  it("requires confirmation only for dirty destructive actions", () => {
    const cleanScenario = createEarlyScenarioSession();
    const dirtyScenario = draftPlayerInTransientSession(
      cleanScenario,
      "target-rb",
    );
    const cleanManual = restartTransientSession(cleanScenario);
    const dirtyManual = draftPlayerInTransientSession(
      cleanManual,
      "opening-wr-1",
    );

    for (const action of ["reset", "restart", "replace"] as const) {
      expect(requiresTransientSessionConfirmation(cleanScenario, action)).toBe(
        false,
      );
      expect(requiresTransientSessionConfirmation(dirtyScenario, action)).toBe(
        true,
      );
    }

    expect(requiresTransientSessionConfirmation(cleanManual, "restart")).toBe(
      false,
    );
    expect(requiresTransientSessionConfirmation(cleanManual, "replace")).toBe(
      false,
    );
    expect(requiresTransientSessionConfirmation(dirtyManual, "restart")).toBe(
      true,
    );
    expect(requiresTransientSessionConfirmation(dirtyManual, "replace")).toBe(
      true,
    );
    expect(requiresTransientSessionConfirmation(dirtyManual, "reset")).toBe(
      false,
    );
  });

  it("does not invoke persistence collaborators during transient operations", () => {
    const repositoryPick = vi.fn();
    const repositoryUndo = vi.fn();
    const repositoryReset = vi.fn();
    const session = createEarlyScenarioSession();
    const picked = draftPlayerInTransientSession(session, "target-rb");
    const undone = undoLastPickInTransientSession(picked);
    const reset = resetTransientScenarioSession(undone as TransientScenarioSession);
    restartTransientSession(undone);

    expect(reset.ok).toBe(true);
    expect(repositoryPick).not.toHaveBeenCalled();
    expect(repositoryUndo).not.toHaveBeenCalled();
    expect(repositoryReset).not.toHaveBeenCalled();
  });

  it("keeps legacy tiers neutral through local actions, reset, and restart", () => {
    const initial = createEarlyScenarioSession();
    const picked = draftPlayerInTransientSession(initial, "target-rb");
    const undone = undoLastPickInTransientSession(picked);
    const reset = resetTransientScenarioSession(picked);
    const restarted = restartTransientSession(initial);

    expect(reset.ok).toBe(true);
    if (!reset.ok) {
      throw new Error("Expected scenario reset to succeed.");
    }
    for (const session of [initial, picked, undone, reset.session, restarted]) {
      expect(session.rankingTierSemantics).toEqual(
        initial.rankingTierSemantics,
      );
      expect(session.recommendationRankingContextResult.ok).toBe(true);
      if (!session.recommendationRankingContextResult.ok) {
        throw new Error("Expected transient recommendation context to succeed.");
      }
      expect(
        session.recommendationRankingContextResult.context.rankings.every(
          (ranking) =>
            ranking.overallTier === 1 &&
            ranking.overallTierOrigin === "defaulted-neutral",
        ),
      ).toBe(true);
      expect(session.rankings.every(({ tier }) => tier === NEUTRAL_TIER)).toBe(
        true,
      );
      for (const recommendation of session.recommendations) {
        expect(
          recommendation.components.some(({ id }) => id === "tier_cliff"),
        ).toBe(false);
        expect(
          recommendation.reasons.some(
            ({ sourceComponentId }) => sourceComponentId === "tier_cliff",
          ),
        ).toBe(false);
        expect(
          recommendation.reasons.some(
            ({ id }) =>
              id ===
              "draft_pocket_timing:highest_meaningful_tier_disappeared",
          ),
        ).toBe(false);
        const timing = recommendation.components.find(
          ({ id }) => id === "draft_pocket_timing",
        );
        if (timing?.evidence) {
          expect(timing.evidence.profileOverallTierOrigin).toBe(
            "defaulted-neutral",
          );
        }
      }
    }
  });
});

function getEarlyScenarioJson(): string {
  const entry = curatedScenarioCatalog.find((candidate) => {
    return candidate.id === "early-non-default-pressure";
  });

  if (!entry) {
    throw new Error("Expected early curated scenario.");
  }

  return entry.json;
}

function createEarlyScenarioSession(): TransientScenarioSession {
  const result = createTransientScenarioSession(getEarlyScenarioJson());

  if (!result.ok) {
    throw new Error(`Expected scenario session: ${JSON.stringify(result)}`);
  }

  return result.session;
}

function createEarlyScenarioSessionWithAdp(): TransientScenarioSession {
  const result = createTransientScenarioSession(createEarlyScenarioJsonWithAdp(8));

  if (!result.ok) {
    throw new Error(`Expected ADP scenario session: ${JSON.stringify(result)}`);
  }

  return result.session;
}

function createEarlyScenarioV2Session(
  adpRanks: readonly (number | null)[],
): TransientScenarioSession {
  const result = createTransientScenarioSession(
    createEarlyScenarioV2Json(adpRanks),
  );

  if (!result.ok) {
    throw new Error(`Expected Scenario V2 session: ${JSON.stringify(result)}`);
  }

  return result.session;
}

function createEarlyScenarioV2Json(
  adpRanks: readonly (number | null)[],
): string {
  const scenarioV1 = JSON.parse(getEarlyScenarioJson()) as ScenarioV1;
  const rankings = scenarioV1.rankingContext.rankings.map((ranking, index) => ({
    ...ranking,
    player: { ...ranking.player },
    adpRank: adpRanks[index] ?? null,
    tier: NEUTRAL_TIER,
  }));
  const scenarioV2: ScenarioV2 = {
    ...scenarioV1,
    schemaVersion: SCENARIO_V2_SCHEMA_VERSION,
    rankingContext: {
      rankings,
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: rankings.map((ranking, index) => ({
            playerId: ranking.player.id,
            overallRank: ranking.overallRank,
            tier: index < 9 ? 1 : 2,
          })),
        },
        recommendation: {
          QB: "neutral",
          RB: "neutral",
          WR: "neutral",
          TE: "neutral",
          DST: "neutral",
          K: "neutral",
        },
      },
    },
  };

  return serializeScenarioV2(scenarioV2);
}

function createEarlyScenarioJsonWithAdp(appliedPickCount: number): string {
  const scenario = JSON.parse(getEarlyScenarioJson()) as ScenarioV1;

  return JSON.stringify({
    ...scenario,
    rankingContext: {
      rankings: scenario.rankingContext.rankings.map((ranking) => ({
        ...ranking,
        adpRank: ranking.overallRank,
      })),
    },
    replayTarget: { appliedPickCount },
  });
}

function getTimingEvidence(session: TransientScenarioSession) {
  const component = session.recommendations[0]?.components.find(
    (candidate) => candidate.id === "draft_pocket_timing",
  );

  if (!component?.evidence) {
    throw new Error("Expected draft-pocket timing evidence.");
  }

  return component.evidence;
}

function generateRecommendationsForSession(
  session: Pick<
    TransientScenarioSession,
    | "draft"
    | "rankings"
    | "leagueSettings"
    | "recommendationRankingContextResult"
  >,
) {
  return generatePlayerRecommendations({
    draft: session.draft,
    rankings: session.rankings,
    leagueSettings: session.leagueSettings,
    userTeamId: session.draft.userTeamId,
    ...(session.recommendationRankingContextResult.ok
      ? {
          recommendationRankingContext:
            session.recommendationRankingContextResult.context,
        }
      : {}),
  });
}
