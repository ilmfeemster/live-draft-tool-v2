import { seedRankings } from "@/data/seedRankings";
import {
  createRankingSet,
  getRankingSetById,
  replaceRankingSet,
  type CreateRankingSetError,
  type CreateRankingSetResult,
  type ReplaceRankingSetError,
  type ReplaceRankingSetResult,
} from "@/lib/rankingSetRepository";
import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position, RankingEntry } from "@/types/draft";
import { UNKNOWN_TEAM, type RankingSet } from "@/types/rankings";

export const MANAGED_SEED_RANKING_SET_ID = "seed-rankings-2026-fantasypros";
export const MANAGED_SEED_RANKING_SET_NAME =
  "FantasyPros 2026 Seed Rankings";
const MANAGED_SEED_SOURCE_LABEL = "FantasyPros_2026_Draft_ALL_Rankings.csv";
const MANAGED_SEED_SOURCE_FORMAT_ID = "fantasypros-csv";
const MANAGED_SEED_SOURCE_FORMAT_VERSION = 1;

export type BootstrapManagedSeedRankingSetError = Readonly<{
  code:
    | "invalid-seed-ranking-set"
    | "name-conflict"
    | "not-found"
    | "repository-rejected";
  message: string;
  path?: string;
}>;

export type BootstrapManagedSeedRankingSetResult =
  | Readonly<{
      ok: true;
      rankingSet: RankingSet;
      created: boolean;
      replaced: boolean;
    }>
  | Readonly<{
      ok: false;
      errors: readonly BootstrapManagedSeedRankingSetError[];
    }>;

export type ManagedSeedRankingSetRepository = Readonly<{
  createRankingSet(rankingSet: RankingSet): Promise<CreateRankingSetResult>;
  replaceRankingSet(rankingSet: RankingSet): Promise<ReplaceRankingSetResult>;
  getRankingSetById(id: string): Promise<RankingSet | null>;
}>;

const defaultRepository: ManagedSeedRankingSetRepository = {
  createRankingSet,
  replaceRankingSet,
  getRankingSetById,
};

export function buildManagedSeedRankingSet(
  timestamp = new Date(),
): RankingSet {
  if (!isValidDate(timestamp)) {
    throw new Error("Managed seed ranking set timestamp must be a valid Date.");
  }

  const importedAt = cloneDate(timestamp);
  const createdAt = cloneDate(timestamp);
  const updatedAt = cloneDate(timestamp);
  const entries = seedRankings.map(cloneEntry);
  const rankingSet: RankingSet = {
    id: MANAGED_SEED_RANKING_SET_ID,
    name: MANAGED_SEED_RANKING_SET_NAME,
    source: {
      kind: "seed",
      formatId: MANAGED_SEED_SOURCE_FORMAT_ID,
      formatVersion: MANAGED_SEED_SOURCE_FORMAT_VERSION,
      label: MANAGED_SEED_SOURCE_LABEL,
      importedAt,
    },
    capabilities: {
      team: deriveTeamCapability(entries),
      playerIdentity: "provided",
      overallOrder: "explicit",
      positionRank: "derived",
      adp: deriveAdpCapability(entries),
      tiers: deriveTierCapabilities(entries),
    },
    entries,
    createdAt,
    updatedAt,
  };
  const validation = validateRankingSet(rankingSet);

  if (!validation.ok) {
    throw new ManagedSeedRankingSetValidationError(
      validation.errors.map((error) => ({
        code: "invalid-seed-ranking-set",
        message: error.message,
        path: error.path,
      })),
    );
  }

  return validation.rankingSet;
}

export async function bootstrapManagedSeedRankingSet(
  repository = defaultRepository,
  timestamp = new Date(),
): Promise<BootstrapManagedSeedRankingSetResult> {
  let expectedRankingSet: RankingSet;

  try {
    expectedRankingSet = buildManagedSeedRankingSet(timestamp);
  } catch (error) {
    if (error instanceof ManagedSeedRankingSetValidationError) {
      return { ok: false, errors: error.errors };
    }

    if (error instanceof Error) {
      return {
        ok: false,
        errors: [
          {
            code: "invalid-seed-ranking-set",
            message: error.message,
          },
        ],
      };
    }

    throw error;
  }

  const existing = await repository.getRankingSetById(
    MANAGED_SEED_RANKING_SET_ID,
  );

  if (!existing) {
    return mapCreateResult(
      await repository.createRankingSet(expectedRankingSet),
    );
  }

  if (areRankingSetsEquivalent(existing, expectedRankingSet)) {
    return {
      ok: true,
      rankingSet: existing,
      created: false,
      replaced: false,
    };
  }

  return mapReplaceResult(
    await repository.replaceRankingSet(expectedRankingSet),
  );
}

export async function getManagedSeedRankingSet(
  repository: Pick<ManagedSeedRankingSetRepository, "getRankingSetById"> =
    defaultRepository,
): Promise<RankingSet | null> {
  return repository.getRankingSetById(MANAGED_SEED_RANKING_SET_ID);
}

class ManagedSeedRankingSetValidationError extends Error {
  readonly errors: readonly BootstrapManagedSeedRankingSetError[];

  constructor(errors: readonly BootstrapManagedSeedRankingSetError[]) {
    super("Managed seed ranking set is invalid.");
    this.name = "ManagedSeedRankingSetValidationError";
    this.errors = errors;
  }
}

function mapCreateResult(
  result: CreateRankingSetResult,
): BootstrapManagedSeedRankingSetResult {
  if (result.ok) {
    return {
      ok: true,
      rankingSet: result.rankingSet,
      created: true,
      replaced: false,
    };
  }

  return { ok: false, errors: result.errors.map(mapRepositoryError) };
}

function mapReplaceResult(
  result: ReplaceRankingSetResult,
): BootstrapManagedSeedRankingSetResult {
  if (result.ok) {
    return {
      ok: true,
      rankingSet: result.rankingSet,
      created: false,
      replaced: true,
    };
  }

  return { ok: false, errors: result.errors.map(mapRepositoryError) };
}

function mapRepositoryError(
  error: CreateRankingSetError | ReplaceRankingSetError,
): BootstrapManagedSeedRankingSetError {
  switch (error.code) {
    case "invalid-ranking-set":
      return {
        code: "invalid-seed-ranking-set",
        message: error.message,
        path: error.path,
      };
    case "name-conflict":
      return {
        code: "name-conflict",
        message: error.message,
        path: error.path,
      };
    case "not-found":
      return {
        code: "not-found",
        message: error.message,
        path: error.path,
      };
    default:
      return mapUnexpectedRepositoryError(error);
  }
}

function mapUnexpectedRepositoryError(
  error: { message: string; path?: string },
): BootstrapManagedSeedRankingSetError {
      return {
        code: "repository-rejected",
        message: error.message,
        path: error.path,
      };
}

function areRankingSetsEquivalent(left: RankingSet, right: RankingSet): boolean {
  return JSON.stringify(toComparableRankingSet(left)) ===
    JSON.stringify(toComparableRankingSet(right));
}

function toComparableRankingSet(rankingSet: RankingSet) {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    source: {
      ...rankingSet.source,
      importedAt: rankingSet.source.importedAt?.toISOString(),
    },
    capabilities: rankingSet.capabilities,
    entries: rankingSet.entries,
    createdAt: rankingSet.createdAt.toISOString(),
    updatedAt: rankingSet.updatedAt.toISOString(),
  };
}

function deriveTeamCapability(entries: readonly RankingEntry[]) {
  const suppliedCount = entries.filter((entry) => {
    return entry.player.team.trim().length > 0 && entry.player.team !== UNKNOWN_TEAM;
  }).length;

  if (suppliedCount === 0) {
    return "none";
  }

  return suppliedCount === entries.length ? "complete" : "partial";
}

function deriveAdpCapability(entries: readonly RankingEntry[]) {
  const suppliedCount = entries.filter((entry) => entry.adpRank !== null).length;

  if (suppliedCount === 0) {
    return "none";
  }

  return suppliedCount === entries.length ? "complete" : "partial";
}

function deriveTierCapabilities(
  entries: readonly RankingEntry[],
): Partial<Record<Position, "source">> {
  const positions = new Set<Position>();

  entries.forEach((entry) => {
    positions.add(entry.player.position);
  });

  return Object.fromEntries(
    [...positions].sort().map((position) => [position, "source"]),
  ) as Partial<Record<Position, "source">>;
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

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}
