import { describe, expect, it, vi } from "vitest";
import { curatedScenarioCatalog } from "@/lib/curatedScenarios";
import { draftPlayerInDraft, undoLastDraftPick } from "@/lib/draftState";
import { generatePlayerRecommendations } from "@/lib/recommendations";
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
    expect(session.recommendations).toEqual(
      generateRecommendationsForSession(session),
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
    expect(nextSession.isDirty).toBe(true);
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
    };

    const result = resetTransientScenarioSession(corrupted);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected scenario reset to succeed.");
    }
    expect(result.session).toEqual(original);
    expect(result.session).not.toBe(original);
    expect(result.session.draft).not.toBe(original.draft);
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

function generateRecommendationsForSession(
  session: Pick<
    TransientScenarioSession,
    "draft" | "rankings" | "leagueSettings"
  >,
) {
  return generatePlayerRecommendations({
    draft: session.draft,
    rankings: session.rankings,
    leagueSettings: session.leagueSettings,
    userTeamId: session.draft.userTeamId,
  });
}
