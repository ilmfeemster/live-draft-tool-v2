import type { Position, RankingEntry } from "@/types/draft";
import type {
  RankingRecommendationTierSemantics,
  RankingSet,
  RankingSetCapabilities,
  RankingSetSource,
  RankingSetSourceKind,
  RankingSourceTierSemantics,
} from "@/types/rankings";

export type RankingImportFormatId =
  | "fantasypros-csv"
  | "canonical-ranking-json";

export type RankingImportFormatRef = Readonly<{
  id: RankingImportFormatId;
  version: 1;
}>;

export type RankingImportStage =
  | "preflight"
  | "parse"
  | "normalize"
  | "validate"
  | "convert"
  | "persist";

export type RankingImportDiagnosticSeverity = "error" | "warning";

export type RankingImportDiagnosticLocation = Readonly<{
  path?: string;
  row?: number;
  column?: number;
  field?: string;
}>;

export type RankingImportDiagnostic<TCode extends string = string> = Readonly<{
  code: TCode;
  stage: RankingImportStage;
  severity: RankingImportDiagnosticSeverity;
  message: string;
  location?: RankingImportDiagnosticLocation;
}>;

export type RankingImportStageResult<
  TValue,
  TCode extends string = string,
> =
  | Readonly<{
      ok: true;
      value: TValue;
      warnings: readonly RankingImportDiagnostic<TCode>[];
    }>
  | Readonly<{
      ok: false;
      errors: readonly RankingImportDiagnostic<TCode>[];
      warnings: readonly RankingImportDiagnostic<TCode>[];
    }>;

export type PreflightRankingDocument = Readonly<{
  format: RankingImportFormatRef;
  text: string;
  byteLength: number;
}>;

export type ParsedRankingField = Readonly<{
  value: unknown;
  location: RankingImportDiagnosticLocation;
}>;

export type ParsedRankingSourceRecord = Readonly<{
  sourceIndex: number;
  fields: Readonly<Record<string, ParsedRankingField>>;
}>;

export type RankingTierSemanticKind =
  | "source-only"
  | "recommendation-eligible"
  | "unsupported"
  | "absent"
  | "neutral"
  | "legacy-ambiguous";

export type RankingTierSemanticScope = "overall" | "position" | "unknown";

export type RankingTierSemanticContract = Readonly<{
  kind: RankingTierSemanticKind;
  sourceScope?: RankingTierSemanticScope;
  recommendationEligible: boolean;
}>;

export type ParsedRankingSourceDocument = Readonly<{
  format: RankingImportFormatRef;
  metadata: unknown;
  tierSemantics?: RankingTierSemanticContract;
  records: readonly ParsedRankingSourceRecord[];
}>;

export type RankingNormalizationContext = Readonly<{
  name?: string;
  sourceLabel?: string;
  importedAt: Date;
}>;

export type NormalizedRankingCandidateField =
  | "playerId"
  | "playerName"
  | "team"
  | "position"
  | "sourceOrder"
  | "sourcePositionRank"
  | "sourceTier"
  | "tier"
  | "adpRank";

export type NormalizedRankingCandidateEntry = Readonly<{
  sourceIndex: number;
  location: RankingImportDiagnosticLocation;
  fieldLocations: Readonly<
    Partial<
      Record<
        NormalizedRankingCandidateField,
        RankingImportDiagnosticLocation
      >
    >
  >;
  playerId: string | null;
  playerName: string | null;
  team: string | null;
  position: string | null;
  sourceOrder: number | null;
  sourcePositionRank: number | null;
  sourceTier?: number | null;
  tier: number | null;
  adpRank: number | null;
}>;

export type NormalizedRankingTierSemantics = Readonly<{
  sourceKind: RankingSourceTierSemantics;
  recommendation: Readonly<
    Partial<Record<Position, RankingRecommendationTierSemantics>>
  >;
}>;

export type NormalizedRankingCandidate = Readonly<{
  name: string;
  source: RankingSetSource;
  capabilities: RankingSetCapabilities;
  tierSemantics?: NormalizedRankingTierSemantics;
  entries: readonly NormalizedRankingCandidateEntry[];
}>;

export type ValidatedRankingCandidate = Readonly<{
  validated: true;
  candidate: NormalizedRankingCandidate;
}>;

export type ConvertedRankingSet = Readonly<{
  converted: true;
  rankingSet: RankingSet;
}>;

export type CanonicalRankingSetSourceV1 = Readonly<{
  kind: RankingSetSourceKind;
  formatId?: string;
  formatVersion?: number;
  label?: string;
  importedAt?: string;
}>;

export type CanonicalRankingSetDocumentV1 = Readonly<{
  schemaVersion: 1;
  metadata: Readonly<{
    name: string;
    exportedAt: string;
    sourceRankingSetId?: string;
    source?: CanonicalRankingSetSourceV1;
  }>;
  capabilities: RankingSetCapabilities;
  entries: readonly RankingEntry[];
}>;

export type CanonicalRankingSetEntryV2 = Readonly<
  Omit<RankingEntry, "tier"> & {
    sourceTier: number | null;
    recommendationTier: number;
  }
>;

export type CanonicalRankingSetTierSemanticsV2 = Readonly<{
  sourceTier: RankingTierSemanticContract;
  recommendationTier: RankingTierSemanticContract;
  legacyTier?: RankingTierSemanticContract;
}>;

export type CanonicalRankingSetDocumentV2 = Readonly<{
  schemaVersion: 2;
  metadata: CanonicalRankingSetDocumentV1["metadata"];
  tierSemantics: CanonicalRankingSetTierSemanticsV2;
  capabilities: RankingSetCapabilities;
  entries: readonly CanonicalRankingSetEntryV2[];
}>;
