import type { Position, RankingEntry } from "@/types/draft";

export type RankingSnapshotJson = RankingSnapshotJsonValue[];

type RankingSnapshotJsonValue =
  | string
  | number
  | boolean
  | null
  | RankingSnapshotJsonValue[]
  | { [key: string]: RankingSnapshotJsonValue };

const validPositions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function serializeRankingSnapshot(
  rankings: RankingEntry[],
): RankingSnapshotJson {
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
