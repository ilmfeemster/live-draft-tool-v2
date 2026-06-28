import completedDraftDocument from "@/data/scenarios/completed-draft.json";
import earlyPressureDocument from "@/data/scenarios/early-non-default-pressure.json";
import {
  importScenarioV1Json,
  type ImportScenarioV1Result,
} from "@/lib/scenarioPortability";

export const CURATED_SCENARIO_IDS = [
  "early-non-default-pressure",
  "completed-draft",
] as const;

export type CuratedScenarioId = (typeof CURATED_SCENARIO_IDS)[number];

export type CuratedScenarioCatalogEntry = {
  id: CuratedScenarioId;
  json: string;
};

const earlyPressureRawDocument: unknown = earlyPressureDocument;
const completedDraftRawDocument: unknown = completedDraftDocument;

export const curatedScenarioCatalog: CuratedScenarioCatalogEntry[] = [
  {
    id: "early-non-default-pressure",
    json: JSON.stringify(earlyPressureRawDocument),
  },
  {
    id: "completed-draft",
    json: JSON.stringify(completedDraftRawDocument),
  },
];

export function loadCuratedScenario(
  id: CuratedScenarioId,
): ImportScenarioV1Result {
  const entry = curatedScenarioCatalog.find((candidate) => candidate.id === id);

  if (!entry) {
    throw new Error(`Curated scenario ${id} is not registered.`);
  }

  return importScenarioV1Json(entry.json);
}
