import { describe, expect, it, vi } from "vitest";
import { defaultLeagueSetupInput } from "@/lib/leagueSetup";
import {
  parsePersistedDraftRankingSnapshotJson,
  serializeRankingSnapshot,
} from "@/lib/rankingSnapshot";
import {
  createConfiguredDraftFromRankingSet,
  type DraftCreationWorkflowDependencies,
} from "@/lib/draftCreationWorkflow";
import type {
  CreateDraftWorkspaceInput,
} from "@/lib/draftRepository";
import type {
  DraftWorkspace,
  LeagueSettings,
  Position,
  RankingEntry,
} from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
} from "@/types/rankings";

describe("createConfiguredDraftFromRankingSet", () => {
  it("returns invalid-request for a blank ranking-set ID without calling repositories", async () => {
    const fake = createFakeDependencies({
      rankingSets: {
        "rankings-1": createRankingSet("rankings-1"),
      },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "  ",
      },
      fake.dependencies,
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-request",
          path: "rankingSetId",
          message: "Ranking set ID is required.",
        },
      ],
    });
    expect(fake.getRankingSetById).not.toHaveBeenCalled();
    expect(fake.createDraftWorkspace).not.toHaveBeenCalled();
  });

  it("returns ranking-set-not-found without creating a draft", async () => {
    const fake = createFakeDependencies({ rankingSets: {} });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "missing-rankings",
      },
      fake.dependencies,
    );

    expect(fake.getRankingSetById).toHaveBeenCalledWith("missing-rankings");
    expect(fake.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "ranking-set-not-found",
          path: "rankingSetId",
          message: "Ranking set was not found.",
        },
      ],
    });
  });

  it("returns league setup errors using the selected set capacity", async () => {
    const fake = createFakeDependencies({
      rankingSets: {
        "small-rankings": createRankingSet("small-rankings", {
          entries: [createEntry("player-1", 1, "QB", 1)],
          capabilities: createCapabilities({ tiers: { QB: "source" } }),
        }),
      },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "small-rankings",
      },
      fake.dependencies,
    );

    expect(fake.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-league-setup",
          path: "rankingPlayerCount",
          message: "Draft requires 4 players, but only 1 ranking players are available.",
        },
      ],
    });
  });

  it("loads, snapshots, persists copied rankings, and returns the created workspace", async () => {
    const rankingSet = createRankingSet("rankings-1");
    const fake = createFakeDependencies({
      rankingSets: {
        "rankings-1": rankingSet,
      },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: " rankings-1 ",
        name: "Selected Rankings Draft",
        capturedAt: new Date("2026-06-30T12:00:00.000Z"),
      },
      fake.dependencies,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected selected-ranking draft creation to succeed.");
    }

    const persistedInput = fake.createdDraftInputs[0];
    expect(fake.getRankingSetById).toHaveBeenCalledWith("rankings-1");
    expect(persistedInput).toMatchObject({
      name: "Selected Rankings Draft",
      userTeamId: "team-1",
    });
    expect(persistedInput.leagueSettings).toMatchObject({
      teamCount: 2,
      rounds: 2,
    });
    expect(persistedInput.rankings).toEqual(rankingSet.entries);
    expect(persistedInput.rankings).not.toBe(rankingSet.entries);
    expect(persistedInput.rankings[0]).not.toBe(rankingSet.entries[0]);
    expect(persistedInput.rankings[0].player).not.toBe(
      rankingSet.entries[0].player,
    );
    expect(persistedInput.rankingSnapshotMetadata).toEqual({
      capabilities: rankingSet.capabilities,
      tierSemantics: rankingSet.tierSemantics,
      sourceRankingSetId: rankingSet.id,
      sourceRankingSetName: rankingSet.name,
      capturedAt: new Date("2026-06-30T12:00:00.000Z"),
    });
    expect(persistedInput.rankingSnapshotMetadata?.capabilities).not.toBe(
      rankingSet.capabilities,
    );
    expect(persistedInput.rankingSnapshotMetadata?.tierSemantics).not.toBe(
      rankingSet.tierSemantics,
    );
    expect(result.workspace).toEqual(fake.createdWorkspaces[0]);
  });

  it("keeps source-only tiers as metadata while persisted entries remain neutral", async () => {
    const entries = createEntries("source-only", { tier: NEUTRAL_TIER });
    const rankingSet = createRankingSet("source-only", {
      capabilities: createCapabilities({
        tiers: {
          QB: "defaulted-neutral",
          RB: "defaulted-neutral",
          WR: "defaulted-neutral",
          TE: "defaulted-neutral",
        },
      }),
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: entries.map((entry, index) => ({
            playerId: entry.player.id,
            overallRank: entry.overallRank,
            tier: index + 2,
          })),
        },
        recommendation: {
          QB: "neutral",
          RB: "neutral",
          WR: "neutral",
          TE: "neutral",
        },
      },
      entries,
    });
    const fake = createFakeDependencies({
      rankingSets: { "source-only": rankingSet },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "source-only",
        capturedAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      fake.dependencies,
    );

    expect(result.ok).toBe(true);
    const input = fake.createdDraftInputs[0];
    const hydrated = parsePersistedDraftRankingSnapshotJson(
      serializeRankingSnapshot({
        rankings: input.rankings,
        ...input.rankingSnapshotMetadata,
      }),
    );
    expect(hydrated.rankings.every((entry) => entry.tier === NEUTRAL_TIER)).toBe(
      true,
    );
    expect(hydrated.tierSemantics?.source.values?.map((value) => value.tier)).toEqual([
      2, 3, 4, 5,
    ]);
  });

  it("preserves mixed recommendation eligibility through simulated hydration", async () => {
    const entries = createEntries("mixed").map((entry) =>
      entry.player.position === "QB" ? { ...entry, tier: 2 } : entry,
    );
    const rankingSet = createRankingSet("mixed", {
      capabilities: createCapabilities({
        tiers: {
          QB: "source",
          RB: "defaulted-neutral",
          WR: "defaulted-neutral",
          TE: "defaulted-neutral",
        },
      }),
      tierSemantics: {
        source: { kind: "none" },
        recommendation: {
          QB: "recommendation-position",
          RB: "neutral",
          WR: "neutral",
          TE: "neutral",
        },
      },
      entries,
    });
    const fake = createFakeDependencies({ rankingSets: { mixed: rankingSet } });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "mixed",
        capturedAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      fake.dependencies,
    );

    expect(result.ok).toBe(true);
    const input = fake.createdDraftInputs[0];
    const hydrated = parsePersistedDraftRankingSnapshotJson(
      serializeRankingSnapshot({
        rankings: input.rankings,
        ...input.rankingSnapshotMetadata,
      }),
    );
    expect(hydrated.rankings.map((entry) => entry.tier)).toEqual([2, 1, 1, 1]);
    expect(hydrated.tierSemantics?.recommendation).toEqual({
      QB: "recommendation-position",
      RB: "neutral",
      WR: "neutral",
      TE: "neutral",
    });
  });

  it("creates drafts with distinct snapshots for distinct selected ranking sets", async () => {
    const fake = createFakeDependencies({
      rankingSets: {
        "rankings-alpha": createRankingSet("rankings-alpha", {
          entries: createEntries("alpha"),
        }),
        "rankings-beta": createRankingSet("rankings-beta", {
          entries: createEntries("beta"),
        }),
      },
    });

    await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "rankings-alpha",
      },
      fake.dependencies,
    );
    await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "rankings-beta",
      },
      fake.dependencies,
    );

    expect(fake.createdDraftInputs).toHaveLength(2);
    expect(
      fake.createdDraftInputs[0].rankings.map((ranking) => ranking.player.id),
    ).toEqual(["alpha-qb", "alpha-rb", "alpha-wr", "alpha-te"]);
    expect(
      fake.createdDraftInputs[1].rankings.map((ranking) => ranking.player.id),
    ).toEqual(["beta-qb", "beta-rb", "beta-wr", "beta-te"]);
  });

  it("isolates created drafts from later source edits and source deletion", async () => {
    const rankingSet = createRankingSet("rankings-1");
    const fake = createFakeDependencies({
      rankingSets: {
        "rankings-1": rankingSet,
      },
    });
    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "rankings-1",
      },
      fake.dependencies,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected selected-ranking draft creation to succeed.");
    }

    const createdDraftId = result.workspace.draft.id;
    const beforeStoredRankings = structuredClone(fake.createdDraftInputs[0].rankings);
    const beforeStoredMetadata = structuredClone(
      fake.createdDraftInputs[0].rankingSnapshotMetadata,
    );
    rankingSet.entries[0].player.name = "Edited Source Player";
    rankingSet.entries[0].overallRank = 99;
    (
      rankingSet.tierSemantics?.recommendation as Record<string, string>
    ).QB = "neutral";
    delete fake.rankingSets["rankings-1"];

    expect(fake.createdDraftInputs[0].rankings).toEqual(beforeStoredRankings);
    expect(fake.createdDraftInputs[0].rankingSnapshotMetadata).toEqual(
      beforeStoredMetadata,
    );
    await expect(fake.getDraftWorkspaceById(createdDraftId)).resolves.toEqual(
      result.workspace,
    );
  });

  it("maps invalid selected ranking sets to invalid-ranking-set errors", async () => {
    const fake = createFakeDependencies({
      rankingSets: {
        "invalid-rankings": createRankingSet("invalid-rankings", {
          name: "",
        }),
      },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "invalid-rankings",
      },
      fake.dependencies,
    );

    expect(fake.createDraftWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "invalid-ranking-set",
          path: "name",
          message: "Ranking set name must be a non-empty string.",
        },
      ],
    });
  });

  it("persists degraded ranking values without capability metadata", async () => {
    const rankingSet = createRankingSet("degraded-rankings", {
      capabilities: {
        team: "none",
        playerIdentity: "generated",
        overallOrder: "row-derived",
        positionRank: "derived",
        adp: "none",
        tiers: {
          QB: "defaulted-neutral",
          RB: "defaulted-neutral",
          WR: "defaulted-neutral",
          TE: "defaulted-neutral",
        },
      },
      entries: createEntries("generated", {
        team: UNKNOWN_TEAM,
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
      tierSemantics: {
        source: { kind: "none" },
        recommendation: {
          QB: "neutral",
          RB: "neutral",
          WR: "neutral",
          TE: "neutral",
        },
      },
    });
    const fake = createFakeDependencies({
      rankingSets: {
        "degraded-rankings": rankingSet,
      },
    });

    const result = await createConfiguredDraftFromRankingSet(
      {
        leagueSetup: createSmallSetupInput(),
        rankingSetId: "degraded-rankings",
      },
      fake.dependencies,
    );

    expect(result.ok).toBe(true);
    expect(fake.createdDraftInputs[0].rankings).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
    ]);
    expect(fake.createdDraftInputs[0]).not.toHaveProperty("capabilities");
    expect(fake.createdDraftInputs[0]).not.toHaveProperty("sourceRankingSetId");
  });

  it("lets unexpected draft repository failures reject", async () => {
    const repositoryError = new Error("database unavailable");
    const fake = createFakeDependencies({
      rankingSets: {
        "rankings-1": createRankingSet("rankings-1"),
      },
    });
    fake.createDraftWorkspace.mockRejectedValue(repositoryError);

    await expect(
      createConfiguredDraftFromRankingSet(
        {
          leagueSetup: createSmallSetupInput(),
          rankingSetId: "rankings-1",
        },
        fake.dependencies,
      ),
    ).rejects.toBe(repositoryError);
  });
});

type FakeDependencies = {
  rankingSets: Record<string, RankingSet>;
  createdDraftInputs: CreateDraftWorkspaceInput[];
  createdWorkspaces: DraftWorkspace[];
  getRankingSetById: ReturnType<typeof vi.fn>;
  createDraftWorkspace: ReturnType<typeof vi.fn>;
  getDraftWorkspaceById: (id: string) => Promise<DraftWorkspace | null>;
  dependencies: DraftCreationWorkflowDependencies;
};

function createFakeDependencies({
  rankingSets,
}: {
  rankingSets: Record<string, RankingSet>;
}): FakeDependencies {
  const createdDraftInputs: CreateDraftWorkspaceInput[] = [];
  const createdWorkspaces: DraftWorkspace[] = [];
  const getRankingSetById = vi.fn(async (id: string) => {
    return rankingSets[id] ?? null;
  });
  const createDraftWorkspace = vi.fn(
    async (input: CreateDraftWorkspaceInput) => {
      const draftNumber = createdWorkspaces.length + 1;
      const workspace = createDraftWorkspaceValue({
        id: `draft-${draftNumber}`,
        leagueSettings: input.leagueSettings,
        rankings: input.rankings,
        userTeamId: input.userTeamId,
      });

      createdDraftInputs.push(input);
      createdWorkspaces.push(workspace);
      return workspace;
    },
  );

  return {
    rankingSets,
    createdDraftInputs,
    createdWorkspaces,
    getRankingSetById,
    createDraftWorkspace,
    getDraftWorkspaceById: async (id: string) => {
      return createdWorkspaces.find((workspace) => workspace.draft.id === id) ?? null;
    },
    dependencies: {
      getRankingSetById,
      createDraftWorkspace,
    },
  };
}

function createSmallSetupInput() {
  return {
    ...defaultLeagueSetupInput,
    teamCount: 2,
    userDraftPosition: 1,
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
}

function createDraftWorkspaceValue({
  id,
  leagueSettings,
  rankings,
  userTeamId,
}: {
  id: string;
  leagueSettings: LeagueSettings;
  rankings: RankingEntry[];
  userTeamId: string;
}): DraftWorkspace {
  return {
    draft: {
      id,
      teamCount: leagueSettings.teamCount,
      rounds: leagueSettings.rounds,
      userTeamId,
      currentPickNumber: 1,
      teams: [
        { id: "team-1", name: "Team 1", draftPosition: 1 },
        { id: "team-2", name: "Team 2", draftPosition: 2 },
      ],
      picks: [
        { pickNumber: 1, round: 1, pickInRound: 1, teamId: "team-1" },
        { pickNumber: 2, round: 1, pickInRound: 2, teamId: "team-2" },
        { pickNumber: 3, round: 2, pickInRound: 1, teamId: "team-2" },
        { pickNumber: 4, round: 2, pickInRound: 2, teamId: "team-1" },
      ],
    },
    leagueSettings,
    rankings,
  };
}

function createRankingSet(
  id: string,
  overrides: Partial<RankingSet> = {},
): RankingSet {
  const createdAt = new Date("2026-06-30T12:00:00.000Z");

  return {
    id,
    name: `Rankings ${id}`,
    source: { kind: "manual" },
    capabilities: createCapabilities(),
    tierSemantics: {
      source: { kind: "none" },
      recommendation: {
        QB: "recommendation-position",
        RB: "recommendation-position",
        WR: "recommendation-position",
        TE: "recommendation-position",
      },
    },
    entries: createEntries(id),
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createEntries(
  prefix: string,
  overrides: Partial<Pick<RankingEntry, "adpRank" | "tier">> & {
    team?: string;
  } = {},
): RankingEntry[] {
  return [
    createEntry(`${prefix}-qb`, 1, "QB", 1, overrides),
    createEntry(`${prefix}-rb`, 2, "RB", 1, overrides),
    createEntry(`${prefix}-wr`, 3, "WR", 1, overrides),
    createEntry(`${prefix}-te`, 4, "TE", 1, overrides),
  ];
}

function createEntry(
  id: string,
  overallRank: number,
  position: Position,
  positionRank: number,
  overrides: Partial<Pick<RankingEntry, "adpRank" | "tier">> & {
    team?: string;
  } = {},
): RankingEntry {
  return {
    player: {
      id,
      name: `Player ${id}`,
      team: overrides.team ?? "TEST",
      position,
    },
    overallRank,
    positionRank,
    adpRank: overrides.adpRank === undefined ? overallRank + 0.5 : overrides.adpRank,
    tier: overrides.tier ?? 1,
  };
}

function createCapabilities(
  overrides: Partial<RankingSetCapabilities> = {},
): RankingSetCapabilities {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "explicit",
    positionRank: "derived",
    adp: "complete",
    tiers: {
      QB: "source",
      RB: "source",
      WR: "source",
      TE: "source",
    },
    ...overrides,
  };
}
