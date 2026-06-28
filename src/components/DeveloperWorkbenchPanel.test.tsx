import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  DeveloperWorkbenchPanel,
  type WorkbenchStatus,
} from "@/components/DeveloperWorkbenchPanel";

describe("DeveloperWorkbenchPanel", () => {
  it("renders persisted controls and status", () => {
    const markup = renderPanel({
      mode: "persisted",
      name: "draft-1",
      source: "Persisted workspace",
      replayTarget: null,
      appliedPickCount: 3,
      isDirty: false,
    });

    expect(markup).toContain("Developer Workbench");
    expect(markup).toContain("Persisted Draft");
    expect(markup).toContain("Persisted workspace");
    expect(markup).toContain("Not applicable");
    expect(markup).toContain("Applied picks");
    expect(markup).toContain(">3<");
    expect(markup).toContain(">No<");
    expect(markup).toContain("Early Non-Default Pressure");
    expect(markup).toContain("Completed Draft");
    expect(markup).toContain('accept=".json,application/json"');
    expect(markup).toContain("Export Scenario");
  });

  it("renders scenario source, target, dirty state, and errors", () => {
    const markup = renderPanel(
      {
        mode: "scenario",
        name: "Early Non-Default Pressure",
        source: "Curated: early-non-default-pressure",
        replayTarget: 8,
        appliedPickCount: 9,
        isDirty: true,
      },
      {
        selectedCuratedScenarioId: "early-non-default-pressure",
        errors: ["schemaVersion: schemaVersion must be 1."],
        canResetScenario: true,
        canRestartTransient: true,
      },
    );

    expect(markup).toContain("Transient Scenario");
    expect(markup).toContain("Curated: early-non-default-pressure");
    expect(markup).toContain(">8<");
    expect(markup).toContain(">9<");
    expect(markup).toContain(">Yes<");
    expect(markup).toContain("schemaVersion: schemaVersion must be 1.");
    expect(markup).toContain('aria-live="polite"');
  });

  it("renders transient-manual and pending disabled states", () => {
    const markup = renderPanel(
      {
        mode: "transient-manual",
        name: "Restarted Configuration",
        source: "Restarted transient configuration",
        replayTarget: null,
        appliedPickCount: 0,
        isDirty: false,
      },
      {
        isPending: true,
        canResetScenario: false,
        canRestartTransient: true,
      },
    );

    expect(markup).toContain("Transient Manual");
    expect(markup).toContain("Restarted transient configuration");
    expect(markup).toMatch(/<select[^>]*disabled=""/);
    expect(markup).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Reset Scenario<\/button>/);
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Restart Configuration<\/button>/,
    );
  });
});

function renderPanel(
  status: WorkbenchStatus,
  overrides: Partial<Parameters<typeof DeveloperWorkbenchPanel>[0]> = {},
) {
  return renderToStaticMarkup(
    <DeveloperWorkbenchPanel
      status={status}
      selectedCuratedScenarioId=""
      errors={[]}
      isPending={false}
      canResetScenario={false}
      canRestartTransient={false}
      onSelectCuratedScenario={vi.fn()}
      onImportFile={vi.fn()}
      onExport={vi.fn()}
      onResetScenario={vi.fn()}
      onRestartTransient={vi.fn()}
      {...overrides}
    />,
  );
}
