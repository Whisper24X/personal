import type { Run, RunObservability, RunStage } from "./api";
import { useI18n, type Translator } from "./i18n";

type Agent = {
  id: string;
  status: string;
  executor: string;
  kind?: string;
  driverId?: string | null;
  runtimeProviderId?: string | null;
  taskId: string | null;
};

function parseActivityTime(value: string | null | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareActivityDesc(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}

export function sortRunsByRecentActivity(runs: Run[]): Run[] {
  return [...runs].sort((left, right) => {
    const leftTime = parseActivityTime(left.endedAt ?? left.startedAt);
    const rightTime = parseActivityTime(right.endedAt ?? right.startedAt);
    return compareActivityDesc(leftTime, rightTime);
  });
}

function isActiveAgentStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "running" || normalized === "active";
}

function agentKind(agent: Agent): string {
  return agent.kind ?? agent.executor;
}

function runKind(run: Run): string {
  return run.agentKind ?? run.executor;
}

function runBelongsToAgent(run: Run, agent: Agent, agents: Agent[]): boolean {
  const owner = run.agentId ? agents.find((candidate) => candidate.id === run.agentId) : null;
  const currentAgentKind = agentKind(agent);
  const currentRunKind = runKind(run);

  if (owner && agentKind(owner) === currentRunKind) {
    return run.agentId === agent.id;
  }
  if (currentAgentKind === currentRunKind) {
    return true;
  }
  return run.agentId === agent.id;
}

export function sortAgentsByRecentActivity(agents: Agent[], runs: Run[]): Agent[] {
  const latestRunActivity = new Map<string, number | null>();
  for (const agent of agents) {
    for (const run of runs) {
      if (!runBelongsToAgent(run, agent, agents)) {
        continue;
      }
      const activity = parseActivityTime(run.endedAt ?? run.startedAt);
      const current = latestRunActivity.get(agent.id) ?? null;
      if (current === null || (activity !== null && activity > current)) {
        latestRunActivity.set(agent.id, activity);
      }
    }
  }

  return [...agents].sort((left, right) => {
    const leftActive = isActiveAgentStatus(left.status);
    const rightActive = isActiveAgentStatus(right.status);
    if (leftActive !== rightActive) {
      return leftActive ? -1 : 1;
    }
    const leftTime = latestRunActivity.get(left.id) ?? null;
    const rightTime = latestRunActivity.get(right.id) ?? null;
    return compareActivityDesc(leftTime, rightTime);
  });
}

export function AgentsRunsView(props: {
  agents: Agent[];
  runs: Run[];
  selectedRunId: string | null;
  selectedRun: RunObservability | null;
  onSelectRun(runId: string | null): void;
  onOpenRawLogs(runId: string): void;
  selectedAgentId: string | null;
  onSelectAgent(agentId: string | null): void;
}) {
  const { t } = useI18n();
  const selectedAgent = props.agents.find((a) => a.id === props.selectedAgentId) ?? null;
  const sortedAgents = sortAgentsByRecentActivity(props.agents, props.runs);
  const displayedRuns = sortRunsByRecentActivity(
    selectedAgent
      ? props.runs.filter((run) => runBelongsToAgent(run, selectedAgent, props.agents))
      : props.runs
  );

  return (
    <section className="runs-layout">
      <div className="agent-pool-column">
        <aside className="agent-pool" aria-label={t("runs.agentPool")}>
          <h2>{t("runs.agentPool")}</h2>
          {sortedAgents.length === 0 ? <p className="meta">{t("agents.empty")}</p> : null}
          <div className="agent-list-buttons">
            {sortedAgents.map((agent) => {
              const isSelected = props.selectedAgentId === agent.id;
              const handleSelectAgent = () => {
                props.onSelectAgent(agent.id);
                const matchedRun = sortRunsByRecentActivity(
                  props.runs.filter((run) => runBelongsToAgent(run, agent, props.agents))
                )[0];
                if (matchedRun) {
                  props.onSelectRun(matchedRun.id);
                } else {
                  props.onSelectRun(null);
                }
              };

              return (
                <button
                  key={agent.id}
                  className={isSelected ? "run-card-selected" : ""}
                  onClick={handleSelectAgent}
                  type="button"
                >
                  {agent.id} · {agent.status} · {agent.kind ?? agent.executor}
                </button>
              );
            })}
          </div>
        </aside>

        {props.selectedRunId && props.selectedRun ? (
          <section className="plugin-chain-card" aria-label={t("runs.pluginChain")}>
            <h3>{t("runs.pluginChain")}</h3>
            <div className="plugin-chain-list">
              {props.selectedRun.plugins.map((plugin) => (
                <p key={plugin.pluginId} className="plugin-chain-item">
                  <span className="plugin-id-tag">{plugin.pluginId}</span>
                  <span className={`badge status-${plugin.participationSource === "actual" ? "completed" : "pending"}`}>
                    {plugin.participationSource === "actual" ? t("runs.participated") : t("runs.candidate")}
                  </span>
                </p>
              ))}
              {props.selectedRun.plugins.length === 0 ? <p className="meta">{t("runs.noPluginParticipation")}</p> : null}
            </div>
          </section>
        ) : null}
      </div>

      <section className="run-list" aria-label={t("runs.title")}>
        <h2>{t("runs.title")}</h2>
        {displayedRuns.length === 0 ? <p className="meta">{t("runs.empty")}</p> : null}
        <div className="run-list-buttons">
          {displayedRuns.map((run) => (
            <button
              className={props.selectedRunId === run.id ? "run-card-selected" : ""}
              key={run.id}
              onClick={() => {
                props.onSelectRun(run.id);
                if (selectedAgent && runBelongsToAgent(run, selectedAgent, props.agents)) {
                  props.onSelectAgent(selectedAgent.id);
                } else if (run.agentId) {
                  props.onSelectAgent(run.agentId);
                }
              }}
              type="button"
            >
              {t("runs.run", { id: run.id })} · {run.status}
            </button>
          ))}
        </div>
      </section>

      <div className="run-detail-container">
        {props.selectedRunId && props.selectedRun ? (
          <section className="run-detail-card" aria-label={t("runs.runDetail")}>
            <div className="run-card-header">
              <div>
                <h2>{t("runs.run", { id: props.selectedRun.run.id })}</h2>
                <p className="meta detail-subtitle">
                  {t("runs.route")} {formatRunRoute(props.selectedRun.run, t)}
                </p>
              </div>
              <button
                className="secondary-button raw-log-trigger"
                onClick={() => props.onOpenRawLogs(props.selectedRun!.run.id)}
                type="button"
              >
                {t("runs.viewRawLogs")}
              </button>
            </div>
            <div className="stage-progress">
              {props.selectedRun.stages.map((stage) => (
                <span className={`stage-node stage-${stage.status}`} key={stage.key}>
                  {stage.key}
                </span>
              ))}
            </div>
            <div className="run-lifecycle-panel">
              <div className="subpanel-header">
                <h3>{t("runs.lifecycle")}</h3>
                <span>{props.selectedRun.stages.length}</span>
              </div>
              <div className="run-lifecycle-list">
                {props.selectedRun.stages.map((stage) => (
                  <RunLifecycleItem key={stage.key} stage={stage} t={t} />
                ))}
                {props.selectedRun.stages.length === 0 ? <p className="meta">{t("runs.noLifecycle")}</p> : null}
              </div>
            </div>
          </section>
        ) : selectedAgent ? (
          <section className="run-detail-card" aria-label={t("runs.agentDetail")}>
            <div className="run-card-header">
              <h2>{t("runs.agentHeading", { id: selectedAgent.id })}</h2>
              <span className={`badge status-${selectedAgent.status}`}>{selectedAgent.status}</span>
            </div>
            <div className="agent-detail-body">
              <p className="agent-detail-row"><strong>{t("runs.executor")}</strong> {selectedAgent.executor}</p>
              <p className="agent-detail-row"><strong>{t("runs.taskId")}</strong> {selectedAgent.taskId || t("common.noneValue")}</p>
              <p className="empty-state agent-empty-hint">
                {t("runs.noAgentRuns")}
              </p>
            </div>
          </section>
        ) : (
          <section className="run-detail-card empty-detail">
            <p className="empty-state">{t("runs.noRunSelected")}</p>
          </section>
        )}
      </div>
    </section>
  );
}

function RunLifecycleItem(props: { stage: RunStage; t: Translator }) {
  const summary = props.stage.summary?.trim();

  return (
    <article className={`run-lifecycle-item stage-${props.stage.status}`}>
      <div>
        <p className="run-lifecycle-title">
          {props.stage.label || props.stage.key}
          <span className={`badge status-${props.stage.status}`}>{props.stage.status}</span>
        </p>
        <p className="mono meta">
          {formatStageTimeRange(props.stage, props.t)}
        </p>
        {summary ? <p className="meta run-lifecycle-summary">{summary}</p> : null}
      </div>
    </article>
  );
}

function formatStageTimeRange(stage: RunStage, t: Translator): string {
  const start = stage.startedAt ? formatStageTime(stage.startedAt) : t("common.noneValue");
  const end = stage.endedAt ? formatStageTime(stage.endedAt) : t("common.noneValue");
  return t("runs.stageTimeRange", { start, end });
}

function formatStageTime(value: string): string {
  return value.replace("T", " ").replace(".000Z", " UTC");
}

function formatRunRoute(run: Pick<Run, "executor" | "agentKind" | "driverId" | "runtimeProviderId">, t: Translator): string {
  return [
    run.agentKind ?? run.executor,
    `${t("common.driver")} ${run.driverId ?? "coding"}`,
    `${t("common.runtime")} ${run.runtimeProviderId ?? "auto"}`
  ].join(" · ");
}

function formatAgentRoute(agent: Pick<Agent, "executor" | "kind" | "driverId" | "runtimeProviderId">, t: Translator): string {
  return [
    agent.kind ?? agent.executor,
    `${t("common.driver")} ${agent.driverId ?? "coding"}`,
    `${t("common.runtime")} ${agent.runtimeProviderId ?? "auto"}`
  ].join(" · ");
}
