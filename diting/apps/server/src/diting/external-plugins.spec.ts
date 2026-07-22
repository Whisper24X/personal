import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CONFIG_DEFAULTS, ServerConfig } from "./config";
import { createResolvedPlugins, getExternalPluginPackageName, loadExternalPlugin } from "./external-plugins";

describe("external plugins", () => {
  it("uses the agent package config before the legacy execution package", () => {
    const config = createConfig();
    config.plugins.agents.packageName = "@demo/agent-plugin";
    config.plugins.execution.packageName = "@demo/execution-plugin";

    expect(getExternalPluginPackageName(config, "agent")).toBe("@demo/agent-plugin");
  });

  it("replaces a built-in kind with the configured external package", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-external-quality-"));
    try {
      const modulePath = join(sandbox, "quality-plugin.cjs");
      await writeFile(modulePath, `
module.exports = {
  createPluginPackage() {
    return {
      manifest: {
        id: "external-quality-package",
        displayName: "External Quality",
        version: "1.0.0",
        kind: "quality",
        capabilities: [{ kind: "quality", capability: "default", priority: 250 }]
      },
      createPlugins() {
        return [{
          id: "external-quality",
          kind: "quality",
          priority: 250,
          capabilities: ["default"],
          async health() {
            return { healthy: true, message: "external quality ready" };
          },
          async evaluate() {
            return {
              passed: true,
              score: 100,
              riskLevel: "low",
              checks: [],
              report: {}
            };
          }
        }];
      }
    };
  }
};
`, "utf8");

      const config = createConfig({
        plugins: {
          ...CONFIG_DEFAULTS.plugins,
          quality: {
            packageName: modulePath
          }
        }
      });

      const plugins = await createResolvedPlugins(config);

      expect(plugins.map((plugin) => plugin.id)).toEqual(expect.arrayContaining([
        "root-logs",
        "meegle",
        "git-worktree-local",
        "openspec-completion-gate",
        "external-quality",
        "default-observability-governance"
      ]));
      expect(plugins.some((plugin) => plugin.id.startsWith("codex-"))).toBe(true);
      expect(plugins.some((plugin) => plugin.id.startsWith("cursor-"))).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("throws when an external package exports the wrong plugin kind", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-external-kind-"));
    try {
      const modulePath = join(sandbox, "wrong-kind.cjs");
      await writeFile(modulePath, `
module.exports = {
  createPluginPackage() {
    return {
      manifest: {
        id: "wrong-kind-package",
        displayName: "Wrong Kind",
        version: "1.0.0",
        kind: "environment",
        capabilities: [{ kind: "environment", capability: "local", priority: 100 }]
      },
      createPlugins() {
        return [];
      }
    };
  }
};
`, "utf8");

      await expect(loadExternalPlugin("quality", modulePath, createConfig())).rejects.toThrow(
        `External plugin package ${modulePath} returned manifest kind mismatch for quality`
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("replaces the built-in completion gate with the configured external package", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-external-completion-gate-"));
    try {
      const modulePath = join(sandbox, "completion-gate-plugin.cjs");
      await writeFile(modulePath, `
module.exports = {
  createPluginPackage() {
    return {
      manifest: {
        id: "external-completion-gate-package",
        displayName: "External Completion Gate",
        version: "1.0.0",
        kind: "completion-gate",
        capabilities: [{ kind: "completion-gate", capability: "openspec", priority: 250 }]
      },
      createPlugins() {
        return [{
          id: "external-completion-gate",
          kind: "completion-gate",
          priority: 250,
          capabilities: ["openspec"],
          async health() {
            return { healthy: true, message: "external completion gate ready" };
          },
          async evaluate() {
            return {
              passed: true,
              checks: [],
              incompleteTasks: [],
              repairObjective: null,
              repairDoneWhen: [],
              metadata: {}
            };
          }
        }];
      }
    };
  }
};
`, "utf8");

      const config = createConfig({
        plugins: {
          ...CONFIG_DEFAULTS.plugins,
          completionGate: {
            packageName: modulePath
          }
        }
      });

      const plugins = await createResolvedPlugins(config);

      expect(plugins.map((plugin) => plugin.id)).toContain("external-completion-gate");
      expect(plugins.map((plugin) => plugin.id)).not.toContain("openspec-completion-gate");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("throws when an external package does not export createPlugin", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-external-invalid-"));
    try {
      const modulePath = join(sandbox, "invalid-plugin.cjs");
      await writeFile(modulePath, "module.exports = {};\n", "utf8");

      await expect(loadExternalPlugin("log", modulePath, createConfig())).rejects.toThrow(
        `External plugin package ${modulePath} must export createPluginPackage()`
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects plugins missing required kind-specific methods", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-external-contract-"));
    try {
      const modulePath = join(sandbox, "invalid-quality.cjs");
      await writeFile(modulePath, `
module.exports = {
  createPluginPackage() {
    return {
      manifest: {
        id: "invalid-quality-package",
        displayName: "Invalid Quality",
        version: "1.0.0",
        kind: "quality",
        capabilities: [{ kind: "quality", capability: "default", priority: 100 }]
      },
      createPlugins() {
        return [{
          id: "invalid-quality",
          kind: "quality",
          priority: 100,
          capabilities: ["default"],
          async health() {
            return { healthy: true, message: "ok" };
          }
        }];
      }
    };
  }
};
`, "utf8");

      await expect(loadExternalPlugin("quality", modulePath, createConfig())).rejects.toThrow(
        `External plugin package ${modulePath} is missing required method evaluate() on invalid-quality`
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects completion gate plugins missing evaluate", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-external-completion-contract-"));
    try {
      const modulePath = join(sandbox, "invalid-completion-gate.cjs");
      await writeFile(modulePath, `
module.exports = {
  createPluginPackage() {
    return {
      manifest: {
        id: "invalid-completion-gate-package",
        displayName: "Invalid Completion Gate",
        version: "1.0.0",
        kind: "completion-gate",
        capabilities: [{ kind: "completion-gate", capability: "openspec", priority: 100 }]
      },
      createPlugins() {
        return [{
          id: "invalid-completion-gate",
          kind: "completion-gate",
          priority: 100,
          capabilities: ["openspec"],
          async health() {
            return { healthy: true, message: "ok" };
          }
        }];
      }
    };
  }
};
`, "utf8");

      await expect(loadExternalPlugin("completion-gate", modulePath, createConfig())).rejects.toThrow(
        `External plugin package ${modulePath} is missing required method evaluate() on invalid-completion-gate`
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

function createConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...CONFIG_DEFAULTS,
    ...overrides,
    scheduler: {
      ...CONFIG_DEFAULTS.scheduler,
      ...overrides.scheduler,
      agents: {
        ...CONFIG_DEFAULTS.scheduler.agents,
        ...overrides.scheduler?.agents
      }
    },
    workspace: {
      ...CONFIG_DEFAULTS.workspace,
      ...overrides.workspace
    },
    goalRecovery: {
      ...CONFIG_DEFAULTS.goalRecovery,
      ...overrides.goalRecovery
    },
    plugins: {
      ...CONFIG_DEFAULTS.plugins,
      ...overrides.plugins,
      taskIntegration: {
        ...CONFIG_DEFAULTS.plugins.taskIntegration,
        ...overrides.plugins?.taskIntegration
      },
      execution: {
        ...CONFIG_DEFAULTS.plugins.execution,
        ...overrides.plugins?.execution
      },
      agents: {
        ...CONFIG_DEFAULTS.plugins.agents,
        ...overrides.plugins?.agents
      },
      environment: {
        ...CONFIG_DEFAULTS.plugins.environment,
        ...overrides.plugins?.environment
      },
      completionGate: {
        ...CONFIG_DEFAULTS.plugins.completionGate,
        ...overrides.plugins?.completionGate
      },
      quality: {
        ...CONFIG_DEFAULTS.plugins.quality,
        ...overrides.plugins?.quality
      },
      observabilityGovernance: {
        ...CONFIG_DEFAULTS.plugins.observabilityGovernance,
        ...overrides.plugins?.observabilityGovernance
      },
      log: {
        ...CONFIG_DEFAULTS.plugins.log,
        ...overrides.plugins?.log
      },
      meegle: {
        ...CONFIG_DEFAULTS.plugins.meegle,
        ...overrides.plugins?.meegle
      },
      gitlab: {
        ...CONFIG_DEFAULTS.plugins.gitlab,
        ...overrides.plugins?.gitlab
      }
    },
    governance: {
      ...CONFIG_DEFAULTS.governance,
      ...overrides.governance
    }
  };
}
