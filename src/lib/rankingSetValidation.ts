import type { Position } from "@/types/draft";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingDataAvailability,
  type RankingRecommendationTierSemantics,
  type RankingSet,
  type RankingSourceTierSemantics,
  type RankingTierCapability,
} from "@/types/rankings";

export type RankingSetValidationErrorCode =
  | "invalid-id"
  | "invalid-name"
  | "invalid-source"
  | "invalid-date"
  | "empty-entries"
  | "invalid-player-id"
  | "duplicate-player-id"
  | "invalid-player-name"
  | "invalid-team"
  | "invalid-position"
  | "invalid-overall-rank"
  | "invalid-position-rank"
  | "invalid-adp-rank"
  | "invalid-tier"
  | "invalid-capability";

export type RankingSetValidationError = {
  code: RankingSetValidationErrorCode;
  path: string;
  message: string;
};

export type RankingSetValidationResult =
  | { ok: true; rankingSet: RankingSet }
  | { ok: false; errors: RankingSetValidationError[] };

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const SOURCE_KINDS = ["seed", "external", "canonical", "manual"] as const;
const AVAILABILITY_VALUES = ["complete", "partial", "none"] as const;
const IDENTITY_VALUES = ["provided", "generated", "mixed"] as const;
const ORDER_VALUES = ["explicit", "row-derived"] as const;
const TIER_VALUES = ["source", "defaulted-neutral"] as const;
const SOURCE_TIER_SEMANTIC_VALUES = [
  "none",
  "source-overall",
  "legacy-ambiguous",
] as const;
const RECOMMENDATION_TIER_SEMANTIC_VALUES = [
  "neutral",
  "recommendation-position",
] as const;

export function validateRankingSet(
  rankingSet: RankingSet,
): RankingSetValidationResult {
  const errors: RankingSetValidationError[] = [];
  const record = rankingSet as unknown as Record<string, unknown>;

  validateNonEmptyString(
    record.id,
    "id",
    "invalid-id",
    "Ranking set ID must be a non-empty string.",
    errors,
  );
  validateNonEmptyString(
    record.name,
    "name",
    "invalid-name",
    "Ranking set name must be a non-empty string.",
    errors,
  );
  validateSource(record.source, errors);

  const createdAtValid = validateDate(
    record.createdAt,
    "createdAt",
    "createdAt must be a valid Date.",
    errors,
  );
  const updatedAtValid = validateDate(
    record.updatedAt,
    "updatedAt",
    "updatedAt must be a valid Date.",
    errors,
  );

  if (
    createdAtValid &&
    updatedAtValid &&
    (record.updatedAt as Date).getTime() < (record.createdAt as Date).getTime()
  ) {
    errors.push({
      code: "invalid-date",
      path: "updatedAt",
      message: "updatedAt must not be earlier than createdAt.",
    });
  }

  const entries = Array.isArray(record.entries)
    ? (record.entries as unknown[])
    : null;

  if (!entries || entries.length === 0) {
    errors.push({
      code: "empty-entries",
      path: "entries",
      message: "Ranking set entries must be a non-empty array.",
    });
  }

  const entryFacts = entries ? validateEntries(entries, errors) : null;
  validateCapabilities(record.capabilities, entryFacts, errors);
  validateTierSemantics(
    record.tierSemantics,
    entryFacts,
    record.capabilities,
    errors,
  );

  return errors.length === 0
    ? { ok: true, rankingSet }
    : { ok: false, errors };
}

function validateSource(
  value: unknown,
  errors: RankingSetValidationError[],
): void {
  const source = asRecord(value);

  if (!source) {
    errors.push({
      code: "invalid-source",
      path: "source",
      message: "Ranking set source must be an object.",
    });
    return;
  }

  if (!SOURCE_KINDS.includes(source.kind as (typeof SOURCE_KINDS)[number])) {
    errors.push({
      code: "invalid-source",
      path: "source.kind",
      message: "Ranking set source kind is unsupported.",
    });
  }

  validateOptionalNonEmptyString(source.formatId, "source.formatId", errors);
  validateOptionalNonEmptyString(source.label, "source.label", errors);

  if (
    source.formatVersion !== undefined &&
    (!Number.isInteger(source.formatVersion) ||
      (source.formatVersion as number) <= 0)
  ) {
    errors.push({
      code: "invalid-source",
      path: "source.formatVersion",
      message: "Source format version must be a positive integer when present.",
    });
  }

  if (
    source.importedAt !== undefined &&
    !isValidDate(source.importedAt)
  ) {
    errors.push({
      code: "invalid-source",
      path: "source.importedAt",
      message: "Source import timestamp must be a valid Date when present.",
    });
  }
}

type EntryFacts = {
  teams: string[];
  adpRanks: Array<number | null>;
  tiersByPosition: Map<Position, number[]>;
  representedPositions: Set<Position>;
  entriesByPlayerId: Map<string, { overallRank: number }>;
  allTeamsValid: boolean;
  allAdpRanksValid: boolean;
};

function validateEntries(
  entries: unknown[],
  errors: RankingSetValidationError[],
): EntryFacts {
  const playerIds = new Set<string>();
  const positionCounts = new Map<Position, number>();
  const previousTiers = new Map<Position, number>();
  const teams: string[] = [];
  const adpRanks: Array<number | null> = [];
  const tiersByPosition = new Map<Position, number[]>();
  const representedPositions = new Set<Position>();
  const entriesByPlayerId = new Map<
    string,
    { overallRank: number }
  >();
  let allTeamsValid = true;
  let allAdpRanksValid = true;

  for (let index = 0; index < entries.length; index += 1) {
    const value = entries[index];
    const path = `entries[${index}]`;
    const entry = asRecord(value);
    const player = asRecord(entry?.player);
    const playerId = player?.id;

    if (!isNonEmptyString(playerId)) {
      errors.push({
        code: "invalid-player-id",
        path: `${path}.player.id`,
        message: "Player ID must be a non-empty string.",
      });
    } else if (playerIds.has(playerId)) {
      errors.push({
        code: "duplicate-player-id",
        path: `${path}.player.id`,
        message: `Player ID ${playerId} appears more than once.`,
      });
    } else {
      playerIds.add(playerId);
    }

    if (!isNonEmptyString(player?.name)) {
      errors.push({
        code: "invalid-player-name",
        path: `${path}.player.name`,
        message: "Player name must be a non-empty string.",
      });
    }

    const team = player?.team;
    const teamValid = isNonEmptyString(team);

    if (!teamValid) {
      allTeamsValid = false;
      errors.push({
        code: "invalid-team",
        path: `${path}.player.team`,
        message: "Player team must be a non-empty string.",
      });
    } else {
      teams.push(team as string);
    }

    const position = player?.position;
    const positionValid = isPosition(position);

    if (!positionValid) {
      errors.push({
        code: "invalid-position",
        path: `${path}.player.position`,
        message: "Player position is unsupported.",
      });
    }

    if (!Number.isInteger(entry?.overallRank) || entry?.overallRank !== index + 1) {
      errors.push({
        code: "invalid-overall-rank",
        path: `${path}.overallRank`,
        message: `Overall rank must equal ${index + 1} in canonical order.`,
      });
    }

    let positionRankValid = false;

    if (positionValid) {
      representedPositions.add(position);
      const expectedPositionRank = (positionCounts.get(position) ?? 0) + 1;
      positionCounts.set(position, expectedPositionRank);
      positionRankValid =
        Number.isInteger(entry?.positionRank) &&
        entry?.positionRank === expectedPositionRank;

      if (!positionRankValid) {
        errors.push({
          code: "invalid-position-rank",
          path: `${path}.positionRank`,
          message: `Position rank must equal ${expectedPositionRank} for ${position}.`,
        });
      }
    }

    const overallRank = entry?.overallRank;

    if (
      isNonEmptyString(playerId) &&
      positionValid &&
      Number.isInteger(overallRank) &&
      overallRank === index + 1
    ) {
      entriesByPlayerId.set(playerId, {
        overallRank: overallRank as number,
      });
    }

    const adpRank = entry?.adpRank;
    const adpRankValid =
      adpRank === null ||
      (typeof adpRank === "number" && Number.isFinite(adpRank) && adpRank > 0);

    if (!adpRankValid) {
      allAdpRanksValid = false;
      errors.push({
        code: "invalid-adp-rank",
        path: `${path}.adpRank`,
        message: "ADP rank must be null or a positive finite number.",
      });
    } else {
      adpRanks.push(adpRank as number | null);
    }

    const tier = entry?.tier;
    const tierValid = Number.isInteger(tier) && (tier as number) > 0;

    if (!tierValid) {
      errors.push({
        code: "invalid-tier",
        path: `${path}.tier`,
        message: "Tier must be a positive integer.",
      });
    } else if (positionValid) {
      const previousTier = previousTiers.get(position);

      if (previousTier !== undefined && (tier as number) < previousTier) {
        errors.push({
          code: "invalid-tier",
          path: `${path}.tier`,
          message: `Tier must not decrease within ${position}.`,
        });
      }

      previousTiers.set(position, tier as number);
      const positionTiers = tiersByPosition.get(position) ?? [];
      positionTiers.push(tier as number);
      tiersByPosition.set(position, positionTiers);
    }
  }

  return {
    teams,
    adpRanks,
    tiersByPosition,
    representedPositions,
    entriesByPlayerId,
    allTeamsValid,
    allAdpRanksValid,
  };
}

function validateCapabilities(
  value: unknown,
  facts: EntryFacts | null,
  errors: RankingSetValidationError[],
): void {
  const capabilities = asRecord(value);

  if (!capabilities) {
    errors.push({
      code: "invalid-capability",
      path: "capabilities",
      message: "Ranking set capabilities must be an object.",
    });
    return;
  }

  const team = capabilities.team;
  validateCapabilityValue(team, AVAILABILITY_VALUES, "capabilities.team", errors);

  if (facts?.allTeamsValid && isAvailability(team)) {
    const expected = deriveAvailability(
      facts.teams.map((entryTeam) => entryTeam !== UNKNOWN_TEAM),
    );
    validateDerivedCapability(team, expected, "capabilities.team", errors);
  }

  validateCapabilityValue(
    capabilities.playerIdentity,
    IDENTITY_VALUES,
    "capabilities.playerIdentity",
    errors,
  );
  validateCapabilityValue(
    capabilities.overallOrder,
    ORDER_VALUES,
    "capabilities.overallOrder",
    errors,
  );
  validateCapabilityValue(
    capabilities.positionRank,
    ["derived"] as const,
    "capabilities.positionRank",
    errors,
  );

  const adp = capabilities.adp;
  validateCapabilityValue(adp, AVAILABILITY_VALUES, "capabilities.adp", errors);

  if (facts?.allAdpRanksValid && isAvailability(adp)) {
    const expected = deriveAvailability(
      facts.adpRanks.map((adpRank) => adpRank !== null),
    );
    validateDerivedCapability(adp, expected, "capabilities.adp", errors);
  }

  const tiers = asRecord(capabilities.tiers);

  if (!tiers) {
    errors.push({
      code: "invalid-capability",
      path: "capabilities.tiers",
      message: "Tier capabilities must be an object.",
    });
    return;
  }

  POSITIONS.forEach((position) => {
    const capability = tiers[position];
    const represented = facts?.representedPositions.has(position) ?? false;
    const path = `capabilities.tiers.${position}`;

    if (!represented) {
      if (capability !== undefined) {
        errors.push({
          code: "invalid-capability",
          path,
          message: `${position} tier capability must be absent when the position is absent.`,
        });
      }
      return;
    }

    if (!TIER_VALUES.includes(capability as RankingTierCapability)) {
      errors.push({
        code: "invalid-capability",
        path,
        message: `${position} tier capability is unsupported.`,
      });
      return;
    }

    if (capability === "defaulted-neutral" && facts) {
      const hasNonNeutralTier = (facts.tiersByPosition.get(position) ?? []).some(
        (tier) => tier !== NEUTRAL_TIER,
      );

      if (hasNonNeutralTier) {
        errors.push({
          code: "invalid-capability",
          path,
          message: `${position} defaulted-neutral tiers must all equal ${NEUTRAL_TIER}.`,
        });
      }
    }
  });

  Object.keys(tiers)
    .filter((key) => !POSITIONS.includes(key as Position))
    .sort()
    .forEach((key) => {
      errors.push({
        code: "invalid-capability",
        path: `capabilities.tiers.${key}`,
        message: `Tier capability position ${key} is unsupported.`,
      });
    });
}

function validateTierSemantics(
  value: unknown,
  facts: EntryFacts | null,
  capabilitiesValue: unknown,
  errors: RankingSetValidationError[],
): void {
  if (value === undefined) {
    return;
  }

  const tierSemantics = asRecord(value);

  if (!tierSemantics) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics",
      message: "Tier semantics must be an object when present.",
    });
    return;
  }

  const sourceKind = validateSourceTierSemantics(
    tierSemantics.source,
    facts,
    errors,
  );
  validateRecommendationTierSemantics(
    tierSemantics.recommendation,
    sourceKind,
    facts,
    capabilitiesValue,
    errors,
  );
}

function validateSourceTierSemantics(
  value: unknown,
  facts: EntryFacts | null,
  errors: RankingSetValidationError[],
): RankingSourceTierSemantics | null {
  const source = asRecord(value);

  if (!source) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics.source",
      message: "Source tier semantics must be an object.",
    });
    return null;
  }

  const kind = source.kind;
  const kindValid = SOURCE_TIER_SEMANTIC_VALUES.includes(
    kind as RankingSourceTierSemantics,
  );

  if (!kindValid) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics.source.kind",
      message: "Source tier semantics kind is unsupported.",
    });
  }

  const values = source.values;

  if (values === undefined) {
    return kindValid ? (kind as RankingSourceTierSemantics) : null;
  }

  if (!Array.isArray(values)) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics.source.values",
      message: "Source tier values must be an array when present.",
    });
    return kindValid ? (kind as RankingSourceTierSemantics) : null;
  }

  if (kind === "none" && values.length > 0) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics.source.values",
      message: "Source tier values must be absent when source tier kind is none.",
    });
  }

  const references = new Set<string>();

  values.forEach((valueItem, index) => {
    const path = `tierSemantics.source.values[${index}]`;
    const sourceValue = asRecord(valueItem);

    if (!sourceValue) {
      errors.push({
        code: "invalid-capability",
        path,
        message: "Source tier value must be an object.",
      });
      return;
    }

    const playerId = sourceValue.playerId;
    const overallRank = sourceValue.overallRank;
    const tier = sourceValue.tier;
    const playerIdValid = isNonEmptyString(playerId);
    const overallRankValid = isPositiveInteger(overallRank);

    if (!playerIdValid) {
      errors.push({
        code: "invalid-capability",
        path: `${path}.playerId`,
        message: "Source tier player ID must be a non-empty string.",
      });
    }

    if (!overallRankValid) {
      errors.push({
        code: "invalid-capability",
        path: `${path}.overallRank`,
        message: "Source tier overall rank must be a positive integer.",
      });
    }

    if (!isPositiveInteger(tier)) {
      errors.push({
        code: "invalid-tier",
        path: `${path}.tier`,
        message: "Source tier must be a positive integer.",
      });
    }

    if (!playerIdValid || !overallRankValid) {
      return;
    }

    const referenceKey = `${playerId}\u0000${overallRank}`;

    if (references.has(referenceKey)) {
      errors.push({
        code: "invalid-capability",
        path,
        message: "Source tier value references the same canonical entry more than once.",
      });
      return;
    }

    references.add(referenceKey);

    const entry = facts?.entriesByPlayerId.get(playerId);

    if (!entry) {
      errors.push({
        code: "invalid-capability",
        path: `${path}.playerId`,
        message: `Source tier player ID ${playerId} does not match a canonical entry.`,
      });
      return;
    }

    if (entry.overallRank !== overallRank) {
      errors.push({
        code: "invalid-capability",
        path: `${path}.overallRank`,
        message: `Source tier overall rank must match canonical entry rank ${entry.overallRank}.`,
      });
    }
  });

  return kindValid ? (kind as RankingSourceTierSemantics) : null;
}

function validateRecommendationTierSemantics(
  value: unknown,
  sourceKind: RankingSourceTierSemantics | null,
  facts: EntryFacts | null,
  capabilitiesValue: unknown,
  errors: RankingSetValidationError[],
): void {
  const recommendation = asRecord(value);

  if (!recommendation) {
    errors.push({
      code: "invalid-capability",
      path: "tierSemantics.recommendation",
      message: "Recommendation tier semantics must be an object.",
    });
    return;
  }

  const capabilities = asRecord(capabilitiesValue);
  const tierCapabilities = asRecord(capabilities?.tiers);

  POSITIONS.forEach((position) => {
    const represented = facts?.representedPositions.has(position) ?? false;
    const semantic = recommendation[position];
    const path = `tierSemantics.recommendation.${position}`;

    if (!represented) {
      if (semantic !== undefined) {
        errors.push({
          code: "invalid-capability",
          path,
          message: `${position} recommendation tier semantics must be absent when the position is absent.`,
        });
      }
      return;
    }

    if (
      !RECOMMENDATION_TIER_SEMANTIC_VALUES.includes(
        semantic as RankingRecommendationTierSemantics,
      )
    ) {
      errors.push({
        code: "invalid-capability",
        path,
        message: `${position} recommendation tier semantics are unsupported.`,
      });
      return;
    }

    if (
      sourceKind === "legacy-ambiguous" &&
      semantic === "recommendation-position"
    ) {
      errors.push({
        code: "invalid-capability",
        path,
        message: `${position} legacy ambiguous tiers are not recommendation-eligible by default.`,
      });
    }

    if (semantic === "neutral") {
      const tiers = facts?.tiersByPosition.get(position) ?? [];
      const hasNonNeutralTier = tiers.some((tier) => tier !== NEUTRAL_TIER);

      if (hasNonNeutralTier) {
        errors.push({
          code: "invalid-tier",
          path,
          message: `${position} neutral recommendation tiers must all equal ${NEUTRAL_TIER}.`,
        });
      }
    }

    validateRecommendationCapabilityAlignment(
      semantic as RankingRecommendationTierSemantics,
      tierCapabilities?.[position],
      position,
      errors,
    );
  });

  Object.keys(recommendation)
    .filter((key) => !POSITIONS.includes(key as Position))
    .sort()
    .forEach((key) => {
      errors.push({
        code: "invalid-capability",
        path: `tierSemantics.recommendation.${key}`,
        message: `Recommendation tier semantics position ${key} is unsupported.`,
      });
    });
}

function validateRecommendationCapabilityAlignment(
  semantic: RankingRecommendationTierSemantics,
  capability: unknown,
  position: Position,
  errors: RankingSetValidationError[],
): void {
  const expected =
    semantic === "neutral" ? "defaulted-neutral" : "source";

  if (capability !== expected) {
    errors.push({
      code: "invalid-capability",
      path: `capabilities.tiers.${position}`,
      message: `${position} tier capability must be ${expected} for ${semantic} recommendation tiers.`,
    });
  }
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  code: RankingSetValidationErrorCode,
  message: string,
  errors: RankingSetValidationError[],
): void {
  if (!isNonEmptyString(value)) {
    errors.push({ code, path, message });
  }
}

function validateOptionalNonEmptyString(
  value: unknown,
  path: string,
  errors: RankingSetValidationError[],
): void {
  if (value !== undefined && !isNonEmptyString(value)) {
    errors.push({
      code: "invalid-source",
      path,
      message: `${path} must be a non-empty string when present.`,
    });
  }
}

function validateDate(
  value: unknown,
  path: string,
  message: string,
  errors: RankingSetValidationError[],
): boolean {
  if (isValidDate(value)) {
    return true;
  }

  errors.push({ code: "invalid-date", path, message });
  return false;
}

function validateCapabilityValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: RankingSetValidationError[],
): void {
  if (!allowed.includes(value as T[number])) {
    errors.push({
      code: "invalid-capability",
      path,
      message: `${path} is unsupported.`,
    });
  }
}

function validateDerivedCapability(
  actual: RankingDataAvailability,
  expected: RankingDataAvailability,
  path: string,
  errors: RankingSetValidationError[],
): void {
  if (actual !== expected) {
    errors.push({
      code: "invalid-capability",
      path,
      message: `${path} must be ${expected} for the canonical entries.`,
    });
  }
}

function deriveAvailability(values: boolean[]): RankingDataAvailability {
  const availableCount = values.filter(Boolean).length;

  if (availableCount === 0) {
    return "none";
  }

  return availableCount === values.length ? "complete" : "partial";
}

function isAvailability(value: unknown): value is RankingDataAvailability {
  return AVAILABILITY_VALUES.includes(value as RankingDataAvailability);
}

function isPosition(value: unknown): value is Position {
  return POSITIONS.includes(value as Position);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
