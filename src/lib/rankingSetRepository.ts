import { getPrismaClient } from "@/lib/prisma";
import { validateRankingSet } from "@/lib/rankingSetValidation";
import { Prisma } from "@/generated/prisma/client";
import type { Position, RankingEntry } from "@/types/draft";
import {
  NEUTRAL_TIER,
  type RankingDataAvailability,
  type RankingOverallOrderCapability,
  type RankingPlayerIdentityCapability,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSetSource,
  type RankingSetSourceKind,
  type RankingSetSummary,
  type RankingTierCapability,
  type RankingTierSemantics,
} from "@/types/rankings";

export type CreateRankingSetError = Readonly<{
  code: "invalid-ranking-set" | "name-conflict";
  message: string;
  path?: string;
}>;

export type CreateRankingSetResult =
  | Readonly<{ ok: true; rankingSet: RankingSet }>
  | Readonly<{ ok: false; errors: readonly CreateRankingSetError[] }>;

export type ReplaceRankingSetError = Readonly<{
  code: "invalid-ranking-set" | "not-found" | "name-conflict";
  message: string;
  path?: string;
}>;

export type ReplaceRankingSetResult =
  | Readonly<{ ok: true; rankingSet: RankingSet }>
  | Readonly<{ ok: false; errors: readonly ReplaceRankingSetError[] }>;

export type DeleteRankingSetError = Readonly<{
  code: "not-found";
  message: string;
  path: "id";
}>;

export type DeleteRankingSetResult =
  | Readonly<{ ok: true; id: string }>
  | Readonly<{ ok: false; errors: readonly DeleteRankingSetError[] }>;

export class RankingSetRepositoryMappingError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`Invalid persisted ranking set at ${path}: ${message}`);
    this.name = "RankingSetRepositoryMappingError";
    this.path = path;
  }
}

type PersistedSourceKind = "SEED" | "EXTERNAL" | "CANONICAL" | "MANUAL";
type PersistedAvailability = "COMPLETE" | "PARTIAL" | "NONE";
type PersistedIdentityCapability = "PROVIDED" | "GENERATED" | "MIXED";
type PersistedOrderCapability = "EXPLICIT" | "ROW_DERIVED";
type PersistedPosition = "QB" | "RB" | "WR" | "TE" | "DST" | "K";

type PersistedRankingSetEntryRecord = {
  id: string;
  rankingSetId: string;
  playerId: string;
  playerName: string;
  team: string;
  position: PersistedPosition;
  overallRank: number;
  positionRank: number;
  tier: number;
  adpRank: number | null;
};

type PersistedRankingSetRecord = {
  id: string;
  name: string;
  normalizedName: string;
  sourceKind: PersistedSourceKind;
  sourceFormatId: string | null;
  sourceFormatVersion: number | null;
  sourceLabel: string | null;
  sourceImportedAt: Date | null;
  teamCapability: PersistedAvailability;
  playerIdentityCapability: PersistedIdentityCapability;
  overallOrderCapability: PersistedOrderCapability;
  adpCapability: PersistedAvailability;
  tierCapabilities: unknown;
  tierSemantics: unknown | null;
  entries: PersistedRankingSetEntryRecord[];
  createdAt: Date;
  updatedAt: Date;
};

type PersistedRankingSetSummaryRecord = Omit<
  PersistedRankingSetRecord,
  | "normalizedName"
  | "sourceFormatId"
  | "sourceFormatVersion"
  | "sourceLabel"
  | "sourceImportedAt"
  | "tierSemantics"
  | "entries"
> & {
  _count: { entries: number };
};

type RankingSetEntryCreateData = Omit<
  PersistedRankingSetEntryRecord,
  "id" | "rankingSetId"
>;

type RankingSetCreateData = Omit<
  PersistedRankingSetRecord,
  | "entries"
  | "sourceFormatId"
  | "sourceFormatVersion"
  | "sourceLabel"
  | "sourceImportedAt"
  | "tierSemantics"
> & {
  sourceFormatId?: string;
  sourceFormatVersion?: number;
  sourceLabel?: string;
  sourceImportedAt?: Date;
  tierSemantics?: unknown;
  entries: { create: RankingSetEntryCreateData[] };
};

type RankingSetUpdateData = Omit<
  RankingSetCreateData,
  | "id"
  | "sourceFormatId"
  | "sourceFormatVersion"
  | "sourceLabel"
  | "sourceImportedAt"
  | "tierSemantics"
  | "entries"
> & {
  sourceFormatId: string | null;
  sourceFormatVersion: number | null;
  sourceLabel: string | null;
  sourceImportedAt: Date | null;
  tierSemantics: unknown;
  entries: {
    deleteMany: Record<string, never>;
    create: RankingSetEntryCreateData[];
  };
};

type FullRecordInclude = {
  entries: {
    orderBy: { overallRank: "asc" };
  };
};

type SummarySelect = {
  id: true;
  name: true;
  sourceKind: true;
  teamCapability: true;
  playerIdentityCapability: true;
  overallOrderCapability: true;
  adpCapability: true;
  tierCapabilities: true;
  _count: { select: { entries: true } };
  createdAt: true;
  updatedAt: true;
};

type RankingSetRepositoryDb = {
  $transaction?<T>(
    callback: (tx: RankingSetRepositoryTransactionDb) => Promise<T>,
  ): Promise<T>;
  rankingSet: {
    create(args: {
      data: RankingSetCreateData;
      include: FullRecordInclude;
    }): Promise<PersistedRankingSetRecord>;
    update(args: {
      where: { id: string };
      data: RankingSetUpdateData;
      include: FullRecordInclude;
    }): Promise<PersistedRankingSetRecord>;
    delete(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<{ id: string }>;
    findUnique(args: {
      where: { id: string };
      include: FullRecordInclude;
    }): Promise<PersistedRankingSetRecord | null>;
    findMany(args: {
      select: SummarySelect;
      orderBy: readonly [
        { updatedAt: "desc" },
        { name: "asc" },
        { id: "asc" },
      ];
    }): Promise<PersistedRankingSetSummaryRecord[]>;
  };
};

type RankingSetRepositoryTransactionDb = Omit<
  RankingSetRepositoryDb,
  "$transaction"
>;

const fullRecordInclude = {
  entries: { orderBy: { overallRank: "asc" } },
} as const;

const summarySelect = {
  id: true,
  name: true,
  sourceKind: true,
  teamCapability: true,
  playerIdentityCapability: true,
  overallOrderCapability: true,
  adpCapability: true,
  tierCapabilities: true,
  _count: { select: { entries: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const summaryOrder = [
  { updatedAt: "desc" },
  { name: "asc" },
  { id: "asc" },
] as const;

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function createRankingSetRepository(db: RankingSetRepositoryDb) {
  return {
    async createRankingSet(
      rankingSet: RankingSet,
    ): Promise<CreateRankingSetResult> {
      const validation = validateRankingSet(rankingSet);

      if (!validation.ok) {
        return {
          ok: false,
          errors: validation.errors.map((domainError) => ({
            code: "invalid-ranking-set",
            message: domainError.message,
            path: domainError.path,
          })),
        };
      }

      try {
        const created = await runRepositoryTransaction(db, (tx) => {
          return tx.rankingSet.create({
            data: mapRankingSetToCreateData(validation.rankingSet),
            include: fullRecordInclude,
          });
        });

        return { ok: true, rankingSet: mapRecordToRankingSet(created) };
      } catch (error) {
        if (isNormalizedNameConflict(error)) {
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

        throw error;
      }
    },

    async replaceRankingSet(
      rankingSet: RankingSet,
    ): Promise<ReplaceRankingSetResult> {
      const validation = validateRankingSet(rankingSet);

      if (!validation.ok) {
        return {
          ok: false,
          errors: validation.errors.map((domainError) => ({
            code: "invalid-ranking-set",
            message: domainError.message,
            path: domainError.path,
          })),
        };
      }

      try {
        const replaced = await runRepositoryTransaction(db, async (tx) => {
          const record = await tx.rankingSet.update({
            where: { id: validation.rankingSet.id },
            data: mapRankingSetToUpdateData(validation.rankingSet),
            include: fullRecordInclude,
          });

          return mapRecordToRankingSet(record);
        });

        return { ok: true, rankingSet: replaced };
      } catch (error) {
        if (isNormalizedNameConflict(error)) {
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

        if (isPrismaErrorCode(error, "P2025")) {
          return notFoundResult();
        }

        throw error;
      }
    },

    async deleteRankingSetById(id: string): Promise<DeleteRankingSetResult> {
      try {
        const deleted = await db.rankingSet.delete({
          where: { id },
          select: { id: true },
        });

        return { ok: true, id: deleted.id };
      } catch (error) {
        if (isPrismaErrorCode(error, "P2025")) {
          return notFoundResult();
        }

        throw error;
      }
    },

    async getRankingSetById(id: string): Promise<RankingSet | null> {
      const record = await db.rankingSet.findUnique({
        where: { id },
        include: fullRecordInclude,
      });

      return record ? mapRecordToRankingSet(record) : null;
    },

    async listRankingSetSummaries(): Promise<RankingSetSummary[]> {
      const records = await db.rankingSet.findMany({
        select: summarySelect,
        orderBy: summaryOrder,
      });

      return records.map(mapRecordToSummary);
    },
  };
}

export async function createRankingSet(
  rankingSet: RankingSet,
): Promise<CreateRankingSetResult> {
  return createRankingSetRepository(
    getPrismaClient() as unknown as RankingSetRepositoryDb,
  ).createRankingSet(rankingSet);
}

export async function getRankingSetById(
  id: string,
): Promise<RankingSet | null> {
  return createRankingSetRepository(
    getPrismaClient() as unknown as RankingSetRepositoryDb,
  ).getRankingSetById(id);
}

export async function replaceRankingSet(
  rankingSet: RankingSet,
): Promise<ReplaceRankingSetResult> {
  return createRankingSetRepository(
    getPrismaClient() as unknown as RankingSetRepositoryDb,
  ).replaceRankingSet(rankingSet);
}

export async function deleteRankingSetById(
  id: string,
): Promise<DeleteRankingSetResult> {
  return createRankingSetRepository(
    getPrismaClient() as unknown as RankingSetRepositoryDb,
  ).deleteRankingSetById(id);
}

export async function listRankingSetSummaries(): Promise<RankingSetSummary[]> {
  return createRankingSetRepository(
    getPrismaClient() as unknown as RankingSetRepositoryDb,
  ).listRankingSetSummaries();
}

function mapRankingSetToCreateData(rankingSet: RankingSet): RankingSetCreateData {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    normalizedName: normalizeName(rankingSet.name),
    sourceKind: mapSourceKindToPersisted(rankingSet.source.kind),
    ...(rankingSet.source.formatId === undefined
      ? {}
      : { sourceFormatId: rankingSet.source.formatId }),
    ...(rankingSet.source.formatVersion === undefined
      ? {}
      : { sourceFormatVersion: rankingSet.source.formatVersion }),
    ...(rankingSet.source.label === undefined
      ? {}
      : { sourceLabel: rankingSet.source.label }),
    ...(rankingSet.source.importedAt === undefined
      ? {}
      : { sourceImportedAt: cloneDate(rankingSet.source.importedAt) }),
    teamCapability: mapAvailabilityToPersisted(rankingSet.capabilities.team),
    playerIdentityCapability: mapIdentityToPersisted(
      rankingSet.capabilities.playerIdentity,
    ),
    overallOrderCapability: mapOrderToPersisted(
      rankingSet.capabilities.overallOrder,
    ),
    adpCapability: mapAvailabilityToPersisted(rankingSet.capabilities.adp),
    tierCapabilities: mapTierCapabilitiesToJson(rankingSet.capabilities.tiers),
    ...(rankingSet.tierSemantics === undefined
      ? {}
      : { tierSemantics: copyTierSemantics(rankingSet.tierSemantics) }),
    entries: {
      create: rankingSet.entries.map((entry) => ({
        playerId: entry.player.id,
        playerName: entry.player.name,
        team: entry.player.team,
        position: mapPositionToPersisted(entry.player.position),
        overallRank: entry.overallRank,
        positionRank: entry.positionRank,
        tier: entry.tier,
        adpRank: entry.adpRank,
      })),
    },
    createdAt: cloneDate(rankingSet.createdAt),
    updatedAt: cloneDate(rankingSet.updatedAt),
  };
}

function mapRankingSetToUpdateData(rankingSet: RankingSet): RankingSetUpdateData {
  return {
    name: rankingSet.name,
    normalizedName: normalizeName(rankingSet.name),
    sourceKind: mapSourceKindToPersisted(rankingSet.source.kind),
    sourceFormatId: rankingSet.source.formatId ?? null,
    sourceFormatVersion: rankingSet.source.formatVersion ?? null,
    sourceLabel: rankingSet.source.label ?? null,
    sourceImportedAt:
      rankingSet.source.importedAt === undefined
        ? null
        : cloneDate(rankingSet.source.importedAt),
    teamCapability: mapAvailabilityToPersisted(rankingSet.capabilities.team),
    playerIdentityCapability: mapIdentityToPersisted(
      rankingSet.capabilities.playerIdentity,
    ),
    overallOrderCapability: mapOrderToPersisted(
      rankingSet.capabilities.overallOrder,
    ),
    adpCapability: mapAvailabilityToPersisted(rankingSet.capabilities.adp),
    tierCapabilities: mapTierCapabilitiesToJson(rankingSet.capabilities.tiers),
    tierSemantics:
      rankingSet.tierSemantics === undefined
        ? Prisma.DbNull
        : copyTierSemantics(rankingSet.tierSemantics),
    entries: {
      deleteMany: {},
      create: rankingSet.entries.map(mapEntryToCreateData),
    },
    createdAt: cloneDate(rankingSet.createdAt),
    updatedAt: cloneDate(rankingSet.updatedAt),
  };
}

function mapEntryToCreateData(entry: RankingEntry): RankingSetEntryCreateData {
  return {
    playerId: entry.player.id,
    playerName: entry.player.name,
    team: entry.player.team,
    position: mapPositionToPersisted(entry.player.position),
    overallRank: entry.overallRank,
    positionRank: entry.positionRank,
    tier: entry.tier,
    adpRank: entry.adpRank,
  };
}

function mapRecordToRankingSet(record: PersistedRankingSetRecord): RankingSet {
  const mappedEntries = [...record.entries]
    .sort((left, right) => left.overallRank - right.overallRank)
    .map(mapRecordToEntry);
  const mappedCapabilities = mapRecordToCapabilities(record);
  const tierState =
    record.tierSemantics === null
      ? mapLegacyTierState(mappedEntries, mappedCapabilities)
      : {
          capabilities: mappedCapabilities,
          entries: mappedEntries,
          tierSemantics: structuredClone(
            record.tierSemantics,
          ) as RankingTierSemantics,
        };
  const rankingSet: RankingSet = {
    id: record.id,
    name: record.name,
    source: mapRecordToSource(record),
    capabilities: tierState.capabilities,
    tierSemantics: tierState.tierSemantics,
    entries: tierState.entries,
    createdAt: parseDate(record.createdAt, "createdAt"),
    updatedAt: parseDate(record.updatedAt, "updatedAt"),
  };
  const validation = validateRankingSet(rankingSet);

  if (!validation.ok) {
    const firstError = validation.errors[0];
    throw new RankingSetRepositoryMappingError(
      firstError.path,
      firstError.message,
    );
  }

  return validation.rankingSet;
}

function mapLegacyTierState(
  entries: readonly RankingEntry[],
  capabilities: RankingSetCapabilities,
): Readonly<{
  capabilities: RankingSetCapabilities;
  entries: readonly RankingEntry[];
  tierSemantics: RankingTierSemantics;
}> {
  const tiers: Partial<Record<Position, "defaulted-neutral">> = {};
  const recommendation: Partial<Record<Position, "neutral">> = {};

  entries.forEach((entry) => {
    tiers[entry.player.position] = "defaulted-neutral";
    recommendation[entry.player.position] = "neutral";
  });

  return {
    capabilities: {
      ...capabilities,
      tiers,
    },
    entries: entries.map((entry) => ({
      ...entry,
      player: { ...entry.player },
      tier: NEUTRAL_TIER,
    })),
    tierSemantics: {
      source: {
        kind: "legacy-ambiguous",
        values: entries.map((entry) => ({
          playerId: entry.player.id,
          overallRank: entry.overallRank,
          tier: entry.tier,
        })),
      },
      recommendation,
    },
  };
}

function mapRecordToSource(record: PersistedRankingSetRecord): RankingSetSource {
  return {
    kind: mapPersistedSourceKind(record.sourceKind),
    ...(record.sourceFormatId === null
      ? {}
      : { formatId: record.sourceFormatId }),
    ...(record.sourceFormatVersion === null
      ? {}
      : { formatVersion: record.sourceFormatVersion }),
    ...(record.sourceLabel === null ? {} : { label: record.sourceLabel }),
    ...(record.sourceImportedAt === null
      ? {}
      : {
          importedAt: parseDate(
            record.sourceImportedAt,
            "source.importedAt",
          ),
        }),
  };
}

function mapRecordToCapabilities(
  record: Pick<
    PersistedRankingSetRecord,
    | "teamCapability"
    | "playerIdentityCapability"
    | "overallOrderCapability"
    | "adpCapability"
    | "tierCapabilities"
  >,
): RankingSetCapabilities {
  return {
    team: mapPersistedAvailability(record.teamCapability),
    playerIdentity: mapPersistedIdentity(record.playerIdentityCapability),
    overallOrder: mapPersistedOrder(record.overallOrderCapability),
    positionRank: "derived",
    adp: mapPersistedAvailability(record.adpCapability),
    tiers: parseTierCapabilities(record.tierCapabilities),
  };
}

function mapRecordToEntry(record: PersistedRankingSetEntryRecord): RankingEntry {
  return {
    player: {
      id: record.playerId,
      name: record.playerName,
      team: record.team,
      position: mapPersistedPosition(record.position),
    },
    overallRank: record.overallRank,
    positionRank: record.positionRank,
    tier: record.tier,
    adpRank: record.adpRank,
  };
}

function mapRecordToSummary(
  record: PersistedRankingSetSummaryRecord,
): RankingSetSummary {
  if (!Number.isInteger(record._count.entries) || record._count.entries < 0) {
    throw new RankingSetRepositoryMappingError(
      "entryCount",
      "Entry count must be a non-negative integer.",
    );
  }

  return {
    id: record.id,
    name: record.name,
    sourceKind: mapPersistedSourceKind(record.sourceKind),
    entryCount: record._count.entries,
    capabilities: mapRecordToCapabilities(record),
    createdAt: parseDate(record.createdAt, "createdAt"),
    updatedAt: parseDate(record.updatedAt, "updatedAt"),
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

function mapSourceKindToPersisted(value: RankingSetSourceKind): PersistedSourceKind {
  const values: Record<RankingSetSourceKind, PersistedSourceKind> = {
    seed: "SEED",
    external: "EXTERNAL",
    canonical: "CANONICAL",
    manual: "MANUAL",
  };
  return values[value];
}

function mapPersistedSourceKind(value: PersistedSourceKind): RankingSetSourceKind {
  switch (value) {
    case "SEED":
      return "seed";
    case "EXTERNAL":
      return "external";
    case "CANONICAL":
      return "canonical";
    case "MANUAL":
      return "manual";
    default:
      throw new RankingSetRepositoryMappingError(
        "source.kind",
        `Unsupported source kind ${String(value)}.`,
      );
  }
}

function mapAvailabilityToPersisted(
  value: RankingDataAvailability,
): PersistedAvailability {
  const values: Record<RankingDataAvailability, PersistedAvailability> = {
    complete: "COMPLETE",
    partial: "PARTIAL",
    none: "NONE",
  };
  return values[value];
}

function mapPersistedAvailability(
  value: PersistedAvailability,
): RankingDataAvailability {
  switch (value) {
    case "COMPLETE":
      return "complete";
    case "PARTIAL":
      return "partial";
    case "NONE":
      return "none";
    default:
      throw new RankingSetRepositoryMappingError(
        "capabilities",
        `Unsupported availability ${String(value)}.`,
      );
  }
}

function mapIdentityToPersisted(
  value: RankingPlayerIdentityCapability,
): PersistedIdentityCapability {
  const values: Record<
    RankingPlayerIdentityCapability,
    PersistedIdentityCapability
  > = {
    provided: "PROVIDED",
    generated: "GENERATED",
    mixed: "MIXED",
  };
  return values[value];
}

function mapPersistedIdentity(
  value: PersistedIdentityCapability,
): RankingPlayerIdentityCapability {
  switch (value) {
    case "PROVIDED":
      return "provided";
    case "GENERATED":
      return "generated";
    case "MIXED":
      return "mixed";
    default:
      throw new RankingSetRepositoryMappingError(
        "capabilities.playerIdentity",
        `Unsupported identity capability ${String(value)}.`,
      );
  }
}

function mapOrderToPersisted(
  value: RankingOverallOrderCapability,
): PersistedOrderCapability {
  return value === "explicit" ? "EXPLICIT" : "ROW_DERIVED";
}

function mapPersistedOrder(
  value: PersistedOrderCapability,
): RankingOverallOrderCapability {
  switch (value) {
    case "EXPLICIT":
      return "explicit";
    case "ROW_DERIVED":
      return "row-derived";
    default:
      throw new RankingSetRepositoryMappingError(
        "capabilities.overallOrder",
        `Unsupported order capability ${String(value)}.`,
      );
  }
}

function mapPositionToPersisted(value: Position): PersistedPosition {
  return value;
}

function mapPersistedPosition(value: PersistedPosition): Position {
  if (POSITIONS.includes(value as Position)) {
    return value as Position;
  }

  throw new RankingSetRepositoryMappingError(
    "entries.player.position",
    `Unsupported position ${String(value)}.`,
  );
}

function mapTierCapabilitiesToJson(
  tiers: RankingSetCapabilities["tiers"],
): Record<string, RankingTierCapability> {
  return Object.fromEntries(
    POSITIONS.flatMap((position) => {
      const capability = tiers[position];
      return capability === undefined ? [] : [[position, capability]];
    }),
  );
}

function copyTierSemantics(value: RankingTierSemantics): RankingTierSemantics {
  return structuredClone(value);
}

function parseTierCapabilities(
  value: unknown,
): RankingSetCapabilities["tiers"] {
  const record = asRecord(value);

  if (!record) {
    throw new RankingSetRepositoryMappingError(
      "capabilities.tiers",
      "Tier capabilities must be an object.",
    );
  }

  const result: Partial<Record<Position, RankingTierCapability>> = {};

  Object.keys(record).forEach((key) => {
    if (!POSITIONS.includes(key as Position)) {
      throw new RankingSetRepositoryMappingError(
        `capabilities.tiers.${key}`,
        `Unsupported tier capability position ${key}.`,
      );
    }

    const capability = record[key];

    if (capability !== "source" && capability !== "defaulted-neutral") {
      throw new RankingSetRepositoryMappingError(
        `capabilities.tiers.${key}`,
        `Unsupported tier capability ${String(capability)}.`,
      );
    }

    result[key as Position] = capability;
  });

  return result;
}

function parseDate(value: unknown, path: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RankingSetRepositoryMappingError(path, "Value must be a valid Date.");
  }

  return cloneDate(value);
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function isNormalizedNameConflict(error: unknown): boolean {
  const record = asRecord(error);

  if (record?.code !== "P2002") {
    return false;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const meta = asRecord(record?.meta);
  const target = meta?.target;

  if (typeof target === "string") {
    return target.includes("normalizedName");
  }

  if (Array.isArray(target) && target.length > 0) {
    return target.some(
      (field) => field === "normalizedName",
    );
  }

  // Prisma's PostgreSQL driver adapter can omit meta.target from P2002 errors,
  // while retaining the conflicting field in the generated error message.
  return message.includes("normalizedName");
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return asRecord(error)?.code === code;
}

function notFoundResult() {
  return {
    ok: false,
    errors: [
      {
        code: "not-found",
        message: "Ranking set was not found.",
        path: "id",
      },
    ],
  } as const;
}

async function runRepositoryTransaction<T>(
  db: RankingSetRepositoryDb,
  callback: (tx: RankingSetRepositoryTransactionDb) => Promise<T>,
): Promise<T> {
  return db.$transaction ? db.$transaction(callback) : callback(db);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
