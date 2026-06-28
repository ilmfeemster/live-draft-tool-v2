import { describe, expect, expectTypeOf, it } from "vitest";
import {
  exportCanonicalRankingSetJson,
  type CanonicalRankingJsonExportResult,
} from "@/lib/canonicalRankingJsonExporter";
import { parseCanonicalRankingJson } from "@/lib/canonicalRankingJsonParser";
import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  RANKING_IMPORT_LIMITS,
  preflightRankingImport,
} from "@/lib/rankingImportPreflight";
import { validateNormalizedRankingCandidate } from "@/lib/rankingCandidateValidation";
import { normalizeRankingSource } from "@/lib/rankingNormalizer";
import { convertValidatedRankingCandidate } from "@/lib/rankingSetConversion";
import type { Position, RankingEntry } from "@/types/draft";
import type { CanonicalRankingSetDocumentV1 } from "@/types/rankingImport";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingSet,
  type RankingSetCapabilities,
} from "@/types/rankings";

const exportedAt = new Date("2026-06-28T15:00:00.000Z");

describe("exportCanonicalRankingSetJson", () => {
  it("produces exact compact V1 JSON in frozen property order", () => {
    const rankingSet = createCompleteSet();
    const result = exportCanonicalRankingSetJson(rankingSet, {
      exportedAt,
      includeSourceRankingSetId: true,
    });

    expectSuccess(result);
    const expected =
      '{"schemaVersion":1,"metadata":{"name":"Complete Rankings","exportedAt":"2026-06-28T15:00:00.000Z","sourceRankingSetId":"local-set-1","source":{"kind":"external","formatId":"fantasypros-csv","formatVersion":1,"label":"rankings.csv","importedAt":"2026-06-27T12:00:00.000Z"}},"capabilities":{"team":"complete","playerIdentity":"provided","overallOrder":"explicit","positionRank":"derived","adp":"complete","tiers":{"QB":"source","RB":"source"}},"entries":[{"player":{"id":"qb-1","name":"Player qb-1","team":"SEA","position":"QB"},"overallRank":1,"positionRank":1,"tier":1,"adpRank":1.5},{"player":{"id":"rb-1","name":"Player rb-1","team":"BUF","position":"RB"},"overallRank":2,"positionRank":1,"tier":2,"adpRank":2.5},{"player":{"id":"qb-2","name":"Player qb-2","team":"KC","position":"QB"},"overallRank":3,"positionRank":2,"tier":5,"adpRank":3.5}]}';

    expect(result.value.text).toBe(expected);
    expect(result.value.document).toEqual(JSON.parse(expected));
    expect(result.value.byteLength).toBe(new TextEncoder().encode(expected).byteLength);
    expect(Object.keys(result.value.document)).toEqual([
      "schemaVersion",
      "metadata",
      "capabilities",
      "entries",
    ]);
    expect(Object.keys(result.value.document.capabilities.tiers)).toEqual([
      "QB",
      "RB",
    ]);
    expectTypeOf(result.value.document).toMatchTypeOf<CanonicalRankingSetDocumentV1>();
  });

  it("omits source identity unless explicitly requested", () => {
    const withoutId = exportCanonicalRankingSetJson(createCompleteSet(), {
      exportedAt,
    });
    const withId = exportCanonicalRankingSetJson(createCompleteSet(), {
      exportedAt,
      includeSourceRankingSetId: true,
    });

    expectSuccess(withoutId);
    expectSuccess(withId);
    expect(withoutId.value.document.metadata).not.toHaveProperty(
      "sourceRankingSetId",
    );
    expect(withId.value.document.metadata.sourceRankingSetId).toBe(
      "local-set-1",
    );
  });

  it("preserves canonical entry order, tier gaps, and engine-used values", () => {
    const rankingSet = createCompleteSet();
    const result = exportCanonicalRankingSetJson(rankingSet, { exportedAt });

    expectSuccess(result);
    expect(result.value.document.entries).toEqual(rankingSet.entries);
    expect(result.value.document.entries.map((entry) => entry.tier)).toEqual([
      1, 2, 5,
    ]);
    expect(result.value.document.entries.map((entry) => entry.player.id)).toEqual([
      "qb-1",
      "rb-1",
      "qb-2",
    ]);
  });

  it("preserves degraded values and defaulted capability provenance", () => {
    const result = exportCanonicalRankingSetJson(createDegradedSet(), {
      exportedAt,
    });

    expectSuccess(result);
    expect(result.value.document.capabilities).toEqual({
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
    expect(result.value.document.entries).toEqual([
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
  });

  it("omits absent source fields rather than writing null", () => {
    const result = exportCanonicalRankingSetJson(createDegradedSet(), {
      exportedAt,
    });

    expectSuccess(result);
    expect(result.value.document.metadata.source).toEqual({ kind: "manual" });
    expect(result.value.text).not.toContain('"formatId":null');
    expect(result.value.text).not.toContain('"importedAt":null');
  });

  it("excludes lifecycle, Scenario V1, draft, recommendation, and source-record state", () => {
    const result = exportCanonicalRankingSetJson(createCompleteSet(), {
      exportedAt,
    });

    expectSuccess(result);
    const forbidden = [
      "createdAt",
      "updatedAt",
      "rankingContext",
      "leagueSettings",
      "draftConfiguration",
      "userTeamContext",
      "pickHistory",
      "replayTarget",
      "recommendations",
      "draft",
      "sourceIndex",
      "fieldLocations",
      "location",
    ];

    forbidden.forEach((field) => {
      expect(result.value.text).not.toContain(`"${field}"`);
    });
  });

  it("is deterministic and does not mutate or share nested input values", () => {
    const rankingSet = createCompleteSet();
    const before = structuredClone(rankingSet);
    const first = exportCanonicalRankingSetJson(rankingSet, {
      exportedAt,
      includeSourceRankingSetId: true,
    });
    const second = exportCanonicalRankingSetJson(structuredClone(rankingSet), {
      exportedAt: new Date(exportedAt),
      includeSourceRankingSetId: true,
    });

    expectSuccess(first);
    expectSuccess(second);
    expect(first.value).toEqual(second.value);
    expect(rankingSet).toEqual(before);
    expect(first.value.document.metadata.source).not.toBe(rankingSet.source);
    expect(first.value.document.capabilities).not.toBe(rankingSet.capabilities);
    expect(first.value.document.capabilities.tiers).not.toBe(
      rankingSet.capabilities.tiers,
    );
    expect(first.value.document.entries).not.toBe(rankingSet.entries);
    expect(first.value.document.entries[0]).not.toBe(rankingSet.entries[0]);
    expect(first.value.document.entries[0]?.player).not.toBe(
      rankingSet.entries[0]?.player,
    );
  });

  it("rejects invalid request values before domain validation", () => {
    const invalidSet = createCompleteSet({ id: "" });
    const invalidDate = exportCanonicalRankingSetJson(invalidSet, {
      exportedAt: new Date(Number.NaN),
    });
    const invalidOption = exportCanonicalRankingSetJson(invalidSet, {
      exportedAt,
      includeSourceRankingSetId: "yes" as unknown as boolean,
    });

    expectFailure(invalidDate);
    expect(invalidDate.errors[0]?.code).toBe("invalid-export-date");
    expectFailure(invalidOption);
    expect(invalidOption.errors[0]?.code).toBe("invalid-export-option");
  });

  it("maps ordered canonical domain failures", () => {
    const result = exportCanonicalRankingSetJson(
      createCompleteSet({ id: "", name: " " }),
      { exportedAt },
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "invalid-ranking-set",
        message: "Ranking set ID must be a non-empty string.",
        path: "id",
      },
      {
        code: "invalid-ranking-set",
        message: "Ranking set name must be a non-empty string.",
        path: "name",
      },
    ]);
  });

  it("rejects 1,001 domain-valid entries at the portable limit", () => {
    const entries = Array.from(
      { length: RANKING_IMPORT_LIMITS.maxEntries + 1 },
      (_, index) =>
        createEntry(
          `qb-${index + 1}`,
          index + 1,
          "QB",
          index + 1,
          1,
          "SEA",
          null,
        ),
    );
    const result = exportCanonicalRankingSetJson(
      createCompleteSet({
        entries,
        capabilities: createCapabilities({
          adp: "none",
          tiers: { QB: "source" },
        }),
      }),
      { exportedAt },
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "entry-limit-exceeded",
        message: "Canonical ranking export must not contain more than 1000 entries.",
        path: "entries",
      },
    ]);
  });

  it("counts UTF-8 bytes and rejects output over one MiB", () => {
    const multibyte = createCompleteSet({ name: "Café Rankings" });
    const multibyteResult = exportCanonicalRankingSetJson(multibyte, {
      exportedAt,
    });
    expectSuccess(multibyteResult);
    expect(multibyteResult.value.byteLength).toBeGreaterThan(
      multibyteResult.value.text.length,
    );

    const oversized = createCompleteSet({
      name: "é".repeat(RANKING_IMPORT_LIMITS.maxBytes),
    });
    const oversizedResult = exportCanonicalRankingSetJson(oversized, {
      exportedAt,
    });
    expectFailure(oversizedResult);
    expect(oversizedResult.errors[0]?.code).toBe("output-too-large");
  });

  it("round-trips a complete set through every public import stage", () => {
    const source = createCompleteSet();
    const exported = exportCanonicalRankingSetJson(source, {
      exportedAt,
      includeSourceRankingSetId: true,
    });
    expectSuccess(exported);

    const roundTrip = importExport(exported.value.text, "new-local-id");

    expect(roundTrip.id).toBe("new-local-id");
    expect(roundTrip.id).not.toBe(source.id);
    expect(roundTrip.name).toBe(source.name);
    expect(roundTrip.source).toEqual(source.source);
    expect(roundTrip.capabilities).toEqual(source.capabilities);
    expect(roundTrip.entries).toEqual(source.entries);
  });

  it("round-trips safely degraded values and provenance", () => {
    const source = createDegradedSet();
    const exported = exportCanonicalRankingSetJson(source, { exportedAt });
    expectSuccess(exported);

    const roundTrip = importExport(exported.value.text, "degraded-copy");

    expect(roundTrip.capabilities).toEqual(source.capabilities);
    expect(roundTrip.entries).toEqual(source.entries);
    expect(roundTrip.entries.every((entry) => entry.player.team === UNKNOWN_TEAM)).toBe(
      true,
    );
    expect(roundTrip.entries.every((entry) => entry.adpRank === null)).toBe(true);
  });

  it("keeps included source identity portable and non-authoritative", () => {
    const exported = exportCanonicalRankingSetJson(createCompleteSet(), {
      exportedAt,
      includeSourceRankingSetId: true,
    });
    expectSuccess(exported);

    const parsed = parseExport(exported.value.text);
    const metadata = parsed.metadata as {
      documentMetadata: { value: Record<string, unknown> };
    };
    expect(metadata.documentMetadata.value.sourceRankingSetId).toBe(
      "local-set-1",
    );

    const roundTrip = importExport(exported.value.text, "explicit-new-id");
    expect(roundTrip.id).toBe("explicit-new-id");
  });
});

function createCompleteSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "local-set-1",
    name: "Complete Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      label: "rankings.csv",
      importedAt: new Date("2026-06-27T12:00:00.000Z"),
    },
    capabilities: createCapabilities(),
    entries: [
      createEntry("qb-1", 1, "QB", 1, 1, "SEA", 1.5),
      createEntry("rb-1", 2, "RB", 1, 2, "BUF", 2.5),
      createEntry("qb-2", 3, "QB", 2, 5, "KC", 3.5),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    ...overrides,
  };
}

function createDegradedSet(): RankingSet {
  return {
    id: "degraded-set",
    name: "Degraded Rankings",
    source: { kind: "manual" },
    capabilities: {
      team: "none",
      playerIdentity: "generated",
      overallOrder: "row-derived",
      positionRank: "derived",
      adp: "none",
      tiers: {
        QB: "defaulted-neutral",
        RB: "defaulted-neutral",
      },
    },
    entries: [
      createEntry(
        "generated-qb",
        1,
        "QB",
        1,
        NEUTRAL_TIER,
        UNKNOWN_TEAM,
        null,
      ),
      createEntry(
        "generated-rb",
        2,
        "RB",
        1,
        NEUTRAL_TIER,
        UNKNOWN_TEAM,
        null,
      ),
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-28T12:00:00.000Z"),
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
    tiers: { RB: "source", QB: "source" },
    ...overrides,
  };
}

function createEntry(
  id: string,
  overallRank: number,
  position: Position,
  positionRank: number,
  tier: number,
  team: string,
  adpRank: number | null,
): RankingEntry {
  return {
    player: { id, name: `Player ${id}`, team, position },
    overallRank,
    positionRank,
    tier,
    adpRank,
  };
}

function parseExport(text: string) {
  const bytes = new TextEncoder().encode(text);
  const preflight = preflightRankingImport({
    formatId: CANONICAL_RANKING_JSON_V1_FORMAT.id,
    formatVersion: CANONICAL_RANKING_JSON_V1_FORMAT.version,
    bytes,
  });

  if (!preflight.ok) {
    throw new Error(`Preflight failed: ${JSON.stringify(preflight.errors)}`);
  }

  const parsed = parseCanonicalRankingJson(preflight.value);

  if (!parsed.ok) {
    throw new Error(`Parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  return parsed.value;
}

function importExport(text: string, newLocalId: string): RankingSet {
  const parsed = parseExport(text);
  const normalized = normalizeRankingSource(parsed, {
    importedAt: new Date("2026-06-28T16:00:00.000Z"),
  });

  if (!normalized.ok) {
    throw new Error(`Normalization failed: ${JSON.stringify(normalized.errors)}`);
  }

  const validated = validateNormalizedRankingCandidate(normalized.value);

  if (!validated.ok) {
    throw new Error(`Validation failed: ${JSON.stringify(validated.errors)}`);
  }

  const converted = convertValidatedRankingCandidate(validated.value, {
    workflow: "create",
    rankingSetId: newLocalId,
    timestamp: new Date("2026-06-28T16:00:00.000Z"),
  });

  if (!converted.ok) {
    throw new Error(`Conversion failed: ${JSON.stringify(converted.errors)}`);
  }

  return converted.value.rankingSet;
}

function expectSuccess(
  result: CanonicalRankingJsonExportResult,
): asserts result is Extract<CanonicalRankingJsonExportResult, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected export success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: CanonicalRankingJsonExportResult,
): asserts result is Extract<CanonicalRankingJsonExportResult, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected export failure.");
  }
}
