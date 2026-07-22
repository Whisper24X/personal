import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  API_BASE,
  fetchJson,
  getRunObservability,
  getRunRawLogs,
  listRuns,
  postJson,
  type Run,
  type RunObservability,
  type RunRawLogsResponse
} from "./api";
import { buildLogTimelineItems } from "./log-timeline";
import { LogTimelineView } from "./log-timeline-view";
import { AgentsRunsView, sortRunsByRecentActivity } from "./run-observability";
import { RawLogModal } from "./raw-log-modal";
import { DependencyCheckModal } from "./dependency-check-modal";
import { listDependencyChecks, recheckDependencies, type DependencyCheckSummary } from "./dependency-checks";
import { PluginsPanel } from "./plugins-panel";
import { I18nProvider, toDateLocale, useI18n, type Translator } from "./i18n";
import { useTheme } from "./theme";
import { summarizePluginHealthMessage } from "./task-sync-hints";

type ConsoleTab = "overview" | "agents-runs" | "plugins" | "tasks" | "events";

type DashboardData = {
  tasks: {
    total: number;
    byStatus: Record<string, number>;
  };
  agents: {
    total: number;
    byStatus: Record<string, number>;
  };
  plugins: {
    total: number;
    healthy: number;
  };
};

type OpsSnapshot = {
  focusEventTypes: string[];
  watchedEventCount: number;
  eventTypeCounts: Record<string, number>;
  eventTypeRanking: Array<{
    eventType: string;
    count: number;
  }>;
  recentWatchedEvents: EventItem[];
  recentAbnormalTasks: Array<{
    taskId: string;
    title: string;
    status: string;
    traceId: string;
    eventType: string;
    message: string;
    createdAt: string;
    retryCount: number;
    repairCount: number;
  }>;
};

type Task = {
  id: string;
  title: string;
  instruction?: string;
  repo: string;
  branch: string;
  executor: string;
  agentKind?: string;
  preferredDriver?: string | null;
  preferredRuntime?: string | null;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  status: string;
  priority: string;
  traceId: string;
  repairCount: number;
  retryCount: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    humanLoop?: {
      requestId?: string;
      requestedAt?: string;
      seenReplyIds?: string[];
      childIssue?: {
        externalId?: string;
      };
    };
    waitReason?: {
      type?: string;
      source?: string;
      message?: string;
      recoverableBy?: string;
      createdAt?: string;
    };
    workflowRole?: string;
    sourceProductTaskId?: string;
    workspaceId?: string;
    openspecChangeId?: string;
    openspecRevision?: string;
    approvedOpenSpec?: boolean;
    openSpecReview?: {
      externalId?: string;
      lastDecision?: string;
      decision?: string;
      replyId?: string;
      requestedAt?: string;
      approvedAt?: string;
      error?: string;
    };
  };
};

type Agent = {
  id: string;
  status: string;
  executor: string;
  kind?: string;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  taskId: string | null;
};

type Plugin = {
  id: string;
  kind: string;
  priority: number;
  capabilities: string[];
  displayName?: string;
  binaryPath?: string | null;
  runtimeSource?: string | null;
  runtimeKind?: string | null;
  health: {
    healthy: boolean;
    message: string;
  };
};

type PluginConfig = {
  pluginId: string;
  kind: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
};

type MeegleAuthStart = {
  status: "pending";
  authenticated: false;
  authorizationUrl: string;
  deviceCode: string;
  clientId: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  message: string;
};

type MeegleAuthPoll = {
  status: "pending" | "authenticated" | "failed" | "expired";
  authenticated: boolean;
  message: string;
};

type MeegleAuthUiState = {
  status: "idle" | "starting" | MeegleAuthPoll["status"];
  message: string;
};

type GitLabAuthStart = {
  status: "pending";
  authenticated: false;
  authorizationUrl: string;
  userCode: string;
  host: string;
  intervalSeconds: number;
  message: string;
};

type GitLabAuthPoll = {
  status: "pending" | "authenticated" | "failed";
  authenticated: boolean;
  host: string;
  message: string;
};

type GitLabAuthUiState = {
  status: "idle" | "starting" | GitLabAuthPoll["status"];
  message: string;
};

type Readiness = {
  ok: boolean;
  status: string;
  checks: {
    plugins: {
      ok: boolean;
      message: string;
      requiredKinds: Record<string, boolean>;
    };
  };
};

type Execution = {
  id: string;
  status: string;
  summary: string | null;
  executor: string;
  agentKind?: string;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  startedAt: string;
  endedAt: string | null;
  agentId: string | null;
};

type Transition = {
  taskId: string;
  traceId: string;
  from: string;
  to: string;
  reason: string;
  operator: string;
  timestamp: string;
};

type EvalResult = {
  id: string;
  taskId: string;
  executionId: string;
  passed: boolean;
  score: number;
  riskLevel: string;
  report: Record<string, unknown>;
  createdAt: string;
};

type RepairGoal = {
  id: string;
  taskId: string;
  objective: string;
  constraints: string[];
  doneWhen: string[];
  status: string;
  currentIteration: number;
  maxIterations: number;
};

type Observability = {
  schemaVersion: string;
  taskId: string;
  transitions: Transition[];
};

type TaskDetails = {
  executions: Execution[];
  transitions: Transition[];
  evalResults: EvalResult[];
  repairGoal: RepairGoal | null;
  observability: Observability;
};

type EventItem = {
  id: string;
  eventType: string;
  message?: string;
  traceId: string;
  taskId?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
};

type StreamStatus = "connecting" | "live" | "reconnecting";
type EventCategory =
  | "all"
  | "task"
  | "execution"
  | "goal"
  | "eval"
  | "scheduler"
  | "agent"
  | "plugin"
  | "governance"
  | "environment"
  | "other";

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ConsoleTab>("agents-runs");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [opsSnapshot, setOpsSnapshot] = useState<OpsSnapshot | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [pluginConfigs, setPluginConfigs] = useState<PluginConfig[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [dependencyChecks, setDependencyChecks] = useState<DependencyCheckSummary | null>(null);
  const [dependencyChecksOpen, setDependencyChecksOpen] = useState(false);
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [taskDetails, setTaskDetails] = useState<Record<string, TaskDetails>>({});
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [childIssueSyncMessage, setChildIssueSyncMessage] = useState<string | null>(null);
  const [meegleAuth, setMeegleAuth] = useState<MeegleAuthUiState>({
    status: "idle",
    message: ""
  });
  const [gitlabAuth, setGitlabAuth] = useState<GitLabAuthUiState>({
    status: "idle",
    message: ""
  });
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamRetryToken, setStreamRetryToken] = useState(0);
  const [taskQuery, setTaskQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState<EventCategory>("all");
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedRunObservability, setSelectedRunObservability] = useState<RunObservability | null>(null);
  const [rawLogRunId, setRawLogRunId] = useState<string | null>(null);
  const [rawLogs, setRawLogs] = useState<RunRawLogsResponse | null>(null);
  const [rawLogQuery, setRawLogQuery] = useState({ source: "all", q: "" });
  const [loadingRawLogs, setLoadingRawLogs] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const selectedTaskIdRef = useRef<string | null>(selectedTaskId);
  const selectedRunIdRef = useRef<string | null>(selectedRunId);
  const rawLogRunIdRef = useRef<string | null>(rawLogRunId);
  const rawLogQueryRef = useRef(rawLogQuery);

  const dateLocale = toDateLocale(locale);
  const formatDate = (value: string) => formatDateValue(value, dateLocale);
  const formatCounts = (counts: Record<string, number>) => formatCountsValue(counts, t("common.none"));

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  useEffect(() => {
    rawLogRunIdRef.current = rawLogRunId;
  }, [rawLogRunId]);

  useEffect(() => {
    rawLogQueryRef.current = rawLogQuery;
  }, [rawLogQuery]);

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    if (!matchesStatus) {
      return false;
    }
    const query = taskQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [
      task.id,
      task.title,
      task.repo,
      task.branch,
      task.executor,
      task.traceId
    ].some((value) => value.toLowerCase().includes(query));
  });
  const taskStatusCounts = groupTasksByStatus(tasks);

  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId((current) =>
      current && filteredTasks.some((task) => task.id === current) ? current : filteredTasks[0].id
    );
  }, [filteredTasks]);

  useEffect(() => {
    if (plugins.length === 0) {
      setSelectedPluginId(null);
      return;
    }
    setSelectedPluginId((current) => (current && plugins.some((plugin) => plugin.id === current) ? current : plugins[0].id));
  }, [plugins]);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }
    void refreshTaskDetails(selectedTaskId);
  }, [selectedTaskId]);

  useEffect(() => {
    setEventCategoryFilter("all");
  }, [selectedTaskId]);

  useEffect(() => {
    if (runs.length === 0) {
      setSelectedRunId(null);
      setSelectedRunObservability(null);
      setSelectedAgentId(null);
      return;
    }
    const currentRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
    const currentAgentExists = selectedAgentId ? agents.some((agent) => agent.id === selectedAgentId) : false;
    if (currentRun) {
      if (!currentAgentExists) {
        setSelectedAgentId(currentRun.agentId ?? null);
      }
      return;
    }
    if (!selectedRunId && selectedAgentId && currentAgentExists) {
      return;
    }
    const defaultRun = sortRunsByRecentActivity(runs)[0];
    setSelectedRunId(defaultRun.id);
    setSelectedAgentId(defaultRun.agentId ?? null);
  }, [agents, runs, selectedAgentId, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRunObservability(null);
      return;
    }
    void (async () => {
      try {
        const observability = await getRunObservability(selectedRunId);
        setSelectedRunObservability(observability);
      } catch {
        setSelectedRunObservability(null);
      }
    })();
  }, [selectedRunId]);

  useEffect(() => {
    if (!rawLogRunId) {
      setRawLogs(null);
      return;
    }
    void (async () => {
      setLoadingRawLogs(true);
      try {
        const response = await getRunRawLogs(rawLogRunId, rawLogQuery);
        setRawLogs(response);
      } catch {
        setRawLogs(null);
      } finally {
        setLoadingRawLogs(false);
      }
    })();
  }, [rawLogRunId, rawLogQuery]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedDetails = selectedTaskId ? taskDetails[selectedTaskId] : null;
  const selectedEvents = selectedTask
    ? recentEvents.filter((event) => event.taskId === selectedTask.id || event.traceId === selectedTask.traceId)
    : recentEvents;
  const eventCategoryCounts = groupEventsByCategory(selectedEvents);
  const filteredSelectedEvents = selectedEvents.filter((event) => matchesEventCategory(event.eventType, eventCategoryFilter));
  const selectedLifecycleTimelineItems = useMemo(
    () => buildLogTimelineItems({
      transitions: selectedDetails?.transitions ?? selectedDetails?.observability.transitions ?? []
    }),
    [selectedDetails?.observability.transitions, selectedDetails?.transitions]
  );
  const selectedLiveEventTimelineItems = useMemo(
    () => buildLogTimelineItems({
      liveEvents: filteredSelectedEvents
    }),
    [filteredSelectedEvents]
  );
  const selectedExecutionSummary = selectedDetails ? summarizeExecutionState(selectedTask, selectedDetails, selectedEvents, t) : null;
  const selectedPlugin = plugins.find((plugin) => plugin.id === selectedPluginId) ?? null;
  const selectedPluginConfig = selectedPlugin
    ? pluginConfigs.find((config) => config.pluginId === selectedPlugin.id) ?? null
    : null;
  const meeglePlugin = plugins.find((plugin) => plugin.id === "meegle") ?? null;

  function openMeeglePluginSettings(): void {
    setActiveTab("plugins");
    setSelectedPluginId("meegle");
  }

  function openDependencyChecks(): void {
    setDependencyChecksOpen(true);
    void refreshDependencyChecks();
  }

  async function refreshDependencyChecks(): Promise<void> {
    try {
      setDependencyChecks(await listDependencyChecks());
      setDetailError(null);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDependencyRecheck(): Promise<void> {
    setCheckingDependencies(true);
    try {
      setDependencyChecks(await recheckDependencies());
      setDetailError(null);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setCheckingDependencies(false);
    }
  }

  function handleDependencyAction(target: string): void {
    if (target === "meegle") {
      openMeeglePluginSettings();
      void startMeegleAuthorization();
      return;
    }
    if (target === "gitlab") {
      setActiveTab("plugins");
      setSelectedPluginId("gitlab");
      void startGitLabAuthorization();
      return;
    }
    setActiveTab("plugins");
    setSelectedPluginId(target);
  }

  function runTaskSyncNow(): void {
    void postJson("/debug/sync").then(refreshAll);
  }

  function renderTaskSyncEmptyState(filtered: boolean): ReactElement {
    if (filtered) {
      return <div className="empty-state">{t("tasks.emptyFilter")}</div>;
    }
    return <div className="empty-state">{t("tasks.emptyNone")}</div>;
  }

  async function refreshAll(): Promise<void> {
    setIsRefreshing(true);
    try {
      const [dashboardResponse, opsResponse, tasksResponse, agentsResponse, pluginsResponse, pluginConfigsResponse, readinessResponse, dependencyChecksResponse, runsResponse] = await Promise.all([
        fetchJson<DashboardData>("/dashboard"),
        fetchJson<OpsSnapshot>("/ops/events"),
        fetchJson<Task[]>("/tasks"),
        fetchJson<Agent[]>("/agents"),
        fetchJson<Plugin[]>("/plugins"),
        fetchJson<PluginConfig[]>("/plugin-configs"),
        fetchJson<Readiness>("/readiness"),
        listDependencyChecks(),
        listRuns()
      ]);
      setDashboard(dashboardResponse);
      setOpsSnapshot(opsResponse);
      setTasks(tasksResponse);
      setAgents(agentsResponse);
      setPlugins(pluginsResponse);
      setPluginConfigs(pluginConfigsResponse);
      setReadiness(readinessResponse);
      setDependencyChecks(dependencyChecksResponse);
      setRuns(runsResponse);
      setRefreshError(null);
      const meegle = pluginsResponse.find((plugin) => plugin.id === "meegle");
      if (meegle && !meegle.health.healthy) {
        try {
          const authStatus = await fetchJson<{ authenticated: boolean; status: string; message: string }>(
            "/integrations/meegle/auth/status"
          );
          setMeegleAuth((current) => {
            if (current.status === "starting" || current.status === "pending") {
              return current;
            }
            if (authStatus.authenticated) {
              return { status: "authenticated", message: t("meegle.authenticated") };
            }
            if (current.status === "authenticated") {
              return current;
            }
            return {
              status: "idle",
              message: summarizePluginHealthMessage(meegle.health.message)
            };
          });
        } catch {
          // ignore auth status probe failures during refresh
        }
      }
      const gitlab = pluginsResponse.find((plugin) => plugin.id === "gitlab");
      if (gitlab && !gitlab.health.healthy) {
        try {
          const authStatus = await fetchJson<{ authenticated: boolean; status: string; message: string }>(
            "/integrations/gitlab/auth/status"
          );
          setGitlabAuth((current) => {
            if (current.status === "starting" || current.status === "pending") {
              return current;
            }
            if (authStatus.authenticated) {
              return { status: "authenticated", message: t("gitlab.authenticated") };
            }
            if (current.status === "authenticated") {
              return current;
            }
            return {
              status: "idle",
              message: summarizePluginHealthMessage(gitlab.health.message)
            };
          });
        } catch {
          // ignore auth status probe failures during refresh
        }
      }
    } catch (refreshError) {
      setRefreshError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshTaskDetails(taskId: string): Promise<void> {
    setLoadingDetails(true);
    try {
      const [executions, transitions, evalResults, repairGoal, observability] = await Promise.all([
        fetchJson<Execution[]>(`/tasks/${taskId}/executions`),
        fetchJson<Transition[]>(`/tasks/${taskId}/transitions`),
        fetchJson<EvalResult[]>(`/tasks/${taskId}/eval-results`),
        fetchJson<RepairGoal | null>(`/tasks/${taskId}/repair-goal`),
        fetchJson<Observability>(`/tasks/${taskId}/observability`)
      ]);
      setTaskDetails((current) => ({
        ...current,
        [taskId]: {
          executions,
          transitions,
          evalResults,
          repairGoal,
          observability
        }
      }));
      setDetailError(null);
    } catch (detailError) {
      setDetailError(detailError instanceof Error ? detailError.message : String(detailError));
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;
    let refreshTimer: number | null = null;
    const source = new EventSource(`${API_BASE}/events`);
    setStreamStatus("connecting");
    source.onmessage = (event) => {
      const payload = safeParseEvent(event.data);
      setStreamStatus("live");
      setRecentEvents((current) => [payload, ...current].slice(0, 20));
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        void refreshAll();
        const activeTaskId = selectedTaskIdRef.current;
        if (activeTaskId) {
          void refreshTaskDetails(activeTaskId);
        }
        const activeRunId = selectedRunIdRef.current;
        if (activeRunId) {
          void getRunObservability(activeRunId)
            .then((observability) => setSelectedRunObservability(observability))
            .catch(() => setSelectedRunObservability(null));
        }
        const activeRawLogRunId = rawLogRunIdRef.current;
        if (activeRawLogRunId) {
          void getRunRawLogs(activeRawLogRunId, rawLogQueryRef.current)
            .then((response) => setRawLogs(response))
            .catch(() => setRawLogs(null));
        }
      }, 300);
    };
    source.onerror = () => {
      if (disposed) {
        return;
      }
      setStreamStatus("reconnecting");
      source.close();
      retryTimer = window.setTimeout(() => {
        if (!disposed) {
          setStreamRetryToken((current) => current + 1);
        }
      }, 2000);
    };

    return () => {
      disposed = true;
      source.close();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [streamRetryToken]);

  async function triggerTaskAction(
    taskId: string,
    action: "submit" | "resume" | "retry" | "reopen" | "cancel"
  ): Promise<void> {
    try {
      await postJson(`/tasks/${taskId}/${action}`);
      await Promise.all([refreshAll(), refreshTaskDetails(taskId)]);
      setRefreshError(null);
      setDetailError(null);
    } catch (actionError) {
      setDetailError(actionError instanceof Error ? actionError.message : String(actionError));
    }
  }

  async function syncChildRepairIssue(taskId: string): Promise<void> {
    try {
      setChildIssueSyncMessage(null);
      const result = await postJson<{
        ready: boolean;
        recovered: boolean;
        childExternalId: string | null;
        replyId: string | null;
        summary: string;
      }>(`/tasks/${taskId}/sync-human-repair-issue`);
      setChildIssueSyncMessage(
        result.recovered
          ? result.summary || "子任务方案已应用，父任务已恢复到队列。"
          : result.ready
            ? result.summary || "子任务方案已读取，本次未重复恢复。"
            : "子任务描述尚未以 `【开发中】` 开头"
      );
      await Promise.all([refreshAll(), refreshTaskDetails(taskId)]);
      setDetailError(null);
    } catch (syncError) {
      setDetailError(syncError instanceof Error ? syncError.message : String(syncError));
    }
  }

  async function startMeegleAuthorization(): Promise<void> {
    setMeegleAuth({ status: "starting", message: t("meegle.starting") });
    try {
      const started = await postJson<MeegleAuthStart>("/integrations/meegle/auth/start");
      window.open(started.authorizationUrl, "_blank", "noopener,noreferrer");
      setMeegleAuth({ status: "pending", message: started.message });
      await pollMeegleAuthorization(started);
    } catch (authError) {
      setMeegleAuth({
        status: "failed",
        message: authError instanceof Error ? authError.message : String(authError)
      });
    }
  }

  async function startGitLabAuthorization(): Promise<void> {
    setGitlabAuth({ status: "starting", message: t("gitlab.starting") });
    try {
      const started = await postJson<GitLabAuthStart>("/integrations/gitlab/auth/start");
      window.open(started.authorizationUrl, "_blank", "noopener,noreferrer");
      setGitlabAuth({ status: "pending", message: `${started.message}: ${started.userCode}` });
      await pollGitLabAuthorization(started);
    } catch (authError) {
      setGitlabAuth({
        status: "failed",
        message: authError instanceof Error ? authError.message : String(authError)
      });
    }
  }

  async function togglePluginEnabled(plugin: Plugin, nextEnabled: boolean): Promise<void> {
    setTogglingPluginId(plugin.id);
    try {
      const currentConfig = pluginConfigs.find((config) => config.pluginId === plugin.id) ?? null;
      await postJson("/plugin-configs", {
        pluginId: plugin.id,
        kind: plugin.kind,
        enabled: nextEnabled,
        priority: currentConfig?.priority ?? plugin.priority,
        config: currentConfig?.config ?? {}
      });
      await refreshAll();
      setDetailError(null);
    } catch (toggleError) {
      setDetailError(toggleError instanceof Error ? toggleError.message : String(toggleError));
    } finally {
      setTogglingPluginId((current) => (current === plugin.id ? null : current));
    }
  }

  async function pollMeegleAuthorization(input: MeegleAuthStart): Promise<void> {
    try {
      const result = await postJson<MeegleAuthPoll>("/integrations/meegle/auth/poll", {
        deviceCode: input.deviceCode,
        clientId: input.clientId,
        intervalSeconds: input.intervalSeconds,
        expiresInSeconds: input.expiresInSeconds
      });
      setMeegleAuth({ status: result.status, message: result.message });
      if (result.authenticated) {
        await refreshAll();
        return;
      }
      if (result.status === "pending") {
        window.setTimeout(() => {
          void pollMeegleAuthorization(input);
        }, Math.max(input.intervalSeconds, 1) * 1000);
      }
    } catch (authError) {
      setMeegleAuth({
        status: "failed",
        message: authError instanceof Error ? authError.message : String(authError)
      });
    }
  }

  async function pollGitLabAuthorization(input: GitLabAuthStart): Promise<void> {
    try {
      const result = await postJson<GitLabAuthPoll>("/integrations/gitlab/auth/poll");
      setGitlabAuth({ status: result.status, message: result.message });
      if (result.authenticated) {
        await refreshAll();
        return;
      }
      if (result.status === "pending") {
        window.setTimeout(() => {
          void pollGitLabAuthorization(input);
        }, Math.max(input.intervalSeconds, 1) * 1000);
      }
    } catch (authError) {
      setGitlabAuth({
        status: "failed",
        message: authError instanceof Error ? authError.message : String(authError)
      });
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-title-container">
          <div className="hero-title-row">
            <span className="eyebrow">DITING</span>
            <h1>{t("hero.title")}</h1>
          </div>
          <p className="lede">
            {t("hero.lede")}
          </p>
        </div>
        <div className="hero-actions">
          <span className={`stream-badge stream-${streamStatus}`}>
            {streamStatus === "live" ? (
              <>
                <span className="pulse-dot"></span>
                {t("stream.live")}
              </>
            ) : streamStatus === "connecting" ? (
              t("stream.connecting")
            ) : (
              t("stream.reconnecting")
            )}
          </span>
          <button
            className="secondary-button"
            onClick={runTaskSyncNow}
            title={t("actions.syncTooltip")}
            type="button"
          >
            {t("actions.sync")}
          </button>
          <button
            className="secondary-button"
            onClick={() => void postJson("/debug/scheduler").then(refreshAll)}
            title={t("actions.dispatchTooltip")}
            type="button"
          >
            {t("actions.dispatch")}
          </button>
          <button
            className={dependencyChecks?.degraded ? "secondary-button danger-button" : "secondary-button"}
            onClick={openDependencyChecks}
            type="button"
          >
            {dependencyChecks?.degraded ? t("dependencyChecks.degraded") : t("dependencyChecks.open")}
          </button>
          <button
            className="primary-button"
            onClick={() => void refreshAll()}
            title={t("actions.refreshTooltip")}
            type="button"
          >
            {isRefreshing ? t("actions.refreshing") : t("actions.refresh")}
          </button>
          <button
            aria-label={t("actions.switchLanguage")}
            className="secondary-button locale-toggle"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            title={t("actions.switchLanguage")}
            type="button"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
          <button
            aria-label={t("actions.switchTheme")}
            aria-pressed={theme === "dark"}
            className="secondary-button theme-toggle"
            onClick={toggleTheme}
            title={t("actions.switchTheme")}
            type="button"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {refreshError ? (
        <section className="banner danger banner-actionable">
          <span>{t("banner.refreshFailed", { error: refreshError })}</span>
          <button className="secondary-button" onClick={() => void refreshAll()} type="button">
            {t("banner.retryRefresh")}
          </button>
        </section>
      ) : null}
      {streamStatus === "reconnecting" ? (
        <section className="banner warning banner-actionable">
          <span>{t("banner.streamDisconnected")}</span>
          <button
            className="secondary-button"
            onClick={() => {
              setStreamStatus("connecting");
              setStreamRetryToken((current) => current + 1);
            }}
            type="button"
          >
            {t("banner.reconnectNow")}
          </button>
        </section>
      ) : null}
      {detailError ? <section className="banner danger">{detailError}</section> : null}

      <nav aria-label={t("nav.label")} className="top-nav">
        {([
          ["overview", t("nav.overview")],
          ["agents-runs", t("nav.agentsRuns")],
          ["plugins", t("nav.plugins")],
          ["tasks", t("nav.tasks")],
          ["events", t("nav.events")]
        ] as Array<[ConsoleTab, string]>).map(([tab, label]) => (
          <button
            className={`nav-tab ${activeTab === tab ? "nav-tab-active" : ""}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
      <>
      <section className="stats-grid">
        <StatCard title={t("stats.tasks")} value={dashboard?.tasks.total ?? 0} detail={formatCounts(dashboard?.tasks.byStatus ?? {})} />
        <StatCard title={t("stats.agents")} value={dashboard?.agents.total ?? 0} detail={formatCounts(dashboard?.agents.byStatus ?? {})} />
        <StatCard title={t("stats.plugins")} value={dashboard?.plugins.total ?? 0} detail={t("stats.healthy", { count: dashboard?.plugins.healthy ?? 0 })} />
      </section>

      <section className="panel ops-panel">
        <div className="panel-header">
          <div>
            <h2>{t("ops.title")}</h2>
            <p className="meta detail-subtitle">
              {t("ops.subtitle")}
            </p>
          </div>
          <span>{opsSnapshot?.watchedEventCount ?? 0}</span>
        </div>

        <div className="ops-summary-grid">
          <StatCard title={t("ops.watchedEvents")} value={opsSnapshot?.watchedEventCount ?? 0} detail={formatCounts(opsSnapshot?.eventTypeCounts ?? {})} />
          <StatCard
            title={t("ops.abnormalTasks")}
            value={opsSnapshot?.recentAbnormalTasks.length ?? 0}
            detail={opsSnapshot?.recentAbnormalTasks[0] ? t("ops.latest", { label: formatEventLabel(opsSnapshot.recentAbnormalTasks[0].eventType) }) : t("common.none")}
          />
          <StatCard
            title={t("ops.topEvent")}
            value={opsSnapshot?.eventTypeRanking[0]?.count ?? 0}
            detail={opsSnapshot?.eventTypeRanking[0] ? formatEventLabel(opsSnapshot.eventTypeRanking[0].eventType) : t("common.none")}
          />
        </div>

        <div className="ops-grid">
          <article className="detail-card ops-card">
            <div className="subpanel-header">
              <h3>{t("ops.ranking")}</h3>
              <span>{opsSnapshot?.eventTypeRanking.length ?? 0}</span>
            </div>
            <div className="timeline-list compact-list">
              {(opsSnapshot?.eventTypeRanking ?? []).map((item) => (
                <article className={`timeline-item event-${classifyEventTone(item.eventType)}`} key={item.eventType}>
                  <div>
                    <p className="timeline-title">{formatEventLabel(item.eventType)}</p>
                    <p className="meta">{t("ops.recentAbnormalSignal")}</p>
                  </div>
                  <p className="mono">{t("ops.count", { count: item.count })}</p>
                </article>
              ))}
              {(opsSnapshot?.eventTypeRanking ?? []).length === 0 ? <div className="empty-state">{t("ops.emptyRanking")}</div> : null}
            </div>
          </article>

          <article className="detail-card ops-card">
            <div className="subpanel-header">
              <h3>{t("ops.recentAbnormalTasks")}</h3>
              <span>{opsSnapshot?.recentAbnormalTasks.length ?? 0}</span>
            </div>
            <div className="timeline-list compact-list">
              {(opsSnapshot?.recentAbnormalTasks ?? []).map((item) => (
                <button className="ops-task-row" key={`${item.taskId}-${item.eventType}-${item.createdAt}`} onClick={() => { setActiveTab("tasks"); setSelectedTaskId(item.taskId); }} type="button">
                  <div>
                    <p className="timeline-title">
                      {item.title}
                      <span className={`badge status-${item.status}`}>{item.status}</span>
                    </p>
                    <p className="meta">
                      {formatEventLabel(item.eventType)} · {t("common.retryCount", { count: item.retryCount })} · {t("common.repairCount", { count: item.repairCount })}
                    </p>
                    <p className="event-context">{item.message}</p>
                  </div>
                  <p className="mono">{formatDate(item.createdAt)}</p>
                </button>
              ))}
              {(opsSnapshot?.recentAbnormalTasks ?? []).length === 0 ? <div className="empty-state">{t("ops.emptyAbnormal")}</div> : null}
            </div>
          </article>

          <article className="detail-card ops-card">
            <div className="subpanel-header">
              <h3>{t("ops.watchedFeed")}</h3>
              <span>{opsSnapshot?.recentWatchedEvents.length ?? 0}</span>
            </div>
            <div className="timeline-list compact-list">
              {(opsSnapshot?.recentWatchedEvents ?? []).map((event) => (
                <article className={`timeline-item event-${classifyEventTone(event.eventType)}`} key={event.id}>
                  <div>
                    <p className="timeline-title">
                      {formatEventLabel(event.eventType)}
                      <span className={`event-pill event-${classifyEventTone(event.eventType)}`}>
                        {classifyEventTone(event.eventType)}
                      </span>
                    </p>
                    <p className="meta">{eventSummary(event)}</p>
                  </div>
                  <p className="mono">{event.createdAt ? formatDate(event.createdAt) : t("common.live")}</p>
                </article>
              ))}
              {(opsSnapshot?.recentWatchedEvents ?? []).length === 0 ? <div className="empty-state">{t("ops.emptyFeed")}</div> : null}
            </div>
          </article>
        </div>
      </section>
      </>
      ) : null}

      {activeTab === "agents-runs" ? (
        <AgentsRunsView
          agents={agents}
          onOpenRawLogs={(runId) => {
            setRawLogQuery({ source: "stdout", q: "" });
            setRawLogRunId(runId);
          }}
          onSelectRun={setSelectedRunId}
          runs={runs}
          selectedRun={selectedRunObservability}
          selectedRunId={selectedRunId}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />
      ) : null}

      {activeTab === "plugins" ? (
        <PluginsPanel
          integrationAuthSlot={
            selectedPlugin?.id === "meegle" ? (
              <div className="config-block meegle-auth-block">
                <div className="subpanel-header">
                  <p className="eyebrow compact">{t("meegle.title")}</p>
                  <span className={`badge ${meegleAuth.status === "authenticated" || selectedPlugin.health.healthy ? "status-done" : "status-failed"}`}>
                    {meegleAuth.status === "idle" ? (selectedPlugin.health.healthy ? t("meegle.statusReady") : t("meegle.statusRequired")) : meegleAuth.status}
                  </span>
                </div>
                <p className="meta">
                  {meegleAuth.message || (selectedPlugin.health.healthy
                    ? t("meegle.ready")
                    : t("meegle.authorizePrompt"))}
                </p>
                {!selectedPlugin.health.healthy ? (
                  <p className="meta meegle-health-detail">
                    {summarizePluginHealthMessage(selectedPlugin.health.message)}
                  </p>
                ) : null}
                {!selectedPlugin.health.healthy && meegleAuth.status !== "authenticated" ? (
                  <button
                    className="primary-button"
                    disabled={meegleAuth.status === "starting" || meegleAuth.status === "pending"}
                    onClick={() => void startMeegleAuthorization()}
                    type="button"
                  >
                    {meegleAuth.status === "starting" || meegleAuth.status === "pending" ? t("meegle.authorizing") : t("meegle.authorize")}
                  </button>
                ) : null}
                {selectedPlugin.health.healthy && tasks.length === 0 ? (
                  <button className="secondary-button" onClick={runTaskSyncNow} type="button">
                    {t("meegle.syncNow")}
                  </button>
                ) : null}
              </div>
            ) : selectedPlugin?.id === "gitlab" ? (
              <div className="config-block meegle-auth-block">
                <div className="subpanel-header">
                  <p className="eyebrow compact">{t("gitlab.title")}</p>
                  <span className={`badge ${gitlabAuth.status === "authenticated" || selectedPlugin.health.healthy ? "status-done" : "status-failed"}`}>
                    {gitlabAuth.status === "idle" ? (selectedPlugin.health.healthy ? t("gitlab.statusReady") : t("gitlab.statusRequired")) : gitlabAuth.status}
                  </span>
                </div>
                <p className="meta">
                  {gitlabAuth.message || (selectedPlugin.health.healthy
                    ? t("gitlab.ready")
                    : t("gitlab.authorizePrompt"))}
                </p>
                {!selectedPlugin.health.healthy ? (
                  <p className="meta meegle-health-detail">
                    {summarizePluginHealthMessage(selectedPlugin.health.message)}
                  </p>
                ) : null}
                {!selectedPlugin.health.healthy && gitlabAuth.status !== "authenticated" ? (
                  <button
                    className="primary-button"
                    disabled={gitlabAuth.status === "starting" || gitlabAuth.status === "pending"}
                    onClick={() => void startGitLabAuthorization()}
                    type="button"
                  >
                    {gitlabAuth.status === "starting" || gitlabAuth.status === "pending" ? t("gitlab.authorizing") : t("gitlab.authorize")}
                  </button>
                ) : null}
              </div>
            ) : meeglePlugin && !meeglePlugin.health.healthy ? (
              <div className="config-block meegle-auth-block">
                <p className="meta">{t("meegle.unavailableSummary")}</p>
                <button className="secondary-button" onClick={openMeeglePluginSettings} type="button">
                  {t("meegle.viewStatus")}
                </button>
              </div>
            ) : null
          }
          onSelectPlugin={setSelectedPluginId}
          onTogglePlugin={(plugin, nextEnabled) => void togglePluginEnabled(plugin, nextEnabled)}
          pluginConfigs={pluginConfigs}
          plugins={plugins}
          readiness={readiness}
          selectedPluginId={selectedPluginId}
          togglingPluginId={togglingPluginId}
        />
      ) : null}

      {activeTab === "tasks" ? (
      <main className={`console-layout${isLeftSidebarOpen ? "" : " sidebar-left-collapsed"}${isRightSidebarOpen ? "" : " sidebar-right-collapsed"}`}>
        <section className={`panel task-panel sidebar-left ${isLeftSidebarOpen ? "" : "collapsed"}`}>
          <div className="panel-header">
            <h2>{t("tasks.title")}</h2>
            <span>{filteredTasks.length}</span>
          </div>
          <div className="task-filter-row">
            <span className="eyebrow compact">{t("tasks.activeQueue")}</span>
            {renderCountChips(taskStatusCounts, t("common.none"))}
          </div>
          <div className="task-search-row">
            <input
              aria-label={t("tasks.searchAria")}
              className="task-search"
              onChange={(event) => setTaskQuery(event.target.value)}
              placeholder={t("tasks.searchPlaceholder")}
              type="search"
              value={taskQuery}
            />
          </div>
          <div className="filter-pills" role="tablist" aria-label={t("tasks.statusFilters")}>
            {buildStatusFilters(taskStatusCounts, t("common.all"), t).map((filter) => (
              <button
                aria-pressed={statusFilter === filter.value}
                className={`filter-pill ${statusFilter === filter.value ? "filter-pill-active" : ""}`}
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>
          <div className="stack">
            {filteredTasks.map((task) => (
              <button
                className={`task-card ${selectedTaskId === task.id ? "task-card-selected" : ""}`}
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                type="button"
              >
                <div className="card-head">
                  <h3>{task.title}</h3>
                  <span className={`badge status-${task.status}`}>{task.status}</span>
                </div>
                <p className="mono">{task.repo}#{task.branch}</p>
                <p className="meta">
                  {formatTaskRoute(task, t)} · {task.priority} · {t("common.repairCount", { count: task.repairCount })} · {t("common.retryCount", { count: task.retryCount })}
                </p>
              </button>
            ))}
            {filteredTasks.length === 0 ? renderTaskSyncEmptyState(tasks.length > 0) : null}
          </div>
        </section>

        <section className="panel detail-panel detail-main">
          <div className="panel-header">
            <div className="panel-header-leading">
              <button
                className="sidebar-toggle-button sidebar-toggle-left"
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                title={isLeftSidebarOpen ? t("sidebar.collapseLeft") : t("sidebar.expandLeft")}
                type="button"
              >
                <span aria-hidden className="sidebar-toggle-icon">{isLeftSidebarOpen ? "◀" : "▶"}</span>
              </button>
              <div className="panel-header-titles">
                <div className="panel-header-title-row">
                  <h2>{selectedTask?.title ?? t("tasks.detailTitle")}</h2>
                  {selectedTask ? <span className={`badge status-${selectedTask.status}`}>{selectedTask.status}</span> : null}
                </div>
                <p
                  className="meta detail-subtitle"
                  title={selectedTask ? `${selectedTask.repo}#${selectedTask.branch} · ${selectedTask.executor}` : undefined}
                >
                  {selectedTask ? `${selectedTask.repo}#${selectedTask.branch} · ${selectedTask.executor}` : t("tasks.selectTask")}
                </p>
              </div>
            </div>
            <div className="panel-header-trailing">
              <button
                className={`sidebar-toggle-button sidebar-toggle-agents${isRightSidebarOpen ? "" : " sidebar-toggle-agents-collapsed"}`}
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                title={isRightSidebarOpen ? t("sidebar.collapseRight") : t("sidebar.expandRight")}
                type="button"
              >
                {isRightSidebarOpen ? <span aria-hidden className="sidebar-toggle-icon">▶</span> : t("sidebar.agentsShort")}
              </button>
            </div>
          </div>

          {selectedTask ? (
            <>
              <div className="action-row">
                <button className="secondary-button" onClick={() => void triggerTaskAction(selectedTask.id, "submit")} type="button">
                  {t("actions.submit")}
                </button>
                {selectedTask.status === "waiting" ? (
                  <button className="secondary-button" onClick={() => void triggerTaskAction(selectedTask.id, "resume")} type="button">
                    {t("actions.resume")}
                  </button>
                ) : null}
                {selectedTask.status === "failed" && !hasChildRepairIssue(selectedTask) ? (
                  <button className="secondary-button" onClick={() => void triggerTaskAction(selectedTask.id, "retry")} type="button">
                    {t("actions.retry")}
                  </button>
                ) : null}
                {["succeeded", "failed", "cancelled"].includes(selectedTask.status) ? (
                  <button className="secondary-button" onClick={() => void triggerTaskAction(selectedTask.id, "reopen")} type="button">
                    {t("actions.reopen")}
                  </button>
                ) : null}
                <button className="secondary-button danger-outline" onClick={() => void triggerTaskAction(selectedTask.id, "cancel")} type="button">
                  {t("actions.cancel")}
                </button>
                {hasChildRepairIssue(selectedTask) ? (
                  <button className="secondary-button" onClick={() => void syncChildRepairIssue(selectedTask.id)} type="button">
                    检查子任务方案
                  </button>
                ) : null}
              </div>
              {childIssueSyncMessage ? <section className="banner info">{childIssueSyncMessage}</section> : null}

              <div className="detail-grid">
                <TaskContextCard key={selectedTask.id} task={selectedTask} formatDate={formatDate} />
                <OpenSpecWorkflowCard task={selectedTask} />

                <article className="detail-card">
                  <p className="eyebrow compact">{t("tasks.repairGoal")}</p>
                  {selectedDetails?.repairGoal ? (
                    <>
                      <p className="detail-copy">{selectedDetails.repairGoal.objective}</p>
                      <p className="meta">
                        {selectedDetails.repairGoal.status} · {t("tasks.iteration", {
                          current: selectedDetails.repairGoal.currentIteration,
                          max: selectedDetails.repairGoal.maxIterations
                        })}
                      </p>
                      <p className="mono">
                        {selectedDetails.repairGoal.doneWhen.length > 0
                          ? selectedDetails.repairGoal.doneWhen.join(" · ")
                          : t("tasks.noDoneWhen")}
                      </p>
                    </>
                  ) : (
                    <p className="meta">{t("tasks.noRepairGoal")}</p>
                  )}
                </article>
              </div>

              <section className="summary-strip">
                <article className={`summary-card ${selectedExecutionSummary?.tone ?? "neutral"}`}>
                  <p className="eyebrow compact">{t("summary.executionRecovery")}</p>
                  <p className="summary-title">{selectedExecutionSummary?.headline ?? t("summary.noRecovery")}</p>
                  <p className="meta">{selectedExecutionSummary?.detail ?? t("summary.noRetryBlock")}</p>
                </article>
                <article className="summary-card neutral">
                  <p className="eyebrow compact">{t("summary.currentPressure")}</p>
                  <p className="summary-title">
                    {t("common.retryCount", { count: selectedTask.retryCount })} · {t("common.repairCount", { count: selectedTask.repairCount })}
                  </p>
                  <p className="meta">
                    {selectedDetails?.evalResults[0]
                      ? t("summary.latestEval", { score: selectedDetails.evalResults[0].score, risk: selectedDetails.evalResults[0].riskLevel })
                      : t("summary.noEval")}
                  </p>
                </article>
              </section>

              <section className="timeline-section">
                <div className="subpanel-header">
                  <h3>{t("sections.executions")}</h3>
                  <span>{selectedDetails?.executions.length ?? 0}</span>
                </div>
                <div className="mini-grid">
                  {(selectedDetails?.executions ?? []).map((execution) => (
                    <article className="mini-card" key={execution.id}>
                      <div className="card-head">
                        <strong className="mono">{execution.id}</strong>
                        <span className={`badge status-${execution.status}`}>{execution.status}</span>
                      </div>
                      <p className="meta">
                        {formatExecutionRoute(execution, t)} · {execution.agentId ?? t("tasks.noAgent")}
                      </p>
                      <p>{execution.summary ?? t("tasks.noSummary")}</p>
                      <p className="mono">
                        {formatDate(execution.startedAt)}
                        {execution.endedAt ? ` → ${formatDate(execution.endedAt)}` : ""}
                      </p>
                    </article>
                  ))}
                  {(selectedDetails?.executions ?? []).length === 0 ? <div className="empty-state">{t("tasks.emptyExecutions")}</div> : null}
                </div>
              </section>

              <section className="timeline-section">
                <LogTimelineView
                  emptyMessage={t("logTimeline.lifecycleEmpty")}
                  formatDate={formatDate}
                  items={selectedLifecycleTimelineItems}
                  loading={loadingDetails}
                  subtitle={t("logTimeline.lifecycleSubtitle")}
                  title={t("sections.lifecycle")}
                />
              </section>

              <section className="timeline-section">
                <div className="task-filter-row event-filter-row">
                  <span className="eyebrow compact">{t("tasks.eventLens")}</span>
                  {renderCountChips(eventCategoryCounts, t("common.none"))}
                </div>
                <div className="filter-pills" role="tablist" aria-label={t("events.categoryFilters")}>
                  {buildEventCategoryFilters(eventCategoryCounts, t("common.all")).map((filter) => (
                    <button
                      aria-pressed={eventCategoryFilter === filter.value}
                      className={`filter-pill ${eventCategoryFilter === filter.value ? "filter-pill-active" : ""}`}
                      key={filter.value}
                      onClick={() => setEventCategoryFilter(filter.value)}
                      type="button"
                    >
                      {filter.label}
                      <span>{filter.count}</span>
                    </button>
                  ))}
                </div>
                <LogTimelineView
                  emptyMessage={eventCategoryFilter === "all" ? t("events.emptyNone") : t("events.emptyFilter")}
                  formatDate={formatDate}
                  items={selectedLiveEventTimelineItems}
                  loading={loadingDetails}
                  subtitle={t("logTimeline.liveEventSubtitle")}
                  title={t("sections.liveEvents")}
                />
              </section>

              <section className="timeline-section">
                <div className="subpanel-header">
                  <h3>{t("sections.evalResults")}</h3>
                  <span>{selectedDetails?.evalResults.length ?? 0}</span>
                </div>
                <div className="timeline-list compact-list">
                  {(selectedDetails?.evalResults ?? []).map((result) => (
                    <article className="timeline-item" key={result.id}>
                      <div>
                        <p className="timeline-title">
                          {t("eval.score", { score: result.score, risk: result.riskLevel })}
                        </p>
                        <p className="meta">{result.passed ? t("eval.passed") : t("eval.failed")}</p>
                      </div>
                      <p className="mono">{formatDate(result.createdAt)}</p>
                    </article>
                  ))}
                  {(selectedDetails?.evalResults ?? []).length === 0 ? <div className="empty-state">{t("tasks.emptyEvals")}</div> : null}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">{t("tasks.noTaskSelected")}</div>
          )}
        </section>

        <section className={`panel sidebar-panel sidebar-right ${isRightSidebarOpen ? "" : "collapsed"}`}>
          <div className="panel-header">
            <h2>{t("agents.title")}</h2>
            <span>{agents.length}</span>
          </div>
          <div className="stack">
            {agents.map((agent) => (
              <article className="card" key={agent.id}>
                <div className="card-head">
                  <h3>{agent.id}</h3>
                  <span className={`badge status-${agent.status}`}>{agent.status}</span>
                </div>
                <p className="meta">
                  {formatAgentRoute(agent, t)} · {agent.taskId ? t("tasks.taskRef", { id: agent.taskId }) : t("common.idle")}
                </p>
              </article>
            ))}
            {agents.length === 0 ? <div className="empty-state">{t("agents.empty")}</div> : null}
          </div>
        </section>
      </main>
      ) : null}

      {activeTab === "events" ? (
        <section className="panel ops-panel">
          <div className="panel-header">
            <h2>{t("sections.liveEvents")}</h2>
            <span>{recentEvents.length}</span>
          </div>
          <div className="timeline-list events-timeline-list">
            {recentEvents.map((event) => (
              <article className={`timeline-item event-${classifyEventTone(event.eventType)}`} key={event.id}>
                <div>
                  <p className="timeline-title">{formatEventLabel(event.eventType)}</p>
                  <p className="meta">{eventSummary(event)}</p>
                </div>
                <p className="mono">{event.createdAt ? formatDate(event.createdAt) : t("common.live")}</p>
              </article>
            ))}
            {recentEvents.length === 0 ? <div className="empty-state">{t("events.emptyNone")}</div> : null}
          </div>
        </section>
      ) : null}

      <RawLogModal
        isOpen={rawLogRunId !== null}
        loading={loadingRawLogs}
        logs={rawLogs}
        onClose={() => setRawLogRunId(null)}
        onQueryChange={setRawLogQuery}
        query={rawLogQuery}
        runId={rawLogRunId ?? ""}
      />
      <DependencyCheckModal
        checking={checkingDependencies}
        isOpen={dependencyChecksOpen}
        onAction={handleDependencyAction}
        onClose={() => setDependencyChecksOpen(false)}
        onRecheck={() => void handleDependencyRecheck()}
        summary={dependencyChecks}
      />
    </div>
  );
}

function StatCard(props: { title: string; value: number; detail: string }) {
  return (
    <article className="stat-card">
      <p className="eyebrow">{props.title}</p>
      <strong>{props.value}</strong>
      <span>{props.detail}</span>
    </article>
  );
}

function Metric(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="metric">
      <span className="eyebrow compact">{props.label}</span>
      <strong className={props.mono ? "mono" : undefined}>{props.value}</strong>
    </div>
  );
}

const INSTRUCTION_COLLAPSE_THRESHOLD = 180;

function truncateMiddle(value: string, max = 14): string {
  if (value.length <= max) {
    return value;
  }
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

function isLongInstruction(instruction?: string): boolean {
  if (!instruction) {
    return false;
  }
  return instruction.length > INSTRUCTION_COLLAPSE_THRESHOLD || instruction.split("\n").length > 3;
}

function TaskContextCard(props: { task: Task; formatDate: (value: string) => string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const instruction = props.task.instruction ?? t("tasks.noInstruction");
  const collapsible = isLongInstruction(props.task.instruction);

  return (
    <article className="detail-card detail-card-compact task-context-card">
      <div className="context-header">
        <p className="eyebrow compact">{t("tasks.context")}</p>
        <div className="context-metrics-chips">
          <span className="stat-chip mono" title={props.task.traceId}>
            {t("metric.trace")}: {truncateMiddle(props.task.traceId)}
          </span>
          <span className="stat-chip">{t("metric.created")}: {props.formatDate(props.task.createdAt)}</span>
          <span className="stat-chip">{t("metric.priority")}: {props.task.priority}</span>
        </div>
      </div>
      <p className={`detail-copy${collapsible && !expanded ? " detail-copy-clamped" : ""}`}>{instruction}</p>
      {collapsible ? (
        <button className="context-expand-btn" onClick={() => setExpanded(!expanded)} type="button">
          {expanded ? t("tasks.collapseInstruction") : t("tasks.expandInstruction")}
        </button>
      ) : null}
    </article>
  );
}

function OpenSpecWorkflowCard(props: { task: Task }) {
  const { t } = useI18n();
  const metadata = props.task.metadata;
  if (!metadata?.openSpecReview && !metadata?.openspecChangeId && !metadata?.sourceProductTaskId && !metadata?.workspaceId) {
    return null;
  }
  const review = metadata.openSpecReview;
  const heading = metadata.sourceProductTaskId || metadata.approvedOpenSpec
    ? t("tasks.openspecHandoff")
    : t("tasks.openspecReview");
  const rows = [
    { label: t("tasks.openspecRole"), value: metadata.workflowRole },
    { label: t("tasks.openspecSourceProduct"), value: metadata.sourceProductTaskId },
    { label: t("tasks.openspecChange"), value: metadata.openspecChangeId },
    { label: t("tasks.openspecRevision"), value: metadata.openspecRevision },
    { label: t("tasks.openspecWorkspace"), value: metadata.workspaceId },
    { label: t("tasks.openspecReviewId"), value: review?.externalId },
    { label: t("tasks.openspecDecision"), value: review?.lastDecision ?? review?.decision },
    { label: t("tasks.openspecReply"), value: review?.replyId },
    { label: t("tasks.openspecError"), value: review?.error }
  ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);

  return (
    <article className="detail-card detail-card-compact">
      <p className="eyebrow compact">{heading}</p>
      <div className="metadata-grid">
        {rows.map((row) => (
          <div className="metadata-row" key={row.label}>
            <span className="meta">{row.label}</span>
            <strong className="mono">{row.value}</strong>
          </div>
        ))}
        {metadata.approvedOpenSpec ? (
          <div className="metadata-row">
            <span className="meta">{t("tasks.openspecApproved")}</span>
            <strong className="mono">true</strong>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatCountsValue(counts: Record<string, number>, noneLabel: string): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return noneLabel;
  }
  return entries.map(([key, value]) => `${key}:${value}`).join(" · ");
}

function renderCountChips(counts: Record<string, number>, noneLabel: string) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return <span className="meta">{noneLabel}</span>;
  }
  return (
    <div className="stat-chips">
      {entries.map(([key, value]) => (
        <span className="stat-chip" key={key}>
          {key}:{value}
        </span>
      ))}
    </div>
  );
}

function groupTasksByStatus(tasks: Task[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((result, task) => {
    result[task.status] = (result[task.status] ?? 0) + 1;
    return result;
  }, {});
}

function groupEventsByCategory(events: EventItem[]): Record<string, number> {
  return events.reduce<Record<string, number>>((result, event) => {
    const category = categorizeEventType(event.eventType);
    result[category] = (result[category] ?? 0) + 1;
    return result;
  }, {});
}

function buildStatusFilters(counts: Record<string, number>, allLabel: string, t: Translator): Array<{ value: string; label: string; count: number }> {
  const orderedStatuses = ["all", "draft", "ready", "active", "waiting", "succeeded", "failed", "cancelled"];
  return orderedStatuses
    .map((status) => ({
      value: status,
      label: status === "all" ? allLabel : t(`status.${status}` as "status.draft"),
      count: status === "all" ? Object.values(counts).reduce((sum, value) => sum + value, 0) : counts[status] ?? 0
    }))
    .filter((item) => item.value === "all" || item.count > 0);
}

function isPluginToggleBlocked(kind: string): boolean {
  return kind === "environment" || kind === "log";
}

function formatTaskRoute(
  task: Pick<Task, "executor" | "agentKind" | "driverId" | "preferredDriver" | "preferredRuntime" | "runtimeProviderId">,
  t: Translator
): string {
  const parts = [
    task.agentKind ?? task.executor,
    `${t("common.driver")} ${task.driverId ?? task.preferredDriver ?? "coding"}`,
    `${t("common.runtime")} ${task.runtimeProviderId ?? task.preferredRuntime ?? "auto"}`
  ];
  return parts.join(" · ");
}

function formatExecutionRoute(
  execution: Pick<Execution, "executor" | "agentKind" | "driverId" | "runtimeProviderId">,
  t: Translator
): string {
  const parts = [
    execution.agentKind ?? execution.executor,
    `${t("common.driver")} ${execution.driverId ?? "coding"}`,
    `${t("common.runtime")} ${execution.runtimeProviderId ?? "auto"}`
  ];
  return parts.join(" · ");
}

function formatAgentRoute(
  agent: Pick<Agent, "executor" | "kind" | "driverId" | "runtimeProviderId">,
  t: Translator
): string {
  const parts = [
    agent.kind ?? agent.executor,
    `${t("common.driver")} ${agent.driverId ?? "coding"}`,
    `${t("common.runtime")} ${agent.runtimeProviderId ?? "auto"}`
  ];
  return parts.join(" · ");
}

function buildEventCategoryFilters(counts: Record<string, number>, allLabel: string): Array<{ value: EventCategory; label: string; count: number }> {
  const orderedCategories: EventCategory[] = [
    "all",
    "execution",
    "task",
    "goal",
    "eval",
    "scheduler",
    "agent",
    "plugin",
    "governance",
    "environment",
    "other"
  ];
  return orderedCategories
    .map((category) => ({
      value: category,
      label: category === "all" ? allLabel : category,
      count: category === "all" ? Object.values(counts).reduce((sum, value) => sum + value, 0) : counts[category] ?? 0
    }))
    .filter((item) => item.value === "all" || item.count > 0);
}

function formatDateValue(value: string, dateLocale: string): string {
  return new Date(value).toLocaleString(dateLocale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function safeParseEvent(raw: string): EventItem {
  try {
    return JSON.parse(raw) as EventItem;
  } catch {
    return {
      id: `raw-${raw.length}`,
      eventType: "unknown",
      traceId: "unknown"
    };
  }
}

function classifyEventTone(eventType: string): "info" | "warn" | "success" | "danger" {
  if (
    eventType.includes("blocked")
    || eventType.includes("failed")
    || eventType.includes("needs_human")
    || eventType.includes("stderr")
    || eventType.includes("runtime.error")
  ) {
    return "danger";
  }
  if (eventType.includes("timeout") || eventType.includes("idle_timeout")) {
    return "warn";
  }
  if (eventType.includes("retry") || eventType.includes("requeued") || eventType.includes("repair")) {
    return "warn";
  }
  if (eventType.includes("done") || eventType.includes("completed") || eventType.includes("healthy")) {
    return "success";
  }
  return "info";
}

function categorizeEventType(eventType: string): EventCategory {
  if (eventType.startsWith("task.")) {
    return "task";
  }
  if (eventType.startsWith("execution.") || eventType.startsWith("executor.")) {
    return "execution";
  }
  if (eventType.startsWith("goal.")) {
    return "goal";
  }
  if (eventType.startsWith("eval.")) {
    return "eval";
  }
  if (eventType.startsWith("scheduler.")) {
    return "scheduler";
  }
  if (eventType.startsWith("agent.")) {
    return "agent";
  }
  if (eventType.startsWith("plugin.")) {
    return "plugin";
  }
  if (eventType.startsWith("governance.")) {
    return "governance";
  }
  if (eventType.startsWith("environment.")) {
    return "environment";
  }
  return "other";
}

function matchesEventCategory(eventType: string, filter: EventCategory): boolean {
  return filter === "all" || categorizeEventType(eventType) === filter;
}

function formatEventLabel(eventType: string): string {
  return eventType.replaceAll(".", " / ");
}

function eventSummary(event: EventItem): string {
  if (event.message?.trim()) {
    return event.message.trim();
  }
  const correlation = readObject(event.data?.correlation);
  const taskId = typeof correlation.taskId === "string" ? correlation.taskId : event.taskId;
  const executionId = typeof correlation.executionId === "string" ? correlation.executionId : undefined;
  return [taskId ?? event.traceId, executionId].filter(Boolean).join(" · ");
}

function hasChildRepairIssue(task: Task): boolean {
  return task.status === "waiting" && Boolean(task.metadata?.humanLoop?.childIssue?.externalId);
}

function summarizeExecutionState(
  task: Task | null,
  details: TaskDetails,
  events: EventItem[],
  t: Translator
): {
  tone: "neutral" | "warn" | "danger" | "success";
  headline: string;
  detail: string;
} {
  const latestRetryEvent = events.find((event) => event.eventType === "execution.retry_scheduled" || event.eventType === "environment.retry_scheduled");
  const latestBlockEvent = events.find((event) => event.eventType === "execution.blocked" || event.eventType === "environment.blocked");
  const latestSucceeded = details.transitions.find((transition) => transition.to === "succeeded");
  const latestFailedTransition = details.transitions.find((transition) => transition.to === "failed");
  const latestEval = details.evalResults[0];

  if (task?.status === "failed") {
    const failedEvent = events.find((event) => event.eventType === "task.failed");
    const detail = failedEvent?.message?.trim()
      || latestFailedTransition?.reason
      || t("summary.failedFallback");
    return {
      tone: "danger",
      headline: t("summary.failedHeadline"),
      detail
    };
  }
  if (task?.status === "succeeded" && latestSucceeded) {
    return {
      tone: "success",
      headline: t("summary.doneHeadline"),
      detail: latestEval ? t("summary.doneDetail", { score: latestEval.score }) : t("summary.doneFallback")
    };
  }
  if (latestBlockEvent) {
    const payload = latestBlockEvent.data;
    return {
      tone: "danger",
      headline: t("summary.blockedHeadline"),
      detail: buildRetryDetail(payload, t)
    };
  }
  if (latestRetryEvent) {
    const payload = latestRetryEvent.data;
    return {
      tone: "warn",
      headline: t("summary.retryHeadline"),
      detail: buildRetryDetail(payload, t)
    };
  }
  if (task?.status === "active") {
    return {
      tone: "warn",
      headline: t("summary.convergingHeadline"),
      detail: latestEval ? t("summary.latestEval", { score: latestEval.score, risk: latestEval.riskLevel }) : t("summary.awaitingEval")
    };
  }
  return {
    tone: "neutral",
    headline: t("summary.noSignalHeadline"),
    detail: t("summary.noSignalDetail")
  };
}

function buildRetryDetail(data: Record<string, unknown> | undefined, t: Translator): string {
  const payload = readObject(data);
  const attempt = typeof payload.attempt === "number" ? payload.attempt : null;
  const retryLimit = typeof payload.retryLimit === "number" ? payload.retryLimit : null;
  const errorCategory = typeof payload.errorCategory === "string" ? payload.errorCategory : null;
  const timeoutCategory = typeof payload.timeoutCategory === "string" ? payload.timeoutCategory : null;
  const stage = typeof payload.stage === "string" ? payload.stage : null;
  const summary = [stage, errorCategory && errorCategory !== "none" ? errorCategory : null, timeoutCategory && timeoutCategory !== "none" ? timeoutCategory : null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  if (attempt !== null && retryLimit !== null) {
    return `${summary || t("summary.retryBudget")} · ${t("common.attempt", { attempt, limit: retryLimit })}`;
  }
  return summary || t("summary.noRetryMeta");
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
