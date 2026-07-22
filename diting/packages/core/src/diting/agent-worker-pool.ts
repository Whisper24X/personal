import { RunAttempt, TitingTask } from "@diting/plugin-api";
import { ServiceExecution } from "./service-execution";
import { ServiceConfig, ServiceDependencies, sortTaskPriority } from "./service-shared";
import { ServiceSupport } from "./service-support";

const DEFAULT_AGENT_KIND = "programming";
const LEGACY_TASK_EXECUTORS = new Set(["codex", "cursor", "programming"]);
const SUPPORTED_AGENT_KINDS = new Set(["programming", "product", "quality"]);

export class ServiceAgentWorkerPool {
  private readonly runningAgents = new Set<string>();

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly config: ServiceConfig,
    private readonly support: ServiceSupport,
    private readonly execution: ServiceExecution
  ) {}

  start(): () => void {
    const state = { active: true };
    const timers: unknown[] = [];

    void this.startKnownProgrammingAgents(state, timers);
    const discoveryTimer = this.config.setIntervalFn(() => {
      void this.startKnownProgrammingAgents(state, timers);
    }, this.config.agentWorkerPollIntervalMs);
    timers.push(discoveryTimer);

    return () => {
      state.active = false;
      for (const timer of timers) {
        this.config.clearIntervalFn(timer);
      }
      this.runningAgents.clear();
    };
  }

  async runAllWorkersOnce(): Promise<number> {
    const agents = await this.deps.agents.list();
    const results = await Promise.all(
      agents
        .filter((agent) => this.isSupportedAgent(agent))
        .map((agent) => this.runOnce(agent.id))
    );
    return results.filter(Boolean).length;
  }

  async runOnce(agentId: string): Promise<boolean> {
    const agent = await this.deps.agents.getById(agentId);
    if (!agent || agent.status !== "idle" || !this.isSupportedAgent(agent)) {
      return false;
    }

    const task = await this.nextClaimableTask(this.agentKind(agent));
    if (!task) {
      return false;
    }

    const now = this.support.now();
    const claimedAgent = await this.deps.agents.claimIdleById(agent.id, task.id, now);
    if (!claimedAgent) {
      return false;
    }

    const claimedTask = await this.deps.tasks.claimQueued(task.id, now);
    if (!claimedTask) {
      await this.support.releaseAgent(claimedAgent);
      return false;
    }

    const attempt: RunAttempt = {
      id: this.support.createId(),
      taskId: claimedTask.id,
      agentId: claimedAgent.id,
      stage: "preparing",
      startedAt: now,
      metadata: {}
    };
    await this.deps.runAttempts.create(attempt);
    await this.support.recordTaskMutation(claimedTask, "ready", "active", "Task claimed by agent worker", "agent-worker");
    await this.support.publish("agent.worker_task_claimed", "Agent worker claimed task", claimedTask, {
      agentId: claimedAgent.id
    }, { agentId: claimedAgent.id });
    await this.execution.runTask(claimedTask, claimedAgent);
    return true;
  }

  private async startKnownProgrammingAgents(state: { active: boolean }, timers: unknown[]): Promise<void> {
    if (!state.active) {
      return;
    }
    const agents = await this.deps.agents.list();
    if (!state.active) {
      return;
    }
    for (const agent of agents) {
      if (!this.isSupportedAgent(agent) || this.runningAgents.has(agent.id)) {
        continue;
      }
      this.runningAgents.add(agent.id);
      const timer = this.config.setIntervalFn(() => {
        if (!state.active) {
          return;
        }
        void this.runOnce(agent.id).catch((error) => this.publishWorkerError(agent.id, error));
      }, this.config.agentWorkerPollIntervalMs);
      timers.push(timer);
      void this.runOnce(agent.id).catch((error) => this.publishWorkerError(agent.id, error));
    }
  }

  private async nextClaimableTask(agentKind: string): Promise<TitingTask | null> {
    const ready = (await this.deps.tasks.list({ status: "ready" })).sort(sortTaskPriority);
    return ready.find((task) => this.isSupportedTask(task, agentKind)) ?? null;
  }

  private isSupportedAgent(agent: { kind?: string | null; executor: string }): boolean {
    return SUPPORTED_AGENT_KINDS.has(this.agentKind(agent));
  }

  private isSupportedTask(task: TitingTask, agentKind: string): boolean {
    const taskKind = this.taskKind(task);
    if (agentKind === taskKind) {
      return true;
    }
    return agentKind === DEFAULT_AGENT_KIND && LEGACY_TASK_EXECUTORS.has(task.executor) && taskKind === DEFAULT_AGENT_KIND;
  }

  private agentKind(agent: { kind?: string | null; executor: string }): string {
    return agent.kind ?? agent.executor;
  }

  private taskKind(task: TitingTask): string {
    if (task.agentKind) {
      return task.agentKind;
    }
    if (LEGACY_TASK_EXECUTORS.has(task.executor)) {
      return DEFAULT_AGENT_KIND;
    }
    return task.executor;
  }

  private async publishWorkerError(agentId: string, error: unknown): Promise<void> {
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({ traceId: `agent:${agentId}`, agentId }),
      eventType: "agent.worker_error",
      message: "Agent worker failed",
      data: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}
