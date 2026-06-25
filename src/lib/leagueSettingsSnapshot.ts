import type { LeagueSettings, Position, RosterSlot } from "@/types/draft";

export type LeagueSettingsSnapshotJson = LeagueSettingsSnapshotJsonValue;

type LeagueSettingsSnapshotJsonValue =
  | string
  | number
  | boolean
  | null
  | LeagueSettingsSnapshotJsonValue[]
  | { [key: string]: LeagueSettingsSnapshotJsonValue };

const validPositions: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function serializeLeagueSettingsSnapshot(
  leagueSettings: LeagueSettings,
): LeagueSettingsSnapshotJson {
  return {
    teamCount: leagueSettings.teamCount,
    rounds: leagueSettings.rounds,
    draftType: leagueSettings.draftType,
    scoringFormat: leagueSettings.scoringFormat,
    rosterSlots: leagueSettings.rosterSlots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      eligiblePositions: [...slot.eligiblePositions],
    })),
  };
}

export function parseLeagueSettingsSnapshotJson(
  snapshot: unknown,
): LeagueSettings {
  const record = expectRecord(snapshot, "League settings snapshot");

  return {
    teamCount: expectPositiveInteger(record.teamCount, "leagueSettings.teamCount"),
    rounds: expectPositiveInteger(record.rounds, "leagueSettings.rounds"),
    draftType: expectDraftType(record.draftType, "leagueSettings.draftType"),
    scoringFormat: expectScoringFormat(
      record.scoringFormat,
      "leagueSettings.scoringFormat",
    ),
    rosterSlots: expectRosterSlots(record.rosterSlots, "leagueSettings.rosterSlots"),
  };
}

function expectRosterSlots(value: unknown, path: string): RosterSlot[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value.map((slot, index) => {
    const slotPath = `${path}[${index}]`;
    const record = expectRecord(slot, slotPath);

    return {
      id: expectString(record.id, `${slotPath}.id`),
      label: expectString(record.label, `${slotPath}.label`),
      eligiblePositions: expectEligiblePositions(
        record.eligiblePositions,
        `${slotPath}.eligiblePositions`,
      ),
    };
  });
}

function expectEligiblePositions(value: unknown, path: string): Position[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array.`);
  }

  return value.map((position, index) => {
    return expectPosition(position, `${path}[${index}]`);
  });
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

function expectPositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) {
    throw new Error(`${path} must be a positive integer.`);
  }

  return value;
}

function expectDraftType(value: unknown, path: string): LeagueSettings["draftType"] {
  if (value !== "SNAKE") {
    throw new Error(`${path} must be SNAKE.`);
  }

  return value;
}

function expectScoringFormat(
  value: unknown,
  path: string,
): LeagueSettings["scoringFormat"] {
  if (value !== "PPR") {
    throw new Error(`${path} must be PPR.`);
  }

  return value;
}

function expectPosition(value: unknown, path: string): Position {
  if (!validPositions.includes(value as Position)) {
    throw new Error(`${path} must be a valid position.`);
  }

  return value as Position;
}
