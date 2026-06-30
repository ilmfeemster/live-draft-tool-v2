import { describe, expect, it } from "vitest";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  CANONICAL_RANKING_JSON_V1_PROFILE,
  FANTASYPROS_CSV_V1_FORMAT,
  FANTASYPROS_CSV_V1_PROFILE,
  FANTASYPROS_CSV_V1_TIER_SEMANTICS,
  RANKING_IMPORT_LIMITS,
  isRankingImportFormatId,
  preflightRankingImport,
  type RankingImportPreflightErrorCode,
} from "@/lib/rankingImportPreflight";
import type {
  CanonicalRankingSetDocumentV1,
  CanonicalRankingSetDocumentV2,
  RankingImportStageResult,
  PreflightRankingDocument,
  RankingTierSemanticContract,
} from "@/types/rankingImport";
import { UNKNOWN_TEAM } from "@/types/rankings";

const encoder = new TextEncoder();

describe("ranking import format profiles", () => {
  it("defines the two approved V1 format references and fixed limits", () => {
    expect(FANTASYPROS_CSV_V1_FORMAT).toEqual({
      id: "fantasypros-csv",
      version: 1,
    });
    expect(CANONICAL_RANKING_JSON_V1_FORMAT).toEqual({
      id: "canonical-ranking-json",
      version: 1,
    });
    expect(RANKING_IMPORT_LIMITS).toEqual({
      maxBytes: 1_048_576,
      maxEntries: 1_000,
    });
    expect(isRankingImportFormatId("fantasypros-csv")).toBe(true);
    expect(isRankingImportFormatId("canonical-ranking-json")).toBe(true);
    expect(isRankingImportFormatId("scenario-json")).toBe(false);
  });

  it("freezes the observed FantasyPros header and normalized semantics", () => {
    expect(FANTASYPROS_CSV_V1_PROFILE.observedHeaders).toEqual([
      "RK",
      "TIERS",
      "PLAYER NAME",
      "TEAM",
      "POS",
      "BYE",
      "UPSIDE ",
      "BUST ",
      "SOS",
      "ECR VS ADP",
    ]);
    expect(
      FANTASYPROS_CSV_V1_PROFILE.observedHeaders.map(normalizeHeader),
    ).toEqual([
      "RK",
      "TIERS",
      "PLAYER NAME",
      "TEAM",
      "POS",
      "BYE",
      "UPSIDE",
      "BUST",
      "SOS",
      "ECR VS ADP",
    ]);
    expect(FANTASYPROS_CSV_V1_PROFILE.headers).toEqual({
      overallOrder: { aliases: ["RK", "RANK"], required: false },
      tier: {
        aliases: ["TIERS", "TIER"],
        required: false,
        tierSemantics: {
          kind: "source-only",
          sourceScope: "overall",
          recommendationEligible: false,
        },
      },
      playerName: { aliases: ["PLAYER NAME", "PLAYER"], required: true },
      team: { aliases: ["TEAM"], required: false },
      position: { aliases: ["POS", "POSITION"], required: true },
      adpDelta: { aliases: ["ECR VS ADP"], required: false },
    });
    expect(FANTASYPROS_CSV_V1_PROFILE.ignoredHeaders).toEqual([
      "BYE",
      "UPSIDE",
      "BUST",
      "SOS",
    ]);
  });

  it("defines required, optional, and absent-column contracts", () => {
    const minimumHeader = ["PLAYER NAME", "POS"];
    const missingOptionalHeader = ["player", "position"];

    expect(minimumHeader.map(normalizeHeader)).toEqual([
      "PLAYER NAME",
      "POS",
    ]);
    expect(missingOptionalHeader.map(normalizeHeader)).toEqual([
      "PLAYER",
      "POSITION",
    ]);
    expect(FANTASYPROS_CSV_V1_PROFILE.hasPlayerIdColumn).toBe(false);
  });

  it("defines the tier semantic vocabulary required by the patch design", () => {
    const contracts: readonly RankingTierSemanticContract[] = [
      {
        kind: "source-only",
        sourceScope: "overall",
        recommendationEligible: false,
      },
      {
        kind: "recommendation-eligible",
        sourceScope: "position",
        recommendationEligible: true,
      },
      { kind: "unsupported", recommendationEligible: false },
      { kind: "absent", recommendationEligible: false },
      {
        kind: "neutral",
        sourceScope: "position",
        recommendationEligible: false,
      },
      {
        kind: "legacy-ambiguous",
        sourceScope: "unknown",
        recommendationEligible: false,
      },
    ];

    expect(contracts.map((contract) => contract.kind)).toEqual([
      "source-only",
      "recommendation-eligible",
      "unsupported",
      "absent",
      "neutral",
      "legacy-ambiguous",
    ]);
  });

  it("defines position, tier, and ADP-delta source semantics", () => {
    const positionPattern = FANTASYPROS_CSV_V1_PROFILE.positionValuePattern;
    const adpPattern = FANTASYPROS_CSV_V1_PROFILE.adpDeltaValuePattern;

    expect(["QB", "RB12", "WR160", "TE1", "DST31", "K4"].every((value) => positionPattern.test(value))).toBe(true);
    expect(["DL1", "RB0", "WR-1", ""].some((value) => positionPattern.test(value))).toBe(false);
    expect(["+2", "-97", "0", "-"].every((value) => adpPattern.test(value))).toBe(true);
    expect(["+0", "--1", "1.5", ""].some((value) => adpPattern.test(value))).toBe(false);
    expect(FANTASYPROS_CSV_V1_PROFILE.adpDeltaNullMarker).toBe("-");
    expect(FANTASYPROS_CSV_V1_PROFILE.headers.tier.tierSemantics).toBe(
      FANTASYPROS_CSV_V1_TIER_SEMANTICS,
    );
  });

  it("defines the canonical JSON V1 envelope contract", () => {
    expect(CANONICAL_RANKING_JSON_V1_PROFILE).toEqual({
      format: CANONICAL_RANKING_JSON_V1_FORMAT,
      schemaVersion: 1,
      maxBytes: 1_048_576,
      maxEntries: 1_000,
      requiredRootFields: [
        "schemaVersion",
        "metadata",
        "capabilities",
        "entries",
      ],
      tierSemantics: {
        kind: "legacy-ambiguous",
        sourceScope: "unknown",
        recommendationEligible: false,
      },
    });

    const document: CanonicalRankingSetDocumentV1 = {
      schemaVersion: 1,
      metadata: {
        name: "Portable Rankings",
        exportedAt: "2026-06-28T12:00:00.000Z",
      },
      capabilities: {
        team: "none",
        playerIdentity: "generated",
        overallOrder: "row-derived",
        positionRank: "derived",
        adp: "none",
        tiers: { QB: "defaulted-neutral" },
      },
      entries: [
        {
          player: {
            id: "generated-qb",
            name: "Generated QB",
            team: UNKNOWN_TEAM,
            position: "QB",
          },
          overallRank: 1,
          adpRank: null,
          positionRank: 1,
          tier: 1,
        },
      ],
    };

    expect(document).not.toHaveProperty("draft");
    expect(document).not.toHaveProperty("recommendations");
  });

  it("defines the explicit canonical JSON tier-semantics document shape", () => {
    const document: CanonicalRankingSetDocumentV2 = {
      schemaVersion: 2,
      metadata: {
        name: "Portable Rankings",
        exportedAt: "2026-06-28T12:00:00.000Z",
      },
      tierSemantics: {
        sourceTier: {
          kind: "source-only",
          sourceScope: "overall",
          recommendationEligible: false,
        },
        recommendationTier: {
          kind: "recommendation-eligible",
          sourceScope: "position",
          recommendationEligible: true,
        },
        legacyTier: {
          kind: "legacy-ambiguous",
          sourceScope: "unknown",
          recommendationEligible: false,
        },
      },
      capabilities: {
        team: "none",
        playerIdentity: "generated",
        overallOrder: "row-derived",
        positionRank: "derived",
        adp: "none",
        tiers: { QB: "defaulted-neutral" },
      },
      entries: [
        {
          player: {
            id: "generated-qb",
            name: "Generated QB",
            team: UNKNOWN_TEAM,
            position: "QB",
          },
          overallRank: 1,
          adpRank: null,
          positionRank: 1,
          sourceTier: null,
          recommendationTier: 1,
        },
      ],
    };

    expect(document.tierSemantics.sourceTier.kind).toBe("source-only");
    expect(document.tierSemantics.recommendationTier.kind).toBe(
      "recommendation-eligible",
    );
    expect(document.entries[0]).not.toHaveProperty("tier");
  });
});

describe("preflightRankingImport", () => {
  it.each([
    FANTASYPROS_CSV_V1_FORMAT,
    CANONICAL_RANKING_JSON_V1_FORMAT,
  ])("accepts valid UTF-8 for $id", (format) => {
    const bytes = encoder.encode("valid document");
    const result = preflightRankingImport({
      formatId: format.id,
      formatVersion: format.version,
      bytes,
    });

    expectSuccess(result);
    expect(result.value).toEqual({
      format,
      text: "valid document",
      byteLength: bytes.byteLength,
    });
    expect(result.warnings).toEqual([]);
  });

  it("strips one leading UTF-8 BOM and preserves original byte length", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x64, 0x61, 0x74, 0x61]);
    const result = preflightRankingImport({
      formatId: "fantasypros-csv",
      formatVersion: 1,
      bytes,
    });

    expectSuccess(result);
    expect(result.value.text).toBe("data");
    expect(result.value.byteLength).toBe(7);
  });

  it("accepts exactly one MiB", () => {
    const bytes = new Uint8Array(RANKING_IMPORT_LIMITS.maxBytes).fill(0x61);
    const result = preflightRankingImport({
      formatId: "fantasypros-csv",
      formatVersion: 1,
      bytes,
    });

    expectSuccess(result);
    expect(result.value.byteLength).toBe(RANKING_IMPORT_LIMITS.maxBytes);
  });

  it("rejects one byte over one MiB", () => {
    const result = preflightRankingImport({
      formatId: "fantasypros-csv",
      formatVersion: 1,
      bytes: new Uint8Array(RANKING_IMPORT_LIMITS.maxBytes + 1),
    });

    expectFailure(result, {
      code: "input-too-large",
      stage: "preflight",
      severity: "error",
      message: "Ranking import input must not exceed 1048576 bytes.",
    });
  });

  it.each([
    { name: "zero bytes", bytes: new Uint8Array() },
    { name: "whitespace only", bytes: encoder.encode(" \r\n\t") },
  ])("rejects $name", ({ bytes }) => {
    const result = preflightRankingImport({
      formatId: "fantasypros-csv",
      formatVersion: 1,
      bytes,
    });

    expectFailure(result, {
      code: "empty-input",
      stage: "preflight",
      severity: "error",
      message: "Ranking import input must not be empty.",
    });
  });

  it("rejects invalid UTF-8", () => {
    const result = preflightRankingImport({
      formatId: "fantasypros-csv",
      formatVersion: 1,
      bytes: new Uint8Array([0xc3, 0x28]),
    });

    expectFailure(result, {
      code: "invalid-encoding",
      stage: "preflight",
      severity: "error",
      message: "Ranking import input must be valid UTF-8.",
    });
  });

  it("rejects unsupported format before inspecting content", () => {
    const result = preflightRankingImport({
      formatId: "scenario-json",
      formatVersion: 99,
      bytes: new Uint8Array(),
    });

    expectFailure(result, {
      code: "unsupported-format",
      stage: "preflight",
      severity: "error",
      message: "Ranking import format scenario-json is unsupported.",
    });
  });

  it("rejects unsupported version before inspecting content", () => {
    const result = preflightRankingImport({
      formatId: "canonical-ranking-json",
      formatVersion: 2,
      bytes: new Uint8Array(),
    });

    expectFailure(result, {
      code: "unsupported-version",
      stage: "preflight",
      severity: "error",
      message: "Ranking import format canonical-ranking-json version 2 is unsupported.",
    });
  });
});

function normalizeHeader(value: string): string {
  return value.trim().toUpperCase();
}

function expectSuccess(
  result: RankingImportStageResult<
    PreflightRankingDocument,
    RankingImportPreflightErrorCode
  >,
): asserts result is Extract<typeof result, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success, received ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: RankingImportStageResult<
    PreflightRankingDocument,
    RankingImportPreflightErrorCode
  >,
  expectedError: {
    code: RankingImportPreflightErrorCode;
    stage: "preflight";
    severity: "error";
    message: string;
  },
): void {
  expect(result).toEqual({
    ok: false,
    errors: [expectedError],
    warnings: [],
  });
  expect(result).not.toHaveProperty("errors.0.location");
}
