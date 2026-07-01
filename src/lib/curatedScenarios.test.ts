import { describe, expect, it } from "vitest";
import {
  CURATED_SCENARIO_IDS,
  curatedScenarioCatalog,
  loadCuratedScenario,
  type CuratedScenarioId,
} from "@/lib/curatedScenarios";
import { isValidDraftState } from "@/lib/draftInvariants";
import type {
  Draft,
  PlayerRecommendation,
  RankingEntry,
} from "@/types/draft";

describe("curated scenario library", () => {
  it("has stable unique catalog IDs", () => {
    expect(CURATED_SCENARIO_IDS).toEqual([
      "early-non-default-pressure",
      "completed-draft",
    ]);
    expect(new Set(CURATED_SCENARIO_IDS).size).toBe(CURATED_SCENARIO_IDS.length);
    expect(curatedScenarioCatalog.map((entry) => entry.id)).toEqual(
      CURATED_SCENARIO_IDS,
    );
  });

  it.each(CURATED_SCENARIO_IDS)(
    "loads %s through validation and replay with valid invariants",
    (id) => {
      const result = loadSuccessfulScenario(id);
      const availableRankings = getAvailableRankings(
        result.draft,
        result.scenario.rankingContext.rankings,
      );

      expect(result.scenario.schemaVersion).toBe(1);
      expect(result.scenario.metadata.id).toBe(id);
      expect(
        isValidDraftState({ draft: result.draft, availableRankings }),
      ).toBe(true);
      expect(result.scenario.pickHistory).toHaveLength(
        result.scenario.replayTarget.appliedPickCount,
      );
    },
  );

  it.each(CURATED_SCENARIO_IDS)(
    "replays %s deterministically into fresh values",
    (id) => {
      const first = loadSuccessfulScenario(id);
      const second = loadSuccessfulScenario(id);

      expect(first).toEqual(second);
      expect(first.scenario).not.toBe(second.scenario);
      expect(first.draft).not.toBe(second.draft);
      expect(first.recommendations).not.toBe(second.recommendations);
    },
  );

  it("reproduces the early non-default pressure case", () => {
    const result = loadSuccessfulScenario("early-non-default-pressure");
    const availablePlayerIds = getAvailableRankings(
      result.draft,
      result.scenario.rankingContext.rankings,
    ).map((ranking) => ranking.player.id);
    const primary = getRecommendation(result.recommendations, "target-rb");

    expect(result.scenario.leagueSettings).toMatchObject({
      teamCount: 4,
      rounds: 4,
    });
    expect(result.scenario.userTeamContext.userTeamId).toBe("team-4");
    expect(result.scenario.replayTarget.appliedPickCount).toBe(8);
    expect(result.draft.currentPickNumber).toBe(9);
    expect(getUserPickPlayerIds(result.draft)).toEqual(["user-qb", "user-wr"]);
    expect(availablePlayerIds).toEqual([
      "target-rb",
      "available-wr",
      "available-qb",
      "available-te",
      "available-dst",
      "available-k",
      "next-tier-rb",
      "depth-wr",
    ]);
    expect(result.recommendations[0].playerId).toBe("target-rb");
    expect(result.recommendations.findIndex((candidate) => {
      return candidate.playerId === "target-rb";
    })).toBe(0);
    expect(primary.totalScore).toBe(98.02943725152286);
    expect(primary.components.find((component) => component.id === "roster_fit"))
      .toMatchObject({ delta: 10 });
    expect(primary.components.find((component) => component.id === "positional_run"))
      .toMatchObject({ delta: 2 });
    expect(primary.components.find((component) => component.id === "tier_cliff"))
      .toBeUndefined();
    expect(primary.components.find((component) => component.id === "positional_scarcity"))
      .toMatchObject({ delta: 3 });
    expect(primary.reasons.map((reason) => reason.id)).toEqual([
      "roster_fit:direct_starter_need",
      "positional_scarcity:mild_scarcity",
      "base_value:overall_rank",
    ]);
  });

  it("reproduces the completed draft case", () => {
    const result = loadSuccessfulScenario("completed-draft");
    const capacity =
      result.scenario.leagueSettings.teamCount *
      result.scenario.leagueSettings.rounds;
    const assignedPlayerIds = result.draft.picks.map((pick) => pick.playerId);

    expect(capacity).toBe(4);
    expect(result.scenario.replayTarget.appliedPickCount).toBe(capacity);
    expect(result.draft.currentPickNumber).toBe(4);
    expect(assignedPlayerIds).toEqual([
      "complete-qb-1",
      "complete-rb",
      "complete-wr",
      "complete-qb-2",
    ]);
    expect(new Set(assignedPlayerIds).size).toBe(capacity);
    expect(
      getAvailableRankings(result.draft, result.scenario.rankingContext.rankings),
    ).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("keeps raw documents free of authoritative derived state", () => {
    for (const entry of curatedScenarioCatalog) {
      const document = JSON.parse(entry.json) as Record<string, unknown>;

      expect(document).not.toHaveProperty("draft");
      expect(document).not.toHaveProperty("rosters");
      expect(document).not.toHaveProperty("availablePlayers");
      expect(document).not.toHaveProperty("currentPickNumber");
      expect(document).not.toHaveProperty("recommendations");
    }
  });
});

type SuccessfulCuratedScenario = Extract<
  ReturnType<typeof loadCuratedScenario>,
  { ok: true }
>;

function loadSuccessfulScenario(
  id: CuratedScenarioId,
): SuccessfulCuratedScenario {
  const result = loadCuratedScenario(id);

  if (!result.ok) {
    throw new Error(`Expected ${id} to load: ${JSON.stringify(result)}`);
  }

  return result;
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

function getUserPickPlayerIds(draft: Draft): string[] {
  return draft.picks.flatMap((pick) => {
    if (pick.teamId !== draft.userTeamId || !pick.playerId) {
      return [];
    }

    return [pick.playerId];
  });
}

function getRecommendation(
  recommendations: PlayerRecommendation[],
  playerId: string,
): PlayerRecommendation {
  const recommendation = recommendations.find(
    (candidate) => candidate.playerId === playerId,
  );

  if (!recommendation) {
    throw new Error(`Expected recommendation for ${playerId}.`);
  }

  return recommendation;
}
