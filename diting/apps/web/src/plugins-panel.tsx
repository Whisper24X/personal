import { useState, type ReactNode } from "react";
import { useI18n } from "./i18n";

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

export function PluginsPanel(props: {
  plugins: Plugin[];
  pluginConfigs: PluginConfig[];
  readiness: Readiness | null;
  selectedPluginId: string | null;
  togglingPluginId: string | null;
  onSelectPlugin(id: string): void;
  onTogglePlugin(plugin: Plugin, nextEnabled: boolean): void;
  integrationAuthSlot?: ReactNode;
}) {
  const { t } = useI18n();
  const selectedPlugin = props.plugins.find((plugin) => plugin.id === props.selectedPluginId) ?? props.plugins[0] ?? null;
  const selectedConfig = selectedPlugin
    ? props.pluginConfigs.find((config) => config.pluginId === selectedPlugin.id) ?? null
    : null;
  const selectedEnabled = selectedConfig?.enabled ?? true;
  const toggleBlocked = selectedPlugin ? isPluginToggleBlocked(selectedPlugin.kind) : false;

  return (
    <section className="plugins-page">
      <h2>Plugin Management</h2>
      <div className="plugin-grid">
        {props.plugins.map((plugin) => {
          const config = props.pluginConfigs.find((item) => item.pluginId === plugin.id) ?? null;
          return (
            <button
              className={props.selectedPluginId === plugin.id ? "plugin-card-selected" : ""}
              key={plugin.id}
              onClick={() => props.onSelectPlugin(plugin.id)}
              type="button"
            >
              {plugin.displayName ?? plugin.id} · {plugin.kind} · {plugin.runtimeKind ?? "n/a"} · {plugin.health.healthy ? "healthy" : "unhealthy"} · priority{" "}
              {config?.priority ?? plugin.priority}
            </button>
          );
        })}
        {props.plugins.length === 0 ? <p className="meta">No plugins registered.</p> : null}
      </div>
      {selectedPlugin ? (
        <article className="plugin-detail-card">
          <h3>{selectedPlugin.displayName ?? selectedPlugin.id}</h3>
          <HealthMessage healthy={selectedPlugin.health.healthy} message={selectedPlugin.health.message} />
          <p className="meta">
            {selectedPlugin.kind} · {selectedPlugin.runtimeKind ?? "n/a"} · enabled {String(selectedEnabled)} · priority {selectedConfig?.priority ?? selectedPlugin.priority}
          </p>
          <p className="meta">
            {selectedPlugin.binaryPath ?? "binary n/a"} · {selectedPlugin.runtimeSource ?? "source n/a"}
          </p>
          {toggleBlocked ? (
            <p className="meta">Required plugin; toggling disabled in console.</p>
          ) : (
            <button
              className={selectedEnabled ? "secondary-button" : "primary-button"}
              disabled={props.togglingPluginId === selectedPlugin.id}
              onClick={() => props.onTogglePlugin(selectedPlugin, !selectedEnabled)}
              type="button"
            >
              {props.togglingPluginId === selectedPlugin.id
                ? selectedEnabled
                  ? t("plugins.disabling")
                  : t("plugins.enabling")
                : selectedEnabled
                  ? t("plugins.disable")
                  : t("plugins.enable")}
            </button>
          )}
          {props.integrationAuthSlot}
          <h4>{t("plugins.configJson")}</h4>
          <pre className="config-pre">{JSON.stringify(selectedConfig?.config ?? {}, null, 2)}</pre>
          <h4>{t("plugins.recentEvents")}</h4>
          <p>{t("plugins.noRecentEvents")}</p>
          <h4>{t("plugins.participatingRuns")}</h4>
          <p>{t("plugins.noParticipatingRuns")}</p>
          <div className="detail-metrics plugin-metrics">
            <div className="metric">
              <span className="eyebrow compact">{t("plugins.requiredKind")}</span>
              <strong>{String(props.readiness?.checks.plugins.requiredKinds[selectedPlugin.kind] ?? false)}</strong>
            </div>
            <div className="metric">
              <span className="eyebrow compact">{t("plugins.readiness")}</span>
              <strong>{props.readiness?.checks.plugins.message ?? t("common.unknown")}</strong>
            </div>
          </div>
        </article>
      ) : (
        <p>{t("plugins.noPluginSelected")}</p>
      )}
    </section>
  );
}

function isPluginToggleBlocked(kind: string): boolean {
  return kind === "environment" || kind === "log";
}

function HealthMessage({ healthy, message }: { healthy: boolean; message: string }) {
  const [copied, setCopied] = useState(false);

  // 提取 `command` 形式的内联代码（最多一个 action command）
  const cmdMatch = message.match(/`([^`]+)`/);
  const command = cmdMatch?.[1] ?? null;
  const textBefore = command ? message.slice(0, message.indexOf(`\`${command}\``)) : message;
  const textAfter = command ? message.slice(message.indexOf(`\`${command}\``) + command.length + 2) : "";

  function handleCopy() {
    if (!command) {
      return;
    }
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!healthy && command) {
    return (
      <div>
        <p>
          {textBefore}
          <code className="inline-code">{command}</code>
          {textAfter}
        </p>
        <div className="action-command-box">
          <code>{command}</code>
          <button className="copy-btn" onClick={handleCopy} type="button">
            {copied ? "✓ 已复制" : "复制"}
          </button>
        </div>
      </div>
    );
  }

  return <p>{message}</p>;
}
