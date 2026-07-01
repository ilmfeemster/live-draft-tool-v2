import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftRepository } from "@/lib/draftRepository";
import { isValidDraftState } from "@/lib/draftInvariants";
import { draftPlayerInDraft } from "@/lib/draftState";
import { buildLeagueSetup } from "@/lib/leagueSetup";
import { serializeLeagueSettingsSnapshot } from "@/lib/leagueSettingsSnapshot";
import { serializeRankingSnapshot } from "@/lib/rankingSnapshot";
import {
  generatePlayerRecommendations,
  generateTopRecommendations,
} from "@/lib/recommendations";
import type {
  Draft,
  LeagueSettings,
  Position,
  RankingEntry,
  UserRosterPlayer,
} from "@/types/draft";

describe("draft repository", () => {
  it("creates a default draft from source state without empty pick rows", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
    ];

    const workspace = await repository.createDraftWorkspace({
      name: "Test Draft",
      leagueSettings: defaultLeagueSettings,
      rankings,
      userTeamId: "team-2",
    });

    expect(db.drafts[0]).toMatchObject({
      name: "Test Draft",
      leagueSettings: serializeLeagueSettingsSnapshot(defaultLeagueSettings),
      userTeamId: "team-2",
      picks: [],
    });
    expect(db.rankingSnapshots[0].rankings).toEqual(
      expect.objectContaining({
        schemaVersion: 2,
        rankings,
        tierSemantics: {
          source: {
            kind: "legacy-ambiguous",
            values: [
              { playerId: "player-1", overallRank: 1, tier: 1 },
              { playerId: "player-2", overallRank: 2, tier: 1 },
            ],
          },
          recommendation: { WR: "neutral", RB: "neutral" },
        },
        capturedAt: expect.any(String),
      }),
    );
    expect(workspace.draft.currentPickNumber).toBe(1);
    expect(workspace.draft.picks).toHaveLength(192);
    expect(workspace.rankings).toEqual(rankings);
    expect(isValidDraftState({ draft: workspace.draft })).toBe(true);
  });

  it("persists and hydrates explicit managed snapshot metadata", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const rankings = [
      createRanking("qb-1", 1, "QB"),
      { ...createRanking("qb-2", 2, "QB"), tier: 3 },
    ];
    const capturedAt = new Date("2026-07-01T12:00:00.000Z");
    const rankingSnapshotMetadata = {
      capabilities: {
        team: "complete",
        playerIdentity: "provided",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "none",
        tiers: { QB: "source" },
      } as const,
      tierSemantics: {
        source: { kind: "none" },
        recommendation: { QB: "recommendation-position" },
      } as const,
      sourceRankingSetId: "managed-rankings",
      sourceRankingSetName: "Managed Rankings",
      capturedAt,
    };

    const workspace = await repository.createDraftWorkspace({
      leagueSettings: defaultLeagueSettings,
      rankings,
      rankingSnapshotMetadata,
      userTeamId: "team-2",
    });

    expect(db.rankingSnapshots[0].rankings).toEqual(
      serializeRankingSnapshot({ rankings, ...rankingSnapshotMetadata }),
    );
    expect(workspace.rankings.map((entry) => entry.tier)).toEqual([1, 3]);
  });

  it("round-trips a generated non-default draft workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const rankings = Array.from({ length: 12 }, (_, index) => {
      return createRanking(`player-${index + 1}`, index + 1, "QB");
    });
    const setup = buildLeagueSetup(
      {
        teamCount: 4,
        userDraftPosition: 3,
        draftType: "SNAKE",
        scoringFormat: "PPR",
        rosterSlotCounts: {
          QB: 1,
          RB: 0,
          WR: 0,
          TE: 0,
          FLEX: 1,
          DST: 0,
          K: 0,
          BENCH: 1,
        },
      },
      rankings.length,
    );

    if (!setup.ok) {
      throw new Error(`Expected valid setup: ${JSON.stringify(setup.errors)}`);
    }

    const createdWorkspace = await repository.createDraftWorkspace({
      leagueSettings: setup.leagueSettings,
      rankings,
      userTeamId: setup.userTeamId,
    });
    const loadedWorkspace = await repository.getDraftWorkspaceById(
      createdWorkspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([]);
    expect(loadedWorkspace?.leagueSettings).toEqual(setup.leagueSettings);
    expect(loadedWorkspace?.draft.userTeamId).toBe("team-3");
    expect(loadedWorkspace?.draft.teams).toEqual([
      { id: "team-1", name: "Team 1", draftPosition: 1 },
      { id: "team-2", name: "Team 2", draftPosition: 2 },
      { id: "team-3", name: "Team 3", draftPosition: 3 },
      { id: "team-4", name: "Team 4", draftPosition: 4 },
    ]);
    expect(loadedWorkspace?.draft.rounds).toBe(3);
    expect(loadedWorkspace?.draft.picks).toHaveLength(12);
    expect(loadedWorkspace?.draft.picks.map((pick) => pick.teamId)).toEqual([
      "team-1",
      "team-2",
      "team-3",
      "team-4",
      "team-4",
      "team-3",
      "team-2",
      "team-1",
      "team-1",
      "team-2",
      "team-3",
      "team-4",
    ]);
    expect(loadedWorkspace?.rankings).toEqual(rankings);
    expect(
      loadedWorkspace && isValidDraftState({ draft: loadedWorkspace.draft }),
    ).toBe(true);
  });

  it("loads an existing draft as a typed draft workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const createdWorkspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    db.drafts[0].picks.push(
      { pickNumber: 2, playerId: "player-2" },
      { pickNumber: 1, playerId: "player-1" },
    );

    const loadedWorkspace = await repository.getDraftWorkspaceById(
      createdWorkspace.draft.id,
    );

    expect(loadedWorkspace?.draft.currentPickNumber).toBe(3);
    expect(loadedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(loadedWorkspace?.draft.picks[1].playerId).toBe("player-2");
    expect(loadedWorkspace?.rankings.map((ranking) => ranking.player.id)).toEqual([
      "player-1",
      "player-2",
    ]);
  });

  it("preserves recommendation output across persistence hydration", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const leagueSettings = createLeagueSettings({ teamCount: 2, rounds: 4 });
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
      createRanking("player-3", 3, "QB"),
      createRanking("player-4", 4, "TE"),
      createRanking("player-5", 5, "RB"),
      createRanking("player-6", 6, "WR"),
      createRanking("player-7", 7, "QB"),
      createRanking("player-8", 8, "TE"),
    ];
    const draftedPlayerIds = ["player-1", "player-2", "player-3"];
    const workspace = await repository.createDraftWorkspace({
      leagueSettings,
      rankings,
      userTeamId: "team-1",
    });
    const inMemoryDraft = draftedPlayerIds.reduce((draft, playerId) => {
      return draftPlayerInDraft(draft, playerId);
    }, workspace.draft);
    const expectedRecommendations = generatePlayerRecommendations({
      draft: inMemoryDraft,
      rankings: workspace.rankings,
      leagueSettings: workspace.leagueSettings,
      userTeamId: workspace.draft.userTeamId,
    });

    for (const playerId of draftedPlayerIds) {
      await repository.draftPlayerInWorkspace(workspace.draft.id, playerId);
    }

    const reloadedWorkspace = await repository.getDraftWorkspaceById(workspace.draft.id);

    if (!reloadedWorkspace) {
      throw new Error("Expected persisted draft workspace to reload.");
    }

    const reloadedInput = {
      draft: reloadedWorkspace.draft,
      rankings: reloadedWorkspace.rankings,
      leagueSettings: reloadedWorkspace.leagueSettings,
      userTeamId: reloadedWorkspace.draft.userTeamId,
    };
    const reloadedRecommendations = generatePlayerRecommendations(reloadedInput);
    const repeatedReloadedRecommendations = generatePlayerRecommendations(reloadedInput);
    const draftedPlayerIdSet = new Set(draftedPlayerIds);

    expect(reloadedWorkspace.draft).toEqual(inMemoryDraft);
    expect(reloadedWorkspace.rankings).toEqual(workspace.rankings);
    expect(reloadedWorkspace.leagueSettings).toEqual(workspace.leagueSettings);
    expect(reloadedRecommendations).toEqual(expectedRecommendations);
    expect(repeatedReloadedRecommendations).toEqual(reloadedRecommendations);
    expect(expectedRecommendations.every((recommendation) => {
      return !draftedPlayerIdSet.has(recommendation.playerId);
    })).toBe(true);
    expect(reloadedRecommendations.every((recommendation) => {
      return !draftedPlayerIdSet.has(recommendation.playerId);
    })).toBe(true);
  });

  it("returns null when loading a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(repository.getDraftWorkspaceById("missing-draft")).resolves.toBeNull();
  });

  it("drafts a player, persists the pick, and reloads the current pick", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-1",
    );
    const reloadedWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(updatedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(reloadedWorkspace?.draft.picks[0].playerId).toBe("player-1");
    expect(reloadedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("returns null when drafting into a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.draftPlayerInWorkspace("missing-draft", "player-1"),
    ).resolves.toBeNull();
  });

  it("does not mutate pick history when drafting a player missing from the ranking snapshot", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "missing-player",
    );

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(1);
  });

  it("does not create another pick row for a duplicate drafted player", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");

    const updatedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-1",
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("undoes the latest persisted pick and reloads the restored current pick", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );
    const reloadedWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(updatedWorkspace?.draft.picks[1].playerId).toBeUndefined();
    expect(reloadedWorkspace?.draft.currentPickNumber).toBe(2);
    expect(reloadedWorkspace?.draft.picks[1].playerId).toBeUndefined();
  });

  it("preserves draft invariants and recommendation inputs across persisted reload and undo", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
      createRanking("player-3", 3, "QB"),
      createRanking("player-4", 4, "TE"),
      createRanking("player-5", 5, "WR"),
      createRanking("player-6", 6, "RB"),
      createRanking("player-7", 7, "WR"),
      createRanking("player-8", 8, "RB"),
    ];
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 4, rounds: 3 }),
      rankings,
      userTeamId: "team-3",
    });

    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-3");

    const reloadedWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(reloadedWorkspace).not.toBeNull();
    if (!reloadedWorkspace) {
      throw new Error("Expected persisted workflow draft to reload.");
    }

    const availableRankings = getAvailableRankings(
      reloadedWorkspace.rankings,
      reloadedWorkspace.draft,
    );
    const rosterPlayers = getUserRosterPlayers(
      reloadedWorkspace.rankings,
      reloadedWorkspace.draft,
    );
    const recommendations = generateTopRecommendations(availableRankings, {
      rosterPlayers,
    });

    expect(reloadedWorkspace.draft.currentPickNumber).toBe(4);
    expect(
      reloadedWorkspace.draft.picks
        .filter((pick) => pick.playerId)
        .map((pick) => pick.playerId),
    ).toEqual(["player-1", "player-2", "player-3"]);
    expect(availableRankings.map((ranking) => ranking.player.id)).not.toContain(
      "player-1",
    );
    expect(availableRankings.map((ranking) => ranking.player.id)).not.toContain(
      "player-2",
    );
    expect(availableRankings.map((ranking) => ranking.player.id)).not.toContain(
      "player-3",
    );
    expect(rosterPlayers).toEqual([
      {
        pickNumber: 3,
        name: "player-3",
        team: "TEST",
        position: "QB",
      },
    ]);
    expect(recommendations.map((recommendation) => recommendation.ranking.player.id))
      .toEqual(["player-4", "player-5", "player-6", "player-7", "player-8"]);
    expect(
      isValidDraftState({
        draft: reloadedWorkspace.draft,
        availableRankings,
        rosterPlayers,
        recommendationRankings: recommendations.map((recommendation) => {
          return recommendation.ranking;
        }),
      }),
    ).toBe(true);

    await repository.undoLastPickInWorkspace(workspace.draft.id);

    const restoredWorkspace = await repository.getDraftWorkspaceById(
      workspace.draft.id,
    );

    expect(restoredWorkspace).not.toBeNull();
    if (!restoredWorkspace) {
      throw new Error("Expected post-undo workflow draft to reload.");
    }

    const restoredAvailableRankings = getAvailableRankings(
      restoredWorkspace.rankings,
      restoredWorkspace.draft,
    );
    const restoredRosterPlayers = getUserRosterPlayers(
      restoredWorkspace.rankings,
      restoredWorkspace.draft,
    );
    const restoredRecommendations = generateTopRecommendations(
      restoredAvailableRankings,
      { rosterPlayers: restoredRosterPlayers },
    );

    expect(restoredWorkspace.draft.currentPickNumber).toBe(3);
    expect(
      restoredWorkspace.draft.picks
        .filter((pick) => pick.playerId)
        .map((pick) => pick.playerId),
    ).toEqual(["player-1", "player-2"]);
    expect(restoredAvailableRankings.map((ranking) => ranking.player.id)).toContain(
      "player-3",
    );
    expect(restoredRosterPlayers).toEqual([]);
    expect(
      isValidDraftState({
        draft: restoredWorkspace.draft,
        availableRankings: restoredAvailableRankings,
        rosterPlayers: restoredRosterPlayers,
        recommendationRankings: restoredRecommendations.map((recommendation) => {
          return recommendation.ranking;
        }),
      }),
    ).toBe(true);
  });

  it("returns null when undoing a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.undoLastPickInWorkspace("missing-draft"),
    ).resolves.toBeNull();
  });

  it("does not mutate pick history when undoing an empty draft", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 2 }),
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-1",
    });

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(1);
  });

  it("marks a completed draft complete and blocks extra picks after completion", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 1 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
        createRanking("player-3", 3, "QB"),
      ],
      userTeamId: "team-1",
    });

    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    const completedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-2",
    );
    const unchangedWorkspace = await repository.draftPlayerInWorkspace(
      workspace.draft.id,
      "player-3",
    );

    expect(db.drafts[0].status).toBe("COMPLETE");
    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
      { pickNumber: 2, playerId: "player-2" },
    ]);
    expect(completedWorkspace?.draft.picks.every((pick) => pick.playerId)).toBe(
      true,
    );
    expect(unchangedWorkspace?.draft.picks.map((pick) => pick.playerId)).toEqual([
      "player-1",
      "player-2",
    ]);
  });

  it("restores in-progress status when undoing after completion", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const workspace = await repository.createDraftWorkspace({
      leagueSettings: createLeagueSettings({ teamCount: 2, rounds: 1 }),
      rankings: [
        createRanking("player-1", 1, "WR"),
        createRanking("player-2", 2, "RB"),
      ],
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");

    const updatedWorkspace = await repository.undoLastPickInWorkspace(
      workspace.draft.id,
    );

    expect(db.drafts[0].status).toBe("IN_PROGRESS");
    expect(db.drafts[0].picks).toEqual([
      { pickNumber: 1, playerId: "player-1" },
    ]);
    expect(updatedWorkspace?.draft.currentPickNumber).toBe(2);
  });

  it("resets one draft pick history and reloads an empty workspace", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const leagueSettings = createLeagueSettings({ teamCount: 2, rounds: 2 });
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
      createRanking("player-3", 3, "QB"),
    ];
    const workspace = await repository.createDraftWorkspace({
      name: "Reset Me",
      leagueSettings,
      rankings,
      userTeamId: "team-2",
    });
    const otherWorkspace = await repository.createDraftWorkspace({
      name: "Keep Me",
      leagueSettings,
      rankings,
      userTeamId: "team-1",
    });
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(workspace.draft.id, "player-2");
    await repository.draftPlayerInWorkspace(otherWorkspace.draft.id, "player-3");

    const resetWorkspace = await repository.resetDraftWorkspace(workspace.draft.id);

    expect(resetWorkspace).not.toBeNull();
    if (!resetWorkspace) {
      throw new Error("Expected reset to return a workspace.");
    }

    expect(db.drafts[0].picks).toEqual([]);
    expect(db.drafts[0].status).toBe("NOT_STARTED");
    expect(db.drafts[1].picks).toEqual([
      { pickNumber: 1, playerId: "player-3" },
    ]);
    expect(db.drafts[1].status).toBe("IN_PROGRESS");
    expect(resetWorkspace.draft.id).toBe(workspace.draft.id);
    expect(resetWorkspace.draft.currentPickNumber).toBe(1);
    expect(resetWorkspace.draft.picks.every((pick) => !pick.playerId)).toBe(true);
    expect(resetWorkspace.rankings).toEqual(rankings);
    expect(resetWorkspace.leagueSettings).toEqual(leagueSettings);
    expect(resetWorkspace.draft.userTeamId).toBe("team-2");
    expect(isValidDraftState({ draft: resetWorkspace.draft })).toBe(true);
  });

  it("returns null when resetting a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.resetDraftWorkspace("missing-draft"),
    ).resolves.toBeNull();
  });

  it("deletes one draft workspace without mutating other drafts", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const leagueSettings = createLeagueSettings({ teamCount: 2, rounds: 2 });
    const rankings = [
      createRanking("player-1", 1, "WR"),
      createRanking("player-2", 2, "RB"),
      createRanking("player-3", 3, "QB"),
    ];
    const deletedWorkspace = await repository.createDraftWorkspace({
      name: "Delete Me",
      leagueSettings,
      rankings,
      userTeamId: "team-1",
    });
    const keptWorkspace = await repository.createDraftWorkspace({
      name: "Keep Me",
      leagueSettings,
      rankings,
      userTeamId: "team-2",
    });
    await repository.draftPlayerInWorkspace(deletedWorkspace.draft.id, "player-1");
    await repository.draftPlayerInWorkspace(keptWorkspace.draft.id, "player-2");

    const result = await repository.deleteDraftWorkspace(
      deletedWorkspace.draft.id,
    );

    expect(result).toBe(true);
    await expect(
      repository.getDraftWorkspaceById(deletedWorkspace.draft.id),
    ).resolves.toBeNull();
    await expect(
      repository.getDraftWorkspaceById(keptWorkspace.draft.id),
    ).resolves.toMatchObject({
      draft: {
        id: keptWorkspace.draft.id,
        currentPickNumber: 2,
      },
    });
    expect(db.drafts.map((draft) => draft.id)).toEqual([keptWorkspace.draft.id]);
    expect(db.rankingSnapshots.map((snapshot) => snapshot.id)).toEqual([
      "ranking-snapshot-2",
    ]);

    const summaries = await repository.listDraftSummaries();

    expect(summaries.map((summary) => summary.id)).toEqual([
      keptWorkspace.draft.id,
    ]);
    expect(summaries[0].draftedPickCount).toBe(1);
  });

  it("returns false when deleting a missing draft", async () => {
    const repository = createDraftRepository(createFakeDraftDb());

    await expect(
      repository.deleteDraftWorkspace("missing-draft"),
    ).resolves.toBe(false);
  });

  it("lists lightweight draft summaries without loading ranking snapshot JSON", async () => {
    const db = createFakeDraftDb();
    const repository = createDraftRepository(db);
    const defaultWorkspace = await repository.createDraftWorkspace({
      name: "Default Draft",
      leagueSettings: defaultLeagueSettings,
      rankings: [createRanking("player-1", 1, "WR")],
      userTeamId: "team-2",
    });
    const nonDefaultSettings = createLeagueSettings({ teamCount: 4, rounds: 3 });
    const nonDefaultWorkspace = await repository.createDraftWorkspace({
      name: "Non-default Draft",
      leagueSettings: nonDefaultSettings,
      rankings: [createRanking("player-2", 1, "RB")],
      userTeamId: "team-3",
    });
    db.drafts[0].picks.push({ pickNumber: 1, playerId: "player-1" });
    db.drafts[0].updatedAt = new Date("2026-01-01T00:00:00.000Z");
    db.drafts[1].updatedAt = new Date("2026-01-02T00:00:00.000Z");

    const summaries = await repository.listDraftSummaries();

    expect(db.findManySelectedRankingSnapshot).toBe(false);
    expect(summaries).toEqual([
      {
        id: nonDefaultWorkspace.draft.id,
        name: "Non-default Draft",
        status: "NOT_STARTED",
        teamCount: 4,
        rounds: 3,
        userTeamId: "team-3",
        draftedPickCount: 0,
        createdAt: db.drafts[1].createdAt,
        updatedAt: db.drafts[1].updatedAt,
      },
      {
        id: defaultWorkspace.draft.id,
        name: "Default Draft",
        status: "NOT_STARTED",
        teamCount: 12,
        rounds: 16,
        userTeamId: "team-2",
        draftedPickCount: 1,
        createdAt: db.drafts[0].createdAt,
        updatedAt: db.drafts[0].updatedAt,
      },
    ]);
  });
});

type FakeDraftRecord = {
  id: string;
  name: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  leagueSettings: unknown;
  userTeamId: string;
  rankingSnapshot: {
    id: string;
    rankings: unknown;
  };
  picks: {
    pickNumber: number;
    playerId: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

function createFakeDraftDb() {
  const db = {
    drafts: [] as FakeDraftRecord[],
    rankingSnapshots: [] as { id: string; rankings: unknown }[],
    findManySelectedRankingSnapshot: false,
    draft: {
      async create(args: {
        data: {
          name: string | null;
          leagueSettings: unknown;
          userTeamId: string;
          rankingSnapshot: {
            create: {
              rankings: unknown;
            };
          };
        };
      }) {
        const draftNumber = db.drafts.length + 1;
        const rankingSnapshot = {
          id: `ranking-snapshot-${draftNumber}`,
          rankings: args.data.rankingSnapshot.create.rankings,
        };
        const draft = {
          id: `draft-${draftNumber}`,
          name: args.data.name,
          status: "NOT_STARTED" as const,
          leagueSettings: args.data.leagueSettings,
          userTeamId: args.data.userTeamId,
          rankingSnapshot,
          picks: [],
          createdAt: new Date(`2026-01-0${draftNumber}T00:00:00.000Z`),
          updatedAt: new Date(`2026-01-0${draftNumber}T00:00:00.000Z`),
        };

        db.rankingSnapshots.push(rankingSnapshot);
        db.drafts.push(draft);

        return toWorkspaceRecord(draft);
      },
      async findUnique(args: { where: { id: string } }) {
        const draft = db.drafts.find((candidate) => candidate.id === args.where.id);

        return draft ? toWorkspaceRecord(draft) : null;
      },
      async findMany(args: {
        select: Record<string, unknown>;
        orderBy: {
          updatedAt: "desc";
        };
      }) {
        db.findManySelectedRankingSnapshot = "rankingSnapshot" in args.select;

        return [...db.drafts]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .map((draft) => ({
            id: draft.id,
            name: draft.name,
            status: draft.status,
            leagueSettings: draft.leagueSettings,
            userTeamId: draft.userTeamId,
            picks: draft.picks.map((pick) => ({ pickNumber: pick.pickNumber })),
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          }));
      },
      async update(args: {
        where: { id: string };
        data: { status: FakeDraftRecord["status"] };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.where.id;
        });

        if (!draft) {
          throw new Error(`Draft ${args.where.id} was not found.`);
        }

        draft.status = args.data.status;
        draft.updatedAt = new Date(draft.updatedAt.getTime() + 1);

        return draft;
      },
      async delete(args: { where: { id: string } }) {
        const draftIndex = db.drafts.findIndex((candidate) => {
          return candidate.id === args.where.id;
        });

        if (draftIndex === -1) {
          throw new Error(`Draft ${args.where.id} was not found.`);
        }

        const [deletedDraft] = db.drafts.splice(draftIndex, 1);

        return deletedDraft;
      },
    },
    rankingSnapshot: {
      async delete(args: { where: { id: string } }) {
        const snapshotIndex = db.rankingSnapshots.findIndex((candidate) => {
          return candidate.id === args.where.id;
        });

        if (snapshotIndex === -1) {
          throw new Error(`Ranking snapshot ${args.where.id} was not found.`);
        }

        const [deletedSnapshot] = db.rankingSnapshots.splice(snapshotIndex, 1);

        return deletedSnapshot;
      },
    },
    draftPick: {
      async create(args: {
        data: {
          draftId: string;
          pickNumber: number;
          playerId: string;
        };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.data.draftId;
        });

        if (!draft) {
          throw new Error(`Draft ${args.data.draftId} was not found.`);
        }

        if (
          draft.picks.some((pick) => {
            return pick.pickNumber === args.data.pickNumber;
          })
        ) {
          throw new Error(`Pick ${args.data.pickNumber} already exists.`);
        }

        draft.picks.push({
          pickNumber: args.data.pickNumber,
          playerId: args.data.playerId,
        });

        return args.data;
      },
      async deleteMany(args: {
        where: {
          draftId: string;
          pickNumber?: number;
        };
      }) {
        const draft = db.drafts.find((candidate) => {
          return candidate.id === args.where.draftId;
        });

        if (!draft) {
          return { count: 0 };
        }

        const originalPickCount = draft.picks.length;
        draft.picks = draft.picks.filter((pick) => {
          if (args.where.pickNumber === undefined) {
            return false;
          }

          return pick.pickNumber !== args.where.pickNumber;
        });

        return {
          count: originalPickCount - draft.picks.length,
        };
      },
    },
  };

  return db;
}

function toWorkspaceRecord(draft: FakeDraftRecord) {
  return {
    id: draft.id,
    leagueSettings: draft.leagueSettings,
    userTeamId: draft.userTeamId,
    rankingSnapshot: {
      id: draft.rankingSnapshot.id,
      rankings: draft.rankingSnapshot.rankings,
    },
    picks: [...draft.picks].sort((left, right) => left.pickNumber - right.pickNumber),
  };
}

function getAvailableRankings(
  rankings: RankingEntry[],
  draft: Draft,
): RankingEntry[] {
  const draftedPlayerIds = new Set(
    draft.picks
      .map((pick) => pick.playerId)
      .filter((playerId): playerId is string => Boolean(playerId)),
  );

  return rankings.filter((ranking) => {
    return !draftedPlayerIds.has(ranking.player.id);
  });
}

function getUserRosterPlayers(
  rankings: RankingEntry[],
  draft: Draft,
): UserRosterPlayer[] {
  return draft.picks
    .filter((pick) => pick.teamId === draft.userTeamId && pick.playerId)
    .map((pick) => {
      const ranking = rankings.find((entry) => {
        return entry.player.id === pick.playerId;
      });

      if (!ranking) {
        return undefined;
      }

      return {
        pickNumber: pick.pickNumber,
        name: ranking.player.name,
        team: ranking.player.team,
        position: ranking.player.position,
      };
    })
    .filter((player): player is UserRosterPlayer => Boolean(player))
    .sort((left, right) => left.pickNumber - right.pickNumber);
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
    positionRank: overallRank,
    tier: 1,
  };
}
