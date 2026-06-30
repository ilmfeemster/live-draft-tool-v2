import { describe, expect, it } from "vitest";
import {
  parseCanonicalRankingJson,
  type CanonicalRankingJsonParserDiagnosticCode,
} from "@/lib/canonicalRankingJsonParser";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  FANTASYPROS_CSV_V1_FORMAT,
  RANKING_IMPORT_LIMITS,
} from "@/lib/rankingImportPreflight";
import type {
  ParsedRankingSourceDocument,
  PreflightRankingDocument,
  RankingImportStageResult,
} from "@/types/rankingImport";

describe("parseCanonicalRankingJson", () => {
  it("parses the minimum V1 envelope and defers the empty-set invariant", () => {
    const result = parseValue({
      schemaVersion: 1,
      metadata: {},
      capabilities: {},
      entries: [],
    });

    expectSuccess(result);
    expect(result.value).toEqual({
      format: CANONICAL_RANKING_JSON_V1_FORMAT,
      metadata: {
        schemaVersion: located(1, "schemaVersion", "schemaVersion"),
        documentMetadata: located({}, "metadata", "metadata"),
        capabilities: located({}, "capabilities", "capabilities"),
      },
      tierSemantics: {
        kind: "legacy-ambiguous",
        sourceScope: "unknown",
        recommendationEligible: false,
      },
      records: [],
    });
    expect(result.value).not.toHaveProperty("id");
    expect(result.value).not.toHaveProperty("entries");
    expect(result.warnings).toEqual([]);
  });

  it("preserves representative metadata, capabilities, and entry values", () => {
    const documentMetadata = {
      name: "Portable Rankings",
      exportedAt: "2026-06-28T12:00:00.000Z",
      sourceRankingSetId: "source-set-17",
      source: {
        kind: "external",
        formatId: "fantasypros-csv",
        formatVersion: 1,
        label: "June rankings",
        importedAt: "2026-06-27T12:00:00.000Z",
      },
    };
    const capabilities = {
      team: "partial",
      playerIdentity: "provided",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: "partial",
      tiers: { QB: "source", RB: "defaulted-neutral" },
    };
    const result = parseValue({
      schemaVersion: 1,
      metadata: documentMetadata,
      capabilities,
      entries: [
        {
          player: {
            id: "portable-player-1",
            name: "  Player One  ",
            team: "KC",
            position: "QB",
          },
          overallRank: 1,
          positionRank: 1,
          tier: 2,
          adpRank: null,
          ignoredFutureValue: "not part of V1",
        },
      ],
    });

    expectSuccess(result);
    expect(result.value.metadata).toEqual({
      schemaVersion: located(1, "schemaVersion", "schemaVersion"),
      documentMetadata: located(documentMetadata, "metadata", "metadata"),
      capabilities: located(capabilities, "capabilities", "capabilities"),
    });
    expect(result.value.tierSemantics).toEqual({
      kind: "legacy-ambiguous",
      sourceScope: "unknown",
      recommendationEligible: false,
    });
    expect(result.value.records).toEqual([
      {
        sourceIndex: 0,
        fields: {
          overallOrder: located(
            1,
            "entries[0].overallRank",
            "overallOrder",
          ),
          sourcePositionRank: located(
            1,
            "entries[0].positionRank",
            "sourcePositionRank",
          ),
          tier: located(2, "entries[0].tier", "tier"),
          adpRank: located(null, "entries[0].adpRank", "adpRank"),
          playerId: located(
            "portable-player-1",
            "entries[0].player.id",
            "playerId",
          ),
          playerName: located(
            "  Player One  ",
            "entries[0].player.name",
            "playerName",
          ),
          team: located("KC", "entries[0].player.team", "team"),
          position: located("QB", "entries[0].player.position", "position"),
        },
      },
    ]);
    expect(result.value.records[0]?.fields).not.toHaveProperty(
      "ignoredFutureValue",
    );
  });

  it("preserves malformed semantic values and absent properties for normalization", () => {
    const result = parseValue({
      schemaVersion: 1,
      metadata: { name: 42 },
      capabilities: { team: "invented-state" },
      entries: [
        {
          player: "not-an-object",
          overallRank: "first",
          positionRank: null,
          tier: -7,
          adpRank: "unknown",
        },
        {},
        { player: ["also", "not", "an", "object"] },
      ],
    });

    expectSuccess(result);
    expect(result.value.records).toEqual([
      {
        sourceIndex: 0,
        fields: {
          overallOrder: located(
            "first",
            "entries[0].overallRank",
            "overallOrder",
          ),
          sourcePositionRank: located(
            null,
            "entries[0].positionRank",
            "sourcePositionRank",
          ),
          tier: located(-7, "entries[0].tier", "tier"),
          adpRank: located("unknown", "entries[0].adpRank", "adpRank"),
          player: located(
            "not-an-object",
            "entries[0].player",
            "player",
          ),
        },
      },
      { sourceIndex: 1, fields: {} },
      {
        sourceIndex: 2,
        fields: {
          player: located(
            ["also", "not", "an", "object"],
            "entries[2].player",
            "player",
          ),
        },
      },
    ]);
  });

  it("returns a stable error for malformed JSON", () => {
    const result = parseCanonicalRankingJson(
      documentFromText('{"schemaVersion":1,'),
    );

    expectFailure(result, [
      {
        code: "malformed-json",
        stage: "parse",
        severity: "error",
        message: "Canonical ranking JSON is malformed.",
        location: { path: "$" },
      },
    ]);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "rankings"],
    ["number", 1],
    ["boolean", true],
  ])("rejects a $s root", (_name, root) => {
    const result = parseValue(root);

    expectFailureCodes(result, ["invalid-root"]);
    expect(result.errors[0]?.location).toEqual({ path: "$" });
  });

  it("rejects Scenario V1 before canonical envelope validation", () => {
    const result = parseValue({
      schemaVersion: 1,
      metadata: { id: "scenario-1", name: "Scenario" },
      leagueSettings: {},
      draftConfiguration: {},
      rankingContext: { rankings: [] },
      userTeamContext: {},
      pickHistory: [],
      replayTarget: { appliedPickCount: 0 },
    });

    expectFailure(result, [
      {
        code: "wrong-document-type",
        stage: "parse",
        severity: "error",
        message:
          "Scenario V1 JSON cannot be imported as a canonical ranking set.",
        location: { path: "$" },
      },
    ]);
  });

  it("rejects a missing schema version", () => {
    const result = parseValue({
      metadata: {},
      capabilities: {},
      entries: [],
    });

    expectFailureCodes(result, ["missing-schema-version"]);
    expect(result.errors[0]?.location).toEqual({ path: "schemaVersion" });
  });

  it.each([0, 2, "1", null])(
    "rejects unsupported schema version %j without coercion",
    (schemaVersion) => {
      const result = parseValue({
        schemaVersion,
        metadata: {},
        capabilities: {},
        entries: [],
      });

      expectFailureCodes(result, ["unsupported-schema-version"]);
      expect(result.errors[0]?.location).toEqual({ path: "schemaVersion" });
    },
  );

  it("reports missing envelope fields in frozen order", () => {
    const result = parseValue({ schemaVersion: 1 });

    expectFailureCodes(result, [
      "missing-envelope-field",
      "missing-envelope-field",
      "missing-envelope-field",
    ]);
    expect(result.errors.map((diagnostic) => diagnostic.location?.path)).toEqual(
      ["metadata", "capabilities", "entries"],
    );
  });

  it("reports invalid envelope field shapes in frozen order", () => {
    const result = parseValue({
      schemaVersion: 1,
      metadata: [],
      capabilities: null,
      entries: {},
    });

    expectFailureCodes(result, [
      "invalid-envelope-field",
      "invalid-envelope-field",
      "invalid-envelope-field",
    ]);
    expect(result.errors.map((diagnostic) => diagnostic.location?.path)).toEqual(
      ["metadata", "capabilities", "entries"],
    );
  });

  it("accumulates missing and invalid envelope failures deterministically", () => {
    const result = parseValue({
      schemaVersion: 1,
      capabilities: "complete",
      entries: [],
    });

    expectFailureCodes(result, [
      "missing-envelope-field",
      "invalid-envelope-field",
    ]);
    expect(result.errors.map((diagnostic) => diagnostic.location?.path)).toEqual(
      ["metadata", "capabilities"],
    );
  });

  it("rejects non-object entries with their indexed paths", () => {
    const result = parseValue({
      schemaVersion: 1,
      metadata: {},
      capabilities: {},
      entries: [{}, null, "player", [], 4],
    });

    expectFailureCodes(result, [
      "invalid-entry-shape",
      "invalid-entry-shape",
      "invalid-entry-shape",
      "invalid-entry-shape",
    ]);
    expect(result.errors.map((diagnostic) => diagnostic.location?.path)).toEqual(
      ["entries[1]", "entries[2]", "entries[3]", "entries[4]"],
    );
  });

  it("accepts exactly 1,000 entry records", () => {
    const entries = Array.from(
      { length: RANKING_IMPORT_LIMITS.maxEntries },
      () => ({}),
    );
    const result = parseValue({
      schemaVersion: 1,
      metadata: {},
      capabilities: {},
      entries,
    });

    expectSuccess(result);
    expect(result.value.records).toHaveLength(
      RANKING_IMPORT_LIMITS.maxEntries,
    );
    expect(result.value.records.at(-1)?.sourceIndex).toBe(999);
  });

  it("rejects 1,001 entries before mapping their shapes", () => {
    const entries = Array.from(
      { length: RANKING_IMPORT_LIMITS.maxEntries + 1 },
      () => null,
    );
    const result = parseValue({
      schemaVersion: 1,
      metadata: {},
      capabilities: {},
      entries,
    });

    expectFailure(result, [
      {
        code: "too-many-records",
        stage: "parse",
        severity: "error",
        message:
          "Canonical ranking JSON must not contain more than 1000 entries.",
        location: { path: "entries" },
      },
    ]);
  });

  it("rejects a preflight document selected for another format", () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      metadata: {},
      capabilities: {},
      entries: [],
    });
    const result = parseCanonicalRankingJson({
      format: FANTASYPROS_CSV_V1_FORMAT,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
    });

    expectFailureCodes(result, ["wrong-format"]);
    expect(result.errors[0]).not.toHaveProperty("location");
  });
});

function parseValue(value: unknown): ParserResult {
  return parseCanonicalRankingJson(
    documentFromText(JSON.stringify(value)),
  );
}

function documentFromText(text: string): PreflightRankingDocument {
  return {
    format: CANONICAL_RANKING_JSON_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  };
}

function located(value: unknown, path: string, field: string) {
  return {
    value,
    location: { path, field },
  };
}

type ParserResult = RankingImportStageResult<
  ParsedRankingSourceDocument,
  CanonicalRankingJsonParserDiagnosticCode
>;

function expectSuccess(
  result: ParserResult,
): asserts result is Extract<ParserResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(
      `Expected success, received ${JSON.stringify(result.errors)}`,
    );
  }
}

function expectFailure(
  result: ParserResult,
  errors: Extract<ParserResult, { ok: false }>["errors"],
): asserts result is Extract<ParserResult, { ok: false }> {
  expect(result).toEqual({
    ok: false,
    errors,
    warnings: [],
  });

  if (result.ok) {
    throw new Error("Expected parser failure.");
  }
}

function expectFailureCodes(
  result: ParserResult,
  codes: CanonicalRankingJsonParserDiagnosticCode[],
): asserts result is Extract<ParserResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected parser failure.");
  }

  expect(result.errors.map((diagnostic) => diagnostic.code)).toEqual(codes);
  expect(
    result.errors.every(
      (diagnostic) =>
        diagnostic.stage === "parse" && diagnostic.severity === "error",
    ),
  ).toBe(true);
  expect(result.warnings).toEqual([]);
}
