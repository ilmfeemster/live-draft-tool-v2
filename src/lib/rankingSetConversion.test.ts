import { describe, expect, expectTypeOf, it } from "vitest";
import { parseCanonicalRankingJson } from "@/lib/canonicalRankingJsonParser";
import { parseFantasyProsCsv } from "@/lib/fantasyProsCsvParser";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  FANTASYPROS_CSV_V1_FORMAT,
} from "@/lib/rankingImportPreflight";
import { validateNormalizedRankingCandidate } from "@/lib/rankingCandidateValidation";
import { normalizeRankingSource } from "@/lib/rankingNormalizer";
import {
  convertValidatedRankingCandidate,
  type RankingSetConversionDiagnosticCode,
  type RankingSetConversionRequest,
} from "@/lib/rankingSetConversion";
import {
  validateRankingSet,
  type RankingSetValidationResult,
} from "@/lib/rankingSetValidation";
import type { Position } from "@/types/draft";
import type {
  ConvertedRankingSet,
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

const createTimestamp = new Date("2026-06-28T12:00:00.000Z");

describe("convertValidatedRankingCandidate", () => {
  it("converts FantasyPros source tiers into metadata and neutral recommendation tiers", () => {
    const validated = validatedCsv(
      "RK,TIER,PLAYER NAME,TEAM,POS,ECR VS ADP\n" +
        "10,1,Quarterback,KC,QB1,+2\n" +
        "2,2,Running Back,BUF,RB1,-\n" +
        "40,4,Second Quarterback,SEA,QB2,0",
      "FantasyPros Rankings",
    );
    const result = convertValidatedRankingCandidate(validated, {
      workflow: "create",
      rankingSetId: "local-create-1",
      timestamp: createTimestamp,
    });

    expectSuccess(result);
    expect(result.value.rankingSet).toEqual({
      id: "local-create-1",
      name: "FantasyPros Rankings",
      source: {
        kind: "external",
        formatId: "fantasypros-csv",
        formatVersion: 1,
        importedAt: createTimestamp,
      },
      capabilities: {
        team: "complete",
        playerIdentity: "generated",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "partial",
        tiers: { QB: "defaulted-neutral", RB: "defaulted-neutral" },
      },
      tierSemantics: {
        source: {
          kind: "source-overall",
          values: [
            {
              playerId: "fantasypros-v1:rb:running%20back",
              overallRank: 1,
              tier: 2,
            },
            {
              playerId: "fantasypros-v1:qb:quarterback",
              overallRank: 2,
              tier: 1,
            },
            {
              playerId: "fantasypros-v1:qb:second%20quarterback",
              overallRank: 3,
              tier: 4,
            },
          ],
        },
        recommendation: { RB: "neutral", QB: "neutral" },
      },
      entries: [
        {
          player: {
            id: "fantasypros-v1:rb:running%20back",
            name: "Running Back",
            team: "BUF",
            position: "RB",
          },
          overallRank: 1,
          positionRank: 1,
          tier: NEUTRAL_TIER,
          adpRank: null,
        },
        {
          player: {
            id: "fantasypros-v1:qb:quarterback",
            name: "Quarterback",
            team: "KC",
            position: "QB",
          },
          overallRank: 2,
          positionRank: 1,
          tier: 1,
          adpRank: 12,
        },
        {
          player: {
            id: "fantasypros-v1:qb:second%20quarterback",
            name: "Second Quarterback",
            team: "SEA",
            position: "QB",
          },
          overallRank: 3,
          positionRank: 2,
          tier: NEUTRAL_TIER,
          adpRank: 40,
        },
      ],
      createdAt: createTimestamp,
      updatedAt: createTimestamp,
    });
    expectDomainSuccess(validateRankingSet(result.value.rankingSet));
    expect(result.value.rankingSet.entries[0]).not.toHaveProperty("sourceOrder");
    expect(result.value.rankingSet.entries[0]).not.toHaveProperty(
      "sourcePositionRank",
    );
    expect(result.value.rankingSet.entries[0]).not.toHaveProperty("location");
  });

  it("converts Canonical JSON without reusing portable local identity", () => {
    const validated = validatedCanonical({
      schemaVersion: 1,
      metadata: {
        name: "Portable Rankings",
        exportedAt: "2026-06-28T11:00:00.000Z",
        sourceRankingSetId: "portable-set-never-local",
        source: {
          kind: "canonical",
          formatId: "canonical-ranking-json",
          formatVersion: 1,
          importedAt: "2026-06-27T12:00:00.000Z",
        },
      },
      capabilities: {
        team: "complete",
        playerIdentity: "provided",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "none",
        tiers: { WR: "source" },
      },
      entries: [
        {
          player: {
            id: "portable-player",
            name: "Portable Player",
            team: "CIN",
            position: "WR",
          },
          overallRank: 8,
          positionRank: 1,
          tier: 3,
          adpRank: null,
        },
      ],
    });
    const result = convertValidatedRankingCandidate(validated, {
      workflow: "create",
      rankingSetId: "new-local-id",
      timestamp: createTimestamp,
    });

    expectSuccess(result);
    expect(result.value.rankingSet.id).toBe("new-local-id");
    expect(result.value.rankingSet).not.toHaveProperty("sourceRankingSetId");
    expect(result.value.rankingSet.entries[0]?.overallRank).toBe(1);
    expect(result.value.rankingSet.entries[0]?.player.id).toBe(
      "portable-player",
    );
  });

  it("derives contiguous ranks while preserving source tier gaps", () => {
    const validated = validateCandidate(
      createCandidate({
        entries: [
          createEntry(0, "qb-2", 40, "QB", 2, 5),
          createEntry(1, "wr-1", 2, "WR", 1, 1),
          createEntry(2, "qb-1", 10, "QB", 1, 1),
          createEntry(3, "wr-2", 80, "WR", 2, 4),
        ],
        capabilities: createCapabilities({
          tiers: { QB: "source", WR: "source" },
        }),
      }),
    );
    const result = convertValidatedRankingCandidate(validated, createRequest());

    expectSuccess(result);
    expect(
      result.value.rankingSet.entries.map((entry) => ({
        id: entry.player.id,
        overallRank: entry.overallRank,
        positionRank: entry.positionRank,
        tier: entry.tier,
      })),
    ).toEqual([
      { id: "wr-1", overallRank: 1, positionRank: 1, tier: 1 },
      { id: "qb-1", overallRank: 2, positionRank: 1, tier: 1 },
      { id: "qb-2", overallRank: 3, positionRank: 2, tier: 5 },
      { id: "wr-2", overallRank: 4, positionRank: 2, tier: 4 },
    ]);
  });

  it("preserves normalized fallback values and capabilities", () => {
    const validated = validatedCsv(
      "PLAYER NAME,POS\nUnknown QB,QB\nUnknown RB,RB",
      "Degraded",
    );
    const result = convertValidatedRankingCandidate(validated, createRequest());

    expectSuccess(result);
    expect(result.value.rankingSet.entries).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
      expect.objectContaining({
        player: expect.objectContaining({ team: UNKNOWN_TEAM }),
        adpRank: null,
        tier: NEUTRAL_TIER,
      }),
    ]);
    expect(result.value.rankingSet.capabilities).toEqual({
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
    expect(result.value.rankingSet.tierSemantics).toEqual({
      source: { kind: "none" },
      recommendation: { QB: "neutral", RB: "neutral" },
    });
    expectDomainSuccess(validateRankingSet(result.value.rankingSet));
  });

  it("assigns create lifecycle values into independent Date objects", () => {
    const validated = validateCandidate(createCandidate());
    const result = convertValidatedRankingCandidate(validated, createRequest());

    expectSuccess(result);
    expect(result.value.rankingSet.createdAt).toEqual(createTimestamp);
    expect(result.value.rankingSet.updatedAt).toEqual(createTimestamp);
    expect(result.value.rankingSet.createdAt).not.toBe(createTimestamp);
    expect(result.value.rankingSet.updatedAt).not.toBe(createTimestamp);
    expect(result.value.rankingSet.createdAt).not.toBe(
      result.value.rankingSet.updatedAt,
    );
  });

  it("preserves replacement identity and creation time with a later update", () => {
    const createdAt = new Date("2026-06-20T12:00:00.000Z");
    const updatedAt = new Date("2026-06-28T14:00:00.000Z");
    const validated = validateCandidate(createCandidate());
    const result = convertValidatedRankingCandidate(validated, {
      workflow: "replace",
      rankingSetId: "existing-local-id",
      createdAt,
      timestamp: updatedAt,
    });

    expectSuccess(result);
    expect(result.value.rankingSet.id).toBe("existing-local-id");
    expect(result.value.rankingSet.createdAt).toEqual(createdAt);
    expect(result.value.rankingSet.updatedAt).toEqual(updatedAt);
    expect(result.value.rankingSet.createdAt).not.toBe(createdAt);
    expect(result.value.rankingSet.updatedAt).not.toBe(updatedAt);
  });

  it("copies source, capabilities, tier maps, entries, players, and dates", () => {
    const candidate = createCandidate();
    const validated = validateCandidate(candidate);
    const before = structuredClone(validated);
    const result = convertValidatedRankingCandidate(validated, createRequest());

    expectSuccess(result);
    const rankingSet = result.value.rankingSet;
    expect(validated).toEqual(before);
    expect(rankingSet.source).not.toBe(candidate.source);
    expect(rankingSet.source.importedAt).not.toBe(candidate.source.importedAt);
    expect(rankingSet.capabilities).not.toBe(candidate.capabilities);
    expect(rankingSet.capabilities.tiers).not.toBe(candidate.capabilities.tiers);
    expect(rankingSet.entries).not.toBe(candidate.entries);
    expect(rankingSet.entries[0]).not.toBe(candidate.entries[0]);
    expect(rankingSet.entries[0]?.player).not.toBe(candidate.entries[0]);
  });

  it("is deterministic without sharing aggregate objects between calls", () => {
    const validated = validateCandidate(createCandidate());
    const request = createRequest();
    const first = convertValidatedRankingCandidate(validated, request);
    const second = convertValidatedRankingCandidate(validated, request);

    expectSuccess(first);
    expectSuccess(second);
    expect(first.value).toEqual(second.value);
    expect(first.value.rankingSet).not.toBe(second.value.rankingSet);
    expect(first.value.rankingSet.entries).not.toBe(
      second.value.rankingSet.entries,
    );
    expectTypeOf(first.value).toMatchTypeOf<ConvertedRankingSet>();
  });

  it.each([
    {
      name: "malformed wrapper",
      validated: { validated: false, candidate: createCandidate() },
      request: createRequest(),
      code: "invalid-validated-candidate",
    },
    {
      name: "unknown workflow",
      validated: { validated: true, candidate: createCandidate() },
      request: { workflow: "merge", rankingSetId: "id", timestamp: createTimestamp },
      code: "invalid-workflow",
    },
    {
      name: "empty local ID",
      validated: { validated: true, candidate: createCandidate() },
      request: { workflow: "create", rankingSetId: " ", timestamp: createTimestamp },
      code: "invalid-ranking-set-id",
    },
    {
      name: "invalid create date",
      validated: { validated: true, candidate: createCandidate() },
      request: {
        workflow: "create",
        rankingSetId: "id",
        timestamp: new Date(Number.NaN),
      },
      code: "invalid-lifecycle-date",
    },
  ])("rejects $name", ({ validated, request, code }) => {
    const result = convertValidatedRankingCandidate(
      validated as ValidatedRankingCandidate,
      request as RankingSetConversionRequest,
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe(code);
    expect(result.errors[0]?.stage).toBe("convert");
    expect(result).not.toHaveProperty("value");
  });

  it("reports replacement dates in field order and rejects reversed lifecycle", () => {
    const validated = validateCandidate(createCandidate());
    const invalidDates = convertValidatedRankingCandidate(validated, {
      workflow: "replace",
      rankingSetId: "existing",
      createdAt: new Date(Number.NaN),
      timestamp: new Date(Number.NaN),
    });

    expectFailure(invalidDates);
    expect(invalidDates.errors.map((entry) => entry.message)).toEqual([
      "Replacement createdAt must be a valid Date.",
      "Replacement timestamp must be a valid Date.",
    ]);

    const reversed = convertValidatedRankingCandidate(validated, {
      workflow: "replace",
      rankingSetId: "existing",
      createdAt: new Date("2026-06-28T13:00:00.000Z"),
      timestamp: new Date("2026-06-28T12:00:00.000Z"),
    });
    expectFailure(reversed);
    expect(reversed.errors[0]?.code).toBe("invalid-lifecycle-order");
  });

  it("rejects forged tied source order instead of inventing a tie breaker", () => {
    const candidate = createCandidate({
      entries: [
        createEntry(0, "qb-1", 1, "QB", 1, 1),
        createEntry(1, "rb-1", 1, "RB", 1, 1),
      ],
    });
    const result = convertValidatedRankingCandidate(
      { validated: true, candidate },
      createRequest(),
    );

    expectFailure(result);
    expect(result.errors[0]?.code).toBe("invalid-validated-candidate");
  });

  it("maps final canonical invariant failures and returns no aggregate", () => {
    const candidate = createCandidate({
      capabilities: createCapabilities({ team: "none" }),
    });
    const result = convertValidatedRankingCandidate(
      { validated: true, candidate },
      createRequest(),
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "canonical-invariant-failed",
        stage: "convert",
        severity: "error",
        message: "capabilities.team must be complete for the canonical entries.",
        location: { path: "capabilities.team" },
      },
    ]);
    expect(result).not.toHaveProperty("value");
  });
});

function createRequest(): RankingSetConversionRequest {
  return {
    workflow: "create",
    rankingSetId: "local-set-1",
    timestamp: createTimestamp,
  };
}

function createCandidate(
  overrides: Partial<NormalizedRankingCandidate> = {},
): NormalizedRankingCandidate {
  return {
    name: "Candidate Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-27T12:00:00.000Z"),
    },
    entries: [
      createEntry(0, "qb-1", 1, "QB", 1, 1),
      createEntry(1, "rb-1", 2, "RB", 1, 1),
      createEntry(2, "qb-2", 3, "QB", 2, 2),
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
): NormalizedRankingCandidateEntry {
  return {
    sourceIndex,
    location: { path: `entries[${sourceIndex}]` },
    fieldLocations: {},
    playerId,
    playerName: `Player ${playerId}`,
    team: "SEA",
    position,
    sourceOrder,
    sourcePositionRank,
    tier,
    adpRank: sourceOrder + 0.5,
  };
}

function validateCandidate(
  candidate: NormalizedRankingCandidate,
): ValidatedRankingCandidate {
  const result = validateNormalizedRankingCandidate(candidate);

  if (!result.ok) {
    throw new Error(`Candidate validation failed: ${JSON.stringify(result.errors)}`);
  }

  return result.value;
}

function validatedCsv(text: string, name: string): ValidatedRankingCandidate {
  const parsed = parseFantasyProsCsv({
    format: FANTASYPROS_CSV_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  });

  if (!parsed.ok) {
    throw new Error(`CSV parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const normalized = normalizeRankingSource(parsed.value, {
    name,
    importedAt: createTimestamp,
  });

  if (!normalized.ok) {
    throw new Error(`CSV normalization failed: ${JSON.stringify(normalized.errors)}`);
  }

  return validateCandidate(normalized.value);
}

function validatedCanonical(value: unknown): ValidatedRankingCandidate {
  const text = JSON.stringify(value);
  const parsed = parseCanonicalRankingJson({
    format: CANONICAL_RANKING_JSON_V1_FORMAT,
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  });

  if (!parsed.ok) {
    throw new Error(`Canonical parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const normalized = normalizeRankingSource(parsed.value, {
    importedAt: createTimestamp,
  });

  if (!normalized.ok) {
    throw new Error(
      `Canonical normalization failed: ${JSON.stringify(normalized.errors)}`,
    );
  }

  return validateCandidate(normalized.value);
}

type ConversionResult = RankingImportStageResult<
  ConvertedRankingSet,
  RankingSetConversionDiagnosticCode
>;

function expectSuccess(
  result: ConversionResult,
): asserts result is Extract<ConversionResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected conversion success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: ConversionResult,
): asserts result is Extract<ConversionResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected conversion failure.");
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
