import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  type RankingRecommendationTierSemantics,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSnapshot,
  type RankingSourceTierSemantics,
  type RankingTierCapability,
  type RankingTierSemantics,
} from "@/types/rankings";

export type RankingSnapshotJsonV2 = Readonly<{
  schemaVersion: 2;
  rankings: readonly RankingEntry[];
  capabilities?: RankingSetCapabilities;
  tierSemantics: RankingTierSemantics;
  sourceRankingSetId?: string;
  sourceRankingSetName?: string;
  capturedAt: string;
}>;

export type RankingSnapshotJson =
  | readonly RankingEntry[]
  | RankingSnapshotJsonV2;

export type CreateRankingSnapshotOptions = Readonly<{
  capturedAt?: Date;
}>;

export type RankingSnapshotCreationError = Readonly<{
  code: "invalid-ranking-set";
  path: string;
  message: string;
}>;

export type CreateRankingSnapshotResult =
  | Readonly<{ ok: true; snapshot: RankingSnapshot }>
  | Readonly<{
      ok: false;
      errors: readonly RankingSnapshotCreationError[];
    }>;

const validPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function createRankingSnapshotFromRankingSet(
  rankingSet: RankingSet,
  options: CreateRankingSnapshotOptions = {},
): CreateRankingSnapshotResult {
  const validation = validateRankingSet(rankingSet);

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map((error) => ({
        code: "invalid-ranking-set",
        path: error.path,
        message: error.message,
      })),
    };
  }

  return {
    ok: true,
    snapshot: materializeRankingSnapshot({
      rankings: validation.rankingSet.entries,
      capabilities: validation.rankingSet.capabilities,
      ...(validation.rankingSet.tierSemantics === undefined
        ? {}
        : { tierSemantics: validation.rankingSet.tierSemantics }),
      sourceRankingSetId: validation.rankingSet.id,
      sourceRankingSetName: validation.rankingSet.name,
      capturedAt: options.capturedAt ?? new Date(),
    }),
  };
}

export function serializeRankingSnapshot(
  rankings: readonly RankingEntry[],
): readonly RankingEntry[];
export function serializeRankingSnapshot(
  snapshot: RankingSnapshot,
): RankingSnapshotJsonV2;
export function serializeRankingSnapshot(
  value: readonly RankingEntry[] | RankingSnapshot,
): RankingSnapshotJson {
  if (isRankingEntryArray(value)) {
    return copyRankingEntries(value);
  }

  const snapshot = materializeRankingSnapshot(value, new Date());

  return {
    schemaVersion: 2,
    rankings: copyRankingEntries(snapshot.rankings),
    ...(snapshot.capabilities === undefined
      ? {}
      : { capabilities: copyRankingSetCapabilities(snapshot.capabilities) }),
    tierSemantics: copyTierSemantics(snapshot.tierSemantics as RankingTierSemantics),
    ...(snapshot.sourceRankingSetId === undefined
      ? {}
      : { sourceRankingSetId: snapshot.sourceRankingSetId }),
    ...(snapshot.sourceRankingSetName === undefined
      ? {}
      : { sourceRankingSetName: snapshot.sourceRankingSetName }),
    capturedAt: (snapshot.capturedAt as Date).toISOString(),
  };
}

function isRankingEntryArray(
  value: readonly RankingEntry[] | RankingSnapshot,
): value is readonly RankingEntry[] {
  return Array.isArray(value);
}

export function parseRankingSnapshotJson(snapshot: unknown): RankingEntry[] {
  if (!Array.isArray(snapshot)) {
    throw new Error("Ranking snapshot must be an array.");
  }

  return snapshot.map((entry, index) => parseRankingEntry(entry, index));
}

export function parsePersistedDraftRankingSnapshotJson(
  snapshot: unknown,
): RankingSnapshot {
  if (Array.isArray(snapshot)) {
    return materializeRankingSnapshot({
      rankings: parseRankingSnapshotJson(snapshot),
    });
  }

  const document = expectRecord(snapshot, "Ranking snapshot");

  if (document.schemaVersion !== 2) {
    throw new Error("Ranking snapshot schemaVersion must be 2.");
  }

  const rankings = parseRankingSnapshotJson(document.rankings);
  const tierSemantics = parseTierSemantics(document.tierSemantics);
  const capabilities =
    document.capabilities === undefined
      ? undefined
      : parseCapabilities(document.capabilities);
  const capturedAt = parseCapturedAt(document.capturedAt);
  const sourceRankingSetId = parseOptionalString(
    document.sourceRankingSetId,
    "Ranking snapshot sourceRankingSetId",
  );
  const sourceRankingSetName = parseOptionalString(
    document.sourceRankingSetName,
    "Ranking snapshot sourceRankingSetName",
  );
  const parsed: RankingSnapshot = {
    rankings,
    ...(capabilities === undefined ? {} : { capabilities }),
    tierSemantics,
    ...(sourceRankingSetId === undefined ? {} : { sourceRankingSetId }),
    ...(sourceRankingSetName === undefined ? {} : { sourceRankingSetName }),
    capturedAt,
  };

  validatePersistedSnapshot(parsed);
  return copyRankingSnapshot(parsed);
}

function materializeRankingSnapshot(
  snapshot: RankingSnapshot,
  defaultCapturedAt?: Date,
): RankingSnapshot {
  const capturedAt = snapshot.capturedAt ?? defaultCapturedAt;

  if (snapshot.tierSemantics) {
    return {
      rankings: copyRankingEntries(snapshot.rankings),
      ...(snapshot.capabilities === undefined
        ? {}
        : { capabilities: copyRankingSetCapabilities(snapshot.capabilities) }),
      tierSemantics: copyTierSemantics(snapshot.tierSemantics),
      ...(snapshot.sourceRankingSetId === undefined
        ? {}
        : { sourceRankingSetId: snapshot.sourceRankingSetId }),
      ...(snapshot.sourceRankingSetName === undefined
        ? {}
        : { sourceRankingSetName: snapshot.sourceRankingSetName }),
      ...(capturedAt === undefined ? {} : { capturedAt: copyDate(capturedAt) }),
    };
  }

  const originalRankings = copyRankingEntries(snapshot.rankings);
  const recommendation: Partial<Record<Position, "neutral">> = {};
  const sourceValues = originalRankings.map((entry) => {
    recommendation[entry.player.position] = "neutral";
    return {
      playerId: entry.player.id,
      overallRank: entry.overallRank,
      tier: entry.tier,
    };
  });
  const rankings = originalRankings.map((entry) => ({
    ...entry,
    player: { ...entry.player },
    tier: NEUTRAL_TIER,
  }));

  return {
    rankings,
    ...(snapshot.capabilities === undefined
      ? {}
      : {
          capabilities: neutralizeTierCapabilities(
            snapshot.capabilities,
            rankings,
          ),
        }),
    tierSemantics: {
      source: {
        kind: "legacy-ambiguous",
        values: sourceValues,
      },
      recommendation,
    },
    ...(snapshot.sourceRankingSetId === undefined
      ? {}
      : { sourceRankingSetId: snapshot.sourceRankingSetId }),
    ...(snapshot.sourceRankingSetName === undefined
      ? {}
      : { sourceRankingSetName: snapshot.sourceRankingSetName }),
    ...(capturedAt === undefined ? {} : { capturedAt: copyDate(capturedAt) }),
  };
}

function parseTierSemantics(value: unknown): RankingTierSemantics {
  const semantics = expectRecord(value, "Ranking snapshot tierSemantics");
  const source = expectRecord(
    semantics.source,
    "Ranking snapshot tierSemantics.source",
  );
  const sourceKind = expectString(
    source.kind,
    "Ranking snapshot tierSemantics.source.kind",
  );

  if (
    sourceKind !== "none" &&
    sourceKind !== "source-overall" &&
    sourceKind !== "legacy-ambiguous"
  ) {
    throw new Error("Ranking snapshot source tier semantics are unsupported.");
  }

  const sourceValues =
    source.values === undefined
      ? undefined
      : expectArray(
          source.values,
          "Ranking snapshot tierSemantics.source.values",
        ).map((sourceValue, index) => {
          const record = expectRecord(
            sourceValue,
            `Ranking snapshot tierSemantics.source.values[${index}]`,
          );
          return {
            playerId: expectString(
              record.playerId,
              `Ranking snapshot tierSemantics.source.values[${index}].playerId`,
            ),
            overallRank: expectNumber(
              record.overallRank,
              `Ranking snapshot tierSemantics.source.values[${index}].overallRank`,
            ),
            tier: expectNumber(
              record.tier,
              `Ranking snapshot tierSemantics.source.values[${index}].tier`,
            ),
          };
        });
  const recommendationRecord = expectRecord(
    semantics.recommendation,
    "Ranking snapshot tierSemantics.recommendation",
  );
  const recommendation: Partial<
    Record<Position, RankingRecommendationTierSemantics>
  > = {};

  Object.entries(recommendationRecord).forEach(([position, semantic]) => {
    if (!validPositions.includes(position as Position)) {
      throw new Error(
        `Ranking snapshot recommendation tier position ${position} is unsupported.`,
      );
    }

    if (semantic !== "neutral" && semantic !== "recommendation-position") {
      throw new Error(
        `Ranking snapshot ${position} recommendation tier semantics are unsupported.`,
      );
    }

    recommendation[position as Position] = semantic;
  });

  return {
    source: {
      kind: sourceKind as RankingSourceTierSemantics,
      ...(sourceValues === undefined ? {} : { values: sourceValues }),
    },
    recommendation,
  };
}

function parseCapabilities(value: unknown): RankingSetCapabilities {
  const capabilities = expectRecord(value, "Ranking snapshot capabilities");
  const tiersRecord = expectRecord(
    capabilities.tiers,
    "Ranking snapshot capabilities.tiers",
  );
  const tiers: Partial<Record<Position, RankingTierCapability>> = {};

  Object.entries(tiersRecord).forEach(([position, capability]) => {
    if (!validPositions.includes(position as Position)) {
      throw new Error(
        `Ranking snapshot tier capability position ${position} is unsupported.`,
      );
    }

    if (capability !== "source" && capability !== "defaulted-neutral") {
      throw new Error(
        `Ranking snapshot ${position} tier capability is unsupported.`,
      );
    }

    tiers[position as Position] = capability;
  });

  return {
    team: expectString(
      capabilities.team,
      "Ranking snapshot capabilities.team",
    ) as RankingSetCapabilities["team"],
    playerIdentity: expectString(
      capabilities.playerIdentity,
      "Ranking snapshot capabilities.playerIdentity",
    ) as RankingSetCapabilities["playerIdentity"],
    overallOrder: expectString(
      capabilities.overallOrder,
      "Ranking snapshot capabilities.overallOrder",
    ) as RankingSetCapabilities["overallOrder"],
    positionRank: expectString(
      capabilities.positionRank,
      "Ranking snapshot capabilities.positionRank",
    ) as RankingSetCapabilities["positionRank"],
    adp: expectString(
      capabilities.adp,
      "Ranking snapshot capabilities.adp",
    ) as RankingSetCapabilities["adp"],
    tiers,
  };
}

function validatePersistedSnapshot(snapshot: RankingSnapshot): void {
  if (!snapshot.capabilities) {
    validateSnapshotTierSemantics(snapshot);
    return;
  }

  const timestamp = snapshot.capturedAt as Date;
  const validation = validateRankingSet({
    id: snapshot.sourceRankingSetId ?? "persisted-snapshot",
    name: snapshot.sourceRankingSetName ?? "Persisted Snapshot",
    source: { kind: "manual" },
    capabilities: snapshot.capabilities,
    tierSemantics: snapshot.tierSemantics,
    entries: snapshot.rankings,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (!validation.ok) {
    const error = validation.errors[0];
    throw new Error(`Ranking snapshot ${error.path}: ${error.message}`);
  }
}

function validateSnapshotTierSemantics(snapshot: RankingSnapshot): void {
  const semantics = snapshot.tierSemantics as RankingTierSemantics;
  const representedPositions = new Set(
    snapshot.rankings.map((entry) => entry.player.position),
  );

  representedPositions.forEach((position) => {
    const semantic = semantics.recommendation[position];

    if (!semantic) {
      throw new Error(
        `Ranking snapshot ${position} recommendation tier semantics are unsupported.`,
      );
    }

    const positionEntries = snapshot.rankings.filter(
      (entry) => entry.player.position === position,
    );

    if (
      semantic === "neutral" &&
      positionEntries.some((entry) => entry.tier !== NEUTRAL_TIER)
    ) {
      throw new Error(
        `Ranking snapshot ${position} neutral recommendation tiers must all equal ${NEUTRAL_TIER}.`,
      );
    }

    if (semantic === "recommendation-position") {
      let previousTier = 0;
      positionEntries.forEach((entry) => {
        if (!Number.isInteger(entry.tier) || entry.tier <= 0 || entry.tier < previousTier) {
          throw new Error(
            `Ranking snapshot ${position} recommendation tiers must be positive and non-decreasing.`,
          );
        }
        previousTier = entry.tier;
      });
    }

    if (
      semantics.source.kind === "legacy-ambiguous" &&
      semantic === "recommendation-position"
    ) {
      throw new Error(
        `Ranking snapshot ${position} legacy ambiguous tiers are not recommendation-eligible.`,
      );
    }
  });

  Object.keys(semantics.recommendation).forEach((position) => {
    if (!representedPositions.has(position as Position)) {
      throw new Error(
        `Ranking snapshot ${position} recommendation tier semantics must be absent when the position is absent.`,
      );
    }
  });

  const sourceValues = semantics.source.values ?? [];

  if (semantics.source.kind === "none" && sourceValues.length > 0) {
    throw new Error(
      "Ranking snapshot source tier values must be absent when source tier kind is none.",
    );
  }

  const entriesByPlayerId = new Map(
    snapshot.rankings.map((entry) => [entry.player.id, entry]),
  );
  const references = new Set<string>();

  sourceValues.forEach((sourceValue) => {
    const entry = entriesByPlayerId.get(sourceValue.playerId);
    const reference = `${sourceValue.playerId}\u0000${sourceValue.overallRank}`;

    if (!entry) {
      throw new Error(
        `Ranking snapshot source tier player ID ${sourceValue.playerId} does not match a canonical entry.`,
      );
    }

    if (entry.overallRank !== sourceValue.overallRank) {
      throw new Error(
        `Ranking snapshot source tier rank for ${sourceValue.playerId} does not match its entry.`,
      );
    }

    if (!Number.isInteger(sourceValue.tier) || sourceValue.tier <= 0) {
      throw new Error("Ranking snapshot source tier must be a positive integer.");
    }

    if (references.has(reference)) {
      throw new Error("Ranking snapshot source tier reference is duplicated.");
    }
    references.add(reference);
  });
}

function neutralizeTierCapabilities(
  capabilities: RankingSetCapabilities,
  rankings: readonly RankingEntry[],
): RankingSetCapabilities {
  const representedPositions = new Set(
    rankings.map((entry) => entry.player.position),
  );
  const tiers: Partial<Record<Position, RankingTierCapability>> = {};

  validPositions.forEach((position) => {
    if (representedPositions.has(position)) {
      tiers[position] = "defaulted-neutral";
    }
  });

  return {
    ...copyRankingSetCapabilities(capabilities),
    tiers,
  };
}

function parseRankingEntry(entry: unknown, index: number): RankingEntry {
  const path = `Ranking snapshot entry ${index}`;
  const record = expectRecord(entry, path);
  const player = expectRecord(record.player, `${path}.player`);

  return {
    player: {
      id: expectString(player.id, `${path}.player.id`),
      name: expectString(player.name, `${path}.player.name`),
      team: expectString(player.team, `${path}.player.team`),
      position: expectPosition(player.position, `${path}.player.position`),
    },
    overallRank: expectNumber(record.overallRank, `${path}.overallRank`),
    adpRank: expectNullableNumber(record.adpRank, `${path}.adpRank`),
    positionRank: expectNumber(record.positionRank, `${path}.positionRank`),
    tier: expectNumber(record.tier, `${path}.tier`),
  };
}

function expectRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a number.`);
  }

  return value;
}

function expectNullableNumber(value: unknown, path: string): number | null {
  if (value === null) {
    return value;
  }

  return expectNumber(value, path);
}

function expectPosition(value: unknown, path: string): Position {
  if (!validPositions.includes(value as Position)) {
    throw new Error(`${path} must be a valid position.`);
  }

  return value as Position;
}

function parseCapturedAt(value: unknown): Date {
  if (typeof value !== "string") {
    throw new Error("Ranking snapshot capturedAt must be an ISO date string.");
  }

  const capturedAt = new Date(value);

  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.toISOString() !== value) {
    throw new Error("Ranking snapshot capturedAt must be an ISO date string.");
  }

  return capturedAt;
}

function parseOptionalString(
  value: unknown,
  path: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = expectString(value, path);

  if (parsed.trim().length === 0) {
    throw new Error(`${path} must be non-empty.`);
  }

  return parsed;
}

export function copyRankingEntries(
  rankings: readonly RankingEntry[],
): RankingEntry[] {
  return rankings.map((ranking) => ({
    player: {
      id: ranking.player.id,
      name: ranking.player.name,
      team: ranking.player.team,
      position: ranking.player.position,
    },
    overallRank: ranking.overallRank,
    adpRank: ranking.adpRank,
    positionRank: ranking.positionRank,
    tier: ranking.tier,
  }));
}

function copyRankingSnapshot(snapshot: RankingSnapshot): RankingSnapshot {
  return {
    rankings: copyRankingEntries(snapshot.rankings),
    ...(snapshot.capabilities === undefined
      ? {}
      : { capabilities: copyRankingSetCapabilities(snapshot.capabilities) }),
    ...(snapshot.tierSemantics === undefined
      ? {}
      : { tierSemantics: copyTierSemantics(snapshot.tierSemantics) }),
    ...(snapshot.sourceRankingSetId === undefined
      ? {}
      : { sourceRankingSetId: snapshot.sourceRankingSetId }),
    ...(snapshot.sourceRankingSetName === undefined
      ? {}
      : { sourceRankingSetName: snapshot.sourceRankingSetName }),
    ...(snapshot.capturedAt === undefined
      ? {}
      : { capturedAt: copyDate(snapshot.capturedAt) }),
  };
}

function copyTierSemantics(
  semantics: RankingTierSemantics,
): RankingTierSemantics {
  return {
    source: {
      kind: semantics.source.kind,
      ...(semantics.source.values === undefined
        ? {}
        : {
            values: semantics.source.values.map((value) => ({ ...value })),
          }),
    },
    recommendation: { ...semantics.recommendation },
  };
}

function copyRankingSetCapabilities(
  capabilities: RankingSetCapabilities,
): RankingSetCapabilities {
  return {
    team: capabilities.team,
    playerIdentity: capabilities.playerIdentity,
    overallOrder: capabilities.overallOrder,
    positionRank: capabilities.positionRank,
    adp: capabilities.adp,
    tiers: { ...capabilities.tiers },
  };
}

function copyDate(date: Date): Date {
  return new Date(date.getTime());
}
