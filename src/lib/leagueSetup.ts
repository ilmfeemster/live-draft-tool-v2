import { createDraftTeams } from "@/lib/draftOrder";
import type {
  DraftType,
  LeagueSettings,
  Position,
  RosterSlot,
  ScoringFormat,
} from "@/types/draft";

export const LEAGUE_SETUP_LIMITS = {
  minTeamCount: 2,
  maxTeamCount: 20,
  minRosterSlots: 1,
  maxRosterSlots: 30,
} as const;

export const LEAGUE_SETUP_ROSTER_CATEGORIES = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "DST",
  "K",
  "BENCH",
] as const;

export type LeagueSetupRosterCategory =
  (typeof LEAGUE_SETUP_ROSTER_CATEGORIES)[number];

export type LeagueSetupRosterCounts = Record<
  LeagueSetupRosterCategory,
  number
>;

export type LeagueSetupInput = {
  teamCount: number;
  userDraftPosition: number;
  draftType: DraftType;
  scoringFormat: ScoringFormat;
  rosterSlotCounts: LeagueSetupRosterCounts;
};

export type LeagueSetupValidationField =
  | "rankingPlayerCount"
  | "teamCount"
  | "userDraftPosition"
  | "draftType"
  | "scoringFormat"
  | "rosterSlotCounts"
  | `rosterSlotCounts.${LeagueSetupRosterCategory}`;

export type LeagueSetupValidationError = {
  field: LeagueSetupValidationField;
  message: string;
};

export type LeagueSetupResult =
  | {
      ok: true;
      leagueSettings: LeagueSettings;
      userTeamId: string;
    }
  | {
      ok: false;
      errors: LeagueSetupValidationError[];
    };

type RosterSlotDefinition = {
  label: string;
  eligiblePositions: Position[];
};

const ROSTER_SLOT_DEFINITIONS: Record<
  LeagueSetupRosterCategory,
  RosterSlotDefinition
> = {
  QB: { label: "QB", eligiblePositions: ["QB"] },
  RB: { label: "RB", eligiblePositions: ["RB"] },
  WR: { label: "WR", eligiblePositions: ["WR"] },
  TE: { label: "TE", eligiblePositions: ["TE"] },
  FLEX: { label: "FLEX", eligiblePositions: ["RB", "WR", "TE"] },
  DST: { label: "DST", eligiblePositions: ["DST"] },
  K: { label: "K", eligiblePositions: ["K"] },
  BENCH: {
    label: "BENCH",
    eligiblePositions: ["QB", "RB", "WR", "TE", "DST", "K"],
  },
};

export const defaultLeagueSetupInput: LeagueSetupInput = {
  teamCount: 12,
  userDraftPosition: 1,
  draftType: "SNAKE",
  scoringFormat: "PPR",
  rosterSlotCounts: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 2,
    DST: 1,
    K: 1,
    BENCH: 6,
  },
};

export function buildLeagueSetup(
  input: LeagueSetupInput,
  rankingPlayerCount: number,
): LeagueSetupResult {
  const errors: LeagueSetupValidationError[] = [];
  const isRankingPlayerCountValid = isNonNegativeInteger(rankingPlayerCount);
  const isTeamCountValid =
    Number.isInteger(input.teamCount) &&
    input.teamCount >= LEAGUE_SETUP_LIMITS.minTeamCount &&
    input.teamCount <= LEAGUE_SETUP_LIMITS.maxTeamCount;
  const isDraftPositionInteger = Number.isInteger(input.userDraftPosition);

  if (!isRankingPlayerCountValid) {
    errors.push({
      field: "rankingPlayerCount",
      message: "Ranking player count must be a non-negative integer.",
    });
  }

  if (!isTeamCountValid) {
    errors.push({
      field: "teamCount",
      message: `Team count must be an integer from ${LEAGUE_SETUP_LIMITS.minTeamCount} through ${LEAGUE_SETUP_LIMITS.maxTeamCount}.`,
    });
  }

  if (!isDraftPositionInteger) {
    errors.push({
      field: "userDraftPosition",
      message: "Draft position must be an integer.",
    });
  } else if (
    isTeamCountValid &&
    (input.userDraftPosition < 1 || input.userDraftPosition > input.teamCount)
  ) {
    errors.push({
      field: "userDraftPosition",
      message: "Draft position must be between 1 and the selected team count.",
    });
  }

  if (input.draftType !== "SNAKE") {
    errors.push({
      field: "draftType",
      message: "Draft type must be SNAKE.",
    });
  }

  if (input.scoringFormat !== "PPR") {
    errors.push({
      field: "scoringFormat",
      message: "Scoring format must be PPR.",
    });
  }

  const rosterSlotCounts = input.rosterSlotCounts as
    | Partial<LeagueSetupRosterCounts>
    | undefined;
  let areRosterCountsValid = true;
  let startingSlotCount = 0;
  let totalRosterSlots = 0;

  LEAGUE_SETUP_ROSTER_CATEGORIES.forEach((category) => {
    const count = rosterSlotCounts?.[category];

    if (!isNonNegativeInteger(count)) {
      errors.push({
        field: `rosterSlotCounts.${category}`,
        message: `${category} roster count must be a non-negative integer.`,
      });
      areRosterCountsValid = false;
      return;
    }

    totalRosterSlots += count;

    if (category !== "BENCH") {
      startingSlotCount += count;
    }
  });

  let isRosterShapeValid = areRosterCountsValid;

  if (areRosterCountsValid && startingSlotCount === 0) {
    errors.push({
      field: "rosterSlotCounts",
      message: "At least one non-BENCH starting slot is required.",
    });
    isRosterShapeValid = false;
  }

  if (
    areRosterCountsValid &&
    (totalRosterSlots < LEAGUE_SETUP_LIMITS.minRosterSlots ||
      totalRosterSlots > LEAGUE_SETUP_LIMITS.maxRosterSlots)
  ) {
    errors.push({
      field: "rosterSlotCounts",
      message: `Total roster slots must be between ${LEAGUE_SETUP_LIMITS.minRosterSlots} and ${LEAGUE_SETUP_LIMITS.maxRosterSlots}.`,
    });
    isRosterShapeValid = false;
  }

  if (isRankingPlayerCountValid && isTeamCountValid && isRosterShapeValid) {
    const requiredPlayerCount = input.teamCount * totalRosterSlots;

    if (requiredPlayerCount > rankingPlayerCount) {
      errors.push({
        field: "rankingPlayerCount",
        message: `Draft requires ${requiredPlayerCount} players, but only ${rankingPlayerCount} ranking players are available.`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const userTeam = createDraftTeams(input.teamCount).find(
    (team) => team.draftPosition === input.userDraftPosition,
  );

  if (!userTeam) {
    return {
      ok: false,
      errors: [
        {
          field: "userDraftPosition",
          message: "Draft position must identify a generated team.",
        },
      ],
    };
  }

  const rosterSlots = buildRosterSlots(input.rosterSlotCounts);

  return {
    ok: true,
    leagueSettings: {
      teamCount: input.teamCount,
      rounds: rosterSlots.length,
      draftType: input.draftType,
      scoringFormat: input.scoringFormat,
      rosterSlots,
    },
    userTeamId: userTeam.id,
  };
}

function buildRosterSlots(counts: LeagueSetupRosterCounts): RosterSlot[] {
  return LEAGUE_SETUP_ROSTER_CATEGORIES.flatMap((category) => {
    const definition = ROSTER_SLOT_DEFINITIONS[category];

    return Array.from({ length: counts[category] }, (_, index) => ({
      id: `${category.toLowerCase()}-${index + 1}`,
      label: definition.label,
      eligiblePositions: [...definition.eligiblePositions],
    }));
  });
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
