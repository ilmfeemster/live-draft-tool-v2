import type { Position, RankingEntry } from "@/types/draft";
import { validateRankingSet } from "@/lib/rankingSetValidation";
import type {
  RankingSet,
  RankingSetCapabilities,
  RankingSnapshot,
} from "@/types/rankings";

export type RankingSnapshotJson = RankingSnapshotJsonValue[];

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

type RankingSnapshotJsonValue =
  | string
  | number
  | boolean
  | null
  | RankingSnapshotJsonValue[]
  | { [key: string]: RankingSnapshotJsonValue };

const validPositions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

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
    snapshot: {
      rankings: copyRankingEntries(validation.rankingSet.entries),
      capabilities: copyRankingSetCapabilities(validation.rankingSet.capabilities),
      sourceRankingSetId: validation.rankingSet.id,
      sourceRankingSetName: validation.rankingSet.name,
      capturedAt: copyDate(options.capturedAt ?? new Date()),
    },
  };
}

export function serializeRankingSnapshot(
  rankings: readonly RankingEntry[],
): RankingSnapshotJson {
  return copyRankingEntries(rankings);
}

export function parseRankingSnapshotJson(snapshot: unknown): RankingEntry[] {
  if (!Array.isArray(snapshot)) {
    throw new Error("Ranking snapshot must be an array.");
  }

  return snapshot.map((entry, index) => parseRankingEntry(entry, index));
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
