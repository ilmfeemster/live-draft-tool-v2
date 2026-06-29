import { validateRankingSet } from "@/lib/rankingSetValidation";
import type { Position } from "@/types/draft";
import {
  UNKNOWN_TEAM,
  type RankingDataAvailability,
  type RankingSet,
  type RankingSetCapabilities,
  type RankingSetSource,
} from "@/types/rankings";

export type RenameRankingSetIntent = Readonly<{
  type: "rename";
  name: string;
}>;

export type CorrectRankingPlayerIntent = Readonly<{
  type: "correct-player";
  playerId: string;
  changes: Readonly<{
    id?: string;
    name?: string;
    team?: string;
    position?: Position;
    adpRank?: number | null;
    tier?: number;
  }>;
}>;

export type ReorderRankingPlayerIntent = Readonly<{
  type: "reorder-player";
  playerId: string;
  toOverallRank: number;
}>;

export type AssignPositionTiersIntent = Readonly<{
  type: "assign-position-tiers";
  position: Position;
  assignments: readonly Readonly<{
    playerId: string;
    tier: number;
  }>[];
}>;

export type UpdateRankingTierIntent = Readonly<{
  type: "update-tier";
  playerId: string;
  tier: number;
}>;

export type RankingSetEditIntent =
  | RenameRankingSetIntent
  | CorrectRankingPlayerIntent
  | ReorderRankingPlayerIntent
  | AssignPositionTiersIntent
  | UpdateRankingTierIntent;

export type RankingSetEditRequest = Readonly<{
  updatedAt: Date;
  intent: RankingSetEditIntent;
}>;

export type RankingSetEditErrorCode =
  | "invalid-ranking-set"
  | "invalid-update-date"
  | "invalid-lifecycle-order"
  | "invalid-intent"
  | "player-not-found"
  | "invalid-player-correction"
  | "invalid-reorder"
  | "invalid-tier-assignment"
  | "invalid-tier-update"
  | "edit-invariant-failed";

export type RankingSetEditError = Readonly<{
  code: RankingSetEditErrorCode;
  message: string;
  path?: string;
}>;

export type RankingSetEditResult =
  | Readonly<{ ok: true; rankingSet: RankingSet }>
  | Readonly<{ ok: false; errors: readonly RankingSetEditError[] }>;

type UnknownRecord = Record<string, unknown>;
type MutablePlayer = {
  id: string;
  name: string;
  team: string;
  position: Position;
};
type MutableEntry = {
  player: MutablePlayer;
  overallRank: number;
  adpRank: number | null;
  positionRank: number;
  tier: number;
};
type MutableCapabilities = {
  team: RankingSetCapabilities["team"];
  playerIdentity: RankingSetCapabilities["playerIdentity"];
  overallOrder: RankingSetCapabilities["overallOrder"];
  positionRank: RankingSetCapabilities["positionRank"];
  adp: RankingSetCapabilities["adp"];
  tiers: Partial<Record<Position, "source" | "defaulted-neutral">>;
};
type MutableRankingSet = {
  id: string;
  name: string;
  source: RankingSetSource;
  capabilities: MutableCapabilities;
  entries: MutableEntry[];
  createdAt: Date;
  updatedAt: Date;
};

const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const CORRECTION_KEYS = [
  "id",
  "name",
  "team",
  "position",
  "adpRank",
  "tier",
] as const;

export function editRankingSet(
  rankingSet: RankingSet,
  request: RankingSetEditRequest,
): RankingSetEditResult {
  const sourceValidation = validateRankingSet(rankingSet);

  if (!sourceValidation.ok) {
    return failure(
      sourceValidation.errors.map((domainError) => ({
        code: "invalid-ranking-set",
        message: domainError.message,
        path: domainError.path,
      })),
    );
  }

  const requestRecord = asRecord(request);

  if (!isValidDate(requestRecord?.updatedAt)) {
    return failure([
      {
        code: "invalid-update-date",
        message: "Ranking set edit updatedAt must be a valid Date.",
        path: "updatedAt",
      },
    ]);
  }

  if (requestRecord.updatedAt.getTime() < rankingSet.updatedAt.getTime()) {
    return failure([
      {
        code: "invalid-lifecycle-order",
        message: "Ranking set edit updatedAt must not be earlier than the current updatedAt.",
        path: "updatedAt",
      },
    ]);
  }

  const intent = asRecord(requestRecord.intent);

  if (!intent || !isIntentType(intent.type)) {
    return failure([
      {
        code: "invalid-intent",
        message: "Ranking set edit intent is unsupported.",
        path: "intent.type",
      },
    ]);
  }

  const proposal = cloneRankingSet(rankingSet, requestRecord.updatedAt);
  const intentErrors = applyIntent(proposal, intent);

  if (intentErrors.length > 0) {
    return failure(intentErrors);
  }

  const proposalValidation = validateRankingSet(proposal);

  if (!proposalValidation.ok) {
    return failure(
      proposalValidation.errors.map((domainError) => ({
        code: "edit-invariant-failed",
        message: domainError.message,
        path: domainError.path,
      })),
    );
  }

  return { ok: true, rankingSet: proposalValidation.rankingSet };
}

function applyIntent(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  switch (intent.type) {
    case "rename":
      return applyRename(proposal, intent);
    case "correct-player":
      return applyPlayerCorrection(proposal, intent);
    case "reorder-player":
      return applyReorder(proposal, intent);
    case "assign-position-tiers":
      return applyTierAssignment(proposal, intent);
    case "update-tier":
      return applyTierUpdate(proposal, intent);
    default:
      return [
        {
          code: "invalid-intent",
          message: "Ranking set edit intent is unsupported.",
          path: "intent.type",
        },
      ];
  }
}

function applyRename(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  if (!isNonEmptyString(intent.name)) {
    return [
      {
        code: "invalid-intent",
        message: "Ranking set rename requires a non-empty name.",
        path: "intent.name",
      },
    ];
  }

  proposal.name = intent.name;
  return [];
}

function applyPlayerCorrection(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  if (!isNonEmptyString(intent.playerId)) {
    return [
      {
        code: "invalid-player-correction",
        message: "Player correction requires a non-empty target player ID.",
        path: "intent.playerId",
      },
    ];
  }

  const changes = asRecord(intent.changes);

  if (!changes) {
    return [
      {
        code: "invalid-player-correction",
        message: "Player correction changes must be an object.",
        path: "intent.changes",
      },
    ];
  }

  const changeKeys = Object.keys(changes);
  const unknownKeys = changeKeys.filter(
    (key) => !CORRECTION_KEYS.includes(key as (typeof CORRECTION_KEYS)[number]),
  );

  if (changeKeys.length === 0 || unknownKeys.length > 0) {
    return [
      {
        code: "invalid-player-correction",
        message:
          changeKeys.length === 0
            ? "Player correction requires at least one change."
            : `Player correction field ${unknownKeys.sort()[0]} is unsupported.`,
        path: "intent.changes",
      },
    ];
  }

  const targetIndex = proposal.entries.findIndex(
    (entry) => entry.player.id === intent.playerId,
  );

  if (targetIndex < 0) {
    return [playerNotFound(intent.playerId)];
  }

  const target = proposal.entries[targetIndex];
  const positionSupplied = hasOwn(changes, "position");
  const positionChanges =
    positionSupplied && changes.position !== target.player.position;

  if (hasOwn(changes, "tier") && !positionChanges) {
    return [
      {
        code: "invalid-player-correction",
        message: "Player correction tier is allowed only with a position change.",
        path: "intent.changes.tier",
      },
    ];
  }

  const priorPosition = target.player.position;
  const representedBefore = new Set(
    proposal.entries.map((entry) => entry.player.position),
  );
  const oldId = target.player.id;

  if (hasOwn(changes, "id")) {
    target.player.id = changes.id as string;
  }
  if (hasOwn(changes, "name")) {
    target.player.name = changes.name as string;
  }
  if (hasOwn(changes, "team")) {
    target.player.team = changes.team as string;
  }
  if (positionSupplied) {
    target.player.position = changes.position as Position;
  }
  if (hasOwn(changes, "adpRank")) {
    target.adpRank = changes.adpRank as number | null;
  }
  if (hasOwn(changes, "tier")) {
    target.tier = changes.tier as number;
  }

  if (positionChanges) {
    if (
      isPosition(target.player.position) &&
      !representedBefore.has(target.player.position)
    ) {
      proposal.capabilities.tiers[target.player.position] = "source";
    }

    if (
      isPosition(priorPosition) &&
      !proposal.entries.some((entry) => entry.player.position === priorPosition)
    ) {
      delete proposal.capabilities.tiers[priorPosition];
    }

    deriveCanonicalRanks(proposal.entries);
  }

  proposal.capabilities.team = deriveAvailability(
    proposal.entries.map((entry) => entry.player.team !== UNKNOWN_TEAM),
  );
  proposal.capabilities.adp = deriveAvailability(
    proposal.entries.map((entry) => entry.adpRank !== null),
  );

  if (target.player.id !== oldId) {
    proposal.capabilities.playerIdentity = correctedIdentityCapability(
      proposal.capabilities.playerIdentity,
      proposal.entries.length,
    );
  }

  proposal.capabilities.positionRank = "derived";
  reconcileTierCapabilityKeys(proposal);
  return [];
}

function applyReorder(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  if (!isNonEmptyString(intent.playerId)) {
    return [
      {
        code: "invalid-reorder",
        message: "Ranking reorder requires a non-empty player ID.",
        path: "intent.playerId",
      },
    ];
  }

  if (
    !Number.isInteger(intent.toOverallRank) ||
    (intent.toOverallRank as number) < 1 ||
    (intent.toOverallRank as number) > proposal.entries.length
  ) {
    return [
      {
        code: "invalid-reorder",
        message: `Ranking reorder target must be from 1 through ${proposal.entries.length}.`,
        path: "intent.toOverallRank",
      },
    ];
  }

  const currentIndex = proposal.entries.findIndex(
    (entry) => entry.player.id === intent.playerId,
  );

  if (currentIndex < 0) {
    return [playerNotFound(intent.playerId)];
  }

  const [entry] = proposal.entries.splice(currentIndex, 1);
  proposal.entries.splice((intent.toOverallRank as number) - 1, 0, entry);
  deriveCanonicalRanks(proposal.entries);
  proposal.capabilities.overallOrder = "explicit";
  proposal.capabilities.positionRank = "derived";
  return [];
}

function applyTierAssignment(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  if (!isPosition(intent.position)) {
    return [
      {
        code: "invalid-tier-assignment",
        message: "Tier assignment requires a supported position.",
        path: "intent.position",
      },
    ];
  }

  const positionEntries = proposal.entries.filter(
    (entry) => entry.player.position === intent.position,
  );

  if (positionEntries.length === 0) {
    return [
      {
        code: "invalid-tier-assignment",
        message: `Tier assignment position ${intent.position} is not represented.`,
        path: "intent.position",
      },
    ];
  }

  if (!Array.isArray(intent.assignments)) {
    return [
      {
        code: "invalid-tier-assignment",
        message: "Tier assignments must be an array.",
        path: "intent.assignments",
      },
    ];
  }

  const expectedIds = new Set(
    positionEntries.map((entry) => entry.player.id),
  );
  const assignments = new Map<string, number>();
  const errors: RankingSetEditError[] = [];

  intent.assignments.forEach((value, index) => {
    const assignment = asRecord(value);
    const path = `intent.assignments[${index}]`;

    if (!assignment || !isNonEmptyString(assignment.playerId)) {
      errors.push({
        code: "invalid-tier-assignment",
        message: "Tier assignment requires a non-empty player ID.",
        path: `${path}.playerId`,
      });
      return;
    }

    if (assignments.has(assignment.playerId)) {
      errors.push({
        code: "invalid-tier-assignment",
        message: `Tier assignment player ${assignment.playerId} appears more than once.`,
        path: `${path}.playerId`,
      });
    } else if (!expectedIds.has(assignment.playerId)) {
      errors.push({
        code: "invalid-tier-assignment",
        message: `Tier assignment player ${assignment.playerId} is not in ${intent.position}.`,
        path: `${path}.playerId`,
      });
    } else if (!isPositiveInteger(assignment.tier)) {
      errors.push({
        code: "invalid-tier-assignment",
        message: "Assigned tier must be a positive integer.",
        path: `${path}.tier`,
      });
    } else {
      assignments.set(assignment.playerId, assignment.tier);
    }
  });

  const missingIds = [...expectedIds].filter((id) => !assignments.has(id));

  missingIds.forEach((id) => {
    errors.push({
      code: "invalid-tier-assignment",
      message: `Tier assignment is missing player ${id}.`,
      path: "intent.assignments",
    });
  });

  if (errors.length > 0) {
    return errors;
  }

  let priorTier: number | undefined;

  for (const entry of positionEntries) {
    const tier = assignments.get(entry.player.id) as number;

    if (priorTier !== undefined && tier < priorTier) {
      return [
        {
          code: "invalid-tier-assignment",
          message: `Assigned tiers must not decrease within ${intent.position}.`,
          path: "intent.assignments",
        },
      ];
    }

    priorTier = tier;
  }

  positionEntries.forEach((entry) => {
    entry.tier = assignments.get(entry.player.id) as number;
  });
  proposal.capabilities.tiers[intent.position] = "source";
  return [];
}

function applyTierUpdate(
  proposal: MutableRankingSet,
  intent: UnknownRecord,
): RankingSetEditError[] {
  if (!isNonEmptyString(intent.playerId)) {
    return [
      {
        code: "invalid-tier-update",
        message: "Tier update requires a non-empty player ID.",
        path: "intent.playerId",
      },
    ];
  }

  const target = proposal.entries.find(
    (entry) => entry.player.id === intent.playerId,
  );

  if (!target) {
    return [playerNotFound(intent.playerId)];
  }

  if (!isPositiveInteger(intent.tier)) {
    return [
      {
        code: "invalid-tier-update",
        message: "Updated tier must be a positive integer.",
        path: "intent.tier",
      },
    ];
  }

  if (proposal.capabilities.tiers[target.player.position] !== "source") {
    return [
      {
        code: "invalid-tier-update",
        message:
          "Defaulted-neutral tiers require complete position-tier assignment.",
        path: `capabilities.tiers.${target.player.position}`,
      },
    ];
  }

  target.tier = intent.tier;
  return [];
}

function cloneRankingSet(
  rankingSet: RankingSet,
  updatedAt: Date,
): MutableRankingSet {
  return {
    id: rankingSet.id,
    name: rankingSet.name,
    source: cloneSource(rankingSet.source),
    capabilities: {
      team: rankingSet.capabilities.team,
      playerIdentity: rankingSet.capabilities.playerIdentity,
      overallOrder: rankingSet.capabilities.overallOrder,
      positionRank: rankingSet.capabilities.positionRank,
      adp: rankingSet.capabilities.adp,
      tiers: { ...rankingSet.capabilities.tiers },
    },
    entries: rankingSet.entries.map((entry) => ({
      player: { ...entry.player },
      overallRank: entry.overallRank,
      positionRank: entry.positionRank,
      tier: entry.tier,
      adpRank: entry.adpRank,
    })),
    createdAt: cloneDate(rankingSet.createdAt),
    updatedAt: cloneDate(updatedAt),
  };
}

function cloneSource(source: RankingSetSource): RankingSetSource {
  return {
    kind: source.kind,
    ...(source.formatId === undefined ? {} : { formatId: source.formatId }),
    ...(source.formatVersion === undefined
      ? {}
      : { formatVersion: source.formatVersion }),
    ...(source.label === undefined ? {} : { label: source.label }),
    ...(source.importedAt === undefined
      ? {}
      : { importedAt: cloneDate(source.importedAt) }),
  };
}

function deriveCanonicalRanks(entries: MutableEntry[]): void {
  const counts = new Map<Position, number>();

  entries.forEach((entry, index) => {
    entry.overallRank = index + 1;
    const nextPositionRank = (counts.get(entry.player.position) ?? 0) + 1;
    counts.set(entry.player.position, nextPositionRank);
    entry.positionRank = nextPositionRank;
  });
}

function reconcileTierCapabilityKeys(proposal: MutableRankingSet): void {
  const represented = new Set(
    proposal.entries
      .map((entry) => entry.player.position)
      .filter(isPosition),
  );
  const reconciled: MutableCapabilities["tiers"] = {};

  POSITIONS.forEach((position) => {
    if (!represented.has(position)) {
      return;
    }

    reconciled[position] =
      proposal.capabilities.tiers[position] ?? "source";
  });

  proposal.capabilities.tiers = reconciled;
}

function deriveAvailability(values: readonly boolean[]): RankingDataAvailability {
  const availableCount = values.filter(Boolean).length;

  if (availableCount === 0) {
    return "none";
  }

  return availableCount === values.length ? "complete" : "partial";
}

function correctedIdentityCapability(
  current: RankingSetCapabilities["playerIdentity"],
  entryCount: number,
): RankingSetCapabilities["playerIdentity"] {
  if (current === "provided") {
    return "provided";
  }

  if (current === "mixed") {
    return "mixed";
  }

  return entryCount === 1 ? "provided" : "mixed";
}

function playerNotFound(value: unknown): RankingSetEditError {
  return {
    code: "player-not-found",
    message: `Ranking player ${String(value)} was not found.`,
    path: "entries",
  };
}

function isIntentType(value: unknown): value is RankingSetEditIntent["type"] {
  return (
    value === "rename" ||
    value === "correct-player" ||
    value === "reorder-player" ||
    value === "assign-position-tiers" ||
    value === "update-tier"
  );
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

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOwn(record: UnknownRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function failure(errors: readonly RankingSetEditError[]): RankingSetEditResult {
  return { ok: false, errors };
}
