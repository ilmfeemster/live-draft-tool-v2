import type {
  CandidatePocketSignal,
  Draft,
  DraftPocket,
  DraftPocketDiversityLabel,
  DraftPocketForecast,
  DraftPocketProfile,
  DraftPocketProfileTransition,
  DraftPocketTimingAllocationRole,
  Position,
  RecommendationRankingFact,
} from "@/types/draft";

const MIN_POCKET_SIZE = 6;
const MAX_POCKET_SIZE = 12;
const POSITION_ORDER: readonly Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

type CreateDraftPocketForecastInput = Readonly<{
  draft: Draft;
  rankings: readonly RecommendationRankingFact[];
  userTeamId: string;
}>;

type CreateCandidatePocketSignalInput = Readonly<{
  candidate: RecommendationRankingFact;
  forecast: DraftPocketForecast;
  profileTransitions: readonly DraftPocketProfileTransition[];
}>;

type CreateDraftPocketProfileTransitionsInput = Readonly<{
  forecast: DraftPocketForecast;
  rankings: readonly RecommendationRankingFact[];
}>;

type ForecastRanking = Readonly<{
  normalizedAdp: number;
  ranking: RecommendationRankingFact;
}>;

function compareByOverallRank(
  a: RecommendationRankingFact,
  b: RecommendationRankingFact,
) {
  if (a.overallRank !== b.overallRank) {
    return a.overallRank - b.overallRank;
  }

  return a.player.id.localeCompare(b.player.id);
}

function compareByForecastRemoval(a: ForecastRanking, b: ForecastRanking) {
  if (a.normalizedAdp !== b.normalizedAdp) {
    return a.normalizedAdp - b.normalizedAdp;
  }

  return compareByOverallRank(a.ranking, b.ranking);
}

function getTargetPickNumber(draft: Draft, userTeamId: string) {
  return draft.picks.reduce<number | null>((targetPickNumber, pick) => {
    if (
      pick.teamId !== userTeamId ||
      pick.pickNumber <= draft.currentPickNumber
    ) {
      return targetPickNumber;
    }

    if (targetPickNumber === null || pick.pickNumber < targetPickNumber) {
      return pick.pickNumber;
    }

    return targetPickNumber;
  }, null);
}

function getCurrentBoard(
  draft: Draft,
  rankings: readonly RecommendationRankingFact[],
) {
  const draftedPlayerIds = new Set(
    draft.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  );

  return rankings
    .filter((ranking) => !draftedPlayerIds.has(ranking.player.id))
    .sort(compareByOverallRank);
}

function createPositionCounts(): Record<Position, number> {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    DST: 0,
    K: 0,
  };
}

function getDiversityLabels(
  positionCounts: Readonly<Record<Position, number>>,
  pocketSize: number,
): DraftPocketDiversityLabel[] {
  const labels: DraftPocketDiversityLabel[] = [];

  if (pocketSize < MIN_POCKET_SIZE) {
    labels.push("thin");
  }

  if (positionCounts.WR > pocketSize / 2) {
    labels.push("WR-heavy");
  } else if (positionCounts.RB > pocketSize / 2) {
    labels.push("RB-heavy");
  } else if (positionCounts.QB + positionCounts.TE > pocketSize / 2) {
    labels.push("onesie-heavy");
  } else if (
    POSITION_ORDER.filter((position) => positionCounts[position] > 0).length >= 3
  ) {
    labels.push("balanced");
  } else {
    labels.push("mixed");
  }

  return labels;
}

export function createDraftPocket(
  rankings: readonly RecommendationRankingFact[],
): DraftPocket {
  const orderedRankings = [...rankings].sort(compareByOverallRank);
  let pocketRankings = orderedRankings.slice(0, MIN_POCKET_SIZE);

  if (orderedRankings.length > MIN_POCKET_SIZE) {
    const sixthRanking = orderedRankings[MIN_POCKET_SIZE - 1];

    if (sixthRanking.overallTierOrigin === "source") {
      let pocketSize = MIN_POCKET_SIZE;

      while (pocketSize < Math.min(orderedRankings.length, MAX_POCKET_SIZE)) {
        const nextRanking = orderedRankings[pocketSize];

        if (
          nextRanking.overallTierOrigin !== "source" ||
          nextRanking.overallTier !== sixthRanking.overallTier
        ) {
          break;
        }

        pocketSize += 1;
      }

      pocketRankings = orderedRankings.slice(0, pocketSize);
    }
  }

  const overallTierCounts = pocketRankings.reduce<
    Array<{
      overallTier: number;
      overallTierOrigin: RecommendationRankingFact["overallTierOrigin"];
      count: number;
    }>
  >((counts, ranking) => {
    const existingCount = counts.find((entry) => {
      return (
        entry.overallTier === ranking.overallTier &&
        entry.overallTierOrigin === ranking.overallTierOrigin
      );
    });

    if (existingCount) {
      existingCount.count += 1;
    } else {
      counts.push({
        overallTier: ranking.overallTier,
        overallTierOrigin: ranking.overallTierOrigin,
        count: 1,
      });
    }

    return counts;
  }, []);
  overallTierCounts.sort((a, b) => {
    if (a.overallTier !== b.overallTier) {
      return a.overallTier - b.overallTier;
    }

    if (a.overallTierOrigin === b.overallTierOrigin) {
      return 0;
    }

    return a.overallTierOrigin === "source" ? -1 : 1;
  });

  const meaningfulTiers = pocketRankings.flatMap((ranking) => {
    return ranking.overallTierOrigin === "source" ? [ranking.overallTier] : [];
  });
  const highestMeaningfulOverallTier =
    meaningfulTiers.length === 0 ? null : Math.min(...meaningfulTiers);
  const positionCounts = createPositionCounts();

  for (const ranking of pocketRankings) {
    positionCounts[ranking.player.position] += 1;
  }

  return {
    playerIds: pocketRankings.map((ranking) => ranking.player.id),
    highestMeaningfulOverallTier,
    overallTierCounts,
    positionCounts,
    diversityLabels: getDiversityLabels(positionCounts, pocketRankings.length),
  };
}

function resolvePocketRankings(
  playerIds: readonly string[],
  rankingsByPlayerId: ReadonlyMap<string, RecommendationRankingFact>,
) {
  return playerIds.map((playerId) => {
    const ranking = rankingsByPlayerId.get(playerId);

    if (!ranking) {
      throw new Error(`Draft pocket player ${playerId} is missing from ranking context.`);
    }

    return ranking;
  });
}

function createProfile(ranking: RecommendationRankingFact): DraftPocketProfile {
  return {
    position: ranking.player.position,
    overallTierOrigin: ranking.overallTierOrigin,
    overallTier: ranking.overallTier,
  };
}

function getProfileKey(profile: DraftPocketProfile) {
  return `${profile.position}:${profile.overallTierOrigin}:${profile.overallTier}`;
}

function isSameProfile(
  ranking: RecommendationRankingFact,
  profile: DraftPocketProfile,
) {
  return (
    ranking.player.position === profile.position &&
    ranking.overallTierOrigin === profile.overallTierOrigin &&
    ranking.overallTier === profile.overallTier
  );
}

export function createDraftPocketProfileTransitions({
  forecast,
  rankings,
}: CreateDraftPocketProfileTransitionsInput): readonly DraftPocketProfileTransition[] {
  if (
    forecast.status !== "active" ||
    forecast.forecastedPocket === null ||
    forecast.currentPocket.playerIds.length === 0
  ) {
    return [];
  }

  const rankingsByPlayerId = new Map(
    rankings.map((ranking) => [ranking.player.id, ranking] as const),
  );
  const currentPocketRankings = resolvePocketRankings(
    forecast.currentPocket.playerIds,
    rankingsByPlayerId,
  ).sort(compareByOverallRank);
  const forecastedPocketRankings = resolvePocketRankings(
    forecast.forecastedPocket.playerIds,
    rankingsByPlayerId,
  ).sort(compareByOverallRank);
  const profileGroups = new Map<
    string,
    {
      profile: DraftPocketProfile;
      rankings: RecommendationRankingFact[];
    }
  >();

  for (const ranking of currentPocketRankings) {
    const profile = createProfile(ranking);
    const profileKey = getProfileKey(profile);
    const existingGroup = profileGroups.get(profileKey);

    if (existingGroup) {
      existingGroup.rankings.push(ranking);
    } else {
      profileGroups.set(profileKey, { profile, rankings: [ranking] });
    }
  }

  return [...profileGroups.values()]
    .map(({ profile, rankings: currentProfileRankings }) => {
      currentProfileRankings.sort(compareByOverallRank);
      const anchor = currentProfileRankings[0];
      const comparableRankings: RecommendationRankingFact[] = [];
      const nearRankings: RecommendationRankingFact[] = [];
      let forecastedExactProfileCount = 0;

      for (const forecastedRanking of forecastedPocketRankings) {
        if (
          forecastedRanking.player.position !== profile.position ||
          Math.abs(anchor.overallRank - forecastedRanking.overallRank) > 12
        ) {
          continue;
        }

        if (forecastedRanking.overallTierOrigin !== profile.overallTierOrigin) {
          throw new Error(
            `Draft pocket profile ${anchor.player.id} and forecasted player ${forecastedRanking.player.id} have mixed overall-tier origins.`,
          );
        }

        if (isSameProfile(forecastedRanking, profile)) {
          forecastedExactProfileCount += 1;
        }

        if (
          profile.overallTierOrigin === "defaulted-neutral" ||
          forecastedRanking.overallTier <= profile.overallTier
        ) {
          comparableRankings.push(forecastedRanking);
        } else {
          nearRankings.push(forecastedRanking);
        }
      }

      const forecastedComparableCount = comparableRankings.length;
      const forecastedNearCount = nearRankings.length;
      const replacementQuality =
        forecastedComparableCount >= 2
          ? "high"
          : forecastedComparableCount === 1 || forecastedNearCount >= 1
            ? "medium"
            : "low";
      const highestMeaningfulTierDisappeared =
        profile.overallTierOrigin === "source" &&
        forecast.currentPocket.highestMeaningfulOverallTier ===
          profile.overallTier &&
        !forecastedPocketRankings.some((ranking) => {
          return (
            ranking.overallTierOrigin === "source" &&
            ranking.overallTier === profile.overallTier
          );
        });

      return {
        profile,
        anchorPlayerId: anchor.player.id,
        anchorOverallRank: anchor.overallRank,
        currentPlayerIds: currentProfileRankings.map(
          (ranking) => ranking.player.id,
        ),
        currentProfileCount: currentProfileRankings.length,
        forecastedComparablePlayerIds: comparableRankings.map(
          (ranking) => ranking.player.id,
        ),
        forecastedNearPlayerIds: nearRankings.map(
          (ranking) => ranking.player.id,
        ),
        forecastedExactProfileCount,
        forecastedComparableCount,
        forecastedNearCount,
        replacementQuality,
        skipSafety: replacementQuality,
        exactProfileDisappeared: forecastedExactProfileCount === 0,
        highestMeaningfulTierDisappeared,
      } satisfies DraftPocketProfileTransition;
    })
    .sort((a, b) => {
      if (a.anchorOverallRank !== b.anchorOverallRank) {
        return a.anchorOverallRank - b.anchorOverallRank;
      }

      return a.anchorPlayerId.localeCompare(b.anchorPlayerId);
    });
}

function createNeutralCandidateSignal({
  candidate,
  forecast,
  candidateInCurrentPocket,
}: {
  candidate: RecommendationRankingFact;
  forecast: DraftPocketForecast;
  candidateInCurrentPocket: boolean;
}): CandidatePocketSignal {
  return {
    candidatePlayerId: candidate.player.id,
    candidatePosition: candidate.player.position,
    profile: createProfile(candidate),
    profileAnchorPlayerId: null,
    profileOrdinal: null,
    allocationRole: "neutral",
    candidateInCurrentPocket,
    candidateInForecastedPocket:
      forecast.forecastedPocket?.playerIds.includes(candidate.player.id) ?? false,
    comparableReplacementCount: 0,
    nearReplacementCount: 0,
    replacementQuality: "neutral",
    skipSafety: "neutral",
    currentProfileCount: 0,
    forecastedProfileCount: 0,
    profileDisappeared: false,
    highestMeaningfulTierDisappeared: false,
  };
}

function getAllocationRole(
  skipSafety: DraftPocketProfileTransition["skipSafety"],
  profileOrdinal: number,
): DraftPocketTimingAllocationRole {
  if (skipSafety === "low") {
    return profileOrdinal === 1 ? "full" : "reduced";
  }

  if (skipSafety === "medium" && profileOrdinal === 1) {
    return "full";
  }

  return "neutral";
}

export function createCandidatePocketSignal({
  candidate,
  forecast,
  profileTransitions,
}: CreateCandidatePocketSignalInput): CandidatePocketSignal {
  const candidateInCurrentPocket = forecast.currentPocket.playerIds.includes(
    candidate.player.id,
  );

  if (
    forecast.status !== "active" ||
    forecast.forecastedPocket === null ||
    !candidateInCurrentPocket
  ) {
    return createNeutralCandidateSignal({
      candidate,
      forecast,
      candidateInCurrentPocket,
    });
  }

  const matchingTransitions = profileTransitions.filter((transition) => {
    return transition.currentPlayerIds.includes(candidate.player.id);
  });

  if (matchingTransitions.length !== 1) {
    throw new Error(
      `Current-pocket candidate ${candidate.player.id} must resolve to exactly one draft-pocket profile transition.`,
    );
  }

  const [transition] = matchingTransitions;
  const candidateProfile = createProfile(candidate);

  if (getProfileKey(transition.profile) !== getProfileKey(candidateProfile)) {
    throw new Error(
      `Candidate ${candidate.player.id} does not match its draft-pocket profile transition.`,
    );
  }

  const profileIndexes = transition.currentPlayerIds.flatMap((playerId, index) => {
    return playerId === candidate.player.id ? [index] : [];
  });

  if (profileIndexes.length !== 1) {
    throw new Error(
      `Candidate ${candidate.player.id} must appear exactly once in its draft-pocket profile transition.`,
    );
  }

  const profileOrdinal = profileIndexes[0] + 1;
  const candidateInForecastedPocket = forecast.forecastedPocket.playerIds.includes(
    candidate.player.id,
  );

  return {
    candidatePlayerId: candidate.player.id,
    candidatePosition: candidate.player.position,
    profile: transition.profile,
    profileAnchorPlayerId: transition.anchorPlayerId,
    profileOrdinal,
    allocationRole: getAllocationRole(transition.skipSafety, profileOrdinal),
    candidateInCurrentPocket,
    candidateInForecastedPocket,
    comparableReplacementCount: transition.forecastedComparableCount,
    nearReplacementCount: transition.forecastedNearCount,
    replacementQuality: transition.replacementQuality,
    skipSafety: transition.skipSafety,
    currentProfileCount: transition.currentProfileCount,
    forecastedProfileCount: transition.forecastedExactProfileCount,
    profileDisappeared: transition.exactProfileDisappeared,
    highestMeaningfulTierDisappeared:
      transition.highestMeaningfulTierDisappeared,
  };
}

export function createDraftPocketForecast({
  draft,
  rankings,
  userTeamId,
}: CreateDraftPocketForecastInput): DraftPocketForecast {
  const currentBoard = getCurrentBoard(draft, rankings);
  const currentBoardPlayerIds = currentBoard.map((ranking) => ranking.player.id);
  const currentPocket = createDraftPocket(currentBoard);
  const targetPickNumber = getTargetPickNumber(draft, userTeamId);

  if (targetPickNumber === null) {
    return {
      status: "no-next-pick",
      targetPickNumber: null,
      picksToRemove: null,
      missingAdpFallback: null,
      currentBoardPlayerIds,
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
      currentPocket,
      forecastedPocket: null,
    };
  }

  const picksToRemove = targetPickNumber - draft.currentPickNumber;
  const validAdpValues = rankings.flatMap((ranking) => {
    return ranking.adpRank === null ? [] : [ranking.adpRank];
  });

  if (validAdpValues.length === 0) {
    return {
      status: "no-adp",
      targetPickNumber,
      picksToRemove,
      missingAdpFallback: null,
      currentBoardPlayerIds,
      removalWindowPlayerIds: [],
      forecastedBoardPlayerIds: [],
      currentPocket,
      forecastedPocket: null,
    };
  }

  const missingAdpFallback = Math.max(...validAdpValues) + 1;
  const removalOrder = currentBoard
    .map((ranking) => ({
      ranking,
      normalizedAdp: ranking.adpRank ?? missingAdpFallback,
    }))
    .sort(compareByForecastRemoval);
  const removalWindowPlayerIds = removalOrder
    .slice(0, picksToRemove)
    .map(({ ranking }) => ranking.player.id);
  const forecastedBoard = removalOrder
    .slice(picksToRemove)
    .map(({ ranking }) => ranking)
    .sort(compareByOverallRank);
  const forecastedBoardPlayerIds = forecastedBoard.map((ranking) => ranking.player.id);

  return {
    status: "active",
    targetPickNumber,
    picksToRemove,
    missingAdpFallback,
    currentBoardPlayerIds,
    removalWindowPlayerIds,
    forecastedBoardPlayerIds,
    currentPocket,
    forecastedPocket: createDraftPocket(forecastedBoard),
  };
}
