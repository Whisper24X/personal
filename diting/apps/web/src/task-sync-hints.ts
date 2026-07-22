type PluginHealth = {
  healthy: boolean;
  message: string;
};

type PluginLike = {
  id: string;
  kind: string;
  health: PluginHealth;
};

export type TaskSyncHintAction = "authorize_meegle" | "open_plugins" | "sync";

export type TaskSyncHintKind =
  | "meegle_auth_required"
  | "meegle_unhealthy"
  | "integration_skipped"
  | "ready_empty"
  | "generic_empty";

export type TaskSyncHint = {
  kind: TaskSyncHintKind;
  severity: "warning" | "info";
  action: TaskSyncHintAction | null;
  healthDetail?: string;
  skippedCount?: number;
};

export type TaskSyncHintView = {
  severity: "warning" | "info";
  title: string;
  detail: string;
  action: TaskSyncHintAction | null;
  actionLabel: string | null;
};

type HintTranslator = (key: string, params?: Record<string, string | number>) => string;

/** 从插件 health.message 中提取可读文案（支持 JSON envelope / 嵌套 error）。 */
export function summarizePluginHealthMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const error = parsed.error;
    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message.trim();
      }
      if (typeof record.code === "string" && record.code.trim()) {
        return record.code.trim();
      }
    }
    if (typeof parsed.reason === "string" && parsed.reason.trim()) {
      return parsed.reason.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // plain text message
  }
  return trimmed;
}

export function isMeegleAuthIssue(message: string): boolean {
  const normalized = summarizePluginHealthMessage(message).toLowerCase();
  return (
    normalized.includes("auth_required") ||
    normalized.includes("authentication required") ||
    normalized.includes("no local token") ||
    normalized.includes("未授权") ||
    normalized.includes("未登录")
  );
}

/** 任务列表为空时，根据插件与 ops 信号识别同步阻塞原因。 */
export function detectTaskSyncHint(input: {
  taskCount: number;
  plugins: PluginLike[];
  integrationSkippedCount?: number;
}): TaskSyncHint | null {
  if (input.taskCount > 0) {
    return null;
  }

  const meegle = input.plugins.find((plugin) => plugin.id === "meegle");
  if (meegle && meegle.kind === "task-integration" && !meegle.health.healthy) {
    const healthDetail = summarizePluginHealthMessage(meegle.health.message);
    if (isMeegleAuthIssue(meegle.health.message)) {
      return {
        kind: "meegle_auth_required",
        severity: "warning",
        action: "authorize_meegle",
        healthDetail: healthDetail || undefined
      };
    }
    return {
      kind: "meegle_unhealthy",
      severity: "warning",
      action: "open_plugins",
      healthDetail: healthDetail || undefined
    };
  }

  const skipped = input.integrationSkippedCount ?? 0;
  if (skipped > 0) {
    return {
      kind: "integration_skipped",
      severity: "warning",
      action: "open_plugins",
      skippedCount: skipped
    };
  }

  if (meegle?.health.healthy) {
    return {
      kind: "ready_empty",
      severity: "info",
      action: "sync"
    };
  }

  return {
    kind: "generic_empty",
    severity: "info",
    action: "sync"
  };
}

export function formatTaskSyncHint(hint: TaskSyncHint, t: HintTranslator): TaskSyncHintView {
  const actionLabel = hint.action
    ? hint.action === "authorize_meegle"
      ? t("taskSync.action.authorizeMeegle")
      : hint.action === "open_plugins"
        ? t("taskSync.action.openPlugins")
        : t("taskSync.action.syncNow")
    : null;

  switch (hint.kind) {
    case "meegle_auth_required":
      return {
        severity: hint.severity,
        title: t("taskSync.meegleAuthRequired.title"),
        detail: t("taskSync.meegleAuthRequired.detail", {
          reason: hint.healthDetail ? ` (${hint.healthDetail})` : ""
        }),
        action: hint.action,
        actionLabel
      };
    case "meegle_unhealthy":
      return {
        severity: hint.severity,
        title: t("taskSync.meegleUnhealthy.title"),
        detail: t("taskSync.meegleUnhealthy.detail", {
          reason: hint.healthDetail ?? t("common.unknown")
        }),
        action: hint.action,
        actionLabel
      };
    case "integration_skipped":
      return {
        severity: hint.severity,
        title: t("taskSync.integrationSkipped.title"),
        detail: t("taskSync.integrationSkipped.detail", { count: hint.skippedCount ?? 0 }),
        action: hint.action,
        actionLabel
      };
    case "ready_empty":
      return {
        severity: hint.severity,
        title: t("taskSync.readyEmpty.title"),
        detail: t("taskSync.readyEmpty.detail"),
        action: hint.action,
        actionLabel
      };
    default:
      return {
        severity: hint.severity,
        title: t("taskSync.genericEmpty.title"),
        detail: t("taskSync.genericEmpty.detail"),
        action: hint.action,
        actionLabel
      };
  }
}
