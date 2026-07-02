import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  DraftSetupForm,
  type DraftSetupValidationError,
} from "@/components/DraftSetupForm";
import { MANAGED_SEED_RANKING_SET_ID } from "@/lib/managedSeedRankingSet";
import type { RankingSetSummary } from "@/types/rankings";

describe("DraftSetupForm", () => {
  it("renders default configuration, ranking selection, constraints, and derived summary", () => {
    const markup = renderForm();

    expect(markup).toContain("New Draft Setup");
    expect(markup).toContain('name="rankingSetId"');
    expect(markup).toContain("FantasyPros 2026 Seed Rankings");
    expect(markup).toContain("Selected Set");
    expect(markup).toContain("Seed");
    expect(markup).toContain("500");
    expect(markup).toContain("snapshotted for this draft");
    expect(markup).toMatch(
      new RegExp(
        `<option[^>]*value="${MANAGED_SEED_RANKING_SET_ID}"[^>]*selected=""`,
      ),
    );
    expect(markup).toContain('name="teamCount"');
    expect(markup).toContain('value="12"');
    expect(markup).toContain('name="userDraftPosition"');
    expect(markup).toContain('value="1"');

    const expectedRosterValues = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 2,
      DST: 1,
      K: 1,
      BENCH: 6,
    };

    for (const [category, count] of Object.entries(expectedRosterValues)) {
      expect(markup).toMatch(
        new RegExp(
          `<input[^>]*min="0"[^>]*max="30"[^>]*name="rosterSlotCounts\\.${category}"[^>]*value="${count}"`,
        ),
      );
    }

    expect(markup).toContain("Draft Type");
    expect(markup).toContain("Snake");
    expect(markup).toContain("Scoring");
    expect(markup).toContain("PPR");
    expect(markup).toContain("Rounds");
    expect(markup).toContain(">16<");
    expect(markup).toContain("Total Picks");
    expect(markup).toContain(">192<");
  });

  it("renders an empty choose state when the managed seed set is unavailable", () => {
    const markup = renderForm({
      rankingSummaries: [
        createRankingSummary({
          id: "alternate-rankings",
          name: "Alternate Rankings",
          sourceKind: "manual",
          entryCount: 42,
        }),
      ],
    });

    expect(markup).toContain("Choose a ranking set");
    expect(markup).toContain("Alternate Rankings - 42 players");
    expect(markup).toContain(
      "Choose the managed ranking set that should anchor this draft.",
    );
    expect(markup).not.toContain("Selected Set");
    expect(markup).not.toMatch(
      /<option[^>]*value="alternate-rankings"[^>]*selected=""/,
    );
  });

  it("disables creation when no ranking set summaries are available", () => {
    const markup = renderForm({ rankingSummaries: [] });

    expect(markup).toContain(
      "A managed ranking set is required before creating a draft.",
    );
    expect(markup).toMatch(/<select[^>]*name="rankingSetId"[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Create Draft<\/button>/);
  });

  it("renders capability warnings for safely degraded selected sets", () => {
    const markup = renderForm({
      rankingSummaries: [
        createRankingSummary({
          capabilities: {
            team: "partial",
            playerIdentity: "generated",
            overallOrder: "row-derived",
            positionRank: "derived",
            adp: "none",
            tiers: {
              QB: "defaulted-neutral",
              RB: "source",
              WR: "defaulted-neutral",
            },
          },
        }),
      ],
    });

    expect(markup).toContain(
      "Recommendation tier pressure is unavailable for QB, WR.",
    );
    expect(markup).not.toContain(
      "Recommendation tier pressure is unavailable for RB",
    );
    expect(markup).toContain("Team metadata is missing or partial.");
    expect(markup).toContain("ADP metadata is missing or partial.");
  });

  it("renders ranking, field, roster, capacity, and form errors", () => {
    const errors: DraftSetupValidationError[] = [
      { field: "rankingSetId", message: "Ranking set was not found." },
      { field: "rankingSet", message: "Ranking set name must be non-empty." },
      { field: "teamCount", message: "Team count error." },
      { field: "userDraftPosition", message: "Draft position error." },
      { field: "rosterSlotCounts.RB", message: "RB count error." },
      { field: "rosterSlotCounts", message: "Roster error." },
      { field: "rankingPlayerCount", message: "Capacity error." },
    ];
    const markup = renderForm({
      serverErrors: errors,
      formError: "Unable to create the configured draft.",
    });

    for (const error of errors) {
      expect(markup).toContain(error.message);
    }

    expect(markup).toContain("Unable to create the configured draft.");
    expect(markup).toContain('aria-invalid="true"');
  });

  it("renders selected-set capacity validation errors", () => {
    const markup = renderForm({
      serverErrors: [
        {
          field: "rankingPlayerCount",
          message: "Draft requires 192 players, but only 10 ranking players are available.",
        },
      ],
      rankingSummaries: [
        createRankingSummary({
          entryCount: 10,
        }),
      ],
    });

    expect(markup).toContain(
      "Draft requires 192 players, but only 10 ranking players are available.",
    );
    expect(markup).toContain(">10<");
  });

  it("disables controls and communicates pending creation", () => {
    const markup = renderForm({ isPending: true });

    expect(markup).toContain("Creating Draft...");
    expect(markup).toMatch(/<select[^>]*name="rankingSetId"[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Creating Draft\.\.\.<\/button>/);
    expect(markup).toMatch(
      /<input[^>]*type="number"[^>]*disabled=""[^>]*name="teamCount"/,
    );
  });
});

function renderForm(
  overrides: Partial<Parameters<typeof DraftSetupForm>[0]> = {},
) {
  return renderToStaticMarkup(
    <DraftSetupForm
      defaultRankingSetId={MANAGED_SEED_RANKING_SET_ID}
      isPending={false}
      rankingSummaries={[createRankingSummary()]}
      serverErrors={[]}
      formError={null}
      onCancel={vi.fn()}
      onClearServerErrors={vi.fn()}
      onSubmit={vi.fn(async () => undefined)}
      {...overrides}
    />,
  );
}

function createRankingSummary(
  overrides: Partial<RankingSetSummary> = {},
): RankingSetSummary {
  const timestamp = new Date("2026-06-30T12:00:00.000Z");

  return {
    id: MANAGED_SEED_RANKING_SET_ID,
    name: "FantasyPros 2026 Seed Rankings",
    sourceKind: "seed",
    entryCount: 500,
    capabilities: {
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
        DST: "source",
        K: "source",
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
