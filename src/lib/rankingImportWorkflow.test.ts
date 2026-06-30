import { describe, expect, it } from "vitest";
import {
  importRankingSet,
  type RankingImportWorkflowRepository,
} from "@/lib/rankingImportWorkflow";
import type {
  ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import type { RankingEntry } from "@/types/draft";
import type { RankingImportFormatId } from "@/types/rankingImport";
import type { RankingSet } from "@/types/rankings";

const importedAt = new Date("2026-06-30T12:00:00.000Z");

describe("ranking import workflow", () => {
  it("creates a managed ranking set from FantasyPros CSV", async () => {
    const fake = createFakeRepository();

    const result = await importRankingSet(createCsvInput(), {
      repository: fake.repository,
      generateRankingSetId: () => "created-rankings",
      now: () => importedAt,
    });

    expectSuccess(result);
    expect(result.created).toBe(true);
    expect(result.replaced).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "adp-defaulted",
    ]);
    expect(result.rankingSet).toMatchObject({
      id: "created-rankings",
      name: "Imported Rankings",
      source: {
        kind: "external",
        formatId: "fantasypros-csv",
        formatVersion: 1,
        label: "rankings.csv",
        importedAt,
      },
      capabilities: {
        team: "complete",
        playerIdentity: "generated",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "partial",
        tiers: { QB: "source", RB: "source" },
      },
      createdAt: importedAt,
      updatedAt: importedAt,
    });
    expect(
      result.rankingSet.entries.map((entry) => ({
        id: entry.player.id,
        overallRank: entry.overallRank,
        positionRank: entry.positionRank,
        tier: entry.tier,
        adpRank: entry.adpRank,
      })),
    ).toEqual([
      {
        id: "fantasypros-v1:qb:passer",
        overallRank: 1,
        positionRank: 1,
        tier: 1,
        adpRank: 3,
      },
      {
        id: "fantasypros-v1:rb:runner",
        overallRank: 2,
        positionRank: 1,
        tier: 1,
        adpRank: null,
      },
    ]);
    expect(result.rankingSet.entries[0]).not.toHaveProperty("sourceIndex");
    expect(result.rankingSet).not.toHaveProperty("normalizedName");
    expect(fake.createCount).toBe(1);
    expect(fake.replaceCount).toBe(0);
    expect(fake.loadCount).toBe(0);
  });

  it("creates an independent managed set from canonical JSON without reusing portable identity", async () => {
    const fake = createFakeRepository();

    const result = await importRankingSet(createCanonicalInput(), {
      repository: fake.repository,
      generateRankingSetId: () => "local-created-id",
      now: () => importedAt,
    });

    expectSuccess(result);
    expect(result.rankingSet.id).toBe("local-created-id");
    expect(result.rankingSet).not.toHaveProperty("sourceRankingSetId");
    expect(result.rankingSet.entries[0]?.player.id).toBe("portable-qb");
    expect(fake.records).toHaveLength(1);
  });

  it("returns normalization warnings for permitted missing optional CSV fields", async () => {
    const fake = createFakeRepository();

    const result = await importRankingSet(
      {
        text: "PLAYER NAME,POS\nFallback QB,QB\nFallback RB,RB",
        formatId: "fantasypros-csv",
        name: "Fallback Rankings",
      },
      {
        repository: fake.repository,
        generateRankingSetId: () => "fallback-rankings",
        now: () => importedAt,
      },
    );

    expectSuccess(result);
    expect(result.rankingSet.capabilities).toMatchObject({
      team: "none",
      adp: "none",
      tiers: {
        QB: "defaulted-neutral",
        RB: "defaulted-neutral",
      },
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "team-defaulted",
      "adp-defaulted",
      "tiers-defaulted-neutral",
      "tiers-defaulted-neutral",
    ]);
  });

  it("stops before repository writes for request, parse, normalize, validate, and convert failures", async () => {
    const cases = [
      {
        name: "unsupported request format",
        input: {
          ...createCsvInput(),
          formatId: "scenario-json" as RankingImportFormatId,
        },
        expectedStage: "preflight",
      },
      {
        name: "parser failure",
        input: {
          ...createCsvInput(),
          text: 'PLAYER NAME,POS\n"Unclosed,QB',
        },
        expectedStage: "parse",
      },
      {
        name: "normalization failure",
        input: {
          ...createCsvInput(),
          text: "PLAYER NAME,POS\nBad Position,DEF",
        },
        expectedStage: "normalize",
      },
      {
        name: "validation failure",
        input: {
          ...createCsvInput(),
          text: "PLAYER NAME,POS\nSame,QB\nSame,QB",
        },
        expectedStage: "validate",
      },
      {
        name: "conversion failure",
        input: {
          ...createCsvInput(),
          intent: { kind: "create", rankingSetId: " " },
        },
        expectedStage: "convert",
      },
    ] as const;

    for (const { input, expectedStage } of cases) {
      const fake = createFakeRepository();
      const result = await importRankingSet(input, {
        repository: fake.repository,
        now: () => importedAt,
      });

      expectFailure(result);
      expect(result.errors[0]?.stage).toBe(expectedStage);
      expect(fake.createCount).toBe(0);
      expect(fake.replaceCount).toBe(0);
    }
  });

  it("maps create name conflicts to persist diagnostics and preserves warnings", async () => {
    const fake = createFakeRepository();
    fake.records.push(createExistingSet({ name: "Fallback Rankings" }));

    const result = await importRankingSet(
      {
        text: "PLAYER NAME,POS\nFallback QB,QB\nFallback RB,RB",
        formatId: "fantasypros-csv",
        name: " fallback rankings ",
      },
      {
        repository: fake.repository,
        generateRankingSetId: () => "conflicting-name",
        now: () => importedAt,
      },
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "persistence-name-conflict",
        stage: "persist",
        severity: "error",
        message: "A ranking set with this name already exists.",
        location: { path: "name" },
      },
    ]);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "team-defaulted",
    );
    expect(fake.records).toHaveLength(1);
  });

  it("replaces an existing set while preserving local identity and createdAt", async () => {
    const fake = createFakeRepository();
    const existing = createExistingSet();
    fake.records.push(existing);

    const result = await importRankingSet(
      {
        ...createCsvInput({ name: "Replacement Rankings" }),
        intent: { kind: "replace", rankingSetId: existing.id },
      },
      {
        repository: fake.repository,
        now: () => importedAt,
      },
    );

    expectSuccess(result);
    expect(result.created).toBe(false);
    expect(result.replaced).toBe(true);
    expect(result.rankingSet.id).toBe(existing.id);
    expect(result.rankingSet.createdAt).toEqual(existing.createdAt);
    expect(result.rankingSet.updatedAt).toEqual(importedAt);
    expect(result.rankingSet.name).toBe("Replacement Rankings");
    expect(fake.loadCount).toBe(1);
    expect(fake.createCount).toBe(0);
    expect(fake.replaceCount).toBe(1);
    expect(fake.records).toEqual([result.rankingSet]);
  });

  it("does not replace an existing set when replacement import fails", async () => {
    const fake = createFakeRepository();
    const existing = createExistingSet();
    fake.records.push(existing);

    const result = await importRankingSet(
      {
        ...createCsvInput({
          text: "PLAYER NAME,POS\nBad,DEF",
        }),
        intent: { kind: "replace", rankingSetId: existing.id },
      },
      {
        repository: fake.repository,
        now: () => importedAt,
      },
    );

    expectFailure(result);
    expect(result.errors[0]?.stage).toBe("normalize");
    expect(fake.records).toEqual([existing]);
    expect(fake.replaceCount).toBe(0);
  });

  it("returns not-found diagnostics for missing replacement targets before and after conversion", async () => {
    const missingBefore = createFakeRepository();

    const missingBeforeResult = await importRankingSet(
      {
        ...createCsvInput(),
        intent: { kind: "replace", rankingSetId: "missing" },
      },
      {
        repository: missingBefore.repository,
        now: () => importedAt,
      },
    );

    expectFailure(missingBeforeResult);
    expect(missingBeforeResult.errors).toEqual([
      {
        code: "persistence-not-found",
        stage: "persist",
        severity: "error",
        message: "Ranking set was not found.",
        location: { path: "id" },
      },
    ]);
    expect(missingBefore.replaceCount).toBe(0);

    const missingAfter = createFakeRepository();
    missingAfter.records.push(createExistingSet({ id: "existing" }));
    missingAfter.replaceResult = {
      ok: false,
      errors: [
        {
          code: "not-found",
          message: "Ranking set was not found.",
          path: "id",
        },
      ],
    };
    const missingAfterResult = await importRankingSet(
      {
        ...createCsvInput(),
        intent: { kind: "replace", rankingSetId: "existing" },
      },
      {
        repository: missingAfter.repository,
        now: () => importedAt,
      },
    );

    expectFailure(missingAfterResult);
    expect(missingAfterResult.errors[0]).toMatchObject({
      code: "persistence-not-found",
      stage: "persist",
      location: { path: "id" },
    });
    expect(missingAfter.replaceCount).toBe(1);
  });

  it("preserves diagnostic locations through the application boundary", async () => {
    const fake = createFakeRepository();

    const result = await importRankingSet(
      {
        ...createCsvInput(),
        text: "PLAYER NAME,POS\nBad,DEF",
      },
      {
        repository: fake.repository,
        now: () => importedAt,
      },
    );

    expectFailure(result);
    expect(result.errors[0]).toMatchObject({
      stage: "normalize",
      location: { row: 2, column: 2, field: "position" },
    });
  });

  it("rejects replacement intent without a target id before loading", async () => {
    const fake = createFakeRepository();

    const result = await importRankingSet(
      {
        ...createCsvInput(),
        intent: { kind: "replace", rankingSetId: " " },
      },
      {
        repository: fake.repository,
        now: () => importedAt,
      },
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "invalid-import-request",
        stage: "preflight",
        severity: "error",
        message: "Replacement ranking set ID must be a non-empty string.",
        location: { path: "intent.rankingSetId" },
      },
    ]);
    expect(fake.loadCount).toBe(0);
  });
});

function createCsvInput(
  overrides: Partial<Parameters<typeof importRankingSet>[0]> = {},
): Parameters<typeof importRankingSet>[0] {
  return {
    text:
      "RK,TIERS,PLAYER NAME,TEAM,POS,ECR VS ADP\n" +
      "2,1,Runner,BUF,RB1,-\n" +
      "1,1,Passer,KC,QB1,+2",
    formatId: "fantasypros-csv",
    name: "Imported Rankings",
    sourceLabel: "rankings.csv",
    ...overrides,
  };
}

function createCanonicalInput(): Parameters<typeof importRankingSet>[0] {
  return {
    text: JSON.stringify({
      schemaVersion: 1,
      metadata: {
        name: "Portable Rankings",
        exportedAt: "2026-06-29T12:00:00.000Z",
        sourceRankingSetId: "portable-id",
      },
      capabilities: {
        team: "complete",
        playerIdentity: "provided",
        overallOrder: "explicit",
        positionRank: "derived",
        adp: "none",
        tiers: { QB: "source" },
      },
      entries: [
        {
          player: {
            id: "portable-qb",
            name: "Portable QB",
            team: "KC",
            position: "QB",
          },
          overallRank: 1,
          positionRank: 1,
          tier: 1,
          adpRank: null,
        },
      ],
    }),
    formatId: "canonical-ranking-json",
    name: "Imported Portable",
  };
}

function createFakeRepository() {
  const state = {
    records: [] as RankingSet[],
    createCount: 0,
    replaceCount: 0,
    loadCount: 0,
    replaceResult: undefined as ReplaceRankingSetResult | undefined,
  };

  const repository: RankingImportWorkflowRepository = {
    async createRankingSet(rankingSet) {
      state.createCount += 1;

      if (
        state.records.some(
          (record) =>
            normalizeName(record.name) === normalizeName(rankingSet.name),
        )
      ) {
        return {
          ok: false,
          errors: [
            {
              code: "name-conflict",
              message: "A ranking set with this name already exists.",
              path: "name",
            },
          ],
        };
      }

      const saved = cloneRankingSet(rankingSet);
      state.records.push(saved);
      return { ok: true, rankingSet: cloneRankingSet(saved) };
    },

    async replaceRankingSet(rankingSet) {
      state.replaceCount += 1;

      if (state.replaceResult) {
        return state.replaceResult;
      }

      const index = state.records.findIndex(
        (record) => record.id === rankingSet.id,
      );

      if (index < 0) {
        return {
          ok: false,
          errors: [
            {
              code: "not-found",
              message: "Ranking set was not found.",
              path: "id",
            },
          ],
        };
      }

      state.records[index] = cloneRankingSet(rankingSet);
      return { ok: true, rankingSet: cloneRankingSet(rankingSet) };
    },

    async getRankingSetById(id) {
      state.loadCount += 1;
      const record = state.records.find((candidate) => candidate.id === id);
      return record ? cloneRankingSet(record) : null;
    },
  };

  return {
    repository,
    get records() {
      return state.records;
    },
    get createCount() {
      return state.createCount;
    },
    get replaceCount() {
      return state.replaceCount;
    },
    get loadCount() {
      return state.loadCount;
    },
    set replaceResult(value: ReplaceRankingSetResult | undefined) {
      state.replaceResult = value;
    },
  };
}

function createExistingSet(overrides: Partial<RankingSet> = {}): RankingSet {
  return {
    id: "existing-set",
    name: "Existing Rankings",
    source: {
      kind: "external",
      formatId: "fantasypros-csv",
      formatVersion: 1,
      importedAt: new Date("2026-06-28T12:00:00.000Z"),
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
          id: "existing-qb",
          name: "Existing QB",
          team: "KC",
          position: "QB",
        },
        overallRank: 1,
        positionRank: 1,
        tier: 1,
        adpRank: null,
      },
    ],
    createdAt: new Date("2026-06-20T12:00:00.000Z"),
    updatedAt: new Date("2026-06-28T12:00:00.000Z"),
    ...overrides,
  };
}

function cloneRankingSet(rankingSet: RankingSet): RankingSet {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    source: {
      ...rankingSet.source,
      ...(rankingSet.source.importedAt === undefined
        ? {}
        : { importedAt: new Date(rankingSet.source.importedAt) }),
    },
    capabilities: {
      ...rankingSet.capabilities,
      tiers: { ...rankingSet.capabilities.tiers },
    },
    entries: rankingSet.entries.map(cloneEntry),
    createdAt: new Date(rankingSet.createdAt),
    updatedAt: new Date(rankingSet.updatedAt),
  };
}

function cloneEntry(entry: RankingEntry): RankingEntry {
  return {
    player: { ...entry.player },
    overallRank: entry.overallRank,
    adpRank: entry.adpRank,
    positionRank: entry.positionRank,
    tier: entry.tier,
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

function expectSuccess(
  result: Awaited<ReturnType<typeof importRankingSet>>,
): asserts result is Extract<
  Awaited<ReturnType<typeof importRankingSet>>,
  { ok: true }
> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected import success: ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: Awaited<ReturnType<typeof importRankingSet>>,
): asserts result is Extract<
  Awaited<ReturnType<typeof importRankingSet>>,
  { ok: false }
> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected import failure.");
  }
}
