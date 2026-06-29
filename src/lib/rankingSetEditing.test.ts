import { describe, expect, expectTypeOf, it } from "vitest";
import {
  editRankingSet,
  type RankingSetEditRequest,
  type RankingSetEditResult,
} from "@/lib/rankingSetEditing";
import {
  validateRankingSet,
  type RankingSetValidationResult,
} from "@/lib/rankingSetValidation";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSnapshot,
} from "@/types/rankings";

const originalUpdatedAt = new Date("2026-06-28T12:00:00.000Z");
const editTimestamp = new Date("2026-06-28T13:00:00.000Z");

describe("editRankingSet", () => {
  it("renames with new ownership while preserving all other values", () => {
    const source = createSet();
    const before = structuredClone(source);
    const result = editRankingSet(source, request({ type: "rename", name: " New Name " }));

    expectSuccess(result);
    expect(result.rankingSet.name).toBe(" New Name ");
    expect(result.rankingSet.id).toBe(source.id);
    expect(result.rankingSet.source).toEqual(source.source);
    expect(result.rankingSet.capabilities).toEqual(source.capabilities);
    expect(result.rankingSet.entries).toEqual(source.entries);
    expect(result.rankingSet.createdAt).toEqual(source.createdAt);
    expect(result.rankingSet.updatedAt).toEqual(editTimestamp);
    expect(result.rankingSet.updatedAt).not.toBe(editTimestamp);
    expect(source).toEqual(before);
    expectDomainSuccess(validateRankingSet(result.rankingSet));
  });

  it.each(["", "   ", 4])("rejects invalid rename %j", (name) => {
    const result = editRankingSet(
      createSet(),
      request({ type: "rename", name: name as string }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-intent");
  });

  it("corrects player fields and derives partial team and ADP capabilities", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: {
          name: "Corrected QB",
          team: UNKNOWN_TEAM,
          adpRank: null,
        },
      }),
    );

    expectSuccess(result);
    expect(result.rankingSet.entries[0]).toEqual(
      expect.objectContaining({
        player: expect.objectContaining({
          id: "qb-1",
          name: "Corrected QB",
          team: UNKNOWN_TEAM,
        }),
        adpRank: null,
      }),
    );
    expect(result.rankingSet.capabilities.team).toBe("partial");
    expect(result.rankingSet.capabilities.adp).toBe("partial");
  });

  it("derives none availability for a one-player correction", () => {
    const source = createSet({
      entries: [createEntry("qb-1", 1, "QB", 1, 1)],
      capabilities: createCapabilities({ tiers: { QB: "source" } }),
    });
    const result = editRankingSet(
      source,
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: { team: UNKNOWN_TEAM, adpRank: null },
      }),
    );

    expectSuccess(result);
    expect(result.rankingSet.capabilities.team).toBe("none");
    expect(result.rankingSet.capabilities.adp).toBe("none");
  });

  it("updates generated identity capability conservatively after ID correction", () => {
    const generated = createSet({
      capabilities: createCapabilities({ playerIdentity: "generated" }),
    });
    const multiple = editRankingSet(
      generated,
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: { id: "corrected-qb" },
      }),
    );
    expectSuccess(multiple);
    expect(multiple.rankingSet.capabilities.playerIdentity).toBe("mixed");

    const singleSource = createSet({
      entries: [createEntry("qb-1", 1, "QB", 1, 1)],
      capabilities: createCapabilities({
        playerIdentity: "generated",
        tiers: { QB: "source" },
      }),
    });
    const single = editRankingSet(
      singleSource,
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: { id: "provided-qb" },
      }),
    );
    expectSuccess(single);
    expect(single.rankingSet.capabilities.playerIdentity).toBe("provided");
  });

  it("rejects a duplicate corrected identity through complete validation", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: { id: "rb-1" },
      }),
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "edit-invariant-failed",
      message: "Player ID rb-1 appears more than once.",
      path: "entries[1].player.id",
    });
  });

  it("corrects position and recalculates affected position ranks", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "rb-1",
        changes: { position: "QB", tier: 2 },
      }),
    );

    expectSuccess(result);
    expect(
      result.rankingSet.entries.map((entry) => ({
        id: entry.player.id,
        position: entry.player.position,
        overallRank: entry.overallRank,
        positionRank: entry.positionRank,
        tier: entry.tier,
      })),
    ).toEqual([
      { id: "qb-1", position: "QB", overallRank: 1, positionRank: 1, tier: 1 },
      { id: "rb-1", position: "QB", overallRank: 2, positionRank: 2, tier: 2 },
      { id: "qb-2", position: "QB", overallRank: 3, positionRank: 3, tier: 2 },
      { id: "wr-1", position: "WR", overallRank: 4, positionRank: 1, tier: 1 },
    ]);
    expect(result.rankingSet.capabilities.tiers).toEqual({
      QB: "source",
      WR: "source",
    });
  });

  it("adds source tier capability when correction introduces a position", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "wr-1",
        changes: { position: "TE", tier: 3 },
      }),
    );

    expectSuccess(result);
    expect(result.rankingSet.capabilities.tiers).toEqual({
      QB: "source",
      RB: "source",
      TE: "source",
    });
  });

  it("requires neutral tiers when correcting into a defaulted position", () => {
    const source = createSet({
      capabilities: createCapabilities({
        tiers: {
          QB: "defaulted-neutral",
          RB: "source",
          WR: "source",
        },
      }),
      entries: [
        createEntry("qb-1", 1, "QB", 1, NEUTRAL_TIER),
        createEntry("rb-1", 2, "RB", 1, 1),
        createEntry("qb-2", 3, "QB", 2, NEUTRAL_TIER),
        createEntry("wr-1", 4, "WR", 1, 1),
      ],
    });
    const result = editRankingSet(
      source,
      request({
        type: "correct-player",
        playerId: "rb-1",
        changes: { position: "QB", tier: 2 },
      }),
    );

    expectFailure(result);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "edit-invariant-failed",
        path: "capabilities.tiers.QB",
      }),
    );
  });

  it("rejects tier correction without an actual position change", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes: { position: "QB", tier: 2 },
      }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-player-correction");
  });

  it.each([
    {},
    { unknown: true },
  ])("rejects unsupported correction shape %j", (changes) => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "correct-player",
        playerId: "qb-1",
        changes,
      } as RankingSetEditRequest["intent"]),
    );
    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-player-correction");
  });

  it.each([
    ["rb-1", 4, ["qb-1", "qb-2", "wr-1", "rb-1"]],
    ["wr-1", 1, ["wr-1", "qb-1", "rb-1", "qb-2"]],
    ["rb-1", 2, ["qb-1", "rb-1", "qb-2", "wr-1"]],
  ])("reorders %s to rank %s", (playerId, toOverallRank, expectedIds) => {
    const result = editRankingSet(
      createSet(),
      request({ type: "reorder-player", playerId, toOverallRank }),
    );

    expectSuccess(result);
    expect(result.rankingSet.entries.map((entry) => entry.player.id)).toEqual(
      expectedIds,
    );
    expect(result.rankingSet.entries.map((entry) => entry.overallRank)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(result.rankingSet.capabilities.overallOrder).toBe("explicit");
  });

  it("rejects reorder that creates position-local tier regression", () => {
    const source = createSet();
    const before = structuredClone(source);
    const result = editRankingSet(
      source,
      request({ type: "reorder-player", playerId: "qb-2", toOverallRank: 1 }),
    );

    expectFailure(result);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "edit-invariant-failed", path: "entries[1].tier" }),
    );
    expect(source).toEqual(before);
  });

  it.each([0, 5, 1.5])("rejects invalid reorder rank %s", (toOverallRank) => {
    const result = editRankingSet(
      createSet(),
      request({ type: "reorder-player", playerId: "rb-1", toOverallRank }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-reorder");
  });

  it("assigns complete position tiers by identity and preserves gaps", () => {
    const result = editRankingSet(
      createSet(),
      request({
        type: "assign-position-tiers",
        position: "QB",
        assignments: [
          { playerId: "qb-2", tier: 6 },
          { playerId: "qb-1", tier: 2 },
        ],
      }),
    );

    expectSuccess(result);
    expect(
      result.rankingSet.entries
        .filter((entry) => entry.player.position === "QB")
        .map((entry) => entry.tier),
    ).toEqual([2, 6]);
    expect(result.rankingSet.capabilities.tiers.QB).toBe("source");
  });

  it("transitions complete neutral tiers to authored source tiers", () => {
    const source = createDegradedSet();
    const result = editRankingSet(
      source,
      request({
        type: "assign-position-tiers",
        position: "QB",
        assignments: [
          { playerId: "qb-1", tier: 1 },
          { playerId: "qb-2", tier: 4 },
        ],
      }),
    );

    expectSuccess(result);
    expect(result.rankingSet.capabilities.tiers.QB).toBe("source");
    expect(result.rankingSet.entries.map((entry) => entry.tier)).toEqual([1, 4]);
  });

  it.each([
    {
      name: "incomplete",
      assignments: [{ playerId: "qb-1", tier: 1 }],
    },
    {
      name: "duplicate",
      assignments: [
        { playerId: "qb-1", tier: 1 },
        { playerId: "qb-1", tier: 2 },
      ],
    },
    {
      name: "foreign",
      assignments: [
        { playerId: "qb-1", tier: 1 },
        { playerId: "rb-1", tier: 2 },
      ],
    },
    {
      name: "invalid tier",
      assignments: [
        { playerId: "qb-1", tier: 0 },
        { playerId: "qb-2", tier: 2 },
      ],
    },
    {
      name: "fractional tier",
      assignments: [
        { playerId: "qb-1", tier: 1.5 },
        { playerId: "qb-2", tier: 2 },
      ],
    },
    {
      name: "decreasing",
      assignments: [
        { playerId: "qb-1", tier: 3 },
        { playerId: "qb-2", tier: 2 },
      ],
    },
  ])("rejects $name tier assignment", ({ assignments }) => {
    const result = editRankingSet(
      createSet(),
      request({ type: "assign-position-tiers", position: "QB", assignments }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-tier-assignment");
  });

  it("rejects unsupported or unrepresented tier assignment positions", () => {
    const unsupported = editRankingSet(
      createSet(),
      request({
        type: "assign-position-tiers",
        position: "DL" as Position,
        assignments: [],
      }),
    );
    expectFailure(unsupported);
    expect(unsupported.errors[0]?.code).toBe("invalid-tier-assignment");

    const absent = editRankingSet(
      createSet(),
      request({ type: "assign-position-tiers", position: "TE", assignments: [] }),
    );
    expectFailure(absent);
    expect(absent.errors[0]?.code).toBe("invalid-tier-assignment");
  });

  it("updates one source tier and rejects invalid progression", () => {
    const valid = editRankingSet(
      createSet(),
      request({ type: "update-tier", playerId: "qb-2", tier: 4 }),
    );
    expectSuccess(valid);
    expect(valid.rankingSet.entries[2]?.tier).toBe(4);

    const invalid = editRankingSet(
      createSet(),
      request({ type: "update-tier", playerId: "qb-2", tier: 0 }),
    );
    expectFailure(invalid);
    expect(invalid.errors[0]?.code).toBe("invalid-tier-update");

    const decreasing = editRankingSet(
      createSet(),
      request({ type: "update-tier", playerId: "qb-1", tier: 3 }),
    );
    expectFailure(decreasing);
    expect(decreasing.errors[0]?.code).toBe("edit-invariant-failed");
  });

  it("rejects individual updates on defaulted-neutral tiers", () => {
    const result = editRankingSet(
      createDegradedSet(),
      request({ type: "update-tier", playerId: "qb-2", tier: 2 }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-tier-update");
  });

  it.each([
    { type: "correct-player", playerId: "missing", changes: { name: "x" } },
    { type: "reorder-player", playerId: "missing", toOverallRank: 1 },
    { type: "update-tier", playerId: "missing", tier: 1 },
  ] as const)("returns player-not-found for $type", (intent) => {
    const result = editRankingSet(createSet(), request(intent));
    expectFailure(result);
    expect(result.errors[0]?.code).toBe("player-not-found");
  });

  it("rejects invalid source, invalid timestamp, and backward lifecycle in order", () => {
    const invalidSource = createSet({ id: "" });
    const sourceResult = editRankingSet(
      invalidSource,
      request({ type: "rename", name: "Name" }),
    );
    expectFailure(sourceResult);
    expect(sourceResult.errors[0]?.code).toBe("invalid-ranking-set");

    const invalidDate = editRankingSet(createSet(), {
      updatedAt: new Date(Number.NaN),
      intent: { type: "rename", name: "Name" },
    });
    expectFailure(invalidDate);
    expect(invalidDate.errors[0]?.code).toBe("invalid-update-date");

    const backward = editRankingSet(createSet(), {
      updatedAt: new Date("2026-06-28T11:00:00.000Z"),
      intent: { type: "rename", name: "Name" },
    });
    expectFailure(backward);
    expect(backward.errors[0]?.code).toBe("invalid-lifecycle-order");
  });

  it("owns all nested output values and is deterministic", () => {
    const source = createSet();
    const edit = request({ type: "rename", name: "Same Edit" });
    const first = editRankingSet(source, edit);
    const second = editRankingSet(structuredClone(source), {
      updatedAt: new Date(editTimestamp),
      intent: { type: "rename", name: "Same Edit" },
    });

    expectSuccess(first);
    expectSuccess(second);
    expect(first.rankingSet).toEqual(second.rankingSet);
    expect(first.rankingSet).not.toBe(second.rankingSet);
    expect(first.rankingSet.source).not.toBe(source.source);
    expect(first.rankingSet.source.importedAt).not.toBe(source.source.importedAt);
    expect(first.rankingSet.capabilities).not.toBe(source.capabilities);
    expect(first.rankingSet.capabilities.tiers).not.toBe(source.capabilities.tiers);
    expect(first.rankingSet.entries).not.toBe(source.entries);
    expect(first.rankingSet.entries[0]).not.toBe(source.entries[0]);
    expect(first.rankingSet.entries[0]?.player).not.toBe(source.entries[0]?.player);
    expect(first.rankingSet.createdAt).not.toBe(source.createdAt);
    expectTypeOf(first.rankingSet).toMatchTypeOf<RankingSet>();
  });

  it("rejects a runtime snapshot-shaped value", () => {
    const snapshot: RankingSnapshot = {
      rankings: createSet().entries,
      capabilities: createSet().capabilities,
    };
    const result = editRankingSet(
      snapshot as unknown as RankingSet,
      request({ type: "rename", name: "No Snapshot Edits" }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-ranking-set");
  });
});

function request(intent: RankingSetEditRequest["intent"]): RankingSetEditRequest {
  return { updatedAt: editTimestamp, intent };
}

function createSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "rankings-1",
    name: "Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-27T12:00:00.000Z"),
    },
    capabilities: createCapabilities(),
    entries: [
      createEntry("qb-1", 1, "QB", 1, 1),
      createEntry("rb-1", 2, "RB", 1, 1),
      createEntry("qb-2", 3, "QB", 2, 2),
      createEntry("wr-1", 4, "WR", 1, 1),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: originalUpdatedAt,
    ...overrides,
  };
}

function createDegradedSet(): RankingSet {
  return createSet({
    capabilities: {
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: { QB: "defaulted-neutral" },
    },
    entries: [
      createEntry("qb-1", 1, "QB", 1, NEUTRAL_TIER, UNKNOWN_TEAM, null),
      createEntry("qb-2", 2, "QB", 2, NEUTRAL_TIER, UNKNOWN_TEAM, null),
    ],
  });
}

function createCapabilities(
  overrides: Partial<RankingSetCapabilities> = {},
): RankingSetCapabilities {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "row-derived",
    positionRank: "derived",
    adp: "complete",
    tiers: { QB: "source", RB: "source", WR: "source" },
    ...overrides,
  };
}

function createEntry(
  id: string,
  overallRank: number,
  position: Position,
  positionRank: number,
  tier: number,
  team = "SEA",
  adpRank: number | null = overallRank + 0.5,
): RankingEntry {
  return {
    player: { id, name: `Player ${id}`, team, position },
    overallRank,
    positionRank,
    tier,
    adpRank,
  };
}

function expectSuccess(
  result: RankingSetEditResult,
): asserts result is Extract<RankingSetEditResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected edit success: ${JSON.stringify(result.errors)}`);
  }

  expectDomainSuccess(validateRankingSet(result.rankingSet));
}

function expectFailure(
  result: RankingSetEditResult,
): asserts result is Extract<RankingSetEditResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected edit failure.");
  }
}

function expectDomainSuccess(
  result: RankingSetValidationResult,
): asserts result is Extract<RankingSetValidationResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected domain success: ${JSON.stringify(result.errors)}`);
  }
}
