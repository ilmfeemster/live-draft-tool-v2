import { describe, expect, it } from "vitest";
import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import type { Draft } from "@/types/draft";

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

describe("draftPlayerInDraft", () => {
  it("drafts a player into the current pick", () => {
    const draft = createTestDraft();
    const result = draftPlayerInDraft(draft, "player-1");

    expect(result).not.toBe(draft);
    expect(result.currentPickNumber).toBe(2);
    expect(result.picks[0].playerId).toBe("player-1");
    expect(draft.picks[0].playerId).toBeUndefined();
  });

  it("caps the current pick number at the final pick", () => {
    const draft = createTestDraft({ currentPickNumber: 4 });
    const result = draftPlayerInDraft(draft, "player-4");

    expect(result).not.toBe(draft);
    expect(result.currentPickNumber).toBe(4);
    expect(result.picks[3].playerId).toBe("player-4");
  });

  it("blocks duplicate player IDs", () => {
    const draft = createTestDraft({
      currentPickNumber: 2,
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

    expect(draftPlayerInDraft(draft, "player-1")).toBe(draft);
  });

  it("blocks drafting over a filled current pick", () => {
    const draft = createTestDraft({
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

    expect(draftPlayerInDraft(draft, "player-2")).toBe(draft);
  });

  it("blocks drafting when the current pick does not exist", () => {
    const draft = createTestDraft({ currentPickNumber: 99 });

    expect(draftPlayerInDraft(draft, "player-1")).toBe(draft);
  });

  it("blocks drafting after the draft is complete", () => {
    const draft = createTestDraft({
      currentPickNumber: 4,
      picks: generateSnakeDraftOrder(2, 2).map((pick) => ({
        ...pick,
        playerId: `player-${pick.pickNumber}`,
      })),
    });

    expect(draftPlayerInDraft(draft, "player-5")).toBe(draft);
  });
});

describe("undoLastDraftPick", () => {
  it("clears only the latest drafted pick", () => {
    const draft = createTestDraft({
      currentPickNumber: 3,
      picks: generateSnakeDraftOrder(2, 2).map((pick) => {
        if (pick.pickNumber === 1) {
          return {
            ...pick,
            playerId: "player-1",
          };
        }

        if (pick.pickNumber === 2) {
          return {
            ...pick,
            playerId: "player-2",
          };
        }

        return pick;
      }),
    });
    const result = undoLastDraftPick(draft);

    expect(result).not.toBe(draft);
    expect(result.currentPickNumber).toBe(2);
    expect(result.picks[0].playerId).toBe("player-1");
    expect(result.picks[1].playerId).toBeUndefined();
    expect(draft.picks[1].playerId).toBe("player-2");
  });

  it("leaves an empty draft unchanged", () => {
    const draft = createTestDraft();

    expect(undoLastDraftPick(draft)).toBe(draft);
  });

  it("undoes the final pick after a draft is complete", () => {
    const completedDraft = createTestDraft({
      currentPickNumber: 4,
      picks: generateSnakeDraftOrder(2, 2).map((pick) => ({
        ...pick,
        playerId: `player-${pick.pickNumber}`,
      })),
    });
    const result = undoLastDraftPick(completedDraft);

    expect(result).not.toBe(completedDraft);
    expect(result.currentPickNumber).toBe(4);
    expect(result.picks[0].playerId).toBe("player-1");
    expect(result.picks[1].playerId).toBe("player-2");
    expect(result.picks[2].playerId).toBe("player-3");
    expect(result.picks[3].playerId).toBeUndefined();
    expect(completedDraft.picks[3].playerId).toBe("player-4");
  });
});
