import { createDraftTeams, generateSnakeDraftOrder } from "@/lib/draftOrder";
import {
  buildLeagueSetup,
  LEAGUE_SETUP_ROSTER_CATEGORIES,
  type LeagueSetupRosterCategory,
  type LeagueSetupRosterCounts,
  type LeagueSetupValidationField,
} from "@/lib/leagueSetup";
import { parseLeagueSettingsSnapshotJson } from "@/lib/leagueSettingsSnapshot";
import { createRecommendationRankingContext } from "@/lib/recommendationRankingContext";
import {
  parsePersistedDraftRankingSnapshotJson,
  parseRankingSnapshotJson,
} from "@/lib/rankingSnapshot";
import type {
  RankingEntry,
  RecommendationRankingContextErrorCode,
} from "@/types/draft";
import { NEUTRAL_TIER, type RankingSnapshot } from "@/types/rankings";
import {
  SCENARIO_SCHEMA_VERSION,
  SCENARIO_V2_SCHEMA_VERSION,
  type ScenarioDocument,
  type ScenarioMetadata,
  type ScenarioPick,
  type ScenarioProvenance,
  type ScenarioSourceKind,
  type ScenarioV1,
  type ScenarioV2,
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
  | "inconsistent-configuration"
  | RecommendationRankingContextErrorCode;

export type ScenarioValidationError = {
  code: ScenarioValidationErrorCode;
  path: string;
  message: string;
};

type ParseScenarioFailure = { ok: false; errors: ScenarioValidationError[] };

export type ParseScenarioV1Result =
  | { ok: true; scenario: ScenarioV1 }
  | ParseScenarioFailure;

export type ParseScenarioV2Result =
  | { ok: true; scenario: ScenarioV2 }
  | ParseScenarioFailure;

export type ParseScenarioResult =
  | { ok: true; scenario: ScenarioDocument }
  | ParseScenarioFailure;

export function materializeScenarioV1Rankings(
  rankings: readonly RankingEntry[],
): RankingEntry[] {
  return rankings.map((ranking) => ({
    ...ranking,
    player: { ...ranking.player },
    tier: NEUTRAL_TIER,
  }));
}

class ScenarioValidationFailure extends Error {
  constructor(readonly validationError: ScenarioValidationError) {
    super(validationError.message);
  }
}

export function parseScenarioV1Json(json: string): ParseScenarioV1Result {
  return parseScenarioJsonWith(json, (value) =>
    parseScenario(value, SCENARIO_SCHEMA_VERSION),
  );
}

export function parseScenarioV2Json(json: string): ParseScenarioV2Result {
  return parseScenarioJsonWith(json, (value) =>
    parseScenario(value, SCENARIO_V2_SCHEMA_VERSION),
  );
}

export function parseScenarioJson(json: string): ParseScenarioResult {
  return parseScenarioJsonWith(json, (value) => {
    const root = expectRecord(value, "$", "Scenario");
    const schemaVersion = parseSchemaVersion(
      required(root, "schemaVersion", "schemaVersion"),
    );

    if (
      schemaVersion !== SCENARIO_SCHEMA_VERSION &&
      schemaVersion !== SCENARIO_V2_SCHEMA_VERSION
    ) {
      reject(
        "unsupported-version",
        "schemaVersion",
        `schemaVersion must be ${SCENARIO_SCHEMA_VERSION} or ${SCENARIO_V2_SCHEMA_VERSION}.`,
      );
    }

    return schemaVersion === SCENARIO_SCHEMA_VERSION
      ? parseScenario(value, SCENARIO_SCHEMA_VERSION)
      : parseScenario(value, SCENARIO_V2_SCHEMA_VERSION);
  });
}

function parseScenarioJsonWith<TScenario extends ScenarioDocument>(
  json: string,
  parser: (value: unknown) => TScenario,
): { ok: true; scenario: TScenario } | ParseScenarioFailure {
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
    return { ok: true, scenario: parser(parsed) };
  } catch (error) {
    if (error instanceof ScenarioValidationFailure) {
      return { ok: false, errors: [error.validationError] };
    }

    return failure("invalid-value", "$", "Scenario validation failed.");
  }
}

function parseScenario(
  value: unknown,
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION,
): ScenarioV1;
function parseScenario(
  value: unknown,
  schemaVersion: typeof SCENARIO_V2_SCHEMA_VERSION,
): ScenarioV2;
function parseScenario(
  value: unknown,
  schemaVersion:
    | typeof SCENARIO_SCHEMA_VERSION
    | typeof SCENARIO_V2_SCHEMA_VERSION,
): ScenarioDocument {
  const root = expectRecord(value, "$", "Scenario");
  const schemaVersionValue = parseSchemaVersion(
    required(root, "schemaVersion", "schemaVersion"),
  );

  if (schemaVersionValue !== schemaVersion) {
    reject(
      "unsupported-version",
      "schemaVersion",
      `schemaVersion must be ${schemaVersion}.`,
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
  const rankingContextRecord = expectRecord(
    required(root, "rankingContext", "rankingContext"),
    "rankingContext",
    "rankingContext",
  );
  const rankingsValue = required(
    rankingContextRecord,
    "rankings",
    "rankingContext.rankings",
  );
  const rankingContext =
    schemaVersion === SCENARIO_SCHEMA_VERSION
      ? { rankings: parseRankings(rankingsValue, true) }
      : parseScenarioV2RankingContext(rankingContextRecord, rankingsValue);
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

  const commonScenario = {
    metadata,
    leagueSettings,
    draftConfiguration: { teams },
    userTeamContext: { userTeamId },
    pickHistory,
    replayTarget: { appliedPickCount },
  };
  const scenario: ScenarioDocument =
    schemaVersion === SCENARIO_SCHEMA_VERSION
      ? {
          schemaVersion: SCENARIO_SCHEMA_VERSION,
          ...commonScenario,
          rankingContext: { rankings: rankingContext.rankings },
        }
      : {
          schemaVersion: SCENARIO_V2_SCHEMA_VERSION,
          ...commonScenario,
          rankingContext: rankingContext as ScenarioV2["rankingContext"],
        };

  validateConsistency(scenario);
  return scenario;
}

function parseSchemaVersion(value: unknown): number {
  if (typeof value !== "number") {
    reject("invalid-type", "schemaVersion", "schemaVersion must be a number.");
  }

  if (!Number.isInteger(value)) {
    reject("invalid-value", "schemaVersion", "schemaVersion must be an integer.");
  }

  return value;
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

function parseRankings(
  value: unknown,
  materializeNeutralTiers: boolean,
): ScenarioV1["rankingContext"]["rankings"] {
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
    const rankings = parseRankingSnapshotJson(value);

    return materializeNeutralTiers
      ? materializeScenarioV1Rankings(rankings)
      : rankings;
  } catch {
    reject(
      "invalid-value",
      "rankingContext.rankings",
      "rankingContext.rankings must contain typed ranking entries.",
    );
  }
}

function parseScenarioV2RankingContext(
  rankingContext: Record<string, unknown>,
  rankingsValue: unknown,
): ScenarioV2["rankingContext"] {
  const rankings = parseRankings(rankingsValue, false);
  const tierSemanticsValue = required(
    rankingContext,
    "tierSemantics",
    "rankingContext.tierSemantics",
  );
  let snapshot: RankingSnapshot;

  try {
    snapshot = parsePersistedDraftRankingSnapshotJson({
      schemaVersion: 2,
      rankings,
      tierSemantics: tierSemanticsValue,
      capturedAt: "1970-01-01T00:00:00.000Z",
    });
  } catch {
    reject(
      "invalid-value",
      "rankingContext.tierSemantics",
      "rankingContext.tierSemantics must contain valid ranking tier semantics.",
    );
  }

  const recommendationContext = createRecommendationRankingContext(snapshot);

  if (!recommendationContext.ok) {
    const error = recommendationContext.errors[0];

    reject(
      error.code,
      `rankingContext.${error.path}`,
      error.message,
    );
  }

  if (!snapshot.tierSemantics) {
    reject(
      "missing-field",
      "rankingContext.tierSemantics",
      "rankingContext.tierSemantics is required.",
    );
  }

  return {
    rankings: [...snapshot.rankings],
    tierSemantics: snapshot.tierSemantics,
  };
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

function validateConsistency(scenario: ScenarioDocument): void {
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
): ParseScenarioFailure {
  return { ok: false, errors: [{ code, path, message }] };
}
