import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  findDraftInvariantViolations,
  isValidDraftState,
} from "@/lib/draftInvariants";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import type { Draft, Position, RankingEntry, UserRosterPlayer } from "@/types/draft";

function createTestDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "test-draft",
    teamCount: 2,
    rounds: 2,
    userTeamId: "team-1",
    currentPickNumber: 1,
    teams: createDraftTeams(2),
    picks: generateSnakeDraftOrder(2, 2),
    ...overrides,
  };
}

function createRanking(
  id: string,
  name = id,
  position: Position = "RB",
): RankingEntry {
  return {
    player: {
      id,
      name,
      team: "TEST",
      position,
    },
    overallRank: 1,
    adpRank: null,
    positionRank: 1,
    tier: 1,
  };
}

describe("findDraftInvariantViolations", () => {
  it("accepts a valid empty draft", () => {
    const draft = createTestDraft();

    expect(isValidDraftState({ draft })).toBe(true);
    expect(findDraftInvariantViolations({ draft })).toEqual([]);
  });

  it("accepts a draft after a valid pick", () => {
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");

    expect(isValidDraftState({ draft })).toBe(true);
    expect(findDraftInvariantViolations({ draft })).toEqual([]);
  });

  it("accepts a draft after picks and undo", () => {
    const afterFirstPick = draftPlayerInDraft(createTestDraft(), "player-1");
    const afterSecondPick = draftPlayerInDraft(afterFirstPick, "player-2");
    const afterUndo = undoLastDraftPick(afterSecondPick);

    expect(afterUndo.currentPickNumber).toBe(2);
    expect(isValidDraftState({ draft: afterUndo })).toBe(true);
    expect(findDraftInvariantViolations({ draft: afterUndo })).toEqual([]);
  });

  it("detects duplicate drafted player IDs", () => {
    const draft = createTestDraft({
      currentPickNumber: 3,
      picks: generateSnakeDraftOrder(2, 2).map((pick) => {
        if (pick.pickNumber === 1 || pick.pickNumber === 2) {
          return {
            ...pick,
            playerId: "player-1",
          };
        }

        return pick;
      }),
    });

    expect(findDraftInvariantViolations({ draft })).toContain(
      "duplicate-drafted-player",
    );
  });

  it("detects drafted count mismatch", () => {
    const draft = createTestDraft({
      currentPickNumber: 3,
      picks: generateSnakeDraftOrder(2, 2).map((pick) => {
        if (pick.pickNumber !== 1) {
          return pick;
        }

        return {
          ...pick,
          playerId: "player-1",
        };
      }),
    });

    expect(findDraftInvariantViolations({ draft })).toContain(
      "drafted-count-mismatch",
    );
  });

  it("detects drafted players in available rankings", () => {
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");
    const availableRankings = [createRanking("player-1")];

    expect(findDraftInvariantViolations({ draft, availableRankings })).toContain(
      "drafted-player-available",
    );
  });

  it("detects available players on the roster", () => {
    const draft = createTestDraft();
    const availableRankings = [createRanking("player-1", "Player One")];
    const rosterPlayers: UserRosterPlayer[] = [
      {
        pickNumber: 1,
        name: "Player One",
        team: "TEST",
        position: "RB",
      },
    ];

    expect(
      findDraftInvariantViolations({ draft, availableRankings, rosterPlayers }),
    ).toContain("available-player-on-roster");
  });

  it("detects recommendation rankings containing unavailable players", () => {
    const draft = createTestDraft();
    const availableRankings = [createRanking("player-1")];
    const recommendationRankings = [createRanking("player-2")];

    expect(
      findDraftInvariantViolations({
        draft,
        availableRankings,
        recommendationRankings,
      }),
    ).toContain("recommendation-player-unavailable");
  });

  it("does not mutate the draft", () => {
    const draft = draftPlayerInDraft(createTestDraft(), "player-1");
    const originalPick = draft.picks[0];

    findDraftInvariantViolations({ draft });

    expect(draft.picks[0]).toBe(originalPick);
    expect(draft.picks[0].playerId).toBe("player-1");
  });
});
