import { buildDiagnosis } from "./diagnose-task";

describe("buildDiagnosis", () => {
  it("summarizes the latest execution, eval failures, and inferred stop reason", () => {
    const diagnosis = buildDiagnosis({
      task: {
        id: "task-1",
        external_id: "MEEGLE-1",
        source: "meegle",
        status: "needs_human",
        executor: "codex",
        trace_id: "trace-1",
        retry_count: 1,
        repair_count: 2,
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T01:00:00.000Z",
        started_at: "2026-05-11T00:10:00.000Z",
        completed_at: "2026-05-11T00:40:00.000Z"
      },
      executions: [
        {
          id: "exec-1",
          status: "failed",
          summary: "build failed",
          agent_id: "agent-1",
          started_at: "2026-05-11T00:10:00.000Z",
          ended_at: "2026-05-11T00:20:00.000Z"
        }
      ],
      evalResults: [
        {
          id: "eval-1",
          passed: false,
          score: 30,
          risk_level: "medium",
          created_at: "2026-05-11T00:21:00.000Z",
          report_json: {
            checks: [
              { name: "build", passed: false, detail: "compile error" },
              { name: "lint", passed: true, detail: "ok" }
            ]
          }
        }
      ],
      repairGoal: {
        status: "budget_limited",
        iteration: 3,
        max_iterations: 3,
        objective: "Fix build",
        last_failure_hash: "hash-1"
      },
      transitions: [
        {
          from_status: "evaluating",
          to_status: "needs_human",
          reason: "Repair budget exhausted",
          created_at: "2026-05-11T00:22:00.000Z"
        }
      ],
      logs: [
        {
          event_type: "execution.failed",
          message: "Repair budget exhausted",
          created_at: "2026-05-11T00:22:00.000Z"
        }
      ]
    });

    expect(diagnosis.summary.taskId).toBe("task-1");
    expect(diagnosis.latestEvaluation?.failedChecks).toEqual([
      { name: "build", passed: false, detail: "compile error" }
    ]);
    expect(diagnosis.repairGoal).toEqual(expect.objectContaining({
      status: "budget_limited",
      iteration: 3
    }));
    expect(diagnosis.inferredFailureMode.stopReason).toBe("repair_budget_exhausted");
  });

  it("surfaces OpenSpec local path for product review diagnostics", () => {
    const diagnosis = buildDiagnosis({
      task: {
        id: "task-product",
        external_id: "MEEGLE-2",
        source: "meegle",
        status: "needs_human",
        executor: "product",
        agent_kind: "product",
        driver_id: "openspec-product",
        trace_id: "trace-product",
        retry_count: 0,
        repair_count: 0,
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T01:00:00.000Z",
        started_at: "2026-05-11T00:10:00.000Z",
        completed_at: "2026-05-11T00:40:00.000Z",
        metadata_json: {
          openSpecReview: {
            externalId: "review-1",
            openspecPath: "/tmp/diting/workspace/openspec/changes/add-demo"
          }
        }
      },
      executions: [],
      evalResults: [],
      repairGoal: undefined,
      transitions: [],
      logs: []
    });

    expect(diagnosis.inferredFailureMode.productReview?.openspecPath).toBe("/tmp/diting/workspace/openspec/changes/add-demo");
  });

  it("surfaces quality artifact paths from task metadata", () => {
    const diagnosis = buildDiagnosis({
      task: {
        id: "task-quality",
        external_id: "MEEGLE-3",
        source: "meegle",
        status: "ready",
        executor: "programming",
        agent_kind: "programming",
        driver_id: "coding",
        trace_id: "trace-quality",
        retry_count: 0,
        repair_count: 1,
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T01:00:00.000Z",
        started_at: "2026-05-11T00:10:00.000Z",
        completed_at: null,
        metadata_json: {
          implementationHandoffPath: "/tmp/task/artifacts/implementation-handoff.json",
          qualityReportPath: "/tmp/task/artifacts/quality-report.json",
          qualityRepairHandoffPath: "/tmp/task/artifacts/quality-repair-handoff.json"
        }
      },
      executions: [],
      evalResults: [],
      repairGoal: undefined,
      transitions: [],
      logs: []
    });

    expect(diagnosis.inferredFailureMode.qualityArtifacts).toEqual({
      implementationHandoffPath: "/tmp/task/artifacts/implementation-handoff.json",
      qualityReportPath: "/tmp/task/artifacts/quality-report.json",
      qualityRepairHandoffPath: "/tmp/task/artifacts/quality-repair-handoff.json"
    });
  });
});
