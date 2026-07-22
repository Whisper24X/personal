import { evaluateQualityEvidence } from "./quality-evidence";

describe("quality evidence", () => {
  it("passes when required API and UI evidence are present and code review has no blockers", () => {
    const result = evaluateQualityEvidence({
      automationRequirements: { api: "required", ui: "required" },
      artifactPaths: {
        apiAutomationReport: "/tmp/artifacts/api-report.json",
        uiAutomationReport: "/tmp/artifacts/ui-report.json",
        codeReviewReport: "/tmp/artifacts/code-review-report.json"
      },
      codeReviewReport: {
        schemaVersion: "2026-07-03",
        reviewArtifactId: "review-1",
        executionId: "exec-1",
        findings: [{ severity: "MINOR", title: "nit", detail: "ok" }],
        summary: "no blockers"
      }
    });

    expect(result).toEqual({
      passed: true,
      failures: []
    });
  });

  it("passes when API and UI automation are explicitly not applicable with reasons", () => {
    const result = evaluateQualityEvidence({
      automationRequirements: {
        api: { status: "not_applicable", reason: "no API changes" },
        ui: { status: "not_applicable", reason: "backend-only change" }
      },
      artifactPaths: {
        codeReviewReport: "/tmp/artifacts/code-review-report.json"
      },
      codeReviewReport: {
        schemaVersion: "2026-07-03",
        reviewArtifactId: "review-1",
        executionId: "exec-1",
        findings: [],
        summary: "no blockers"
      }
    });

    expect(result.passed).toBe(true);
  });

  it("fails when required UI evidence is missing", () => {
    const result = evaluateQualityEvidence({
      automationRequirements: { ui: "required" },
      artifactPaths: {
        codeReviewReport: "/tmp/artifacts/code-review-report.json"
      },
      codeReviewReport: {
        schemaVersion: "2026-07-03",
        reviewArtifactId: "review-1",
        executionId: "exec-1",
        findings: [],
        summary: "no blockers"
      }
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join("\n")).toContain("ui automation evidence is required");
  });

  it("fails when code review report is missing", () => {
    const result = evaluateQualityEvidence({
      automationRequirements: {},
      artifactPaths: {}
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join("\n")).toContain("code-review-report.json is required");
  });

  it.each(["CRITICAL", "IMPORTANT"] as const)("fails on %s code review finding", (severity) => {
    const result = evaluateQualityEvidence({
      automationRequirements: {},
      artifactPaths: {
        codeReviewReport: "/tmp/artifacts/code-review-report.json"
      },
      codeReviewReport: {
        schemaVersion: "2026-07-03",
        reviewArtifactId: "review-1",
        executionId: "exec-1",
        findings: [{ severity, title: "bug", detail: "must fix" }],
        summary: "blockers found"
      }
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join("\n")).toContain(severity);
  });
});
