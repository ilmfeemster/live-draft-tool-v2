import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftSetupForm } from "@/components/DraftSetupForm";
import type { LeagueSetupValidationError } from "@/lib/leagueSetup";

describe("DraftSetupForm", () => {
  it("renders default configuration, constraints, and derived summary", () => {
    const markup = renderForm();

    expect(markup).toContain("New Draft Setup");
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
    expect(markup).not.toContain("<select");
  });

  it("renders field, roster, capacity, and form errors", () => {
    const errors: LeagueSetupValidationError[] = [
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

  it("disables controls and communicates pending creation", () => {
    const markup = renderForm({ isPending: true });

    expect(markup).toContain("Creating Draft...");
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
      rankingPlayerCount={500}
      isPending={false}
      serverErrors={[]}
      formError={null}
      onCancel={vi.fn()}
      onClearServerErrors={vi.fn()}
      onSubmit={vi.fn(async () => undefined)}
      {...overrides}
    />,
  );
}
