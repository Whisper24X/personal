export type TaskStatus =
  | "draft"
  | "ready"
  | "active"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AttemptStage =
  | "preparing"
  | "executing"
  | "completion_checking"
  | "evaluating"
  | "repairing"
  | "creating_pr"
  | "completed"
  | "failed";

export type WaitReasonType =
  | "human_input"
  | "approval"
  | "external_reply"
  | "environment_blocked"
  | "policy_blocked";

export type WaitReasonRecoverableBy = "user" | "integration" | "operator" | "system";

export type WaitReason = {
  type: WaitReasonType;
  source: string;
  message: string;
  externalRef?: string;
  recoverableBy: WaitReasonRecoverableBy;
  createdAt: string;
};

export type RunAttempt = {
  id: string;
  taskId: string;
  agentId: string;
  stage: AttemptStage;
  releaseReason?: string;
  startedAt: Date;
  endedAt?: Date;
  metadata: Record<string, unknown>;
};

export type TaskPriority = "low" | "medium" | "high";

export type AgentKind = "programming" | "product" | "review" | "triage" | "docs" | "qa" | string;

export type AgentRequest = {
  agentKind: AgentKind;
  capability?: string;
  preferredDriver?: string;
  preferredRuntime?: string;
  legacyExecutor?: string;
};

export type AgentStatus = "idle" | "busy" | "offline" | "disabled" | "error";

export type RiskLevel = "low" | "medium" | "high";

export type TitingTask = {
  id: string;
  source: string;
  externalId: string | null;
  sourceIdentity?: string;
  integrationKey?: string;
  title: string;
  instruction: string;
  repo: string;
  branch: string;
  priority: TaskPriority;
  status: TaskStatus;
  executor: string;
  agentKind?: AgentKind;
  preferredDriver?: string | null;
  preferredRuntime?: string | null;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  traceId: string;
  constraints: string[];
  acceptanceCriteria: string[];
  metadata: Record<string, unknown>;
  retryCount: number;
  repairCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskTransition = {
  taskId: string;
  traceId: string;
  from: TaskStatus;
  to: TaskStatus;
  reason: string;
  operator: string;
  timestamp: Date;
};

export type ExecutionStatus =
  | "preparing"
  | "executing"
  | "evaluating"
  | "repairing"
  | "completed"
  | "failed";

export type ExecutionRecord = {
  id: string;
  taskId: string;
  agentId: string | null;
  agentKind?: AgentKind;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  workspace: string;
  status: ExecutionStatus;
  summary: string | null;
  executor: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type ObservabilityCorrelation = {
  correlationId: string;
  traceId: string;
  taskId?: string;
  executionId?: string;
  pluginId?: string;
  agentId?: string;
  eventId?: string;
};

export type ExecutionLogRecord = {
  id: string;
  taskId: string;
  executionId: string | null;
  eventType: string;
  message: string;
  data: Record<string, unknown>;
  createdAt: Date;
};

export type AgentRecord = {
  id: string;
  status: AgentStatus;
  taskId: string | null;
  executor: string;
  kind?: AgentKind;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  labels: string[];
  lastHeartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RepairGoal = {
  id: string;
  taskId: string;
  objective: string;
  constraints: string[];
  doneWhen: string[];
  status: "repairing" | "achieved" | "budget_limited" | "needs_human";
  currentIteration: number;
  maxIterations: number;
  lastFailureHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type RepairPlan = RepairGoal;

export type EvalResult = {
  id: string;
  taskId: string;
  executionId: string;
  passed: boolean;
  score: number;
  riskLevel: RiskLevel;
  report: Record<string, unknown>;
  createdAt: Date;
};

export type PluginConfig = {
  id: string;
  pluginId: string;
  kind: PluginKind;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  updatedAt: Date;
};

export type AgentLease = {
  id: string;
  agentId: string;
  taskId: string;
  executionId: string | null;
  leasedAt: Date;
  leaseExpiresAt: Date;
  releasedAt: Date | null;
  releaseReason: string | null;
  candidateAgents: string[];
  selectionReason: string;
  prioritySnapshot: Record<string, unknown>;
};

export type HumanReviewStatus = "pending" | "answered" | "dismissed" | "expired";

export type HumanReview = {
  id: string;
  taskId: string;
  executionId: string | null;
  requestType: string;
  reason: string;
  externalThreadRef: string | null;
  responseSummary: string | null;
  status: HumanReviewStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PluginKind =
  | "task-integration"
  | "agent"
  | "execution"
  | "environment"
  | "completion-gate"
  | "quality"
  | "observability-governance"
  | "log"
  | "task-source"
  | "workspace"
  | "executor"
  | "quality-check"
  | "governance"
  | "log-store"
  | "observability"
  | "notification"
  | "intelligence"
  | "platform";

export type PluginCapability = {
  kind: PluginKind;
  capability: string;
  priority?: number;
};

export type PluginDependency = {
  kind: PluginKind;
  capability?: string;
  required?: boolean;
};

export type PluginConfigSchema = {
  schemaVersion: string;
  defaults?: Record<string, unknown>;
  required?: string[];
};

export type PluginManifest = {
  id: string;
  displayName: string;
  version: string;
  kind: PluginKind;
  capabilities: PluginCapability[];
  dependencies?: PluginDependency[];
  configSchema?: PluginConfigSchema | null;
};

export type CreateTaskInput = {
  source?: string;
  externalId?: string | null;
  title: string;
  instruction: string;
  repo: string;
  branch?: string;
  priority?: TaskPriority;
  executor?: string;
  agentKind?: AgentKind;
  capability?: string;
  preferredDriver?: string;
  preferredRuntime?: string;
  constraints?: string[];
  acceptanceCriteria?: string[];
  metadata?: Record<string, unknown>;
};

export type TaskListQuery = {
  status?: TaskStatus;
  executor?: string;
  agentKind?: AgentKind;
};

export type RunAttemptListQuery = {
  taskId?: string;
  agentId?: string;
  stage?: AttemptStage;
  limit?: number;
  cursor?: string;
};

export type RunStageKey = "workspace" | "execute" | "completion_gate" | "quality" | "repair" | "pull_request" | "done";

export type RunStageStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type RunStage = {
  key: RunStageKey;
  label: string;
  status: RunStageStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  summary: string | null;
};

export type RunStep = {
  id: string;
  runId: string;
  stage: RunStageKey;
  status: Exclude<RunStageStatus, "pending">;
  title: string;
  message: string;
  pluginId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  error: string | null;
};

export type RunPluginRef = {
  pluginId: string;
  kind: PluginKind;
  participationSource: "actual" | "fallback";
  fallbackReason: "missing_plugin_correlation" | "readiness_required" | "runtime_available" | null;
  status: RunStageStatus;
  health: "healthy" | "unhealthy" | "unknown";
  summary: string | null;
  lastEventAt: Date | null;
};

export type RunRawLogItem = {
  id: string;
  runId: string | null;
  taskId: string;
  source: "stdout" | "stderr" | "summary" | "event" | "file";
  channel: string;
  stage: RunStageKey | null;
  pluginId: string | null;
  createdAt: Date;
  text: string;
  redacted: boolean;
};

export type RunRawLogsResponse = {
  schemaVersion: string;
  runId: string;
  taskId: string;
  scope: "run" | "task";
  redacted: boolean;
  items: RunRawLogItem[];
  nextCursor: string | null;
};

export type RawLogQuery = {
  taskId: string;
  executionId: string;
  source?: RunRawLogItem["source"];
  q?: string;
  limit?: number;
  cursor?: string;
};

export type RawLogReadResult = Pick<RunRawLogsResponse, "scope" | "redacted" | "items" | "nextCursor">;

export type RunObservability = {
  schemaVersion: string;
  run: ExecutionRecord;
  stages: RunStage[];
  steps: RunStep[];
  plugins: RunPluginRef[];
  rawLogs: {
    available: boolean;
    endpoint: string;
    sources: Array<RunRawLogItem["source"]>;
    scope: "run" | "task";
    redacted: boolean;
  };
};
