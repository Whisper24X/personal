import { describe, expect, it } from "vitest";
import {
  detectTaskSyncHint,
  formatTaskSyncHint,
  isMeegleAuthIssue,
  summarizePluginHealthMessage
} from "./task-sync-hints";

const t = (key: string, params?: Record<string, string | number>) => {
  if (params) {
    return `${key}:${JSON.stringify(params)}`;
  }
  return key;
};

describe("summarizePluginHealthMessage", () => {
  it("extracts nested auth error message from JSON envelope", () => {
    const message = JSON.stringify({
      data: null,
      error: {
        code: "AUTH_REQUIRED",
        message: "authentication required"
      }
    });
    expect(summarizePluginHealthMessage(message)).toBe("authentication required");
  });

  it("returns plain text when message is not JSON", () => {
    expect(summarizePluginHealthMessage("Meegle file integration ready")).toBe("Meegle file integration ready");
  });
});

describe("detectTaskSyncHint", () => {
  const meegleAuthError = JSON.stringify({
    error: { code: "AUTH_REQUIRED", message: "authentication required" }
  });

  it("returns null when tasks already exist", () => {
    expect(
      detectTaskSyncHint({
        taskCount: 2,
        plugins: [{ id: "meegle", kind: "task-integration", health: { healthy: false, message: meegleAuthError } }]
      })
    ).toBeNull();
  });

  it("surfaces meegle auth hint when integration is unhealthy", () => {
    const hint = detectTaskSyncHint({
      taskCount: 0,
      plugins: [{ id: "meegle", kind: "task-integration", health: { healthy: false, message: meegleAuthError } }]
    });
    expect(hint?.kind).toBe("meegle_auth_required");
    expect(hint?.action).toBe("authorize_meegle");
  });

  it("suggests sync when meegle is healthy but queue is empty", () => {
    const hint = detectTaskSyncHint({
      taskCount: 0,
      plugins: [{ id: "meegle", kind: "task-integration", health: { healthy: true, message: "ready" } }]
    });
    expect(hint?.kind).toBe("ready_empty");
    expect(hint?.action).toBe("sync");
  });
});

describe("formatTaskSyncHint", () => {
  it("maps hint kind to i18n keys", () => {
    const view = formatTaskSyncHint(
      {
        kind: "meegle_auth_required",
        severity: "warning",
        action: "authorize_meegle",
        healthDetail: "authentication required"
      },
      t
    );
    expect(view.title).toBe("taskSync.meegleAuthRequired.title");
    expect(view.actionLabel).toBe("taskSync.action.authorizeMeegle");
  });
});

describe("isMeegleAuthIssue", () => {
  it("detects no local token reason", () => {
    expect(isMeegleAuthIssue(JSON.stringify({ reason: "no local token" }))).toBe(true);
  });
});
