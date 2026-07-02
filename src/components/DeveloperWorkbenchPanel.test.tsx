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
    expect(markup).toMatch(/<details(?![^>]*open="")[^>]*>/);
    expect(markup).toContain("<summary");
    expect(markup).toContain("Expand");
    expect(markup).toContain("Minimize");
    expect(markup).toContain("Persisted Draft");
    expect(markup).toContain("Persisted workspace");
    expect(markup).toContain("Not applicable");
    expect(markup).toContain("Applied picks");
    expect(markup).toContain(">3<");
    expect(markup).toContain(">No<");
    expect(markup).toContain("Scenario Files");
    expect(markup).toContain("Open saved scenario");
    expect(markup).toContain("Local files are not stored by the app");
    expect(markup).not.toContain("Curated scenario");
    expect(markup).not.toContain("<select");
    expect(markup).toContain('accept=".json,application/json"');
    expect(markup).toContain("Export Scenario");
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Apply Target<\/button>/);
  });

  it("renders scenario source, target, dirty state, and errors", () => {
    const markup = renderPanel(
      {
        mode: "scenario",
        name: "Early Non-Default Pressure",
        source: "Imported file: exported-draft-scenario.json",
        replayTarget: 8,
        appliedPickCount: 9,
        isDirty: true,
      },
      {
        errors: ["schemaVersion: schemaVersion must be 1."],
        canResetScenario: true,
        canRestartTransient: true,
        replayTargetInput: "6",
        replayTargetMax: 12,
        canApplyReplayTarget: true,
      },
    );

    expect(markup).toContain("Transient Scenario");
    expect(markup).toContain("Imported file: exported-draft-scenario.json");
    expect(markup).toContain(">8<");
    expect(markup).toContain(">9<");
    expect(markup).toContain(">Yes<");
    expect(markup).toContain("schemaVersion: schemaVersion must be 1.");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toMatch(
      /<input[^>]*type="number"[^>]*min="0"[^>]*max="12"[^>]*step="1"[^>]*value="6"/,
    );
    expect(markup).toContain("0 through 12 applied picks.");
    expect(markup).not.toMatch(
      /<button[^>]*disabled=""[^>]*>Apply Target<\/button>/,
    );
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
    expect(markup).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
    expect(markup).toMatch(/<input[^>]*type="number"[^>]*disabled=""/);
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
      errors={[]}
      isPending={false}
      canResetScenario={false}
      canRestartTransient={false}
      replayTargetInput=""
      replayTargetMax={null}
      canApplyReplayTarget={false}
      onReplayTargetInputChange={vi.fn()}
      onApplyReplayTarget={vi.fn()}
      onImportFile={vi.fn()}
      onExport={vi.fn()}
      onResetScenario={vi.fn()}
      onRestartTransient={vi.fn()}
      {...overrides}
    />,
  );
}
