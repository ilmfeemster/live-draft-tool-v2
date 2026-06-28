import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseFantasyProsCsv,
  type FantasyProsCsvParserDiagnosticCode,
} from "@/lib/fantasyProsCsvParser";
import {
  RANKING_IMPORT_LIMITS,
  preflightRankingImport,
} from "@/lib/rankingImportPreflight";
import type {
  ParsedRankingSourceDocument,
  PreflightRankingDocument,
  RankingImportStageResult,
} from "@/types/rankingImport";

const encoder = new TextEncoder();

describe("parseFantasyProsCsv", () => {
  it("parses the real 487-record FantasyPros source without warnings", () => {
    const bytes = readFileSync(
      resolve(process.cwd(), "src/data/FantasyPros_2026_Draft_ALL_Rankings.csv"),
    );
    const result = parseFantasyProsCsv(preflight(bytes));

    expectSuccess(result);
    expect(result.warnings).toEqual([]);
    expect(result.value.records).toHaveLength(487);
    expect(result.value.metadata).toEqual({
      physicalHeaders: [
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
      ],
      normalizedHeaders: [
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
      ],
      semanticColumns: {
        overallOrder: 1,
        tier: 2,
        playerName: 3,
        team: 4,
        position: 5,
        adpDelta: 10,
      },
    });
    expect(rawFields(result.value.records[0])).toEqual({
      overallOrder: "1",
      tier: "1",
      playerName: "Ja'Marr Chase",
      team: "CIN",
      position: "WR1",
      adpDelta: "+2",
    });
    expect(rawFields(result.value.records[486])).toEqual({
      overallOrder: "487",
      tier: "16",
      playerName: "New York Jets",
      team: "NYJ",
      position: "DST31",
      adpDelta: "-97",
    });
  });

  it("accepts required-only headers and preserves raw values", () => {
    const result = parseText('PLAYER NAME,POS\n"  Mixed Case  "," wr1 "');

    expectSuccess(result);
    expect(result.warnings).toEqual([]);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "  Mixed Case  ",
      position: " wr1 ",
    });
    expect(result.value.records[0]?.fields.playerName?.location).toEqual({
      row: 2,
      column: 1,
      field: "playerName",
    });
  });

  it("accepts aliases with case and outer header whitespace", () => {
    const result = parseText(" player , position , rank , tier \nAlpha,QB1,1,1");

    expectSuccess(result);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "Alpha",
      position: "QB1",
      overallOrder: "1",
      tier: "1",
    });
  });

  it("omits known ignored columns without warnings", () => {
    const result = parseText(
      "PLAYER NAME,POS,BYE,UPSIDE,BUST,SOS\nAlpha,QB1,8,up,bust,sos",
    );

    expectSuccess(result);
    expect(result.warnings).toEqual([]);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "Alpha",
      position: "QB1",
    });
  });

  it("warns for unknown headers in physical column order and omits them", () => {
    const result = parseText(
      "PLAYER NAME,MYSTERY,POS,OTHER\nAlpha,one,QB1,two",
    );

    expectSuccess(result);
    expect(result.warnings).toEqual([
      {
        code: "unknown-header",
        stage: "parse",
        severity: "warning",
        message:
          "FantasyPros CSV header MYSTERY is unsupported and will be ignored.",
        location: { row: 1, column: 2, field: "MYSTERY" },
      },
      {
        code: "unknown-header",
        stage: "parse",
        severity: "warning",
        message:
          "FantasyPros CSV header OTHER is unsupported and will be ignored.",
        location: { row: 1, column: 4, field: "OTHER" },
      },
    ]);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "Alpha",
      position: "QB1",
    });
  });

  it("rejects duplicate semantics through different aliases", () => {
    const result = parseText("PLAYER NAME,PLAYER,POS\nAlpha,Other,QB1");

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "duplicate-header",
        stage: "parse",
        severity: "error",
        message:
          "FantasyPros CSV header maps more than one column to playerName.",
        location: { row: 1, column: 2, field: "playerName" },
      },
    ]);
  });

  it("reports both missing required semantics in contract order", () => {
    const result = parseText("RK,TEAM\n1,SEA");

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "missing-required-header",
        stage: "parse",
        severity: "error",
        message: "FantasyPros CSV is missing required playerName header.",
        location: { row: 1, field: "playerName" },
      },
      {
        code: "missing-required-header",
        stage: "parse",
        severity: "error",
        message: "FantasyPros CSV is missing required position header.",
        location: { row: 1, field: "position" },
      },
    ]);
  });

  it("parses quoted commas and doubled quote escapes", () => {
    const result = parseText(
      'PLAYER NAME,POS,TEAM\r\n"Smith, Jr.",WR1,"T""M"\r\n',
    );

    expectSuccess(result);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "Smith, Jr.",
      position: "WR1",
      team: 'T"M',
    });
  });

  it("parses quoted multiline values with actual physical field rows", () => {
    const result = parseText('PLAYER NAME,POS\n"Line\nBreak",QB1');

    expectSuccess(result);
    expect(rawFields(result.value.records[0])).toEqual({
      playerName: "Line\nBreak",
      position: "QB1",
    });
    expect(result.value.records[0]?.fields.playerName?.location).toEqual({
      row: 2,
      column: 1,
      field: "playerName",
    });
    expect(result.value.records[0]?.fields.position?.location).toEqual({
      row: 3,
      column: 2,
      field: "position",
    });
  });

  it("preserves signs and null markers without coercion", () => {
    const result = parseText(
      "PLAYER NAME,POS,ECR VS ADP\nPositive,QB1,+2\nNegative,RB1,-7\nMissing,WR1,-",
    );

    expectSuccess(result);
    expect(result.value.records.map((record) => rawFields(record).adpDelta)).toEqual([
      "+2",
      "-7",
      "-",
    ]);
  });

  it("skips physical blank lines while preserving rows and source indexes", () => {
    const result = parseText(
      "\nPLAYER NAME,POS\n\nAlpha,QB1\n\nBeta,RB1",
    );

    expectSuccess(result);
    expect(result.value.records.map((record) => record.sourceIndex)).toEqual([0, 1]);
    expect(result.value.records[0]?.fields.playerName?.location.row).toBe(4);
    expect(result.value.records[1]?.fields.playerName?.location.row).toBe(6);
  });

  it("does not treat quoted-empty or comma-only records as blank", () => {
    const quotedEmpty = parseText('PLAYER NAME,POS\n""');
    const commaOnly = parseText("PLAYER NAME,POS\n,");

    expectFailure(quotedEmpty);
    expect(quotedEmpty.errors[0]).toEqual(
      expect.objectContaining({ code: "row-length-mismatch" }),
    );
    expectSuccess(commaOnly);
    expect(rawFields(commaOnly.value.records[0])).toEqual({
      playerName: "",
      position: "",
    });
  });

  it("reports row-width mismatches by physical row", () => {
    const result = parseText(
      "PLAYER NAME,POS,TEAM\nAlpha,QB1\nBeta,RB1,SEA,extra",
    );

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "row-length-mismatch",
        stage: "parse",
        severity: "error",
        message: "FantasyPros CSV row has 2 fields; expected 3.",
        location: { row: 2, column: 1 },
      },
      {
        code: "row-length-mismatch",
        stage: "parse",
        severity: "error",
        message: "FantasyPros CSV row has 4 fields; expected 3.",
        location: { row: 3, column: 1 },
      },
    ]);
  });

  it("rejects a header with zero data records", () => {
    const result = parseText("PLAYER NAME,POS\n\n");

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "empty-records",
        stage: "parse",
        severity: "error",
        message: "FantasyPros CSV must contain at least one data record.",
      },
    ]);
  });

  it.each([1_000, 1_001])("enforces the record boundary at %s rows", (count) => {
    const rows = Array.from({ length: count }, (_, index) => {
      return `Player ${index + 1},QB${index + 1}`;
    });
    const result = parseText(`PLAYER NAME,POS\n${rows.join("\n")}`);

    if (count === RANKING_IMPORT_LIMITS.maxEntries) {
      expectSuccess(result);
      expect(result.value.records).toHaveLength(count);
    } else {
      expectFailure(result);
      expect(result.errors).toEqual([
        {
          code: "too-many-records",
          stage: "parse",
          severity: "error",
          message: "FantasyPros CSV must contain at most 1000 data records.",
        },
      ]);
    }
  });

  it.each([
    {
      name: "quote inside unquoted field",
      csv: 'PLAYER NAME,POS\nbad"quote,QB1',
      message: "Quote may only appear at the start of a field.",
      location: { row: 2, column: 4 },
    },
    {
      name: "text after closing quote",
      csv: 'PLAYER NAME,POS\n"closed"x,QB1',
      message: "Only a delimiter or record ending may follow a closing quote.",
      location: { row: 2, column: 9 },
    },
    {
      name: "unclosed quote",
      csv: 'PLAYER NAME,POS\n"open,QB1',
      message: "Quoted field is not closed.",
      location: { row: 2, column: 1 },
    },
    {
      name: "bare carriage return",
      csv: "PLAYER NAME,POS\rAlpha,QB1",
      message: "Bare carriage return is unsupported.",
      location: { row: 1, column: 16 },
    },
  ])("rejects malformed CSV: $name", ({ csv, message, location }) => {
    const result = parseText(csv);

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "malformed-csv",
        stage: "parse",
        severity: "error",
        message,
        location,
      },
    ]);
  });

  it("rejects the wrong preflight format before reading text", () => {
    const document = preflightText("{}", "canonical-ranking-json");
    const result = parseFantasyProsCsv(document);

    expectFailure(result);
    expect(result.errors).toEqual([
      {
        code: "wrong-format",
        stage: "parse",
        severity: "error",
        message:
          "FantasyPros CSV parser requires fantasypros-csv version 1.",
      },
    ]);
  });
});

function parseText(text: string) {
  return parseFantasyProsCsv(preflightText(text));
}

function preflightText(
  text: string,
  formatId: "fantasypros-csv" | "canonical-ranking-json" = "fantasypros-csv",
): PreflightRankingDocument {
  return preflight(encoder.encode(text), formatId);
}

function preflight(
  bytes: Uint8Array,
  formatId: "fantasypros-csv" | "canonical-ranking-json" = "fantasypros-csv",
): PreflightRankingDocument {
  const result = preflightRankingImport({
    formatId,
    formatVersion: 1,
    bytes,
  });

  if (!result.ok) {
    throw new Error(`Preflight failed: ${JSON.stringify(result.errors)}`);
  }

  return result.value;
}

function rawFields(
  record: ParsedRankingSourceDocument["records"][number] | undefined,
): Record<string, unknown> {
  if (!record) {
    throw new Error("Expected parsed record.");
  }

  return Object.fromEntries(
    Object.entries(record.fields).map(([key, field]) => [key, field.value]),
  );
}

function expectSuccess(
  result: RankingImportStageResult<
    ParsedRankingSourceDocument,
    FantasyProsCsvParserDiagnosticCode
  >,
): asserts result is Extract<typeof result, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected success, received ${JSON.stringify(result.errors)}`);
  }
}

function expectFailure(
  result: RankingImportStageResult<
    ParsedRankingSourceDocument,
    FantasyProsCsvParserDiagnosticCode
  >,
): asserts result is Extract<typeof result, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected FantasyPros CSV parse failure.");
  }
}
