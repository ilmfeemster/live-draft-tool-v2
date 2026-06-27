import { describe, expect, it } from "vitest";
import { defaultLeagueSettings } from "@/data/defaultLeagueSettings";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { generatePlayerRecommendations } from "@/lib/recommendations";
import type {
  Draft,
  PlayerRecommendation,
  Position,
  RankingEntry,
  RecommendationInput,
} from "@/types/draft";

type DraftedScenarioPlayer = {
  id: string;
  position: Position;
};

function createScenarioRanking(
  id: string,
  overallRank: number,
  position: Position,
  positionRank = overallRank,
  tier = 1,
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
    positionRank,
    tier,
  };
}

function createScenarioDraft({
  userPlayerIds,
  opponentPlayerIds,
  rounds = 16,
}: {
  userPlayerIds: string[];
  opponentPlayerIds: string[];
  rounds?: number;
}): Draft {
  const teamCount = 2;
  const teams = createDraftTeams(teamCount);
  const userTeamId = teams[0].id;
  const opponentTeamId = teams[1].id;
  const currentPickNumber = userPlayerIds.length + opponentPlayerIds.length + 1;
  let userPlayerIndex = 0;
  let opponentPlayerIndex = 0;
  const picks = generateSnakeDraftOrder(teamCount, rounds).map((pick) => {
    if (pick.pickNumber >= currentPickNumber) {
      return pick;
    }

    if (pick.teamId === userTeamId) {
      const playerId = userPlayerIds[userPlayerIndex];
      userPlayerIndex += 1;

      if (!playerId) {
        throw new Error(`Missing user player for completed pick ${pick.pickNumber}`);
      }

      return { ...pick, playerId };
    }

    if (pick.teamId === opponentTeamId) {
      const playerId = opponentPlayerIds[opponentPlayerIndex];
      opponentPlayerIndex += 1;

      if (!playerId) {
        throw new Error(`Missing opponent player for completed pick ${pick.pickNumber}`);
      }

      return { ...pick, playerId };
    }

    return pick;
  });

  return {
    id: "scenario-draft",
    teamCount,
    rounds,
    userTeamId,
    currentPickNumber,
    teams,
    picks,
  };
}

function createScenarioInput(draft: Draft, rankings: RankingEntry[]): RecommendationInput {
  return {
    draft,
    rankings,
    leagueSettings: {
      ...defaultLeagueSettings,
      teamCount: draft.teamCount,
      rounds: draft.rounds,
    },
    userTeamId: draft.userTeamId,
  };
}

function createDraftedRankings(
  players: DraftedScenarioPlayer[],
  startingOverallRank: number,
): RankingEntry[] {
  return players.map((player, index) => {
    return createScenarioRanking(
      player.id,
      startingOverallRank + index,
      player.position,
      index + 1,
    );
  });
}

function createOpponentPlayers(count: number, prefix: string): DraftedScenarioPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    position: "TE" as const,
  }));
}

function getRecommendation(
  recommendations: PlayerRecommendation[],
  playerId: string,
): PlayerRecommendation {
  const recommendation = recommendations.find((candidate) => candidate.playerId === playerId);

  expect(recommendation, `Expected recommendation for ${playerId}`).toBeDefined();

  return recommendation as PlayerRecommendation;
}

function getRecommendationIndex(recommendations: PlayerRecommendation[], playerId: string) {
  const index = recommendations.findIndex((recommendation) => {
    return recommendation.playerId === playerId;
  });

  expect(index, `Expected recommendation index for ${playerId}`).toBeGreaterThanOrEqual(0);

  return index;
}

function expectPlayerBefore(
  recommendations: PlayerRecommendation[],
  higherPlayerId: string,
  lowerPlayerId: string,
) {
  expect(getRecommendationIndex(recommendations, higherPlayerId)).toBeLessThan(
    getRecommendationIndex(recommendations, lowerPlayerId),
  );
}

function expectOnlyAvailablePlayers(recommendations: PlayerRecommendation[], draft: Draft) {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  expect(
    recommendations.every((recommendation) => !draftedPlayerIds.has(recommendation.playerId)),
  ).toBe(true);
}

function generateDeterministicScenario(
  input: RecommendationInput,
  limit: number,
): PlayerRecommendation[] {
  const firstRun = generatePlayerRecommendations(input, { limit });
  const secondRun = generatePlayerRecommendations(input, { limit });

  expect(secondRun).toEqual(firstRun);
  expectOnlyAvailablePlayers(firstRun, input.draft);

  return firstRun;
}

function getRosterFitComponent(recommendation: PlayerRecommendation) {
  const component = recommendation.components.find((candidate) => {
    return candidate.id === "roster_fit";
  });

  expect(component, `Expected roster_fit for ${recommendation.playerId}`).toBeDefined();

  return component;
}

function getScoreComponent(recommendation: PlayerRecommendation, componentId: string) {
  const component = recommendation.components.find((candidate) => {
    return candidate.id === componentId;
  });

  expect(component, `Expected ${componentId} for ${recommendation.playerId}`).toBeDefined();

  return component;
}

describe("recommendation roster construction scenarios", () => {
  it("promotes needed WRs after a heavy RB start while preserving elite RB value", () => {
    const userPlayers = Array.from({ length: 10 }, (_, index) => ({
      id: `drafted-user-rb-${index + 1}`,
      position: "RB" as const,
    }));
    const opponentPlayers = createOpponentPlayers(10, "drafted-opponent-heavy-rb");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("elite-rb", 1, "RB", 1),
      createScenarioRanking("ordinary-rb", 17, "RB", 2),
      createScenarioRanking("needed-wr", 18, "WR", 1),
      createScenarioRanking("nearby-wr-1", 19, "WR", 2),
      createScenarioRanking("nearby-wr-2", 20, "WR", 3),
      createScenarioRanking("nearby-wr-3", 21, "WR", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      10,
    );
    const eliteRunningBack = getRecommendation(recommendations, "elite-rb");
    const ordinaryRunningBack = getRecommendation(recommendations, "ordinary-rb");
    const neededWideReceiver = getRecommendation(recommendations, "needed-wr");

    expectPlayerBefore(recommendations, "elite-rb", "needed-wr");
    expectPlayerBefore(recommendations, "needed-wr", "ordinary-rb");
    expect(neededWideReceiver.reasons.map((reason) => reason.id)).toContain(
      "roster_fit:direct_starter_need",
    );
    expect(getRosterFitComponent(ordinaryRunningBack)).toMatchObject({
      delta: -12,
      direction: "negative",
      evidence: expect.objectContaining({ timing: "saturated" }),
    });
    expect(eliteRunningBack.reasons.at(-1)?.id).toBe("roster_fit:saturated");
  });

  it("promotes needed RBs after a heavy WR start while preserving elite WR value", () => {
    const userPlayers = Array.from({ length: 10 }, (_, index) => ({
      id: `drafted-user-wr-${index + 1}`,
      position: "WR" as const,
    }));
    const opponentPlayers = createOpponentPlayers(10, "drafted-opponent-heavy-wr");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("elite-wr", 1, "WR", 1),
      createScenarioRanking("ordinary-wr", 17, "WR", 2),
      createScenarioRanking("needed-rb", 18, "RB", 1),
      createScenarioRanking("nearby-rb-1", 19, "RB", 2),
      createScenarioRanking("nearby-rb-2", 20, "RB", 3),
      createScenarioRanking("nearby-rb-3", 21, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      10,
    );
    const eliteWideReceiver = getRecommendation(recommendations, "elite-wr");
    const ordinaryWideReceiver = getRecommendation(recommendations, "ordinary-wr");
    const neededRunningBack = getRecommendation(recommendations, "needed-rb");

    expectPlayerBefore(recommendations, "elite-wr", "needed-rb");
    expectPlayerBefore(recommendations, "needed-rb", "ordinary-wr");
    expect(neededRunningBack.reasons.map((reason) => reason.id)).toContain(
      "roster_fit:direct_starter_need",
    );
    expect(getRosterFitComponent(ordinaryWideReceiver)).toMatchObject({
      delta: -12,
      direction: "negative",
      evidence: expect.objectContaining({ timing: "saturated" }),
    });
    expect(eliteWideReceiver.reasons.at(-1)?.id).toBe("roster_fit:saturated");
  });

  it("does not let an open QB slot overcome a large early base-value gap", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "early-user-rb-1", position: "RB" },
      { id: "early-user-wr-1", position: "WR" },
      { id: "early-user-rb-2", position: "RB" },
      { id: "early-user-wr-2", position: "WR" },
    ];
    const opponentPlayers = createOpponentPlayers(4, "early-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("elite-rb", 1, "RB", 1),
      createScenarioRanking("early-qb", 40, "QB", 1),
      createScenarioRanking("nearby-early-qb-1", 41, "QB", 2),
      createScenarioRanking("nearby-early-qb-2", 42, "QB", 3),
      createScenarioRanking("nearby-early-qb-3", 43, "QB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      10,
    );
    const earlyQuarterback = getRecommendation(recommendations, "early-qb");

    expectPlayerBefore(recommendations, "elite-rb", "early-qb");
    expect(earlyQuarterback.reasons.map((reason) => reason.id)).toContain(
      "roster_fit:direct_starter_need",
    );
    expect(
      earlyQuarterback.reasons.some((reason) => reason.text.toLowerCase().includes("opponent")),
    ).toBe(false);
  });

  it("promotes a comparable QB in the middle rounds when its starter slot is open", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "middle-user-rb-1", position: "RB" },
      { id: "middle-user-wr-1", position: "WR" },
      { id: "middle-user-rb-2", position: "RB" },
      { id: "middle-user-wr-2", position: "WR" },
      { id: "middle-user-te-1", position: "TE" },
      { id: "middle-user-dst", position: "DST" },
      { id: "middle-user-k", position: "K" },
      { id: "middle-user-te-2", position: "TE" },
    ];
    const opponentPlayers = createOpponentPlayers(8, "middle-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("middle-rb", 29, "RB", 1),
      createScenarioRanking("middle-qb", 30, "QB", 1),
      createScenarioRanking("nearby-middle-rb-1", 31, "RB", 2),
      createScenarioRanking("nearby-middle-qb-1", 32, "QB", 2),
      createScenarioRanking("nearby-middle-qb-2", 33, "QB", 3),
      createScenarioRanking("nearby-middle-qb-3", 34, "QB", 4),
      createScenarioRanking("nearby-middle-rb-2", 35, "RB", 3),
      createScenarioRanking("nearby-middle-rb-3", 36, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const middleQuarterback = getRecommendation(recommendations, "middle-qb");
    const starterNeedReason = middleQuarterback.reasons.find((reason) => {
      return reason.id === "roster_fit:direct_starter_need";
    });

    expectPlayerBefore(recommendations, "middle-qb", "middle-rb");
    expect(starterNeedReason).toEqual(
      expect.objectContaining({ text: "Fills an open QB starter slot." }),
    );
  });

  it("de-emphasizes an ordinary backup QB after the starter slot is filled", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "filled-user-rb-1", position: "RB" },
      { id: "filled-user-wr-1", position: "WR" },
      { id: "filled-user-rb-2", position: "RB" },
      { id: "filled-user-wr-2", position: "WR" },
      { id: "filled-user-te-1", position: "TE" },
      { id: "filled-user-dst", position: "DST" },
      { id: "filled-user-k", position: "K" },
      { id: "filled-user-te-2", position: "TE" },
      { id: "filled-user-qb", position: "QB" },
    ];
    const opponentPlayers = createOpponentPlayers(9, "filled-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("backup-qb", 30, "QB", 1),
      createScenarioRanking("depth-rb", 31, "RB", 1),
      createScenarioRanking("nearby-backup-qb-1", 32, "QB", 2),
      createScenarioRanking("nearby-backup-qb-2", 33, "QB", 3),
      createScenarioRanking("nearby-backup-qb-3", 34, "QB", 4),
      createScenarioRanking("nearby-depth-rb-1", 35, "RB", 2),
      createScenarioRanking("nearby-depth-rb-2", 36, "RB", 3),
      createScenarioRanking("nearby-depth-rb-3", 37, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const backupQuarterback = getRecommendation(recommendations, "backup-qb");

    expectPlayerBefore(recommendations, "depth-rb", "backup-qb");
    expect(getRosterFitComponent(backupQuarterback)).toMatchObject({
      delta: -6,
      direction: "negative",
      evidence: expect.objectContaining({ timing: "limited_need" }),
    });
    expect(backupQuarterback.reasons.at(-1)?.id).toBe("roster_fit:limited_need");
    expect(recommendations.some((recommendation) => {
      return recommendation.playerId === "filled-user-qb";
    })).toBe(false);
  });
});

describe("recommendation urgency scenarios", () => {
  it("raises a roster-relevant WR after five consecutive observed WR picks", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "run-user-rb-1", position: "RB" },
      { id: "run-user-rb-2", position: "RB" },
      { id: "run-user-te", position: "TE" },
      { id: "run-user-wr-1", position: "WR" },
      { id: "run-user-wr-2", position: "WR" },
      { id: "run-user-wr-3", position: "WR" },
    ];
    const opponentPlayers: DraftedScenarioPlayer[] = [
      { id: "run-opponent-te-1", position: "TE" },
      { id: "run-opponent-te-2", position: "TE" },
      { id: "run-opponent-te-3", position: "TE" },
      { id: "run-opponent-te-4", position: "TE" },
      { id: "run-opponent-wr-1", position: "WR" },
      { id: "run-opponent-wr-2", position: "WR" },
    ];
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("control-rb", 19, "RB", 1),
      createScenarioRanking("run-wr", 20, "WR", 1),
      createScenarioRanking("nearby-run-wr-1", 21, "WR", 2),
      createScenarioRanking("nearby-run-wr-2", 22, "WR", 3),
      createScenarioRanking("nearby-run-wr-3", 23, "WR", 4),
      createScenarioRanking("nearby-control-rb-1", 24, "RB", 2),
      createScenarioRanking("nearby-control-rb-2", 25, "RB", 3),
      createScenarioRanking("nearby-control-rb-3", 26, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const runWideReceiver = getRecommendation(recommendations, "run-wr");
    const controlRunningBack = getRecommendation(recommendations, "control-rb");
    const runReason = runWideReceiver.reasons.find((reason) => {
      return reason.id === "positional_run:clear_run";
    });

    expect(draft.currentPickNumber).toBe(13);
    expect(draft.picks.slice(7, 12).every((pick) => {
      const ranking = rankings.find((candidate) => candidate.player.id === pick.playerId);

      return ranking?.player.position === "WR";
    })).toBe(true);
    expectPlayerBefore(recommendations, "run-wr", "control-rb");
    expect(getRosterFitComponent(runWideReceiver)).toMatchObject({
      delta: 5,
      evidence: expect.objectContaining({ timing: "flex_need" }),
    });
    expect(getRosterFitComponent(controlRunningBack)).toMatchObject({
      delta: 5,
      evidence: expect.objectContaining({ timing: "flex_need" }),
    });
    expect(getScoreComponent(runWideReceiver, "positional_run")).toMatchObject({
      delta: 4,
      direction: "positive",
      evidence: expect.objectContaining({
        recentPositionPickCount: 5,
        thresholdMatched: "clear_run",
      }),
    });
    expect(getScoreComponent(controlRunningBack, "positional_run")).toMatchObject({
      delta: 0,
      direction: "neutral",
    });
    expect(runReason).toEqual(
      expect.objectContaining({
        text: "5 WR players were drafted in the last 12 picks.",
      }),
    );
    expect(runReason?.text.toLowerCase()).not.toContain("opponent");
    expect(runReason?.text.toLowerCase()).not.toContain("will");
  });

  it("gates an observed WR run when the position is already solved", () => {
    const userPlayers = Array.from({ length: 10 }, (_, index) => ({
      id: `solved-run-user-wr-${index + 1}`,
      position: "WR" as const,
    }));
    const opponentPlayers = Array.from({ length: 10 }, (_, index) => ({
      id: `solved-run-opponent-wr-${index + 1}`,
      position: "WR" as const,
    }));
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("solved-wr", 20, "WR", 1),
      createScenarioRanking("needed-rb", 21, "RB", 1),
      createScenarioRanking("nearby-solved-wr-1", 22, "WR", 2),
      createScenarioRanking("nearby-solved-wr-2", 23, "WR", 3),
      createScenarioRanking("nearby-solved-wr-3", 24, "WR", 4),
      createScenarioRanking("nearby-needed-rb-1", 25, "RB", 2),
      createScenarioRanking("nearby-needed-rb-2", 26, "RB", 3),
      createScenarioRanking("nearby-needed-rb-3", 27, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const solvedWideReceiver = getRecommendation(recommendations, "solved-wr");

    expectPlayerBefore(recommendations, "needed-rb", "solved-wr");
    expect(getRosterFitComponent(solvedWideReceiver)).toMatchObject({
      delta: -12,
      direction: "negative",
      evidence: expect.objectContaining({ timing: "saturated" }),
    });
    expect(getScoreComponent(solvedWideReceiver, "positional_run")).toMatchObject({
      delta: 0,
      direction: "neutral",
      evidence: expect.objectContaining({
        recentPositionPickCount: 12,
        thresholdMatched: "roster_irrelevant",
      }),
    });
    expect(solvedWideReceiver.reasons.some((reason) => {
      return reason.sourceComponentId === "positional_run";
    })).toBe(false);
    expect(solvedWideReceiver.reasons.at(-1)?.id).toBe("roster_fit:saturated");
  });

  it("raises a last-tier RB above a close peer without passing an elite WR", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "tier-user-rb-1", position: "RB" },
      { id: "tier-user-wr-1", position: "WR" },
      { id: "tier-user-rb-2", position: "RB" },
      { id: "tier-user-wr-2", position: "WR" },
    ];
    const opponentPlayers = createOpponentPlayers(4, "tier-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("elite-wr", 1, "WR", 1, 1),
      createScenarioRanking("control-wr", 19, "WR", 2, 1),
      createScenarioRanking("tier-rb", 20, "RB", 1, 1),
      createScenarioRanking("nearby-tier-wr-1", 21, "WR", 3, 1),
      createScenarioRanking("nearby-tier-wr-2", 22, "WR", 4, 1),
      createScenarioRanking("nearby-tier-wr-3", 23, "WR", 5, 1),
      createScenarioRanking("next-tier-rb", 35, "RB", 2, 3),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const tierRunningBack = getRecommendation(recommendations, "tier-rb");
    const controlWideReceiver = getRecommendation(recommendations, "control-wr");
    const tierReason = tierRunningBack.reasons.find((reason) => {
      return reason.id === "tier_cliff:major_tier_cliff";
    });

    expectPlayerBefore(recommendations, "elite-wr", "tier-rb");
    expectPlayerBefore(recommendations, "tier-rb", "control-wr");
    expect(getRosterFitComponent(tierRunningBack).delta).toBe(
      getRosterFitComponent(controlWideReceiver).delta,
    );
    expect(getScoreComponent(tierRunningBack, "tier_cliff")).toMatchObject({
      delta: 12,
      direction: "positive",
      evidence: expect.objectContaining({
        sameTierRemaining: 1,
        tierGap: 2,
        thresholdMatched: "major_tier_cliff",
      }),
    });
    expect(getScoreComponent(controlWideReceiver, "tier_cliff")).toMatchObject({
      delta: 0,
      direction: "neutral",
    });
    expect(tierReason).toEqual(
      expect.objectContaining({ text: "A major RB tier drop follows." }),
    );
    expect(tierReason?.text.toLowerCase()).not.toContain("opponent");
    expect(tierReason?.text.toLowerCase()).not.toContain("will");
  });
});

describe("late-roster recommendation scenarios", () => {
  it("keeps filled RB and WR positions relevant while FLEX slots remain open", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "flex-user-qb", position: "QB" },
      { id: "flex-user-rb-1", position: "RB" },
      { id: "flex-user-rb-2", position: "RB" },
      { id: "flex-user-wr-1", position: "WR" },
      { id: "flex-user-wr-2", position: "WR" },
      { id: "flex-user-te", position: "TE" },
    ];
    const opponentPlayers = createOpponentPlayers(6, "flex-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("backup-qb", 18, "QB", 1),
      createScenarioRanking("flex-rb", 19, "RB", 1),
      createScenarioRanking("flex-wr", 20, "WR", 1),
      createScenarioRanking("nearby-flex-rb-1", 21, "RB", 2),
      createScenarioRanking("nearby-flex-wr-1", 22, "WR", 2),
      createScenarioRanking("nearby-flex-rb-2", 23, "RB", 3),
      createScenarioRanking("nearby-flex-wr-2", 24, "WR", 3),
      createScenarioRanking("nearby-flex-rb-3", 25, "RB", 4),
      createScenarioRanking("nearby-flex-wr-3", 26, "WR", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      12,
    );
    const flexRunningBack = getRecommendation(recommendations, "flex-rb");
    const flexWideReceiver = getRecommendation(recommendations, "flex-wr");
    const backupQuarterback = getRecommendation(recommendations, "backup-qb");

    expect(draft.currentPickNumber).toBe(13);
    expectPlayerBefore(recommendations, "flex-rb", "backup-qb");
    expectPlayerBefore(recommendations, "flex-wr", "backup-qb");

    for (const flexCandidate of [flexRunningBack, flexWideReceiver]) {
      expect(getRosterFitComponent(flexCandidate)).toMatchObject({
        delta: 5,
        direction: "positive",
        evidence: expect.objectContaining({ timing: "flex_need" }),
      });
      expect(flexCandidate.reasons.map((reason) => reason.id)).toContain(
        "roster_fit:flex_need",
      );
    }

    expect(getRosterFitComponent(backupQuarterback)).toMatchObject({
      delta: -6,
      direction: "negative",
      evidence: expect.objectContaining({ timing: "limited_need" }),
    });
    expect(backupQuarterback.reasons.at(-1)?.id).toBe("roster_fit:limited_need");
  });

  it("prefers useful RB and WR bench depth over low-impact backups", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "bench-user-qb", position: "QB" },
      { id: "bench-user-rb-1", position: "RB" },
      { id: "bench-user-rb-2", position: "RB" },
      { id: "bench-user-rb-3", position: "RB" },
      { id: "bench-user-wr-1", position: "WR" },
      { id: "bench-user-wr-2", position: "WR" },
      { id: "bench-user-wr-3", position: "WR" },
      { id: "bench-user-te-1", position: "TE" },
      { id: "bench-user-te-2", position: "TE" },
      { id: "bench-user-dst", position: "DST" },
      { id: "bench-user-k", position: "K" },
    ];
    const opponentPlayers = createOpponentPlayers(11, "bench-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("backup-dst", 28, "DST", 1),
      createScenarioRanking("backup-qb", 29, "QB", 1),
      createScenarioRanking("bench-rb", 30, "RB", 1),
      createScenarioRanking("bench-wr", 31, "WR", 1),
      createScenarioRanking("nearby-bench-rb-1", 32, "RB", 2),
      createScenarioRanking("nearby-bench-wr-1", 33, "WR", 2),
      createScenarioRanking("nearby-bench-rb-2", 34, "RB", 3),
      createScenarioRanking("nearby-bench-wr-2", 35, "WR", 3),
      createScenarioRanking("nearby-bench-rb-3", 36, "RB", 4),
      createScenarioRanking("nearby-bench-wr-3", 37, "WR", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      14,
    );
    const benchRunningBack = getRecommendation(recommendations, "bench-rb");
    const benchWideReceiver = getRecommendation(recommendations, "bench-wr");
    const backupQuarterback = getRecommendation(recommendations, "backup-qb");
    const backupDefense = getRecommendation(recommendations, "backup-dst");

    expect(draft.currentPickNumber).toBe(23);

    for (const depthPlayerId of ["bench-rb", "bench-wr"]) {
      expectPlayerBefore(recommendations, depthPlayerId, "backup-qb");
      expectPlayerBefore(recommendations, depthPlayerId, "backup-dst");
    }

    for (const depthCandidate of [benchRunningBack, benchWideReceiver]) {
      expect(getRosterFitComponent(depthCandidate)).toMatchObject({
        delta: 3,
        direction: "positive",
        evidence: expect.objectContaining({ timing: "bench_depth" }),
      });
      expect(depthCandidate.reasons.map((reason) => reason.id)).toContain(
        "roster_fit:bench_depth",
      );
    }

    for (const backupCandidate of [backupQuarterback, backupDefense]) {
      expect(getRosterFitComponent(backupCandidate)).toMatchObject({
        delta: -6,
        direction: "negative",
        evidence: expect.objectContaining({ timing: "limited_need" }),
      });
    }

    expect(backupDefense.reasons.at(-1)?.id).toBe("roster_fit:limited_need");
  });

  it("promotes empty DEF and K starter slots after the late threshold", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "late-open-user-qb", position: "QB" },
      { id: "late-open-user-rb-1", position: "RB" },
      { id: "late-open-user-rb-2", position: "RB" },
      { id: "late-open-user-rb-3", position: "RB" },
      { id: "late-open-user-rb-4", position: "RB" },
      { id: "late-open-user-wr-1", position: "WR" },
      { id: "late-open-user-wr-2", position: "WR" },
      { id: "late-open-user-wr-3", position: "WR" },
      { id: "late-open-user-wr-4", position: "WR" },
      { id: "late-open-user-te-1", position: "TE" },
      { id: "late-open-user-te-2", position: "TE" },
    ];
    const opponentPlayers = createOpponentPlayers(11, "late-open-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("extra-rb", 28, "RB", 1),
      createScenarioRanking("needed-dst", 29, "DST", 1),
      createScenarioRanking("needed-k", 30, "K", 1),
      createScenarioRanking("nearby-extra-rb-1", 31, "RB", 2),
      createScenarioRanking("nearby-extra-rb-2", 32, "RB", 3),
      createScenarioRanking("nearby-extra-rb-3", 33, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      10,
    );
    const extraRunningBack = getRecommendation(recommendations, "extra-rb");
    const neededDefense = getRecommendation(recommendations, "needed-dst");
    const neededKicker = getRecommendation(recommendations, "needed-k");

    expect(draft.currentPickNumber).toBe(23);
    expectPlayerBefore(recommendations, "needed-dst", "extra-rb");
    expectPlayerBefore(recommendations, "needed-k", "extra-rb");
    expect(getRosterFitComponent(extraRunningBack)).toMatchObject({
      delta: 3,
      direction: "positive",
      evidence: expect.objectContaining({ timing: "bench_depth" }),
    });

    for (const [candidate, expectedText] of [
      [neededDefense, "Fills an open DST starter slot."],
      [neededKicker, "Fills an open K starter slot."],
    ] as const) {
      expect(getRosterFitComponent(candidate)).toMatchObject({
        delta: 10,
        direction: "positive",
        evidence: expect.objectContaining({ timing: "direct_starter_need" }),
      });
      expect(candidate.reasons).toContainEqual(
        expect.objectContaining({
          id: "roster_fit:direct_starter_need",
          text: expectedText,
        }),
      );
    }
  });

  it("drops backup DEF and K below useful depth after their slots are filled", () => {
    const userPlayers: DraftedScenarioPlayer[] = [
      { id: "late-filled-user-qb", position: "QB" },
      { id: "late-filled-user-rb-1", position: "RB" },
      { id: "late-filled-user-rb-2", position: "RB" },
      { id: "late-filled-user-rb-3", position: "RB" },
      { id: "late-filled-user-rb-4", position: "RB" },
      { id: "late-filled-user-wr-1", position: "WR" },
      { id: "late-filled-user-wr-2", position: "WR" },
      { id: "late-filled-user-wr-3", position: "WR" },
      { id: "late-filled-user-wr-4", position: "WR" },
      { id: "late-filled-user-te-1", position: "TE" },
      { id: "late-filled-user-te-2", position: "TE" },
      { id: "late-filled-user-dst", position: "DST" },
      { id: "late-filled-user-k", position: "K" },
    ];
    const opponentPlayers = createOpponentPlayers(13, "late-filled-opponent");
    const draft = createScenarioDraft({
      userPlayerIds: userPlayers.map((player) => player.id),
      opponentPlayerIds: opponentPlayers.map((player) => player.id),
    });
    const rankings = [
      ...createDraftedRankings(userPlayers, 200),
      ...createDraftedRankings(opponentPlayers, 300),
      createScenarioRanking("backup-dst", 29, "DST", 1),
      createScenarioRanking("backup-k", 30, "K", 1),
      createScenarioRanking("depth-rb", 31, "RB", 1),
      createScenarioRanking("nearby-depth-rb-1", 32, "RB", 2),
      createScenarioRanking("nearby-depth-rb-2", 33, "RB", 3),
      createScenarioRanking("nearby-depth-rb-3", 34, "RB", 4),
    ];

    const recommendations = generateDeterministicScenario(
      createScenarioInput(draft, rankings),
      10,
    );
    const backupDefense = getRecommendation(recommendations, "backup-dst");
    const backupKicker = getRecommendation(recommendations, "backup-k");
    const depthRunningBack = getRecommendation(recommendations, "depth-rb");

    expect(draft.currentPickNumber).toBe(27);
    expectPlayerBefore(recommendations, "depth-rb", "backup-dst");
    expectPlayerBefore(recommendations, "depth-rb", "backup-k");
    expect(getRosterFitComponent(depthRunningBack)).toMatchObject({
      delta: 3,
      direction: "positive",
      evidence: expect.objectContaining({ timing: "bench_depth" }),
    });
    expect(depthRunningBack.reasons.map((reason) => reason.id)).toContain(
      "roster_fit:bench_depth",
    );

    for (const backupCandidate of [backupDefense, backupKicker]) {
      expect(getRosterFitComponent(backupCandidate)).toMatchObject({
        delta: -6,
        direction: "negative",
        evidence: expect.objectContaining({ timing: "limited_need" }),
      });
      expect(backupCandidate.reasons.at(-1)?.id).toBe("roster_fit:limited_need");
    }

    expect(recommendations.some((recommendation) => {
      return recommendation.playerId === "late-filled-user-dst";
    })).toBe(false);
    expect(recommendations.some((recommendation) => {
      return recommendation.playerId === "late-filled-user-k";
    })).toBe(false);
  });
});
