import { describe, expect, expectTypeOf, it } from "vitest";
import { parseFantasyProsCsv } from "@/lib/fantasyProsCsvParser";
import {
  FANTASYPROS_CSV_V1_FORMAT,
  RANKING_IMPORT_LIMITS,
} from "@/lib/rankingImportPreflight";
import {
  validateNormalizedRankingCandidate,
  type RankingCandidateValidationDiagnosticCode,
} from "@/lib/rankingCandidateValidation";
import { normalizeRankingSource } from "@/lib/rankingNormalizer";
import type { Position } from "@/types/draft";
import type {
  NormalizedRankingCandidate,
  NormalizedRankingCandidateEntry,
  RankingImportStageResult,
  ValidatedRankingCandidate,
} from "@/types/rankingImport";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSetCapabilities,
} from "@/types/rankings";

describe("validateNormalizedRankingCandidate", () => {
  it("accepts a complete candidate and preserves the exact reference", () => {
    const candidate = createCandidate();
    const before = structuredClone(candidate);
    const result = validateNormalizedRankingCandidate(candidate);

    expectSuccess(result);
    expect(result.value).toEqual({ validated: true, candidate });
    expect(result.value.candidate).toBe(candidate);
    expect(result.warnings).toEqual([]);
    expect(candidate).toEqual(before);
    expectTypeOf(result.value).toMatchTypeOf<ValidatedRankingCandidate>();
  });

  it("accepts complete and safely degraded public normalization outputs", () => {
    const complete = normalizeCsv(
      "RK,TIER,PLAYER NAME,TEAM,POS,ECR VS ADP\n1,1,Alpha,KC,QB1,+2\n2,1,Beta,BUF,RB1,0",
      "Complete",
    );
    const degraded = normalizeCsv(
      "PLAYER NAME,POS\nAlpha,QB\nBeta,RB",
      "Degraded",
    );

    expectSuccess(validateNormalizedRankingCandidate(complete));
    const degradedResult = validateNormalizedRankingCandidate(degraded);
    expectSuccess(degradedResult);
    expect(degradedResult.value.candidate.capabilities).toEqual({
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: {
        QB: "defaulted-neutral",
        RB: "defaulted-neutral",
      },
    });
  });

  it("accepts a valid one-entry candidate without league capacity checks", () => {
    const candidate = createCandidate({
      entries: [createEntry(0, "qb-1", 7, "QB", 1, 3)],
      capabilities: createCapabilities({
        tiers: { QB: "source" },
      }),
    });

    expectSuccess(validateNormalizedRankingCandidate(candidate));
  });

  it("returns metadata and collection failures in stable order", () => {
    const candidate = createCandidate({
      name: " ",
      source: {
        kind: "provider" as NormalizedRankingCandidate["source"]["kind"],
        formatId: "",
        label: " ",
        formatVersion: 0,
        importedAt: new Date(Number.NaN),
      },
      entries: [],
      capabilities: createCapabilities({ tiers: {} }),
    });
    const result = validateNormalizedRankingCandidate(candidate);

    expectFailure(result);
    expect(result.errors.map((entry) => entry.code)).toEqual([
      "invalid-name",
      "invalid-source",
      "invalid-source",
      "invalid-source",
      "invalid-source",
      "invalid-source",
      "empty-entries",
    ]);
  });

  it("rejects 1,001 otherwise valid entries", () => {
    const entries = Array.from(
      { length: RANKING_IMPORT_LIMITS.maxEntries + 1 },
      (_, index) => createEntry(index, `qb-${index}`, index + 1, "QB", index + 1, 1),
    );
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        entries,
        capabilities: createCapabilities({ tiers: { QB: "source" } }),
      }),
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "too-many-entries" }),
    ]);
  });

  it("rejects malformed and sparse runtime entries while continuing", () => {
    const entries = new Array<NormalizedRankingCandidateEntry>(2);
    entries[1] = createEntry(1, "rb-1", 2, "RB", 1, 1);
    const candidate = createCandidate({
      entries,
      capabilities: createCapabilities({ tiers: { RB: "source" } }),
    });
    const result = validateNormalizedRankingCandidate(candidate);

    expectFailure(result);
    expect(result.errors[0]).toEqual({
      code: "invalid-entry",
      stage: "validate",
      severity: "error",
      message: "Normalized ranking candidate entry must be an object.",
      location: { path: "entries[0]" },
    });
  });

  it("validates entry fields in the documented order", () => {
    const invalid = {
      ...createEntry(2, "", 0, "QB", null, 0),
      sourceIndex: 2,
      playerName: "",
      team: " ",
      position: "DL",
      sourcePositionRank: 0,
      adpRank: Number.NaN,
    } as unknown as NormalizedRankingCandidateEntry;
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        entries: [invalid],
        capabilities: createCapabilities({ tiers: {} }),
      }),
    );

    expectFailure(result);
    expect(result.errors.slice(0, 9).map((entry) => entry.code)).toEqual([
      "invalid-source-index",
      "invalid-player-id",
      "invalid-player-name",
      "invalid-team",
      "invalid-position",
      "invalid-source-order",
      "invalid-source-position-rank",
      "invalid-adp-rank",
      "invalid-tier",
    ]);
  });

  it("reports duplicate IDs and source order at the later retained locations", () => {
    const entries = [
      createEntry(0, "same", 4, "QB", 1, 1),
      createEntry(1, "same", 4, "RB", 1, 1),
    ];
    const result = validateNormalizedRankingCandidate(createCandidate({ entries }));

    expectFailure(result);
    expect(result.errors.slice(0, 2)).toEqual([
      {
        code: "duplicate-player-id",
        stage: "validate",
        severity: "error",
        message: "Normalized player ID same appears more than once.",
        location: fieldLocation(1, "playerId"),
      },
      {
        code: "duplicate-source-order",
        stage: "validate",
        severity: "error",
        message: "Normalized source order 4 appears more than once.",
        location: fieldLocation(1, "sourceOrder"),
      },
    ]);
  });

  it("accepts explicit gaps and array order independent of source order", () => {
    const entries = [
      createEntry(0, "qb-2", 30, "QB", 2, 4),
      createEntry(1, "rb-1", 20, "RB", 1, 2),
      createEntry(2, "qb-1", 10, "QB", 1, 1),
    ];

    expectSuccess(
      validateNormalizedRankingCandidate(createCandidate({ entries })),
    );
  });

  it("requires row-derived order to match source index", () => {
    const entries = [
      createEntry(0, "qb-1", 2, "QB", 1, 1),
      createEntry(1, "rb-1", 3, "RB", 1, 1),
    ];
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        entries,
        capabilities: createCapabilities({ overallOrder: "row-derived" }),
      }),
    );

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "invalid-capability",
      stage: "validate",
      severity: "error",
      message: "Row-derived source order must equal sourceIndex plus one.",
      location: fieldLocation(0, "sourceOrder"),
    });
  });

  it("accepts null source-position rank and rejects supplied disagreement", () => {
    const entries = [
      createEntry(0, "qb-1", 1, "QB", null, 1),
      createEntry(1, "rb-1", 2, "RB", 1, 1),
      createEntry(2, "qb-2", 3, "QB", 3, 2),
    ];
    const result = validateNormalizedRankingCandidate(createCandidate({ entries }));

    expectFailure(result);
    expect(result.errors).toContainEqual({
      code: "invalid-source-position-rank",
      stage: "validate",
      severity: "error",
      message: "Normalized source position rank must equal 2 for QB in source order.",
      location: fieldLocation(2, "sourcePositionRank"),
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "2"])(
    "rejects malformed ADP %s rather than treating it as absent",
    (adpRank) => {
      const entry = {
        ...createEntry(0, "qb-1", 1, "QB", 1, 1),
        adpRank,
      } as unknown as NormalizedRankingCandidateEntry;
      const result = validateNormalizedRankingCandidate(
        createCandidate({
          entries: [entry],
          capabilities: createCapabilities({
            adp: "none",
            tiers: { QB: "source" },
          }),
        }),
      );

      expectFailure(result);
      expect(result.errors[0]?.code).toBe("invalid-adp-rank");
    },
  );

  it("accepts equal and gapped tiers but rejects position-local decreases", () => {
    const valid = createCandidate({
      entries: [
        createEntry(0, "qb-1", 1, "QB", 1, 2),
        createEntry(1, "qb-2", 2, "QB", 2, 2),
        createEntry(2, "qb-3", 3, "QB", 3, 6),
      ],
      capabilities: createCapabilities({ tiers: { QB: "source" } }),
    });
    const invalidEntries = [
      createEntry(0, "qb-1", 1, "QB", 1, 3),
      createEntry(1, "rb-1", 2, "RB", 1, 1),
      createEntry(2, "qb-2", 3, "QB", 2, 2),
    ];

    expectSuccess(validateNormalizedRankingCandidate(valid));
    const invalid = validateNormalizedRankingCandidate(
      createCandidate({ entries: invalidEntries }),
    );
    expectFailure(invalid);
    expect(invalid.errors).toContainEqual({
      code: "invalid-tier-progression",
      stage: "validate",
      severity: "error",
      message: "Normalized tier must not decrease within QB source order.",
      location: fieldLocation(2, "tier"),
    });
  });

  it.each([0, -1, 1.5])("rejects invalid tier %s", (tier) => {
    const entry = createEntry(0, "qb-1", 1, "QB", 1, tier);
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        entries: [entry],
        capabilities: createCapabilities({ tiers: { QB: "source" } }),
      }),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-tier");
  });

  it("skips derived rank and tier errors when source order is ambiguous", () => {
    const entries = [
      createEntry(0, "qb-1", 1, "QB", 4, 3),
      createEntry(1, "qb-2", 1, "QB", 1, 1),
    ];
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        entries,
        capabilities: createCapabilities({ tiers: { QB: "source" } }),
      }),
    );

    expectFailure(result);
    expect(result.errors.map((entry) => entry.code)).toEqual([
      "duplicate-source-order",
    ]);
  });

  it("accepts complete, partial, and absent availability when accurately declared", () => {
    const entries = [
      createEntry(0, "qb-1", 1, "QB", 1, 1, {
        team: UNKNOWN_TEAM,
        adpRank: null,
      }),
      createEntry(1, "rb-1", 2, "RB", 1, 1),
    ];

    expectSuccess(
      validateNormalizedRankingCandidate(
        createCandidate({
          entries,
          capabilities: createCapabilities({ team: "partial", adp: "partial" }),
        }),
      ),
    );

    const absentEntries = entries.map((entry) => ({
      ...entry,
      team: UNKNOWN_TEAM,
      adpRank: null,
    }));
    expectSuccess(
      validateNormalizedRankingCandidate(
        createCandidate({
          entries: absentEntries,
          capabilities: createCapabilities({ team: "none", adp: "none" }),
        }),
      ),
    );
  });

  it("locates team and ADP capability mismatches at relevant fields", () => {
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        capabilities: createCapabilities({ team: "none", adp: "none" }),
      }),
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "invalid-capability",
        stage: "validate",
        severity: "error",
        message: "Normalized team capability must be complete.",
        location: fieldLocation(0, "team"),
      },
      {
        code: "invalid-capability",
        stage: "validate",
        severity: "error",
        message: "Normalized ADP capability must be complete.",
        location: fieldLocation(0, "adpRank"),
      },
    ]);
  });

  it("rejects unsupported scalar capability states in fixed order", () => {
    const capabilities = {
      ...createCapabilities(),
      team: "sometimes",
      playerIdentity: "mapped",
      overallOrder: "sorted",
      positionRank: "source",
      adp: "sometimes",
    } as unknown as RankingSetCapabilities;
    const result = validateNormalizedRankingCandidate(
      createCandidate({ capabilities }),
    );

    expectFailure(result);
    expect(result.errors.map((entry) => entry.message)).toEqual([
      "Normalized ranking capability team is unsupported.",
      "Normalized ranking capability playerIdentity is unsupported.",
      "Normalized ranking capability overallOrder is unsupported.",
      "Normalized ranking capability positionRank is unsupported.",
      "Normalized ranking capability adp is unsupported.",
    ]);
  });

  it("requires tier capabilities for exactly represented positions", () => {
    const capabilities = createCapabilities({
      tiers: {
        QB: "source",
        WR: "source",
        ZZZ: "source",
        AAA: "source",
      } as unknown as RankingSetCapabilities["tiers"],
    });
    const result = validateNormalizedRankingCandidate(
      createCandidate({ capabilities }),
    );

    expectFailure(result);
    expect(result.errors.map((entry) => entry.message)).toEqual([
      "Normalized RB tier capability is unsupported.",
      "Normalized WR tier capability must be absent when the position is absent.",
      "Normalized tier capability position AAA is unsupported.",
      "Normalized tier capability position ZZZ is unsupported.",
    ]);
  });

  it("requires neutral fallback tiers while allowing source tier gaps", () => {
    const neutralEntries = [
      createEntry(0, "qb-1", 1, "QB", 1, NEUTRAL_TIER),
      createEntry(1, "qb-2", 2, "QB", 2, 2),
    ];
    const neutralResult = validateNormalizedRankingCandidate(
      createCandidate({
        entries: neutralEntries,
        capabilities: createCapabilities({
          tiers: { QB: "defaulted-neutral" },
        }),
      }),
    );

    expectFailure(neutralResult);
    expect(neutralResult.errors).toContainEqual({
      code: "invalid-capability",
      stage: "validate",
      severity: "error",
      message: "QB defaulted-neutral tiers must all equal 1.",
      location: fieldLocation(1, "tier"),
    });

    const sourceResult = validateNormalizedRankingCandidate(
      createCandidate({
        entries: neutralEntries,
        capabilities: createCapabilities({ tiers: { QB: "source" } }),
      }),
    );
    expectSuccess(sourceResult);
  });

  it("returns multiple independent failures in stable phases", () => {
    const entries = [
      {
        ...createEntry(0, "same", 2, "QB", 1, 3),
        team: "",
      },
      {
        ...createEntry(1, "same", 2, "QB", 2, 1),
        adpRank: 0,
      },
    ] as NormalizedRankingCandidateEntry[];
    const result = validateNormalizedRankingCandidate(
      createCandidate({
        name: "",
        entries,
        capabilities: createCapabilities({
          team: "none",
          adp: "none",
          tiers: { QB: "source" },
        }),
      }),
    );

    expectFailure(result);
    expect(result.errors.map((entry) => entry.code)).toEqual([
      "invalid-name",
      "invalid-team",
      "duplicate-player-id",
      "duplicate-source-order",
      "invalid-adp-rank",
    ]);
  });

  it("keeps normalization failures at the normalization boundary", () => {
    const text = "PLAYER NAME,POS\nAlpha,DEF";
    const parsed = parseFantasyProsCsv({
      format: FANTASYPROS_CSV_V1_FORMAT,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
    });

    if (!parsed.ok) {
      throw new Error("Expected parser success.");
    }

    const normalized = normalizeRankingSource(parsed.value, {
      name: "Invalid",
      importedAt: new Date("2026-06-28T12:00:00.000Z"),
    });

    expect(normalized.ok).toBe(false);

    if (normalized.ok) {
      throw new Error("Expected normalization failure.");
    }

    expect(normalized.errors[0]?.stage).toBe("normalize");
    expect(normalized).not.toHaveProperty("value");
  });
});

function createCandidate(
  overrides: Partial<NormalizedRankingCandidate> = {},
): NormalizedRankingCandidate {
  return {
    name: "Validated Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-28T12:00:00.000Z"),
    },
    entries: [
      createEntry(0, "qb-1", 10, "QB", 1, 1),
      createEntry(1, "rb-1", 20, "RB", 1, 1),
      createEntry(2, "qb-2", 30, "QB", 2, 3),
    ],
    capabilities: createCapabilities(),
    ...overrides,
  };
}

function createCapabilities(
  overrides: Partial<RankingSetCapabilities> = {},
): RankingSetCapabilities {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "explicit",
    positionRank: "derived",
    adp: "complete",
    tiers: { QB: "source", RB: "source" },
    ...overrides,
  };
}

function createEntry(
  sourceIndex: number,
  playerId: string,
  sourceOrder: number,
  position: Position,
  sourcePositionRank: number | null,
  tier: number,
  overrides: { team?: string; adpRank?: number | null } = {},
): NormalizedRankingCandidateEntry {
  return {
    sourceIndex,
    location: { path: `entries[${sourceIndex}]` },
    fieldLocations: {
      playerId: fieldLocation(sourceIndex, "playerId"),
      playerName: fieldLocation(sourceIndex, "playerName"),
      team: fieldLocation(sourceIndex, "team"),
      position: fieldLocation(sourceIndex, "position"),
      sourceOrder: fieldLocation(sourceIndex, "sourceOrder"),
      sourcePositionRank: fieldLocation(sourceIndex, "sourcePositionRank"),
      adpRank: fieldLocation(sourceIndex, "adpRank"),
      tier: fieldLocation(sourceIndex, "tier"),
    },
    playerId,
    playerName: `Player ${playerId}`,
    team: overrides.team ?? "SEA",
    position,
    sourceOrder,
    sourcePositionRank,
    adpRank:
      overrides.adpRank === undefined ? sourceOrder + 0.5 : overrides.adpRank,
    tier,
  };
}

function fieldLocation(index: number, field: string) {
  return { path: `entries[${index}].${field}`, field };
}

function normalizeCsv(text: string, name: string): NormalizedRankingCandidate {
  const parsed = parseFantasyProsCsv({
    format: FANTASYPROS_CSV_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  });

  if (!parsed.ok) {
    throw new Error(`Parser failed: ${JSON.stringify(parsed.errors)}`);
  }

  const normalized = normalizeRankingSource(parsed.value, {
    name,
    importedAt: new Date("2026-06-28T12:00:00.000Z"),
  });

  if (!normalized.ok) {
    throw new Error(`Normalizer failed: ${JSON.stringify(normalized.errors)}`);
  }

  return normalized.value;
}

type ValidationResult = RankingImportStageResult<
  ValidatedRankingCandidate,
  RankingCandidateValidationDiagnosticCode
>;

function expectSuccess(
  result: ValidationResult,
): asserts result is Extract<ValidationResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: ValidationResult,
): asserts result is Extract<ValidationResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected candidate validation failure.");
  }
}
