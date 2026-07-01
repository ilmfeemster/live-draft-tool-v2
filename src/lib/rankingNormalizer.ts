import {
  CANONICAL_RANKING_JSON_V1_FORMAT,
  FANTASYPROS_CSV_V1_FORMAT,
  FANTASYPROS_CSV_V1_PROFILE,
} from "@/lib/rankingImportPreflight";
import type { Position } from "@/types/draft";
import type {
  NormalizedRankingCandidate,
  NormalizedRankingCandidateEntry,
  NormalizedRankingCandidateField,
  ParsedRankingField,
  ParsedRankingSourceDocument,
  ParsedRankingSourceRecord,
  RankingImportDiagnostic,
  RankingImportDiagnosticLocation,
  RankingImportStageResult,
  RankingNormalizationContext,
} from "@/types/rankingImport";
import {
  NEUTRAL_TIER,
  UNKNOWN_TEAM,
  type RankingDataAvailability,
  type RankingSetCapabilities,
  type RankingSetSource,
} from "@/types/rankings";

export type RankingNormalizerDiagnosticCode =
  | "unsupported-format"
  | "invalid-import-context"
  | "missing-name"
  | "invalid-metadata"
  | "invalid-capabilities"
  | "missing-required-value"
  | "invalid-text"
  | "invalid-position"
  | "invalid-team"
  | "invalid-number"
  | "invalid-null-marker"
  | "team-defaulted"
  | "adp-defaulted"
  | "source-tiers-preserved"
  | "tiers-defaulted-neutral";

type NormalizerDiagnostic =
  RankingImportDiagnostic<RankingNormalizerDiagnosticCode>;
type NormalizerResult = RankingImportStageResult<
  NormalizedRankingCandidate,
  RankingNormalizerDiagnosticCode
>;
type UnknownRecord = Record<string, unknown>;

type WorkingEntry = {
  sourceIndex: number;
  location: RankingImportDiagnosticLocation;
  fieldLocations: Partial<
    Record<NormalizedRankingCandidateField, RankingImportDiagnosticLocation>
  >;
  playerId: string | null;
  playerName: string | null;
  team: string | null;
  position: string | null;
  sourceOrder: number | null;
  sourcePositionRank: number | null;
  sourceTier?: number | null;
  tier: number | null;
  adpRank: number | null;
  teamState?: "source" | "missing" | "malformed";
  tierState?: "source" | "missing" | "malformed";
  adpState?: "source" | "missing" | "malformed";
};

type NormalizedContext = {
  name?: string;
  sourceLabel?: string;
  importedAt: Date | null;
};

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const POSITION_PATTERN = /^(QB|RB|WR|TE|DST|K)([1-9]\d*)?$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const SIGNED_DELTA_PATTERN = /^(?:[+-][1-9]\d*|0)$/;
const SOURCE_KINDS = ["seed", "external", "canonical", "manual"] as const;
const AVAILABILITY_VALUES = ["complete", "partial", "none"] as const;
const IDENTITY_VALUES = ["provided", "generated", "mixed"] as const;
const ORDER_VALUES = ["explicit", "row-derived"] as const;
const TIER_VALUES = ["source", "defaulted-neutral"] as const;
const CAPABILITY_KEYS = [
  "team",
  "playerIdentity",
  "overallOrder",
  "positionRank",
  "adp",
  "tiers",
] as const;

export function normalizeRankingSource(
  document: ParsedRankingSourceDocument,
  context: RankingNormalizationContext,
): NormalizerResult {
  if (sameFormat(document, FANTASYPROS_CSV_V1_FORMAT)) {
    return normalizeFantasyPros(document, context);
  }

  if (sameFormat(document, CANONICAL_RANKING_JSON_V1_FORMAT)) {
    return normalizeCanonical(document, context);
  }

  return failure([
    diagnostic(
      "unsupported-format",
      "error",
      "Ranking normalizer received an unsupported format.",
    ),
  ]);
}

function normalizeFantasyPros(
  document: ParsedRankingSourceDocument,
  context: RankingNormalizationContext,
): NormalizerResult {
  const errors: NormalizerDiagnostic[] = [];
  const normalizedContext = normalizeContext(context, true, errors);

  if (normalizedContext.name === undefined && !hasInvalidName(errors)) {
    errors.push(
      diagnostic(
        "missing-name",
        "error",
        "FantasyPros ranking imports require an explicit name.",
      ),
    );
  }

  const hasExplicitOrder = document.records.some(
    (record) => record.fields.overallOrder !== undefined,
  );
  const entries = document.records.map((record) =>
    normalizeFantasyProsRecord(record, hasExplicitOrder, errors),
  );
  const warnings: NormalizerDiagnostic[] = [];
  const defaultedTeams = entries.filter(
    (entry) => entry.teamState === "missing",
  ).length;

  if (defaultedTeams > 0) {
    warnings.push(
      diagnostic(
        "team-defaulted",
        "warning",
        `${defaultedTeams} ranking ${plural(defaultedTeams, "entry", "entries")} defaulted to ${UNKNOWN_TEAM}.`,
      ),
    );
  }

  const defaultedAdp = entries.filter(
    (entry) => entry.adpState === "missing",
  ).length;

  if (defaultedAdp > 0) {
    warnings.push(
      diagnostic(
        "adp-defaulted",
        "warning",
        `${defaultedAdp} ranking ${plural(defaultedAdp, "entry", "entries")} defaulted to null ADP.`,
      ),
    );
  }

  const tierCapabilities: Partial<Record<Position, "defaulted-neutral">> = {};
  const suppliedSourceTierCount = entries.filter(
    (entry) => entry.tierState === "source",
  ).length;

  POSITIONS.forEach((position) => {
    const positionEntries = entries.filter(
      (entry) => entry.position === position,
    );

    if (positionEntries.length === 0) {
      return;
    }

    positionEntries.forEach((entry) => {
      entry.tier = NEUTRAL_TIER;
      entry.fieldLocations.tier = entry.location;
    });
    tierCapabilities[position] = "defaulted-neutral";

    if (suppliedSourceTierCount === 0) {
      warnings.push(
        diagnostic(
          "tiers-defaulted-neutral",
          "warning",
          `${position} recommendation tiers defaulted to neutral because FantasyPros source tiers were absent.`,
        ),
      );
    }
  });

  if (suppliedSourceTierCount > 0) {
    warnings.push(
      diagnostic(
        "source-tiers-preserved",
        "warning",
        `${suppliedSourceTierCount} FantasyPros source ${plural(suppliedSourceTierCount, "tier was", "tiers were")} preserved as overall metadata; recommendation tiers remain neutral.`,
      ),
    );
  }

  if (errors.length > 0) {
    return failure(errors, warnings);
  }

  const source: RankingSetSource = {
    kind: "external",
    formatId: FANTASYPROS_CSV_V1_FORMAT.id,
    formatVersion: FANTASYPROS_CSV_V1_FORMAT.version,
    ...(normalizedContext.sourceLabel === undefined
      ? {}
      : { label: normalizedContext.sourceLabel }),
    importedAt: cloneDate(normalizedContext.importedAt as Date),
  };
  const capabilities: RankingSetCapabilities = {
    team: availability(
      entries.map((entry) => entry.teamState === "source"),
    ),
    playerIdentity: "generated",
    overallOrder: hasExplicitOrder ? "explicit" : "row-derived",
    positionRank: "derived",
    adp: availability(entries.map((entry) => entry.adpState === "source")),
    tiers: tierCapabilities,
  };

  return success(
    {
      name: normalizedContext.name as string,
      source,
      capabilities,
      entries: entries.map(toCandidateEntry),
    },
    warnings,
  );
}

function normalizeFantasyProsRecord(
  record: ParsedRankingSourceRecord,
  hasExplicitOrder: boolean,
  errors: NormalizerDiagnostic[],
): WorkingEntry {
  const location = csvRecordLocation(record);
  const entry = emptyWorkingEntry(record.sourceIndex, location);
  const recordErrors: NormalizerDiagnostic[] = [];
  const playerNameField = record.fields.playerName;
  const playerName = normalizeRequiredText(
    playerNameField,
    "player name",
    recordErrors,
  );

  entry.playerName = playerName;
  setLocation(entry, "playerName", playerNameField?.location ?? location);

  const teamField = record.fields.team;
  const teamResult = normalizeCsvTeam(teamField, recordErrors);
  entry.team = teamResult.value;
  entry.teamState = teamResult.state;
  setLocation(entry, "team", teamField?.location ?? location);

  const positionField = record.fields.position;
  const position = normalizeFantasyProsPosition(positionField, recordErrors);
  entry.position = position?.position ?? null;
  entry.sourcePositionRank = position?.rank ?? null;
  setLocation(entry, "position", positionField?.location ?? location);
  setLocation(entry, "sourcePositionRank", positionField?.location ?? location);

  if (playerName !== null && position !== null) {
    entry.playerId = generatedPlayerId(playerName, position.position);
  }
  setLocation(entry, "playerId", playerNameField?.location ?? location);

  const orderField = record.fields.overallOrder;

  if (hasExplicitOrder) {
    if (orderField === undefined) {
      recordErrors.push(
        diagnostic(
          "missing-required-value",
          "error",
          "FantasyPros explicit overall order is required on every record.",
          location,
        ),
      );
    } else {
      entry.sourceOrder = normalizeCsvPositiveInteger(
        orderField,
        "overall order",
        recordErrors,
      );
    }
    setLocation(entry, "sourceOrder", orderField?.location ?? location);
  } else {
    entry.sourceOrder = record.sourceIndex + 1;
    setLocation(entry, "sourceOrder", location);
  }

  const tierField = record.fields.tier;
  const tierResult = normalizeCsvOptionalPositiveInteger(
    tierField,
    "tier",
    recordErrors,
  );
  entry.sourceTier = tierResult.value;
  entry.tier = NEUTRAL_TIER;
  entry.tierState = tierResult.state;
  setLocation(entry, "sourceTier", tierField?.location ?? location);
  setLocation(entry, "tier", location);

  const adpField = record.fields.adpDelta;
  const delta = normalizeCsvAdpDelta(adpField, recordErrors);
  entry.adpState = delta.state;

  if (delta.value !== null && entry.sourceOrder !== null) {
    entry.adpRank = entry.sourceOrder + delta.value;
  }
  setLocation(entry, "adpRank", adpField?.location ?? location);

  errors.push(...recordErrors);
  return entry;
}

function normalizeCanonical(
  document: ParsedRankingSourceDocument,
  context: RankingNormalizationContext,
): NormalizerResult {
  const errors: NormalizerDiagnostic[] = [];
  const normalizedContext = normalizeContext(context, false, errors);
  const metadataWrapper = asRecord(document.metadata);
  const documentMetadataField = metadataWrapper
    ? asParsedField(metadataWrapper.documentMetadata)
    : null;
  const capabilitiesField = metadataWrapper
    ? asParsedField(metadataWrapper.capabilities)
    : null;

  if (!documentMetadataField || !asRecord(documentMetadataField.value)) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking metadata wrapper is invalid.",
        documentMetadataField?.location ?? { path: "metadata" },
      ),
    );
  }

  if (!capabilitiesField || !asRecord(capabilitiesField.value)) {
    errors.push(
      diagnostic(
        "invalid-capabilities",
        "error",
        "Canonical ranking capabilities wrapper is invalid.",
        capabilitiesField?.location ?? { path: "capabilities" },
      ),
    );
  }

  const portableMetadata = documentMetadataField
    ? asRecord(documentMetadataField.value)
    : null;
  const metadataLocation = documentMetadataField?.location ?? {
    path: "metadata",
  };
  const name = normalizeCanonicalName(
    normalizedContext.name,
    portableMetadata,
    metadataLocation,
    errors,
  );
  validateExportedAt(portableMetadata, metadataLocation, errors);
  const source = normalizeCanonicalSource(
    portableMetadata,
    metadataLocation,
    normalizedContext.importedAt,
    errors,
  );
  const capabilities = capabilitiesField
    ? normalizeCanonicalCapabilities(capabilitiesField, errors)
    : null;
  const entries = document.records.map((record) =>
    normalizeCanonicalRecord(record, errors),
  );

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    name: name as string,
    source: source as RankingSetSource,
    capabilities: capabilities as RankingSetCapabilities,
    entries: entries.map(toCandidateEntry),
  });
}

function normalizeCanonicalRecord(
  record: ParsedRankingSourceRecord,
  errors: NormalizerDiagnostic[],
): WorkingEntry {
  const location = { path: `entries[${record.sourceIndex}]` };
  const entry = emptyWorkingEntry(record.sourceIndex, location);
  const recordErrors: NormalizerDiagnostic[] = [];
  const fields = record.fields;

  entry.playerId = normalizeCanonicalPlayerId(
    fields.playerId,
    canonicalFieldLocation(record.sourceIndex, "playerId"),
    recordErrors,
  );
  setLocation(
    entry,
    "playerId",
    fields.playerId?.location ?? canonicalFieldLocation(record.sourceIndex, "playerId"),
  );

  entry.playerName = normalizeCanonicalRequiredText(
    fields.playerName,
    "player name",
    canonicalFieldLocation(record.sourceIndex, "playerName"),
    recordErrors,
  );
  setLocation(
    entry,
    "playerName",
    fields.playerName?.location ?? canonicalFieldLocation(record.sourceIndex, "playerName"),
  );

  entry.team = normalizeCanonicalTeam(
    fields.team,
    canonicalFieldLocation(record.sourceIndex, "team"),
    recordErrors,
  );
  setLocation(
    entry,
    "team",
    fields.team?.location ?? canonicalFieldLocation(record.sourceIndex, "team"),
  );

  entry.position = normalizeCanonicalPosition(
    fields.position,
    canonicalFieldLocation(record.sourceIndex, "position"),
    recordErrors,
  );
  setLocation(
    entry,
    "position",
    fields.position?.location ?? canonicalFieldLocation(record.sourceIndex, "position"),
  );

  entry.sourceOrder = normalizeCanonicalPositiveInteger(
    fields.overallOrder,
    "overall order",
    canonicalFieldLocation(record.sourceIndex, "sourceOrder"),
    recordErrors,
  );
  setLocation(
    entry,
    "sourceOrder",
    fields.overallOrder?.location ?? canonicalFieldLocation(record.sourceIndex, "sourceOrder"),
  );

  entry.sourcePositionRank = normalizeCanonicalPositiveInteger(
    fields.sourcePositionRank,
    "position rank",
    canonicalFieldLocation(record.sourceIndex, "sourcePositionRank"),
    recordErrors,
  );
  setLocation(
    entry,
    "sourcePositionRank",
    fields.sourcePositionRank?.location ?? canonicalFieldLocation(record.sourceIndex, "sourcePositionRank"),
  );

  entry.tier = normalizeCanonicalPositiveInteger(
    fields.tier,
    "tier",
    canonicalFieldLocation(record.sourceIndex, "tier"),
    recordErrors,
  );
  setLocation(
    entry,
    "tier",
    fields.tier?.location ?? canonicalFieldLocation(record.sourceIndex, "tier"),
  );

  entry.adpRank = normalizeCanonicalAdp(
    fields.adpRank,
    canonicalFieldLocation(record.sourceIndex, "adpRank"),
    recordErrors,
  );
  setLocation(
    entry,
    "adpRank",
    fields.adpRank?.location ?? canonicalFieldLocation(record.sourceIndex, "adpRank"),
  );

  errors.push(...recordErrors);
  return entry;
}

function normalizeContext(
  context: RankingNormalizationContext,
  requireDate: boolean,
  errors: NormalizerDiagnostic[],
): NormalizedContext {
  const raw = asRecord(context);
  let name: string | undefined;
  let sourceLabel: string | undefined;

  if (raw && raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
      errors.push(
        diagnostic(
          "invalid-import-context",
          "error",
          "Import context name must be a non-empty string when present.",
        ),
      );
    } else {
      name = raw.name.trim();
    }
  }

  if (raw && raw.sourceLabel !== undefined) {
    if (
      typeof raw.sourceLabel !== "string" ||
      raw.sourceLabel.trim().length === 0
    ) {
      errors.push(
        diagnostic(
          "invalid-import-context",
          "error",
          "Import context source label must be a non-empty string when present.",
        ),
      );
    } else {
      sourceLabel = raw.sourceLabel.trim();
    }
  }

  const importedAt = raw?.importedAt;
  const validDate = isValidDate(importedAt);

  if (requireDate && !validDate) {
    errors.push(
      diagnostic(
        "invalid-import-context",
        "error",
        "Import context importedAt must be a valid Date.",
      ),
    );
  }

  return {
    name,
    sourceLabel,
    importedAt: validDate ? cloneDate(importedAt) : null,
  };
}

function normalizeCanonicalName(
  explicitName: string | undefined,
  metadata: UnknownRecord | null,
  location: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): string | null {
  if (explicitName !== undefined) {
    return explicitName;
  }

  if (!metadata || !hasOwn(metadata, "name")) {
    errors.push(
      diagnostic(
        "missing-name",
        "error",
        "Canonical ranking metadata must contain a name.",
        childLocation(location, "name"),
      ),
    );
    return null;
  }

  if (
    typeof metadata.name !== "string" ||
    metadata.name.trim().length === 0
  ) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking metadata name must be a non-empty string.",
        childLocation(location, "name"),
      ),
    );
    return null;
  }

  return metadata.name.trim();
}

function validateExportedAt(
  metadata: UnknownRecord | null,
  location: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): void {
  if (!metadata || !isIsoDateString(metadata.exportedAt)) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking metadata exportedAt must be a valid ISO timestamp.",
        childLocation(location, "exportedAt"),
      ),
    );
  }
}

function normalizeCanonicalSource(
  metadata: UnknownRecord | null,
  location: RankingImportDiagnosticLocation,
  contextImportedAt: Date | null,
  errors: NormalizerDiagnostic[],
): RankingSetSource | null {
  if (!metadata || metadata.source === undefined) {
    if (!contextImportedAt) {
      errors.push(
        diagnostic(
          "invalid-import-context",
          "error",
          "Canonical imports without source provenance require a valid importedAt Date.",
        ),
      );
      return null;
    }

    return {
      kind: "canonical",
      formatId: CANONICAL_RANKING_JSON_V1_FORMAT.id,
      formatVersion: CANONICAL_RANKING_JSON_V1_FORMAT.version,
      importedAt: cloneDate(contextImportedAt),
    };
  }

  const source = asRecord(metadata.source);
  const sourceLocation = childLocation(location, "source");

  if (!source) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking source provenance must be an object.",
        sourceLocation,
      ),
    );
    return null;
  }

  let valid = true;

  if (!SOURCE_KINDS.includes(source.kind as (typeof SOURCE_KINDS)[number])) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking source kind is unsupported.",
        childLocation(sourceLocation, "kind"),
      ),
    );
    valid = false;
  }

  for (const field of ["formatId", "label"] as const) {
    const value = source[field];

    if (
      value !== undefined &&
      (typeof value !== "string" || value.trim().length === 0)
    ) {
      errors.push(
        diagnostic(
          "invalid-metadata",
          "error",
          `Canonical ranking source ${field} must be a non-empty string when present.`,
          childLocation(sourceLocation, field),
        ),
      );
      valid = false;
    }
  }

  if (
    source.formatVersion !== undefined &&
    (!Number.isInteger(source.formatVersion) ||
      (source.formatVersion as number) <= 0)
  ) {
    errors.push(
      diagnostic(
        "invalid-metadata",
        "error",
        "Canonical ranking source formatVersion must be a positive integer when present.",
        childLocation(sourceLocation, "formatVersion"),
      ),
    );
    valid = false;
  }

  let importedAt: Date | undefined;

  if (source.importedAt !== undefined) {
    if (!isIsoDateString(source.importedAt)) {
      errors.push(
        diagnostic(
          "invalid-metadata",
          "error",
          "Canonical ranking source importedAt must be a valid ISO timestamp when present.",
          childLocation(sourceLocation, "importedAt"),
        ),
      );
      valid = false;
    } else {
      importedAt = new Date(source.importedAt);
    }
  }

  if (!valid) {
    return null;
  }

  return {
    kind: source.kind as RankingSetSource["kind"],
    ...(source.formatId === undefined
      ? {}
      : { formatId: (source.formatId as string).trim() }),
    ...(source.formatVersion === undefined
      ? {}
      : { formatVersion: source.formatVersion as number }),
    ...(source.label === undefined
      ? {}
      : { label: (source.label as string).trim() }),
    ...(importedAt === undefined ? {} : { importedAt }),
  };
}

function normalizeCanonicalCapabilities(
  field: ParsedRankingField,
  errors: NormalizerDiagnostic[],
): RankingSetCapabilities | null {
  const value = asRecord(field.value);

  if (!value) {
    return null;
  }

  let valid = true;

  Object.keys(value)
    .filter((key) => !CAPABILITY_KEYS.includes(key as (typeof CAPABILITY_KEYS)[number]))
    .sort()
    .forEach((key) => {
      errors.push(
        diagnostic(
          "invalid-capabilities",
          "error",
          `Canonical ranking capability ${key} is unsupported.`,
          childLocation(field.location, key),
        ),
      );
      valid = false;
    });

  valid = validateCapability(
    value.team,
    AVAILABILITY_VALUES,
    "team",
    field.location,
    errors,
  ) && valid;
  valid = validateCapability(
    value.playerIdentity,
    IDENTITY_VALUES,
    "playerIdentity",
    field.location,
    errors,
  ) && valid;
  valid = validateCapability(
    value.overallOrder,
    ORDER_VALUES,
    "overallOrder",
    field.location,
    errors,
  ) && valid;
  valid = validateCapability(
    value.positionRank,
    ["derived"] as const,
    "positionRank",
    field.location,
    errors,
  ) && valid;
  valid = validateCapability(
    value.adp,
    AVAILABILITY_VALUES,
    "adp",
    field.location,
    errors,
  ) && valid;

  const tiers = asRecord(value.tiers);
  const normalizedTiers: Partial<
    Record<Position, "source" | "defaulted-neutral">
  > = {};

  if (!tiers) {
    errors.push(
      diagnostic(
        "invalid-capabilities",
        "error",
        "Canonical ranking tier capabilities must be an object.",
        childLocation(field.location, "tiers"),
      ),
    );
    valid = false;
  } else {
    Object.keys(tiers)
      .sort()
      .forEach((key) => {
        const tierLocation = childLocation(
          childLocation(field.location, "tiers"),
          key,
        );

        if (!POSITIONS.includes(key as Position)) {
          errors.push(
            diagnostic(
              "invalid-capabilities",
              "error",
              `Canonical ranking tier capability position ${key} is unsupported.`,
              tierLocation,
            ),
          );
          valid = false;
        } else if (!TIER_VALUES.includes(tiers[key] as (typeof TIER_VALUES)[number])) {
          errors.push(
            diagnostic(
              "invalid-capabilities",
              "error",
              `Canonical ranking ${key} tier capability is unsupported.`,
              tierLocation,
            ),
          );
          valid = false;
        } else {
          normalizedTiers[key as Position] = tiers[key] as
            | "source"
            | "defaulted-neutral";
        }
      });
  }

  if (!valid) {
    return null;
  }

  return {
    team: value.team as RankingSetCapabilities["team"],
    playerIdentity:
      value.playerIdentity as RankingSetCapabilities["playerIdentity"],
    overallOrder:
      value.overallOrder as RankingSetCapabilities["overallOrder"],
    positionRank: "derived",
    adp: value.adp as RankingSetCapabilities["adp"],
    tiers: normalizedTiers,
  };
}

function validateCapability<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  location: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): boolean {
  if (allowed.includes(value as T[number])) {
    return true;
  }

  errors.push(
    diagnostic(
      "invalid-capabilities",
      "error",
      `Canonical ranking capability ${field} is unsupported.`,
      childLocation(location, field),
    ),
  );
  return false;
}

function normalizeFantasyProsPosition(
  field: ParsedRankingField | undefined,
  errors: NormalizerDiagnostic[],
): { position: Position; rank: number | null } | null {
  if (!field) {
    errors.push(
      diagnostic(
        "missing-required-value",
        "error",
        "FantasyPros player position is required.",
      ),
    );
    return null;
  }

  if (typeof field.value !== "string") {
    errors.push(
      diagnostic(
        "invalid-position",
        "error",
        "FantasyPros player position must be a supported string.",
        field.location,
      ),
    );
    return null;
  }

  const normalized = field.value.trim().toUpperCase();
  const match = POSITION_PATTERN.exec(normalized);

  if (!match || !FANTASYPROS_CSV_V1_PROFILE.positionValuePattern.test(normalized)) {
    errors.push(
      diagnostic(
        "invalid-position",
        "error",
        "FantasyPros player position is unsupported.",
        field.location,
      ),
    );
    return null;
  }

  return {
    position: match[1] as Position,
    rank: match[2] === undefined ? null : Number(match[2]),
  };
}

function normalizeCsvTeam(
  field: ParsedRankingField | undefined,
  errors: NormalizerDiagnostic[],
): {
  value: string;
  state: "source" | "missing" | "malformed";
} {
  if (field === undefined || field.value === "") {
    return { value: UNKNOWN_TEAM, state: "missing" };
  }

  if (typeof field.value !== "string") {
    errors.push(
      diagnostic(
        "invalid-team",
        "error",
        "FantasyPros team must be a string when supplied.",
        field.location,
      ),
    );
    return { value: UNKNOWN_TEAM, state: "malformed" };
  }

  const normalized = field.value.trim().toUpperCase();

  if (normalized.length === 0) {
    return { value: UNKNOWN_TEAM, state: "missing" };
  }

  return { value: normalized, state: "source" };
}

function normalizeRequiredText(
  field: ParsedRankingField | undefined,
  label: string,
  errors: NormalizerDiagnostic[],
): string | null {
  if (!field) {
    errors.push(
      diagnostic(
        "missing-required-value",
        "error",
        `FantasyPros ${label} is required.`,
      ),
    );
    return null;
  }

  if (typeof field.value !== "string" || field.value.trim().length === 0) {
    errors.push(
      diagnostic(
        "invalid-text",
        "error",
        `FantasyPros ${label} must be a non-empty string.`,
        field.location,
      ),
    );
    return null;
  }

  return field.value.trim();
}

function normalizeCsvPositiveInteger(
  field: ParsedRankingField,
  label: string,
  errors: NormalizerDiagnostic[],
): number | null {
  if (
    typeof field.value !== "string" ||
    !POSITIVE_INTEGER_PATTERN.test(field.value.trim())
  ) {
    errors.push(
      diagnostic(
        "invalid-number",
        "error",
        `FantasyPros ${label} must be a positive base-10 integer.`,
        field.location,
      ),
    );
    return null;
  }

  return Number(field.value.trim());
}

function normalizeCsvOptionalPositiveInteger(
  field: ParsedRankingField | undefined,
  label: string,
  errors: NormalizerDiagnostic[],
): { value: number | null; state: "source" | "missing" | "malformed" } {
  if (
    field === undefined ||
    (typeof field.value === "string" && field.value.trim().length === 0)
  ) {
    return { value: null, state: "missing" };
  }

  const value = normalizeCsvPositiveInteger(field, label, errors);
  return value === null
    ? { value: null, state: "malformed" }
    : { value, state: "source" };
}

function normalizeCsvAdpDelta(
  field: ParsedRankingField | undefined,
  errors: NormalizerDiagnostic[],
): {
  value: number | null;
  state: "source" | "missing" | "malformed";
} {
  if (field === undefined) {
    return { value: null, state: "missing" };
  }

  if (typeof field.value !== "string") {
    errors.push(
      diagnostic(
        "invalid-number",
        "error",
        "FantasyPros ADP delta must be a supported string representation.",
        field.location,
      ),
    );
    return { value: null, state: "malformed" };
  }

  const value = field.value.trim();

  if (value.length === 0 || value === FANTASYPROS_CSV_V1_PROFILE.adpDeltaNullMarker) {
    return { value: null, state: "missing" };
  }

  if (value.startsWith("-") && !SIGNED_DELTA_PATTERN.test(value)) {
    errors.push(
      diagnostic(
        "invalid-null-marker",
        "error",
        "FantasyPros ADP delta uses an unsupported null or negative marker.",
        field.location,
      ),
    );
    return { value: null, state: "malformed" };
  }

  if (
    !SIGNED_DELTA_PATTERN.test(value) ||
    !FANTASYPROS_CSV_V1_PROFILE.adpDeltaValuePattern.test(value)
  ) {
    errors.push(
      diagnostic(
        "invalid-number",
        "error",
        "FantasyPros ADP delta must be a signed non-zero integer, zero, or the documented null marker.",
        field.location,
      ),
    );
    return { value: null, state: "malformed" };
  }

  return { value: Number(value), state: "source" };
}

function normalizeCanonicalPlayerId(
  field: ParsedRankingField | undefined,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): string | null {
  if (!field) {
    errors.push(missingCanonicalValue("player ID", fallbackLocation));
    return null;
  }

  if (typeof field.value !== "string") {
    errors.push(
      diagnostic(
        "invalid-text",
        "error",
        "Canonical player ID must be a string.",
        field.location,
      ),
    );
    return null;
  }

  return field.value;
}

function normalizeCanonicalRequiredText(
  field: ParsedRankingField | undefined,
  label: string,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): string | null {
  if (!field) {
    errors.push(missingCanonicalValue(label, fallbackLocation));
    return null;
  }

  if (typeof field.value !== "string" || field.value.trim().length === 0) {
    errors.push(
      diagnostic(
        "invalid-text",
        "error",
        `Canonical ${label} must be a non-empty string.`,
        field.location,
      ),
    );
    return null;
  }

  return field.value.trim();
}

function normalizeCanonicalTeam(
  field: ParsedRankingField | undefined,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): string | null {
  if (!field) {
    errors.push(missingCanonicalValue("team", fallbackLocation));
    return null;
  }

  if (typeof field.value !== "string" || field.value.trim().length === 0) {
    errors.push(
      diagnostic(
        "invalid-team",
        "error",
        "Canonical team must be a non-empty string.",
        field.location,
      ),
    );
    return null;
  }

  return field.value.trim().toUpperCase();
}

function normalizeCanonicalPosition(
  field: ParsedRankingField | undefined,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): Position | null {
  if (!field) {
    errors.push(missingCanonicalValue("position", fallbackLocation));
    return null;
  }

  if (typeof field.value !== "string") {
    errors.push(
      diagnostic(
        "invalid-position",
        "error",
        "Canonical player position must be a supported string.",
        field.location,
      ),
    );
    return null;
  }

  const value = field.value.trim().toUpperCase();

  if (!POSITIONS.includes(value as Position)) {
    errors.push(
      diagnostic(
        "invalid-position",
        "error",
        "Canonical player position is unsupported.",
        field.location,
      ),
    );
    return null;
  }

  return value as Position;
}

function normalizeCanonicalPositiveInteger(
  field: ParsedRankingField | undefined,
  label: string,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): number | null {
  if (!field) {
    errors.push(missingCanonicalValue(label, fallbackLocation));
    return null;
  }

  if (!Number.isInteger(field.value) || (field.value as number) <= 0) {
    errors.push(
      diagnostic(
        "invalid-number",
        "error",
        `Canonical ${label} must be a positive integer number.`,
        field.location,
      ),
    );
    return null;
  }

  return field.value as number;
}

function normalizeCanonicalAdp(
  field: ParsedRankingField | undefined,
  fallbackLocation: RankingImportDiagnosticLocation,
  errors: NormalizerDiagnostic[],
): number | null {
  if (!field) {
    errors.push(missingCanonicalValue("ADP rank", fallbackLocation));
    return null;
  }

  if (field.value === null) {
    return null;
  }

  if (
    typeof field.value !== "number" ||
    !Number.isFinite(field.value) ||
    field.value <= 0
  ) {
    errors.push(
      diagnostic(
        "invalid-number",
        "error",
        "Canonical ADP rank must be null or a positive finite number.",
        field.location,
      ),
    );
    return null;
  }

  return field.value;
}

function missingCanonicalValue(
  label: string,
  location: RankingImportDiagnosticLocation,
): NormalizerDiagnostic {
  return diagnostic(
    "missing-required-value",
    "error",
    `Canonical ${label} is required.`,
    location,
  );
}

function generatedPlayerId(name: string, position: Position): string {
  return `fantasypros-v1:${position.toLowerCase()}:${encodeURIComponent(name.toLowerCase())}`;
}

function availability(values: readonly boolean[]): RankingDataAvailability {
  const availableCount = values.filter(Boolean).length;

  if (availableCount === 0) {
    return "none";
  }

  return availableCount === values.length ? "complete" : "partial";
}

function emptyWorkingEntry(
  sourceIndex: number,
  location: RankingImportDiagnosticLocation,
): WorkingEntry {
  return {
    sourceIndex,
    location,
    fieldLocations: {},
    playerId: null,
    playerName: null,
    team: null,
    position: null,
    sourceOrder: null,
    sourcePositionRank: null,
    tier: null,
    adpRank: null,
  };
}

function toCandidateEntry(entry: WorkingEntry): NormalizedRankingCandidateEntry {
  return {
    sourceIndex: entry.sourceIndex,
    location: { ...entry.location },
    fieldLocations: Object.fromEntries(
      Object.entries(entry.fieldLocations).map(([key, location]) => [
        key,
        { ...location },
      ]),
    ),
    playerId: entry.playerId,
    playerName: entry.playerName,
    team: entry.team,
    position: entry.position,
    sourceOrder: entry.sourceOrder,
    sourcePositionRank: entry.sourcePositionRank,
    ...(Object.prototype.hasOwnProperty.call(entry, "sourceTier")
      ? { sourceTier: entry.sourceTier ?? null }
      : {}),
    tier: entry.tier,
    adpRank: entry.adpRank,
  };
}

function setLocation(
  entry: WorkingEntry,
  field: NormalizedRankingCandidateField,
  location: RankingImportDiagnosticLocation,
): void {
  entry.fieldLocations[field] = { ...location };
}

function csvRecordLocation(
  record: ParsedRankingSourceRecord,
): RankingImportDiagnosticLocation {
  const firstField = Object.values(record.fields)[0];
  return firstField ? { ...firstField.location } : {};
}

function canonicalFieldLocation(
  sourceIndex: number,
  field: NormalizedRankingCandidateField,
): RankingImportDiagnosticLocation {
  const paths: Record<NormalizedRankingCandidateField, string> = {
    playerId: `entries[${sourceIndex}].player.id`,
    playerName: `entries[${sourceIndex}].player.name`,
    team: `entries[${sourceIndex}].player.team`,
    position: `entries[${sourceIndex}].player.position`,
    sourceOrder: `entries[${sourceIndex}].overallRank`,
    sourcePositionRank: `entries[${sourceIndex}].positionRank`,
    sourceTier: `entries[${sourceIndex}].sourceTier`,
    tier: `entries[${sourceIndex}].tier`,
    adpRank: `entries[${sourceIndex}].adpRank`,
  };
  return { path: paths[field], field };
}

function childLocation(
  location: RankingImportDiagnosticLocation,
  child: string,
): RankingImportDiagnosticLocation {
  return {
    ...location,
    path: location.path ? `${location.path}.${child}` : child,
    field: child,
  };
}

function asParsedField(value: unknown): ParsedRankingField | null {
  const record = asRecord(value);
  const location = asRecord(record?.location);

  if (!record || !hasOwn(record, "value") || !location) {
    return null;
  }

  return {
    value: record.value,
    location: location as RankingImportDiagnosticLocation,
  };
}

function sameFormat(
  document: ParsedRankingSourceDocument,
  format: { id: string; version: number },
): boolean {
  return (
    document.format.id === format.id && document.format.version === format.version
  );
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOwn(record: UnknownRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime());
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function hasInvalidName(errors: readonly NormalizerDiagnostic[]): boolean {
  return errors.some(
    (entry) =>
      entry.code === "invalid-import-context" && entry.message.includes("name"),
  );
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}

function diagnostic(
  code: RankingNormalizerDiagnosticCode,
  severity: "error" | "warning",
  message: string,
  location?: RankingImportDiagnosticLocation,
): NormalizerDiagnostic {
  return {
    code,
    stage: "normalize",
    severity,
    message,
    ...(location === undefined ? {} : { location }),
  };
}

function success(
  value: NormalizedRankingCandidate,
  warnings: readonly NormalizerDiagnostic[] = [],
): NormalizerResult {
  return { ok: true, value, warnings };
}

function failure(
  errors: readonly NormalizerDiagnostic[],
  warnings: readonly NormalizerDiagnostic[] = [],
): NormalizerResult {
  return { ok: false, errors, warnings };
}
