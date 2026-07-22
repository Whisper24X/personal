import { PluginRuntime } from "./plugin-runtime";
import {
  AgentPlugin,
  CompletionGatePlugin,
  EnvironmentPlugin,
  LogPlugin,
  ObservabilityGovernancePlugin,
  PluginConfig,
  QualityPlugin,
  RuntimePlugin,
  TaskIntegrationPlugin
} from "@diting/plugin-api";

describe("PluginRuntime", () => {
  it("passes plugin configs to init hooks", async () => {
    const initCalls: Array<{ pluginId: string; config: PluginConfig | null }> = [];
    const runtime = new PluginRuntime(
      [
        createAgentPlugin("codex", 10, ["codex"], {
          init: async (config) => {
            initCalls.push({ pluginId: "codex", config });
          }
        }),
        createEnvironmentPlugin("env", 10, {
          init: async (config) => {
            initCalls.push({ pluginId: "env", config });
          }
        })
      ],
      [
        createConfig("codex", "execution", { enabled: false, priority: 99 }),
        createConfig("env", "environment", { enabled: true, priority: 50 })
      ]
    );

    await runtime.init();

    expect(initCalls).toEqual([
      {
        pluginId: "codex",
        config: expect.objectContaining({
          pluginId: "codex",
          enabled: false,
          priority: 99
        })
      },
      {
        pluginId: "env",
        config: expect.objectContaining({
          pluginId: "env",
          enabled: true,
          priority: 50
        })
      }
    ]);
  });

  it("filters disabled plugins out of runtime selection", () => {
    const runtime = new PluginRuntime(
      [
        createTaskIntegrationPlugin("meegle-a", 100, ["meegle"]),
        createTaskIntegrationPlugin("meegle-b", 10, ["meegle"]),
        createAgentPlugin("codex-a", 100, ["codex"]),
        createAgentPlugin("codex-b", 10, ["codex"])
      ],
      [
        createConfig("meegle-a", "task-integration", { enabled: false }),
        createConfig("codex-a", "agent", { enabled: false })
      ]
    );

    expect(runtime.getTaskIntegrations().map((plugin) => plugin.id)).toEqual(["meegle-b"]);
    expect((runtime as any).selectAgentPlugin("codex").id).toBe("codex-b");
  });

  it("uses config priority overrides when selecting plugins", () => {
    const runtime = new PluginRuntime(
      [
        createAgentPlugin("codex-a", 100, ["codex"]),
        createAgentPlugin("codex-b", 10, ["codex"]),
        createEnvironmentPlugin("env-a", 100),
        createEnvironmentPlugin("env-b", 10),
        createQualityPlugin("quality-a", 100),
        createQualityPlugin("quality-b", 10)
      ],
      [
        createConfig("codex-a", "agent", { priority: 1 }),
        createConfig("codex-b", "agent", { priority: 500 }),
        createConfig("env-a", "environment", { priority: 1 }),
        createConfig("env-b", "environment", { priority: 500 }),
        createConfig("quality-a", "quality", { priority: 1 }),
        createConfig("quality-b", "quality", { priority: 500 })
      ]
    );

    expect((runtime as any).selectAgentPlugin("codex").id).toBe("codex-b");
    expect(runtime.selectEnvironmentPlugin().id).toBe("env-b");
    expect(runtime.selectQualityPlugin().id).toBe("quality-b");
  });

  it("returns null when no quality plugin is enabled", () => {
    const runtime = new PluginRuntime(
      [createQualityPlugin("quality", 100)],
      [createConfig("quality", "quality", { enabled: false })]
    );

    expect(runtime.getPrimaryQualityPlugin()).toBeNull();
  });

  it("selects the highest-priority completion gate plugin", () => {
    const runtime = new PluginRuntime(
      [
        createCompletionGatePlugin("completion-a", 100),
        createCompletionGatePlugin("completion-b", 10)
      ],
      [
        createConfig("completion-a", "completion-gate", { priority: 1 }),
        createConfig("completion-b", "completion-gate", { priority: 500 })
      ]
    );

    expect(runtime.getPrimaryCompletionGatePlugin()?.id).toBe("completion-b");
  });

  it("returns null when no completion gate plugin is enabled", () => {
    const runtime = new PluginRuntime(
      [createCompletionGatePlugin("completion", 100)],
      [createConfig("completion", "completion-gate", { enabled: false })]
    );

    expect(runtime.getPrimaryCompletionGatePlugin()).toBeNull();
  });

  it("throws when no enabled plugin matches a required capability", () => {
    const runtime = new PluginRuntime(
      [
        createAgentPlugin("codex", 100, ["codex"]),
        createGovernancePlugin("gov", 100)
      ],
      [createConfig("codex", "agent", { enabled: false })]
    );

    expect(() => (runtime as any).selectAgentPlugin("codex")).toThrow(
      "No agent plugin registered for capability codex"
    );
    expect(runtime.getGovernancePlugins().map((plugin) => plugin.id)).toEqual(["gov"]);
  });

  it("selects the highest-priority log plugin", () => {
    const runtime = new PluginRuntime([
      createLogPlugin("log-a", 10),
      createLogPlugin("log-b", 100)
    ]);

    expect(runtime.selectLogPlugin().id).toBe("log-b");
  });

  it("selects an openspec product driver by agent kind, driver, and runtime provider", () => {
    const runtime = new PluginRuntime([
      createAgentPlugin("coding-codex", 100, ["programming", "codex"], {
        agentKind: "programming",
        driverId: "coding",
        runtimeProviderId: "codex"
      }),
      createAgentPlugin("product-cursor", 80, ["product", "openspec", "cursor"], {
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "cursor"
      }),
      createAgentPlugin("product-codex", 100, ["product", "openspec", "codex"], {
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      })
    ]);

    expect(runtime.selectAgentPluginForTask({
      agentKind: "product",
      driverId: "openspec-product",
      runtimeProviderId: "codex",
      capability: "openspec"
    }).id).toBe("product-codex");
  });

  it("selects a quality orchestrator driver by agent kind, driver, runtime provider and review capability", () => {
    const runtime = new PluginRuntime([
      createAgentPlugin("coding-codex", 100, ["programming", "codex"], {
        agentKind: "programming",
        driverId: "coding",
        runtimeProviderId: "codex"
      }),
      createAgentPlugin("quality-cursor", 80, ["quality", "review", "cursor"], {
        agentKind: "quality",
        driverId: "quality-orchestrator",
        runtimeProviderId: "cursor"
      }),
      createAgentPlugin("quality-codex", 100, ["quality", "review", "codex"], {
        agentKind: "quality",
        driverId: "quality-orchestrator",
        runtimeProviderId: "codex"
      })
    ]);

    expect(runtime.selectAgentPluginForTask({
      agentKind: "quality",
      driverId: "quality-orchestrator",
      runtimeProviderId: "codex",
      capability: "review"
    }).id).toBe("quality-codex");
  });

  it("does not fall back to executor plugins when an explicit agent kind has no match", () => {
    const runtime = new PluginRuntime([
      createAgentPlugin("coding-codex", 100, ["programming", "codex"], {
        agentKind: "programming",
        driverId: "coding",
        runtimeProviderId: "codex"
      })
    ]);

    expect(() => runtime.selectAgentPluginForTask({
      agentKind: "quality",
      driverId: "quality-orchestrator",
      runtimeProviderId: "codex",
      executor: "codex"
    })).toThrow("No agent plugin registered for agent kind quality");
  });

  it("falls back to Cursor for the product driver when Codex is disabled", () => {
    const runtime = new PluginRuntime(
      [
        createAgentPlugin("product-cursor", 80, ["product", "openspec", "cursor"], {
          agentKind: "product",
          driverId: "openspec-product",
          runtimeProviderId: "cursor"
        }),
        createAgentPlugin("product-codex", 100, ["product", "openspec", "codex"], {
          agentKind: "product",
          driverId: "openspec-product",
          runtimeProviderId: "codex"
        })
      ],
      [createConfig("product-codex", "agent", { enabled: false })]
    );

    expect(runtime.selectAgentPluginForTask({
      agentKind: "product",
      driverId: "openspec-product",
      runtimeProviderId: "codex",
      capability: "openspec"
    }).id).toBe("product-cursor");
  });
});

function createConfig(
  pluginId: string,
  kind: PluginConfig["kind"],
  overrides: Partial<Pick<PluginConfig, "enabled" | "priority" | "config">> = {}
): PluginConfig {
  return {
    id: `config-${pluginId}`,
    pluginId,
    kind,
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 10,
    config: overrides.config ?? {},
    updatedAt: new Date("2026-05-11T00:00:00.000Z")
  };
}

function createBasePlugin(
  id: string,
  kind: RuntimePlugin["kind"],
  priority: number,
  capabilities: string[],
  overrides: Partial<RuntimePlugin> = {}
): RuntimePlugin {
  return {
    id,
    kind,
    priority,
    capabilities,
    health: async () => ({ healthy: true, message: "ok" }),
    ...overrides
  };
}

function createTaskIntegrationPlugin(
  id: string,
  priority: number,
  capabilities: string[]
): TaskIntegrationPlugin {
  return {
    ...createBasePlugin(id, "task-integration", priority, capabilities),
    kind: "task-integration",
    pullTasks: async () => [],
    reportResult: async () => undefined
  };
}

function createAgentPlugin(
  id: string,
  priority: number,
  capabilities: string[],
  overrides: Partial<AgentPlugin> = {}
): AgentPlugin {
  return {
    ...createBasePlugin(id, "agent", priority, capabilities, overrides),
    kind: "agent",
    execute: async () => {
      throw new Error("not used");
    },
    ...overrides
  };
}

function createEnvironmentPlugin(
  id: string,
  priority: number,
  overrides: Partial<EnvironmentPlugin> = {}
): EnvironmentPlugin {
  return {
    ...createBasePlugin(id, "environment", priority, ["local"], overrides),
    kind: "environment",
    prepareWorkspace: async () => {
      throw new Error("not used");
    },
    cleanupWorkspace: async () => undefined,
    ...overrides
  };
}

function createLogPlugin(id: string, priority: number): LogPlugin {
  return {
    ...createBasePlugin(id, "log", priority, ["default"]),
    kind: "log",
    append: async () => undefined,
    listByTask: async () => [],
    listByTrace: async () => [],
    listRawByExecution: async () => ({
      scope: "run" as const,
      redacted: true,
      items: [],
      nextCursor: null
    }),
    recentEvents: async () => [],
    snapshotEvents: () => [],
    subscribe: () => () => undefined
  };
}

function createQualityPlugin(
  id: string,
  priority: number,
  overrides: Partial<QualityPlugin> = {}
): QualityPlugin {
  return {
    ...createBasePlugin(id, "quality", priority, ["default"], overrides),
    kind: "quality",
    evaluate: async () => {
      throw new Error("not used");
    },
    ...overrides
  };
}

function createCompletionGatePlugin(
  id: string,
  priority: number,
  overrides: Partial<CompletionGatePlugin> = {}
): CompletionGatePlugin {
  return {
    ...createBasePlugin(id, "completion-gate", priority, ["openspec"], overrides),
    kind: "completion-gate",
    evaluate: async () => ({
      passed: true,
      checks: [],
      incompleteTasks: [],
      repairObjective: null,
      repairDoneWhen: [],
      metadata: {}
    }),
    ...overrides
  };
}

function createGovernancePlugin(id: string, priority: number): ObservabilityGovernancePlugin {
  return {
    ...createBasePlugin(id, "observability-governance", priority, ["events"]),
    kind: "observability-governance"
  };
}
