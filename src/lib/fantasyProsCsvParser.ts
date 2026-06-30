import {
  FANTASYPROS_CSV_V1_FORMAT,
  FANTASYPROS_CSV_V1_PROFILE,
  RANKING_IMPORT_LIMITS,
} from "@/lib/rankingImportPreflight";
import type {
  ParsedRankingField,
  ParsedRankingSourceDocument,
  ParsedRankingSourceRecord,
  PreflightRankingDocument,
  RankingImportDiagnostic,
  RankingImportDiagnosticLocation,
  RankingImportStageResult,
} from "@/types/rankingImport";

export type FantasyProsCsvParserDiagnosticCode =
  | "wrong-format"
  | "malformed-csv"
  | "missing-header"
  | "missing-required-header"
  | "duplicate-header"
  | "row-length-mismatch"
  | "empty-records"
  | "too-many-records"
  | "unknown-header";

export type FantasyProsParsedMetadata = Readonly<{
  physicalHeaders: readonly string[];
  normalizedHeaders: readonly string[];
  semanticColumns: Readonly<Record<string, number>>;
}>;

type ParserDiagnostic = RankingImportDiagnostic<FantasyProsCsvParserDiagnosticCode>;
type ParserResult = RankingImportStageResult<
  ParsedRankingSourceDocument,
  FantasyProsCsvParserDiagnosticCode
>;

type CsvField = {
  value: string;
  startLine: number;
  startCharacterColumn: number;
  quoted: boolean;
};

type CsvRecord = {
  fields: CsvField[];
  startLine: number;
};

type CsvScanResult =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; error: ParserDiagnostic };

const REQUIRED_SEMANTICS = ["playerName", "position"] as const;

const HEADER_ALIASES = new Map<string, string>(
  Object.entries(FANTASYPROS_CSV_V1_PROFILE.headers).flatMap(
    ([semantic, definition]) => {
      return definition.aliases.map((alias) => [alias, semantic] as const);
    },
  ),
);

const IGNORED_HEADERS = new Set<string>(
  FANTASYPROS_CSV_V1_PROFILE.ignoredHeaders,
);

export function parseFantasyProsCsv(
  document: PreflightRankingDocument,
): ParserResult {
  if (
    document.format.id !== FANTASYPROS_CSV_V1_FORMAT.id ||
    document.format.version !== FANTASYPROS_CSV_V1_FORMAT.version
  ) {
    return failure([
      error(
        "wrong-format",
        "FantasyPros CSV parser requires fantasypros-csv version 1.",
      ),
    ]);
  }

  const scanned = scanCsv(document.text);

  if (!scanned.ok) {
    return failure([scanned.error]);
  }

  const records = scanned.records.filter((record) => !isBlankRecord(record));
  const header = records[0];

  if (!header) {
    return failure([
      error("missing-header", "FantasyPros CSV must contain a header row."),
    ]);
  }

  const warnings: ParserDiagnostic[] = [];
  const duplicateErrors: ParserDiagnostic[] = [];
  const normalizedHeaders = header.fields.map((field) =>
    normalizeHeader(field.value),
  );
  const semanticColumns = new Map<string, number>();

  normalizedHeaders.forEach((normalizedHeader, index) => {
    const semantic = HEADER_ALIASES.get(normalizedHeader);

    if (semantic) {
      if (semanticColumns.has(semantic)) {
        duplicateErrors.push(
          error(
            "duplicate-header",
            `FantasyPros CSV header maps more than one column to ${semantic}.`,
            {
              row: header.fields[index]?.startLine ?? header.startLine,
              column: index + 1,
              field: semantic,
            },
          ),
        );
      } else {
        semanticColumns.set(semantic, index + 1);
      }
      return;
    }

    if (IGNORED_HEADERS.has(normalizedHeader)) {
      return;
    }

    warnings.push(
      warning(
        "unknown-header",
        normalizedHeader.length > 0
          ? `FantasyPros CSV header ${normalizedHeader} is unsupported and will be ignored.`
          : "Empty FantasyPros CSV header is unsupported and will be ignored.",
        {
          row: header.fields[index]?.startLine ?? header.startLine,
          column: index + 1,
          field: normalizedHeader,
        },
      ),
    );
  });

  const missingErrors = REQUIRED_SEMANTICS.flatMap((semantic) => {
    if (semanticColumns.has(semantic)) {
      return [];
    }

    return [
      error(
        "missing-required-header",
        `FantasyPros CSV is missing required ${semantic} header.`,
        { row: header.startLine, field: semantic },
      ),
    ];
  });
  const headerErrors = [...missingErrors, ...duplicateErrors];

  if (headerErrors.length > 0) {
    return failure(headerErrors, warnings);
  }

  const dataRecords = records.slice(1);
  const rowErrors: ParserDiagnostic[] = [];

  dataRecords.forEach((record) => {
    if (record.fields.length !== header.fields.length) {
      rowErrors.push(
        error(
          "row-length-mismatch",
          `FantasyPros CSV row has ${record.fields.length} fields; expected ${header.fields.length}.`,
          { row: record.startLine, column: 1 },
        ),
      );
    }
  });

  if (dataRecords.length > RANKING_IMPORT_LIMITS.maxEntries) {
    rowErrors.push(
      error(
        "too-many-records",
        `FantasyPros CSV must contain at most ${RANKING_IMPORT_LIMITS.maxEntries} data records.`,
      ),
    );
  } else if (dataRecords.length === 0) {
    rowErrors.push(
      error(
        "empty-records",
        "FantasyPros CSV must contain at least one data record.",
      ),
    );
  }

  if (rowErrors.length > 0) {
    return failure(rowErrors, warnings);
  }

  const parsedRecords = dataRecords.map((record, sourceIndex) => {
    return mapRecord(record, sourceIndex, semanticColumns);
  });
  const metadata: FantasyProsParsedMetadata = {
    physicalHeaders: header.fields.map((field) => field.value),
    normalizedHeaders,
    semanticColumns: Object.fromEntries(semanticColumns),
  };

  return {
    ok: true,
    value: {
      format: FANTASYPROS_CSV_V1_FORMAT,
      metadata,
      tierSemantics: FANTASYPROS_CSV_V1_PROFILE.headers.tier.tierSemantics,
      records: parsedRecords,
    },
    warnings,
  };
}

function mapRecord(
  record: CsvRecord,
  sourceIndex: number,
  semanticColumns: Map<string, number>,
): ParsedRankingSourceRecord {
  const fields: Record<string, ParsedRankingField> = {};

  semanticColumns.forEach((oneBasedColumn, semantic) => {
    const field = record.fields[oneBasedColumn - 1];

    if (!field) {
      return;
    }

    fields[semantic] = {
      value: field.value,
      location: {
        row: field.startLine,
        column: oneBasedColumn,
        field: semantic,
      },
    };
  });

  return {
    sourceIndex,
    fields,
  };
}

function scanCsv(text: string): CsvScanResult {
  const records: CsvRecord[] = [];
  let fields: CsvField[] = [];
  let value = "";
  let index = 0;
  let line = 1;
  let characterColumn = 1;
  let recordStartLine = 1;
  let fieldStartLine = 1;
  let fieldStartCharacterColumn = 1;
  let fieldQuoted = false;
  let inQuotes = false;
  let quoteClosed = false;
  let openingQuoteLine = 1;
  let openingQuoteColumn = 1;

  function pushField(): void {
    fields.push({
      value,
      startLine: fieldStartLine,
      startCharacterColumn: fieldStartCharacterColumn,
      quoted: fieldQuoted,
    });
    value = "";
    fieldQuoted = false;
    quoteClosed = false;
  }

  function pushRecord(): void {
    records.push({ fields, startLine: recordStartLine });
    fields = [];
  }

  function beginNextField(): void {
    fieldStartLine = line;
    fieldStartCharacterColumn = characterColumn;
  }

  function beginNextRecord(): void {
    recordStartLine = line;
    beginNextField();
  }

  while (index < text.length) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 2;
          characterColumn += 2;
        } else {
          inQuotes = false;
          quoteClosed = true;
          index += 1;
          characterColumn += 1;
        }
        continue;
      }

      if (character === "\r") {
        if (text[index + 1] !== "\n") {
          return malformed("Bare carriage return is unsupported.", line, characterColumn);
        }
        value += "\r\n";
        index += 2;
        line += 1;
        characterColumn = 1;
        continue;
      }

      if (character === "\n") {
        value += "\n";
        index += 1;
        line += 1;
        characterColumn = 1;
        continue;
      }

      value += character;
      index += 1;
      characterColumn += 1;
      continue;
    }

    if (quoteClosed) {
      if (character === ",") {
        pushField();
        index += 1;
        characterColumn += 1;
        beginNextField();
        continue;
      }

      if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] !== "\n") {
          return malformed("Bare carriage return is unsupported.", line, characterColumn);
        }
        pushField();
        pushRecord();
        if (character === "\r") {
          index += 2;
        } else {
          index += 1;
        }
        line += 1;
        characterColumn = 1;
        beginNextRecord();
        continue;
      }

      return malformed(
        "Only a delimiter or record ending may follow a closing quote.",
        line,
        characterColumn,
      );
    }

    if (character === '"') {
      if (value.length > 0) {
        return malformed(
          "Quote may only appear at the start of a field.",
          line,
          characterColumn,
        );
      }
      fieldQuoted = true;
      inQuotes = true;
      openingQuoteLine = line;
      openingQuoteColumn = characterColumn;
      index += 1;
      characterColumn += 1;
      continue;
    }

    if (character === ",") {
      pushField();
      index += 1;
      characterColumn += 1;
      beginNextField();
      continue;
    }

    if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] !== "\n") {
        return malformed("Bare carriage return is unsupported.", line, characterColumn);
      }
      pushField();
      pushRecord();
      if (character === "\r") {
        index += 2;
      } else {
        index += 1;
      }
      line += 1;
      characterColumn = 1;
      beginNextRecord();
      continue;
    }

    value += character;
    index += 1;
    characterColumn += 1;
  }

  if (inQuotes) {
    return malformed(
      "Quoted field is not closed.",
      openingQuoteLine,
      openingQuoteColumn,
    );
  }

  if (
    fields.length > 0 ||
    value.length > 0 ||
    fieldQuoted ||
    quoteClosed
  ) {
    pushField();
    pushRecord();
  }

  return { ok: true, records };
}

function isBlankRecord(record: CsvRecord): boolean {
  return (
    record.fields.length === 1 &&
    record.fields[0]?.value === "" &&
    record.fields[0]?.quoted === false
  );
}

function normalizeHeader(value: string): string {
  return value.trim().toUpperCase();
}

function malformed(
  message: string,
  row: number,
  column: number,
): CsvScanResult {
  return {
    ok: false,
    error: error("malformed-csv", message, { row, column }),
  };
}

function error(
  code: Exclude<FantasyProsCsvParserDiagnosticCode, "unknown-header">,
  message: string,
  location?: RankingImportDiagnosticLocation,
): ParserDiagnostic {
  return {
    code,
    stage: "parse",
    severity: "error",
    message,
    ...(location === undefined ? {} : { location }),
  };
}

function warning(
  code: "unknown-header",
  message: string,
  location: RankingImportDiagnosticLocation,
): ParserDiagnostic {
  return {
    code,
    stage: "parse",
    severity: "warning",
    message,
    location,
  };
}

function failure(
  errors: readonly ParserDiagnostic[],
  warnings: readonly ParserDiagnostic[] = [],
): ParserResult {
  return { ok: false, errors, warnings };
}
