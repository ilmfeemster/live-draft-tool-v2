import { RANKING_IMPORT_LIMITS } from "@/lib/rankingImportPreflight";
import type { Position } from "@/types/draft";
import type {
  NormalizedRankingCandidate,
  NormalizedRankingCandidateField,
  RankingImportDiagnostic,
  RankingImportDiagnosticLocation,
  RankingImportStageResult,
  ValidatedRankingCandidate,
} from "@/types/rankingImport";
import { NEUTRAL_TIER, UNKNOWN_TEAM } from "@/types/rankings";

export type RankingCandidateValidationDiagnosticCode =
  | "invalid-name"
  | "invalid-source"
  | "empty-entries"
  | "too-many-entries"
  | "invalid-entry"
  | "invalid-source-index"
  | "invalid-player-id"
  | "duplicate-player-id"
  | "invalid-player-name"
  | "invalid-team"
  | "invalid-position"
  | "invalid-source-order"
  | "duplicate-source-order"
  | "invalid-source-position-rank"
  | "invalid-adp-rank"
  | "invalid-tier"
  | "invalid-tier-progression"
  | "invalid-capability";

type CandidateDiagnostic =
  RankingImportDiagnostic<RankingCandidateValidationDiagnosticCode>;
type CandidateValidationResult = RankingImportStageResult<
  ValidatedRankingCandidate,
  RankingCandidateValidationDiagnosticCode
>;
type UnknownRecord = Record<string, unknown>;

type EntryFacts = {
  arrayIndex: number;
  record: UnknownRecord;
  location?: RankingImportDiagnosticLocation;
  sourceIndexValid: boolean;
  playerIdValid: boolean;
  playerNameValid: boolean;
  teamValid: boolean;
  position: Position | null;
  sourceOrder: number | null;
  sourcePositionRank: number | null;
  sourcePositionRankValid: boolean;
  adpRank: number | null;
  adpRankValid: boolean;
  tier: number | null;
  tierValid: boolean;
};

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const SOURCE_KINDS = ["seed", "external", "canonical", "manual"] as const;
const AVAILABILITY_VALUES = ["complete", "partial", "none"] as const;
const IDENTITY_VALUES = ["provided", "generated", "mixed"] as const;
const ORDER_VALUES = ["explicit", "row-derived"] as const;
const TIER_VALUES = ["source", "defaulted-neutral"] as const;

export function validateNormalizedRankingCandidate(
  candidate: NormalizedRankingCandidate,
): CandidateValidationResult {
  const errors: CandidateDiagnostic[] = [];
  const candidateRecord = asRecord(candidate);

  validateName(candidateRecord?.name, errors);
  validateSource(candidateRecord?.source, errors);

  const entriesValue = candidateRecord?.entries;

  if (!Array.isArray(entriesValue)) {
    errors.push(
      error(
        "invalid-entry",
        "Normalized ranking candidate entries must be an array.",
      ),
    );
    return failure(errors);
  }

  if (entriesValue.length === 0) {
    errors.push(
      error(
        "empty-entries",
        "Normalized ranking candidate must contain at least one entry.",
      ),
    );
  }

  if (entriesValue.length > RANKING_IMPORT_LIMITS.maxEntries) {
    errors.push(
      error(
        "too-many-entries",
        `Normalized ranking candidate must not contain more than ${RANKING_IMPORT_LIMITS.maxEntries} entries.`,
      ),
    );
  }

  const playerIds = new Set<string>();
  const sourceOrders = new Set<number>();
  const facts: EntryFacts[] = [];
  let orderUnambiguous = true;

  for (let index = 0; index < entriesValue.length; index += 1) {
    const entry = asRecord(entriesValue[index]);

    if (!entry) {
      errors.push(
        error(
          "invalid-entry",
          "Normalized ranking candidate entry must be an object.",
          { path: `entries[${index}]` },
        ),
      );
      orderUnambiguous = false;
      continue;
    }

    const entryFacts = validateEntry(
      entry,
      index,
      playerIds,
      sourceOrders,
      errors,
    );
    facts.push(entryFacts);

    if (entryFacts.sourceOrder === null || sourceOrders.size < facts.filter((fact) => fact.sourceOrder !== null).length) {
      orderUnambiguous = false;
    }
  }

  if (facts.length !== entriesValue.length) {
    orderUnambiguous = false;
  }

  const sortedFacts = orderUnambiguous
    ? [...facts].sort(
        (left, right) =>
          (left.sourceOrder as number) - (right.sourceOrder as number),
      )
    : [];

  if (orderUnambiguous) {
    validateDerivedPositionRanks(sortedFacts, errors);
    validateTierProgression(sortedFacts, errors);
  }

  validateCapabilities(
    candidateRecord?.capabilities,
    facts,
    entriesValue.length,
    orderUnambiguous,
    errors,
  );

  if (errors.length > 0) {
    return failure(errors);
  }

  return {
    ok: true,
    value: { validated: true, candidate },
    warnings: [],
  };
}

function validateName(
  value: unknown,
  errors: CandidateDiagnostic[],
): void {
  if (!isNonEmptyString(value)) {
    errors.push(
      error(
        "invalid-name",
        "Normalized ranking candidate name must be a non-empty string.",
      ),
    );
  }
}

function validateSource(
  value: unknown,
  errors: CandidateDiagnostic[],
): void {
  const source = asRecord(value);

  if (!source) {
    errors.push(
      error("invalid-source", "Normalized ranking source must be an object."),
    );
    return;
  }

  if (!SOURCE_KINDS.includes(source.kind as (typeof SOURCE_KINDS)[number])) {
    errors.push(
      error("invalid-source", "Normalized ranking source kind is unsupported."),
    );
  }

  for (const field of ["formatId", "label"] as const) {
    if (source[field] !== undefined && !isNonEmptyString(source[field])) {
      errors.push(
        error(
          "invalid-source",
          `Normalized ranking source ${field} must be a non-empty string when present.`,
        ),
      );
    }
  }

  if (
    source.formatVersion !== undefined &&
    !isPositiveInteger(source.formatVersion)
  ) {
    errors.push(
      error(
        "invalid-source",
        "Normalized ranking source formatVersion must be a positive integer when present.",
      ),
    );
  }

  if (source.importedAt !== undefined && !isValidDate(source.importedAt)) {
    errors.push(
      error(
        "invalid-source",
        "Normalized ranking source importedAt must be a valid Date when present.",
      ),
    );
  }
}

function validateEntry(
  entry: UnknownRecord,
  arrayIndex: number,
  playerIds: Set<string>,
  sourceOrders: Set<number>,
  errors: CandidateDiagnostic[],
): EntryFacts {
  const location = asLocation(entry.location);
  const sourceIndexValid =
    Number.isInteger(entry.sourceIndex) && entry.sourceIndex === arrayIndex;

  if (!sourceIndexValid) {
    errors.push(
      error(
        "invalid-source-index",
        `Normalized source index must equal array index ${arrayIndex}.`,
        location,
      ),
    );
  }

  const playerIdValid = isNonEmptyString(entry.playerId);

  if (!playerIdValid) {
    errors.push(
      fieldError(
        "invalid-player-id",
        "Normalized player ID must be a non-empty string.",
        entry,
        "playerId",
      ),
    );
  } else if (playerIds.has(entry.playerId as string)) {
    errors.push(
      fieldError(
        "duplicate-player-id",
        `Normalized player ID ${entry.playerId as string} appears more than once.`,
        entry,
        "playerId",
      ),
    );
  } else {
    playerIds.add(entry.playerId as string);
  }

  const playerNameValid = isNonEmptyString(entry.playerName);

  if (!playerNameValid) {
    errors.push(
      fieldError(
        "invalid-player-name",
        "Normalized player name must be a non-empty string.",
        entry,
        "playerName",
      ),
    );
  }

  const teamValid = isNonEmptyString(entry.team);

  if (!teamValid) {
    errors.push(
      fieldError(
        "invalid-team",
        "Normalized team must be a non-empty string.",
        entry,
        "team",
      ),
    );
  }

  const position = isPosition(entry.position) ? entry.position : null;

  if (!position) {
    errors.push(
      fieldError(
        "invalid-position",
        "Normalized player position is unsupported.",
        entry,
        "position",
      ),
    );
  }

  let sourceOrder: number | null = null;

  if (!isPositiveInteger(entry.sourceOrder)) {
    errors.push(
      fieldError(
        "invalid-source-order",
        "Normalized source order must be a positive integer.",
        entry,
        "sourceOrder",
      ),
    );
  } else {
    sourceOrder = entry.sourceOrder;

    if (sourceOrders.has(sourceOrder)) {
      errors.push(
        fieldError(
          "duplicate-source-order",
          `Normalized source order ${sourceOrder} appears more than once.`,
          entry,
          "sourceOrder",
        ),
      );
    } else {
      sourceOrders.add(sourceOrder);
    }
  }

  const sourcePositionRankValid =
    entry.sourcePositionRank === null ||
    isPositiveInteger(entry.sourcePositionRank);
  const sourcePositionRank = sourcePositionRankValid
    ? (entry.sourcePositionRank as number | null)
    : null;

  if (!sourcePositionRankValid) {
    errors.push(
      fieldError(
        "invalid-source-position-rank",
        "Normalized source position rank must be null or a positive integer.",
        entry,
        "sourcePositionRank",
      ),
    );
  }

  const adpRankValid =
    entry.adpRank === null ||
    (typeof entry.adpRank === "number" &&
      Number.isFinite(entry.adpRank) &&
      entry.adpRank > 0);
  const adpRank = adpRankValid ? (entry.adpRank as number | null) : null;

  if (!adpRankValid) {
    errors.push(
      fieldError(
        "invalid-adp-rank",
        "Normalized ADP rank must be null or a positive finite number.",
        entry,
        "adpRank",
      ),
    );
  }

  const tierValid = isPositiveInteger(entry.tier);
  const tier = tierValid ? (entry.tier as number) : null;

  if (!tierValid) {
    errors.push(
      fieldError(
        "invalid-tier",
        "Normalized tier must be a positive integer.",
        entry,
        "tier",
      ),
    );
  }

  return {
    arrayIndex,
    record: entry,
    location,
    sourceIndexValid,
    playerIdValid,
    playerNameValid,
    teamValid,
    position,
    sourceOrder,
    sourcePositionRank,
    sourcePositionRankValid,
    adpRank,
    adpRankValid,
    tier,
    tierValid,
  };
}

function validateDerivedPositionRanks(
  sortedFacts: readonly EntryFacts[],
  errors: CandidateDiagnostic[],
): void {
  const counts = new Map<Position, number>();

  sortedFacts.forEach((facts) => {
    if (!facts.position) {
      return;
    }

    const expected = (counts.get(facts.position) ?? 0) + 1;
    counts.set(facts.position, expected);

    if (
      facts.sourcePositionRankValid &&
      facts.sourcePositionRank !== null &&
      facts.sourcePositionRank !== expected
    ) {
      errors.push(
        fieldError(
          "invalid-source-position-rank",
          `Normalized source position rank must equal ${expected} for ${facts.position} in source order.`,
          facts.record,
          "sourcePositionRank",
        ),
      );
    }
  });
}

function validateTierProgression(
  sortedFacts: readonly EntryFacts[],
  errors: CandidateDiagnostic[],
): void {
  const priorTiers = new Map<Position, number>();

  sortedFacts.forEach((facts) => {
    if (!facts.position || !facts.tierValid) {
      return;
    }

    const prior = priorTiers.get(facts.position);

    if (prior !== undefined && (facts.tier as number) < prior) {
      errors.push(
        fieldError(
          "invalid-tier-progression",
          `Normalized tier must not decrease within ${facts.position} source order.`,
          facts.record,
          "tier",
        ),
      );
    }

    priorTiers.set(facts.position, facts.tier as number);
  });
}

function validateCapabilities(
  value: unknown,
  facts: readonly EntryFacts[],
  entryCount: number,
  orderUnambiguous: boolean,
  errors: CandidateDiagnostic[],
): void {
  const capabilities = asRecord(value);

  if (!capabilities) {
    errors.push(
      error(
        "invalid-capability",
        "Normalized ranking capabilities must be an object.",
      ),
    );
    return;
  }

  const teamSupported = validateCapabilityValue(
    capabilities.team,
    AVAILABILITY_VALUES,
    "team",
    errors,
  );
  const allTeamsValid =
    entryCount > 0 &&
    facts.length === entryCount &&
    facts.every((entry) => entry.teamValid);

  if (teamSupported && allTeamsValid) {
    const expected = availability(
      facts.map((entry) => entry.record.team !== UNKNOWN_TEAM),
    );

    if (capabilities.team !== expected) {
      errors.push(
        error(
          "invalid-capability",
          `Normalized team capability must be ${expected}.`,
          firstFieldLocation(facts, "team"),
        ),
      );
    }
  }

  validateCapabilityValue(
    capabilities.playerIdentity,
    IDENTITY_VALUES,
    "playerIdentity",
    errors,
  );

  const orderSupported = validateCapabilityValue(
    capabilities.overallOrder,
    ORDER_VALUES,
    "overallOrder",
    errors,
  );

  if (
    orderSupported &&
    capabilities.overallOrder === "row-derived" &&
    orderUnambiguous &&
    facts.every((entry) => entry.sourceIndexValid)
  ) {
    const mismatch = facts.find(
      (entry) => entry.sourceOrder !== entry.arrayIndex + 1,
    );

    if (mismatch) {
      errors.push(
        fieldError(
          "invalid-capability",
          "Row-derived source order must equal sourceIndex plus one.",
          mismatch.record,
          "sourceOrder",
        ),
      );
    }
  }

  validateCapabilityValue(
    capabilities.positionRank,
    ["derived"] as const,
    "positionRank",
    errors,
  );

  const adpSupported = validateCapabilityValue(
    capabilities.adp,
    AVAILABILITY_VALUES,
    "adp",
    errors,
  );
  const allAdpValid =
    entryCount > 0 &&
    facts.length === entryCount &&
    facts.every((entry) => entry.adpRankValid);

  if (adpSupported && allAdpValid) {
    const expected = availability(
      facts.map((entry) => entry.adpRank !== null),
    );

    if (capabilities.adp !== expected) {
      errors.push(
        error(
          "invalid-capability",
          `Normalized ADP capability must be ${expected}.`,
          firstFieldLocation(facts, "adpRank"),
        ),
      );
    }
  }

  validateTierCapabilities(capabilities.tiers, facts, entryCount, errors);
}

function validateTierCapabilities(
  value: unknown,
  facts: readonly EntryFacts[],
  entryCount: number,
  errors: CandidateDiagnostic[],
): void {
  const tiers = asRecord(value);

  if (!tiers) {
    errors.push(
      error(
        "invalid-capability",
        "Normalized tier capabilities must be an object.",
      ),
    );
    return;
  }

  const allEntryShapesValid = facts.length === entryCount;
  const allPositionsValid =
    allEntryShapesValid && facts.every((entry) => entry.position !== null);

  POSITIONS.forEach((position) => {
    const positionFacts = facts.filter((entry) => entry.position === position);
    const represented = positionFacts.length > 0;
    const capability = tiers[position];

    if (!allPositionsValid) {
      if (
        capability !== undefined &&
        !TIER_VALUES.includes(capability as (typeof TIER_VALUES)[number])
      ) {
        errors.push(
          error(
            "invalid-capability",
            `Normalized ${position} tier capability is unsupported.`,
          ),
        );
      }
      return;
    }

    if (!represented) {
      if (capability !== undefined) {
        errors.push(
          error(
            "invalid-capability",
            `Normalized ${position} tier capability must be absent when the position is absent.`,
          ),
        );
      }
      return;
    }

    if (!TIER_VALUES.includes(capability as (typeof TIER_VALUES)[number])) {
      errors.push(
        error(
          "invalid-capability",
          `Normalized ${position} tier capability is unsupported.`,
          firstFieldLocation(positionFacts, "tier"),
        ),
      );
      return;
    }

    if (
      capability === "defaulted-neutral" &&
      allEntryShapesValid &&
      positionFacts.every((entry) => entry.tierValid)
    ) {
      const nonNeutral = positionFacts.find(
        (entry) => entry.tier !== NEUTRAL_TIER,
      );

      if (nonNeutral) {
        errors.push(
          fieldError(
            "invalid-capability",
            `${position} defaulted-neutral tiers must all equal ${NEUTRAL_TIER}.`,
            nonNeutral.record,
            "tier",
          ),
        );
      }
    }
  });

  Object.keys(tiers)
    .filter((key) => !POSITIONS.includes(key as Position))
    .sort()
    .forEach((key) => {
      errors.push(
        error(
          "invalid-capability",
          `Normalized tier capability position ${key} is unsupported.`,
        ),
      );
    });
}

function validateCapabilityValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  errors: CandidateDiagnostic[],
): boolean {
  if (allowed.includes(value as T[number])) {
    return true;
  }

  errors.push(
    error(
      "invalid-capability",
      `Normalized ranking capability ${field} is unsupported.`,
    ),
  );
  return false;
}

function fieldError(
  code: RankingCandidateValidationDiagnosticCode,
  message: string,
  entry: UnknownRecord,
  field: NormalizedRankingCandidateField,
): CandidateDiagnostic {
  return error(code, message, fieldLocation(entry, field));
}

function fieldLocation(
  entry: UnknownRecord,
  field: NormalizedRankingCandidateField,
): RankingImportDiagnosticLocation | undefined {
  const fieldLocations = asRecord(entry.fieldLocations);
  return asLocation(fieldLocations?.[field]) ?? asLocation(entry.location);
}

function firstFieldLocation(
  facts: readonly EntryFacts[],
  field: NormalizedRankingCandidateField,
): RankingImportDiagnosticLocation | undefined {
  const first = facts[0];
  return first ? fieldLocation(first.record, field) : undefined;
}

function availability(values: readonly boolean[]): "complete" | "partial" | "none" {
  const availableCount = values.filter(Boolean).length;

  if (availableCount === 0) {
    return "none";
  }

  return availableCount === values.length ? "complete" : "partial";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isPosition(value: unknown): value is Position {
  return POSITIONS.includes(value as Position);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asLocation(
  value: unknown,
): RankingImportDiagnosticLocation | undefined {
  const location = asRecord(value);
  return location ? (location as RankingImportDiagnosticLocation) : undefined;
}

function error(
  code: RankingCandidateValidationDiagnosticCode,
  message: string,
  location?: RankingImportDiagnosticLocation,
): CandidateDiagnostic {
  return {
    code,
    stage: "validate",
    severity: "error",
    message,
    ...(location === undefined ? {} : { location }),
  };
}

function failure(
  errors: readonly CandidateDiagnostic[],
): CandidateValidationResult {
  return { ok: false, errors, warnings: [] };
}
