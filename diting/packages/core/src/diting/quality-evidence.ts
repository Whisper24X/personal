export type AutomationRequirement =
  | "required"
  | "optional"
  | {
      status: "required" | "optional" | "not_applicable";
      reason?: string;
    };

export type QualityEvidenceInput = {
  automationRequirements: {
    api?: AutomationRequirement;
    ui?: AutomationRequirement;
  };
  artifactPaths: {
    apiAutomationReport?: string;
    uiAutomationReport?: string;
    codeReviewReport?: string;
  };
  codeReviewReport?: CodeReviewReport;
};

export type CodeReviewFindingSeverity = "CRITICAL" | "IMPORTANT" | "MINOR" | "INFO" | string;

export type CodeReviewReport = {
  schemaVersion: string;
  reviewArtifactId?: string;
  executionId?: string;
  findings: Array<{
    severity: CodeReviewFindingSeverity;
    title: string;
    detail?: string;
  }>;
  summary: string;
};

export type QualityEvidenceResult = {
  passed: boolean;
  failures: string[];
};

export function evaluateQualityEvidence(input: QualityEvidenceInput): QualityEvidenceResult {
  const failures: string[] = [];
  evaluateAutomationRequirement("api", input.automationRequirements.api, input.artifactPaths.apiAutomationReport, failures);
  evaluateAutomationRequirement("ui", input.automationRequirements.ui, input.artifactPaths.uiAutomationReport, failures);

  if (!input.artifactPaths.codeReviewReport || !input.codeReviewReport) {
    failures.push("code-review-report.json is required");
  } else {
    if (!input.codeReviewReport.reviewArtifactId) {
      failures.push("code review report must include reviewArtifactId");
    }
    if (!input.codeReviewReport.executionId) {
      failures.push("code review report must include executionId");
    }
    for (const finding of input.codeReviewReport.findings) {
      if (finding.severity === "CRITICAL" || finding.severity === "IMPORTANT") {
        failures.push(`code review finding ${finding.severity}: ${finding.title}`);
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures
  };
}

function evaluateAutomationRequirement(
  kind: "api" | "ui",
  requirement: AutomationRequirement | undefined,
  reportPath: string | undefined,
  failures: string[]
): void {
  const normalized = normalizeAutomationRequirement(requirement);
  if (normalized.status === "not_applicable") {
    if (!normalized.reason) {
      failures.push(`${kind} automation not_applicable requires a reason`);
    }
    return;
  }
  if (normalized.status === "required" && !reportPath) {
    failures.push(`${kind} automation evidence is required`);
  }
}

function normalizeAutomationRequirement(requirement: AutomationRequirement | undefined): {
  status: "required" | "optional" | "not_applicable";
  reason?: string;
} {
  if (!requirement) {
    return { status: "optional" };
  }
  if (typeof requirement === "string") {
    return { status: requirement };
  }
  return requirement;
}
