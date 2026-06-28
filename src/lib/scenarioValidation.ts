import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  buildLeagueSetup,
  LEAGUE_SETUP_ROSTER_CATEGORIES,
  type LeagueSetupRosterCategory,
  type LeagueSetupRosterCounts,
  type LeagueSetupValidationField,
} from "@/lib/leagueSetup";
import { parseLeagueSettingsSnapshotJson } from "@/lib/leagueSettingsSnapshot";
import { parseRankingSnapshotJson } from "@/lib/rankingSnapshot";
import {
  SCENARIO_SCHEMA_VERSION,
  type ScenarioMetadata,
  type ScenarioPick,
  type ScenarioProvenance,
  type ScenarioSourceKind,
  type ScenarioV1,
} from "@/types/scenario";

export const SCENARIO_VALIDATION_LIMITS = {
  maxJsonBytes: 1024 * 1024,
  maxRankings: 1000,
  maxDraftPicks: 1000,
  maxMetadataTags: 50,
} as const;

export type ScenarioValidationErrorCode =
  | "invalid-json"
  | "invalid-type"
  | "missing-field"
  | "unsupported-version"
  | "limit-exceeded"
  | "invalid-value"
  | "duplicate-identity"
  | "invalid-reference"
  | "inconsistent-configuration";

export type ScenarioValidationError = {
  code: ScenarioValidationErrorCode;
  path: string;
  message: string;
};

export type ParseScenarioV1Result =
  | { ok: true; scenario: ScenarioV1 }
  | { ok: false; errors: ScenarioValidationError[] };

class ScenarioValidationFailure extends Error {
  constructor(readonly validationError: ScenarioValidationError) {
    super(validationError.message);
  }
}

export function parseScenarioV1Json(json: string): ParseScenarioV1Result {
  if (new TextEncoder().encode(json).byteLength > SCENARIO_VALIDATION_LIMITS.maxJsonBytes) {
    return failure(
      "limit-exceeded",
      "$",
      `Scenario JSON must not exceed ${SCENARIO_VALIDATION_LIMITS.maxJsonBytes} bytes.`,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return failure("invalid-json", "$", "Scenario must contain valid JSON.");
  }

  try {
    return { ok: true, scenario: parseScenario(parsed) };
  } catch (error) {
    if (error instanceof ScenarioValidationFailure) {
      return { ok: false, errors: [error.validationError] };
    }

    return failure("invalid-value", "$", "Scenario validation failed.");
  }
}

function parseScenario(value: unknown): ScenarioV1 {
  const root = expectRecord(value, "$", "Scenario");
  const schemaVersionValue = required(root, "schemaVersion", "schemaVersion");

  if (typeof schemaVersionValue !== "number") {
    reject("invalid-type", "schemaVersion", "schemaVersion must be a number.");
  }

  if (!Number.isInteger(schemaVersionValue)) {
    reject("invalid-value", "schemaVersion", "schemaVersion must be an integer.");
  }

  if (schemaVersionValue !== SCENARIO_SCHEMA_VERSION) {
    reject(
      "unsupported-version",
      "schemaVersion",
      `schemaVersion must be ${SCENARIO_SCHEMA_VERSION}.`,
    );
  }

  const metadata = parseMetadata(required(root, "metadata", "metadata"));
  const leagueSettings = parseLeagueSettings(
    required(root, "leagueSettings", "leagueSettings"),
  );
  const teams = parseTeams(
    required(
      expectRecord(
        required(root, "draftConfiguration", "draftConfiguration"),
        "draftConfiguration",
        "draftConfiguration",
      ),
      "teams",
      "draftConfiguration.teams",
    ),
  );
  const rankings = parseRankings(
    required(
      expectRecord(
        required(root, "rankingContext", "rankingContext"),
        "rankingContext",
        "rankingContext",
      ),
      "rankings",
      "rankingContext.rankings",
    ),
  );
  const userTeamId = expectNonEmptyString(
    required(
      expectRecord(
        required(root, "userTeamContext", "userTeamContext"),
        "userTeamContext",
        "userTeamContext",
      ),
      "userTeamId",
      "userTeamContext.userTeamId",
    ),
    "userTeamContext.userTeamId",
  );
  const pickHistory = parsePickHistory(
    required(root, "pickHistory", "pickHistory"),
  );
  const replayTargetRecord = expectRecord(
    required(root, "replayTarget", "replayTarget"),
    "replayTarget",
    "replayTarget",
  );
  const appliedPickCount = expectNonNegativeInteger(
    required(
      replayTargetRecord,
      "appliedPickCount",
      "replayTarget.appliedPickCount",
    ),
    "replayTarget.appliedPickCount",
  );

  if (appliedPickCount > pickHistory.length) {
    reject(
      "invalid-value",
      "replayTarget.appliedPickCount",
      "appliedPickCount must not exceed pickHistory length.",
    );
  }

  const scenario: ScenarioV1 = {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    metadata,
    leagueSettings,
    draftConfiguration: { teams },
    rankingContext: { rankings },
    userTeamContext: { userTeamId },
    pickHistory,
    replayTarget: { appliedPickCount },
  };

  validateConsistency(scenario);
  return scenario;
}

function parseMetadata(value: unknown): ScenarioMetadata {
  const record = expectRecord(value, "metadata", "metadata");
  const description = optionalString(record.description, "metadata.description");
  const tags = parseOptionalTags(record.tags);
  const provenance = parseOptionalProvenance(record.provenance);

  return {
    id: expectNonEmptyString(
      required(record, "id", "metadata.id"),
      "metadata.id",
    ),
    name: expectNonEmptyString(
      required(record, "name", "metadata.name"),
      "metadata.name",
    ),
    ...(description === undefined ? {} : { description }),
    ...(tags === undefined ? {} : { tags }),
    ...(provenance === undefined ? {} : { provenance }),
  };
}

function parseOptionalTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    reject("invalid-type", "metadata.tags", "metadata.tags must be an array.");
  }

  if (value.length > SCENARIO_VALIDATION_LIMITS.maxMetadataTags) {
    reject(
      "limit-exceeded",
      "metadata.tags",
      `metadata.tags must contain at most ${SCENARIO_VALIDATION_LIMITS.maxMetadataTags} entries.`,
    );
  }

  return value.map((tag, index) =>
    expectString(tag, `metadata.tags[${index}]`),
  );
}

function parseOptionalProvenance(value: unknown): ScenarioProvenance | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "metadata.provenance", "metadata.provenance");
  const sourceKind = expectNonEmptyString(
    required(record, "sourceKind", "metadata.provenance.sourceKind"),
    "metadata.provenance.sourceKind",
  );

  if (!isScenarioSourceKind(sourceKind)) {
    reject(
      "invalid-value",
      "metadata.provenance.sourceKind",
      "sourceKind must be manual, persisted, or scenario.",
    );
  }

  const sourceId = optionalNonEmptyString(
    record.sourceId,
    "metadata.provenance.sourceId",
  );
  const exportedAt = expectNonEmptyString(
    required(record, "exportedAt", "metadata.provenance.exportedAt"),
    "metadata.provenance.exportedAt",
  );

  if (Number.isNaN(Date.parse(exportedAt))) {
    reject(
      "invalid-value",
      "metadata.provenance.exportedAt",
      "exportedAt must be a valid timestamp.",
    );
  }

  return {
    sourceKind,
    ...(sourceId === undefined ? {} : { sourceId }),
    exportedAt,
  };
}

function parseLeagueSettings(value: unknown): ScenarioV1["leagueSettings"] {
  try {
    return parseLeagueSettingsSnapshotJson(value);
  } catch {
    reject(
      "invalid-value",
      "leagueSettings",
      "leagueSettings must contain supported typed settings.",
    );
  }
}

function parseTeams(value: unknown): ScenarioV1["draftConfiguration"]["teams"] {
  if (!Array.isArray(value)) {
    reject(
      "invalid-type",
      "draftConfiguration.teams",
      "draftConfiguration.teams must be an array.",
    );
  }

  return value.map((team, index) => {
    const path = `draftConfiguration.teams[${index}]`;
    const record = expectRecord(team, path, path);

    return {
      id: expectNonEmptyString(required(record, "id", `${path}.id`), `${path}.id`),
      name: expectNonEmptyString(
        required(record, "name", `${path}.name`),
        `${path}.name`,
      ),
      draftPosition: expectPositiveInteger(
        required(record, "draftPosition", `${path}.draftPosition`),
        `${path}.draftPosition`,
      ),
    };
  });
}

function parseRankings(value: unknown): ScenarioV1["rankingContext"]["rankings"] {
  if (!Array.isArray(value)) {
    reject(
      "invalid-type",
      "rankingContext.rankings",
      "rankingContext.rankings must be an array.",
    );
  }

  if (value.length > SCENARIO_VALIDATION_LIMITS.maxRankings) {
    reject(
      "limit-exceeded",
      "rankingContext.rankings",
      `rankingContext.rankings must contain at most ${SCENARIO_VALIDATION_LIMITS.maxRankings} entries.`,
    );
  }

  if (value.length === 0) {
    reject(
      "invalid-value",
      "rankingContext.rankings",
      "rankingContext.rankings must contain at least one entry.",
    );
  }

  try {
    return parseRankingSnapshotJson(value);
  } catch {
    reject(
      "invalid-value",
      "rankingContext.rankings",
      "rankingContext.rankings must contain typed ranking entries.",
    );
  }
}

function parsePickHistory(value: unknown): ScenarioPick[] {
  if (!Array.isArray(value)) {
    reject("invalid-type", "pickHistory", "pickHistory must be an array.");
  }

  if (value.length > SCENARIO_VALIDATION_LIMITS.maxDraftPicks) {
    reject(
      "limit-exceeded",
      "pickHistory",
      `pickHistory must contain at most ${SCENARIO_VALIDATION_LIMITS.maxDraftPicks} entries.`,
    );
  }

  return value.map((pick, index) => {
    const path = `pickHistory[${index}]`;
    const record = expectRecord(pick, path, path);
    const expectedPickNumber = optionalPositiveInteger(
      record.expectedPickNumber,
      `${path}.expectedPickNumber`,
    );
    const expectedTeamId = optionalNonEmptyString(
      record.expectedTeamId,
      `${path}.expectedTeamId`,
    );

    return {
      playerId: expectNonEmptyString(
        required(record, "playerId", `${path}.playerId`),
        `${path}.playerId`,
      ),
      ...(expectedPickNumber === undefined ? {} : { expectedPickNumber }),
      ...(expectedTeamId === undefined ? {} : { expectedTeamId }),
    };
  });
}

function validateConsistency(scenario: ScenarioV1): void {
  const { leagueSettings, draftConfiguration, rankingContext, userTeamContext } = scenario;
  const capacity = leagueSettings.teamCount * leagueSettings.rounds;

  if (capacity > SCENARIO_VALIDATION_LIMITS.maxDraftPicks) {
    reject(
      "limit-exceeded",
      "leagueSettings",
      `Configured draft capacity must not exceed ${SCENARIO_VALIDATION_LIMITS.maxDraftPicks} picks.`,
    );
  }

  rejectDuplicateValues(
    draftConfiguration.teams.map((team) => team.id),
    "draftConfiguration.teams",
    "team ID",
  );
  rejectDuplicateValues(
    draftConfiguration.teams.map((team) => team.draftPosition),
    "draftConfiguration.teams",
    "draft position",
  );

  const expectedTeams = createDraftTeams(leagueSettings.teamCount);

  if (!equalJson(draftConfiguration.teams, expectedTeams)) {
    reject(
      "inconsistent-configuration",
      "draftConfiguration.teams",
      "Teams must match the canonical generated team order for leagueSettings.teamCount.",
    );
  }

  const userTeam = draftConfiguration.teams.find(
    (team) => team.id === userTeamContext.userTeamId,
  );

  if (!userTeam) {
    reject(
      "invalid-reference",
      "userTeamContext.userTeamId",
      "userTeamId must reference a configured team.",
    );
  }

  const rosterSlotCounts = createEmptyRosterCounts();

  leagueSettings.rosterSlots.forEach((slot, index) => {
    if (!isRosterCategory(slot.label)) {
      reject(
        "invalid-value",
        `leagueSettings.rosterSlots[${index}].label`,
        "Roster slot label must be a supported category.",
      );
    }

    rosterSlotCounts[slot.label] += 1;
  });

  const setup = buildLeagueSetup(
    {
      teamCount: leagueSettings.teamCount,
      userDraftPosition: userTeam.draftPosition,
      draftType: leagueSettings.draftType,
      scoringFormat: leagueSettings.scoringFormat,
      rosterSlotCounts,
    },
    rankingContext.rankings.length,
  );

  if (!setup.ok) {
    const setupError = setup.errors[0];

    reject(
      "inconsistent-configuration",
      mapSetupField(setupError.field),
      setupError.message,
    );
  }

  if (!equalJson(setup.leagueSettings, leagueSettings)) {
    reject(
      "inconsistent-configuration",
      "leagueSettings",
      "leagueSettings must match canonical generated settings.",
    );
  }

  if (setup.userTeamId !== userTeamContext.userTeamId) {
    reject(
      "inconsistent-configuration",
      "userTeamContext.userTeamId",
      "userTeamId must match the team derived from draft position.",
    );
  }

  const rankingPlayerIds = rankingContext.rankings.map(({ player }) => player.id);

  rankingPlayerIds.forEach((playerId, index) => {
    if (playerId.length === 0) {
      reject(
        "invalid-value",
        `rankingContext.rankings[${index}].player.id`,
        "Ranking player ID must be non-empty.",
      );
    }
  });
  rejectDuplicateValues(
    rankingPlayerIds,
    "rankingContext.rankings",
    "ranking player ID",
  );

  if (scenario.pickHistory.length > capacity) {
    reject(
      "limit-exceeded",
      "pickHistory",
      "pickHistory must not exceed configured draft capacity.",
    );
  }

  if (scenario.replayTarget.appliedPickCount > capacity) {
    reject(
      "invalid-value",
      "replayTarget.appliedPickCount",
      "appliedPickCount must not exceed configured draft capacity.",
    );
  }

  const rankingPlayerIdSet = new Set(rankingPlayerIds);
  const pickedPlayerIds = new Set<string>();
  const draftOrder = generateSnakeDraftOrder(
    leagueSettings.teamCount,
    leagueSettings.rounds,
  );

  scenario.pickHistory.forEach((pick, index) => {
    const path = `pickHistory[${index}]`;

    if (!rankingPlayerIdSet.has(pick.playerId)) {
      reject(
        "invalid-reference",
        `${path}.playerId`,
        "Picked player must exist in rankingContext.rankings.",
      );
    }

    if (pickedPlayerIds.has(pick.playerId)) {
      reject(
        "duplicate-identity",
        `${path}.playerId`,
        "Picked player must not appear more than once.",
      );
    }
    pickedPlayerIds.add(pick.playerId);

    const expectedDraftPick = draftOrder[index];

    if (
      pick.expectedPickNumber !== undefined &&
      pick.expectedPickNumber !== expectedDraftPick.pickNumber
    ) {
      reject(
        "inconsistent-configuration",
        `${path}.expectedPickNumber`,
        "expectedPickNumber must match the generated draft order.",
      );
    }

    if (
      pick.expectedTeamId !== undefined &&
      pick.expectedTeamId !== expectedDraftPick.teamId
    ) {
      reject(
        "inconsistent-configuration",
        `${path}.expectedTeamId`,
        "expectedTeamId must match the generated draft order.",
      );
    }
  });
}

function required(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown {
  if (!(key in record)) {
    reject("missing-field", path, `${path} is required.`);
  }

  return record[key];
}

function expectRecord(
  value: unknown,
  path: string,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reject("invalid-type", path, `${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    reject("invalid-type", path, `${path} must be a string.`);
  }

  return value;
}

function expectNonEmptyString(value: unknown, path: string): string {
  const parsed = expectString(value, path);

  if (parsed.length === 0) {
    reject("invalid-value", path, `${path} must be non-empty.`);
  }

  return parsed;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : expectString(value, path);
}

function optionalNonEmptyString(
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined ? undefined : expectNonEmptyString(value, path);
}

function expectNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number") {
    reject("invalid-type", path, `${path} must be a number.`);
  }

  if (!Number.isInteger(value) || value < 0) {
    reject("invalid-value", path, `${path} must be a non-negative integer.`);
  }

  return value;
}

function expectPositiveInteger(value: unknown, path: string): number {
  const parsed = expectNonNegativeInteger(value, path);

  if (parsed < 1) {
    reject("invalid-value", path, `${path} must be a positive integer.`);
  }

  return parsed;
}

function optionalPositiveInteger(value: unknown, path: string): number | undefined {
  return value === undefined ? undefined : expectPositiveInteger(value, path);
}

function rejectDuplicateValues(
  values: Array<string | number>,
  path: string,
  label: string,
): void {
  if (new Set(values).size !== values.length) {
    reject(
      "duplicate-identity",
      path,
      `${path} must not contain a duplicate ${label}.`,
    );
  }
}

function createEmptyRosterCounts(): LeagueSetupRosterCounts {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    DST: 0,
    K: 0,
    BENCH: 0,
  };
}

function isRosterCategory(value: string): value is LeagueSetupRosterCategory {
  return LEAGUE_SETUP_ROSTER_CATEGORIES.includes(
    value as LeagueSetupRosterCategory,
  );
}

function isScenarioSourceKind(value: string): value is ScenarioSourceKind {
  return value === "manual" || value === "persisted" || value === "scenario";
}

function mapSetupField(field: LeagueSetupValidationField): string {
  if (field === "rankingPlayerCount") {
    return "rankingContext.rankings";
  }

  if (field === "userDraftPosition") {
    return "userTeamContext.userTeamId";
  }

  if (field === "teamCount" || field === "draftType" || field === "scoringFormat") {
    return `leagueSettings.${field}`;
  }

  return "leagueSettings.rosterSlots";
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reject(
  code: ScenarioValidationErrorCode,
  path: string,
  message: string,
): never {
  throw new ScenarioValidationFailure({ code, path, message });
}

function failure(
  code: ScenarioValidationErrorCode,
  path: string,
  message: string,
): ParseScenarioV1Result {
  return { ok: false, errors: [{ code, path, message }] };
}
