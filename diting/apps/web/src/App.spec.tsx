import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { I18nProvider } from "./i18n";
import { AgentsRunsView } from "./run-observability";

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {
    MockEventSource.instances.push(this);
  }

  close() {}
}

function createRunMocks() {
  return {
    runs: [
      {
        id: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        workspace: "/tmp/ws",
        status: "completed",
        summary: "done",
        executor: "codex",
        startedAt: "2026-05-11T00:00:00.000Z",
        endedAt: "2026-05-11T00:05:00.000Z"
      }
    ],
    observability: {
      schemaVersion: "2026-05-11",
      run: {
        id: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        workspace: "/tmp/ws",
        status: "completed",
        summary: "done",
        executor: "codex",
        startedAt: "2026-05-11T00:00:00.000Z",
        endedAt: "2026-05-11T00:05:00.000Z"
      },
      stages: [
        { key: "workspace", label: "Workspace", status: "done", startedAt: null, endedAt: null, summary: null },
        { key: "execute", label: "Execute", status: "done", startedAt: null, endedAt: null, summary: null },
        {
          key: "completion_gate",
          label: "Completion Gate",
          status: "done",
          startedAt: "2026-05-11T00:02:00.000Z",
          endedAt: "2026-05-11T00:02:30.000Z",
          summary: "Run passed completion gate"
        }
      ],
      steps: [
        {
          id: "step-1",
          runId: "exec-1",
          stage: "execute",
          status: "done",
          title: "Executor completed",
          message: "Executor completed",
          pluginId: "cursor",
          startedAt: "2026-05-11T00:01:00.000Z",
          endedAt: "2026-05-11T00:02:00.000Z",
          error: null
        },
        {
          id: "step-completion-gate",
          runId: "exec-1",
          stage: "completion_gate",
          status: "done",
          title: "Completion gate evaluated",
          message: "Completion gate passed",
          pluginId: "openspec-completion-gate",
          startedAt: "2026-05-11T00:02:00.000Z",
          endedAt: "2026-05-11T00:02:30.000Z",
          error: null
        }
      ],
      plugins: [
        {
          pluginId: "cursor",
          kind: "execution",
          participationSource: "actual",
          fallbackReason: null,
          status: "done",
          health: "healthy",
          summary: null,
          lastEventAt: null
        },
        {
          pluginId: "openspec-completion-gate",
          kind: "completion-gate",
          participationSource: "actual",
          fallbackReason: null,
          status: "done",
          health: "healthy",
          summary: null,
          lastEventAt: null
        }
      ],
      rawLogs: {
        available: true,
        endpoint: "/api/runs/exec-1/raw-logs",
        sources: ["stdout", "stderr", "summary"],
        scope: "run",
        redacted: true
      }
    },
    rawLogs: {
      schemaVersion: "2026-05-11",
      runId: "exec-1",
      taskId: "task-1",
      scope: "run",
      redacted: true,
      items: [
        {
          id: "exec-1:stderr:1",
          runId: "exec-1",
          taskId: "task-1",
          source: "stderr",
          channel: "executor_stderr",
          stage: "execute",
          pluginId: "cursor",
          createdAt: "2026-05-11T00:02:00.000Z",
          text: JSON.stringify({
            level: "error",
            message: "npm test failed",
            error: "timeout waiting for worker",
            traceId: "trace-raw-1",
            durationMs: 1200
          }),
          redacted: true
        },
        {
          id: "exec-1:stdout:1",
          runId: "exec-1",
          taskId: "task-1",
          source: "stdout",
          channel: "executor_stdout",
          stage: "execute",
          pluginId: null,
          createdAt: "2026-05-11T00:01:30.000Z",
          text: JSON.stringify({
            result: "# Install result\n\n- dependencies completed\n- tests skipped\n\n| Check | Status |\n| --- | --- |\n| lint | pass |\n| typecheck | pass |",
            exitCode: 0
          }),
          redacted: false
        },
        {
          id: "exec-1:stdout:codex-thread",
          runId: "exec-1",
          taskId: "task-1",
          source: "stdout",
          channel: "executor_stdout",
          stage: "execute",
          pluginId: "codex",
          createdAt: "2026-05-11T00:01:40.000Z",
          text: JSON.stringify({
            type: "thread.started",
            thread_id: "019ea674-2581-78d0-8caf-c4985717f9f3"
          }),
          redacted: false
        },
        {
          id: "exec-1:stdout:codex-msg",
          runId: "exec-1",
          taskId: "task-1",
          source: "stdout",
          channel: "executor_stdout",
          stage: "execute",
          pluginId: "codex",
          createdAt: "2026-05-11T00:01:45.000Z",
          text: JSON.stringify({
            type: "item.completed",
            item: {
              id: "item_0",
              type: "agent_message",
              text: "Use superpowers to implement personal website"
            }
          }),
          redacted: false
        },
        {
          id: "exec-1:stdout:codex-cmd",
          runId: "exec-1",
          taskId: "task-1",
          source: "stdout",
          channel: "executor_stdout",
          stage: "execute",
          pluginId: "codex",
          createdAt: "2026-05-11T00:01:50.000Z",
          text: JSON.stringify({
            type: "item.completed",
            item: {
              id: "item_1",
              type: "command_execution",
              command: "npm test",
              aggregated_output: "all 15 tests passed",
              exit_code: 0,
              status: "completed"
            }
          }),
          redacted: false
        },
        {
          id: "exec-1:stdout:codex-zsh-cmd",
          runId: "exec-1",
          taskId: "task-1",
          source: "stdout",
          channel: "executor_stdout",
          stage: "execute",
          pluginId: null,
          createdAt: "2026-05-11T00:01:55.000Z",
          text: JSON.stringify({
            type: "item.completed",
            item: {
              id: "item_5",
              type: "command_execution",
              command: "/bin/zsh -lc \"sed -n '1,260p' skills/openspec-superpowers-workflow/SKILL.md\"",
              aggregated_output: [
                "---",
                "name: openspec-superpowers-workflow",
                "---",
                "",
                "# OpenSpec + Superpowers 融合编排流程",
                "",
                "将 Superpowers 的工程纪律与 OpenSpec 的变更管理融合为一个不可跳过的编排流程。",
                "  - `openspec validate` → 人工检查并继续后续流程"
              ].join("\n")
            }
          }).repeat(20).slice(0, 2000),
          redacted: false
        }
      ],
      nextCursor: null
    }
  };
}

function matchRunsEndpoint(url: string): boolean {
  return url.includes("/runs") && !url.includes("/observability") && !url.includes("/raw-logs");
}

async function openAgentsRunsTab(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /^agents \/ runs$/i }));
  await screen.findByText("Agent Pool");
}

async function openTasksTab(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
  await screen.findByRole("button", { name: /Fix build/i });
}

describe("App", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const openMock = vi.fn<typeof window.open>();
  const runMocks = createRunMocks();

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal("open", openMock);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 2, byStatus: { ready: 1, failed: 1 } },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 1, healthy: 0 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: [
            "execution.blocked",
            "execution.retry_scheduled",
            "scheduler.tick_skipped",
            "agent.offline",
            "plugin.integration_skipped"
          ],
          watchedEventCount: 4,
          eventTypeCounts: {
            "execution.retry_scheduled": 2,
            "execution.blocked": 1,
            "agent.offline": 1
          },
          eventTypeRanking: [
            { eventType: "execution.retry_scheduled", count: 2 },
            { eventType: "agent.offline", count: 1 },
            { eventType: "execution.blocked", count: 1 }
          ],
          recentWatchedEvents: [
            {
              id: "ops-event-1",
              eventType: "execution.blocked",
              traceId: "trace-2",
              taskId: "task-2",
              createdAt: "2026-05-11T00:07:00.000Z",
              data: {}
            }
          ],
          recentAbnormalTasks: [
            {
              taskId: "task-2",
              title: "Repair tests",
              status: "failed",
              traceId: "trace-2",
              eventType: "execution.blocked",
              message: "Execution failure blocked task",
              createdAt: "2026-05-11T00:07:00.000Z",
              retryCount: 2,
              repairCount: 1
            }
          ]
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([
          {
            id: "task-1",
            title: "Fix build",
            repo: "repo-a",
            branch: "main",
            executor: "codex",
            status: "ready",
            priority: "high",
            traceId: "trace-1",
            repairCount: 0,
            retryCount: 0,
            createdAt: "2026-05-11T00:00:00.000Z"
          },
          {
            id: "task-2",
            title: "Repair tests",
            repo: "repo-b",
            branch: "dev",
            executor: "codex",
            status: "waiting",
            priority: "medium",
            traceId: "trace-2",
            repairCount: 1,
            retryCount: 2,
            metadata: {
              humanLoop: {
                childIssue: {
                  externalId: "child-2",
                  failureHash: "hash-2"
                }
              }
            },
            createdAt: "2026-05-11T00:00:00.000Z"
          },
          {
            id: "task-3",
            title: "Wait for environment",
            repo: "repo-c",
            branch: "feature/env",
            executor: "codex",
            status: "waiting",
            priority: "medium",
            traceId: "trace-3",
            repairCount: 0,
            retryCount: 2,
            metadata: {
              waitReason: {
                type: "environment_blocked",
                source: "scheduler",
                message: "Service startup retry budget exhausted",
                recoverableBy: "operator",
                createdAt: "2026-05-11T00:00:00.000Z"
              }
            },
            createdAt: "2026-05-11T00:00:00.000Z"
          },
          {
            id: "task-4",
            title: "Clarify product spec",
            repo: "repo-d",
            branch: "feature/product",
            executor: "product",
            agentKind: "product",
            driverId: "openspec-product",
            status: "waiting",
            priority: "high",
            traceId: "trace-4",
            repairCount: 0,
            retryCount: 0,
            metadata: {
              humanLoop: {
                requestId: "request-product",
                requestedAt: "2026-05-11T00:00:00.000Z",
                seenReplyIds: []
              },
              waitReason: {
                type: "human_input",
                source: "openspec-product",
                message: "Product Agent is waiting for a reply",
                recoverableBy: "user",
                createdAt: "2026-05-11T00:00:00.000Z"
              }
            },
            createdAt: "2026-05-11T00:00:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-2/sync-human-repair-issue")) {
        return jsonResponse({
          ready: false,
          recovered: false,
          childExternalId: "child-2",
          replyId: null,
          summary: "Child repair issue is not ready"
        });
      }
      if (url.endsWith("/agents")) {
        return jsonResponse([
          {
            id: "agent-1",
            status: "idle",
            executor: "codex",
            taskId: null
          },
          {
            id: "agent-empty",
            status: "offline",
            executor: "gpt",
            taskId: null
          }
        ]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse(runMocks.runs);
      }
      if (url.includes("/runs/exec-1/observability")) {
        return jsonResponse(runMocks.observability);
      }
      if (url.includes("/runs/exec-1/raw-logs")) {
        return jsonResponse(runMocks.rawLogs);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([
          {
            id: "meegle",
            kind: "task-integration",
            priority: 10,
            capabilities: ["meegle"],
            health: {
              healthy: false,
              message: "credentials missing"
            }
          }
        ]);
      }
      if (url.endsWith("/plugin-configs")) {
        if (input instanceof Request && input.method === "POST") {
          return jsonResponse({
            pluginId: "meegle",
            kind: "task-integration",
            enabled: false,
            priority: 30,
            config: { mode: "poll" }
          });
        }
        return jsonResponse([
          {
            pluginId: "meegle",
            kind: "task-integration",
            enabled: true,
            priority: 30,
            config: { mode: "poll" }
          }
        ]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({
          ok: false,
          status: "degraded",
          checks: {
            plugins: {
              ok: false,
              message: "One or more required plugin kinds are unhealthy",
              requiredKinds: {
                environment: true,
                execution: true,
                quality: true,
                "observability-governance": true,
                "task-integration": false
              }
            }
          }
        });
      }
      if (url.endsWith("/integrations/meegle/auth/status")) {
        return jsonResponse({
          status: "unauthenticated",
          authenticated: false,
          message: "credentials missing"
        });
      }
      if (url.endsWith("/integrations/meegle/auth/start")) {
        return jsonResponse({
          status: "pending",
          authenticated: false,
          authorizationUrl: "https://project.feishu.cn/auth/device",
          deviceCode: "device-123",
          clientId: "client-123",
          intervalSeconds: 1,
          expiresInSeconds: 600,
          message: "Open the authorization URL to authorize Meegle"
        });
      }
      if (url.endsWith("/integrations/meegle/auth/poll")) {
        return jsonResponse({
          status: "authenticated",
          authenticated: true,
          message: "Meegle authorization completed"
        });
      }
      if (url.endsWith("/tasks/task-1/executions") || url.endsWith("/tasks/task-2/executions")) {
        return jsonResponse([
          {
            id: "exec-1",
            status: "failed",
            summary: "timed out",
            executor: "codex",
            startedAt: "2026-05-11T00:00:00.000Z",
            endedAt: "2026-05-11T00:05:00.000Z",
            agentId: "agent-1"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-1/transitions")) {
        return jsonResponse([
          {
            taskId: "task-1",
            traceId: "trace-1",
            from: "ready",
            to: "active",
            reason: "claimed",
            operator: "scheduler",
            timestamp: "2026-05-11T00:00:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-2/transitions")) {
        return jsonResponse([
          {
            taskId: "task-2",
            traceId: "trace-2",
            from: "active",
            to: "blocked",
            reason: "timeout budget exhausted",
            operator: "scheduler",
            timestamp: "2026-05-11T00:05:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-1/logs")) {
        return jsonResponse([
          {
            id: "log-1",
            taskId: "task-1",
            executionId: "exec-1",
            eventType: "execution.retry_scheduled",
            message: "Execution failure scheduled for retry",
            data: { attempt: 1, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" },
            createdAt: "2026-05-11T00:05:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-2/logs")) {
        return jsonResponse([
          {
            id: "log-2",
            taskId: "task-2",
            executionId: "exec-1",
            eventType: "execution.blocked",
            message: "Execution failure blocked task",
            data: { attempt: 3, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" },
            createdAt: "2026-05-11T00:05:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-1/eval-results")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/tasks/task-2/eval-results")) {
        return jsonResponse([
          {
            id: "eval-1",
            taskId: "task-2",
            executionId: "exec-1",
            passed: false,
            score: 35,
            riskLevel: "medium",
            report: {},
            createdAt: "2026-05-11T00:05:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/tasks/task-1/repair-goal") || url.endsWith("/tasks/task-2/repair-goal")) {
        return jsonResponse(null);
      }
      if (url.endsWith("/tasks/task-1/observability") || url.endsWith("/tasks/task-2/observability")) {
        const taskId = url.includes("task-1") ? "task-1" : "task-2";
        return jsonResponse({
          schemaVersion: "2026-05-11",
          taskId,
          transitions: [],
          executionLogs: taskId === "task-1"
            ? [{
                id: "log-1",
                taskId,
                executionId: "exec-1",
                eventType: "execution.retry_scheduled",
                message: "Execution failure scheduled for retry",
                data: { attempt: 1, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" },
                createdAt: "2026-05-11T00:05:00.000Z"
              }]
            : [{
                id: "log-2",
                taskId,
                executionId: "exec-1",
                eventType: "execution.blocked",
                message: "Execution failure blocked task",
                data: { attempt: 3, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" },
                createdAt: "2026-05-11T00:05:00.000Z"
              }]
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
    openMock.mockReset();
    fetchMock.mockReset();
  });

  it("uses Agents / Runs as the primary execution view", async () => {
    render(<App />);

    await openAgentsRunsTab();
    expect(await screen.findByText(/Run exec-1/)).not.toBeNull();
    expect(await screen.findByText("workspace")).not.toBeNull();
    expect(await screen.findByText("execute")).not.toBeNull();
    expect(await screen.findByText("Lifecycle")).not.toBeNull();
    expect(await screen.findByText("Plugin Chain")).not.toBeNull();
  });

  it("shows completion_gate in the run lifecycle", async () => {
    render(<App />);

    await openAgentsRunsTab();
    expect(await screen.findByText("completion_gate")).not.toBeNull();
    expect(await screen.findByText("Completion Gate")).not.toBeNull();
    expect(await screen.findByText("Run passed completion gate")).not.toBeNull();
    expect(await screen.findByText("openspec-completion-gate")).not.toBeNull();
  });

  it("selects the corresponding run when clicking an agent in the pool", async () => {
    render(<App />);

    await openAgentsRunsTab();
    const agentBtn = await screen.findByRole("button", { name: /agent-1 · idle/i });
    expect(agentBtn).not.toBeNull();

    fireEvent.click(agentBtn);

    expect(agentBtn.className).toContain("run-card-selected");
  });

  it("shows agent details when clicking an agent with no runs in the pool", async () => {
    render(<App />);

    await openAgentsRunsTab();
    const agentBtn = await screen.findByRole("button", { name: /agent-empty · offline/i });
    expect(agentBtn).not.toBeNull();

    fireEvent.click(agentBtn);

    await waitFor(() => {
      expect(agentBtn.className).toContain("run-card-selected");
    });
    expect(await screen.findByText("Agent agent-empty")).not.toBeNull();
    expect(await screen.findByText("No runs have been executed by this agent yet.")).not.toBeNull();
    
    // Runs list should filter and display empty state
    expect(screen.getByText("No runs yet.")).not.toBeNull();
    expect(screen.queryByText(/Run exec-1/)).toBeNull();
  });

  it("keeps the manually selected agent and run after live refresh", async () => {
    const selectedRun = {
      ...runMocks.runs[0],
      id: "exec-2",
      taskId: "task-2",
      agentId: "agent-2",
      executor: "gpt",
      startedAt: "2026-05-10T00:00:00.000Z",
      endedAt: "2026-05-10T00:05:00.000Z"
    };
    const selectedObservability = {
      ...runMocks.observability,
      run: selectedRun,
      steps: runMocks.observability.steps.map((step) => ({ ...step, id: `exec-2-${step.id}`, runId: "exec-2" })),
      rawLogs: {
        ...runMocks.observability.rawLogs,
        endpoint: "/api/runs/exec-2/raw-logs"
      }
    };
    const defaultFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/agents")) {
        return jsonResponse([
          {
            id: "agent-1",
            status: "idle",
            executor: "codex",
            taskId: null
          },
          {
            id: "agent-empty",
            status: "offline",
            executor: "gpt",
            taskId: null
          },
          {
            id: "agent-2",
            status: "idle",
            executor: "gpt",
            taskId: null
          }
        ]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse([runMocks.runs[0], selectedRun]);
      }
      if (url.includes("/runs/exec-2/observability")) {
        return jsonResponse(selectedObservability);
      }
      return defaultFetch!(input, init);
    });
    render(<App />);

    await openAgentsRunsTab();
    const agentBtn = await screen.findByRole("button", { name: /agent-2 · idle/i });

    fireEvent.click(agentBtn);

    await waitFor(() => {
      expect(agentBtn.className).toContain("run-card-selected");
      expect(screen.getAllByText(/Run exec-2/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Run exec-1/)).toBeNull();
    });

    const runListCallsBefore = fetchMock.mock.calls.filter(([input]) => matchRunsEndpoint(String(input))).length;
    MockEventSource.instances[0]?.onmessage?.({
      data: JSON.stringify({
        id: "event-live-1",
        eventType: "execution.step_completed",
        traceId: "trace-2",
        taskId: "task-2",
        createdAt: "2026-05-11T00:08:00.000Z",
        data: {}
      })
    } as MessageEvent<string>);

    await waitFor(() => {
      const runListCallsAfter = fetchMock.mock.calls.filter(([input]) => matchRunsEndpoint(String(input))).length;
      expect(runListCallsAfter).toBeGreaterThan(runListCallsBefore);
    }, { timeout: 2000 });
    await waitFor(() => {
      expect(agentBtn.className).toContain("run-card-selected");
      expect(screen.getAllByText(/Run exec-2/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Run exec-1/)).toBeNull();
    }, { timeout: 2000 });
  });

  it("shows quality runs under quality agents when stale records keep a programming agent id", () => {
    render(
      <I18nProvider>
        <AgentsRunsView
          agents={[
            { id: "programming-agent-1", status: "idle", executor: "programming", kind: "programming", taskId: null },
            { id: "quality-agent-1", status: "idle", executor: "quality", kind: "quality", taskId: null }
          ]}
          runs={[
            {
              id: "exec-quality",
              taskId: "task-1",
              agentId: "programming-agent-1",
              workspace: "/tmp/ws",
              status: "failed",
              summary: null,
              executor: "quality",
              agentKind: "quality",
              startedAt: "2026-05-11T00:00:00.000Z",
              endedAt: "2026-05-11T00:05:00.000Z"
            }
          ]}
          selectedRun={null}
          selectedRunId={null}
          onSelectRun={vi.fn()}
          onOpenRawLogs={vi.fn()}
          selectedAgentId="quality-agent-1"
          onSelectAgent={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Run exec-quality/)).not.toBeNull();
    expect(screen.queryByText("No runs yet.")).toBeNull();
  });

  it("shows the selected run route and scoped programming lifecycle", () => {
    render(
      <I18nProvider>
        <AgentsRunsView
          agents={[
            { id: "programming-agent-1", status: "idle", executor: "programming", kind: "programming", taskId: null }
          ]}
          runs={[
            {
              id: "exec-programming",
              taskId: "task-1",
              agentId: "programming-agent-1",
              workspace: "/tmp/ws",
              status: "completed",
              summary: null,
              executor: "programming",
              agentKind: "programming",
              driverId: "coding",
              runtimeProviderId: "codex",
              startedAt: "2026-05-11T00:00:00.000Z",
              endedAt: "2026-05-11T00:05:00.000Z"
            }
          ]}
          selectedRun={{
            ...runMocks.observability,
            run: {
              ...runMocks.observability.run,
              id: "exec-programming",
              executor: "programming",
              agentKind: "programming",
              driverId: "coding",
              runtimeProviderId: "codex"
            },
            stages: [
              {
                key: "workspace",
                label: "Workspace",
                status: "done",
                startedAt: "2026-05-11T00:00:00.000Z",
                endedAt: "2026-05-11T00:01:00.000Z",
                summary: "Workspace ready"
              },
              {
                key: "execute",
                label: "Execute",
                status: "done",
                startedAt: "2026-05-11T00:01:00.000Z",
                endedAt: "2026-05-11T00:04:00.000Z",
                summary: "Implementation completed"
              },
              {
                key: "done",
                label: "Done",
                status: "done",
                startedAt: "2026-05-11T00:04:00.000Z",
                endedAt: "2026-05-11T00:05:00.000Z",
                summary: "Programming handed off"
              }
            ],
            steps: [],
            plugins: [],
            rawLogs: {
              available: false,
              endpoint: "/api/runs/exec-programming/raw-logs",
              sources: [],
              scope: "run",
              redacted: true
            }
          }}
          selectedRunId="exec-programming"
          onSelectRun={vi.fn()}
          onOpenRawLogs={vi.fn()}
          selectedAgentId="programming-agent-1"
          onSelectAgent={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Route: programming · driver coding · runtime codex/)).not.toBeNull();
    expect(screen.queryByText("quality")).toBeNull();
  });

  it("opens raw logs in a modal with source filtering and search", async () => {
    render(<App />);

    await openAgentsRunsTab();
    await screen.findByText(/Run exec-1/);
    fireEvent.click(await screen.findByRole("button", { name: /view raw logs/i }));

    const rawLogDialog = await screen.findByRole("dialog", { name: /^raw logs$/i });
    expect(rawLogDialog).not.toBeNull();
    expect(rawLogDialog.querySelector(".raw-log-sticky-header")).not.toBeNull();
    expect((screen.getByLabelText("Raw log source") as HTMLSelectElement).value).toBe("stdout");
    expect((screen.getByLabelText("Raw log type") as HTMLSelectElement).value).toBe("stdout.agent");
    expect(screen.getByText("Use superpowers to implement personal website")).not.toBeNull();
    expect(screen.queryByText(/npm test failed/i)).toBeNull();
    expect(screen.queryByText("all 15 tests passed")).toBeNull();

    fireEvent.change(screen.getByLabelText("Raw log type"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Raw log source"), { target: { value: "all" } });
    expect((await screen.findAllByText(/npm test failed/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/timeout waiting for worker/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("trace-raw-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("stderr").length).toBeGreaterThan(0);
    expect(screen.getAllByText("execute").length).toBeGreaterThan(0);
    expect(screen.getAllByText("cursor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("redacted").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /install result/i })).not.toBeNull();
    expect(screen.getByText(/dependencies completed/i)).not.toBeNull();
    expect(screen.getByRole("table")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Check" })).not.toBeNull();
    expect(screen.getByRole("cell", { name: "typecheck" })).not.toBeNull();
    expect(screen.queryByText(/^# Install result/i)).toBeNull();
    expect(screen.queryByText(/\| Check \| Status \|/i)).toBeNull();
    expect(screen.queryByText(/"result"/i)).toBeNull();

    expect(screen.getByText("Codex thread started")).not.toBeNull();
    expect(screen.getAllByText("019ea674-2581-78d0-8caf-c4985717f9f3").length).toBeGreaterThan(0);
    expect(screen.getByText("Agent response")).not.toBeNull();
    expect(screen.getByText("assistant message")).not.toBeNull();
    expect(screen.getByText("item")).not.toBeNull();
    expect(screen.getByText("item_0")).not.toBeNull();
    expect(rawLogDialog.querySelector(".raw-log-agent-message")).not.toBeNull();
    expect(rawLogDialog.querySelector(".raw-log-quick-stats")).not.toBeNull();
    expect(screen.getAllByText("agent response").length).toBeGreaterThan(0);
    expect(screen.getAllByText("command").length).toBeGreaterThan(0);
    expect(screen.getAllByText("thread").length).toBeGreaterThan(0);
    expect(screen.getAllByText("result").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Codex command execution completed").length).toBeGreaterThan(0);
    expect(screen.getByText("all 15 tests passed")).not.toBeNull();
    expect(screen.getAllByText("sed -n '1,260p' skills/openspec-superpowers-workflow/SKILL.md").length).toBeGreaterThan(0);
    expect(screen.getByText("OpenSpec + Superpowers 融合编排流程")).not.toBeNull();
    expect(screen.getAllByText("completed").length).toBeGreaterThan(0);
    expect(screen.queryByText(/"aggregated_output"/i)).toBeNull();

    fireEvent.change(screen.getByLabelText("Raw log type"), { target: { value: "stdout.agent" } });
    expect(screen.getByText("Use superpowers to implement personal website")).not.toBeNull();
    expect(screen.queryByText("all 15 tests passed")).toBeNull();
    fireEvent.change(screen.getByLabelText("Raw log type"), { target: { value: "all" } });

    fireEvent.change(screen.getByLabelText("Search raw logs"), { target: { value: "timeout" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/runs/exec-1/raw-logs?q=timeout"));
    });
  });

  it("shows plugins as a management page and from the run plugin chain", async () => {
    render(<App />);

    await openAgentsRunsTab();
    await screen.findByText("Plugin Chain");
    expect(screen.getAllByText(/participated/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));

    expect(await screen.findByText("Plugin Management")).not.toBeNull();
    expect(screen.getByText("meegle")).not.toBeNull();
    expect(screen.getByText(/Config JSON/i)).not.toBeNull();
    expect(screen.getByText(/Recent Events/i)).not.toBeNull();
  });

  it("filters task list by search query and status pills", async () => {
    render(<App />);

    await openTasksTab();
    expect(screen.getAllByText("Repair tests").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "repo-b" } });

    await waitFor(() => {
      expect(screen.queryByText("Fix build")).toBeNull();
    });
    expect(screen.getAllByText("Repair tests").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "" } });
    const filterBar = screen.getByRole("tablist", { name: "Task status filters" });
    const waitingFilter = Array.from(filterBar.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Waiting") || button.textContent?.includes("等待中")
    );
    if (!waitingFilter) {
      throw new Error("waiting filter not found");
    }
    fireEvent.click(waitingFilter);

    await waitFor(() => {
      expect(screen.queryByText("Fix build")).toBeNull();
    });
    expect(screen.getAllByText("Repair tests").length).toBeGreaterThan(0);
  });

  it("shows child issue sync action for waiting tasks with child metadata", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    await screen.findByText("Repair tests");
    fireEvent.click(screen.getByRole("button", { name: /Repair tests/i }));

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "检查子任务方案" }));

    await screen.findByText("子任务描述尚未以 `【开发中】` 开头");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-2/sync-human-repair-issue"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not show product reply sync action for waiting product tasks", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    await screen.findByText("Clarify product spec");
    fireEvent.click(screen.getByRole("button", { name: /Clarify product spec/i }));

    expect(screen.queryByRole("button", { name: "检查回复" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-4/sync-human-reply"),
      expect.anything()
    );
  });

  it("shows resume but not retry for ordinary waiting tasks", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    await screen.findByText("Wait for environment");
    fireEvent.click(screen.getByRole("button", { name: /Wait for environment/i }));

    expect(screen.getByRole("button", { name: "Resume" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows OpenSpec review and handoff diagnostics in task detail", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 2, byStatus: { waiting: 1, ready: 1 } },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 0, healthy: 0 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: [],
          watchedEventCount: 0,
          eventTypeCounts: {},
          eventTypeRanking: [],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([
          {
            id: "task-product",
            title: "Review product spec",
            repo: "repo-a",
            branch: "main",
            executor: "product",
            agentKind: "product",
            driverId: "openspec-product",
            runtimeProviderId: "codex",
            status: "waiting",
            priority: "high",
            traceId: "trace-product",
            repairCount: 0,
            retryCount: 0,
            metadata: {
              workflowRole: "product_spec",
              workspaceId: "/tmp/diting-product-workspace",
              openspecChangeId: "add-demo",
              openspecRevision: "rev-1",
              openSpecReview: {
                externalId: "review-1",
                lastDecision: "pending",
                requestedAt: "2026-06-13T00:00:00.000Z"
              }
            },
            createdAt: "2026-06-13T00:00:00.000Z"
          },
          {
            id: "task-programming",
            title: "Implement product spec",
            repo: "repo-a",
            branch: "main",
            executor: "programming",
            agentKind: "programming",
            driverId: "coding",
            status: "ready",
            priority: "high",
            traceId: "trace-product",
            repairCount: 0,
            retryCount: 0,
            metadata: {
              workflowRole: "programming_from_product",
              sourceProductTaskId: "task-product",
              workspaceId: "/tmp/diting-product-workspace",
              openspecChangeId: "add-demo",
              approvedOpenSpec: true,
              openSpecReview: {
                externalId: "review-1",
                lastDecision: "approved"
              }
            },
            createdAt: "2026-06-13T00:05:00.000Z"
          }
        ]);
      }
      if (url.endsWith("/agents") || matchRunsEndpoint(url) || url.endsWith("/plugins") || url.endsWith("/plugin-configs")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({ ok: true, status: "ready", checks: { plugins: { ok: true, message: "ready", requiredKinds: {} } } });
      }
      if (url.endsWith("/integrations/meegle/auth/status")) {
        return jsonResponse({ status: "unauthenticated", authenticated: false, message: "not configured" });
      }
      if (/\/tasks\/task-(product|programming)\/(executions|transitions|logs|eval-results)$/.test(url)) {
        return jsonResponse([]);
      }
      if (/\/tasks\/task-(product|programming)\/repair-goal$/.test(url)) {
        return jsonResponse(null);
      }
      if (/\/tasks\/task-(product|programming)\/observability$/.test(url)) {
        return jsonResponse({ schemaVersion: "2026-05-11", taskId: url.includes("task-product") ? "task-product" : "task-programming", transitions: [], executionLogs: [] });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Review product spec/i }));

    expect(await screen.findByText("OpenSpec Review")).not.toBeNull();
    expect(screen.getAllByText("review-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("add-demo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("rev-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/tmp/diting-product-workspace").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Implement product spec/i }));

    expect(await screen.findByText("OpenSpec Handoff")).not.toBeNull();
    expect(screen.getAllByText("task-product").length).toBeGreaterThan(0);
    expect(screen.getAllByText("approved").length).toBeGreaterThan(0);
  });

  it("shows plugin health, config, and readiness details", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("credentials missing");
    expect(screen.getAllByText("meegle").length).toBeGreaterThan(0);
    expect(screen.getByText(/enabled true · priority 30/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /disable plugin/i })).not.toBeNull();
    expect(screen.getByText(/One or more required plugin kinds are unhealthy/i)).not.toBeNull();
    expect(screen.getByText(/"mode": "poll"/i)).not.toBeNull();
  });

  it("posts plugin config updates when disabling a safe plugin", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("credentials missing");
    fireEvent.click(screen.getByRole("button", { name: /disable plugin/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/plugin-configs"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pluginId: "meegle",
            kind: "task-integration",
            enabled: false,
            priority: 30,
            config: { mode: "poll" }
          })
        })
      );
    });
  });

  it("allows toggling quality plugins in the console", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 0, byStatus: {} },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 1, healthy: 1 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: [],
          watchedEventCount: 0,
          eventTypeCounts: {},
          eventTypeRanking: [],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/agents")) {
        return jsonResponse([]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([
          {
            id: "default-quality",
            kind: "quality",
            priority: 100,
            capabilities: ["default"],
            health: {
              healthy: true,
              message: "Script-based quality gate enabled"
            }
          }
        ]);
      }
      if (url.endsWith("/plugin-configs")) {
        if (init?.method === "POST") {
          return jsonResponse({
            pluginId: "default-quality",
            kind: "quality",
            enabled: false,
            priority: 100,
            config: {}
          });
        }
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({
          ok: true,
          status: "ready",
          checks: {
            plugins: {
              ok: true,
              message: "All required plugin kinds are healthy",
              requiredKinds: {}
            }
          }
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("Script-based quality gate enabled");
    expect(screen.getByRole("button", { name: /disable plugin/i })).not.toBeNull();
  });

  it("blocks toggling for required plugins in the console", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 0, byStatus: {} },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 1, healthy: 1 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: [],
          watchedEventCount: 0,
          eventTypeCounts: {},
          eventTypeRanking: [],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/agents")) {
        return jsonResponse([]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([
          {
            id: "default-environment",
            kind: "environment",
            priority: 100,
            capabilities: ["local"],
            health: {
              healthy: true,
              message: "Workspace environment ready"
            }
          }
        ]);
      }
      if (url.endsWith("/plugin-configs")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({
          ok: true,
          status: "ready",
          checks: {
            plugins: {
              ok: true,
              message: "All required plugin kinds are healthy",
              requiredKinds: {
                environment: true
              }
            }
          }
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("Workspace environment ready");
    expect(screen.queryByRole("button", { name: /disable plugin/i })).toBeNull();
    expect(screen.getByText(/Required plugin; toggling disabled in console\./i)).not.toBeNull();
  });

  it("opens the Meegle authorization URL and polls until authorized", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("credentials missing");
    fireEvent.click(await screen.findByRole("button", { name: /authorize meegle/i }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://project.feishu.cn/auth/device",
        "_blank",
        "noopener,noreferrer"
      );
    });
    await screen.findByText(/Meegle authorization completed/i);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/integrations/meegle/auth/poll"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("device-123")
      })
    );
  });

  it("opens the GitLab authorization URL and polls until authorized", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 0, byStatus: {} },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 1, healthy: 0 },
          recentEvents: []
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          schemaVersion: "2026-05-13",
          eventTypeCounts: [],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks") || url.endsWith("/agents") || matchRunsEndpoint(url)) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([
          {
            id: "gitlab",
            kind: "platform",
            priority: 90,
            capabilities: ["gitlab", "merge-request", "cli-auth"],
            health: {
              healthy: false,
              message: "GitLab CLI authorization required"
            }
          }
        ]);
      }
      if (url.endsWith("/plugin-configs")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({ ok: true, status: "ready", checks: { plugins: { ok: true, message: "ready", requiredKinds: {} } } });
      }
      if (url.endsWith("/integrations/gitlab/auth/status")) {
        return jsonResponse({
          status: "unauthenticated",
          authenticated: false,
          host: "gitlab.yc345.tv",
          message: "not logged in"
        });
      }
      if (url.endsWith("/integrations/gitlab/auth/start")) {
        return jsonResponse({
          status: "pending",
          authenticated: false,
          authorizationUrl: "https://gitlab.yc345.tv/oauth/device",
          userCode: "ABCD-EFGH",
          host: "gitlab.yc345.tv",
          intervalSeconds: 1,
          message: "Open the authorization URL and enter the GitLab device code"
        });
      }
      if (url.endsWith("/integrations/gitlab/auth/poll")) {
        return jsonResponse({
          status: "authenticated",
          authenticated: true,
          host: "gitlab.yc345.tv",
          message: "GitLab CLI is authenticated"
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    await screen.findByText("GitLab CLI authorization required");
    fireEvent.click(await screen.findByRole("button", { name: /authorize gitlab/i }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://gitlab.yc345.tv/oauth/device",
        "_blank",
        "noopener,noreferrer"
      );
    });
    await screen.findByText(/GitLab CLI is authenticated/i);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/integrations/gitlab/auth/poll"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows the global ops panel with ranked event types and abnormal tasks", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^overview$/i }));
    await screen.findByText("Global Event / Ops");
    expect(screen.getAllByText("execution / retry_scheduled").length).toBeGreaterThan(0);
    expect(screen.getByText("Recent Abnormal Tasks")).not.toBeNull();
    expect(screen.getByText(/Execution failure blocked task/i)).not.toBeNull();
    expect(screen.getByText("Global Watched Feed")).not.toBeNull();
  });

  it("surfaces retry and block execution summaries in task detail", async () => {
    render(<App />);

    await openTasksTab();
    const source = MockEventSource.instances[0];
    source?.onmessage?.({
      data: JSON.stringify({
        id: "retry-event",
        eventType: "execution.retry_scheduled",
        message: "retry scheduled",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-05-11T00:06:00.000Z",
        data: { attempt: 1, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" }
      })
    } as MessageEvent<string>);
    await screen.findByText("Controller scheduled another automatic retry.");
    expect(screen.getAllByText(/attempt 1\/2/i).length).toBeGreaterThan(0);

    const waitingFilter = Array.from(
      screen.getByRole("tablist", { name: "Task status filters" }).querySelectorAll("button")
    ).find((button) => button.textContent?.includes("Waiting") || button.textContent?.includes("等待中"));
    if (!waitingFilter) {
      throw new Error("waiting filter not found");
    }
    fireEvent.click(waitingFilter);
    source?.onmessage?.({
      data: JSON.stringify({
        id: "block-event",
        eventType: "execution.blocked",
        message: "blocked",
        traceId: "trace-2",
        taskId: "task-2",
        createdAt: "2026-05-11T00:07:00.000Z",
        data: { attempt: 3, retryLimit: 2, errorCategory: "timeout", timeoutCategory: "execution_timeout" }
      })
    } as MessageEvent<string>);

    await screen.findByText("Automatic retry stopped and the task was blocked.");
    expect(screen.getAllByText(/attempt 3\/2/i).length).toBeGreaterThan(0);
  });

  it("filters live events by category lens", async () => {
    render(<App />);

    await openTasksTab();
    const source = MockEventSource.instances[0];
    source?.onmessage?.({
      data: JSON.stringify({
        id: "event-1",
        eventType: "scheduler.tick_started",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-05-11T00:06:00.000Z",
        data: {}
      })
    } as MessageEvent<string>);
    source?.onmessage?.({
      data: JSON.stringify({
        id: "event-2",
        eventType: "agent.offline",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-05-11T00:07:00.000Z",
        data: {}
      })
    } as MessageEvent<string>);

    await screen.findByText("scheduler / tick_started");
    const filterBar = screen.getByRole("tablist", { name: "Event category filters" });
    const schedulerFilter = Array.from(filterBar.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("scheduler")
    );
    if (!schedulerFilter) {
      throw new Error("scheduler filter not found");
    }
    fireEvent.click(schedulerFilter);

    const liveEventsSection = screen.getByText("Live Event Stream").closest("section");
    if (!liveEventsSection) {
      throw new Error("live event stream section not found");
    }
    await within(liveEventsSection).findByText("scheduler / tick_started");
    expect(within(liveEventsSection).queryByText("agent / offline")).toBeNull();
    expect(within(liveEventsSection).queryByText("execution / retry_scheduled")).toBeNull();
  });

  it("renders task lifecycle and live events without requesting execution logs", async () => {
    render(<App />);

    await openTasksTab();
    const source = MockEventSource.instances[0];
    source?.onmessage?.({
      data: JSON.stringify({
        id: "task-live-event-1",
        eventType: "scheduler.tick_started",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-05-11T00:06:00.000Z",
        data: {}
      })
    } as MessageEvent<string>);

    const lifecycleSection = (await screen.findByText("Lifecycle Timeline")).closest("section");
    const liveEventsSection = (await screen.findByText("Live Event Stream")).closest("section");
    if (!lifecycleSection || !liveEventsSection) {
      throw new Error("split task timeline sections not found");
    }
    expect(within(lifecycleSection).getByText("ready → active")).not.toBeNull();
    expect(within(lifecycleSection).queryByText("scheduler / tick_started")).toBeNull();
    expect(await within(liveEventsSection).findByText("scheduler / tick_started")).not.toBeNull();
    expect(within(liveEventsSection).queryByText("ready → active")).toBeNull();
    expect(screen.queryByText("execution / retry_scheduled")).toBeNull();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/tasks/task-1/logs"))).toBe(false);
    fireEvent.click(within(lifecycleSection).getByRole("button", { name: /view from start/i }));
    expect(within(lifecycleSection).getByText("ready → active")).not.toBeNull();
  });

  it("shows run lifecycle instead of step execution logs in run detail", async () => {
    render(<App />);

    await openAgentsRunsTab();
    expect(await screen.findByText("Lifecycle")).not.toBeNull();
    expect(screen.getByText("Completion Gate")).not.toBeNull();
    expect(screen.getByText("Run passed completion gate")).not.toBeNull();
    expect(screen.queryByText("Completion gate passed")).toBeNull();
  });

  it("sorts raw logs with newest entries first", async () => {
    render(<App />);

    await openAgentsRunsTab();
    fireEvent.click(await screen.findByRole("button", { name: /view raw logs/i }));
    const rawLogDialog = await screen.findByRole("dialog", { name: /^raw logs$/i });
    fireEvent.change(screen.getByLabelText("Raw log type"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Raw log source"), { target: { value: "all" } });
    const items = rawLogDialog.querySelectorAll(".raw-log-item");
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].textContent).toMatch(/npm test failed/i);
  });

  it("refreshes selected run observability and raw logs after live events", async () => {
    render(<App />);

    await openAgentsRunsTab();
    fireEvent.click(await screen.findByRole("button", { name: /view raw logs/i }));
    await screen.findByRole("dialog", { name: /^raw logs$/i });

    const observabilityCallsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/runs/exec-1/observability")
    ).length;
    const rawLogCallsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/runs/exec-1/raw-logs")
    ).length;

    const source = MockEventSource.instances[0];
    source?.onmessage?.({
      data: JSON.stringify({
        id: "event-live-1",
        eventType: "execution.step_completed",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-05-11T00:08:00.000Z",
        data: {}
      })
    } as MessageEvent<string>);

    await waitFor(() => {
      const observabilityCallsAfter = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/runs/exec-1/observability")
      ).length;
      const rawLogCallsAfter = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/runs/exec-1/raw-logs")
      ).length;
      expect(observabilityCallsAfter).toBeGreaterThan(observabilityCallsBefore);
      expect(rawLogCallsAfter).toBeGreaterThan(rawLogCallsBefore);
    }, { timeout: 2000 });
  });

  it("shows reconnect banner and reconnects the live event stream", async () => {
    render(<App />);

    await openTasksTab();
    expect(MockEventSource.instances.length).toBe(1);

    MockEventSource.instances[0]?.onerror?.();

    await screen.findByText("Live updates disconnected. Reconnecting in the background.");
    fireEvent.click(screen.getByRole("button", { name: "Reconnect now" }));

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(2);
    });
    await waitFor(() => {
      expect(screen.queryByText("Live updates disconnected. Reconnecting in the background.")).toBeNull();
    });
  });

  it("hides task sync dependency hints when Meegle is unauthenticated", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 0, byStatus: {} },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 1, healthy: 0 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: ["plugin.integration_skipped"],
          watchedEventCount: 3,
          eventTypeCounts: { "plugin.integration_skipped": 3 },
          eventTypeRanking: [{ eventType: "plugin.integration_skipped", count: 3 }],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/agents")) {
        return jsonResponse([]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([
          {
            id: "meegle",
            kind: "task-integration",
            priority: 10,
            capabilities: ["meegle"],
            health: {
              healthy: false,
              message: JSON.stringify({
                error: { code: "AUTH_REQUIRED", message: "authentication required" }
              })
            }
          }
        ]);
      }
      if (url.endsWith("/plugin-configs")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({
          ok: true,
          status: "ready",
          checks: {
            plugins: {
              ok: true,
              message: "ready",
              requiredKinds: {}
            }
          }
        });
      }
      if (url.endsWith("/dependency-checks")) {
        return jsonResponse({
          ready: 0,
          total: 1,
          degraded: true,
          checks: [
            {
              id: "meegle-auth",
              category: "task-integration",
              label: "Meegle CLI",
              description: "Meegle task intake",
              status: "blocked",
              required: false,
              requiredFor: ["task-sync"],
              items: [
                { id: "auth", label: "Signed in", status: "blocked", detail: "authentication required" }
              ],
              action: { kind: "auth", label: "Authorize Meegle", target: "meegle" }
            }
          ]
        });
      }
      if (url.endsWith("/integrations/meegle/auth/status")) {
        return jsonResponse({
          status: "unauthenticated",
          authenticated: false,
          message: "no local token"
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dependency checks need attention/i })).not.toBeNull();
    });
    expect(screen.queryByText("Tasks not synced: Meegle is not authorized")).toBeNull();
    expect(screen.queryByText(/scheduler skips unhealthy Meegle integration/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /authorize meegle/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    expect(await screen.findByText("No tasks have been synced yet.")).not.toBeNull();
  });

  it("shows empty states when no runtime data has been synced", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/dashboard")) {
        return jsonResponse({
          tasks: { total: 0, byStatus: {} },
          agents: { total: 0, byStatus: {} },
          plugins: { total: 0, healthy: 0 }
        });
      }
      if (url.endsWith("/ops/events")) {
        return jsonResponse({
          focusEventTypes: [],
          watchedEventCount: 0,
          eventTypeCounts: {},
          eventTypeRanking: [],
          recentWatchedEvents: [],
          recentAbnormalTasks: []
        });
      }
      if (url.endsWith("/tasks")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/agents")) {
        return jsonResponse([]);
      }
      if (matchRunsEndpoint(url)) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugins")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/plugin-configs")) {
        return jsonResponse([]);
      }
      if (url.endsWith("/readiness")) {
        return jsonResponse({
          ok: true,
          status: "ready",
          checks: {
            plugins: {
              ok: true,
              message: "All required plugin kinds are healthy",
              requiredKinds: {}
            }
          }
        });
      }
      if (url.endsWith("/integrations/meegle/auth/status")) {
        return jsonResponse({
          status: "unauthenticated",
          authenticated: false,
          message: "not ready"
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
    await screen.findByText("No tasks yet");
    expect(screen.getByText("No task selected.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^agents \/ runs$/i }));
    expect(screen.getByText("No agents registered.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^plugins$/i }));
    expect(screen.getByText("No plugins registered.")).not.toBeNull();
  });
});

function jsonResponse(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: async () => data
  } as Response);
}
