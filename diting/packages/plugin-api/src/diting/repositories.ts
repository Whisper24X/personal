import {
  AgentRecord,
  EvalResult,
  ExecutionLogRecord,
  ExecutionRecord,
  ExecutionStatus,
  HumanReview,
  PluginConfig,
  RepairGoal,
  AgentLease,
  RunAttempt,
  RunAttemptListQuery,
  TaskListQuery,
  TaskTransition,
  TitingTask
} from "./models";

export type ExecutionListQuery = {
  taskId?: string;
  agentId?: string;
  status?: ExecutionStatus;
  limit?: number;
  cursor?: string;
};

export interface TaskRepository {
  create(task: TitingTask): Promise<void>;
  save(task: TitingTask): Promise<void>;
  getById(id: string): Promise<TitingTask | null>;
  getByExternalId(source: string, externalId: string): Promise<TitingTask | null>;
  listByTraceId(traceId: string): Promise<TitingTask[]>;
  list(query?: TaskListQuery): Promise<TitingTask[]>;
  claimQueued(id: string, startedAt: Date): Promise<TitingTask | null>;
}

export interface TaskTransitionRepository {
  append(transition: TaskTransition): Promise<void>;
  listByTask(taskId: string): Promise<TaskTransition[]>;
  listByTraceId(traceId: string): Promise<TaskTransition[]>;
}

export interface ExecutionRepository {
  create(execution: ExecutionRecord): Promise<void>;
  save(execution: ExecutionRecord): Promise<void>;
  getById(id: string): Promise<ExecutionRecord | null>;
  list(query?: ExecutionListQuery): Promise<ExecutionRecord[]>;
  listByTask(taskId: string): Promise<ExecutionRecord[]>;
  getLatestByTask(taskId: string): Promise<ExecutionRecord | null>;
}

export interface ExecutionLogRepository {
  append(log: ExecutionLogRecord): Promise<void>;
  listByTask(taskId: string): Promise<ExecutionLogRecord[]>;
  listByExecution(executionId: string): Promise<ExecutionLogRecord[]>;
}

export interface AgentRepository {
  upsert(agent: AgentRecord): Promise<void>;
  list(): Promise<AgentRecord[]>;
  getIdle(executor: string): Promise<AgentRecord | null>;
  getById(id: string): Promise<AgentRecord | null>;
  claimIdle(executor: string, taskId: string, now: Date): Promise<AgentRecord | null>;
  claimIdleById(id: string, taskId: string, now: Date): Promise<AgentRecord | null>;
}

export interface RepairGoalRepository {
  upsert(goal: RepairGoal): Promise<void>;
  getByTaskId(taskId: string): Promise<RepairGoal | null>;
}

export interface EvalResultRepository {
  create(result: EvalResult): Promise<void>;
  listByTask(taskId: string): Promise<EvalResult[]>;
}

export interface PluginConfigRepository {
  list(): Promise<PluginConfig[]>;
  getByPluginId(pluginId: string): Promise<PluginConfig | null>;
  upsert(config: PluginConfig): Promise<void>;
}

export interface AgentLeaseRepository {
  create(lease: AgentLease): Promise<void>;
  release(id: string, releasedAt: Date, releaseReason: string): Promise<void>;
  listActive(): Promise<AgentLease[]>;
  listByTask(taskId: string): Promise<AgentLease[]>;
  listByExecution(executionId: string): Promise<AgentLease[]>;
}

export interface HumanReviewRepository {
  create(review: HumanReview): Promise<void>;
  save(review: HumanReview): Promise<void>;
  getLatestByTask(taskId: string): Promise<HumanReview | null>;
  listByTask(taskId: string): Promise<HumanReview[]>;
}

export interface RunAttemptRepository {
  create(attempt: RunAttempt): Promise<void>;
  save(attempt: RunAttempt): Promise<void>;
  getById(id: string): Promise<RunAttempt | null>;
  getLatestByTask(taskId: string): Promise<RunAttempt | null>;
  list(query?: RunAttemptListQuery): Promise<RunAttempt[]>;
  listByTask(taskId: string): Promise<RunAttempt[]>;
}
