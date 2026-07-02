import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import {
  mapDraftRecordToWorkspace,
  type PersistedDraftWorkspaceRecord,
} from "@/lib/draftRepositoryMapping";
import { isValidDraftState } from "@/lib/draftInvariants";
import { serializeLeagueSettingsSnapshot } from "@/lib/leagueSettingsSnapshot";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";
import type { LeagueSettings, Position, RankingEntry } from "@/types/draft";
import { NEUTRAL_TIER } from "@/types/rankings";

describe("mapDraftRecordToWorkspace", () => {
  it("maps an MVP-shaped persisted record to a valid draft workspace", () => {
    const record = createDraftRecord({
      leagueSettings: defaultLeagueSettings,
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
    });

    const workspace = mapDraftRecordToWorkspace(record);

    expect(workspace.leagueSettings).toEqual(defaultLeagueSettings);
    expect(workspace.rankings.map((ranking) => ranking.player.id)).toEqual([
      "player-1",
      "player-2",
    ]);
    expect(workspace.draft).toMatchObject({
      id: "draft-1",
      teamCount: 12,
      rounds: 16,
      userTeamId: "team-2",
      currentPickNumber: 1,
    });
    expect(workspace.draft.picks).toHaveLength(192);
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("overlays persisted pick history and derives the current pick", () => {
    const record = createDraftRecord({
      leagueSettings: defaultLeagueSettings,
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
        createRanking("player-3", 3, "QB"),
      ],
      picks: [
        { pickNumber: 2, playerId: "player-2" },
        { pickNumber: 1, playerId: "player-1" },
      ],
    });

    const workspace = mapDraftRecordToWorkspace(record);

    expect(workspace.draft.currentPickNumber).toBe(3);
    expect(workspace.draft.picks[0]).toMatchObject({
      pickNumber: 1,
      round: 1,
      pickInRound: 1,
      teamId: "team-1",
      playerId: "player-1",
    });
    expect(workspace.draft.picks[1]).toMatchObject({
      pickNumber: 2,
      round: 1,
      pickInRound: 2,
      teamId: "team-2",
      playerId: "player-2",
    });
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("maps a non-default league configuration without assuming MVP league size", () => {
    const leagueSettings = createLeagueSettings({ teamCount: 4, rounds: 3 });
    const record = createDraftRecord({
      leagueSettings,
      userTeamId: "team-3",
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
        createRanking("player-3", 3, "QB"),
      ],
      picks: [
        { pickNumber: 1, playerId: "player-1" },
        { pickNumber: 2, playerId: "player-2" },
      ],
    });

    const workspace = mapDraftRecordToWorkspace(record);
    const activePick = workspace.draft.picks.find((pick) => {
      return pick.pickNumber === workspace.draft.currentPickNumber;
    });

    expect(workspace.draft.teamCount).toBe(4);
    expect(workspace.draft.rounds).toBe(3);
    expect(workspace.draft.teams).toHaveLength(4);
    expect(workspace.draft.picks).toHaveLength(12);
    expect(workspace.draft.currentPickNumber).toBe(3);
    expect(activePick).toEqual({
      pickNumber: 3,
      round: 1,
      pickInRound: 3,
      teamId: "team-3",
    });
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("exposes persisted ranking snapshots with neutral tiers", () => {
    const rankings = [
      createRanking("player-1", 1, "DST", {
        adpRank: null,
        positionRank: 1,
        tier: 4,
        name: "Defense One",
        team: "ONE",
      }),
    ];
    const record = createDraftRecord({ rankings });

    const workspace = mapDraftRecordToWorkspace(record);

    expect(workspace.rankings).toEqual([
      {
        ...rankings[0],
        player: { ...rankings[0].player },
        tier: NEUTRAL_TIER,
      },
    ]);
  });

  it("preserves explicitly eligible tiers from a V2 snapshot envelope", () => {
    const rankings = [
      createRanking("player-1", 1, "QB", {
        positionRank: 1,
        tier: 1,
      }),
      createRanking("player-2", 2, "QB", {
        positionRank: 2,
        tier: 3,
      }),
    ];
    const record = createDraftRecord({
      rankings: serializeRankingSnapshot({
        rankings,
        capabilities: {
          team: "complete",
          playerIdentity: "provided",
          overallOrder: "explicit",
          positionRank: "derived",
          adp: "none",
          tiers: { QB: "source" },
        },
        tierSemantics: {
          source: { kind: "none" },
          recommendation: { QB: "recommendation-position" },
        },
        sourceRankingSetId: "rankings-1",
        sourceRankingSetName: "Rankings One",
        capturedAt: new Date("2026-07-01T12:00:00.000Z"),
      }),
    });

    const workspace = mapDraftRecordToWorkspace(record);

    expect(workspace.rankings.map((entry) => entry.tier)).toEqual([1, 3]);
  });

  it("preserves complete source-overall context from a V2 snapshot envelope", () => {
    const rankings = [
      createRanking("player-1", 1, "WR", { adpRank: 1.5 }),
      createRanking("player-2", 2, "RB", { adpRank: null }),
      createRanking("player-3", 3, "QB", { adpRank: 4.5 }),
    ];
    const serializedSnapshot = createV2Snapshot(rankings, [1, 1, 3]);
    const record = createDraftRecord({ rankings: serializedSnapshot });
    const before = structuredClone(record.rankingSnapshot.rankings);

    const workspace = mapDraftRecordToWorkspace(record);
    const contextResult = workspace.recommendationRankingContextResult;

    expect(contextResult?.ok).toBe(true);
    if (!contextResult?.ok) {
      throw new Error("Expected mapped recommendation context to succeed.");
    }
    expect(
      contextResult.context.rankings.map((ranking) => ({
        playerId: ranking.player.id,
        adpRank: ranking.adpRank,
        overallTier: ranking.overallTier,
        origin: ranking.overallTierOrigin,
      })),
    ).toEqual([
      { playerId: "player-1", adpRank: 1.5, overallTier: 1, origin: "source" },
      { playerId: "player-2", adpRank: null, overallTier: 1, origin: "source" },
      { playerId: "player-3", adpRank: 4.5, overallTier: 3, origin: "source" },
    ]);
    expect(record.rankingSnapshot.rankings).toEqual(before);
  });

  it.each(["none", "legacy-ambiguous"] as const)(
    "maps explicit %s source semantics to neutral overall tiers",
    (sourceKind) => {
      const rankings = [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ];
      const record = createDraftRecord({
        rankings: serializeRankingSnapshot({
          rankings,
          tierSemantics: {
            source: { kind: sourceKind },
            recommendation: createNeutralRecommendationSemantics(rankings),
          },
          capturedAt: new Date("2026-07-02T12:00:00.000Z"),
        }),
      });

      const workspace = mapDraftRecordToWorkspace(record);
      const contextResult = workspace.recommendationRankingContextResult;

      expect(contextResult?.ok).toBe(true);
      if (!contextResult?.ok) {
        throw new Error("Expected mapped recommendation context to succeed.");
      }
      expect(
        contextResult.context.rankings.map((ranking) => ({
          tier: ranking.overallTier,
          origin: ranking.overallTierOrigin,
        })),
      ).toEqual([
        { tier: 1, origin: "defaulted-neutral" },
        { tier: 1, origin: "defaulted-neutral" },
      ]);
    },
  );

  it.each([
    ["complete", [1.5, 2.5, 3.5]],
    ["partial", [1.5, null, 3.5]],
    ["absent", [null, null, null]],
  ] as const)("preserves %s ADP through mapped context", (_label, adpRanks) => {
    const rankings = [
      createRanking("player-1", 1, "WR", { adpRank: adpRanks[0] }),
      createRanking("player-2", 2, "RB", { adpRank: adpRanks[1] }),
      createRanking("player-3", 3, "QB", { adpRank: adpRanks[2] }),
    ];
    const record = createDraftRecord({ rankings });

    const workspace = mapDraftRecordToWorkspace(record);
    const contextResult = workspace.recommendationRankingContextResult;

    expect(contextResult?.ok).toBe(true);
    if (!contextResult?.ok) {
      throw new Error("Expected mapped recommendation context to succeed.");
    }
    expect(
      contextResult.context.rankings.map((ranking) => ranking.adpRank),
    ).toEqual(adpRanks);
    expect(
      contextResult.context.rankings.map((ranking) => ({
        tier: ranking.overallTier,
        origin: ranking.overallTierOrigin,
      })),
    ).toEqual([
      { tier: 1, origin: "defaulted-neutral" },
      { tier: 1, origin: "defaulted-neutral" },
      { tier: 1, origin: "defaulted-neutral" },
    ]);
  });

  it("keeps Phase 5-valid partial source tiers loadable as a structured context failure", () => {
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
    ];
    const serializedSnapshot = createV2Snapshot(rankings, [1]);
    const record = createDraftRecord({ rankings: serializedSnapshot });

    const workspace = mapDraftRecordToWorkspace(record);

    expect(workspace.draft.id).toBe("draft-1");
    expect(workspace.rankings.map((ranking) => ranking.player.id)).toEqual([
      "player-1",
      "player-2",
    ]);
    expect(workspace.recommendationRankingContextResult).toEqual({
      ok: false,
      errors: [
        {
          code: "partial-overall-tiers",
          path: "tierSemantics.source.values",
          message: "Overall tiers are missing for: player-2.",
        },
      ],
    });
    expect(workspace.recommendationRankingContextResult).not.toHaveProperty(
      "context",
    );
  });

  it("rejects invalid league settings before hydration", () => {
    const record = createDraftRecord({
      leagueSettings: {
        ...defaultLeagueSettings,
        teamCount: 0,
      },
    });

    expect(() => mapDraftRecordToWorkspace(record)).toThrow(
      "leagueSettings.teamCount must be a positive integer.",
    );
  });

  it("rejects invalid ranking snapshot JSON", () => {
    const record = createDraftRecord({
      rankings: { rankings: [] },
    });

    expect(() => mapDraftRecordToWorkspace(record)).toThrow(
      "Ranking snapshot schemaVersion must be 2.",
    );
  });

  it("rejects invalid pick history", () => {
    const record = createDraftRecord({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      picks: [{ pickNumber: 5, playerId: "player-5" }],
    });

    expect(() => mapDraftRecordToWorkspace(record)).toThrow(
      "Pick history entry 5 is outside the generated draft order.",
    );
  });
});

function createDraftRecord({
  id = "draft-1",
  leagueSettings = defaultLeagueSettings,
  userTeamId = "team-2",
  rankings = [createRanking("player-1", 1, "WR")],
  picks = [],
}: {
  id?: string;
  leagueSettings?: unknown;
  userTeamId?: string;
  rankings?: unknown;
  picks?: PersistedDraftWorkspaceRecord["picks"];
} = {}): PersistedDraftWorkspaceRecord {
  return {
    id,
    leagueSettings: isLeagueSettings(leagueSettings)
      ? serializeLeagueSettingsSnapshot(leagueSettings)
      : leagueSettings,
    userTeamId,
    rankingSnapshot: {
      rankings: isRankingEntryArray(rankings)
        ? serializeRankingSnapshot(rankings)
        : rankings,
    },
    picks,
  };
}

function createLeagueSettings({
  teamCount,
  rounds,
}: {
  teamCount: number;
  rounds: number;
}): LeagueSettings {
  return {
    ...defaultLeagueSettings,
    teamCount,
    rounds,
    rosterSlots: defaultLeagueSettings.rosterSlots.slice(0, rounds),
  };
}

function createRanking(
  id: string,
  overallRank: number,
  position: Position,
  options: Partial<
    Pick<RankingEntry, "adpRank" | "positionRank" | "tier"> & {
      name: string;
      team: string;
    }
  > = {},
): RankingEntry {
  return {
    player: {
      id,
      name: options.name ?? id,
      team: options.team ?? "TEST",
      position,
    },
    overallRank,
    adpRank: options.adpRank ?? null,
    positionRank: options.positionRank ?? overallRank,
    tier: options.tier ?? 1,
  };
}

function createV2Snapshot(
  rankings: readonly RankingEntry[],
  overallTiers: readonly number[],
) {
  return serializeRankingSnapshot({
    rankings,
    tierSemantics: {
      source: {
        kind: "source-overall",
        values: overallTiers.map((tier, index) => ({
          playerId: rankings[index].player.id,
          overallRank: rankings[index].overallRank,
          tier,
        })),
      },
      recommendation: createNeutralRecommendationSemantics(rankings),
    },
    capturedAt: new Date("2026-07-02T12:00:00.000Z"),
  });
}

function createNeutralRecommendationSemantics(
  rankings: readonly RankingEntry[],
): Partial<Record<Position, "neutral">> {
  return rankings.reduce<Partial<Record<Position, "neutral">>>(
    (semantics, ranking) => {
      semantics[ranking.player.position] = "neutral";
      return semantics;
    },
    {},
  );
}

function isLeagueSettings(value: unknown): value is LeagueSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "teamCount" in value &&
      "rosterSlots" in value,
  );
}

function isRankingEntryArray(value: unknown): value is RankingEntry[] {
  return Array.isArray(value);
}
