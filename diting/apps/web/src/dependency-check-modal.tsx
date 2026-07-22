import type { DependencyCheck, DependencyCheckCategory, DependencyCheckStatus, DependencyCheckSummary } from "./dependency-checks";

const CATEGORY_LABELS: Record<DependencyCheckCategory, string> = {
  "coding-agent": "Coding Agents",
  "task-integration": "Task Integrations",
  platform: "Platform / Repository",
  openspec: "OpenSpec",
  environment: "Environment"
};

const CATEGORY_ORDER: DependencyCheckCategory[] = ["coding-agent", "task-integration", "platform", "environment"];

const STATUS_LABELS: Record<DependencyCheckStatus, string> = {
  ready: "Ready",
  warning: "Needs review",
  blocked: "Action needed",
  checking: "Checking",
  unknown: "Unknown",
  unverified: "Unverified"
};

export function DependencyCheckModal(props: {
  isOpen: boolean;
  summary: DependencyCheckSummary | null;
  checking?: boolean;
  onAction(target: string): void;
  onClose(): void;
  onRecheck(): void;
}) {
  if (!props.isOpen) {
    return null;
  }
  const summary = props.summary ?? { ready: 0, total: 0, degraded: false, checks: [] };
  const grouped = groupChecks(summary.checks);
  const attentionCount = summary.checks.filter((check) => check.status !== "ready").length;
  return (
    <div aria-modal="true" className="modal-backdrop dependency-check-backdrop" role="dialog" aria-label="Dependency checks">
      <section className="modal-card dependency-check-modal-card">
        <header className="dependency-check-header">
          <div>
            <p className="eyebrow compact">依赖检查</p>
            <h2>任务依赖状态</h2>
            <p className="meta">检查任务同步、代码执行和仓库操作依赖是否可用。</p>
          </div>
          <button aria-label="Close dependency checks" className="icon-button" onClick={props.onClose} type="button">×</button>
        </header>

        <div className="dependency-check-progress-row">
          <span className="dependency-ready-pill">{summary.ready}/{summary.total} ready</span>
          {attentionCount > 0 ? (
            <span className="dependency-attention-pill">{attentionCount} need attention</span>
          ) : (
            <span className="dependency-all-ready-pill">All required checks are available</span>
          )}
        </div>

        <div className="dependency-check-groups">
          {CATEGORY_ORDER.filter((category) => grouped[category]?.length).map((category) => (
            <section className="dependency-check-group" key={category}>
              <h3>{CATEGORY_LABELS[category]}</h3>
              {grouped[category]?.map((check) => (
                <DependencyCheckCard check={check} key={check.id} onAction={props.onAction} />
              ))}
            </section>
          ))}
        </div>

        <footer className="dependency-check-footer">
          <span className="meta">可以先跳过，任务开始前仍会执行必需依赖校验。</span>
          <button className="secondary-button" disabled={props.checking} onClick={props.onRecheck} type="button">
            {props.checking ? "Checking..." : "Re-check"}
          </button>
          <button className="primary-button" onClick={props.onClose} type="button">Skip for now</button>
        </footer>
      </section>
    </div>
  );
}

function DependencyCheckCard(props: { check: DependencyCheck; onAction(target: string): void }) {
  const { check } = props;
  return (
    <article className={`dependency-check-card dependency-check-card-${check.status}`}>
      <div className="dependency-check-card-main">
        <div className="dependency-check-title-row">
          <div className="dependency-check-title">
            <StatusDot status={check.status} />
            <h4>{check.label}</h4>
            <span className="dependency-required-badge">{check.required ? "Required" : "Optional"}</span>
            <span className={`dependency-status-badge dependency-status-badge-${check.status}`}>
              {STATUS_LABELS[check.status]}
            </span>
          </div>
          {check.action ? (
            <button className="secondary-button dependency-action-button" onClick={() => props.onAction(check.action!.target)} type="button">
              {check.action.label}
            </button>
          ) : null}
        </div>
        <div className="dependency-check-copy">
          <p className="meta">{check.description}</p>
          <ul className="dependency-check-items">
            {check.items.map((item) => (
              <li key={item.id}>
                <StatusDot status={item.status} />
                <span className="dependency-check-item-label">{item.label}</span>
                <span className="dependency-check-item-detail">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function StatusDot(props: { status: DependencyCheckStatus }) {
  return <span aria-label={props.status} className={`dependency-status-dot dependency-status-${props.status}`} />;
}

function groupChecks(checks: DependencyCheck[]): Partial<Record<DependencyCheckCategory, DependencyCheck[]>> {
  return checks.reduce<Partial<Record<DependencyCheckCategory, DependencyCheck[]>>>((acc, check) => {
    acc[check.category] = [...(acc[check.category] ?? []), check];
    return acc;
  }, {});
}
