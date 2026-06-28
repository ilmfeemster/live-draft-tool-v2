import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftHistoryList } from "@/components/DraftHistoryList";
import type { DraftSummary } from "@/lib/draftRepository";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/draftActions", () => ({
  deleteDraftAction: vi.fn(),
}));

describe("DraftHistoryList", () => {
  it("renders active and completed groups with counts", () => {
    const markup = renderToStaticMarkup(
      <DraftHistoryList
        activeDraftId="active-1"
        summaries={[
          createSummary("active-1", "IN_PROGRESS", 2),
          createSummary("active-2", "NOT_STARTED", 0),
          createSummary("complete-1", "COMPLETE", 4),
        ]}
      />,
    );

    expect(markup).toContain("2 active / 1 complete");
    expect(markup).toContain("Active Drafts");
    expect(markup).toMatch(/<details[^>]*open=""/);
    expect(markup).toContain("<summary");
    expect(markup).toContain("Expand");
    expect(markup).toContain("Minimize");
    expect(markup).toContain("Completed Drafts (1)");
    expect(markup).toContain("active-1");
    expect(markup).toContain("active-2");
    expect(markup).toContain("complete-1");
    expect(markup).toContain("Loaded");
    expect(markup.match(/Delete Draft/g)).toHaveLength(3);
  });

  it("renders the empty history state", () => {
    const markup = renderToStaticMarkup(
      <DraftHistoryList activeDraftId="draft-1" summaries={[]} />,
    );

    expect(markup).toContain(
      "No saved drafts were listed before this workspace loaded.",
    );
    expect(markup).not.toContain("Delete Draft");
  });
});

function createSummary(
  id: string,
  status: DraftSummary["status"],
  draftedPickCount: number,
): DraftSummary {
  return {
    id,
    name: id,
    status,
    teamCount: 2,
    rounds: 2,
    userTeamId: "team-1",
    draftedPickCount,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  };
}
