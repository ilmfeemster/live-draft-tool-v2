import { describe, expect, it } from "vitest";
import { parseCanonicalRankingJson } from "@/lib/canonicalRankingJsonParser";
import { parseFantasyProsCsv } from "@/lib/fantasyProsCsvParser";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  FANTASYPROS_CSV_V1_FORMAT,
} from "@/lib/rankingImportPreflight";
import {
  normalizeRankingSource,
  type RankingNormalizerDiagnosticCode,
} from "@/lib/rankingNormalizer";
import type {
  NormalizedRankingCandidate,
  ParsedRankingSourceDocument,
  RankingImportStageResult,
} from "@/types/rankingImport";
import { NEUTRAL_TIER, UNKNOWN_TEAM } from "@/types/rankings";

const importedAt = new Date("2026-06-28T12:00:00.000Z");

describe("normalizeRankingSource FantasyPros CSV", () => {
  it("normalizes a representative explicit-order document", () => {
    const parsed = parseCsv(
      "RK,TIERS,PLAYER NAME,TEAM,POS,ECR VS ADP\n" +
        '5,2,"  Alpha  ",kc,QB3,+2\n' +
        "9,4,Beta,buf,RB2,-1",
    );
    const result = normalizeRankingSource(parsed, {
      name: "  June Rankings  ",
      sourceLabel: "  source.csv  ",
      importedAt,
    });

    expectSuccess(result);
    expect(result.warnings).toEqual([]);
    expect(result.value.name).toBe("June Rankings");
    expect(result.value.source).toEqual({
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "source.csv",
      importedAt,
    });
    expect(result.value.source.importedAt).not.toBe(importedAt);
    expect(result.value.capabilities).toEqual({
      team: "complete",
      playerIdentity: "generated",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: "complete",
      tiers: { QB: "source", RB: "source" },
    });
    expect(result.value.entries).toEqual([
      expect.objectContaining({
        sourceIndex: 0,
        playerId: "fantasypros-v1:qb:alpha",
        playerName: "Alpha",
        team: "KC",
        position: "QB",
        sourceOrder: 5,
        sourcePositionRank: 3,
        tier: 2,
        adpRank: 7,
      }),
      expect.objectContaining({
        sourceIndex: 1,
        playerId: "fantasypros-v1:rb:beta",
        playerName: "Beta",
        team: "BUF",
        position: "RB",
        sourceOrder: 9,
        sourcePositionRank: 2,
        tier: 4,
        adpRank: 8,
      }),
    ]);
    expect(result.value.entries[0]?.location).toEqual({
      row: 2,
      column: 1,
      field: "overallOrder",
    });
    expect(result.value.entries[0]?.fieldLocations).toEqual({
      playerId: { row: 2, column: 3, field: "playerName" },
      playerName: { row: 2, column: 3, field: "playerName" },
      position: { row: 2, column: 5, field: "position" },
      sourcePositionRank: { row: 2, column: 5, field: "position" },
      team: { row: 2, column: 4, field: "team" },
      sourceOrder: { row: 2, column: 1, field: "overallOrder" },
      tier: { row: 2, column: 2, field: "tier" },
      adpRank: { row: 2, column: 6, field: "adpDelta" },
    });
  });

  it("materializes all minimum-profile fallbacks with capabilities and warnings", () => {
    const result = normalizeRankingSource(
      parseCsv("PLAYER NAME,POS\nPlayer One, wr1 \nPlayer Two,RB"),
      { name: "Minimum", importedAt },
    );

    expectSuccess(result);
    expect(result.value.capabilities).toEqual({
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: { RB: "defaulted-neutral", WR: "defaulted-neutral" },
    });
    expect(result.value.entries).toEqual([
      expect.objectContaining({
        playerId: "fantasypros-v1:wr:player%20one",
        team: UNKNOWN_TEAM,
        position: "WR",
        sourceOrder: 1,
        sourcePositionRank: 1,
        tier: NEUTRAL_TIER,
        adpRank: null,
      }),
      expect.objectContaining({
        playerId: "fantasypros-v1:rb:player%20two",
        team: UNKNOWN_TEAM,
        position: "RB",
        sourceOrder: 2,
        sourcePositionRank: null,
        tier: NEUTRAL_TIER,
        adpRank: null,
      }),
    ]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "team-defaulted",
      "adp-defaulted",
      "tiers-defaulted-neutral",
      "tiers-defaulted-neutral",
    ]);
    expect(result.warnings.map((warning) => warning.message)).toEqual([
      "2 ranking entries defaulted to UNK.",
      "2 ranking entries defaulted to null ADP.",
      "RB tiers defaulted to neutral for 1 entry because 1 tier was missing.",
      "WR tiers defaulted to neutral for 1 entry because 1 tier was missing.",
    ]);
    expect(result.value.entries[0]?.fieldLocations.sourceOrder).toEqual(
      result.value.entries[0]?.location,
    );
    expect(result.value.entries[0]?.fieldLocations.tier).toEqual(
      result.value.entries[0]?.location,
    );
  });

  it("neutralizes an entire position for partial tiers and preserves other gaps", () => {
    const result = normalizeRankingSource(
      parseCsv(
        "PLAYER NAME,POS,TIER\nQB One,QB1,3\nQB Two,QB2,\nRB One,RB1,2\nRB Two,RB2,5",
      ),
      { name: "Tiers", importedAt },
    );

    expectSuccess(result);
    expect(result.value.entries.map((entry) => entry.tier)).toEqual([1, 1, 2, 5]);
    expect(result.value.capabilities.tiers).toEqual({
      QB: "defaulted-neutral",
      RB: "source",
    });
    expect(result.warnings.at(-1)).toEqual({
      code: "tiers-defaulted-neutral",
      stage: "normalize",
      severity: "warning",
      message:
        "QB tiers defaulted to neutral for 2 entries because 1 tier was missing.",
    });
  });

  it("derives ADP deltas including values left for Task 6 validation", () => {
    const result = normalizeRankingSource(
      parseCsv(
        "RK,PLAYER NAME,POS,ECR VS ADP\n1,Positive,QB1,+2\n2,Negative,RB1,-7\n3,Zero,WR1,0\n4,Null,TE1,-\n5,Blank,K1,",
      ),
      { name: "ADP", importedAt },
    );

    expectSuccess(result);
    expect(result.value.entries.map((entry) => entry.adpRank)).toEqual([
      3,
      -5,
      3,
      null,
      null,
    ]);
    expect(result.value.capabilities.adp).toBe("partial");
  });

  it("distinguishes supplied canonical fallback values from missing CSV data", () => {
    const result = normalizeRankingSource(
      parseCsv(
        "PLAYER NAME,TEAM,POS,TIER,ECR VS ADP\nUnknown Team,UNK,QB1,1,-",
      ),
      { name: "Supplied Fallbacks", importedAt },
    );

    expectSuccess(result);
    expect(result.value.capabilities.team).toBe("complete");
    expect(result.value.capabilities.adp).toBe("none");
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "adp-defaulted",
    ]);
  });

  it("keeps generated identities deterministic, team-independent, and collision-visible", () => {
    const parsed = parseCsv(
      "PLAYER NAME,POS,TEAM\nSame Name,QB1,KC\nSame Name,QB2,BUF",
    );
    const first = normalizeRankingSource(parsed, { name: "IDs", importedAt });
    const second = normalizeRankingSource(parsed, { name: "IDs", importedAt });

    expectSuccess(first);
    expectSuccess(second);
    expect(first.value).toEqual(second.value);
    expect(first.value.entries.map((entry) => entry.playerId)).toEqual([
      "fantasypros-v1:qb:same%20name",
      "fantasypros-v1:qb:same%20name",
    ]);
  });

  it("preserves explicit order gaps and ties without canonicalizing", () => {
    const result = normalizeRankingSource(
      parseCsv("RK,PLAYER NAME,POS\n4,One,QB1\n4,Two,RB1\n10,Three,WR1"),
      { name: "Order", importedAt },
    );

    expectSuccess(result);
    expect(result.value.entries.map((entry) => entry.sourceOrder)).toEqual([
      4, 4, 10,
    ]);
  });

  it("reports mixed order and malformed supplied fields in semantic order", () => {
    const result = normalizeRankingSource(
      parseCsv(
        "RK,PLAYER NAME,TEAM,POS,TIER,ECR VS ADP\n1,Alpha,KC,QB1,1,+2\n,Beta,7,DEF,bad,--1",
      ),
      { name: "Errors", importedAt },
    );

    expectFailure(result);
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid-position",
      "invalid-number",
      "invalid-number",
      "invalid-null-marker",
    ]);
    expect(result.errors.map((error) => error.location)).toEqual([
      { row: 3, column: 4, field: "position" },
      { row: 3, column: 1, field: "overallOrder" },
      { row: 3, column: 5, field: "tier" },
      { row: 3, column: 6, field: "adpDelta" },
    ]);
  });

  it("requires valid import context without duplicating missing-name errors", () => {
    const invalidDate = new Date(Number.NaN);
    const result = normalizeRankingSource(
      parseCsv("PLAYER NAME,POS\nAlpha,QB1"),
      { name: " ", sourceLabel: " ", importedAt: invalidDate },
    );

    expectFailure(result);
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid-import-context",
      "invalid-import-context",
      "invalid-import-context",
    ]);
  });
});

describe("normalizeRankingSource Canonical Ranking JSON", () => {
  it("normalizes portable metadata, provenance, capabilities, and locations", () => {
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "  Portable  ",
          exportedAt: "2026-06-28T10:00:00.000Z",
          sourceRankingSetId: "never-local",
          source: {
            kind: "external",
            formatId: "fantasypros-csv",
            formatVersion: 1,
            label: "  original.csv  ",
            importedAt: "2026-06-27T10:00:00.000Z",
          },
        },
        capabilities: completeCapabilities(),
        entries: [canonicalEntry()],
      }),
      { importedAt },
    );

    expectSuccess(result);
    expect(result.warnings).toEqual([]);
    expect(result.value.name).toBe("Portable");
    expect(result.value.source).toEqual({
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "original.csv",
      importedAt: new Date("2026-06-27T10:00:00.000Z"),
    });
    expect(result.value).not.toHaveProperty("sourceRankingSetId");
    expect(result.value.capabilities).toEqual(completeCapabilities());
    expect(result.value.entries[0]).toEqual({
      sourceIndex: 0,
      location: { path: "entries[0]" },
      fieldLocations: {
        playerId: { path: "entries[0].player.id", field: "playerId" },
        playerName: { path: "entries[0].player.name", field: "playerName" },
        team: { path: "entries[0].player.team", field: "team" },
        position: { path: "entries[0].player.position", field: "position" },
        sourceOrder: { path: "entries[0].overallRank", field: "overallOrder" },
        sourcePositionRank: {
          path: "entries[0].positionRank",
          field: "sourcePositionRank",
        },
        tier: { path: "entries[0].tier", field: "tier" },
        adpRank: { path: "entries[0].adpRank", field: "adpRank" },
      },
      playerId: "  Explicit ID  ",
      playerName: "Player One",
      team: "KC",
      position: "QB",
      sourceOrder: 3,
      sourcePositionRank: 1,
      tier: 2,
      adpRank: null,
    });
  });

  it("uses explicit name precedence and creates canonical provenance when absent", () => {
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "Portable",
          exportedAt: "2026-06-28T10:00:00.000Z",
        },
        capabilities: completeCapabilities(),
        entries: [canonicalEntry()],
      }),
      { name: "  Imported Copy  ", importedAt },
    );

    expectSuccess(result);
    expect(result.value.name).toBe("Imported Copy");
    expect(result.value.source).toEqual({
      kind: "canonical",
      formatId: "canonical-ranking-json",
      formatVersion: 1,
      importedAt,
    });
    expect(result.value.source.importedAt).not.toBe(importedAt);
  });

  it("preserves declared capabilities without repairing contradictions", () => {
    const capabilities = {
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "complete",
      tiers: { QB: "defaulted-neutral" },
    } as const;
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "Contradictory",
          exportedAt: "2026-06-28T10:00:00.000Z",
        },
        capabilities,
        entries: [canonicalEntry()],
      }),
      { importedAt },
    );

    expectSuccess(result);
    expect(result.value.capabilities).toEqual(capabilities);
    expect(result.warnings).toEqual([]);
  });

  it("accepts an empty candidate for Task 6 to reject", () => {
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "Empty",
          exportedAt: "2026-06-28T10:00:00.000Z",
        },
        capabilities: {
          team: "none",
          playerIdentity: "provided",
          overallOrder: "explicit",
          positionRank: "derived",
          adp: "none",
          tiers: {},
        },
        entries: [],
      }),
      { importedAt },
    );

    expectSuccess(result);
    expect(result.value.entries).toEqual([]);
  });

  it("rejects malformed metadata, source provenance, and capabilities", () => {
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: 7,
          exportedAt: "not-a-date",
          source: {
            kind: "provider",
            formatVersion: 0,
            importedAt: "yesterday",
          },
        },
        capabilities: {
          team: "invented",
          playerIdentity: "provided",
          overallOrder: "explicit",
          positionRank: "supplied",
          adp: "none",
          tiers: { DEF: "source", QB: "invented" },
          extra: true,
        },
        entries: [canonicalEntry()],
      }),
      { importedAt },
    );

    expectFailure(result);
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid-metadata",
      "invalid-metadata",
      "invalid-metadata",
      "invalid-metadata",
      "invalid-metadata",
      "invalid-capabilities",
      "invalid-capabilities",
      "invalid-capabilities",
      "invalid-capabilities",
      "invalid-capabilities",
    ]);
  });

  it("rejects missing canonical values and numeric strings in semantic order", () => {
    const result = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "Bad Entry",
          exportedAt: "2026-06-28T10:00:00.000Z",
        },
        capabilities: completeCapabilities(),
        entries: [
          {
            player: { id: 2, name: " ", team: "", position: "DEF" },
            overallRank: "1",
            positionRank: null,
            tier: 0,
          },
        ],
      }),
      { importedAt },
    );

    expectFailure(result);
    expect(result.errors.map((error) => error.code)).toEqual([
      "invalid-text",
      "invalid-text",
      "invalid-team",
      "invalid-position",
      "invalid-number",
      "invalid-number",
      "invalid-number",
      "missing-required-value",
    ]);
    expect(result.errors.at(-1)?.location).toEqual({
      path: "entries[0].adpRank",
      field: "adpRank",
    });
  });

  it("requires a valid context date only when portable source is absent", () => {
    const value = {
      schemaVersion: 1,
      metadata: {
        name: "Portable",
        exportedAt: "2026-06-28T10:00:00.000Z",
      },
      capabilities: completeCapabilities(),
      entries: [canonicalEntry()],
    };
    const result = normalizeRankingSource(parseCanonical(value), {
      importedAt: new Date(Number.NaN),
    });

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "invalid-import-context",
        stage: "normalize",
        severity: "error",
        message:
          "Canonical imports without source provenance require a valid importedAt Date.",
      },
    ]);
  });
});

describe("normalizeRankingSource boundaries", () => {
  it("produces equivalent source-neutral entries across formats", () => {
    const csv = normalizeRankingSource(
      parseCsv("RK,TIER,PLAYER NAME,TEAM,POS,ECR VS ADP\n3,2,Player One,KC,QB1,-"),
      { name: "Equivalent", importedAt },
    );
    const canonical = normalizeRankingSource(
      parseCanonical({
        schemaVersion: 1,
        metadata: {
          name: "Equivalent",
          exportedAt: "2026-06-28T10:00:00.000Z",
        },
        capabilities: {
          team: "complete",
          playerIdentity: "generated",
          overallOrder: "explicit",
          positionRank: "derived",
          adp: "none",
          tiers: { QB: "source" },
        },
        entries: [
          {
            player: {
              id: "fantasypros-v1:qb:player%20one",
              name: "Player One",
              team: "KC",
              position: "QB",
            },
            overallRank: 3,
            positionRank: 1,
            tier: 2,
            adpRank: null,
          },
        ],
      }),
      { importedAt },
    );

    expectSuccess(csv);
    expectSuccess(canonical);
    expect(stripLocations(csv.value.entries[0])).toEqual(
      stripLocations(canonical.value.entries[0]),
    );
    expect(csv.value.capabilities).toEqual(canonical.value.capabilities);
  });

  it("does not mutate parsed input", () => {
    const parsed = parseCsv("PLAYER NAME,POS\n  Mixed  ,QB1");
    const before = JSON.stringify(parsed);

    normalizeRankingSource(parsed, { name: "Pure", importedAt });

    expect(JSON.stringify(parsed)).toBe(before);
  });

  it("rejects unsupported runtime formats before normalization", () => {
    const document = {
      format: { id: "scenario-json", version: 1 },
      metadata: {},
      records: [],
    } as unknown as ParsedRankingSourceDocument;
    const result = normalizeRankingSource(document, {
      name: "Unsupported",
      importedAt,
    });

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "unsupported-format",
        stage: "normalize",
        severity: "error",
        message: "Ranking normalizer received an unsupported format.",
      },
    ]);
  });
});

function parseCsv(text: string): ParsedRankingSourceDocument {
  const result = parseFantasyProsCsv({
    format: FANTASYPROS_CSV_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  });

  if (!result.ok) {
    throw new Error(`CSV parse failed: ${JSON.stringify(result.errors)}`);
  }

  return result.value;
}

function parseCanonical(value: unknown): ParsedRankingSourceDocument {
  const text = JSON.stringify(value);
  const result = parseCanonicalRankingJson({
    format: CANONICAL_RANKING_JSON_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  });

  if (!result.ok) {
    throw new Error(`Canonical parse failed: ${JSON.stringify(result.errors)}`);
  }

  return result.value;
}

function canonicalEntry() {
  return {
    player: {
      id: "  Explicit ID  ",
      name: "  Player One  ",
      team: "kc",
      position: "qb",
    },
    overallRank: 3,
    positionRank: 1,
    tier: 2,
    adpRank: null,
  };
}

function completeCapabilities() {
  return {
    team: "complete",
    playerIdentity: "provided",
    overallOrder: "explicit",
    positionRank: "derived",
    adp: "none",
    tiers: { QB: "source" },
  } as const;
}

function stripLocations(
  entry: NormalizedRankingCandidate["entries"][number] | undefined,
) {
  if (!entry) {
    throw new Error("Expected normalized entry.");
  }

  return {
    sourceIndex: entry.sourceIndex,
    playerId: entry.playerId,
    playerName: entry.playerName,
    team: entry.team,
    position: entry.position,
    sourceOrder: entry.sourceOrder,
    sourcePositionRank: entry.sourcePositionRank,
    tier: entry.tier,
    adpRank: entry.adpRank,
  };
}

type NormalizerResult = RankingImportStageResult<
  NormalizedRankingCandidate,
  RankingNormalizerDiagnosticCode
>;

function expectSuccess(
  result: NormalizerResult,
): asserts result is Extract<NormalizerResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: NormalizerResult,
): asserts result is Extract<NormalizerResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected normalization failure.");
  }
}
