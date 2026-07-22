import { PluginHealth, PreparedWorkspace, QualityPlugin, QualityResult, TitingTask, ExecutionResult } from "@diting/plugin-api";
import {
  buildQualityLayers,
  calculateQualityScore,
  collectAutomationReportScores,
  collectDiffRisk,
  deriveRiskLevel,
  runQualityScripts
} from "./shared";

/** Runs layered static/unit/startup checks, scores automation reports, then derives pass/fail and score. */
export class DefaultQualityPlugin implements QualityPlugin {
  readonly id = "default-quality";
  readonly kind = "quality" as const;
  readonly priority = 100;
  readonly capabilities = ["default"];

  constructor(private readonly timeoutMs: number) {}

  /** Always healthy; messaging only. */
  async health(): Promise<PluginHealth> {
    return { healthy: true, message: "Script-based quality gate enabled" };
  }

  /**
   * Quality chain: static/unit/startup scripts → existing API/UI automation reports → git diff/size risk → acceptance row.
   * Pass requires clean exit and all non-skipped script/report checks OK. Diff risk remains advisory.
   */
  async evaluate(input: { execution: ExecutionResult; task: TitingTask; workspace: PreparedWorkspace }): Promise<QualityResult> {
    const scriptResult = await runQualityScripts(input.workspace, this.timeoutMs);
    const scriptCommands = scriptResult.scripts;
    const automationReport = await collectAutomationReportScores(input.workspace, input.task);
    const qualityLayers = buildQualityLayers(scriptCommands, automationReport.checks);
    const diffReport = await collectDiffRisk(input.workspace, this.timeoutMs);
    const exitCodePassed = input.execution.exitCode === 0;
    const commandChecks = scriptCommands.map((command) => ({
      name: `${command.layer}/${command.name}`,
      passed: command.passed,
      detail: command.detail
    }));
    const automationChecks = automationReport.checks.map((check) => ({
      name: `automation-report/${check.name}`,
      passed: check.passed,
      detail: check.detail
    }));
    const qualityChecks = [...scriptCommands, ...automationReport.checks];
    const riskLevel = deriveRiskLevel(diffReport, qualityChecks, input.execution.timedOut);
    const acceptancePassed = exitCodePassed && commandChecks.every((check) => check.passed) && automationChecks.every((check) => check.passed);
    const passed = acceptancePassed;

    return {
      passed,
      score: calculateQualityScore(exitCodePassed, qualityChecks, riskLevel),
      riskLevel,
      checks: [
        {
          name: "executor-exit-code",
          passed: exitCodePassed,
          detail: exitCodePassed ? "Executor exited cleanly" : `Exit code ${input.execution.exitCode}`
        },
        ...commandChecks,
        ...automationChecks,
        {
          name: "diff-risk",
          passed: true,
          detail: `files=${diffReport.filesChanged}, insertions=${diffReport.insertions}, deletions=${diffReport.deletions}, risk=${riskLevel}`
        },
        {
          name: "acceptance-criteria",
          passed: acceptancePassed,
          detail: input.task.acceptanceCriteria.length > 0
            ? `Inferred from automation: ${input.task.acceptanceCriteria.join("; ")}`
            : "No explicit acceptance criteria"
        }
      ],
      report: {
        timedOut: input.execution.timedOut,
        layers: qualityLayers,
        scripts: scriptCommands,
        automationReports: automationReport.reports,
        diff: diffReport,
        perRepoDiff: (diffReport as { perRepo?: Record<string, unknown> }).perRepo ?? {}
      }
    };
  }
}
