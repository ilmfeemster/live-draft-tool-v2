import { describe, expect, it } from "vitest";
import { formatAutomaticDraftName } from "@/lib/draftNames";

describe("formatAutomaticDraftName", () => {
  it("formats afternoon draft names with date and time", () => {
    expect(formatAutomaticDraftName(new Date(2026, 5, 26, 17, 42))).toBe(
      "Draft - Jun 26, 2026, 5:42 PM",
    );
  });

  it("formats midnight as 12 AM", () => {
    expect(formatAutomaticDraftName(new Date(2026, 0, 2, 0, 5))).toBe(
      "Draft - Jan 2, 2026, 12:05 AM",
    );
  });

  it("formats noon as 12 PM", () => {
    expect(formatAutomaticDraftName(new Date(2026, 6, 4, 12, 0))).toBe(
      "Draft - Jul 4, 2026, 12:00 PM",
    );
  });

  it("zero-pads minutes", () => {
    expect(formatAutomaticDraftName(new Date(2026, 10, 9, 9, 7))).toBe(
      "Draft - Nov 9, 2026, 9:07 AM",
    );
  });
});
