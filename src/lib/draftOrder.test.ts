import { describe, expect, it } from "vitest";
import { generateSnakeDraftOrder } from "@/lib/draftOrder";

describe("generateSnakeDraftOrder", () => {
  it("creates a small snake draft order", () => {
    const picks = generateSnakeDraftOrder(2, 2);

    expect(picks).toHaveLength(4);
    expect(picks.map((pick) => pick.teamId)).toEqual([
      "team-1",
      "team-2",
      "team-2",
      "team-1",
    ]);
  });
});
